// „Mein Profil“: Fortschritt, Schwächenprofil über alle analysierten Partien, Stapelanalyse der letzten
// Partien sowie Sichern und Wiederherstellen aller Daten als Datei.
import { db } from './db.js';
import { syncInfo, syncNow, exportCode, importCode } from './sync.js';

/** Fehlerarten mit passender Lektion und passendem Aufgaben-Thema. */
export const TAGS = {
  hung: { label: 'Material eingestellt', lesson: 'haengend', theme: 'hangingPiece' },
  overlooked: { label: 'Angriff übersehen', lesson: 'drohungen', theme: 'defensiveMove' },
  'mate-allowed': { label: 'Matt zugelassen', lesson: 'check', theme: 'defensiveMove' },
  'mate-missed': { label: 'Matt ausgelassen', lesson: 'mattin2', theme: 'mateIn2' },
  'win-missed': { label: 'Materialgewinn verpasst', lesson: 'gabel', theme: 'fork' },
  'fork-allowed': { label: 'Gabel zugelassen', lesson: 'gabel', theme: 'fork' },
  material: { label: 'Verlustreiche Abwicklung', lesson: 'zaehlen', theme: 'sacrifice' },
  pin: { label: 'Fesselung zugelassen', lesson: 'fesselung', theme: 'pin' },
  king: { label: 'König im Angriff', lesson: 'verteidigen', theme: 'defensiveMove' },
  other: { label: 'Stellungsfehler', lesson: 'aktiv', theme: '' },
};

let d = null; // von der App übergebene Helfer
let batch = null;

const pct = (x) => (x == null ? '–' : Math.round(x) + ' %');
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function initProfile(deps) {
  d = deps;
  d.$('profile-body').addEventListener('click', onClick);
}

