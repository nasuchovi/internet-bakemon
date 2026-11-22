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
  autoArmies(byProv);
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
    else if (n.inventions.length >= 2 && total > 5 && mage / total < 0.12) t = 'mage';
    if (n.gold < UNITS[t].cost + reserve || n.manpower < 1000) break;
    if (!threatened && inc.net < UNITS[t].maint + 0.5) break;
    let pid = n.capital;
    if (!canRecruitAt(n.id, pid)) { const alt = ownedProvs(n.id).find(p => canRecruitAt(n.id, p.id)); if (!alt) break; pid = alt.id; }
    if (!recruit(n.id, pid, t)) break;
    regs++;
  }
  // 商会（建設より先に検討）
  if (!war && n.gold > guildCost(n) + 40 && guildsOf(n.id).length < maxGuilds(n) && Math.random() < 0.6) {
    const cand = landProvs().filter(p => canFoundGuild(n.id, p.id)).map(p => ({ p, v: guildIncome({ owner: n.id, pid: p.id }) })).sort((a, b) => b.v - a.v);
    if (cand.length) foundGuild(n.id, cand[0].p.id);
  }
  // 大建造物
  if (!war && !n.project && Math.random() < 0.25 * cfg().wonder) {
    const provs = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => dev(b) - dev(a));
    const opts = [];
    for (const W of WONDERS) { if (n.gold < wonderCost(n, W) + 150) continue; const p = provs.find(p => !wonderReq(n, W, p.id)); if (p) opts.push({ W, p }); }
    if (opts.length) { const o = pick(opts); startWonder(n, o.W.id, o.p.id); }
  }
  // 余剰資金の投資
  for (let k = 0; k < 6 && !war && n.gold > 600; k++) {
    const p = ownedProvs(n.id).filter(p => p.controller === n.id && p.dev < DEV_CAP).sort((a, b) => investCost(n, a) - investCost(n, b))[0];
    if (!p || !invest(n, p)) break;
  }
  if (n.gold < 0 && inc.net < 0) {
    const a = S.armies.filter(a => a.owner === n.id && !a.inBattle).sort((x, y) => armyRegs(y) - armyRegs(x))[0];
    for (let k = 0; k < 3 && a && S.armies.includes(a); k++) { const t = a.regs.cav > 0 ? 'cav' : a.regs.mage > 0 ? 'mage' : 'inf'; if (a.regs[t] > 0) { a.men[t] -= a.men[t] / a.regs[t]; a.regs[t]--; } if (armyRegs(a) <= 0) destroyArmy(a); }
    const f = S.fleets.find(f => f.owner === n.id); if (f) { if (f.trans > 0) f.trans--; else if (f.war > 0) f.war--; if (f.war + f.trans <= 0) destroyFleet(f); }
  }
  // 海軍
  const coastal = ownedProvs(n.id).filter(p => p.coastal && p.controller === n.id);
  if (coastal.length && !n.overlord) {
    let war = 0, trans = 0; for (const f of S.fleets) if (f.owner === n.id) { war += f.war; trans += f.trans; }
    const wantWar = Math.floor(inc.dev / 45), wantTrans = Math.min(8, Math.floor(inc.regs * 0.3));
    const port = coastal.find(p => p.id === n.capital) || coastal[0];
    if (war < wantWar && n.gold > shipCost(n, 'war') + 60 && inc.net > 2) buildShip(n.id, port.id, 'war');
    else if (trans < wantTrans && n.gold > shipCost(n, 'trans') + 50 && inc.net > 1) buildShip(n.id, port.id, 'trans');
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
  if ((n.stab || 0) < 1 && n.gov >= stabCost(n) + 50) raiseStab(n);
  // 発明（安いものから）
  const avail = INVENTIONS.filter(i => canInvent(n, i.id)).sort((a, b) => a.tier - b.tier || Math.random() - 0.5);
  if (avail.length) invent(n, avail[0].id);
  if (n.generals.length < Math.min(3, S.armies.filter(a => a.owner === n.id).length) && n.gov > 150) recruitGeneral(n);
  // 代官：控えの異世界人と現地の代官を、発展度の高い州から配置
  const ungov = ownedProvs(n.id).filter(p => p.controller === n.id && !governorAt(p)).sort((a, b) => dev(b) - dev(a));
  for (const c of [...n.bench]) { const p = ungov.shift(); if (!p) break; assignGovernor(n, c, p.id); }
  for (const c of n.governors.filter(c => c.pid == null)) { const p = ungov.shift(); if (!p) break; assignGovernor(n, c, p.id); }
  if (ungov.length && n.governors.length < 2 + Math.floor(totalDev(n.id) / 60) && n.gov > 120) { const c = recruitNativeGov(n); if (c) assignGovernor(n, c, ungov[0].id); }
  if (n.gov > 400) {
    const p = ownedProvs(n.id).filter(p => p.controller === n.id).sort((a, b) => devCost(n, a) - devCost(n, b))[0];
    if (p) develop(n, p);
  }
  // 召喚
  if (canSummon(n) && n.gold > 150 && Math.random() < 0.3 * cfg().summon) {
    const r = doSummon(n);
    if (r && r.char && (r.char.rarity === 'SSR' || r.char.rarity === 'SR')) hooks.log(`✨ ${n.name}が異世界から${r.char.title}（${r.char.rarity}）を召喚したという噂だ`, 'info');
  }
  // 商会
  if (!war && n.gold > guildCost(n) + 70 && guildsOf(n.id).length < maxGuilds(n)) {
    const cand = landProvs().filter(p => canFoundGuild(n.id, p.id)).map(p => ({ p, v: guildIncome({ owner: n.id, pid: p.id }) })).sort((a, b) => b.v - a.v);
    if (cand.length) foundGuild(n.id, cand[0].p.id);
  }
  // 入植
  if (!war && n.gold > colonizeCost(n) + 40 && !S.provinces.some(p => p.colonizing && p.colonizing.by === n.id)) {
    const c = [];
    for (const p of landProvs()) if (canColonize(n.id, p.id)) c.push(p.id);
    if (c.length && Math.random() < 0.5 * cfg().expand) colonize(n.id, pick(c));
  }
}

