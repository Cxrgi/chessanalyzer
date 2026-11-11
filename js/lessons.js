// Lektionen: Kursübersicht und der Player, der eine Lektion Schritt für Schritt durchgeht.
import { Chess } from '../vendor/chess.js';
import { COURSES } from './lessons-data.js';
import { see } from './tactics.js';

let d = null; // von der App übergebene Helfer
const L = { course: null, lesson: null, i: 0, stage: 0, fen: '', solved: false, busy: false, hint: false, solution: false, last: null, feedback: null, seen: 0, finished: false };

const GREEN = 'rgba(129, 182, 76, .6)';
const YELLOW = 'rgba(255, 213, 79, .6)';
const RED = 'rgba(250, 65, 45, .55)';

export const allLessons = () => COURSES.flatMap((c) => c.lessons.map((l) => ({ course: c, lesson: l })));
const doneMap = () => d.store.get('lessons', {});

/** Fortschritt über alle Kurse und die nächste offene Lektion. */
export function lessonProgress() {
  const done = doneMap();
  const all = allLessons();
  const next = all.find((x) => !done[x.lesson.id]) || null;
  return { done: all.filter((x) => done[x.lesson.id]).length, total: all.length, next: next ? next.lesson : null };
}

export function initLessons(deps) {
  d = deps;
  d.$('lessons-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lesson]');
    if (b) location.hash = '#lektion/' + b.dataset.lesson;
  });
  d.$('ls-dots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b && +b.dataset.step <= L.seen) goStep(+b.dataset.step);
  });
  d.$('ls-prev').onclick = () => goStep(L.i - 1);
  d.$('ls-next').onclick = () => nextStep(true);
  d.$('ls-all').onclick = () => { location.hash = '#lektionen'; };
}

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

