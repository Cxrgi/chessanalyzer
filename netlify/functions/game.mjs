// Netlify-Funktion: /api/game?type=live&id=123 → Partie-Daten von chess.com
import { fetchGame } from '../../server/proxy.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const { status, body } = await fetchGame(url.searchParams.get('type'), url.searchParams.get('id'));
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': body.game && body.game.isFinished ? 'public, max-age=86400' : 'no-store',
    },
  });
};

export const config = { path: '/api/game' };
