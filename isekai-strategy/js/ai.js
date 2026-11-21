'use strict';
// ===== AI =====
function aiArmyTick() {
  const byProv = new Map();
  for (const a of S.armies) { let l = byProv.get(a.prov); if (!l) byProv.set(a.prov, l = []); l.push(a); }
  for (const n of S.nations) {
    if (!n.alive || n.isMonster || n.id === S.player) continue;
    aiNationArmies(n, byProv);
  }
  monsterArmies();
}

function aiNationArmies(n, byProv) {
  const mine = S.armies.filter(a => a.owner === n.id);
  if (!mine.length) return;
  // 同じ州で待機している軍を統合
  const idle = new Map();
  for (const a of mine) {
    if (a.path.length || a.inBattle || a.retreat) continue;
    let l = idle.get(a.prov); if (!l) idle.set(a.prov, l = []); l.push(a);
  }
  for (const l of idle.values()) if (l.length > 1) mergeArmies(l);

  for (const a of S.armies.filter(a => a.owner === n.id)) {
    if (a.inBattle || a.retreat) continue;
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
  const d = bfsDist(n.id, a.prov, 14);
  // 近くに強すぎる敵がいれば退く
  let threat = 0;
  for (const q of [a.prov, ...prov(a.prov).nb]) for (const b of byProv.get(q) || []) if (hostile(n.id, b.owner) && !b.retreat) threat += armyPower(b);
  if (threat > myPow * 1.4 && prov(a.prov).controller !== n.id) return n.capital;

  let best = null, bs = -1e9;
  for (let pid = 0; pid < d.length; pid++) {
    if (d[pid] < 0) continue;
    const p = prov(pid), dist = d[pid];
    let enemyPow = 0;
    for (const b of byProv.get(pid) || []) if (hostile(n.id, b.owner) && !b.retreat) enemyPow += armyPower(b);
    let sc;
    if (enemyPow > 0) {
      if (enemyPow > myPow * 0.85) continue;
      sc = 120 - dist * 10 + (p.owner === n.id ? 40 : 0);
    } else if (p.owner >= 0 && hostile(n.id, p.controller)) {
      if (myMen < 1000 * Math.max(1, p.fort)) continue;
      // 無関係な第三国の州は解放対象にしない（魔物占領地は自国・友好国のみ）
      if (p.controller === MONSTER && !friendly(n.id, p.owner)) continue;
      sc = 70 - dist * 8 + dev(p) * 1.5 + (p.owner === n.id ? 35 : 0) - p.fort * 6;
      if (p.siege && p.siege.by !== n.id && friendly(p.siege.by, n.id) && pid !== a.prov) sc -= 30;
    } else continue;
    if (pid === a.target) sc += 15;
    if (sc > bs) { bs = sc; best = pid; }
  }
  return best;
}

function monsterArmies() {
  for (const a of [...S.armies]) {
    if (a.owner !== MONSTER || a.inBattle || a.retreat) continue;
    if (a.expire && S.day > a.expire) {
      if (prov(a.prov).owner === S.player) hooks.log(`🌫 ${a.name}は散り散りになって消えた`, 'info');
      destroyArmy(a); continue;
    }
    if (a.path.length) continue;
    const p = prov(a.prov);
    if (p.owner >= 0 && p.controller !== MONSTER) continue; // 包囲中
    if (Math.random() < 0.5) continue;
    const opts = p.nb.filter(q => prov(q).owner >= 0 && prov(q).controller !== MONSTER);
    a.path = [opts.length ? pick(opts) : pick(p.nb)]; a.prog = 0;
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
  const threatened = war || S.armies.some(a => a.owner === MONSTER && prov(a.prov).owner === n.id);
  // 徴兵
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
  // 赤字なら解散
  if (n.gold < 0 && inc.net < 0) {
    const a = S.armies.filter(a => a.owner === n.id && !a.inBattle).sort((x, y) => armyRegs(y) - armyRegs(x))[0];
    if (a) { const t = a.regs.cav > 0 ? 'cav' : a.regs.mage > 0 ? 'mage' : 'inf'; if (a.regs[t] > 0) { a.men[t] -= a.men[t] / a.regs[t]; a.regs[t]--; } if (armyRegs(a) <= 0) destroyArmy(a); }
  }
  // 建設
  if (!war) {
    const provs = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => dev(b) - dev(a));
    let built = 0;
    for (const p of provs) {
      if (n.gold < 110 || built >= 3) break;
      const k = !p.b.temple ? 'temple' : !p.b.workshop ? 'workshop' : !p.b.barracks ? 'barracks' : (!p.b.walls && (p.id === n.capital || dev(p) >= 12)) ? 'walls' : null;
      if (k && build(n, p, k)) built++;
    }
  }
  // 技術・開発
  for (const t of ['mil', 'adm', 'dip']) buyTech(n, t);
  for (const t of ['adm', 'dip', 'mil']) {
    if (n[t] > 500) {
      const type = Object.keys(DEV_TYPES).find(k => DEV_TYPES[k].pt === t);
      const p = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => devCost(n, a) - devCost(n, b))[0];
      if (p) develop(n, p, type);
    }
  }
  // 入植
  if (!war && n.gold > colonizeCost(n) + 40 && !S.provinces.some(p => p.colonizing && p.colonizing.by === n.id)) {
    const c = [];
    for (const p of ownedProvs(n.id)) for (const q of p.nb) if (canColonize(n.id, q)) c.push(q);
    if (c.length && Math.random() < 0.5) colonize(n.id, pick(c));
  }
}

