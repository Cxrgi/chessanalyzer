// Gegen den Computer spielen: Stärkestufen, Farbe wählen, Zug zurücknehmen, Tipp, Aufgeben –
// und danach direkt in die Analyse. Dazu ein Endspieltrainer mit festen Ausgangsstellungen.
import { Chess } from '../vendor/chess.js';
import { EnginePlayer } from './engine.js';

const SIDE = { w: 'Weiß', b: 'Schwarz' };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Stufen: Suchtiefe, Stockfish-Skill und wie oft bewusst ein schwächerer oder zufälliger Zug kommt. */
export const LEVELS = [
  { n: 1, name: 'Anfänger', elo: 600, depth: 1, skill: 0, random: 0.3, loose: 0.7 },
  { n: 2, name: 'Einsteiger', elo: 900, depth: 2, skill: 0, random: 0.14, loose: 0.5 },
  { n: 3, name: 'Hobbyspieler', elo: 1200, depth: 3, skill: 2, random: 0.05, loose: 0.3 },
  { n: 4, name: 'Vereinsspieler', elo: 1500, depth: 5, skill: 6, random: 0, loose: 0.15 },
  { n: 5, name: 'Fortgeschritten', elo: 1800, depth: 7, skill: 10, random: 0, loose: 0.05 },
  { n: 6, name: 'Stark', elo: 2100, depth: 9, skill: 14, random: 0, loose: 0 },
  { n: 7, name: 'Meister', elo: 2400, depth: 12, skill: 18, random: 0, loose: 0 },
  { n: 8, name: 'Maximum', elo: 3000, depth: 18, skill: 20, random: 0, loose: 0 },
];

