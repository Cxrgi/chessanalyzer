// Eigene Symbole für die Zugbewertungen (als Inline-SVG) und ein paar UI-Icons.
import { CLASSES } from './analysis.js';

const GLYPH = {
  brilliant: '<text x="12" y="17" font-size="13.5">!!</text>',
  great: '<text x="12" y="17" font-size="14">!</text>',
  best: '<path d="M12 4.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.9l5-.7z"/>',
  excellent: '<path d="M9.2 18.2H7.1c-.5 0-.9-.4-.9-.9v-5.5c0-.5.4-.9.9-.9h2.1zm1.3-7.4l2.3-4.6c.2-.4.7-.6 1.1-.4.8.3 1.2 1.200 1 2l-.5 2.300h3c.9 0 1.500.8 1.300 1.700l-1.100 5c-.2.8-.9 1.400-1.700 1.400h-5.400z"/>',
  good: '<path d="M10.300 17.300l-4.500-4.500 1.800-1.800 2.700 2.700 6.300-6.300 1.800 1.800z"/>',
  book: '<path d="M5 6.500c2.300-.8 4.500-.6 6.300.5v10.500c-1.800-1.100-4-1.300-6.300-.5zm14 0c-2.300-.8-4.500-.6-6.300.5v10.500c1.800-1.100 4-1.300 6.300-.5z"/>',
  forced: '<path d="M5 10.800h8.500V7.300l5.700 4.700-5.700 4.700v-3.500H5z"/>',
  inaccuracy: '<text x="12" y="17" font-size="13">?!</text>',
  mistake: '<text x="12" y="17" font-size="14">?</text>',
  miss: '<path d="M7.600 5.800L12 10.200l4.400-4.400 1.800 1.800L13.800 12l4.400 4.400-1.800 1.800L12 13.800l-4.400 4.400-1.800-1.800L10.200 12 5.800 7.600z"/>',
  blunder: '<text x="12" y="17" font-size="13">??</text>',
};

/** Rundes Bewertungs-Symbol als SVG-Text. */
export function classIcon(cls, size = 18) {
  const c = CLASSES[cls];
  if (!c) return '';
  return `<svg class="cls-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-label="${c.label}" role="img">`
    + `<circle cx="12" cy="12" r="12" fill="${c.color}"/>`
    + `<g fill="#fff" font-family="system-ui,Segoe UI,Arial,sans-serif" font-weight="800" text-anchor="middle">${GLYPH[cls]}</g></svg>`;
}

const UI = {
  first: '<path d="M6 5h2.200v14H6zm3.200 7L19 5v14z"/>',
  prev: '<path d="M16.500 5v14L6.500 12z"/>',
  next: '<path d="M7.500 5v14l10-7z"/>',
  last: '<path d="M15.800 5H18v14h-2.200zM14.800 12L5 19V5z"/>',
  flip: '<path d="M7 4l-4 4h3v8h2V8h3zm10 16l4-4h-3V8h-2v8h-3z"/>',
  gear: '<path d="M19.400 13a7.500 7.500 0 000-2l2-1.600-2-3.400-2.400 1a7.500 7.500 0 00-1.700-1L15 3.500h-4l-.4 2.500a7.500 7.500 0 00-1.700 1l-2.400-1-2 3.400 2 1.600a7.500 7.500 0 000 2l-2 1.600 2 3.400 2.400-1a7.500 7.500 0 001.700 1l.4 2.500h4l.4-2.500a7.500 7.500 0 001.700-1l2.400 1 2-3.400zM13 15.200a3.200 3.200 0 110-6.400 3.200 3.200 0 010 6.400z" transform="translate(-1 0)"/>',
  sound: '<path d="M4 9.500v5h3.500L12 19V5L7.500 9.500zm11.500 2.500a4 4 0 00-2-3.500v7a4 4 0 002-3.500zm-2-8v2.100a6.500 6.500 0 010 11.800V20a8.500 8.500 0 000-16z"/>',
  mute: '<path d="M4 9.500v5h3.500L12 19V5L7.500 9.500zm16.600.100L19.200 8.200 17 10.400l-2.200-2.200-1.400 1.400 2.200 2.200-2.200 2.200 1.400 1.400 2.200-2.200 2.200 2.200 1.400-1.400-2.200-2.200z"/>',
  bulb: '<path d="M12 3a6.500 6.500 0 00-3.800 11.800c.5.400.8 1 .8 1.600V17h6v-.600c0-.600.300-1.200.800-1.600A6.500 6.500 0 0012 3zM9.500 18.500h5V20a1 1 0 01-1 1h-3a1 1 0 01-1-1z"/>',
  retry: '<path d="M12 5V2L7.500 6 12 10V7a5 5 0 11-5 5H5a7 7 0 107-7z"/>',
  arrow: '<path d="M5 11h10.200l-3.600-3.600L13 6l6 6-6 6-1.400-1.400 3.600-3.600H5z"/>',
  back: '<path d="M19 11H8.800l3.600-3.600L11 6l-6 6 6 6 1.400-1.400L8.800 13H19z"/>',
  chart: '<path d="M4 19h16v1.800H4zM5.500 11h3v6.500h-3zm5-5h3v11.500h-3zm5 3h3v8.500h-3z"/>',
  close: '<path d="M6.400 5L12 10.600 17.600 5 19 6.400 13.400 12l5.600 5.600-1.400 1.400L12 13.400 6.400 19 5 17.600 10.600 12 5 6.400z"/>',
  hand: '<path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>',
  trash: '<path d="M6 19c0 1.100.900 2 2 2h8c1.100 0 2-.900 2-2V7H6v12zM19 4h-3.500l-1-1h-5l-1 1H5v2h14V4z"/>',
  star: '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1.100 5.900L12 16.900l-5.300 2.800 1.100-5.900-4.300-4.100 5.900-.800z"/>',
};

export function uiIcon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${UI[name] || ''}</svg>`;
}
