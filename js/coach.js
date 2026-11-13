// Der Coach: erzeugt aus Engine-Daten und Taktik-Mustern verständliche Erklärungen.
// Ist bekannt, welche Seite der Nutzer gespielt hat (ctx.you), spricht der Coach ihn direkt an.
import { Chess } from '../vendor/chess.js';
import { CLASSES, BAD, winPct } from './analysis.js';
import { see, hangingPieces, forkTargets, pinsBy, mateThreat, materialInfo, VAL } from './tactics.js';

const SIDE = { w: 'Weiß', b: 'Schwarz' };
const ACC = { p: 'den Bauern', n: 'den Springer', b: 'den Läufer', r: 'den Turm', q: 'die Dame', k: 'den König' };
const NOM = { p: 'der Bauer', n: 'der Springer', b: 'der Läufer', r: 'der Turm', q: 'die Dame', k: 'der König' };
const BARE = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
const INDEF = { p: 'einen Bauern', n: 'einen Springer', b: 'einen Läufer', r: 'einen Turm', q: 'die Dame' };
const PLURAL = { p: 'Bauern', n: 'Springer', b: 'Läufer', r: 'Türme', q: 'Damen' };
const PROMO = { q: 'eine Dame', r: 'einen Turm', b: 'einen Läufer', n: 'einen Springer' };

// ---------------------------------------------------------------------------
// Sprache: Anrede und Beugung
// ---------------------------------------------------------------------------

const V2 = {
  rochiert: 'rochierst', bringt: 'bringst', verwandelt: 'verwandelst', gibt: 'gibst', schlägt: 'schlägst',
  gewinnt: 'gewinnst', tauscht: 'tauschst', greift: 'greifst', deckt: 'deckst', entwickelt: 'entwickelst',
  stellt: 'stellst', rückt: 'rückst', aktiviert: 'aktivierst', fesselt: 'fesselst', legt: 'legst',
  droht: 'drohst', verliert: 'verlierst', übersieht: 'übersiehst', konnte: 'konntest', kann: 'kannst',
  steht: 'stehst', bekommt: 'bekommst', sichert: 'sicherst',
};
const V2_RE = new RegExp(`(?<![\\p{L}])(${Object.keys(V2).join('|')})(?![\\p{L}])`, 'gu');
const second = (text) => text.replace(V2_RE, (w) => V2[w]);

function persona(ctx, color) {
  if (!ctx.you) {
    return { subj: SIDE[color], low: SIDE[color], p2: false, king: color === 'w' ? 'der weiße König' : 'der schwarze König' };
  }
  if (ctx.you === color) return { subj: 'Du', low: 'du', p2: true, king: 'dein König' };
  return { subj: 'Dein Gegner', low: 'dein Gegner', p2: false, king: 'der König deines Gegners' };
}

/** Satzteil mit Subjekt: say(ctx, 'w', 'entwickelt den Springer') → „Du entwickelst den Springer“. */
export function say(ctx, color, predicate, low = false) {
  const p = persona(ctx, color);
  return `${low ? p.low : p.subj} ${p.p2 ? second(predicate) : predicate}`;
}