function aiDiplomacy(n) {
  const war = warsOf(n.id).length > 0;
  if (n.gov > 200 && Math.random() < 0.2) {
    const cand = n.allies.length ? n.allies : S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id).map(o => o.id);
    improveRel(n, pick(cand));
  }
  // 属国の併合
  for (const v of vassalsOf(n.id)) if (canAnnex(n, v) && n.gov >= annexCost(n, v)) annex(n, v);
  if (n.overlord) return; // 属国は独自外交をしない
  // 外交的属国化
  if (!war && Math.random() < 0.03) {
    const neigh = new Set(); for (const p of ownedProvs(n.id)) for (const q of p.nb) { const o = prov(q).owner; if (o > 0 && o !== n.id) neigh.add(o); }
    for (const o of neigh) if (vassalAccepts(n, nat(o))) { makeVassal(n, nat(o)); hooks.log(`📜 ${nat(o).name}が${n.name}の属国となった`, 'info'); break; }
  }
  if (!war && n.allies.length < 2 && Math.random() < 0.04 * cfg().ally) {
    const cand = S.nations.filter(o => o.alive && !o.isMonster && o.id !== n.id && !o.overlord && !isAlly(n.id, o.id) && o.allies.length < 3 && getRel(n.id, o.id) > 45 && !hostile(n.id, o.id));
    if (cand.length) {
      const o = pick(cand);
      if (o.id === S.player) {
        hooks.modal({
          title: '🤝 同盟の申し出', body: `<b>${esc(n.name)}</b>（${RACES[n.race].name}・${n.polity}）が我が国との同盟を申し出ている。<br>同盟国は互いの防衛戦争に参戦する。`,
          buttons: [{ label: '同盟を結ぶ', fn: () => { if (n.alive && !hostile(n.id, S.player)) { addAlliance(n.id, S.player); hooks.log(`🤝 ${n.name}と同盟を結んだ`, 'good'); } } },
            { label: '断る', fn: () => addRel(n.id, S.player, -10) }],
        });
      } else addAlliance(n.id, o.id);
    }
  }
  if (war || S.day < 360 || S.day - n.lastWar < 720) return;
  if (coalitionOf(n.id).length >= 2) return; // 警戒されている間は自重
  const aggr = (n.demonKing ? 0.14 : n.race === 'demon' ? 0.09 : 0.045) * cfg().aggr;
  if (Math.random() > aggr) return;
  const neigh = new Set();
  for (const p of ownedProvs(n.id)) for (const q of p.nb) { const o = prov(q).owner; if (o > 0 && o !== n.id) neigh.add(o); }
  const myP = coalitionPower(n.id);
  let best = null, br = 0;
  for (const o of neigh) {
    if (isAlly(n.id, o) || hasTruce(n.id, o) || !nat(o).alive) continue;
    if (o === S.player && S.day < cfg().grace * 360) continue;
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
    // プレイヤーが同盟国として参戦中：自国が大きく占領されていれば、敵が単独講和を求めてくる
    if (!pLead && sideOf(w, S.player) && S.day - (w.lastOfferP || 0) > 180) {
      const T = separatePeaceTerms(w, S.player);
      if (T.share >= 20 && Math.random() < 0.4) {
        w.lastOfferP = S.day;
        const other = sideOf(w, S.player) === 'att' ? 'def' : 'att', ids = []; let g = 0;
        for (const p of T.occ) { if (g >= T.need) break; ids.push(p.id); g += dev(p) / T.myDev * 100; }
        hooks.modal({
          title: '📜 単独講和の要求', body: `<b>${esc(nat(w[other][0]).name)}</b>が我が国に単独講和を求めている。<br>我が国の開発度の${Math.round(T.share)}%が占領されている。<br><br>要求：<b>${ids.map(i => esc(prov(i).name)).join('、')}</b> の割譲<br><span class="note">受諾すると我が国だけが戦争から抜ける（同盟国は戦争を続ける）。</span>`,
          buttons: [{ label: '受諾して離脱する', fn: () => separatePeace(w, S.player, ids.filter(i => prov(i).owner === S.player)) }, { label: '拒否して戦い続ける' }],
        });
      }
    }
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

// ===== プレイヤー軍の自律行動 =====
const AUTO_MODES = {
  manual:  { name: '手動', desc: '命令した通りにだけ動く' },
  defend:  { name: '防衛', desc: '拠点の周辺を守る。自国・同盟国の州に入った敵や魔物を迎え撃ち、奪われた州を取り返す' },
  offense: { name: '攻勢', desc: '戦争中、勝てる敵軍を撃破し、敵の州を次々と包囲・占領する。平時は防衛と同じ' },
  hunt:    { name: '討伐', desc: '魔物の群れと反乱軍だけを狩る。占領された州の奪還も行う' },
};
const AUTO_RISK = { careful: { name: '慎重', k: 0.6 }, normal: { name: '通常', k: 0.85 }, bold: { name: '大胆', k: 1.2 } };
const AUTO_RANGE = { 3: '近く', 8: '中域', 14: '広域' };
function autoArmies(byProv) {
  for (const a of [...S.armies]) if (a.owner === S.player && a.auto && a.auto.mode !== 'manual' && S.armies.includes(a)) autoArmy(a, byProv);
}
function nearestOwnSafe(a) {
  const nid = a.owner, n = S.provinces.length, seen = new Uint8Array(n); seen[a.prov] = 1;
  const q = [a.prov]; let h = 0;
  while (h < q.length) {
    const u = q[h++], p = prov(u);
    if (!p.sea && p.controller === nid && !S.armies.some(b => b.prov === u && hostile(b.owner, nid))) return u;
    for (const v of p.nb) if (!seen[v] && canEnter(nid, v, false)) { seen[v] = 1; q.push(v); }
  }
  return nat(nid).capital;
}
function autoArmy(a, byProv) {
  if (a.inBattle || a.retreat || a.delve) return;
  if (a.manualHold) { if (a.path.length) return; a.manualHold = false; }
  if (prov(a.prov).sea && a.path.length) return;
  const n = nat(a.owner), C = a.auto, risk = (AUTO_RISK[C.risk] || AUTO_RISK.normal).k, range = C.range || 8;
  const home = C.home != null && prov(C.home).owner === n.id ? C.home : n.capital;
  const cap = armyRegs(a) * 1000;
  // 消耗したら後退して補充
  if (a.resting) {
    if (armyMen(a) >= cap * 0.9 && a.morale >= maxMorale(n.id) * 0.85) a.resting = false;
    else { if (prov(a.prov).controller !== n.id && !a.path.length) moveArmyTo(a, nearestOwnSafe(a)); a.autoState = '後退して補充中'; return; }
  }
  if (armyMen(a) < cap * 0.5 || a.morale < maxMorale(n.id) * 0.4) { a.resting = true; moveArmyTo(a, nearestOwnSafe(a)); a.autoState = '後退して補充中'; return; }
  const myPow = armyPower(a);
  // 勝てない敵が迫ったら拠点へ退く
  let threat = 0;
  for (const q of [a.prov, ...adjOf(prov(a.prov))]) for (const b of byProv.get(q) || []) if (hostile(n.id, b.owner) && !b.retreat) threat += armyPower(b);
  if (threat > myPow * risk * 1.4 && a.prov !== home) { moveArmyTo(a, home); a.target = home; a.autoState = '強敵を避けて退却中'; return; }
  const atWarNow = warsOf(n.id).length > 0;
  const mode = C.mode === 'offense' && !atWarNow ? 'defend' : C.mode;
  // 防衛は拠点からの距離、それ以外は現在地からの距離で探す
  const dArea = bfsDist(n.id, mode === 'defend' ? home : a.prov, range, a);
  let best = null, bs = -1e9, why = '';
  for (let pid = 0; pid < dArea.length; pid++) {
    if (dArea[pid] < 0) continue;
    const p = prov(pid); if (p.sea) continue;
    const dist = dArea[pid], ownish = p.owner === n.id || (p.owner > 0 && friendly(n.id, p.owner));
    let enemyPow = 0, rogueOnly = true;
    for (const b of byProv.get(pid) || []) if (hostile(n.id, b.owner) && !b.retreat) { enemyPow += armyPower(b); if (!isRogue(b.owner)) rogueOnly = false; }
    let sc, w;
    if (enemyPow > 0) {
      if (enemyPow > myPow * risk) continue;
      if (mode === 'defend' && !ownish) continue;
      if (mode === 'hunt' && !rogueOnly) continue;
      sc = 120 - dist * 10 + (ownish ? 40 : 0); w = '敵軍を迎撃';
    } else if (p.owner >= 0 && hostile(n.id, p.controller)) {
      if (armyMen(a) < 1000 * Math.max(1, effFort(p))) continue;
      if (isRogue(p.controller) && !ownish) continue;
      if (mode === 'defend' && !ownish) continue;
      if (mode === 'hunt' && !(ownish && isRogue(p.controller))) continue;
      if (mode === 'offense' && !ownish && !hostile(n.id, p.owner)) continue;
      sc = 70 - dist * 8 + dev(p) * 1.5 + (ownish ? 35 : 0) - effFort(p) * 6; w = ownish ? '奪還' : '包囲・占領';
      if (p.siege && p.siege.by !== n.id && friendly(p.siege.by, n.id) && pid !== a.prov) sc -= 30;
    } else continue;
    if (pid === a.target) sc += 15;
    if (sc > bs) { bs = sc; best = pid; why = w; }
  }
  if (best == null) {
    if (a.prov !== home && (!a.path.length || a.target !== home)) { moveArmyTo(a, home); a.target = home; }
    a.autoState = a.prov === home ? '拠点で待機中' : '拠点へ帰還中'; return;
  }
  a.autoState = `${prov(best).name}で${why}`;
  if (best === a.prov) { a.path = []; a.prog = 0; a.target = best; return; }
  if (a.target === best && a.path.length) return;
  if (moveArmyTo(a, best)) a.target = best;
}
