# Chess Analyzer

Kostenlose Partieanalyse für chess.com-Partien – für alle, die dafür kein Abo bezahlen wollen.
Link einfügen, und ein Coach geht die Partie Zug für Zug mit dir durch.

**Live:** <https://chessanalyzer-cxrgi.netlify.app>

Nicht mit Chess.com verbunden. Die komplette Analyse läuft im Browser auf deinem Gerät (Stockfish als WebAssembly).

## Was die Seite kann

- **Benutzerkonten** mit eigenem Stand je Person, **Synchronisierung** zwischen allen Geräten und eine
  **Verwaltung** für den Betreiber
- **Startseite** mit allen Bereichen auf einen Blick
- **Taktikaufgaben**: rund 13 500 Aufgaben von leicht bis schwer, automatisch passend zur eigenen Wertung –
  mit Wertungszahl, Serie, Statistik, Tipp, vorgespielter Lösung und Themen-Training (Gabel, Fesselung, Matt in 2 …)
- **Lektionen**: 53 kurze, interaktive Lektionen in neun Kursen – Grundlagen, Taktik, Mattbilder, Eröffnung, Endspiel,
  Sicher spielen, Taktik für Fortgeschrittene, Strategie und Königsangriff – mit Aufgaben direkt auf dem Brett,
  Tipps, Lösungen und gespeichertem Fortschritt
- **Partie laden** über einen chess.com- oder Lichess-Link, über deinen Benutzernamen (Liste der letzten Partien
  mit Filtern), per PGN-Text oder PGN-Datei (auch per Drag & Drop, auch mit mehreren Partien)
- **Gegen den Computer spielen** in acht Stärkestufen (Zug zurück, Tipp, danach direkt analysieren) und
  **Endspiel-Trainer** mit Mattführungen, Turmendspielen und Bauernendspielen (Opposition, Quadratregel, Durchbruch,
  Dame gegen Bauer) – alle Stellungen mit Stockfish geprüft
- **Fehler-Training**: Fehler aus den eigenen Partien kommen als Aufgaben in wachsenden Abständen wieder, bis sie sitzen
- **Trainer**: Eröffnungstrainer mit 36 Hauptvarianten und Koordinaten-Trainer
- **Mein Profil**: Genauigkeit im Verlauf, häufigste Fehlerarten mit passender Lektion und Aufgaben, Zeitmanagement,
  Serien, Abzeichen, mehrere Partien am Stück analysieren, Sicherungs-Code zum Kopieren und Einfügen
- **Taktik-Extras**: Tagesaufgabe, „Sturm“ auf Zeit, Tipp in zwei Stufen, falsch gelöste Aufgaben kommen wieder,
  Statistik je Thema
- **Exportieren und teilen**: kommentierte PGN (mit Bewertungen), Teilen-Link mit fertiger Analyse (der Empfänger muss
  nichts neu rechnen), Brett als Bild, Fazit als Text
- **Werkzeuge in der Analyse**: „Nur Fehler“, „Drohung zeigen“, „Tiefer rechnen“, eigene Pfeile und Markierungen per
  Rechtsklick, Mausrad zum Blättern, Tastenkürzel-Übersicht mit `?`
- **Live-Vorschau**: Während die Engine rechnet, füllen sich Bewertungsverlauf und vorläufige Genauigkeit
- **„Zeig mir warum“**: Bei Fehlern spielt der Coach die Bestrafung vor, bei verpassten Chancen den besseren Weg und bei
  brillanten oder großartigen Zügen, warum sie funktionieren – mit Fazit zu Material und Bewertung
- **Eigene Varianten und Notizen** zu jeder Partie: bleiben gespeichert, werden mit dem Konto abgeglichen und stehen in
  der PGN-Datei als Nebenvarianten und Kommentare
- **Neue Partien**: Die Startseite erkennt neue Partien deines chess.com- oder Lichess-Kontos und analysiert sie auf Wunsch
  nacheinander im Hintergrund (eine eigene Analyse hat immer Vorrang)
- **Eröffnungs-Repertoire**: Eröffnungen mit Weiß und Schwarz festlegen (aus dem Trainer, als eigene Linie oder vom
  Analysebrett); die Analyse zeigt, wo du oder dein Gegner davon abgewichen seid
