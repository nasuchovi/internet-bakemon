'use strict';
// ===== AI =====
function aiArmyTick() {
  const byProv = new Map();
  for (const a of S.armies) { let l = byProv.get(a.prov); if (!l) byProv.set(a.prov, l = []); l.push(a); }
  for (const n of S.nations) {
    if (!n.alive || n.isMonster || n.id === S.player) continue;
    aiNationArmies(n, byProv);
    aiFleets(n);
  }
  rogueArmies();
}

function aiNationArmies(n, byProv) {
  const mine = S.armies.filter(a => a.owner === n.id);
  if (!mine.length) return;
  const idle = new Map();
  for (const a of mine) {
    if (a.path.length || a.inBattle || a.retreat || a.delve || prov(a.prov).sea) continue;
    let l = idle.get(a.prov); if (!l) idle.set(a.prov, l = []); l.push(a);
  }
  for (const l of idle.values()) if (l.length > 1) mergeArmies(l);
  // 将軍の割り当て
  const free = n.generals.filter(g => !S.armies.some(a => a.owner === n.id && a.gen === g.id));
  for (const a of S.armies) if (a.owner === n.id && a.gen == null && free.length) a.gen = free.shift().id;

  for (const a of S.armies.filter(a => a.owner === n.id)) {
    if (a.inBattle || a.retreat || a.delve) continue;
    if (prov(a.prov).sea && a.path.length) continue;
    if (a.morale < maxMorale(n.id) * 0.4 || armyMen(a) < armyRegs(a) * 400) {
      if (prov(a.prov).controller !== n.id && a.target !== n.capital) { if (moveArmyTo(a, n.capital)) a.target = n.capital; }
      continue;
    }
    const t = aiTarget(n, a, byProv);
    if (t == null) {
      if (a.prov !== n.capital && a.target !== n.capital) { if (moveArmyTo(a, n.capital)) a.target = n.capital; }
      continue;
    }
    if (t === a.prov) { a.path = []; a.prog = 0; a.target = t; continue; }
    if (a.target === t && a.path.length) continue;
    if (moveArmyTo(a, t)) a.target = t;
  }
}

function aiTarget(n, a, byProv) {
  const myPow = armyPower(a), myMen = armyMen(a);
  const d = bfsDist(n.id, a.prov, 14, a);
  let threat = 0;
  for (const q of [a.prov, ...adjOf(prov(a.prov))]) for (const b of byProv.get(q) || []) if (hostile(n.id, b.owner) && !b.retreat) threat += armyPower(b);
  if (threat > myPow * 1.4 && prov(a.prov).controller !== n.id) return n.capital;

  let best = null, bs = -1e9;
  for (let pid = 0; pid < d.length; pid++) {
    if (d[pid] < 0) continue;
    const p = prov(pid); if (p.sea) continue;
    const dist = d[pid];
    let enemyPow = 0;
    for (const b of byProv.get(pid) || []) if (hostile(n.id, b.owner) && !b.retreat) enemyPow += armyPower(b);
    let sc;
    if (enemyPow > 0) {
      if (enemyPow > myPow * 0.85) continue;
      sc = 120 - dist * 10 + (p.owner === n.id ? 40 : 0);
    } else if (p.owner >= 0 && hostile(n.id, p.controller)) {
      if (myMen < 1000 * Math.max(1, p.fort)) continue;
      if (isRogue(p.controller) && !friendly(n.id, p.owner)) continue;
      sc = 70 - dist * 8 + dev(p) * 1.5 + (p.owner === n.id ? 35 : 0) - p.fort * 6;
      if (p.siege && p.siege.by !== n.id && friendly(p.siege.by, n.id) && pid !== a.prov) sc -= 30;
    } else continue;
    if (pid === a.target) sc += 15;
    if (sc > bs) { bs = sc; best = pid; }
  }
  return best;
}

function aiFleets(n) {
  for (const f of S.fleets) {
    if (f.owner !== n.id || f.inBattle || f.retreat || f.path.length) continue;
    if (f.str < 0.6) { const h = homePort(n.id, f.prov); if (h != null && h !== f.prov) moveFleetTo(f, h); continue; }
    if (f.war === 0) continue;
    // 近くの弱い敵艦隊を攻撃
    let best = null, bd = 99;
    for (const e of S.fleets) {
      if (!hostile(n.id, e.owner) || e.war * e.str >= f.war * f.str * 0.9) continue;
      const path = findFleetPath(n.id, f.prov, e.prov);
      if (path && path.length < bd && path.length <= 6) { bd = path.length; best = e.prov; }
    }
    if (best != null) moveFleetTo(f, best);
  }
}

