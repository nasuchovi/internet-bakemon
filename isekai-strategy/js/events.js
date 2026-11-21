'use strict';
// ===== イベント・ゲーム開始・セーブ =====
function randomOwnProv(n, f) { const l = ownedProvs(n.id).filter(p => p.controller === n.id && (!f || f(p))); return l.length ? pick(l) : null; }

const EVENTS = [
  {
    id: 'drifter', title: '異世界からの漂流者',
    text: (n) => `${esc(prov(n.capital).name)}の郊外で、見慣れぬ服を着た若者が保護された。<br>「ニホン」という国から来たと言っている……。転生者である陛下には、どこか懐かしい響きだ。`,
    options: [
      { label: '知識を授けてもらう', desc: '前世の知識+60', fx: n => { n.know += 60; } },
      { label: '騎士として取り立てる', desc: '人的資源+3000、政務+30', fx: n => { n.manpower += 3000; n.gov += 30; } },
    ],
  },
  {
    id: 'dungeon', title: 'ダンジョンの発見', prep: n => randomOwnProv(n, p => !p.dungeon),
    text: (n, p) => `${esc(p.name)}の地下深くで、古代のダンジョンへの入口が発見された。<br>中からは魔物の気配と、財宝の輝きが漏れている。`,
    options: [
      { label: '自ら攻略する', desc: 'Lv2のダンジョンが出現（軍を送り込んで攻略できる）', fx: (n, p) => { p.dungeon = { lv: 2, cleared: false }; } },
      { label: '冒険者ギルドに任せる', desc: '金貨-30、攻略済み扱いになり生産収入+1/月', fx: (n, p) => { n.gold -= 30; p.dungeon = { lv: 1, cleared: true }; } },
    ],
  },
  {
    id: 'stampede', title: 'スタンピード発生！', prep: n => randomOwnProv(n),
    text: (n, p) => `${esc(p.name)}近くの魔境から、魔物の大群が溢れ出した！<br>このままでは村々が蹂躙される。`,
    options: [
      { label: '我が軍で迎え撃つ', desc: '魔物の軍勢が出現する（倒せば軍事点+50）', fx: (n, p) => { const a = spawnMonsters(p, Math.round(3000 + S.day / 360 * 150)); a.bounty = true; } },
      { label: '冒険者に討伐を依頼する', desc: '金貨-50', fx: n => { n.gold -= 50; } },
    ],
  },
  {
    id: 'saint', title: '聖女の降臨',
    text: () => `神殿に眩い光が満ち、一人の少女が「神託を受けた」と告げた。<br>民衆は彼女を聖女と崇めている。`,
    options: [
      { label: '聖女を国の象徴とする', desc: '政務+60、全ての国との関係+10', fx: n => { n.gov += 60; for (const o of S.nations) if (o.id > 0 && o.id !== n.id) addRel(n.id, o.id, 10); } },
      { label: '聖女を戦場へ', desc: '2年間 士気+0.5', fx: n => addTimed(n, 'morale', 0.5, 720, '聖女の加護') },
    ],
  },
  {
    id: 'harvest', title: '大豊作',
    text: () => `天候に恵まれ、今年は国中で記録的な豊作となった。`,
    options: [
      { label: '国庫に納める', desc: '金貨+(月収×5)', fx: n => { n.gold += Math.max(20, calcIncome(n).net * 5); } },
      { label: '民に還元する', desc: 'ランダムな2州の発展度+1', fx: n => { for (let i = 0; i < 2; i++) { const p = randomOwnProv(n); if (p) p.dev++; } } },
    ],
  },
  {
    id: 'manavein', title: '魔石鉱脈の発見', prep: n => randomOwnProv(n, p => p.good !== 'manastone'),
    text: (n, p) => `${esc(p.name)}の山中で、青く輝く魔石の大鉱脈が見つかった。`,
    options: [
      { label: '採掘を始める', desc: '交易品が「魔石」になる', fx: (n, p) => { p.good = 'manastone'; mapDirty = true; } },
      { label: '魔導研究に回す', desc: '前世の知識+30、魔力+30', fx: n => { n.know += 30; n.mana += 30; } },
    ],
  },
  {
    id: 'heroparty', title: '勇者パーティの来訪',
    text: () => `聖剣を携えた勇者と、その仲間たちが王宮を訪れた。<br>「この国のために剣を振るいたい」と申し出ている。`,
    options: [
      { label: '王宮に迎える（金貨-80）', desc: '3年間 戦闘力+15%', fx: n => { n.gold -= 80; addTimed(n, 'combat', 0.15, 1080, '勇者パーティ'); } },
      { label: '丁重にお帰りいただく', desc: '政務+25', fx: n => { n.gov += 25; } },
    ],
  },
  {
    id: 'awakening', title: 'チート能力の覚醒',
    text: (n) => `転生者である${esc(n.ruler.name)}の内に眠っていた力が、ついに目覚めた。<br>脳裏に「スキルポイントを割り振ってください」という声が響く。`,
    options: [
      { label: '為政者の才', desc: '政務+120', fx: n => { n.gov += 120; } },
      { label: '前世の記憶の覚醒', desc: '前世の知識+80', fx: n => { n.know += 80; } },
      { label: '魔導の才', desc: '魔力+100', fx: n => { n.mana += 100; } },
    ],
  },
  {
    id: 'envoy', title: '魔王の使者',
    cond: n => !n.demonKing && S.nations.some(o => o.demonKing && o.alive && !hostile(o.id, n.id)),
    text: () => `魔王国の使者が密かに訪れた。<br>「我が主と手を組めば、人族どもの領地は思いのまま……」`,
    options: [
      { label: '申し出を受ける', desc: '魔王国との関係+50、人族国家との関係-20', fx: n => { const dk = S.nations.find(o => o.demonKing); addRel(n.id, dk.id, 50); for (const o of S.nations) if (o.race === 'human' && o.id !== n.id) addRel(n.id, o.id, -20); } },
      { label: '使者を斬る', desc: '魔王国との関係-50、人族国家との関係+15、政務+30', fx: n => { const dk = S.nations.find(o => o.demonKing); addRel(n.id, dk.id, -50); for (const o of S.nations) if (o.race === 'human' && o.id !== n.id) addRel(n.id, o.id, 15); n.gov += 30; } },
    ],
  },
  {
    id: 'lostsoul', title: '迷い込んだ異世界人',
    text: () => `国境の森で、制服姿の少年少女が保護された。<br>「気づいたらここにいた」——どうやら召喚の儀を経ずに、こちらの世界へ落ちてきたらしい。`,
    options: [
      { label: '保護して仕官させる', desc: '異世界人1人を得る（N〜SR）', fx: n => { const c = makeSummoned(n, rint(0, 2)); if (c.role === 'general') n.generals.push(c); else if (n.advisors.length < 3) n.advisors.push(c); else n.bench.push(c); hooks.log(`✨ ${c.title} ${c.name}（${c.rarity}）が仕官した`, 'good'); } },
      { label: '魔力の触媒として研究する', desc: '魔力+80', fx: n => { n.mana += 80; } },
    ],
  },
  {
    id: 'demonarmy', title: '魔王軍の侵攻', cond: n => !n.demonKing && S.nations.some(o => o.demonKing && o.alive) && n.race !== 'demon',
    prep: n => randomOwnProv(n),
    text: (n, p) => `魔王の命を受けた魔物の大軍団が${esc(p.name)}に迫っている！<br>斥候の報告では、その数は通常の群れを遥かに上回る。`,
    options: [
      { label: '全軍で迎え撃つ', desc: '大規模な魔物の軍勢が出現（撃破で軍事点+50）', fx: (n, p) => { const a = spawnMonsters(p, Math.round(6000 + S.day / 360 * 200)); a.name = '魔王軍団'; a.bounty = true; } },
      { label: '城壁に籠もって耐える', desc: '安定度-1', fx: n => { n.stab = Math.max(-3, (n.stab || 0) - 1); } },
    ],
  },
  {
    id: 'heresy', title: '異端の広がり', prep: n => randomOwnProv(n, p => p.religion === n.religion && p.id !== n.capital),
    text: (n, p) => `${esc(p.name)}で、国教とは異なる教えを説く者が現れ、信者を増やしている。`,
    options: [
      { label: '異端審問を行う', desc: '政務-50', fx: n => { n.gov -= 50; } },
      { label: '信仰の自由を認める', desc: 'この州の宗教が変わる、政務+30', fx: (n, p) => { p.religion = pick(Object.keys(RELIGIONS).filter(r => r !== n.religion)); n.gov += 30; mapDirty = true; } },
    ],
  },
  {
    id: 'festival', title: '建国祭',
    text: (n) => `${esc(n.name)}の建国を祝う祭りが盛大に開かれた。転生者の君主が持ち込んだ「屋台」と「花火」が大評判だ。`,
    options: [
      { label: '祝祭を盛り上げる（金貨-40）', desc: '安定度+1', fx: n => { n.gold -= 40; n.stab = Math.min(3, (n.stab || 0) + 1); } },
      { label: '質素に済ませる', desc: '金貨+20', fx: n => { n.gold += 20; } },
    ],
  },
  {
    id: 'plague', title: '疫病の流行',
    text: () => `都市部で原因不明の熱病が広がっている。`,
    options: [
      { label: '治癒術師を派遣する（金貨-40）', desc: '被害を最小限に抑える', fx: n => { n.gold -= 40; } },
      { label: '静観する', desc: '人的資源-30%', fx: n => { n.manpower *= 0.7; } },
    ],
  },
  {
    id: 'inventor', title: '前世の知識：活版印刷',
    cond: n => !n.inventions.includes('printing'),
    text: (n) => `${esc(n.ruler.name)}は前世の記憶をもとに、職人たちに「活版印刷」の仕組みを説明した。`,
    options: [
      { label: '量産して識字率を上げる', desc: '発明「活版印刷」を完成させる', fx: n => { if (!n.inventions.includes('printing')) n.inventions.push('printing'); } },
      { label: '軍の教練書を刷る', desc: '政務+80', fx: n => { n.gov += 80; } },
    ],
  },
];

