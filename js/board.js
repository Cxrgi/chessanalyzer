// Schachbrett: Figuren mit Animation, Markierungen, Pfeile, Bewertungs-Symbol
// sowie Ziehen per Klick oder Drag & Drop.
import { classIcon } from './icons.js';

const FILES = 'abcdefgh';

export class Board {
  /**
   * @param root     Container-Element
   * @param opts     { getMoves(square) -> [{to, promotion?}], onMove({from, to, promotion}) }
   */
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.orientation = 'w';
    this.pieces = new Map(); // square -> { el, code }
    this.interactive = false;
    this.selected = null;
    this.targets = [];
    this.drag = null;
    this.pieceSet = 'cburnett';

    root.classList.add('board');
    root.innerHTML = `
      <div class="board-coords"></div>
      <div class="board-marks"></div>
      <div class="board-pieces"></div>
      <svg class="board-arrows" viewBox="0 0 8 8"></svg>
      <div class="board-hints"></div>
      <div class="board-badge"></div>
      <div class="board-promo" hidden></div>`;
    this.coordsEl = root.querySelector('.board-coords');
    this.marksEl = root.querySelector('.board-marks');
    this.piecesEl = root.querySelector('.board-pieces');
    this.arrowsEl = root.querySelector('.board-arrows');
    this.hintsEl = root.querySelector('.board-hints');
    this.badgeEl = root.querySelector('.board-badge');
    this.promoEl = root.querySelector('.board-promo');
    this.decor = {};

    this.drawCoords();
    root.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    root.addEventListener('pointermove', (e) => this.onPointerMove(e));
    root.addEventListener('pointerup', (e) => this.onPointerUp(e));
    root.addEventListener('pointercancel', () => this.cancelDrag());
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // -- Geometrie -------------------------------------------------------------

  /** Spalte/Zeile (0–7, von oben links) eines Feldes in der aktuellen Ausrichtung. */
  xy(square) {
    const f = FILES.indexOf(square[0]);
    const r = +square[1] - 1;
    return this.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  }

  squareAt(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return this.orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
  }

  place(el, square) {
    const [x, y] = this.xy(square);
    el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  }

  // -- Aussehen --------------------------------------------------------------

  setPieceSet(name) {
    this.pieceSet = name;
    this.root.dataset.pieces = name;
    for (const { el, code } of this.pieces.values()) el.style.backgroundImage = this.pieceUrl(code);
  }

  pieceUrl(code) {
    return `url("assets/pieces/${this.pieceSet}/${code}.svg")`;
  }

  drawCoords() {
    let html = '';
    for (let i = 0; i < 8; i++) {
      const rank = this.orientation === 'w' ? 8 - i : i + 1;
      const file = this.orientation === 'w' ? FILES[i] : FILES[7 - i];
      html += `<span class="coord rank ${i % 2 ? 'on-dark' : 'on-light'}" style="top:${i * 12.5}%">${rank}</span>`;
      html += `<span class="coord file ${i % 2 ? 'on-light' : 'on-dark'}" style="left:${i * 12.5}%">${file}</span>`;
    }
    this.coordsEl.innerHTML = html;
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.drawCoords();
    this.root.classList.add('no-anim');
    for (const [sq, p] of this.pieces) this.place(p.el, sq);
    this.setDecor(this.decor);
    this.clearSelection();
    void this.root.offsetWidth;
    this.root.classList.remove('no-anim');
  }

  // -- Stellung --------------------------------------------------------------