- **Einstellungen**: helles, dunkles oder automatisches Design (wie das System), 11 Brettfarben, 9 Figurensätze,
  Brettgröße, Notation (deutsch, englisch, Figuren), Strenge der Bewertung, Zahl der Engine-Linien, Farben für
  Farbenblinde, Lautstärke, Animationen
- **Offline nutzbar** und als App installierbar (Service Worker); einmal geladene Dateien kommen aus dem Gerätespeicher
- **Jeder Zug bewertet**: Brillant, Großartig, Bester Zug, Ausgezeichnet, Gut, Buchzug, Ungenauigkeit, Fehler, Verpasste Chance, Patzer
- **Bewertungsleiste**, Genauigkeit für beide Seiten, Bewertungsdiagramm, Eröffnungsname
- **Coach**, der in Sätzen erklärt, was ein Zug bewirkt, warum er schlecht war und was besser gewesen wäre –
  auf Wunsch aus deiner Sicht („Du …“), mit Fesselungen, Gabeln, Mattdrohungen und Abwicklungen
- **Übersicht** mit Partiephasen, Schlüsselmomenten zum Anspringen und persönlichen Lernpunkten
- Roter Pfeil auf dem Brett zeigt bei Fehlern, wie der Gegner sie bestraft
- **„Bester Zug“** zeigt die Engine-Empfehlung samt Fortsetzung, **„Nochmal versuchen“** lässt dich den Fehler selbst korrigieren
- **Eigene Varianten**: einfach Figuren ziehen, Stockfish rechnet live mit
- **Analysebrett**: frei für beide Seiten ziehen, jeder Zug wird sofort bewertet, der beste Zug erscheint als Pfeil;
  Zugliste zum Zurückspringen, FEN/PGN kopieren, der Stand bleibt beim Neuladen erhalten
- **Stellungs-Editor**: beliebige Stellung aufbauen (Figuren setzen, verschieben, löschen, Zugrecht, Rochaderechte,
  FEN einfügen) und von dort aus weiterspielen
- Uhren, geschlagene Figuren, Brett drehen, Tastatursteuerung (← → Pos1 Ende, F = drehen, N = nächster Schlüsselmoment), Töne
- Brettfarben und Figurensets wählbar, bereits analysierte Partien werden im Browser gespeichert

## Konten und Verwaltung

- **Benutzerkonten:** Jede Person legt ein eigenes Konto an (Benutzername, Passwort, wo sie spielt und unter welchem
  Namen). Partien, Fortschritt, Trainingskarten und Einstellungen gehören zum Konto und sind auf jedem Gerät gleich.
- **Synchronisierung:** ein Abruf beim Öffnen, danach wird nur hochgeladen, wenn sich etwas geändert hat (gebündelt,
  höchstens alle zwei Minuten). Analysierte Partien werden einmal hochgeladen und auf anderen Geräten bei Bedarf geholt.
- **Sicherungs-Code** (im Profil): der komplette Stand als Text zum Kopieren und Einfügen – auch ohne Konto nutzbar.
- **Abmelden** lädt erst alles hoch und entfernt dann den Stand von diesem Gerät, damit sich Konten nicht vermischen.
- **Verwaltung** unter `/admin`, geschützt durch das Betreiber-Passwort (mit Notfall-Code zum Zurücksetzen):
  Konten ansehen, sperren, abmelden, löschen (samt Daten), Übergangs-Passwort vergeben, Speicherverbrauch je Konto
  (auf Knopfdruck), Daten eines Kontos als JSON exportieren, Registrierung offen / nur mit Einladungscode /
  geschlossen, Höchstzahl an Konten, Hinweistext für alle.
- Gespeichert werden nur gesalzene Hashes, nie Passwörter – auf Netlify im Blob-Speicher (`auth` für Konten,
  `sync` für die Stände), lokal im Ordner `.data/`.
- Geschützt sind Seite, Skripte und `/api/*`. Bilder, Stylesheet, Engine und die freien Daten bleiben abrufbar.
- Umgebungsvariable `SETUP_TOKEN`: Ist sie gesetzt, kann nur jemand mit diesem Code das erste Betreiber-Passwort festlegen.
- `REQUIRE_LOGIN=false` (oder lokal `NO_PASSWORD=1 npm start`) schaltet Anmeldung, Konten und Synchronisierung ab;
  dann liegt alles nur im jeweiligen Browser. Dasselbe gilt für rein statisches Hosting (z. B. GitHub Pages).
