// Der Coach: erzeugt aus Engine-Daten und einfachen Taktik-Mustern verständliche Erklärungen.
import { Chess } from '../vendor/chess.js';
import { CLASSES, BAD, winPct } from './analysis.js';
import { see, hangingPieces, forkTargets, VAL } from './tactics.js';

const SIDE = { w: 'Weiß', b: 'Schwarz' };
const ACC = { p: 'den Bauern', n: 'den Springer', b: 'den Läufer', r: 'den Turm', q: 'die Dame', k: 'den König' };
const NOM = { p: 'der Bauer', n: 'der Springer', b: 'der Läufer', r: 'der Turm', q: 'die Dame', k: 'der König' };
const INDEF = { p: 'einen Bauern', n: 'einen Springer', b: 'einen Läufer', r: 'einen Turm', q: 'die Dame' };
const PLURAL = { p: 'Bauern', n: 'Springer', b: 'Läufer', r: 'Türme', q: 'Damen' };
const PROMO = { q: 'eine Dame', r: 'einen Turm', b: 'einen Läufer', n: 'einen Springer' };

/** SAN mit deutschen Figurenbuchstaben (S, L, T, D). */
export function sanDe(san) {
  return san.replace(/[NBRQ]/g, (c) => ({ N: 'S', B: 'L', R: 'T', Q: 'D' }[c]));
}

/** Wandelt eine Engine-Variante (UCI) in ausgeschriebene Züge um. */
export function pvToMoves(fen, pv, max = 10) {
  const chess = new Chess(fen);
  const out = [];
  for (const uci of (pv || []).slice(0, max)) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out.push({
        san: m.san, uci, from: m.from, to: m.to, color: m.color, piece: m.piece,
        captured: m.captured || null, promotion: m.promotion || null, fen: chess.fen(),
      });
    } catch (e) {
      break;
    }
  }
  return out;
}

/** Zugfolge als Text mit Zugnummern, z. B. „12. Sf3 Sc6 13. Lb5“. */
export function lineText(fen, moves) {
  const parts = fen.split(' ');
  let num = +parts[5] || 1;
  let white = parts[1] === 'w';
  let out = '';
  moves.forEach((m, i) => {
    if (white) out += `${num}. `;
    else if (i === 0) out += `${num}… `;
    out += sanDe(m.san) + ' ';
    if (!white) num++;
    white = !white;
  });
  return out.trim();
}

function gainText(type, gain) {
  if (VAL[type] && gain >= VAL[type]) return INDEF[type];
  if (type === 'r' && gain === 2) return 'die Qualität';
  if (gain >= 3) return 'eine Figur';
  if (gain === 1) return 'einen Bauern';
  return 'Material';
}

function verdict(ev) {
  const w = winPct(ev);
  if (ev.type === 'mate') {
    if (ev.value === 0) return '';
    const s = ev.value > 0 ? 'Weiß' : 'Schwarz';
    return `${s} kann in ${Math.abs(ev.value)} ${Math.abs(ev.value) === 1 ? 'Zug' : 'Zügen'} mattsetzen.`;
  }
  const s = w >= 50 ? 'Weiß' : 'Schwarz';
  const d = Math.abs(w - 50);
  if (d < 6) return 'Die Stellung ist ausgeglichen.';
  if (d < 15) return `${s} steht etwas besser.`;
  if (d < 30) return `${s} steht klar besser.`;
  if (d < 43) return `${s} steht auf Gewinn.`;
  return `${s} steht völlig auf Gewinn.`;
}

function openFile(chess, file) {
  let own = false, any = false;
  for (let r = 1; r <= 8; r++) {
    const p = chess.get(file + r);
    if (p && p.type === 'p') {
      any = true;
      if (p.color === chess.turn()) own = true;
    }
  }
  return !any ? 'offene' : !own ? 'halboffene' : null;
}

/**
 * Beschreibt in einer Verbphrase, was ein Zug bewirkt („entwickelt den Springer“).
 * @param fen   Stellung vor dem Zug
 * @param mv    Zug { from, to, promotion }
 * @param prev  vorheriger Zug der Partie (für „schlägt zurück“)
 */
