// Netlify Edge Function: Anmeldung (Benutzerkonten), Verwaltung und Synchronisierung vor allen Seiten,
// Skripten und /api/*. Die eigentliche Logik liegt in server/gate.mjs und wird auch vom lokalen Server benutzt.
import { getStore } from '@netlify/blobs';
import { handleGate } from '../../server/gate.mjs';

/** Schlüssel-Wert-Speicher auf Netlify Blobs. */
const kv = (name) => {
  const store = () => getStore({ name, consistency: 'strong' });
  return {
    get: (key) => store().get(key, { type: 'text' }),
    set: (key, text) => store().set(key, text),
    delete: (key) => store().delete(key),
    list: async (prefix) => (await store().list({ prefix })).blobs.map((b) => b.key),
  };
};
const accounts = kv('auth'); // Konten, Einstellungen, Betreiber-Passwort
const data = kv('sync'); // synchronisierte Stände je Konto

export default async (request, context) => {
  const response = await handleGate(request, {
    kv: accounts,
    data,
    ip: context.ip,
    setupToken: Netlify.env.get('SETUP_TOKEN') || '',
    open: Netlify.env.get('REQUIRE_LOGIN') === 'false',
  });
  return response || undefined; // undefined = Anfrage geht normal weiter
};

// Bilder, Engine, Stylesheet und die frei lizenzierten Daten (Eröffnungen, Aufgaben) bleiben offen –
// ohne Seite und Skripte sind sie nutzlos, und so läuft nicht jede Datei durch die Edge Function.
export const config = {
  path: '/*',
  excludedPath: ['/vendor/*', '/assets/*', '/css/*', '/data/*', '/manifest.webmanifest', '/.netlify/*'],
};
