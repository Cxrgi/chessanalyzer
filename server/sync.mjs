// Synchronisierung zwischen den Geräten eines Kontos: ein kleiner Stand (Fortschritt, Statistik, Trainingskarten,
// Einstellungen) plus die analysierten Partien einzeln. Wird von server/gate.mjs aufgerufen – immer erst NACH der
// Anmeldung, und jedes Konto sieht nur seinen eigenen Bereich (prefix).
// Grenzen in Byte (eine Zeile in Cloudflare D1 darf höchstens etwa 2 MB groß sein)
const MAX_STATE = 1_900_000;
const MAX_GAME = 700_000;
const bytes = (text) => new TextEncoder().encode(text).length;
const GAME_ID = /^[A-Za-z0-9_.:-]{1,80}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/**
 * @param request Request
 * @param store   { get(key) → Text | null, set(key, text), delete(key) }
 * @param prefix  Bereich des angemeldeten Kontos, z. B. "anna/"
 * @returns Response – oder null, wenn die Anfrage nicht zu /api/sync gehört.
 */
export async function handleSync(request, store, prefix = '') {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/api/sync' && path !== '/api/sync/game') return null;
  const method = request.method;
  try {
    if (path === '/api/sync') {
      // Der Stand liegt als Text {"rev":N,"data":…} vor. Die Nummer wird nur abgelesen, nicht der ganze Text
      // entpackt – das hält die Rechenzeit pro Anfrage klein (wichtig auf Cloudflare).
      const text = await store.get(prefix + 'state');
      const m = text && /^\{"rev":(\d+),/.exec(text);
      const rev = m ? +m[1] : 0;
      const current = () => new Response(text || '{"rev":0,"data":null}', { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      if (method === 'GET') {
        // Kennt das Gerät den Stand schon, wird er nicht noch einmal übertragen.
        return Number(url.searchParams.get('rev')) === rev && rev > 0 ? json({ rev, same: true }) : current();
      }
      if (method === 'PUT') {
        const raw = await request.text();
        if (bytes(raw) > MAX_STATE) return json({ error: 'too-large' }, 413);
        const body = JSON.parse(raw);
        if (!body || typeof body.data !== 'object' || body.data === null) return json({ error: 'bad-request' }, 400);
        // Hat inzwischen ein anderes Gerät gespeichert, bekommt dieses den neuen Stand zum Zusammenführen zurück.
        if (Number(body.base) !== rev) {
          const res = current();
          return new Response(res.body, { status: 409, headers: res.headers });
        }
        await store.set(prefix + 'state', `{"rev":${rev + 1},"data":${JSON.stringify(body.data)}}`);
        return json({ rev: rev + 1 });
      }
      return json({ error: 'method' }, 405);
    }
    const id = url.searchParams.get('id') || '';
    if (!GAME_ID.test(id)) return json({ error: 'bad-id' }, 400);
    const key = prefix + 'game/' + id;
    if (method === 'GET') {
      const text = await store.get(key);
      return text ? new Response(text, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }) : json({ error: 'not-found' }, 404);
    }
    if (method === 'PUT') {
      const raw = await request.text();
      if (bytes(raw) > MAX_GAME) return json({ error: 'too-large' }, 413);
      JSON.parse(raw);
      await store.set(key, raw);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await store.delete(key);
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  } catch (e) {
    return json({ error: 'bad-request' }, 400);
  }
}
