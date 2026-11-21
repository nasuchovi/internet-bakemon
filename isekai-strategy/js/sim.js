'use strict';
// ===== ゲーム状態とシミュレーション =====
let S = null;      // ゲーム状態
let GRID = null;   // 州IDグリッド（陸も海も）
let mapDirty = true;
const hooks = { log: () => {}, modal: () => {}, gameOver: () => {} };

const nat = id => S.nations[id];
const prov = id => S.provinces[id];
const dev = p => p.tax + p.prod + p.mp;
const isRogue = id => id >= 0 && !!S.nations[id] && !!S.nations[id].isMonster; // 魔物・反乱軍
const landProvs = () => S.provinces.slice(0, S.landCount);
const adjOf = p => p.sea ? p.nb.concat(p.lnb) : p.nb.concat(p.snb);

function natMod(n, key) {
  if (!n || n.isMonster) return 0;
  let v = 0;
  const add = m => { if (m && m[key]) v += m[key]; };
  add(RACES[n.race].mods);
  if (n.cheat) add(CHEAT_BY_ID[n.cheat].mods);
  for (const m of n.timed) if (m.key === key && m.until > S.day) v += m.val;
  if (n.skills) for (const s of n.skills) add(SKILL_BY_ID[s].mods);
  if (n.advisors) for (const c of n.advisors) add(c.mods);
  if (n.artifacts) for (const a of n.artifacts) add(ARTIFACT_BY_ID[a].mods);
  if (key === 'taxMod' || key === 'prodMod') v += (n.tech.adm - 1) * 0.04;
  if (key === 'prodMod') v += (n.tech.dip - 1) * 0.03;
  if (key === 'combat') v += (n.tech.mil - 1) * 0.06;
  if (key === 'morale') v += (n.tech.mil - 1) * 0.1;
  if (key === 'taxMod') v += (n.stab || 0) * 0.03;
  return v;
}
function addTimed(n, key, val, days, label) { n.timed.push({ key, val, until: S.day + days, label }); }

// ---------- 外交関係 ----------
const isAlly = (a, b) => a !== b && a > 0 && b > 0 && !isRogue(a) && !isRogue(b) && nat(a).allies.includes(b);
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
  if (isRogue(a) || isRogue(b)) return true;
  return atWar(a, b);
}
const friendly = (a, b) => a >= 0 && b >= 0 && (a === b || isAlly(a, b) || coBelligerent(a, b));
const hasTruce = (a, b) => (nat(a).truces[b] || 0) > S.day;
function getRel(a, b) { return S.rel[a][b]; }
function addRel(a, b, v) { if (a === b || isRogue(a) || isRogue(b)) return; S.rel[a][b] = S.rel[b][a] = clamp(S.rel[a][b] + v, -100, 100); }
function addAlliance(a, b) { if (!isAlly(a, b)) { nat(a).allies.push(b); nat(b).allies.push(a); } }
function breakAlliance(a, b) { nat(a).allies = nat(a).allies.filter(x => x !== b); nat(b).allies = nat(b).allies.filter(x => x !== a); }
const vassalsOf = id => S.nations.filter(n => n.alive && n.overlord === id);

// ---------- 海 ----------
function fleetsAt(pid) { return S.fleets.filter(f => f.prov === pid); }
function seaBlocked(nid, pid) {
  let enemy = false, friend = false;
  for (const f of S.fleets) if (f.prov === pid && f.war > 0) { if (hostile(nid, f.owner)) enemy = true; else if (friendly(nid, f.owner)) friend = true; }
  return enemy && !friend;
}
function transportCap(nid) { let c = 0; for (const f of S.fleets) if (f.owner === nid) c += f.trans; return c; }
function regsAtSea(nid, except) { let r = 0; for (const a of S.armies) if (a.owner === nid && a !== except && prov(a.prov).sea) r += armyRegs(a); return r; }
function seaOK(nid, a) { return !isRogue(nid) && transportCap(nid) >= regsAtSea(nid, a) + (a ? armyRegs(a) : 1); }

function canEnter(nid, pid, sea) {
  const p = prov(pid);
  if (p.sea) return !!sea && !seaBlocked(nid, pid);
  if (isRogue(nid) || p.owner < 0) return true;
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
  let prod = p.prod * GOODS[p.good].price * 0.05 * (1 + natMod(n, 'prodMod') + (p.b.workshop ? 0.5 : 0)) + (p.dungeon && p.dungeon.cleared ? 1 : 0);
  if (p.coreUntil > S.day) { tax *= 0.5; prod *= 0.5; }
  if (p.religion !== n.religion) { tax *= 0.75; prod *= 0.75; }
  if (p.id === n.capital) tax += 1;
  return { tax, prod };
}
function provUnrest(p) {
  if (p.owner <= 0) return 0;
  const n = nat(p.owner); let u = 0;
  if (p.coreUntil > S.day) u += 2;
  if (p.religion !== n.religion) u += 3;
  if (n.gold < 0) u += 2;
  if (p.b.temple) u -= 1;
  u -= n.stab || 0;
  u += natMod(n, 'unrest');
  return u;
}

// 交易
function computeTrade() {
  if (S._trade && S._trade.day === S.day) return S._trade;
  const K = S.nodes.length, NN = S.nations.length;
  const val = new Array(K).fill(0), pow = [];
  for (let i = 0; i < K; i++) pow.push(new Float64Array(NN));
  for (const p of S.provinces) {
    if (p.sea) continue;
    val[p.node] += (p.prod * GOODS[p.good].price * 0.035 + dev(p) * 0.02) * (p.owner >= 0 ? 1 : 0.4);
    if (p.owner > 0 && p.controller === p.owner) pow[p.node][p.owner] += dev(p) * (p.coastal ? 1.2 : 1);
  }
  for (const n of S.nations) if (n.alive && n.merchants) for (const k of n.merchants) { pow[k][n.id] = pow[k][n.id] * 1.5 + 10; }
  const tot = pow.map(a => a.reduce((s, v) => s + v, 0));
  S._trade = { day: S.day, val, pow, tot };
  return S._trade;
}
function tradeIncome(n) {
  const T = computeTrade(); let t = 0;
  for (let i = 0; i < T.val.length; i++) if (T.tot[i] > 0) t += T.val[i] * T.pow[i][n.id] / T.tot[i];
  return t * (1 + natMod(n, 'tradeMod'));
}
function maxMerchants(n) { return 1 + Math.floor(n.tech.dip / 2) + natMod(n, 'merchants'); }