export function renderLessonList() {
  const done = doneMap();
  let n = 0;
  d.$('lessons-list').innerHTML = COURSES.map((c) => {
    const count = c.lessons.filter((l) => done[l.id]).length;
    return `<section class="course">
      <header class="course-head">
        <div><h2>${d.esc(c.title)}</h2><p>${d.esc(c.desc)}</p></div>
        <div class="course-prog"><span>${count} / ${c.lessons.length}</span><div class="bar"><i style="width:${(count / c.lessons.length) * 100}%"></i></div></div>
      </header>
      <div class="lesson-grid">${c.lessons.map((l) => {
        n++;
        return `<button type="button" class="lesson-card ${done[l.id] ? 'done' : ''}" data-lesson="${l.id}">
          <span class="lesson-num">${done[l.id] ? d.uiIcon('check', 18) : n}</span>
          <span class="lesson-txt"><b>${d.esc(l.title)}</b><small>${d.esc(l.desc)}</small></span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/** Öffnet eine Lektion. Gibt false zurück, wenn es sie nicht gibt. */
export function openLesson(id) {
  const hit = allLessons().find((x) => x.lesson.id === id);
  if (!hit) return false;
  L.course = hit.course;
  L.lesson = hit.lesson;
  L.seen = 0;
  L.finished = false;
  d.enterLessonView(`${hit.lesson.title} · Lektion`);
  goStep(0);
  return true;
}

const step = () => L.lesson.steps[L.i];
const seqOf = (s) => s.seq || [{ user: s.accept || null, mate: s.mate }];
const turnOf = (fen) => fen.split(' ')[1];
const uciOf = (m) => m.from + m.to + (m.promotion || '');

function goStep(i) {
  if (i < 0 || i >= L.lesson.steps.length) return;
  L.i = i;
  L.seen = Math.max(L.seen, i);
  L.stage = 0;
  L.fen = step().fen;
  L.solved = step().type === 'info';
  L.busy = false;
  L.hint = L.solution = false;
  L.last = null;
  L.feedback = null;
  L.finished = false;
  const s = step();
  d.board.setOrientation(s.orientation || (s.type === 'move' ? turnOf(s.fen) : 'w'));
  d.board.setPosition(L.fen, { animate: false });
  render();
}

/** Lösungszüge der aktuellen Stufe (bei Mattaufgaben: alle Mattzüge). */
function solutions() {
  const st = seqOf(step())[L.stage];
  if (!st) return [];
  const chess = new Chess(L.fen);
  const legal = chess.moves({ verbose: true });
  const out = [];
  if (st.mate) out.push(...legal.filter((m) => m.san.endsWith('#')).map(uciOf));
  for (const u of st.user || []) if (legal.some((m) => uciOf(m) === u) && !out.includes(u)) out.push(u);
  return out;
}

function decor() {
  const s = step();
  const dec = { squares: [], arrows: [] };
  if (L.finished) return dec;
  if (L.stage === 0 && !L.last) {
    for (const sq of s.marks || []) dec.squares.push({ square: sq, color: YELLOW });
    for (const [from, to] of s.arrows || []) dec.arrows.push({ from, to, color: '#81b64c', opacity: 0.85 });
  }
  if (L.last) {
    const color = L.last.ok ? GREEN : RED;
    for (const sq of L.last.squares) dec.squares.push({ square: sq, color });
  }
  if (!L.solved && !L.busy && (L.hint || L.solution)) {
    if (s.type === 'square') {
      if (L.solution) dec.squares.push({ square: s.target[0], color: GREEN });
      else for (let r = 1; r <= 8; r++) dec.squares.push({ square: s.target[0][0] + r, color: YELLOW });
    } else {
      const sol = solutions()[0];
      if (sol && L.solution) dec.arrows.push({ from: sol.slice(0, 2), to: sol.slice(2, 4), color: '#81b64c', opacity: 0.9 });
      else if (sol) dec.squares.push({ square: sol.slice(0, 2), color: GREEN });
    }
  }
  return dec;
}

function render() {
  const s = step();
  const steps = L.lesson.steps;
  const waiting = !L.solved && !L.busy && !L.finished;
  d.board.setPicker(waiting && s.type === 'square' ? pick : null);
  d.board.setInteractive(waiting && s.type === 'move');
  d.board.setDecor(decor());

  d.$('ls-course').textContent = L.course.title;
  d.$('ls-title').textContent = L.lesson.title;
  d.$('ls-dots').innerHTML = steps.map((x, k) =>
    `<button type="button" data-step="${k}" class="${k === L.i ? 'on' : ''} ${k < L.i || (k === L.i && L.solved) ? 'done' : ''} ${x.type === 'info' ? '' : 'task'}" ${k <= L.seen ? '' : 'disabled'} aria-label="Schritt ${k + 1}"></button>`).join('');
  d.$('ls-count').textContent = `Schritt ${L.i + 1} von ${steps.length}`;
  d.$('ls-prev').disabled = L.i === 0;
  d.$('ls-next').textContent = L.solved ? (L.i === steps.length - 1 ? 'Abschließen' : 'Weiter') : 'Überspringen';

  if (L.finished) return;
  const st = seqOf(s)[L.stage];
  const prompt = (L.stage > 0 && st && st.text) || s.text;
  const paragraphs = [];
  const actions = [];
  let title = s.type === 'info' ? L.lesson.title : 'Deine Aufgabe';
  let cls = null;

  if (s.type === 'info') {
    paragraphs.push(prompt);
    actions.push({ label: L.i === steps.length - 1 ? 'Lektion abschließen' : 'Weiter', icon: 'arrow', primary: true, run: () => nextStep(false) });
  } else if (L.solved) {
    title = 'Richtig!';
    cls = 'best';
    paragraphs.push(s.success || 'Genau so.');
    actions.push({ label: L.i === steps.length - 1 ? 'Lektion abschließen' : 'Weiter', icon: 'arrow', primary: true, run: () => nextStep(false) });
  } else {
    paragraphs.push(prompt);
    if (L.feedback) paragraphs.push(L.feedback);
    else if (L.solution) paragraphs.push(s.type === 'square' ? 'Das gesuchte Feld ist grün markiert.' : 'Der Pfeil zeigt den Zug. Spiel ihn auf dem Brett nach.');
    else if (L.hint) paragraphs.push(s.type === 'square' ? 'Tipp: Der Buchstabe nennt die Linie – sie ist markiert. Die Zahl nennt die Reihe.' : 'Tipp: Die markierte Figur macht den Zug.');
    actions.push({ label: 'Tipp', icon: 'bulb', run: () => { L.hint = true; L.feedback = null; render(); } });
    actions.push({ label: 'Lösung zeigen', icon: 'star', run: () => { L.solution = true; L.feedback = null; render(); } });
  }
  d.setCoach({ cls, title, paragraphs, actions });
}

function solve() {
  L.solved = true;
  L.busy = false;
  L.feedback = null;
  d.playSound('end');
  render();
}

function wrong(text, squares, resetFen) {
  L.busy = true;
  L.last = { ok: false, squares };
  L.feedback = text;
  render();
  setTimeout(() => {
    if (!L.busy) return;
    L.busy = false;
    L.last = null;
    if (resetFen) d.board.setPosition(L.fen, { animate: true });
    render();
  }, 1000);
}

function pick(square) {
  const s = step();
  if (s.target.includes(square)) {
    L.last = { ok: true, squares: [square] };
    solve();
  } else {
    wrong(`Das ist **${square}**. Gesucht ist **${s.target[0]}** – erst der Buchstabe (Linie), dann die Zahl (Reihe).`, [square], false);
  }
}

/** Legale Zielfelder für die App (nur während einer Zugaufgabe). */
export function lessonTargets(square) {
  if (!L.lesson || L.solved || L.busy || step().type !== 'move') return [];
  const chess = new Chess(L.fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return [];
  return chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

/** Verarbeitet einen Zug des Lernenden. */
export function lessonMove({ from, to, promotion }) {
  if (!L.lesson || L.solved || L.busy) return;
  const s = step();
  const seq = seqOf(s);
  const st = seq[L.stage];
  const chess = new Chess(L.fen);
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch (e) {
    d.board.setPosition(L.fen, { animate: false });
    return;
  }
  const uci = uciOf(m);
  const ok = (st.mate && m.san.endsWith('#')) || (st.user || []).includes(uci);
  d.board.setPosition(chess.fen(), { animate: true });
  d.playSound(m.captured ? 'capture' : /[+#]/.test(m.san) ? 'check' : 'move');

  if (!ok) {
    let text = (s.wrong && s.wrong[uci]) || null;
    if (!text && chess.isStalemate()) text = 'Patt! Der Gegner hat keinen Zug mehr, steht aber nicht im Schach – das wäre nur unentschieden.';
    if (!text && s.wrongDefault) text = s.wrongDefault;
    if (!text && !chess.isGameOver() && see(chess, m.to) > 0) text = 'Vorsicht: Dort kann deine Figur geschlagen werden. Versuch es noch einmal.';
    if (!text) text = st.mate ? 'Das ist noch kein Matt. Versuch es noch einmal.' : 'Das ist nicht der gesuchte Zug. Versuch es noch einmal.';
    wrong(text, [m.from, m.to], true);
    return;
  }

  L.fen = chess.fen();
  L.stage++;
  L.hint = L.solution = false;
  L.feedback = null;
  L.last = { ok: true, squares: [m.from, m.to] };
  if (L.stage >= seq.length) {
    solve();
    return;
  }
  // Der Gegner antwortet automatisch, dann ist der Lernende wieder dran.
  L.busy = true;
  render();
  const lesson = L.lesson, index = L.i;
  setTimeout(() => {
    if (L.lesson !== lesson || L.i !== index) return;
    const reply = seq[L.stage];
    const cands = Array.isArray(reply.auto) ? reply.auto : [reply.auto];
    const c = new Chess(L.fen);
    let rm = null;
    for (const u of cands) {
      try {
        rm = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        break;
      } catch (e) { /* nächster Kandidat */ }
    }
    L.busy = false;
    if (!rm) {
      solve();
      return;
    }
    L.fen = c.fen();
    L.stage++;
    L.last = null;
    d.board.setPosition(L.fen, { animate: true });
    d.playSound(rm.captured ? 'capture' : 'move');
    if (L.stage >= seq.length) solve();
    else render();
  }, 650);
}

function nextStep(skip) {
  if (L.finished) return;
  if (!L.solved && !skip) return;
  if (L.i < L.lesson.steps.length - 1) {
    goStep(L.i + 1);
    return;
  }
  finish();
}

function finish() {
  const done = doneMap();
  done[L.lesson.id] = true;
  d.store.set('lessons', done);
  L.finished = true;
  L.solved = true;
  const all = allLessons();
  const idx = all.findIndex((x) => x.lesson.id === L.lesson.id);
  const next = all[idx + 1];
  const { done: count, total } = lessonProgress();
  d.playSound('end');
  d.setCoach({
    cls: 'brilliant',
    title: 'Lektion geschafft!',
    paragraphs: [
      `Du hast „${L.lesson.title}“ abgeschlossen. Damit sind ${count} von ${total} Lektionen erledigt.`,
      next ? `Als Nächstes: **${next.lesson.title}** – ${next.lesson.desc}.` : 'Das war die letzte Lektion – du hast den ganzen Kurs durch. Stark!',
    ],
    actions: [
      { label: 'Alle Lektionen', icon: 'back', run: () => { location.hash = '#lektionen'; } },
      ...(next ? [{ label: 'Nächste Lektion', icon: 'arrow', primary: true, run: () => { location.hash = '#lektion/' + next.lesson.id; } }] : []),
    ],
  });
  render();
}

/** Tastatur: → weiter (wenn gelöst), ← zurück. */
export function lessonKey(key) {
  if (!L.lesson) return false;
  if (key === 'ArrowRight' || key === 'Enter') {
    if (L.solved) nextStep(false);
    return true;
  }
  if (key === 'ArrowLeft') {
    goStep(L.i - 1);
    return true;
  }
  return false;
}