function rogueArmies() {
  for (const a of [...S.armies]) {
    if (!isRogue(a.owner) || a.inBattle || a.retreat) continue;
    if (a.expire && S.day > a.expire) {
      if (prov(a.prov).owner === S.player) hooks.log(`🌫 ${a.name}は散り散りになって消えた`, 'info');
      destroyArmy(a); continue;
    }
    if (a.path.length) continue;
    const p = prov(a.prov);
    if (p.owner >= 0 && p.controller !== a.owner && (a.owner !== REBEL || p.owner === a.target)) continue; // 包囲中
    if (Math.random() < 0.5) continue;
    let opts;
    if (a.owner === REBEL) opts = p.nb.filter(q => prov(q).owner === a.target && prov(q).controller !== REBEL);
    else opts = p.nb.filter(q => prov(q).owner >= 0 && prov(q).controller !== MONSTER);
    if (!opts.length) { if (a.owner === REBEL) continue; opts = p.nb; }
    a.path = [pick(opts)]; a.prog = 0;
  }
}

function aiMonthly() {
  for (const n of S.nations) {
    if (!n.alive || n.isMonster || n.id === S.player) continue;
    aiEconomy(n);
    aiDiplomacy(n);
  }
}

function aiEconomy(n) {
  const inc = calcIncome(n), war = warsOf(n.id).length > 0;
  const threatened = war || S.armies.some(a => isRogue(a.owner) && prov(a.prov).owner === n.id);
  let regs = inc.regs, tries = 0;
  const reserve = threatened ? 5 : 40;
  const wantFL = threatened ? inc.fl : Math.floor(inc.fl * 0.8);
  while (regs < wantFL && tries++ < 5) {
    let total = 0, cav = 0, mage = 0;
    for (const a of S.armies) if (a.owner === n.id) { total += armyRegs(a); cav += a.regs.cav; mage += a.regs.mage; }
    let t = 'inf';
    if (total > 3 && cav / total < 0.22) t = 'cav';
    else if (n.tech.mil >= 2 && total > 5 && mage / total < 0.12) t = 'mage';
    if (n.gold < UNITS[t].cost + reserve || n.manpower < 1000) break;
    if (!threatened && inc.net < UNITS[t].maint + 0.5) break;
    let pid = n.capital;
    if (!canRecruitAt(n.id, pid)) { const alt = ownedProvs(n.id).find(p => canRecruitAt(n.id, p.id)); if (!alt) break; pid = alt.id; }
    if (!recruit(n.id, pid, t)) break;
    regs++;
  }
  if (n.gold < 0 && inc.net < 0) {
    const a = S.armies.filter(a => a.owner === n.id && !a.inBattle).sort((x, y) => armyRegs(y) - armyRegs(x))[0];
    if (a) { const t = a.regs.cav > 0 ? 'cav' : a.regs.mage > 0 ? 'mage' : 'inf'; if (a.regs[t] > 0) { a.men[t] -= a.men[t] / a.regs[t]; a.regs[t]--; } if (armyRegs(a) <= 0) destroyArmy(a); }
    const f = S.fleets.find(f => f.owner === n.id); if (f) { if (f.trans > 0) f.trans--; else if (f.war > 0) f.war--; if (f.war + f.trans <= 0) destroyFleet(f); }
  }
  // 海軍
  const coastal = ownedProvs(n.id).filter(p => p.coastal && p.controller === n.id);
  if (coastal.length && !n.overlord) {
    let war = 0, trans = 0; for (const f of S.fleets) if (f.owner === n.id) { war += f.war; trans += f.trans; }
    const wantWar = Math.floor(inc.dev / 45), wantTrans = Math.min(8, Math.floor(inc.regs * 0.3));
    const port = coastal.find(p => p.id === n.capital) || coastal[0];
    if (war < wantWar && n.gold > SHIPS.war.cost + 60 && inc.net > 2) buildShip(n.id, port.id, 'war');
    else if (trans < wantTrans && n.gold > SHIPS.trans.cost + 50 && inc.net > 1) buildShip(n.id, port.id, 'trans');
  }
  if (!war) {
    const provs = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => dev(b) - dev(a));
    let built = 0;
    for (const p of provs) {
      if (n.gold < 110 || built >= 3) break;
      const k = !p.b.temple ? 'temple' : !p.b.workshop ? 'workshop' : !p.b.barracks ? 'barracks' : (!p.b.walls && (p.id === n.capital || dev(p) >= 12)) ? 'walls' : null;
      if (k && build(n, p, k)) built++;
    }
    // 改宗
    if (n.gold > 80) { const p = ownedProvs(n.id).find(p => canConvert(n.id, p.id)); if (p) convert(n.id, p.id); }
  }
  // 安定度・技術・開発・将軍
  if ((n.stab || 0) < 1 && n.adm >= stabCost(n) + 50) raiseStab(n);
  for (const t of ['mil', 'adm', 'dip']) buyTech(n, t);
  if (n.generals.length < Math.min(3, S.armies.filter(a => a.owner === n.id).length) && n.mil > 150) recruitGeneral(n);
  for (const t of ['adm', 'dip', 'mil']) {
    if (n[t] > 500) {
      const type = Object.keys(DEV_TYPES).find(k => DEV_TYPES[k].pt === t);
      const p = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => devCost(n, a) - devCost(n, b))[0];
      if (p) develop(n, p, type);
    }
  }
  // 召喚
  if (canSummon(n) && n.gold > 150 && Math.random() < 0.3) {
    const r = doSummon(n);
    if (r && r.char && (r.char.rarity === 'SSR' || r.char.rarity === 'SR')) hooks.log(`✨ ${n.name}が異世界から${r.char.title}（${r.char.rarity}）を召喚したという噂だ`, 'info');
  }
  // 商人
  if (S.day % 360 === 30 || !n.merchants.length) {
    const T = computeTrade(), max = Math.max(0, maxMerchants(n));
    const score = T.val.map((v, i) => ({ i, s: v * (T.pow[i][n.id] + 5) / (T.tot[i] + 10) })).filter(x => T.pow[x.i][n.id] > 0).sort((a, b) => b.s - a.s);
    n.merchants = n.overlord ? [] : score.slice(0, max).map(x => x.i);
  }
  // 入植
  if (!war && n.gold > colonizeCost(n) + 40 && !S.provinces.some(p => p.colonizing && p.colonizing.by === n.id)) {
    const c = [];
    for (const p of landProvs()) if (canColonize(n.id, p.id)) c.push(p.id);
    if (c.length && Math.random() < 0.5) colonize(n.id, pick(c));
  }
}