function calcIncome(n) {
  let tax = 0, prod = 0, d = 0, bmaint = 0;
  for (const p of S.provinces) {
    if (p.owner !== n.id) continue;
    d += dev(p); const r = provIncome(p, n); tax += r.tax; prod += r.prod;
    if (p.b.walls) bmaint += 0.4;
  }
  const trade = tradeIncome(n);
  let maint = 0, regs = 0, navy = 0;
  for (const a of S.armies) if (a.owner === n.id) for (const t in UNITS) { maint += a.regs[t] * UNITS[t].maint; regs += a.regs[t]; }
  for (const f of S.fleets) if (f.owner === n.id) navy += f.war * SHIPS.war.maint + f.trans * SHIPS.trans.maint;
  const fl = Math.floor(5 + d / 5);
  if (regs > fl) maint *= 1 + (regs - fl) / Math.max(1, fl) * 2;
  let tribute = 0;
  const base = tax + prod + trade - maint - navy - bmaint;
  if (n.overlord) tribute = -Math.max(0, base * 0.15);
  for (const v of vassalsOf(n.id)) tribute += Math.max(0, v._lastBase || 0) * 0.15;
  return { tax, prod, trade, maint, navy, bmaint, tribute, net: base + tribute, base, dev: d, regs, fl };
}
function manaIncome(n) {
  let m = 1;
  for (const p of S.provinces) if (p.owner === n.id && p.controller === n.id) { if (p.good === 'manastone') m += 1; if (p.terrain === 'miasma') m += 0.5; }
  for (const a of S.armies) if (a.owner === n.id) m += a.regs.mage * 0.05;
  return m + natMod(n, 'manaPts');
}
function nationPower(id) {
  let p = 0; for (const a of S.armies) if (a.owner === id) p += armyPower(a);
  if (!isRogue(id)) p += nat(id).manpower / 1000 * 0.4;
  return p;
}
function coalitionPower(id) { let p = nationPower(id); for (const al of nat(id).allies) p += nationPower(al) * 0.7; return p; }

// ---------- 人物（将軍・顧問） ----------
function newChar(opts) { return Object.assign({ id: S.nextCharId++, att: 0, def: 0, man: 0, sie: 0, mods: {}, summoned: false, until: S.day + 360 * 20 }, opts); }
function findGeneral(n, id) { return id == null || !n.generals ? null : n.generals.find(g => g.id === id) || null; }
function genOf(a) { return isRogue(a.owner) ? null : findGeneral(nat(a.owner), a.gen); }
function generalCost(n) { return 50; }
function recruitGeneral(n) {
  if (n.mil < generalCost(n)) return null;
  n.mil -= generalCost(n);
  let pips = 2 + rint(0, 4) + Math.floor((n.tech.mil - 1) / 2);
  const st = [0, 0, 0, 0]; while (pips-- > 0) st[rint(0, 3)]++;
  const g = newChar({ name: pick(RACES[n.race].rulers), title: '将軍', role: 'general', att: Math.min(6, st[0]), def: Math.min(6, st[1]), man: Math.min(6, st[2]), sie: Math.min(6, st[3]), until: S.day + 360 * rint(12, 25) });
  n.generals.push(g); return g;
}
function assignGeneral(a, gid) {
  for (const b of S.armies) if (b.owner === a.owner && b.gen === gid) b.gen = null;
  a.gen = gid;
}
function removeGeneral(n, g, reason) {
  n.generals = n.generals.filter(x => x !== g);
  for (const a of S.armies) if (a.owner === n.id && a.gen === g.id) a.gen = null;
  if (n.id === S.player && reason) hooks.log(`⚰ ${g.title} ${g.name}が${reason}`, 'bad');
}
function charMod(c, key) { return c && c.mods && c.mods[key] ? c.mods[key] : 0; }

// 召喚
function summonCost(n) { return Math.round((100 + 60 * (n.summonCount || 0)) * Math.max(0.3, 1 + natMod(n, 'summonCost'))); }
const SUMMON_GOLD = 50;
function canSummon(n) { return n.mana >= summonCost(n) && n.gold >= SUMMON_GOLD; }
function rollRarity(n) {
  const up = natMod(n, 'rarityUp') > 0;
  const tot = RARITIES.reduce((s, r) => s + (up ? r.w2 : r.w), 0);
  let x = Math.random() * tot;
  for (let i = 0; i < RARITIES.length; i++) { x -= up ? RARITIES[i].w2 : RARITIES[i].w; if (x <= 0) return i; }
  return 0;
}
function makeSummoned(n, ri) {
  const pool = SUMMON_POOL.filter(a => !a.minR || ri >= a.minR);
  const A = pick(pool), R = RARITIES[ri];
  const mods = {};
  for (const k in A.mods) { const v = A.mods[k] * R.mult; mods[k] = Math.abs(v) >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000; }
  const c = newChar({ name: `${pick(JP_SURNAMES)} ${pick(JP_GIVEN)}`, title: A.title, role: A.role, desc: A.desc, rarity: R.id, arch: A.id, mods, summoned: true, until: S.day + 360 * 60 });
  if (A.stats) { const bonus = ri - 1; [c.att, c.def, c.man, c.sie] = A.stats.map(v => clamp(v + bonus, 0, 7)); }
  return c;
}
function doSummon(n) {
  if (!canSummon(n)) return null;
  n.mana -= summonCost(n); n.gold -= SUMMON_GOLD; n.summonCount = (n.summonCount || 0) + 1;
  if (!natMod(n, 'noAccident') && Math.random() < 0.08) {
    const a = spawnMonsters(prov(n.capital), Math.round(4000 + S.day / 360 * 150));
    a.name = '魔界の軍勢';
    return { accident: true, army: a };
  }
  const c = makeSummoned(n, rollRarity(n));
  if (c.role === 'general') n.generals.push(c);
  else if (n.advisors.length < 3) n.advisors.push(c);
  else n.bench.push(c);
  return { char: c };
}