export function describeMove(fen, mv, prev, ply) {
  const chess = new Chess(fen);
  const mover = chess.turn();
  const enemy = mover === 'w' ? 'b' : 'w';
  const seeBefore = chess.get(mv.to) ? see(chess, mv.to) : 0;
  const fileKind = openFile(chess, mv.to[0]);
  let m;
  try {
    m = chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion || undefined });
  } catch (e) {
    return null;
  }
  const after = chess.fen();
  const check = chess.isCheck();

  if (chess.isCheckmate()) return 'setzt matt';
  if (m.isKingsideCastle()) return 'rochiert kurz und bringt den König in Sicherheit';
  if (m.isQueensideCastle()) return 'rochiert lang und bringt den König in Sicherheit';
  if (m.promotion) return `verwandelt den Bauern in ${PROMO[m.promotion]}` + (check ? ' und gibt Schach' : '');

  if (m.captured) {
    const tail = check ? ' mit Schach' : '';
    if (prev && prev.captured && prev.to === m.to) return 'schlägt zurück' + tail;
    if (m.isEnPassant()) return 'schlägt den Bauern en passant' + tail;
    if (seeBefore >= VAL[m.captured] && m.captured !== 'p') return `gewinnt ${ACC[m.captured]} auf ${m.to}` + tail;
    if (seeBefore > 0) return `schlägt ${ACC[m.captured]} auf ${m.to} und gewinnt Material` + tail;
    if (m.captured === m.piece && m.piece !== 'p') return `tauscht die ${PLURAL[m.piece]}` + tail;
    return `schlägt ${ACC[m.captured]} auf ${m.to}` + tail;
  }

  const fork = forkTargets(chess, m.to);
  if (fork.length >= 2 && see(chess, m.to) === 0) {
    const names = fork.slice(0, 2).map((t) => ACC[t.type].replace(/^(den|die) /, ''));
    return `greift mit einer Gabel ${names[0]} und ${names[1]} an`;
  }
  if (check) return 'gibt Schach';

  // neue Drohung gegen eine gegnerische Figur
  const hungBefore = new Set(hangingPieces(fen, enemy).map((h) => h.square));
  const threat = hangingPieces(after, enemy).find((h) => !hungBefore.has(h.square) && (h.type !== 'p' || h.gain >= 1));
  const safeHere = see(chess, m.to) === 0;
  if (threat && threat.type !== 'p' && safeHere) return `greift ${ACC[threat.type]} auf ${threat.square} an`;

  // angegriffene Figur gerettet
  const ownHungBefore = hangingPieces(fen, mover);
  if (ownHungBefore.some((h) => h.square === m.from) && safeHere && m.piece !== 'p') {
    return `bringt ${ACC[m.piece]} in Sicherheit`;
  }
  const ownHungAfter = new Set(hangingPieces(after, mover).map((h) => h.square));
  const saved = ownHungBefore.find((h) => h.square !== m.from && !ownHungAfter.has(h.square) && h.type !== 'p');
  if (saved) return `deckt ${ACC[saved.type]} auf ${saved.square}`;

  const homeRank = mover === 'w' ? '1' : '8';
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === homeRank && ply < 30) {
    return `entwickelt ${ACC[m.piece]}`;
  }
  if (m.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(m.to) && ply < 16) return 'besetzt das Zentrum';
  if (m.piece === 'r' && fileKind && m.from[0] !== m.to[0]) return `stellt den Turm auf die ${fileKind} ${m.to[0]}-Linie`;
  if (m.piece === 'p') {
    const rank = +m.to[1];
    if ((mover === 'w' && rank >= 6) || (mover === 'b' && rank <= 3)) return 'rückt mit dem Bauern weiter in Richtung Umwandlung vor';
  }
  if (threat && safeHere) return `greift ${ACC[threat.type]} auf ${threat.square} an`;
  if (m.piece === 'k' && ply > 50) return 'aktiviert den König';
  return null;
}

