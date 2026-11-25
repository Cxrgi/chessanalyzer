// Tests für die neuen Funktionen: Repertoire, Teilen-Link mit Analyse, Notizen in PGN und Abgleich, Live-Genauigkeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoves, checkRepertoire, toggleOpening, addLine, getRepertoire, removeLine } from '../js/repertoire.js';
import { gameFromPgn } from '../js/chesscom.js';
import { buildPgn, packAnalysis, unpackAnalysis } from '../js/pgn.js';
import { mergeStates, emptyState } from '../js/sync-merge.js';
import { previewAccuracy, reviewGame, winPct } from '../js/analysis.js';
import { OPENING_GROUPS } from '../js/openings-data.js';
import { DEMO_PGN } from '../js/demo.js';
import { Chess } from '../vendor/chess.js';

const memoryStore = () => {
  const m = new Map();
  return { get: (k, f) => (m.has(k) ? JSON.parse(m.get(k)) : f), set: (k, v) => { m.set(k, JSON.stringify(v)); } };
};
const opera = () => gameFromPgn(DEMO_PGN); // 1. e4 e5 2. Sf3 d6 3. d4 Lg4 …

test('Repertoire: Züge in deutscher und englischer Schreibweise lesen', () => {
  assert.deepEqual(parseMoves('1. e4 e5 2. Sf3 Sc6 3. Lb5 a6 4. 0-0').sans, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'O-O']);
  assert.deepEqual(parseMoves('1.d4 d5 2.Bf4 Nf6!? 3.e3').sans, ['d4', 'd5', 'Bf4', 'Nf6', 'e3']);
  assert.deepEqual(parseMoves('1. e4 e5 2. Ke3'), { error: 'illegal', at: 3, token: 'Ke3' });
  assert.equal(parseMoves('   ').error, 'empty');
});

test('Repertoire: Abweichung erkennen – eigene, gegnerische, vollständig gespielt', () => {
  const store = memoryStore();
  addLine(store, 'w', 'Gegen Philidor', parseMoves('1. e4 e5 2. Sf3 d6 3. d4 Sf6').sans);
  const r = checkRepertoire(opera(), 'w', getRepertoire(store));
  assert.deepEqual([r.type, r.ply, r.played, r.expected], ['opp', 5, 'Bg4', ['Nf6']]);

  const mine = memoryStore();
  addLine(mine, 'w', 'Mit Lc4', parseMoves('1. e4 e5 2. Sf3 d6 3. Lc4').sans);
  const r2 = checkRepertoire(opera(), 'w', getRepertoire(mine));
  assert.deepEqual([r2.type, r2.ply, r2.played, r2.expected], ['you', 4, 'd4', ['Bc4']]);

  const short = memoryStore();
  addLine(short, 'w', 'Kurz', parseMoves('1. e4 e5 2. Sf3').sans);
  assert.deepEqual([checkRepertoire(opera(), 'w', getRepertoire(short)).type, checkRepertoire(opera(), 'w', getRepertoire(short)).depth], ['complete', 3]);
  // Für Schwarz nichts eingetragen → keine Aussage
  assert.equal(checkRepertoire(opera(), 'b', getRepertoire(short)), null);
  removeLine(short, 'w', getRepertoire(short).w[0].id);
  assert.equal(getRepertoire(short).w.length, 0);
});

test('Repertoire: Eröffnung aus dem Trainer an- und abwählen', () => {
  const store = memoryStore();
  const italian = OPENING_GROUPS[0].items.find((o) => o.id === 'italienisch');
  assert.equal(toggleOpening(store, italian, 'w'), true);
  assert.equal(getRepertoire(store).w[0].moves, italian.moves);
  assert.equal(toggleOpening(store, italian, 'w'), false);
  assert.equal(getRepertoire(store).w.length, 0);
});

