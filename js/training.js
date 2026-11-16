// Fehler-Training: Alle groben Fehler aus den eigenen analysierten Partien kommen als Karten wieder –
// in wachsenden Abständen (Leitner-Prinzip), bis sie sitzen.
import { Chess } from '../vendor/chess.js';
import { db } from './db.js';
import { winPct, CLASSES } from './analysis.js';

/** Abstand bis zur nächsten Wiederholung je Stufe, in Tagen. */
const INTERVALS = [0, 1, 3, 7, 21];
const DAY = 86400000;
const SIDE = { w: 'Weiß', b: 'Schwarz' };
const GREEN = 'rgba(129, 182, 76, .6)';
const RED = 'rgba(250, 65, 45, .55)';

let d = null; // von der App übergebene Helfer
const T = { queue: [], card: null, status: 'idle', first: true, last: null, show: false, token: 0, done: 0, right: 0 };

export function initTraining(deps) {
  d = deps;
  d.$('tr-open').onclick = () => { if (T.card) location.hash = '#' + T.card.gameId; };
  d.$('tr-drop').onclick = async () => {
    if (!T.card) return;
    await db.del('cards', T.card.id);
    next();
  };
}

/** Zahl der fälligen und aller Karten (für die Startseite). */
export async function trainingSummary() {
  const cards = (await db.all('cards').catch(() => [])).map((e) => e.value);
  return { total: cards.length, due: cards.filter((c) => c.due <= Date.now()).length, mastered: cards.filter((c) => c.box >= INTERVALS.length - 1).length };
}

export async function openTraining() {
  d.enterTrainingView();
  T.token++;
  T.done = T.right = 0;
  const cards = (await db.all('cards').catch(() => [])).map((e) => e.value);
  T.queue = cards.filter((c) => c.due <= Date.now()).sort((a, b) => a.box - b.box || a.due - b.due).slice(0, 20);
  T.all = cards.length;
  next();
}

function next() {
  const token = ++T.token;
  T.card = T.queue.shift() || null;
  T.status = T.card ? 'play' : 'empty';
  T.first = true;
  T.last = null;
  T.show = false;
  if (!T.card) {
    d.board.setInteractive(false);
    d.board.setDecor({});
    renderPanel();
    d.setCoach(T.all
      ? { cls: T.done ? 'best' : null, title: T.done ? 'Für heute geschafft!' : 'Nichts fällig', paragraphs: [T.done ? `${T.right} von ${T.done} auf Anhieb richtig. Die übrigen Karten kommen in den nächsten Tagen wieder.` : 'Alle Karten sind für heute erledigt. Schau morgen wieder vorbei – oder analysiere neue Partien.'], actions: [{ label: 'Zur Startseite', primary: true, run: () => { location.hash = ''; } }] }
      : { title: 'Noch keine Karten', paragraphs: ['Hier landen automatisch alle Fehler und Patzer aus deinen analysierten Partien. Analysiere eine eigene Partie und sag dem Coach, welche Seite du warst – dann geht es los.'], actions: [{ label: 'Partie analysieren', primary: true, run: () => { location.hash = '#analyse'; } }] });
    return;
  }
  const c = T.card;
  d.board.setOrientation(c.fen.split(' ')[1]);
  d.board.setPosition(c.fen, { animate: false });
  if (token === T.token) render();
}

function decor() {
  const dec = { squares: [], arrows: [] };
  if (T.last) for (const sq of T.last.squares) dec.squares.push({ square: sq, color: T.last.color });
  if (T.show && T.card) dec.arrows.push({ from: T.card.best.slice(0, 2), to: T.card.best.slice(2, 4), color: '#81b64c', opacity: 0.9 });
  return dec;
}

