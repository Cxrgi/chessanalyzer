// Trainer: (1) Koordinaten – Felder auf Zeit finden, (2) Eröffnungen – Hauptvarianten Zug für Zug einüben.
import { Chess } from '../vendor/chess.js';
import { OPENING_GROUPS } from './openings-data.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GREEN = 'rgba(129, 182, 76, .7)';
const RED = 'rgba(250, 65, 45, .6)';
const SIDE = { w: 'Weiß', b: 'Schwarz' };
const SECONDS = 30;

let d = null; // von der App übergebene Helfer
const T = { tab: 'coords', token: 0 };
const C = { running: false, side: 'w', target: null, hits: 0, miss: 0, ends: 0, timer: null, last: 0 };
const O = { item: null, side: 'w', sans: [], idx: 0, chess: null, wrong: 0, status: 'list', slips: 0, demo: false };

const allOpenings = () => OPENING_GROUPS.flatMap((g) => g.items);
const stats = () => d.store.get('trainers', { coords: { w: 0, b: 0 }, openings: {} });

export function initTrainers(deps) {
  d = deps;
  d.$('tn-tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) location.hash = b.dataset.tab === 'coords' ? '#trainer' : '#trainer/eroeffnungen';
  };
  d.$('tn-body').onclick = onPanelClick;
}

/** Kurzinfo für die Startseite. */
export function trainerSummary() {
  const s = stats();
  const learned = Object.keys(s.openings || {}).length;
  return { learned, total: allOpenings().length, coords: Math.max(s.coords.w || 0, s.coords.b || 0) };
}

export function openTrainers(tab = 'coords', id = null) {
  stopAll();
  T.tab = tab === 'openings' ? 'openings' : 'coords';
  d.enterTrainerView(T.tab === 'coords' ? 'Koordinaten-Trainer' : 'Eröffnungstrainer');
  d.$('tn-tabs').innerHTML = [['coords', 'Koordinaten'], ['openings', 'Eröffnungen']].map(([k, name]) =>
    `<button type="button" class="chip ${k === T.tab ? 'on' : ''}" data-tab="${k}">${name}</button>`).join('');
  if (T.tab === 'coords') coordsIdle();
  else if (id && allOpenings().some((o) => o.id === id)) startOpening(id);
  else openingList();
}

export function leaveTrainers() {
  if (!d) return;
  stopAll();
  d.board.setEditor(null);
  d.$('review').classList.remove('no-coords');
}

function stopAll() {
  T.token++;
  clearInterval(C.timer);
  C.running = false;
  O.demo = false;
}

function onPanelClick(e) {
  const b = e.target.closest('[data-act], [data-op]');
  if (!b) return;
  if (b.dataset.op) {
    location.hash = '#trainer/eroeffnungen/' + b.dataset.op;
    return;
  }
  const act = b.dataset.act;
  if (act === 'coords-w' || act === 'coords-b') startCoords(act.slice(-1));
  else if (act === 'op-list') location.hash = '#trainer/eroeffnungen';
  else if (act === 'op-side') startOpening(O.item.id, O.side === 'w' ? 'b' : 'w');
  else if (act === 'op-again') startOpening(O.item.id, O.side);
  else if (act === 'op-demo') demoOpening();
  else if (act === 'op-hint') { O.wrong = 2; O.slips++; renderOpening(); }
}

// ---------------------------------------------------------------------------
// Koordinaten
// ---------------------------------------------------------------------------

