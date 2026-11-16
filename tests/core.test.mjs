// Kern-Tests ohne Browser: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { parseGameLink, decodeTcn, gameFromPgn } from '../js/chesscom.js';
import { parseLichessLink } from '../js/lichess.js';
import { buildPgn, splitPgn, pgnTag, packPgn, unpackPgn } from '../js/pgn.js';
import { winPct, evalText, reviewGame, STRICTNESS, CLASSES, setPalette } from '../js/analysis.js';
import { parseTimeControl, timeSpent } from '../js/insights.js';
import { sanDe, setNotation } from '../js/coach.js';
import { OPENING_GROUPS } from '../js/openings-data.js';
import { DEMO_PGN } from '../js/demo.js';

test('chess.com-Links werden erkannt', () => {
  assert.deepEqual(parseGameLink('https://www.chess.com/game/live/123456789'), { type: 'live', id: '123456789' });
  assert.deepEqual(parseGameLink('https://www.chess.com/game/daily/987654321?move=3'), { type: 'daily', id: '987654321' });
  assert.deepEqual(parseGameLink('https://www.chess.com/analysis/game/live/123456789/review'), { type: 'live', id: '123456789' });
  assert.equal(parseGameLink('1. e4 e5 2. Nf3'), null);
  assert.equal(parseGameLink('https://lichess.org/abcdefgh'), null);
});

test('Lichess-Links werden erkannt', () => {
  assert.equal(parseLichessLink('https://lichess.org/HqjDTU4A'), 'HqjDTU4A');
  assert.equal(parseLichessLink('https://lichess.org/HqjDTU4A/black#12'), 'HqjDTU4A');
  assert.equal(parseLichessLink('https://lichess.org/HqjDTU4Aabcd'), 'HqjDTU4A');
  assert.equal(parseLichessLink('https://www.chess.com/game/live/1'), null);
});

