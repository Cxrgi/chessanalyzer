// Hauptlogik: Partie laden → analysieren → Übersicht → Zug für Zug mit Coach.
import { Chess } from '../vendor/chess.js';
import { openEditor, bindEditor } from './editor.js';
import { initPuzzles, openPuzzles, puzzleTargets, puzzleMove, puzzleKey, puzzleSummary, leavePuzzles, themeName } from './puzzles.js';
import { initTraining, openTraining, trainingTargets, trainingMove, trainingKey, trainingSummary, leaveTraining } from './training.js';
import { initProfile, renderProfile, renderSyncStatus, dayStreak, TAGS } from './profile.js';
import { initPlay, openPlay, playTargets, playMove, leavePlay } from './play.js';
import { initTrainers, openTrainers, trainerTargets, trainerMove, trainerSummary, leaveTrainers } from './trainers.js';
import { initLessons, renderLessonList, openLesson, lessonTargets, lessonMove, lessonKey, lessonProgress } from './lessons.js';
import { Board } from './board.js';
import { AnalysisPool, LiveEngine, EnginePlayer, warmEngine, terminalEval } from './engine.js';
import { db, migrateLegacy } from './db.js';
import { initSync, startSync, skipSync, syncIfStale, flushSync, touch, forget, fetchGame } from './sync.js';
import { parseLichessLink, loadLichessGame, fetchLichessGames } from './lichess.js';
import { buildPgn, splitPgn, pgnTag, packPgn, unpackPgn, packAnalysis, unpackAnalysis } from './pgn.js';
import { gameSummary, mistakeCards, mistakeTag, timeReport, timeSpent } from './insights.js';
import { reviewGame, bookMoves, winPct, evalText, previewAccuracy, CLASSES, CLASS_ORDER, BAD, STRICTNESS, setPalette } from './analysis.js';
import { explainMove, summarize, resultText, describeMove, pvToMoves, lineText, sanDe, say, setNotation } from './coach.js';
import { parseGameLink, loadByLink, gameFromPgn, gameFromArchive, fetchRecentGames, fetchAvatar, LoadError } from './chesscom.js';
import { materialInfo, flipTurn } from './tactics.js';
import { classIcon, uiIcon } from './icons.js';
import { playSound, setSoundEnabled, setVolume } from './sound.js';
import { DEMO_PGN } from './demo.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const SIDE = { w: 'Weiß', b: 'Schwarz' };
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const THEMES = {
  green: { name: 'Grün', light: '#ebecd0', dark: '#739552' },
  brown: { name: 'Holz', light: '#f0d9b5', dark: '#b58863' },
  blue: { name: 'Blau', light: '#dee3e6', dark: '#8ca2ad' },
  grey: { name: 'Grau', light: '#e3e3e3', dark: '#8f8f8f' },
  purple: { name: 'Lila', light: '#ece4f5', dark: '#8f77b5' },
};
const PIECE_SETS = { cburnett: 'Klassisch', chessnut: 'Modern', merida: 'Merida' };
const DEPTHS = { 12: 'Schnell', 16: 'Normal', 20: 'Tief' };
// Weitere Einstellungen: [Schlüssel, Überschrift, Auswahl]
const OPTIONS = [
  ['mode', 'Design', { dark: 'Dunkel', light: 'Hell' }],
  ['size', 'Brettgröße', { small: 'Klein', medium: 'Mittel', auto: 'Groß' }],
  ['notation', 'Schreibweise der Züge', { de: 'Deutsch (S, L, T, D)', en: 'Englisch (N, B, R, Q)', fig: 'Figuren (♘ ♗ ♖ ♕)' }],
  ['strict', 'Bewertung der Züge', { mild: 'Nachsichtig', normal: 'Normal', strict: 'Streng' }],
  ['lines', 'Engine-Linien', { 0: 'Aus', 1: '1', 2: '2', 3: '3', 5: '5' }],
  ['palette', 'Farben der Zugbewertung', { normal: 'Standard', safe: 'Für Farbenblinde' }],
];
const TOGGLES = [['anim', 'Figuren gleiten lassen'], ['dots', 'Mögliche Züge als Punkte zeigen'], ['lastMove', 'Letzten Zug farbig markieren']];
const DEFAULTS = { theme: 'green', pieces: 'cburnett', depth: 16, sound: true, volume: 0.7, mode: 'dark', size: 'auto', notation: 'de', strict: 'normal', lines: 3, palette: 'normal', anim: true, dots: true, lastMove: true };

// ---------------------------------------------------------------------------
// Zustand & Speicher
// ---------------------------------------------------------------------------

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('ca.' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  /** silent = true: nur ablegen, nicht als Änderung des Nutzers für die Synchronisierung vormerken. */
  set(key, value, silent = false) {
    try {
      const text = JSON.stringify(value);
      const changed = localStorage.getItem('ca.' + key) !== text;
      localStorage.setItem('ca.' + key, text);
      if (changed && !silent) touch(key);
      return true;
    } catch (e) {
      return false;
    }
  },
  del(key) {
    try { localStorage.removeItem('ca.' + key); } catch (e) { /* egal */ }
  },
};

const S = {
  settings: { ...DEFAULTS, ...store.get('settings', {}) },
  username: store.get('username', ''),
  site: store.get('site', 'chesscom'),
  view: 'home',
  mode: null, // 'game' = Partieanalyse, 'board' = freies Analysebrett
  game: null,
  review: null,
  ply: 0,
  variation: null,
  retry: null,
  live: null,
  orientation: 'w',
  you: null, // 'w' | 'b' – welche Seite der Nutzer gespielt hat
  pool: null,
  book: null,
  hoverArrow: null,
};

const live = new LiveEngine();
const scale = () => STRICTNESS[S.settings.strict] || 1;
let board;
let threatEngine = null;
let drawSettings = () => {};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function init() {
  board = new Board($('board'), { getMoves: legalTargets, onMove: onUserMove });
  applySettings();
  buildStaticIcons();
  buildSettingsDialog();
  bindEvents();
  migrateLegacy().catch(() => {}).then(renderHistory);
  $('user-input').value = S.username;
  bindEditor({ board, $, setCoach, uiIcon, copyText, pieceSet: () => S.settings.pieces, onPlay: (fen) => openBoard(fen), onCancel: closeEditor });
  initLessons({ board, $, setCoach, store, uiIcon, esc, playSound, enterLessonView, onDone: () => bump('lessons') });
  initPuzzles({ board, $, setCoach, store, playSound, enterPuzzleView, openBoard: (fen, ucis) => openBoard(fen, ucis, 1), onSolved: () => bump('puzzles') });
  initPlay({
    board, $, setCoach, store, uiIcon, playSound, enterPlayView, san: sanDe, username: () => S.username,
    evaluate: (fen) => live.evaluate(fen, 12),
    analyze: (pgn, you) => { const g = gameFromPgn(pgn); g.youHint = you; startGame(g); },
    onResult: (r) => bump(r.scenario ? 'endgames' : 'played', r),
  });
  initTraining({ board, $, setCoach, playSound, enterTrainingView: () => soloPane('pane-training', 'training', 'Fehler-Training'), san: sanDe, evaluate: (fen) => live.evaluate(fen, 13), onCard: () => bump('cards') });
  initTrainers({ board, $, setCoach, store, esc, playSound, san: sanDe, enterTrainerView: (title) => soloPane('pane-trainer', 'trainer', title), openBoard: (fen, ucis) => openBoard(fen, ucis), onDone: (kind) => bump(kind === 'coords' ? 'coords' : 'openings') });
  initProfile({
    $, esc, store, lessonProgress, username: () => S.username, batchAnalyze, download, themeName, copyText,
    openTheme: (theme) => { store.set('puzzles', { ...store.get('puzzles', {}), theme }); location.hash = '#aufgaben'; },
  });
  initSync({ onApplied: afterSync, onStatus: () => { if (S.view === 'profile') renderSyncStatus(); } });
  initAccount();
  routeFromHash();
  initOffline();
  bindSwipe();
  $('skip-link').onclick = (e) => {
    e.preventDefault();
    const main = [...document.querySelectorAll('main')].find((m) => !m.hidden);
    if (main) { main.tabIndex = -1; main.focus(); }
  };
}

/** Ein anderes Gerät hat Neues geliefert: Einstellungen und sichtbare Listen auffrischen. */
function afterSync() {
  S.settings = { ...DEFAULTS, ...store.get('settings', {}) };
  S.username = store.get('username', '');
  S.site = store.get('site', 'chesscom');
  applySettings();
  drawSettings();
  $('user-input').value = S.username;
  $('site-input').value = S.site;
  if (S.view === 'hub') {
    renderHistory();
    renderHub();
  } else if (S.view === 'profile') renderProfile();
  else if (S.mode === 'game' && S.review) {
    const game = S.game;
    loadAnnot(game).then((a) => {
      if (S.game !== game) return;
      S.annot = a;
      refreshAfterSettings();
    });
  }
}

/**
 * Offline-Modus: Ein Service Worker hält die Seite im Gerätespeicher. Das macht sie ohne Netz
 * nutzbar und spart Anfragen an den Server. Nach einem Update lädt die Startseite einmal neu.
 */
function initOffline() {
  if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost')) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || reloaded || S.view !== 'hub') return;
    reloaded = true;
    location.reload();
  });
}

/** Entfernt Service Worker und Zwischenspeicher (beim Abmelden – danach liegt nichts mehr offline vor). */
async function clearOffline() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    for (const key of await caches.keys()) await caches.delete(key);
  } catch (e) { /* nicht unterstützt – dann gibt es auch nichts zu löschen */ }
}

/** Auf dem Handy: über Coach oder Zugliste wischen blättert einen Zug vor oder zurück. */
function bindSwipe() {
  let start = null;
  const panel = document.querySelector('.panel');
  panel.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = e.touches.length === 1 && !e.target.closest('input, select, textarea, .graph-wrap, .palette') ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!start || S.view !== 'moves' || (S.mode !== 'game' && S.mode !== 'board')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Date.now() - start.at < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) (dx < 0 ? next : prev)();
    start = null;
  }, { passive: true });
}

function buildStaticIcons() {
  $('btn-settings').innerHTML = uiIcon('gear', 20);
  $('settings-close').innerHTML = uiIcon('close', 18);
  $('games-close').innerHTML = uiIcon('close', 18);
  $('ctl-overview').innerHTML = uiIcon('chart', 20);
  $('ctl-first').innerHTML = uiIcon('first', 20);
  $('ctl-prev').innerHTML = uiIcon('prev', 22);
  $('ctl-next').innerHTML = uiIcon('next', 22);
  $('ctl-last').innerHTML = uiIcon('last', 20);
  $('ctl-flip').innerHTML = uiIcon('flip', 20);
  $('ctl-key').innerHTML = uiIcon('star', 20);
  $('btn-logout').innerHTML = uiIcon('logout', 20);
  document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = uiIcon(el.dataset.ico, 24); });
}

/** byUser = true, wenn der Nutzer gerade selbst etwas umgestellt hat (nur dann wird es an andere Geräte weitergegeben). */
function applySettings(byUser = false) {
  const t = THEMES[S.settings.theme] || THEMES.green;
  document.documentElement.style.setProperty('--sq-light', t.light);
  document.documentElement.style.setProperty('--sq-dark', t.dark);
  if (!PIECE_SETS[S.settings.pieces]) S.settings.pieces = 'cburnett';
  board.setPieceSet(S.settings.pieces);
  setSoundEnabled(S.settings.sound);
  setVolume(+S.settings.volume);
  setNotation(S.settings.notation);
  setPalette(S.settings.palette === 'safe');
  live.multipv = Math.max(1, +S.settings.lines || 1);
  const root = document.documentElement;
  root.dataset.mode = S.settings.mode === 'light' ? 'light' : 'dark';
  root.dataset.size = S.settings.size;
  root.classList.toggle('no-motion', !S.settings.anim);
  root.classList.toggle('no-dots', !S.settings.dots);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = S.settings.mode === 'light' ? '#eef1f5' : '#11151b';
  $('btn-sound').innerHTML = uiIcon(S.settings.sound ? 'sound' : 'mute', 20);
  store.set('settings', S.settings, !byUser);
  if (S.view !== 'home' && S.game) renderPlayers();
}

function buildSettingsDialog() {
  const draw = () => {
    $('set-theme').innerHTML = Object.entries(THEMES).map(([k, t]) =>
      `<button type="button" class="swatch ${k === S.settings.theme ? 'on' : ''}" data-theme="${k}">
        <i style="background-image:repeating-conic-gradient(${t.dark} 0 25%, ${t.light} 0 50%)"></i>${t.name}</button>`).join('');
    $('set-pieces').innerHTML = Object.entries(PIECE_SETS).map(([k, name]) =>
      `<button type="button" class="swatch ${k === S.settings.pieces ? 'on' : ''}" data-pieces="${k}">
        <i class="pc" style="background-image:url('assets/pieces/${k}/wN.svg')"></i>${name}</button>`).join('');
    $('set-depth').innerHTML = Object.entries(DEPTHS).map(([d, name]) =>
      `<button type="button" class="${+d === S.settings.depth ? 'on' : ''}" data-depth="${d}">${name}</button>`).join('');
    $('set-more').innerHTML = OPTIONS.map(([key, title, choices]) =>
      `<h3>${title}</h3><div class="seg n${Object.keys(choices).length}">` + Object.entries(choices).map(([v, name]) =>
        `<button type="button" class="${String(S.settings[key]) === v ? 'on' : ''}" data-opt="${key}" data-value="${v}">${name}</button>`).join('') + '</div>').join('')
      + '<h3>Brett und Ton</h3>'
      + TOGGLES.map(([key, title]) => `<label class="toggle"><input type="checkbox" data-toggle="${key}" ${S.settings[key] ? 'checked' : ''}> ${title}</label>`).join('')
      + `<label class="toggle range">Lautstärke <input type="range" id="set-volume" min="0" max="1" step="0.05" value="${S.settings.volume}"></label>`;
  };
  draw();
  drawSettings = draw;
  $('settings').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.toggle) S.settings[t.dataset.toggle] = t.checked;
    else if (t.id === 'set-volume') {
      S.settings.volume = +t.value;
      S.settings.sound = S.settings.volume > 0;
    } else return;
    applySettings(true);
    if (t.id === 'set-volume') playSound('move');
    refreshAfterSettings();
  });
  $('settings').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === $('settings')) $('settings').close();
    if (!b) return;
    if (b.dataset.theme) S.settings.theme = b.dataset.theme;
    else if (b.dataset.pieces) S.settings.pieces = b.dataset.pieces;
    else if (b.dataset.depth) S.settings.depth = +b.dataset.depth;
    else if (b.dataset.opt) S.settings[b.dataset.opt] = b.dataset.opt === 'lines' ? +b.dataset.value : b.dataset.value;
    else return;
    applySettings(true);
    draw();
    refreshAfterSettings(b.dataset.opt);
  });
  $('btn-keys').onclick = () => { $('settings').close(); $('keys').showModal(); };
  $('keys-close').onclick = () => $('keys').close();
  $('keys').addEventListener('click', (e) => { if (e.target === $('keys')) $('keys').close(); });
  $('btn-settings').onclick = () => $('settings').showModal();
  $('settings-close').onclick = () => $('settings').close();
}

/** Zeichnet neu, was von einer geänderten Einstellung abhängt (Notation, Strenge, Farben …). */
function refreshAfterSettings(opt) {
  if (S.mode !== 'game' || !S.review) {
    if (S.mode === 'board' && S.variation) render();
    return;
  }
  if (opt === 'strict') S.review = reviewGame(S.game, S.rawPositions || S.review.positions, S.book, scale());
  buildMoveList();
  if (S.view === 'overview') renderOverview();
  else if (S.view === 'moves') render();
  renderGraphs();
}