test('Teilen-Link mit Analyse: packen, entpacken, gleiche Bewertung', async () => {
  const game = opera();
  // künstliche Engine-Ergebnisse: alle 0.3, außer der Schlussstellung (matt)
  const positions = game.fens.map((fen, i) => {
    const c = new Chess(fen);
    if (c.isCheckmate()) return { lines: [], eval: { type: 'mate', value: 0, winner: 'w' }, terminal: 'mate' };
    const mv = c.moves({ verbose: true })[0];
    const move = mv.from + mv.to;
    return { eval: { type: 'cp', value: 30 }, lines: [{ move, pv: [move], eval: { type: 'cp', value: 30 }, depth: 14 }, { move, pv: [move], eval: { type: i === 3 ? 'mate' : 'cp', value: i === 3 ? 4 : 10 }, depth: 14 }] };
  });
  const packed = await packAnalysis(game, positions, 16);
  const back = await unpackAnalysis(packed);
  assert.equal(back.depth, 16);
  assert.equal(back.id, game.id);
  assert.equal(back.positions.length, game.fens.length);
  assert.equal(back.positions.at(-1), 'terminal');
  assert.deepEqual(back.positions[3].lines[1].eval, { type: 'mate', value: 4 });
  assert.deepEqual(gameFromPgn(back.pgn).moves.map((m) => m.san), game.moves.map((m) => m.san));
  await assert.rejects(() => unpackAnalysis('zkaputt'));
});

test('PGN-Download mit Notizen (Kommentare) und gespeicherten Varianten (Nebenvarianten)', () => {
  const game = opera();
  const annot = { notes: { 0: 'Partie gegen {zwei}', 8: 'Hier lieber Lxf3 vermeiden' }, lines: [{ id: 'x', base: 6, ucis: ['h2h3', 'g4h5', 'g2g4'] }, { id: 'y', base: 33, ucis: ['g8h8'] }] };
  const pgn = buildPgn(game, null, annot);
  assert.match(pgn, /^\{ Partie gegen \(zwei\) \} 1\. e4/m);
  assert.match(pgn, /4\. dxe5 \(4\. h3 Bh5 5\. g4\) 4\.\.\. Bxf3 \{ Hier lieber Lxf3 vermeiden \}/);
  // Die Partie lässt sich mit Kommentaren und Varianten wieder einlesen
  assert.equal(gameFromPgn(pgn).moves.length, game.moves.length);
});

test('Abgleich: Notizen – neuere gewinnt, Gelöschtes bleibt gelöscht', () => {
  const a = { ...emptyState(), notes: { g1: { id: 'g1', mod: 100, notes: { 3: 'alt' }, lines: [] } } };
  const b = { ...emptyState(), notes: { g1: { id: 'g1', mod: 200, notes: { 3: 'neu' }, lines: [] }, g2: { id: 'g2', mod: 50, notes: { 1: 'x' }, lines: [] } }, del: { 'n:g2': 60 } };
  const m = mergeStates(a, b, 1000);
  assert.equal(m.notes.g1.notes[3], 'neu');
  assert.ok(!m.notes.g2);
  // „newseen“ (Merker für neue Partien): der größere Wert gewinnt
  const n = mergeStates({ ...emptyState(), keys: { newseen: { v: 500, at: 9 } } }, { ...emptyState(), keys: { newseen: { v: 700, at: 3 } } });
  assert.equal(n.keys.newseen.v, 700);
});

test('Vorläufige Genauigkeit während der Analyse', () => {
  const game = opera();
  const evals = new Array(game.fens.length);
  assert.deepEqual(previewAccuracy(game, evals), { w: null, b: null, moves: 0 });
  for (let i = 0; i <= 6; i++) evals[i] = { type: 'cp', value: 30 };
  const p = previewAccuracy(game, evals);
  assert.equal(p.moves, 6);
  assert.ok(p.w > 99 && p.b > 99);
  evals[7] = { type: 'cp', value: 900 }; // nach 4. dxe5 steht Weiß plötzlich klar besser → Schwarz verlor nichts, Weiß gewann
  evals[8] = { type: 'cp', value: 900 };
  assert.ok(previewAccuracy(game, evals).moves === 8);
  assert.ok(winPct({ type: 'cp', value: 900 }) > 90);
  assert.ok(typeof reviewGame === 'function');
});
