// Baut data/puzzles/*.json aus einer Auswahl der Lichess-Aufgabensammlung (CC0, database.lichess.org).
//
//   1. lichess_db_puzzle.csv.zst von https://database.lichess.org/#puzzles laden
//   2. python3 tools/select-puzzles.py lichess_db_puzzle.csv.zst auswahl.csv   (braucht: pip install zstandard)
//   3. node tools/build-puzzles.mjs auswahl.csv
//
// Jede Aufgabe wird mit chess.js nachgespielt; fehlerhafte fliegen raus.
// Format je Aufgabe (ein String): id;FEN (ohne Zugzähler);Züge;Wertung;Themen
// Der erste Zug ist der des Gegners, danach kommt abwechselnd die Lösung.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { Chess } from '../vendor/chess.js';

const KEEP = new Set(['mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'fork', 'pin', 'skewer', 'discoveredAttack',
  'discoveredCheck', 'doubleCheck', 'deflection', 'attraction', 'sacrifice', 'hangingPiece', 'trappedPiece', 'capturingDefender',
  'intermezzo', 'quietMove', 'defensiveMove', 'advancedPawn', 'promotion', 'underPromotion', 'enPassant', 'backRankMate',
  'smotheredMate', 'kingsideAttack', 'queensideAttack', 'exposedKing', 'attackingF2F7', 'clearance', 'interference', 'xRayAttack',
  'zugzwang', 'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame',
  'anastasiaMate', 'arabianMate']);

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n');
const bands = new Map();
let bad = 0;
for (const row of rows) {
  const [id, fen, moves, rating, themes] = row.trim().split(',');
  const list = moves.split(' ');
  try {
    const chess = new Chess(fen);
    for (const u of list) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (themes.includes('mate') && !chess.isCheckmate()) throw new Error('kein Matt am Ende');
  } catch (e) {
    bad++;
    continue;
  }
  const band = Math.floor(+rating / 200) * 200;
  const kept = themes.split(' ').filter((t) => KEEP.has(t)).join(' ');
  if (!bands.has(band)) bands.set(band, []);
  bands.get(band).push([id, fen.split(' ').slice(0, 4).join(' '), moves, rating, kept].join(';'));
}
const dir = new URL('../data/puzzles/', import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let total = 0;
const index = {};
for (const [band, list] of [...bands].sort((a, b) => a[0] - b[0])) {
  writeFileSync(new URL(`${String(band).padStart(4, '0')}.json`, dir), JSON.stringify(list));
  index[band] = list.length;
  total += list.length;
}
writeFileSync(new URL('index.json', dir), JSON.stringify(index));
console.log(`${total} Aufgaben in ${bands.size} Dateien, ${bad} aussortiert`, index);
