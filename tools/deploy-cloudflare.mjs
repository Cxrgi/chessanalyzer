// Veröffentlicht die Seite auf Cloudflare:
//   1. stellt die Browser-Dateien zusammen (wie tools/build-cloudflare.mjs),
//   2. lädt neue oder geänderte Dateien in den KV-Speicher (Schlüssel = Inhalts-Prüfsumme, unveränderliche Dateien),
//   3. schreibt cloudflare/site-manifest.json (Pfad → Schlüssel, Typ) und veröffentlicht den Worker mit wrangler,
//   4. räumt danach Dateien im KV auf, die nicht mehr gebraucht werden.
// Braucht: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Aufruf: node tools/deploy-cloudflare.mjs [--maintenance]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const NAMESPACE = '2af8dfa8d23d458399ea1c91bb633c40'; // KV „chessanalyzer-site“
const PUBLIC = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'vendor', 'assets', 'data'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.webp': 'image/webp',
};
if (!ACCOUNT || !TOKEN) throw new Error('CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN setzen');
const api = (path, init = {}) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${NAMESPACE}${path}`, {
  ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
});

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// 1) Dateien und Prüfsummen
const manifest = {};
const content = new Map();
for (const name of PUBLIC) {
  const p = join(root, name);
  for (const file of statSync(p).isDirectory() ? files(p) : [p]) {
    const rel = '/' + relative(root, file).split('\\').join('/');
    if (rel.endsWith('/README.md')) continue;
    // Lizenztexte (z. B. COPYING.txt, chess.js.LICENSE) als Text ausliefern
    const type = TYPES[extname(file).toLowerCase()] || (/(LICENSE|COPYING)/i.test(rel) ? 'text/plain; charset=utf-8' : null);
    if (!type) throw new Error('unbekannter Dateityp: ' + rel);
    const body = readFileSync(file);
    const key = createHash('sha256').update(body).digest('hex').slice(0, 32);
    manifest[rel] = { key, type, size: body.length };
    content.set(key, body);
  }
}

// 2) Vorhandene Schlüssel lesen, nur Neues hochladen
async function existingKeys() {
  const keys = new Set();
  let cursor = '';
  do {
    const res = await api(`/keys?limit=1000${cursor ? '&cursor=' + cursor : ''}`);
    const data = await res.json();
    if (!data.success) throw new Error('KV-Liste: ' + JSON.stringify(data.errors));
    data.result.forEach((k) => keys.add(k.name));
    cursor = data.result_info && data.result_info.cursor;
  } while (cursor);
  return keys;
}
const have = await existingKeys();
const missing = [...content.keys()].filter((k) => !have.has(k));
let done = 0;
for (let i = 0; i < missing.length; i += 6) {
  await Promise.all(missing.slice(i, i + 6).map(async (key) => {
    for (let attempt = 1; ; attempt++) {
      const res = await api(`/values/${key}`, { method: 'PUT', body: content.get(key), headers: { 'Content-Type': 'application/octet-stream' } });
      if (res.ok) break;
      if (attempt >= 4) throw new Error(`Upload ${key}: ${res.status} ${await res.text()}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    done++;
  }));
}
console.log(`${Object.keys(manifest).length} Dateien, ${missing.length} neu hochgeladen (${done}).`);

// 3) Manifest schreiben und Worker veröffentlichen
writeFileSync(join(root, 'cloudflare/site-manifest.json'), JSON.stringify(manifest));
const vars = process.argv.includes('--maintenance') ? ['--var', 'MAINTENANCE:1'] : ['--var', 'MAINTENANCE:0'];
execFileSync(process.env.WRANGLER || 'npx', process.env.WRANGLER ? ['deploy', ...vars] : ['wrangler', 'deploy', ...vars], { cwd: root, stdio: 'inherit' });

// 4) Aufräumen: Schlüssel, die keine Datei mehr verwendet (alte Fassungen)
const used = new Set(Object.values(manifest).map((m) => m.key));
const stale = [...have].filter((k) => !used.has(k));
if (stale.length) {
  const res = await api('/bulk/delete', { method: 'POST', body: JSON.stringify(stale), headers: { 'Content-Type': 'application/json' } });
  console.log(res.ok ? `${stale.length} alte Dateien entfernt.` : 'Aufräumen fehlgeschlagen (nicht schlimm): ' + res.status);
}
