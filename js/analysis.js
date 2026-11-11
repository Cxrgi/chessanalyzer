// Bewertet jeden Zug einer Partie anhand der Engine-Ergebnisse:
// Gewinnwahrscheinlichkeit, Klassifizierung (Brillant … Patzer) und Genauigkeit.
import { Chess } from '../vendor/chess.js';
import { positionKey } from './poskey.js';
import { see, hangingPieces, VAL } from './tactics.js';

export const CLASSES = {
  brilliant: { label: 'Brillant', noun: 'ein brillanter Zug', symbol: '!!', color: '#1baaa6' },
  great: { label: 'Großartig', noun: 'ein großartiger Zug', symbol: '!', color: '#5c8bb0' },
  best: { label: 'Bester Zug', noun: 'der beste Zug', symbol: '★', color: '#81b64c' },
  excellent: { label: 'Ausgezeichnet', noun: 'ein ausgezeichneter Zug', symbol: '👍', color: '#81b64c' },
  good: { label: 'Gut', noun: 'ein guter Zug', symbol: '✓', color: '#77915f' },
  book: { label: 'Buchzug', noun: 'ein Buchzug', symbol: '📖', color: '#a88865' },
  forced: { label: 'Erzwungen', noun: 'erzwungen', symbol: '→', color: '#8b8987' },
  inaccuracy: { label: 'Ungenauigkeit', noun: 'eine Ungenauigkeit', symbol: '?!', color: '#f7c631' },
  mistake: { label: 'Fehler', noun: 'ein Fehler', symbol: '?', color: '#ffa459' },
  miss: { label: 'Verpasste Chance', noun: 'eine verpasste Chance', symbol: '✕', color: '#ff7769' },
  blunder: { label: 'Patzer', noun: 'ein Patzer', symbol: '??', color: '#fa412d' },
};

