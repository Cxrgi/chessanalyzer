// Führt zwei Stände zusammen (dieses Gerät + Server bzw. Sicherungs-Code) – ohne Browser-Abhängigkeiten, damit es testbar ist.
//
// Aufbau eines Stands:
// { v: 1,
//   keys:  { name: { v: Wert, at: Zeitstempel der letzten Änderung } },   // Einstellungen, Aufgaben-Wertung, Lektionen …
//   meta:  { id: Kurzfassung einer analysierten Partie },
//   cards: { id: Trainingskarte },
//   notes: { Partie-id: { id, mod, notes: { Halbzug: Text }, lines: [{ id, base, ucis }] } },  // eigene Notizen und Varianten
//   del:   { 'g:<Partie>' | 'c:<Karte>' | 'n:<Partie>': Zeitstempel } }    // Gelöschtes, damit es nicht wieder auftaucht
const DAY = 86400000;
const KEEP_DELETED = 180 * DAY;

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const size = (x) => JSON.stringify(x === undefined ? null : x).length;

/** JSON mit sortierten Schlüsseln – damit zwei gleiche Stände auch gleich aussehen. */
export function stable(x) {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}

export const emptyState = () => ({ v: 1, keys: {}, meta: {}, cards: {}, notes: {}, del: {} });

/** Zahlen je Tag und Art: der größere Wert gewinnt (Aktivität lässt sich nicht „zurücknehmen“). */
function mergeDays(a, b) {
  const out = {};
  for (const day of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = (a || {})[day] || {}, y = (b || {})[day] || {};
    out[day] = {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      out[day][k] = typeof x[k] === 'number' || typeof y[k] === 'number' ? Math.max(x[k] || 0, y[k] || 0) : (x[k] !== undefined ? x[k] : y[k]);
    }
  }
  return out;
}

/** Besondere Regeln für Werte, die nur wachsen: Beides zusammenlegen statt eines zu verwerfen. */
const COMBINE = {
  activity: mergeDays,
  lessons: (a, b) => ({ ...a, ...b }),
  endgames: (a, b) => ({ ...a, ...b }),
  wins: (a, b) => Math.max(Number(a) || 0, Number(b) || 0),
  newseen: (a, b) => Math.max(Number(a) || 0, Number(b) || 0),
  ratings: (a, b, newer) => ({ ...(newer === 'a' ? b : a), ...(newer === 'a' ? a : b) }),
  trainers: (a, b) => {
    const openings = { ...((a || {}).openings || {}) };
    for (const [id, n] of Object.entries((b || {}).openings || {})) openings[id] = Math.max(openings[id] || 0, n || 0);
    const ca = (a || {}).coords || {}, cb = (b || {}).coords || {};
    return { coords: { w: Math.max(ca.w || 0, cb.w || 0), b: Math.max(ca.b || 0, cb.b || 0) }, openings };
  },
};

function mergeKey(name, a, b) {
  if (!a) return b;
  if (!b) return a;
  const at = Math.max(a.at || 0, b.at || 0);
  const combine = COMBINE[name];
  if (combine && (name === 'wins' || name === 'newseen' || (isObj(a.v) && isObj(b.v)))) return { v: combine(a.v, b.v, (a.at || 0) >= (b.at || 0) ? 'a' : 'b'), at };
  // Sonst gewinnt die neuere Änderung. Ist ein Wert noch nie abgeglichen worden (at ≤ 1), gewinnt bei
  // Fortschrittsdaten der umfangreichere Stand – so geht beim ersten Abgleich nichts Wertvolles verloren.
  const fresh = (x) => (x.at || 0) <= 1;
  if ((fresh(a) || fresh(b)) && name !== 'settings' && name !== 'site' && name !== 'username') {
    if (fresh(a) && fresh(b)) return size(a.v) >= size(b.v) ? { ...a, at } : { ...b, at };
    const [old, dated] = fresh(a) ? [a, b] : [b, a];
    return size(old.v) > size(dated.v) * 1.5 ? { v: old.v, at: dated.at + 1 } : dated;
  }
  return (a.at || 0) >= (b.at || 0) ? a : b;
}

const stamp = (x) => Math.max(x.mod || 0, x.at || 0);

/**
 * @returns zusammengeführter Stand. Reihenfolge der Argumente spielt keine Rolle.
 */
export function mergeStates(a, b, now = Date.now()) {
  a = { ...emptyState(), ...(a || {}) };
  b = { ...emptyState(), ...(b || {}) };
  const out = emptyState();

  for (const k of new Set([...Object.keys(a.del), ...Object.keys(b.del)])) {
    const t = Math.max(a.del[k] || 0, b.del[k] || 0);
    if (now - t < KEEP_DELETED) out.del[k] = t;
  }
  for (const name of new Set([...Object.keys(a.keys), ...Object.keys(b.keys)])) {
    const m = mergeKey(name, a.keys[name], b.keys[name]);
    if (m && m.v !== undefined) out.keys[name] = m;
  }
  for (const id of new Set([...Object.keys(a.meta), ...Object.keys(b.meta)])) {
    const x = a.meta[id], y = b.meta[id];
    const pick = !x ? y : !y ? x : stamp(x) >= stamp(y) ? x : y;
    // Gelöscht bleibt gelöscht – außer die Partie wurde danach neu analysiert.
    if ((out.del['g:' + id] || 0) < (pick.at || 0)) out.meta[id] = pick;
  }
  for (const id of new Set([...Object.keys(a.notes), ...Object.keys(b.notes)])) {
    const x = a.notes[id], y = b.notes[id];
    const pick = !x ? y : !y ? x : (x.mod || 0) >= (y.mod || 0) ? x : y;
    if ((out.del['n:' + id] || 0) < (pick.mod || 0)) out.notes[id] = pick;
  }
  for (const id of new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])) {
    if (out.del['c:' + id]) continue;
    const x = a.cards[id], y = b.cards[id];
    out.cards[id] = !x ? y : !y ? x : (x.mod || 0) !== (y.mod || 0) ? ((x.mod || 0) > (y.mod || 0) ? x : y) : ((x.seen || 0) >= (y.seen || 0) ? x : y);
  }
  return out;
}

export const sameState = (a, b) => stable(a) === stable(b);