function aiDiplomacy(n) {
  const war = warsOf(n.id).length > 0;
  if (n.dip > 150 && Math.random() < 0.2) {
    const cand = n.allies.length ? n.allies : S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id).map(o => o.id);
    improveRel(n, pick(cand));
  }
  // 属国の併合
  for (const v of vassalsOf(n.id)) if (canAnnex(n, v) && n.dip >= annexCost(n, v)) annex(n, v);
  if (n.overlord) return; // 属国は独自外交をしない
  // 外交的属国化
  if (!war && Math.random() < 0.03) {
    const neigh = new Set(); for (const p of ownedProvs(n.id)) for (const q of p.nb) { const o = prov(q).owner; if (o > 0 && o !== n.id) neigh.add(o); }
    for (const o of neigh) if (vassalAccepts(n, nat(o))) { makeVassal(n, nat(o)); hooks.log(`📜 ${nat(o).name}が${n.name}の属国となった`, 'info'); break; }
  }
  if (!war && n.allies.length < 2 && Math.random() < 0.04) {
    const cand = S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id && !o.overlord && !isAlly(n.id, o.id) && o.allies.length < 3 && getRel(n.id, o.id) > 45 && !hostile(n.id, o.id));
    if (cand.length) {
      const o = pick(cand);
      if (o.id === S.player) {
        hooks.modal({
          title: '🤝 同盟の申し出', body: `<b>${esc(n.name)}</b>（${RACES[n.race].name}・${n.gov}）が我が国との同盟を申し出ている。<br>同盟国は互いの防衛戦争に参戦する。`,
          buttons: [{ label: '同盟を結ぶ', fn: () => { if (n.alive && !hostile(n.id, S.player)) { addAlliance(n.id, S.player); hooks.log(`🤝 ${n.name}と同盟を結んだ`, 'good'); } } },
            { label: '断る', fn: () => addRel(n.id, S.player, -10) }],
        });
      } else addAlliance(n.id, o.id);
    }
  }
  if (war || S.day < 360 || S.day - n.lastWar < 720) return;
  if (coalitionOf(n.id).length >= 2) return; // 警戒されている間は自重
  const aggr = (n.demonKing ? 0.14 : n.race === 'demon' ? 0.09 : 0.045) * diff().aggr;
  if (Math.random() > aggr) return;
  const neigh = new Set();
  for (const p of ownedProvs(n.id)) for (const q of p.nb) { const o = prov(q).owner; if (o > 0 && o !== n.id) neigh.add(o); }
  const myP = coalitionPower(n.id);
  let best = null, br = 0;
  for (const o of neigh) {
    if (isAlly(n.id, o) || hasTruce(n.id, o) || !nat(o).alive) continue;
    if (o === S.player && S.day < diff().grace) continue;
    if (o === S.player && S.tut && !S.tut.done) continue;
    if (getRel(n.id, o) > (n.demonKing ? 40 : 5)) continue;
    const tgt = nat(o).overlord || o;
    const ratio = myP / Math.max(1, coalitionPower(tgt));
    const need = n.demonKing ? 1.1 : 1.45;
    if (ratio > need && ratio > br) { br = ratio; best = o; }
  }
  if (best != null) declareWar(n.id, best);
}

