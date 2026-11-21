'use strict';
// ===== 描画 =====
let canvas, ctx, dpr = 1;
const cam = { x: 0, y: 0, s: 1 };
let baseCanvas, baseCtx, baseImg;
let seaRGB, provBorder;
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
function viewW() { return exportView ? exportView.w : canvas.width / dpr; }
function viewH() { return exportView ? exportView.h : canvas.height / dpr; }
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

let isSea, paper, edgeBuf;
let glyphs = [];
let mapDeco = { compass: { x: 120, y: 120 }, cart: { x: 30, y: 30, w: 330, h: 220 }, serp: null };

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
  placeDecorations(dist);
  // 紙と海の下地
  const NZ = makeNoise(S.seed + 999);
  paper = new Uint8ClampedArray(n * 3); seaRGB = new Uint8ClampedArray(n * 3); edgeBuf = new Uint8Array(n);
  const cx = mapDeco.compass.x, cy = mapDeco.compass.y, step = Math.PI / 8;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x;
    const fine = NZ.vn(x / 3.5, y / 3.5) * 0.5 + NZ.vn(x / 11 + 9, y / 11 + 9) * 0.5;
    const stain = Math.max(0, NZ.fbm(x / 170 + 30, y / 170 + 30, 3) - 0.56);
    const e = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y) / 140, v = e < 1 ? (1 - e) * (1 - e) * 34 : 0;
    const pr = 236 + (fine - 0.5) * 20 - stain * 130 - v, pg = 222 + (fine - 0.5) * 20 - stain * 145 - v * 1.15, pb = 188 + (fine - 0.5) * 18 - stain * 170 - v * 1.4;
    paper[i * 3] = pr; paper[i * 3 + 1] = pg; paper[i * 3 + 2] = pb;
    if (!isSea[g[i]]) continue;
    const dd = Math.min(60, dist[i]), deep = dd / 60;
    let mr = 0.80 - deep * 0.17, mg = 0.88 - deep * 0.14, mb = 0.89 - deep * 0.10;
    if (dd === 3 || dd === 7 || dd === 12 || dd === 18) { mr *= 0.84; mg *= 0.87; mb *= 0.9; } // 海岸の波紋
    if (dd > 5) { // 方位線（羅針盤から放射）
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      if (r > 80) { const k = Math.atan2(dy, dx) / step; if (Math.abs(k - Math.round(k)) * step * r < 0.55) { mr *= 0.88; mg *= 0.88; mb *= 0.9; } }
    }
    seaRGB[i * 3] = pr * mr; seaRGB[i * 3 + 1] = pg * mg; seaRGB[i * 3 + 2] = pb * mb;
  }
  // 地形記号の配置
  const R = mulberry32(S.seed * 31 + 7);
  glyphs = [];
  const kind = { mountains: 'm', hills: 'h', forest: 'f', marsh: 'w', desert: 'd', miasma: 'x', plains: 'p' };
  for (const p of S.provinces) {
    if (p.sea) continue;
    const t = kind[p.terrain];
    const want = t === 'p' ? (R() < 0.35 ? 1 : 0) : clamp(Math.round(p.area / 650), 1, 9);
    const rad = Math.sqrt(p.area) * 0.75, mine = [];
    for (let k = 0; k < want * 8 && mine.length < want; k++) {
      const gx = Math.round(p.x + (R() * 2 - 1) * rad), gy = Math.round(p.y + (R() * 2 - 1) * rad);
      if (gx < 2 || gy < 2 || gx >= MAP_W - 2 || gy >= MAP_H - 2 || g[gy * MAP_W + gx] !== p.id) continue;
      if (Math.hypot(gx - p.x, gy - p.y) < 15) continue;
      if (provBorder[gy * MAP_W + gx] || mine.some(o => Math.hypot(o.x - gx, o.y - gy) < 10)) continue;
      mine.push({ x: gx, y: gy, t, r: R(), pid: p.id, k: mine.length });
    }
    glyphs.push(...mine);
    // 発展用の区画（集落・畑・鉱山など）：中心寄りから
    const slots = [];
    for (let k = 0; k < 90 && slots.length < 8; k++) {
      const rr = rad * (0.25 + 0.75 * Math.sqrt(R())), an = R() * Math.PI * 2;
      const gx = Math.round(p.x + Math.cos(an) * rr), gy = Math.round(p.y + Math.sin(an) * rr);
      if (gx < 3 || gy < 3 || gx >= MAP_W - 3 || gy >= MAP_H - 3 || g[gy * MAP_W + gx] !== p.id) continue;
      if (Math.hypot(gx - p.x, gy - (p.y + 14)) < 16 || Math.hypot(gx - p.x, gy - p.y) < 14) continue;
      if (provBorder[gy * MAP_W + gx] || slots.some(o => Math.hypot(o.x - gx, o.y - gy) < 15)) continue;
      slots.push({ x: gx, y: gy, r: R() });
    }
    slots.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    p._slots = slots; p._wild = mine.length;
  }
  mapDirty = true;
}
function placeDecorations(dist) {
  const seaFrac = (x0, y0, w, h) => { let s = 0, c = 0; for (let y = y0; y < y0 + h; y += 10) for (let x = x0; x < x0 + w; x += 10) { if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue; c++; if (isSea[GRID[y * MAP_W + x]]) s++; } return c ? s / c : 0; };
  const CW = 330, CH = 230;
  const carts = [[26, 26], [MAP_W - CW - 26, 26], [26, MAP_H - CH - 26], [MAP_W - CW - 26, MAP_H - CH - 26]];
  let bi = 0, bs = -1; carts.forEach((c, i) => { const f = seaFrac(c[0], c[1], CW, CH); if (f > bs) { bs = f; bi = i; } });
  mapDeco.cart = { x: carts[bi][0], y: carts[bi][1], w: CW, h: CH };
  const comps = [[130, 130], [MAP_W - 130, 130], [130, MAP_H - 130], [MAP_W - 130, MAP_H - 130]];
  let ci = 0, cs = -1; comps.forEach((c, i) => { if (i === bi) return; const f = seaFrac(c[0] - 80, c[1] - 80, 160, 160); if (f > cs) { cs = f; ci = i; } });
  mapDeco.compass = { x: comps[ci][0], y: comps[ci][1] };
  let best = null, bd = 34;
  for (let y = 60; y < MAP_H - 60; y += 20) for (let x = 60; x < MAP_W - 60; x += 20) {
    const d = dist[y * MAP_W + x]; if (d === 255 || d < bd) continue;
    if (Math.hypot(x - mapDeco.compass.x, y - mapDeco.compass.y) < 220) continue;
    const c = mapDeco.cart; if (x > c.x - 120 && x < c.x + c.w + 120 && y > c.y - 60 && y < c.y + c.h + 60) continue;
    bd = d; best = { x, y };
  }
  mapDeco.serp = best;
}

