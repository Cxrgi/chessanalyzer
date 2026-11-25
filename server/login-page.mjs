// Anmelde- und Registrierungsseite (komplett eigenständig, ohne weitere Dateien).
// registration: 'open' | 'invite' | 'closed' – steuert, ob und wie neue Konten angelegt werden können.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PAGE_STYLE = `
  :root { color-scheme: dark; --bg:#11151b; --panel:#1c222c; --line:#2e3745; --text:#e8ecf1; --muted:#97a3b4; --accent:#3ecf8e; --ink:#06281a; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:20px 16px 90px; color:var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height:1.5;
    background: radial-gradient(1000px 500px at 80% -10%, rgba(62,207,142,.10), transparent 60%), radial-gradient(800px 500px at -10% 110%, rgba(92,139,176,.12), transparent 60%), var(--bg); }
  .card { width:min(420px,100%); background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:26px 24px 22px; box-shadow:0 24px 60px -30px rgba(0,0,0,.8); }
  .brand { display:flex; align-items:center; gap:10px; font-size:1.15rem; margin-bottom:18px; }
  .brand b { color:var(--accent); }
  .brand img { width:34px; height:34px; display:block; }
  h1 { font-size:1.45rem; margin:0 0 6px; letter-spacing:-.02em; }
  p { margin:0 0 16px; color:var(--muted); font-size:.95rem; }
  label { display:block; font-size:.82rem; font-weight:650; margin:12px 0 5px; }
  input, select, textarea { width:100%; background:#171c24; color:var(--text); border:1px solid var(--line); border-radius:11px; padding:12px 13px; font:inherit; font-size:1rem; }
  input:focus, select:focus, textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(62,207,142,.18); }
  button.go { width:100%; margin-top:18px; border:0; border-radius:11px; padding:12px; font:inherit; font-weight:700; font-size:1rem; cursor:pointer; background:var(--accent); color:var(--ink); box-shadow:0 3px 0 #23915f; }
  button.go:disabled { opacity:.6; cursor:default; }
  button.link, a.link { background:none; border:0; color:var(--muted); text-decoration:underline; text-underline-offset:3px; font:inherit; font-size:.88rem; cursor:pointer; padding:0; margin-top:14px; display:inline-block; }
  .err { color:#ff8f80; font-size:.92rem; margin:12px 0 0; min-height:1.2em; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:1.35rem; letter-spacing:.06em; text-align:center; background:#171c24; border:1px dashed var(--accent); border-radius:11px; padding:14px; margin:6px 0 4px; user-select:all; }
  label.show { display:flex; align-items:center; gap:8px; font-weight:500; color:var(--muted); margin-top:10px; cursor:pointer; }
  label.show input { width:auto; accent-color:var(--accent); }
  .note { font-size:.82rem; margin:8px 0 0; }
  .tabs { display:grid; grid-template-columns:1fr 1fr; gap:4px; background:#171c24; border:1px solid var(--line); border-radius:12px; padding:4px; margin-bottom:18px; }
  .tabs button { border:0; background:none; color:var(--muted); font:inherit; font-weight:650; padding:9px; border-radius:9px; cursor:pointer; }
  .tabs button.on { background:var(--accent); color:var(--ink); }
  .notice { background:rgba(62,207,142,.1); border:1px solid rgba(62,207,142,.35); border-radius:11px; padding:10px 12px; color:var(--text); font-size:.9rem; }
  [hidden] { display:none !important; }`;

export const BRAND = `<div class="brand">
    <img src="/assets/logo.svg" alt="" width="34" height="34">
    <span>Chess<b>Analyzer</b></span>
  </div>`;

export function loginPage({ nonce = '', registration = 'open', notice = '' } = {}) {
  const canRegister = registration !== 'closed';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Anmelden · Chess Analyzer</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo-32.png" sizes="32x32" type="image/png">
<style>${PAGE_STYLE}</style>
</head>
<body>
<main class="card">
  ${BRAND}
  ${notice ? `<p class="notice">${esc(notice)}</p>` : ''}
  <div class="tabs" ${canRegister ? '' : 'hidden'}>
    <button type="button" id="tab-login" class="on">Anmelden</button>
    <button type="button" id="tab-register">Konto erstellen</button>
  </div>

  <form id="f-login">
    <h1>Willkommen zurück</h1>
    <p>Melde dich mit deinem Konto an.</p>
    <label for="l-name">Benutzername</label>
    <input id="l-name" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
    <label for="l-pw">Passwort</label>
    <input id="l-pw" type="password" autocomplete="current-password" required>
    <label class="show"><input type="checkbox" id="show-pw"> Passwort anzeigen</label>
    <button class="go" type="submit">Anmelden</button>
    <p class="err" id="e-login" role="alert"></p>
    <p class="note">Passwort vergessen? Der Betreiber der Seite kann dir ein neues geben.${canRegister ? '' : ' Neue Konten können gerade nicht angelegt werden.'}</p>
  </form>

  <form id="f-register" hidden>
    <h1>Konto erstellen</h1>
    <p>Dein Fortschritt, deine Partien und deine Statistik gehören zu deinem Konto – auf jedem Gerät.</p>
    <div ${registration === 'invite' ? '' : 'hidden'}>
      <label for="r-invite">Einladungscode</label>
      <input id="r-invite" type="text" autocomplete="off" spellcheck="false">
    </div>
    <label for="r-name">Benutzername (3–20 Zeichen: Buchstaben, Zahlen, _ und -)</label>
    <input id="r-name" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}" required>
    <label for="r-pw">Passwort (mindestens 8 Zeichen)</label>
    <input id="r-pw" type="password" autocomplete="new-password" minlength="8" required>
    <label for="r-pw2">Passwort wiederholen</label>
    <input id="r-pw2" type="password" autocomplete="new-password" minlength="8" required>
    <label for="r-site">Wo spielst du hauptsächlich?</label>
    <select id="r-site" required>
      <option value="chesscom">chess.com</option>
      <option value="lichess">Lichess</option>
      <option value="none">Auf keiner der beiden Seiten</option>
    </select>
    <div id="box-chesscom">
      <label for="r-chesscom">Dein Benutzername auf chess.com</label>
      <input id="r-chesscom" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40">
    </div>
    <div id="box-lichess" hidden>
      <label for="r-lichess">Dein Benutzername auf Lichess</label>
      <input id="r-lichess" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40">
    </div>
    <p class="note">Damit findet die Seite deine eigenen Partien. Du kannst das später in den Einstellungen ändern. Was gespeichert wird, steht in der <a class="link" href="/datenschutz" style="margin:0">Datenschutzerklärung</a>.</p>
    <button class="go" type="submit">Konto erstellen</button>
    <p class="err" id="e-register" role="alert"></p>
  </form>
  <p class="note" style="text-align:center;margin-top:18px"><a class="link" href="/impressum" style="margin:0">Impressum</a> · <a class="link" href="/datenschutz" style="margin:0">Datenschutz</a></p>
</main>
<script nonce="${nonce}">
  const $ = (id) => document.getElementById(id);
  const TEXT = {
    wrong: 'Benutzername oder Passwort stimmen nicht.', locked: 'Zu viele Versuche. Bitte warte ein paar Minuten.',
    weak: 'Das Passwort braucht mindestens 8 Zeichen.', name: 'Der Benutzername braucht 3–20 Zeichen (Buchstaben, Zahlen, _ und -).',
    taken: 'Diesen Benutzernamen gibt es schon.', invite: 'Der Einladungscode stimmt nicht.', closed: 'Neue Konten können gerade nicht angelegt werden.',
    full: 'Es können gerade keine weiteren Konten angelegt werden.', disabled: 'Dieses Konto wurde gesperrt.',
    handle: 'Bitte gib deinen Benutzernamen auf der gewählten Schachseite an (nur Buchstaben, Zahlen, _ und -).', site: 'Bitte wähle aus, wo du spielst.',
  };
  function tab(register) {
    $('f-login').hidden = register; $('f-register').hidden = !register;
    $('tab-login').classList.toggle('on', !register); $('tab-register').classList.toggle('on', register);
    (register ? $('r-name') : $('l-name')).focus();
  }
  $('tab-login').onclick = () => tab(false);
  $('tab-register').onclick = () => tab(true);
  async function post(action, body, form, errId) {
    const btn = form.querySelector('button.go');
    btn.disabled = true;
    $(errId).textContent = '';
    try {
      const res = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      $(errId).textContent = TEXT[data.error] || 'Das hat nicht geklappt. Bitte versuch es noch einmal.';
    } catch (e) {
      $(errId).textContent = 'Keine Verbindung. Bitte versuch es noch einmal.';
    } finally {
      btn.disabled = false;
    }
    return null;
  }
  $('f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await post('login', { name: $('l-name').value, password: $('l-pw').value }, e.target, 'e-login')) location.reload();
    else $('l-pw').select();
  });
  $('show-pw').onchange = (e) => { $('l-pw').type = e.target.checked ? 'text' : 'password'; };
  $('r-site').onchange = () => {
    $('box-chesscom').hidden = $('r-site').value !== 'chesscom';
    $('box-lichess').hidden = $('r-site').value !== 'lichess';
  };
  $('f-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('r-pw').value !== $('r-pw2').value) { $('e-register').textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
    const site = $('r-site').value;
    const data = await post('register', {
      name: $('r-name').value.trim(), password: $('r-pw').value, site, invite: $('r-invite').value.trim(),
      chesscom: site === 'chesscom' ? $('r-chesscom').value.trim() : '', lichess: site === 'lichess' ? $('r-lichess').value.trim() : '',
    }, e.target, 'e-register');
    if (data) location.reload();
  });
</script>
</body>
</html>`;
}