function playerEvents() {
  const n = nat(S.player); if (!n || !n.alive) return;
  if (Math.random() > 0.09) return;
  const cands = EVENTS.filter(e => (!e.cond || e.cond(n)) && !(n.evCD[e.id] > S.day));
  if (!cands.length) return;
  const e = pick(cands);
  const ctx = e.prep ? e.prep(n) : null;
  if (e.prep && !ctx) return;
  n.evCD[e.id] = S.day + 360 * 4;
  gainXP(n, 3);
  hooks.modal({
    title: '✦ ' + e.title, body: e.text(n, ctx),
    buttons: e.options.map(o => ({ label: o.label, desc: o.desc, fn: () => { o.fx(n, ctx); mapDirty = true; } })),
  });
}

// ---------- ゲーム開始 ----------
function newWorld(seed) {
  const w = generateWorld(seed);
  GRID = w.grid;
  S = {
    seed, day: 0, speed: 2, paused: true, started: false, player: -1,
    provinces: w.provinces, landCount: w.landCount, nodes: w.nodes, nations: w.nations, rel: w.rel, relBase: w.relBase,
    armies: [], fleets: [], guilds: [], nextGuildId: 1, wonders: [], aiCfg: Object.assign({}, AI_PRESETS.normal), wars: [], battles: {}, nextArmyId: 1, nextWarId: 1, nextFleetId: 1, nextCharId: 1, log: [], sel: null, over: false, victories: {}, ae: {}, diff: 'normal', tut: null, rebirths: 0,
  };
  mapDirty = true;
}
function startGame(playerId, cheat, rulerName, opts = {}) {
  S.player = playerId; S.diff = opts.diff || 'normal'; S.aiCfg = Object.assign({}, AI_PRESETS.normal, opts.aiCfg || AI_PRESETS[S.diff] || {});
  for (const n of S.nations) {
    if (n.isMonster) continue;
    n.manpower = maxManpower(n);
    const fl = forceLimit(n);
    const regs = Math.max(3, Math.round(fl * (n.demonKing ? 0.75 : 0.55)));
    const cav = Math.round(regs * 0.2), mage = n.demonKing ? Math.round(regs * 0.1) : 0;
    createArmy(n.id, n.capital, regs - cav - mage, cav, mage);
  }
  const p = nat(playerId);
  p.isPlayer = true; p.cheat = cheat;
  p.ruler = { name: rulerName || '転生者', cap: 3, reincarnated: true, xp: 0, lv: 1 };
  p.sp = 1; p.mana = 60;
  if (cheat === 'hero') createArmy(playerId, p.capital, 6, 4, 2, { hero: true, name: '勇者隊' });
  p.gold += 50;
  // 初期の将軍・代官・艦隊
  for (const n of S.nations) {
    if (n.isMonster) continue;
    n.gov += NATIVE_GOV_COST; const gv = recruitNativeGov(n); if (gv) assignGovernor(n, gv, n.capital);
    n.gov += generalCost(n); const g = recruitGeneral(n);
    const a = S.armies.find(a => a.owner === n.id && !a.hero); if (g && a) a.gen = g.id;
    const port = ownedProvs(n.id).find(q => q.coastal);
    if (port && n.size !== 'small') createFleet(n.id, port.snb[0], n.size === 'big' ? 3 : 1, 2);
  }
  S.started = true; S.paused = true;
  mapDirty = true;
  hooks.log(`✨ ${p.ruler.name}は${p.name}の君主として転生した。王国暦${START_YEAR}年、物語が始まる。`, 'good');
}

