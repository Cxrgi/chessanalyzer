// Synchronisierung: Alle angemeldeten Geräte teilen sich einen Stand (Fortschritt, Statistik, Trainingskarten,
// Einstellungen, analysierte Partien). Bewusst sparsam: ein Abruf beim Öffnen, danach wird nur hochgeladen,
// wenn sich etwas geändert hat – gebündelt und höchstens alle zwei Minuten.
import { db } from './db.js';
import { mergeStates, sameState, emptyState } from './sync-merge.js';
import { buildPgn, packPgn, unpackPgn } from './pgn.js';

/** Was aus dem Browser-Speicher mitgenommen wird (gerätebezogene Kleinigkeiten wie das Analysebrett bleiben lokal). */
export const SYNC_KEYS = ['settings', 'username', 'site', 'puzzles', 'lessons', 'activity', 'play', 'endgames', 'wins', 'ratings', 'trainers'];
const BOOK = 'ca.sync'; // Buchführung dieses Geräts (wird nicht synchronisiert)
const PUSH_DELAY = 30000;
const PUSH_GAP = 120000;
const PULL_GAP = 10 * 60000;
const UPLOADS_PER_RUN = 30;

let d = null; // { onApplied(), onStatus() }
const X = { available: null, busy: false, timer: null, error: null, started: false };
let decide;
const decided = new Promise((resolve) => { decide = resolve; }); // steht fest, ob es hier eine Synchronisierung gibt?

function book() {
  try {
    return { rev: 0, at: 0, pushed: 0, stamps: {}, del: {}, up: [], dirty: false, off: false, n: 0, ...JSON.parse(localStorage.getItem(BOOK) || '{}') };
  } catch (e) {
    return { rev: 0, at: 0, pushed: 0, stamps: {}, del: {}, up: [], dirty: false, off: false, n: 0 };
  }
}
function saveBook(b) {
  try { localStorage.setItem(BOOK, JSON.stringify(b)); } catch (e) { /* voll – dann eben ohne Buchführung */ }
}

const readKey = (k) => {
  try {
    const v = localStorage.getItem('ca.' + k);
    return v == null ? undefined : JSON.parse(v);
  } catch (e) {
    return undefined;
  }
};

/** Aktueller Stand dieses Geräts. */
export async function collect() {
  const b = book();
  const state = emptyState();
  for (const k of SYNC_KEYS) {
    const v = readKey(k);
    if (v !== undefined) state.keys[k] = { v, at: b.stamps[k] || 1 };
  }
  for (const e of await db.all('meta').catch(() => [])) state.meta[e.key] = e.value;
  for (const e of await db.all('cards').catch(() => [])) state.cards[e.key] = e.value;
  for (const e of await db.all('notes').catch(() => [])) state.notes[e.key] = e.value;
  state.del = { ...b.del };
  return state;
}

/** Schreibt einen zusammengeführten Stand auf dieses Gerät. */
async function apply(merged, local) {
  const b = book();
  for (const [k, e] of Object.entries(merged.keys)) {
    if (!SYNC_KEYS.includes(k)) continue;
    try { localStorage.setItem('ca.' + k, JSON.stringify(e.v)); } catch (err) { /* Speicher voll */ }
    b.stamps[k] = e.at;
  }
  b.del = { ...merged.del };
  saveBook(b);
  for (const [store, kind] of [['meta', 'g:'], ['cards', 'c:'], ['notes', 'n:']]) {
    const fresh = Object.entries(merged[store]).filter(([id, v]) => JSON.stringify(local[store][id]) !== JSON.stringify(v));
    if (fresh.length) await db.setMany(store, fresh);
    for (const id of Object.keys(local[store])) {
      if (merged[store][id]) continue;
      await db.del(store, id);
      if (kind === 'g:') await db.del('games', id);
    }
  }
}

const api = (path, init) => fetch('api/sync' + path, { cache: 'no-store', ...init });

export function initSync(deps) {
  d = deps;
  document.addEventListener('visibilitychange', () => {
    if (!X.started) return;
    const b = book();
    if (document.hidden && b.dirty) syncNow();
    else if (!document.hidden && Date.now() - b.at > PULL_GAP) syncNow();
  });
}