/** Tage in Folge mit Aktivität (bis heute oder gestern). */
export function dayStreak(activity) {
  let n = 0;
  const day = new Date();
  for (let i = 0; i < 400; i++) {
    const key = day.toISOString().slice(0, 10);
    if (activity[key]) n++;
    else if (i > 0) break;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

function spark(values, lo = 40, hi = 100) {
  if (values.length < 2) return '';
  const w = 240, h = 46;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Verlauf"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export async function renderProfile() {
  const esc = d.esc;
  const metas = (await db.all('meta').catch(() => [])).map((e) => e.value).sort((a, b) => a.at - b.at);
  const mine = metas.filter((m) => m.you && m.acc);
  const pz = d.store.get('puzzles', {});
  const lessons = d.lessonProgress();
  const activity = d.store.get('activity', {});
  const cards = (await db.all('cards').catch(() => [])).map((e) => e.value);
  const today = activity[new Date().toISOString().slice(0, 10)] || {};

  // --- Kennzahlen ---
  const accs = mine.map((m) => m.acc[m.you]);
  const last10 = avg(accs.slice(-10));
  const prev10 = avg(accs.slice(-20, -10));
  const trend = last10 != null && prev10 != null ? last10 - prev10 : null;
  const stat = (value, label, sub = '') => `<div class="stat"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  let html = `<div class="stats">
    ${stat(metas.length, 'analysierte Partien', mine.length < metas.length ? `${mine.length} mit bekannter Seite` : '')}
    ${stat(pct(last10), 'Genauigkeit', trend == null ? 'letzte 10 Partien' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)} gegenüber davor`)}
    ${stat(Math.round(pz.rating || 1000), 'Aufgaben-Wertung', `${pz.solved || 0} gelöst`)}
    ${stat(`${lessons.done}/${lessons.total}`, 'Lektionen')}
    ${stat(dayStreak(activity), 'Tage in Folge', `heute: ${today.puzzles || 0} Aufgaben, ${today.lessons || 0} Lektionen`)}
  </div>`;

  // --- Wochenrückblick ---
  const week = { games: 0, puzzles: 0, lessons: 0, cards: 0, played: 0 };
  const day = new Date();
  for (let i = 0; i < 7; i++) {
    const a = activity[day.toISOString().slice(0, 10)] || {};
    for (const k of Object.keys(week)) week[k] += a[k] || 0;
    day.setDate(day.getDate() - 1);
  }
  html += `<p class="week">Diese Woche: <b>${week.games}</b> Partien analysiert · <b>${week.puzzles}</b> Aufgaben gelöst · <b>${week.lessons}</b> Lektionen · <b>${week.cards}</b> Fehlerkarten wiederholt · <b>${week.played}</b> Partien gegen den Computer</p>`;

  // --- Stapelanalyse ---
  html += `<section class="pf-card"><h2>Mehrere Partien auf einmal analysieren</h2>
    <p class="hint">Lädt deine letzten Partien (chess.com oder Lichess, je nach Auswahl unter „Partie analysieren“) und analysiert sie nacheinander im Hintergrund. Je mehr Partien, desto genauer wird dein Schwächenprofil.</p>
    <div class="pf-row" id="batch-row">${batch
    ? `<div class="progress"><div class="progress-fill" style="width:${(batch.done / batch.total) * 100}%"></div></div><span>${esc(batch.text)}</span><button type="button" class="btn ghost small" data-act="batch-stop">Abbrechen</button>`
    : `<button type="button" class="btn primary small" data-act="batch" data-n="5">Letzte 5</button><button type="button" class="btn soft small" data-act="batch" data-n="10">Letzte 10</button><button type="button" class="btn soft small" data-act="batch" data-n="20">Letzte 20</button><span class="hint" id="batch-msg">${d.username() ? `für „${esc(d.username())}“` : 'Trag zuerst unter „Partie analysieren“ deinen Benutzernamen ein.'}</span>`}</div></section>`;

  if (mine.length) {
    // --- Fehlerarten ---
    const tags = {};
    let games = 0;
    for (const m of mine) {
      if (!m.tags) continue;
      games++;
      for (const [t, n] of Object.entries(m.tags[m.you] || {})) tags[t] = (tags[t] || 0) + n;
    }
    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
    const max = sorted.length ? sorted[0][1] : 1;
    html += `<section class="pf-card"><h2>Deine häufigsten Fehler</h2>${sorted.length ? `<p class="hint">Grobe Fehler aus ${games} Partien. Der oberste Balken ist dein größter Hebel.</p>
      <div class="bars">${sorted.slice(0, 6).map(([t, n]) => {
    const info = TAGS[t] || TAGS.other;
    return `<div class="bar-row"><span class="bar-label">${info.label}</span><div class="bar"><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b>
          <span class="bar-links"><button type="button" class="link" data-act="lesson" data-id="${info.lesson}">Lektion</button>${info.theme ? `<button type="button" class="link" data-act="theme" data-id="${info.theme}">Aufgaben</button>` : ''}</span></div>`;
  }).join('')}</div>` : '<p class="hint">Keine groben Fehler in den analysierten Partien – stark!</p>'}</section>`;

    // --- Partiephasen ---
    const phase = {};
    for (const m of mine) for (const p of m.phases || []) if (p[m.you] != null) (phase[p.name] = phase[p.name] || []).push(p[m.you]);
    const rows = Object.entries(phase).map(([name, xs]) => [name, avg(xs)]);
    const worst = rows.length ? rows.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    html += `<section class="pf-card half"><h2>Partiephasen</h2><div class="bars">${rows.map(([name, v]) =>
      `<div class="bar-row"><span class="bar-label">${name}</span><div class="bar"><i class="${worst && worst[0] === name && rows.length > 1 ? 'warn' : ''}" style="width:${v}%"></i></div><b>${pct(v)}</b></div>`).join('')}</div>
      ${worst && rows.length > 1 ? `<p class="hint">Am meisten verlierst du im <b>${worst[0]}</b>.</p>` : ''}</section>`;

    // --- Farben und Zeit ---
    const score = (list) => (list.length ? list.reduce((s, m) => s + (m.result === '1/2-1/2' ? 0.5 : (m.result === '1-0') === (m.you === 'w') ? 1 : 0), 0) / list.length * 100 : null);
    const white = mine.filter((m) => m.you === 'w'), black = mine.filter((m) => m.you === 'b');
    const timed = mine.filter((m) => m.time && m.time[m.you]);
    const trouble = timed.reduce((s, m) => s + (m.time[m.you].troubleErrors || 0), 0);
    const fast = timed.reduce((s, m) => s + (m.time[m.you].fastErrors || 0), 0);
    html += `<section class="pf-card half"><h2>Farben und Zeit</h2><ul class="pf-list">
      <li>Mit Weiß: <b>${pct(score(white))}</b> der Punkte, Genauigkeit ${pct(avg(white.map((m) => m.acc.w)))} (${white.length} Partien)</li>
      <li>Mit Schwarz: <b>${pct(score(black))}</b> der Punkte, Genauigkeit ${pct(avg(black.map((m) => m.acc.b)))} (${black.length} Partien)</li>
      ${timed.length ? `<li>Grobe Fehler in Zeitnot: <b>${trouble}</b> · blitzschnell gezogene Fehler: <b>${fast}</b></li>` : ''}
    </ul></section>`;

    // --- Verlauf und Eröffnungen ---
    html += `<section class="pf-card half"><h2>Genauigkeit im Verlauf</h2>${accs.length >= 2 ? `<div class="spark-wrap">${spark(accs.slice(-30))}</div><p class="hint">Deine letzten ${Math.min(30, accs.length)} Partien, älteste links.</p>` : '<p class="hint">Ab zwei Partien erscheint hier eine Kurve.</p>'}</section>`;
    const ops = {};
    for (const m of mine) {
      const name = (m.opening || 'Unbekannt').split(':')[0];
      (ops[name] = ops[name] || []).push(m);
    }
    const top = Object.entries(ops).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
    html += `<section class="pf-card half"><h2>Deine Eröffnungen</h2><table class="pf-table"><tr><th>Eröffnung</th><th>Partien</th><th>Punkte</th><th>Genauigkeit</th></tr>
      ${top.map(([name, list]) => `<tr><td>${esc(name)}</td><td>${list.length}</td><td>${pct(score(list))}</td><td>${pct(avg(list.map((m) => m.acc[m.you])))}</td></tr>`).join('')}</table></section>`;
  } else {
    html += '<section class="pf-card"><h2>Dein Schwächenprofil</h2><p class="hint">Sobald du eigene Partien analysiert hast und der Coach weiß, welche Seite du warst, erscheinen hier deine häufigsten Fehler, deine schwächste Partiephase und deine Eröffnungen.</p></section>';
  }

  // --- Aufgaben nach Thema ---
  const themes = Object.entries(pz.themes || {}).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  if (themes.length) {
    html += `<section class="pf-card half"><h2>Aufgaben nach Thema</h2><div class="bars">${themes.slice(0, 8).map(([t, v]) =>
      `<div class="bar-row"><span class="bar-label">${esc(d.themeName(t))}</span><div class="bar"><i class="${v.ok / v.n < 0.5 ? 'warn' : ''}" style="width:${(v.ok / v.n) * 100}%"></i></div><b>${pct((v.ok / v.n) * 100)}</b>
        <span class="bar-links"><button type="button" class="link" data-act="theme" data-id="${t}">üben</button></span></div>`).join('')}</div><p class="hint">Schwächste Themen zuerst (ab drei gespielten Aufgaben).</p></section>`;
  }

  // --- Abzeichen ---
  const badges = [
    [metas.length >= 1, 'Erste Analyse'], [metas.length >= 10, '10 Partien analysiert'], [metas.length >= 50, '50 Partien analysiert'],
    [(pz.solved || 0) >= 10, '10 Aufgaben gelöst'], [(pz.solved || 0) >= 100, '100 Aufgaben gelöst'], [(pz.solved || 0) >= 500, '500 Aufgaben gelöst'],
    [(pz.best || 0) >= 10, 'Zehner-Serie'], [(pz.rating || 0) >= 1500, 'Aufgaben-Wertung 1500'],
    [lessons.done >= 1, 'Erste Lektion'], [lessons.done >= 10, 'Grundkurs geschafft'], [lessons.done >= lessons.total, 'Alle Lektionen'],
    [mine.some((m) => m.counts && m.counts[m.you] && m.counts[m.you].brilliant > 0), 'Brillanter Zug'],
    [accs.some((a) => a >= 95), 'Partie mit 95 % Genauigkeit'], [cards.some((c) => c.box >= 4), 'Fehler gemeistert'],
    [d.store.get('wins', 0) >= 3, 'Computer Stufe 3 besiegt'], [d.store.get('wins', 0) >= 5, 'Computer Stufe 5 besiegt'], [dayStreak(activity) >= 7, 'Eine Woche am Stück'],
  ];
  html += `<section class="pf-card"><h2>Abzeichen</h2><div class="badges">${badges.map(([ok, name]) => `<span class="badge ${ok ? 'on' : ''}">${ok ? '★' : '☆'} ${name}</span>`).join('')}</div></section>`;

  // --- chess.com-Wertungen ---
  html += '<section class="pf-card half" id="pf-ratings" hidden></section>';

  // --- Daten sichern ---
  html += `<section class="pf-card half"><h2>Synchronisierung</h2>
    <p class="hint">Dein Stand gehört zu deinem Konto: Partien, Fortschritt, Trainingskarten und Einstellungen sind auf jedem Gerät gleich, auf dem du dich anmeldest.</p>
    <p class="hint" id="sync-status"></p>
    <div class="pf-row" id="sync-buttons" hidden><button type="button" class="btn soft small" id="sync-now" data-act="sync-now">Jetzt abgleichen</button></div></section>`;
  html += `<section class="pf-card half"><h2>Sicherungs-Code</h2>
    <p class="hint">Dein kompletter Stand als Text: kopieren, auf einem anderen Gerät oder in einem anderen Browser einfügen – fertig. Vorhandenes wird dabei nicht überschrieben, sondern zusammengeführt.</p>
    <div class="pf-row"><button type="button" class="btn soft small" data-act="export">Code kopieren</button><button type="button" class="btn soft small" data-act="import">Code einfügen</button></div>
    <div class="code-box" id="code-box" hidden><textarea id="code-input" rows="3" spellcheck="false" autocomplete="off" placeholder="Code hier einfügen (beginnt mit CA1.)" aria-label="Sicherungs-Code"></textarea>
      <button type="button" class="btn primary small" data-act="import-go">Einspielen</button></div>
    <p class="hint" id="backup-msg"></p></section>`;

  d.$('profile-body').innerHTML = html;
  renderSyncStatus();
  loadRatings();
}

/** Aktuelle chess.com-Wertungen über die öffentliche Schnittstelle (und Verlauf im Browser merken). */
async function loadRatings() {
  const name = d.username();
  const box = d.$('pf-ratings');
  if (!name || !box) return;
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(name.toLowerCase())}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const now = {};
    for (const [key, label] of [['chess_rapid', 'Schnellschach'], ['chess_blitz', 'Blitz'], ['chess_bullet', 'Bullet'], ['chess_daily', 'Fernschach']]) {
      if (data[key] && data[key].last) now[label] = data[key].last.rating;
    }
    if (!Object.keys(now).length || !d.$('pf-ratings')) return;
    const hist = d.store.get('ratings', {});
    hist[new Date().toISOString().slice(0, 10)] = now;
    const days = Object.keys(hist).sort();
    while (days.length > 400) delete hist[days.shift()];
    d.store.set('ratings', hist);
    const first = hist[days[0]] || {};
    box.hidden = false;
    box.innerHTML = `<h2>Deine chess.com-Wertungen</h2><ul class="pf-list">${Object.entries(now).map(([label, r]) => {
      const diff = first[label] != null && days.length > 1 ? r - first[label] : null;
      return `<li>${label}: <b>${r}</b>${diff ? ` <span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff} seit ${days[0].split('-').reverse().join('.')}</span>` : ''}</li>`;
    }).join('')}</ul>`;
  } catch (e) { /* ohne Netz einfach weglassen */ }
}

