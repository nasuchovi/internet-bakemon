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

// ===== BGM（時代ごとに曲調が変わる自動演奏） =====
let musicOn = true;
try { musicOn = localStorage.getItem('isekai-music') !== '0'; } catch (e) {}
let musicBus = null, musicTimer = null, mStep = 0, mNext = 0, mEra = 0, mWar = false, mPrev = 7, mChord = 0;
const ERA_MUSIC = [
  { name: '黎明', root: 62, scale: [0, 2, 4, 7, 9], bpm: 70, prog: [0, 5, 7, 0], density: 0.35, drums: false, lead: 'triangle' },
  { name: '興隆', root: 55, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 84, prog: [0, 7, 9, 5], density: 0.45, drums: false, lead: 'triangle' },
  { name: '動乱', root: 57, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 92, prog: [0, 8, 3, 10], density: 0.5, drums: true, lead: 'sawtooth' },
  { name: '魔導', root: 60, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 76, prog: [0, 2, 7, 4], density: 0.4, drums: false, lead: 'sine', shimmer: true },
  { name: '終末', root: 52, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 62, prog: [0, 1, 0, 8], density: 0.3, drums: true, lead: 'triangle', drone: true },
];
function mTone(f, t, dur, type, vol, att = 0.01, filt = 0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filt) { const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); fl.connect(g); } else o.connect(g);
  g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function mNoise(t, dur, vol, freq) {
  const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = freq; g.gain.value = vol;
  src.connect(fl); fl.connect(g); g.connect(musicBus); src.start(t);
}
function inScale(E, semi) { const m = ((semi % 12) + 12) % 12; return E.scale.includes(m); }
function mPlayStep(step, t) {
  const E = ERA_MUSIC[mEra] || ERA_MUSIC[0], beat = 60 / (E.bpm * (mWar ? 1.1 : 1)), eighth = beat / 2;
  // 2小節ごとに和音を変える
  if (step % 16 === 0) {
    mChord = E.prog[(step / 16) % E.prog.length];
    const r = E.root + mChord - 12, third = inScale(E, mChord + 4) ? 4 : 3, len = eighth * 16;
    for (const iv of [0, third, 7]) mTone(NOTE(r + iv), t, len + 0.8, 'sine', 0.035, 1.2, 900);
    if (E.shimmer) for (const iv of [12, 19]) { mTone(NOTE(r + iv) * 1.003, t, len, 'sine', 0.012, 1.5); }
    if (E.drone) mTone(NOTE(E.root - 24), t, len + 1, 'sawtooth', 0.02, 1.5, 300);
  }
  // ベース
  if (step % 8 === 0) mTone(NOTE(E.root + mChord - 24), t, beat * 1.6, 'triangle', 0.07, 0.02, 600);
  if (step % 8 === 6 && mEra >= 1) mTone(NOTE(E.root + mChord - 17), t, beat * 0.8, 'triangle', 0.04, 0.02, 600);
  // 旋律：音階上をランダムに歩く（リュートのような爪弾き）
  if (Math.random() < E.density * (step % 2 === 0 ? 1.2 : 0.7)) {
    mPrev = clamp(mPrev + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)], 0, E.scale.length * 2 - 1);
    const oct = Math.floor(mPrev / E.scale.length), deg = E.scale[mPrev % E.scale.length];
    const f = NOTE(E.root + 12 * oct + deg);
    mTone(f, t, beat * 1.4, E.lead, E.lead === 'sawtooth' ? 0.018 : 0.05, 0.005, E.lead === 'sawtooth' ? 1800 : 0);
    mTone(f * 2, t, beat * 0.5, 'sine', 0.012, 0.005);
  }
  // 太鼓（動乱・終末・戦時）
  if (E.drums || mWar) {
    if (step % 4 === 0) mTone(70, t, 0.35, 'sine', 0.12, 0.005);
    if (step % 8 === 4) mNoise(t, 0.18, 0.08, 1400);
    if (mWar && step % 2 === 1) mNoise(t, 0.05, 0.03, 6000);
  }
}
function musicTick() {
  if (!AC || !musicOn) return;
  const E = ERA_MUSIC[mEra] || ERA_MUSIC[0], eighth = 30 / (E.bpm * (mWar ? 1.1 : 1));
  if (mNext < AC.currentTime) mNext = AC.currentTime + 0.05;
  while (mNext < AC.currentTime + 0.5) { mPlayStep(mStep, mNext); mNext += eighth; mStep++; }
}
function startMusic() {
  if (!musicOn || !audio()) return;
  if (!musicBus) { musicBus = AC.createGain(); musicBus.gain.value = 0.9; musicBus.connect(AC.destination); }
  musicBus.gain.setTargetAtTime(0.9, AC.currentTime, 0.5);
  if (!musicTimer) musicTimer = setInterval(musicTick, 150);
}
function stopMusic() {
  if (musicBus) musicBus.gain.setTargetAtTime(0.0001, AC.currentTime, 0.3);
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
function setMusicState(era, war) { if (era !== mEra) { mEra = era; mStep = 0; } mWar = war; }
function toggleMusic() { musicOn = !musicOn; try { localStorage.setItem('isekai-music', musicOn ? '1' : '0'); } catch (e) {} if (musicOn) startMusic(); else stopMusic(); return musicOn; }