/** Startet die Synchronisierung (nur wenn die Seite mit Passwortschutz läuft – sonst gibt es keinen gemeinsamen Speicher). */
export function startSync() {
  X.started = true;
  decide();
  if (!book().off) syncNow();
  else notify();
}

/** Diese Seite läuft ohne gemeinsamen Speicher (kein Passwortschutz oder rein statisches Hosting). */
export function skipSync() {
  X.available = false;
  decide();
  notify();
}

export function syncInfo() {
  const b = book();
  return { available: X.available, off: b.off, busy: X.busy, at: b.at, dirty: b.dirty, error: X.error, started: X.started };
}

export function setSyncOff(off) {
  const b = book();
  b.off = off;
  saveBook(b);
  if (!off) syncNow();
  else notify();
}

function notify() {
  if (d && d.onStatus) d.onStatus(syncInfo());
}

/** Merkt eine Änderung vor: key = geänderter Speicher-Schlüssel (oder nichts bei Partien/Karten). */
export function touch(key) {
  if (key && !SYNC_KEYS.includes(key)) return;
  const b = book();
  if (key) b.stamps[key] = Date.now();
  b.dirty = true;
  b.n++;
  saveBook(b);
  schedule();
}

/** Merkt etwas Gelöschtes vor (kind: 'g' = Partie, 'c' = Trainingskarte). */
export function forget(kind, id) {
  const b = book();
  b.del[`${kind}:${id}`] = Date.now();
  b.up = b.up.filter((x) => x !== id);
  b.dirty = true;
  b.n++;
  saveBook(b);
  schedule();
  if (kind === 'g' && X.available && !b.off) api('/game?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
}

function schedule() {
  if (!X.started || X.available === false || X.timer) return;
  const b = book();
  if (b.off) return;
  const wait = Math.max(PUSH_DELAY, b.pushed + PUSH_GAP - Date.now());
  X.timer = setTimeout(() => {
    X.timer = null;
    syncNow();
  }, wait);
}

/** Beim Zurückkehren zur Startseite: nachsehen, falls der letzte Abgleich länger her ist. */
export function syncIfStale() {
  if (!X.started) return;
  const b = book();
  if (!b.off && (Date.now() - b.at > PULL_GAP || (b.dirty && Date.now() - b.pushed > PUSH_GAP))) syncNow();
}

/** Vor dem Abmelden: alles Offene hochladen. Gibt false zurück, wenn danach noch etwas ungespeichert ist. */
export async function flushSync() {
  if (!X.started || X.available === false) return true;
  for (let i = 0; i < 100 && X.busy; i++) await new Promise((r) => setTimeout(r, 100));
  clearTimeout(X.timer);
  X.timer = null;
  const ok = await syncNow();
  return ok && !book().dirty;
}

/** Ein kompletter Abgleich: holen, zusammenführen, bei Bedarf hochladen. */
export async function syncNow() {
  if (X.busy || X.available === false || !X.started) return false;
  if (book().off) return false;
  X.busy = true;
  X.error = null;
  notify();
  try {
    let b = book();
    let res = await api('?rev=' + b.rev);
    if (res.status === 404 || res.status === 401) {
      X.available = false;
      return false;
    }
    if (!res.ok) throw new Error('status ' + res.status);
    X.available = true;
    let remote = await res.json();
    for (let round = 0; round < 4; round++) {
      const mark = book().n; // ändert der Nutzer währenddessen etwas, bleibt das für den nächsten Abgleich vorgemerkt
      const local = await collect();
      b = book();
      const merged = remote.same || !remote.data ? local : mergeStates(local, remote.data);
      const changedLocal = !sameState(merged, local);
      if (changedLocal) await apply(merged, local);
      const needPush = remote.same ? b.dirty : !remote.data || !sameState(merged, remote.data);
      if (!needPush) {
        b = book();
        Object.assign(b, { rev: remote.rev, at: Date.now(), dirty: b.n !== mark });
        saveBook(b);
        if (changedLocal && d.onApplied) d.onApplied();
        break;
      }
      res = await api('', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: remote.rev, data: merged }) });
      if (res.status === 409) {
        remote = await res.json(); // ein anderes Gerät war schneller – noch einmal zusammenführen
        continue;
      }
      if (!res.ok) throw new Error('status ' + res.status);
      const { rev } = await res.json();
      b = book();
      Object.assign(b, { rev, at: Date.now(), pushed: Date.now(), dirty: b.n !== mark });
      saveBook(b);
      if (changedLocal && d.onApplied) d.onApplied();
      break;
    }
    await uploadGames();
    if (book().dirty) schedule();
    return true;
  } catch (e) {
    X.error = navigator.onLine === false ? 'offline' : 'failed';
    return false;
  } finally {
    X.busy = false;
    notify();
  }
}