const sanOf = (fen, uci) => {
  try {
    return d.san(new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
  } catch (e) {
    return uci;
  }
};

function render() {
  const c = T.card;
  d.board.setInteractive(T.status === 'play');
  d.board.setDecor(decor());
  renderPanel();
  if (!c) return;
  const turn = c.fen.split(' ')[1];
  if (T.status === 'play') {
    d.setCoach({
      title: `${SIDE[turn]} am Zug – mach es besser!`,
      paragraphs: [
        `In dieser Stellung hast du **${sanOf(c.fen, c.played)}** gespielt – ${CLASSES[c.cls].noun}.`,
        T.first ? 'Welcher Zug wäre stärker gewesen?' : 'Das war es noch nicht. Versuch es noch einmal oder lass dir die Lösung zeigen.',
      ],
      actions: [{ label: 'Lösung zeigen', icon: 'star', run: () => answer(false, true) }],
    });
  } else if (T.status === 'done') {
    d.setCoach({
      cls: T.ok ? 'best' : 'mistake',
      title: T.ok ? 'Richtig!' : 'Die Lösung',
      paragraphs: [T.text, T.ok ? `Die Karte kommt in ${INTERVALS[c.box] === 1 ? 'einem Tag' : INTERVALS[c.box] + ' Tagen'} wieder.` : 'Die Karte kommt bald noch einmal dran.'],
      actions: [{ label: T.queue.length ? 'Nächste Karte' : 'Fertig', icon: 'arrow', primary: true, run: next }],
    });
  }
}

function renderPanel() {
  const $ = d.$;
  $('tr-left').textContent = T.queue.length + (T.card && T.status !== 'done' ? 1 : 0);
  $('tr-done').textContent = T.done;
  $('tr-right').textContent = T.right;
  $('tr-label').textContent = T.card ? T.card.label : '';
  $('tr-box').innerHTML = T.card ? INTERVALS.map((_, i) => `<i class="${i <= T.card.box ? 'on' : ''}"></i>`).join('') : '';
  $('tr-open').disabled = $('tr-drop').disabled = !T.card;
}

/** Wertet eine Karte aus und plant die nächste Wiederholung. */
async function answer(ok, showSolution, text) {
  const c = T.card;
  if (!c || T.status === 'done') return;
  const firstTry = T.first && ok;
  T.status = 'done';
  T.ok = ok;
  T.show = !ok || showSolution;
  T.text = text || (ok ? `**${sanOf(c.fen, c.best)}** ist der beste Zug.` : `Am stärksten war **${sanOf(c.fen, c.best)}**.`);
  T.done++;
  if (firstTry) T.right++;
  c.seen = (c.seen || 0) + 1;
  c.box = firstTry ? Math.min(INTERVALS.length - 1, c.box + 1) : 0;
  c.due = Date.now() + (firstTry ? INTERVALS[c.box] * DAY : 10 * 60000);
  await db.set('cards', c.id, c).catch(() => {});
  if (!firstTry && !T.queue.includes(c) && T.queue.length < 30) T.queue.push({ ...c, retry: true });
  d.playSound(ok ? 'end' : 'move');
  d.onCard && d.onCard(firstTry);
  if (!ok) d.board.setPosition(c.fen, { animate: true });
  render();
}

export function trainingTargets(square) {
  if (T.status !== 'play') return [];
  const chess = new Chess(T.card.fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return [];
  return chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

export async function trainingMove({ from, to, promotion }) {
  if (T.status !== 'play') return;
  const c = T.card;
  const chess = new Chess(c.fen);
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch (e) {
    d.board.setPosition(c.fen, { animate: false });
    return;
  }
  const uci = m.from + m.to + (m.promotion || '');
  const token = T.token;
  d.board.setPosition(chess.fen(), { animate: true });
  d.playSound(m.captured ? 'capture' : 'move');
  const wrong = (text) => {
    T.first = false;
    T.status = 'busy';
    T.last = { squares: [m.from, m.to], color: RED };
    d.board.setInteractive(false);
    d.board.setDecor(decor());
    d.setCoach({ cls: 'mistake', title: 'Noch nicht', paragraphs: [text] });
    setTimeout(() => {
      if (token !== T.token) return;
      T.last = null;
      T.status = 'play';
      d.board.setPosition(c.fen, { animate: true });
      render();
    }, 1200);
  };
  T.last = { squares: [m.from, m.to], color: GREEN };
  if (uci === c.best || chess.isCheckmate()) {
    answer(true, false);
    return;
  }
  if (uci === c.played) {
    wrong('Das ist genau der Zug aus der Partie. Such nach etwas anderem!');
    return;
  }
  // Anderer Zug: mit der Engine gegen den besten Zug vergleichen
  T.status = 'busy';
  d.board.setInteractive(false);
  d.setCoach({ title: 'Ich prüfe deinen Zug …', paragraphs: ['Einen Moment.'] });
  const best = new Chess(c.fen);
  best.move({ from: c.best.slice(0, 2), to: c.best.slice(2, 4), promotion: c.best[4] });
  const a = await d.evaluate(chess.fen());
  const b = token === T.token ? await d.evaluate(best.fen()) : null;
  if (token !== T.token) return;
  const ev = (r) => (r ? (r.terminal ? r.terminal.eval : r.lines[0] && r.lines[0].eval) : null);
  const sign = c.fen.split(' ')[1] === 'w' ? 1 : -1;
  if (ev(a) && ev(b) && sign * (winPct(ev(b)) - winPct(ev(a))) <= 4) {
    T.status = 'play';
    answer(true, true, `**${d.san(m.san)}** ist auch stark – fast so gut wie der beste Zug **${sanOf(c.fen, c.best)}**.`);
  } else {
    wrong(`**${d.san(m.san)}** ist nicht stark genug.`);
  }
}

export function trainingKey(key) {
  if ((key === 'Enter' || key === 'ArrowRight') && (T.status === 'done' || T.status === 'empty')) {
    if (T.status === 'done') next();
    return true;
  }
  return false;
}

export function leaveTraining() {
  T.token++;
  T.status = 'idle';
  T.card = null;
}