function coordsIdle(result) {
  const s = stats();
  d.board.setEditor(null);
  d.board.setInteractive(false);
  d.board.setOrientation(C.side);
  d.board.setPosition(START, { animate: false });
  d.board.setDecor({});
  d.$('review').classList.remove('no-coords');
  d.$('tn-body').innerHTML = `
    <div class="pz-stats">
      <div><b>${s.coords.w || 0}</b><span>Rekord Weiß</span></div>
      <div><b>${s.coords.b || 0}</b><span>Rekord Schwarz</span></div>
      <div><b>${SECONDS} s</b><span>pro Runde</span></div>
    </div>
    <div class="play-actions">
      <button type="button" class="btn primary" data-act="coords-w">Start aus Sicht von Weiß</button>
      <button type="button" class="btn soft" data-act="coords-b">Start aus Sicht von Schwarz</button>
    </div>
    <p class="hint">Während der Runde sind die Buchstaben und Zahlen am Brettrand ausgeblendet.</p>`;
  d.setCoach(result || {
    title: 'Koordinaten-Trainer',
    paragraphs: ['Der Coach nennt ein Feld – zum Beispiel **e4** – und du klickst es so schnell wie möglich an. Wer die Felder im Schlaf kennt, kann Züge viel leichter lesen, mitschreiben und sich merken.', `Du hast ${SECONDS} Sekunden. Wie viele Felder schaffst du?`],
  });
}

function startCoords(side) {
  stopAll();
  const token = T.token;
  Object.assign(C, { running: true, side, hits: 0, miss: 0, ends: Date.now() + SECONDS * 1000, target: null, last: 0 });
  d.board.setOrientation(side);
  d.board.setPosition(START, { animate: false });
  d.board.setDecor({});
  d.$('review').classList.add('no-coords');
  d.board.setEditor({ tool: () => 'pick', place: pickSquare, move() {} });
  nextTarget();
  C.timer = setInterval(() => {
    if (token !== T.token) return;
    if (Date.now() >= C.ends) endCoords();
    else renderCoords();
  }, 100);
}

