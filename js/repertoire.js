// Eröffnungs-Repertoire: welche Eröffnungen man mit Weiß und mit Schwarz spielt – und wo man in einer
// echten Partie davon abgewichen ist. Reine Logik ohne Oberfläche (die steckt in trainers.js und app.js).
import { Chess } from '../vendor/chess.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const MAX_LINES = 40;
export const MAX_PLIES = 30;

/** { w: [Linie], b: [Linie] } – Linie: { id, name, moves: 'e4 e5 Nf3 …' (englische SAN), opening? } */
export function getRepertoire(store) {
  const r = store.get('repertoire', null);
  return { w: Array.isArray(r && r.w) ? r.w : [], b: Array.isArray(r && r.b) ? r.b : [] };
}

const save = (store, rep) => store.set('repertoire', rep);

export function hasOpening(store, openingId, side) {
  return getRepertoire(store)[side].some((l) => l.opening === openingId);
}

/** Eröffnung aus dem Trainer hinzufügen oder wieder entfernen. Gibt den neuen Zustand zurück (true = drin). */
export function toggleOpening(store, opening, side) {
  const rep = getRepertoire(store);
  if (rep[side].some((l) => l.opening === opening.id)) {
    rep[side] = rep[side].filter((l) => l.opening !== opening.id);
    save(store, rep);
    return false;
  }
  if (rep[side].length >= MAX_LINES) throw new Error('voll');
  rep[side].push({ id: 'op-' + opening.id, name: opening.name, moves: opening.moves, opening: opening.id });
  save(store, rep);
  return true;
}

export function addLine(store, side, name, sans) {
  const rep = getRepertoire(store);
  if (rep[side].length >= MAX_LINES) throw new Error('voll');
  const moves = sans.slice(0, MAX_PLIES).join(' ');
  if (rep[side].some((l) => l.moves === moves)) return false;
  rep[side].push({ id: 'eigen-' + Date.now().toString(36), name: name || 'Eigene Linie', moves });
  save(store, rep);
  return true;
}

export function removeLine(store, side, id) {
  const rep = getRepertoire(store);
  rep[side] = rep[side].filter((l) => l.id !== id);
  save(store, rep);
}

/**
 * Liest Züge aus Text: „1. e4 e5 2. Sf3 Sc6“ – deutsche (S, L, T, D) oder englische Figurenbuchstaben.
 * @returns { sans } oder { error, at } (at = Nummer des Zugs, der nicht passt)
 */
export function parseMoves(text) {
  const tokens = String(text || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\d+\s*\.(\.\.)?/g, ' ')
    .replace(/[…]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  const chess = new Chess();
  const sans = [];
  for (const raw of tokens) {
    const tok = raw.replace(/[!?]+$/, '').replace(/^([SLTDK])/, (c) => ({ S: 'N', L: 'B', T: 'R', D: 'Q', K: 'K' }[c])).replace(/=([SLTD])/, (m, c) => '=' + { S: 'N', L: 'B', T: 'R', D: 'Q' }[c]).replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
    let m = null;
    try {
      m = chess.move(tok);
    } catch (e) {
      m = null;
    }
    if (!m) return { error: 'illegal', at: sans.length + 1, token: raw };
    sans.push(m.san);
    if (sans.length > MAX_PLIES) break;
  }
  if (!sans.length) return { error: 'empty' };
  return { sans };
}

/**
 * Vergleicht eine Partie mit dem Repertoire der Seite `you`.
 * @returns null (kein Repertoire für diese Farbe / andere Startstellung) oder
 *   { type: 'you' | 'opp' | 'complete', ply, played, expected: [SAN], names: [Name], depth }
 *   ply = Index des Zugs (0-basiert), bei dem die Partie das Repertoire verlassen hat; depth = Halbzüge im Repertoire
 */
export function checkRepertoire(game, you, rep) {
  if (!you || !game.startFen.startsWith(START.split(' ').slice(0, 4).join(' '))) return null;
  const lines = (rep[you] || []).map((l) => ({ name: l.name, sans: String(l.moves || '').split(' ').filter(Boolean) })).filter((l) => l.sans.length);
  if (!lines.length) return null;
  let cand = lines;
  for (let i = 0; i < game.moves.length; i++) {
    const going = cand.filter((l) => l.sans.length > i);
    if (!going.length) {
      // Alle passenden Linien sind zu Ende: bis hierhin war alles Repertoire
      return { type: 'complete', ply: i, depth: i, names: [...new Set(cand.map((l) => l.name))], expected: [], played: null };
    }
    const played = game.moves[i].san;
    const next = going.filter((l) => l.sans[i] === played);
    if (!next.length) {
      const mover = game.moves[i].color;
      return {
        type: mover === you ? 'you' : 'opp', ply: i, depth: i, played,
        expected: [...new Set(going.map((l) => l.sans[i]))], names: [...new Set(going.map((l) => l.name))],
      };
    }
    cand = next;
  }
  return { type: 'complete', ply: game.moves.length, depth: game.moves.length, names: [...new Set(cand.map((l) => l.name))], expected: [], played: null };
}