function aiDiplomacy(n) {
  const war = warsOf(n.id).length > 0;
  // 関係改善
  if (n.dip > 150 && Math.random() < 0.2) {
    const cand = n.allies.length ? n.allies : S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id).map(o => o.id);
    improveRel(n, pick(cand));
  }
  // 同盟
  if (!war && n.allies.length < 2 && Math.random() < 0.04) {
    const cand = S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id && !isAlly(n.id, o.id) && o.allies.length < 3 && getRel(n.id, o.id) > 45 && !hostile(n.id, o.id));
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
  // 宣戦
  if (war || S.day < 360 || S.day - n.lastWar < 720) return;
  const aggr = n.demonKing ? 0.14 : n.race === 'demon' ? 0.09 : 0.045;
  if (Math.random() > aggr) return;
  const neigh = new Set();
  for (const p of ownedProvs(n.id)) for (const q of p.nb) { const o = prov(q).owner; if (o > 0 && o !== n.id) neigh.add(o); }
  const myP = coalitionPower(n.id);
  let best = null, br = 0;
  for (const o of neigh) {
    if (isAlly(n.id, o) || hasTruce(n.id, o) || !nat(o).alive) continue;
    if (o === S.player && S.day < 360 * 2) continue;
    if (getRel(n.id, o) > (n.demonKing ? 40 : 5)) continue;
    const ratio = myP / Math.max(1, coalitionPower(o));
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
    if (s >= 30 || (s >= 12 && age > 720)) { makePeace(w, 'att', pickDemands(w, 'att', s)); continue; }
    if (s <= -30 || (s <= -12 && age > 720)) { makePeace(w, 'def', pickDemands(w, 'def', -s)); continue; }
    if ((age > 1080 && Math.abs(s) < 12 && Math.random() < 0.2) || age > 2160) makePeace(w, null, []);
  }
}

function aiAcceptsPeace(w, pSide, provIds) {
  const s = warScore(w), sP = pSide === 'att' ? s : -s, age = S.day - w.start;
  if (!provIds.length) return sP >= -5 || (age > 1080 && sP > -25);
  const lose = pSide === 'att' ? 'def' : 'att';
  let cost = 0; for (const i of provIds) cost += provPeaceCost(w, prov(i), lose);
  return sP > 0 && cost <= sP + 0.01;
}
