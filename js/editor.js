// Stellungs-Editor: Figuren frei aufs Brett setzen, Zugrecht und Rochaderechte festlegen,
// FEN einfügen oder kopieren – und von dort aus im Analysebrett weiterspielen.
import { Chess } from '../vendor/chess.js';
import { Board } from './board.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TYPES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const FILES = 'abcdefgh';
const SIDE = { w: 'Weiß', b: 'Schwarz' };
const CASTLE = [
  ['K', 'Weiß kurz', 'wK', 'e1', 'wR', 'h1'],
  ['Q', 'Weiß lang', 'wK', 'e1', 'wR', 'a1'],
  ['k', 'Schwarz kurz', 'bK', 'e8', 'bR', 'h8'],
  ['q', 'Schwarz lang', 'bK', 'e8', 'bR', 'a8'],
];

let d = null; // von der App übergebene Helfer
const E = { map: new Map(), turn: 'w', castling: { K: true, Q: true, k: true, q: true }, tool: 'hand' };

/** Verdrahtet die Bedienelemente des Editors (einmalig beim Start). */
export function bindEditor(deps) {
  d = deps;
  const $ = d.$;
  $('palette').addEventListener('click', (e) => {
    const b = e.target.closest('.pal');
    if (!b) return;
    E.tool = b.dataset.tool;
    drawPalette();
  });
  $('ed-turn').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    E.turn = b.dataset.turn;
    sync();
  });
  $('ed-castle').addEventListener('change', (e) => {
    if (e.target.dataset.flag) E.castling[e.target.dataset.flag] = e.target.checked;
    sync();
  });
  $('ed-start').onclick = () => { load(START); sync(); };
  $('ed-clear').onclick = () => { E.map.clear(); sync(); };
  $('ed-flip').onclick = () => d.board.setOrientation(d.board.orientation === 'w' ? 'b' : 'w');
  const input = $('ed-fen');
  input.addEventListener('change', loadFromInput);
  input.addEventListener('paste', () => setTimeout(loadFromInput, 0));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadFromInput();
      input.blur();
    }
  });
  $('ed-copy').onclick = (e) => d.copyText(fen(), e.currentTarget);
  $('ed-cancel').onclick = () => {
    d.board.setEditor(null);
    d.onCancel();
  };
  $('ed-go').onclick = () => {
    const err = problem(fen());
    if (err) {
      showError(err);
      return;
    }
    d.board.setEditor(null);
    d.onPlay(fen());
  };
}

/** Öffnet den Editor mit einer Ausgangsstellung. */
export function openEditor(fenText) {
  load(fenText || START);
  E.tool = 'hand';
  d.board.setEditor({ tool: () => E.tool, place, move });
  d.setCoach({
    title: 'Stellung aufbauen',
    paragraphs: [
      'Wähl eine Figur und tipp auf ein Feld, um sie zu setzen – nochmal tippen nimmt sie wieder weg. Mit dem Verschieben-Werkzeug ziehst du Figuren um; aus dem Brett gezogen verschwinden sie.',
      'Wenn alles steht: „Von hier spielen“.',
    ],
  });
  sync();
}

function load(text) {
  const parts = String(text).trim().split(/\s+/);
  E.map = Board.parseFen(parts[0]);
  E.turn = parts[1] === 'b' ? 'b' : 'w';
  const rights = parts[2] == null ? 'KQkq' : parts[2];
  for (const flag of 'KQkq') E.castling[flag] = rights.includes(flag);
}

function loadFromInput() {
  const text = d.$('ed-fen').value.trim();
  if (!text || text === fen()) return;
  const rows = text.split(/\s+/)[0].split('/');
  const valid = rows.length === 8 && rows.every((row) => {
    if (!/^[pnbrqkPNBRQK1-8]+$/.test(row)) return false;
    let n = 0;
    for (const ch of row) n += /\d/.test(ch) ? +ch : 1;
    return n === 8;
  });
  if (!valid) {
    showError('Das ist kein gültiger FEN-Text.');
    return;
  }
  load(text);
  sync();
}

