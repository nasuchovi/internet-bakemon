'use strict';
// ===== 描画 =====
let canvas, ctx, dpr = 1;
const cam = { x: 0, y: 0, s: 1 };
let baseCanvas, baseCtx, baseImg;
let seaRGB, provBorder, texture;
let mapMode = 'political';
let badgeRects = [];
let nationLabels = [];
let highlightNation = -1; // 開始画面での国ハイライト

function initRender() {
  canvas = document.getElementById('map'); ctx = canvas.getContext('2d');
  baseCanvas = document.createElement('canvas'); baseCanvas.width = MAP_W; baseCanvas.height = MAP_H;
  baseCtx = baseCanvas.getContext('2d'); baseImg = baseCtx.createImageData(MAP_W, MAP_H);
  resize(); window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
}
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  clampCam();
}
function viewW() { return canvas.width / dpr; }
function viewH() { return canvas.height / dpr; }
function fitScale() { return Math.min(viewW() / MAP_W, viewH() / MAP_H); }
function clampCam() {
  const minS = fitScale() * 0.8, maxS = 6;
  cam.s = clamp(cam.s, minS, maxS);
  const vw = viewW() / cam.s, vh = viewH() / cam.s;
  const mx = Math.max(0, (vw - MAP_W) / 2) + vw * 0.45, my = Math.max(0, (vh - MAP_H) / 2) + vh * 0.55;
  cam.x = clamp(cam.x, -mx, MAP_W - vw + mx); cam.y = clamp(cam.y, -my, MAP_H - vh + my);
}
function centerOn(x, y, s) { if (s) cam.s = s; cam.x = x - viewW() / 2 / cam.s; cam.y = y - viewH() / 2 / cam.s; clampCam(); }
function zoomAt(sx, sy, f) {
  const wx = cam.x + sx / cam.s, wy = cam.y + sy / cam.s;
  cam.s *= f; clampCam();
  cam.x = wx - sx / cam.s; cam.y = wy - sy / cam.s; clampCam();
}
function screenToWorld(sx, sy) { return [cam.x + sx / cam.s, cam.y + sy / cam.s]; }
function provAt(sx, sy) {
  const [x, y] = screenToWorld(sx, sy);
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return -1;
  return GRID[iy * MAP_W + ix];
}

let isSea;
function prepareStatic() {
  const n = MAP_W * MAP_H, g = GRID;
  isSea = new Uint8Array(S.provinces.length); for (const p of S.provinces) if (p.sea) isSea[p.id] = 1;
  provBorder = new Uint8Array(n);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, p = g[i];
    let b = 0;
    if (isSea[p]) {
      const chk = q => { if (q !== p && isSea[q]) b = 3; };
      if (x < MAP_W - 1) chk(g[i + 1]); if (y < MAP_H - 1) chk(g[i + MAP_W]);
      provBorder[i] = b; continue;
    }
    const chk = q => { if (q !== p) b = isSea[q] ? 2 : (b || 1); };
    if (x > 0) chk(g[i - 1]); if (x < MAP_W - 1) chk(g[i + 1]);
    if (y > 0) chk(g[i - MAP_W]); if (y < MAP_H - 1) chk(g[i + MAP_W]);
    provBorder[i] = b;
  }
  // 海岸からの距離
  const dist = new Uint8Array(n).fill(255), q = new Int32Array(n); let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (!isSea[g[i]]) { dist[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], d = dist[i]; if (d >= 60) continue;
    const x = i % MAP_W;
    const push = j => { if (dist[j] === 255) { dist[j] = d + 1; q[qt++] = j; } };
    if (x > 0) push(i - 1); if (x < MAP_W - 1) push(i + 1); if (i >= MAP_W) push(i - MAP_W); if (i < n - MAP_W) push(i + MAP_W);
  }
  const NZ = makeNoise(S.seed + 999);
  seaRGB = new Uint8ClampedArray(n * 3); texture = new Int8Array(n);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x;
    const t = NZ.vn(x / 5, y / 5) * 0.6 + NZ.vn(x / 17 + 9, y / 17 + 9) * 0.4;
    texture[i] = Math.round((t - 0.5) * 22);
    if (!isSea[g[i]]) continue;
    const d = Math.min(60, dist[i]) / 60, f = Math.pow(1 - d, 2.2);
    const wave = (NZ.vn(x / 40, y / 12) - 0.5) * 10;
    seaRGB[i * 3] = 24 + f * 50 + wave; seaRGB[i * 3 + 1] = 52 + f * 66 + wave; seaRGB[i * 3 + 2] = 84 + f * 62 + wave;
    if (dist[i] === 1) { seaRGB[i * 3] += 40; seaRGB[i * 3 + 1] += 40; seaRGB[i * 3 + 2] += 30; }
  }
  mapDirty = true;
}

