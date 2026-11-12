# Chess Analyzer

Kostenlose Partieanalyse für chess.com-Partien – für alle, die dafür kein Abo bezahlen wollen.
Link einfügen, und ein Coach geht die Partie Zug für Zug mit dir durch.

**Live:** <https://chessanalyzer-cxrgi.netlify.app>

Nicht mit Chess.com verbunden. Die komplette Analyse läuft im Browser auf deinem Gerät (Stockfish als WebAssembly).

## Was die Seite kann

- **Passwortschutz**: Beim ersten Besuch legst du ein Passwort fest; danach kommt niemand ohne Anmeldung auf die Seite
- **Startseite** mit allen Bereichen auf einen Blick
- **Lektionen**: 53 kurze, interaktive Lektionen in neun Kursen – Grundlagen, Taktik, Mattbilder, Eröffnung, Endspiel,
  Sicher spielen, Taktik für Fortgeschrittene, Strategie und Königsangriff – mit Aufgaben direkt auf dem Brett,
  Tipps, Lösungen und gespeichertem Fortschritt
- **Partie laden** über einen chess.com-Link, über deinen Benutzernamen (Liste der letzten Partien) oder per PGN
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

## Passwort

- Beim allerersten Aufruf fragt die Seite nach einem neuen Passwort und zeigt einmalig einen **Notfall-Code**.
  Mit ihm lässt sich der Schutz zurücksetzen, falls das Passwort vergessen wurde („Passwort vergessen?“ auf der Anmeldeseite).
- Ändern lässt sich das Passwort in den Einstellungen (Zahnrad), abmelden über das Symbol daneben.
- Gespeichert wird nur ein gesalzener Hash – auf Netlify im Blob-Speicher `auth`, lokal in `.data/auth.json`.
  Wer beides verloren hat (Passwort und Notfall-Code), löscht diesen Eintrag und richtet die Seite neu ein.
- Geschützt sind Seite, Skripte, Daten und `/api/*`. Bilder, Stylesheet und die Engine-Dateien bleiben abrufbar.
- Auf rein statischem Hosting (z. B. GitHub Pages) gibt es keinen Passwortschutz, weil dort kein Server-Code läuft.
- Lokal ohne Passwort starten: `NO_PASSWORD=1 npm start`

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
(`api.chess.com/pub`) funktioniert dagegen direkt aus dem Browser und dient als Ausweichweg. Auf rein statischem
Hosting versucht die Seite zusätzlich öffentliche CORS-Proxys (allorigins, codetabs), bevor sie nach dem Benutzernamen fragt.

## Grenzen

- Nur normales Schach (kein Chess960 und keine anderen Varianten).
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
server/gate.mjs       Passwortschutz (lokaler Server und Netlify Edge Function)
data/openings.json    Eröffnungsbuch (erzeugt mit tools/build-openings.mjs)
server.js             Lokaler Server mit /api/game
netlify/functions/    Dieselbe Funktion für Netlify
vendor/               Stockfish und chess.js
```

## Fremde Bestandteile und Lizenzen

- [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19 (Lite, single-threaded) – GPLv3, siehe `vendor/stockfish/COPYING.txt`
- [chess.js](https://github.com/jhlywa/chess.js) – BSD-2-Clause, siehe `vendor/chess.js.LICENSE`
- Eröffnungsdaten: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) – CC0
- Figurensets aus [lichess-org/lila](https://github.com/lichess-org/lila) – siehe `assets/pieces/README.md`
- Formeln für Gewinnwahrscheinlichkeit und Genauigkeit angelehnt an die offen dokumentierten Lichess-Formeln
