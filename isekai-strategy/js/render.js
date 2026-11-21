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
      mine.push({ x: gx, y: gy, t, r: R() });
    }
    glyphs.push(...mine);
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
  drawTerrainGlyphs();
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
    if (!isCap && p.dev < 14) continue;
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

function drawWonders() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const w of S.wonders) {
    const p = prov(w.pid), x = sx(p.x) - 18, y = sy(p.y) + 4;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = 'rgba(250,236,200,.92)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#b8862f'; ctx.stroke();
    ctx.font = '13px sans-serif'; ctx.fillText(WONDER_BY_ID[w.id].icon, x, y + 1);
  }
  for (const n of S.nations) {
    if (!n.alive || !n.project) continue;
    const p = prov(n.project.pid), x = sx(p.x) - 18, y = sy(p.y) + 4;
    ctx.font = '13px sans-serif'; ctx.fillText('🏗', x, y);
    ctx.fillStyle = 'rgba(20,12,8,.7)'; ctx.fillRect(x - 11, y + 10, 22, 4);
    ctx.fillStyle = '#e0b04a'; ctx.fillRect(x - 10, y + 11, 20 * n.project.prog / n.project.need, 2);
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
