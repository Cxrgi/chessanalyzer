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
  'hangingPiece', 'trappedPiece', 'backRankMate', 'defensiveMove', 'promotion', 'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame'];
/** Punkte für die Wertung je nach benutzter Hilfe: ohne Tipp, Figur gezeigt, Zug gezeigt. */
const HINT_SCORE = [1, 0.6, 0.3];

let d = null; // von der App übergebene Helfer
const files = new Map(); // Band → Aufgabenliste (geladen bei Bedarf)
const P = { puzzle: null, moves: [], idx: 0, fen: '', color: 'w', status: 'idle', failed: false, hint: 0, last: null, delta: 0, token: 0, mode: 'normal' };
/** Aufgaben-Sturm: so viele Aufgaben wie möglich in der Zeit, drei Fehler erlaubt. */
const R = { on: false, end: 0, lives: 3, score: 0, minutes: 3, timer: null, over: false };

const defaults = () => ({ rating: 1000, played: 0, solved: 0, streak: 0, best: 0, recent: [], done: [], theme: '', retry: [], curve: [], themes: {}, rush: {}, daily: '' });
const today = () => new Date().toISOString().slice(0, 10);
const stats = () => ({ ...defaults(), ...d.store.get('puzzles', {}) });
const save = (s) => d.store.set('puzzles', s);

export const themeName = (t) => THEME[t] || t;

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
    if (R.on) stopRush();
    else if (P.status === 'solved' || P.status === 'shown') nextPuzzle();
    else giveUp();
  };
  d.$('pz-extra').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b || R.on) return;
    sel.value = b.dataset.theme;
    sel.onchange();
  });
  d.$('pz-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    if (b.dataset.mode === 'daily') startDaily();
    else if (b.dataset.mode === 'rush') startRush(+b.dataset.min);
    else { stopRush(true); P.mode = 'normal'; nextPuzzle(); }
  });
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
  // Fehlgeschlagene Aufgaben kommen nach einigen anderen noch einmal dran
  if (!R.on && !s.theme) {
    const due = (s.retry || []).find((r) => s.played >= r.after);
    if (due) {
      s.retry = s.retry.filter((r) => r !== due);
      save(s);
      const again = (await loadBand(bandOf(due.rating))).find((p) => p.id === due.id);
      if (again) return { ...again, again: true };
    }
  }
  const target = R.on ? Math.min(2500, 600 + R.score * 45) : Math.max(450, Math.min(2550, s.rating + (Math.random() * 160 - 80)));
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
    let pool = list.filter((p) => !done.has(p.id) && (R.on || !s.theme || p.themes.includes(s.theme)));
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
  stopRush(true);
  P.mode = 'normal';
  d.$('pz-theme').value = stats().theme || '';
  await nextPuzzle();
}

/** Tagesaufgabe: jeden Tag dieselbe für alle, mittlere Schwierigkeit, ohne Wertung. */
async function startDaily() {
  stopRush(true);
  const token = ++P.token;
  const list = await loadBand(1200);
  if (token !== P.token) return;
  let h = 0;
  for (const ch of today()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  P.mode = 'daily';
  begin(list[h % list.length], token);
}

function startRush(minutes) {
  stopRush(true);
  Object.assign(R, { on: true, end: Date.now() + minutes * 60000, lives: 3, score: 0, minutes, over: false });
  P.mode = 'rush';
  R.timer = setInterval(() => {
    if (Date.now() >= R.end) endRush();
    else renderPanel();
  }, 500);
  nextPuzzle();
}

function stopRush(silent) {
  clearInterval(R.timer);
  const was = R.on;
  R.on = false;
  if (was && !silent) { P.mode = 'normal'; nextPuzzle(); }
}

function endRush() {
  clearInterval(R.timer);
  R.on = false;
  R.over = true;
  P.token++;
  P.status = 'shown';
  const s = stats();
  const key = 'm' + R.minutes;
  const best = Math.max(s.rush[key] || 0, R.score);
  const record = R.score > (s.rush[key] || 0);
  s.rush = { ...s.rush, [key]: best };
  save(s);
  d.board.setInteractive(false);
  d.playSound('end');
  renderPanel();
  d.setCoach({
    cls: record ? 'brilliant' : 'best',
    title: record ? `Neuer Rekord: ${R.score}!` : `Sturm beendet: ${R.score} gelöst`,
    paragraphs: [`${R.lives <= 0 ? 'Drei Fehler – ' : 'Die Zeit ist um – '}du hast in ${R.minutes} Minuten ${R.score} Aufgaben gelöst. Dein Rekord: ${best}.`],
    actions: [{ label: 'Zurück zum Training', run: () => { P.mode = 'normal'; R.over = false; nextPuzzle(); } }, { label: 'Nochmal', icon: 'retry', primary: true, run: () => startRush(R.minutes) }],
  });
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
  if (P.mode === 'daily') P.mode = 'normal';
  begin(puzzle, token);
}

/** Stellt eine Aufgabe aufs Brett und lässt den Gegner den einleitenden Zug machen. */
function begin(puzzle, token) {
  R.over = false;
  Object.assign(P, { puzzle, moves: puzzle.moves, idx: 0, fen: puzzle.fen, failed: false, hint: 0, last: null, delta: 0, status: 'loading' });
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
  }, R.on ? 300 : 550);
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
  if (P.hint && P.status === 'play' && P.moves[P.idx]) {
    const u = P.moves[P.idx];
    dec.squares.push({ square: u.slice(0, 2), color: GREEN });
    if (P.hint >= 2) dec.arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: '#81b64c', opacity: 0.85 });
  }
  return dec;
}

