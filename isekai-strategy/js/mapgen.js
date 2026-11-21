'use strict';
// ===== 大陸生成 =====
// 戻り値: { grid, provinces(陸→海の順), landCount, nations, rel, relBase, nodes }
function generateWorld(seed) {
  const R = mulberry32(seed * 7919 + 13);
  const N1 = makeNoise(seed * 3 + 1), N2 = makeNoise(seed * 3 + 2), N3 = makeNoise(seed * 3 + 3);
  const STEP = 56;
  const cols = Math.ceil(MAP_W / STEP), rows = Math.ceil(MAP_H / STEP);
  const seeds = new Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = Math.min(MAP_W - 1, (i + 0.12 + 0.76 * R()) * STEP);
    const y = Math.min(MAP_H - 1, (j + 0.12 + 0.76 * R()) * STEP);
    const nx = x / MAP_W * 2 - 1, ny = y / MAP_H * 2 - 1;
    const d2 = nx * nx * 0.85 + ny * ny * 1.15;
    const e = 0.55 * N1.fbm(x / 420, y / 420, 5) + 0.45 * N1.fbm(x / 900 + 10, y / 900 + 10, 3) - d2 * 0.38;
    const m = N2.fbm(x / 320, y / 320, 4);
    seeds[j * cols + i] = { x, y, e, m, land: false, pid: -1, edge: i === 0 || j === 0 || i === cols - 1 || j === rows - 1 };
  }
  const es = seeds.map(s => s.e).sort((a, b) => b - a);
  const thr = es[Math.floor(seeds.length * 0.5)];
  for (const s of seeds) s.land = s.e > thr && !s.edge;
  // 島を追加（海軍が活きるように）
  const nearLand = (i, j, r) => { for (let b = j - r; b <= j + r; b++) for (let a = i - r; a <= i + r; a++) if (a >= 0 && b >= 0 && a < cols && b < rows && seeds[b * cols + a].land) return true; return false; };
  for (let k = 0, tries = 0; k < 4 && tries < 400; tries++) {
    const i = 2 + Math.floor(R() * (cols - 4)), j = 2 + Math.floor(R() * (rows - 4));
    if (nearLand(i, j, 2)) continue;
    const size = 3 + Math.floor(R() * 3); let ci = i, cj = j;
    for (let t = 0; t < size * 3 && size > 0; t++) {
      const sd = seeds[cj * cols + ci]; sd.land = true;
      const dir = Math.floor(R() * 4); const ni = ci + [1, -1, 0, 0][dir], nj = cj + [0, 0, 1, -1][dir];
      if (ni >= 1 && nj >= 1 && ni < cols - 1 && nj < rows - 1) { ci = ni; cj = nj; }
      let cnt = 0; for (let b = j - 2; b <= j + 2; b++) for (let a = i - 2; a <= i + 2; a++) if (a >= 0 && b >= 0 && a < cols && b < rows && seeds[b * cols + a].land) cnt++;
      if (cnt >= size) break;
    }
    k++;
  }

  // 歪ませたボロノイ
  const WS = 4, wW = Math.ceil(MAP_W / WS) + 2, wH = Math.ceil(MAP_H / WS) + 2;
  const warpX = new Float32Array(wW * wH), warpY = new Float32Array(wW * wH);
  for (let y = 0; y < wH; y++) for (let x = 0; x < wW; x++) {
    const px = x * WS, py = y * WS;
    warpX[y * wW + x] = (N3.fbm(px / 90, py / 90, 3) - 0.5) * 70;
    warpY[y * wW + x] = (N3.fbm(px / 90 + 33.3, py / 90 + 71.1, 3) - 0.5) * 70;
  }
  const seedOf = new Int32Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    const fy = y / WS, y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < MAP_W; x++) {
      const fx = x / WS, x0 = Math.floor(fx), tx = fx - x0;
      const k = y0 * wW + x0;
      const wx = (warpX[k] * (1 - tx) + warpX[k + 1] * tx) * (1 - ty) + (warpX[k + wW] * (1 - tx) + warpX[k + wW + 1] * tx) * ty;
      const wy = (warpY[k] * (1 - tx) + warpY[k + 1] * tx) * (1 - ty) + (warpY[k + wW] * (1 - tx) + warpY[k + wW + 1] * tx) * ty;
      const px = x + wx, py = y + wy;
      const ci = Math.floor(px / STEP), cj = Math.floor(py / STEP);
      let best = 0, bd = 1e18;
      for (let jj = Math.max(0, cj - 2); jj <= Math.min(rows - 1, cj + 2); jj++)
        for (let ii = Math.max(0, ci - 2); ii <= Math.min(cols - 1, ci + 2); ii++) {
          const s = seeds[jj * cols + ii], dx = s.x - px, dy = s.y - py, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = jj * cols + ii; }
        }
      seedOf[y * MAP_W + x] = best;
    }
  }
  const sAdj = seeds.map(() => new Set());
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x, a = seedOf[i];
    if (x + 1 < MAP_W) { const b = seedOf[i + 1]; if (a !== b) { sAdj[a].add(b); sAdj[b].add(a); } }
    if (y + 1 < MAP_H) { const b = seedOf[i + MAP_W]; if (a !== b) { sAdj[a].add(b); sAdj[b].add(a); } }
  }
  // 陸塊: 最大のものを本土、3シード以上を島として残す
  const comp = new Int32Array(seeds.length).fill(-1); let bestComp = -1, bestSize = 0, cid = 0; const sizes = [];
  for (let i = 0; i < seeds.length; i++) {
    if (!seeds[i].land || comp[i] >= 0) continue;
    const q = [i]; comp[i] = cid; let size = 0;
    while (q.length) { const u = q.pop(); size++; for (const v of sAdj[u]) if (seeds[v].land && comp[v] < 0) { comp[v] = cid; q.push(v); } }
    sizes.push(size);
    if (size > bestSize) { bestSize = size; bestComp = cid; }
    cid++;
  }
  for (let i = 0; i < seeds.length; i++) if (seeds[i].land && sizes[comp[i]] < 3) seeds[i].land = false;

  const provinces = [];
  for (let i = 0; i < seeds.length; i++) if (seeds[i].land) {
    const s = seeds[i]; s.pid = provinces.length;
    provinces.push({ id: s.pid, sx: s.x, sy: s.y, e: s.e, m: s.m, main: comp[i] === bestComp, nbSet: new Set(), snbSet: new Set(), area: 0, cx: 0, cy: 0 });
  }
  const landCount = provinces.length;
  // 海域: 海シードを2〜3個ずつまとめる
  const zoneOf = new Int32Array(seeds.length).fill(-1); const zones = [];
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i].land || zoneOf[i] >= 0) continue;
    const z = zones.length; zoneOf[i] = z; const members = [i];
    const coastal = [...sAdj[i]].some(v => seeds[v].land);
    const maxSize = coastal ? 2 : 4;
    for (const v of sAdj[i]) { if (members.length >= maxSize) break; if (!seeds[v].land && zoneOf[v] < 0) { zoneOf[v] = z; members.push(v); } }
    zones.push(members);
  }
  for (let z = 0; z < zones.length; z++) {
    const id = landCount + z;
    for (const s of zones[z]) seeds[s].pid = id;
    provinces.push({ id, sea: true, nbSet: new Set(), lnbSet: new Set(), area: 0, cx: 0, cy: 0 });
  }
  const grid = new Int16Array(MAP_W * MAP_H);
  for (let i = 0; i < grid.length; i++) grid[i] = seeds[seedOf[i]].pid;
  for (let i = 0; i < seeds.length; i++) {
    const a = provinces[seeds[i].pid];
    for (const j of sAdj[i]) {
      const b = provinces[seeds[j].pid]; if (a === b) continue;
      if (!a.sea) { if (b.sea) a.snbSet.add(b.id); else a.nbSet.add(b.id); }
      else { if (b.sea) a.nbSet.add(b.id); else a.lnbSet.add(b.id); }
    }
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const pr = provinces[grid[y * MAP_W + x]]; pr.area++; pr.cx += x; pr.cy += y;
  }
  for (const p of provinces) {
    p.nb = [...p.nbSet]; delete p.nbSet;
    if (p.sea) { p.lnb = [...p.lnbSet]; delete p.lnbSet; } else { p.snb = [...p.snbSet]; delete p.snbSet; p.coastal = p.snb.length > 0; }
    if (p.area > 0) { p.cx /= p.area; p.cy /= p.area; }
    p.x = p.cx; p.y = p.cy;
    const gx = Math.round(p.x), gy = Math.round(p.y);
    if (grid[gy * MAP_W + gx] !== p.id) {
      let found = false;
      const ox = p.sea ? p.cx : p.sx, oy = p.sea ? p.cy : p.sy;
      for (let r = 0; r < 60 && !found; r += 2) for (let a = 0; a < 16 && !found; a++) {
        const tx = Math.round(ox + Math.cos(a / 16 * Math.PI * 2) * r), ty = Math.round(oy + Math.sin(a / 16 * Math.PI * 2) * r);
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && grid[ty * MAP_W + tx] === p.id) { p.x = tx; p.y = ty; found = true; }
      }
    }
  }
  const land = provinces.slice(0, landCount);

  // 地形
  const eRank = rankOf(land.map(p => p.e)), mRank = rankOf(land.map(p => p.m));
  for (const p of land) {
    const er = eRank[p.id], mr = mRank[p.id];
    let t = 'plains';
    if (er > 0.9) t = 'mountains';
    else if (er > 0.75) t = 'hills';
    else if (mr > 0.74) t = 'forest';
    else if (er < 0.16 && mr > 0.5) t = 'marsh';
    else if (mr < 0.13) t = 'desert';
    p.terrain = t;
  }

  // 国家配置（本土のみ）
  const n = landCount;
  const hop = (from) => { const d = new Int16Array(n).fill(-1); d[from] = 0; const q = [from]; let h = 0; while (h < q.length) { const u = q[h++]; for (const v of provinces[u].nb) if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } } return d; };
  const nations = [{ id: MONSTER, name: '魔物', short: '魔物', race: 'demon', color: MONSTER_COLOR, isMonster: true, alive: true, allies: [], truces: {}, timed: [], tech: { adm: 1, dip: 1, mil: 1 } }];
  const capitals = [];
  for (let ti = 0; ti < NATION_TEMPLATES.length; ti++) {
    const T = NATION_TEMPLATES[ti];
    let best = -1, bs = -1;
    for (const p of land) {
      if (!p.main || capitals.includes(p.id) || p.nb.length < 3) continue;
      let md = 1e9;
      for (const c of capitals) { const q = provinces[c]; md = Math.min(md, Math.hypot(q.x - p.x, q.y - p.y)); }
      if (!capitals.length) md = 500 + R() * 200;
      let sc = md * (RACES[T.race].pref.includes(p.terrain) ? 1.35 : 1) * (0.8 + 0.4 * R());
      if (T.size === 'big') sc *= 1 + p.nb.length * 0.05;
      if (sc > bs) { bs = sc; best = p.id; }
    }
    capitals.push(best);
  }
  for (const p of land) p.owner = -1;
  const hops = capitals.map(c => hop(c));
  const targets = NATION_TEMPLATES.map(T => { const r = SIZE_RANGE[T.size]; return r[0] + Math.floor(R() * (r[1] - r[0] + 1)); });
  const owned = NATION_TEMPLATES.map(() => []);
  capitals.forEach((c, i) => { provinces[c].owner = i + 1; owned[i].push(c); });
  for (let round = 0; round < 40; round++) {
    const order = shuffle(NATION_TEMPLATES.map((_, i) => i), R);
    let grew = false;
    for (const i of order) {
      if (owned[i].length >= targets[i]) continue;
      let best = -1, bs = 1e9;
      for (const pid of owned[i]) for (const q of provinces[pid].nb) {
        if (provinces[q].owner >= 0) continue;
        const sc = hops[i][q] + R() * 1.6 - (RACES[NATION_TEMPLATES[i].race].pref.includes(provinces[q].terrain) ? 0.6 : 0);
        if (sc < bs) { bs = sc; best = q; }
      }
      if (best >= 0) { provinces[best].owner = i + 1; owned[i].push(best); grew = true; }
    }
    if (!grew) break;
  }
  const dk = NATION_TEMPLATES.findIndex(t => t.demonKing);
  for (const p of land) {
    const h = hops[dk][p.id];
    if (h >= 0 && h <= 2 && R() < (h === 0 ? 1 : 0.55)) p.terrain = 'miasma';
  }
  for (let k = 0; k < 4; k++) { const p = pick(land, R); if (p.owner < 0) p.terrain = 'miasma'; }

  // 名前・種族・宗教・資源
  const used = new Set();
  const genName = (race) => {
    const r = RACES[race];
    for (let t = 0; t < 80; t++) {
      const s = pick(r.pre, R) + (R() < 0.3 ? pick(r.mid, R) : '') + pick(r.suf, R);
      if (!used.has(s) && s.length <= 7) { used.add(s); return s; }
    }
    const s = pick(r.pre, R) + pick(r.suf, R) + used.size; used.add(s); return s;
  };
  for (const p of land) {
    if (p.owner > 0) p.race = NATION_TEMPLATES[p.owner - 1].race;
    else {
      let bi = 0, bd = 1e9;
      capitals.forEach((c, i) => { const h = hops[i][p.id]; const d = h >= 0 ? h : 50 + Math.hypot(provinces[c].x - p.x, provinces[c].y - p.y) / 50; if (d < bd) { bd = d; bi = i; } });
      p.race = NATION_TEMPLATES[bi].race;
    }
    p.religion = RACE_RELIGION[p.race];
    p.name = genName(p.race);
    p.good = pick(TERRAIN_GOODS[p.terrain], R);
    const f = TERRAIN[p.terrain].dev;
    if (p.owner > 0) {
      p.dev = Math.max(3, Math.round((3 + R() * 8) * f));
    } else p.dev = 3;
    p.controller = p.owner;
    p.fort = 0; p.b = {}; p.siege = null; p.colonizing = null; p.converting = null; p.coreUntil = 0; p.dungeon = null;
  }
  // ダンジョン
  const dcand = shuffle(land.filter(p => ['miasma', 'mountains', 'forest', 'hills', 'marsh'].includes(p.terrain)), R);
  dcand.slice(0, 12).forEach(p => { p.dungeon = { lv: 1 + Math.floor(R() * (p.terrain === 'miasma' ? 5 : 3.5)), cleared: false }; });
  // 海域の名前
  for (const p of provinces) if (p.sea) {
    p.owner = -1; p.controller = -1; p.dev = 0; p.terrain = 'sea'; p.b = {}; p.fort = 0; p.siege = null; p.colonizing = null; p.converting = null; p.coreUntil = 0; p.dungeon = null;
    if (p.lnb.length) {
      const near = provinces[p.lnb[0]];
      p.name = near.name + (p.lnb.length >= 3 ? '湾' : '沖');
    } else p.name = '外洋';
  }
  // 交易圏（k-means）
  const K = 8;
  let cents = shuffle(land.filter(p => p.main), R).slice(0, K).map(p => [p.x, p.y]);
  for (let it = 0; it < 10; it++) {
    const acc = cents.map(() => [0, 0, 0]);
    for (const p of land) {
      let bi = 0, bd = 1e18; cents.forEach((c, i) => { const d = (c[0] - p.x) ** 2 + (c[1] - p.y) ** 2; if (d < bd) { bd = d; bi = i; } });
      p.node = bi; acc[bi][0] += p.x; acc[bi][1] += p.y; acc[bi][2]++;
    }
    cents = acc.map((a, i) => a[2] ? [a[0] / a[2], a[1] / a[2]] : cents[i]);
  }
  const nodes = cents.map((c, i) => {
    let best = null, bd = 1e18;
    for (const p of land) if (p.node === i) { const d = (c[0] - p.x) ** 2 + (c[1] - p.y) ** 2; if (d < bd) { bd = d; best = p; } }
    return { id: i, x: c[0], y: c[1], name: (best ? best.name : '辺境') + '交易圏', color: [60 + (i * 97) % 180, 80 + (i * 53) % 160, 90 + (i * 71) % 150] };
  });

  NATION_TEMPLATES.forEach((T, i) => {
    const id = i + 1, cap = provinces[capitals[i]];
    cap.dev += 8;
    cap.fort = T.race === 'dwarf' ? 3 : 2;
    if (T.size === 'big') shuffle(owned[i].filter(p => p !== cap.id), R).slice(0, 2).forEach(pid => provinces[pid].fort = 1);
    const root = genName(T.race);
    const big = T.size === 'big';
    nations.push({
      id, name: root + T.gov, short: root, race: T.race, religion: RACE_RELIGION[T.race], polity: T.gov, size: T.size, color: T.color, demonKing: !!T.demonKing,
      capital: cap.id, alive: true, isMonster: false, isPlayer: false,
      gold: big ? 150 : 80, manpower: 0, gov: 50, know: 0, mana: 20, stab: 1, inventions: [], governors: [], guildCount: 0,
      ruler: { name: pick(RACES[T.race].rulers, R), cap: 1 + Math.floor(R() * 5) },
      tech: { adm: 1, dip: 1, mil: 1 }, allies: [], truces: {}, timed: [], cheat: null, lastWar: -9999, armyCount: 0, fleetCount: 0, evCD: {},
      generals: [], advisors: [], bench: [], artifacts: [], skills: [], overlord: null, vassalSince: 0, summonCount: 0,
    });
  });
  nations.push({ id: REBEL, name: '反乱軍', short: '反乱軍', race: 'human', color: REBEL_COLOR, isMonster: true, isRebel: true, alive: true, allies: [], truces: {}, timed: [], tech: { adm: 1, dip: 1, mil: 1 } });

  // 関係値
  const NN = nations.length;
  const relBase = [], rel = [];
  for (let a = 0; a < NN; a++) { relBase.push(new Array(NN).fill(0)); rel.push(new Array(NN).fill(0)); }
  for (let a = 1; a < REBEL; a++) for (let b = a + 1; b < REBEL; b++) {
    const A = nations[a], B = nations[b];
    let base = 0;
    if (A.race === B.race) base += 25;
    if ((A.race === 'demon') !== (B.race === 'demon')) base -= 35;
    if ((A.race === 'elf' && B.race === 'dwarf') || (A.race === 'dwarf' && B.race === 'elf')) base -= 10;
    base += Math.round((R() - 0.5) * 30);
    relBase[a][b] = relBase[b][a] = base;
    rel[a][b] = rel[b][a] = base;
  }
  for (let a = 1; a < REBEL; a++) for (let b = a + 1; b < REBEL; b++) {
    if (nations[a].race === nations[b].race && rel[a][b] > 25 && nations[a].allies.length < 2 && nations[b].allies.length < 2) {
      nations[a].allies.push(b); nations[b].allies.push(a);
    }
  }
  return { grid, provinces, landCount, nations, rel, relBase, nodes };
}

function rankOf(vals) {
  const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
  const r = new Array(vals.length);
  idx.forEach((i, k) => r[i] = k / Math.max(1, vals.length - 1));
  return r;
}
