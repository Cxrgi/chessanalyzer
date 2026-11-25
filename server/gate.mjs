// Zugang zur Seite: Benutzerkonten + Verwaltung. Läuft unverändert im lokalen Server (server.js)
// und als Netlify Edge Function – beide übergeben nur zwei Schlüssel-Wert-Speicher.
//
// - Jede Person legt ein eigenes Konto an (Benutzername + Passwort) und hat ihren eigenen Stand.
// - Die Verwaltung unter /admin ist mit dem Betreiber-Passwort geschützt (das frühere Seiten-Passwort,
//   samt Notfall-Code). Dort lassen sich Konten ansehen, sperren, löschen und die Registrierung steuern.
// - Gespeichert werden nie Passwörter, sondern nur gesalzene PBKDF2-Hashes.
import { loginPage } from './login-page.mjs';
import { adminPage } from './admin-page.mjs';
import { handleSync } from './sync.mjs';
import { impressumPage, privacyPage } from './legal-pages.mjs';

const USER_COOKIE = 'ca_user';
const ADMIN_COOKIE = 'ca_admin';
const SESSION_DAYS = 30;
const ADMIN_DAYS = 7;
const ITERATIONS = 30000; // für neue Hashes; ältere Einträge merken sich ihre eigene Zahl
const LEGACY_ITERATIONS = 20000;
const DEFAULT_SETTINGS = { registration: 'open', invite: '', maxUsers: 50, notice: '' };
const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'moderator']);
const enc = new TextEncoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (bytes) => b64(crypto.getRandomValues(new Uint8Array(bytes)));

async function hashSecret(secret, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return b64(bits);
}

function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sign = async (secret, text) => b64(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(text)));

