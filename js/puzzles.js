// Taktikaufgaben: endlose Aufgaben passend zur eigenen Wertung, mit Serie, Statistik und Themenfilter.
// Die Aufgaben stammen aus der frei verfügbaren Lichess-Sammlung (CC0), siehe tools/build-puzzles.mjs.
import { Chess } from '../vendor/chess.js';

const BANDS = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
const GREEN = 'rgba(129, 182, 76, .6)';
const RED = 'rgba(250, 65, 45, .55)';
const LAST = 'rgba(255, 213, 79, .5)';
const SIDE = { w: 'Weiß', b: 'Schwarz' };

const THEME = {
  mateIn1: 'Matt in 1', mateIn2: 'Matt in 2', mateIn3: 'Matt in 3', mateIn4: 'Matt in 4', mateIn5: 'Matt in 5',
  fork: 'Gabel', pin: 'Fesselung', skewer: 'Spieß', discoveredAttack: 'Abzugsangriff', discoveredCheck: 'Abzugsschach',
  doubleCheck: 'Doppelschach', deflection: 'Ablenkung', attraction: 'Hinlenkung', sacrifice: 'Opfer',
  hangingPiece: 'Hängende Figur', trappedPiece: 'Gefangene Figur', capturingDefender: 'Verteidiger beseitigen',
  intermezzo: 'Zwischenzug', quietMove: 'Stiller Zug', defensiveMove: 'Verteidigungszug', advancedPawn: 'Vorgerückter Bauer',
  promotion: 'Umwandlung', underPromotion: 'Unterverwandlung', enPassant: 'En passant', backRankMate: 'Grundreihenmatt',
  smotheredMate: 'Ersticktes Matt', anastasiaMate: 'Anastasias Matt', arabianMate: 'Arabisches Matt',
  kingsideAttack: 'Angriff am Königsflügel', queensideAttack: 'Angriff am Damenflügel', exposedKing: 'Offener König',
  attackingF2F7: 'Angriff auf f2/f7', clearance: 'Räumung', interference: 'Unterbrechung', xRayAttack: 'Röntgenangriff',
  zugzwang: 'Zugzwang', opening: 'Eröffnung', middlegame: 'Mittelspiel', endgame: 'Endspiel', rookEndgame: 'Turmendspiel',
  pawnEndgame: 'Bauernendspiel', bishopEndgame: 'Läuferendspiel', knightEndgame: 'Springerendspiel', queenEndgame: 'Damenendspiel',
};
/** Themen, die sich gezielt trainieren lassen (ohne Wertung). */
const FILTERS = ['mateIn1', 'mateIn2', 'mateIn3', 'fork', 'pin', 'skewer', 'discoveredAttack', 'deflection', 'attraction', 'sacrifice',
  'hangingPiece', 'trappedPiece', 'backRankMate', 'defensiveMove', 'promotion', 'endgame', 'rookEndgame', 'pawnEndgame'];

let d = null; // von der App übergebene Helfer
const files = new Map(); // Band → Aufgabenliste (geladen bei Bedarf)
const P = { puzzle: null, moves: [], idx: 0, fen: '', color: 'w', status: 'idle', failed: false, hint: false, last: null, delta: 0, token: 0 };

const defaults = () => ({ rating: 1000, played: 0, solved: 0, streak: 0, best: 0, recent: [], done: [], theme: '' });
const stats = () => ({ ...defaults(), ...d.store.get('puzzles', {}) });
const save = (s) => d.store.set('puzzles', s);

/** Wertung und Zahl der gelösten Aufgaben für die Startseite. */
export function puzzleSummary() {
  const s = stats();
  return { rating: Math.round(s.rating), solved: s.solved };
}

export function initPuzzles(deps) {
  d = deps;
  const sel = d.$('pz-theme');
  sel.innerHTML = '<option value="">Alle Themen (mit Wertung)</option>'
    + FILTERS.map((t) => `<option value="${t}">${THEME[t]}</option>`).join('');
  sel.onchange = () => {
    const s = stats();
    s.theme = sel.value;
    save(s);
    nextPuzzle();
  };
  d.$('pz-next').onclick = () => {
    if (P.status === 'solved' || P.status === 'shown') nextPuzzle();
    else giveUp();
  };
}

