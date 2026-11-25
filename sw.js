// Service Worker: macht die Seite offline nutzbar und spart Anfragen an den Server.
// Bei jeder Veröffentlichung VERSION ändern – dann holen sich alle Geräte die neuen Dateien.
const VERSION = '2026-11-25';
const CACHE = 'ca-' + VERSION;
const DAY = 24 * 60 * 60 * 1000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('ca-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

/** Legt eine Antwort mit Zeitstempel in den Zwischenspeicher. */
async function store(cache, key, res) {
  const headers = new Headers(res.headers);
  headers.set('x-cached-at', String(Date.now()));
  const body = await res.clone().arrayBuffer();
  await cache.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers }));
}

/**
 * Erst der Zwischenspeicher, sonst das Netz.
 * refresh = true: höchstens einmal am Tag im Hintergrund nachsehen, ob es eine neuere Fassung gibt.
 */
async function cacheFirst(request, refresh) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const load = async () => {
    const res = await fetch(request);
    if (res.ok && res.status === 200) await store(cache, request, res);
    return res;
  };
  if (!hit) return load();
  if (refresh && Date.now() - Number(hit.headers.get('x-cached-at') || 0) > DAY) load().catch(() => {});
  return hit;
}

/** Die Seite selbst: immer zuerst das Netz (dort sitzt der Passwortschutz), offline die gespeicherte Fassung. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && !res.headers.has('x-gate')) await store(cache, './', res);
    return res;
  } catch (e) {
    const hit = await cache.match('./');
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.includes('/api/') || path.includes('/.netlify/') || path.endsWith('/sw.js') || /\/(admin|impressum|datenschutz)$/.test(path)) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (/\/(vendor|assets|data)\//.test(path)) event.respondWith(cacheFirst(request, false));
  else if (/\/(js|css)\//.test(path) || path.endsWith('/manifest.webmanifest')) event.respondWith(cacheFirst(request, true));
});
