'use strict';
// ===== ゲーム状態とシミュレーション =====
let S = null;      // ゲーム状態
let GRID = null;   // 州IDグリッド
let mapDirty = true;
const hooks = { log: () => {}, modal: () => {}, gameOver: () => {} };

const nat = id => S.nations[id];
const prov = id => S.provinces[id];
const dev = p => p.tax + p.prod + p.mp;

function natMod(n, key) {
  if (!n || n.isMonster) return 0;
  let v = 0;
  const r = RACES[n.race]; if (r.mods[key]) v += r.mods[key];
  if (n.cheat) { const c = CHEAT_BY_ID[n.cheat]; if (c.mods[key]) v += c.mods[key]; }
  for (const m of n.timed) if (m.key === key && m.until > S.day) v += m.val;
  if (key === 'taxMod' || key === 'prodMod') v += (n.tech.adm - 1) * 0.04;
  if (key === 'prodMod') v += (n.tech.dip - 1) * 0.03;
  if (key === 'combat') v += (n.tech.mil - 1) * 0.06;
  if (key === 'morale') v += (n.tech.mil - 1) * 0.1;
  return v;
}
function addTimed(n, key, val, days, label) { n.timed.push({ key, val, until: S.day + days, label }); }

// ---------- 外交関係 ----------
const isAlly = (a, b) => a !== b && a > 0 && b > 0 && nat(a).allies.includes(b);
const sideOf = (w, id) => w.att.includes(id) ? 'att' : w.def.includes(id) ? 'def' : null;
const warsOf = id => S.wars.filter(w => sideOf(w, id));
function atWar(a, b) {
  for (const w of S.wars) { const sa = sideOf(w, a), sb = sideOf(w, b); if (sa && sb && sa !== sb) return true; }
  return false;
}
function coBelligerent(a, b) {
  for (const w of S.wars) { const sa = sideOf(w, a); if (sa && sa === sideOf(w, b)) return true; }
  return false;
}
function hostile(a, b) {
  if (a === b || a < 0 || b < 0) return false;
  if (a === MONSTER || b === MONSTER) return true;
  return atWar(a, b);
}
const friendly = (a, b) => a >= 0 && b >= 0 && (a === b || isAlly(a, b) || coBelligerent(a, b));
const hasTruce = (a, b) => (nat(a).truces[b] || 0) > S.day;
function getRel(a, b) { return S.rel[a][b]; }
function addRel(a, b, v) { if (a === b || a === MONSTER || b === MONSTER) return; S.rel[a][b] = S.rel[b][a] = clamp(S.rel[a][b] + v, -100, 100); }
function addAlliance(a, b) { if (!isAlly(a, b)) { nat(a).allies.push(b); nat(b).allies.push(a); } }
function breakAlliance(a, b) { nat(a).allies = nat(a).allies.filter(x => x !== b); nat(b).allies = nat(b).allies.filter(x => x !== a); }

function canEnter(nid, pid) {
  const p = prov(pid);
  if (nid === MONSTER || p.owner < 0) return true;
  if (friendly(nid, p.owner) || friendly(nid, p.controller)) return true;
  return hostile(nid, p.owner) || hostile(nid, p.controller);
}

