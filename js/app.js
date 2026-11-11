// Hauptlogik: Partie laden → analysieren → Übersicht → Zug für Zug mit Coach.
import { Chess } from '../vendor/chess.js';
import { openEditor, bindEditor } from './editor.js';
import { Board } from './board.js';
import { AnalysisPool, LiveEngine } from './engine.js';
import { reviewGame, winPct, evalText, CLASSES, CLASS_ORDER, BAD } from './analysis.js';
import { explainMove, summarize, resultText, describeMove, pvToMoves, lineText, sanDe, say } from './coach.js';
import { parseGameLink, loadByLink, gameFromPgn, gameFromArchive, fetchRecentGames, fetchAvatar, LoadError } from './chesscom.js';
import { materialInfo } from './tactics.js';
import { classIcon, uiIcon } from './icons.js';
import { playSound, setSoundEnabled } from './sound.js';
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
  set(key, value) {
    try {
      localStorage.setItem('ca.' + key, JSON.stringify(value));
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
  settings: { theme: 'green', pieces: 'cburnett', depth: 16, sound: true, ...store.get('settings', {}) },
  username: store.get('username', ''),
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
let board;

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function init() {
  board = new Board($('board'), { getMoves: legalTargets, onMove: onUserMove });
  applySettings();
  buildStaticIcons();
  buildSettingsDialog();
  bindEvents();
  renderHistory();
  $('user-input').value = S.username;
  bindEditor({ board, $, setCoach, uiIcon, copyText, pieceSet: () => S.settings.pieces, onPlay: (fen) => openBoard(fen), onCancel: closeEditor });
  routeFromHash();
  watchHostBadge();
}

/**
 * Manche Hoster blenden unten rechts ein Badge ein. Damit es keine Knöpfe verdeckt,
 * hält die Seite dort genau so viel Platz frei, wie das Badge hoch ist.
 */
function watchHostBadge() {
  const apply = () => {
    const frame = document.getElementById('nl-badge-frame') || document.getElementById('nl-hud-frame');
    const h = frame ? Math.ceil(frame.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--dock', h + 'px');
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.body, { childList: true });
  obs.observe(document.documentElement, { childList: true });
  window.addEventListener('resize', apply);
  apply();
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
  $('f1').innerHTML = ['brilliant', 'best', 'blunder'].map((c) => classIcon(c, 26)).join('');
  $('f2').innerHTML = classIcon('great', 26) + classIcon('book', 26);
  $('f3').innerHTML = classIcon('excellent', 26) + classIcon('miss', 26);
}

function applySettings() {
  const t = THEMES[S.settings.theme] || THEMES.green;
  document.documentElement.style.setProperty('--sq-light', t.light);
  document.documentElement.style.setProperty('--sq-dark', t.dark);
  if (!PIECE_SETS[S.settings.pieces]) S.settings.pieces = 'cburnett';
  board.setPieceSet(S.settings.pieces);
  setSoundEnabled(S.settings.sound);
  $('btn-sound').innerHTML = uiIcon(S.settings.sound ? 'sound' : 'mute', 20);
  store.set('settings', S.settings);
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
  };
  draw();
  $('settings').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === $('settings')) $('settings').close();
    if (!b) return;
    if (b.dataset.theme) S.settings.theme = b.dataset.theme;
    else if (b.dataset.pieces) S.settings.pieces = b.dataset.pieces;
    else if (b.dataset.depth) S.settings.depth = +b.dataset.depth;
    else return;
    applySettings();
    draw();
  });
  $('btn-settings').onclick = () => $('settings').showModal();
  $('settings-close').onclick = () => $('settings').close();
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
  $('btn-new').onclick = goHome;
  $('btn-board').onclick = () => openBoard(S.mode === 'game' && S.view === 'moves' ? currentFen() : null);
  $('btn-board-home').onclick = () => openBoard();
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
    applySettings();
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
  $('moments').addEventListener('click', (e) => {
    const b = e.target.closest('.moment');
    if (b) { showMoves(); go(+b.dataset.ply); }
  });

  $('moves').addEventListener('click', (e) => {
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
    if (S.view !== 'moves' && S.view !== 'overview') return;
    if (e.target.closest('input, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') {
      if (S.view === 'overview') { showMoves(); go(0); } else next();
    } else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Home' || e.key === 'ArrowUp') $('ctl-first').click();
    else if (e.key === 'End' || e.key === 'ArrowDown') $('ctl-last').click();
    else if (e.key.toLowerCase() === 'f') flip();
    else if (e.key.toLowerCase() === 'n' && S.view === 'moves' && S.mode === 'game') nextKey();
    else return;
    e.preventDefault();
  });
  window.addEventListener('resize', () => {
    if (S.review) renderGraphs();
  });
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
      startGame(gameFromPgn(text));
      return;
    }
    const link = parseGameLink(text);
    if (link) {
      await loadLink(link, username);
      return;
    }
    if (/^[\w-]{2,40}$/.test(text)) {
      showRecentGames(text);
      return;
    }
    setStatus('Das sieht nicht nach einem chess.com-Link, PGN oder Benutzernamen aus.', 'error');
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