/** Endspieltrainer: klassische Stellungen gegen die Engine in voller Stärke. */
export const ENDGAMES = [
  { id: 'kqk', title: 'Matt mit der Dame', fen: '8/8/8/4k3/8/8/1Q6/K7 w - - 0 1', you: 'w', goal: 'win', text: 'König an den Rand drängen, eigenen König heranführen, mattsetzen – ohne Patt.' },
  { id: 'krk', title: 'Matt mit dem Turm', fen: '8/8/8/4k3/8/8/1R6/K7 w - - 0 1', you: 'w', goal: 'win', text: 'Der Turm schneidet Reihen ab, dein König drängt den gegnerischen zurück.' },
  { id: 'krrk', title: 'Treppenmatt mit zwei Türmen', fen: '8/8/4k3/8/8/8/R7/1R4K1 w - - 0 1', you: 'w', goal: 'win', text: 'Ein Turm sperrt, der andere gibt Schach – Reihe für Reihe.' },
  { id: 'kpk', title: 'König und Bauer gewinnen', fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1', you: 'w', goal: 'win', text: 'Dein König steht vor dem Bauern. Nutze die Opposition und führe den Bauern zur Dame.' },
  { id: 'lucena', title: 'Turmendspiel: Brücke bauen', fen: '3K4/3P2k1/8/8/8/8/r7/5R2 w - - 0 1', you: 'w', goal: 'win', text: 'Turm auf die 4. Reihe, König heraus, am Ende mit dem Turm dazwischenziehen.' },
  { id: 'philidor', title: 'Turmendspiel: Remis halten', fen: '4k3/7R/r7/3KP3/8/8/8/8 w - - 0 1', you: 'b', goal: 'draw', text: 'Halte die 6. Reihe. Rückt der Bauer dorthin vor, geh mit dem Turm nach hinten und gib Schach.' },
  { id: 'kbbk', title: 'Matt mit dem Läuferpaar', fen: '8/8/8/4k3/8/8/8/KBB5 w - - 0 1', you: 'w', goal: 'win', text: 'Die Läufer bilden nebeneinander eine Wand, der König hilft – Matt gibt es nur in der Ecke.' },
  // Bauernendspiele (alle mit Stockfish in Tiefe 30 geprüft: genau ein Zug führt zum Ziel)
  { id: 'opposition', title: 'Opposition: König vor dem Bauern', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', you: 'w', goal: 'promote', text: 'Dein König steht vor dem Bauern auf der 6. Reihe – das gewinnt. Aber nur, wenn du die Opposition behältst: Geh mit dem König zur Seite (nicht zurück!) und schieb den Bauern im richtigen Moment.' },
  { id: 'opposition-hold', title: 'Opposition: Remis verteidigen', fen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1', you: 'b', goal: 'draw', text: 'Du bist am Zug. Stell deinen König dem weißen genau gegenüber (Opposition) und bleib immer vor dem Bauern. Weicht Weiß aus, gehst du mit.' },
  { id: 'quadrat', title: 'Quadratregel: Wettlauf zur Dame', fen: '8/8/8/8/P4k2/8/8/7K w - - 0 1', you: 'w', goal: 'promote', text: 'Denk dir vom Bauern ein Quadrat bis zur Grundreihe. Steht der gegnerische König außerhalb, holt er den Bauern nicht mehr ein – also sofort laufen, nicht mit dem König trödeln!' },
  { id: 'durchbruch', title: 'Bauerndurchbruch', fen: '8/ppp3k1/8/PPP5/8/8/8/6K1 w - - 0 1', you: 'w', goal: 'promote', text: 'Drei gegen drei – und doch gewinnst du: Mit einem Bauernopfer in der Mitte bricht einer deiner Bauern durch. Der schwarze König ist zu weit weg.' },
  { id: 'kqkp', title: 'Dame gegen Bauer auf der 2. Reihe', fen: '8/8/8/8/8/8/3pk3/1Q5K w - - 0 1', you: 'w', goal: 'win', text: 'Mit Schachs und Fesselungen zwingst du den König vor seinen eigenen Bauern. Jedes Mal gewinnst du ein Tempo für deinen König – bis er hilft, den Bauern zu holen und mattzusetzen.' },
];

let d = null; // von der App übergebene Helfer
const player = new EnginePlayer();
const G = { chess: null, you: 'w', level: LEVELS[2], start: START, over: null, thinking: false, hint: null, last: null, scenario: null, token: 0, resigned: false };

const prefs = () => ({ level: 3, color: 'w', ...d.store.get('play', {}) });

export function initPlay(deps) {
  d = deps;
  const $ = d.$;
  $('play-levels').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    d.store.set('play', { ...prefs(), level: +b.dataset.level });
    renderSetup();
  });
  $('play-color').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    d.store.set('play', { ...prefs(), color: b.dataset.color });
    renderSetup();
  });
  $('play-start').onclick = () => {
    const p = prefs();
    startGame({ level: LEVELS[p.level - 1], you: p.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : p.color });
  };
  $('play-endgames').addEventListener('click', (e) => {
    const b = e.target.closest('[data-endgame]');
    const sc = b && ENDGAMES.find((x) => x.id === b.dataset.endgame);
    if (sc) startGame({ level: LEVELS[7], you: sc.you, fen: sc.fen, scenario: sc });
  });
  $('play-undo').onclick = undo;
  $('play-hint').onclick = hint;
  $('play-resign').onclick = resign;
  $('play-new').onclick = () => showSetup();
  $('play-moves').addEventListener('click', () => {});
}

/** Öffnet den Bereich mit der Auswahl von Stufe und Farbe. */
/** Wie viele Endspiel-Aufgaben schon geschafft sind (für die Trainieren-Seite). */
export function endgameSummary() {
  const done = d ? d.store.get('endgames', {}) : {};
  return { done: ENDGAMES.filter((e) => done[e.id]).length, total: ENDGAMES.length };
}

export function openPlay() {
  d.enterPlayView();
  showSetup();
}

