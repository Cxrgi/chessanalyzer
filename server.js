// Kleiner lokaler Server: liefert die Seite aus, schützt sie mit einem Passwort
// und holt Partien von chess.com (/api/game).
// Start: npm start  →  http://localhost:8080      (ohne Passwort: NO_PASSWORD=1 npm start)
import http from 'node:http';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGame } from './server/proxy.mjs';
import { handleGate } from './server/gate.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const PUBLIC = ['index.html', 'css', 'js', 'vendor', 'assets', 'data'];

// Passwortschutz: Der Hash liegt in .data/auth.json (nicht im Repository).
const GATED = !process.env.NO_PASSWORD;
const UNGATED = /^\/(vendor|assets|css)\//;
const AUTH_FILE = join(ROOT, '.data', 'auth.json');
const store = {
  get: async () => {
    try {
      return JSON.parse(await readFile(AUTH_FILE, 'utf8'));
    } catch (e) {
      return null;
    }
  },
  set: async (cfg) => {
    await mkdir(join(ROOT, '.data'), { recursive: true });
    await writeFile(AUTH_FILE, JSON.stringify(cfg));
  },
  delete: () => rm(AUTH_FILE, { force: true }),
};

async function gate(req, res, url) {
  if (!GATED || UNGATED.test(url.pathname)) return false;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  let body;
  if (req.method === 'POST') {
    const chunks = [];
    for await (const c of req) {
      chunks.push(c);
      if (chunks.reduce((n, x) => n + x.length, 0) > 10000) break;
    }
    body = Buffer.concat(chunks);
  }
  const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers, body });
  const out = await handleGate(request, { store, ip: req.socket.remoteAddress || 'local' });
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
