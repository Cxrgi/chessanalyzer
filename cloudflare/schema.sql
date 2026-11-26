-- Speicher für den Cloudflare Worker: ein Schlüssel-Wert-Speicher in zwei Bereichen.
--   store = 'auth': Konten (u/<name>), Einstellungen (settings), Betreiber-Passwort (config)
--   store = 'sync': Stand (<name>/state) und Partien (<name>/game/<id>) je Konto
CREATE TABLE IF NOT EXISTS kv (
  store TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store, key)
);
