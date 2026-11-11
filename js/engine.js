// Stockfish (WebAssembly) als Web Worker: ein Pool für die Partieanalyse
// und eine Live-Instanz für eigene Varianten.
import { Chess } from '../vendor/chess.js';

const ENGINE_URL = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url).href;

/** Dünne UCI-Hülle um einen Stockfish-Worker. */
class UciWorker {
  constructor() {
    this.worker = new Worker(ENGINE_URL);
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

  async init(multiPv) {
    // Der Worker lädt das WASM-Modul asynchron – „uci“ wiederholen, bis er antwortet
    this.send('uci');
    const retry = setInterval(() => this.send('uci'), 700);
    try {
      await this.waitFor((l) => l === 'uciok');
    } finally {
      clearInterval(retry);
    }
    this.send('setoption name Hash value 32');
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

/** Analysiert alle Stellungen einer Partie parallel in mehreren Workern. */
export class AnalysisPool {
  constructor() {
    const cores = navigator.hardwareConcurrency || 2;
    this.size = Math.max(1, Math.min(4, cores - 1));
    this.workers = [];
    this.cancelled = false;
  }

  async analyze(fens, { depth = 14, onProgress } = {}) {
    const results = new Array(fens.length);
    const queue = [];
    fens.forEach((fen, i) => {
      const t = terminalEval(fen);
      if (t) results[i] = t;
      else queue.push(i);
    });
    const total = queue.length;
    let done = 0;
    const movetime = depth <= 12 ? 2500 : depth <= 16 ? 6000 : 15000;

    const run = async () => {
      const uci = new UciWorker();
      this.workers.push(uci);
      await uci.init(2);
      while (queue.length && !this.cancelled) {
        const i = queue.shift();
        const lines = await search(uci, fens[i], { depth, movetime });
        if (this.cancelled) return;
        results[i] = { lines, eval: lines[0] ? lines[0].eval : { type: 'cp', value: 0 } };
        done++;
        onProgress && onProgress(done, total, i);
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(this.size, Math.max(1, total)) }, run));
    } finally {
      this.dispose();
    }
    if (this.cancelled) throw new Error('abgebrochen');
    return results;
  }

  cancel() {
    this.cancelled = true;
    this.dispose();
  }

  dispose() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
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
  }

  async ensure() {
    if (!this.ready) {
      this.uci = new UciWorker();
      this.ready = this.uci.init(3);
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
      this.uci.send('stop');
      return;
    }
    this.pump();
  }

  async pump() {
    this.busy = true;
    try {
      await this.ensure();
      while (this.pending) {
        const job = this.pending;
        this.pending = null;
        const lines = await search(this.uci, job.fen, {
          depth: job.depth,
          onUpdate: (l) => {
            if (job.token === this.token && job.onUpdate) job.onUpdate(l, null);
          },
        });
        if (job.token === this.token) job.onDone && job.onDone(lines, null);
        else job.onCancel && job.onCancel();
      }
    } catch (e) {
      console.error(e);
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