/** Warum ist der gespielte Zug schlecht? Sucht die Widerlegung in der Engine-Variante. */
function refutation(ctx, k) {
  const { game, positions } = ctx;
  const move = game.moves[k];
  const fenBefore = game.fens[k];
  const fenAfter = game.fens[k + 1];
  const after = positions[k + 1];
  const afterEval = ctx.review.evals[k + 1];
  const side = SIDE[move.color];
  const pvMoves = after.lines[0] ? pvToMoves(fenAfter, after.lines[0].pv, 3) : [];
  const reply = pvMoves[0];
  const oppWins = (ev) => ev.type === 'mate' && ev.value !== 0 && (ev.value > 0) === (move.color === 'b');

  if (after.terminal === 'draw') return 'Damit ist die Partie nur noch remis.';
  if (oppWins(afterEval) && reply) {
    const n = Math.abs(afterEval.value);
    return n === 1
      ? `Das erlaubt **${sanDe(reply.san)}** – und das ist Matt.`
      : `Das erlaubt ein erzwungenes Matt in ${n} Zügen, beginnend mit **${sanDe(reply.san)}**.`;
  }
  if (!reply) return null;

  const chess = new Chess(fenAfter);
  if (reply.captured) {
    // Beim Zurückschlagen zählt nur, was unterm Strich verloren geht
    const got = reply.to === move.to && move.captured ? VAL[move.captured] : 0;
    const gain = see(chess, reply.to) - got;
    if (gain > 0) {
      const what = got ? gainText('x', gain) : gainText(reply.captured, gain);
      if (reply.to === move.to) {
        return `${cap(NOM[move.promotion || move.piece])} kann auf ${move.to} einfach geschlagen werden: **${sanDe(reply.san)}** gewinnt ${what}.`;
      }
      const wasHanging = hangingPieces(fenBefore, move.color).some((h) => h.square === reply.to);
      if (wasHanging) {
        return `${side} übersieht, dass ${NOM[reply.captured]} auf ${reply.to} angegriffen war: **${sanDe(reply.san)}** gewinnt ${what}.`;
      }
      return `Der Zug lässt ${ACC[reply.captured]} auf ${reply.to} im Stich: **${sanDe(reply.san)}** gewinnt ${what}.`;
    }
  }
  chess.move({ from: reply.from, to: reply.to, promotion: reply.promotion || undefined });
  const fork = forkTargets(chess, reply.to);
  if (fork.length >= 2) {
    const names = fork.slice(0, 2).map((t) => NOM[t.type].replace(/^(der|die) /, ''));
    return `Das erlaubt **${sanDe(reply.san)}** mit einer Gabel auf ${names[0]} und ${names[1]}.`;
  }
  const third = pvMoves[2];
  if (third && third.captured && pvMoves[1]) {
    const c2 = new Chess(pvMoves[1].fen);
    const gain = see(c2, third.to) - (pvMoves[1].captured ? VAL[pvMoves[1].captured] : 0);
    if (gain > 0) {
      return `Nach **${sanDe(reply.san)}** droht ${sanDe(third.san)}, und ${side} verliert ${gainText(third.captured, gain)}.`;
    }
  }
  const cls = ctx.review.moves[k].cls;
  if (chess.isCheck() && cls === 'blunder') {
    return `Nach **${sanDe(reply.san)}** gerät der König von ${side} in große Gefahr.`;
  }
  if (cls === 'blunder' || cls === 'mistake') {
    return `${GENERIC[cls]} Die Antwort **${sanDe(reply.san)}** ist jetzt sehr stark.`;
  }
  return null;
}

