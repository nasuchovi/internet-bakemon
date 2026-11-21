'use strict';
// ===== 効果音（WebAudioで合成。外部ファイルなし） =====
let AC = null, master = null;
let muted = false;
try { muted = localStorage.getItem('isekai-mute') === '1'; } catch (e) {}
function audio() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, t, dur, type = 'sine', vol = 0.3, f2) {
  const ac = AC, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, vol = 0.3, freq = 800) {
  const ac = AC, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; fl.type = 'lowpass'; fl.frequency.value = freq; g.gain.value = vol;
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t);
}
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
function sfx(name) {
  if (muted || !audio()) return;
  const t = AC.currentTime + 0.01;
  switch (name) {
    case 'click': tone(1400, t, 0.03, 'square', 0.05); break;
    case 'coin': tone(1568, t, 0.08, 'triangle', 0.15); tone(2093, t + 0.06, 0.14, 'triangle', 0.15); break;
    case 'win': [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), t + i * 0.08, 0.3, 'triangle', 0.22)); noise(t, 0.15, 0.25, 2500); break;
    case 'lose': [67, 63, 60].forEach((n, i) => tone(NOTE(n), t + i * 0.14, 0.35, 'sawtooth', 0.08)); break;
    case 'siege': noise(t, 0.35, 0.5, 400); tone(90, t, 0.4, 'sine', 0.5, 45); tone(NOTE(79), t + 0.12, 0.3, 'triangle', 0.15); break;
    case 'lost': noise(t, 0.4, 0.4, 300); tone(110, t, 0.5, 'sawtooth', 0.1, 70); break;
    case 'war': [0, 0.35].forEach(d => { tone(110, t + d, 0.5, 'sawtooth', 0.14); tone(165, t + d, 0.5, 'sawtooth', 0.1); }); tone(55, t, 0.9, 'sine', 0.3); break;
    case 'levelup': [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(NOTE(n), t + i * 0.09, 0.28, 'square', 0.07)); tone(NOTE(88), t + 0.55, 0.6, 'triangle', 0.18); break;
    case 'event': tone(880, t, 0.6, 'sine', 0.18); tone(1320, t + 0.05, 0.7, 'sine', 0.1); break;
    case 'summon': tone(220, t, 1.2, 'sine', 0.18, 880); tone(330, t + 0.2, 1.0, 'triangle', 0.08, 1320); noise(t, 1.1, 0.08, 6000); break;
    case 'reveal-N': tone(NOTE(76), t, 0.5, 'triangle', 0.2); break;
    case 'reveal-R': [76, 83].forEach((n, i) => tone(NOTE(n), t + i * 0.1, 0.6, 'triangle', 0.2)); break;
    case 'reveal-SR': [72, 76, 79, 83].forEach((n, i) => tone(NOTE(n), t + i * 0.07, 0.9, 'triangle', 0.16)); break;
    case 'reveal-SSR': [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone(NOTE(n), t + i * 0.06, 1.2, 'triangle', 0.14)); noise(t, 0.6, 0.2, 8000); tone(NOTE(60), t, 1.5, 'sine', 0.25); break;
    case 'accident': noise(t, 0.8, 0.5, 250); tone(80, t, 1.0, 'sawtooth', 0.15, 40); break;
  }
}
function toggleMute() { muted = !muted; try { localStorage.setItem('isekai-mute', muted ? '1' : '0'); } catch (e) {} if (!muted) sfx('click'); return muted; }