function nextTarget() {
  let sq;
  do sq = 'abcdefgh'[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
  while (sq === C.target);
  C.target = sq;
  renderCoords();
  d.setCoach({ title: `Wo ist ${sq}?`, paragraphs: ['Klick das Feld auf dem Brett an.'] });
}

function renderCoords() {
  const left = Math.max(0, C.ends - Date.now());
  d.$('tn-body').innerHTML = `
    <div class="tn-target">${C.target}</div>
    <div class="bar tn-time"><i style="width:${(left / (SECONDS * 1000)) * 100}%"></i></div>
    <div class="pz-stats">
      <div><b>${C.hits}</b><span>richtig</span></div>
      <div><b>${C.miss}</b><span>falsch</span></div>
      <div><b>${Math.ceil(left / 1000)} s</b><span>übrig</span></div>
    </div>`;
}

function pickSquare(sq) {
  if (!C.running || Date.now() - C.last < 140) return;
  C.last = Date.now();
  if (sq === C.target) {
    C.hits++;
    d.playSound('move');
    d.board.setDecor({ squares: [{ square: sq, color: GREEN }] });
    nextTarget();
  } else {
    C.miss++;
    d.playSound('error');
    d.board.setDecor({ squares: [{ square: sq, color: RED }] });
    renderCoords();
  }
}

function endCoords() {
  stopAll();
  const s = stats();
  const record = C.hits > (s.coords[C.side] || 0);
  if (record) {
    s.coords[C.side] = C.hits;
    d.store.set('trainers', s);
  }
  d.playSound('end');
  if (d.onDone) d.onDone('coords', C.hits);
  const tries = C.hits + C.miss;
  coordsIdle({
    cls: C.hits >= 10 ? 'best' : null,
    title: `${C.hits} Felder in ${SECONDS} Sekunden${record && C.hits ? ' – neuer Rekord!' : ''}`,
    paragraphs: [
      tries ? `Trefferquote: ${Math.round((C.hits / tries) * 100)} %.` : 'Du hast kein Feld angeklickt.',
      C.hits >= 20 ? 'Stark – du kennst das Brett richtig gut.' : C.hits >= 10 ? 'Guter Wert. Mit etwas Übung geht es noch schneller.' : 'Tipp: Merk dir zuerst die Ecken und die Mittelfelder d4, e4, d5, e5 – der Rest ergibt sich daraus.',
    ],
  });
}

// ---------------------------------------------------------------------------
// Eröffnungen
// ---------------------------------------------------------------------------

function openingList() {
  O.status = 'list';
  O.item = null;
  const done = stats().openings || {};
  d.board.setEditor(null);
  d.board.setInteractive(false);
  d.board.setOrientation('w');
  d.board.setPosition(START, { animate: false });
  d.board.setDecor({});
  d.$('tn-body').innerHTML = OPENING_GROUPS.map((g) =>
    `<h3 class="tn-group">${d.esc(g.title)}</h3><div class="tn-list">` + g.items.map((o) =>
      `<button type="button" class="tn-op ${done[o.id] ? 'done' : ''}" data-op="${o.id}">
        <span>${d.esc(o.name)}</span><small>${done[o.id] ? '✓ ' + done[o.id] + '×' : SIDE[o.side]}</small></button>`).join('') + '</div>').join('');
  const n = Object.keys(done).length;
  d.setCoach({
    title: 'Eröffnungstrainer',
    paragraphs: ['Such dir rechts eine Eröffnung aus. Du spielst die Züge deiner Seite selbst, der Coach antwortet für den Gegner und sagt dir, worum es geht.', n ? `Bisher geübt: ${n} von ${allOpenings().length}.` : 'Tipp: Lerne zuerst eine Eröffnung mit Weiß und je eine Antwort auf 1. e4 und 1. d4.'],
  });
}

function startOpening(id, side) {
  stopAll();
  const item = allOpenings().find((o) => o.id === id);
  Object.assign(O, { item, side: side || item.side, sans: item.moves.split(' '), idx: 0, chess: new Chess(), wrong: 0, slips: 0, status: 'play', demo: false, last: null, note: null });
  d.board.setEditor(null);
  d.board.setOrientation(O.side);
  d.board.setPosition(START, { animate: false });
  stepOpening();
}

const usersTurn = () => O.chess.turn() === O.side;

/** Führt den nächsten Zug der Linie aus (Gegnerzug oder Vorführung). */
function autoMove() {
  const m = O.chess.move(O.sans[O.idx]);
  O.idx++;
  O.last = m;
  O.wrong = 0;
  d.board.setPosition(O.chess.fen());
  d.playSound(m.captured ? 'capture' : 'move');
}

function stepOpening() {
  const token = T.token;
  if (O.idx >= O.sans.length) {
    finishOpening();
    return;
  }
  renderOpening();
  if (O.demo || !usersTurn()) {
    d.board.setInteractive(false);
    setTimeout(() => {
      if (token !== T.token) return;
      autoMove();
      stepOpening();
    }, O.demo ? 750 : 420);
  } else {
    d.board.setInteractive(true);
  }
}

function lineSoFar() {
  let out = '';
  O.sans.slice(0, O.idx).forEach((san, i) => { out += (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + d.san(san) + ' '; });
  return out.trim();
}

function renderOpening() {
  const o = O.item;
  const decor = { squares: [], arrows: [] };
  if (O.last) decor.squares.push({ square: O.last.from, color: 'rgba(255, 235, 59, .5)' }, { square: O.last.to, color: 'rgba(255, 235, 59, .5)' });
  if (O.status === 'play' && !O.demo && usersTurn() && O.wrong >= 2) {
    const m = new Chess(O.chess.fen()).move(O.sans[O.idx]);
    decor.arrows.push({ from: m.from, to: m.to, color: '#81b64c' });
  }
  d.board.setDecor(decor);
  const total = O.sans.length;
  d.$('tn-body').innerHTML = `
    <div class="ls-head"><span>Eröffnungstrainer · du spielst ${SIDE[O.side]}</span><b>${d.esc(o.name)}</b></div>
    <div class="bar tn-time"><i style="width:${(O.idx / total) * 100}%"></i></div>
    <p class="tn-line">${d.esc(lineSoFar()) || '&nbsp;'}</p>
    <div class="play-actions">
      ${O.status === 'play' && !O.demo ? '<button type="button" class="btn soft small" data-act="op-hint">Zug zeigen</button>' : ''}
      <button type="button" class="btn soft small" data-act="op-demo">Erst vorführen</button>
      <button type="button" class="btn soft small" data-act="op-side">Als ${SIDE[O.side === 'w' ? 'b' : 'w']} üben</button>
      <button type="button" class="btn ghost small" data-act="op-list">Andere Eröffnung</button>
    </div>`;
  if (O.status !== 'play') return;
  if (O.demo) {
    d.setCoach({ title: o.name, paragraphs: [o.idea, 'Schau dir die Züge an – gleich bist du dran.'] });
  } else if (O.note) {
    d.setCoach({ cls: 'mistake', title: 'Das ist ein anderer Zug', paragraphs: [O.note, O.wrong >= 2 ? 'Der Pfeil zeigt dir den Zug dieser Variante.' : 'Versuch es noch einmal.'] });
  } else {
    d.setCoach({ title: o.name, paragraphs: [o.idea, usersTurn() ? (O.idx < 2 ? 'Du bist am Zug – spiel den ersten Zug der Eröffnung.' : 'Du bist am Zug. Wie geht es weiter?') : 'Der Gegner zieht …'] });
  }
}

function demoOpening() {
  stopAll();
  Object.assign(O, { idx: 0, chess: new Chess(), wrong: 0, status: 'play', demo: true, last: null, note: null });
  d.board.setPosition(START, { animate: false });
  stepOpening();
}

function finishOpening() {
  d.board.setInteractive(false);
  const wasDemo = O.demo;
  O.demo = false;
  if (wasDemo) {
    O.status = 'shown';
    renderOpening();
    d.setCoach({ title: 'Jetzt du!', paragraphs: [`Das war die Hauptvariante: ${lineSoFar()}`], actions: [{ label: 'Selbst spielen', primary: true, run: () => startOpening(O.item.id, O.side) }] });
    return;
  }
  O.status = 'done';
  const s = stats();
  s.openings = s.openings || {};
  s.openings[O.item.id] = (s.openings[O.item.id] || 0) + 1;
  d.store.set('trainers', s);
  d.playSound('end');
  if (d.onDone) d.onDone('openings', O.item.id);
  renderOpening();
  const ucis = O.chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
  d.setCoach({
    cls: 'best',
    title: O.slips ? 'Geschafft!' : 'Fehlerfrei!',
    paragraphs: [
      O.slips ? `Du hast die Variante durchgespielt, mit ${O.slips === 1 ? 'einem Stolperer' : O.slips + ' Stolperern'}. Wiederhole sie, bis sie ohne Hilfe klappt.` : 'Die Variante sitzt. Wiederhole sie in ein paar Tagen noch einmal – oder probier die andere Farbe.',
      `Hauptvariante: ${lineSoFar()}`,
    ],
    actions: [
      { label: 'Nochmal', run: () => startOpening(O.item.id, O.side) },
      { label: 'Von hier weiterspielen', run: () => d.openBoard(START, ucis) },
      { label: 'Andere Eröffnung', primary: true, run: () => { location.hash = '#trainer/eroeffnungen'; } },
    ],
  });
}

export function trainerTargets(square) {
  if (T.tab !== 'openings' || O.status !== 'play' || O.demo || !usersTurn()) return [];
  const piece = O.chess.get(square);
  if (!piece || piece.color !== O.side) return [];
  return O.chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

export function trainerMove({ from, to, promotion }) {
  if (T.tab !== 'openings' || O.status !== 'play' || O.demo || !usersTurn()) return;
  const probe = new Chess(O.chess.fen());
  let m;
  try {
    m = probe.move({ from, to, promotion });
  } catch (e) {
    return;
  }
  const expected = new Chess(O.chess.fen()).move(O.sans[O.idx]);
  if (m.san === expected.san) {
    O.note = null;
    autoMove();
    stepOpening();
    return;
  }
  O.wrong++;
  O.slips++;
  O.note = `**${d.san(m.san)}** gehört nicht zu dieser Variante.`;
  d.playSound('error');
  d.board.setPosition(O.chess.fen(), { animate: false });
  renderOpening();
}