function aiPeace() {
  for (const w of [...S.wars]) {
    if (!S.wars.includes(w)) continue;
    const s = warScore(w), age = S.day - w.start;
    const pLead = w.att[0] === S.player || w.def[0] === S.player;
    if (pLead) {
      const aiSide = w.att[0] === S.player ? 'def' : 'att';
      const sAI = aiSide === 'att' ? s : -s;
      if (sAI >= 25 && S.day - w.lastOffer > 150 && Math.random() < 0.5) {
        w.lastOffer = S.day;
        const provs = pickDemands(w, aiSide, sAI);
        const lead = nat(w[aiSide][0]);
        const list = provs.map(i => esc(prov(i).name)).join('、') || '（領土要求なし）';
        hooks.modal({
          title: '📜 講和の要求', body: `<b>${esc(lead.name)}</b>が講和を求めている。<br>戦勝点: ${Math.round(sAI)}（敵優勢）<br><br>要求: <b>${list}</b> の割譲`,
          buttons: [{ label: '受諾する', fn: () => makePeace(w, aiSide, provs.filter(i => w[aiSide === 'att' ? 'def' : 'att'].includes(prov(i).owner))) },
            { label: '拒否して戦い続ける' }],
        });
      }
      continue;
    }
    const settle = (side, score) => {
      const lose = side === 'att' ? 'def' : 'att', loser = w[lose][0];
      if (loser !== S.player && totalDev(loser) * 3 < totalDev(w[side][0]) && score >= vassalPeaceCost(w, lose) && Math.random() < 0.4 && !nat(loser).demonKing)
        makePeace(w, side, pickDemands(w, side, score - vassalPeaceCost(w, lose)), true);
      else makePeace(w, side, pickDemands(w, side, score));
    };
    if (s >= 30 || (s >= 12 && age > 720)) { settle('att', s); continue; }
    if (s <= -30 || (s <= -12 && age > 720)) { settle('def', -s); continue; }
    if ((age > 1080 && Math.abs(s) < 12 && Math.random() < 0.2) || age > 2160) makePeace(w, null, []);
  }
}

function aiAcceptsPeace(w, pSide, provIds, vassalize) {
  const s = warScore(w), sP = pSide === 'att' ? s : -s, age = S.day - w.start;
  const lose = pSide === 'att' ? 'def' : 'att';
  if (!provIds.length && !vassalize) return sP >= -5 || (age > 1080 && sP > -25);
  let cost = vassalize ? vassalPeaceCost(w, lose) : 0;
  for (const i of provIds) if (!(vassalize && prov(i).owner === w[lose][0])) cost += provPeaceCost(w, prov(i), lose);
  return sP > 0 && cost <= sP + 0.01;
}
