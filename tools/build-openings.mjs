// Baut data/openings.json aus dem CC0-Datensatz von lichess-org/chess-openings.
// Aufruf: node tools/build-openings.mjs <ordner-mit-a.tsv..e.tsv>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from '../vendor/chess.js';
import { positionKey } from '../js/poskey.js';

const dir = process.argv[2];
if (!dir) throw new Error('Pfad zu den TSV-Dateien fehlt');

const names = [];
const nameIndex = new Map();
const book = {}; // key -> index in names (benannte Stellung) oder -1 (nur "Buch")
let lines = 0;

for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const rows = readFileSync(join(dir, `${f}.tsv`), 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    const sans = pgn.replace(/\d+\.+/g, ' ').trim().split(/\s+/);
    const keys = [];
    for (const san of sans) {
      chess.move(san);
      keys.push(positionKey(chess.fen()));
    }
    const label = `${eco}|${name}`;
    if (!nameIndex.has(label)) { nameIndex.set(label, names.length); names.push(label); }
    keys.forEach((k, i) => {
      if (i === keys.length - 1) book[k] = nameIndex.get(label);
      else if (!(k in book)) book[k] = -1;
    });
    lines++;
  }
}
writeFileSync(new URL('../data/openings.json', import.meta.url), JSON.stringify({ names, book }));
console.log(`${lines} Eröffnungen, ${Object.keys(book).length} Stellungen, ${names.length} Namen`);