// ---------- 国力 ----------
function ownedProvs(id) { return S.provinces.filter(p => p.owner === id); }
function totalDev(id) { let d = 0; for (const p of S.provinces) if (p.owner === id) d += dev(p); return d; }
function forceLimit(n) { return Math.floor(5 + totalDev(n.id) / 5); }
function maxManpower(n) {
  let m = 3000;
  for (const p of S.provinces) if (p.owner === n.id)
    m += p.mp * 400 * (1 + natMod(n, 'mpMod') + (p.b.barracks ? 0.5 : 0)) * (p.coreUntil > S.day ? 0.5 : 1);
  return Math.round(m);
}
function provIncome(p, n) {
  if (p.owner !== n.id || p.controller !== n.id) return { tax: 0, prod: 0 };
  let tax = p.tax * 0.22 * (1 + natMod(n, 'taxMod') + (p.b.temple ? 0.4 : 0));
  let prod = p.prod * GOODS[p.good].price * 0.07 * (1 + natMod(n, 'prodMod') + (p.b.workshop ? 0.5 : 0)) + (p.dungeon ? 1 : 0);
  if (p.coreUntil > S.day) { tax *= 0.5; prod *= 0.5; }
  if (p.id === n.capital) tax += 1;
  return { tax, prod };
}
function calcIncome(n) {
  let tax = 0, prod = 0, d = 0, bmaint = 0;
  for (const p of S.provinces) {
    if (p.owner !== n.id) continue;
    d += dev(p); const r = provIncome(p, n); tax += r.tax; prod += r.prod;
    if (p.b.walls) bmaint += 0.4;
  }
  let maint = 0, regs = 0;
  for (const a of S.armies) if (a.owner === n.id) for (const t in UNITS) { maint += a.regs[t] * UNITS[t].maint; regs += a.regs[t]; }
  const fl = Math.floor(5 + d / 5);
  if (regs > fl) maint *= 1 + (regs - fl) / Math.max(1, fl) * 2;
  return { tax, prod, maint, bmaint, net: tax + prod - maint - bmaint, dev: d, regs, fl };
}
function nationPower(id) {
  let p = 0; for (const a of S.armies) if (a.owner === id) p += armyPower(a);
  if (id !== MONSTER) p += nat(id).manpower / 1000 * 0.4;
  return p;
}
function coalitionPower(id) { let p = nationPower(id); for (const al of nat(id).allies) p += nationPower(al) * 0.7; return p; }

// ---------- 軍 ----------
const armyMen = a => a.men.inf + a.men.cav + a.men.mage;
const armyRegs = a => a.regs.inf + a.regs.cav + a.regs.mage;
function maxMorale(nid) { return nid === MONSTER ? 2.5 : 3 + natMod(nat(nid), 'morale'); }
function combatMod(a, pid) {
  if (a.owner === MONSTER) return 0;
  const n = nat(a.owner); let m = natMod(n, 'combat');
  if (a.hero) m += 0.3;
  if (pid != null && n.race === 'elf') { const t = prov(pid).terrain; if (t === 'forest' || t === 'marsh') m += 0.25; }
  return m;
}
function rawPower(a) {
  const cavP = UNITS.cav.power + (a.owner !== MONSTER ? natMod(nat(a.owner), 'cavPower') : 0);
  return (a.men.inf * UNITS.inf.power + a.men.cav * cavP + a.men.mage * UNITS.mage.power) / 1000;
}
function armyPower(a) { return rawPower(a) * (1 + combatMod(a)) * (0.5 + 0.5 * a.morale / maxMorale(a.owner)); }
function unitName(nid, t) { return nid > 0 ? RACES[nat(nid).race].units[t] : UNITS[t].name; }

