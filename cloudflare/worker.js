// Cloudflare Worker: liefert die Seite aus (Dateien im KV-Speicher „SITE“, Verzeichnis in site-manifest.json),
// übernimmt Anmeldung, Konten, Verwaltung und Abgleich (server/gate.mjs) und holt Partien von chess.com (/api/game).
// Gespeichert wird in einer D1-Datenbank: eine Tabelle „kv“ mit den Bereichen „auth“ (Konten, Einstellungen)
// und „sync“ (Stand und Partien je Konto) – dieselben Schlüssel wie früher in Netlify Blobs.
import { handleGate } from '../server/gate.mjs';
import { fetchGame } from '../server/proxy.mjs';
import SITE from './site-manifest.json';

/** Schlüssel-Wert-Speicher auf D1 mit derselben Schnittstelle wie der Datei- bzw. Blob-Speicher. */
function d1Store(db, store) {
  return {
    async get(key) {
      const row = await db.prepare('SELECT value FROM kv WHERE store = ?1 AND key = ?2').bind(store, key).first();
      return row ? row.value : null;
    },
    async set(key, text) {
      await db.prepare('INSERT INTO kv (store, key, value, updated) VALUES (?1, ?2, ?3, ?4) '
        + 'ON CONFLICT (store, key) DO UPDATE SET value = excluded.value, updated = excluded.updated').bind(store, key, text, Date.now()).run();
    },
    async delete(key) {
      await db.prepare('DELETE FROM kv WHERE store = ?1 AND key = ?2').bind(store, key).run();
    },
    async list(prefix) {
      // Bereichsabfrage statt LIKE: nutzt den Index und hat keine Probleme mit _ oder % im Präfix
      const { results } = await db.prepare('SELECT key FROM kv WHERE store = ?1 AND key >= ?2 AND key < ?3 ORDER BY key')
        .bind(store, prefix, prefix + '￿').all();
      return results.map((r) => r.key);
    },
  };
}

// Frei zugänglich (ohne Anmeldung): Bilder, Engine, Stylesheet, freie Daten – wie früher auf Netlify
const UNGATED = /^\/(vendor|assets|css|data)\/|^\/manifest\.webmanifest$/;

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; form-action 'self'",
  // „cross-origin isolated“: erst dann darf die Live-Engine mehrere Prozessorkerne nutzen.
  // „credentialless“ lässt fremde Bilder (Profilbilder von chess.com) weiter laden.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

function cacheFor(path) {
  if (/^\/(vendor|assets)\//.test(path)) return 'public, max-age=2592000';
  if (/^\/data\//.test(path)) return 'public, max-age=604800';
  return 'no-cache'; // Seite, Skripte, sw.js: immer nachfragen (dank ETag meist nur „unverändert“)
}

/** Liefert eine Datei aus dem KV-Speicher. Unveränderte Dateien beantwortet der Worker ohne KV-Zugriff mit 304. */
async function serveFile(request, env, path) {
  const file = SITE[path === '/' ? '/index.html' : path];
  if (!file) return new Response('Nicht gefunden', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const etag = `"${file.key}"`;
  const headers = { 'Content-Type': file.type, ETag: etag, 'Cache-Control': cacheFor(path) };
  if ((request.headers.get('If-None-Match') || '').split(/\s*,\s*/).includes(etag)) return new Response(null, { status: 304, headers });
  const body = await env.SITE.get(file.key, { type: 'arrayBuffer', cacheTtl: 86400 });
  if (!body) return new Response('Datei fehlt', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

function finish(response, path) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY)) res.headers.set(k, v);
  return res;
}

const MAINTENANCE_PAGE = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Gleich wieder da · Chess Analyzer</title><link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<meta http-equiv="refresh" content="30"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#11151b;color:#e8ecf1;
font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}img{width:64px;height:64px}h1{font-size:1.4rem;margin:16px 0 8px}p{color:#97a3b4;margin:0}</style>
</head><body><main><img src="/assets/logo.svg" alt=""><h1>Die Seite zieht gerade um</h1><p>In ein paar Minuten ist alles wieder da – diese Seite lädt sich von selbst neu.</p></main></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (UNGATED.test(path)) return finish(await serveFile(request, env, path), path);

    // Während des Umzugs: alles außer den freien Dateien zeigt eine Hinweisseite (Variable MAINTENANCE = "1")
    if (env.MAINTENANCE === '1') {
      return finish(new Response(MAINTENANCE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '120' } }), path);
    }

    const gate = await handleGate(request, {
      kv: d1Store(env.DB, 'auth'),
      data: d1Store(env.DB, 'sync'),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      setupToken: env.SETUP_TOKEN || '',
      open: env.REQUIRE_LOGIN === 'false',
    });
    if (gate) return finish(gate, path);

    if (path === '/api/game') {
      const { status, body } = await fetchGame(url.searchParams.get('type'), url.searchParams.get('id'));
      return finish(new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': body.game && body.game.isFinished ? 'private, max-age=86400' : 'no-store',
        },
      }), path);
    }
    if (path.startsWith('/api/')) {
      return finish(new Response('{"error":"unknown"}', { status: 404, headers: { 'Content-Type': 'application/json' } }), path);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return finish(new Response('Nicht erlaubt', { status: 405 }), path);
    return finish(await serveFile(request, env, path), path);
  },
};
