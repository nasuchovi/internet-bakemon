'use strict';
// ===== スマホ版：操作とレイアウトの差し替え =====
// ゲームの中身（sim/ai/events/render/ui）はPC版と共通。ここでは操作と表示の流れだけを変える。

// ---------- 下から引き出すパネル（シート） ----------
function sheetOpen(full) {
  const p = $('panel'); p.classList.remove('hidden'); p.classList.toggle('full', !!full);
  document.body.classList.add('panel-open', 'sheet-open'); document.body.classList.toggle('sheet-full', !!full);
}
function sheetClose() {
  $('panel').classList.add('hidden'); $('panel').classList.remove('full');
  document.body.classList.remove('panel-open', 'sheet-open', 'sheet-full');
  document.querySelectorAll('#mtabs button').forEach(b => b.classList.remove('on'));
}
openPanel = function () { sheetOpen($('panel').classList.contains('full')); };
(function () {
  const h = $('sheet-handle'); let y0 = null, h0 = 0;
  h.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = $('panel').getBoundingClientRect().height; h.setPointerCapture(e.pointerId); $('panel').style.transition = 'none'; });
  h.addEventListener('pointermove', e => { if (y0 == null) return; $('panel').style.height = Math.max(60, h0 - (e.clientY - y0)) + 'px'; });
  const end = e => {
    if (y0 == null) return;
    const dy = e.clientY - y0, mainH = $('main').getBoundingClientRect().height, hNow = h0 - dy;
    $('panel').style.transition = ''; $('panel').style.height = ''; y0 = null;
    if (Math.abs(dy) < 6) { sheetOpen(!$('panel').classList.contains('full')); return; } // タップで全画面切替
    if (hNow < mainH * 0.28) sheetClose(); else sheetOpen(hNow > mainH * 0.7);
  };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
})();

// タブ：同じタブをもう一度押すと閉じる
const _act = act;
act = function (name, arg, ev) {
  if (name === 'tab' && arg === tab && !$('panel').classList.contains('hidden')) { sheetClose(); return; }
  if (name === 'close') { sheetClose(); return; }
  return _act(name, arg, ev);
};

// ---------- パネル更新は開いている時だけ、間隔を空けて ----------
let lastPanelAt = 0;
refresh = function (force) {
  renderTop();
  const open = !$('panel').classList.contains('hidden');
  if (open && (force || performance.now() - lastPanelAt > 700)) { renderPanel(force); lastPanelAt = performance.now(); }
  if (!open) document.querySelectorAll('#mtabs button').forEach(b => b.classList.remove('on'));
  if (typeof tutTick === 'function') tutTick();
};

// ---------- 描画は30fpsまで（電池と発熱を抑える） ----------
const _draw = draw; let lastDrawAt = 0;
draw = function () { const t = performance.now(); if (t - lastDrawAt < 30) return; lastDrawAt = t; _draw(); };