function provColor(p) {
  switch (mapMode) {
    case 'terrain': return TERRAIN[p.terrain].color;
    case 'goods': return GOODS[p.good].color;
    case 'religion': return RELIGIONS[p.religion].color;
    case 'guild': {
      const gs = S.guilds.filter(g => g.pid === p.id);
      if (gs.length) return nat(gs[0].owner).color;
      return [236, 222, 188];
    }
    case 'unrest': {
      if (p.owner <= 0) return [236, 222, 188];
      const u = provUnrest(p);
      return u <= 0 ? [110, 170, 110] : u < 3 ? [220, 200, 90] : u < 5 ? [230, 140, 60] : [210, 60, 50];
    }
    case 'dev': {
      const t = clamp((dev(p) - 3) / 22, 0, 1);
      return t < 0.5 ? [200, 60 + t * 2 * 160, 50] : [200 - (t - 0.5) * 2 * 150, 220, 50 + (t - 0.5) * 2 * 40];
    }
    case 'diplo': {
      if (p.owner < 0) return [236, 222, 188];
      const me = S.player >= 0 ? S.player : highlightNation;
      if (p.owner === me) return [70, 190, 90];
      if (me < 0) return [160, 160, 160];
      if (hostile(me, p.owner)) return [210, 60, 50];
      if (isAlly(me, p.owner)) return [70, 130, 220];
      if (hasTruce(me, p.owner)) return [220, 200, 90];
      const t = clamp((getRel(me, p.owner) + 100) / 200, 0, 1);
      return [200 - t * 60, 150 + t * 40, 150 + t * 40];
    }
    default: {
      if (p.owner < 0) return null;
      let c = nat(p.owner).color;
      if (p.owner > 0 && nat(p.owner).overlord) { const o = nat(nat(p.owner).overlord).color; c = [c[0] * 0.6 + o[0] * 0.4, c[1] * 0.6 + o[1] * 0.4, c[2] * 0.6 + o[2] * 0.4]; }
      const gr = (c[0] + c[1] + c[2]) / 3; // 水彩らしく少し彩度を落とす
      return [c[0] * 0.82 + gr * 0.18, c[1] * 0.82 + gr * 0.18, c[2] * 0.82 + gr * 0.18];
    }
  }
}
function renderBase() {
  const d = baseImg.data, g = GRID, np = S.provinces.length, n = MAP_W * MAP_H;
  const political = mapMode === 'political';
  const cols = new Float32Array(np * 3), owner = new Int16Array(np), aBase = new Float32Array(np), occ = new Uint8Array(np), occC = new Float32Array(np * 3);
  for (const p of S.provinces) {
    if (p.sea) { owner[p.id] = -2; continue; }
    owner[p.id] = p.owner;
    const c = provColor(p);
    if (c) { cols[p.id * 3] = c[0]; cols[p.id * 3 + 1] = c[1]; cols[p.id * 3 + 2] = c[2]; aBase[p.id] = 1; }
    if (political && highlightNation >= 0 && p.owner !== highlightNation) aBase[p.id] *= 0.3;
    if (political && p.owner >= 0 && p.controller !== p.owner) { occ[p.id] = 1; const cc = nat(p.controller).color; occC[p.id * 3] = cc[0]; occC[p.id * 3 + 1] = cc[1]; occC[p.id * 3 + 2] = cc[2]; }
    if (political && p.colonizing) { occ[p.id] = 2; const cc = nat(p.colonizing.by).color; occC[p.id * 3] = cc[0]; occC[p.id * 3 + 1] = cc[1]; occC[p.id * 3 + 2] = cc[2]; }
  }
  // 国境・海岸からの距離（手彩色の縁取り用）
  const ed = edgeBuf;
  for (let y = 0, i = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++, i++) {
    const o = owner[g[i]];
    if (o === -2) { ed[i] = 0; continue; }
    const diff = (x > 0 && owner[g[i - 1]] !== o) || (x < MAP_W - 1 && owner[g[i + 1]] !== o) || (y > 0 && owner[g[i - MAP_W]] !== o) || (y < MAP_H - 1 && owner[g[i + MAP_W]] !== o);
    ed[i] = diff ? 0 : 255;
  }
  for (let y = 0, i = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++, i++) {
    let v = ed[i]; if (x > 0 && ed[i - 1] + 1 < v) v = ed[i - 1] + 1; if (y > 0 && ed[i - MAP_W] + 1 < v) v = ed[i - MAP_W] + 1; ed[i] = v;
  }
  for (let y = MAP_H - 1, i = n - 1; y >= 0; y--) for (let x = MAP_W - 1; x >= 0; x--, i--) {
    let v = ed[i]; if (x < MAP_W - 1 && ed[i + 1] + 1 < v) v = ed[i + 1] + 1; if (y < MAP_H - 1 && ed[i + MAP_W] + 1 < v) v = ed[i + MAP_W] + 1; ed[i] = v;
  }
  const sel = S.sel && S.sel.type === 'prov' ? S.sel.id : -1;
  for (let y = 0, i = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++, i++) {
    const pid = g[i], o = i * 4, k = i * 3;
    if (isSea[pid]) {
      let r = seaRGB[k], gg = seaRGB[k + 1], b = seaRGB[k + 2];
      if (pid === sel) { r += 22; gg += 26; b += 26; if (provBorder[i] === 3) { r = 150; gg = 40; b = 30; } }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; continue;
    }
    let r = paper[k], gg = paper[k + 1], b = paper[k + 2];
    const band = Math.max(0, 1 - ed[i] / 7);
    const a = aBase[pid] * (political ? 0.26 + 0.6 * band * band + (band > 0 ? 0.05 : 0) : 0.5 + 0.2 * band);
    if (a > 0) { r *= 1 - a + a * cols[pid * 3] / 255; gg *= 1 - a + a * cols[pid * 3 + 1] / 255; b *= 1 - a + a * cols[pid * 3 + 2] / 255; }
    if (occ[pid] && (occ[pid] === 1 ? (x + y) % 6 < 2 : (x % 4 === 0 && y % 4 === 0))) { r *= occC[pid * 3] / 255 * 0.9; gg *= occC[pid * 3 + 1] / 255 * 0.9; b *= occC[pid * 3 + 2] / 255 * 0.9; }
    const bd = provBorder[i];
    if (bd === 2) { r = r * 0.25 + 52; gg = gg * 0.25 + 34; b = b * 0.25 + 20; }
    else if (bd === 1) {
      if (ed[i] === 0) { r = r * 0.2 + 56; gg = gg * 0.2 + 34; b = b * 0.2 + 18; } // 国境：濃いインク
      else if (((x + y) & 3) < 2) { r *= 0.8; gg *= 0.78; b *= 0.76; } // 州境：点線
    }
    if (pid === sel) { if (bd) { r = 160; gg = 36; b = 24; } else { r = r * 0.85 + 38; gg = gg * 0.85 + 36; b = b * 0.85 + 30; } }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  baseCtx.putImageData(baseImg, 0, 0);
  computeNationLabels();
  for (const p of S.provinces) if (!p.sea) p._feats = devFeatures(p);
  computeRoads();
  mapDirty = false;
}
function computeNationLabels() {
  nationLabels = [];
  const np = S.provinces.length;
  const compOf = new Int32Array(np).fill(-1);
  let cid = 0;
  for (const n of S.nations) {
    if (n.isMonster || !n.alive) continue;
    // 領土を連結成分に分ける
    const comps = [];
    for (const p0 of S.provinces) {
      if (p0.owner !== n.id || compOf[p0.id] >= 0) continue;
      const list = [], q = [p0.id]; compOf[p0.id] = cid;
      while (q.length) { const u = q.pop(); list.push(prov(u)); for (const v of prov(u).nb) if (compOf[v] < 0 && prov(v).owner === n.id) { compOf[v] = cid; q.push(v); } }
      comps.push({ id: cid++, list, area: list.reduce((s, p) => s + p.area, 0) });
    }
    comps.sort((a, b) => b.area - a.area);
    comps.forEach((c, i) => { if (i === 0 || (c.area >= comps[0].area * 0.6 && c.area > 5000)) { const L = fitLabel(n.short, c, compOf); if (L) { L.id = n.id; nationLabels.push(L); } } });
  }
}
// 領土の形に沿って国名を収める（傾け・曲げ・縦書き）
function fitLabel(text, comp, compOf) {
  const inside = (x, y) => { const ix = x | 0, iy = y | 0; if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return false; return compOf[GRID[iy * MAP_W + ix]] === comp.id; };
  const walk = (x, y, dx, dy, max) => { let last = 0, gap = 0; for (let t = 2; t <= max; t += 2) { if (inside(x + dx * t, y + dy * t)) { last = t; gap = 0; } else if (++gap > 3) break; } return last; };
  let A = 0, mx = 0, my = 0;
  for (const p of comp.list) { A += p.area; mx += p.x * p.area; my += p.y * p.area; }
  mx /= A; my /= A;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of comp.list) { const dx = p.x - mx, dy = p.y - my, sp = p.area / (4 * Math.PI); cxx += p.area * (dx * dx + sp); cyy += p.area * (dy * dy + sp); cxy += p.area * dx * dy; }
  let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  // 起点：重心が領土外なら最大の州の中心
  let sx0 = mx, sy0 = my;
  if (!inside(sx0, sy0)) { const big = comp.list.reduce((a, b) => b.area > a.area ? b : a); sx0 = big.x; sy0 = big.y; }
  const n = [...text].length;
  let best = null;
  const tryAngle = (a0) => {
    const ux = Math.cos(a0), uy = Math.sin(a0), vx = -uy, vy = ux;
    const a = -walk(sx0, sy0, -ux, -uy, 900), b = walk(sx0, sy0, ux, uy, 900);
    const len = b - a; if (len < 8) return;
    const cx = sx0 + ux * (a + b) / 2, cy = sy0 + uy * (a + b) / 2;
    // 軸に沿って太さと中心線を測る
    const K = 7, ss = [], ms = [], hs = [];
    for (let i = 0; i < K; i++) {
      const s = (i / (K - 1) - 0.5) * len * 0.84, px = cx + ux * s, py = cy + uy * s;
      let base = 0;
      if (!inside(px, py)) { let f = false; for (const o of [4, -4, 8, -8, 12, -12, 18, -18]) if (inside(px + vx * o, py + vy * o)) { base = o; f = true; break; } if (!f) continue; }
      const c1 = base - walk(px + vx * base, py + vy * base, -vx, -vy, 400), c2 = base + walk(px + vx * base, py + vy * base, vx, vy, 400);
      ss.push(s); ms.push((c1 + c2) / 2); hs.push(c2 - c1);
    }
    if (ss.length < 3) return;
    // 中心線を二次曲線で近似
    let S0 = ss.length, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
    for (let i = 0; i < ss.length; i++) { const s = ss[i], m = ms[i]; S1 += s; S2 += s * s; S3 += s * s * s; S4 += s ** 4; T0 += m; T1 += m * s; T2 += m * s * s; }
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], D = det(M);
    let qa = 0, qb = 0, qc = T0 / S0;
    if (Math.abs(D) > 1e-6) {
      qa = det([[T2, S3, S2], [T1, S2, S1], [T0, S1, S0]]) / D; qb = det([[S4, T2, S2], [S3, T1, S1], [S2, T0, S0]]) / D; qc = det([[S4, S3, T2], [S3, S2, T1], [S2, S1, T0]]) / D;
      const half = len / 2, lim = len * 0.12;
      if (Math.abs(qa) * half * half > lim) qa = Math.sign(qa) * lim / (half * half);
    }
    const hsorted = [...hs].sort((x, y) => x - y), thick = hsorted[Math.floor(hsorted.length * 0.3)];
    const usable = len * 0.82;
    let fs = Math.min(thick * 0.72, usable / (n + (n - 1) * 0.2));
    fs = clamp(fs, 6, 64);
    const spc = n > 1 ? clamp((usable - n * fs) / ((n - 1) * fs), 0.1, 1.1) : 0;
    const score = fs * (1 + 0.15 * spc);
    if (!best || score > best.score) best = { score, cx, cy, ux, uy, vx, vy, qa, qb, qc, fs, spc, ang: a0 };
  };
  const vertical = Math.abs(ang) > 0.8; // 縦長・急斜面の国は縦書き
  if (vertical) ang = Math.PI / 2;
  else ang = clamp(ang, -0.55, 0.55);
  for (const d of [0, -0.15, 0.15, -0.3, 0.3]) tryAngle(vertical ? Math.PI / 2 + d * 0.5 : clamp(ang + d, -0.6, 0.6));
  if (!vertical) { const keep = best; best = null; for (const d of [0, -0.15, 0.15]) tryAngle(Math.PI / 2 + d); if (!best || (keep && keep.score >= best.score * 0.8)) best = keep; }
  if (!best) return null;
  // 文字ごとの位置と角度
  const B = best, chars = [...text], tw = n * B.fs + (n - 1) * B.fs * B.spc;
  const isV = Math.abs(Math.abs(B.ang) - Math.PI / 2) < 0.5;
  const glyphs2 = chars.map((ch, k) => {
    const s = -tw / 2 + B.fs / 2 + k * B.fs * (1 + B.spc);
    const m = B.qa * s * s + B.qb * s + B.qc, dm = 2 * B.qa * s + B.qb;
    const x = B.cx + B.ux * s + B.vx * m, y = B.cy + B.uy * s + B.vy * m;
    let rot = Math.atan2(B.uy + B.vy * dm, B.ux + B.vx * dm);
    if (isV) { rot -= Math.PI / 2; if (ch === 'ー' || ch === '〜') rot += Math.PI / 2; } // 縦書きは文字を立てる（長音は縦向き）
    if (rot > Math.PI / 2) rot -= Math.PI; if (rot < -Math.PI / 2) rot += Math.PI;
    return { ch, x, y, rot };
  });
  return { fs: B.fs, glyphs: glyphs2, x: B.cx, y: B.cy, name: text };
}