- **Impressum und Datenschutzerklärung** stehen unter `/impressum` und `/datenschutz` (ohne Anmeldung lesbar, verlinkt
  auf der Anmeldeseite und in der App). Name, Anschrift und E-Mail des Betreibers werden in der Verwaltung eingetragen –
  sie stehen also nicht im Code. Die Texte beschreiben, was die Seite technisch tut; sie ersetzen keine Rechtsberatung.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) 18 oder neuer. Es müssen keine Pakete installiert werden.

```bash
npm start
```

Danach <http://localhost:8080> öffnen.

Die Seite direkt per Doppelklick auf `index.html` zu öffnen funktioniert nicht – Browser erlauben die Engine nur über einen Webserver.

## Online stellen

| Hosting | Link einfügen genügt? | Hinweis |
| --- | --- | --- |
| **Netlify** | Ja | Repository verbinden, fertig. `netlify.toml` und die Funktion unter `netlify/functions/` sind schon dabei. |
| **Eigener Server** | Ja | `npm start` (Port über die Umgebungsvariable `PORT`). |
| **GitHub Pages** o. ä. (rein statisch) | Mit Benutzername | Ohne Server-Funktion wird die Partie über dein öffentliches Partie-Archiv gefunden – dafür einmal den chess.com-Namen eintragen. |

Hintergrund: chess.com erlaubt Browsern anderer Webseiten nicht, eine Partie direkt über ihre ID abzurufen.
Deshalb holt eine winzige Server-Funktion (`server/proxy.mjs`) die Partie-Daten. Die öffentliche Archiv-Schnittstelle
(`api.chess.com/pub`) funktioniert dagegen direkt aus dem Browser und dient als Ausweichweg.

### Sparsam mit dem Netlify-Kontingent

- Die Seite hat keinen Build-Schritt; es wird nur veröffentlicht, wenn du es auslöst.
- Analyse, Aufgaben, Lektionen und alle Statistiken laufen im Browser. Der Server wird nur für die Anmeldung, die
  Synchronisierung (wenige kleine Anfragen pro Sitzung) und das Laden einer chess.com-Partie per Link gebraucht.
- Der Service Worker (`sw.js`) liefert bereits geladene Dateien aus dem Gerätespeicher. **Bei jeder Veröffentlichung
  `VERSION` in `sw.js` ändern**, damit alle Geräte die neuen Dateien holen (sonst dauert es bis zu einem Tag).
- Schutz vor Missbrauch: Höchstzahl an Konten, Bremse für Registrierungen und Fehlversuche, Größengrenzen je Konto.
  Wird es trotzdem zu viel, lässt sich die Registrierung in der Verwaltung auf Einladungscode oder „geschlossen“ stellen.
- Bewusst nicht eingebaut, weil es laufend Kontingent kosten würde: KI-Erklärungen und Überwachung/Alarme.

### Engine-Geschwindigkeit

- Die Partieanalyse rechnet mit mehreren Engines gleichzeitig: 2 auf Handys, bis zu 6 auf PCs mit 8 und mehr Kernen.
  Jede Engine rechnet zusammenhängende Abschnitte von hinten nach vorn und nutzt so ihre Hash-Tabelle weiter.
- Die Live-Analyse (eigene Varianten, Analysebrett) nutzt auf PCs mehrere Kerne. Dafür sendet die Seite die Header
  `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: credentialless` (siehe `netlify.toml`).
  Browser ohne Unterstützung (z. B. Safari) und Handys bekommen automatisch die Einzelkern-Engine; startet die
  Mehrkern-Engine nicht, wird ebenfalls auf die Einzelkern-Engine umgeschaltet.

## Tests

```bash
npm test
```

Prüft alle Lektionen (jede Lösung muss ein legaler Zug sein) und die Kernfunktionen: Links erkennen, Züge dekodieren,
PGN lesen und schreiben, Zugbewertung, Eröffnungslinien, Konten, Verwaltung, Synchronisierung, Repertoire,
Teilen-Links mit Analyse, Notizen und Varianten im PGN. Dieselben Tests laufen bei jedem Push
über GitHub Actions (`.github/workflows/ci.yml`).

## Grenzen

- Nur normales Schach (kein Chess960 und keine anderen Varianten).
- Ohne Konto (lokal ohne Anmeldung oder auf statischem Hosting) liegen alle Daten nur im Browser des jeweiligen Geräts.
  Zum Umziehen gibt es im Profil den Sicherungs-Code.
