/* =========================================================
   550万分の1 ― 効果音（Web Audio で合成。音声ファイルは使わない）
   鈴・拍子木・梵鐘ふうの短い音を、節目だけに鳴らす。
========================================================= */
(function (root) {
"use strict";
let ctx = null, on = true;
try { on = localStorage.getItem("heian550_sound") !== "off"; } catch (e) {}
function ac() {
  if (!ctx) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
// 金属の鈴：倍音をずらして重ねる
function bell(base, when, dur, vol) {
  const c = ac(); if (!c) return; const t = c.currentTime + (when || 0);
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([m, v]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = base * m;
    env(g, t, 0.004, (vol || 0.18) * v, dur / (1 + m * 0.35));
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.1);
  });
}
// 拍子木：短い雑音を帯域で絞る
function clack(when, vol) {
  const c = ac(); if (!c) return; const t = c.currentTime + (when || 0);
  const n = Math.floor(c.sampleRate * 0.06), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = c.createBufferSource(); s.buffer = b;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2100; f.Q.value = 6;
  const g = c.createGain(); g.gain.value = vol || 0.9;
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}
// 梵鐘：低い倍音をゆっくり減衰
function gong(when, vol) {
  const c = ac(); if (!c) return; const t = c.currentTime + (when || 0);
  [[1, 1], [2.02, 0.5], [2.74, 0.35], [3.76, 0.2], [5.1, 0.1]].forEach(([m, v]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = 98 * m;
    env(g, t, 0.02, (vol || 0.22) * v, 4.5 / (1 + m * 0.25));
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 5);
  });
}
// 太鼓：低い音を素早く落とす
function drum(when, vol) {
  const c = ac(); if (!c) return; const t = c.currentTime + (when || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
  env(g, t, 0.005, vol || 0.5, 0.45);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.6);
}
const PLAY = {
  birth: () => bell(1318, 0, 2.2, 0.16),
  birthRare: () => { bell(1318, 0, 2.2, 0.16); bell(1760, 0.32, 2.4, 0.14); },
  child: () => { bell(2093, 0, 1.0, 0.09); bell(2093, 0.18, 1.0, 0.07); },
  good: () => { clack(0, 0.8); clack(0.16, 0.7); },
  death: () => gong(0, 0.24),
  gokuraku: () => { bell(1046, 0, 2.6, 0.14); bell(1568, 0.25, 2.6, 0.1); bell(2093, 0.5, 2.6, 0.08); },
  rinne: () => clack(0, 0.9),
  jigoku: () => { drum(0, 0.55); drum(0.28, 0.45); }
};
root.HeianSound = {
  play(k) { if (!on || !PLAY[k]) return; try { PLAY[k](); } catch (e) {} },
  get on() { return on; },
  toggle() { on = !on; try { localStorage.setItem("heian550_sound", on ? "on" : "off"); } catch (e) {} if (on) { ac(); PLAY.child(); } return on; }
};
})(typeof window !== "undefined" ? window : globalThis);