/** Was hätte der beste Zug gebracht? */
function missedIdea(ctx, k) {
  const { game, positions } = ctx;
  const move = game.moves[k];
  const fen = game.fens[k];
  const best = positions[k].lines[0];
  if (!best || !ctx.review.moves[k].best) return null;
  const bm = pvToMoves(fen, best.pv, 1)[0];
  if (!bm) return null;
  const mine = (ev) => ev.type === 'mate' && ev.value !== 0 && (ev.value > 0) === (move.color === 'w');
  if (mine(best.eval)) {
    const n = Math.abs(best.eval.value);
    return n === 1
      ? `Hier war **${sanDe(bm.san)}** sofort matt!`
      : `Hier gab es ein erzwungenes Matt in ${n} Zügen, beginnend mit **${sanDe(bm.san)}**.`;
  }
  const chess = new Chess(fen);
  if (bm.captured) {
    const gain = see(chess, bm.to);
    if (gain > 0) return `${SIDE[move.color]} konnte mit **${sanDe(bm.san)}** ${gainText(bm.captured, gain)} gewinnen.`;
  }
  chess.move({ from: bm.from, to: bm.to, promotion: bm.promotion || undefined });
  const fork = forkTargets(chess, bm.to);
  if (fork.length >= 2 && see(chess, bm.to) === 0) {
    const names = fork.slice(0, 2).map((t) => NOM[t.type].replace(/^(der|die) /, ''));
    return `**${sanDe(bm.san)}** wäre eine Gabel auf ${names[0]} und ${names[1]} gewesen.`;
  }
  return null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const BEST_PRAISE = [
  'Genau so würde es auch die Engine spielen.',
  'Das ist der stärkste Zug in dieser Stellung.',
  'Besser geht es nicht.',
  'Stark gespielt – das ist die erste Wahl der Engine.',
];

const GENERIC = {
  inaccuracy: 'Der Zug ist spielbar, gibt aber einen Teil des Vorteils aus der Hand.',
  mistake: 'Das verschlechtert die Stellung deutlich.',
  blunder: 'Das ist ein schwerer Fehler, der die Stellung kippen lässt.',
  miss: 'Der Gegner hatte gerade einen Fehler gemacht – diese Chance bleibt ungenutzt.',
};

/**
 * Erklärung zu Zug k (Index in game.moves).
 * @returns { cls, title, paragraphs[], best: { san, uci } | null }
 */
export function explainMove(ctx, k) {
  const { game, positions, review } = ctx;
  const move = game.moves[k];
  const info = review.moves[k];
  const cls = info.cls;
  const fen = game.fens[k];
  const prev = k > 0 ? game.moves[k - 1] : null;
  const side = SIDE[move.color];
  const san = sanDe(move.san);
  const bestLine = info.best ? positions[k].lines[0] : null;
  const bestMove = bestLine ? pvToMoves(fen, bestLine.pv, 1)[0] : null;
  const bestSan = bestMove ? sanDe(bestMove.san) : null;
  const paragraphs = [];
  const after = positions[k + 1];
  const what = describeMove(fen, move, prev, k);

  const title = cls === 'forced' ? `${san} ist erzwungen` : `${san} ist ${CLASSES[cls].noun}`;

  if (after.terminal === 'mate') {
    paragraphs.push(`Schachmatt! ${side} gewinnt die Partie.`);
    return { cls, title, paragraphs, best: null };
  }

  if (cls === 'book') {
    const op = review.opening;
    if (op && op.ply === k + 1) paragraphs.push(`Das ist bekannte Eröffnungstheorie: **${op.name}**.`);
    else paragraphs.push(what ? `Ein bekannter Theoriezug: ${side} ${what}.` : 'Ein bekannter Zug aus der Eröffnungstheorie.');
  } else if (cls === 'forced') {
    paragraphs.push('Es gab nur diesen einen legalen Zug.');
  } else if (cls === 'brilliant') {
    paragraphs.push(`Ein starkes Opfer! ${side} gibt Material und bekommt dafür mehr zurück${what ? ': Der Zug ' + what : ''}.`);
  } else if (cls === 'great') {
    const keep = info.winAfter >= 62 ? 'den Vorteil festhält' : info.winAfter >= 40 ? 'die Stellung im Gleichgewicht hält' : 'noch Widerstand leistet';
    paragraphs.push(`Das war der einzige Zug, der ${keep}${what ? ': ' + side + ' ' + what : ''}.`);
  } else if (cls === 'best') {
    const praise = BEST_PRAISE[k % BEST_PRAISE.length];
    paragraphs.push(what ? `${side} ${what}. ${praise}` : praise);
  } else if (cls === 'excellent') {
    paragraphs.push((what ? `${side} ${what}. ` : '') + (bestSan ? `Fast genauso stark wie der beste Zug **${bestSan}**.` : 'Ein sehr starker Zug.'));
  } else if (cls === 'good') {
    paragraphs.push((what ? `${side} ${what}. ` : '') + (bestSan ? `Ein ordentlicher Zug – **${bestSan}** war aber noch etwas genauer.` : 'Ein ordentlicher Zug.'));
  } else if (BAD.has(cls)) {
    const reasons = [];
    const missed = missedIdea(ctx, k);
    const refute = refutation(ctx, k);
    if (cls === 'miss') {
      if (missed) reasons.push(missed);
      else if (refute) reasons.push(refute);
    } else {
      if (refute) reasons.push(refute);
      if (missed && (!refute || /matt/i.test(missed))) reasons.push(missed);
    }
    if (!reasons.length) reasons.push(GENERIC[cls]);
    paragraphs.push(reasons.join(' '));
    if (bestSan && !reasons.some((r) => r.includes(`**${bestSan}**`))) {
      const bestWhat = describeMove(fen, bestMove, prev, k);
      paragraphs.push(`Besser war **${bestSan}**` + (bestWhat ? `: Das ${bestWhat}.` : '.'));
    }
  }

  const v = verdict(review.evals[k + 1]);
  if (v && cls !== 'book') paragraphs.push(v);
  if (after.terminal === 'draw') paragraphs.push('Die Partie endet remis.');

  return {
    cls,
    title,
    paragraphs,
    best: bestMove && !info.isBest && cls !== 'book' && cls !== 'forced' ? { san: bestSan, uci: bestMove.uci } : null,
  };
}

const TERMINATION = [
  [/checkmate/i, 'durch Schachmatt'],
  [/resign/i, 'durch Aufgabe'],
  [/on time|timeout/i, 'auf Zeit'],
  [/abandon/i, 'durch Partieabbruch'],
  [/stalemate/i, 'durch Patt'],
  [/repetition/i, 'durch Zugwiederholung'],
  [/agreement/i, 'durch Einigung'],
  [/insufficient/i, 'wegen ungenügenden Materials'],
  [/50-move/i, 'nach der 50-Züge-Regel'],
];

/** Ein Satz zum Partieergebnis. */
export function resultText(game) {
  const how = (TERMINATION.find(([re]) => re.test(game.termination)) || [])[1] || '';
  if (game.result === '1-0') return `${game.white.name} gewinnt mit Weiß${how ? ' ' + how : ''}.`;
  if (game.result === '0-1') return `${game.black.name} gewinnt mit Schwarz${how ? ' ' + how : ''}.`;
  if (game.result === '1/2-1/2') return `Die Partie endet remis${how ? ' ' + how : ''}.`;
  return '';
}

/** Zusammenfassung für die Übersicht. Gibt auch den Schlüsselmoment zurück. */
export function summarize(ctx) {
  const { game, review } = ctx;
  const acc = review.accuracy;
  const blunders = review.counts.w.blunder + review.counts.b.blunder;
  const parts = [];
  if (acc.w >= 90 && acc.b >= 90) parts.push('Eine sehr saubere Partie von beiden Seiten.');
  else if (blunders >= 4) parts.push('Eine wilde Partie mit vielen Wendungen!');
  else if (Math.abs(acc.w - acc.b) >= 10) parts.push('Eine ziemlich einseitige Partie.');
  else parts.push('Eine umkämpfte Partie.');
  const res = resultText(game);
  if (res) parts.push(res);

  let key = -1;
  review.moves.forEach((m, i) => {
    if (BAD.has(m.cls) && (key < 0 || m.loss > review.moves[key].loss)) key = i;
  });
  let keyText = '';
  if (key >= 0 && review.moves[key].loss >= 10) {
    const mv = game.moves[key];
    const num = Math.floor(key / 2) + 1;
    keyText = `Der größte Wendepunkt war ${num}.${mv.color === 'b' ? '..' : ''} ${sanDe(mv.san)} – ${CLASSES[review.moves[key].cls].noun}.`;
  }
  return { text: parts.join(' '), keyText, keyPly: key >= 0 ? key + 1 : null };
}
