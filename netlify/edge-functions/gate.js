// Netlify Edge Function: Passwortschutz vor allen Seiten, Skripten, Daten und /api/*.
// Die eigentliche Logik liegt in server/gate.mjs und wird auch vom lokalen Server benutzt.
import { getStore } from '@netlify/blobs';
import { handleGate } from '../../server/gate.mjs';

const store = () => getStore({ name: 'auth', consistency: 'strong' });
const adapter = {
  get: () => store().get('config', { type: 'json' }),
  set: (cfg) => store().setJSON('config', cfg),
  delete: () => store().delete('config'),
};

export default async (request, context) => {
  const response = await handleGate(request, { store: adapter, ip: context.ip });
  return response || undefined; // undefined = Anfrage geht normal weiter
};

// Bilder, Engine und Stylesheet bleiben frei – ohne Seite und Skripte sind sie nutzlos,
// und so läuft nicht jede Datei durch die Edge Function.
export const config = {
  path: '/*',
  excludedPath: ['/vendor/*', '/assets/*', '/css/*', '/.netlify/*'],
};
