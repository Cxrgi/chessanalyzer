// Kompakter Schlüssel für eine Stellung (Figuren, Zugrecht, Rochaderechte) –
// wird für das Eröffnungsbuch verwendet.
export function positionKey(fen) {
  const s = fen.split(' ').slice(0, 3).join(' ');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
