// Kleine taktische Helfer auf Basis von chess.js (Abtausch-Bewertung, hängende Figuren, Gabeln).
import { Chess } from '../vendor/chess.js';

export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Statische Abtausch-Bewertung: Wie viel Material gewinnt die Seite am Zug,
 * wenn sie auf `square` schlägt (0 = Schlagen lohnt sich nicht / ist nicht möglich).
 */
export function see(chess, square, depth = 0) {
  if (depth > 12) return 0;
  const caps = chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured && !m.isEnPassant());
  if (!caps.length) return 0;
  caps.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
  const m = caps[0];
  const gain = VAL[m.captured] + (m.promotion ? VAL[m.promotion] - 1 : 0);
  chess.move(m);
  const reply = see(chess, square, depth + 1);
  chess.undo();
  return Math.max(0, gain - reply);
}

/** Dieselbe Stellung, aber die andere Seite ist am Zug (null, wenn das nicht erlaubt ist). */
export function flipTurn(fen) {
  const chess = new Chess(fen);
  if (chess.isCheck()) return null;
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  try {
    const flipped = new Chess(p.join(' '));
    return flipped.fen();
  } catch (e) {
    return null;
  }
}

/**
 * Figuren von `color`, die der Gegner mit Materialgewinn schlagen kann.
 * Rückgabe absteigend nach Gewinn: [{ square, type, gain }]
 */
export function hangingPieces(fen, color) {
  let f = fen;
  if (fen.split(' ')[1] === color) {
    f = flipTurn(fen);
    if (!f) return [];
  }
  const chess = new Chess(f);
  const out = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === 'k') continue;
      const gain = see(chess, sq.square);
      if (gain > 0) out.push({ square: sq.square, type: sq.type, gain });
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** Gegnerische Figuren, die die Figur auf `square` angreift. */
export function attackedBy(chess, square) {
  const piece = chess.get(square);
  if (!piece) return [];
  const out = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color === piece.color) continue;
      if (chess.attackers(sq.square, piece.color).includes(square)) out.push({ square: sq.square, type: sq.type });
    }
  }
  return out;
}

/** Erkennt eine Gabel: die Figur auf `square` greift mindestens zwei lohnende Ziele an. */
export function forkTargets(chess, square) {
  const piece = chess.get(square);
  if (!piece) return [];
  const enemy = piece.color === 'w' ? 'b' : 'w';
  const targets = attackedBy(chess, square).filter((t) => {
    if (t.type === 'k') return true;
    if (VAL[t.type] > VAL[piece.type]) return true;
    // gleich- oder minderwertige Figur zählt nur, wenn sie ungedeckt ist
    return t.type !== 'p' && chess.attackers(t.square, enemy).length === 0;
  });
  return targets.length >= 2 ? targets : [];
}

/** Material beider Seiten in Bauerneinheiten und geschlagene Figuren. */
export function materialInfo(fen) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if (count.w[t] === undefined) continue;
    count[ch === t ? 'b' : 'w'][t]++;
  }
  const points = (c) => Object.keys(start).reduce((s, t) => s + count[c][t] * VAL[t], 0);
  const lost = (c) => {
    const out = [];
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      for (let i = 0; i < Math.max(0, start[t] - count[c][t]); i++) out.push(t);
    }
    return out;
  };
  return {
    diff: points('w') - points('b'),
    capturedByWhite: lost('b'),
    capturedByBlack: lost('w'),
    total: points('w') + points('b'),
  };
}

const DIRS = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
};
DIRS.q = [...DIRS.b, ...DIRS.r];

/**
 * Fesselungen, die der Läufer/Turm/die Dame auf `square` ausübt:
 * gegnerische Figur, hinter der auf derselben Linie König oder Dame steht.
 * → [{ square, type, behind: 'k' | 'q' }]
 */
export function pinsBy(chess, square) {
  const piece = chess.get(square);
  if (!piece || !DIRS[piece.type]) return [];
  const out = [];
  const f0 = square.charCodeAt(0) - 97, r0 = +square[1] - 1;
  for (const [df, dr] of DIRS[piece.type]) {
    let first = null;
    for (let f = f0 + df, r = r0 + dr; f >= 0 && f < 8 && r >= 0 && r < 8; f += df, r += dr) {
      const sq = String.fromCharCode(97 + f) + (r + 1);
      const p = chess.get(sq);
      if (!p) continue;
      if (!first) {
        if (p.color === piece.color || p.type === 'k' || p.type === 'p') break;
        first = { square: sq, type: p.type };
        continue;
      }
      if (p.color !== piece.color) {
        if (p.type === 'k') out.push({ ...first, behind: 'k' });
        else if (p.type === 'q' && first.type !== 'q' && piece.type !== 'q') out.push({ ...first, behind: 'q' });
      }
      break;
    }
  }
  return out;
}

/** Droht die Seite, die gerade gezogen hat, ein Matt in einem Zug? */
export function mateThreat(fenAfter) {
  const flipped = flipTurn(fenAfter);
  if (!flipped) return false;
  const chess = new Chess(flipped);
  for (const m of chess.moves({ verbose: true })) {
    if (!m.san.endsWith('#')) continue;
    return true;
  }
  return false;
}