function createArmy(owner, pid, inf, cav, mage, opts = {}) {
  let name = opts.name;
  if (!name) { const n = nat(owner); n.armyCount = (n.armyCount || 0) + 1; name = `第${n.armyCount}軍`; }
  const a = {
    id: S.nextArmyId++, owner, prov: pid, regs: { inf, cav, mage }, men: { inf: inf * 1000, cav: cav * 1000, mage: mage * 1000 },
    morale: maxMorale(owner), path: [], prog: 0, retreat: false, inBattle: false, hero: !!opts.hero, name, target: null, expire: opts.expire || 0,
  };
  S.armies.push(a); return a;
}
function destroyArmy(a) {
  const i = S.armies.indexOf(a); if (i >= 0) S.armies.splice(i, 1);
  if (S.sel && S.sel.type === 'army' && S.sel.id === a.id) S.sel = { type: 'prov', id: a.prov };
}
function recruitCost(n, t) { return UNITS[t].cost; }
function canRecruitAt(nid, pid) {
  const p = prov(pid);
  return p.owner === nid && p.controller === nid && !S.armies.some(a => a.prov === pid && hostile(a.owner, nid));
}
function recruit(nid, pid, t, count = 1) {
  const n = nat(nid), cost = recruitCost(n, t) * count;
  if (n.gold < cost || n.manpower < 1000 * count || !canRecruitAt(nid, pid)) return null;
  n.gold -= cost; n.manpower -= 1000 * count;
  let a = S.armies.find(x => x.owner === nid && x.prov === pid && !x.path.length && !x.inBattle && !x.retreat);
  if (!a) a = createArmy(nid, pid, 0, 0, 0);
  a.regs[t] += count; a.men[t] += 1000 * count;
  return a;
}
function mergeArmies(list) {
  if (list.length < 2) return list[0];
  const a = list[0];
  for (const b of list.slice(1)) {
    for (const t in UNITS) { a.regs[t] += b.regs[t]; a.men[t] += b.men[t]; }
    a.morale = Math.min(a.morale, b.morale); a.hero = a.hero || b.hero;
    destroyArmy(b);
  }
  return a;
}
function splitArmy(a) {
  if (armyRegs(a) < 2) return null;
  const b = createArmy(a.owner, a.prov, 0, 0, 0);
  for (const t in UNITS) {
    const k = Math.floor(a.regs[t] / 2); if (!k) continue;
    const share = a.men[t] * k / a.regs[t];
    a.regs[t] -= k; b.regs[t] += k; a.men[t] -= share; b.men[t] += share;
  }
  if (armyRegs(b) === 0) { // 1種しかない時
    const t = Object.keys(UNITS).find(t => a.regs[t] >= 1 && armyRegs(a) > 1) || 'inf';
    const share = a.men[t] / a.regs[t]; a.regs[t]--; b.regs[t]++; a.men[t] -= share; b.men[t] += share;
  }
  b.morale = a.morale;
  return b;
}

// ---------- 経路 ----------
function moveDays(a, pid) {
  const sp = a.owner === MONSTER ? 0 : natMod(nat(a.owner), 'moveSpeed');
  return 9 * TERRAIN[prov(pid).terrain].move / (1 + sp);
}
function findPath(nid, from, to) {
  if (from === to) return [];
  if (!canEnter(nid, to)) return null;
  const n = S.provinces.length;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[from] = 0; const open = [from];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const u = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (done[u]) continue; done[u] = 1; if (u === to) break;
    for (const v of prov(u).nb) {
      if (done[v] || !canEnter(nid, v)) continue;
      const c = dist[u] + TERRAIN[prov(v).terrain].move;
      if (c < dist[v]) { dist[v] = c; prev[v] = u; open.push(v); }
    }
  }
  if (prev[to] < 0) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.push(v);
  return path.reverse();
}
function bfsDist(nid, from, maxD) {
  const d = new Int16Array(S.provinces.length).fill(-1); d[from] = 0;
  const q = [from]; let h = 0;
  while (h < q.length) {
    const u = q[h++]; if (d[u] >= maxD) continue;
    for (const v of prov(u).nb) if (d[v] < 0 && canEnter(nid, v)) { d[v] = d[u] + 1; q.push(v); }
  }
  return d;
}
function moveArmyTo(a, to) {
  const path = findPath(a.owner, a.prov, to);
  if (!path) return false;
  if (!(a.path.length && path.length && a.path[0] === path[0])) a.prog = 0;
  a.path = path; return true;
}
function retreatArmy(a, from) {
  if (a.owner === MONSTER || armyMen(a) < 500) { destroyArmy(a); return; }
  const n = S.provinces.length, prev = new Int32Array(n).fill(-2); prev[from] = -1;
  const q = [from]; let h = 0, goal = -1;
  while (h < q.length && goal < 0) {
    const u = q[h++];
    for (const v of prov(u).nb) {
      if (prev[v] !== -2 || !canEnter(a.owner, v)) continue;
      prev[v] = u;
      const p = prov(v);
      if (friendly(a.owner, p.controller) && !S.armies.some(b => b.prov === v && hostile(b.owner, a.owner))) { goal = v; break; }
      q.push(v);
    }
  }
  if (goal < 0) { destroyArmy(a); return; }
  const path = []; for (let v = goal; v !== from; v = prev[v]) path.push(v);
  a.path = path.reverse(); a.prog = 0; a.retreat = true; a.morale = Math.max(0, a.morale); a.target = null;
}