async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'lesson') location.hash = '#lektion/' + b.dataset.id;
  else if (act === 'theme') d.openTheme(b.dataset.id);
  else if (act === 'export') exportData(b);
  else if (act === 'import') { d.$('code-box').hidden = false; d.$('code-input').focus(); }
  else if (act === 'import-go') importData();
  else if (act === 'sync-now') syncNow();

  else if (act === 'batch-stop' && batch) batch.stop = true;
  else if (act === 'batch') runBatch(+b.dataset.n);
}

async function runBatch(n) {
  if (batch || !d.username()) return;
  batch = { done: 0, total: n, text: 'Lade die Partienliste …', stop: false };
  renderProfile();
  try {
    await d.batchAnalyze(n, (done, total, text) => {
      batch.done = done;
      batch.total = total;
      batch.text = text;
      const row = d.$('batch-row');
      if (row && row.querySelector('.progress-fill')) {
        row.querySelector('.progress-fill').style.width = `${(done / total) * 100}%`;
        row.querySelector('span').textContent = text;
      }
      return !batch.stop;
    });
  } catch (err) {
    console.error(err);
  }
  batch = null;
  if (d.$('profile-body').offsetParent) renderProfile();
}

/** „vor 3 Min.“ */
function ago(t) {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  if (min < 24 * 60) return `vor ${Math.round(min / 60)} Std.`;
  return 'am ' + new Date(t).toLocaleDateString('de-DE');
}