  static parseFen(fen) {
    const map = new Map();
    const rows = fen.split(' ')[0].split('/');
    rows.forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += +ch;
        else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          map.set(FILES[f] + (8 - i), color + ch.toUpperCase());
          f++;
        }
      }
    });
    return map;
  }

  /** Setzt die Stellung; passende Figuren gleiten animiert auf ihr neues Feld. */
  setPosition(fen, { animate = true } = {}) {
    this.cancelDrag();
    this.clearSelection();
    const next = Board.parseFen(fen);
    const removed = [];
    const added = [];
    for (const [sq, p] of this.pieces) {
      if (next.get(sq) !== p.code) removed.push([sq, p]);
    }
    for (const [sq, code] of next) {
      const cur = this.pieces.get(sq);
      if (!cur || cur.code !== code) added.push([sq, code]);
    }
    if (!animate) this.root.classList.add('no-anim');
    for (const [sq] of removed) this.pieces.delete(sq);

    const dist = (a, b) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(+a[1] - +b[1]);
    for (const [sq, code] of added) {
      // gleiche Figur, die woanders verschwunden ist → verschieben
      let best = -1;
      removed.forEach(([from, p], i) => {
        if (!p || p.code !== code) return;
        if (best < 0 || dist(from, sq) < dist(removed[best][0], sq)) best = i;
      });
      // Umwandlung: Bauer derselben Farbe wird zur neuen Figur
      if (best < 0) {
        best = removed.findIndex(([from, p]) => p && p.code === code[0] + 'P' && dist(from, sq) <= 2 && /[18]/.test(sq[1]));
      }
      let el;
      if (best >= 0) {
        el = removed[best][1].el;
        removed[best][1] = null;
        el.classList.remove('dragging');
        el.style.left = el.style.top = '';
      } else {
        el = document.createElement('div');
        el.className = 'piece';
        this.piecesEl.appendChild(el);
      }
      el.style.backgroundImage = this.pieceUrl(code);
      el.dataset.code = code;
      this.place(el, sq);
      this.pieces.set(sq, { el, code });
    }
    for (const [, p] of removed) {
      if (!p) continue;
      if (animate) {
        p.el.classList.add('gone');
        setTimeout(() => p.el.remove(), 160);
      } else {
        p.el.remove();
      }
    }
    if (!animate) {
      void this.root.offsetWidth;
      this.root.classList.remove('no-anim');
    }
  }

  // -- Markierungen ----------------------------------------------------------

  /**
   * @param d { squares: [{square, color}], arrows: [{from, to, color}], badge: {square, cls}, check: square }
   */
  setDecor(d = {}) {
    this.decor = d;
    let marks = '';
    for (const m of d.squares || []) {
      const [x, y] = this.xy(m.square);
      marks += `<div class="mark" style="left:${x * 12.5}%;top:${y * 12.5}%;background:${m.color}"></div>`;
    }
    this.marksEl.innerHTML = marks;

    let arrows = '';
    for (const a of d.arrows || []) {
      const [x1, y1] = this.xy(a.from).map((v) => v + 0.5);
      const [x2, y2] = this.xy(a.to).map((v) => v + 0.5);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (!len) continue;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const head = 0.38, w = 0.17, hw = 0.36;
      const sx = x1 + ux * 0.18, sy = y1 + uy * 0.18;
      const ex = x2 - ux * head, ey = y2 - uy * head;
      const px = -uy, py = ux;
      const pts = [
        [sx + px * w / 2, sy + py * w / 2], [ex + px * w / 2, ey + py * w / 2],
        [ex + px * hw / 2, ey + py * hw / 2], [x2 - ux * 0.06, y2 - uy * 0.06],
        [ex - px * hw / 2, ey - py * hw / 2], [ex - px * w / 2, ey - py * w / 2],
        [sx - px * w / 2, sy - py * w / 2],
      ].map((p) => p.map((v) => v.toFixed(3)).join(',')).join(' ');
      arrows += `<polygon points="${pts}" fill="${a.color}" opacity="${a.opacity || 0.85}"/>`;
    }
    this.arrowsEl.innerHTML = arrows;

    if (d.badge) {
      const [x, y] = this.xy(d.badge.square);
      this.badgeEl.innerHTML = classIcon(d.badge.cls, 64);
      this.badgeEl.style.left = `${Math.min(x * 12.5 + 8.6, 95.2)}%`;
      this.badgeEl.style.top = `${Math.max(y * 12.5 - 1.6, 0.4)}%`;
      this.badgeEl.hidden = false;
    } else {
      this.badgeEl.hidden = true;
    }
  }

  // -- Eingabe ---------------------------------------------------------------

  setInteractive(on) {
    this.interactive = on;
    this.root.classList.toggle('interactive', !!on);
    if (!on) this.clearSelection();
  }

  clearSelection() {
    if (this.promoFrom) {
      const p = this.pieces.get(this.promoFrom);
      if (p) this.place(p.el, this.promoFrom);
      this.promoFrom = null;
    }
    this.selected = null;
    this.targets = [];
    this.hintsEl.innerHTML = '';
    this.promoEl.hidden = true;
  }

  select(square) {
    const targets = this.opts.getMoves ? this.opts.getMoves(square) : [];
    if (!targets.length) {
      this.clearSelection();
      return false;
    }
    this.selected = square;
    this.targets = targets;
    const [sx, sy] = this.xy(square);
    let html = `<div class="sq-sel" style="left:${sx * 12.5}%;top:${sy * 12.5}%"></div>`;
    const seen = new Set();
    for (const t of targets) {
      if (seen.has(t.to)) continue;
      seen.add(t.to);
      const [x, y] = this.xy(t.to);
      html += `<div class="sq-hint ${this.pieces.has(t.to) ? 'capture' : ''}" style="left:${x * 12.5}%;top:${y * 12.5}%"></div>`;
    }
    this.hintsEl.innerHTML = html;
    return true;
  }

  tryMove(from, to) {
    const options = this.targets.filter((t) => t.to === to);
    if (!options.length) return false;
    if (options.some((t) => t.promotion)) {
      this.askPromotion(from, to);
      return true;
    }
    this.clearSelection();
    this.opts.onMove && this.opts.onMove({ from, to });
    return true;
  }

  askPromotion(from, to) {
    const color = this.pieces.get(from).code[0];
    const [x, y] = this.xy(to);
    const down = y === 0;
    this.promoEl.innerHTML = ['q', 'n', 'r', 'b'].map((p) =>
      `<button type="button" data-p="${p}" style="background-image:${this.pieceUrl(color + p.toUpperCase()).replace(/"/g, "'")}" aria-label="Umwandlung ${p}"></button>`).join('');
    this.promoEl.style.left = `${x * 12.5}%`;
    this.promoEl.style.top = down ? '0' : 'auto';
    this.promoEl.style.bottom = down ? 'auto' : '0';
    this.promoEl.hidden = false;
    this.promoFrom = from;
    this.promoEl.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();
      this.promoFrom = null;
      this.clearSelection();
      this.opts.onMove && this.opts.onMove({ from, to, promotion: btn.dataset.p });
    };
  }

  onPointerDown(e) {
    if (!this.interactive || e.button > 0) return;
    if (e.target.closest('.board-promo')) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (this.selected && sq !== this.selected && this.tryMove(this.selected, sq)) return;
    const piece = this.pieces.get(sq);
    if (!piece || !this.select(sq)) {
      this.clearSelection();
      return;
    }
    e.preventDefault();
    this.root.setPointerCapture(e.pointerId);
    this.drag = { from: sq, el: piece.el, startX: e.clientX, startY: e.clientY, moved: false };
  }

  onPointerMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    d.moved = true;
    const rect = this.root.getBoundingClientRect();
    const size = rect.width / 8;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left)) - size / 2;
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top)) - size / 2;
    d.el.classList.add('dragging');
    d.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  onPointerUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.el.classList.remove('dragging');
    if (!d.moved) return; // Klick: Auswahl bleibt bestehen
    const sq = this.squareAt(e.clientX, e.clientY);
    if (sq && sq !== d.from && this.targets.some((t) => t.to === sq)) {
      // Figur ohne Animation absetzen; die App setzt danach die neue Stellung
      this.root.classList.add('no-anim');
      this.place(d.el, sq);
      void this.root.offsetWidth;
      this.root.classList.remove('no-anim');
      if (this.tryMove(d.from, sq)) return;
    }
    this.place(d.el, d.from);
  }

  cancelDrag() {
    if (!this.drag) return;
    this.drag.el.classList.remove('dragging');
    this.place(this.drag.el, this.drag.from);
    this.drag = null;
  }
}
