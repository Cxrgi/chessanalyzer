// Passwortschutz: Einrichtung, Anmeldung, falsches Passwort, Abmelden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGate } from '../server/gate.mjs';

function memoryStore() {
  let cfg = null;
  return { get: async () => cfg, set: async (c) => { cfg = c; }, delete: async () => { cfg = null; } };
}
const post = (path, body, cookie) => new Request('https://example.test' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
});
const page = (cookie) => new Request('https://example.test/', { headers: { Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}) } });
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('Passwortschutz: kompletter Ablauf', async () => {
  const env = { store: memoryStore(), ip: 'test' };

  const first = await handleGate(page(), env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-gate'), 'login');
  assert.match(await first.text(), /Passwort festlegen/);

  const weak = await handleGate(post('/api/auth/setup', { password: '123' }), env);
  assert.equal(weak.status, 400);

  const setup = await handleGate(post('/api/auth/setup', { password: 'geheim123' }), env);
  assert.equal(setup.status, 200);
  const { recovery } = await setup.json();
  assert.match(recovery, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const session = cookieOf(setup);
  assert.match(session, /^ca_session=/);

  // Mit gültiger Sitzung wird die Anfrage durchgelassen, ohne Sitzung kommt die Anmeldeseite bzw. 401
  assert.equal(await handleGate(page(session), env), null);
  assert.match(await (await handleGate(page(), env)).text(), /Willkommen zurück/);
  const api = await handleGate(new Request('https://example.test/js/app.js'), env);
  assert.equal(api.status, 401);

  const again = await handleGate(post('/api/auth/setup', { password: 'anderes123' }), env);
  assert.equal(again.status, 409);

  const wrong = await handleGate(post('/api/auth/login', { password: 'falsch' }), env);
  assert.equal(wrong.status, 401);
  const login = await handleGate(post('/api/auth/login', { password: 'geheim123' }), env);
  assert.equal(login.status, 200);
  assert.equal(await handleGate(page(cookieOf(login)), env), null);

  // Passwort ändern meldet alle anderen Sitzungen ab
  const change = await handleGate(post('/api/auth/password', { current: 'geheim123', next: 'neu-geheim' }, session), env);
  assert.equal(change.status, 200);
  assert.notEqual(await handleGate(page(session), env), null);
  assert.equal(await handleGate(page(cookieOf(change)), env), null);
});

test('Passwortschutz lässt sich per REQUIRE_LOGIN=false abschalten', async () => {
  assert.equal(await handleGate(page(), { store: memoryStore(), ip: 'test', open: true }), null);
});
