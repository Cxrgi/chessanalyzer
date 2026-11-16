// Kleiner lokaler Server: liefert die Seite aus, verwaltet Benutzerkonten samt Synchronisierung
// und holt Partien von chess.com (/api/game).
// Start: npm start  →  http://localhost:8080      (ohne Anmeldung: NO_PASSWORD=1 npm start)
import http from 'node:http';
import { readFile, writeFile, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGame } from './server/proxy.mjs';
import { handleGate } from './server/gate.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const PUBLIC = ['index.html', 'css', 'js', 'vendor', 'assets', 'data', 'sw.js', 'manifest.webmanifest'];

// Anmeldung: Konten, Einstellungen und synchronisierte Stände liegen als Dateien in .data/ (nicht im Repository).
const GATED = !process.env.NO_PASSWORD && process.env.REQUIRE_LOGIN !== 'false';
const UNGATED = /^\/(vendor|assets|css|data)\/|^\/manifest\.webmanifest$/;
const DATA_DIR = process.env.DATA_DIR || join(ROOT, '.data');

/** Schlüssel-Wert-Speicher als Ordner mit einer Datei je Schlüssel. */
function fileStore(name) {
  const dir = join(DATA_DIR, name);
  const file = (key) => join(dir, encodeURIComponent(key) + '.json');
  return {
    get: (key) => readFile(file(key), 'utf8').catch(() => null),
    set: async (key, text) => {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), text);
    },
    delete: (key) => rm(file(key), { force: true }),
    list: async (prefix) => (await readdir(dir).catch(() => []))
      .filter((f) => f.endsWith('.json')).map((f) => decodeURIComponent(f.slice(0, -5))).filter((k) => k.startsWith(prefix)),
  };
}
const accounts = fileStore('auth');
const syncData = fileStore('sync');

async function gate(req, res, url) {
  if (!GATED || UNGATED.test(url.pathname)) return false;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  let body;
  if (req.method === 'POST' || req.method === 'PUT') {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      chunks.push(c);
      size += c.length;
      if (size > 4_000_000) break;
    }
    body = Buffer.concat(chunks);
  }
  const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers, body });
  const out = await handleGate(request, { kv: accounts, data: syncData, ip: req.socket.remoteAddress || 'local', setupToken: process.env.SETUP_TOKEN || '' });
  if (!out) return false;
  const h = {};
  out.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; });
  const cookies = out.headers.getSetCookie();
  if (cookies.length) h['Set-Cookie'] = cookies;
  res.writeHead(out.status, h);
  res.end(Buffer.from(await out.arrayBuffer()));
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (await gate(req, res, url)) return;
  if (url.pathname === '/api/game') {
    const { status, body } = await fetchGame(url.searchParams.get('type'), url.searchParams.get('id'));
    res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  let rel;
  try {
    rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
  } catch (e) {
    rel = '';
  }
  const top = rel.split(sep)[0];
  if (!rel || rel.includes('..') || !PUBLIC.includes(top)) {
    res.writeHead(404, { 'Content-Type': MIME['.txt'] });
    res.end('Nicht gefunden');
    return;
  }
  try {
    const file = join(ROOT, rel);
    if (!(await stat(file)).isFile()) throw new Error('kein File');
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(404, { 'Content-Type': MIME['.txt'] });
    res.end('Nicht gefunden');
  }
});

server.listen(PORT, () => {
  console.log(`Chess Analyzer läuft auf http://localhost:${PORT}`);
});