export const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
export const BAD = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Gewinnwahrscheinlichkeit für Weiß in Prozent (0–100). */
export function winPct(ev) {
  if (!ev) return 50;
  if (ev.type === 'mate') {
    if (ev.value === 0) return ev.winner === 'w' ? 100 : 0;
    return ev.value > 0 ? 100 : 0;
  }
  const cp = clamp(ev.value, -1500, 1500);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Bewertung als kurzer Text aus Sicht von Weiß, z. B. „+1.3“ oder „M4“. */
export function evalText(ev) {
  if (!ev) return '0.0';
  if (ev.type === 'mate') {
    if (ev.value === 0) return ev.winner === 'w' ? '1-0' : '0-1';
    return (ev.value < 0 ? '-' : '') + 'M' + Math.abs(ev.value);
  }
  const p = ev.value / 100;
  return (p > 0 ? '+' : '') + p.toFixed(Math.abs(p) >= 10 ? 0 : 1);
}

const moveAccuracy = (loss) => clamp(103.1668 * Math.exp(-0.04354 * loss) - 3.1669, 0, 100);

function stddev(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

/** Partie-Genauigkeit je Seite (Verfahren angelehnt an die offene Lichess-Formel). */
function gameAccuracy(wins, accs, colors) {
  const n = accs.length;
  const size = clamp(Math.floor(n / 10), 2, 8);
  const windows = [];
  for (let i = 0; i < Math.min(size - 2, n); i++) windows.push(wins.slice(0, size));
  for (let i = 0; i + size <= wins.length; i++) windows.push(wins.slice(i, i + size));
  const weights = accs.map((_, i) => clamp(stddev(windows[Math.min(i, windows.length - 1)] || [50, 50]), 0.5, 12));
  const out = {};
  for (const c of ['w', 'b']) {
    let wSum = 0, wAcc = 0, hSum = 0, cnt = 0;
    accs.forEach((a, i) => {
      if (colors[i] !== c) return;
      wSum += weights[i];
      wAcc += weights[i] * a;
      hSum += 1 / Math.max(a, 1);
      cnt++;
    });
    out[c] = cnt ? (wAcc / wSum + cnt / hSum) / 2 : null;
  }
  return out;
}

/** Opfert der Zug Material (Figur kann mit Gewinn geschlagen werden)? */
function sacrificeValue(fenAfter, move) {
  if (move.piece === 'k' || move.promotion) return 0;
  const got = move.captured ? VAL[move.captured] : 0;
  const chess = new Chess(fenAfter);
  let offered = move.piece === 'p' ? 0 : see(chess, move.to);
  if (!chess.isCheck()) {
    // andere Figur absichtlich stehen gelassen
    for (const h of hangingPieces(fenAfter, move.color)) {
      if (h.type !== 'p' && h.square !== move.to) offered = Math.max(offered, h.gain);
    }
  }
  return offered - got;
}

/**
 * @param game       Partie (moves, fens)
 * @param positions  Engine-Ergebnis je Stellung: { lines: [{move, pv, eval}], eval }
 * @param book       Eröffnungsbuch { names, book }
 */
export function reviewGame(game, positions, book) {
  const n = game.moves.length;
  // Rückwärts abgleichen: Die Stellung nach einem Zug wurde einen Halbzug tiefer gerechnet
  // und ist damit verlässlicher als die Vorschau aus der Stellung davor.
  positions = positions.map((p) => ({ ...p, lines: p.lines.slice() }));
  const evals = positions.map((p) => p.eval);
  const outplayed = new Array(n).fill(false);
  const lift = (a, sign) => {
    if (a.type !== 'mate') return a;
    if (a.value === 0) return { type: 'mate', value: a.winner === 'w' ? 1 : -1 };
    return { type: 'mate', value: a.value * sign > 0 ? a.value + sign : a.value };
  };
  for (let k = n - 1; k >= 0; k--) {
    const sign = game.moves[k].color === 'w' ? 1 : -1;
    const lines = positions[k].lines;
    const a = lift(evals[k + 1], sign);
    if (lines[0] && lines[0].move === game.moves[k].uci) {
      // Der beste Engine-Zug wurde gespielt: tiefere Bewertung übernehmen
      if (lines[1] && sign * (winPct(lines[1].eval) - winPct(a)) > 2) {
        // … außer die zweite Linie ist nach tieferer Rechnung doch besser
        lines.reverse();
        evals[k] = lines[0].eval;
      } else {
        evals[k] = a;
      }
    } else if (sign * (winPct(a) - winPct(evals[k])) > 0.5) {
      // Der gespielte Zug ist besser als alles, was die Engine vorher sah
      outplayed[k] = lines.length > 0;
      evals[k] = a;
    }
  }
  const wins = evals.map(winPct);
  const moves = [];
  let inBook = !!book && game.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq');
  let opening = null;
  let prevLoss = 0;
  let prevWinBeforeOpp = 50;

  for (let k = 0; k < n; k++) {
    const move = game.moves[k];
    const before = positions[k];
    const after = positions[k + 1];
    const pov = (w) => (move.color === 'w' ? w : 100 - w);
    const best = before.lines[0] || null;
    const second = before.lines[1] || null;
    const isBest = (!!best && best.move === move.uci) || outplayed[k];
    const winAfter = pov(wins[k + 1]);
    const winBest = Math.max(pov(best ? winPct(best.eval) : wins[k]), outplayed[k] ? winAfter : 0);
    const playedLine = before.lines.find((l) => l.move === move.uci);
    let loss = Math.max(0, winBest - winAfter);
    if (isBest) loss = 0;
    else if (playedLine) loss = Math.min(loss, Math.max(0, winBest - pov(winPct(playedLine.eval))));

    const legal = new Chess(game.fens[k]).moves().length;
    let cls;

    if (inBook && k < 40) {
      const idx = book.book[positionKey(game.fens[k + 1])];
      if (idx === undefined) inBook = false;
      else {
        cls = 'book';
        if (idx >= 0) {
          const [eco, name] = book.names[idx].split('|');
          opening = { eco, name, ply: k + 1 };
        }
      }
    }

    if (!cls) {
      if (legal === 1) cls = 'forced';
      else if (isBest) cls = 'best';
      else if (loss <= 2) cls = 'excellent';
      else if (loss <= 5) cls = 'good';
      else if (loss <= 10) cls = 'inaccuracy';
      else if (loss <= 20) cls = 'mistake';
      else cls = 'blunder';

      // Verpasste Chance: Der Gegner hat gepatzt, aber die Gelegenheit wurde nicht genutzt
      if ((cls === 'mistake' || cls === 'blunder') && prevLoss >= 10 && winAfter >= prevWinBeforeOpp - 6 && winAfter >= 35) {
        cls = 'miss';
      }
      // Matt ausgelassen, obwohl weiterhin alles gewinnt, soll nicht als „bester Zug“ durchgehen
      if (best && best.eval.type === 'mate' && pov(winPct(best.eval)) === 100 && Math.abs(best.eval.value) <= 3 && !isBest
        && !(after.eval.type === 'mate' && pov(winPct(after.eval)) === 100) && cls !== 'blunder' && cls !== 'mistake') {
        cls = 'miss';
      }

      // Wer ohne Not in ein erzwungenes Matt läuft, hat mindestens ungenau gespielt
      const matedAfter = evals[k + 1].type === 'mate' && winAfter === 0;
      const matedBefore = best && best.eval.type === 'mate' && pov(winPct(best.eval)) === 0;
      if (matedAfter && !matedBefore && !isBest && (cls === 'excellent' || cls === 'good')) cls = 'inaccuracy';

      if (cls === 'best' || cls === 'excellent') {
        const mating = evals[k + 1].type === 'mate' && winAfter === 100;
        const sac = winAfter >= 50 && (winBest <= 97 || mating) && loss <= 2 && after.terminal !== 'mate'
          ? sacrificeValue(game.fens[k + 1], move) : 0;
        const prev = k > 0 ? game.moves[k - 1] : null;
        const recapture = !!(move.captured && prev && prev.captured && prev.to === move.to);
        if (sac >= 2 && !recapture) {
          cls = 'brilliant';
        } else if (cls === 'best' && !recapture && after.terminal !== 'mate' && (outplayed[k] ? best : second)) {
          const alt = pov(winPct((outplayed[k] ? best : second).eval));
          const gap = alt <= 85 ? winBest - alt : 0;
          // Einziger guter Zug – aber kein offensichtliches Schlagen einer hängenden Figur
          let obvious = false;
          if (move.captured) {
            const c = new Chess(game.fens[k]);
            obvious = see(c, move.to) >= VAL[move.captured] || VAL[move.captured] > VAL[move.piece];
          }
          if (gap >= 15 && !obvious && winAfter >= 30) cls = 'great';
        }
      }
    }

    moves.push({
      cls,
      loss,
      accuracy: cls === 'book' || cls === 'forced' ? 100 : moveAccuracy(loss),
      isBest,
      best: best && !outplayed[k] ? best.move : null,
      winBefore: winBest,
      winAfter,
    });
    prevWinBeforeOpp = 100 - winBest; // Sicht des nächsten Spielers vor diesem Zug
    prevLoss = cls === 'book' ? 0 : loss;
  }

  const colors = game.moves.map((m) => m.color);
  const accuracy = gameAccuracy(wins, moves.map((m) => m.accuracy), colors);
  const counts = { w: {}, b: {} };
  for (const c of CLASS_ORDER) counts.w[c] = counts.b[c] = 0;
  moves.forEach((m, i) => {
    if (counts[colors[i]][m.cls] !== undefined) counts[colors[i]][m.cls]++;
  });
  return { moves, positions, evals, wins, accuracy, counts, opening };
}