/** Zeigt, ob und wann zuletzt mit den anderen Geräten abgeglichen wurde. */
export function renderSyncStatus() {
  const box = d.$('sync-status');
  if (!box) return;
  const s = syncInfo();
  const on = s.started && s.available !== false;
  d.$('sync-buttons').hidden = !on;
  if (!on) {
    box.textContent = s.started || s.available === false
      ? 'Hier gibt es keine Konten – alles liegt nur in diesem Browser. Nimm deinen Stand mit dem Sicherungs-Code mit.'
      : 'Wird geprüft …';
    return;
  }
  box.textContent = s.off ? 'Ausgeschaltet – dieses Gerät behält seinen Stand für sich.'
    : s.busy ? 'Gleiche ab …'
      : s.error === 'offline' ? 'Kein Netz. Der Abgleich wird nachgeholt, sobald du wieder online bist.'
        : s.error ? 'Der letzte Abgleich hat nicht geklappt. Es wird später noch einmal versucht.'
          : s.at ? `Aktiv. Zuletzt abgeglichen ${ago(s.at)}${s.dirty ? ' – neue Änderungen werden gleich hochgeladen' : ''}.` : 'Aktiv.';
}

/** Sicherungs-Code: der komplette Stand als Text in der Zwischenablage. */
async function exportData(button) {
  const msg = d.$('backup-msg');
  try {
    const { code, games } = await exportCode();
    await d.copyText(code, button);
    msg.textContent = `Code kopiert (${games === 1 ? '1 Partie' : games + ' Partien'}, ${code.length.toLocaleString('de-DE')} Zeichen). Füg ihn auf dem anderen Gerät unter „Code einfügen“ ein.`;
  } catch (err) {
    msg.textContent = 'Das hat nicht geklappt.';
  }
}

async function importData() {
  const msg = d.$('backup-msg');
  const text = d.$('code-input').value;
  if (!text.trim()) {
    msg.textContent = 'Füg zuerst den Code in das Feld ein.';
    return;
  }
  try {
    const { games } = await importCode(text);
    d.$('code-input').value = '';
    msg.textContent = `Eingespielt – ${games === 1 ? '1 Partie ist' : games + ' Partien sind'} jetzt auf diesem Gerät. Die Seite wird neu geladen …`;
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    msg.textContent = 'Das ist kein gültiger Sicherungs-Code. Wurde er vollständig kopiert?';
  }
}
