// Konten, Verwaltung und Synchronisierung – ohne Browser, mit Speicher im Arbeitsspeicher.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGate } from '../server/gate.mjs';

function memoryKv() {
  const map = new Map();
  return {
    map,
    get: async (k) => (map.has(k) ? map.get(k) : null),
    set: async (k, v) => { map.set(k, v); },
    delete: async (k) => { map.delete(k); },
    list: async (prefix) => [...map.keys()].filter((k) => k.startsWith(prefix)),
  };
}
const newEnv = (extra = {}) => ({ kv: memoryKv(), data: memoryKv(), ip: 'test-' + Math.random(), ...extra });
const B = 'https://example.test';
const post = (path, body, cookie) => new Request(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body || {}) });
const get = (path, cookie, accept = 'application/json') => new Request(B + path, { headers: { Accept: accept, ...(cookie ? { Cookie: cookie } : {}) } });
const put = (path, body, cookie) => new Request(B + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const anna = { name: 'Anna', password: 'geheim123', site: 'chesscom', chesscom: 'anna_chess', lichess: '' };

test('Konto anlegen, anmelden, abmelden', async () => {
  const env = newEnv();
  const page = await handleGate(get('/', null, 'text/html'), env);
  assert.equal(page.headers.get('x-gate'), 'login');
  assert.match(await page.text(), /Konto erstellen/);
  assert.equal((await handleGate(get('/js/app.js'), env)).status, 401);

  for (const [bad, error] of [[{ name: 'ab' }, 'name'], [{ name: 'admin' }, 'name'], [{ password: 'kurz' }, 'weak'], [{ site: 'chesscom', chesscom: '' }, 'handle'], [{ site: 'irgendwo' }, 'site']]) {
    const res = await handleGate(post('/api/auth/register', { ...anna, ...bad }), env);
    assert.equal((await res.json()).error, error);
  }
  const reg = await handleGate(post('/api/auth/register', anna), env);
  assert.equal(reg.status, 200);
  const session = cookieOf(reg);
  assert.match(session, /^ca_user=anna\./);
  assert.equal((await handleGate(post('/api/auth/register', { ...anna, name: 'ANNA' }), env)).status, 409);

  // Mit Anmeldung werden Seite und Skripte durchgelassen, der Status nennt das Konto
  assert.equal(await handleGate(get('/', session, 'text/html'), env), null);
  assert.equal(await handleGate(get('/js/app.js', session), env), null);
  const status = await (await handleGate(get('/api/auth/status', session), env)).json();
  assert.deepEqual([status.accounts, status.authenticated, status.user.name, status.user.chesscom], [true, true, 'Anna', 'anna_chess']);

  // Im Speicher liegt kein Passwort im Klartext
  assert.ok(![...env.kv.map.values()].some((v) => v.includes('geheim123')));

  assert.equal((await handleGate(post('/api/auth/login', { name: 'anna', password: 'falsch' }), env)).status, 401);
  assert.equal((await handleGate(post('/api/auth/login', { name: 'gibtsnicht', password: 'geheim123' }), env)).status, 401);
  const login = await handleGate(post('/api/auth/login', { name: 'ANNA', password: 'geheim123' }), env);
  assert.equal(login.status, 200);

  // Passwort ändern meldet andere Geräte ab (ihre Daten-Anfragen werden abgelehnt)
  const other = cookieOf(login);
  const change = await handleGate(post('/api/auth/password', { current: 'geheim123', next: 'neu-geheim-1' }, session), env);
  assert.equal(change.status, 200);
  assert.equal((await (await handleGate(get('/api/auth/status', other), env)).json()).authenticated, false);
  assert.equal((await (await handleGate(get('/api/auth/status', cookieOf(change)), env)).json()).authenticated, true);

  const profile = await handleGate(post('/api/auth/profile', { site: 'lichess', lichess: 'anna_li', chesscom: '' }, cookieOf(change)), env);
  assert.equal((await profile.json()).user.lichess, 'anna_li');
});

test('Jedes Konto hat seinen eigenen synchronisierten Stand', async () => {
  const env = newEnv();
  const a = cookieOf(await handleGate(post('/api/auth/register', anna), env));
  const b = cookieOf(await handleGate(post('/api/auth/register', { ...anna, name: 'Ben', chesscom: 'ben_chess' }), env));
  assert.equal((await handleGate(get('/api/sync'), env)).status, 401);

  assert.deepEqual(await (await handleGate(get('/api/sync', a), env)).json(), { rev: 0, data: null });
  const state = { v: 1, keys: { wins: { v: 3, at: 5 } }, meta: {}, cards: {}, del: {} };
  assert.deepEqual(await (await handleGate(put('/api/sync', { base: 0, data: state }, a), env)).json(), { rev: 1 });
  assert.deepEqual((await (await handleGate(get('/api/sync', a), env)).json()).data, state);
  assert.deepEqual(await (await handleGate(get('/api/sync?rev=1', a), env)).json(), { rev: 1, same: true });
  // Veralteter Ausgangsstand → Konflikt, der aktuelle Stand kommt zurück
  const conflict = await handleGate(put('/api/sync', { base: 0, data: state }, a), env);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).rev, 1);
  // Ben sieht davon nichts
  assert.deepEqual(await (await handleGate(get('/api/sync', b), env)).json(), { rev: 0, data: null });

  assert.equal((await handleGate(put('/api/sync/game?id=live-1', { game: {}, positions: [] }, a), env)).status, 200);
  assert.equal((await handleGate(get('/api/sync/game?id=live-1', a), env)).status, 200);
  assert.equal((await handleGate(get('/api/sync/game?id=live-1', b), env)).status, 404);
  assert.equal((await handleGate(get('/api/sync/game?id=../x', a), env)).status, 400);

  // Konto löschen entfernt auch alle Daten
  const del = await handleGate(post('/api/auth/delete', { password: 'geheim123' }, a), env);
  assert.equal(del.status, 200);
  assert.equal((await env.data.list('anna/')).length, 0);
  assert.equal((await handleGate(get('/api/sync', a), env)).status, 401);
});

