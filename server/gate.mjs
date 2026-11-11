// Passwortschutz für die ganze Seite. Läuft unverändert im lokalen Server (server.js)
// und als Netlify Edge Function – beide übergeben nur einen Speicher für die Konfiguration.
//
// Ablauf: Beim allerersten Besuch wird ein Passwort festgelegt (dazu gibt es einmalig einen
// Notfall-Code). Danach liefert die Seite ohne gültige Anmeldung nur noch die Anmeldeseite aus.
// Gespeichert wird nie das Passwort selbst, sondern nur ein gesalzener PBKDF2-Hash.
import { loginPage } from './login-page.mjs';

const COOKIE = 'ca_session';
const SESSION_DAYS = 30;
const ITERATIONS = 20000;
const enc = new TextEncoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (bytes) => b64(crypto.getRandomValues(new Uint8Array(bytes)));

async function hashSecret(secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

async function makeSession(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const sig = b64(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`v1.${exp}`)));
  return `${exp}.${sig}`;
}

async function validSession(token, secret) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  const want = b64(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`v1.${exp}`)));
  return sameText(want, sig);
}

function readCookie(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Die Konfiguration wird kurz im Speicher gehalten, damit nicht jede Anfrage den Speicher liest.
let cache = null;
async function loadConfig(store, fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 60000) return cache.cfg;
  const cfg = await store.get();
  cache = cfg ? { cfg, at: Date.now() } : null;
  return cfg || null;
}

// Einfache Bremse gegen Durchprobieren (pro laufender Instanz).
const fails = new Map();
function blocked(ip) {
  const f = fails.get(ip);
  return !!f && f.count >= 8 && Date.now() - f.at < 10 * 60000;
}
function noteFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.at > 10 * 60000) fails.set(ip, { count: 1, at: Date.now() });
  else f.count++;
  if (fails.size > 500) fails.clear();
}

const recoveryCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
};

const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const goodPassword = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 200;

async function newConfig(password, keep = {}) {
  const salt = randomToken(16);
  const code = recoveryCode();
  const recoverySalt = randomToken(16);
  return {
    cfg: {
      v: 1,
      salt,
      hash: await hashSecret(password, salt),
      secret: keep.secret || randomToken(32),
      recoverySalt,
      recoveryHash: await hashSecret(cleanCode(code), recoverySalt),
      created: new Date().toISOString(),
    },
    code,
  };
}

async function authApi(request, url, env, cfg, authed) {
  const action = url.pathname.slice('/api/auth/'.length);
  const { store, ip = 'local' } = env;
  if (action === 'status') return json({ configured: !!cfg, authenticated: authed });
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  let body = {};
  try {
    body = await request.json();
  } catch (e) { /* leerer Body */ }

  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, '', 0) });

  if (action === 'setup') {
    if (cfg) return json({ error: 'configured' }, 409);
    if (!goodPassword(body.password)) return json({ error: 'weak' }, 400);
    const made = await newConfig(body.password);
    await store.set(made.cfg);
    cache = { cfg: made.cfg, at: Date.now() };
    return json({ ok: true, recovery: made.code }, 200, { 'Set-Cookie': cookieHeader(request, await makeSession(made.cfg.secret), SESSION_DAYS * 86400) });
  }

  if (!cfg) return json({ error: 'unconfigured' }, 409);
  if (blocked(ip)) return json({ error: 'locked' }, 429);

  if (action === 'login') {
    if (!sameText(await hashSecret(String(body.password || ''), cfg.salt), cfg.hash)) {
      noteFail(ip);
      await sleep(400);
      return json({ error: 'wrong' }, 401);
    }
    fails.delete(ip);
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, await makeSession(cfg.secret), SESSION_DAYS * 86400) });
  }

  if (action === 'reset') {
    // „Passwort vergessen“: Mit dem Notfall-Code wird der Schutz zurückgesetzt, danach neu einrichten.
    if (!sameText(await hashSecret(cleanCode(body.recovery), cfg.recoverySalt), cfg.recoveryHash)) {
      noteFail(ip);
      await sleep(400);
      return json({ error: 'wrong' }, 401);
    }
    await store.delete();
    cache = null;
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, '', 0) });
  }

  if (action === 'password') {
    if (!authed) return json({ error: 'auth' }, 401);
    if (!sameText(await hashSecret(String(body.current || ''), cfg.salt), cfg.hash)) {
      noteFail(ip);
      await sleep(400);
      return json({ error: 'wrong' }, 401);
    }
    if (!goodPassword(body.next)) return json({ error: 'weak' }, 400);
    const salt = randomToken(16);
    const next = { ...cfg, salt, hash: await hashSecret(body.next, salt) };
    await store.set(next);
    cache = { cfg: next, at: Date.now() };
    return json({ ok: true });
  }
  return json({ error: 'unknown' }, 404);
}

/**
 * Prüft eine Anfrage.
 * @param request Web-Request
 * @param env     { store: { get(), set(cfg), delete() }, ip }
 * @returns Response (Anmeldeseite, API-Antwort oder 401) – oder null, wenn die Anfrage durchgelassen wird.
 */
export async function handleGate(request, env) {
  const url = new URL(request.url);
  const isAuthApi = url.pathname.startsWith('/api/auth/');
  let cfg = await loadConfig(env.store, isAuthApi);
  const token = readCookie(request);
  let authed = !!cfg && !!token && (await validSession(token, cfg.secret));
  if (!authed && token && cfg && !isAuthApi) {
    // Könnte an einer veralteten Konfiguration im Zwischenspeicher liegen – einmal frisch lesen.
    cfg = await loadConfig(env.store, true);
    authed = !!cfg && (await validSession(token, cfg.secret));
  }

  if (isAuthApi) return authApi(request, url, env, cfg, authed);
  if (authed) return null;

  const wantsPage = request.method === 'GET'
    && (url.pathname === '/' || url.pathname.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html'));
  if (wantsPage) {
    if (!cfg) cfg = await loadConfig(env.store, true);
    return new Response(loginPage(cfg ? 'login' : 'setup'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }
  return json({ error: 'auth' }, 401);
}