/** Wie say(), aber mit dem Verb vor dem Subjekt: „verlierst du“ / „verliert Weiß“. */
function sayInv(ctx, color, verb) {
  const p = persona(ctx, color);
  return `${p.p2 ? second(verb) : verb} ${p.low}`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

function pointsText(points) {
  if (points >= 8) return 'die Dame';
  if (points >= 6) return 'viel Material';
  if (points === 5) return 'einen Turm';
  if (points === 3) return 'eine Figur';
  if (points === 1) return 'einen Bauern';
  return 'Material';
}

function gainText(type, gain) {
  if (VAL[type] && gain >= VAL[type]) return INDEF[type];
  if (type === 'r' && gain === 2) return 'die Qualität';
  return pointsText(gain);
}

function verdict(ctx, ev) {
  const w = winPct(ev);
  if (ev.type === 'mate') {
    if (ev.value === 0) return '';
    const n = Math.abs(ev.value);
    return say(ctx, ev.value > 0 ? 'w' : 'b', `kann in ${n} ${n === 1 ? 'Zug' : 'Zügen'} mattsetzen`) + '.';
  }
  const c = w >= 50 ? 'w' : 'b';
  const d = Math.abs(w - 50);
  if (d < 6) return 'Die Stellung ist ausgeglichen.';
  if (d < 15) return say(ctx, c, 'steht etwas besser') + '.';
  if (d < 30) return say(ctx, c, 'steht klar besser') + '.';
  if (d < 43) return say(ctx, c, 'steht auf Gewinn') + '.';
  return say(ctx, c, 'steht völlig auf Gewinn') + '.';
}

// ---------------------------------------------------------------------------
// Was bewirkt ein Zug?
// ---------------------------------------------------------------------------

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
 * Beschreibt in einer Verbphrase (3. Person), was ein Zug bewirkt,
 * z. B. „entwickelt den Springer und greift die Dame auf d8 an“.
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

  const parts = [];
  const safeHere = see(chess, m.to) === 0;

  if (m.isKingsideCastle()) parts.push('rochiert kurz und bringt den König in Sicherheit');
  else if (m.isQueensideCastle()) parts.push('rochiert lang und bringt den König in Sicherheit');
  else if (m.promotion) parts.push(`verwandelt den Bauern in ${PROMO[m.promotion]}`);
  else if (m.captured) {
    if (prev && prev.captured && prev.to === m.to) parts.push('schlägt zurück');
    else if (m.isEnPassant()) parts.push('schlägt den Bauern en passant');
    else if (seeBefore >= VAL[m.captured] && m.captured !== 'p') parts.push(`gewinnt ${ACC[m.captured]} auf ${m.to}`);
    else if (seeBefore > 0 && m.captured !== 'p') parts.push(`schlägt ${ACC[m.captured]} auf ${m.to} und gewinnt Material`);
    else if (m.captured === m.piece && m.piece !== 'p') parts.push(`tauscht die ${PLURAL[m.piece]}`);
    else parts.push(`schlägt ${ACC[m.captured]} auf ${m.to}`);
  }

  if (check) parts.push('gibt Schach');

  const fork = forkTargets(chess, m.to);
  if (fork.length >= 2 && safeHere) {
    parts.push(`greift mit einer Gabel ${BARE[fork[0].type]} und ${BARE[fork[1].type]} an`);
  } else {
    const pin = safeHere && 'brq'.includes(m.piece) ? pinsBy(chess, m.to)[0] : null;
    if (pin) {
      parts.push(`fesselt ${ACC[pin.type]} auf ${pin.square} an ${pin.behind === 'k' ? 'den König' : 'die Dame'}`);
    } else {
      // neue Drohung gegen eine gegnerische Figur (direkt oder per Abzug)
      const hungBefore = new Set(hangingPieces(fen, enemy).map((h) => h.square));
      const threat = hangingPieces(after, enemy).find((h) => !hungBefore.has(h.square) && h.type !== 'p');
      if (threat && safeHere) {
        const direct = chess.attackers(threat.square, mover).includes(m.to);
        parts.push(direct ? `greift ${ACC[threat.type]} auf ${threat.square} an` : `legt einen Abzugsangriff auf ${ACC[threat.type]} frei`);
      }
    }
  }

  if (!check && safeHere && mateThreat(after)) parts.push('droht Matt');

  // eigene Figuren gerettet oder gedeckt
  const ownHungBefore = hangingPieces(fen, mover);
  if (ownHungBefore.some((h) => h.square === m.from) && safeHere && m.piece !== 'p' && !m.captured) {
    parts.push(`bringt ${ACC[m.piece]} in Sicherheit`);
  } else {
    const ownHungAfter = new Set(hangingPieces(after, mover).map((h) => h.square));
    const saved = ownHungBefore.find((h) => h.square !== m.from && !ownHungAfter.has(h.square) && h.type !== 'p');
    if (saved) parts.push(`sichert ${ACC[saved.type]} auf ${saved.square}`);
  }

  const homeRank = mover === 'w' ? '1' : '8';
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === homeRank && ply < 30 && !m.captured && parts.length <= 1) {
    parts.unshift(`entwickelt ${ACC[m.piece]}`);
  } else if (!parts.length || (parts.length === 1 && check)) {
    if (m.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(m.to) && ply < 16) parts.push('besetzt das Zentrum');
    else if (m.piece === 'r' && fileKind && m.from[0] !== m.to[0]) parts.push(`stellt den Turm auf die ${fileKind} ${m.to[0]}-Linie`);
    else if (m.piece === 'p' && ((mover === 'w' && +m.to[1] >= 6) || (mover === 'b' && +m.to[1] <= 3))) {
      parts.push('rückt mit dem Bauern weiter in Richtung Umwandlung vor');
    } else if (m.piece === 'k' && ply > 50) parts.push('aktiviert den König');
  }
  if (!parts.length) return null;
  return parts.slice(0, 2).join(' und ');
}