/** Lädt Analysen hoch, die der Server noch nicht hat (jede Partie genau einmal). */
async function uploadGames() {
  const b = book();
  const done = new Set(b.up);
  const pending = (await db.all('meta').catch(() => [])).map((e) => e.key).filter((id) => !done.has(id)).slice(0, UPLOADS_PER_RUN);
  let changed = false;
  for (const id of pending) {
    const g = await db.get('games', id).catch(() => null);
    if (g && g.game && g.positions && g.positions.length) {
      const res = await api('/game?id=' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) });
      if (!res.ok && res.status !== 413 && res.status !== 400) break;
    }
    // Auch Partien ohne lokale Analyse gelten als erledigt: Sie stammen von einem anderen Gerät und liegen dort schon.
    done.add(id);
    changed = true;
  }
  if (changed) {
    const nb = book();
    nb.up = [...done].slice(-3000);
    saveBook(nb);
  }
}

/** Holt die Analyse einer Partie, die auf einem anderen Gerät entstanden ist. */
export async function fetchGame(id) {
  await Promise.race([decided, new Promise((r) => setTimeout(r, 2500))]);
  if (!X.started || X.available === false || book().off) return null;
  try {
    const res = await api('/game?id=' + encodeURIComponent(id));
    if (!res.ok) return null;
    const g = await res.json();
    if (!g || !g.game || !g.positions) return null;
    await db.set('games', id, g);
    const b = book();
    if (!b.up.includes(id)) {
      b.up.push(id);
      saveBook(b);
    }
    return g;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sicherungs-Code: derselbe Stand als Text zum Kopieren und Einfügen
// ---------------------------------------------------------------------------

const PREFIX = 'CA1.';

/** Stand dieses Geräts als kopierbarer Code (Partien als PGN, die Analyse wird beim Öffnen neu berechnet). */
export async function exportCode() {
  const state = await collect();
  const pgns = {};
  for (const e of await db.all('games').catch(() => [])) {
    if (!state.meta[e.key]) continue;
    try {
      pgns[e.key] = e.value.pgn || buildPgn(e.value.game);
    } catch (err) { /* Partie überspringen */ }
  }
  return { code: PREFIX + await packPgn(JSON.stringify({ ...state, pgns })), games: Object.keys(state.meta).length };
}

/** Spielt einen Sicherungs-Code ein: Er wird mit dem Stand dieses Geräts zusammengeführt, nichts wird überschrieben. */
export async function importCode(text) {
  const code = String(text || '').replace(/\s+/g, '');
  if (!code.startsWith(PREFIX)) throw new Error('kein Code');
  const data = JSON.parse(await unpackPgn(code.slice(PREFIX.length)));
  if (!data || data.v !== 1 || typeof data.keys !== 'object') throw new Error('kein Code');
  const { pgns = {}, ...incoming } = data;
  const local = await collect();
  const merged = mergeStates(local, incoming);
  await apply(merged, local);
  for (const [id, pgn] of Object.entries(pgns)) {
    if (!merged.meta[id] || typeof pgn !== 'string') continue;
    if (!(await db.get('games', id).catch(() => null))) await db.set('games', id, { pgn, at: Date.now() });
  }
  touch();
  if (d && d.onApplied) d.onApplied();
  return { games: Object.keys(merged.meta).length };
}
