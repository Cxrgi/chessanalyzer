// Auswertungen über eine Partie hinaus: Zeitverbrauch, Kurzfassung für Verlauf und Schwächenprofil,
// Trainingskarten aus eigenen Fehlern.
import { BAD } from './analysis.js';
import { diagnoseMove, phases } from './coach.js';

/** Grundbedenkzeit und Zuschlag aus „600+5“ (null bei Fernschach oder ohne Angabe). */
export function parseTimeControl(tc) {
  if (!tc || tc.includes('/')) return null;
  const [base, inc] = String(tc).split('+').map(Number);
  return Number.isFinite(base) && base > 0 ? { base, inc: inc || 0 } : null;
}

/** Verbrauchte Zeit je Zug in Sekunden (null, wenn keine Uhrzeiten vorliegen). */
export function timeSpent(game) {
  const tc = parseTimeControl(game.timeControl);
  if (!tc || !game.moves.some((m) => m.clock != null)) return null;
  const last = { w: tc.base, b: tc.base };
  return game.moves.map((m) => {
    if (m.clock == null) return null;
    const spent = Math.max(0, last[m.color] - m.clock + tc.inc);
    last[m.color] = m.clock;
    return Math.round(spent * 10) / 10;
  });
}

/** Zeitmanagement einer Seite: Durchschnitt, längstes Nachdenken, Zeitnot, zu schnelle Fehler. */
export function timeReport(game, review, color) {
  const spent = timeSpent(game);
  const tc = parseTimeControl(game.timeControl);
  if (!spent || !tc) return null;
  const limit = Math.max(15, tc.base * 0.1);
  const r = { moves: 0, total: 0, longest: null, trouble: 0, troubleErrors: 0, fastErrors: 0, left: null, limit, troubleFrom: null };
  game.moves.forEach((m, k) => {
    if (m.color !== color || spent[k] == null) return;
    r.moves++;
    r.total += spent[k];
    if (!r.longest || spent[k] > r.longest.sec) r.longest = { k, sec: spent[k] };
    const bad = BAD.has(review.moves[k].cls) && review.moves[k].cls !== 'inaccuracy';
    const before = m.clock + spent[k] - tc.inc;
    if (before < limit) {
      r.trouble++;
      if (r.troubleFrom == null) r.troubleFrom = k;
      if (bad) r.troubleErrors++;
    } else if (bad && spent[k] <= Math.max(2, tc.base * 0.005)) {
      r.fastErrors++;
    }
    r.left = m.clock;
  });
  if (!r.moves) return null;
  r.avg = r.total / r.moves;
  return r;
}

/** Schlagwort für einen schlechten Zug (für Lernpunkte, Profil und Training). */
export function mistakeTag(ctx, k) {
  const cls = ctx.review.moves[k].cls;
  const { refute, missed } = diagnoseMove(ctx, k);
  if (cls === 'miss' && missed) return missed.tag;
  if (refute && refute.tag !== 'generic' && refute.tag !== 'draw') return refute.tag;
  if (missed) return missed.tag;
  return 'other';
}

/** Kompakte Zusammenfassung einer analysierten Partie (wird im Verlauf gespeichert). */
export function gameSummary(ctx) {
  const { game, review } = ctx;
  const tags = { w: {}, b: {} };
  game.moves.forEach((m, k) => {
    const cls = review.moves[k].cls;
    if (!BAD.has(cls) || cls === 'inaccuracy') return;
    const t = mistakeTag(ctx, k);
    tags[m.color][t] = (tags[m.color][t] || 0) + 1;
  });
  const time = {};
  for (const c of ['w', 'b']) {
    const r = timeReport(game, review, c);
    time[c] = r ? { avg: r.avg, trouble: r.trouble, troubleErrors: r.troubleErrors, fastErrors: r.fastErrors, left: r.left } : null;
  }
  return {
    id: game.id, at: Date.now(), url: game.url || null,
    white: game.white.name, black: game.black.name, wr: game.white.rating || null, br: game.black.rating || null,
    result: game.result, date: game.date, timeClass: game.timeClass, moves: game.moves.length,
    opening: review.opening ? review.opening.name : (game.openingHint || ''),
    you: ctx.you || null,
    acc: { w: review.accuracy.w, b: review.accuracy.b },
    counts: review.counts,
    phases: phases(ctx).map((p) => ({ name: p.name, w: p.wAcc, b: p.bAcc })),
    tags, time,
  };
}

/** Trainingskarten: alle Fehler, verpassten Chancen und Patzer einer Seite. */
export function mistakeCards(ctx, color) {
  const { game, review } = ctx;
  const cards = [];
  game.moves.forEach((m, k) => {
    const info = review.moves[k];
    if (m.color !== color || !BAD.has(info.cls) || info.cls === 'inaccuracy' || !info.best) return;
    cards.push({
      id: `${game.id}:${k}`, gameId: game.id, k, fen: game.fens[k], best: info.best, played: m.uci,
      cls: info.cls, tag: mistakeTag(ctx, k), loss: Math.round(info.loss),
      label: `${game.white.name} – ${game.black.name}, Zug ${Math.floor(k / 2) + 1}`,
      box: 0, due: 0, seen: 0,
    });
  });
  return cards;
}
