// Impressum und Datenschutzerklärung – ohne Anmeldung erreichbar.
// Die Angaben zum Betreiber kommen aus der Verwaltung (nicht aus dem Code), damit keine Adresse im Repository steht.
import { PAGE_STYLE, BRAND } from './login-page.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = (s) => esc(s).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('<br>');

const STYLE = `${PAGE_STYLE}
  body { place-items:start center; padding-top:28px; }
  .card { width:min(760px,100%); }
  h2 { font-size:1.08rem; margin:26px 0 8px; }
  .card p, .card li { color:var(--text); font-size:.97rem; }
  .card ul { margin:0 0 16px; padding-left:20px; }
  .card li { margin-bottom:5px; }
  .card a { color:var(--accent); }
  .muted { color:var(--muted) !important; font-size:.88rem !important; }
  .who { background:#171c24; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
  .nav { display:flex; flex-wrap:wrap; gap:14px; margin-top:26px; padding-top:16px; border-top:1px solid var(--line); font-size:.92rem; }`;

const shell = (title, body) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Chess Analyzer</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo-32.png" sizes="32x32" type="image/png">
<style>${STYLE}</style>
</head>
<body>
<main class="card">
  ${BRAND}
  ${body}
  <nav class="nav"><a href="/">Zur Seite</a><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></nav>
</main>
</body>
</html>`;

/** Name, Anschrift und Kontakt des Betreibers – oder ein Hinweis, falls noch nichts hinterlegt ist. */
function operator(legal) {
  const l = legal || {};
  if (!l.name && !l.address && !l.email) return '<p class="who muted">Der Betreiber hat hier noch keine Angaben hinterlegt.</p>';
  return `<p class="who">${[esc(l.name), lines(l.address), l.email ? `E-Mail: <a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '', lines(l.extra)].filter(Boolean).join('<br>')}</p>`;
}

export function impressumPage(legal) {
  return shell('Impressum', `
  <h1>Impressum</h1>
  <h2>Angaben gemäß § 5 DDG</h2>
  ${operator(legal)}
  <h2>Verantwortlich für den Inhalt</h2>
  <p>Die oben genannte Person.</p>
  <h2>Hinweise</h2>
  <p>Diese Seite ist ein privates, kostenloses Projekt ohne Werbung. Sie ist nicht mit Chess.com oder Lichess verbunden; deren Namen und Marken gehören den jeweiligen Inhabern.</p>
  <p>Die Analysen und Erklärungen werden automatisch von einem Schachprogramm erzeugt. Sie können Fehler enthalten.</p>
  <p class="muted">Verwendete freie Bestandteile: Stockfish (GPLv3), chess.js (BSD), Eröffnungs- und Aufgabendaten von Lichess (CC0), Figurensätze aus dem Lichess-Projekt.</p>`);
}

export function privacyPage(legal) {
  return shell('Datenschutz', `
  <h1>Datenschutzerklärung</h1>
  <p class="muted">Stand: November 2026</p>

  <h2>1. Wer ist verantwortlich?</h2>
  ${operator(legal)}

  <h2>2. Kurz gesagt</h2>
  <ul>
    <li>Es gibt keine Werbung, kein Tracking und keine Analyse-Werkzeuge.</li>
    <li>Gespeichert wird nur, was die Seite zum Funktionieren braucht: dein Konto und dein Spielstand.</li>
    <li>Du kannst dein Konto mit allen Daten jederzeit selbst löschen (Einstellungen → Konto löschen).</li>
  </ul>

  <h2>3. Welche Daten werden gespeichert?</h2>
  <p><b>Konto:</b> dein Benutzername, dein Passwort (nur als nicht umkehrbarer Hash, nie im Klartext), ob du auf chess.com oder Lichess spielst und unter welchem Namen, das Datum der Erstellung und der Tag deiner letzten Nutzung. Eine E-Mail-Adresse wird nicht erhoben.</p>
  <p><b>Dein Stand:</b> die Partien, die du analysierst (Züge, Namen der Spieler, Bewertungen), deine Statistik, dein Fortschritt bei Lektionen und Aufgaben, deine Trainingskarten und deine Einstellungen. Diese Daten werden deinem Konto zugeordnet, damit sie auf allen deinen Geräten gleich sind.</p>
  <p><b>Zweck und Rechtsgrundlage:</b> Bereitstellung der Seite und deines Kontos (Art. 6 Abs. 1 lit. b DSGVO).</p>

  <h2>4. Hosting</h2>
  <p>Die Seite läuft bei Netlify, Inc. (USA). Beim Aufruf verarbeitet Netlify technisch notwendige Daten wie deine IP-Adresse, den Zeitpunkt und die aufgerufene Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Konto und Stand werden auf Servern von Netlify gespeichert; dabei können Daten in die USA übertragen werden. Näheres steht in der <a href="https://www.netlify.com/privacy/" rel="noopener">Datenschutzerklärung von Netlify</a>.</p>

  <h2>5. Cookies und Speicher im Browser</h2>
  <ul>
    <li><b>Anmelde-Cookie:</b> Nach der Anmeldung wird ein Cookie gesetzt, das dich 30 Tage lang angemeldet hält. Es ist technisch notwendig; ohne es funktioniert die Anmeldung nicht.</li>
    <li><b>Speicher im Browser:</b> Dein Stand und die Dateien der Seite werden zusätzlich in deinem Browser abgelegt, damit die Seite schnell und auch ohne Netz funktioniert. Beim Abmelden wird das von diesem Gerät entfernt.</li>
  </ul>
  <p>Weitere Cookies – etwa für Werbung oder Statistik – gibt es nicht. Eine Einwilligung ist deshalb nicht nötig (§ 25 Abs. 2 TDDDG).</p>

  <h2>6. Abrufe bei chess.com und Lichess</h2>
  <p>Wenn du Partien oder Wertungen von chess.com oder Lichess laden lässt, ruft dein Browser diese Daten direkt bei dem jeweiligen Anbieter ab. Dabei erfährt der Anbieter deine IP-Adresse und den angefragten Benutzernamen. Für diese Verarbeitung gelten die Datenschutzerklärungen von <a href="https://www.chess.com/legal/privacy" rel="noopener">Chess.com</a> und <a href="https://lichess.org/privacy" rel="noopener">Lichess</a>.</p>

  <h2>7. Wie lange werden die Daten gespeichert?</h2>
  <p>Solange dein Konto besteht. Löschst du dein Konto, werden Konto und Stand sofort vom Server entfernt. Der Betreiber kann Konten ebenfalls löschen, zum Beispiel bei Missbrauch.</p>

  <h2>8. Wer hat Zugriff?</h2>
  <p>Andere Benutzer sehen deine Daten nicht. Der Betreiber sieht in der Verwaltung deinen Benutzernamen, deinen Namen auf chess.com oder Lichess, das Erstellungsdatum, den Tag der letzten Nutzung und die Zahl deiner gespeicherten Partien. Dein Passwort kann niemand einsehen.</p>

  <h2>9. Deine Rechte</h2>
  <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Deinen kompletten Stand kannst du im Profil als Sicherungs-Code mitnehmen. Wende dich für alles Weitere an die oben genannte Person. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.</p>`);
}
