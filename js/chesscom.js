// Laden von Partien: chess.com-Link, Benutzername (öffentliche API) oder PGN.
import { Chess } from '../vendor/chess.js';

const TCN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PUB = 'https://api.chess.com/pub';

export class LoadError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Link erkennen
// ---------------------------------------------------------------------------

/** Liest Partie-Typ und ID aus einem chess.com-Link. Gibt null zurück, wenn es kein Link ist. */
export function parseGameLink(input) {
  const text = String(input || '').trim();
  if (!/chess\.com/i.test(text) && !/^\d{6,}$/.test(text)) return null;
  if (/^\d{6,}$/.test(text)) return { type: null, id: text };
  const hash = text.match(/[#&?]g=(\d{5,})/);
  const idMatch = hash ? hash[1] : (text.split(/[?#]/)[0].match(/\/(\d{5,})(?:\/|$)/g) || []).pop();
  if (!idMatch) return null;
  const id = idMatch.replace(/\D/g, '');
  let type = null;
  if (/\/daily\b/i.test(text)) type = 'daily';
  else if (/\/live\b/i.test(text)) type = 'live';
  else if (/\/computer\b/i.test(text)) type = 'computer';
  return { type, id };
}

// ---------------------------------------------------------------------------
// TCN (kompaktes Zugformat von chess.com) dekodieren
// ---------------------------------------------------------------------------

export function decodeTcn(tcn) {
  const moves = [];
  for (let i = 0; i + 1 < tcn.length; i += 2) {
    const from = TCN.indexOf(tcn[i]);
    let to = TCN.indexOf(tcn[i + 1]);
    const move = {};
    if (to > 63) {
      move.promotion = 'qnrbkp'[Math.floor((to - 64) / 3)];
      to = from + (from < 16 ? -8 : 8) + ((to - 1) % 3) - 1;
    }
    if (from > 75) throw new LoadError('variant', 'Diese Partie ist keine normale Schachpartie.');
    move.from = TCN[from % 8] + (Math.floor(from / 8) + 1);
    move.to = TCN[to % 8] + (Math.floor(to / 8) + 1);
    moves.push(move);
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Einheitliches Partie-Objekt bauen
// ---------------------------------------------------------------------------

function buildGame(meta, startFen, moveInputs, clocks) {
  const chess = new Chess(startFen || START_FEN);
  const fens = [chess.fen()];
  const moves = [];
  moveInputs.forEach((input, i) => {
    let m;
    try {
      // Fernschach-Partien kodieren die Rochade als „König schlägt Turm“
      if (typeof input === 'object') {
        const a = chess.get(input.from), b = chess.get(input.to);
        if (a && b && a.type === 'k' && b.type === 'r' && a.color === b.color) {
          input = { from: input.from, to: (input.to[0] > input.from[0] ? 'g' : 'c') + input.from[1] };
        }
      }
      m = chess.move(input);
    } catch (e) {
      throw new LoadError('variant', 'Die Züge dieser Partie konnten nicht gelesen werden (evtl. eine Schachvariante).');
    }
    moves.push({
      san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color,
      captured: m.captured || null, promotion: m.promotion || null,
      uci: m.from + m.to + (m.promotion || ''),
      castle: m.isKingsideCastle() ? 'k' : m.isQueensideCastle() ? 'q' : null,
      enPassant: m.isEnPassant(),
      clock: clocks && clocks[i] != null ? clocks[i] : null,
    });
    fens.push(chess.fen());
  });
  if (!moves.length) throw new LoadError('empty', 'Diese Partie enthält keine Züge.');
  return {
    id: meta.id || 'pgn-' + hash(fens[fens.length - 1] + moves.length + (meta.white?.name || '')),
    url: meta.url || null,
    white: { name: 'Weiß', rating: null, avatar: null, ...meta.white },
    black: { name: 'Schwarz', rating: null, avatar: null, ...meta.black },
    result: meta.result || '*',
    termination: meta.termination || '',
    date: meta.date || '',
    timeControl: meta.timeControl || '',
    timeClass: meta.timeClass || '',
    openingHint: meta.openingHint || '',
    startFen: fens[0],
    moves,
    fens,
  };
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function parseClocks(pgn) {
  const out = [];
  const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
  let m;
  while ((m = re.exec(pgn))) out.push(+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]));
  return out;
}

function pgnHeader(pgn, key) {
  const m = pgn.match(new RegExp('\\[' + key + '\\s+"([^"]*)"\\]'));
  return m ? m[1] : '';
}

function openingFromEcoUrl(url) {
  if (!url) return '';
  const slug = url.split('/openings/')[1];
  if (!slug) return '';
  return slug.replace(/-\d+\..*$/, '').replace(/-/g, ' ').trim();
}

function timeClassOf(tc) {
  if (!tc) return '';
  if (tc.includes('/')) return 'daily';
  const [base, inc] = tc.split('+').map(Number);
  const est = base + 40 * (inc || 0);
  if (est < 180) return 'bullet';
  if (est < 600) return 'blitz';
  return 'rapid';
}

/** Partie aus der Antwort des chess.com-Spiel-Endpunkts (über den Proxy). */
export function gameFromCallback(data, type) {
  const g = data && data.game;
  if (!g || !g.moveList) throw new LoadError('notfound', 'Die Partie wurde nicht gefunden.');
  if (g.type && g.type !== 'chess') {
    throw new LoadError('variant', `Nur normales Schach wird unterstützt (diese Partie: ${g.typeName || g.type}).`);
  }
  const h = g.pgnHeaders || {};
  const players = Object.values(data.players || {});
  const side = (color) => {
    const p = players.find((x) => x && x.color === color) || {};
    return {
      name: p.username || (color === 'white' ? h.White : h.Black) || (color === 'white' ? 'Weiß' : 'Schwarz'),
      rating: p.rating || (color === 'white' ? h.WhiteElo : h.BlackElo) || null,
      avatar: p.avatarUrl || null,
    };
  };
  let clocks = null;
  if (g.moveTimestamps && type !== 'daily') {
    clocks = String(g.moveTimestamps).split(',').map((x) => Number(x) / 10);
  }
  const tc = h.TimeControl || '';
  return buildGame({
    id: `${type}-${g.id}`,
    url: `https://www.chess.com/game/${type}/${g.id}`,
    white: side('white'),
    black: side('black'),
    result: h.Result || '*',
    termination: g.resultMessage || h.Termination || '',
    date: (h.Date || '').replace(/\./g, '-'),
    timeControl: tc,
    timeClass: type === 'daily' ? 'daily' : timeClassOf(tc),
  }, g.initialSetup || h.FEN || START_FEN, decodeTcn(g.moveList), clocks);
}

/** Partie aus einem Eintrag des öffentlichen Monatsarchivs. */
export function gameFromArchive(a) {
  if (a.rules && a.rules !== 'chess') {
    throw new LoadError('variant', `Nur normales Schach wird unterstützt (diese Partie: ${a.rules}).`);
  }
  const link = parseGameLink(a.url) || { type: 'live', id: hash(a.url) };
  const pgn = a.pgn || '';
  const meta = {
    id: `${link.type || 'live'}-${link.id}`,
    url: a.url,
    white: { name: a.white.username, rating: a.white.rating },
    black: { name: a.black.username, rating: a.black.rating },
    result: pgnHeader(pgn, 'Result') || resultFromArchive(a),
    termination: pgnHeader(pgn, 'Termination'),
    date: (pgnHeader(pgn, 'Date') || '').replace(/\./g, '-'),
    timeControl: a.time_control || '',
    timeClass: a.time_class || '',
    openingHint: openingFromEcoUrl(a.eco),
  };
  const clocks = a.time_class === 'daily' ? null : parseClocks(pgn);
  if (a.tcn) return buildGame(meta, a.initial_setup || START_FEN, decodeTcn(a.tcn), clocks);
  return gameFromPgn(pgn, meta);
}

function resultFromArchive(a) {
  if (a.white.result === 'win') return '1-0';
  if (a.black.result === 'win') return '0-1';
  return '1/2-1/2';
}

/** Partie aus eingefügtem PGN-Text. */
export function gameFromPgn(pgn, metaOverride) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn.trim(), { strict: false });
  } catch (e) {
    throw new LoadError('pgn', 'Das PGN konnte nicht gelesen werden. Bitte prüfe den Text.');
  }
  const h = chess.getHeaders ? chess.getHeaders() : chess.header();
  const history = chess.history({ verbose: true });
  const startFen = history.length ? history[0].before : chess.fen();
  const link = parseGameLink(h.Link || h.Site || '');
  const meta = metaOverride || {
    id: link && link.type ? `${link.type}-${link.id}` : null,
    url: h.Link || null,
    white: { name: h.White && h.White !== '?' ? h.White : 'Weiß', rating: h.WhiteElo && h.WhiteElo !== '?' ? h.WhiteElo : null },
    black: { name: h.Black && h.Black !== '?' ? h.Black : 'Schwarz', rating: h.BlackElo && h.BlackElo !== '?' ? h.BlackElo : null },
    result: h.Result || '*',
    termination: h.Termination || '',
    date: (h.Date || '').replace(/\./g, '-').replace(/\?/g, ''),
    timeControl: h.TimeControl || '',
    timeClass: timeClassOf(h.TimeControl || ''),
    openingHint: openingFromEcoUrl(h.ECOUrl) || h.Opening || '',
  };
  const clocks = parseClocks(pgn);
  return buildGame(meta, startFen, history.map((m) => ({ from: m.from, to: m.to, promotion: m.promotion })),
    clocks.length === history.length ? clocks : null);
}

// ---------------------------------------------------------------------------
// Netzwerk
// ---------------------------------------------------------------------------

async function fetchJson(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return JSON.parse(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

const callbackUrl = (type, id) => `https://www.chess.com/callback/${type}/game/${id}`;

/** Eigener Proxy (server.js bzw. Netlify-Funktion). Auf rein statischem Hosting nicht vorhanden. */
let proxyMissing = false;
async function viaOwnProxy(type, id) {
  if (proxyMissing) throw new Error('kein Proxy');
  let data;
  try {
    data = await fetchJson(`api/game?type=${type}&id=${id}`, { timeout: 15000 });
  } catch (e) {
    if (e.status === 401) throw new LoadError('auth', 'Deine Anmeldung ist abgelaufen. Bitte lade die Seite neu und melde dich wieder an.');
    // 404 oder HTML statt JSON → auf diesem Server gibt es keinen Proxy
    if (e.name !== 'AbortError') proxyMissing = true;
    throw e;
  }
  if (data.error === 'notfound') throw new LoadError('notfound-here', 'nicht gefunden');
  if (data.error) throw new Error(data.error);
  return data;
}

/** Öffentliche CORS-Proxys als Notlösung für rein statisches Hosting. */
async function viaPublicProxy(type, id) {
  const target = callbackUrl(type, id);
  const urls = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(target),
    'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(target),
  ];
  return Promise.any(urls.map(async (u) => {
    const data = await fetchJson(u, { timeout: 8000 });
    if (!data || !data.game) throw new Error('ungültige Antwort');
    return data;
  }));
}

async function fetchArchiveList(username) {
  try {
    const data = await fetchJson(`${PUB}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
    return data.archives || [];
  } catch (e) {
    if (e.status === 404) throw new LoadError('nouser', `Den Benutzer „${username}“ gibt es auf chess.com nicht.`);
    throw new LoadError('network', 'chess.com ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sucht eine Partie anhand ihrer ID in den Monatsarchiven eines Spielers (neueste zuerst). */
async function findInArchives(username, id, { maxMonths = 36, onStatus } = {}) {
  const archives = (await fetchArchiveList(username)).slice().reverse().slice(0, maxMonths);
  for (const url of archives) {
    const label = url.split('/').slice(-2).join('/');
    onStatus && onStatus(`Durchsuche das Archiv ${label} …`);
    let data;
    try {
      data = await fetchJson(url, { timeout: 20000 });
    } catch (e) {
      continue;
    }
    const hit = (data.games || []).find((g) => g.url && g.url.split('/').pop() === String(id));
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

/**
 * Lädt eine Partie über ihren Link.
 * Reihenfolge: eigener Proxy → Archiv des gespeicherten Benutzers → öffentliche Proxys.
 * Scheitert alles, wird LoadError('needuser') geworfen – dann fragt die Oberfläche nach dem Benutzernamen.
 */
export async function loadByLink(link, { username, onStatus, deep = false } = {}) {
  const types = link.type ? [link.type] : ['live', 'daily'];
  onStatus && onStatus('Lade die Partie von chess.com …');

  if (!deep) {
    let misses = 0;
    for (const type of types) {
      try {
        return gameFromCallback(await viaOwnProxy(type, link.id), type);
      } catch (e) {
        if (e instanceof LoadError && e.code === 'notfound-here') misses++;
        else if (e instanceof LoadError) throw e;
      }
    }
    if (misses === types.length) {
      throw new LoadError('notfound', 'Diese Partie gibt es auf chess.com nicht (mehr). Stimmt der Link?');
    }
  }
  if (username) {
    const hit = await findInArchives(username, link.id, { maxMonths: deep ? 60 : 3, onStatus });
    if (hit) return gameFromArchive(hit);
    if (deep) {
      throw new LoadError('notfound', `In den Partien von „${username}“ wurde diese Partie nicht gefunden. Stimmt der Benutzername?`);
    }
  }
  onStatus && onStatus('Lade die Partie von chess.com …');
  for (const type of types) {
    try {
      return gameFromCallback(await viaPublicProxy(type, link.id), type);
    } catch (e) {
      if (e instanceof LoadError) throw e;
    }
  }
  throw new LoadError('needuser', 'Für diesen Link wird dein chess.com-Benutzername gebraucht.');
}

/** Die letzten Partien eines Spielers (für die Auswahlliste). */
export async function fetchRecentGames(username, { months = 2 } = {}) {
  const archives = (await fetchArchiveList(username)).slice().reverse().slice(0, months);
  const games = [];
  for (const url of archives) {
    try {
      const data = await fetchJson(url, { timeout: 20000 });
      games.push(...(data.games || []));
    } catch (e) { /* Monat überspringen */ }
    if (games.length >= 30) break;
  }
  return games
    .filter((g) => !g.rules || g.rules === 'chess')
    .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
    .slice(0, 50);
}

/** Profilbild eines Spielers (optional, Fehler werden ignoriert). */
export async function fetchAvatar(username) {
  try {
    const data = await fetchJson(`${PUB}/player/${encodeURIComponent(username.toLowerCase())}`, { timeout: 8000 });
    return data.avatar || null;
  } catch (e) {
    return null;
  }
}