function showSetup() {
  G.token++;
  G.chess = null;
  G.over = null;
  player.stop();
  d.$('play-setup').hidden = false;
  d.$('play-game').hidden = true;
  d.board.setOrientation('w');
  d.board.setPosition(START, { animate: false });
  d.board.setDecor({});
  d.board.setInteractive(false);
  renderSetup();
  d.setCoach({ title: 'Gegen den Computer', paragraphs: ['Wähl eine Stärke und deine Farbe. Nach der Partie kannst du sie direkt analysieren lassen.'] });
  player.ensure().catch(() => {});
}

function renderSetup() {
  const p = prefs();
  const done = d.store.get('endgames', {});
  d.$('play-levels').innerHTML = LEVELS.map((l) => `<button type="button" class="level ${l.n === p.level ? 'on' : ''}" data-level="${l.n}"><b>${l.n}</b><span>${l.name}</span><small>~${l.elo}</small></button>`).join('');
  d.$('play-color').innerHTML = [['w', 'Weiß'], ['b', 'Schwarz'], ['r', 'Zufall']].map(([c, n]) => `<button type="button" class="${p.color === c ? 'on' : ''}" data-color="${c}">${n}</button>`).join('');
  d.$('play-endgames').innerHTML = ENDGAMES.map((e) => `<button type="button" class="lesson-card ${done[e.id] ? 'done' : ''}" data-endgame="${e.id}">
    <span class="lesson-num">${done[e.id] ? d.uiIcon('check', 18) : d.uiIcon('play', 16)}</span><span class="lesson-txt"><b>${e.title}</b><small>${{ draw: 'Ziel: Remis halten', promote: 'Ziel: Bauer zur Dame bringen', win: 'Ziel: gewinnen' }[e.goal]}</small></span></button>`).join('');
}

function startGame({ level, you, fen = START, scenario = null }) {
  G.token++;
  Object.assign(G, { chess: new Chess(fen), you, level, start: fen, over: null, thinking: false, hint: null, last: null, scenario, resigned: false });
  d.$('play-setup').hidden = true;
  d.$('play-game').hidden = false;
  d.board.setOrientation(you);
  d.board.setPosition(fen, { animate: false });
  render();
  if (G.chess.turn() !== you) engineMove();
}

const turnIsYours = () => G.chess && !G.over && !G.thinking && G.chess.turn() === G.you;

function status() {
  const c = G.chess;
  if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', text: 'Schachmatt' };
  if (c.isStalemate()) return { result: '1/2-1/2', text: 'Patt' };
  if (c.isInsufficientMaterial()) return { result: '1/2-1/2', text: 'Remis – zu wenig Material' };
  if (c.isThreefoldRepetition()) return { result: '1/2-1/2', text: 'Remis durch Stellungswiederholung' };
  if (c.isDrawByFiftyMoves()) return { result: '1/2-1/2', text: 'Remis nach der 50-Züge-Regel' };
  return null;
}

/** Ziel der Endspiel-Aufgabe erreicht? (gewinnen, Remis halten oder Bauer sicher zur Dame bringen) */
function goalMet(won, drawn) {
  const g = G.scenario && G.scenario.goal;
  return !!g && (((g === 'win' || g === 'promote') && won) || (g === 'draw' && drawn));
}

function finish(over) {
  G.over = over;
  const won = (over.result === '1-0') === (G.you === 'w') && over.result !== '1/2-1/2';
  const drawn = over.result === '1/2-1/2';
  if (goalMet(won, drawn)) {
    d.store.set('endgames', { ...d.store.get('endgames', {}), [G.scenario.id]: true });
  }
  d.playSound('end');
  d.onResult && d.onResult({ won, drawn, level: G.level.n, scenario: !!G.scenario });
  render();
}

