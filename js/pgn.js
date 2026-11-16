// PGN schreiben (auch mit Bewertungen und Uhrzeiten), mehrere Partien aus einer Datei trennen
// und Partien für einen Teilen-Link packen.
const NAG = { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', miss: '?', blunder: '??' };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const clk = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const evalTag = (ev) => (ev.type === 'mate' ? (ev.value === 0 ? null : `#${ev.value}`) : (ev.value / 100).toFixed(2));

/**
 * @param game    Partie
 * @param review  optional: Analyse – dann mit Zugbewertungen (!!, ?, ??), [%eval] und [%clk]
 */
export function buildPgn(game, review = null) {
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
    needNumber = tags.length > 0;
    if (tags.length) body += `{ ${tags.join(' ')} } `;
    if (!white) num++;
    white = !white;
  });
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