test('TCN-Züge von chess.com werden dekodiert', () => {
  const moves = decodeTcn('mC0Kgv5Q');
  assert.deepEqual(moves.map((m) => m.from + m.to), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
});

test('PGN wird eingelesen und wieder ausgegeben', () => {
  const game = gameFromPgn(DEMO_PGN);
  assert.equal(game.moves.length, 33);
  assert.equal(game.fens.length, 34);
  assert.equal(game.result, '1-0');
  const pgn = buildPgn(game);
  const again = gameFromPgn(pgn);
  assert.deepEqual(again.moves.map((m) => m.san), game.moves.map((m) => m.san));
  assert.equal(pgnTag(pgn, 'White'), game.white.name);
});

test('Mehrere Partien in einer PGN-Datei werden getrennt', () => {
  const one = buildPgn(gameFromPgn(DEMO_PGN));
  assert.equal(splitPgn(`${one}\n\n${one}\n`).length, 2);
  assert.equal(splitPgn(one).length, 1);
});

test('Teilen-Link: PGN packen und entpacken', async () => {
  const pgn = buildPgn(gameFromPgn(DEMO_PGN));
  const packed = await packPgn(pgn);
  assert.match(packed, /^[A-Za-z0-9_-]+$/);
  assert.ok(packed.length < pgn.length);
  assert.equal(await unpackPgn(packed), pgn);
});

test('Gewinnwahrscheinlichkeit und Bewertungstext', () => {
  assert.equal(winPct({ type: 'cp', value: 0 }), 50);
  assert.ok(winPct({ type: 'cp', value: 300 }) > 70);
  assert.ok(winPct({ type: 'cp', value: -300 }) < 30);
  assert.equal(winPct({ type: 'mate', value: 3 }), 100);
  assert.equal(winPct({ type: 'mate', value: -2 }), 0);
  assert.equal(evalText({ type: 'cp', value: 150 }), '+1.5');
  assert.match(evalText({ type: 'mate', value: -4 }), /M4/);
});

/**
 * Baut eine Partie mit künstlichen Engine-Ergebnissen.
 * evals: Bewertung je Stellung aus Sicht von Weiß (in Bauern); other: Halbzüge, bei denen die Engine einen anderen Zug vorgezogen hätte.
 */
function fakeReview(sans, evals, { scale = 1, other = [] } = {}) {
  const chess = new Chess();
  const game = { startFen: chess.fen(), moves: [], fens: [chess.fen()], result: '*', white: { name: 'W' }, black: { name: 'S' } };
  const alternatives = [];
  for (const san of sans) {
    const legal = chess.moves({ verbose: true });
    const m = chess.move(san);
    alternatives.push(legal.find((x) => x.san !== m.san));
    game.moves.push({ ...m, fen: chess.fen() });
    game.fens.push(chess.fen());
  }
  const positions = evals.map((v, i) => {
    const ev = { type: 'cp', value: Math.round(v * 100) };
    const played = game.moves[i];
    if (!played) return { eval: ev, lines: [] };
    const pick = other.includes(i) ? alternatives[i] : played;
    const move = pick.from + pick.to;
    return { eval: ev, lines: [{ move, pv: [move], eval: ev, depth: 12 }] };
  });
  return reviewGame(game, positions, null, scale);
}

test('Zugbewertung: ruhige Partie, Patzer und Strenge', () => {
  const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
  const steady = fakeReview(sans, [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  assert.ok(steady.moves.every((m) => !['mistake', 'blunder', 'inaccuracy', 'miss'].includes(m.cls)));
  assert.ok(steady.accuracy.w > 95 && steady.accuracy.b > 95);

  // Weiß wirft mit dem 2. Zug die Partie weg: Die Engine wollte etwas anderes, danach steht Schwarz klar auf Gewinn.
  const lost = fakeReview(sans, [0.2, 0.2, 0.2, -6, -6, -6, -6], { other: [2] });
  assert.equal(lost.moves[2].cls, 'blunder');
  assert.ok(lost.accuracy.w < steady.accuracy.w);
  assert.equal(lost.counts.w.blunder, 1);

  // Ein mittlerer Fehler wird je nach eingestellter Strenge unterschiedlich hart bewertet
  const order = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
  const rank = (scale) => order.indexOf(fakeReview(sans, [0.2, 0.2, 0.2, -1.0, -1.0, -1.0, -1.0], { other: [2], scale }).moves[2].cls);
  assert.ok(rank(STRICTNESS.mild) >= 0 && rank(STRICTNESS.strict) >= 0);
  assert.ok(rank(STRICTNESS.mild) < rank(STRICTNESS.strict));
});

test('Farbpalette für Farbenblinde lässt sich umschalten', () => {
  const normal = CLASSES.blunder.color;
  setPalette(true);
  assert.notEqual(CLASSES.blunder.color, normal);
  setPalette(false);
  assert.equal(CLASSES.blunder.color, normal);
});

test('Bedenkzeit je Zug', () => {
  assert.deepEqual(parseTimeControl('600+5'), { base: 600, inc: 5 });
  assert.equal(parseTimeControl('1/86400'), null);
  const game = { timeControl: '60+1', moves: [{ color: 'w', clock: 58 }, { color: 'b', clock: 55 }, { color: 'w', clock: 50 }] };
  assert.deepEqual(timeSpent(game), [3, 6, 9]);
});

test('Notation: deutsch, englisch, Figuren', () => {
  assert.equal(sanDe('Nxe5+'), 'Sxe5+');
  setNotation('en');
  assert.equal(sanDe('Qh5#'), 'Qh5#');
  setNotation('fig');
  assert.equal(sanDe('Bb5'), '♗b5');
  setNotation('de');
  assert.equal(sanDe('Rad1'), 'Tad1');
});

test('Eröffnungstrainer: alle Linien sind legale Zugfolgen', () => {
  const ids = new Set();
  for (const group of OPENING_GROUPS) {
    for (const o of group.items) {
      assert.ok(!ids.has(o.id), `doppelte ID ${o.id}`);
      ids.add(o.id);
      const chess = new Chess();
      for (const san of o.moves.split(' ')) assert.doesNotThrow(() => chess.move(san), `${o.id}: ${san}`);
      assert.ok(o.idea.length > 20);
    }
  }
  assert.ok(ids.size >= 30);
});