function push(m) {
  G.last = { from: m.from, to: m.to };
  G.hint = null;
  d.board.setPosition(G.chess.fen(), { animate: true });
  d.playSound(m.captured ? 'capture' : /[+#]/.test(m.san) ? 'check' : 'move');
  const over = status();
  if (over) finish(over);
  else if (G.scenario && G.scenario.goal === 'promote' && m.color === G.you && m.promotion) {
    // Ziel „umwandeln“: geschafft, sobald die neue Figur nicht sofort geschlagen werden kann
    const lost = G.chess.moves({ verbose: true }).some((x) => x.to === m.to);
    if (!lost) finish({ result: G.you === 'w' ? '1-0' : '0-1', text: `Bauer umgewandelt – die neue ${{ q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer' }[m.promotion]} ist in Sicherheit` });
  }
}

async function engineMove() {
  const token = G.token;
  G.thinking = true;
  render();
  const lvl = G.level;
  const fen = G.chess.fen();
  let uci = null;
  try {
    const started = Date.now();
    const legal = G.chess.moves({ verbose: true });
    if (Math.random() < lvl.random) {
      const m = legal[Math.floor(Math.random() * legal.length)];
      uci = m.from + m.to + (m.promotion || '');
    } else {
      const lines = await player.lines(fen, { depth: lvl.depth, skill: lvl.skill, multipv: lvl.loose ? 4 : 1 });
      // schwächere Stufen greifen öfter zu einer der Nebenlinien statt zum besten Zug
      const pool = lines.length > 1 && Math.random() < lvl.loose ? lines.slice(1) : lines.slice(0, 1);
      const pick = pool[Math.floor(Math.random() * pool.length)] || lines[0];
      uci = pick ? pick.move : null;
      if (!uci) {
        const m = legal[0];
        uci = m.from + m.to + (m.promotion || '');
      }
    }
    // nicht schneller antworten, als ein Mensch schauen kann
    await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - started))));
  } catch (e) {
    console.error(e);
  }
  if (token !== G.token || !uci) return;
  G.thinking = false;
  const m = G.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  push(m);
  if (!G.over) render();
}