// ---------- 日次処理 ----------
function dailyTick() {
  S.day++;
  moveArmies();
  resolveBattles();
  processSieges();
  processColonies();
  for (const a of S.armies) if (!a.inBattle && !a.retreat) a.morale = Math.min(maxMorale(a.owner), a.morale + maxMorale(a.owner) * 0.012);
  if (S.day % 3 === 0) aiArmyTick();
  if (S.day % 30 === 0) monthlyTick();
}

function moveArmies() {
  for (const a of [...S.armies]) {
    if (a.inBattle || !a.path.length) continue;
    const next = a.path[0];
    if (!a.retreat && !canEnter(a.owner, next)) { a.path = []; a.prog = 0; continue; }
    a.prog += 1 / moveDays(a, next) * (a.retreat ? 1.4 : 1);
    if (a.prog >= 1) {
      a.prog = 0; a.prov = next; a.path.shift();
      if (!a.path.length) a.retreat = false;
    }
  }
}

function resolveBattles() {
  const byProv = new Map();
  for (const a of S.armies) {
    a.inBattle = false; if (a.retreat) continue;
    let l = byProv.get(a.prov); if (!l) byProv.set(a.prov, l = []); l.push(a);
  }
  const active = new Set();
  for (const [pid, list] of byProv) {
    if (list.length < 2) continue;
    let A = -1, B = -1;
    outer: for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
      if (hostile(list[i].owner, list[j].owner)) { A = list[i].owner; B = list[j].owner; break outer; }
    if (A < 0) continue;
    const sA = list.filter(a => a.owner === A || (friendly(a.owner, A) && hostile(a.owner, B)));
    const sB = list.filter(a => !sA.includes(a) && (a.owner === B || (friendly(a.owner, B) && hostile(a.owner, A))));
    if (!sA.length || !sB.length) continue;
    active.add(pid);
    let bt = S.battles[pid];
    if (!bt || bt.A !== A || bt.B !== B) {
      bt = S.battles[pid] = { pid, A, B, day: 0, lossA: 0, lossB: 0, diceA: 0, diceB: 0 };
      if (sA.concat(sB).some(a => a.owner === S.player)) hooks.log(`⚔ ${prov(pid).name}で戦闘が始まった`, 'war');
    }
    battleDay(bt, sA, sB, pid);
  }
  for (const k in S.battles) if (!active.has(+k)) delete S.battles[k];
}
function sumMen(side) { let m = 0; for (const a of side) m += armyMen(a); return m; }
function sidePower(side, pid) { let p = 0; for (const a of side) p += rawPower(a) * (1 + combatMod(a, pid)); return p; }
function applyLoss(side, dmg, total) {
  for (const a of side) {
    const men = armyMen(a); if (men <= 0) continue;
    const loss = dmg * men / total;
    for (const t in UNITS) a.men[t] = Math.max(0, a.men[t] - loss * a.men[t] / men);
  }
}
function battleDay(bt, sA, sB, pid) {
  bt.day++;
  if (bt.day % 3 === 1) { bt.diceA = rint(0, 6); bt.diceB = rint(0, 6); }
  for (const a of sA) a.inBattle = true; for (const a of sB) a.inBattle = true;
  const p = prov(pid), tdef = TERRAIN[p.terrain].def;
  const defA = friendly(bt.A, p.controller), defB = friendly(bt.B, p.controller);
  const menA = sumMen(sA), menB = sumMen(sB);
  const dmgB = sidePower(sA, pid) * (3 + bt.diceA + (defA ? tdef : 0)) * 5;
  const dmgA = sidePower(sB, pid) * (3 + bt.diceB + (defB ? tdef : 0)) * 5;
  applyLoss(sA, dmgA, menA); applyLoss(sB, dmgB, menB);
  bt.lossA += Math.min(dmgA, menA); bt.lossB += Math.min(dmgB, menB);
  const mdA = dmgA / Math.max(menA, 1) * 8 + 0.03, mdB = dmgB / Math.max(menB, 1) * 8 + 0.03;
  for (const a of sA) a.morale -= mdA; for (const a of sB) a.morale -= mdB;
  const broken = a => a.morale <= 0 || armyMen(a) < 100;
  const leftA = sA.filter(a => !broken(a)), leftB = sB.filter(a => !broken(a));
  if (!leftA.length || !leftB.length) {
    const aWon = leftA.length > 0 || (!leftB.length && sumMen(sA) >= sumMen(sB));
    battleEnded(bt, aWon, sA, sB);
  }
  for (const a of sA.concat(sB)) if (broken(a) && S.armies.includes(a)) {
    if (armyMen(a) < 100) destroyArmy(a); else retreatArmy(a, pid);
  }
}
function battleEnded(bt, aWon, sA, sB) {
  const win = aWon ? bt.A : bt.B, lose = aWon ? bt.B : bt.A;
  const loserLoss = aWon ? bt.lossB : bt.lossA;
  for (const w of S.wars) {
    const sw = sideOf(w, win), sl = sideOf(w, lose);
    if (sw && sl && sw !== sl) { const v = Math.min(8, 1 + loserLoss / 2000); w.battle = clamp(w.battle + (sw === 'att' ? v : -v), -40, 40); break; }
  }
  const pInA = sA.some(a => a.owner === S.player), pInB = sB.some(a => a.owner === S.player);
  const loserSide = aWon ? sB : sA, winnerSide = aWon ? sA : sB;
  if (loserSide.some(a => a.bounty) && winnerSide.some(a => a.owner === S.player)) { nat(S.player).mil += 50; hooks.log('🎖 魔物の討伐に成功！ 軍事点+50', 'good'); }
  if (pInA || pInB) {
    const won = (pInA && aWon) || (pInB && !aWon);
    const my = pInA ? bt.lossA : bt.lossB, en = pInA ? bt.lossB : bt.lossA;
    hooks.log(`${won ? '🏆' : '💀'} ${prov(bt.pid).name}の戦い — ${won ? '勝利' : '敗北'}（自軍損害 ${fmtMen(my)} / 敵損害 ${fmtMen(en)}）`, won ? 'good' : 'bad');
  }
}

