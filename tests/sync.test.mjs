// Zusammenführen zweier Stände (Gerät + Server).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates, sameState, emptyState, stable } from '../js/sync-merge.js';

const NOW = 1_800_000_000_000;
const state = (extra) => ({ ...emptyState(), ...extra });

test('Reihenfolge der Schlüssel spielt beim Vergleich keine Rolle', () => {
  assert.equal(stable({ b: 1, a: [2, { d: 1, c: 2 }] }), stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.ok(sameState(state({ keys: { x: { v: 1, at: 2 } } }), state({ keys: { x: { at: 2, v: 1 } } })));
});

test('Neuere Änderung gewinnt, Fortschritt wird zusammengelegt', () => {
  const phone = state({ keys: {
    puzzles: { v: { rating: 1200, solved: 40 }, at: 200 }, settings: { v: { theme: 'blue' }, at: 100 },
    lessons: { v: { gabel: true }, at: 50 }, wins: { v: 2, at: 10 },
    activity: { v: { '2026-11-16': { puzzles: 5, games: 1 } }, at: 10 },
    trainers: { v: { coords: { w: 12, b: 0 }, openings: { italienisch: 2 } }, at: 10 },
  } });
  const laptop = state({ keys: {
    puzzles: { v: { rating: 1100, solved: 30 }, at: 100 }, settings: { v: { theme: 'green' }, at: 300 },
    lessons: { v: { fesselung: true }, at: 60 }, wins: { v: 5, at: 5 },
    activity: { v: { '2026-11-16': { puzzles: 3, lessons: 2 }, '2026-11-15': { puzzles: 1 } }, at: 20 },
    trainers: { v: { coords: { w: 8, b: 9 }, openings: { italienisch: 1, london: 4 } }, at: 20 },
  } });
  const m = mergeStates(phone, laptop, NOW);
  assert.equal(m.keys.puzzles.v.rating, 1200);
  assert.equal(m.keys.settings.v.theme, 'green');
  assert.deepEqual(m.keys.lessons.v, { gabel: true, fesselung: true });
  assert.equal(m.keys.wins.v, 5);
  assert.deepEqual(m.keys.activity.v, { '2026-11-16': { puzzles: 5, games: 1, lessons: 2 }, '2026-11-15': { puzzles: 1 } });
  assert.deepEqual(m.keys.trainers.v, { coords: { w: 12, b: 9 }, openings: { italienisch: 2, london: 4 } });
  // In beide Richtungen dasselbe Ergebnis – sonst würden sich zwei Geräte nie einig
  assert.ok(sameState(m, mergeStates(laptop, phone, NOW)));
  assert.ok(sameState(m, mergeStates(m, phone, NOW)));
});

test('Erster Abgleich: Der umfangreichere Stand geht nicht verloren', () => {
  const old = state({ keys: { puzzles: { v: { rating: 1500, solved: 300, recent: [1, 1, 0, 1, 1, 1, 0, 1], themes: { fork: [20, 15] } }, at: 1 } } });
  const fresh = state({ keys: { puzzles: { v: { rating: 1000 }, at: 500 } } });
  assert.equal(mergeStates(old, fresh, NOW).keys.puzzles.v.rating, 1500);
  assert.equal(mergeStates(fresh, old, NOW).keys.puzzles.v.rating, 1500);
});

test('Partien und Karten: vereinen, Gelöschtes bleibt gelöscht', () => {
  const a = state({
    meta: { g1: { id: 'g1', at: 100 }, g2: { id: 'g2', at: 100, fav: false } },
    cards: { 'g1:4': { id: 'g1:4', box: 0, seen: 0 }, 'g2:9': { id: 'g2:9', box: 1, seen: 1, mod: 500 } },
    del: {},
  });
  const b = state({
    meta: { g2: { id: 'g2', at: 100, fav: true, mod: 900 }, g3: { id: 'g3', at: 300 } },
    cards: { 'g2:9': { id: 'g2:9', box: 3, seen: 4, mod: 800 }, 'g1:4': { id: 'g1:4', box: 2, seen: 2 } },
    del: { 'g:g1': NOW - 1000, 'c:g1:4': NOW - 1000, 'g:alt': NOW - 400 * 86400000 },
  });
  const m = mergeStates(a, b, NOW);
  assert.deepEqual(Object.keys(m.meta).sort(), ['g2', 'g3']);
  assert.equal(m.meta.g2.fav, true);
  assert.deepEqual(Object.keys(m.cards), ['g2:9']);
  assert.equal(m.cards['g2:9'].box, 3);
  assert.ok(!('g:alt' in m.del), 'sehr alte Lösch-Einträge werden aufgeräumt');
  // Später neu analysiert → darf wiederkommen
  const again = mergeStates(m, state({ meta: { g1: { id: 'g1', at: NOW + 5 } } }), NOW + 10);
  assert.ok(again.meta.g1);
});