async function loadBand(band) {
  if (!files.has(band)) {
    const res = await fetch(`data/puzzles/${String(band).padStart(4, '0')}.json`);
    if (!res.ok) throw new Error('Aufgaben konnten nicht geladen werden');
    files.set(band, (await res.json()).map((line) => {
      const [id, fen, moves, rating, themes] = line.split(';');
      return { id, fen: fen + ' 0 1', moves: moves.split(' '), rating: +rating, themes: themes ? themes.split(' ') : [] };
    }));
  }
  return files.get(band);
}

const bandOf = (rating) => BANDS.reduce((best, b) => (rating >= b ? b : best), BANDS[0]);

/** Sucht eine noch nicht gespielte Aufgabe nahe der Zielwertung (und zum Thema, falls gewählt). */
async function pick(s) {
  const target = Math.max(450, Math.min(2550, s.rating + (Math.random() * 160 - 80)));
  const start = BANDS.indexOf(bandOf(target));
  const done = new Set(s.done);
  // vom passenden Band aus abwechselnd nach oben und unten weitersuchen
  const order = [start];
  for (let k = 1; k < BANDS.length; k++) {
    if (start + k < BANDS.length) order.push(start + k);
    if (start - k >= 0) order.push(start - k);
  }
  for (const i of order) {
    const list = await loadBand(BANDS[i]);
    let pool = list.filter((p) => !done.has(p.id) && (!s.theme || p.themes.includes(s.theme)));
    if (!pool.length) continue;
    const near = pool.filter((p) => Math.abs(p.rating - target) <= 110);
    if (near.length >= 5) pool = near;
    else pool.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).splice(40);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

/** Öffnet den Aufgaben-Modus und startet die nächste Aufgabe. */
export async function openPuzzles() {
  d.enterPuzzleView();
  d.$('pz-theme').value = stats().theme || '';
  await nextPuzzle();
}

async function nextPuzzle() {
  const token = ++P.token;
  P.status = 'loading';
  P.puzzle = null;
  d.board.setInteractive(false);
  d.board.setDecor({});
  renderPanel();
  d.setCoach({ title: 'Nächste Aufgabe …', paragraphs: ['Ich suche eine passende Stellung für dich.'] });
  let s = stats();
  let puzzle = null;
  try {
    puzzle = await pick(s);
    if (!puzzle && s.done.length) {
      // alles durchgespielt: von vorn beginnen
      s.done = [];
      save(s);
      puzzle = await pick(s);
    }
  } catch (e) {
    if (token !== P.token) return;
    d.setCoach({ title: 'Aufgaben nicht erreichbar', paragraphs: ['Die Aufgaben konnten nicht geladen werden. Bitte prüfe deine Verbindung und versuch es noch einmal.'], actions: [{ label: 'Nochmal versuchen', primary: true, run: nextPuzzle }] });
    return;
  }
  if (token !== P.token) return;
  if (!puzzle) {
    d.setCoach({ title: 'Keine Aufgabe gefunden', paragraphs: ['Zu diesem Thema gibt es gerade keine Aufgabe. Wähl ein anderes Thema.'] });
    return;
  }
  Object.assign(P, { puzzle, moves: puzzle.moves, idx: 0, fen: puzzle.fen, failed: false, hint: false, last: null, delta: 0 });
  P.color = puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w';
  d.board.setOrientation(P.color);
  d.board.setPosition(P.fen, { animate: false });
  renderPanel();
  d.setCoach({ title: `${SIDE[P.color]} am Zug`, paragraphs: ['Der Gegner zieht …'] });
  // Der erste Zug gehört dem Gegner – er führt in die Aufgabenstellung.
  setTimeout(() => {
    if (token !== P.token) return;
    playSolutionMove();
    P.status = 'play';
    render();
  }, 550);
}

/** Spielt den nächsten Zug der Lösung auf dem Brett. */
function playSolutionMove() {
  const u = P.moves[P.idx];
  const chess = new Chess(P.fen);
  const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  P.fen = chess.fen();
  P.idx++;
  P.last = { squares: [m.from, m.to], color: LAST };
  d.board.setPosition(P.fen, { animate: true });
  d.playSound(m.captured ? 'capture' : /[+#]/.test(m.san) ? 'check' : 'move');
}

function decor() {
  const dec = { squares: [], arrows: [] };
  if (P.last) for (const sq of P.last.squares) dec.squares.push({ square: sq, color: P.last.color });
  if (P.hint && P.status === 'play' && P.moves[P.idx]) dec.squares.push({ square: P.moves[P.idx].slice(0, 2), color: GREEN });
  return dec;
}

const themeNames = (p) => p.themes.map((t) => THEME[t]).filter(Boolean);

function render() {
  d.board.setInteractive(P.status === 'play');
  d.board.setDecor(decor());
  renderPanel();
  if (!P.puzzle) return;
  const rated = !stats().theme;
  const sign = (n) => (n > 0 ? '+' + n : String(n));
  if (P.status === 'play') {
    const first = P.idx === 1 && !P.failed;
    d.setCoach({
      title: `${SIDE[P.color]} am Zug`,
      paragraphs: [P.failed ? 'Das war es noch nicht. Versuch es noch einmal oder lass dir die Lösung zeigen.' : first ? 'Finde den besten Zug!' : 'Richtig! Wie geht es weiter?'],
      actions: [
        { label: 'Tipp', icon: 'bulb', run: () => { P.hint = true; render(); } },
        { label: 'Lösung zeigen', icon: 'star', run: giveUp },
      ],
    });
  } else if (P.status === 'solved') {
    d.setCoach({
      cls: P.failed ? 'good' : 'best',
      title: P.failed ? 'Gelöst – im zweiten Anlauf' : 'Gelöst!',
      paragraphs: [
        (rated ? `Wertung der Aufgabe: **${P.puzzle.rating}**. Deine Wertung: **${sign(P.delta)}**.` : `Wertung der Aufgabe: **${P.puzzle.rating}** (Themen-Training ohne Wertung).`),
        themeNames(P.puzzle).length ? `Themen: ${themeNames(P.puzzle).join(', ')}.` : '',
      ].filter(Boolean),
      actions: [
        { label: 'Im Analysebrett ansehen', icon: 'grid', run: () => d.openBoard(P.puzzle.fen, P.moves) },
        { label: 'Nächste Aufgabe', icon: 'arrow', primary: true, run: nextPuzzle },
      ],
    });
  } else if (P.status === 'shown') {
    d.setCoach({
      cls: 'mistake',
      title: 'Das war die Lösung',
      paragraphs: [
        (rated ? `Wertung der Aufgabe: **${P.puzzle.rating}**. Deine Wertung: **${sign(P.delta)}**.` : `Wertung der Aufgabe: **${P.puzzle.rating}**.`),
        themeNames(P.puzzle).length ? `Themen: ${themeNames(P.puzzle).join(', ')}.` : '',
      ].filter(Boolean),
      actions: [
        { label: 'Im Analysebrett ansehen', icon: 'grid', run: () => d.openBoard(P.puzzle.fen, P.moves) },
        { label: 'Nächste Aufgabe', icon: 'arrow', primary: true, run: nextPuzzle },
      ],
    });
  }
}

function renderPanel() {
  const s = stats();
  const $ = d.$;
  $('pz-rating').textContent = Math.round(s.rating);
  const delta = $('pz-delta');
  delta.textContent = P.delta ? (P.delta > 0 ? '+' + P.delta : String(P.delta)) : '';
  delta.className = 'pz-delta ' + (P.delta > 0 ? 'up' : P.delta < 0 ? 'down' : '');
  $('pz-streak').textContent = s.streak;
  $('pz-best').textContent = s.best;
  $('pz-solved').textContent = s.solved;
  $('pz-quote').textContent = s.played ? Math.round((s.solved / s.played) * 100) + ' %' : '–';
  $('pz-recent').innerHTML = s.recent.slice(-12).map((r) => `<i class="${r ? 'ok' : 'no'}"></i>`).join('') || '<span>Noch keine Aufgaben gespielt</span>';
  const done = P.status === 'solved' || P.status === 'shown';
  $('pz-next').textContent = done ? 'Nächste Aufgabe' : 'Aufgeben und Lösung zeigen';
  $('pz-next').className = 'btn ' + (done ? 'primary' : 'ghost');
  $('pz-next').disabled = P.status === 'loading' || P.status === 'busy';
  $('pz-info').textContent = P.puzzle && done ? `Aufgabe ${P.puzzle.id} · Lichess-Sammlung` : '';
}

/** Trägt das Ergebnis ein – einmal pro Aufgabe, beim ersten Fehler oder bei fehlerfreier Lösung. */
function record(success) {
  const s = stats();
  const rated = !s.theme;
  if (rated) {
    const expected = 1 / (1 + 10 ** ((P.puzzle.rating - s.rating) / 400));
    const k = s.played < 20 ? 40 : 24;
    const score = success ? (P.hint ? 0.5 : 1) : 0;
    const before = Math.round(s.rating);
    s.rating = Math.max(400, Math.min(2800, s.rating + k * (score - expected)));
    P.delta = Math.round(s.rating) - before;
  }
  s.played++;
  if (success) {
    s.solved++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.streak = 0;
  }
  s.recent = [...s.recent, success ? 1 : 0].slice(-30);
  s.done = [...s.done, P.puzzle.id].slice(-6000);
  save(s);
}

function finish() {
  if (!P.failed) record(true);
  P.status = 'solved';
  P.hint = false;
  d.playSound('end');
  render();
}

/** Aufgeben: Wertung abziehen (falls noch nicht geschehen) und die Lösung vorspielen. */
function giveUp() {
  if (!P.puzzle || (P.status !== 'play' && P.status !== 'busy')) return;
  if (!P.failed) {
    P.failed = true;
    record(false);
  }
  const token = P.token;
  P.status = 'busy';
  P.hint = false;
  d.board.setPosition(P.fen, { animate: false });
  render();
  d.setCoach({ title: 'So geht es', paragraphs: ['Schau dir die Lösung in Ruhe an.'] });
  const step = () => {
    if (token !== P.token) return;
    if (P.idx >= P.moves.length) {
      P.status = 'shown';
      render();
      return;
    }
    const mine = P.idx % 2 === 1;
    playSolutionMove();
    if (mine) P.last.color = GREEN;
    d.board.setDecor(decor());
    setTimeout(step, 900);
  };
  setTimeout(step, 400);
}

/** Legale Zielfelder für die App (nur während der Lernende am Zug ist). */
export function puzzleTargets(square) {
  if (P.status !== 'play') return [];
  const chess = new Chess(P.fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return [];
  return chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

/** Verarbeitet einen Zug des Lernenden. */
export function puzzleMove({ from, to, promotion }) {
  if (P.status !== 'play') return;
  const chess = new Chess(P.fen);
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch (e) {
    d.board.setPosition(P.fen, { animate: false });
    return;
  }
  const uci = m.from + m.to + (m.promotion || '');
  // Jedes Matt zählt – auch wenn die Musterlösung ein anderes vorsieht.
  const ok = uci === P.moves[P.idx] || chess.isCheckmate();
  d.board.setPosition(chess.fen(), { animate: true });
  d.playSound(m.captured ? 'capture' : /[+#]/.test(m.san) ? 'check' : 'move');
  const token = P.token;

  if (!ok) {
    if (!P.failed) {
      P.failed = true;
      record(false);
    }
    P.status = 'busy';
    P.last = { squares: [m.from, m.to], color: RED };
    d.board.setInteractive(false);
    d.board.setDecor(decor());
    renderPanel();
    d.setCoach({ cls: 'mistake', title: 'Nicht der beste Zug', paragraphs: ['Das war es leider nicht.'] });
    setTimeout(() => {
      if (token !== P.token) return;
      P.last = null;
      P.status = 'play';
      d.board.setPosition(P.fen, { animate: true });
      render();
    }, 900);
    return;
  }

  P.fen = chess.fen();
  P.idx++;
  P.hint = false;
  P.last = { squares: [m.from, m.to], color: GREEN };
  if (P.idx >= P.moves.length || chess.isCheckmate()) {
    finish();
    return;
  }
  P.status = 'busy';
  d.board.setInteractive(false);
  d.board.setDecor(decor());
  setTimeout(() => {
    if (token !== P.token) return;
    playSolutionMove();
    P.status = 'play';
    render();
  }, 500);
}

/** Tastatur: Enter oder → für die nächste Aufgabe. */
export function puzzleKey(key) {
  if ((key === 'Enter' || key === 'ArrowRight') && (P.status === 'solved' || P.status === 'shown')) {
    nextPuzzle();
    return true;
  }
  return false;
}

/** Beim Verlassen des Modus laufende Abläufe abbrechen. */
export function leavePuzzles() {
  P.token++;
  P.status = 'idle';
  P.puzzle = null;
}
