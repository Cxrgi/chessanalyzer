// Verwaltung (/admin): Konten ansehen, sperren, löschen, Passwörter zurücksetzen, Registrierung steuern.
// Geschützt durch das Betreiber-Passwort. Komplett eigenständige Seite ohne weitere Dateien.
import { PAGE_STYLE, BRAND } from './login-page.mjs';

export function adminPage({ nonce = '' } = {}) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Verwaltung · Chess Analyzer</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo-32.png" sizes="32x32" type="image/png">
<style>${PAGE_STYLE}
  body.wide { place-items:start center; padding-top:28px; }
  .board { width:min(1040px,100%); display:grid; gap:16px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:18px 20px; }
  .panel h2 { margin:0 0 12px; font-size:1.1rem; }
  .top { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; }
  .top .brand { margin:0; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .btn { border:1px solid var(--line); background:#232a36; color:var(--text); border-radius:9px; padding:7px 12px; font:inherit; font-size:.88rem; font-weight:600; cursor:pointer; text-decoration:none; }
  .btn:hover { border-color:var(--accent); }
  .btn.danger { color:#ff8f80; }
  .btn.primary { background:var(--accent); color:var(--ink); border-color:transparent; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
  .stat { background:#171c24; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
  .stat b { display:block; font-size:1.5rem; }
  .stat span { color:var(--muted); font-size:.82rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .grid label { margin-top:0; }
  .scroll { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:.92rem; }
  th { text-align:left; color:var(--muted); font-size:.74rem; text-transform:uppercase; letter-spacing:.06em; padding:6px 8px; }
  td { padding:9px 8px; border-top:1px solid var(--line); vertical-align:middle; }
  td.acts { white-space:nowrap; }
  td.acts .btn { padding:4px 9px; font-size:.8rem; margin:2px 2px 2px 0; }
  .tag { font-size:.74rem; font-weight:700; border-radius:99px; padding:2px 9px; border:1px solid var(--line); color:var(--muted); }
  .tag.off { color:#ff8f80; border-color:#ff8f80; }
  .msg { color:var(--accent); font-size:.9rem; min-height:1.3em; margin:10px 0 0; }
  .msg.bad { color:#ff8f80; }
  .muted { color:var(--muted); font-size:.88rem; }
  input.small, select.small, textarea.small { padding:9px 11px; font-size:.95rem; }
</style>
</head>
<body>
<main class="card" id="gate">
  ${BRAND}
  <p id="loading">Lädt …</p>

  <form id="f-login" hidden>
    <h1>Verwaltung</h1>
    <p>Dieser Bereich ist nur für den Betreiber der Seite. Gib das Betreiber-Passwort ein.</p>
    <label for="pw">Betreiber-Passwort</label>
    <input id="pw" type="password" autocomplete="current-password" required>
    <button class="go" type="submit">Anmelden</button>
    <p class="err" id="e-login" role="alert"></p>
    <button class="link" type="button" id="to-reset">Passwort vergessen?</button>
    <p class="note"><a class="link" href="/">Zurück zur Seite</a></p>
  </form>

  <form id="f-setup" hidden>
    <h1>Betreiber-Passwort festlegen</h1>
    <p>Es gibt noch kein Betreiber-Passwort. Leg es jetzt fest – damit schützt du die Verwaltung.</p>
    <div id="tok-box" hidden>
      <label for="tok">Einrichtungs-Code</label>
      <input id="tok" type="text" autocomplete="off" spellcheck="false">
    </div>
    <label for="n1">Neues Passwort (mindestens 8 Zeichen)</label>
    <input id="n1" type="password" autocomplete="new-password" minlength="8" required>
    <label for="n2">Passwort wiederholen</label>
    <input id="n2" type="password" autocomplete="new-password" minlength="8" required>
    <button class="go" type="submit">Passwort speichern</button>
    <p class="err" id="e-setup" role="alert"></p>
  </form>

  <section id="s-code" hidden>
    <h1>Notfall-Code notieren</h1>
    <p>Falls du das Betreiber-Passwort einmal vergisst, kannst du es nur mit diesem Code zurücksetzen. Er wird nur jetzt angezeigt.</p>
    <div class="code" id="code"></div>
    <button class="go" type="button" id="code-done">Notiert – weiter</button>
  </section>

  <form id="f-reset" hidden>
    <h1>Passwort zurücksetzen</h1>
    <p>Gib den Notfall-Code ein, den du beim Einrichten bekommen hast. Danach legst du ein neues Betreiber-Passwort fest.</p>
    <label for="rc">Notfall-Code</label>
    <input id="rc" type="text" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX" required>
    <button class="go" type="submit">Zurücksetzen</button>
    <p class="err" id="e-reset" role="alert"></p>
    <button class="link" type="button" id="to-login">Zurück zur Anmeldung</button>
  </form>
</main>

<div class="board" id="dash" hidden>
  <div class="panel top">
    ${BRAND}
    <div class="row">
      <a class="btn" href="/">Zur Seite</a>
      <button class="btn" type="button" id="reload">Aktualisieren</button>
      <button class="btn" type="button" id="logout">Abmelden</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><b id="st-users">0</b><span>Konten</span></div>
    <div class="stat"><b id="st-week">0</b><span>aktiv in den letzten 7 Tagen</span></div>
    <div class="stat"><b id="st-off">0</b><span>gesperrt</span></div>
    <div class="stat"><b id="st-reg">–</b><span>Registrierung</span></div>
  </div>

  <div class="panel">
    <h2>Konten</h2>
    <div class="row" style="margin-bottom:10px"><input class="small" id="filter" type="search" placeholder="Suchen …" style="max-width:280px" aria-label="Konten durchsuchen">
      <button class="btn" type="button" id="sizes" title="Liest die gespeicherten Daten aller Konten – nur bei Bedarf">Speicher aller Konten berechnen</button></div>
    <div class="scroll"><table>
      <thead><tr><th>Benutzer</th><th>Schachkonto</th><th>Erstellt</th><th>Zuletzt aktiv</th><th>Speicher</th><th>Status</th><th>Aktionen</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
    <p class="muted" id="empty" hidden>Noch keine Konten.</p>
    <p class="msg" id="m-users" role="status"></p>
  </div>

  <div class="panel">
    <h2>Registrierung und Hinweis</h2>
    <div class="grid">
      <div><label for="s-reg">Neue Konten</label>
        <select class="small" id="s-reg"><option value="open">Jeder darf sich registrieren</option><option value="invite">Nur mit Einladungscode</option><option value="closed">Geschlossen</option></select></div>
      <div><label for="s-invite">Einladungscode</label><input class="small" id="s-invite" type="text" autocomplete="off" spellcheck="false" maxlength="60"></div>
      <div><label for="s-max">Höchstzahl an Konten</label><input class="small" id="s-max" type="number" min="1" max="5000"></div>
    </div>
    <label for="s-notice">Hinweis für alle (erscheint auf der Anmelde- und der Startseite; leer = keiner)</label>
    <textarea class="small" id="s-notice" rows="2" maxlength="300"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" id="s-save">Speichern</button></div>
    <p class="msg" id="m-settings" role="status"></p>
  </div>

  <div class="panel">
    <h2>Impressum und Datenschutz</h2>
    <p class="muted">Diese Angaben erscheinen öffentlich auf den Seiten <a class="link" href="/impressum" target="_blank" rel="noopener" style="margin:0">Impressum</a> und <a class="link" href="/datenschutz" target="_blank" rel="noopener" style="margin:0">Datenschutz</a> – auch für nicht angemeldete Besucher. Ein Impressum braucht einen echten Namen und eine Anschrift, unter der Post dich erreicht.</p>
    <div class="grid">
      <div><label for="g-name">Vor- und Nachname</label><input class="small" id="g-name" type="text" maxlength="120" autocomplete="name"></div>
      <div><label for="g-email">E-Mail für Anfragen</label><input class="small" id="g-email" type="email" maxlength="120" autocomplete="email"></div>
    </div>
    <label for="g-address">Anschrift (Straße und Hausnummer, PLZ und Ort – jede Zeile einzeln)</label>
    <textarea class="small" id="g-address" rows="3" maxlength="400" autocomplete="street-address"></textarea>
    <label for="g-extra">Zusatz (freiwillig, z. B. Telefon)</label>
    <textarea class="small" id="g-extra" rows="2" maxlength="400"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" id="g-save">Speichern</button></div>
    <p class="msg" id="m-legal" role="status"></p>
  </div>

  <div class="panel">
    <h2>Sicherheit</h2>
    <div class="grid">
      <div><label for="p-cur">Aktuelles Betreiber-Passwort</label><input class="small" id="p-cur" type="password" autocomplete="current-password"></div>
      <div><label for="p-new">Neues Betreiber-Passwort (mind. 8 Zeichen)</label><input class="small" id="p-new" type="password" autocomplete="new-password"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn" type="button" id="p-save">Betreiber-Passwort ändern</button>
      <button class="btn danger" type="button" id="all-out">Alle Benutzer abmelden</button>
    </div>
    <p class="msg" id="m-sec" role="status"></p>
  </div>
</div>

<script nonce="${nonce}">
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TEXT = { wrong: 'Das stimmt leider nicht.', locked: 'Zu viele Versuche. Bitte warte ein paar Minuten.', weak: 'Das Passwort braucht mindestens 8 Zeichen.',
    token: 'Der Einrichtungs-Code stimmt nicht.', configured: 'Es wurde bereits ein Passwort festgelegt. Bitte lade die Seite neu.', invite: 'Bitte gib einen Einladungscode an.' };
  const REG = { open: 'offen', invite: 'mit Code', closed: 'geschlossen' };
  let users = [];
  const sizes = {}; // Name → { bytes, games } (nur, wenn berechnet)
  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const sizeText = (s) => (s ? kb(s.bytes) + ' · ' + s.games + (s.games === 1 ? ' Partie' : ' Partien') : '–');
  async function details(name) {
    const r = await api('user', { name, action: 'details' });
    if (!r.ok) return null;
    sizes[name] = r.data;
    return r.data;
  }

  async function api(action, body) {
    const res = await fetch('/api/admin/' + action, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }
  function show(id) {
    for (const s of ['loading', 'f-login', 'f-setup', 's-code', 'f-reset']) $(s).hidden = s !== id;
    const el = $(id).querySelector('input');
    if (el) el.focus();
  }
  async function form(action, body, f, errId) {
    const btn = f.querySelector('button.go');
    btn.disabled = true;
    $(errId).textContent = '';
    const r = await api(action, body).catch(() => null);
    btn.disabled = false;
    if (r && r.ok) return r.data;
    $(errId).textContent = r ? (TEXT[r.data.error] || 'Das hat nicht geklappt.') : 'Keine Verbindung.';
    return null;
  }
  const say = (id, text, bad) => { $(id).textContent = text; $(id).className = 'msg' + (bad ? ' bad' : ''); };
  const date = (d) => (d ? d.split('-').reverse().join('.') : '–');

  async function start() {
    const r = await api('status').catch(() => null);
    if (!r || !r.ok) { $('loading').textContent = 'Die Verwaltung ist hier nicht verfügbar.'; return; }
    if (r.data.authenticated) return dashboard();
    $('tok-box').hidden = !r.data.needsToken;
    show(r.data.configured ? 'f-login' : 'f-setup');
  }

  async function dashboard() {
    const r = await api('users');
    if (!r.ok) { $('gate').hidden = false; $('dash').hidden = true; document.body.classList.remove('wide'); return show('f-login'); }
    $('gate').hidden = true; $('dash').hidden = false; document.body.classList.add('wide');
    users = r.data.users;
    const s = r.data.settings;
    $('s-reg').value = s.registration; $('s-invite').value = s.invite || ''; $('s-max').value = s.maxUsers; $('s-notice').value = s.notice || '';
    const g = s.legal || {};
    $('g-name').value = g.name || ''; $('g-email').value = g.email || ''; $('g-address').value = g.address || ''; $('g-extra').value = g.extra || '';
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    $('st-users').textContent = users.length + ' / ' + s.maxUsers;
    $('st-week').textContent = users.filter((u) => u.seen >= weekAgo).length;
    $('st-off').textContent = users.filter((u) => u.disabled).length;
    $('st-reg').textContent = REG[s.registration] || s.registration;
    draw();
  }

  function draw() {
    const q = $('filter').value.trim().toLowerCase();
    const list = users.filter((u) => !q || (u.name + ' ' + u.chesscom + ' ' + u.lichess).toLowerCase().includes(q));
    $('empty').hidden = users.length > 0;
    $('rows').innerHTML = list.map((u) => {
      const play = u.site === 'chesscom' ? 'chess.com: ' + esc(u.chesscom) : u.site === 'lichess' ? 'Lichess: ' + esc(u.lichess) : '–';
      const n = esc(u.name);
      return '<tr><td><b>' + n + '</b></td><td>' + play + '</td><td>' + date(u.created) + '</td><td>' + date(u.seen) + '</td><td class="muted">' + sizeText(sizes[u.name]) + '</td>'
        + '<td><span class="tag ' + (u.disabled ? 'off' : '') + '">' + (u.disabled ? 'gesperrt' : 'aktiv') + '</span></td>'
        + '<td class="acts"><button class="btn" data-a="details" data-n="' + n + '">Details</button>'
        + '<button class="btn" data-a="export" data-n="' + n + '">Exportieren</button>'
        + '<button class="btn" data-a="password" data-n="' + n + '">Neues Passwort</button>'
        + '<button class="btn" data-a="' + (u.disabled ? 'enable' : 'disable') + '" data-n="' + n + '">' + (u.disabled ? 'Entsperren' : 'Sperren') + '</button>'
        + '<button class="btn" data-a="logout" data-n="' + n + '">Abmelden</button>'
        + '<button class="btn danger" data-a="delete" data-n="' + n + '">Löschen</button></td></tr>';
    }).join('');
  }

  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const name = b.dataset.n, action = b.dataset.a;
    if (action === 'delete' && !confirm('Konto „' + name + '“ mit allen gespeicherten Daten endgültig löschen?')) return;
    if (action === 'password' && !confirm('Für „' + name + '“ ein neues Übergangs-Passwort erzeugen? Das alte gilt dann nicht mehr.')) return;
    if (action === 'export') {
      say('m-users', 'Export wird erstellt …');
      const res = await fetch('/api/admin/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, action: 'export' }) }).catch(() => null);
      if (!res || !res.ok) return say('m-users', 'Der Export hat nicht geklappt.', true);
      const blob = await res.blob();
      const file = ((res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || 'export.json';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return say('m-users', 'Export von ' + name + ' heruntergeladen (' + kb(blob.size) + ').');
    }
    if (action === 'details') {
      const s = await details(name);
      if (!s) return say('m-users', 'Das hat nicht geklappt.', true);
      draw();
      return say('m-users', name + ': ' + (s.games === 1 ? '1 analysierte Partie' : s.games + ' analysierte Partien') + ', zusammen ' + kb(s.bytes)
        + (s.hasState ? ' (davon Fortschritt und Einstellungen ' + kb(s.stateBytes) + ').' : ' – noch kein Fortschritt gespeichert.'));
    }
    const r = await api('user', { name, action });
    if (!r.ok) return say('m-users', 'Das hat nicht geklappt.', true);
    if (action === 'password') say('m-users', 'Neues Passwort für ' + name + ': ' + r.data.password + ' – gib es der Person weiter, sie kann es danach selbst ändern.');
    else say('m-users', { delete: 'Konto gelöscht.', disable: 'Konto gesperrt.', enable: 'Konto entsperrt.', logout: 'Auf allen Geräten abgemeldet.' }[action]);
    const keep = $('m-users').textContent;
    await dashboard();
    say('m-users', keep);
  });
  $('filter').oninput = draw;
  $('sizes').onclick = async () => {
    say('m-users', 'Berechne …');
    let total = 0;
    for (const u of users) {
      const s = await details(u.name);
      if (s) total += s.bytes;
      draw();
    }
    say('m-users', 'Alle Konten zusammen: ' + kb(total) + '.');
  };
  $('reload').onclick = dashboard;
  $('logout').onclick = async () => { await api('logout', {}); location.reload(); };
  $('s-save').onclick = async () => {
    const r = await api('settings', { registration: $('s-reg').value, invite: $('s-invite').value, maxUsers: +$('s-max').value, notice: $('s-notice').value });
    say('m-settings', r.ok ? 'Gespeichert.' : (TEXT[r.data.error] || 'Das hat nicht geklappt.'), !r.ok);
    if (r.ok) dashboard();
  };
  $('g-save').onclick = async () => {
    const r = await api('settings', { legal: { name: $('g-name').value, email: $('g-email').value, address: $('g-address').value, extra: $('g-extra').value } });
    say('m-legal', r.ok ? 'Gespeichert – die Seiten Impressum und Datenschutz zeigen die Angaben ab sofort.' : 'Das hat nicht geklappt.', !r.ok);
  };
  $('p-save').onclick = async () => {
    const r = await api('password', { current: $('p-cur').value, next: $('p-new').value });
    say('m-sec', r.ok ? 'Betreiber-Passwort geändert.' : (TEXT[r.data.error] || 'Das hat nicht geklappt.'), !r.ok);
    if (r.ok) $('p-cur').value = $('p-new').value = '';
  };
  $('all-out').onclick = async () => {
    if (!confirm('Wirklich alle Benutzer auf allen Geräten abmelden? Ihre Daten bleiben erhalten.')) return;
    const r = await api('logout-all', {});
    say('m-sec', r.ok ? 'Alle Benutzer wurden abgemeldet.' : 'Das hat nicht geklappt.', !r.ok);
  };

  $('f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await form('login', { password: $('pw').value }, e.target, 'e-login')) { $('pw').value = ''; dashboard(); } else $('pw').select();
  });
  $('f-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('n1').value !== $('n2').value) { $('e-setup').textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
    const data = await form('setup', { password: $('n1').value, token: $('tok').value.trim() }, e.target, 'e-setup');
    if (data) { $('code').textContent = data.recovery; show('s-code'); }
  });
  $('code-done').onclick = dashboard;
  $('to-reset').onclick = () => show('f-reset');
  $('to-login').onclick = () => show('f-login');
  $('f-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await form('reset', { recovery: $('rc').value }, e.target, 'e-reset')) show('f-setup');
  });
  start();
</script>
</body>
</html>`;
}