const available = () => {
  const out = {};
  for (const [flag, , king, ksq, rook, rsq] of CASTLE) out[flag] = E.map.get(ksq) === king && E.map.get(rsq) === rook;
  return out;
};

/** FEN der aufgebauten Stellung. */
function fen() {
  let placement = '';
  for (let r = 8; r >= 1; r--) {
    let empty = 0;
    for (const f of FILES) {
      const code = E.map.get(f + r);
      if (!code) {
        empty++;
        continue;
      }
      if (empty) placement += empty;
      empty = 0;
      placement += code[0] === 'w' ? code[1] : code[1].toLowerCase();
    }
    if (empty) placement += empty;
    if (r > 1) placement += '/';
  }
  const ok = available();
  const rights = [...'KQkq'].filter((flag) => ok[flag] && E.castling[flag]).join('') || '-';
  return `${placement} ${E.turn} ${rights} - 0 1`;
}

/** Prüft, ob von der Stellung aus gespielt werden kann. Gibt eine Fehlermeldung oder null zurück. */
function problem(text) {
  const codes = [...E.map.values()];
  if (codes.filter((c) => c === 'wK').length !== 1 || codes.filter((c) => c === 'bK').length !== 1) {
    return 'Jede Seite braucht genau einen König.';
  }
  for (const [sq, code] of E.map) {
    if (code[1] === 'P' && (sq[1] === '1' || sq[1] === '8')) return 'Bauern können nicht auf der ersten oder letzten Reihe stehen.';
  }
  let chess;
  try {
    chess = new Chess(text);
  } catch (e) {
    return 'Diese Stellung ist nach den Schachregeln nicht möglich.';
  }
  const other = E.turn === 'w' ? 'b' : 'w';
  const kingSq = [...E.map].find(([, code]) => code === other + 'K')[0];
  if (chess.isAttacked(kingSq, E.turn)) {
    return `Der König von ${SIDE[other]} steht im Schach, obwohl ${SIDE[E.turn]} am Zug ist. Stell das Zugrecht um oder verschieb eine Figur.`;
  }
  return null;
}

function showError(text) {
  const el = d.$('ed-error');
  el.textContent = text || '';
  el.hidden = !text;
}

function place(square) {
  if (E.tool === 'erase' || E.map.get(square) === E.tool) E.map.delete(square);
  else E.map.set(square, E.tool);
  sync();
}

function move(from, to) {
  const code = E.map.get(from);
  if (!code) return;
  E.map.delete(from);
  if (to) E.map.set(to, code);
  sync();
}

function drawPalette() {
  const set = d.pieceSet();
  const btn = (tool, inner, cls, label) =>
    `<button type="button" class="pal ${cls} ${E.tool === tool ? 'on' : ''}" data-tool="${tool}" title="${label}" aria-label="${label}" ${inner}</button>`;
  const piece = (color, t) => btn(color + t, `style="background-image:url('assets/pieces/${set}/${color}${t}.svg')">`, color === 'w' ? 'dark' : '', `${SIDE[color]} ${t}`);
  d.$('palette').innerHTML =
    btn('hand', `>${d.uiIcon('hand', 22)}`, 'tool', 'Figuren verschieben')
    + TYPES.map((t) => piece('w', t)).join('')
    + btn('erase', `>${d.uiIcon('trash', 22)}`, 'tool', 'Figuren entfernen')
    + TYPES.map((t) => piece('b', t)).join('');
}

function sync() {
  const $ = d.$;
  d.board.setPosition(fen(), { animate: false });
  drawPalette();
  $('ed-turn').innerHTML = ['w', 'b'].map((c) => `<button type="button" class="${E.turn === c ? 'on' : ''}" data-turn="${c}">${SIDE[c]}</button>`).join('');
  const ok = available();
  $('ed-castle').innerHTML = CASTLE.map(([flag, label]) =>
    `<label class="${ok[flag] ? '' : 'off'}"><input type="checkbox" data-flag="${flag}" ${ok[flag] && E.castling[flag] ? 'checked' : ''} ${ok[flag] ? '' : 'disabled'}>${label}</label>`).join('');
  if (document.activeElement !== $('ed-fen')) $('ed-fen').value = fen();
  showError('');
}