function bindEvents() {
  $('load-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitInput();
  });
  const input = $('game-input');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight + 2, 180) + 'px';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !input.value.includes('\n')) {
      e.preventDefault();
      submitInput();
    }
  });
  input.addEventListener('paste', () => setTimeout(() => {
    input.dispatchEvent(new Event('input'));
    if (parseGameLink(input.value)) submitInput();
  }, 0));
  $('btn-demo').onclick = () => startGame(gameFromPgn(DEMO_PGN));
  $('btn-recent').onclick = () => {
    const name = $('user-input').value.trim() || $('game-input').value.trim();
    if (!/^[\w-]{2,40}$/.test(name)) {
      setStatus('Trag zuerst deinen chess.com-Namen ein.', 'error');
      $('user-input').focus();
      return;
    }
    showRecentGames(name);
  };
  $('games-close').onclick = () => { $('games-card').hidden = true; };
  $('site-input').value = S.site;
  $('site-input').onchange = (e) => {
    S.site = e.target.value;
    store.set('site', S.site);
  };
  $('btn-file').onclick = () => $('pgn-file').click();
  $('pgn-file').onchange = (e) => {
    openPgnFile(e.target.files[0]);
    e.target.value = '';
  };
  const card = $('load-form');
  for (const ev of ['dragenter', 'dragover']) card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.add('drop'); });
  for (const ev of ['dragleave', 'drop']) card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.remove('drop'); });
  card.addEventListener('drop', (e) => openPgnFile(e.dataTransfer.files[0]));
  $('games-filter').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    S.gamesList.filter[c.dataset.key] = c.dataset.value;
    renderGamesList();
  });
  $('btn-new').onclick = goHome;
  $('btn-board').onclick = () => openBoard(S.mode === 'game' && S.view === 'moves' ? currentFen() : null);
  document.querySelector('.tiles').addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (!t) return;
    const go = t.dataset.go;
    if (['analyse', 'lektionen', 'brett', 'aufgaben', 'spielen', 'training', 'profil', 'trainer'].includes(go)) location.hash = '#' + go;
    else if (go === 'editor') { openBoard(); showEditor(currentFen()); }
    else if (go === 'demo') startGame(gameFromPgn(DEMO_PGN));
    else if (go === 'recent') {
      location.hash = '#analyse';
      setTimeout(() => (S.username ? showRecentGames(S.username) : $('user-input').focus()), 50);
    }
  });
  $('lessons-search').addEventListener('input', (e) => renderLessonList(e.target.value));
  $('new-games').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ngAll) enqueueNewGames();
    else if (b.dataset.ngOpen) location.hash = '#' + b.dataset.ngOpen;
    else if (b.dataset.ngHide) {
      // Merker: alles bis zur neuesten dieser Partien gilt als gesehen (auch auf anderen Geräten)
      const newest = Math.max(...NG.list.map((x) => x.at));
      store.set('newseen', Math.max(Number(store.get('newseen', 0)) || 0, newest));
      NG.list = [];
      NG.queue = [];
      renderNewGames();
    } else if (b.dataset.ngNow) {
      const entry = NG.list.find((x) => x.id === b.dataset.ngNow);
      try {
        if (entry) startGame(entry.load());
      } catch (err) {
        console.error(err);
        NG.failed.add(entry.id);
        renderNewGames();
      }
    }
  });
  $('hub-continue').onclick = () => {
    const { next } = lessonProgress();
    if (next) location.hash = '#lektion/' + next.id;
  };
  $('bt-edit').onclick = () => showEditor(currentFen());
  $('bt-reset').onclick = () => openBoard(START_FEN);
  $('bt-fen').onclick = (e) => copyText(currentFen(), e.currentTarget);
  $('bt-pgn').onclick = (e) => copyText(boardPgn(), e.currentTarget);
  $('bt-arrow').checked = store.get('boardArrow', true);
  $('bt-arrow').onchange = (e) => {
    store.set('boardArrow', e.target.checked);
    renderBoard(false);
  };
  $('brand').onclick = (e) => { e.preventDefault(); goHome(); };
  $('btn-sound').onclick = () => {
    S.settings.sound = !S.settings.sound;
    applySettings(true);
    if (S.settings.sound) playSound('move');
  };
  $('btn-cancel').onclick = goHome;
  $('btn-start').onclick = () => { showMoves(); go(0); };
  $('ctl-overview').onclick = showOverview;
  $('ctl-first').onclick = () => (S.mode === 'board' ? boardGo(0) : go(0));
  $('ctl-prev').onclick = prev;
  $('ctl-next').onclick = next;
  $('ctl-last').onclick = () => (S.mode === 'board' ? boardGo(Infinity) : go(S.game.moves.length));
  $('ctl-flip').onclick = flip;
  $('ctl-key').onclick = nextKey;
  $('ov-actions').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !S.review) return;
    const act = b.dataset.act;
    if (act === 'summary') copyText(summaryText(), b);
    else if (act === 'pgn') download(new Blob([buildPgn(S.game, S.review, S.annot)], { type: 'application/x-chess-pgn' }), `${S.game.white.name}-${S.game.black.name}.pgn`.replace(/[^\w.-]+/g, '_'));
    else if (act === 'share') {
      // Link mit fertiger Analyse; nur bei sehr langen Partien (riesiger Link) nur mit den Zügen
      const full = `${location.origin}${location.pathname}#a=${await packAnalysis(S.game, S.rawPositions || S.review.positions, S.analysisDepth || S.settings.depth)}`;
      copyText(full.length <= 60000 ? full : `${location.origin}${location.pathname}#pgn=${await packPgn(buildPgn(S.game))}`, b);
    }
    else if (act === 'png') boardPng();
  });
  $('moments').addEventListener('click', (e) => {
    const b = e.target.closest('.moment');
    if (b) { showMoves(); go(+b.dataset.ply); }
  });

  $('moves').addEventListener('click', (e) => {
    const del = e.target.closest('.var-del');
    if (del) {
      deleteSavedLine(del.closest('.var-row').dataset.line);
      return;
    }
    const open = e.target.closest('.var-open');
    if (open) {
      openSavedLine(open.closest('.var-row').dataset.line);
      return;
    }
    const b = e.target.closest('.mv');
    if (!b) return;
    if (S.mode === 'board') boardGo(+b.dataset.ply);
    else go(+b.dataset.ply);
  });
  for (const id of ['graph-overview', 'graph-moves']) {
    $(id).parentElement.addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ply = Math.round(((e.clientX - rect.left) / rect.width) * S.game.moves.length);
      if (S.view === 'overview') showMoves();
      go(ply);
    });
  }
  $('lines').addEventListener('click', (e) => {
    const b = e.target.closest('.line');
    if (b) playLine(+b.dataset.i);
  });
  $('lines').addEventListener('pointerover', (e) => {
    const b = e.target.closest('.line');
    const arrow = b ? b.dataset.uci : null;
    if (arrow !== S.hoverArrow) {
      S.hoverArrow = arrow;
      renderBoard(false);
    }
  });
  $('lines').addEventListener('pointerleave', () => {
    if (S.hoverArrow) {
      S.hoverArrow = null;
      renderBoard(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.view === 'lesson') {
      if (lessonKey(e.key)) e.preventDefault();
      return;
    }
    if (S.view === 'puzzle') {
      if (puzzleKey(e.key)) e.preventDefault();
      return;
    }
    if (S.view === 'training') {
      if (trainingKey(e.key)) e.preventDefault();
      return;
    }
    if (e.key === '?') {
      $('keys').showModal();
      e.preventDefault();
      return;
    }
    if (S.view !== 'moves' && S.view !== 'overview') return;
    if (e.key === 'ArrowRight') {
      if (S.view === 'overview') { showMoves(); go(0); } else next();
    } else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Home') $('ctl-first').click();
    else if (e.key === 'End') $('ctl-last').click();
    else if (e.key.toLowerCase() === 'f') flip();
    else if (e.key.toLowerCase() === 'n' && S.view === 'moves' && S.mode === 'game') (e.shiftKey ? prevKey() : nextKey());
    else if (e.key.toLowerCase() === 'd' && S.view === 'moves') showThreat();
    else if (e.key.toLowerCase() === 'x' && S.view === 'moves' && S.mode === 'game') toggleOnlyBad();
    else return;
    e.preventDefault();
  });
  window.addEventListener('resize', () => {
    if (S.review) renderGraphs();
  });
  // Mausrad über dem Brett blättert durch die Züge
  let wheelAt = 0;
  $('board').addEventListener('wheel', (e) => {
    if (S.view !== 'moves' || (S.mode !== 'game' && S.mode !== 'board')) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < 4 || e.timeStamp - wheelAt < 70) return;
    wheelAt = e.timeStamp;
    if (e.deltaY > 0) next();
    else prev();
  }, { passive: false });
  $('mt-bad').onclick = toggleOnlyBad;
  $('variation').addEventListener('click', (e) => { if (e.target.closest('#v-save')) saveVariation(); });
  $('mt-note').onclick = () => {
    S.noteOpen = S.noteOpen === S.ply ? null : S.ply;
    renderTools();
    if (!$('note-box').hidden) $('note-text').focus();
  };
  let noteTimer = null;
  $('note-text').addEventListener('input', () => {
    const ply = S.ply;
    const game = S.game;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { if (S.game === game) setNote(ply, $('note-text').value); }, 500);
  });
  $('note-text').addEventListener('blur', () => {
    clearTimeout(noteTimer);
    if (S.mode === 'game' && !S.variation) setNote(S.ply, $('note-text').value);
  });
  $('mt-threat').onclick = showThreat;
  $('mt-deep').onclick = deepen;
  for (const id of ['graph-overview', 'graph-moves']) {
    const wrap = $(id).parentElement;
    const tip = document.createElement('div');
    tip.className = 'graph-tip';
    tip.hidden = true;
    wrap.appendChild(tip);
    wrap.addEventListener('pointermove', (e) => {
      if (!S.review || !S.game) return;
      const rect = wrap.getBoundingClientRect();
      const n = S.game.moves.length;
      const ply = Math.max(0, Math.min(n, Math.round(((e.clientX - rect.left) / rect.width) * n)));
      const m = ply ? S.game.moves[ply - 1] : null;
      const startNo = +S.game.startFen.split(' ')[5] || 1;
      const offset = S.game.moves[0].color === 'b' ? 1 : 0;
      const label = m ? `${startNo + Math.floor((ply - 1 + offset) / 2)}${m.color === 'w' ? '.' : '…'} ${sanDe(m.san)}` : 'Start';
      tip.textContent = `${label} · ${evalText(S.review.evals[ply])}`;
      tip.hidden = false;
      tip.style.left = Math.max(2, Math.min(rect.width - tip.offsetWidth - 2, e.clientX - rect.left - tip.offsetWidth / 2)) + 'px';
    });
    wrap.addEventListener('pointerleave', () => { tip.hidden = true; });
  }
  window.addEventListener('hashchange', routeFromHash);
}

// ---------------------------------------------------------------------------
// Partie laden
// ---------------------------------------------------------------------------

function setStatus(text, kind) {
  const el = $('load-status');
  el.hidden = !text;
  el.className = 'load-status' + (kind === 'error' ? ' error' : '');
  el.innerHTML = (kind === 'busy' ? '<span class="spinner"></span>' : '') + `<span>${esc(text)}</span>`;
  $('btn-load').disabled = kind === 'busy';
}

function rememberUser() {
  const name = $('user-input').value.trim();
  if (name !== S.username) {
    S.username = name;
    store.set('username', name);
  }
  return name;
}

async function submitInput() {
  const text = $('game-input').value.trim();
  const username = rememberUser();
  if (!text) {
    if (username) showRecentGames(username);
    else setStatus('Füge einen Partie-Link, ein PGN oder einen Benutzernamen ein.', 'error');
    return;
  }
  try {
    if (/\[\w+\s+"/.test(text) || /\d\.\s*[a-hNBRQKO]/.test(text)) {
      openPgnText(text);
      return;
    }
    const lichessId = parseLichessLink(text);
    if (lichessId) {
      setStatus('Lade die Partie von Lichess …', 'busy');
      const game = await loadLichessGame(lichessId);
      setStatus('');
      startGame(game);
      return;
    }
    const link = parseGameLink(text);
    if (link) {
      await loadLink(link, S.site === 'chesscom' ? username : '');
      return;
    }
    if (/^[\w-]{2,40}$/.test(text)) {
      showRecentGames(text);
      return;
    }
    setStatus('Das sieht nicht nach einem Link von chess.com oder Lichess, einem PGN oder einem Benutzernamen aus.', 'error');
  } catch (e) {
    reportLoadError(e);
  }
}

/** PGN-Text öffnen: eine Partie direkt analysieren, bei mehreren eine Auswahlliste zeigen. */
function openPgnText(text) {
  const parts = splitPgn(text);
  if (parts.length === 1) {
    startGame(gameFromPgn(parts[0]));
    return;
  }
  const entries = parts.slice(0, 400).map((pgn, i) => ({
    id: 'pgnfile-' + i,
    white: { name: pgnTag(pgn, 'White') || 'Weiß', rating: pgnTag(pgn, 'WhiteElo') || null },
    black: { name: pgnTag(pgn, 'Black') || 'Schwarz', rating: pgnTag(pgn, 'BlackElo') || null },
    result: pgnTag(pgn, 'Result') || '*', timeClass: '', at: 0, dateText: pgnTag(pgn, 'Date').replace(/\?/g, '').replace(/\.+$/, ''),
    load: () => gameFromPgn(pgn),
  }));
  setStatus('');
  showGamesList(`${parts.length} Partien in der Datei`, entries, '');
}

async function openPgnFile(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    setStatus('Die Datei ist zu groß (maximal 20 MB).', 'error');
    return;
  }
  try {
    openPgnText(await file.text());
  } catch (e) {
    reportLoadError(e);
  }
}

async function loadLink(link, username) {
  setStatus('Lade die Partie von chess.com …', 'busy');
  const onStatus = (t) => setStatus(t, 'busy');
  let game;
  try {
    game = await loadByLink(link, { username, onStatus });
  } catch (e) {
    if (!(e instanceof LoadError) || e.code !== 'needuser') throw e;
    if (!username) {
      setStatus('Fast geschafft: Trag unten einmal deinen chess.com-Namen ein und klick nochmal auf „Analysieren“ – dann finde ich die Partie in deinem Archiv.', 'error');
      $('user-input').focus();
      return;
    }
    game = await loadByLink(link, { username, onStatus, deep: true });
  }
  setStatus('');
  startGame(game);
}

