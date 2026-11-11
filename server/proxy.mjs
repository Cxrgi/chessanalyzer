// Holt eine Partie vom chess.com-Spiel-Endpunkt. Wird vom lokalen Server (server.js)
// und von der Netlify-Funktion benutzt, weil Browser diesen Endpunkt wegen CORS
// nicht direkt abfragen dürfen.
const TYPES = new Set(['live', 'daily', 'computer']);

export async function fetchGame(type, id) {
  if (!TYPES.has(type) || !/^\d{1,20}$/.test(String(id))) {
    return { status: 400, body: { error: 'bad-request' } };
  }
  try {
    const res = await fetch(`https://www.chess.com/callback/${type}/game/${id}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; chessanalyzer)' },
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 404) return { status: 200, body: { error: 'notfound' } };
    if (!res.ok) return { status: 200, body: { error: 'upstream-' + res.status } };
    const data = await res.json();
    if (!data || !data.game) return { status: 200, body: { error: 'notfound' } };
    // nur weitergeben, was die Seite braucht
    const players = {};
    for (const [k, p] of Object.entries(data.players || {})) {
      players[k] = { username: p.username, rating: p.rating, color: p.color, avatarUrl: p.avatarUrl };
    }
    const g = data.game;
    return {
      status: 200,
      body: {
        game: {
          id: g.id, type: g.type, typeName: g.typeName, moveList: g.moveList, initialSetup: g.initialSetup,
          pgnHeaders: g.pgnHeaders, moveTimestamps: g.moveTimestamps, resultMessage: g.resultMessage,
          isFinished: g.isFinished,
        },
        players,
      },
    };
  } catch (e) {
    return { status: 200, body: { error: 'unreachable' } };
  }
}