// ---------- 転生者の成長 ----------
function xpNeed(lv) { return 40 + lv * 20; }
function gainXP(n, v) {
  if (!n || !n.isPlayer) return;
  const r = n.ruler; r.xp = (r.xp || 0) + v; r.lv = r.lv || 1;
  while (r.xp >= xpNeed(r.lv)) { r.xp -= xpNeed(r.lv); r.lv++; n.sp = (n.sp || 0) + 1; hooks.log(`⭐ ${r.name}のレベルが${r.lv}に上がった！ スキルポイント+1`, 'good'); }
}
function canLearn(n, id) { const s = SKILL_BY_ID[id]; return (n.sp || 0) >= 1 && !n.skills.includes(id) && (!s.req || n.skills.includes(s.req)); }
function learnSkill(n, id) { if (!canLearn(n, id)) return false; n.sp--; n.skills.push(id); mapDirty = true; return true; }

// ---------- 軍 ----------
const armyMen = a => a.men.inf + a.men.cav + a.men.mage;
const armyRegs = a => a.regs.inf + a.regs.cav + a.regs.mage;
function maxMorale(nid) { return isRogue(nid) ? 2.5 : 3 + natMod(nat(nid), 'morale'); }
function combatMod(a, pid, vsRogue) {
  if (isRogue(a.owner)) return 0;
  const n = nat(a.owner); let m = natMod(n, 'combat');
  const g = genOf(a); m += charMod(g, 'combat'); if (vsRogue) m += charMod(g, 'vsMonster');
  if (a.hero) m += 0.3;
  if (pid != null && n.race === 'elf') { const t = prov(pid).terrain; if (t === 'forest' || t === 'marsh') m += 0.25; }
  return m;
}
function rawPower(a) {
  const cavP = UNITS.cav.power + (!isRogue(a.owner) ? natMod(nat(a.owner), 'cavPower') : 0);
  return (a.men.inf * UNITS.inf.power + a.men.cav * cavP + a.men.mage * UNITS.mage.power) / 1000;
}
function armyPower(a) { const g = genOf(a); return rawPower(a) * (1 + combatMod(a)) * (0.5 + 0.5 * a.morale / maxMorale(a.owner)) * (g ? 1 + (g.att + g.def) * 0.04 : 1); }
function unitName(nid, t) { return nid > 0 && !isRogue(nid) ? RACES[nat(nid).race].units[t] : UNITS[t].name; }

function createArmy(owner, pid, inf, cav, mage, opts = {}) {
  let name = opts.name;
  if (!name) { const n = nat(owner); n.armyCount = (n.armyCount || 0) + 1; name = `第${n.armyCount}軍`; }
  const a = {
    id: S.nextArmyId++, owner, prov: pid, regs: { inf, cav, mage }, men: { inf: inf * 1000, cav: cav * 1000, mage: mage * 1000 },
    morale: maxMorale(owner), path: [], prog: 0, retreat: false, inBattle: false, hero: !!opts.hero, name, target: null, expire: opts.expire || 0, gen: null, delve: null,
  };
  S.armies.push(a); return a;
}
function destroyArmy(a, killed) {
  const i = S.armies.indexOf(a); if (i >= 0) S.armies.splice(i, 1);
  if (killed && a.gen != null && !isRogue(a.owner) && Math.random() < 0.3) { const g = genOf(a); if (g && !g.summoned) removeGeneral(nat(a.owner), g, '戦死した'); }
  if (S.sel && S.sel.type === 'army' && S.sel.id === a.id) S.sel = { type: 'prov', id: a.prov };
}
function canRecruitAt(nid, pid) {
  const p = prov(pid);
  return !p.sea && p.owner === nid && p.controller === nid && !S.armies.some(a => a.prov === pid && hostile(a.owner, nid));
}
function recruit(nid, pid, t, count = 1) {
  const n = nat(nid), cost = UNITS[t].cost * count;
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
    if (a.gen == null && b.gen != null) a.gen = b.gen;
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
  if (armyRegs(b) === 0) {
    const t = Object.keys(UNITS).find(t => a.regs[t] >= 1) || 'inf';
    const share = a.men[t] / a.regs[t]; a.regs[t]--; b.regs[t]++; a.men[t] -= share; b.men[t] += share;
  }
  b.morale = a.morale;
  return b;
}

// ---------- 経路 ----------
function moveDays(a, pid) {
  let sp = 0;
  if (!isRogue(a.owner)) { sp = natMod(nat(a.owner), 'moveSpeed'); const g = genOf(a); if (g) sp += g.man * 0.05 + charMod(g, 'moveSpeed'); }
  return 9 * TERRAIN[prov(pid).terrain].move / (1 + sp);
}
function findPath(nid, from, to, army) {
  if (from === to) return [];
  const sea = seaOK(nid, army) || (army && prov(army.prov).sea);
  if (!canEnter(nid, to, sea)) return null;
  const n = S.provinces.length;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[from] = 0; const open = [from];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const u = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (done[u]) continue; done[u] = 1; if (u === to) break;
    for (const v of adjOf(prov(u))) {
      if (done[v] || !canEnter(nid, v, sea)) continue;
      const c = dist[u] + TERRAIN[prov(v).terrain].move + (prov(v).sea ? 0.5 : 0);
      if (c < dist[v]) { dist[v] = c; prev[v] = u; open.push(v); }
    }
  }
  if (prev[to] < 0) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.push(v);
  return path.reverse();
}
function bfsDist(nid, from, maxD, army) {
  const sea = seaOK(nid, army);
  const d = new Int16Array(S.provinces.length).fill(-1); d[from] = 0;
  const q = [from]; let h = 0;
  while (h < q.length) {
    const u = q[h++]; if (d[u] >= maxD) continue;
    for (const v of adjOf(prov(u))) if (d[v] < 0 && canEnter(nid, v, sea)) { d[v] = d[u] + 1; q.push(v); }
  }
  return d;
}
function moveArmyTo(a, to) {
  const path = findPath(a.owner, a.prov, to, a);
  if (!path) return false;
  if (!(a.path.length && path.length && a.path[0] === path[0])) a.prog = 0;
  a.path = path; a.delve = null; return true;
}
function retreatArmy(a, from) {
  if (isRogue(a.owner) || armyMen(a) < 500) { destroyArmy(a, true); return; }
  const n = S.provinces.length, prev = new Int32Array(n).fill(-2); prev[from] = -1;
  const q = [from]; let h = 0, goal = -1;
  while (h < q.length && goal < 0) {
    const u = q[h++];
    for (const v of prov(u).nb) {
      if (prev[v] !== -2 || prov(v).sea || !canEnter(a.owner, v, false)) continue;
      prev[v] = u;
      const p = prov(v);
      if (friendly(a.owner, p.controller) && !S.armies.some(b => b.prov === v && hostile(b.owner, a.owner))) { goal = v; break; }
      q.push(v);
    }
  }
  if (goal < 0) { destroyArmy(a, true); return; }
  const path = []; for (let v = goal; v !== from; v = prev[v]) path.push(v);
  a.path = path.reverse(); a.prog = 0; a.retreat = true; a.morale = Math.max(0, a.morale); a.target = null; a.delve = null;
}