function siegeNeed(p) { return p.fort <= 0 ? 10 : 30 * p.fort; }
function processSieges() {
  const byProv = new Map();
  for (const a of S.armies) { if (a.retreat || a.inBattle) continue; let l = byProv.get(a.prov); if (!l) byProv.set(a.prov, l = []); l.push(a); }
  for (const p of S.provinces) {
    if (p.owner < 0) { p.siege = null; continue; }
    if (S.battles[p.id]) continue;
    const here = byProv.get(p.id) || [];
    const bes = here.filter(a => hostile(a.owner, p.controller));
    if (!bes.length) { p.siege = null; continue; }
    const lead = bes[0].owner;
    if (!p.siege || p.siege.by !== lead) p.siege = { by: lead, prog: 0, need: siegeNeed(p) };
    let men = 0, mages = 0; for (const a of bes) { men += armyMen(a); mages += a.regs.mage; }
    if (men < 1000 * Math.max(1, p.fort)) continue;
    p.siege.prog += (1 + 0.2 * mages) * (0.6 + Math.random() * 0.8);
    if (p.siege.prog >= p.siege.need) occupy(p, lead);
  }
}
function occupy(p, by) {
  const prevCtrl = p.controller;
  let to = by;
  if (friendly(by, p.owner) || (prevCtrl === MONSTER && !hostile(by, p.owner))) to = p.owner;
  p.controller = to; p.siege = null; mapDirty = true;
  if (p.owner === S.player || by === S.player) {
    if (to === S.player && p.owner === S.player) hooks.log(`🏰 ${p.name}を奪還した`, 'good');
    else if (by === S.player) hooks.log(`🏰 ${p.name}を占領した`, 'good');
    else hooks.log(`🔥 ${p.name}が${by === MONSTER ? '魔物' : nat(by).name}に占領された！`, 'bad');
  }
}
function processColonies() {
  for (const p of S.provinces) {
    if (!p.colonizing) continue;
    if (p.owner >= 0 || !nat(p.colonizing.by).alive) { p.colonizing = null; continue; }
    if (S.day >= p.colonizing.until) {
      const by = p.colonizing.by; p.colonizing = null;
      p.owner = p.controller = by; p.tax = p.prod = p.mp = 1; p.coreUntil = 0; mapDirty = true;
      if (by === S.player) hooks.log(`⛺ ${p.name}への入植が完了した`, 'good');
    }
  }
}
function colonizeCost(n) { return Math.round(50 * (1 - 0.05 * (n.tech.dip - 1))); }
function canColonize(nid, pid) {
  const p = prov(pid);
  if (p.owner >= 0 || p.colonizing) return false;
  return p.nb.some(q => prov(q).owner === nid);
}
function colonize(nid, pid) {
  const n = nat(nid), c = colonizeCost(n);
  if (n.gold < c || !canColonize(nid, pid)) return false;
  n.gold -= c; prov(pid).colonizing = { by: nid, start: S.day, until: S.day + 150 };
  return true;
}

