// PGN schreiben (auch mit Bewertungen und Uhrzeiten), mehrere Partien aus einer Datei trennen
// und Partien für einen Teilen-Link packen.
import { Chess } from '../vendor/chess.js';
const NAG = { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', miss: '?', blunder: '??' };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const clk = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const evalTag = (ev) => (ev.type === 'mate' ? (ev.value === 0 ? null : `#${ev.value}`) : (ev.value / 100).toFixed(2));

/** Zugfolge (UCI) ab einer Stellung als PGN-Text mit Zugnummern, z. B. „4... Bxf3 5. Qxf3“. */
function lineSan(fen, ucis) {
  const chess = new Chess(fen);
  let num = +fen.split(' ')[5] || 1;
  let out = '';
  ucis.forEach((uci, i) => {
    let m;
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch (e) {
      return;
    }
    if (m.color === 'w') out += `${num}. `;
    else if (i === 0) out += `${num}... `;
    out += m.san + ' ';
    if (m.color === 'b') num++;
  });
  return out.trim();
}

const commentText = (t) => String(t).replace(/[{}]/g, (c) => (c === '{' ? '(' : ')')).replace(/\s+/g, ' ').trim();

/**
 * @param game    Partie
 * @param review  optional: Analyse – dann mit Zugbewertungen (!!, ?, ??), [%eval] und [%clk]
 * @param annot   optional: eigene Notizen (als Kommentare) und gespeicherte Varianten (als Nebenvarianten)
 */
export function buildPgn(game, review = null, annot = null) {
  const head = [
    ['Event', game.url && /lichess/.test(game.url) ? 'Lichess' : game.url ? 'Chess.com' : 'Partie'],
    ['Site', game.url || '?'],
    ['Date', game.date ? game.date.replace(/-/g, '.') : '????.??.??'],
    ['White', game.white.name], ['Black', game.black.name], ['Result', game.result || '*'],
  ];
  if (game.white.rating) head.push(['WhiteElo', game.white.rating]);
  if (game.black.rating) head.push(['BlackElo', game.black.rating]);
  if (game.timeControl) head.push(['TimeControl', game.timeControl]);
  if (game.termination) head.push(['Termination', game.termination]);
  if (review && review.opening) head.push(['ECO', review.opening.eco], ['Opening', review.opening.name]);
  if (game.startFen !== START) head.push(['SetUp', '1'], ['FEN', game.startFen]);
  if (review) head.push(['Annotator', 'Chess Analyzer (Stockfish)']);

  const parts = game.startFen.split(' ');
  let num = +parts[5] || 1;
  let white = parts[1] === 'w';
  let body = '';
  let needNumber = true;
  const notes = (annot && annot.notes) || {};
  const lines = (annot && annot.lines) || [];
  if (notes[0]) body += `{ ${commentText(notes[0])} } `;
  game.moves.forEach((m, k) => {
    if (white) body += `${num}. `;
    else if (needNumber) body += `${num}... `;
    body += m.san + (review && NAG[review.moves[k].cls] ? NAG[review.moves[k].cls] : '') + ' ';
    const tags = [];
    if (review) {
      const e = evalTag(review.evals[k + 1]);
      if (e) tags.push(`[%eval ${e}]`);
    }
    if (m.clock != null) tags.push(`[%clk ${clk(m.clock)}]`);
    if (notes[k + 1]) tags.push(commentText(notes[k + 1]));
    needNumber = tags.length > 0;
    if (tags.length) body += `{ ${tags.join(' ')} } `;
    // Gespeicherte Varianten, die diesen Zug ersetzen, stehen als Nebenvariante direkt dahinter
    for (const line of lines) {
      if (line.base !== k || !game.fens || !game.fens[k]) continue;
      const text = lineSan(game.fens[k], line.ucis);
      if (text) {
        body += `(${text}) `;
        needNumber = true;
      }
    }
    if (!white) num++;
    white = !white;
  });
  // Varianten ab der Schlussstellung lassen sich in PGN nicht als Nebenvariante schreiben – als Kommentar anhängen
  for (const line of lines) {
    if (line.base !== game.moves.length || !game.fens) continue;
    const text = lineSan(game.fens[line.base], line.ucis);
    if (text) body += `{ Variante: ${text} } `;
  }
  return head.map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n') + '\n\n' + body + (game.result || '*') + '\n';
}

/** Trennt eine PGN-Datei mit mehreren Partien in einzelne PGN-Texte. */
export function splitPgn(text) {
  const games = String(text).replace(/\r/g, '').split(/\n(?=\[Event\s+")/).map((g) => g.trim()).filter(Boolean);
  return games.length ? games : [String(text).trim()];
}

/** Liest eine Kopfzeile aus einem PGN-Text. */
export function pgnTag(pgn, key) {
  const m = pgn.match(new RegExp('\\[' + key + '\\s+"([^"]*)"\\]'));
  return m ? m[1] : '';
}

const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Packt ein PGN für die Adresszeile (komprimiert, URL-sicher). */
export async function packPgn(pgn) {
  const raw = new TextEncoder().encode(pgn);
  if (typeof CompressionStream === 'undefined') return 'r' + b64(raw);
  return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function unpackPgn(packed) {
  const bytes = unb64(packed.slice(1));
  if (packed[0] === 'r') return new TextDecoder().decode(bytes);
  return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
}

// ---------------------------------------------------------------------------
// Teilen-Link mit fertiger Analyse: Partie + Engine-Ergebnisse kompakt gepackt, damit der Empfänger
// nichts neu rechnen muss. Alles steckt im Link selbst (nach dem #) – kein Server, kein Speicher.
// ---------------------------------------------------------------------------

const evOut = (ev) => (ev.type === 'mate' ? 'M' + ev.value : ev.value);
const evIn = (x) => (typeof x === 'string' && x[0] === 'M' ? { type: 'mate', value: +x.slice(1) } : { type: 'cp', value: +x || 0 });

/** @returns gepackter Text für „#a=…“ */
export async function packAnalysis(game, positions, depth) {
  const p = positions.map((pos) => {
    if (pos.terminal) return 't';
    if (pos.book) return 'b';
    return [evOut(pos.eval), ...pos.lines.slice(0, 2).map((l, i) => [l.pv.slice(0, i ? 6 : 10).join(' '), evOut(l.eval), l.depth || 0])];
  });
  return packPgn(JSON.stringify({ v: 1, id: game.id, d: depth, pgn: buildPgn(game), p }));
}

/**
 * Liest einen gepackten Analyse-Link. Endstellungen (Matt, Patt …) ergänzt der Aufrufer selbst.
 * @returns { pgn, id, depth, positions } – positions[i] ist 'terminal' oder ein Engine-Ergebnis
 */
export async function unpackAnalysis(packed) {
  const data = JSON.parse(await unpackPgn(packed));
  if (!data || data.v !== 1 || typeof data.pgn !== 'string' || !Array.isArray(data.p)) throw new Error('kein Analyse-Link');
  const positions = data.p.map((x) => {
    if (x === 't') return 'terminal';
    if (x === 'b') return { lines: [], eval: { type: 'cp', value: 20 }, book: true };
    if (!Array.isArray(x)) throw new Error('beschädigt');
    const [e, ...lines] = x;
    return {
      eval: evIn(e),
      lines: lines.map(([pv, ev, depth]) => {
        const moves = String(pv || '').split(' ').filter((u) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u));
        return { move: moves[0], pv: moves, eval: evIn(ev), depth: +depth || 0 };
      }).filter((l) => l.move),
    };
  });
  const id = typeof data.id === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(data.id) ? data.id : null;
  return { pgn: data.pgn, id, depth: +data.d || 0, positions };
}