// 艦隊
function createFleet(owner, pid, war, trans) {
  const n = nat(owner); n.fleetCount = (n.fleetCount || 0) + 1;
  const f = { id: S.nextFleetId++, owner, prov: pid, war, trans, str: 1, path: [], prog: 0, retreat: false, name: `第${n.fleetCount}艦隊`, inBattle: false };
  S.fleets.push(f); return f;
}
function destroyFleet(f) { S.fleets = S.fleets.filter(x => x !== f); if (S.sel && S.sel.type === 'fleet' && S.sel.id === f.id) S.sel = { type: 'prov', id: f.prov }; }
function buildShip(nid, pid, type) {
  const n = nat(nid), p = prov(pid), c = SHIPS[type].cost;
  if (p.sea || p.owner !== nid || p.controller !== nid || !p.coastal || n.gold < c) return null;
  n.gold -= c;
  const z = p.snb[0];
  let f = S.fleets.find(x => x.owner === nid && x.prov === z && !x.path.length && !x.inBattle);
  if (!f) f = createFleet(nid, z, 0, 0);
  f[type]++;
  return f;
}
function findFleetPath(nid, from, to) {
  if (from === to) return [];
  if (!prov(to).sea) return null;
  const n = S.provinces.length, prev = new Int32Array(n).fill(-2); prev[from] = -1;
  const q = [from]; let h = 0;
  while (h < q.length) {
    const u = q[h++]; if (u === to) break;
    for (const v of prov(u).nb) if (prev[v] === -2) { prev[v] = u; q.push(v); }
  }
  if (prev[to] === -2) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.push(v);
  return path.reverse();
}
function moveFleetTo(f, to) { const p = findFleetPath(f.owner, f.prov, to); if (!p) return false; if (!(f.path.length && p.length && f.path[0] === p[0])) f.prog = 0; f.path = p; return true; }
function homePort(nid, from) {
  const n = S.provinces.length, seen = new Uint8Array(n); seen[from] = 1;
  const q = [from]; let h = 0;
  while (h < q.length) {
    const u = q[h++];
    if (prov(u).lnb.some(l => prov(l).controller === nid)) return u;
    for (const v of prov(u).nb) if (!seen[v]) { seen[v] = 1; q.push(v); }
  }
  return null;
}

// ---------- 日次処理 ----------
function dailyTick() {
  S.day++;
  moveArmies();
  moveFleets();
  resolveBattles();
  navalBattles();
  seaHazards();
  processSieges();
  processColonies();
  processDelves();
  for (const a of S.armies) if (!a.inBattle && !a.retreat) a.morale = Math.min(maxMorale(a.owner), a.morale + maxMorale(a.owner) * 0.012);
  if (S.day % 3 === 0) aiArmyTick();
  if (S.day % 30 === 0) monthlyTick();
}

function moveArmies() {
  for (const a of [...S.armies]) {
    if (a.inBattle || !a.path.length) continue;
    const next = a.path[0];
    const sea = prov(next).sea ? (prov(a.prov).sea || seaOK(a.owner, a)) : false;
    if (!a.retreat && !canEnter(a.owner, next, sea)) { a.path = []; a.prog = 0; continue; }
    a.prog += 1 / moveDays(a, next) * (a.retreat ? 1.4 : 1);
    if (a.prog >= 1) {
      a.prog = 0; a.prov = next; a.path.shift();
      if (!a.path.length) a.retreat = false;
    }
  }
}
function moveFleets() {
  for (const f of S.fleets) {
    if (f.inBattle || !f.path.length) continue;
    f.prog += 1 / 6 * (f.retreat ? 1.4 : 1);
    if (f.prog >= 1) { f.prog = 0; f.prov = f.path.shift(); if (!f.path.length) f.retreat = false; }
  }
}

