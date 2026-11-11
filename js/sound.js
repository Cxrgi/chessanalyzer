// Dezente Zuggeräusche, komplett per Web Audio erzeugt (keine Audiodateien nötig).
let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function knock(t, { freq = 190, gain = 0.5, len = 0.07 }) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** kind: 'move' | 'capture' | 'check' | 'castle' | 'end' */
export function playSound(kind) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  if (kind === 'capture') {
    knock(t, { freq: 240, gain: 0.55, len: 0.05 });
    knock(t + 0.045, { freq: 150, gain: 0.5, len: 0.08 });
  } else if (kind === 'check') {
    knock(t, { freq: 190, gain: 0.45 });
    knock(t + 0.06, { freq: 520, gain: 0.25, len: 0.12 });
  } else if (kind === 'castle') {
    knock(t, { freq: 190, gain: 0.45 });
    knock(t + 0.09, { freq: 170, gain: 0.45 });
  } else if (kind === 'end') {
    knock(t, { freq: 330, gain: 0.3, len: 0.16 });
    knock(t + 0.14, { freq: 440, gain: 0.3, len: 0.22 });
  } else {
    knock(t, { freq: 190, gain: 0.5 });
  }
}