function draw() {
  if (!S) return;
  if (mapDirty) renderBase();
  const w = viewW(), h = viewH();
  const now = performance.now();
  let ox = 0, oy = 0;
  if (now < shakeUntil) { const k = (shakeUntil - now) / 400; ox = (Math.random() - 0.5) * shakeAmp * 2 * k; oy = (Math.random() - 0.5) * shakeAmp * 2 * k; }
  ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, '#3a2716'); bg.addColorStop(1, '#170e07');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  drawMapSheet();
  drawSiegesAndColonies();
  drawPaths();
  drawArmies();
  drawFleets();
  drawBattles();
  drawFx(now);
}
const sx = x => (x - cam.x) * cam.s, sy = y => (y - cam.y) * cam.s;
// 地図そのもの（書き出しでも使う）
function drawMapSheet(exporting) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24 * Math.min(1, cam.s);
  ctx.fillStyle = '#d9c393'; ctx.fillRect(sx(0), sy(0), MAP_W * cam.s, MAP_H * cam.s);
  ctx.restore();
  ctx.imageSmoothingEnabled = cam.s < 2.5;
  ctx.drawImage(baseCanvas, sx(0), sy(0), MAP_W * cam.s, MAP_H * cam.s);
  drawRoads();
  drawTerrainGlyphs();
  drawDevelopment();
  drawDecor(exporting);
  drawCities();
  drawLabels(exporting);
  drawWonders();
}
const INK = 'rgba(66,40,20,';
function visible(x, y, m) { return x > -m && y > -m && x < viewW() + m && y < viewH() + m; }
function drawTerrainGlyphs() {
  if (cam.s < 0.6) return;
  const s = clamp(5 * cam.s, 3.5, 12), a = clamp((cam.s - 0.6) / 0.3, 0, 1);
  ctx.lineWidth = Math.max(0.8, Math.min(1.6, cam.s * 0.65)); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pm = new Path2D(), ps = new Path2D(), ph = new Path2D(), pf = new Path2D(), pt = new Path2D(), pw = new Path2D(), pd = new Path2D(), px = new Path2D(), pp = new Path2D();
  for (const G of glyphs) {
    const x = sx(G.x), y = sy(G.y);
    if (!visible(x, y, 20)) continue;
    if (G.k >= wildKeep(prov(G.pid))) continue; // 開発で自然が減る
    if (devNear(G)) continue;
    const k = s * (0.8 + G.r * 0.45);
    switch (G.t) {
      case 'm': // 山：三角の峰と陰影
        pm.moveTo(x - k, y + k * 0.55); pm.lineTo(x - k * 0.1, y - k * 0.8); pm.lineTo(x + k * 0.35, y - k * 0.15); pm.lineTo(x + k * 0.55, y - k * 0.4); pm.lineTo(x + k * 1.1, y + k * 0.55);
        for (let j = 1; j <= 3; j++) { const t = j / 4; ps.moveTo(x - k * 0.1 + k * 0.5 * t, y - k * 0.8 + k * 1.1 * t); ps.lineTo(x - k * 0.1 + k * 0.5 * t + k * 0.12, y + k * 0.5); }
        break;
      case 'h': ph.moveTo(x - k, y + k * 0.3); ph.quadraticCurveTo(x - k * 0.5, y - k * 0.6, x, y + k * 0.3); ph.moveTo(x - k * 0.1, y + k * 0.3); ph.quadraticCurveTo(x + k * 0.45, y - k * 0.35, x + k, y + k * 0.3); break;
      case 'f': for (const [dx, dy] of [[-0.55, 0.1], [0.5, 0], [0, -0.35]]) { const cx = x + dx * k, cy = y + dy * k; pf.moveTo(cx + k * 0.38, cy - k * 0.25); pf.arc(cx, cy - k * 0.25, k * 0.38, 0, Math.PI * 2); pt.moveTo(cx, cy + k * 0.12); pt.lineTo(cx, cy + k * 0.5); } break;
      case 'w': for (let j = 0; j < 3; j++) { const yy = y + (j - 1) * k * 0.35, xx = x + (j % 2 ? k * 0.3 : 0); pw.moveTo(xx - k * 0.6, yy); pw.lineTo(xx + k * 0.6, yy); pw.moveTo(xx - k * 0.1, yy); pw.lineTo(xx - k * 0.25, yy - k * 0.35); pw.moveTo(xx + k * 0.1, yy); pw.lineTo(xx + k * 0.25, yy - k * 0.35); } break;
      case 'd': for (const [dx, dy] of [[-0.5, 0.2], [0.1, -0.2], [0.55, 0.3], [-0.1, 0.5], [0.3, 0.6]]) { pd.moveTo(x + dx * k + 0.9, y + dy * k); pd.arc(x + dx * k, y + dy * k, 0.9, 0, Math.PI * 2); } break;
      case 'x': px.moveTo(x + k * 0.6, y); for (let t = 0; t < 12; t++) { const an = t * 0.6, r = k * 0.6 * (1 - t / 13); px.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } break;
      case 'p': pp.moveTo(x - k * 0.5, y); pp.lineTo(x - k * 0.3, y - k * 0.35); pp.moveTo(x, y); pp.lineTo(x, y - k * 0.45); pp.moveTo(x + k * 0.5, y); pp.lineTo(x + k * 0.3, y - k * 0.35); break;
    }
  }
  ctx.fillStyle = `rgba(242,230,202,${0.75 * a})`; ctx.fill(pm);
  ctx.strokeStyle = INK + (0.7 * a) + ')'; ctx.stroke(pm); ctx.stroke(ph); ctx.stroke(pt); ctx.stroke(pw);
  ctx.strokeStyle = INK + (0.45 * a) + ')'; ctx.stroke(ps); ctx.stroke(pp);
  ctx.fillStyle = `rgba(90,110,60,${0.25 * a})`; ctx.fill(pf); ctx.strokeStyle = INK + (0.65 * a) + ')'; ctx.stroke(pf);
  ctx.fillStyle = INK + (0.55 * a) + ')'; ctx.fill(pd);
  ctx.strokeStyle = `rgba(92,40,110,${0.7 * a})`; ctx.stroke(px);
}
function drawCities() {
  if (cam.s < 0.55) return;
  const k = clamp(cam.s * 4.2, 3.2, 8);
  ctx.lineWidth = Math.max(1, k * 0.22); ctx.lineJoin = 'miter';
  for (const p of S.provinces) {
    if (p.sea || p.owner < 0) continue;
    const isCap = p.owner > 0 && nat(p.owner).capital === p.id;
    if (!isCap) continue;
    const x = sx(p.x), y = sy(p.y) + 14;
    if (!visible(x, y, 30)) continue;
    if (isCap) { // 小さな城
      ctx.beginPath();
      ctx.moveTo(x - k, y + k * 0.7); ctx.lineTo(x - k, y - k * 0.3); ctx.lineTo(x - k * 0.6, y - k * 0.3); ctx.lineTo(x - k * 0.6, y - k * 0.6); ctx.lineTo(x - k * 0.25, y - k * 0.6); ctx.lineTo(x - k * 0.25, y - k * 0.3);
      ctx.lineTo(x + k * 0.25, y - k * 0.3); ctx.lineTo(x + k * 0.25, y - k * 0.6); ctx.lineTo(x + k * 0.6, y - k * 0.6); ctx.lineTo(x + k * 0.6, y - k * 0.3); ctx.lineTo(x + k, y - k * 0.3); ctx.lineTo(x + k, y + k * 0.7); ctx.closePath();
      ctx.fillStyle = '#f1e3c0'; ctx.fill(); ctx.strokeStyle = 'rgba(52,30,14,.95)'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - k * 0.3); ctx.lineTo(x, y - k * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - k * 1.5); ctx.lineTo(x + k * 0.9, y - k * 1.25); ctx.lineTo(x, y - k * 1.0); ctx.closePath(); ctx.fillStyle = rgb(nat(p.owner).color); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + k * 0.35, k * 0.28, Math.PI, 0); ctx.lineTo(x + k * 0.28, y + k * 0.7); ctx.lineTo(x - k * 0.28, y + k * 0.7); ctx.closePath(); ctx.fillStyle = 'rgba(52,30,14,.9)'; ctx.fill();
    } else { // 町の印
      ctx.beginPath(); ctx.arc(x, y, k * 0.45, 0, Math.PI * 2); ctx.fillStyle = '#f1e3c0'; ctx.fill(); ctx.strokeStyle = 'rgba(52,30,14,.9)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, k * 0.15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(52,30,14,.9)'; ctx.fill();
    }
  }
}
// 飾り枠・羅針盤・表題・海の竜
function drawDecor(exporting) {
  const S0 = cam.s;
  // 目盛り付きの飾り枠
  const o1 = 5, o2 = 15, seg = 40;
  ctx.save();
  ctx.fillStyle = 'rgba(236,222,190,.95)';
  ctx.fillRect(sx(o1), sy(o1), (MAP_W - o1 * 2) * S0, (o2 - o1) * S0);
  ctx.fillRect(sx(o1), sy(MAP_H - o2), (MAP_W - o1 * 2) * S0, (o2 - o1) * S0);
  ctx.fillRect(sx(o1), sy(o1), (o2 - o1) * S0, (MAP_H - o1 * 2) * S0);
  ctx.fillRect(sx(MAP_W - o2), sy(o1), (o2 - o1) * S0, (MAP_H - o1 * 2) * S0);
  ctx.fillStyle = 'rgba(52,30,14,.88)';
  for (let x = o2, j = 0; x < MAP_W - o2; x += seg, j++) if (j % 2 === 0) { const w = Math.min(seg, MAP_W - o2 - x); ctx.fillRect(sx(x), sy(o1 + 3), w * S0, 4 * S0); ctx.fillRect(sx(x), sy(MAP_H - o2 + 3), w * S0, 4 * S0); }
  for (let y = o2, j = 0; y < MAP_H - o2; y += seg, j++) if (j % 2 === 0) { const h = Math.min(seg, MAP_H - o2 - y); ctx.fillRect(sx(o1 + 3), sy(y), 4 * S0, h * S0); ctx.fillRect(sx(MAP_W - o2 + 3), sy(y), 4 * S0, h * S0); }
  ctx.strokeStyle = 'rgba(52,30,14,.9)';
  ctx.lineWidth = Math.max(1, 2.2 * S0); ctx.strokeRect(sx(o1), sy(o1), (MAP_W - o1 * 2) * S0, (MAP_H - o1 * 2) * S0);
  ctx.lineWidth = Math.max(0.7, 1 * S0); ctx.strokeRect(sx(o2), sy(o2), (MAP_W - o2 * 2) * S0, (MAP_H - o2 * 2) * S0);
  ctx.strokeRect(sx(o1 + 2.5), sy(o1 + 2.5), (MAP_W - o1 * 2 - 5) * S0, (MAP_H - o1 * 2 - 5) * S0);
  ctx.restore();
  drawCompass(mapDeco.compass.x, mapDeco.compass.y, 72);
  drawCartouche(mapDeco.cart);
  if (mapDeco.serp) drawSerpent(mapDeco.serp.x, mapDeco.serp.y);
}
function drawCompass(wx, wy, R) {
  const x = sx(wx), y = sy(wy), r = R * cam.s;
  if (!visible(x, y, r + 20)) return;
  ctx.save(); ctx.translate(x, y);
  ctx.lineWidth = Math.max(0.6, cam.s * 0.9); ctx.strokeStyle = 'rgba(52,30,14,.85)';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fillStyle = 'rgba(240,228,200,.75)'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 32; i++) { const an = i / 32 * Math.PI * 2, a0 = r * 0.74, a1 = r * (i % 4 ? 0.78 : 0.82); ctx.beginPath(); ctx.moveTo(Math.cos(an) * a0, Math.sin(an) * a0); ctx.lineTo(Math.cos(an) * a1, Math.sin(an) * a1); ctx.stroke(); }
  const pt = (len, wid, an, darkLeft, col) => {
    const c = Math.cos(an), s = Math.sin(an), pc = Math.cos(an + Math.PI / 2), ps = Math.sin(an + Math.PI / 2);
    for (const side of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c * len, s * len); ctx.lineTo(pc * wid * side, ps * wid * side); ctx.closePath();
      ctx.fillStyle = (side === 1) === darkLeft ? col : '#f2e6c8'; ctx.fill(); ctx.stroke();
    }
  };
  for (let i = 0; i < 8; i++) pt(r * 0.5, r * 0.07, (i + 0.5) / 8 * Math.PI * 2 - Math.PI / 2, true, 'rgba(120,40,24,.85)');
  for (let i = 0; i < 4; i++) pt(r * 0.68, r * 0.11, (i + 0.5) / 4 * Math.PI * 2 - Math.PI / 2, true, 'rgba(60,36,18,.9)');
  for (let i = 0; i < 4; i++) pt(r, r * 0.14, i / 4 * Math.PI * 2 - Math.PI / 2, true, i === 0 ? 'rgba(150,30,20,.95)' : 'rgba(52,30,14,.95)');
  ctx.beginPath(); ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2); ctx.fillStyle = '#b8892f'; ctx.fill(); ctx.stroke();
  ctx.font = `${Math.max(9, r * 0.2)}px "Zen Antique", "Shippori Mincho", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(52,30,14,.95)';
  ctx.fillText('北', 0, -r * 1.14); ctx.fillText('南', 0, r * 1.14); ctx.fillText('東', r * 1.14, 0); ctx.fillText('西', -r * 1.14, 0);
  ctx.restore();
}
function drawCartouche(c) {
  const x = sx(c.x), y = sy(c.y), w = c.w * cam.s, h = c.h * cam.s, u = cam.s;
  if (!visible(x + w / 2, y + h / 2, Math.max(w, h))) return;
  ctx.save();
  ctx.shadowColor = 'rgba(40,20,8,.35)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 2 * u;
  const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, 'rgba(247,238,214,.97)'); gr.addColorStop(1, 'rgba(232,216,180,.97)');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.restore(); ctx.save();
  ctx.strokeStyle = 'rgba(52,30,14,.92)'; ctx.lineWidth = Math.max(1, 2 * u); ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = Math.max(0.6, 0.8 * u); ctx.strokeRect(x + 6 * u, y + 6 * u, w - 12 * u, h - 12 * u);
  // 四隅の渦巻き
  for (const [cx, cy, sxn, syn] of [[x + 6 * u, y + 6 * u, 1, 1], [x + w - 6 * u, y + 6 * u, -1, 1], [x + 6 * u, y + h - 6 * u, 1, -1], [x + w - 6 * u, y + h - 6 * u, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + 22 * u * syn); ctx.quadraticCurveTo(cx, cy, cx + 22 * u * sxn, cy);
    ctx.moveTo(cx + 8 * u * sxn, cy + 8 * u * syn); ctx.arc(cx + 12 * u * sxn, cy + 12 * u * syn, 4 * u, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(52,30,14,.95)';
  const year = START_YEAR + Math.floor(S.day / 360);
  ctx.font = `${30 * u}px "Zen Antique", "Shippori Mincho", serif`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${6 * u}px`;
  ctx.fillStyle = 'rgba(140,30,20,.95)'; ctx.fillText('異界大陸全図', x + w / 2 + 3 * u, y + 36 * u);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(52,30,14,.95)';
  ctx.font = `${13 * u}px "Shippori Mincho", serif`;
  ctx.fillText(`王国暦 ${year}年${S.started ? `・${ERAS[eraOf()]}` : ''}`, x + w / 2, y + 62 * u);
  if (S.started && S.player >= 0) { ctx.font = `${10.5 * u}px "Shippori Mincho", serif`; ctx.fillText(`転生君主 ${nat(S.player).ruler.name} 治世 ${Math.floor(S.day / 360) + 1}年目 編纂`, x + w / 2, y + 80 * u); }
  ctx.beginPath(); ctx.moveTo(x + 40 * u, y + 92 * u); ctx.lineTo(x + w - 40 * u, y + 92 * u); ctx.stroke();
  // 凡例：主要国
  const list = S.nations.filter(n => n.alive && !n.isMonster).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d).slice(0, 8);
  ctx.textAlign = 'left'; ctx.font = `${10.5 * u}px "Shippori Mincho", serif`;
  list.forEach(({ n, d }, i) => {
    const col = i % 2, row = Math.floor(i / 2), lx = x + (18 + col * 152) * u, ly = y + (108 + row * 28) * u;
    ctx.fillStyle = rgb(n.color, 0.75); ctx.fillRect(lx, ly - 6 * u, 14 * u, 12 * u); ctx.strokeRect(lx, ly - 6 * u, 14 * u, 12 * u);
    ctx.fillStyle = 'rgba(52,30,14,.95)'; ctx.fillText(n.name.length > 9 ? n.short : n.name, lx + 20 * u, ly);
  });
  ctx.restore();
}
function drawSerpent(wx, wy) {
  const x = sx(wx), y = sy(wy), u = cam.s;
  if (!visible(x, y, 120 * u)) return;
  ctx.save(); ctx.strokeStyle = 'rgba(52,40,30,.7)'; ctx.lineWidth = Math.max(0.8, 1.4 * u); ctx.fillStyle = 'rgba(110,130,110,.35)';
  for (let i = 0; i < 3; i++) { // 波間からのぞく胴
    const cx = x - 40 * u + i * 30 * u;
    ctx.beginPath(); ctx.moveTo(cx - 11 * u, y); ctx.bezierCurveTo(cx - 11 * u, y - 18 * u, cx + 11 * u, y - 18 * u, cx + 11 * u, y); ctx.fill(); ctx.stroke();
    for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(cx + j * 5 * u, y - 9 * u, 2 * u, Math.PI, 0); ctx.stroke(); }
  }
  // 頭
  const hx = x + 50 * u;
  ctx.beginPath(); ctx.moveTo(hx - 11 * u, y); ctx.quadraticCurveTo(hx - 10 * u, y - 26 * u, hx + 4 * u, y - 28 * u); ctx.quadraticCurveTo(hx + 18 * u, y - 26 * u, hx + 20 * u, y - 18 * u); ctx.lineTo(hx + 6 * u, y - 16 * u); ctx.quadraticCurveTo(hx + 2 * u, y - 8 * u, hx + 4 * u, y); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(hx + 6 * u, y - 23 * u, 1.6 * u, 0, Math.PI * 2); ctx.fillStyle = 'rgba(52,30,14,.9)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 20 * u, y - 18 * u); ctx.lineTo(hx + 28 * u, y - 15 * u); ctx.moveTo(hx + 20 * u, y - 18 * u); ctx.lineTo(hx + 27 * u, y - 22 * u); ctx.stroke();
  // 波
  for (let i = 0; i < 5; i++) { const wx2 = x - 62 * u + i * 30 * u; ctx.beginPath(); ctx.moveTo(wx2, y + 3 * u); ctx.quadraticCurveTo(wx2 + 7 * u, y - 3 * u, wx2 + 14 * u, y + 3 * u); ctx.stroke(); }
  ctx.font = `italic ${12 * u}px "Zen Antique", "Shippori Mincho", serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(52,30,14,.8)';
  ctx.fillText('此処に竜棲む', x + 4 * u, y + 20 * u);
  ctx.restore();
}
function drawLabels(exporting) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const natAlpha = exporting ? 1 : clamp((1.9 - cam.s) / 0.7, 0, 1);
  if (natAlpha > 0 && mapMode === 'political') {
    for (const L of nationLabels) {
      const fs = L.fs * cam.s;
      if (fs < 8) continue;
      if (!visible(sx(L.x), sy(L.y), fs * 12)) continue;
      ctx.font = `${fs}px "Zen Antique", "Shippori Mincho", serif`;
      ctx.lineWidth = Math.max(1.5, fs * 0.12); ctx.strokeStyle = `rgba(240,228,198,${0.5 * natAlpha})`;
      ctx.fillStyle = `rgba(70,36,16,${0.8 * natAlpha})`;
      for (const G of L.glyphs) {
        ctx.save(); ctx.translate(sx(G.x), sy(G.y)); ctx.rotate(G.rot);
        ctx.strokeText(G.ch, 0, 0); ctx.fillText(G.ch, 0, 0);
        ctx.restore();
      }
    }
  }
  if (cam.s >= 1.4 || exporting) {
    const a = exporting ? 1 : clamp((cam.s - 1.4) / 0.4, 0, 1);
    ctx.font = `600 ${clamp(10 * Math.sqrt(cam.s / 1.5), 9, 15)}px "Shippori Mincho", serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(242,232,206,${0.8 * a})`; ctx.fillStyle = `rgba(50,30,14,${0.92 * a})`;
    for (const p of S.provinces) {
      if (p.sea) continue;
      const x = sx(p.x), y = sy(p.y) - 2;
      if (!visible(x, y, 50)) continue;
      ctx.strokeText(p.name, x, y); ctx.fillText(p.name, x, y);
    }
  }
  if (cam.s >= 1.1 || exporting) {
    ctx.font = `italic ${clamp(11 * cam.s / 1.2, 10, 14)}px "Zen Antique", "Shippori Mincho", serif`; ctx.fillStyle = 'rgba(36,58,68,.62)';
    for (const p of S.provinces) if (p.sea && p.name !== '外洋') { const x = sx(p.x), y = sy(p.y) + 16; if (visible(x, y, 60)) ctx.fillText(p.name, x, y); }
  }
  if (mapMode === 'guild') {
    ctx.lineWidth = 2.5;
    for (const g of S.guilds) for (const o of S.guilds) {
      if (o.id <= g.id || o.owner !== g.owner || !near2(g.pid, o.pid)) continue;
      const a = prov(g.pid), b = prov(o.pid);
      ctx.strokeStyle = rgb(nat(g.owner).color, 0.85); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.font = '700 12px system-ui, sans-serif';
    for (const g of S.guilds) {
      const p = prov(g.pid), x = sx(p.x), y = sy(p.y);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = rgb(nat(g.owner).color); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = g.owner === S.player ? '#a5281b' : 'rgba(52,30,14,.85)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText('⚖', x, y + 1);
    }
  }
}
// 現在の勢力図を古地図として書き出す
let exportView = null;
function exportMap() {
  const sc = 1.6, W = Math.round(MAP_W * sc), H = Math.round(MAP_H * sc);
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const saved = { ctx, cam: Object.assign({}, cam), mode: mapMode, sel: S.sel, hl: highlightNation };
  mapMode = 'political'; S.sel = null; highlightNation = -1; renderBase();
  ctx = c2.getContext('2d'); exportView = { w: W, h: H }; cam.x = 0; cam.y = 0; cam.s = sc;
  try { drawMapSheet(true); }
  finally { ctx = saved.ctx; exportView = null; Object.assign(cam, saved.cam); mapMode = saved.mode; S.sel = saved.sel; highlightNation = saved.hl; mapDirty = true; }
  const name = `isekai-map-${START_YEAR + Math.floor(S.day / 360)}.png`; // 日本語名は環境によって無視されるため英数字
  c2.toBlob(blob => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.download = name; a.href = url; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
  return c2;
}

function markerAt(f, x, y, k) { const sp = iconSprite(f, k, 0); ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h); }
function inkBar(x, y, w, t, col) {
  ctx.fillStyle = 'rgba(241,230,204,.9)'; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2 + 0.5, y + 0.5, (w - 1) * clamp(t, 0, 1), 3);
  ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(52,32,14,.85)'; ctx.strokeRect(x - w / 2, y, w, 4);
}
function inkText(t, x, y, size, col) {
  ctx.font = `700 ${size}px "Shippori Mincho", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(241,230,204,.92)'; ctx.strokeText(t, x, y);
  ctx.fillStyle = col || 'rgba(46,28,12,.95)'; ctx.fillText(t, x, y);
}
function washColor(c, a) { return `rgba(${Math.round(c[0] * 0.8 + 236 * 0.2)},${Math.round(c[1] * 0.8 + 222 * 0.2)},${Math.round(c[2] * 0.8 + 188 * 0.2)},${a == null ? 1 : a})`; }
function drawWonders() {
  const k = Math.round(clamp(7 * Math.sqrt(cam.s), 6, 13) * 2) / 2;
  for (const w of S.wonders) { const p = prov(w.pid), x = sx(p.x) - 22, y = sy(p.y) + 2; if (visible(x, y, 40)) markerAt('w_' + w.id, x, y, k); }
  for (const n of S.nations) {
    if (!n.alive || !n.project) continue;
    const p = prov(n.project.pid), x = sx(p.x) - 22, y = sy(p.y) + 2;
    if (!visible(x, y, 40)) continue;
    markerAt('scaffold', x, y, Math.round(k * 0.8 * 2) / 2);
    inkBar(x, y + k * 0.9, 22, n.project.prog / n.project.need, washColor(n.color));
  }
}
function drawSiegesAndColonies() {
  for (const p of S.provinces) {
    const x = sx(p.x), y = sy(p.y);
    if (!visible(x, y, 40)) continue;
    if (p.siege && p.siege.need) {
      const t = clamp(p.siege.prog / p.siege.need, 0, 1), cy = y + 26;
      ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(241,230,204,.9)'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(52,32,14,.85)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, cy, 10, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = washColor(nat(p.siege.by).color); ctx.stroke();
      markerAt('siegetower', x, cy - 1, 6);
    }
    if (p.dungeon && !p.dungeon.cleared && cam.s >= 0.9) markerAt('cave', x + 16, y + 8, 6.5);
    if (p.colonizing || p.converting) {
      const job = p.colonizing || p.converting;
      markerAt(p.colonizing ? 'tent' : 'church', x, y + 2, 7);
      inkBar(x, y + 12, 26, (S.day - job.start) / (job.until - job.start), washColor(nat(job.by).color));
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
    const col = a.retreat ? 'rgba(120,60,40,.75)' : a === selA ? 'rgba(160,30,20,.9)' : 'rgba(120,30,20,.6)';
    ctx.setLineDash([5, 4]); ctx.lineWidth = a === selA ? 2.6 : 1.8; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]);
    const n = a.path.length, last = prov(a.path[n - 1]), prev = n > 1 ? prov(a.path[n - 2]) : { x: x0, y: y0 };
    const ang = Math.atan2(sy(last.y) - sy(prev.y), sx(last.x) - sx(prev.x)), lx = sx(last.x), ly = sy(last.y);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - Math.cos(ang - 0.45) * 10, ly - Math.sin(ang - 0.45) * 10); ctx.lineTo(lx - Math.cos(ang + 0.45) * 10, ly - Math.sin(ang + 0.45) * 10); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
}
// 軍の駒：国旗を掲げた旗竿
function drawArmyToken(a, x, y, sel) {
  const rogue = isRogue(a.owner), c = nat(a.owner).color, ink = 'rgba(46,28,12,.95)';
  const sea = prov(a.prov).sea;
  ctx.beginPath(); ctx.ellipse(x, y, sel ? 11 : 8, sel ? 4.5 : 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(52,32,14,.25)'; ctx.fill();
  if (sel) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(165,40,27,.95)'; ctx.stroke(); }
  if (sea) { ctx.beginPath(); ctx.moveTo(x - 10, y - 2); ctx.quadraticCurveTo(x, y + 6, x + 10, y - 2); ctx.closePath(); ctx.fillStyle = 'rgba(241,230,204,.95)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 6, y - 28); ctx.lineWidth = 1.6; ctx.strokeStyle = ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 6, y - 29, 1.6, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  if (a.owner === MONSTER) { ctx.beginPath(); ctx.moveTo(x - 8.5, y - 30); ctx.quadraticCurveTo(x - 11, y - 34, x - 9, y - 37); ctx.moveTo(x - 3.5, y - 30); ctx.quadraticCurveTo(x - 1, y - 34, x - 3, y - 37); ctx.lineWidth = 1.3; ctx.stroke(); }
  const fw = 19, fh = 12, fx = x - 5.3, fy = y - 27.5, droop = a.retreat ? 4 : 0;
  ctx.beginPath(); ctx.moveTo(fx, fy);
  if (a.owner === REBEL) { ctx.lineTo(fx + fw, fy + 1); ctx.lineTo(fx + fw - 3, fy + 4); ctx.lineTo(fx + fw, fy + 7); ctx.lineTo(fx + fw - 4, fy + fh); }
  else { ctx.quadraticCurveTo(fx + fw * 0.5, fy - 2 + droop, fx + fw, fy + droop); ctx.lineTo(fx + fw - 5, fy + fh / 2 + droop); ctx.lineTo(fx + fw, fy + fh + droop); ctx.quadraticCurveTo(fx + fw * 0.5, fy + fh + 2 + droop, fx, fy + fh); }
  ctx.closePath();
  ctx.fillStyle = rogue ? (a.owner === MONSTER ? 'rgba(60,30,70,.95)' : 'rgba(120,40,30,.95)') : washColor(c, 0.97); ctx.fill();
  ctx.lineWidth = 1.1; ctx.strokeStyle = ink; if (a.retreat) ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
  const ex = fx + 7.5, ey = fy + fh / 2 + droop * 0.6;
  if (rogue) { ctx.font = '700 8.5px "Shippori Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(246,232,214,.95)'; ctx.fillText(a.owner === MONSTER ? '魔' : '叛', ex, ey + 0.5); }
  else if (a.hero) { ctx.beginPath(); ctx.moveTo(ex - 4, ey + 2.5); ctx.lineTo(ex - 4, ey - 2); ctx.lineTo(ex - 2, ey); ctx.lineTo(ex, ey - 3); ctx.lineTo(ex + 2, ey); ctx.lineTo(ex + 4, ey - 2); ctx.lineTo(ex + 4, ey + 2.5); ctx.closePath(); ctx.fillStyle = 'rgba(250,232,170,.95)'; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = ink; ctx.stroke(); }
  else if (a.gen != null) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.6 : 3.8, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(ex + Math.cos(an) * r, ey + Math.sin(an) * r); } ctx.closePath(); ctx.fillStyle = 'rgba(250,240,210,.95)'; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = ink; ctx.stroke(); }
  if (a.delve) markerAt('cave', x + 14, y - 6, 5);
  inkText(fmtMen(armyMen(a)), x + 1, y + 9, 11, a.retreat ? 'rgba(140,50,30,.95)' : a.owner === S.player ? 'rgba(120,24,14,.98)' : undefined);
  if (!rogue) { const mm = clamp(a.morale / maxMorale(a.owner), 0, 1); inkBar(x + 1, y + 16, 22, mm, mm > 0.5 ? 'rgba(80,110,50,.9)' : mm > 0.25 ? 'rgba(170,130,40,.9)' : 'rgba(160,50,30,.9)'); }
}
function drawArmies() {
  badgeRects = [];
  const groups = new Map();
  for (const a of S.armies) { const k = a.path.length && a.prog > 0 ? 'm' + a.id : a.prov; let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(a); }
  const selId = S.sel && S.sel.type === 'army' ? S.sel.id : -1;
  for (const list of groups.values()) {
    list.sort((a, b) => (a.owner === S.player ? -1 : 0) - (b.owner === S.player ? -1 : 0));
    const n = list.length;
    list.forEach((a, idx) => {
      const [wx, wy] = armyPos(a);
      const x = sx(wx) + (idx - (n - 1) / 2) * 26, y = sy(wy) - 8;
      if (!visible(x, y, 40)) return;
      drawArmyToken(a, x, y, a.id === selId);
      badgeRects.push({ x: x - 13, y: y - 32, w: 30, h: 52, id: a.id });
    });
  }
}
function fleetPos(f) {
  const p = prov(f.prov);
  if (f.path.length && f.prog > 0) { const q = prov(f.path[0]); return [p.x + (q.x - p.x) * f.prog, p.y + (q.y - p.y) * f.prog]; }
  return [p.x, p.y];
}
// 艦隊の駒：インクで描いた帆船
function drawShip(x, y, c, sel, battle) {
  const ink = 'rgba(46,28,12,.95)';
  if (sel) { ctx.beginPath(); ctx.ellipse(x, y + 4, 14, 4.5, 0, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(165,40,27,.95)'; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 13, y - 2); ctx.lineTo(x + 13, y - 2); ctx.quadraticCurveTo(x + 9, y + 5, x + 6, y + 5); ctx.lineTo(x - 8, y + 5); ctx.quadraticCurveTo(x - 11, y + 4, x - 13, y - 2); ctx.closePath();
  ctx.fillStyle = 'rgba(241,230,204,.95)'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 9, y + 1.5); ctx.lineTo(x + 9, y + 1.5); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 26); ctx.lineWidth = 1.3; ctx.stroke();
  for (const [yy, w2] of [[-23, 8], [-14, 10]]) {
    ctx.beginPath(); ctx.moveTo(x - w2, yy); ctx.quadraticCurveTo(x, yy - 2, x + w2, yy); ctx.quadraticCurveTo(x + w2 + 1.5, yy + 4, x + w2, yy + 7.5); ctx.quadraticCurveTo(x, yy + 5.5, x - w2, yy + 7.5); ctx.quadraticCurveTo(x - w2 + 1.5, yy + 4, x - w2, yy); ctx.closePath();
    ctx.fillStyle = washColor(c, 0.97); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 8, y - 24.5); ctx.lineTo(x, y - 23); ctx.fillStyle = washColor(c); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 16, y + 7); ctx.quadraticCurveTo(x - 12, y + 4, x - 8, y + 7); ctx.moveTo(x + 8, y + 7); ctx.quadraticCurveTo(x + 12, y + 4, x + 16, y + 7); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(40,60,70,.7)'; ctx.stroke();
  if (battle) markerAt('swords', x + 14, y - 22, 5);
}
function drawFleets() {
  const selId = S.sel && S.sel.type === 'fleet' ? S.sel.id : -1;
  const count = new Map();
  for (const f of S.fleets) {
    const [wx, wy] = fleetPos(f);
    const k = f.prov, idx = count.get(k) || 0; count.set(k, idx + 1);
    const x = sx(wx) + idx * 30, y = sy(wy) + 26;
    if ((f.owner === S.player || f.id === selId) && f.path.length) {
      ctx.beginPath(); ctx.moveTo(x, y); for (const q of f.path) ctx.lineTo(sx(prov(q).x), sy(prov(q).y) + 26);
      ctx.setLineDash([3, 4]); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(40,70,90,.75)'; ctx.stroke(); ctx.setLineDash([]);
    }
    if (!visible(x, y, 40)) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3); drawShip(0, 0, nat(f.owner).color, f.id === selId, f.inBattle); ctx.restore();
    inkText(`戦${f.war}・輸${f.trans}`, x, y + 17, 10, f.owner === S.player ? 'rgba(120,24,14,.98)' : undefined);
    inkBar(x, y + 23, 24, f.str, 'rgba(60,90,110,.9)');
    badgeRects.push({ x: x - 16, y: y - 30, w: 32, h: 56, id: f.id, fleet: true });
  }
}
function drawBattles() {
  const t = performance.now() / 300;
  for (const k in S.battles) {
    const p = prov(+k), x = sx(p.x), y = sy(p.y) - 40;
    if (!visible(x, y, 40)) continue;
    ctx.beginPath(); ctx.arc(x, y, 12 + Math.sin(t) * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(241,230,204,.85)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(165,40,27,${0.6 + Math.sin(t) * 0.3})`; ctx.stroke();
    markerAt('swords', x, y + 1, 8);
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

// ---------- 演出（ポップアップ文字・波紋・画面振動） ----------
const fxList = []; let shakeUntil = 0, shakeAmp = 0, flashUntil = 0, flashColor = '255,40,30';
const FX_COLORS = { win: '255,214,90', siege: '255,170,60', lose: '240,90,80', lost: '240,90,80', war: '255,60,40', levelup: '255,230,140', summon: '200,160,255' };
function addFx(kind, pid, text) {
  const now = performance.now(), p = pid != null ? prov(pid) : null;
  fxList.push({ kind, x: p ? p.x : null, y: p ? p.y : null, text, t0: now });
  const sh = { war: [450, 7], siege: [220, 3.5], win: [200, 3], lose: [260, 4], lost: [260, 4] }[kind];
  if (sh) { shakeUntil = now + sh[0]; shakeAmp = sh[1]; }
  if (kind === 'war' || kind === 'lost') { flashUntil = now + 500; flashColor = '255,40,30'; }
  if (kind === 'levelup') { flashUntil = now + 350; flashColor = '255,225,140'; }
  if (fxList.length > 30) fxList.shift();
}
function drawFx(now) {
  const w = viewW(), h = viewH();
  if (now < flashUntil) {
    const a = (flashUntil - now) / 500;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, `rgba(${flashColor},0)`); g.addColorStop(1, `rgba(${flashColor},${0.45 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i], t = (now - f.t0) / 1000, dur = f.x == null ? 1.8 : 1.6;
    if (t > dur) { fxList.splice(i, 1); continue; }
    const col = FX_COLORS[f.kind] || '255,255,255';
    const alpha = t < 0.12 ? t / 0.12 : 1 - Math.max(0, (t - dur + 0.6) / 0.6);
    const pop = t < 0.14 ? 1.8 - t / 0.14 * 0.8 : 1;
    let x, y;
    if (f.x != null) {
      x = sx(f.x); y = sy(f.y);
      for (let k = 0; k < 2; k++) {
        const tt = t - k * 0.18; if (tt < 0) continue;
        const r = 8 + tt * 70, a = Math.max(0, 1 - tt / 1.0);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 5 * a + 1; ctx.stroke();
      }
      if (t < 0.35 && (f.kind === 'win' || f.kind === 'siege')) {
        ctx.save(); ctx.translate(x, y); ctx.strokeStyle = `rgba(${col},${1 - t / 0.35})`; ctx.lineWidth = 3;
        for (let k = 0; k < 10; k++) { const an = k / 10 * Math.PI * 2, r0 = 14 + t * 60, r1 = r0 + 16; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
        ctx.restore();
      }
      y = y - 34 - t * 16;
    } else { x = w / 2; y = h * 0.3 - t * 10; }
    if (!f.text) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, alpha);
    const size = f.x == null ? 40 : 22;
    ctx.font = `800 ${size}px "Shippori Mincho", serif`;
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(20,10,4,.9)'; ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = `rgb(${col})`; ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

// ---------- 発展の書き込み（集落・畑・鉱山・街道・鉄道） ----------
function wildKeep(p) {
  const n = p._wild || 0, d = p.dev;
  if (p.terrain === 'forest' || p.terrain === 'hills' || p.terrain === 'marsh') return Math.max(1, n - Math.max(0, Math.floor((d - 5) / 3)));
  if (p.terrain === 'plains') return d >= 9 ? 0 : n;
  return n;
}
// 州ごとの発展物の一覧（区画の順に割り当て）
function devFeatures(p) {
  if (p.owner < 0 || !p._slots) return [];
  const d = p.dev, out = [];
  if (d >= 20) out.push('city');
  if (d >= 10) out.push('town');
  if (d >= 6) out.push('village');
  if (d >= 15) out.push('village');
  if (d >= 25) out.push('town');
  const t = p.terrain;
  if (t === 'mountains' && d >= 9) out.push('mine'); if (t === 'mountains' && d >= 17) out.push('mine');
  if (t === 'hills' && d >= 12) out.push('mine');
  if (t === 'desert' && d >= 9) out.push('oasis');
  if (t === 'marsh' && d >= 9) out.push('polder');
  if (t === 'plains' || t === 'hills' || t === 'forest' || t === 'marsh') { const f = clamp(Math.floor((d - 5) / 3), 0, 4); for (let i = 0; i < f; i++) out.push('field'); }
  return out.slice(0, p._slots.length);
}
function devNear(G) {
  const p = prov(G.pid), n = (p._feats || []).length;
  for (let i = 0; i < n; i++) { const sl = p._slots[i]; if (Math.abs(sl.x - G.x) < 9 && Math.abs(sl.y - G.y) < 9) return true; }
  return false;
}
function settlePoint(p) { const f = p._feats || devFeatures(p); const i = f.findIndex(x => x === 'city' || x === 'town' || x === 'village'); return i >= 0 ? p._slots[i] : { x: p.x, y: p.y }; }
let roadCache = null;
function computeRoads() {
  const roads = [], rails = [];
  for (const p of S.provinces) {
    if (p.sea || p.owner < 0) continue;
    for (const qid of p.nb) {
      if (qid < p.id) continue;
      const q = prov(qid); if (q.owner < 0) continue;
      const lo = Math.min(p.dev, q.dev), sum = p.dev + q.dev;
      if (lo < 6) continue;
      const tier = sum >= 36 && lo >= 14 ? 3 : sum >= 24 ? 2 : 1;
      const a = settlePoint(p), b = settlePoint(q);
      const h = ((p.id * 73856093) ^ (q.id * 19349663)) >>> 0, off = ((h % 1000) / 1000 - 0.5) * 0.35;
      const mx = (a.x + b.x) / 2 - (b.y - a.y) * off, my = (a.y + b.y) / 2 + (b.x - a.x) * off;
      roads.push({ a, b, mx, my, tier });
      if (p.owner === q.owner && lo >= 16 && nat(p.owner).inventions && nat(p.owner).inventions.includes('railway')) rails.push({ a, b });
    }
  }
  roadCache = { roads, rails, day: S.day };
}
function drawRoads() {
  if (cam.s < 0.55) return;
  if (!roadCache) computeRoads();
  const a = clamp((cam.s - 0.55) / 0.3, 0, 1);
  ctx.lineCap = 'round';
  const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  for (const R of roadCache.roads) {
    const ax = sx(R.a.x), ay = sy(R.a.y), bx = sx(R.b.x), by = sy(R.b.y);
    if (!visible((ax + bx) / 2, (ay + by) / 2, Math.abs(ax - bx) + Math.abs(ay - by) + 30)) continue;
    const P = paths[R.tier]; P.moveTo(ax, ay); P.quadraticCurveTo(sx(R.mx), sy(R.my), bx, by);
  }
  // 小道：点線 / 街道：細い実線 / 大街道：細い二重線（古地図の道の描き方）
  ctx.setLineDash([1.2, 3]); ctx.lineWidth = Math.max(0.7, cam.s * 0.6); ctx.strokeStyle = `rgba(66,42,20,${0.55 * a})`; ctx.stroke(paths[1]); ctx.setLineDash([]);
  ctx.lineWidth = Math.max(0.7, cam.s * 0.65); ctx.strokeStyle = `rgba(66,42,20,${0.65 * a})`; ctx.stroke(paths[2]);
  ctx.lineWidth = Math.max(2, cam.s * 2.1); ctx.strokeStyle = `rgba(66,42,20,${0.75 * a})`; ctx.stroke(paths[3]);
  ctx.lineWidth = Math.max(0.9, cam.s * 1.05); ctx.strokeStyle = `rgba(238,226,196,${0.95 * a})`; ctx.stroke(paths[3]);
  // 鉄道：線路と枕木
  if (roadCache.rails.length) {
    const rail = new Path2D(), ties = new Path2D(), tl = Math.max(2, cam.s * 2.2);
    for (const R of roadCache.rails) {
      const ax = sx(R.a.x), ay = sy(R.a.y), bx = sx(R.b.x), by = sy(R.b.y);
      if (!visible((ax + bx) / 2, (ay + by) / 2, Math.abs(ax - bx) + Math.abs(ay - by) + 30)) continue;
      rail.moveTo(ax, ay); rail.lineTo(bx, by);
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, step = Math.max(5, cam.s * 5);
      for (let t = step / 2; t < len; t += step) { const cx = ax + ux * t, cy = ay + uy * t; ties.moveTo(cx - uy * tl, cy + ux * tl); ties.lineTo(cx + uy * tl, cy - ux * tl); }
    }
    ctx.lineWidth = Math.max(1, cam.s * 0.9); ctx.strokeStyle = `rgba(40,26,14,${0.85 * a})`; ctx.stroke(rail); ctx.lineWidth = Math.max(0.6, cam.s * 0.6); ctx.stroke(ties);
  }
}
function drawIcon(f, x, y, k, r) {
  const sl = { r };
  const a = 1;
  const INKC = `rgba(52,32,14,${0.88 * a})`, HATCH = `rgba(52,32,14,${0.5 * a})`, PAPERC = `rgba(241,230,204,${0.92 * a})`;
  const lw = Math.max(0.7, Math.min(1.3, k * 0.1));
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  // ---- 部品（インク線＋紙色の塗り＋斜線の陰影） ----
  const stroke = (w) => { ctx.lineWidth = w || lw; ctx.strokeStyle = INKC; ctx.stroke(); };
  const fillP = () => { ctx.fillStyle = PAPERC; ctx.fill(); };
  const hatchPoly = (pts, n) => { // 多角形の内側に斜線
    ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.clip();
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), st = Math.max(1.4, (x1 - x0) / n);
    ctx.beginPath(); for (let t = x0 - (y1 - y0); t < x1; t += st) { ctx.moveTo(t, y1); ctx.lineTo(t + (y1 - y0), y0); }
    ctx.lineWidth = lw * 0.6; ctx.strokeStyle = HATCH; ctx.stroke(); ctx.restore();
  };
  const house = (x, y, w, h) => { // 横から見た家（屋根の片側に陰影）
    const rh = h * 0.75;
    ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h); fillP(); stroke();
    const roof = [[x - w / 2 - w * 0.08, y - h], [x, y - h - rh], [x + w / 2 + w * 0.08, y - h]];
    ctx.beginPath(); ctx.moveTo(...roof[0]); ctx.lineTo(...roof[1]); ctx.lineTo(...roof[2]); ctx.closePath(); fillP(); stroke();
    hatchPoly([roof[1], roof[2], [x, y - h]], 4);
    ctx.beginPath(); ctx.rect(x - w * 0.12, y - h * 0.45, w * 0.24, h * 0.45); ctx.fillStyle = INKC; ctx.fill();
  };
  const spire = (x, y, w, h) => { // 教会の尖塔
    const sh = h * 0.9;
    ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h); fillP(); stroke();
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x, y - h - sh); ctx.lineTo(x + w / 2, y - h); ctx.closePath(); fillP(); stroke();
    hatchPoly([[x, y - h - sh], [x + w / 2, y - h], [x, y - h]], 3);
    ctx.beginPath(); ctx.moveTo(x, y - h - sh); ctx.lineTo(x, y - h - sh - w * 0.7); ctx.moveTo(x - w * 0.28, y - h - sh - w * 0.45); ctx.lineTo(x + w * 0.28, y - h - sh - w * 0.45); stroke(lw * 0.8);
    ctx.beginPath(); ctx.arc(x, y - h * 0.62, w * 0.18, 0, Math.PI * 2); stroke(lw * 0.7);
  };
  const tower = (x, y, w, h) => { // 鋸壁の塔
    ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h); fillP(); stroke();
    hatchPoly([[x + w * 0.1, y - h], [x + w / 2, y - h], [x + w / 2, y], [x + w * 0.1, y]], 3);
    const c = w / 5; ctx.beginPath();
    for (let i = 0; i < 3; i++) ctx.rect(x - w / 2 + i * 2 * c, y - h - c, c, c);
    fillP(); stroke(lw * 0.8);
  };
  const dome = (x, y, w) => { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.arc(x, y, w / 2, Math.PI, 0); ctx.closePath(); fillP(); stroke(); hatchPoly([[x, y - w / 2], [x + w / 2, y - w * 0.1], [x + w / 2, y], [x, y]], 3); ctx.beginPath(); ctx.moveTo(x, y - w / 2); ctx.lineTo(x, y - w * 0.8); stroke(lw * 0.8); };
  const townDot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fillP(); stroke(lw * 0.9); ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = INKC; ctx.fill(); };
  switch (f) {
        case 'village':
          house(x - k * 0.42, y + k * 0.35, k * 0.55, k * 0.4);
          house(x + k * 0.3, y + k * 0.42, k * 0.45, k * 0.32);
          break;
        case 'town':
          house(x - k * 0.62, y + k * 0.42, k * 0.55, k * 0.42);
          house(x + k * 0.62, y + k * 0.45, k * 0.5, k * 0.38);
          spire(x, y + k * 0.42, k * 0.36, k * 0.65);
          townDot(x, y + k * 0.72, k * 0.17);
          break;
        case 'city': {
          // 奥の家並み・尖塔・丸屋根
          house(x - k * 0.75, y + k * 0.05, k * 0.5, k * 0.45);
          dome(x + k * 0.05, y - k * 0.25, k * 0.6);
          spire(x - k * 0.25, y + k * 0.05, k * 0.3, k * 0.75);
          spire(x + k * 0.7, y + k * 0.05, k * 0.28, k * 0.6);
          // 手前の城壁と円塔
          const wy = y + k * 0.62, wh = k * 0.42, x0 = x - k * 1.2, x1 = x + k * 1.2;
          ctx.beginPath(); ctx.rect(x0, wy - wh, x1 - x0, wh); fillP(); stroke();
          ctx.beginPath(); for (let t = x0; t < x1 - k * 0.1; t += k * 0.24) ctx.rect(t, wy - wh - k * 0.12, k * 0.12, k * 0.12); fillP(); stroke(lw * 0.8);
          ctx.beginPath(); ctx.moveTo(x - k * 0.18, wy); ctx.lineTo(x - k * 0.18, wy - wh * 0.6); ctx.arc(x, wy - wh * 0.6, k * 0.18, Math.PI, 0); ctx.lineTo(x + k * 0.18, wy); ctx.fillStyle = INKC; ctx.fill();
          tower(x0, wy, k * 0.34, k * 0.7); tower(x1, wy, k * 0.34, k * 0.7);
          break;
        }
        case 'field': { // 畝の線だけの区画（2枚）
          ctx.save(); ctx.translate(x, y); ctx.rotate((sl.r - 0.5) * 0.9);
          for (const [ox, w2, ang] of [[-k * 0.42, k * 0.7, 0], [k * 0.42, k * 0.62, 1]]) {
            ctx.beginPath(); ctx.rect(ox - w2 / 2, -k * 0.35, w2, k * 0.7); ctx.setLineDash([lw * 1.5, lw * 1.5]); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = HATCH; ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath();
            if (ang) for (let t = -w2 / 2 + 1.5; t < w2 / 2; t += Math.max(1.6, k * 0.14)) { ctx.moveTo(ox + t, -k * 0.3); ctx.lineTo(ox + t, k * 0.3); }
            else for (let t = -k * 0.3; t <= k * 0.3; t += Math.max(1.6, k * 0.14)) { ctx.moveTo(ox - w2 / 2 + 1.5, t); ctx.lineTo(ox + w2 / 2 - 1.5, t); }
            ctx.lineWidth = lw * 0.6; ctx.strokeStyle = HATCH; ctx.stroke();
          }
          ctx.restore(); break;
        }
        case 'mine': { // 交差した鎚（鉱山の記号）
          ctx.save(); ctx.translate(x, y);
          for (const d of [1, -1]) {
            ctx.save(); ctx.rotate(d * Math.PI / 4);
            ctx.beginPath(); ctx.moveTo(0, k * 0.65); ctx.lineTo(0, -k * 0.45); stroke(Math.max(1, lw * 1.2));
            ctx.beginPath(); ctx.rect(-k * 0.28, -k * 0.62, k * 0.56, k * 0.22); ctx.fillStyle = INKC; ctx.fill();
            ctx.restore();
          }
          ctx.restore(); break;
        }
        case 'oasis': // ヤシと水面
          ctx.beginPath(); for (let j = 0; j < 2; j++) { const yy = y + k * (0.5 + j * 0.2), w2 = k * (0.7 - j * 0.15); ctx.moveTo(x - w2, yy); ctx.quadraticCurveTo(x - w2 / 2, yy - k * 0.1, x, yy); ctx.quadraticCurveTo(x + w2 / 2, yy + k * 0.1, x + w2, yy); } stroke(lw * 0.8);
          ctx.beginPath(); ctx.moveTo(x, y + k * 0.42); ctx.quadraticCurveTo(x + k * 0.18, y - k * 0.1, x + k * 0.05, y - k * 0.6); stroke(Math.max(1, lw * 1.1));
          ctx.beginPath(); for (const [dx, dy] of [[-0.6, -0.35], [-0.5, -0.75], [0.55, -0.3], [0.5, -0.8], [0.05, -0.95]]) { ctx.moveTo(x + k * 0.05, y - k * 0.6); ctx.quadraticCurveTo(x + k * (0.05 + dx * 0.5), y - k * (0.6 - dy * 0.1) - k * 0.25, x + k * (0.05 + dx), y + k * dy); } stroke(lw);
          break;
        case 'polder': { // 堤防と風車
          ctx.beginPath(); ctx.moveTo(x - k * 0.9, y + k * 0.55); ctx.lineTo(x + k * 0.9, y + k * 0.55); ctx.moveTo(x - k * 0.9, y + k * 0.7); ctx.lineTo(x + k * 0.9, y + k * 0.7); stroke(lw * 0.8);
          ctx.beginPath(); ctx.moveTo(x - k * 0.2, y + k * 0.55); ctx.lineTo(x - k * 0.12, y - k * 0.15); ctx.lineTo(x + k * 0.12, y - k * 0.15); ctx.lineTo(x + k * 0.2, y + k * 0.55); ctx.closePath(); fillP(); stroke();
          hatchPoly([[x, y - k * 0.15], [x + k * 0.12, y - k * 0.15], [x + k * 0.2, y + k * 0.55], [x, y + k * 0.55]], 3);
          ctx.save(); ctx.translate(x, y - k * 0.2); ctx.rotate(0.35 + sl.r);
          for (let j = 0; j < 4; j++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.rect(k * 0.06, -k * 0.07, k * 0.55, k * 0.14); fillP(); stroke(lw * 0.7); ctx.beginPath(); ctx.moveTo(k * 0.06, 0); ctx.lineTo(k * 0.61, 0); stroke(lw * 0.5); }
          ctx.restore(); break;
        }
    case 'swords': { // 交差した剣
      for (const d of [1, -1]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(d * Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(-k * 0.12, k * 0.45); ctx.lineTo(-k * 0.12, -k * 0.95); ctx.lineTo(0, -k * 1.2); ctx.lineTo(k * 0.12, -k * 0.95); ctx.lineTo(k * 0.12, k * 0.45); ctx.closePath(); fillP(); stroke();
        ctx.beginPath(); ctx.moveTo(-k * 0.42, k * 0.45); ctx.lineTo(k * 0.42, k * 0.45); stroke(lw * 1.6);
        ctx.beginPath(); ctx.moveTo(0, k * 0.45); ctx.lineTo(0, k * 0.85); stroke(lw * 2.2);
        ctx.restore();
      }
      break;
    }
    case 'siegetower': tower(x, y + k * 0.6, k * 0.9, k * 1.2); break;
    case 'tent':
      ctx.beginPath(); ctx.moveTo(x - k * 0.8, y + k * 0.5); ctx.lineTo(x, y - k * 0.6); ctx.lineTo(x + k * 0.8, y + k * 0.5); ctx.closePath(); fillP(); stroke();
      hatchPoly([[x, y - k * 0.6], [x + k * 0.8, y + k * 0.5], [x, y + k * 0.5]], 4);
      ctx.beginPath(); ctx.moveTo(x, y - k * 0.6); ctx.lineTo(x, y - k * 1.1); ctx.lineTo(x + k * 0.45, y - k * 0.95); ctx.lineTo(x, y - k * 0.8); stroke();
      ctx.beginPath(); ctx.moveTo(x - k * 0.15, y + k * 0.5); ctx.lineTo(x, y + k * 0.05); ctx.lineTo(x + k * 0.15, y + k * 0.5); stroke(lw * 0.8);
      break;
    case 'church': house(x - k * 0.15, y + k * 0.5, k * 0.9, k * 0.6); spire(x + k * 0.45, y + k * 0.5, k * 0.36, k * 0.7); break;
    case 'cave':
      ctx.beginPath(); ctx.moveTo(x - k * 0.95, y + k * 0.5); ctx.quadraticCurveTo(x - k * 0.8, y - k * 0.7, x, y - k * 0.75); ctx.quadraticCurveTo(x + k * 0.8, y - k * 0.7, x + k * 0.95, y + k * 0.5); ctx.closePath(); fillP(); stroke();
      hatchPoly([[x, y - k * 0.75], [x + k * 0.95, y + k * 0.5], [x + k * 0.4, y + k * 0.5]], 4);
      ctx.beginPath(); ctx.moveTo(x - k * 0.45, y + k * 0.5); ctx.quadraticCurveTo(x - k * 0.4, y - k * 0.25, x, y - k * 0.28); ctx.quadraticCurveTo(x + k * 0.4, y - k * 0.25, x + k * 0.45, y + k * 0.5); ctx.closePath(); ctx.fillStyle = INKC; ctx.fill();
      break;
    case 'scaffold':
      ctx.beginPath(); ctx.rect(x - k * 0.7, y - k * 0.6, k * 1.4, k * 1.1); fillP(); stroke();
      ctx.beginPath(); ctx.moveTo(x - k * 0.7, y - k * 0.6); ctx.lineTo(x + k * 0.7, y + k * 0.5); ctx.moveTo(x + k * 0.7, y - k * 0.6); ctx.lineTo(x - k * 0.7, y + k * 0.5); ctx.moveTo(x - k * 0.7, y - k * 0.05); ctx.lineTo(x + k * 0.7, y - k * 0.05); stroke(lw * 0.8);
      ctx.beginPath(); ctx.moveTo(x + k * 0.5, y - k * 0.6); ctx.lineTo(x + k * 0.5, y - k * 1.3); ctx.lineTo(x - k * 0.5, y - k * 1.3); ctx.moveTo(x - k * 0.4, y - k * 1.3); ctx.lineTo(x - k * 0.4, y - k * 0.9); stroke();
      break;
    case 'w_garden':
      ctx.beginPath(); ctx.moveTo(x - k * 1.0, y - k * 0.2); ctx.lineTo(x + k * 1.0, y - k * 0.2); ctx.lineTo(x + k * 0.2, y + k * 0.8); ctx.lineTo(x - k * 0.2, y + k * 0.8); ctx.closePath(); fillP(); stroke();
      hatchPoly([[x, y - k * 0.2], [x + k * 1.0, y - k * 0.2], [x + k * 0.2, y + k * 0.8], [x, y + k * 0.8]], 5);
      for (const [dx, r2] of [[-0.45, 0.32], [0.1, 0.42], [0.6, 0.3]]) { ctx.beginPath(); ctx.arc(x + dx * k, y - k * (0.45 + r2), r2 * k, 0, Math.PI * 2); fillP(); stroke(); ctx.beginPath(); ctx.moveTo(x + dx * k, y - k * 0.2); ctx.lineTo(x + dx * k, y - k * 0.45); stroke(); }
      ctx.beginPath(); ctx.moveTo(x - k * 0.9, y + k * 0.95); ctx.quadraticCurveTo(x - k * 0.6, y + k * 0.8, x - k * 0.3, y + k * 0.95); ctx.moveTo(x + k * 0.3, y + k * 1.05); ctx.quadraticCurveTo(x + k * 0.6, y + k * 0.9, x + k * 0.9, y + k * 1.05); stroke(lw * 0.7);
      break;
    case 'w_tower':
      ctx.beginPath(); ctx.moveTo(x - k * 0.35, y + k * 0.8); ctx.lineTo(x - k * 0.22, y - k * 1.1); ctx.lineTo(x + k * 0.22, y - k * 1.1); ctx.lineTo(x + k * 0.35, y + k * 0.8); ctx.closePath(); fillP(); stroke();
      hatchPoly([[x, y - k * 1.1], [x + k * 0.22, y - k * 1.1], [x + k * 0.35, y + k * 0.8], [x, y + k * 0.8]], 3);
      ctx.beginPath(); for (let i = 0; i < 3; i++) ctx.rect(x - k * 0.3 + i * k * 0.22, y - k * 1.28, k * 0.14, k * 0.18); fillP(); stroke(lw * 0.8);
      ctx.beginPath(); ctx.arc(x, y - k * 1.5, k * 0.16, 0, Math.PI * 2); ctx.fillStyle = INKC; ctx.fill();
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * k * 0.25, y - k * 1.5 + Math.sin(an) * k * 0.25); ctx.lineTo(x + Math.cos(an) * k * 0.42, y - k * 1.5 + Math.sin(an) * k * 0.42); stroke(lw * 0.6); }
      for (const yy of [-0.6, -0.1, 0.35]) { ctx.beginPath(); ctx.rect(x - k * 0.06, y + yy * k, k * 0.12, k * 0.2); ctx.fillStyle = INKC; ctx.fill(); }
      break;
    case 'w_library':
      ctx.beginPath(); ctx.moveTo(x - k * 1.0, y - k * 0.35); ctx.lineTo(x, y - k * 0.95); ctx.lineTo(x + k * 1.0, y - k * 0.35); ctx.closePath(); fillP(); stroke();
      ctx.beginPath(); ctx.rect(x - k * 0.95, y - k * 0.35, k * 1.9, k * 0.12); ctx.rect(x - k * 1.05, y + k * 0.6, k * 2.1, k * 0.14); fillP(); stroke();
      for (let i = 0; i < 5; i++) { const cx2 = x - k * 0.76 + i * k * 0.38; ctx.beginPath(); ctx.rect(cx2 - k * 0.07, y - k * 0.23, k * 0.14, k * 0.83); fillP(); stroke(lw * 0.8); }
      ctx.beginPath(); ctx.arc(x, y - k * 0.58, k * 0.12, 0, Math.PI * 2); stroke(lw * 0.7);
      break;
    case 'w_lighthouse':
      ctx.beginPath(); ctx.moveTo(x - k * 0.32, y + k * 0.8); ctx.lineTo(x - k * 0.18, y - k * 0.7); ctx.lineTo(x + k * 0.18, y - k * 0.7); ctx.lineTo(x + k * 0.32, y + k * 0.8); ctx.closePath(); fillP(); stroke();
      for (const yy of [-0.2, 0.3]) { ctx.beginPath(); ctx.moveTo(x - k * 0.27, y + yy * k); ctx.lineTo(x + k * 0.27, y + yy * k); stroke(lw * 0.7); }
      ctx.beginPath(); ctx.rect(x - k * 0.22, y - k * 1.05, k * 0.44, k * 0.35); fillP(); stroke();
      ctx.beginPath(); ctx.moveTo(x - k * 0.26, y - k * 1.05); ctx.lineTo(x, y - k * 1.3); ctx.lineTo(x + k * 0.26, y - k * 1.05); ctx.closePath(); ctx.fillStyle = INKC; ctx.fill();
      for (const [dx, dy] of [[-1, -0.2], [-1, 0.15], [1, -0.2], [1, 0.15]]) { ctx.beginPath(); ctx.moveTo(x + dx * k * 0.3, y - k * 0.88); ctx.lineTo(x + dx * k * 1.05, y - k * 0.88 + dy * k); stroke(lw * 0.7); }
      ctx.beginPath(); ctx.moveTo(x - k * 0.9, y + k * 0.85); ctx.quadraticCurveTo(x - k * 0.6, y + k * 0.7, x - k * 0.35, y + k * 0.85); ctx.moveTo(x + k * 0.35, y + k * 0.85); ctx.quadraticCurveTo(x + k * 0.6, y + k * 0.7, x + k * 0.9, y + k * 0.85); stroke(lw * 0.7);
      break;
    case 'w_bazaar':
      ctx.beginPath(); ctx.rect(x - k * 1.0, y - k * 0.1, k * 2.0, k * 0.8); fillP(); stroke();
      for (const dx of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(x + (dx - 0.18) * k, y + k * 0.7); ctx.lineTo(x + (dx - 0.18) * k, y + k * 0.35); ctx.arc(x + dx * k, y + k * 0.35, k * 0.18, Math.PI, 0); ctx.lineTo(x + (dx + 0.18) * k, y + k * 0.7); ctx.fillStyle = INKC; ctx.fill(); }
      dome(x, y - k * 0.1, k * 1.1);
      ctx.beginPath(); ctx.moveTo(x - k * 1.1, y - k * 0.1); for (let i = 0; i <= 8; i++) ctx.lineTo(x - k * 1.1 + i * k * 0.275, y - k * 0.1 + (i % 2 ? k * 0.12 : 0)); stroke(lw * 0.7);
      break;
    case 'w_arena':
      ctx.beginPath(); ctx.ellipse(x, y, k * 1.1, k * 0.5, 0, 0, Math.PI * 2); fillP(); stroke();
      ctx.beginPath(); ctx.ellipse(x, y - k * 0.08, k * 0.65, k * 0.25, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(52,32,14,0.25)'; ctx.fill(); stroke(lw * 0.8);
      for (let i = 0; i < 9; i++) { const an = Math.PI * (0.1 + i * 0.1), ax = x + Math.cos(an) * k * 0.9, ay = y + Math.sin(an) * k * 0.4; ctx.beginPath(); ctx.arc(ax, ay + k * 0.02, k * 0.06, Math.PI, 0); stroke(lw * 0.7); }
      break;
    case 'w_cathedral':
      house(x, y + k * 0.75, k * 1.0, k * 0.65);
      spire(x - k * 0.65, y + k * 0.75, k * 0.34, k * 1.0); spire(x + k * 0.65, y + k * 0.75, k * 0.34, k * 1.0);
      ctx.beginPath(); ctx.arc(x, y + k * 0.35, k * 0.16, 0, Math.PI * 2); fillP(); stroke(lw * 0.8);
      break;
    case 'w_gate':
      ctx.beginPath(); ctx.rect(x - k * 0.9, y + k * 0.6, k * 1.8, k * 0.2); fillP(); stroke();
      ctx.beginPath(); ctx.arc(x, y - k * 0.2, k * 0.8, 0, Math.PI * 2); fillP(); stroke(lw * 1.3);
      ctx.beginPath(); ctx.arc(x, y - k * 0.2, k * 0.6, 0, Math.PI * 2); stroke(lw * 0.7);
      ctx.beginPath(); for (let t = 0; t < 22; t++) { const an = t * 0.5, r2 = k * 0.55 * (1 - t / 24); ctx.lineTo(x + Math.cos(an) * r2, y - k * 0.2 + Math.sin(an) * r2); } stroke(lw * 0.8);
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(an) * k * 0.7, y - k * 0.2 + Math.sin(an) * k * 0.7, k * 0.04, 0, Math.PI * 2); ctx.fillStyle = INKC; ctx.fill(); }
      break;
    case 'w_worldtree':
      ctx.beginPath(); ctx.moveTo(x - k * 0.2, y + k * 0.8); ctx.quadraticCurveTo(x - k * 0.1, y, x - k * 0.15, y - k * 0.3); ctx.lineTo(x + k * 0.15, y - k * 0.3); ctx.quadraticCurveTo(x + k * 0.1, y, x + k * 0.2, y + k * 0.8); ctx.closePath(); fillP(); stroke();
      ctx.beginPath(); ctx.moveTo(x - k * 0.2, y + k * 0.8); ctx.lineTo(x - k * 0.55, y + k * 0.9); ctx.moveTo(x + k * 0.2, y + k * 0.8); ctx.lineTo(x + k * 0.55, y + k * 0.9); stroke(lw * 0.8);
      for (const [dx, dy, r2] of [[0, -0.95, 0.55], [-0.65, -0.55, 0.42], [0.65, -0.55, 0.42], [-0.35, -1.3, 0.35], [0.38, -1.28, 0.35]]) { ctx.beginPath(); ctx.arc(x + dx * k, y + dy * k, r2 * k, 0, Math.PI * 2); fillP(); stroke(); }
      hatchPoly([[x + k * 0.2, y - k * 1.5], [x + k * 1.1, y - k * 0.6], [x + k * 0.6, y - k * 0.15], [x + k * 0.1, y - k * 0.5]], 5);
      break;
      }
}
// アイコンは一度だけ描いて使い回す（斜線の陰影が重いため）
const iconCache = new Map();
function iconSprite(f, k, v) {
  const key = f + ':' + k + ':' + v;
  let sp = iconCache.get(key);
  if (sp) return sp;
  if (iconCache.size > 500) iconCache.clear();
  const S2 = k * 3.6, pr = Math.max(1, exportView ? 1 : dpr);
  const c = document.createElement('canvas'); c.width = Math.ceil(S2 * pr); c.height = Math.ceil(S2 * pr);
  const save = ctx; ctx = c.getContext('2d'); ctx.scale(pr, pr);
  try { drawIcon(f, S2 / 2, S2 * 0.55, k, v / 3 + 0.15); } finally { ctx = save; }
  sp = { c, w: S2, h: S2, ox: S2 / 2, oy: S2 * 0.55 };
  iconCache.set(key, sp); return sp;
}
function drawDevelopment() {
  if (cam.s < 0.55) return;
  const a = clamp((cam.s - 0.55) / 0.3, 0, 1), s = clamp(5.6 * cam.s, 3.8, 24);
  ctx.save(); ctx.globalAlpha = a;
  for (const p of S.provinces) {
    if (p.sea || p.owner < 0 || !p._slots) continue;
    if (!visible(sx(p.x), sy(p.y), Math.sqrt(p.area) * cam.s + 30)) continue;
    const feats = p._feats || [];
    for (let i = 0; i < feats.length; i++) {
      const sl = p._slots[i], k = Math.round(s * (0.92 + sl.r * 0.2) * 2) / 2, v = Math.floor(sl.r * 3) % 3;
      const sp = iconSprite(feats[i], k, v);
      ctx.drawImage(sp.c, sx(sl.x) - sp.ox, sy(sl.y) - sp.oy, sp.w, sp.h);
    }
  }
  ctx.restore();
}
