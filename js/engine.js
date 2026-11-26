// Stockfish (WebAssembly) als Web Worker: ein Pool für die Partieanalyse
// und eine Live-Instanz für eigene Varianten.
import { Chess } from '../vendor/chess.js';

const SINGLE_URL = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url).href;
// Mehrkern-Fassung: braucht SharedArrayBuffer, also eine „cross-origin isolated“ Seite (COOP/COEP-Header).
const MULTI_URL = new URL('../vendor/stockfish/stockfish-19-lite.js', import.meta.url).href;

/** Dünne UCI-Hülle um einen Stockfish-Worker. */
class UciWorker {
  constructor(url = SINGLE_URL) {
    this.url = url;
    this.worker = new Worker(url);
    this.listeners = new Set();
    this.worker.onmessage = (ev) => {
      const line = typeof ev.data === 'string' ? ev.data : '';
      for (const fn of [...this.listeners]) fn(line);
    };
    this.failed = new Promise((_, reject) => {
      this.worker.onerror = (ev) => reject(new Error(ev.message || 'Die Schach-Engine konnte nicht geladen werden.'));
    });
    this.failed.catch(() => {});
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  waitFor(test) {
    const hit = new Promise((resolve) => {
      const fn = (line) => {
        if (test(line)) {
          this.listeners.delete(fn);
          resolve(line);
        }
      };
      this.listeners.add(fn);
    });
    return Promise.race([hit, this.failed]);
  }

  /**
   * @param multiPv  Zahl der Linien
   * @param opts     threads/hash überschreiben; timeout = so lange höchstens auf die Engine warten (ms)
   */
  async init(multiPv, { threads = 1, hash = ENGINE_PROFILE.hash, timeout = 0 } = {}) {
    // Der Worker lädt das WASM-Modul asynchron – „uci“ wiederholen, bis er antwortet
    this.send('uci');
    const retry = setInterval(() => this.send('uci'), 700);
    let timer = null;
    try {
      const ok = this.waitFor((l) => l === 'uciok');
      await (timeout ? Promise.race([ok, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Die Engine antwortet nicht.')), timeout); })]) : ok);
    } finally {
      clearInterval(retry);
      clearTimeout(timer);
    }
    if (threads > 1) this.send(`setoption name Threads value ${threads}`);
    this.send(`setoption name Hash value ${hash}`);
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  terminate() {
    this.worker.terminate();
  }
}

/** Liest eine „info …“-Zeile. Bewertung aus Sicht der Seite am Zug. */
function parseInfo(line) {
  if (!line.startsWith('info') || !line.includes(' pv ') || /bound/.test(line)) return null;
  const depth = +(line.match(/ depth (\d+)/) || [])[1];
  const multipv = +(line.match(/ multipv (\d+)/) || [0, 1])[1];
  const score = line.match(/ score (cp|mate) (-?\d+)/);
  if (!score || !depth) return null;
  const pv = line.split(' pv ')[1].trim().split(/\s+/);
  return { depth, multipv, type: score[1], value: +score[2], pv };
}

/** Wandelt Engine-Zeilen in Linien aus Sicht von Weiß um. */
function toLines(infos, fen) {
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
  return infos.filter(Boolean).map((i) => ({
    move: i.pv[0],
    pv: i.pv,
    depth: i.depth,
    eval: { type: i.type, value: i.value * sign },
  }));
}

/** Bewertung von Endstellungen ohne Engine. Gibt null zurück, wenn die Partie weitergeht. */
export function terminalEval(fen) {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    // Seite am Zug ist matt
    return { lines: [], eval: { type: 'mate', value: 0, winner: chess.turn() === 'w' ? 'b' : 'w' }, terminal: 'mate' };
  }
  if (chess.isStalemate() || chess.isInsufficientMaterial()) {
    return { lines: [], eval: { type: 'cp', value: 0 }, terminal: 'draw' };
  }
  return null;
}

async function search(uci, fen, { depth, movetime, onUpdate }) {
  const infos = [];
  const onLine = (line) => {
    const info = parseInfo(line);
    if (!info) return;
    infos[info.multipv - 1] = info;
    if (onUpdate) onUpdate(toLines(infos, fen));
  };
  uci.listeners.add(onLine);
  uci.send('position fen ' + fen);
  uci.send(`go depth ${depth}` + (movetime ? ` movetime ${movetime}` : ''));
  try {
    await uci.waitFor((l) => l.startsWith('bestmove'));
  } finally {
    uci.listeners.delete(onLine);
  }
  // Linien mit veralteter Tiefe (abgebrochene Iteration) aussortieren
  const top = infos[0] ? infos[0].depth : 0;
  return toLines(infos.filter((i) => i && i.depth >= top - 1), fen);
}

const CORES = navigator.hardwareConcurrency || 2;
const MEMORY = navigator.deviceMemory || 8; // nicht jeder Browser verrät den Speicher – dann von einem normalen PC ausgehen
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || MEMORY <= 4;
// Mehrere Kerne für eine einzige Stellung gibt es nur, wenn der Browser es sicher erlaubt.
// Auf Handys bleibt es bei einem Kern pro Engine (Akku, Wärme); alle anderen Geräte nutzen wie bisher die Einzelfassung.
const CAN_THREAD = !MOBILE && CORES >= 4 && typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;

/**
 * Zahl der parallelen Engines für die Partieanalyse, Hash-Größe und Kerne für die Live-Engine –
 * auf Handys und schwachen Geräten sparsamer, auf starken Rechnern mehr.
 */
export const ENGINE_PROFILE = {
  workers: Math.max(1, Math.min(MOBILE ? 2 : MEMORY >= 8 && CORES >= 8 ? 6 : 4, CORES - 1)),
  hash: MOBILE ? 16 : 32,
  liveThreads: CAN_THREAD ? Math.min(4, CORES - 1) : 1,
  liveHash: MOBILE ? 16 : CAN_THREAD ? 64 : 32,
};

/**
 * Startet eine Engine für eine einzelne Stellung (Live-Analyse): wenn möglich mit mehreren Kernen,
 * sonst – oder wenn die Mehrkern-Fassung nicht startet – mit der bewährten Einzelfassung.
 */
async function startSingleOrMulti(multiPv) {
  if (ENGINE_PROFILE.liveThreads > 1) {
    const uci = new UciWorker(MULTI_URL);
    try {
      await uci.init(multiPv, { threads: ENGINE_PROFILE.liveThreads, hash: ENGINE_PROFILE.liveHash, timeout: 12000 });
      return uci;
    } catch (e) {
      uci.terminate();
      ENGINE_PROFILE.liveThreads = 1;
      ENGINE_PROFILE.liveHash = ENGINE_PROFILE.hash;
    }
  }
  const uci = new UciWorker(SINGLE_URL);
  await uci.init(multiPv, { hash: ENGINE_PROFILE.liveHash });
  return uci;
}

// Die Analyse-Worker bleiben zwischen den Partien am Leben (das Laden der Engine kostet sonst jedes Mal Zeit).
const workers = [];
let lastRun = Promise.resolve();

async function acquire(n) {
  while (workers.length < n) {
    const uci = new UciWorker();
    uci.ready = uci.init(2).catch((e) => {
      workers.splice(workers.indexOf(uci), 1);
      uci.terminate();
      throw e;
    });
    workers.push(uci);
  }
  const list = workers.slice(0, n);
  await Promise.all(list.map((w) => w.ready));
  return list;
}

/** Lädt die Engine schon im Voraus, z. B. während der Link eingefügt wird. */
export function warmEngine() {
  acquire(ENGINE_PROFILE.workers).catch(() => {});
}

/** Analysiert alle Stellungen einer Partie parallel in mehreren Workern. */
export class AnalysisPool {
  constructor() {
    this.cancelled = false;
    this.active = [];
  }

  /**
   * @param fens   Stellungen der Partie
   * @param known  bereits bekannte Ergebnisse (Index → Ergebnis), z. B. Buchzüge oder Cache-Treffer
   */
  async analyze(fens, { depth = 14, onProgress, known = {} } = {}) {
    const results = new Array(fens.length);
    const queue = [];
    fens.forEach((fen, i) => {
      const t = terminalEval(fen);
      if (t) results[i] = t;
      else if (known[i]) results[i] = known[i];
      else queue.push(i);
    });
    const total = queue.length;
    let done = 0;
    const movetime = depth <= 12 ? 2500 : depth <= 16 ? 6000 : 15000;
    // In zusammenhängenden Blöcken rechnen, innerhalb eines Blocks von hinten nach vorn: Die nächste Stellung
    // ist dann die Vorgängerin der gerade gerechneten, und die Engine findet vieles schon in ihrer Hash-Tabelle.
    const blocks = [];

    // erst starten, wenn eine vorher abgebrochene Analyse ihre Worker freigegeben hat
    const previous = lastRun;
    let release;
    lastRun = new Promise((r) => { release = r; });
    try {
      await previous;
      if (this.cancelled) throw new Error('abgebrochen');
      this.active = await acquire(Math.min(ENGINE_PROFILE.workers, Math.max(1, total)));
      const size = Math.max(4, Math.min(12, Math.ceil(total / (this.active.length * 2))));
      for (let s = 0; s < queue.length; s += size) blocks.push(queue.slice(s, s + size).reverse());
      const run = async (uci) => {
        while (blocks.length && !this.cancelled) {
          for (const i of blocks.shift()) {
            const lines = await search(uci, fens[i], { depth, movetime });
            if (this.cancelled) return;
            results[i] = { lines, eval: lines[0] ? lines[0].eval : { type: 'cp', value: 0 }, fresh: true };
            done++;
            onProgress && onProgress(done, total, i, results[i]);
          }
        }
      };
      await Promise.all(this.active.map(run));
    } finally {
      this.active = [];
      release();
    }
    if (this.cancelled) throw new Error('abgebrochen');
    return results;
  }

  cancel() {
    this.cancelled = true;
    this.active.forEach((w) => w.send('stop'));
  }
}

/** Dauerhafte Engine für Varianten: immer nur die zuletzt angefragte Stellung zählt. */
export class LiveEngine {
  constructor() {
    this.uci = null;
    this.ready = null;
    this.token = 0;
    this.busy = false;
    this.pending = null;
    this.multipv = 3;
  }

  async ensure() {
    if (!this.ready) {
      this.ready = startSingleOrMulti(3).then((uci) => { this.uci = uci; });
      this.ready.catch(() => { this.ready = null; });
    }
    return this.ready;
  }

  /** Startet die Analyse einer Stellung; onUpdate bekommt laufend die besten Linien. */
  analyze(fen, { depth = 18, onUpdate, onDone, onCancel } = {}) {
    const token = ++this.token;
    const t = terminalEval(fen);
    if (t) {
      this.stop();
      onUpdate && onUpdate([], t);
      onDone && onDone([], t);
      return;
    }
    if (this.pending && this.pending.onCancel) this.pending.onCancel();
    this.pending = { fen, depth, onUpdate, onDone, onCancel, token };
    if (this.busy) {
      // Startet die Engine gerade noch, übernimmt pump() den Auftrag danach von selbst.
      if (this.uci) this.uci.send('stop');
      return;
    }
    this.pump();
  }

  async pump() {
    this.busy = true;
    let job = null;
    try {
      await this.ensure();
      while (this.pending) {
        job = this.pending;
        this.pending = null;
        this.uci.send(`setoption name MultiPV value ${Math.max(1, this.multipv)}`);
        const lines = await search(this.uci, job.fen, {
          depth: job.depth,
          onUpdate: (l) => {
            if (job.token === this.token && job.onUpdate) job.onUpdate(l, null);
          },
        });
        if (job.token === this.token) job.onDone && job.onDone(lines, null);
        else job.onCancel && job.onCancel();
        job = null;
      }
    } catch (e) {
      // Engine ließ sich nicht starten: Wartende nicht hängen lassen (z. B. „Nochmal versuchen“)
      console.error(e);
      for (const j of [job, this.pending]) if (j && j.onCancel) j.onCancel();
      this.pending = null;
    } finally {
      this.busy = false;
    }
  }

  /** Einmalige Bewertung einer Stellung (für „Nochmal versuchen“). */
  evaluate(fen, depth = 13) {
    return new Promise((resolve) => {
      this.analyze(fen, {
        depth,
        onDone: (lines, terminal) => resolve({ lines, terminal }),
        onCancel: () => resolve(null),
      });
    });
  }

  stop() {
    this.token++;
    if (this.pending && this.pending.onCancel) this.pending.onCancel();
    this.pending = null;
    if (this.busy && this.uci) this.uci.send('stop');
  }
}

/** Engine als Spielgegner: liefert für eine Stellung die besten Linien bei begrenzter Tiefe und Spielstärke. */
export class EnginePlayer {
  constructor() {
    this.uci = null;
    this.ready = null;
  }

  ensure() {
    if (!this.ready) {
      this.uci = new UciWorker();
      this.ready = this.uci.init(4);
    }
    return this.ready;
  }

  /** @returns Linien (beste zuerst) aus Sicht von Weiß */
  async lines(fen, { depth = 8, skill = 20, multipv = 4 } = {}) {
    await this.ensure();
    this.uci.send(`setoption name Skill Level value ${skill}`);
    this.uci.send(`setoption name MultiPV value ${multipv}`);
    return search(this.uci, fen, { depth, movetime: 2500 });
  }

  stop() {
    if (this.uci) this.uci.send('stop');
  }
}
