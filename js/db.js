// Dauerhafter Speicher im Browser (IndexedDB): analysierte Partien, Engine-Ergebnisse je Stellung
// und Trainingskarten. Anders als localStorage gibt es hier praktisch keine Größengrenze.
// Steht IndexedDB nicht zur Verfügung (z. B. privates Fenster), wird nur im Arbeitsspeicher gehalten.
const NAME = 'chessanalyzer';
const STORES = ['games', 'meta', 'evals', 'cards', 'notes'];
let opening = null;
const memory = new Map(STORES.map((s) => [s, new Map()]));

function open() {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const req = indexedDB.open(NAME, 2); // Version 2: Speicher „notes“ (eigene Varianten und Notizen)
        req.onupgradeneeded = () => {
          for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  return opening;
}

async function run(store, mode, work) {
  const db = await open();
  if (!db) return work(null, memory.get(store));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let out;
    Promise.resolve(work(tx.objectStore(store), null)).then((v) => { out = v; }, reject);
    tx.oncomplete = () => resolve(out);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const db = {
  get: (store, key) => run(store, 'readonly', (os, mem) => (os ? wrap(os.get(key)) : mem.get(key))),
  set: (store, key, value) => run(store, 'readwrite', (os, mem) => (os ? wrap(os.put(value, key)) : mem.set(key, value))),
  del: (store, key) => run(store, 'readwrite', (os, mem) => (os ? wrap(os.delete(key)) : mem.delete(key))),
  clear: (store) => run(store, 'readwrite', (os, mem) => (os ? wrap(os.clear()) : mem.clear())),
  /** Alle Einträge als [{ key, value }]. */
  all: (store) => run(store, 'readonly', async (os, mem) => {
    if (!os) return [...mem].map(([key, value]) => ({ key, value }));
    const [keys, values] = await Promise.all([wrap(os.getAllKeys()), wrap(os.getAll())]);
    return keys.map((key, i) => ({ key, value: values[i] }));
  }),
  /** Mehrere Schlüssel auf einmal lesen → Map(key → value) nur mit Treffern. */
  getMany: (store, keys) => run(store, 'readonly', async (os, mem) => {
    const out = new Map();
    if (!os) {
      for (const k of keys) if (mem.has(k)) out.set(k, mem.get(k));
      return out;
    }
    await Promise.all(keys.map((k) => wrap(os.get(k)).then((v) => { if (v !== undefined) out.set(k, v); })));
    return out;
  }),
  /** Mehrere Einträge auf einmal schreiben: [[key, value], …]. */
  setMany: (store, entries) => run(store, 'readwrite', (os, mem) => {
    for (const [k, v] of entries) (os ? os.put(v, k) : mem.set(k, v));
  }),
};

/** Übernimmt den alten Verlauf aus localStorage (max. 12 Partien) einmalig in die Datenbank. */
export async function migrateLegacy() {
  let hist;
  try {
    hist = JSON.parse(localStorage.getItem('ca.history') || 'null');
  } catch (e) {
    hist = null;
  }
  if (!Array.isArray(hist)) return;
  for (const h of hist) {
    try {
      const saved = JSON.parse(localStorage.getItem('ca.g.' + h.id) || 'null');
      if (saved && saved.game) {
        await db.set('games', h.id, { ...saved, at: Date.now() });
        await db.set('meta', h.id, { id: h.id, at: Date.now(), white: h.white, black: h.black, result: h.result, date: h.date });
      }
      localStorage.removeItem('ca.g.' + h.id);
    } catch (e) { /* Eintrag überspringen */ }
  }
  localStorage.removeItem('ca.history');
}