const themeNames = (p) => p.themes.map((t) => THEME[t]).filter(Boolean);

function render() {
  d.board.setInteractive(P.status === 'play');
  d.board.setDecor(decor());
  renderPanel();
  if (!P.puzzle) return;
  const rated = isRated();
  const sign = (n) => (n > 0 ? '+' + n : String(n));
  if (P.status === 'play' && R.on) {
    d.setCoach({ title: `${SIDE[P.color]} am Zug`, paragraphs: [`Aufgabe ${R.score + 1} – finde den besten Zug!`] });
  } else if (P.status === 'play') {
    const first = P.idx === 1 && !P.failed;
    const lead = P.mode === 'daily' ? 'Tagesaufgabe: ' : P.puzzle.again ? 'Noch einmal von vorhin: ' : '';
    d.setCoach({
      title: `${SIDE[P.color]} am Zug`,
      paragraphs: [P.failed ? 'Das war es noch nicht. Versuch es noch einmal oder lass dir die Lösung zeigen.' : first ? `${lead}Finde den besten Zug!` : 'Richtig! Wie geht es weiter?',
        ...(P.hint === 1 ? ['Tipp 1: Die markierte Figur zieht. Ein zweiter Tipp zeigt auch das Zielfeld.'] : P.hint >= 2 ? ['Tipp 2: Der Pfeil zeigt den Zug.'] : [])],
      actions: [
        ...(P.hint < 2 ? [{ label: P.hint ? 'Zweiter Tipp' : 'Tipp', icon: 'bulb', run: () => { P.hint++; render(); } }] : []),
        { label: 'Lösung zeigen', icon: 'star', run: giveUp },
      ],
    });
  } else if (P.status === 'solved') {
    d.setCoach({
      cls: P.failed ? 'good' : 'best',
      title: P.failed ? 'Gelöst – im zweiten Anlauf' : 'Gelöst!',
      paragraphs: [
        (rated ? `Wertung der Aufgabe: **${P.puzzle.rating}**. Deine Wertung: **${sign(P.delta)}**.` : `Wertung der Aufgabe: **${P.puzzle.rating}** (${P.mode === 'daily' ? 'Tagesaufgabe' : 'Themen-Training'} ohne Wertung).`),
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
  $('pz-info').textContent = P.puzzle && done && !R.over ? `Aufgabe ${P.puzzle.id} · Lichess-Sammlung` : '';
  if (R.on) {
    $('pz-next').textContent = 'Sturm abbrechen';
    $('pz-next').className = 'btn ghost';
    $('pz-next').disabled = false;
  }
  // Modus-Knöpfe, Sturm-Anzeige, Wertungskurve und schwächste Themen
  const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
  $('pz-rush').hidden = !R.on;
  if (R.on) $('pz-rush').innerHTML = `<b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b><span>${'♥'.repeat(R.lives)}${'♡'.repeat(3 - R.lives)}</span><b>${R.score}</b>`;
  $('pz-modes').innerHTML = [
    ['normal', '', 'Training', P.mode === 'normal' && !R.on],
    ['daily', '', s.daily === today() ? 'Tagesaufgabe ✓' : 'Tagesaufgabe', P.mode === 'daily'],
    ['rush', 3, `Sturm 3 min${s.rush.m3 ? ' · ' + s.rush.m3 : ''}`, R.on && R.minutes === 3],
    ['rush', 5, `Sturm 5 min${s.rush.m5 ? ' · ' + s.rush.m5 : ''}`, R.on && R.minutes === 5],
  ].map(([m, min, label, on]) => `<button type="button" class="chip ${on ? 'on' : ''}" data-mode="${m}" data-min="${min}">${label}</button>`).join('');
  $('pz-theme').disabled = R.on;
  const curve = s.curve || [];
  const weak = Object.entries(s.themes || {}).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 4);
  let extra = '';
  if (curve.length >= 3) {
    const lo = Math.min(...curve), hi = Math.max(...curve), span = Math.max(40, hi - lo);
    const pts = curve.map((v, i) => `${((i / (curve.length - 1)) * 240).toFixed(1)},${(44 - ((v - lo) / span) * 40).toFixed(1)}`).join(' ');
    extra += `<span class="pz-label">Wertungsverlauf</span><svg class="spark" viewBox="0 0 240 46" preserveAspectRatio="none" role="img" aria-label="Verlauf deiner Aufgaben-Wertung"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  }
  if (weak.length) {
    extra += '<span class="pz-label">Deine schwächsten Themen</span>' + weak.map(([t, v]) =>
      `<button type="button" class="pz-weak" data-theme="${t}"><span>${THEME[t]}</span><div class="bar"><i class="${v.ok / v.n < 0.5 ? 'warn' : ''}" style="width:${(v.ok / v.n) * 100}%"></i></div><b>${Math.round((v.ok / v.n) * 100)} %</b></button>`).join('');
  }
  $('pz-extra').innerHTML = extra;
}

const isRated = () => !stats().theme && P.mode === 'normal' && !R.on;

/** Trägt das Ergebnis ein – einmal pro Aufgabe, beim ersten Fehler oder bei fehlerfreier Lösung. */
function record(success) {
  const s = stats();
  if (R.on) {
    // Sturm: nur zählen, keine Wertung
    if (success) R.score++;
    else R.lives--;
    s.done = [...s.done, P.puzzle.id].slice(-6000);
    save(s);
    return;
  }
  const rated = isRated();
  if (P.mode === 'daily') s.daily = today();
  if (!success && rated && !P.puzzle.again) s.retry = [...(s.retry || []), { id: P.puzzle.id, rating: P.puzzle.rating, after: s.played + 8 }].slice(-20);
  if (rated) {
    const expected = 1 / (1 + 10 ** ((P.puzzle.rating - s.rating) / 400));
    const k = s.played < 20 ? 40 : 24;
    const score = success ? HINT_SCORE[P.hint] : 0;
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
  // Erfolgsquote je Thema (für Profil und Seitenleiste)
  s.themes = s.themes || {};
  for (const t of P.puzzle.themes) {
    if (!THEME[t] || ['opening', 'middlegame', 'endgame'].includes(t)) continue;
    s.themes[t] = s.themes[t] || { n: 0, ok: 0 };
    s.themes[t].n++;
    if (success) s.themes[t].ok++;
  }
  s.curve = [...(s.curve || []), Math.round(s.rating)].slice(-60);
  if (success && d.onSolved) d.onSolved();
  s.done = [...s.done, P.puzzle.id].slice(-6000);
  save(s);
}

function finish() {
  if (!P.failed) record(true);
  if (R.on) {
    nextPuzzle();
    return;
  }
  P.status = 'solved';
  P.hint = 0;
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
  P.hint = 0;
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
    if (R.on) {
      // Sturm: ein Fehler kostet ein Leben, dann geht es sofort weiter
      d.playSound('capture');
      if (R.lives <= 0) endRush();
      else nextPuzzle();
      return;
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
  P.hint = 0;
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
  clearInterval(R.timer);
  R.on = false;
  P.token++;
  P.status = 'idle';
  P.puzzle = null;
}