async function showRecentGames(username) {
  setStatus(`Lade die letzten Partien von ${username} …`, 'busy');
  try {
    const games = await fetchRecentGames(username);
    setStatus('');
    if (!$('user-input').value.trim()) {
      $('user-input').value = username;
      rememberUser();
    }
    const me = username.toLowerCase();
    $('games-title').textContent = `Letzte Partien von ${username}`;
    const list = $('games-list');
    list.innerHTML = games.length ? '' : '<li class="game-empty">Keine Partien in den letzten Monaten gefunden.</li>';
    games.forEach((g) => {
      const iAmWhite = g.white.username.toLowerCase() === me;
      const mine = iAmWhite ? g.white : g.black;
      const res = mine.result === 'win' ? 'win' : ['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(mine.result) ? 'loss' : 'draw';
      const li = document.createElement('li');
      const date = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
      li.innerHTML = `<button type="button" class="game-item">
        <span class="game-res ${res}">${{ win: 'S', loss: 'N', draw: 'R' }[res]}</span>
        <span class="game-names">${esc(g.white.username)} <small>(${g.white.rating})</small> – ${esc(g.black.username)} <small>(${g.black.rating})</small></span>
        <span class="game-meta">${esc(timeClassName(g.time_class))} · ${date}</span></button>`;
      li.firstChild.onclick = () => {
        try {
          startGame(gameFromArchive(g));
        } catch (e) {
          reportLoadError(e);
        }
      };
      list.appendChild(li);
    });
    $('games-card').hidden = false;
    $('games-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    reportLoadError(e);
  }
}

function timeClassName(tc) {
  return { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Schnellschach', daily: 'Fernschach' }[tc] || '';
}

function renderHistory() {
  const hist = store.get('history', []);
  $('history-card').hidden = !hist.length;
  $('history-list').innerHTML = hist.map((h) => `<li><button type="button" class="game-item" data-id="${esc(h.id)}">
      <span class="game-res draw">${h.result === '1-0' ? '1' : h.result === '0-1' ? '0' : '½'}</span>
      <span class="game-names">${esc(h.white)} – ${esc(h.black)}</span>
      <span class="game-meta">${esc(h.date || '')}</span></button></li>`).join('');
  $('history-list').onclick = (e) => {
    const b = e.target.closest('.game-item');
    if (b) location.hash = '#' + b.dataset.id;
  };
}

function saveToHistory(game, positions, depth) {
  const hist = store.get('history', []).filter((h) => h.id !== game.id);
  hist.unshift({ id: game.id, white: game.white.name, black: game.black.name, result: game.result, date: game.date });
  const slim = positions.map((p) => ({
    ...p,
    lines: p.lines.map((l) => ({ ...l, pv: l.pv.slice(0, 12) })),
  }));
  while (hist.length > 12) store.del('g.' + hist.pop().id);
  while (!store.set('g.' + game.id, { game, positions: slim, depth }) && hist.length > 1) {
    store.del('g.' + hist.pop().id);
  }
  store.set('history', hist);
}

async function routeFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) {
    if (S.view !== 'home') goHome(true);
    return;
  }
  if (id === 'brett') {
    if (S.mode !== 'board') openBoard();
    return;
  }
  if (S.game && S.game.id === id) return;
  const cached = store.get('g.' + id, null);
  if (cached && cached.game && cached.positions) {
    startGame(cached.game, cached);
    return;
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

function goHome(fromHash) {
  if (S.pool) S.pool.cancel();
  S.pool = null;
  live.stop();
  S.view = 'home';
  S.mode = null;
  S.live = null;
  board.setEditor(null);
  document.querySelector('.panel').classList.remove('is-editor');
  $('pane-editor').hidden = true;
  $('coach').hidden = false;
  S.game = S.review = S.variation = S.retry = null;
  $('review').hidden = true;
  $('home').hidden = false;
  $('btn-new').hidden = true;
  setStatus('');
  renderHistory();
  if (fromHash !== true && location.hash) history.pushState(null, '', location.pathname + location.search);
  document.title = 'Chess Analyzer – kostenlose Partieanalyse';
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

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
  if (S.pool) S.pool.cancel();
  live.stop();
  S.game = game;
  S.mode = 'game';
  board.setEditor(null);
  document.querySelector('.panel').classList.remove('is-editor');
  $('pane-editor').hidden = true;
  $('board-tools').hidden = true;
  $('ctl-overview').hidden = $('ctl-key').hidden = false;
  $('graph-moves').parentElement.hidden = false;
  S.review = null;
  S.variation = S.retry = null;
  S.ply = 0;
  S.view = 'analyzing';
  const me = S.username.toLowerCase();
  S.you = !me ? null : game.white.name.toLowerCase() === me ? 'w' : game.black.name.toLowerCase() === me ? 'b' : null;
  S.orientation = S.you === 'b' ? 'b' : 'w';
  board.setOrientation(S.orientation);

  $('home').hidden = true;
  $('review').hidden = false;
  $('btn-new').hidden = false;
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

  const bookPromise = loadBook();
  let positions;
  if (cached && cached.positions.length === game.fens.length) {
    positions = cached.positions;
  } else {
    const pool = new AnalysisPool();
    S.pool = pool;
    let shown = 0;
    try {
      positions = await pool.analyze(game.fens, {
        depth: S.settings.depth,
        onProgress: (done, total, index) => {
          if (S.pool !== pool) return;
          $('progress-fill').style.width = `${(done / total) * 100}%`;
          $('progress-label').textContent = `Analysiere Stellung ${done} von ${total} …`;
          if (index > shown) {
            shown = index;
            board.setPosition(game.fens[index]);
          }
        },
      });
    } catch (e) {
      if (S.pool !== pool) return; // abgebrochen
      console.error(e);
      setCoach({
        title: 'Die Engine konnte nicht starten',
        paragraphs: ['Stockfish ließ sich in diesem Browser nicht laden. Bitte lade die Seite neu oder probiere einen aktuellen Browser.'],
      });
      $('progress-label').textContent = String(e.message || e);
      return;
    }
    if (S.pool !== pool) return;
    S.pool = null;
    saveToHistory(game, positions, S.settings.depth);
  }
  const book = await bookPromise;
  if (S.game !== game) return;
  S.review = reviewGame(game, positions, book);
  buildMoveList();
  showOverview();
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
    `<tr><td class="n">${r.w ? classIcon(r.w, 20) : '–'}</td><td class="lbl mid">${r.name}</td><td class="n">${r.b ? classIcon(r.b, 20) : '–'}</td></tr>`).join('')}</table>` : '';
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
  highlightMove();
  renderGraphs();
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
  if (ex.best) actions.push({ label: 'Bester Zug', icon: 'star', run: () => showBest(k) });
  if (BAD.has(ex.cls) && ex.best) actions.push({ label: 'Nochmal versuchen', icon: 'retry', run: () => startRetry(k) });
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
  const lines = currentLines();
  if (!lines.length) {
    el.innerHTML = '';
    return;
  }
  const depth = lines[0].depth ? ` · Tiefe ${lines[0].depth}` : '';
  el.innerHTML = `<div class="lines-head">Engine-Linien${depth}</div>` + lines.slice(0, 3).map((l, i) => {
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
  el.innerHTML = `<div class="v-moves"><b>${esc(shown)}</b><span>${esc(rest)}</span></div>`;
}

function buildMoveList() {
  const { game, review } = S;
  let html = '';
  const startsBlack = game.moves[0].color === 'b';
  const first = +game.startFen.split(' ')[5] || 1;
  const cell = (k) => {
    const m = game.moves[k];
    return `<button type="button" class="mv" data-ply="${k + 1}">${classIcon(review.moves[k].cls, 16)}<span>${esc(sanDe(m.san))}</span></button>`;
  };
  let k = 0;
  let num = first;
  if (startsBlack) {
    html += `<div class="move-row"><span class="move-num">${num}.</span><span></span>${cell(0)}</div>`;
    k = 1;
    num++;
  }
  for (; k < game.moves.length; k += 2, num++) {
    html += `<div class="move-row"><span class="move-num">${num}.</span>${cell(k)}${k + 1 < game.moves.length ? cell(k + 1) : '<span></span>'}</div>`;
  }
  html += `<div class="result-row">${esc(game.result === '*' ? '' : game.result.replace('1/2-1/2', '½–½'))}</div>`;
  $('moves').innerHTML = html;
}

function highlightMove() {
  const box = $('moves');
  box.querySelectorAll('.mv.active').forEach((el) => el.classList.remove('active'));
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
  if (S.pool) S.pool.cancel();
  S.pool = null;
  live.stop();
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

  board.setEditor(null);
  document.querySelector('.panel').classList.remove('is-editor');
  $('home').hidden = true;
  $('review').hidden = false;
  $('btn-new').hidden = false;
  $('coach').hidden = false;
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