// ---------- 内政 ----------
function devCost(n, p) { return Math.round((25 + dev(p) * 6) * (1 + natMod(n, 'devCost'))); }
function develop(n, p, type) {
  const pt = DEV_TYPES[type].pt, c = devCost(n, p);
  if (p.owner !== n.id || n[pt] < c) return false;
  n[pt] -= c; p[type]++; mapDirty = true; return true;
}
function buildCost(n, k) { return Math.round(BUILDINGS[k].cost * (1 + natMod(n, 'buildCost'))); }
function build(n, p, k) {
  const c = buildCost(n, k);
  if (p.owner !== n.id || p.controller !== n.id || p.b[k] || n.gold < c) return false;
  n.gold -= c; p.b[k] = true; if (k === 'walls') p.fort++;
  return true;
}
function techCost(n, t) { return Math.round((200 + 80 * n.tech[t]) * (1 + natMod(n, 'techCost'))); }
function buyTech(n, t) {
  const c = techCost(n, t); if (n[t] < c) return false;
  n[t] -= c; n.tech[t]++; return true;
}
function improveRelCost() { return 25; }
function improveRel(n, other) {
  if (n.dip < 25) return false;
  n.dip -= 25; addRel(n.id, other, 20 * (1 + natMod(n, 'relMult'))); return true;
}