- Passwort vergessen: Es gibt keine E-Mail-Adresse im Konto – der Betreiber vergibt in der Verwaltung ein Übergangs-Passwort.
- Die Lektionen sind eigene Inhalte zu den üblichen Themen eines Schachkurses – nicht die Lektionen von chess.com,
  denn deren Texte, Videos und Aufgaben sind urheberrechtlich geschützt.
- Das Brett-Design, das du auf chess.com eingestellt hast, wird von chess.com nicht mitgeliefert – deshalb startet die Seite
  mit dem grünen Brett. Die Figuren sind freie Sets, nicht die von chess.com (die sind urheberrechtlich geschützt).
- Die Erklärungen des Coachs entstehen aus Engine-Daten und Taktik-Mustern, nicht aus einer KI. Sie treffen meistens den Punkt,
  aber nicht immer.
- Die Bewertungen sind an die bekannten Kategorien angelehnt, werden aber selbst berechnet und können von chess.com abweichen.

## Aufbau

```
index.html            Seite
css/style.css         Design
js/app.js             Ablauf und Oberfläche
js/chesscom.js        Partien laden (Link, Archiv, PGN)
js/engine.js          Stockfish-Worker (Partieanalyse + Live-Engine)
js/analysis.js        Zugbewertung und Genauigkeit
js/coach.js           Erklärungen
js/tactics.js         Abtausch, hängende Figuren, Gabeln
js/board.js           Schachbrett
js/editor.js          Stellungs-Editor für das Analysebrett
js/lessons.js         Lektions-Übersicht und -Player
js/lessons-data.js    Inhalte der Grundkurse (geprüft mit tools/check-lessons.mjs)
js/lessons-more.js    Weiterführende Lektionen
js/puzzles.js         Taktikaufgaben (Auswahl nach Wertung, Wertungsberechnung, Themenfilter, Sturm, Tagesaufgabe)
js/play.js            Gegen den Computer spielen, Endspiel-Trainer
js/training.js        Fehler-Training (Karteikasten-Prinzip)
js/trainers.js        Koordinaten- und Eröffnungstrainer, Repertoire-Verwaltung (Linien in js/openings-data.js)
js/repertoire.js      Repertoire speichern und mit einer Partie vergleichen
js/profile.js         Profil, Schwächenanalyse, Stapelanalyse, Sicherung
js/insights.js        Zeitmanagement, Fehlerarten, Kurzfassung einer Partie
js/pgn.js             PGN schreiben, Mehrfach-PGN, Teilen-Link
js/lichess.js         Lichess-Partien laden
js/db.js              Speicher im Browser (IndexedDB)
sw.js                 Service Worker (offline, weniger Anfragen)
manifest.webmanifest  App-Daten für „Zum Startbildschirm hinzufügen“
tests/                Automatische Tests (node --test)
data/puzzles/         Aufgaben nach Schwierigkeit (erzeugt mit tools/select-puzzles.py + tools/build-puzzles.mjs)
server/gate.mjs       Anmeldung: Benutzerkonten und Verwaltung (lokaler Server und Netlify Edge Function)
server/sync.mjs       Synchronisierung je Konto
server/login-page.mjs Anmelde- und Registrierungsseite
server/admin-page.mjs Verwaltung (/admin)
server/legal-pages.mjs Impressum und Datenschutzerklärung
js/sync.js            Synchronisierung im Browser, Sicherungs-Code (Zusammenführen: js/sync-merge.js)
data/openings.json    Eröffnungsbuch (erzeugt mit tools/build-openings.mjs)
server.js             Lokaler Server mit /api/game
netlify/functions/    Dieselbe Funktion für Netlify
vendor/               Stockfish und chess.js
```

## Fremde Bestandteile und Lizenzen

- [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19 (Lite, ein- und mehrkernig) – GPLv3, siehe `vendor/stockfish/COPYING.txt`
- [chess.js](https://github.com/jhlywa/chess.js) – BSD-2-Clause, siehe `vendor/chess.js.LICENSE`
- Eröffnungsdaten: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) – CC0
- Taktikaufgaben: Auswahl aus der [Lichess-Aufgabensammlung](https://database.lichess.org/#puzzles) – CC0
- Figurensets aus [lichess-org/lila](https://github.com/lichess-org/lila) – siehe `assets/pieces/README.md`
- Formeln für Gewinnwahrscheinlichkeit und Genauigkeit angelehnt an die offen dokumentierten Lichess-Formeln
