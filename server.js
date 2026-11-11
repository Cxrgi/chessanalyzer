// Kleiner lokaler Server: liefert die Seite aus und holt Partien von chess.com (/api/game).
// Start: npm start  →  http://localhost:8080
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGame } from './server/proxy.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const PUBLIC = ['index.html', 'css', 'js', 'vendor', 'assets', 'data'];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
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