// ---------------------------------------------------------------------------
// Warum war ein Zug schlecht?
// ---------------------------------------------------------------------------

/** Materialveränderung (aus Sicht von Weiß) entlang einer Variante bis zur nächsten ruhigen Stellung. */
function materialSwing(fen, moves, max = 8) {
  if (!moves.length) return { delta: 0, end: -1 };
  const base = materialInfo(fen).diff;
  const last = Math.min(moves.length, max) - 1;
  let end = last;
  for (let i = last; i >= 0; i--) {
    const next = moves[i + 1];
    if (!next || !next.captured) {
      end = i;
      break;
    }
  }
  return { delta: materialInfo(moves[end].fen).diff - base, end };
}

function diagnose(ctx, k) {
  const cache = ctx.review.diag || (ctx.review.diag = new Map());
  if (!cache.has(k)) cache.set(k, { refute: refutation(ctx, k), missed: missedIdea(ctx, k) });
  return cache.get(k);
}

/** Sucht die Widerlegung des gespielten Zuges in der Engine-Variante. → { text, tag } | null */
function refutation(ctx, k) {
  const { game, positions, review } = ctx;
  const move = game.moves[k];
  const fenBefore = game.fens[k];
  const fenAfter = game.fens[k + 1];
  const after = positions[k + 1];
  const afterEval = review.evals[k + 1];
  const sign = move.color === 'w' ? 1 : -1;
  const pvMoves = after.lines[0] ? pvToMoves(fenAfter, after.lines[0].pv, 10) : [];
  const reply = pvMoves[0];
  const oppWins = (ev) => ev.type === 'mate' && ev.value !== 0 && (ev.value > 0) === (move.color === 'b');

  if (after.terminal === 'draw') return { text: 'Damit ist die Partie nur noch remis.', tag: 'draw' };
  if (oppWins(afterEval) && reply) {
    const n = Math.abs(afterEval.value);
    return {
      tag: 'mate-allowed',
      text: n === 1
        ? `Das erlaubt **${sanDe(reply.san)}** – und das ist Matt.`
        : `Das erlaubt ein erzwungenes Matt in ${n} Zügen, beginnend mit **${sanDe(reply.san)}**.`,
    };
  }
  if (!reply) return null;

  const chess = new Chess(fenAfter);
  if (reply.captured) {
    // Beim Zurückschlagen zählt nur, was unterm Strich verloren geht
    const got = reply.to === move.to && move.captured ? VAL[move.captured] : 0;
    const gain = see(chess, reply.to) - got;
    if (gain > 0) {
      const what = got ? pointsText(gain) : gainText(reply.captured, gain);
      if (reply.to === move.to) {
        return {
          tag: 'hung',
          text: `${cap(NOM[move.promotion || move.piece])} kann auf ${move.to} einfach geschlagen werden: **${sanDe(reply.san)}** gewinnt ${what}.`,
        };
      }
      const wasHanging = hangingPieces(fenBefore, move.color).some((h) => h.square === reply.to);
      if (wasHanging) {
        return {
          tag: 'overlooked',
          text: `${say(ctx, move.color, 'übersieht')}, dass ${NOM[reply.captured]} auf ${reply.to} angegriffen war: **${sanDe(reply.san)}** gewinnt ${what}.`,
        };
      }
      return { tag: 'hung', text: `Der Zug lässt ${ACC[reply.captured]} auf ${reply.to} im Stich: **${sanDe(reply.san)}** gewinnt ${what}.` };
    }
  }
  chess.move({ from: reply.from, to: reply.to, promotion: reply.promotion || undefined });
  const fork = forkTargets(chess, reply.to);
  if (fork.length >= 2) {
    return { tag: 'fork-allowed', text: `Das erlaubt **${sanDe(reply.san)}** mit einer Gabel auf ${BARE[fork[0].type]} und ${BARE[fork[1].type]}.` };
  }
  const pin = 'brq'.includes(reply.piece) && see(chess, reply.to) === 0 ? pinsBy(chess, reply.to)[0] : null;

  // Was kostet die Engine-Variante an Material – verglichen mit dem besten Zug?
  const played = materialSwing(fenAfter, pvMoves);
  const bestLine = positions[k].lines[0];
  const bestMoves = bestLine ? pvToMoves(fenBefore, bestLine.pv, 10) : [];
  const best = materialSwing(fenBefore, bestMoves);
  const base = move.captured ? VAL[move.captured] : 0; // was der gespielte Zug selbst schon geschlagen hat
  const lost = sign * best.delta - (sign * played.delta + base);
  const cls = review.moves[k].cls;
  if (lost >= 2 || (lost >= 1 && cls !== 'inaccuracy')) {
    const line = lineText(fenAfter, pvMoves.slice(0, Math.max(1, Math.min(played.end + 1, 5))));
    const lead = pin ? `**${sanDe(reply.san)}** fesselt ${ACC[pin.type]}. ` : '';
    return { tag: 'material', text: `${lead}Nach **${line}** ${sayInv(ctx, move.color, 'verliert')} ${pointsText(lost)}.` };
  }
  if (pin) {
    return { tag: 'pin', text: `Das erlaubt **${sanDe(reply.san)}**: ${cap(NOM[pin.type])} auf ${pin.square} ist gefesselt und kann nicht weg.` };
  }
  const checks = pvMoves.slice(0, 7).filter((m, i) => i % 2 === 0 && /[+#]/.test(m.san)).length;
  if (checks >= 2 && (cls === 'blunder' || cls === 'mistake')) {
    return { tag: 'king', text: `Nach **${sanDe(reply.san)}** kommt ${persona(ctx, move.color).king} nicht mehr zur Ruhe.` };
  }
  if (cls === 'blunder' || cls === 'mistake') {
    return { tag: 'generic', text: `${GENERIC[cls]} Stark ist jetzt **${lineText(fenAfter, pvMoves.slice(0, 3))}**.` };
  }
  return null;
}

/** Was hätte der beste Zug gebracht? → { text, tag } | null */
function missedIdea(ctx, k) {
  const { game, positions, review } = ctx;
  const move = game.moves[k];
  const fen = game.fens[k];
  const best = positions[k].lines[0];
  if (!best || !review.moves[k].best) return null;
  const bestMoves = pvToMoves(fen, best.pv, 10);
  const bm = bestMoves[0];
  if (!bm) return null;
  const sign = move.color === 'w' ? 1 : -1;
  const mine = (ev) => ev.type === 'mate' && ev.value !== 0 && (ev.value > 0) === (move.color === 'w');
  if (mine(best.eval)) {
    const n = Math.abs(best.eval.value);
    return {
      tag: 'mate-missed',
      text: n === 1
        ? `Hier war **${sanDe(bm.san)}** sofort matt!`
        : `Hier gab es ein erzwungenes Matt in ${n} Zügen, beginnend mit **${sanDe(bm.san)}**.`,
    };
  }
  const chess = new Chess(fen);
  if (bm.captured) {
    const gain = see(chess, bm.to);
    if (gain > 0) {
      return { tag: 'win-missed', text: `${say(ctx, move.color, 'konnte')} mit **${sanDe(bm.san)}** ${gainText(bm.captured, gain)} gewinnen.` };
    }
  }
  chess.move({ from: bm.from, to: bm.to, promotion: bm.promotion || undefined });
  const fork = forkTargets(chess, bm.to);
  if (fork.length >= 2 && see(chess, bm.to) === 0) {
    return { tag: 'win-missed', text: `**${sanDe(bm.san)}** wäre eine Gabel auf ${BARE[fork[0].type]} und ${BARE[fork[1].type]} gewesen.` };
  }
  // Materialgewinn über mehrere Züge
  const swing = materialSwing(fen, bestMoves);
  const playedLine = positions[k + 1].lines[0] ? pvToMoves(game.fens[k + 1], positions[k + 1].lines[0].pv, 10) : [];
  const played = materialSwing(game.fens[k + 1], playedLine);
  const base = move.captured ? VAL[move.captured] : 0;
  const gain = sign * swing.delta;
  if (gain >= 1 && gain - (sign * played.delta + base) >= 2) {
    const line = lineText(fen, bestMoves.slice(0, Math.max(1, Math.min(swing.end + 1, 5))));
    return { tag: 'win-missed', text: `${say(ctx, move.color, 'konnte')} mit **${line}** ${pointsText(gain)} gewinnen.` };
  }
  return null;
}

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
 * @returns { cls, title, paragraphs[], best: { san, uci } | null, threat: uci | null }
 */
export function explainMove(ctx, k) {
  const { game, positions, review } = ctx;
  const move = game.moves[k];
  const info = review.moves[k];
  const cls = info.cls;
  const fen = game.fens[k];
  const prev = k > 0 ? game.moves[k - 1] : null;
  const san = sanDe(move.san);
  const bestLine = info.best ? positions[k].lines[0] : null;
  const bestMove = bestLine ? pvToMoves(fen, bestLine.pv, 1)[0] : null;
  const bestSan = bestMove ? sanDe(bestMove.san) : null;
  const paragraphs = [];
  const after = positions[k + 1];
  const what = describeMove(fen, move, prev, k);
  const does = what ? say(ctx, move.color, what) : null;
  let threat = null;

  const title = cls === 'forced' ? `${san} ist erzwungen` : `${san} ist ${CLASSES[cls].noun}`;

  if (after.terminal === 'mate') {
    paragraphs.push(`Schachmatt! ${say(ctx, move.color, 'gewinnt die Partie')}.`);
    return { cls, title, paragraphs, best: null, threat };
  }

  if (cls === 'book') {
    const op = review.opening;
    if (op && op.ply === k + 1) paragraphs.push(`Das ist bekannte Eröffnungstheorie: **${op.name}**.`);
    else paragraphs.push(does ? `Ein bekannter Theoriezug: ${does}.` : 'Ein bekannter Zug aus der Eröffnungstheorie.');
  } else if (cls === 'forced') {
    paragraphs.push('Es gab nur diesen einen legalen Zug.');
  } else if (cls === 'brilliant') {
    paragraphs.push(`Ein starkes Opfer! ${say(ctx, move.color, 'gibt Material und bekommt dafür mehr zurück')}${what ? ': Der Zug ' + what : ''}.`);
    const follow = after.lines[0] ? pvToMoves(game.fens[k + 1], after.lines[0].pv, 4) : [];
    if (follow.length >= 2) paragraphs.push(`Die Idee: ${lineText(game.fens[k + 1], follow)}.`);
  } else if (cls === 'great') {
    const keep = info.winAfter >= 62 ? 'den Vorteil festhält' : info.winAfter >= 40 ? 'die Stellung im Gleichgewicht hält' : 'noch Widerstand leistet';
    paragraphs.push(`Das war der einzige Zug, der ${keep}${does ? ': ' + does : ''}.`);
  } else if (cls === 'best') {
    const praise = BEST_PRAISE[k % BEST_PRAISE.length];
    paragraphs.push(does ? `${does}. ${praise}` : praise);
  } else if (cls === 'excellent') {
    paragraphs.push((does ? `${does}. ` : '') + (bestSan ? `Fast genauso stark wie der beste Zug **${bestSan}**.` : 'Ein sehr starker Zug.'));
  } else if (cls === 'good') {
    paragraphs.push((does ? `${does}. ` : '') + (bestSan ? `Ein ordentlicher Zug – **${bestSan}** war aber noch etwas genauer.` : 'Ein ordentlicher Zug.'));
  } else if (BAD.has(cls)) {
    const { refute, missed } = diagnose(ctx, k);
    const reasons = [];
    if (cls === 'miss') {
      if (missed) reasons.push(missed.text);
      else if (refute) reasons.push(refute.text);
    } else {
      if (refute) reasons.push(refute.text);
      if (missed && (!refute || refute.tag === 'generic' || missed.tag === 'mate-missed')) reasons.push(missed.text);
    }
    if (!reasons.length) reasons.push(GENERIC[cls]);
    paragraphs.push(reasons.join(' '));
    if (bestSan && !reasons.some((r) => r.includes(`**${bestSan}`) || r.includes(`. ${bestSan} `) || r.includes(`… ${bestSan} `))) {
      const bestWhat = describeMove(fen, bestMove, prev, k);
      paragraphs.push(`Besser war **${bestSan}**` + (bestWhat ? `: Das ${bestWhat}.` : '.'));
    }
    if ((cls === 'blunder' || cls === 'mistake') && after.lines[0]) threat = after.lines[0].move;
  }

  // Stellungsurteil nur nennen, wenn es sich geändert hat (oder der Zug schlecht war)
  const v = verdict(ctx, review.evals[k + 1]);
  const changed = v !== verdict(ctx, review.evals[k]);
  if (v && cls !== 'book' && (changed || BAD.has(cls))) paragraphs.push(v);
  if (after.terminal === 'draw') paragraphs.push('Die Partie endet remis.');

  return {
    cls,
    title,
    paragraphs,
    best: bestMove && !info.isBest && cls !== 'book' && cls !== 'forced' ? { san: bestSan, uci: bestMove.uci } : null,
    threat,
  };
}

// ---------------------------------------------------------------------------
// Zusammenfassung der Partie
// ---------------------------------------------------------------------------

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

function nonPawnMaterial(fen) {
  let total = 0;
  for (const ch of fen.split(' ')[0]) total += { q: 9, r: 5, b: 3, n: 3 }[ch.toLowerCase()] || 0;
  return total;
}

/** Teilt die Partie in Eröffnung, Mittelspiel und Endspiel und bewertet jede Phase je Seite. */
function phases(ctx) {
  const { game, review } = ctx;
  const n = game.moves.length;
  const openingEnd = Math.min(n, Math.max(16, Math.min(24, (review.opening ? review.opening.ply : 0) + 6)));
  let endStart = n;
  for (let k = openingEnd; k < n; k++) {
    if (nonPawnMaterial(game.fens[k]) <= 26) {
      endStart = k;
      break;
    }
  }
  const ranges = [['Eröffnung', 0, openingEnd], ['Mittelspiel', openingEnd, endStart], ['Endspiel', endStart, n]];
  return ranges.map(([name, a, b]) => {
    const row = { name };
    for (const c of ['w', 'b']) {
      const accs = [];
      for (let k = a; k < b; k++) if (game.moves[k].color === c) accs.push(review.moves[k].accuracy);
      const avg = accs.length ? accs.reduce((x, y) => x + y, 0) / accs.length : null;
      row[c] = avg == null ? null
        : avg >= 93 ? 'best' : avg >= 85 ? 'excellent' : avg >= 75 ? 'good' : avg >= 62 ? 'inaccuracy' : avg >= 48 ? 'mistake' : 'blunder';
    }
    return row;
  });
}

const TIP = {
  hung: (n) => `${n}× Material eingestellt. Vor jedem Zug prüfen: Ist das Zielfeld gedeckt – und hängt danach etwas?`,
  overlooked: (n) => `${n}× einen Angriff auf eine eigene Figur übersehen. Nach jedem gegnerischen Zug fragen: Was droht jetzt?`,
  'mate-allowed': () => 'Ein Matt zugelassen. Die Fluchtfelder des eigenen Königs im Blick behalten.',
  'mate-missed': () => 'Ein Matt ausgelassen. Schachgebote immer bis zum Ende durchrechnen.',
  'win-missed': (n) => `${n}× Materialgewinn verpasst. Zuerst nach Schachs, Schlagzügen und Drohungen schauen.`,
  'fork-allowed': (n) => `${n}× eine Gabel zugelassen. Auf Springer- und Bauernzüge achten, die zwei Figuren treffen.`,
  material: (n) => `${n}× in eine Abwicklung gelaufen, die Material kostet. Schlagfolgen bis zum letzten Zug durchrechnen.`,
  pin: () => 'Eine Fesselung zugelassen. Wertvolle Figuren nicht auf dieselbe Linie wie den König stellen.',
  king: () => 'Der König geriet in einen Angriff. Früh rochieren und die Bauern vor dem König zusammenhalten.',
  time: (n) => `${n} Fehler in Zeitnot. Die Bedenkzeit früher einteilen.`,
};
const TIP_ORDER = ['mate-allowed', 'hung', 'overlooked', 'material', 'win-missed', 'mate-missed', 'fork-allowed', 'pin', 'king', 'time'];

/** Lernpunkte für eine Seite: Welche Fehlermuster kamen vor? */
function tipsFor(ctx, color) {
  const { game, review } = ctx;
  const count = {};
  const add = (tag) => { count[tag] = (count[tag] || 0) + 1; };
  const base = parseInt(game.timeControl, 10);
  game.moves.forEach((m, k) => {
    const cls = review.moves[k].cls;
    if (m.color !== color || !BAD.has(cls) || cls === 'inaccuracy') return;
    const { refute, missed } = diagnose(ctx, k);
    if (cls === 'miss' && missed) add(missed.tag);
    else if (refute && TIP[refute.tag]) add(refute.tag);
    else if (missed) add(missed.tag);
    if (m.clock != null && base >= 120 && m.clock < Math.max(15, base * 0.08)) add('time');
  });
  if (count.time < 2) delete count.time;
  return TIP_ORDER.filter((t) => count[t]).slice(0, 3).map((t) => TIP[t](count[t]));
}

/** Zusammenfassung für die Übersicht: Text, Schlüsselmomente, Partiephasen, Lernpunkte. */
export function summarize(ctx) {
  const { game, review } = ctx;
  const acc = review.accuracy;
  const blunders = review.counts.w.blunder + review.counts.b.blunder;
  const parts = [];
  const youWon = (ctx.you === 'w' && game.result === '1-0') || (ctx.you === 'b' && game.result === '0-1');
  const youLost = (ctx.you === 'b' && game.result === '1-0') || (ctx.you === 'w' && game.result === '0-1');
  if (youWon) parts.push('Glückwunsch zum Sieg!');
  else if (youLost) parts.push('Diesmal hat es nicht gereicht – schauen wir, woran es lag.');
  if (acc.w >= 90 && acc.b >= 90) parts.push('Eine sehr saubere Partie von beiden Seiten.');
  else if (blunders >= 4) parts.push('Eine wilde Partie mit vielen Wendungen!');
  else if (Math.abs(acc.w - acc.b) >= 10) parts.push('Eine ziemlich einseitige Partie.');
  else parts.push('Eine umkämpfte Partie.');
  const res = resultText(game);
  if (res) parts.push(res);

  const label = (k) => `${Math.floor(k / 2) + 1}.${game.moves[k].color === 'b' ? '..' : ''} ${sanDe(game.moves[k].san)}`;
  let key = -1;
  const scored = [];
  review.moves.forEach((m, k) => {
    if (BAD.has(m.cls) && (key < 0 || m.loss > review.moves[key].loss)) key = k;
    const weight = m.cls === 'brilliant' ? 30 : m.cls === 'great' ? 14 : BAD.has(m.cls) && m.cls !== 'inaccuracy' ? m.loss : 0;
    if (weight) scored.push({ k, weight });
  });
  const moments = scored.sort((a, b) => b.weight - a.weight).slice(0, 5).sort((a, b) => a.k - b.k)
    .map(({ k }) => ({ ply: k + 1, cls: review.moves[k].cls, label: label(k), color: game.moves[k].color }));

  let keyText = '';
  if (key >= 0 && review.moves[key].loss >= 10) {
    keyText = `Der größte Wendepunkt war ${label(key)} – ${CLASSES[review.moves[key].cls].noun}.`;
  }

  const tips = [];
  for (const c of ctx.you ? [ctx.you] : ['w', 'b']) {
    const items = tipsFor(ctx, c);
    const serious = review.counts[c].blunder + review.counts[c].mistake + review.counts[c].miss;
    if (!items.length && !serious) items.push('Kaum etwas auszusetzen – eine saubere Partie ohne grobe Fehler.');
    if (items.length) tips.push({ color: c, who: ctx.you ? 'Darauf kannst du achten' : (c === 'w' ? game.white.name : game.black.name), items });
  }

  return { text: parts.join(' '), keyText, keyPly: key >= 0 ? key + 1 : null, moments, phases: phases(ctx), tips };
}