// ---------- 戦争 ----------
function declareWar(att, def) {
  if (att === def || isAlly(att, def) || atWar(att, def) || hasTruce(att, def)) return null;
  const w = { id: S.nextWarId++, att: [att], def: [def], battle: 0, start: S.day, lastOffer: S.day, name: `${nat(att).short}・${nat(def).short}戦争` };
  for (const al of [...nat(def).allies]) {
    if (al === att || w.att.includes(al) || w.def.includes(al) || isAlly(al, att) || !nat(al).alive) continue;
    w.def.push(al);
    if (al === S.player) hooks.log(`🛡 同盟国${nat(def).name}の防衛戦争に参戦した（対${nat(att).name}）`, 'war');
  }
  const pendingPlayer = [];
  for (const al of [...nat(att).allies]) {
    if (w.att.includes(al) || w.def.includes(al) || isAlly(al, def) || !nat(al).alive) continue;
    if (al === S.player) { pendingPlayer.push(al); continue; }
    if (Math.random() < 0.6) w.att.push(al);
  }
  S.wars.push(w);
  addRel(att, def, -60);
  for (const n of S.nations) if (n.id > 0 && n.id !== att && n.id !== def) addRel(n.id, att, -4);
  nat(att).lastWar = S.day; nat(def).lastWar = S.day;
  mapDirty = true;
  if (def === S.player || w.def.includes(S.player)) {
    hooks.modal({ title: '⚠ 宣戦布告', body: `<b>${esc(nat(att).name)}</b>が${def === S.player ? '我が国' : esc(nat(def).name)}に宣戦布告してきた！<br>参戦国: ${w.att.map(i => esc(nat(i).name)).join('、')}`, buttons: [{ label: '迎え撃つ！' }] });
  } else if (att !== S.player && w.att.concat(w.def).some(id => isAlly(id, S.player) || id === S.player) === false) {
    hooks.log(`📜 ${nat(att).name}が${nat(def).name}に宣戦布告した`, 'info');
  }
  if (pendingPlayer.length) {
    hooks.modal({
      title: '📯 盟友からの参戦要請', body: `同盟国<b>${esc(nat(att).name)}</b>が<b>${esc(nat(def).name)}</b>に宣戦布告し、我が国に参戦を求めている。<br>断ると同盟は破棄される。`,
      buttons: [
        { label: '参戦する', fn: () => { if (S.wars.includes(w) && !sideOf(w, S.player) && !isAlly(S.player, def)) { w.att.push(S.player); mapDirty = true; } } },
        { label: '断る（同盟破棄）', fn: () => { breakAlliance(S.player, att); addRel(S.player, att, -40); } },
      ],
    });
  }
  return w;
}
function sideDev(w, side) { let d = 0; for (const id of w[side]) d += totalDev(id); return Math.max(1, d); }
function warScore(w) {
  const dA = sideDev(w, 'att'), dD = sideDev(w, 'def');
  let occD = 0, occA = 0;
  for (const p of S.provinces) {
    if (p.owner < 0 || p.controller === p.owner) continue;
    if (w.def.includes(p.owner) && w.att.includes(p.controller)) occD += dev(p);
    else if (w.att.includes(p.owner) && w.def.includes(p.controller)) occA += dev(p);
  }
  return clamp(occD / dD * 100 - occA / dA * 100 + w.battle, -100, 100);
}
function provPeaceCost(w, p, loseSide) { return dev(p) / sideDev(w, loseSide) * 100; }
function pickDemands(w, winSide, score) {
  const lose = winSide === 'att' ? 'def' : 'att';
  const cand = S.provinces.filter(p => w[lose].includes(p.owner) && w[winSide].includes(p.controller)).sort((a, b) => dev(b) - dev(a));
  const res = []; let tot = 0;
  for (const p of cand) { const c = provPeaceCost(w, p, lose); if (tot + c <= score + 0.01) { res.push(p.id); tot += c; } }
  return res;
}
function transferProvince(p, to) {
  const from = p.owner;
  p.owner = p.controller = to; p.coreUntil = S.day + 360 * 3; p.siege = null; p.colonizing = null;
  if (from > 0 && nat(from).capital === p.id) {
    const rest = ownedProvs(from);
    if (rest.length) { const c = rest.sort((a, b) => dev(b) - dev(a))[0]; nat(from).capital = c.id; }
  }
  mapDirty = true;
}
function makePeace(w, winSide, provIds) {
  if (!S.wars.includes(w)) return;
  const winners = winSide ? w[winSide] : [];
  const lead = winSide ? w[winSide][0] : null;
  const names = [];
  for (const pid of provIds) {
    const p = prov(pid); const to = winners.includes(p.controller) ? p.controller : lead;
    names.push(p.name); transferProvince(p, to);
  }
  const involved = w.att.includes(S.player) || w.def.includes(S.player);
  const msg = !winSide ? `🕊 ${w.name}は白紙和平で終結した` :
    `🕊 ${w.name}終結 — ${nat(lead).name}側の勝利${names.length ? '（割譲: ' + names.slice(0, 6).join('、') + (names.length > 6 ? ' 他' : '') + '）' : ''}`;
  hooks.log(msg, involved ? (winSide && w[winSide].includes(S.player) ? 'good' : winSide ? 'bad' : 'info') : 'info');
  endWar(w);
}
function endWar(w) {
  S.wars = S.wars.filter(x => x !== w);
  for (const a of w.att) for (const d of w.def) { if (a > 0 && d > 0) { nat(a).truces[d] = S.day + 360 * 5; nat(d).truces[a] = S.day + 360 * 5; } }
  for (const p of S.provinces) if (p.owner >= 0 && p.controller !== p.owner && p.controller !== MONSTER && !hostile(p.owner, p.controller)) p.controller = p.owner;
  for (const a of [...S.armies]) {
    if (a.owner === MONSTER) continue;
    if (!canEnter(a.owner, a.prov)) { a.prov = nat(a.owner).capital; a.path = []; a.prog = 0; a.retreat = false; }
    else if (a.path.some(q => !canEnter(a.owner, q))) { a.path = []; a.prog = 0; }
  }
  mapDirty = true;
  checkDeaths();
}
function checkDeaths() {
  for (const n of S.nations) {
    if (n.isMonster || !n.alive) continue;
    if (S.provinces.some(p => p.owner === n.id)) continue;
    n.alive = false;
    for (const a of S.armies.filter(a => a.owner === n.id)) destroyArmy(a);
    for (const o of S.nations) o.allies = (o.allies || []).filter(x => x !== n.id);
    n.allies = [];
    for (const p of S.provinces) if (p.controller === n.id) p.controller = p.owner;
    for (const w of [...S.wars]) {
      w.att = w.att.filter(x => x !== n.id); w.def = w.def.filter(x => x !== n.id);
      if (!w.att.length || !w.def.length) endWar(w);
    }
    hooks.log(`☠ ${n.name}は滅亡した`, n.id === S.player ? 'bad' : 'info');
    if (n.id === S.player) hooks.gameOver(false);
  }
}