// ---------- セーブ／ロード ----------
const SAVE_KEY = 'isekai-senki-save-v3';
const DYN_KEYS = ['owner', 'controller', 'dev', 'fort', 'b', 'siege', 'colonizing', 'converting', 'coreUntil', 'dungeon', 'good', 'terrain', 'religion'];
function serialize() {
  return JSON.stringify({
    v: 3, seed: S.seed, day: S.day, speed: S.speed, player: S.player,
    nations: S.nations, rel: S.rel, relBase: S.relBase, armies: S.armies, fleets: S.fleets, guilds: S.guilds, nextGuildId: S.nextGuildId, wonders: S.wonders, aiCfg: S.aiCfg, wars: S.wars, victories: S.victories, demonKingSlayer: S.demonKingSlayer,
    nextArmyId: S.nextArmyId, nextWarId: S.nextWarId, nextFleetId: S.nextFleetId, nextCharId: S.nextCharId, log: S.log.slice(-40), ae: S.ae, diff: S.diff, tut: S.tut, rebirths: S.rebirths,
    provs: S.provinces.map(p => DYN_KEYS.map(k => p[k])),
  });
}
function saveGame() { try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; } }
function autosave() { if (S && S.started && !S.over) saveGame(); }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 3) return false;
  newWorld(d.seed);
  Object.assign(S, { day: d.day, speed: d.speed, player: d.player, nations: d.nations, rel: d.rel, relBase: d.relBase, armies: d.armies, fleets: d.fleets || [], guilds: d.guilds || [], nextGuildId: d.nextGuildId || 1, wonders: d.wonders || [], aiCfg: d.aiCfg || Object.assign({}, AI_PRESETS.normal), wars: d.wars, victories: d.victories || {}, demonKingSlayer: d.demonKingSlayer,
    nextArmyId: d.nextArmyId, nextWarId: d.nextWarId, nextFleetId: d.nextFleetId || 1, nextCharId: d.nextCharId || 1, log: d.log || [], ae: d.ae || {}, diff: d.diff || 'normal', tut: d.tut || null, rebirths: d.rebirths || 0 });
  d.provs.forEach((vals, i) => DYN_KEYS.forEach((k, j) => S.provinces[i][k] = vals[j]));
  S.started = true; S.paused = true; S.battles = {};
  mapDirty = true;
  return true;
}

// ---------- 再転生 ----------
function rebirth(newId) {
  const old = nat(S.player), n = nat(newId);
  if (!n || !n.alive || n.isMonster) return false;
  old.isPlayer = false;
  n.isPlayer = true; n.cheat = old.cheat;
  n.ruler = Object.assign({}, old.ruler);
  n.sp = old.sp || 0; n.skills = (old.skills || []).slice();
  if (n.overlord) { breakAlliance(n.id, n.overlord); n.overlord = null; }
  S.player = newId; S.over = false; S.paused = true; S.rebirths = (S.rebirths || 0) + 1;
  S.sel = { type: 'prov', id: n.capital };
  mapDirty = true;
  hooks.log(`🔁 ${n.ruler.name}の魂は${n.name}の君主として再び転生した`, 'good');
  return true;
}