/** Legale Zielfelder für die App. */
export function playTargets(square) {
  if (!turnIsYours()) return [];
  const piece = G.chess.get(square);
  if (!piece || piece.color !== G.you) return [];
  return G.chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

/** Verarbeitet einen Zug des Spielers. */
export function playMove({ from, to, promotion }) {
  if (!turnIsYours()) return;
  let m;
  try {
    m = G.chess.move({ from, to, promotion });
  } catch (e) {
    d.board.setPosition(G.chess.fen(), { animate: false });
    return;
  }
  push(m);
  if (!G.over) engineMove();
}

function undo() {
  if (!G.chess || G.thinking) return;
  G.over = null;
  G.resigned = false;
  // bis zum eigenen letzten Zug zurück (meist zwei Halbzüge: Antwort der Engine und eigener Zug)
  if (G.chess.history().length && G.chess.turn() === G.you) G.chess.undo();
  if (G.chess.history().length) G.chess.undo();
  const hist = G.chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  G.last = last ? { from: last.from, to: last.to } : null;
  G.hint = null;
  d.board.setPosition(G.chess.fen(), { animate: true });
  render();
  if (G.chess.turn() !== G.you) engineMove();
}

async function hint() {
  if (!turnIsYours()) return;
  const token = G.token;
  const res = await d.evaluate(G.chess.fen());
  if (token !== G.token || !res || !res.lines[0] || !turnIsYours()) return;
  G.hint = res.lines[0].move;
  render();
}

function resign() {
  if (!G.chess || G.over) return;
  G.token++;
  G.thinking = false;
  G.resigned = true;
  player.stop();
  finish({ result: G.you === 'w' ? '0-1' : '1-0', text: 'Aufgabe' });
}

/** PGN der gespielten Partie (für die Analyse). */
function pgn() {
  const c = new Chess(G.start);
  for (const m of G.chess.history({ verbose: true })) c.move({ from: m.from, to: m.to, promotion: m.promotion });
  const me = d.username() || 'Du';
  const bot = `Stockfish Stufe ${G.level.n}`;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const head = [['Event', G.scenario ? G.scenario.title : 'Partie gegen den Computer'], ['Date', today],
    ['White', G.you === 'w' ? me : bot], ['Black', G.you === 'b' ? me : bot], ['Result', G.over ? G.over.result : '*']];
  if (G.start !== START) head.push(['SetUp', '1'], ['FEN', G.start]);
  const body = c.pgn().split('\n').filter((l) => !l.startsWith('[')).join(' ').replace(/\s*(\*|1-0|0-1|1\/2-1\/2)\s*$/, '').trim();
  return head.map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n' + body + ' ' + (G.over ? G.over.result : '*');
}

function render() {
  const $ = d.$;
  const c = G.chess;
  const dec = { squares: [], arrows: [] };
  if (G.last) dec.squares.push({ square: G.last.from, color: 'rgba(255, 213, 79, .5)' }, { square: G.last.to, color: 'rgba(255, 213, 79, .5)' });
  if (G.hint && turnIsYours()) dec.arrows.push({ from: G.hint.slice(0, 2), to: G.hint.slice(2, 4), color: '#81b64c', opacity: 0.85 });
  d.board.setDecor(dec);
  d.board.setInteractive(turnIsYours());

  // Zugliste
  const hist = c.history();
  const first = +G.start.split(' ')[5] || 1;
  const blackStarts = G.start.split(' ')[1] === 'b';
  let html = '';
  for (let i = blackStarts ? -1 : 0, n = first; i < hist.length; i += 2, n++) {
    html += `<div class="move-row"><span class="move-num">${n}.</span><span class="mv">${i >= 0 ? d.san(hist[i]) : ''}</span><span class="mv">${hist[i + 1] ? d.san(hist[i + 1]) : ''}</span></div>`;
  }
  $('play-moves').innerHTML = html || '<div class="result-row">Noch keine Züge.</div>';
  $('play-moves').scrollTop = $('play-moves').scrollHeight;
  $('play-undo').disabled = G.thinking || !hist.length;
  $('play-hint').disabled = !turnIsYours();
  $('play-resign').disabled = !!G.over;

  const vs = G.scenario ? G.scenario.title : `Stufe ${G.level.n} · ${G.level.name} (~${G.level.elo})`;
  if (G.over) {
    const won = G.over.result !== '1/2-1/2' && (G.over.result === '1-0') === (G.you === 'w');
    const drawn = G.over.result === '1/2-1/2';
    const goalOk = goalMet(won, drawn);
    d.setCoach({
      cls: won || goalOk ? 'best' : drawn ? 'good' : 'mistake',
      title: G.scenario ? (goalOk ? 'Geschafft!' : 'Ziel verfehlt') : won ? 'Gewonnen!' : drawn ? 'Remis' : 'Verloren',
      paragraphs: [`${G.over.text}. ${G.scenario ? (goalOk ? 'Die Technik sitzt.' : 'Probier es gleich noch einmal – oder nimm Züge zurück.') : won ? 'Stark gespielt! Versuch dich an der nächsten Stufe.' : drawn ? 'Ein halber Punkt.' : 'Schau dir in der Analyse an, wo es gekippt ist.'}`],
      actions: [
        ...(hist.length >= 2 ? [{ label: 'Partie analysieren', icon: 'search', run: () => d.analyze(pgn(), G.you) }] : []),
        { label: G.scenario ? 'Nochmal' : 'Revanche', icon: 'retry', primary: true, run: () => startGame({ level: G.level, you: G.you, fen: G.start, scenario: G.scenario }) },
      ],
    });
    return;
  }
  d.setCoach({
    title: G.thinking ? 'Der Computer überlegt …' : `Du bist am Zug (${SIDE[G.you]})`,
    paragraphs: [G.scenario && !hist.length ? G.scenario.text : `Gegner: ${vs}.${c.isCheck() && !G.thinking ? ' Du stehst im Schach!' : ''}`],
  });
}

/** Beim Verlassen laufende Berechnungen abbrechen. */
export function leavePlay() {
  G.token++;
  G.thinking = false;
  player.stop();
}