test('Verwaltung: nur mit Betreiber-Passwort, Konten sperren und löschen, Registrierung steuern', async () => {
  const env = newEnv();
  const a = cookieOf(await handleGate(post('/api/auth/register', anna), env));
  await handleGate(put('/api/sync', { base: 0, data: { v: 1, keys: {}, meta: {}, cards: {}, del: {} } }, a), env);
  await handleGate(put('/api/sync/game?id=live-7', { game: {}, positions: [] }, a), env);

  assert.match(await (await handleGate(get('/admin', null, 'text/html'), env)).text(), /Verwaltung/);
  assert.equal((await handleGate(get('/api/admin/users'), env)).status, 401);
  // Eine Benutzer-Anmeldung öffnet die Verwaltung nicht
  assert.equal((await handleGate(get('/api/admin/users', a), env)).status, 401);

  const setup = await handleGate(post('/api/admin/setup', { password: 'betreiber-1' }), env);
  assert.equal(setup.status, 200);
  assert.match((await setup.json()).recovery, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await handleGate(post('/api/admin/setup', { password: 'betreiber-2' }), env)).status, 409);
  assert.equal((await handleGate(post('/api/admin/login', { password: 'falsch' }), env)).status, 401);
  const admin = cookieOf(await handleGate(post('/api/admin/login', { password: 'betreiber-1' }), env));
  assert.match(admin, /^ca_admin=/);

  const list = await (await handleGate(get('/api/admin/users', admin), env)).json();
  assert.deepEqual(list.users.map((u) => [u.name, u.chesscom, u.disabled]), [['Anna', 'anna_chess', false]]);
  assert.equal(list.settings.registration, 'open');
  assert.ok(!JSON.stringify(list).includes('hash'));

  const details = await (await handleGate(post('/api/admin/user', { name: 'Anna', action: 'details' }, admin), env)).json();
  assert.deepEqual([details.games, details.hasState], [1, true]);

  // Sperren: Anmeldung und Daten-Zugriff sind sofort weg
  await handleGate(post('/api/admin/user', { name: 'Anna', action: 'disable' }, admin), env);
  assert.equal((await handleGate(get('/api/sync', a), env)).status, 401);
  assert.equal((await (await handleGate(post('/api/auth/login', anna), env)).json()).error, 'disabled');
  await handleGate(post('/api/admin/user', { name: 'Anna', action: 'enable' }, admin), env);

  // Neues Übergangs-Passwort
  const temp = (await (await handleGate(post('/api/admin/user', { name: 'Anna', action: 'password' }, admin), env)).json()).password;
  assert.equal((await handleGate(post('/api/auth/login', anna), env)).status, 401);
  assert.equal((await handleGate(post('/api/auth/login', { name: 'Anna', password: temp }), env)).status, 200);

  // Registrierung nur mit Einladungscode, dann geschlossen
  assert.equal((await handleGate(post('/api/admin/settings', { registration: 'invite', invite: '' }, admin), env)).status, 400);
  await handleGate(post('/api/admin/settings', { registration: 'invite', invite: 'schach-freunde', notice: 'Hallo zusammen' }, admin), env);
  const ben = { ...anna, name: 'Ben', chesscom: 'ben_chess' };
  assert.equal((await (await handleGate(post('/api/auth/register', ben), env)).json()).error, 'invite');
  assert.equal((await handleGate(post('/api/auth/register', { ...ben, invite: 'schach-freunde' }), newEnvIp(env))).status, 200);
  await handleGate(post('/api/admin/settings', { registration: 'closed' }, admin), env);
  assert.equal((await (await handleGate(post('/api/auth/register', { ...ben, name: 'Cara' }), env)).json()).error, 'closed');
  assert.match(await (await handleGate(get('/', null, 'text/html'), env)).text(), /Hallo zusammen/);

  // Löschen entfernt Konto und Daten
  await handleGate(post('/api/admin/user', { name: 'Anna', action: 'delete' }, admin), env);
  assert.equal((await env.data.list('anna/')).length, 0);
  assert.deepEqual((await (await handleGate(get('/api/admin/users', admin), env)).json()).users.map((u) => u.name), ['Ben']);
});

function newEnvIp(env) {
  return { ...env, ip: 'test-' + Math.random() };
}

test('Höchstzahl an Konten wird eingehalten', async () => {
  const env = newEnv();
  await handleGate(post('/api/admin/setup', { password: 'betreiber-1' }), env);
  const admin = cookieOf(await handleGate(post('/api/admin/login', { password: 'betreiber-1' }), env));
  await handleGate(post('/api/admin/settings', { maxUsers: 1 }, admin), env);
  assert.equal((await handleGate(post('/api/auth/register', anna), env)).status, 200);
  assert.equal((await (await handleGate(post('/api/auth/register', { ...anna, name: 'Ben' }), newEnvIp(env))).json()).error, 'full');
});

test('Ohne Anmeldung (REQUIRE_LOGIN=false): alles offen, aber keine Konten und keine Synchronisierung', async () => {
  const env = newEnv({ open: true });
  assert.equal(await handleGate(get('/', null, 'text/html'), env), null);
  assert.equal((await handleGate(get('/api/sync'), env)).status, 404);
  assert.equal((await handleGate(get('/admin'), env)).status, 404);
});
