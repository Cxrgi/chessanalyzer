// Prüft alle Lektionen: gültige Stellungen, legale Lösungszüge, echte Mattzüge, spielbare Antworten.
// Aufruf: node tools/check-lessons.mjs
import { Chess } from '../vendor/chess.js';
import { COURSES } from '../js/lessons-data.js';

const SQ = /^[a-h][1-8]$/;
let errors = 0, steps = 0, lessons = 0;
const fail = (where, msg) => { errors++; console.log(`FEHLER ${where}: ${msg}`); };

const play = (chess, uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
const mates = (chess) => chess.moves({ verbose: true }).filter((m) => m.san.endsWith('#')).map((m) => m.from + m.to + (m.promotion || ''));

function walk(where, fen, seq, i) {
  if (i >= seq.length) return;
  const st = seq[i];
  if ('auto' in st) {
    const chess = new Chess(fen);
    const cands = Array.isArray(st.auto) ? st.auto : [st.auto];
    const legal = cands.find((u) => { try { play(new Chess(fen), u); return true; } catch (e) { return false; } });
    if (!legal) return fail(where, `Stufe ${i}: keine der Antworten ${cands} ist legal in ${fen}`);
    play(chess, legal);
    return walk(where, chess.fen(), seq, i + 1);
  }
  const chess = new Chess(fen);
  let options = st.user || [];
  if (st.mate) {
    const m = mates(chess);
    if (!m.length) return fail(where, `Stufe ${i}: kein Matt in einem Zug in ${fen}`);
    for (const u of options) if (!m.includes(u)) fail(where, `Stufe ${i}: ${u} ist kein Matt`);
    options = m;
  }
  if (!options.length) return fail(where, `Stufe ${i}: keine Lösung angegeben`);
  // Nach einer Verzweigung passt nicht mehr jede aufgeführte Lösung zu jedem Ast – dann genügt eine legale.
  let legal = 0;
  for (const u of options) {
    const c = new Chess(fen);
    try { play(c, u); } catch (e) {
      if (i === 0) fail(where, `Stufe ${i}: Lösung ${u} ist illegal in ${fen}`);
      continue;
    }
    legal++;
    walk(where, c.fen(), seq, i + 1);
  }
  if (!legal) fail(where, `Stufe ${i}: keine der Lösungen ${options} ist legal in ${fen}`);
}

const ids = new Set();
for (const course of COURSES) {
  for (const lesson of course.lessons) {
    lessons++;
    if (ids.has(lesson.id)) fail(lesson.id, 'doppelte Lektions-ID');
    ids.add(lesson.id);
    lesson.steps.forEach((step, n) => {
      steps++;
      const where = `${course.id}/${lesson.id}#${n + 1}`;
      let chess;
      try { chess = new Chess(step.fen); } catch (e) { return fail(where, `ungültige Stellung: ${e.message}`); }
      for (const s of step.marks || []) if (!SQ.test(s)) fail(where, `Markierung ${s}`);
      for (const a of step.arrows || []) if (!SQ.test(a[0]) || !SQ.test(a[1])) fail(where, `Pfeil ${a}`);
      if (!step.text) fail(where, 'Text fehlt');
      if (step.type === 'info') return;
      if (step.type === 'square') {
        if (!(step.target || []).every((s) => SQ.test(s)) || !step.target.length) fail(where, 'Zielfeld');
        return;
      }
      if (step.type !== 'move') return fail(where, `unbekannter Typ ${step.type}`);
      const seq = step.seq || [{ user: step.accept || null, mate: step.mate }];
      walk(where, step.fen, seq, 0);
      for (const u of Object.keys(step.wrong || {})) {
        try { play(new Chess(step.fen), u); } catch (e) { fail(where, `Hinweis für illegalen Zug ${u}`); }
        if ((seq[0].user || []).includes(u)) fail(where, `${u} ist zugleich Lösung und Fehler`);
      }
      if (!step.success) fail(where, 'Erfolgstext fehlt');
    });
  }
}
console.log(`${COURSES.length} Kurse, ${lessons} Lektionen, ${steps} Schritte – ${errors ? errors + ' Fehler' : 'alles in Ordnung'}`);
process.exit(errors ? 1 : 0);