function reportLoadError(e) {
  console.error(e);
  setStatus(e instanceof LoadError ? e.message : 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.', 'error');
}

async function showRecentGames(username, months = 2) {
  const site = S.site === 'lichess' ? 'Lichess' : 'chess.com';
  setStatus(`Lade die letzten Partien von ${username} (${site}) …`, 'busy');
  $('games-card').hidden = true; // keine alte Liste stehen lassen, falls das Laden scheitert
  try {
    const entries = S.site === 'lichess' ? await fetchLichessGames(username, months * 30) : await fetchRecentGames(username, { months, limit: months * 60 });
    setStatus('');
    if (!$('user-input').value.trim()) {
      $('user-input').value = username;
      rememberUser();
    }
    showGamesList(`Letzte Partien von ${username}`, entries, username.toLowerCase(), months < 12 ? () => showRecentGames(username, months + 2) : null);
  } catch (e) {
    reportLoadError(e);
  }
}

/** Zeigt eine Auswahlliste von Partien mit Filtern (Zeitformat, Farbe, Ergebnis). */
function showGamesList(title, entries, me, more = null) {
  S.gamesList = { title, entries, me, more, filter: (S.gamesList && S.gamesList.me === me && S.gamesList.filter) || { tc: '', color: '', res: '' } };
  $('games-title').textContent = title;
  renderGamesList();
  $('games-card').hidden = false;
  $('games-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderGamesList() {
  const { entries, me, more, filter } = S.gamesList;
  const analyzed = new Set((S.metas || []).map((m) => m.id));
  const mine = (g) => (!me ? null : g.white.name.toLowerCase() === me ? 'w' : g.black.name.toLowerCase() === me ? 'b' : null);
  const outcome = (g) => { const c = mine(g); return !c || g.result === '*' ? null : g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === (c === 'w') ? 'win' : 'loss'; };
  const chip = (key, value, label) => `<button type="button" class="chip ${filter[key] === value ? 'on' : ''}" data-key="${key}" data-value="${value}">${label}</button>`;
  const classes = [...new Set(entries.map((g) => g.timeClass).filter(Boolean))];
  $('games-filter').innerHTML = (classes.length > 1 ? chip('tc', '', 'Alle') + classes.map((c) => chip('tc', c, timeClassName(c))).join('') + '<span class="chip-gap"></span>' : '')
    + (me ? chip('color', '', 'Beide Farben') + chip('color', 'w', 'Weiß') + chip('color', 'b', 'Schwarz') + '<span class="chip-gap"></span>'
      + chip('res', '', 'Alle Ergebnisse') + chip('res', 'win', 'Siege') + chip('res', 'loss', 'Niederlagen') + chip('res', 'draw', 'Remis') : '');
  const shown = entries.filter((g) => (!filter.tc || g.timeClass === filter.tc) && (!filter.color || mine(g) === filter.color) && (!filter.res || outcome(g) === filter.res));
  const list = $('games-list');
  list.innerHTML = shown.length ? '' : '<li class="game-empty">Keine passenden Partien gefunden.</li>';
  shown.forEach((g) => {
    const res = outcome(g) || 'draw';
    const letter = outcome(g) ? { win: 'S', loss: 'N', draw: 'R' }[res] : (g.result === '1-0' ? '1' : g.result === '0-1' ? '0' : '½');
    const date = g.at ? new Date(g.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : (g.dateText || '');
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="game-item">
      <span class="game-res ${res}">${letter}</span>
      <span class="game-names">${esc(g.white.name)} ${g.white.rating ? `<small>(${esc(g.white.rating)})</small>` : ''} – ${esc(g.black.name)} ${g.black.rating ? `<small>(${esc(g.black.rating)})</small>` : ''}</span>
      <span class="game-meta">${analyzed.has(g.id) ? '<span class="done">✓ analysiert</span> · ' : ''}${esc([timeClassName(g.timeClass), date].filter(Boolean).join(' · '))}</span></button>`;
    li.firstChild.onclick = () => {
      try {
        startGame(g.load());
      } catch (e) {
        reportLoadError(e);
      }
    };
    list.appendChild(li);
  });
  if (more) {
    const li = document.createElement('li');
    li.innerHTML = '<button type="button" class="game-item more">Ältere Partien laden</button>';
    li.firstChild.onclick = more;
    list.appendChild(li);
  }
}

function timeClassName(tc) {
  return { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Schnellschach', daily: 'Fernschach' }[tc] || '';
}

async function renderHistory() {
  const metas = (await db.all('meta').catch(() => [])).map((e) => e.value).sort((x, y) => (y.fav ? 1 : 0) - (x.fav ? 1 : 0) || y.at - x.at);
  S.metas = metas;
  $('history-card').hidden = !metas.length;
  const shown = S.historyAll ? metas : metas.slice(0, 8);
  $('history-list').innerHTML = shown.map((h) => {
    const mine = h.you ? h.acc && h.acc[h.you] : null;
    const res = !h.you ? 'draw' : (h.result === '1/2-1/2' ? 'draw' : (h.result === '1-0') === (h.you === 'w') ? 'win' : 'loss');
    const letter = h.you ? { win: 'S', loss: 'N', draw: 'R' }[res] : (h.result === '1-0' ? '1' : h.result === '0-1' ? '0' : '½');
    const info = [h.opening, mine != null ? `${mine.toFixed(0)} % genau` : '', h.date ? h.date.split('-').reverse().join('.') : ''].filter(Boolean).join(' · ');
    return `<li class="hist-row"><button type="button" class="game-item" data-id="${esc(h.id)}">
      <span class="game-res ${res}">${letter}</span>
      <span class="game-names">${esc(h.white)} – ${esc(h.black)}<small class="game-sub">${esc(info)}</small></span></button>
      <button type="button" class="icon-btn hist-fav ${h.fav ? 'on' : ''}" data-fav="${esc(h.id)}" title="Merken" aria-label="Partie merken">${uiIcon('star', 16)}</button>
      <button type="button" class="icon-btn" data-del="${esc(h.id)}" title="Löschen" aria-label="Partie löschen">${uiIcon('trash', 16)}</button></li>`;
  }).join('') + (metas.length > 8 && !S.historyAll ? `<li><button type="button" class="game-item more" data-more="1">Alle ${metas.length} Partien anzeigen</button></li>` : '');
  $('history-list').onclick = async (e) => {
    const fav = e.target.closest('[data-fav]'), del = e.target.closest('[data-del]');
    if (fav) {
      const m = metas.find((x) => x.id === fav.dataset.fav);
      m.fav = !m.fav;
      m.mod = Date.now();
      await db.set('meta', m.id, m);
      touch();
      renderHistory();
    } else if (del) {
      await Promise.all([db.del('meta', del.dataset.del), db.del('games', del.dataset.del)]);
      forget('g', del.dataset.del);
      if (await db.get('notes', del.dataset.del).catch(() => null)) {
        await db.del('notes', del.dataset.del).catch(() => {});
        forget('n', del.dataset.del);
      }
      renderHistory();
    } else if (e.target.closest('[data-more]')) {
      S.historyAll = true;
      renderHistory();
    } else {
      const b = e.target.closest('.game-item');
      if (b) location.hash = '#' + b.dataset.id;
    }
  };
}

/** Speichert Partie, Engine-Ergebnisse und Kurzfassung – und legt Trainingskarten für eigene Fehler an. */
async function saveGame(c, positions, depth) {
  const game = c.game;
  const slim = positions.map((p) => ({ lines: p.lines.map((l) => ({ ...l, pv: l.pv.slice(0, 12) })), eval: p.eval, terminal: p.terminal, book: p.book }));
  const old = await db.get('meta', game.id).catch(() => null);
  const summary = { ...gameSummary(c), fav: old ? old.fav : false, at: old ? old.at : Date.now() };
  await db.set('games', game.id, { game, positions: slim, depth, at: summary.at });
  await db.set('meta', game.id, summary);
  if (c.you) {
    const known = new Set((await db.all('cards')).map((x) => x.key));
    const fresh = mistakeCards(c, c.you).filter((x) => !known.has(x.id));
    if (fresh.length) await db.setMany('cards', fresh.map((x) => [x.id, x]));
  }
  touch();
}

async function routeFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) {
    if (S.view !== 'hub') goHome(true);
    return;
  }
  if (id === 'analyse') {
    showAnalyze();
    return;
  }
  if (id.startsWith('a=')) {
    // Teilen-Link mit fertiger Analyse: sofort anzeigen, ohne neu zu rechnen
    try {
      const shared = await unpackAnalysis(id.slice(2));
      const game = gameFromPgn(shared.pgn);
      if (shared.id) game.id = shared.id;
      if (shared.positions.length !== game.fens.length) throw new Error('passt nicht');
      const positions = shared.positions.map((p, i) => (p === 'terminal' ? terminalEval(game.fens[i]) || { lines: [], eval: { type: 'cp', value: 0 }, terminal: 'draw' } : p));
      startGame(game, { positions, depth: shared.depth, shared: true });
    } catch (e) {
      showAnalyze();
      setStatus('Dieser Analyse-Link ist unvollständig oder beschädigt. Wurde er komplett kopiert?', 'error');
    }
    return;
  }
  if (id.startsWith('pgn=')) {
    try {
      startGame(gameFromPgn(await unpackPgn(id.slice(4))));
    } catch (e) {
      showAnalyze();
      reportLoadError(e);
    }
    return;
  }
  if (id === 'lektionen') {
    showLessons();
    return;
  }
  if (id === 'training') {
    leaveModes();
    openTraining();
    return;
  }
  if (id === 'profil') {
    leaveModes();
    S.view = 'profile';
    showMain('profile');
    document.title = 'Mein Profil · Chess Analyzer';
    renderProfile();
    window.scrollTo(0, 0);
    return;
  }
  if (id === 'trainer' || id.startsWith('trainer/')) {
    const [, tab, op] = id.split('/');
    leaveModes();
    openTrainers(tab === 'eroeffnungen' ? 'openings' : 'coords', op);
    return;
  }
  if (id === 'spielen') {
    if (S.mode !== 'play') {
      leaveModes();
      openPlay();
    }
    return;
  }
  if (id === 'aufgaben') {
    if (S.mode !== 'puzzle') {
      leaveModes();
      openPuzzles();
    }
    return;
  }
  if (id.startsWith('lektion/')) {
    leaveModes();
    if (!openLesson(id.slice(8))) showLessons();
    return;
  }
  if (id === 'brett') {
    if (S.mode !== 'board') openBoard();
    return;
  }
  if (S.game && S.game.id === id) return;
  let cached = await db.get('games', id).catch(() => null);
  // Auf einem anderen Gerät analysiert? Dann die fertige Analyse vom gemeinsamen Speicher holen.
  if (!(cached && cached.game && cached.positions)) cached = (await fetchGame(id)) || cached;
  if (location.hash.slice(1) !== encodeURIComponent(id) && decodeURIComponent(location.hash.slice(1)) !== id) return;
  if (cached && cached.game && cached.positions) {
    startGame(cached.game, cached);
    return;
  }
  if (cached && cached.pgn) {
    // Aus einem Sicherungs-Code: Die Züge sind da, die Analyse wird neu berechnet.
    try {
      const game = gameFromPgn(cached.pgn);
      const meta = await db.get('meta', id).catch(() => null);
      game.id = id;
      if (meta) Object.assign(game, { url: meta.url || game.url, youHint: meta.you || undefined });
      startGame(game);
      return;
    } catch (e) { /* unten weiter: vielleicht lässt sich die Partie neu laden */ }
  }
  const m = id.match(/^(live|daily)-(\d+)$/);
  if (m) {
    try {
      await loadLink({ type: m[1], id: m[2] }, S.username);
    } catch (e) {
      reportLoadError(e);
    }
  }
}

/** Hält den Bildschirm während einer langen Analyse wach (wo der Browser das erlaubt). */
function keepAwake() {
  let lock = null;
  let released = false;
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').then((l) => { if (released) l.release(); else lock = l; }).catch(() => {});
  }
  return { release() { released = true; if (lock) lock.release().catch(() => {}); } };
}

/** Zeigt genau einen Hauptbereich: hub | home | lessons | review. */
function showMain(name) {
  for (const id of ['hub', 'home', 'lessons', 'profile', 'review']) $(id).hidden = id !== name;
  $('btn-new').hidden = $('btn-board').hidden = name === 'hub';
}

/** Räumt auf, bevor ein anderer Bereich geöffnet wird (Engine stoppen, Sondermodi beenden). */
function leaveModes() {
  if (S.pool) S.pool.cancel();
  S.pool = null;
  live.stop();
  S.live = null;
  S.mode = null;
  board.setEditor(null);
  board.setPicker(null);
  board.setInteractive(false);
  document.querySelector('.panel').classList.remove('is-editor');
  $('review').classList.remove('lesson-mode');
  for (const id of ['pane-editor', 'pane-lesson', 'pane-puzzle', 'pane-play', 'pane-training', 'pane-trainer']) $(id).hidden = true;
  $('coach').hidden = false;
  leavePuzzles();
  leavePlay();
  leaveTraining();
  leaveTrainers();
  S.game = S.review = S.variation = S.retry = S.annot = null;
}

/** Startseite mit allen Bereichen. */
function goHome(fromHash) {
  leaveModes();
  resumeNewQueue();
  S.view = 'hub';
  showMain('hub');
  setStatus('');
  renderHistory();
  renderHub();
  syncIfStale();
  if (fromHash !== true && location.hash) history.pushState(null, '', location.pathname + location.search);
  document.title = 'Chess Analyzer';
  window.scrollTo(0, 0);
}

function renderHub() {
  const { done, total, next } = lessonProgress();
  $('tile-prog').innerHTML = `<span>${done} von ${total} geschafft</span><div class="bar"><i style="width:${(done / total) * 100}%"></i></div>`;
  const pz = puzzleSummary();
  $('tile-puzzles').innerHTML = `<span>Wertung ${pz.rating} · ${pz.solved} gelöst</span>`;
  trainingSummary().then((t) => {
    $('tile-training').innerHTML = t.total ? `<span>${t.due} fällig · ${t.total} Karten</span>` : '<span>Füllt sich mit deinen Partien</span>';
  });
  const act = store.get('activity', {});
  const today = act[new Date().toISOString().slice(0, 10)] || {};
  const streak = dayStreak(act);
  $('tile-profile').innerHTML = `<span>${streak === 1 ? '1 Tag' : streak + ' Tage'} in Folge · heute ${today.puzzles || 0} Aufgaben</span>`;
  const tn = trainerSummary();
  $('tile-trainer').innerHTML = `<span>${tn.learned} von ${tn.total} Eröffnungen${tn.coords ? ` · Rekord ${tn.coords} Felder` : ''}</span>`;
  renderNewGames();
  checkNewGames();
  const cont = $('hub-continue');
  cont.hidden = !next || done === 0;
  if (next) cont.innerHTML = `<div><span>Weiter lernen</span><b>${esc(next.title)}</b></div>${uiIcon('arrow', 22)}`;
}

/** Seite „Partie analysieren“ (Link, Benutzername, PGN). */
function showAnalyze() {
  leaveModes();
  S.view = 'home';
  showMain('home');
  warmEngine();
  setStatus('');
  document.title = 'Partie analysieren · Chess Analyzer';
  window.scrollTo(0, 0);
}

function showLessons() {
  leaveModes();
  S.view = 'lessons';
  showMain('lessons');
  const { done, total } = lessonProgress();
  $('lessons-lead').textContent = done ? `${done} von ${total} Lektionen geschafft. Mach da weiter, wo du aufgehört hast.` : `${total} kurze Lektionen mit Aufgaben direkt auf dem Brett. Fang einfach vorn an.`;
  $('lessons-search').value = '';
  renderLessonList();
  document.title = 'Lektionen · Chess Analyzer';
  window.scrollTo(0, 0);
}

/** Bereitet die Brettansicht für eine Lektion vor (wird vom Lektions-Player aufgerufen). */
function enterLessonView(title) {
  S.mode = 'lesson';
  S.view = 'lesson';
  showMain('review');
  $('review').classList.add('lesson-mode');
  $('pane-progress').hidden = $('pane-overview').hidden = $('pane-moves').hidden = $('pane-editor').hidden = true;
  $('controls').hidden = true;
  $('pane-lesson').hidden = false;
  document.title = `${title} · Chess Analyzer`;
  window.scrollTo(0, 0);
}

/** Blendet alle Bereiche der Seitenleiste aus und zeigt nur den gewünschten (Brett ohne Bewertungsleiste). */
function soloPane(id, mode, title) {
  S.mode = mode;
  S.view = mode;
  showMain('review');
  $('review').classList.add('lesson-mode');
  for (const p of ['pane-progress', 'pane-overview', 'pane-moves', 'pane-editor', 'pane-lesson', 'pane-puzzle', 'pane-play', 'pane-training', 'pane-trainer']) $(p).hidden = p !== id;
  $('controls').hidden = true;
  document.title = `${title} · Chess Analyzer`;
  window.scrollTo(0, 0);
}

function enterPlayView() {
  soloPane('pane-play', 'play', 'Gegen den Computer');
}

/** Kurzfassung der Analyse als Text (zum Kopieren und Teilen). */
function summaryText() {
  const { game, review } = S;
  const sum = S.summary;
  const acc = (c) => (review.accuracy[c] == null ? '–' : review.accuracy[c].toFixed(1) + ' %');
  const lines = [
    `${game.white.name} – ${game.black.name}: ${game.result.replace('1/2-1/2', '½–½')}`,
    `Genauigkeit: ${game.white.name} ${acc('w')}, ${game.black.name} ${acc('b')}`,
  ];
  if (review.opening) lines.push(`Eröffnung: ${review.opening.name}`);
  lines.push([sum.text, sum.keyText].filter(Boolean).join(' '));
  for (const t of sum.tips) lines.push(`${t.who}: ${t.items.join(' ')}`);
  return lines.join('\n');
}

/** Zeichnet die aktuelle Stellung als Bild und lädt es herunter. */
async function boardPng() {
  const size = 960, sq = size / 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const t = THEMES[S.settings.theme] || THEMES.green;
  const flip = S.orientation === 'b';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    g.fillStyle = (r + f) % 2 ? t.dark : t.light;
    g.fillRect(f * sq, r * sq, sq, sq);
  }
  g.font = `700 ${sq * 0.17}px system-ui, sans-serif`;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? t.light : t.dark;
    g.fillText(String(flip ? i + 1 : 8 - i), 5, i * sq + sq * 0.2);
    g.fillStyle = i % 2 ? t.dark : t.light;
    g.fillText('abcdefgh'[flip ? 7 - i : i], i * sq + sq * 0.86, size - 6);
  }
  const pieces = [...Board.parseFen(currentFen())];
  await Promise.all(pieces.map(([square, code]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const f = square.charCodeAt(0) - 97, r = +square[1] - 1;
      g.drawImage(img, (flip ? 7 - f : f) * sq, (flip ? r : 7 - r) * sq, sq, sq);
      resolve();
    };
    img.onerror = resolve;
    img.src = `assets/pieces/${S.settings.pieces}/${code}.svg`;
  })));
  canvas.toBlob((blob) => blob && download(blob, 'stellung.png'), 'image/png');
}

/** Lädt eine Datei im Browser herunter. */
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Zählt Aktivität für Tagesziel und Statistik (pro Kalendertag). */
function bump(kind, info) {
  const day = new Date().toISOString().slice(0, 10);
  const act = store.get('activity', {});
  act[day] = act[day] || {};
  act[day][kind] = (act[day][kind] || 0) + 1;
  const days = Object.keys(act).sort();
  while (days.length > 120) delete act[days.shift()];
  store.set('activity', act);
  if (kind === 'played' && info && info.won) store.set('wins', Math.max(store.get('wins', 0), info.level));
}

/** Bereitet die Brettansicht für die Taktikaufgaben vor (wird vom Aufgaben-Modul aufgerufen). */
function enterPuzzleView() {
  S.mode = 'puzzle';
  S.view = 'puzzle';
  showMain('review');
  $('review').classList.add('lesson-mode');
  $('pane-progress').hidden = $('pane-overview').hidden = $('pane-moves').hidden = $('pane-editor').hidden = $('pane-lesson').hidden = true;
  $('controls').hidden = true;
  $('pane-puzzle').hidden = false;
  document.title = 'Taktikaufgaben · Chess Analyzer';
  window.scrollTo(0, 0);
}

/** Anmeldung: Abmelden-Knopf und „Passwort ändern“ nur zeigen, wenn die Seite geschützt läuft. */
/** Löscht den Stand dieses Geräts (beim Abmelden oder wenn sich ein anderes Konto anmeldet). */
async function wipeLocal() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('ca.')) localStorage.removeItem(key);
  } catch (e) { /* kein Speicher – nichts zu löschen */ }
  for (const s of ['games', 'meta', 'cards']) await db.clear(s).catch(() => {});
}

/**
 * Konto: Wer ist angemeldet? Davon hängt ab, wessen Stand auf diesem Gerät liegt und womit synchronisiert wird.
 * Ohne Konten (lokaler Start ohne Anmeldung, rein statisches Hosting) bleibt alles wie es ist – nur in diesem Browser.
 */
async function initAccount() {
  let status = null;
  try {
    const res = await fetch('api/auth/status', { cache: 'no-store' });
    if (res.ok) status = await res.json();
  } catch (e) { /* keine Anmeldung auf diesem Server oder kein Netz */ }
  if (!status || !status.accounts) {
    skipSync();
    return;
  }
  if (!status.authenticated) {
    // Die Anmeldung gilt nicht mehr (abgemeldet, gesperrt oder gelöscht): zurück zur Anmeldeseite.
    await clearOffline();
    location.reload();
    return;
  }
  const me = status.user;
  const lname = me.name.toLowerCase();
  let owner = null;
  try { owner = localStorage.getItem('ca.account'); } catch (e) { /* egal */ }
  if (owner && owner !== lname) {
    // Auf diesem Gerät liegt noch der Stand eines anderen Kontos – der darf nicht vermischt werden.
    await wipeLocal();
    try { localStorage.setItem('ca.account', lname); } catch (e) { /* egal */ }
    location.reload();
    return;
  }
  try { localStorage.setItem('ca.account', lname); } catch (e) { /* egal */ }
  S.account = me;
  const handle = me.site === 'lichess' ? me.lichess : me.site === 'chesscom' ? me.chesscom : '';
  if (!S.username && handle) {
    S.username = handle;
    S.site = me.site === 'lichess' ? 'lichess' : 'chesscom';
    store.set('username', S.username);
    store.set('site', S.site);
    $('user-input').value = S.username;
    $('site-input').value = S.site;
  }
  if (status.notice) {
    $('hub-notice').textContent = status.notice;
    $('hub-notice').hidden = false;
  }
  startSync();
  bindAccount();
  if (S.view === 'hub') checkNewGames();
}

function bindAccount() {
  const me = S.account;
  const post = (action, body) => fetch('api/auth/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).catch(() => null);
  const TEXT = { wrong: 'Das aktuelle Passwort stimmt nicht.', weak: 'Das neue Passwort braucht mindestens 8 Zeichen.', locked: 'Zu viele Versuche. Bitte warte ein paar Minuten.', handle: 'Bitte gib deinen Benutzernamen auf der gewählten Schachseite an.', site: 'Bitte wähle aus, wo du spielst.' };
  const fail = async (res) => (res ? TEXT[(await res.json().catch(() => ({}))).error] : null) || 'Das hat nicht geklappt.';
  $('btn-logout').hidden = false;
  $('acc-box').hidden = false;
  $('foot-legal').hidden = false;
  $('acc-name').innerHTML = `Angemeldet als <b>${esc(me.name)}</b>.`;
  $('acc-site').value = me.site;
  $('acc-chesscom').value = me.chesscom || '';
  $('acc-lichess').value = me.lichess || '';

  const leave = async () => {
    await wipeLocal();
    await clearOffline();
    location.href = location.pathname;
  };
  $('btn-logout').onclick = async () => {
    // Erst alles hochladen, dann den Stand von diesem Gerät entfernen – das nächste Konto fängt hier sauber an.
    const saved = await flushSync();
    if (!saved && !confirm('Deine letzten Änderungen konnten nicht gespeichert werden (kein Netz?). Wenn du dich jetzt abmeldest, gehen sie verloren. Trotzdem abmelden?')) return;
    await post('logout');
    await leave();
  };
  $('acc-save').onclick = async () => {
    const body = { site: $('acc-site').value, chesscom: $('acc-chesscom').value.trim(), lichess: $('acc-lichess').value.trim() };
    const res = await post('profile', body);
    if (!res || !res.ok) {
      $('acc-msg').textContent = await fail(res);
      return;
    }
    Object.assign(me, body);
    const handle = body.site === 'lichess' ? body.lichess : body.site === 'chesscom' ? body.chesscom : '';
    if (handle) {
      S.username = handle;
      S.site = body.site;
      store.set('username', S.username);
      store.set('site', S.site);
      $('user-input').value = S.username;
      $('site-input').value = S.site;
    }
    $('acc-msg').textContent = 'Gespeichert.';
  };
  $('pw-save').onclick = async () => {
    const res = await post('password', { current: $('pw-current').value, next: $('pw-next').value });
    if (res && res.ok) {
      $('pw-msg').textContent = 'Passwort geändert. Alle anderen Geräte wurden abgemeldet.';
      $('pw-current').value = $('pw-next').value = '';
    } else $('pw-msg').textContent = await fail(res);
  };
  $('pw-logout-all').onclick = async (e) => {
    const res = await post('logout-all');
    e.currentTarget.textContent = res && res.ok ? 'Erledigt – nur dieses Gerät ist noch angemeldet' : 'Das hat nicht geklappt';
  };
  $('acc-delete').onclick = async () => {
    const password = $('pw-current').value;
    if (!password) {
      $('pw-msg').textContent = 'Gib oben dein aktuelles Passwort ein, um das Konto zu löschen.';
      $('pw-current').focus();
      return;
    }
    if (!confirm(`Konto „${me.name}“ mit allen Partien, Statistiken und dem gesamten Fortschritt endgültig löschen?`)) return;
    const res = await post('delete', { password });
    if (res && res.ok) await leave();
    else $('pw-msg').textContent = await fail(res);
  };
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

/**
 * Rechnet alle Stellungen einer Partie durch – ohne Buchzüge und ohne Stellungen, die schon im Speicher liegen.
 */
/**
 * @param onProgress (fertig, gesamt, Index, Ergebnis) – nach jeder frisch gerechneten Stellung
 * @param onKnown    (Index, Ergebnis) – für Stellungen, die ohne Engine feststehen (Buch, Speicher)
 */
async function runEngine(game, book, depth, pool, onProgress, onKnown) {
  const known = {};
  // 1) Buchzüge brauchen keine Engine: Stellungen vor dem letzten Theoriezug überspringen
  const nBook = bookMoves(game, book);
  for (let i = 0; i < nBook; i++) known[i] = { lines: [], eval: { type: 'cp', value: 20 }, book: true };
  // 2) Stellungen, die schon einmal in dieser Tiefe gerechnet wurden, aus dem Speicher holen
  const keyOf = (fen) => `${fen.split(' ').slice(0, 4).join(' ')}|${depth}`;
  const hits = await db.getMany('evals', game.fens.map(keyOf)).catch(() => new Map());
  game.fens.forEach((fen, i) => {
    if (!known[i] && hits.has(keyOf(fen))) known[i] = hits.get(keyOf(fen));
  });
  if (onKnown) for (const [i, p] of Object.entries(known)) onKnown(+i, p);
  const positions = await pool.analyze(game.fens, { depth, known, onProgress });
  const fresh = [];
  positions.forEach((p, i) => {
    if (p.fresh) fresh.push([keyOf(game.fens[i]), { lines: p.lines.map((l) => ({ ...l, pv: l.pv.slice(0, 12) })), eval: p.eval }]);
  });
  db.setMany('evals', fresh).catch(() => {});
  return positions;
}

// ---------------------------------------------------------------------------
// Neue Partien: beim Öffnen der Startseite die eigenen letzten Partien prüfen und auf Wunsch
// nacheinander im Hintergrund analysieren (immer nur eine zur Zeit – so bleibt das Gerät bedienbar).
// ---------------------------------------------------------------------------

const NEW_CHECK_GAP = 10 * 60000;
const NEW_WINDOW = 3 * 86400000; // ohne Merker: Partien der letzten drei Tage
const NG = { key: '', checked: 0, checking: false, list: [], queue: [], done: new Set(), failed: new Set(), current: null, pool: null, busy: false, paused: false, error: '' };

const youOf = (game) => {
  const me = S.username.toLowerCase();
  return game.white.name.toLowerCase() === me ? 'w' : game.black.name.toLowerCase() === me ? 'b' : null;
};

async function checkNewGames(force = false) {
  if (!S.username || NG.checking) return;
  const key = `${S.site}:${S.username.toLowerCase()}`;
  if (!force && NG.key === key && Date.now() - NG.checked < NEW_CHECK_GAP) return;
  NG.checking = true;
  try {
    const entries = S.site === 'lichess' ? await fetchLichessGames(S.username, 15) : await fetchRecentGames(S.username, { months: 2, limit: 30 });
    const since = Math.max(Number(store.get('newseen', 0)) || 0, Date.now() - NEW_WINDOW);
    const fresh = [];
    for (const e of entries) {
      if (e.at <= since || fresh.length >= 10) continue;
      if (await db.get('meta', e.id).catch(() => null)) continue;
      fresh.push(e);
    }
    if (NG.key !== key) {
      NG.queue = [];
      NG.done = new Set();
      NG.failed = new Set();
    }
    NG.key = key;
    NG.checked = Date.now();
    NG.error = '';
    // Bereits im Hintergrund fertig gewordene Partien bleiben in der Liste (mit „Öffnen“)
    const keep = NG.list.filter((e) => NG.done.has(e.id) && !fresh.some((f) => f.id === e.id));
    NG.list = [...fresh, ...keep].sort((a, b) => b.at - a.at);
  } catch (e) {
    NG.error = 'failed'; // still: Die Startseite funktioniert auch ohne diese Liste
  } finally {
    NG.checking = false;
  }
  renderNewGames();
}

function renderNewGames() {
  const box = $('new-games');
  if (!box) return;
  const list = NG.list;
  if (!list.length || S.view !== 'hub') {
    box.hidden = true;
    return;
  }
  const site = S.site === 'lichess' ? 'Lichess' : 'chess.com';
  const open = list.filter((e) => !NG.done.has(e.id) && !NG.failed.has(e.id));
  const running = NG.busy && NG.current;
  const rows = list.map((e) => {
    const you = e.white.name.toLowerCase() === S.username.toLowerCase() ? 'w' : e.black.name.toLowerCase() === S.username.toLowerCase() ? 'b' : null;
    const opp = you === 'w' ? e.black : you === 'b' ? e.white : null;
    const res = !you || e.result === '1/2-1/2' ? 'draw' : (e.result === '1-0') === (you === 'w') ? 'win' : 'loss';
    const letter = { win: 'S', loss: 'N', draw: 'R' }[res];
    const who = opp ? `gegen ${esc(opp.name)}${opp.rating ? ` (${opp.rating})` : ''}` : `${esc(e.white.name)} – ${esc(e.black.name)}`;
    const when = new Date(e.at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    let status;
    if (NG.done.has(e.id)) status = `<button type="button" class="btn soft small" data-ng-open="${esc(e.id)}">✓ Öffnen</button>`;
    else if (NG.failed.has(e.id)) status = '<span class="ng-state" title="Diese Partie ließ sich nicht lesen (z. B. eine Schachvariante)">nicht lesbar</span>';
    else if (running && NG.current.id === e.id) status = `<span class="ng-state">${Math.round((NG.current.done / Math.max(1, NG.current.total)) * 100)} %</span>`;
    else if (NG.queue.some((q) => q.id === e.id)) status = '<span class="ng-state">wartet</span>';
    else status = `<button type="button" class="btn soft small" data-ng-now="${esc(e.id)}">Jetzt ansehen</button>`;
    return `<li><span class="game-res ${res}">${letter}</span><span class="ng-who">${who}<small>${esc(timeClassName(e.timeClass))} · ${esc(when)}</small></span>${status}</li>`;
  }).join('');
  const head = open.length
    ? `${open.length === 1 ? 'Eine neue Partie' : `${open.length} neue Partien`} auf ${site}`
    : NG.done.size ? 'Alle neuen Partien sind analysiert' : `Neue Partien auf ${site}`;
  let foot;
  if (running) {
    const pos = list.filter((e) => NG.done.has(e.id)).length + 1;
    foot = `<p class="hint">Analysiere im Hintergrund (${pos} von ${pos + NG.queue.length - 1}) – du kannst die Seite währenddessen ganz normal benutzen.</p>`;
  } else if (NG.queue.length && NG.paused) {
    foot = '<p class="hint">Pausiert, solange du eine andere Partie analysierst. Geht auf der Startseite automatisch weiter.</p>';
  } else foot = '';
  const actions = [];
  if (open.length > 1 && !NG.busy && !NG.queue.length) actions.push(`<button type="button" class="btn primary small" data-ng-all="1">Alle ${open.length} im Hintergrund analysieren</button>`);
  if (open.length === 1 && !NG.busy && !NG.queue.length) actions.push('<button type="button" class="btn primary small" data-ng-all="1">Im Hintergrund analysieren</button>');
  if (!NG.busy) actions.push(`<button type="button" class="btn ghost small" data-ng-hide="1">${open.length ? 'Ausblenden' : 'Fertig'}</button>`);
  box.hidden = false;
  box.innerHTML = `<header><b>${head}</b>${uiIcon('play', 18)}</header><ul class="ng-list">${rows}</ul>${foot}<div class="ng-actions">${actions.join('')}</div>`;
}

function enqueueNewGames() {
  for (const e of NG.list) if (!NG.done.has(e.id) && !NG.failed.has(e.id) && !NG.queue.some((q) => q.id === e.id)) NG.queue.push(e);
  NG.paused = false;
  runNewQueue();
}

function pauseNewQueue() {
  if (!NG.busy) return;
  NG.paused = true;
  if (NG.pool) NG.pool.cancel();
}

function resumeNewQueue() {
  if (!NG.paused) return;
  NG.paused = false;
  if (NG.queue.length) setTimeout(runNewQueue, 300);
}

async function runNewQueue() {
  if (NG.busy || NG.paused) return;
  NG.busy = true;
  renderNewGames();
  const wake = keepAwake();
  try {
    const book = await loadBook();
    while (NG.queue.length && !NG.paused) {
      const entry = NG.queue[0];
      if (await db.get('meta', entry.id).catch(() => null)) {
        NG.queue.shift();
        NG.done.add(entry.id);
        continue;
      }
      let game;
      try {
        game = entry.load();
      } catch (e) {
        NG.queue.shift();
        NG.failed.add(entry.id);
        continue;
      }
      const pool = new AnalysisPool();
      NG.pool = pool;
      NG.current = { id: entry.id, done: 0, total: 1 };
      renderNewGames();
      try {
        const depth = S.settings.depth;
        const positions = await runEngine(game, book, depth, pool, (done, total) => {
          if (!NG.current || NG.current.id !== entry.id) return;
          NG.current.done = done;
          NG.current.total = total;
          renderNewGames();
        });
        if (game.drawn) positions[positions.length - 1] = { lines: [], eval: { type: 'cp', value: 0 }, terminal: 'draw' };
        const review = reviewGame(game, positions, book, scale());
        await saveGame({ game, positions: review.positions, review, you: youOf(game) }, positions, depth);
        bump('games');
        NG.queue.shift();
        NG.done.add(entry.id);
        if (S.view === 'hub') renderHistory();
      } catch (e) {
        if (pool.cancelled) break; // pausiert – die Partie bleibt vorn in der Warteschlange
        NG.queue.shift();
        NG.failed.add(entry.id);
      } finally {
        NG.pool = null;
        NG.current = null;
      }
    }
  } finally {
    wake.release();
    NG.busy = false;
  }
  if (!NG.queue.length && document.hidden) playSound('end');
  renderNewGames();
}

/** Analysiert die letzten Partien des Nutzers nacheinander im Hintergrund (für das Schwächenprofil). */
async function batchAnalyze(n, report) {
  const entries = S.site === 'lichess' ? await fetchLichessGames(S.username, n * 3) : await fetchRecentGames(S.username, { months: 4, limit: 200 });
  const book = await loadBook();
  const me = S.username.toLowerCase();
  const list = [];
  for (const e of entries) {
    if (list.length >= n) break;
    if (await db.get('meta', e.id)) continue;
    try {
      list.push(e.load());
    } catch (err) { /* Varianten überspringen */ }
  }
  if (!list.length) {
    report(1, 1, 'Deine letzten Partien sind schon alle analysiert.');
    return;
  }
  let done = 0;
  for (const game of list) {
    if (!report(done, list.length, `Partie ${done + 1} von ${list.length}: ${game.white.name} – ${game.black.name}`)) break;
    const depth = S.settings.depth;
    const positions = await runEngine(game, book, depth, new AnalysisPool(), null);
    if (game.drawn) positions[positions.length - 1] = { lines: [], eval: { type: 'cp', value: 0 }, terminal: 'draw' };
    const review = reviewGame(game, positions, book, scale());
    const you = game.white.name.toLowerCase() === me ? 'w' : game.black.name.toLowerCase() === me ? 'b' : null;
    await saveGame({ game, positions: review.positions, review, you }, positions, depth);
    bump('games');
    done++;
  }
  report(done, list.length, `${done} Partien analysiert.`);
}

async function loadBook() {
  if (!S.book) {
    try {
      S.book = await (await fetch('data/openings.json')).json();
    } catch (e) {
      S.book = null;
    }
  }
  return S.book;
}

async function startGame(game, cached) {
  pauseNewQueue(); // die eigene Analyse hat Vorrang vor der Hintergrund-Analyse neuer Partien
  if (S.pool) S.pool.cancel();
  live.stop();
  leaveModes();
  S.game = game;
  S.mode = 'game';
  $('board-tools').hidden = true;
  $('ctl-overview').hidden = $('ctl-key').hidden = false;
  $('graph-moves').parentElement.hidden = false;
  S.review = null;
  S.variation = S.retry = null;
  S.ply = 0;
  S.view = 'analyzing';
  const me = S.username.toLowerCase();
  S.you = game.youHint || (!me ? null : game.white.name.toLowerCase() === me ? 'w' : game.black.name.toLowerCase() === me ? 'b' : null);
  S.orientation = S.you === 'b' ? 'b' : 'w';
  board.setOrientation(S.orientation);

  showMain('review');
  $('pane-overview').hidden = $('pane-moves').hidden = $('controls').hidden = true;
  $('pane-progress').hidden = false;
  $('progress-fill').style.width = '0%';
  $('progress-label').textContent = 'Engine wird geladen …';
  document.title = `${game.white.name} – ${game.black.name} · Chess Analyzer`;
  if (location.hash.slice(1) !== game.id) history.pushState(null, '', '#' + encodeURIComponent(game.id));
  window.scrollTo(0, 0);

  board.setInteractive(false);
  board.setPosition(game.fens[0], { animate: false });
  board.setDecor({});
  renderPlayers();
  renderEvalBar({ type: 'cp', value: 0 });
  setCoach({
    title: 'Ich schaue mir die Partie an …',
    paragraphs: ['Stockfish rechnet jede Stellung durch. Das dauert meist nur ein paar Sekunden.'],
  });
  loadAvatars(game);

  const book = await loadBook();
  if (S.game !== game) return;
  let positions;
  // Gespeicherte Analyse nur verwenden, wenn sie mindestens so tief gerechnet wurde wie jetzt eingestellt
  // (Ein geteilter Link bringt seine Analyse mit und wird immer so übernommen.)
  if (cached && cached.positions.length === game.fens.length && ((cached.depth || 0) >= S.settings.depth || cached.shared)) {
    positions = cached.positions;
  } else {
    const pool = new AnalysisPool();
    S.pool = pool;
    let shown = 0;
    const wake = keepAwake();
    // Live-Vorschau: Bewertungsverlauf und vorläufige Genauigkeit füllen sich, während gerechnet wird
    const liveEvals = new Array(game.fens.length);
    let drawTimer = null;
    const drawLive = () => {
      if (drawTimer) return;
      drawTimer = setTimeout(() => {
        drawTimer = null;
        if (S.pool === pool) renderLivePreview(game, liveEvals);
      }, 180);
    };
    $('progress-live').hidden = true;
    try {
      positions = await runEngine(game, book, S.settings.depth, pool, (done, total, index, result) => {
        if (S.pool !== pool) return;
        $('progress-fill').style.width = `${(done / total) * 100}%`;
        $('progress-label').textContent = `Analysiere Stellung ${done} von ${total} …`;
        if (result) liveEvals[index] = result.eval;
        drawLive();
        if (index > shown) {
          shown = index;
          board.setPosition(game.fens[index]);
        }
      }, (index, result) => { liveEvals[index] = result.eval; });
    } catch (e) {
      wake.release();
      if (S.pool !== pool) return; // abgebrochen
      console.error(e);
      setCoach({
        title: 'Die Engine konnte nicht starten',
        paragraphs: ['Stockfish ließ sich in diesem Browser nicht laden. Bitte lade die Seite neu oder probiere einen aktuellen Browser.'],
      });
      $('progress-label').textContent = String(e.message || e);
      return;
    }
    wake.release();
    if (S.pool !== pool) return;
    S.pool = null;
    cached = null;
    bump('games');
    if (document.hidden) playSound('end');
  }
  // Remis durch Stellungswiederholung oder 50-Züge-Regel: Die Schlussstellung ist remis, egal was die Engine meint
  if (game.drawn) positions[positions.length - 1] = { lines: [], eval: { type: 'cp', value: 0 }, terminal: 'draw' };
  if (S.game !== game) return;
  const annot = await loadAnnot(game);
  if (S.game !== game) return;
  S.annot = annot;
  S.noteOpen = null;
  S.book = book;
  S.rawPositions = positions; // unverändert – für erneutes Bewerten (Strenge) und den Teilen-Link
  S.analysisDepth = (cached && cached.depth) || S.settings.depth;
  S.review = reviewGame(game, positions, book, scale());
  buildMoveList();
  showOverview();
  saveGame(ctx(), positions, (cached && cached.depth) || S.settings.depth).catch((e) => console.error(e));
  if (NG.list.some((e) => e.id === game.id)) NG.done.add(game.id);
}

async function loadAvatars(game) {
  if (!game.url || !/chess\.com/.test(game.url)) return;
  for (const side of ['white', 'black']) {
    if (game[side].avatar) continue;
    fetchAvatar(game[side].name).then((url) => {
      if (url && S.game === game) {
        game[side].avatar = url;
        renderPlayers();
        if (S.view === 'overview') renderOverview();
      }
    });
  }
}

const ctx = () => ({ game: S.game, positions: S.review.positions, review: S.review, you: S.you });

// ---------------------------------------------------------------------------
// Ansichten
// ---------------------------------------------------------------------------

function showOverview() {
  live.stop();
  S.view = 'overview';
  S.variation = S.retry = null;
  $('pane-progress').hidden = $('pane-moves').hidden = true;
  $('pane-overview').hidden = false;
  $('controls').hidden = true;
  S.ply = S.game.moves.length;
  board.setInteractive(false);
  S.summary = summarize(ctx());
  renderOverview();
  renderBoard(false);
  renderPlayers();
  renderEvalBar(S.review.evals[S.ply]);
  const sum = S.summary;
  const actions = sum.keyPly ? [{ label: 'Zum Wendepunkt', icon: 'star', run: () => { showMoves(); go(sum.keyPly); } }] : [];
  const paragraphs = [sum.text, sum.keyText].filter(Boolean);
  if (!S.you) {
    paragraphs.push('Welche Seite warst du? Dann erkläre ich alles aus deiner Sicht.');
    actions.push({ label: `Ich war ${short(S.game.white.name)}`, run: () => setYou('w') });
    actions.push({ label: `Ich war ${short(S.game.black.name)}`, run: () => setYou('b') });
  }
  setCoach({ title: 'Partie analysiert!', paragraphs, actions });
}

const short = (name) => (name.length > 16 ? name.slice(0, 15) + '…' : name);

/** Merkt sich, welche Seite der Nutzer gespielt hat – der Coach spricht ihn dann direkt an. */
function setYou(color) {
  S.you = color;
  const p = color === 'w' ? S.game.white : S.game.black;
  if (S.game.url && /chess\.com/.test(S.game.url)) {
    S.username = p.name;
    store.set('username', p.name);
    $('user-input').value = p.name;
  }
  S.orientation = color;
  board.setOrientation(color);
  S.review.diag = null;
  showOverview();
  db.get('games', S.game.id).then((g) => g && saveGame(ctx(), g.positions, g.depth)).catch(() => {});
}

function showMoves() {
  S.view = 'moves';
  $('pane-progress').hidden = $('pane-overview').hidden = true;
  $('pane-moves').hidden = false;
  $('controls').hidden = false;
  board.setInteractive(true);
}

function avatarHtml(p) {
  const letter = esc((p.name || '?')[0].toUpperCase());
  const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span class="avatar">${letter}${img}</span>`;
}

function renderOverview() {
  const { game, review } = S;
  const acc = (c, p) => `<div class="acc ${c}">${avatarHtml(p)}<div style="min-width:0">
      <div class="acc-name">${esc(p.name)}</div>
      <div class="acc-val">${review.accuracy[c] == null ? '–' : review.accuracy[c].toFixed(1)}<small>Genauigkeit</small></div></div></div>`;
  $('acc-row').innerHTML = acc('w', game.white) + acc('b', game.black);
  $('counts').innerHTML = CLASS_ORDER.map((c) => {
    const w = review.counts.w[c], b = review.counts.b[c];
    const color = CLASSES[c].color;
    return `<tr><td class="n ${w ? '' : 'zero'}" style="color:${color}">${w}</td>
      <td class="ico">${classIcon(c, 20)}</td><td class="lbl">${CLASSES[c].label}</td>
      <td class="n ${b ? '' : 'zero'}" style="color:${color}">${b}</td></tr>`;
  }).join('');
  const sum = S.summary;
  const phaseRows = sum.phases.filter((r) => r.w || r.b);
  $('phases').innerHTML = phaseRows.length ? `<h3>Partiephasen</h3><table class="counts">${phaseRows.map((r) =>
    `<tr><td class="n">${r.w ? classIcon(r.w, 20) : '–'}</td><td class="pct">${r.wAcc == null ? '' : r.wAcc.toFixed(0) + ' %'}</td><td class="lbl mid">${r.name}</td><td class="pct">${r.bAcc == null ? '' : r.bAcc.toFixed(0) + ' %'}</td><td class="n">${r.b ? classIcon(r.b, 20) : '–'}</td></tr>`).join('')}</table>` : '';
  renderTimeBox();
  $('ov-actions').innerHTML = [['summary', 'Fazit kopieren'], ['pgn', 'PGN herunterladen'], ['share', 'Link mit Analyse kopieren'], ['png', 'Brett als Bild']]
    .map(([act, label]) => `<button type="button" class="btn soft small" data-act="${act}">${label}</button>`).join('');
  $('moments').innerHTML = sum.moments.length ? `<h3>Schlüsselmomente</h3><div class="moment-list">${sum.moments.map((m) =>
    `<button type="button" class="moment" data-ply="${m.ply}">${classIcon(m.cls, 18)}<b>${esc(m.label)}</b><span>${CLASSES[m.cls].label}</span></button>`).join('')}</div>` : '';
  $('tips').innerHTML = sum.tips.map((t) =>
    `<h3>${S.you ? esc(t.who) : 'Lernpunkte · ' + esc(t.who)}</h3><ul class="tip-list">${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
  const op = review.opening ? review.opening.name : game.openingHint;
  $('opening-line').innerHTML = (op ? `Eröffnung: <b>${esc(op)}</b>` : '')
    + (game.date ? `${op ? ' · ' : ''}${esc(game.date.split('-').reverse().join('.'))}` : '')
    + (game.timeClass ? ` · ${timeClassName(game.timeClass)}` : '');
  renderGraphs();
}

const fmtSec = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} min` : `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} s`);

/** Zeitmanagement in der Übersicht: Durchschnitt, längstes Nachdenken, Zeitnot, vorschnelle Fehler. */
function renderTimeBox() {
  const { game, review } = S;
  const items = [];
  for (const c of S.you ? [S.you] : ['w', 'b']) {
    const r = timeReport(game, review, c);
    if (!r) continue;
    const who = S.you ? 'Du' : esc(c === 'w' ? game.white.name : game.black.name);
    const num = (k) => Math.floor(k / 2) + 1;
    items.push(`${who}: im Schnitt ${fmtSec(r.avg)} pro Zug, am längsten bei Zug ${num(r.longest.k)} (${fmtSec(r.longest.sec)}).`);
    if (r.trouble) items.push(`${who}: Zeitnot ab Zug ${num(r.troubleFrom)} – ${r.trouble} Züge mit weniger als ${fmtSec(r.limit)} auf der Uhr${r.troubleErrors ? `, dabei ${r.troubleErrors} grobe Fehler` : ''}.`);
    if (r.fastErrors) items.push(`${who}: ${r.fastErrors} grobe Fehler blitzschnell gezogen, obwohl genug Zeit da war.`);
  }
  $('timebox').innerHTML = items.length ? `<h3>Zeiteinteilung</h3><ul class="time-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function currentFen() {
  if (S.retry) return S.retry.shownFen || S.game.fens[S.retry.k];
  const v = S.variation;
  if (v) return v.idx === 0 ? S.game.fens[v.basePly] : v.moves[v.idx - 1].fen;
  return S.game.fens[S.ply];
}

function currentEval() {
  const v = S.variation;
  if (S.retry) return S.review.evals[S.retry.k];
  if (!v || (v.idx === 0 && S.mode !== 'board')) return S.review.evals[v ? v.basePly : S.ply];
  if (S.live && S.live.fen === currentFen()) {
    if (S.live.terminal) return S.live.terminal.eval;
    if (S.live.lines[0]) return S.live.lines[0].eval;
  }
  for (let i = v.idx; i >= 0; i--) if (v.evals[i]) return v.evals[i];
  return { type: 'cp', value: 0 };
}

function soundFor(m) {
  if (/#/.test(m.san)) return 'end';
  if (/\+/.test(m.san)) return 'check';
  if (m.captured) return 'capture';
  if (/^O-O/.test(m.san)) return 'castle';
  return 'move';
}

function go(ply, { sound = false } = {}) {
  if (S.view !== 'moves') showMoves();
  const n = S.game.moves.length;
  const old = S.ply;
  live.stop();
  S.live = null;
  S.variation = S.retry = null;
  S.ply = Math.max(0, Math.min(n, ply));
  if (sound && S.ply === old + 1) playSound(soundFor(S.game.moves[S.ply - 1]));
  render();
}

function next() {
  if (S.mode === 'board') {
    boardGo(S.variation.idx + 1, true);
    return;
  }
  if (S.retry) return;
  const v = S.variation;
  if (v) {
    if (v.source === 'why') v.paused = true;
    if (v.idx < v.moves.length) {
      v.idx++;
      playSound(soundFor(v.moves[v.idx - 1]));
      startLive();
      render();
    }
    return;
  }
  if (S.ply < S.game.moves.length) go(S.ply + 1, { sound: true });
}

function prev() {
  if (S.mode === 'board') {
    boardGo(S.variation.idx - 1);
    return;
  }
  if (S.retry) {
    go(S.retry.k + 1);
    return;
  }
  const v = S.variation;
  if (v && v.source === 'why') {
    v.paused = true;
    if (v.idx > 0) {
      v.idx--;
      startLive();
      render();
    } else {
      go(v.returnPly);
    }
    return;
  }
  if (v) {
    if (v.idx > 1) {
      v.idx--;
      startLive();
      render();
    } else {
      go(v.basePly);
    }
    return;
  }
  go(S.ply - 1);
}

const KEY_CLASSES = new Set(['brilliant', 'great', 'mistake', 'miss', 'blunder']);

/** Springt zum nächsten Schlüsselmoment (Fehler, verpasste Chance, starker Zug). */
function nextKey() {
  const n = S.game.moves.length;
  const from = S.retry ? S.retry.k + 1 : S.variation ? S.variation.returnPly : S.ply;
  for (let k = from; k < n; k++) {
    if (KEY_CLASSES.has(S.review.moves[k].cls)) {
      go(k + 1);
      return;
    }
  }
  go(n);
}

/** Springt zum vorherigen Schlüsselmoment. */
function prevKey() {
  const from = S.retry ? S.retry.k + 1 : S.variation ? S.variation.returnPly : S.ply;
  for (let k = from - 2; k >= 0; k--) {
    if (KEY_CLASSES.has(S.review.moves[k].cls)) {
      go(k + 1);
      return;
    }
  }
  go(0);
}

function toggleOnlyBad() {
  const on = !$('moves').classList.contains('only-bad');
  $('moves').classList.toggle('only-bad', on);
  $('mt-bad').classList.toggle('on', on);
  highlightMove();
}

/**
 * „Was droht?“ – die Engine darf für die Seite ziehen, die gerade NICHT am Zug ist.
 * So sieht man, was passiert, wenn man die Drohung ignoriert.
 */
async function showThreat() {
  if (S.view !== 'moves' || (S.mode !== 'game' && S.mode !== 'board')) return;
  const fen = currentFen();
  if (S.threat && S.threat.fen === fen) {
    S.threat = null;
    renderTools();
    board.setDecor(boardDecor());
    return;
  }
  const flipped = new Chess(fen).isGameOver() ? null : flipTurn(fen);
  const t = { fen, busy: !!flipped, text: flipped ? 'Die Engine sucht die Drohung …' : 'Hier gibt es nichts zu drohen: Die Seite am Zug steht im Schach oder die Partie ist vorbei.' };
  S.threat = t;
  renderTools();
  if (!flipped) return;
  threatEngine = threatEngine || new EnginePlayer();
  let lines = [];
  try {
    lines = await threatEngine.lines(flipped, { depth: 14, multipv: 1 });
  } catch (e) { /* unten als „nichts gefunden“ behandelt */ }
  if (S.threat !== t) return;
  t.busy = false;
  const mv = lines[0] ? pvToMoves(flipped, lines[0].pv, 1)[0] : null;
  const who = SIDE[flipped.split(' ')[1]];
  if (!mv) t.text = 'Keine Drohung gefunden.';
  else {
    t.move = mv;
    const mate = lines[0].eval.type === 'mate';
    const taken = { p: 'einen Bauern', n: 'einen Springer', b: 'einen Läufer', r: 'einen Turm', q: 'die Dame' }[mv.captured];
    const what = /#/.test(mv.san) ? ' – das wäre Matt!' : mate ? ' – mit Mattangriff!' : taken ? ` und schlägt ${taken}.` : /\+/.test(mv.san) ? ' mit Schach.' : '. Eine direkte Drohung ist das nicht.';
    t.text = `Ohne Gegenwehr spielt ${who} **${sanDe(mv.san)}**${what}`;
  }
  renderTools();
  board.setDecor(boardDecor());
}

/** Rechnet die aktuelle Partiestellung deutlich tiefer nach (nur auf Wunsch, kostet Zeit). */
function deepen() {
  if (S.mode !== 'game' || S.view !== 'moves' || S.variation || S.retry) return;
  const fen = currentFen();
  if (S.live && S.live.deep && S.live.fen === fen) {
    live.stop();
    S.live = null;
    render();
    return;
  }
  const state = { fen, lines: [], terminal: null, deep: true };
  S.live = state;
  let timer = null;
  live.analyze(fen, {
    depth: 26,
    onUpdate: (lines, terminal) => {
      if (S.live !== state) return;
      state.lines = lines;
      state.terminal = terminal;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (S.live === state) { renderLines(); renderTools(); }
        }, 200);
      }
    },
  });
  renderTools();
}

function renderTools() {
  const game = S.mode === 'game';
  $('mv-tools').hidden = S.mode !== 'game' && S.mode !== 'board';
  $('mt-bad').hidden = !game;
  $('mt-deep').hidden = !game || !!S.variation || !!S.retry;
  const deep = S.live && S.live.deep && S.live.fen === currentFen();
  $('mt-deep').classList.toggle('on', !!deep);
  $('mt-deep').textContent = deep ? 'Tiefer rechnen: stoppen' : 'Tiefer rechnen';
  const t = S.threat && S.threat.fen === currentFen() ? S.threat : null;
  if (!t) S.threat = null;
  $('mt-threat').classList.toggle('on', !!t);
  // Notiz zur aktuellen Stellung (nur in der Partie selbst, nicht in Varianten)
  const canNote = game && !S.variation && !S.retry && !!S.annot && S.view === 'moves';
  const note = canNote ? S.annot.notes[S.ply] || '' : '';
  const noteOpen = canNote && (!!note || S.noteOpen === S.ply);
  $('mt-note').hidden = !canNote;
  $('mt-note').classList.toggle('on', noteOpen);
  $('note-box').hidden = !noteOpen;
  if (noteOpen && document.activeElement !== $('note-text')) $('note-text').value = note;
  $('mv-note').hidden = !t;
  $('mv-note').innerHTML = t ? (t.busy ? '<span class="spinner"></span> ' : '') + md(t.text) : '';
}

function flip() {
  S.orientation = S.orientation === 'w' ? 'b' : 'w';
  board.setOrientation(S.orientation);
  renderPlayers();
  renderEvalBar(currentEval());
}

// ---------------------------------------------------------------------------
// Eigene Züge, Varianten, Live-Engine
// ---------------------------------------------------------------------------

function legalTargets(square) {
  if (S.mode === 'lesson') return lessonTargets(square);
  if (S.mode === 'puzzle') return puzzleTargets(square);
  if (S.mode === 'play') return playTargets(square);
  if (S.mode === 'training') return trainingTargets(square);
  if (S.mode === 'trainer') return trainerTargets(square);
  if (S.view !== 'moves') return [];
  if (S.retry && S.retry.state !== 'waiting') return [];
  const chess = new Chess(currentFen());
  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return [];
  return chess.moves({ square, verbose: true }).map((m) => ({ to: m.to, promotion: m.promotion }));
}

function toMove(m, fen) {
  return {
    san: m.san, uci: m.from + m.to + (m.promotion || ''), from: m.from, to: m.to, color: m.color,
    piece: m.piece, captured: m.captured || null, promotion: m.promotion || null, fen,
  };
}

function onUserMove({ from, to, promotion }) {
  if (S.mode === 'lesson') {
    lessonMove({ from, to, promotion });
    return;
  }
  if (S.mode === 'puzzle') {
    puzzleMove({ from, to, promotion });
    return;
  }
  if (S.mode === 'play') {
    playMove({ from, to, promotion });
    return;
  }
  if (S.mode === 'training') {
    trainingMove({ from, to, promotion });
    return;
  }
  if (S.mode === 'trainer') {
    trainerMove({ from, to, promotion });
    return;
  }
  const fen = currentFen();
  const chess = new Chess(fen);
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch (e) {
    board.setPosition(fen, { animate: false });
    return;
  }
  const mv = toMove(m, chess.fen());
  if (S.retry) {
    retryMove(mv);
    return;
  }
  const v = S.variation;
  if (!v && S.ply < S.game.moves.length && S.game.moves[S.ply].uci === mv.uci) {
    go(S.ply + 1, { sound: true });
    return;
  }
  if (v && v.idx < v.moves.length && v.moves[v.idx].uci === mv.uci) {
    next();
    return;
  }
  if (!v) {
    S.variation = { basePly: S.ply, returnPly: S.ply, moves: [], idx: 0, source: 'user', evals: [S.review.evals[S.ply]], lines: [], judged: [] };
  }
  const cur = S.variation;
  if (cur.source === 'why') {
    // Eigener Zug während „Zeig mir warum“: Vorspielen anhalten, ab hier ist es eine eigene Variante
    cur.paused = true;
    clearTimeout(whyTimer);
  }
  if (cur.source !== 'board') cur.source = 'user';
  cur.moves.length = cur.idx;
  cur.evals.length = cur.idx + 1;
  cur.lines.length = cur.idx + 1;
  cur.judged.length = cur.idx + 1;
  cur.moves.push(mv);
  cur.idx++;
  playSound(soundFor(mv));
  startLive();
  render();
  if (S.mode === 'board') saveBoard();
}

/** Spielt eine Engine-Linie der aktuellen Stellung als Variante an. */
function playLine(i) {
  if (S.retry) return;
  const fen = currentFen();
  const lines = currentLines();
  if (!lines[i]) return;
  const moves = pvToMoves(fen, lines[i].pv, 12);
  if (!moves.length) return;
  const v = S.variation;
  if (v) {
    v.moves.length = v.idx;
    v.evals.length = v.idx + 1;
    v.lines.length = v.idx + 1;
    v.judged.length = v.idx + 1;
    v.moves.push(...(S.mode === 'board' ? moves.slice(0, 1) : moves));
    v.idx++;
    if (v.source !== 'board') v.source = 'user';
  } else {
    S.variation = { basePly: S.ply, returnPly: S.ply, moves, idx: 1, source: 'user', evals: [S.review.evals[S.ply]], lines: [], judged: [] };
  }
  playSound(soundFor(moves[0]));
  startLive();
  render();
  if (S.mode === 'board') saveBoard();
}

function showBest(k) {
  const best = S.review.positions[k].lines[0];
  if (!best) return;
  const moves = pvToMoves(S.game.fens[k], best.pv, 12);
  if (!moves.length) return;
  live.stop();
  S.retry = null;
  S.variation = { basePly: k, returnPly: k + 1, moves, idx: 0, source: 'best', evals: [S.review.evals[k]], lines: [], judged: [], intro: true };
  render();
  const v = S.variation;
  setTimeout(() => {
    if (S.variation !== v || v.idx !== 0) return;
    v.intro = false;
    v.idx = 1;
    playSound(soundFor(moves[0]));
    startLive();
    render();
  }, 650);
}

// ---------------------------------------------------------------------------
// „Zeig mir warum“: die entscheidende Fortsetzung Zug für Zug vorspielen
// ---------------------------------------------------------------------------

const WHY_KINDS = { inaccuracy: 'punish', mistake: 'punish', blunder: 'punish', miss: 'missed', brilliant: 'works', great: 'works' };

/** Welche Zugfolge erklärt Zug k? null, wenn es für diese Bewertung nichts vorzuspielen gibt. */
function whyLine(k) {
  const kind = WHY_KINDS[S.review.moves[k].cls];
  if (!kind) return null;
  const base = kind === 'missed' ? k : k + 1; // verpasste Chance: was stattdessen ging; sonst: was danach passiert
  const best = S.review.positions[base] && S.review.positions[base].lines[0];
  if (!best) return null;
  const mate = best.eval.type === 'mate';
  const moves = pvToMoves(S.game.fens[base], best.pv, mate ? 9 : 6);
  return moves.length ? { kind, base, moves, eval: best.eval } : null;
}

let whyTimer = null;
function showWhy(k) {
  const line = whyLine(k);
  if (!line) return;
  live.stop();
  S.retry = null;
  const v = {
    basePly: line.base, returnPly: k + 1, moves: line.moves, idx: 0, source: 'why', k, kind: line.kind, lineEval: line.eval,
    evals: [S.review.evals[line.base]], lines: [], judged: [], paused: false,
  };
  S.variation = v;
  render();
  playWhy(v, 900);
}

function playWhy(v, delay = 1250) {
  clearTimeout(whyTimer);
  v.paused = false;
  const step = () => {
    if (S.variation !== v || v.paused) return;
    if (v.idx >= v.moves.length) {
      render();
      return;
    }
    v.idx++;
    playSound(soundFor(v.moves[v.idx - 1]));
    startLive();
    render();
    if (v.idx < v.moves.length) whyTimer = setTimeout(step, 1250);
  };
  whyTimer = setTimeout(step, delay);
}

function renderWhyCoach(v) {
  const { game, review } = S;
  const k = v.k;
  const played = game.moves[k];
  const cls = review.moves[k].cls;
  const san = sanDe(played.san);
  const mover = played.color;
  const other = mover === 'w' ? 'b' : 'w';
  const done = v.idx >= v.moves.length;
  const title = v.kind === 'missed' ? `Diese Chance hat ${san} verpasst` : `Darum ist ${san} ${CLASSES[cls].noun}`;
  const paragraphs = [];
  if (v.idx === 0) {
    if (v.kind === 'punish') paragraphs.push(S.you === other ? 'Schau, wie du den Zug bestrafen kannst.' : `Schau, wie ${SIDE[other]} den Zug bestrafen kann.`);
    else if (v.kind === 'missed') paragraphs.push(`Statt ${san} ging **${sanDe(v.moves[0].san)}**. Schau, wohin das geführt hätte.`);
    else paragraphs.push('Schau, was nach dem Zug passiert – die Engine zeigt die beste Fortsetzung für beide Seiten.');
  } else {
    const fen = game.fens[v.basePly];
    paragraphs.push(`**${lineText(fen, v.moves.slice(0, v.idx))}**`);
    const m = v.moves[v.idx - 1];
    const before = v.idx === 1 ? fen : v.moves[v.idx - 2].fen;
    const prevMove = v.idx === 1 ? (v.kind === 'missed' ? (k > 0 ? game.moves[k - 1] : null) : played) : v.moves[v.idx - 2];
    const what = describeMove(before, m, prevMove, v.basePly + v.idx - 1);
    if (what) paragraphs.push(`${say(ctx(), m.color, what)}.`);
  }
  if (done) {
    const endFen = v.moves[v.moves.length - 1].fen;
    const last = v.moves[v.moves.length - 1];
    // Fazit: zuerst die Bewertung, Material nur, wenn es zur Bewertung passt.
    // Verglichen wird mit der Stellung VOR dem besprochenen Zug, aus Sicht dessen, der ihn gemacht hat.
    const sign = mover === 'w' ? 1 : -1;
    const change = sign * (materialInfo(endFen).diff - materialInfo(game.fens[k]).diff);
    const pts = Math.abs(change);
    const unit = pts === 1 ? 'einen Bauern' : `${pts} Bauerneinheiten`;
    const ev = v.lineEval;
    const evText = `Bewertung: **${evalText(ev)}**.`;
    const myWin = mover === 'w' ? winPct(ev) : 100 - winPct(ev);
    const mateFor = ev.type === 'mate' ? (ev.value > 0 ? 'w' : 'b') : null;
    const mated = last.color === 'w' ? 'b' : 'w';
    // Verb passend zur Person: „du stehst“ / „Weiß steht“
    const v2 = (c, du, er) => (S.you === c ? `${du} du` : `${er} ${SIDE[c]}`);
    let end;
    if (/#/.test(last.san)) end = S.you === mated ? 'Am Ende bist du matt.' : `Am Ende ist ${SIDE[mated]} matt.`;
    else if (mateFor) end = v.kind === 'missed' ? `Das wäre auf ein Matt für ${SIDE[mateFor]} hinausgelaufen.` : `Das läuft auf ein Matt für ${SIDE[mateFor]} hinaus.`;
    else if (v.kind === 'missed') {
      end = change > 0
        ? `Unterm Strich ${S.you === mover ? 'hättest du' : `hätte ${SIDE[mover]}`} ${unit} gewonnen. ${evText}`
        : `Die Stellung wäre deutlich besser gewesen: Bewertung **${evalText(ev)}** statt ${evalText(S.review.evals[k + 1])}.`;
    } else if (v.kind === 'punish') {
      if (change <= -1) end = `Unterm Strich ${v2(mover, 'verlierst', 'verliert')} ${unit}. ${evText}`;
      else if (change >= 1) end = `Zwar ${v2(mover, 'gewinnst', 'gewinnt')} dabei Material, die Stellung ist aber trotzdem schlechter. ${evText}`;
      else end = `Das Material bleibt gleich, aber ${v2(mover, 'stehst', 'steht')} danach schlechter. ${evText}`;
    } else if (change <= -1 && myWin >= 50) {
      end = `Obwohl ${S.you === mover ? `du ${unit} weniger hast` : `${SIDE[mover]} ${unit} weniger hat`}, ${v2(mover, 'stehst', 'steht')} danach besser – darum ist der Zug so stark. ${evText}`;
    } else if (change >= 1) end = `Am Ende ${v2(mover, 'gewinnst', 'gewinnt')} ${unit}. ${evText}`;
    else if (myWin >= 50) end = `Damit ${v2(mover, 'stehst', 'steht')} danach besser. ${evText}`;
    else end = `Das hält die Stellung zusammen – jeder andere Zug wäre schlechter gewesen. ${evText}`;
    paragraphs.push(end.charAt(0).toUpperCase() + end.slice(1));
  }
  const n = game.moves.length;
  const actions = [];
  if (done) actions.push({ label: 'Nochmal', icon: 'retry', run: () => showWhy(k) });
  else if (v.paused) actions.push({ label: 'Abspielen', icon: 'play', run: () => { playWhy(v, 200); render(); } });
  else actions.push({ label: 'Anhalten', run: () => { v.paused = true; clearTimeout(whyTimer); render(); } });
  actions.push({ label: 'Zurück zur Partie', icon: 'back', run: () => go(v.returnPly) });
  actions.push({ label: 'Weiter', icon: 'arrow', primary: true, run: () => go(Math.min(n, k + 2)) });
  setCoach({ cls: v.kind === 'missed' ? 'miss' : cls, title, chip: v.idx > 0 ? currentEval() : null, paragraphs, actions });
}

let liveTimer = null;
function startLive() {
  const v = S.variation;
  if (!v || (v.idx === 0 && S.mode !== 'board')) {
    live.stop();
    S.live = null;
    return;
  }
  const fen = currentFen();
  const idx = v.idx;
  const state = { fen, lines: [], terminal: null };
  S.live = state;
  live.analyze(fen, {
    depth: S.mode === 'board' ? 22 : 18,
    onUpdate: (lines, terminal) => {
      if (S.live !== state) return;
      state.lines = lines;
      state.terminal = terminal;
      if (terminal) v.evals[idx] = terminal.eval;
      else if (lines[0] && lines[0].depth >= 10) {
        v.evals[idx] = lines[0].eval;
        v.lines[idx] = lines;
      }
      if (!liveTimer) {
        liveTimer = setTimeout(() => {
          liveTimer = null;
          if (S.live === state) {
            renderEvalBar(currentEval());
            renderLines();
            renderCoach();
            if (S.mode === 'board') {
              board.setDecor(boardDecor());
              refreshMoveIcons();
            }
          }
        }, 120);
      }
    },
  });
}

function currentLines() {
  const v = S.variation;
  if (S.retry) return [];
  if (!v && S.live && S.live.deep && S.live.fen === currentFen() && S.live.lines[0] && S.live.lines[0].depth >= 14) return S.live.lines;
  if (v && (v.idx > 0 || S.mode === 'board')) return S.live && S.live.fen === currentFen() ? S.live.lines : [];
  return S.review.positions[v ? v.basePly : S.ply].lines;
}

// ---------------------------------------------------------------------------
// „Nochmal versuchen“
// ---------------------------------------------------------------------------

function startRetry(k) {
  live.stop();
  S.live = null;
  S.variation = null;
  S.retry = { k, state: 'waiting', hint: false, shownFen: null, feedback: null, userMove: null };
  render();
}

async function retryMove(mv) {
  const r = S.retry;
  const k = r.k;
  const pos = S.review.positions[k];
  const best = pos.lines[0];
  const played = S.game.moves[k];
  const sign = played.color === 'w' ? 1 : -1;
  r.userMove = mv;
  r.shownFen = mv.fen;
  playSound(soundFor(mv));

  const fail = (text) => {
    r.state = 'wrong';
    r.feedback = text;
    render();
    setTimeout(() => {
      if (S.retry !== r) return;
      r.state = 'waiting';
      r.shownFen = null;
      r.userMove = null;
      render();
    }, 1100);
  };
  const solve = (text, exact) => {
    r.state = 'solved';
    r.exact = exact;
    r.feedback = text;
    render();
  };

  if (best && mv.uci === best.move) {
    const what = describeMove(S.game.fens[k], mv, k > 0 ? S.game.moves[k - 1] : null, k);
    solve(`Genau! **${sanDe(mv.san)}** ist der beste Zug.` + (what ? ` ${say(ctx(), mv.color, what)}.` : ''), true);
    return;
  }
  if (mv.uci === played.uci) {
    fail(`Das ist der Zug aus der Partie – der war ${CLASSES[S.review.moves[k].cls].noun}. Probier etwas anderes!`);
    return;
  }
  r.state = 'checking';
  r.feedback = 'Ich prüfe deinen Zug …';
  render();
  const known = pos.lines.find((l) => l.move === mv.uci);
  let ev = known ? known.eval : null;
  if (!ev) {
    const res = await live.evaluate(mv.fen, 13);
    if (S.retry !== r) return;
    if (res) ev = res.terminal ? res.terminal.eval : res.lines[0] && res.lines[0].eval;
  }
  if (!ev) {
    fail('Das konnte ich nicht prüfen. Versuch es noch einmal.');
    return;
  }
  const loss = sign * (winPct(S.review.evals[k]) - winPct(ev));
  const bestSan = best ? sanDe(pvToMoves(S.game.fens[k], best.pv, 1)[0].san) : '';
  if (loss <= 3) solve(`Auch stark! **${sanDe(mv.san)}** ist fast so gut wie der beste Zug **${bestSan}**.`, false);
  else if (loss <= 8) fail(`**${sanDe(mv.san)}** ist besser als in der Partie, aber es geht noch genauer.`);
  else fail(`**${sanDe(mv.san)}** ist leider auch nicht gut. Versuch es noch einmal!`);
}

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------

function render() {
  if (S.mode === 'board') buildBoardMoveList();
  renderBoard(true);
  renderPlayers();
  renderEvalBar(currentEval());
  renderCoach();
  renderLines();
  renderVariationBar();
  renderTools();
  highlightMove();
  renderGraphs();
  announce();
}

/** Sagt Screenreadern, welcher Zug gerade zu sehen ist. */
function announce() {
  let text = '';
  if (S.mode === 'game' && !S.variation && !S.retry && S.ply > 0) {
    const m = S.game.moves[S.ply - 1];
    const cls = S.review.moves[S.ply - 1].cls;
    text = `Zug ${Math.ceil(S.ply / 2)}, ${SIDE[m.color]}: ${spokenMove(m)}. ${CLASSES[cls].label || ''}`;
  } else if (S.variation && S.variation.idx > 0) {
    const m = S.variation.moves[S.variation.idx - 1];
    text = `${SIDE[m.color]}: ${spokenMove(m)}`;
  }
  $('sr-status').textContent = text;
  $('board').setAttribute('aria-label', `Schachbrett. ${new Chess(currentFen()).turn() === 'w' ? 'Weiß' : 'Schwarz'} am Zug.`);
}

function spokenMove(m) {
  if (/^O-O-O/.test(m.san)) return 'lange Rochade';
  if (/^O-O/.test(m.san)) return 'kurze Rochade';
  const names = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
  return `${names[m.piece]} ${m.from} ${m.captured ? 'schlägt auf' : 'nach'} ${m.to}${/#/.test(m.san) ? ', Schachmatt' : /\+/.test(m.san) ? ', Schach' : ''}`;
}

const tint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const YELLOW = 'rgba(255, 235, 59, .5)';

function renderBoard(animate) {
  board.setPosition(currentFen(), { animate });
  board.setDecor(boardDecor());
}

/** Markierungen, Pfeile und Bewertungs-Symbol für die aktuelle Stellung. */
function boardDecor() {
  const { game, review } = S;
  const decor = { squares: [], arrows: [] };
  const v = S.variation;
  if (S.mode === 'board') {
    if (v.idx > 0) {
      const m = v.moves[v.idx - 1];
      const j = judgeMove(v, v.idx);
      const color = j ? tint(CLASSES[j.cls].color, 0.6) : tint('#5c8bb0', 0.55);
      decor.squares.push({ square: m.from, color }, { square: m.to, color });
      if (j) decor.badge = { square: m.to, cls: j.cls };
    }
    const best = S.live && S.live.fen === currentFen() && S.live.lines[0];
    if (best && $('bt-arrow').checked) {
      decor.arrows.push({ from: best.move.slice(0, 2), to: best.move.slice(2, 4), color: CLASSES.best.color, opacity: 0.8 });
    }
  } else if (S.retry) {
    const r = S.retry;
    if (r.userMove && r.shownFen) {
      const color = r.state === 'solved' ? tint(CLASSES.best.color, 0.6) : r.state === 'wrong' ? tint(CLASSES.blunder.color, 0.55) : YELLOW;
      decor.squares.push({ square: r.userMove.from, color }, { square: r.userMove.to, color });
      if (r.state === 'solved') decor.badge = { square: r.userMove.to, cls: r.exact ? 'best' : 'excellent' };
    } else if (r.hint) {
      const best = review.positions[r.k].lines[0];
      if (best) decor.squares.push({ square: best.move.slice(0, 2), color: tint(CLASSES.best.color, 0.65) });
    }
  } else if (v) {
    if (v.idx > 0) {
      const m = v.moves[v.idx - 1];
      const color = v.source === 'best' && v.idx === 1 ? tint(CLASSES.best.color, 0.6) : tint('#5c8bb0', 0.55);
      decor.squares.push({ square: m.from, color }, { square: m.to, color });
      if (v.source === 'best' && v.idx === 1) decor.badge = { square: m.to, cls: 'best' };
    } else if (v.source === 'best' && v.moves[0]) {
      decor.arrows.push({ from: v.moves[0].from, to: v.moves[0].to, color: CLASSES.best.color });
    }
    if (v.source === 'why' && v.moves[v.idx]) {
      decor.arrows.push({ from: v.moves[v.idx].from, to: v.moves[v.idx].to, color: '#f7a531', opacity: 0.85 });
    }
  } else if (S.ply > 0) {
    const m = game.moves[S.ply - 1];
    const cls = S.view === 'moves' ? review.moves[S.ply - 1].cls : null;
    const color = cls ? tint(CLASSES[cls].color, 0.6) : YELLOW;
    decor.squares.push({ square: m.from, color }, { square: m.to, color });
    if (cls) decor.badge = { square: m.to, cls };
    // Bei Fehlern und Patzern die Bestrafung als roten Pfeil zeigen
    const reply = review.positions[S.ply].lines[0];
    if ((cls === 'mistake' || cls === 'blunder') && reply) {
      decor.arrows.push({ from: reply.move.slice(0, 2), to: reply.move.slice(2, 4), color: CLASSES.blunder.color, opacity: 0.75 });
    }
  }
  if (!S.settings.lastMove && !S.retry) decor.squares = [];
  if (S.threat && S.threat.move && S.threat.fen === currentFen() && !S.retry) {
    decor.arrows.push({ from: S.threat.move.from, to: S.threat.move.to, color: CLASSES.blunder.color, opacity: 0.85 });
  }
  if (S.hoverArrow && !S.retry) {
    decor.arrows.push({ from: S.hoverArrow.slice(0, 2), to: S.hoverArrow.slice(2, 4), color: '#f7a531' });
  }
  return decor;
}

function fmtClock(sec) {
  if (sec == null) return '';
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(r)).padStart(2, '0')}`;
  if (s < 20) return `${m}:${r.toFixed(1).padStart(4, '0')}`;
  return `${m}:${String(Math.floor(r)).padStart(2, '0')}`;
}

function clockAt(color) {
  const { game } = S;
  if (!game.moves.some((m) => m.clock != null)) return null;
  for (let i = S.ply - 1; i >= 0; i--) {
    if (game.moves[i].color === color && game.moves[i].clock != null) return game.moves[i].clock;
  }
  const base = parseInt(game.timeControl, 10);
  return Number.isFinite(base) && !game.timeControl.includes('/') ? base : null;
}

function renderPlayers() {
  const { game } = S;
  const fen = currentFen();
  const mat = materialInfo(fen);
  const turn = fen.split(' ')[1];
  const inMain = !S.variation && !S.retry;
  const html = (color) => {
    const p = color === 'w' ? game.white : game.black;
    const taken = color === 'w' ? mat.capturedByWhite : mat.capturedByBlack;
    const other = color === 'w' ? 'b' : 'w';
    const lead = color === 'w' ? mat.diff : -mat.diff;
    let caps = '';
    taken.forEach((t, i) => {
      caps += `<i class="${i && taken[i - 1] !== t ? 'gap' : ''}" style="background-image:url('assets/pieces/${S.settings.pieces}/${other}${t.toUpperCase()}.svg')"></i>`;
    });
    const clock = inMain ? clockAt(color) : null;
    return `${avatarHtml(p)}
      <div class="player-info">
        <div class="player-name">${esc(p.name)}${p.rating ? `<small>(${esc(p.rating)})</small>` : ''}</div>
        <div class="captured">${caps}${lead > 0 ? `<span>+${lead}</span>` : ''}</div>
      </div>
      ${clock != null ? `<div class="clock ${color === 'w' ? 'white' : ''} ${turn === color ? '' : 'idle'}">${fmtClock(clock)}</div>` : ''}`;
  };
  const top = S.orientation === 'w' ? 'b' : 'w';
  $('player-top').innerHTML = html(top);
  $('player-bottom').innerHTML = html(top === 'w' ? 'b' : 'w');
}

function renderEvalBar(ev) {
  const w = winPct(ev);
  const mate = ev.type === 'mate';
  const share = mate ? (w > 50 ? 100 : 0) : Math.max(4, Math.min(96, w));
  $('evalbar-white').style.height = share + '%';
  $('evalbar').classList.toggle('flipped', S.orientation === 'b');
  const num = $('evalbar-num');
  num.textContent = evalText(ev).replace(/^[+-]/, '');
  num.className = 'evalbar-num ' + (w >= 50 ? 'w' : 'b');
  const lead = ev.type === 'mate' ? `Matt in ${Math.abs(ev.value)} für ${w > 50 ? 'Weiß' : 'Schwarz'}` : Math.abs(ev.value) < 30 ? 'ausgeglichen' : `${w > 50 ? 'Weiß' : 'Schwarz'} steht besser`;
  $('evalbar').setAttribute('aria-label', `Bewertung ${evalText(ev)}, ${lead}`);
}

function evalChip(ev) {
  return `<span class="eval-chip ${winPct(ev) >= 50 ? 'w' : 'b'}">${evalText(ev)}</span>`;
}

/** Füllt die Sprechblase des Coachs. */
function setCoach({ cls, title, chip, paragraphs = [], actions = [] }) {
  $('coach-head').innerHTML = (cls ? classIcon(cls, 24) : '')
    + `<span class="title" ${cls ? `style="color:${darken(CLASSES[cls].color)}"` : ''}>${md(title || '')}</span>`
    + (chip ? evalChip(chip) : '');
  $('coach-text').innerHTML = paragraphs.map((p) => `<p>${md(p)}</p>`).join('');
  const box = $('coach-actions');
  box.innerHTML = '';
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.primary ? 'primary' : 'soft');
    b.innerHTML = (a.icon && !a.primary ? uiIcon(a.icon, 16) : '') + esc(a.label) + (a.icon && a.primary ? uiIcon(a.icon, 16) : '');
    b.onclick = a.run;
    box.appendChild(b);
  });
}

/** Dunklere Variante einer Farbe, damit sie auf der hellen Sprechblase lesbar ist. */
function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.72);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function renderCoach() {
  if (S.view !== 'moves') return;
  const { game, review } = S;
  const n = game.moves.length;
  const v = S.variation;

  if (S.retry) {
    const r = S.retry;
    const k = r.k;
    const side = S.you === game.moves[k].color ? 'Du bist' : `${SIDE[game.moves[k].color]} ist`;
    if (r.state === 'solved') {
      setCoach({
        cls: r.exact ? 'best' : 'excellent',
        title: r.exact ? 'Richtig!' : 'Guter Zug!',
        paragraphs: [r.feedback],
        actions: [
          ...(r.exact ? [] : [{ label: 'Besten Zug zeigen', icon: 'bulb', run: () => showBest(k) }]),
          { label: 'Weiter', icon: 'arrow', primary: true, run: () => go(Math.min(n, k + 2)) },
        ],
      });
      return;
    }
    const best = review.positions[k].lines[0];
    const piece = best ? new Chess(game.fens[k]).get(best.move.slice(0, 2)) : null;
    const names = { p: 'einem Bauern', n: 'dem Springer', b: 'dem Läufer', r: 'dem Turm', q: 'der Dame', k: 'dem König' };
    setCoach({
      title: `${side} am Zug – finde etwas Besseres als ${sanDe(game.moves[k].san)}!`,
      paragraphs: [r.feedback || (r.hint && piece ? `Tipp: Zieh mit ${names[piece.type]}.` : 'Zieh eine Figur auf dem Brett.')],
      actions: [
        { label: 'Tipp', icon: 'bulb', run: () => { r.hint = true; r.feedback = null; render(); } },
        { label: 'Lösung zeigen', icon: 'star', run: () => showBest(k) },
        { label: 'Abbrechen', run: () => go(k + 1) },
      ],
    });
    return;
  }

  if (S.mode === 'board') {
    renderBoardCoach();
    return;
  }

  if (v && v.source === 'why') {
    renderWhyCoach(v);
    return;
  }
  if (v) {
    const ev = currentEval();
    if (v.source === 'best') {
      const m = v.moves[0];
      const what = describeMove(game.fens[v.basePly], m, v.basePly > 0 ? game.moves[v.basePly - 1] : null, v.basePly);
      const paragraphs = [];
      if (v.idx <= 1) {
        paragraphs.push(what ? `${say(ctx(), m.color, what)}.` : 'Das ist die erste Wahl der Engine.');
        if (v.moves.length > 1) paragraphs.push(`So könnte es weitergehen: ${lineText(game.fens[v.basePly], v.moves.slice(0, 6))}. Mit → spielst du die Züge durch.`);
      } else {
        paragraphs.push(`Fortsetzung der Engine: ${lineText(game.fens[v.basePly], v.moves.slice(0, v.idx))}`);
      }
      setCoach({
        cls: 'best',
        title: `${sanDe(m.san)} war der beste Zug`,
        chip: v.intro ? null : ev,
        paragraphs,
        actions: [
          { label: 'Zurück zur Partie', icon: 'back', run: () => go(v.returnPly) },
          { label: 'Weiter', icon: 'arrow', primary: true, run: () => go(Math.min(n, v.basePly + 2)) },
        ],
      });
      return;
    }
    // eigene Variante
    const m = v.moves[v.idx - 1];
    const paragraphs = [];
    const before = v.evals[v.idx - 1];
    const after = v.evals[v.idx];
    const done = S.live && S.live.fen === currentFen() && (S.live.terminal || (S.live.lines[0] && S.live.lines[0].depth >= 12));
    if (S.live && S.live.terminal && S.live.terminal.terminal === 'mate') {
      paragraphs.push('Schachmatt!');
    } else if (S.live && S.live.terminal) {
      paragraphs.push('Remis – hier geht nichts mehr.');
    } else if (!done || !after) {
      paragraphs.push('Die Engine rechnet …');
    } else {
      const j = judgeMove(v, v.idx);
      if (j) paragraphs.push(`**${sanDe(m.san)}**: ${JUDGE_TEXT[j.cls]}`);
      const reply = pvToMoves(currentFen(), S.live.lines[0].pv, 1)[0];
      if (reply) paragraphs.push(`Die beste Antwort ist **${sanDe(reply.san)}**.`);
    }
    setCoach({
      title: 'Eigene Variante',
      chip: after || null,
      paragraphs,
      actions: [{ label: 'Zurück zur Partie', icon: 'back', primary: true, run: () => go(v.returnPly) }],
    });
    return;
  }

  if (S.ply === 0) {
    setCoach({
      title: 'Los geht’s!',
      paragraphs: [
        S.you ? `Du spielst mit ${SIDE[S.you]} gegen ${S.you === 'w' ? game.black.name : game.white.name}.`
          : `${game.white.name} (Weiß) gegen ${game.black.name} (Schwarz).`,
        'Geh mit „Weiter“ oder den Pfeiltasten Zug für Zug durch die Partie. Du kannst jederzeit selbst Züge auf dem Brett ausprobieren.',
      ],
      actions: [{ label: 'Weiter', icon: 'arrow', primary: true, run: next }],
    });
    return;
  }

  const k = S.ply - 1;
  const ex = explainMove(ctx(), k);
  const actions = [];
  if (whyLine(k)) actions.push({ label: 'Zeig mir warum', icon: 'play', run: () => showWhy(k) });
  if (ex.best) actions.push({ label: 'Bester Zug', icon: 'star', run: () => showBest(k) });
  if (BAD.has(ex.cls) && ex.best) actions.push({ label: 'Nochmal versuchen', icon: 'retry', run: () => startRetry(k) });
  if (ex.cls === 'mistake' || ex.cls === 'blunder' || ex.cls === 'miss') {
    const tag = TAGS[mistakeTag(ctx(), k)];
    if (tag && tag.lesson) actions.push({ label: 'Lektion dazu', icon: 'book', run: () => { location.hash = '#lektion/' + tag.lesson; } });
  }
  const paragraphs = ex.paragraphs.slice();
  if (S.ply === n) {
    const res = resultText(game);
    if (res && review.positions[n].terminal !== 'mate') paragraphs.push(res);
    actions.push({ label: 'Zur Übersicht', icon: 'chart', primary: true, run: showOverview });
  } else {
    actions.push({ label: 'Weiter', icon: 'arrow', primary: true, run: next });
  }
  setCoach({ cls: ex.cls, title: ex.title, chip: review.evals[S.ply], paragraphs, actions });
}

function renderLines() {
  const el = $('lines');
  if (S.view !== 'moves' || S.retry) {
    el.innerHTML = '';
    return;
  }
  const fen = currentFen();
  const lines = S.settings.lines > 0 ? currentLines() : [];
  if (!lines.length) {
    el.innerHTML = '';
    return;
  }
  const depth = lines[0].depth ? ` · Tiefe ${lines[0].depth}` : '';
  el.innerHTML = `<div class="lines-head">Engine-Linien${depth}</div>` + lines.slice(0, S.settings.lines).map((l, i) => {
    const moves = pvToMoves(fen, l.pv, 8);
    return `<button type="button" class="line" data-i="${i}" data-uci="${esc(l.move)}">${evalChip(l.eval)}<span class="line-moves">${esc(lineText(fen, moves))}</span></button>`;
  }).join('');
}

function renderVariationBar() {
  const el = $('variation');
  const v = S.variation;
  if (!v || v.source !== 'user' || S.mode === 'board') {
    el.hidden = true;
    return;
  }
  const fen = S.game.fens[v.basePly];
  const shown = lineText(fen, v.moves.slice(0, v.idx));
  const rest = v.moves.length > v.idx ? ' ' + v.moves.slice(v.idx, v.idx + 4).map((m) => sanDe(m.san)).join(' ') : '';
  el.hidden = false;
  const line = v.savedId && S.annot ? S.annot.lines.find((l) => l.id === v.savedId) : null;
  const same = line && line.ucis.join(' ') === v.moves.map((m) => m.uci).join(' ');
  const button = !S.annot || !v.moves.length ? ''
    : same ? '<span class="chip on v-saved">Gespeichert ✓</span>'
      : `<button type="button" class="chip" id="v-save">${line ? 'Änderung speichern' : 'Variante speichern'}</button>`;
  el.innerHTML = `<div class="v-moves"><b>${esc(shown)}</b><span>${esc(rest)}</span></div>${button}`;
}

// ---------------------------------------------------------------------------
// Eigene Varianten und Notizen zu einer Partie (bleiben gespeichert und werden mit dem Konto abgeglichen)
// ---------------------------------------------------------------------------

const MAX_LINES = 50;
const MAX_LINE_PLIES = 60;

async function loadAnnot(game) {
  const a = await db.get('notes', game.id).catch(() => null);
  return a && a.notes && a.lines ? a : { id: game.id, notes: {}, lines: [] };
}

async function saveAnnot() {
  const a = S.annot;
  if (!a) return;
  a.mod = Date.now();
  if (!a.lines.length && !Object.keys(a.notes).length) {
    await db.del('notes', a.id).catch(() => {});
    forget('n', a.id);
  } else {
    await db.set('notes', a.id, a).catch(() => {});
    touch();
  }
}

function saveVariation() {
  const v = S.variation;
  if (!v || v.source !== 'user' || !v.moves.length || !S.annot || S.mode !== 'game') return;
  const a = S.annot;
  const ucis = v.moves.slice(0, MAX_LINE_PLIES).map((m) => m.uci);
  let line = v.savedId ? a.lines.find((l) => l.id === v.savedId) : null;
  if (!line) line = a.lines.find((l) => l.base === v.basePly && l.ucis.join(' ') === ucis.join(' '));
  if (line) line.ucis = ucis;
  else {
    if (a.lines.length >= MAX_LINES) {
      $('variation').insertAdjacentHTML('beforeend', '<span class="hint">Höchstens 50 Varianten pro Partie.</span>');
      return;
    }
    line = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), base: v.basePly, ucis };
    a.lines.push(line);
  }
  v.savedId = line.id;
  saveAnnot();
  buildMoveList();
  render();
}

function openSavedLine(id) {
  const line = S.annot && S.annot.lines.find((l) => l.id === id);
  if (!line) return;
  if (S.view !== 'moves') showMoves();
  const moves = pvToMoves(S.game.fens[line.base], line.ucis, MAX_LINE_PLIES);
  if (!moves.length) return;
  live.stop();
  S.retry = null;
  S.variation = {
    basePly: line.base, returnPly: line.base, moves, idx: 1, source: 'user', savedId: id,
    evals: [S.review.evals[line.base]], lines: [], judged: [],
  };
  playSound(soundFor(moves[0]));
  startLive();
  render();
}

function deleteSavedLine(id) {
  if (!S.annot || !confirm('Diese Variante löschen?')) return;
  S.annot.lines = S.annot.lines.filter((l) => l.id !== id);
  if (S.variation && S.variation.savedId === id) S.variation.savedId = null;
  saveAnnot();
  buildMoveList();
  render();
}

/** Notiz zur Stellung nach Halbzug ply (0 = vor dem ersten Zug). Leerer Text löscht sie. */
function setNote(ply, text) {
  if (!S.annot) return;
  const clean = String(text || '').slice(0, 1000).trim();
  if ((S.annot.notes[ply] || '') === clean) return;
  if (clean) S.annot.notes[ply] = clean;
  else delete S.annot.notes[ply];
  saveAnnot();
  buildMoveList();
  highlightMove();
}

function buildMoveList() {
  const { game, review } = S;
  let html = '';
  const startsBlack = game.moves[0].color === 'b';
  const first = +game.startFen.split(' ')[5] || 1;
  const spent = timeSpent(game);
  const isBad = (k) => k < game.moves.length && ['mistake', 'blunder', 'miss', 'inaccuracy'].includes(review.moves[k].cls);
  const fmt = (t) => (t >= 60 ? Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') : t < 10 ? t.toFixed(1) + 's' : Math.round(t) + 's');
  const cell = (k) => {
    const m = game.moves[k];
    const t = spent && spent[k] != null ? `<em class="clk" title="Bedenkzeit für diesen Zug">${fmt(spent[k])}</em>` : '';
    const note = S.annot && S.annot.notes[k + 1] ? '<i class="note-dot" title="Notiz"></i>' : '';
    return `<button type="button" class="mv${isBad(k) ? ' bad' : ''}" data-ply="${k + 1}">${classIcon(review.moves[k].cls, 16)}<span>${esc(sanDe(m.san))}</span>${note}${t}</button>`;
  };
  // Gespeicherte Varianten stehen unter der Zeile mit dem Zug, den sie ersetzen
  const saved = (S.annot && S.annot.lines) || [];
  const varRows = (from, to) => saved.filter((l) => l.base >= from && l.base < to).map((l) => {
    const moves = pvToMoves(game.fens[l.base], l.ucis, 60);
    return `<div class="var-row" data-line="${esc(l.id)}"><button type="button" class="var-open" title="Variante ansehen">(${esc(lineText(game.fens[l.base], moves))})</button>`
      + '<button type="button" class="var-del" title="Variante löschen" aria-label="Variante löschen">×</button></div>';
  }).join('');
  let k = 0;
  let num = first;
  if (startsBlack) {
    html += `<div class="move-row${isBad(0) ? ' has-bad' : ''}"><span class="move-num">${num}.</span><span></span>${cell(0)}</div>` + varRows(0, 1);
    k = 1;
    num++;
  }
  for (; k < game.moves.length; k += 2, num++) {
    html += `<div class="move-row${isBad(k) || isBad(k + 1) ? ' has-bad' : ''}"><span class="move-num">${num}.</span>${cell(k)}${k + 1 < game.moves.length ? cell(k + 1) : '<span></span>'}</div>` + varRows(k, k + 2);
  }
  html += varRows(game.moves.length, game.moves.length + 1);
  html += `<div class="result-row">${esc(game.result === '*' ? '' : game.result.replace('1/2-1/2', '½–½'))}</div>`;
  $('moves').innerHTML = html;
}

function highlightMove() {
  const box = $('moves');
  box.querySelectorAll('.mv.active, .var-row.active').forEach((el) => el.classList.remove('active'));
  if (S.variation && S.variation.savedId) {
    const row = box.querySelector(`.var-row[data-line="${S.variation.savedId}"]`);
    if (row) row.classList.add('active');
  }
  const ply = S.mode === 'board' ? S.variation.idx : S.retry ? S.retry.k + 1 : S.variation ? S.variation.returnPly : S.ply;
  const el = box.querySelector(`.mv[data-ply="${ply}"]`);
  if (el) {
    el.classList.add('active');
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop + 4 || top > box.scrollTop + box.clientHeight - 40) {
      box.scrollTop = top - box.clientHeight / 2;
    }
  } else {
    box.scrollTop = 0;
  }
}

/** Zeichnet während der Analyse den bisher bekannten Bewertungsverlauf und die vorläufige Genauigkeit. */
function renderLivePreview(game, evals) {
  const known = [];
  evals.forEach((ev, i) => { if (ev) known.push(i); });
  if (known.length < 2) return;
  $('progress-live').hidden = false;
  const svg = $('graph-live');
  const W = svg.clientWidth, H = svg.clientHeight;
  if (W && H) {
    const n = Math.max(1, game.fens.length - 1);
    const x = (i) => ((i / n) * W).toFixed(1);
    const y = (ev) => (H - (winPct(ev) / 100) * H).toFixed(1);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let d = `M${x(known[0])},${H} `;
    for (const i of known) d += `L${x(i)},${y(evals[i])} `;
    d += `L${x(known[known.length - 1])},${H} Z`;
    // Noch nicht gerechnete Abschnitte grau hinterlegen
    let gaps = '';
    for (let i = 0; i < game.fens.length; i++) {
      if (evals[i]) continue;
      let j = i;
      while (j + 1 < game.fens.length && !evals[j + 1]) j++;
      gaps += `<rect x="${x(Math.max(0, i - 0.5))}" y="0" width="${Math.max(2, ((j - i + 1) / n) * W).toFixed(1)}" height="${H}" fill="rgba(128,128,128,.18)"/>`;
      i = j;
    }
    svg.innerHTML = `${gaps}<path d="${d}" fill="#f4f5f6"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(128,128,128,.55)" stroke-width="1"/>`;
  }
  const acc = previewAccuracy(game, evals);
  const fmt = (v) => (v == null ? '–' : v.toFixed(1) + ' %');
  $('progress-stats').innerHTML = acc.moves >= 6
    ? `Vorläufige Genauigkeit: <b>Weiß ${fmt(acc.w)}</b> · <b>Schwarz ${fmt(acc.b)}</b>`
    : 'Die ersten Stellungen sind gerechnet …';
}

function renderGraphs() {
  if (!S.review || S.mode === 'board') return;
  drawGraph($('graph-overview'));
  drawGraph($('graph-moves'));
}

function drawGraph(svg) {
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;
  const { review, game } = S;
  const n = game.moves.length;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x = (i) => (n ? (i / n) * W : 0);
  const y = (w) => H - (w / 100) * H;
  let d = `M0,${H} `;
  review.wins.forEach((w, i) => { d += `L${x(i).toFixed(1)},${y(w).toFixed(1)} `; });
  d += `L${W},${H} Z`;
  let marks = '';
  const show = { brilliant: 1, great: 1, blunder: 1, mistake: 1, miss: 1 };
  review.moves.forEach((m, k) => {
    if (!show[m.cls]) return;
    marks += `<circle cx="${x(k + 1).toFixed(1)}" cy="${y(review.wins[k + 1]).toFixed(1)}" r="3.4" fill="${CLASSES[m.cls].color}" stroke="#1c222c" stroke-width="1"/>`;
  });
  const ply = S.view === 'overview' ? null : (S.retry ? S.retry.k + 1 : S.variation ? S.variation.returnPly : S.ply);
  const cursor = ply == null ? '' : `<line x1="${x(ply).toFixed(1)}" x2="${x(ply).toFixed(1)}" y1="0" y2="${H}" stroke="#3ecf8e" stroke-width="2"/>`;
  svg.innerHTML = `<path d="${d}" fill="#f4f5f6"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(128,128,128,.55)" stroke-width="1"/>${marks}${cursor}`;
}

// ---------------------------------------------------------------------------
// Analysebrett: frei für beide Seiten ziehen, Engine rechnet live mit
// ---------------------------------------------------------------------------

const JUDGE_TEXT = {
  best: 'Das ist der beste Zug!',
  excellent: 'Ein starker Zug!',
  good: 'Ein guter Zug.',
  inaccuracy: 'Etwas ungenau.',
  mistake: 'Das ist ein Fehler.',
  blunder: 'Das ist ein Patzer.',
};

/**
 * Bewertet den Zug, der in einer Variante zu Stellung `idx` führt.
 * Verglichen wird möglichst innerhalb derselben Engine-Suche, sonst schwanken die Werte.
 */
function judgeMove(v, idx) {
  if (v.judged[idx]) return v.judged[idx];
  const m = v.moves[idx - 1];
  const sign = m.color === 'w' ? 1 : -1;
  const prevLines = idx === 1 && S.mode !== 'board' ? S.review.positions[v.basePly].lines : (v.lines[idx - 1] || []);
  const hit = prevLines.find((l) => l.move === m.uci);
  const here = S.live && S.live.fen === m.fen ? S.live : null;
  const settled = here && (here.terminal || (here.lines[0] && here.lines[0].depth >= 12));
  let cls = null;
  if (here && here.terminal && here.terminal.terminal === 'mate') cls = 'best';
  else if (hit === prevLines[0] && hit) cls = 'best';
  else {
    let loss = null;
    if (hit) loss = sign * (winPct(prevLines[0].eval) - winPct(hit.eval));
    else if (settled && v.evals[idx - 1] && v.evals[idx]) loss = sign * (winPct(v.evals[idx - 1]) - winPct(v.evals[idx]));
    if (loss == null) return null;
    cls = loss <= 2 ? 'excellent' : loss <= 5 ? 'good' : loss <= 10 ? 'inaccuracy' : loss <= 20 ? 'mistake' : 'blunder';
  }
  v.judged[idx] = { cls, best: prevLines[0] && prevLines[0] !== hit ? prevLines[0].move : null };
  return v.judged[idx];
}

function boardState() {
  const v = S.variation;
  return { startFen: S.game.startFen, ucis: v.moves.map((m) => m.uci), idx: v.idx };
}

function saveBoard() {
  store.set('board', boardState());
}

/** Öffnet das Analysebrett – mit einer Stellung oder dem zuletzt gespeicherten Stand. */
function openBoard(fen, ucis = [], idx = null) {
  leaveModes();
  if (!fen) {
    const saved = store.get('board', null);
    if (saved && saved.startFen) ({ startFen: fen, ucis, idx } = saved);
  }
  let start;
  try {
    start = new Chess(fen || START_FEN).fen();
  } catch (e) {
    start = START_FEN;
    ucis = [];
  }
  const moves = pvToMoves(start, ucis || [], 600);
  S.mode = 'board';
  S.view = 'moves';
  S.you = null;
  S.retry = null;
  S.ply = 0;
  S.live = null;
  S.hoverArrow = null;
  S.game = {
    id: 'brett', url: null, white: { name: 'Weiß', rating: null, avatar: null }, black: { name: 'Schwarz', rating: null, avatar: null },
    result: '*', termination: '', date: '', timeControl: '', timeClass: '', startFen: start, moves: [], fens: [start],
  };
  const zero = { type: 'cp', value: 0 };
  S.review = { positions: [{ lines: [], eval: zero }], evals: [zero], wins: [50], moves: [] };
  S.variation = {
    basePly: 0, returnPly: 0, moves, source: 'board', evals: [], lines: [], judged: [],
    idx: idx == null ? moves.length : Math.max(0, Math.min(moves.length, idx)),
  };

  showMain('review');
  $('pane-progress').hidden = $('pane-overview').hidden = $('pane-editor').hidden = true;
  $('pane-moves').hidden = false;
  $('controls').hidden = false;
  $('board-tools').hidden = false;
  $('ctl-overview').hidden = $('ctl-key').hidden = true;
  $('graph-moves').parentElement.hidden = true;
  document.title = 'Analysebrett · Chess Analyzer';
  if (location.hash !== '#brett') history.pushState(null, '', '#brett');
  window.scrollTo(0, 0);
  board.setOrientation(S.orientation = start.split(' ')[1] === 'b' && !moves.length ? 'b' : 'w');
  board.setInteractive(true);
  board.setPosition(currentFen(), { animate: false });
  startLive();
  render();
  saveBoard();
}

function boardGo(idx, sound = false) {
  const v = S.variation;
  const target = Math.max(0, Math.min(v.moves.length, idx));
  if (target === v.idx) return;
  if (sound && target === v.idx + 1) playSound(soundFor(v.moves[target - 1]));
  v.idx = target;
  startLive();
  render();
  saveBoard();
}

function boardPgn() {
  const chess = new Chess(S.game.startFen);
  for (const m of S.variation.moves) chess.move({ from: m.from, to: m.to, promotion: m.promotion || undefined });
  // leere Standard-Kopfzeilen weglassen, eine eigene Startstellung (FEN) bleibt erhalten
  return chess.pgn().split('\n').filter((l) => !/^\[(Event|Site|Date|Round|White|Black|Result) /.test(l)).join('\n').trim();
}

/** Kopiert Text in die Zwischenablage und bestätigt das kurz auf dem Knopf. */
async function copyText(text, button) {
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
  }
  if (!button) return;
  const label = button.dataset.label || (button.dataset.label = button.textContent);
  button.textContent = ok ? 'Kopiert ✓' : 'Nicht möglich';
  setTimeout(() => { button.textContent = label; }, 1300);
}

function showEditor(fen) {
  live.stop();
  S.live = null;
  S.view = 'editor';
  $('pane-moves').hidden = $('pane-progress').hidden = $('pane-overview').hidden = true;
  $('controls').hidden = true;
  $('pane-editor').hidden = false;
  document.querySelector('.panel').classList.add('is-editor');
  $('player-top').innerHTML = $('player-bottom').innerHTML = '';
  renderEvalBar({ type: 'cp', value: 0 });
  board.setInteractive(false);
  board.setDecor({});
  openEditor(fen);
}

/** Editor ohne Änderung verlassen: zurück zum Analysebrett, wie es war. */
function closeEditor() {
  const st = boardState();
  openBoard(st.startFen, st.ucis, st.idx);
}

function buildBoardMoveList() {
  const v = S.variation;
  const parts = S.game.startFen.split(' ');
  let num = +parts[5] || 1;
  let html = '';
  const cell = (i) => `<button type="button" class="mv" data-ply="${i + 1}"><span class="mv-ico">${v.judged[i + 1] ? classIcon(v.judged[i + 1].cls, 16) : ''}</span><span>${esc(sanDe(v.moves[i].san))}</span></button>`;
  let i = 0;
  if (v.moves.length && v.moves[0].color === 'b') {
    html += `<div class="move-row"><span class="move-num">${num}.</span><span></span>${cell(0)}</div>`;
    i = 1;
    num++;
  }
  for (; i < v.moves.length; i += 2, num++) {
    html += `<div class="move-row"><span class="move-num">${num}.</span>${cell(i)}${i + 1 < v.moves.length ? cell(i + 1) : '<span></span>'}</div>`;
  }
  if (!v.moves.length) html = '<div class="result-row">Noch keine Züge – zieh einfach los.</div>';
  $('moves').innerHTML = html;
}

/** Trägt frisch berechnete Bewertungs-Symbole in die Zugliste nach. */
function refreshMoveIcons() {
  const v = S.variation;
  const j = v.idx > 0 ? v.judged[v.idx] : null;
  if (!j) return;
  const ico = $('moves').querySelector(`.mv[data-ply="${v.idx}"] .mv-ico`);
  if (ico && !ico.firstChild) ico.innerHTML = classIcon(j.cls, 16);
}

function renderBoardCoach() {
  const v = S.variation;
  const fen = currentFen();
  const turn = fen.split(' ')[1];
  const liveHere = S.live && S.live.fen === fen ? S.live : null;
  const best = liveHere && liveHere.lines[0] ? pvToMoves(fen, liveHere.lines[0].pv, 1)[0] : null;
  const ready = liveHere && liveHere.lines[0] && liveHere.lines[0].depth >= 10;
  const paragraphs = [];
  const actions = [];
  let title = 'Analysebrett';
  let cls = null;

  if (v.idx > 0) {
    const m = v.moves[v.idx - 1];
    const before = v.idx === 1 ? S.game.startFen : v.moves[v.idx - 2].fen;
    const fp = before.split(' ');
    const ply = ((+fp[5] || 1) - 1) * 2 + (fp[1] === 'b' ? 1 : 0);
    const j = judgeMove(v, v.idx);
    title = j ? `${sanDe(m.san)} ist ${CLASSES[j.cls].noun}` : sanDe(m.san);
    cls = j ? j.cls : null;
    const what = describeMove(before, m, v.idx > 1 ? v.moves[v.idx - 2] : null, ply);
    if (what) paragraphs.push(`${SIDE[m.color]} ${what}.`);
    if (j && j.best && BAD.has(j.cls)) {
      const better = pvToMoves(before, [j.best], 1)[0];
      if (better) paragraphs.push(`Besser war **${sanDe(better.san)}**.`);
      actions.push({ label: 'Zug zurücknehmen', icon: 'back', run: () => boardGo(v.idx - 1) });
    }
  } else {
    paragraphs.push('Zieh für beide Seiten – die Engine rechnet mit. Über „Stellung bearbeiten“ baust du jede beliebige Stellung auf.');
  }

  if (liveHere && liveHere.terminal) {
    paragraphs.push(liveHere.terminal.terminal === 'mate' ? `Schachmatt! ${SIDE[turn === 'w' ? 'b' : 'w']} gewinnt.` : 'Remis – hier geht nichts mehr.');
  } else if (ready && best) {
    paragraphs.push(`Bester Zug für ${SIDE[turn]}: **${sanDe(best.san)}**.`);
    actions.push({ label: `${sanDe(best.san)} spielen`, icon: 'arrow', primary: true, run: () => playLine(0) });
  } else {
    paragraphs.push('Die Engine rechnet …');
  }
  setCoach({ cls, title, chip: ready || (liveHere && liveHere.terminal) ? currentEval() : null, paragraphs, actions });
}

init();