function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function cookieHeader(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

const html = (text) => new Response(text, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Gate': 'login',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = async (kv, key) => {
  const text = await kv.get(key);
  if (!text) return null;
  try {
    return typeof text === 'string' ? JSON.parse(text) : text;
  } catch (e) {
    return null;
  }
};
const body = async (request) => {
  try {
    return (await request.json()) || {};
  } catch (e) {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Einstellungen und Betreiber-Konfiguration (kurz im Speicher gehalten)
// ---------------------------------------------------------------------------

const cache = { cfg: null, settings: null };
const fresh = (entry) => entry && Date.now() - entry.at < 60000;

async function loadConfig(kv, force = false) {
  if (!force && fresh(cache.cfg)) return cache.cfg.value;
  const value = await readJson(kv, 'config');
  cache.cfg = { value, at: Date.now() };
  return value;
}
async function saveConfig(kv, cfg) {
  if (cfg) await kv.set('config', JSON.stringify(cfg));
  else await kv.delete('config');
  cache.cfg = { value: cfg, at: Date.now() };
}

/** Einstellungen der Seite. Das Geheimnis für die Anmeldungen wird beim ersten Mal erzeugt. */
async function loadSettings(kv, force = false) {
  if (!force && fresh(cache.settings)) return cache.settings.value;
  let value = await readJson(kv, 'settings');
  if (!value || !value.secret) {
    value = { ...DEFAULT_SETTINGS, ...(value || {}), secret: randomToken(32) };
    await kv.set('settings', JSON.stringify(value));
  }
  value = { ...DEFAULT_SETTINGS, ...value };
  cache.settings = { value, at: Date.now() };
  return value;
}
async function saveSettings(kv, value) {
  await kv.set('settings', JSON.stringify(value));
  cache.settings = { value, at: Date.now() };
}

// Einfache Bremsen gegen Durchprobieren und Massen-Registrierung (pro laufender Instanz).
const fails = new Map();
function blocked(ip) {
  const f = fails.get(ip);
  return !!f && f.count >= 8 && Date.now() - f.at < 10 * 60000;
}
/** Zählt einen Fehlversuch und gibt die Wartezeit zurück – sie verdoppelt sich mit jedem weiteren Versuch. */
function noteFail(ip) {
  let f = fails.get(ip);
  if (!f || Date.now() - f.at > 10 * 60000) {
    f = { count: 0, at: Date.now() };
    fails.set(ip, f);
  }
  f.count++;
  if (fails.size > 500) fails.clear();
  return Math.min(400 * 2 ** (f.count - 1), 6000);
}
const signups = new Map();
function signupAllowed(ip) {
  const now = Date.now();
  const list = (signups.get(ip) || []).filter((t) => now - t < 3600000);
  if (list.length >= 3) return false;
  list.push(now);
  signups.set(ip, list);
  if (signups.size > 500) signups.clear();
  return true;
}

// ---------------------------------------------------------------------------
// Benutzerkonten
// ---------------------------------------------------------------------------

const NAME = /^[A-Za-z0-9_-]{3,20}$/;
const HANDLE = /^[A-Za-z0-9_-]{2,40}$/;
const goodPassword = (p, min = 8) => typeof p === 'string' && p.length >= min && p.length <= 200;
const userKey = (lname) => 'u/' + lname;
const loadUser = (kv, lname) => readJson(kv, userKey(lname));
const saveUser = (kv, user) => kv.set(userKey(user.lname), JSON.stringify(user));
const publicUser = (u) => ({ name: u.name, site: u.site, chesscom: u.chesscom, lichess: u.lichess, created: u.created });

/** Prüft die Angaben zum Spielerkonto (wo jemand spielt und unter welchem Namen). */
function playProfile(input) {
  const site = ['chesscom', 'lichess', 'none'].includes(input.site) ? input.site : null;
  const chesscom = String(input.chesscom || '').trim();
  const lichess = String(input.lichess || '').trim();
  if (!site) return { error: 'site' };
  if ((chesscom && !HANDLE.test(chesscom)) || (lichess && !HANDLE.test(lichess))) return { error: 'handle' };
  if ((site === 'chesscom' && !chesscom) || (site === 'lichess' && !lichess)) return { error: 'handle' };
  return { site, chesscom, lichess };
}

async function makeUserSession(secret, user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  return `${user.lname}.${exp}.${user.sv}.${await sign(secret, `u1.${user.lname}.${exp}.${user.sv}`)}`;
}

/** Liest die Anmeldung aus dem Cookie: { lname, sv } – nur Signatur und Ablauf werden geprüft. */
async function readUserSession(request, secret) {
  const token = readCookie(request, USER_COOKIE);
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const [lname, exp, sv, sig] = parts;
  if (!/^\d+$/.test(exp) || +exp < Date.now() / 1000) return null;
  return sameText(await sign(secret, `u1.${lname}.${exp}.${sv}`), sig) ? { lname, sv: +sv } : null;
}

/** Volle Prüfung für alles, was Daten liest oder schreibt: Konto muss existieren, aktiv sein und zur Sitzung passen. */
async function currentUser(request, env, settings) {
  const session = await readUserSession(request, settings.secret);
  if (!session) return null;
  const user = await loadUser(env.kv, session.lname);
  return user && !user.disabled && user.sv === session.sv ? user : null;
}

const userCookie = async (request, settings, user) => ({ 'Set-Cookie': cookieHeader(request, USER_COOKIE, await makeUserSession(settings.secret, user), SESSION_DAYS * 86400) });
const clearUserCookie = (request) => ({ 'Set-Cookie': cookieHeader(request, USER_COOKIE, '', 0) });

async function deleteUserData(env, lname) {
  if (env.data && env.data.list) for (const key of await env.data.list(lname + '/')) await env.data.delete(key);
  await env.kv.delete(userKey(lname));
}

async function authApi(request, url, env, settings) {
  const action = url.pathname.slice('/api/auth/'.length);
  const { kv, ip = 'local' } = env;

  if (action === 'status') {
    const session = await readUserSession(request, settings.secret);
    const user = session ? await currentUser(request, env, settings) : null;
    const headers = session && !user ? clearUserCookie(request) : {};
    if (user) {
      // „Zuletzt aktiv“ höchstens einmal am Tag fortschreiben – spart Schreibzugriffe.
      const today = new Date().toISOString().slice(0, 10);
      if (user.seen !== today) await saveUser(kv, { ...user, seen: today });
    }
    return json({ configured: true, accounts: true, authenticated: !!user, user: user ? publicUser(user) : null, notice: settings.notice || '' }, 200, headers);
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const input = await body(request);

  if (action === 'logout') return json({ ok: true }, 200, clearUserCookie(request));

  if (action === 'register') {
    if (settings.registration === 'closed') return json({ error: 'closed' }, 403);
    if (blocked(ip)) return json({ error: 'locked' }, 429);
    if (settings.registration === 'invite' && !sameText(String(input.invite || '').trim(), String(settings.invite || '')) ) {
      await sleep(noteFail(ip));
      return json({ error: 'invite' }, 403);
    }
    const name = String(input.name || '').trim();
    const lname = name.toLowerCase();
    if (!NAME.test(name) || RESERVED.has(lname)) return json({ error: 'name' }, 400);
    if (!goodPassword(input.password)) return json({ error: 'weak' }, 400);
    const profile = playProfile(input);
    if (profile.error) return json({ error: profile.error }, 400);
    if (await loadUser(kv, lname)) return json({ error: 'taken' }, 409);
    if ((await kv.list('u/')).length >= (Number(settings.maxUsers) || DEFAULT_SETTINGS.maxUsers)) return json({ error: 'full' }, 403);
    if (!signupAllowed(ip)) return json({ error: 'locked' }, 429);
    const salt = randomToken(16);
    const today = new Date().toISOString().slice(0, 10);
    const user = { v: 1, name, lname, salt, iter: ITERATIONS, hash: await hashSecret(input.password, salt), sv: 1, created: today, seen: today, disabled: false, ...profile };
    await saveUser(kv, user);
    return json({ ok: true, user: publicUser(user) }, 200, await userCookie(request, settings, user));
  }

  if (action === 'login') {
    if (blocked(ip)) return json({ error: 'locked' }, 429);
    const lname = String(input.name || '').trim().toLowerCase();
    const user = NAME.test(lname) ? await loadUser(kv, lname) : null;
    // Auch ohne Konto wird gerechnet, damit die Antwortzeit nicht verrät, ob es den Namen gibt.
    const hash = await hashSecret(String(input.password || ''), user ? user.salt : 'kein-konto', user ? user.iter : ITERATIONS);
    if (!user || !sameText(hash, user.hash)) {
      await sleep(noteFail(ip));
      return json({ error: 'wrong' }, 401);
    }
    if (user.disabled) return json({ error: 'disabled' }, 403);
    fails.delete(ip);
    return json({ ok: true, user: publicUser(user) }, 200, await userCookie(request, settings, user));
  }

  // Alles Weitere nur mit gültiger Anmeldung.
  const user = await currentUser(request, env, settings);
  if (!user) return json({ error: 'auth' }, 401, clearUserCookie(request));

  if (action === 'profile') {
    const profile = playProfile(input);
    if (profile.error) return json({ error: profile.error }, 400);
    const next = { ...user, ...profile };
    await saveUser(kv, next);
    return json({ ok: true, user: publicUser(next) });
  }

  if (action === 'password' || action === 'delete') {
    if (blocked(ip)) return json({ error: 'locked' }, 429);
    if (!sameText(await hashSecret(String(input.current || input.password || ''), user.salt, user.iter), user.hash)) {
      await sleep(noteFail(ip));
      return json({ error: 'wrong' }, 401);
    }
    if (action === 'delete') {
      await deleteUserData(env, user.lname);
      return json({ ok: true }, 200, clearUserCookie(request));
    }
    if (!goodPassword(input.next)) return json({ error: 'weak' }, 400);
    // Neues Passwort = neue Sitzungsnummer: Alle anderen Geräte sind damit abgemeldet.
    const salt = randomToken(16);
    const next = { ...user, salt, iter: ITERATIONS, hash: await hashSecret(input.next, salt), sv: user.sv + 1 };
    await saveUser(kv, next);
    return json({ ok: true }, 200, await userCookie(request, settings, next));
  }

  if (action === 'logout-all') {
    const next = { ...user, sv: user.sv + 1 };
    await saveUser(kv, next);
    return json({ ok: true }, 200, await userCookie(request, settings, next));
  }
  return json({ error: 'unknown' }, 404);
}

// ---------------------------------------------------------------------------
// Verwaltung (Betreiber-Passwort)
// ---------------------------------------------------------------------------

const recoveryCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
};
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function newConfig(password) {
  const salt = randomToken(16);
  const code = recoveryCode();
  const recoverySalt = randomToken(16);
  return {
    cfg: {
      v: 1, salt, iter: ITERATIONS, hash: await hashSecret(password, salt), secret: randomToken(32),
      recoverySalt, recoveryHash: await hashSecret(cleanCode(code), recoverySalt, LEGACY_ITERATIONS), created: new Date().toISOString(),
    },
    code,
  };
}

async function makeAdminSession(secret) {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_DAYS * 86400;
  return `${exp}.${await sign(secret, `a1.${exp}`)}`;
}
async function validAdminSession(request, cfg) {
  if (!cfg) return false;
  const [exp, sig] = String(readCookie(request, ADMIN_COOKIE) || '').split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  return sameText(await sign(cfg.secret, `a1.${exp}`), sig);
}
const adminCookie = async (request, cfg) => ({ 'Set-Cookie': cookieHeader(request, ADMIN_COOKIE, await makeAdminSession(cfg.secret), ADMIN_DAYS * 86400) });
const clearAdminCookie = (request) => ({ 'Set-Cookie': cookieHeader(request, ADMIN_COOKIE, '', 0) });

const tempPassword = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => alphabet[b % alphabet.length]).join('');
};

async function adminApi(request, url, env) {
  const action = url.pathname.slice('/api/admin/'.length);
  const { kv, ip = 'local' } = env;
  let cfg = await loadConfig(kv, true);
  const authed = await validAdminSession(request, cfg);

  if (action === 'status') return json({ configured: !!cfg, authenticated: authed, needsToken: !cfg && !!env.setupToken });
  if (action === 'users' && request.method === 'GET') {
    if (!authed) return json({ error: 'auth' }, 401);
    const settings = await loadSettings(kv, true);
    const users = [];
    for (const key of await kv.list('u/')) {
      const u = await readJson(kv, key);
      if (u) users.push({ name: u.name, created: u.created, seen: u.seen, site: u.site, chesscom: u.chesscom, lichess: u.lichess, disabled: !!u.disabled });
    }
    users.sort((a, b) => String(b.seen).localeCompare(String(a.seen)) || a.name.localeCompare(b.name));
    return json({ users, settings: { registration: settings.registration, invite: settings.invite, maxUsers: settings.maxUsers, notice: settings.notice, legal: settings.legal || {} } });
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const input = await body(request);

  if (action === 'logout') return json({ ok: true }, 200, clearAdminCookie(request));

  if (action === 'setup') {
    if (cfg) return json({ error: 'configured' }, 409);
    // Optionaler Einrichtungs-Code (Umgebungsvariable SETUP_TOKEN): Ohne ihn kann niemand die Verwaltung übernehmen.
    if (env.setupToken && !sameText(String(input.token || ''), env.setupToken)) {
      await sleep(noteFail(ip));
      return json({ error: 'token' }, 403);
    }
    if (!goodPassword(input.password, 8)) return json({ error: 'weak' }, 400);
    const made = await newConfig(input.password);
    await saveConfig(kv, made.cfg);
    return json({ ok: true, recovery: made.code }, 200, await adminCookie(request, made.cfg));
  }

  if (!cfg) return json({ error: 'unconfigured' }, 409);
  if (blocked(ip)) return json({ error: 'locked' }, 429);
  const iter = cfg.iter || LEGACY_ITERATIONS;

  if (action === 'login') {
    if (!sameText(await hashSecret(String(input.password || ''), cfg.salt, iter), cfg.hash)) {
      await sleep(noteFail(ip));
      return json({ error: 'wrong' }, 401);
    }
    fails.delete(ip);
    return json({ ok: true }, 200, await adminCookie(request, cfg));
  }

  if (action === 'reset') {
    // „Passwort vergessen“: Mit dem Notfall-Code wird das Betreiber-Passwort zurückgesetzt, danach neu festlegen.
    if (!sameText(await hashSecret(cleanCode(input.recovery), cfg.recoverySalt, LEGACY_ITERATIONS), cfg.recoveryHash)) {
      await sleep(noteFail(ip));
      return json({ error: 'wrong' }, 401);
    }
    await saveConfig(kv, null);
    return json({ ok: true }, 200, clearAdminCookie(request));
  }

  if (!authed) return json({ error: 'auth' }, 401);

  if (action === 'password') {
    if (!sameText(await hashSecret(String(input.current || ''), cfg.salt, iter), cfg.hash)) {
      await sleep(noteFail(ip));
      return json({ error: 'wrong' }, 401);
    }
    if (!goodPassword(input.next, 8)) return json({ error: 'weak' }, 400);
    const salt = randomToken(16);
    cfg = { ...cfg, salt, iter: ITERATIONS, hash: await hashSecret(input.next, salt), secret: randomToken(32) };
    await saveConfig(kv, cfg);
    return json({ ok: true }, 200, await adminCookie(request, cfg));
  }

  if (action === 'settings') {
    const settings = await loadSettings(kv, true);
    const next = { ...settings };
    if (['open', 'invite', 'closed'].includes(input.registration)) next.registration = input.registration;
    if (typeof input.invite === 'string') next.invite = input.invite.trim().slice(0, 60);
    if (Number.isFinite(+input.maxUsers) && +input.maxUsers >= 1) next.maxUsers = Math.min(5000, Math.floor(+input.maxUsers));
    if (typeof input.notice === 'string') next.notice = input.notice.trim().slice(0, 300);
    if (input.legal && typeof input.legal === 'object') {
      // Angaben für Impressum und Datenschutzerklärung – öffentlich sichtbar unter /impressum.
      const clip = (v, n) => String(v || '').trim().slice(0, n);
      next.legal = { name: clip(input.legal.name, 120), address: clip(input.legal.address, 400), email: clip(input.legal.email, 120), extra: clip(input.legal.extra, 400) };
    }
    if (next.registration === 'invite' && !next.invite) return json({ error: 'invite' }, 400);
    await saveSettings(kv, next);
    return json({ ok: true });
  }

  if (action === 'logout-all') {
    // Neues Geheimnis: Alle Benutzer müssen sich neu anmelden (ihre Daten bleiben erhalten).
    const settings = await loadSettings(kv, true);
    await saveSettings(kv, { ...settings, secret: randomToken(32) });
    return json({ ok: true });
  }

  if (action === 'user') {
    const lname = String(input.name || '').toLowerCase();
    const user = NAME.test(lname) ? await loadUser(kv, lname) : null;
    if (!user) return json({ error: 'not-found' }, 404);
    if (input.action === 'details' || input.action === 'export') {
      // Nur auf Knopfdruck: liest alle gespeicherten Daten dieses Kontos (Stand + analysierte Partien)
      const keys = env.data && env.data.list ? await env.data.list(lname + '/') : [];
      const texts = new Map();
      for (let i = 0; i < keys.length; i += 10) {
        const part = keys.slice(i, i + 10);
        const got = await Promise.all(part.map((k) => env.data.get(k)));
        part.forEach((k, j) => { if (got[j] != null) texts.set(k, typeof got[j] === 'string' ? got[j] : JSON.stringify(got[j])); });
      }
      const size = (t) => enc.encode(t).length;
      const state = texts.get(lname + '/state') || null;
      const games = [...texts].filter(([k]) => k.startsWith(lname + '/game/'));
      if (input.action === 'details') {
        const gameBytes = games.reduce((n, [, t]) => n + size(t), 0);
        const stateBytes = state ? size(state) : 0;
        return json({ ok: true, games: games.length, hasState: !!state, bytes: stateBytes + gameBytes, stateBytes, gameBytes });
      }
      // Export als JSON-Datei. Die gespeicherten Texte werden unverändert eingesetzt (kein erneutes Umwandeln).
      const profile = { name: user.name, created: user.created, seen: user.seen, site: user.site, chesscom: user.chesscom, lichess: user.lichess, disabled: !!user.disabled };
      const body = `{"app":"chessanalyzer","export":"konto","exported":${JSON.stringify(new Date().toISOString())},"user":${JSON.stringify(profile)},`
        + `"state":${state || 'null'},"games":{${games.map(([k, t]) => `${JSON.stringify(k.slice(lname.length + 6))}:${t}`).join(',')}}}`;
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="chessanalyzer-${user.lname}-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }
    if (input.action === 'delete') {
      await deleteUserData(env, lname);
      return json({ ok: true });
    }
    if (input.action === 'disable' || input.action === 'enable') {
      await saveUser(kv, { ...user, disabled: input.action === 'disable', sv: user.sv + 1 });
      return json({ ok: true });
    }
    if (input.action === 'logout') {
      await saveUser(kv, { ...user, sv: user.sv + 1 });
      return json({ ok: true });
    }
    if (input.action === 'password') {
      // Neues Übergangs-Passwort – der Betreiber gibt es der Person weiter, sie ändert es danach selbst.
      const password = tempPassword();
      const salt = randomToken(16);
      await saveUser(kv, { ...user, salt, iter: ITERATIONS, hash: await hashSecret(password, salt), sv: user.sv + 1 });
      return json({ ok: true, password });
    }
    if (input.action === 'profile') {
      const profile = playProfile(input);
      if (profile.error) return json({ error: profile.error }, 400);
      await saveUser(kv, { ...user, ...profile });
      return json({ ok: true });
    }
  }
  return json({ error: 'unknown' }, 404);
}

// ---------------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------------

/**
 * Prüft eine Anfrage.
 * @param request Web-Request
 * @param env     { kv, data, ip, setupToken?, open? }
 *                kv   = Speicher für Konten und Einstellungen: { get(key) → Text|null, set(key, text), delete(key), list(prefix) → [key] }
 *                data = Speicher für die synchronisierten Stände (gleiche Schnittstelle)
 *                open = true schaltet Konten und Anmeldung ab (Umgebungsvariable REQUIRE_LOGIN=false).
 * @returns Response (Anmeldeseite, Verwaltung, API-Antwort oder 401) – oder null, wenn die Anfrage durchgelassen wird.
 */
export async function handleGate(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (env.open) {
    if (path.startsWith('/api/auth/')) return json({ configured: false, authenticated: true, open: true });
    if (path.startsWith('/api/admin/') || path.startsWith('/api/sync') || path === '/admin' || path === '/impressum' || path === '/datenschutz') return json({ error: 'off' }, 404);
    return null;
  }
  if (path === '/admin' || path === '/admin/') return html(adminPage({ nonce: randomToken(12) }));
  if (path.startsWith('/api/admin/')) return adminApi(request, url, env);

  const settings = await loadSettings(env.kv);
  // Impressum und Datenschutzerklärung sind ohne Anmeldung lesbar.
  if (path === '/impressum') return html(impressumPage(settings.legal));
  if (path === '/datenschutz') return html(privacyPage(settings.legal));
  if (path.startsWith('/api/auth/')) return authApi(request, url, env, settings);

  if (path.startsWith('/api/')) {
    // Daten-Schnittstellen: volle Prüfung des Kontos.
    const user = await currentUser(request, env, settings);
    if (!user) return json({ error: 'auth' }, 401);
    if (path.startsWith('/api/sync')) return (await handleSync(request, env.data, user.lname + '/')) || json({ error: 'unknown' }, 404);
    return null;
  }

  // Seiten und Skripte: Hier genügt die signierte Anmeldung (kein Speicherzugriff pro Datei).
  if (await readUserSession(request, settings.secret)) return null;
  const wantsPage = request.method === 'GET'
    && (path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html'));
  if (wantsPage) return html(loginPage({ nonce: randomToken(12), registration: settings.registration, notice: settings.notice }));
  return json({ error: 'auth' }, 401);
}
