// Anmeldeseite (komplett eigenständig, ohne weitere Dateien), ausgeliefert vom Passwortschutz.
// mode: 'login' = Passwort eingeben, 'setup' = beim ersten Besuch Passwort festlegen.
export function loginPage(mode) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Anmelden · Chess Analyzer</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: dark; --bg:#11151b; --panel:#1c222c; --line:#2e3745; --text:#e8ecf1; --muted:#97a3b4; --accent:#3ecf8e; --ink:#06281a; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:20px 16px 90px; color:var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height:1.5;
    background: radial-gradient(1000px 500px at 80% -10%, rgba(62,207,142,.10), transparent 60%), radial-gradient(800px 500px at -10% 110%, rgba(92,139,176,.12), transparent 60%), var(--bg); }
  .card { width:min(400px,100%); background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:26px 24px 22px; box-shadow:0 24px 60px -30px rgba(0,0,0,.8); }
  .brand { display:flex; align-items:center; gap:10px; font-size:1.15rem; margin-bottom:18px; }
  .brand b { color:var(--accent); }
  .brand svg { width:34px; height:34px; }
  h1 { font-size:1.45rem; margin:0 0 6px; letter-spacing:-.02em; }
  p { margin:0 0 16px; color:var(--muted); font-size:.95rem; }
  label { display:block; font-size:.82rem; font-weight:650; margin:12px 0 5px; }
  input { width:100%; background:#171c24; color:var(--text); border:1px solid var(--line); border-radius:11px; padding:12px 13px; font:inherit; font-size:1rem; }
  input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(62,207,142,.18); }
  button.go { width:100%; margin-top:18px; border:0; border-radius:11px; padding:12px; font:inherit; font-weight:700; font-size:1rem; cursor:pointer; background:var(--accent); color:var(--ink); box-shadow:0 3px 0 #23915f; }
  button.go:disabled { opacity:.6; cursor:default; }
  button.link { background:none; border:0; color:var(--muted); text-decoration:underline; text-underline-offset:3px; font:inherit; font-size:.88rem; cursor:pointer; padding:0; margin-top:14px; }
  .err { color:#ff8f80; font-size:.92rem; margin:12px 0 0; min-height:1.2em; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:1.35rem; letter-spacing:.06em; text-align:center; background:#171c24; border:1px dashed var(--accent); border-radius:11px; padding:14px; margin:6px 0 4px; user-select:all; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main class="card">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#3ecf8e"/><path d="M11 25.5h11.5c0-5.5-1-7.400-2.300-9.600 1.800.3 3-.3 3.600-1.300.9-1.600-.7-3.300-2.700-5.300-1.700-1.700-4.200-3-7.100-3.200l-.9-1.900-1.900 2.600c-2.500 1.700-4 4.700-3.700 8.300l2.600 1.300 2.300-2.300c.4 1.900-.3 3.300-1.400 4.800-1.300 1.700-2 3.700-2 6.600z" fill="#11151b"/></svg>
    <span>Chess<b>Analyzer</b></span>
  </div>

  <form id="f-login" ${mode === 'login' ? '' : 'hidden'}>
    <h1>Willkommen zurück</h1>
    <p>Diese Seite ist privat. Gib das Passwort ein, um weiterzumachen.</p>
    <label for="pw">Passwort</label>
    <input id="pw" type="password" autocomplete="current-password" required autofocus>
    <button class="go" type="submit">Anmelden</button>
    <p class="err" id="e-login" role="alert"></p>
    <button class="link" type="button" id="to-reset">Passwort vergessen?</button>
  </form>

  <form id="f-setup" ${mode === 'setup' ? '' : 'hidden'}>
    <h1>Passwort festlegen</h1>
    <p>Das ist der erste Besuch. Leg jetzt das Passwort fest, mit dem die Seite künftig geschützt ist.</p>
    <label for="n1">Neues Passwort (mindestens 6 Zeichen)</label>
    <input id="n1" type="password" autocomplete="new-password" minlength="6" required>
    <label for="n2">Passwort wiederholen</label>
    <input id="n2" type="password" autocomplete="new-password" minlength="6" required>
    <button class="go" type="submit">Passwort speichern</button>
    <p class="err" id="e-setup" role="alert"></p>
  </form>

  <section id="s-code" hidden>
    <h1>Notfall-Code notieren</h1>
    <p>Falls du das Passwort einmal vergisst, kannst du die Seite nur mit diesem Code zurücksetzen. Er wird nur jetzt angezeigt.</p>
    <div class="code" id="code"></div>
    <button class="go" type="button" id="code-done">Notiert – weiter zur Seite</button>
  </section>

  <form id="f-reset" hidden>
    <h1>Passwort zurücksetzen</h1>
    <p>Gib den Notfall-Code ein, den du beim Einrichten bekommen hast. Danach legst du ein neues Passwort fest.</p>
    <label for="rc">Notfall-Code</label>
    <input id="rc" type="text" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX" required>
    <button class="go" type="submit">Zurücksetzen</button>
    <p class="err" id="e-reset" role="alert"></p>
    <button class="link" type="button" id="to-login">Zurück zur Anmeldung</button>
  </form>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const show = (id) => { for (const s of ['f-login', 'f-setup', 's-code', 'f-reset']) $(s).hidden = s !== id; const el = $(id).querySelector('input'); if (el) el.focus(); };
  const TEXT = { wrong: 'Das stimmt leider nicht.', locked: 'Zu viele Versuche. Bitte warte ein paar Minuten.', weak: 'Das Passwort braucht mindestens 6 Zeichen.', configured: 'Es wurde bereits ein Passwort festgelegt. Bitte lade die Seite neu.' };
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
    if (await post('login', { password: $('pw').value }, e.target, 'e-login')) location.reload();
    else $('pw').select();
  });
  $('f-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('n1').value !== $('n2').value) { $('e-setup').textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
    const data = await post('setup', { password: $('n1').value }, e.target, 'e-setup');
    if (data) { $('code').textContent = data.recovery; show('s-code'); }
  });
  $('code-done').onclick = () => location.reload();
  $('to-reset').onclick = () => show('f-reset');
  $('to-login').onclick = () => show('f-login');
  $('f-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await post('reset', { recovery: $('rc').value }, e.target, 'e-reset')) show('f-setup');
  });
</script>
</body>
</html>`;
}