// ---------- 地図のタップ：自軍を選んでいれば「ここへ移動」 ----------
function hideCtx() { $('ctxmenu').classList.add('hidden'); }
function ownSelected() {
  const a = S.sel && S.sel.type === 'army' ? S.armies.find(x => x.id === S.sel.id) : null;
  const f = S.sel && S.sel.type === 'fleet' ? S.fleets.find(x => x.id === S.sel.id) : null;
  if (a && a.owner === S.player) return { a };
  if (f && f.owner === S.player) return { f };
  return null;
}
function doMove(o, pid) {
  if (o.a) orderMove(o.a, pid); else orderFleet(o.f, pid);
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
  refresh(true);
}
function showCtx(x, y, pid, o, enemy) {
  const m = $('ctxmenu'), p = prov(pid), who = o.a ? o.a.name : o.f.name;
  const hostileHere = S.armies.some(b => b.prov === pid && hostile(b.owner, S.player));
  m.innerHTML = `<div class="t">${esc(p.name)}</div><button class="go" data-cm="move">${hostileHere ? '⚔' : '🚩'} ${esc(who)}を${hostileHere ? '向かわせて攻撃' : 'ここへ移動'}</button>${enemy ? `<button data-cm="enemy">👁 ${esc(enemy.name)}を見る</button>` : ''}<button data-cm="view">📍 この州を見る</button>`;
  m.classList.remove('hidden');
  const r = $('main').getBoundingClientRect(), w = 200;
  m.style.left = clamp(x - w / 2, 8, r.width - w - 8) + 'px';
  m.style.top = clamp(y - 30, 8, r.height - 150) + 'px';
  m.querySelector('[data-cm="move"]').onclick = () => { hideCtx(); doMove(o, pid); };
  m.querySelector('[data-cm="view"]').onclick = () => { hideCtx(); select({ type: 'prov', id: pid }); refresh(true); };
  if (enemy) m.querySelector('[data-cm="enemy"]').onclick = () => { hideCtx(); select({ type: enemy.fleet ? 'fleet' : 'army', id: enemy.id }); refresh(true); };
}
let suppressTap = false;
const _leftClick = leftClick;
leftClick = function (x, y) {
  if (suppressTap) { suppressTap = false; return; }
  const was = !$('ctxmenu').classList.contains('hidden'); hideCtx();
  if (S.started && !moveMode) {
    const o = ownSelected(), b = badgeAt(x, y);
    if (o && !b) { const pid = provAt(x, y); if (pid >= 0) { showCtx(x, y, pid, o); return; } }
    if (o && b) { // 他国・魔物の駒をタップ：そこへ攻撃に向かうか選べる
      const u = b.fleet ? S.fleets.find(f => f.id === b.id) : S.armies.find(a => a.id === b.id);
      if (u && u.owner !== S.player) { showCtx(x, y, u.prov, o, { id: u.id, fleet: b.fleet, name: u.name }); return; }
    }
    if (was && !b) return; // メニューを閉じるだけ
  }
  _leftClick(x, y);
};
// 長押し：自軍を選んでいれば即移動
(function () {
  const cv = $('map'); let timer = null, sx0 = 0, sy0 = 0;
  cv.addEventListener('pointerdown', e => {
    if (!S || !S.started) return;
    sx0 = e.offsetX; sy0 = e.offsetY; clearTimeout(timer);
    timer = setTimeout(() => {
      const o = ownSelected(); if (!o) return;
      const pid = provAt(sx0, sy0); if (pid < 0) return;
      suppressTap = true; hideCtx(); doMove(o, pid);
      toast(`🚩 ${prov(pid).name}へ移動`);
    }, 480);
  });
  cv.addEventListener('pointermove', e => { if (Math.abs(e.offsetX - sx0) + Math.abs(e.offsetY - sy0) > 10) clearTimeout(timer); });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => clearTimeout(timer)));
})();

// ---------- 小物 ----------
let toastTimer = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 1800); }
// 資源の意味はタップで表示（ホバーがないため）
document.querySelectorAll('#topbar .res').forEach(el => el.addEventListener('click', () => { if (!el.dataset.act) toast(el.title); }));
$('btn-modes').onclick = () => { $('modes').classList.toggle('hidden'); };
document.addEventListener('click', e => { if (e.target.closest('[data-mode]')) $('modes').classList.add('hidden'); });
$('log').addEventListener('click', () => $('log').classList.toggle('open'));
// 戦闘・陥落の振動
const _fx = hooks.fx;
hooks.fx = (kind, pid, text) => { _fx(kind, pid, text); if (navigator.vibrate && (kind === 'war' || kind === 'lost' || kind === 'win')) try { navigator.vibrate(kind === 'war' ? [30, 40, 30] : 20); } catch (e) {} };

// 開始直後・ロード直後は地図を広く見せる（パネルは閉じておく）
const _beginPlay = beginPlay; beginPlay = function () { _beginPlay(); sheetClose(); };
const _afterLoad = afterLoad; afterLoad = function () { _afterLoad(); sheetClose(); };
// 高解像度すぎる画面では描画倍率を1.5に抑える（見た目はほぼ同じで負荷が大きく下がる）
resize = function () {
  if (typeof canvas === 'undefined' || !canvas) return;
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  clampCam();
};
if (typeof canvas !== 'undefined' && canvas) resize();
window.addEventListener('load', () => setTimeout(resize, 50));
window.addEventListener('resize', () => resize());
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($('map'));