function resolveBattles() {
  const byProv = new Map();
  for (const a of S.armies) {
    a.inBattle = false; if (a.retreat || prov(a.prov).sea) continue;
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
function sidePower(side, pid, vsRogue) { let p = 0; for (const a of side) p += rawPower(a) * (1 + combatMod(a, pid, vsRogue)); return p; }
function bestGen(side) { let b = null; for (const a of side) { const g = genOf(a); if (g && (!b || g.att + g.def > b.att + b.def)) b = g; } return b; }
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
  const gA = bestGen(sA), gB = bestGen(sB);
  const pipA = Math.max(0, (gA ? gA.att : 0) - (gB ? gB.def : 0)), pipB = Math.max(0, (gB ? gB.att : 0) - (gA ? gA.def : 0));
  const menA = sumMen(sA), menB = sumMen(sB);
  const dmgB = sidePower(sA, pid, isRogue(bt.B)) * (3 + bt.diceA + pipA + (defA ? tdef : 0)) * 5;
  const dmgA = sidePower(sB, pid, isRogue(bt.A)) * (3 + bt.diceB + pipB + (defB ? tdef : 0)) * 5;
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
    if (armyMen(a) < 100) destroyArmy(a, true); else retreatArmy(a, pid);
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
  if (winnerSide.some(a => a.owner === S.player)) {
    gainXP(nat(S.player), loserSide.some(a => isRogue(a.owner)) ? 3 : 5);
    if (loserSide.some(a => a.bounty)) { nat(S.player).mil += 50; hooks.log('🎖 魔物の討伐に成功！ 軍事点+50', 'good'); }
  }
  if (pInA || pInB) {
    const won = (pInA && aWon) || (pInB && !aWon);
    const my = pInA ? bt.lossA : bt.lossB, en = pInA ? bt.lossB : bt.lossA;
    hooks.log(`${won ? '🏆' : '💀'} ${prov(bt.pid).name}の戦い — ${won ? '勝利' : '敗北'}（自軍損害 ${fmtMen(my)} / 敵損害 ${fmtMen(en)}）`, won ? 'good' : 'bad');
  }
}

function navalBattles() {
  for (const f of S.fleets) f.inBattle = false;
  const byProv = new Map();
  for (const f of S.fleets) { if (f.retreat) continue; let l = byProv.get(f.prov); if (!l) byProv.set(f.prov, l = []); l.push(f); }
  for (const [pid, list] of byProv) {
    if (list.length < 2) continue;
    let A = -1, B = -1;
    outer: for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
      if (hostile(list[i].owner, list[j].owner) && (list[i].war + list[j].war) > 0) { A = list[i].owner; B = list[j].owner; break outer; }
    if (A < 0) continue;
    const sA = list.filter(f => friendly(f.owner, A) && hostile(f.owner, B)), sB = list.filter(f => friendly(f.owner, B) && hostile(f.owner, A));
    const pw = side => side.reduce((s, f) => s + f.war * f.str * (1 + natMod(nat(f.owner), 'combat') * 0.5), 0);
    const hp = side => side.reduce((s, f) => s + f.war + f.trans * 0.4, 0) || 1;
    const dA = pw(sB) * (2 + rint(0, 6)) * 0.03 / hp(sA), dB = pw(sA) * (2 + rint(0, 6)) * 0.03 / hp(sB);
    for (const f of sA) { f.inBattle = true; f.str -= dA; } for (const f of sB) { f.inBattle = true; f.str -= dB; }
    for (const f of sA.concat(sB)) if (f.str <= 0.2) {
      const keep = 0.5 + Math.max(0, f.str);
      f.war = Math.floor(f.war * keep); f.trans = Math.floor(f.trans * keep);
      const winner = sA.includes(f) ? sB : sA;
      if (f.owner === S.player || winner.some(x => x.owner === S.player)) hooks.log(`⚓ ${prov(pid).name}の海戦 — ${f.owner === S.player ? '敗北、艦隊は退却した' : '勝利'}`, f.owner === S.player ? 'bad' : 'good');
      if (f.war + f.trans <= 0) { destroyFleet(f); continue; }
      const home = homePort(f.owner, f.prov);
      f.str = Math.max(0.05, f.str); f.retreat = true; f.path = home != null && home !== f.prov ? findFleetPath(f.owner, f.prov, home) || [] : [];
      if (!f.path.length) f.retreat = false;
    }
  }
}
function seaHazards() {
  for (const a of [...S.armies]) {
    const p = prov(a.prov); if (!p.sea) continue;
    if (seaBlocked(a.owner, a.prov)) {
      for (const t in UNITS) a.men[t] *= 0.95; a.morale -= 0.1;
    }
    if (transportCap(a.owner) < regsAtSea(a.owner)) for (const t in UNITS) a.men[t] *= 0.97; // 輸送艦不足
    if (armyMen(a) < 300) { if (a.owner === S.player) hooks.log(`🌊 ${a.name}は${p.name}で海の藻屑となった`, 'bad'); destroyArmy(a, true); }
  }
}

function siegeNeed(p) { return p.fort <= 0 ? 10 : 30 * p.fort; }
function processSieges() {
  const byProv = new Map();
  for (const a of S.armies) { if (a.retreat || a.inBattle || a.delve) continue; let l = byProv.get(a.prov); if (!l) byProv.set(a.prov, l = []); l.push(a); }
  for (const p of S.provinces) {
    if (p.owner < 0) { p.siege = null; continue; }
    if (S.battles[p.id]) continue;
    const here = byProv.get(p.id) || [];
    const bes = here.filter(a => hostile(a.owner, p.controller));
    if (!bes.length) { p.siege = null; continue; }
    const lead = bes[0].owner;
    if (!p.siege || p.siege.by !== lead) p.siege = { by: lead, prog: 0, need: siegeNeed(p) };
    let men = 0, mages = 0, gs = 0, bonus = 0;
    for (const a of bes) { men += armyMen(a); mages += a.regs.mage; const g = genOf(a); if (g) { gs = Math.max(gs, g.sie); bonus = Math.max(bonus, charMod(g, 'siege')); } }
    if (men < 1000 * Math.max(1, p.fort)) continue;
    let rate = (1 + 0.2 * mages) * (1 + gs * 0.1 + bonus + (isRogue(lead) ? 0 : natMod(nat(lead), 'siege'))) * (0.6 + Math.random() * 0.8);
    if (p.coastal && p.snb.some(z => S.fleets.some(f => f.prov === z && f.war > 0 && hostile(f.owner, p.controller)))) rate *= 1.25; // 海上封鎖
    p.siege.prog += rate;
    if (p.siege.prog >= p.siege.need) occupy(p, lead);
  }
}
function occupy(p, by) {
  const prevCtrl = p.controller;
  let to = by;
  if (friendly(by, p.owner) || (isRogue(prevCtrl) && !hostile(by, p.owner))) to = p.owner;
  p.controller = to; p.siege = null; mapDirty = true;
  if (by === REBEL && p.owner > 0) { const n = nat(p.owner); n.stab = Math.max(-3, (n.stab || 0) - 1); }
  if (p.owner === S.player || by === S.player) {
    if (to === S.player && p.owner === S.player) hooks.log(`🏰 ${p.name}を奪還した`, 'good');
    else if (by === S.player) hooks.log(`🏰 ${p.name}を占領した`, 'good');
    else hooks.log(`🔥 ${p.name}が${nat(by).name}に占領された！${by === REBEL ? '（安定度-1）' : ''}`, 'bad');
  }
}
function processColonies() {
  for (const p of S.provinces) {
    if (p.colonizing) {
      if (p.owner >= 0 || !nat(p.colonizing.by).alive) p.colonizing = null;
      else if (S.day >= p.colonizing.until) {
        const by = p.colonizing.by; p.colonizing = null;
        p.owner = p.controller = by; p.tax = p.prod = p.mp = 1; p.coreUntil = 0; mapDirty = true;
        if (by === S.player) hooks.log(`⛺ ${p.name}への入植が完了した`, 'good');
      }
    }
    if (p.converting) {
      if (p.owner !== p.converting.by) p.converting = null;
      else if (S.day >= p.converting.until) {
        p.religion = nat(p.owner).religion; p.converting = null; mapDirty = true;
        if (p.owner === S.player) hooks.log(`⛪ ${p.name}の改宗が完了した`, 'good');
      }
    }
  }
}
function colonizeCost(n) { return Math.round(50 * (1 - 0.05 * (n.tech.dip - 1))); }
function canColonize(nid, pid) {
  const p = prov(pid);
  if (p.sea || p.owner >= 0 || p.colonizing) return false;
  if (p.nb.some(q => prov(q).owner === nid)) return true;
  return p.snb.some(z => prov(z).lnb.some(l => prov(l).owner === nid));
}
function colonize(nid, pid) {
  const n = nat(nid), c = colonizeCost(n);
  if (n.gold < c || !canColonize(nid, pid)) return false;
  n.gold -= c; prov(pid).colonizing = { by: nid, start: S.day, until: S.day + 150 };
  return true;
}
const CONVERT_COST = 40;
function canConvert(nid, pid) { const p = prov(pid); return !p.sea && p.owner === nid && p.controller === nid && p.religion !== nat(nid).religion && !p.converting; }
function convert(nid, pid) {
  const n = nat(nid); if (!canConvert(nid, pid) || n.gold < CONVERT_COST) return false;
  n.gold -= CONVERT_COST; prov(pid).converting = { by: nid, start: S.day, until: S.day + 240 }; return true;
}

// ダンジョン
function delveNeed(lv) { return 20 + lv * 10; }
function canDelve(a) {
  const p = prov(a.prov);
  if (!p.dungeon || p.dungeon.cleared || a.inBattle || a.retreat || isRogue(a.owner) || a.delve) return false;
  return p.owner < 0 || friendly(a.owner, p.controller);
}
function startDelve(a) {
  if (!canDelve(a)) return false;
  a.path = []; a.prog = 0; a.delve = { pid: a.prov, prog: 0, need: delveNeed(prov(a.prov).dungeon.lv) };
  return true;
}
function processDelves() {
  for (const a of [...S.armies]) {
    if (!a.delve) continue;
    if (a.prov !== a.delve.pid || a.path.length) { a.delve = null; continue; }
    if (a.inBattle) continue;
    a.delve.prog++;
    if (a.delve.prog >= a.delve.need) finishDelve(a);
  }
}
function finishDelve(a) {
  const p = prov(a.prov), d = p.dungeon, n = nat(a.owner); a.delve = null;
  if (!d || d.cleared) return;
  const g = genOf(a);
  const power = armyPower(a) + (g ? (g.att + g.def) * 1.5 : 0);
  const chance = clamp(0.3 + power / (d.lv * 6) * 0.35, 0.1, 0.95);
  const ok = Math.random() < chance;
  const lossF = rnd(0.04, 0.12) * d.lv / 2.5 * (ok ? 1 : 1.6);
  const before = armyMen(a);
  for (const t in UNITS) a.men[t] *= 1 - lossF;
  const res = { ok, lv: d.lv, loss: Math.round(before - armyMen(a)), pname: p.name };
  if (ok) {
    d.cleared = true;
    res.gold = 40 * d.lv + rint(0, 30); res.mana = 15 * d.lv; res.xp = 8 * d.lv;
    n.gold += res.gold; n.mana = (n.mana || 0) + res.mana; gainXP(n, res.xp);
    const avail = ARTIFACTS.filter(x => !S.nations.some(o => o.artifacts && o.artifacts.includes(x.id)));
    if (avail.length && Math.random() < Math.min(0.65, 0.13 * d.lv)) { const art = pick(avail); n.artifacts.push(art.id); res.artifact = art; }
  }
  if (a.owner === S.player) hooks.modal(delveModal(res));
}
function delveModal(r) {
  if (!r.ok) return { title: '💀 ダンジョン攻略失敗', body: `${esc(r.pname)}のダンジョン（Lv${r.lv}）の魔物は手強く、撤退を余儀なくされた。<br>損害：${fmtMen(r.loss)}<br><span class="note">兵を補充し、将軍を付けて再挑戦しよう。</span>`, buttons: [{ label: '撤退する' }] };
  return {
    title: '💎 ダンジョン攻略成功！', body: `${esc(r.pname)}のダンジョン（Lv${r.lv}）を踏破した！<br><br>💰 金貨 +${r.gold}<br>🔮 魔力 +${r.mana}<br>⭐ 経験値 +${r.xp}<br>損害：${fmtMen(r.loss)}${r.artifact ? `<br><br>🏺 秘宝<b>「${esc(r.artifact.name)}」</b>を手に入れた！<br><span class="note">${esc(r.artifact.desc)}</span>` : ''}<br><br><span class="note">踏破したダンジョンは冒険者ギルドが管理し、生産収入+1/月をもたらす。</span>`,
    buttons: [{ label: '凱旋する' }],
  };
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
function buyTech(n, t) { const c = techCost(n, t); if (n[t] < c) return false; n[t] -= c; n.tech[t]++; return true; }
function improveRelCost() { return 25; }
function improveRel(n, other) { if (n.dip < 25) return false; n.dip -= 25; addRel(n.id, other, 20 * (1 + natMod(n, 'relMult'))); return true; }
function stabCost(n) { return 100 + Math.max(0, n.stab || 0) * 50; }
function raiseStab(n) { const c = stabCost(n); if (n.adm < c || (n.stab || 0) >= 3) return false; n.adm -= c; n.stab = (n.stab || 0) + 1; return true; }

// 属国
function annexCost(o, v) { return Math.round(totalDev(v.id) * 8 * Math.max(0.3, 1 + natMod(o, 'annexCost'))); }
const ANNEX_YEARS = 5;
function canAnnex(o, v) { return v.overlord === o.id && S.day - v.vassalSince >= 360 * ANNEX_YEARS && getRel(o.id, v.id) >= 30 && !warsOf(v.id).length; }
function annex(o, v) {
  if (!canAnnex(o, v) || o.dip < annexCost(o, v)) return false;
  o.dip -= annexCost(o, v);
  for (const p of ownedProvs(v.id)) { p.owner = p.controller = o.id; p.coreUntil = 0; p.siege = null; }
  for (const a of S.armies.filter(a => a.owner === v.id)) destroyArmy(a);
  for (const f of S.fleets.filter(f => f.owner === v.id)) f.owner = o.id;
  mapDirty = true;
  hooks.log(`👑 ${o.name}が${v.name}を外交併合した`, o.id === S.player ? 'good' : 'info');
  checkDeaths();
  return true;
}
function makeVassal(o, v) {
  for (const a of [...v.allies]) breakAlliance(v.id, a);
  for (const sub of vassalsOf(v.id)) sub.overlord = null;
  v.overlord = o.id; v.vassalSince = S.day; v.merchants = [];
  addAlliance(o.id, v.id); addRel(o.id, v.id, 30);
  mapDirty = true;
}
function vassalAccepts(o, v) {
  return !v.overlord && !vassalsOf(v.id).length && !hostile(o.id, v.id) && v.id !== S.player && !v.demonKing &&
    nationPower(v.id) * 4 < nationPower(o.id) && totalDev(v.id) * 3 < totalDev(o.id) && getRel(o.id, v.id) >= 30;
}
function vassalPeaceCost(w, loseSide) { return Math.min(100, totalDev(w[loseSide][0]) / sideDev(w, loseSide) * 100 * 0.7); }

// ---------- 戦争 ----------
function declareWar(att, def) {
  if (att === def || isAlly(att, def) || atWar(att, def) || hasTruce(att, def)) return null;
  if (nat(def).overlord && nat(def).overlord !== att) def = nat(def).overlord; // 属国への攻撃は宗主国との戦争
  if (isAlly(att, def) || atWar(att, def)) return null;
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
    if (nat(al).overlord === att || Math.random() < 0.6) w.att.push(al);
  }
  S.wars.push(w);
  addRel(att, def, -60);
  for (const n of S.nations) if (n.id > 0 && !n.isMonster && n.id !== att && n.id !== def) addRel(n.id, att, -4);
  nat(att).lastWar = S.day; nat(def).lastWar = S.day;
  mapDirty = true;
  if (w.def.includes(S.player)) {
    hooks.modal({ title: '⚠ 宣戦布告', body: `<b>${esc(nat(att).name)}</b>が${def === S.player ? '我が国' : esc(nat(def).name)}に宣戦布告してきた！<br>敵：${w.att.map(i => esc(nat(i).name)).join('、')}<br>味方：${w.def.map(i => esc(nat(i).name)).join('、')}`, buttons: [{ label: '迎え撃つ！' }] });
  } else if (att !== S.player) hooks.log(`📜 ${nat(att).name}が${nat(def).name}に宣戦布告した`, 'info');
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
  p.owner = p.controller = to; p.coreUntil = S.day + 360 * 3; p.siege = null; p.colonizing = null; p.converting = null;
  if (from > 0 && nat(from).capital === p.id) {
    const rest = ownedProvs(from);
    if (rest.length) { const c = rest.sort((a, b) => dev(b) - dev(a))[0]; nat(from).capital = c.id; }
  }
  if (from > 0 && !S.provinces.some(q => q.owner === from)) nat(from).killedBy = to;
  mapDirty = true;
}
function makePeace(w, winSide, provIds, vassalize) {
  if (!S.wars.includes(w)) return;
  const winners = winSide ? w[winSide] : [];
  const lead = winSide ? w[winSide][0] : null;
  const loseLead = winSide ? w[winSide === 'att' ? 'def' : 'att'][0] : null;
  const names = [];
  for (const pid of provIds) {
    const p = prov(pid);
    if (vassalize && p.owner === loseLead) continue;
    const to = winners.includes(p.controller) ? p.controller : lead;
    names.push(p.name); transferProvince(p, to);
  }
  const involved = w.att.includes(S.player) || w.def.includes(S.player);
  let msg = !winSide ? `🕊 ${w.name}は白紙和平で終結した` :
    `🕊 ${w.name}終結 — ${nat(lead).name}側の勝利${names.length ? '（割譲: ' + names.slice(0, 6).join('、') + (names.length > 6 ? ' 他' : '') + '）' : ''}`;
  if (vassalize && loseLead != null) msg += `　${nat(loseLead).name}は${nat(lead).name}の属国となった`;
  hooks.log(msg, involved ? (winSide && w[winSide].includes(S.player) ? 'good' : winSide ? 'bad' : 'info') : 'info');
  endWar(w);
  if (vassalize && loseLead != null && nat(loseLead).alive) makeVassal(nat(lead), nat(loseLead));
}
function endWar(w) {
  S.wars = S.wars.filter(x => x !== w);
  for (const a of w.att) for (const d of w.def) { if (a > 0 && d > 0) { nat(a).truces[d] = S.day + 360 * 5; nat(d).truces[a] = S.day + 360 * 5; } }
  for (const p of S.provinces) if (p.owner >= 0 && p.controller !== p.owner && !isRogue(p.controller) && !hostile(p.owner, p.controller)) p.controller = p.owner;
  for (const a of [...S.armies]) {
    if (isRogue(a.owner)) continue;
    const here = prov(a.prov);
    if (!here.sea && !canEnter(a.owner, a.prov, false)) { a.prov = nat(a.owner).capital; a.path = []; a.prog = 0; a.retreat = false; }
    else if (a.path.some(q => !prov(q).sea && !canEnter(a.owner, q, false))) { a.path = []; a.prog = 0; }
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
    for (const f of S.fleets.filter(f => f.owner === n.id)) destroyFleet(f);
    for (const o of S.nations) o.allies = (o.allies || []).filter(x => x !== n.id);
    for (const v of vassalsOf(n.id)) v.overlord = null;
    n.allies = [];
    for (const p of S.provinces) if (p.controller === n.id) p.controller = p.owner;
    for (const w of [...S.wars]) {
      w.att = w.att.filter(x => x !== n.id); w.def = w.def.filter(x => x !== n.id);
      if (!w.att.length || !w.def.length) endWar(w);
    }
    hooks.log(`☠ ${n.name}は滅亡した`, n.id === S.player ? 'bad' : 'info');
    if (n.demonKing) S.demonKingSlayer = n.killedBy;
    if (n.id === S.player) hooks.gameOver(false);
  }
}

// ---------- 月次処理 ----------
function monthlyTick() {
  S._trade = null;
  for (const n of S.nations) {
    if (!n.alive || n.isMonster) continue;
    const inc = calcIncome(n);
    n._lastBase = inc.base;
    n.gold += inc.net;
    const mm = maxManpower(n);
    n.manpower = Math.min(mm, n.manpower + mm / 40 * (n.gold < 0 ? 0.5 : 1));
    n.adm = Math.min(999, n.adm + 3 + n.ruler.adm + natMod(n, 'admPts'));
    n.dip = Math.min(999, n.dip + 3 + n.ruler.dip + natMod(n, 'dipPts'));
    n.mil = Math.min(999, n.mil + 3 + n.ruler.mil + natMod(n, 'milPts'));
    n.mana = Math.min(999, (n.mana || 0) + manaIncome(n));
    n.timed = n.timed.filter(m => m.until > S.day);
    for (const g of [...n.generals]) if (g.until <= S.day) removeGeneral(n, g, g.summoned ? '元の世界へ帰還した' : '老齢で引退した');
    for (const a of S.armies) {
      if (a.owner !== n.id || a.inBattle || a.retreat) continue;
      if (n.gold < 0) a.morale = Math.max(0.1, a.morale - 0.3);
      if (prov(a.prov).controller !== n.id) continue;
      for (const t in UNITS) {
        const deficit = a.regs[t] * 1000 - a.men[t];
        if (deficit > 1) { const add = Math.min(deficit, a.regs[t] * 300, n.manpower); a.men[t] += add; n.manpower -= add; }
      }
    }
    for (const f of S.fleets) if (f.owner === n.id && !f.inBattle && prov(f.prov).lnb.some(l => prov(l).controller === n.id)) f.str = Math.min(1, f.str + 0.25);
    if (n.overlord && !nat(n.overlord).alive) n.overlord = null;
  }
  if (S.player >= 0 && nat(S.player).alive) gainXP(nat(S.player), 2);
  for (let a = 1; a < REBEL; a++) for (let b = a + 1; b < REBEL; b++) {
    const d = S.relBase[a][b] - S.rel[a][b];
    if (Math.abs(d) > 0.5) S.rel[a][b] = S.rel[b][a] = S.rel[a][b] + Math.sign(d) * 0.5;
  }
  rogueMonthly();
  aiMonthly();
  aiPeace();
  checkVictories();
  if (typeof playerEvents === 'function') playerEvents();
  if (S.day % 360 === 0) { mapDirty = true; if (typeof autosave === 'function') autosave(); }
  if (START_YEAR + S.day / 360 >= END_YEAR) hooks.gameOver(true);
}
function spawnMonsters(p, men) {
  const a = createArmy(MONSTER, p.id, Math.max(1, Math.round(men / 1000)), 0, 0, { name: pick(MONSTER_NAMES), expire: S.day + rint(540, 1080) });
  a.men.inf = men; return a;
}
function spawnRebels(p) {
  const men = 1500 + dev(p) * 250 + S.day / 360 * 60;
  const a = createArmy(REBEL, p.id, Math.max(1, Math.round(men / 1000)), 0, 0, { name: p.religion !== nat(p.owner).religion ? `${RELIGIONS[p.religion].name}の反乱軍` : '農民反乱軍', expire: S.day + rint(600, 1000) });
  a.men.inf = men; a.target = p.owner; return a;
}
function rogueMonthly() {
  const year = S.day / 360;
  for (const p of S.provinces) {
    if (p.owner <= 0) continue;
    const n = nat(p.owner);
    const chance = (p.terrain === 'miasma' ? 0.006 : 0.0009) * (1 + natMod(n, 'monsterSpawn'));
    if (Math.random() < chance && !S.armies.some(a => a.prov === p.id)) {
      const a = spawnMonsters(p, Math.round(2500 + Math.random() * 4500 + year * 120));
      if (p.owner === S.player) hooks.log(`👹 ${p.name}に${a.name}（${fmtMen(armyMen(a))}）が出現した！`, 'bad');
    }
    const u = provUnrest(p);
    if (u > 0 && p.controller === p.owner && Math.random() < u * 0.0035 && !S.armies.some(a => a.prov === p.id && isRogue(a.owner))) {
      const a = spawnRebels(p);
      if (p.owner === S.player) hooks.log(`✊ ${p.name}で${a.name}（${fmtMen(armyMen(a))}）が蜂起した！（不穏度 ${u.toFixed(1)}）`, 'bad');
    }
  }
  for (const p of S.provinces) {
    if (isRogue(p.controller) && !S.armies.some(a => a.prov === p.id && a.owner === p.controller) && Math.random() < 0.25) {
      p.controller = p.owner; mapDirty = true;
      if (p.owner === S.player) hooks.log(`🌿 ${p.name}は平穏を取り戻した`, 'info');
    }
  }
  if (Math.random() < 0.08) {
    const c = landProvs().filter(p => !p.dungeon);
    if (c.length) {
      const p = pick(c); p.dungeon = { lv: clamp(1 + Math.floor(Math.random() * (2 + year / 25)), 1, 5), cleared: false };
      if (p.owner === S.player) hooks.log(`🕳 ${p.name}に新たなダンジョン（Lv${p.dungeon.lv}）が出現した`, 'info');
    }
  }
}
function checkVictories() {
  const P = nat(S.player); if (!P || !P.alive) return;
  S.victories = S.victories || {};
  if (!P.demonKing && S.demonKingSlayer === S.player && !S.victories.demon) {
    S.victories.demon = true; gainXP(P, 100);
    hooks.modal({ title: '⚔ 魔王討伐', body: `魔王国は${esc(P.name)}の手によって滅ぼされた！<br>転生者${esc(P.ruler.name)}の名は「勇者王」として大陸中に轟いた。<br><br><b>勝利条件「魔王討伐」を達成した！</b><br><span class="note">ゲームはこのまま続けられる。</span>`, buttons: [{ label: '伝説は続く' }] });
  }
  if (P.demonKing && !S.victories.demon && !S.nations.some(n => n.alive && !n.isMonster && n.race === 'human')) {
    S.victories.demon = true;
    hooks.modal({ title: '🌑 魔界統一', body: `人族の国家はすべて滅び去った。大陸は魔王${esc(P.ruler.name)}の手に落ちた。<br><br><b>勝利条件「魔界統一」を達成した！</b>`, buttons: [{ label: '闇の時代は続く' }] });
  }
  let all = 0; for (const p of S.provinces) if (p.owner > 0) all += dev(p);
  if (!S.victories.hegemon && totalDev(S.player) >= all * 0.5) {
    S.victories.hegemon = true;
    hooks.modal({ title: '👑 大陸の覇者', body: `${esc(P.name)}は大陸の開発度の半分以上を支配した。<br><br><b>勝利条件「大陸の覇者」を達成した！</b>`, buttons: [{ label: 'さらなる覇道へ' }] });
  }
}