// ---------- 月次処理 ----------
function monthlyTick() {
  for (const n of S.nations) {
    if (!n.alive || n.isMonster) continue;
    const inc = calcIncome(n);
    n.gold += inc.net;
    const mm = maxManpower(n);
    n.manpower = Math.min(mm, n.manpower + mm / 40 * (n.gold < 0 ? 0.5 : 1));
    n.adm = Math.min(999, n.adm + 3 + n.ruler.adm + natMod(n, 'admPts'));
    n.dip = Math.min(999, n.dip + 3 + n.ruler.dip + natMod(n, 'dipPts'));
    n.mil = Math.min(999, n.mil + 3 + n.ruler.mil + natMod(n, 'milPts'));
    n.timed = n.timed.filter(m => m.until > S.day);
    for (const a of S.armies) {
      if (a.owner !== n.id || a.inBattle || a.retreat) continue;
      if (n.gold < 0) a.morale = Math.max(0.1, a.morale - 0.3);
      if (prov(a.prov).controller !== n.id) continue;
      for (const t in UNITS) {
        const deficit = a.regs[t] * 1000 - a.men[t];
        if (deficit > 1) { const add = Math.min(deficit, a.regs[t] * 300, n.manpower); a.men[t] += add; n.manpower -= add; }
      }
    }
  }
  // 関係値の自然変化
  for (let a = 1; a < S.nations.length; a++) for (let b = a + 1; b < S.nations.length; b++) {
    const d = S.relBase[a][b] - S.rel[a][b];
    if (Math.abs(d) > 0.5) S.rel[a][b] = S.rel[b][a] = S.rel[a][b] + Math.sign(d) * 0.5;
  }
  monsterMonthly();
  aiMonthly();
  aiPeace();
  if (typeof playerEvents === 'function') playerEvents();
  if (S.day % 360 === 0) { mapDirty = true; if (typeof autosave === 'function') autosave(); }
  if (START_YEAR + S.day / 360 >= END_YEAR) hooks.gameOver(true);
}
function spawnMonsters(p, men) {
  const a = createArmy(MONSTER, p.id, Math.max(1, Math.round(men / 1000)), 0, 0, { name: pick(MONSTER_NAMES), expire: S.day + rint(540, 1080) });
  a.men.inf = men; return a;
}
function monsterMonthly() {
  const year = S.day / 360;
  for (const p of S.provinces) {
    if (p.owner <= 0) continue;
    const chance = p.terrain === 'miasma' ? 0.006 : 0.0009;
    if (Math.random() < chance && !S.armies.some(a => a.prov === p.id)) {
      const a = spawnMonsters(p, Math.round(2500 + Math.random() * 4500 + year * 120));
      if (p.owner === S.player) hooks.log(`👹 ${p.name}に${a.name}（${fmtMen(armyMen(a))}）が出現した！`, 'bad');
    }
  }
  for (const p of S.provinces) {
    if (p.controller === MONSTER && !S.armies.some(a => a.prov === p.id && a.owner === MONSTER) && Math.random() < 0.25) {
      p.controller = p.owner; mapDirty = true;
      if (p.owner === S.player) hooks.log(`🌿 魔物が${p.name}から去った`, 'info');
    }
  }
}
