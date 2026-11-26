// Partien von Lichess laden. Die Lichess-Schnittstelle erlaubt Abrufe direkt aus dem Browser,
// es braucht also weder Proxy noch Anmeldung.
import { gameFromPgn, LoadError } from './chesscom.js';

/** Liest die Partie-ID aus einem Lichess-Link (8 Zeichen; längere Links enthalten zusätzlich ein Spieler-Kürzel). */
export function parseLichessLink(input) {
  const m = String(input || '').trim().match(/lichess\.org\/(?:embed\/)?(?:game\/export\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:[/?#]|$)/);
  return m ? m[1] : null;
}

function toGame(pgn, id) {
  if (/\[Variant "(?!Standard|From Position)/.test(pgn)) throw new LoadError('variant', 'Nur normales Schach wird unterstützt.');
  const game = gameFromPgn(pgn);
  game.id = 'lichess-' + id;
  game.url = 'https://lichess.org/' + id;
  return game;
}

async function get(url, accept) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: accept } });
  } catch (e) {
    throw new LoadError('network', 'Lichess ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.');
  }
  if (res.status === 404) throw new LoadError('notfound', 'Das wurde auf Lichess nicht gefunden.');
  if (res.status === 429) throw new LoadError('network', 'Lichess bremst gerade die Abrufe. Bitte warte eine Minute.');
  if (!res.ok) throw new LoadError('network', 'Lichess hat mit einem Fehler geantwortet.');
  return res.text();
}

export async function loadLichessGame(id) {
  return toGame(await get(`https://lichess.org/game/export/${id}?clocks=true&evals=false&opening=true`, 'application/x-chess-pgn'), id);
}

const SPEED = { ultraBullet: 'bullet', bullet: 'bullet', blitz: 'blitz', rapid: 'rapid', classical: 'rapid', correspondence: 'daily' };

/** Die letzten Partien eines Lichess-Spielers als einheitliche Listeneinträge. */
export async function fetchLichessGames(username, max = 40) {
  let text;
  try {
    text = await get(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&clocks=true&opening=true&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence`, 'application/x-ndjson');
  } catch (e) {
    if (e.code !== 'notfound') throw e;
    // Gibt es den Namen überhaupt? Das Profil ist auch dann abrufbar, wenn Lichess die Partieliste nicht herausgibt.
    const exists = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.status === 404 ? false : r.ok ? true : null)).catch(() => null);
    if (exists === false) throw new LoadError('notfound', `Einen Lichess-Spieler „${username}“ gibt es nicht. Prüfe die Schreibweise.`);
    throw new LoadError('network', 'Lichess gibt die Partieliste gerade nicht heraus. Öffne die Partie stattdessen über ihren Link.');
  }
  // Eine Zeile pro Partie; eine unvollständige letzte Zeile (Abbruch) wird übersprungen
  const games = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      games.push(JSON.parse(line));
    } catch (e) { /* unvollständige Zeile */ }
  }
  const variantOf = (g) => (g.variant && typeof g.variant === 'object' ? g.variant.key : g.variant);
  return games.filter((g) => variantOf(g) === 'standard' && g.pgn).sort((a, b) => (b.lastMoveAt || b.createdAt || 0) - (a.lastMoveAt || a.createdAt || 0)).map((g) => {
    const side = (c) => ({ name: (g.players[c].user && g.players[c].user.name) || (g.players[c].aiLevel ? `Stockfish Stufe ${g.players[c].aiLevel}` : 'Anonym'), rating: g.players[c].rating || null });
    return {
      id: 'lichess-' + g.id, white: side('white'), black: side('black'),
      result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2',
      timeClass: SPEED[g.speed] || '', at: g.lastMoveAt || g.createdAt,
      load: () => toGame(g.pgn, g.id),
    };
  });
}