function provColor(p) {
  const T = TERRAIN[p.terrain];
  switch (mapMode) {
    case 'terrain': return T.color;
    case 'goods': return GOODS[p.good].color;
    case 'religion': return RELIGIONS[p.religion].color;
    case 'trade': { const c = S.nodes[p.node].color; const me = S.player >= 0 ? nat(S.player) : null; return me && me.merchants.includes(p.node) ? [Math.min(255, c[0] + 50), Math.min(255, c[1] + 50), Math.min(255, c[2] + 50)] : c; }
    case 'unrest': {
      if (p.owner <= 0) return [190, 186, 176];
      const u = provUnrest(p);
      return u <= 0 ? [110, 170, 110] : u < 3 ? [220, 200, 90] : u < 5 ? [230, 140, 60] : [210, 60, 50];
    }
    case 'dev': {
      const t = clamp((dev(p) - 3) / 22, 0, 1);
      return t < 0.5 ? [200, 60 + t * 2 * 160, 50] : [200 - (t - 0.5) * 2 * 150, 220, 50 + (t - 0.5) * 2 * 40];
    }
    case 'diplo': {
      if (p.owner < 0) return [190, 186, 176];
      const me = S.player >= 0 ? S.player : highlightNation;
      if (p.owner === me) return [70, 190, 90];
      if (me < 0) return [160, 160, 160];
      if (hostile(me, p.owner)) return [210, 60, 50];
      if (isAlly(me, p.owner)) return [70, 130, 220];
      if (hasTruce(me, p.owner)) return [220, 200, 90];
      const r = getRel(me, p.owner);
      const t = clamp((r + 100) / 200, 0, 1);
      return [200 - t * 60, 150 + t * 40, 150 + t * 40];
    }
    default: {
      let c = p.owner >= 0 ? nat(p.owner).color : UNOWNED_COLOR;
      if (p.owner > 0 && nat(p.owner).overlord) { const o = nat(nat(p.owner).overlord).color; c = [c[0] * 0.6 + o[0] * 0.4, c[1] * 0.6 + o[1] * 0.4, c[2] * 0.6 + o[2] * 0.4]; }
      const sh = T.shade;
      if (highlightNation >= 0 && p.owner !== highlightNation) c = [c[0] * 0.55 + 40, c[1] * 0.55 + 40, c[2] * 0.55 + 40];
      return [c[0] * sh, c[1] * sh, c[2] * sh];
    }
  }
}
function renderBase() {
  const d = baseImg.data, g = GRID, np = S.provinces.length;
  const cols = new Float32Array(np * 3), owner = new Int16Array(np), occ = new Uint8Array(np), occC = new Float32Array(np * 3);
  for (const p of S.provinces) {
    if (p.sea) { owner[p.id] = -2; continue; }
    const c = provColor(p); cols[p.id * 3] = c[0]; cols[p.id * 3 + 1] = c[1]; cols[p.id * 3 + 2] = c[2];
    owner[p.id] = p.owner;
    if (mapMode === 'political' && p.owner >= 0 && p.controller !== p.owner) {
      occ[p.id] = 1; const cc = nat(p.controller).color; occC[p.id * 3] = cc[0]; occC[p.id * 3 + 1] = cc[1]; occC[p.id * 3 + 2] = cc[2];
    }
    if (p.colonizing && mapMode === 'political') { occ[p.id] = 2; const cc = nat(p.colonizing.by).color; occC[p.id * 3] = cc[0]; occC[p.id * 3 + 1] = cc[1]; occC[p.id * 3 + 2] = cc[2]; }
  }
  const sel = S.sel && S.sel.type === 'prov' ? S.sel.id : -1;
  for (let y = 0, i = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++, i++) {
    const pid = g[i], o = i * 4;
    if (isSea[pid]) {
      let r = seaRGB[i * 3], gg = seaRGB[i * 3 + 1], b = seaRGB[i * 3 + 2];
      if (provBorder[i] === 3) { r += 14; gg += 18; b += 22; }
      if (pid === sel) { r += 40; gg += 50; b += 50; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; continue;
    }
    let r = cols[pid * 3], gg = cols[pid * 3 + 1], b = cols[pid * 3 + 2];
    if (occ[pid] && ((((x + y) >> 2) & 1) === (occ[pid] === 2 ? (((x - y) >> 2) & 1) : 1))) {
      r = occC[pid * 3]; gg = occC[pid * 3 + 1]; b = occC[pid * 3 + 2];
    }
    const t = texture[i]; r += t; gg += t; b += t;
    const bd = provBorder[i];
    if (bd === 2) { r *= 0.45; gg *= 0.42; b *= 0.4; }
    else if (bd === 1) {
      const own = owner[pid]; let nb = false;
      const q1 = x > 0 ? g[i - 1] : -1, q2 = x < MAP_W - 1 ? g[i + 1] : -1, q3 = y > 0 ? g[i - MAP_W] : -1, q4 = y < MAP_H - 1 ? g[i + MAP_W] : -1;
      if ((q1 >= 0 && owner[q1] !== own && owner[q1] !== -2) || (q2 >= 0 && owner[q2] !== own && owner[q2] !== -2) || (q3 >= 0 && owner[q3] !== own && owner[q3] !== -2) || (q4 >= 0 && owner[q4] !== own && owner[q4] !== -2)) nb = true;
      if (nb && mapMode === 'political') { r *= 0.3; gg *= 0.28; b *= 0.26; } else { r *= 0.78; gg *= 0.78; b *= 0.78; }
    }
    if (pid === sel) {
      if (bd) { r = 255; gg = 244; b = 200; } else { r += (255 - r) * 0.28; gg += (255 - gg) * 0.28; b += (255 - b) * 0.22; }
    }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  baseCtx.putImageData(baseImg, 0, 0);
  computeNationLabels();
  mapDirty = false;
}
function computeNationLabels() {
  nationLabels = [];
  for (const n of S.nations) {
    if (n.isMonster || !n.alive) continue;
    let ax = 0, ay = 0, area = 0, minX = 1e9, maxX = -1e9;
    for (const p of S.provinces) if (p.owner === n.id) { ax += p.x * p.area; ay += p.y * p.area; area += p.area; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
    if (!area) continue;
    const name = n.short;
    const width = Math.max(Math.sqrt(area) * 1.1, maxX - minX + 30);
    const fs = clamp(width / (name.length + 1), 11, 54);
    nationLabels.push({ x: ax / area, y: ay / area, fs, name, id: n.id });
  }
}

function draw() {
  if (!S) return;
  if (mapDirty) renderBase();
  const w = viewW(), h = viewH();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#18324f'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = cam.s < 2.5;
  ctx.drawImage(baseCanvas, -cam.x * cam.s, -cam.y * cam.s, MAP_W * cam.s, MAP_H * cam.s);
  drawCapitals();
  drawLabels();
  drawSiegesAndColonies();
  drawPaths();
  drawArmies();
  drawFleets();
  drawBattles();
}
const sx = x => (x - cam.x) * cam.s, sy = y => (y - cam.y) * cam.s;

function drawCapitals() {
  if (cam.s < 0.9) return;
  for (const n of S.nations) {
    if (n.isMonster || !n.alive) continue;
    const p = prov(n.capital), x = sx(p.x), y = sy(p.y) + 14;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f4e4b0'; ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.5;
    ctx.fillRect(-3.5, -3.5, 7, 7); ctx.strokeRect(-3.5, -3.5, 7, 7); ctx.restore();
  }
}
function drawLabels() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const natAlpha = clamp((1.9 - cam.s) / 0.7, 0, 1);
  if (natAlpha > 0 && mapMode === 'political') {
    for (const L of nationLabels) {
      const fs = L.fs * cam.s;
      if (fs < 9) continue;
      ctx.font = `700 ${fs}px "Shippori Mincho", serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.18}px`;
      ctx.lineWidth = Math.max(2, fs * 0.12); ctx.strokeStyle = `rgba(20,12,6,${0.55 * natAlpha})`;
      ctx.fillStyle = `rgba(255,248,230,${0.92 * natAlpha})`;
      ctx.strokeText(L.name, sx(L.x), sy(L.y)); ctx.fillText(L.name, sx(L.x), sy(L.y));
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  if (cam.s >= 1.5) {
    const a = clamp((cam.s - 1.5) / 0.4, 0, 1);
    ctx.font = `600 ${clamp(10 * Math.sqrt(cam.s / 1.5), 10, 15)}px "Shippori Mincho", serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(20,14,8,${0.65 * a})`; ctx.fillStyle = `rgba(255,250,236,${a})`;
    for (const p of S.provinces) {
      if (p.sea) continue;
      const x = sx(p.x), y = sy(p.y) - 2;
      if (x < -50 || y < -20 || x > viewW() + 50 || y > viewH() + 20) continue;
      ctx.strokeText(p.name, x, y); ctx.fillText(p.name, x, y);
    }
  }
  if (cam.s >= 1.2) {
    ctx.font = `italic 600 11px "Shippori Mincho", serif`; ctx.fillStyle = 'rgba(190,220,240,.55)';
    for (const p of S.provinces) if (p.sea && p.name !== '外洋') ctx.fillText(p.name, sx(p.x), sy(p.y) + 16);
  }
  if (mapMode === 'trade') {
    const T = computeTrade();
    ctx.font = `700 13px "Shippori Mincho", serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,6,.8)'; ctx.fillStyle = '#fff3c8';
    for (const nd of S.nodes) { const t = `${nd.name} ${T.val[nd.id].toFixed(1)}`; ctx.strokeText(t, sx(nd.x), sy(nd.y)); ctx.fillText(t, sx(nd.x), sy(nd.y)); }
  }
}
function drawSiegesAndColonies() {
  for (const p of S.provinces) {
    const x = sx(p.x), y = sy(p.y);
    if (p.siege && p.siege.need) {
      const t = clamp(p.siege.prog / p.siege.need, 0, 1);
      ctx.beginPath(); ctx.arc(x, y + 24, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,12,8,.75)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y + 24); ctx.arc(x, y + 24, 8, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.closePath();
      ctx.fillStyle = rgb(nat(p.siege.by).color); ctx.fill();
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('🏰', x, y + 24);
    }
    if (p.dungeon && !p.dungeon.cleared && cam.s >= 1.0) {
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🕳', x + 14, y + 6);
    }
    if (p.colonizing || p.converting) {
      const job = p.colonizing || p.converting;
      const t = clamp((S.day - job.start) / (job.until - job.start), 0, 1);
      ctx.fillStyle = 'rgba(20,12,8,.7)'; ctx.fillRect(x - 14, y + 10, 28, 5);
      ctx.fillStyle = rgb(nat(job.by).color); ctx.fillRect(x - 13, y + 11, 26 * t, 3);
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.colonizing ? '⛺' : '⛪', x, y + 2);
    }
  }
}
function armyPos(a) {
  const p = prov(a.prov);
  if (a.path.length && a.prog > 0) { const q = prov(a.path[0]); return [p.x + (q.x - p.x) * a.prog, p.y + (q.y - p.y) * a.prog]; }
  return [p.x, p.y];
}
function drawPaths() {
  const selA = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  for (const a of S.armies) {
    if (!a.path.length) continue;
    if (a.owner !== S.player && a !== selA) continue;
    const [x0, y0] = armyPos(a);
    ctx.beginPath(); ctx.moveTo(sx(x0), sy(y0));
    for (const q of a.path) ctx.lineTo(sx(prov(q).x), sy(prov(q).y));
    ctx.setLineDash([6, 5]); ctx.lineWidth = a === selA ? 3 : 2;
    ctx.strokeStyle = a.retreat ? 'rgba(255,120,100,.9)' : a === selA ? 'rgba(255,240,160,.95)' : 'rgba(255,255,255,.6)'; ctx.stroke(); ctx.setLineDash([]);
    const last = prov(a.path[a.path.length - 1]);
    ctx.beginPath(); ctx.arc(sx(last.x), sy(last.y), 4, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  }
}
function drawArmies() {
  badgeRects = [];
  const groups = new Map();
  for (const a of S.armies) { const k = a.path.length && a.prog > 0 ? 'm' + a.id : a.prov; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(a); }
  const selId = S.sel && S.sel.type === 'army' ? S.sel.id : -1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const list of groups.values()) {
    list.sort((a, b) => (a.owner === S.player ? -1 : 0) - (b.owner === S.player ? -1 : 0));
    list.forEach((a, idx) => {
      const [wx, wy] = armyPos(a);
      const x = sx(wx), y = sy(wy) - 16 - idx * 21;
      const label = (a.hero || a.gen != null ? '★' : a.owner === MONSTER ? '魔 ' : a.owner === REBEL ? '叛 ' : '') + (a.delve ? '🕳' : '') + fmtMen(armyMen(a));
      ctx.font = '700 11px system-ui, sans-serif';
      const bw = Math.max(34, ctx.measureText(label).width + 16), bh = 17;
      const c = nat(a.owner).color;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(x - bw / 2 + 1.5, y - bh / 2 + 2, bw, bh, 4); ctx.fill();
      ctx.fillStyle = isRogue(a.owner) ? '#3a1020' : prov(a.prov).sea ? '#13283a' : '#1d150e'; roundRect(x - bw / 2, y - bh / 2, bw, bh, 4); ctx.fill();
      ctx.fillStyle = rgb(c); roundRect(x - bw / 2, y - bh / 2, 7, bh, 4); ctx.fill(); ctx.fillRect(x - bw / 2 + 3, y - bh / 2, 4, bh);
      ctx.lineWidth = a.id === selId ? 2.5 : 1; ctx.strokeStyle = a.id === selId ? '#ffe9a0' : a.owner === S.player ? '#d9b866' : 'rgba(255,255,255,.35)';
      roundRect(x - bw / 2, y - bh / 2, bw, bh, 4); ctx.stroke();
      ctx.fillStyle = a.retreat ? '#ff9c8c' : '#fff6e0'; ctx.fillText(label, x + 3, y + 0.5);
      const mm = clamp(a.morale / maxMorale(a.owner), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - bw / 2 + 2, y + bh / 2 - 1, bw - 4, 3);
      ctx.fillStyle = mm > 0.5 ? '#6fd36a' : mm > 0.25 ? '#e5c24a' : '#e5574a'; ctx.fillRect(x - bw / 2 + 2, y + bh / 2 - 1, (bw - 4) * mm, 3);
      badgeRects.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh + 2, id: a.id });
    });
  }
}
function fleetPos(f) {
  const p = prov(f.prov);
  if (f.path.length && f.prog > 0) { const q = prov(f.path[0]); return [p.x + (q.x - p.x) * f.prog, p.y + (q.y - p.y) * f.prog]; }
  return [p.x, p.y];
}
function drawFleets() {
  const selId = S.sel && S.sel.type === 'fleet' ? S.sel.id : -1;
  const count = new Map();
  for (const f of S.fleets) {
    const [wx, wy] = fleetPos(f);
    const k = f.prov, idx = count.get(k) || 0; count.set(k, idx + 1);
    const x = sx(wx), y = sy(wy) + 14 + idx * 20;
    if ((f.owner === S.player || f.id === selId) && f.path.length) {
      ctx.beginPath(); ctx.moveTo(x, y); for (const q of f.path) ctx.lineTo(sx(prov(q).x), sy(prov(q).y) + 14);
      ctx.setLineDash([3, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,220,255,.8)'; ctx.stroke(); ctx.setLineDash([]);
    }
    const label = `⛵${f.war}/${f.trans}`;
    ctx.font = '700 11px system-ui, sans-serif';
    const bw = ctx.measureText(label).width + 14, bh = 17;
    ctx.fillStyle = '#0f2233'; roundRect(x - bw / 2, y - bh / 2, bw, bh, 8); ctx.fill();
    ctx.lineWidth = f.id === selId ? 2.5 : 1.5; ctx.strokeStyle = f.id === selId ? '#ffe9a0' : rgb(nat(f.owner).color); roundRect(x - bw / 2, y - bh / 2, bw, bh, 8); ctx.stroke();
    ctx.fillStyle = f.inBattle ? '#ff9c8c' : '#dff2ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - bw / 2 + 4, y + bh / 2 - 1, bw - 8, 2);
    ctx.fillStyle = '#7fc8f0'; ctx.fillRect(x - bw / 2 + 4, y + bh / 2 - 1, (bw - 8) * clamp(f.str, 0, 1), 2);
    badgeRects.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh, id: f.id, fleet: true });
  }
}
function drawBattles() {
  const t = performance.now() / 300;
  for (const k in S.battles) {
    const p = prov(+k), x = sx(p.x), y = sy(p.y);
    ctx.beginPath(); ctx.arc(x, y + 4, 11 + Math.sin(t) * 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,30,20,.55)'; ctx.fill();
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('⚔', x, y + 4);
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function badgeAt(px, py) {
  for (let i = badgeRects.length - 1; i >= 0; i--) { const b = badgeRects[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; }
  return null;
}
