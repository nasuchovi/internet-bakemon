'use strict';
// ===== イベント・ゲーム開始・セーブ =====
function randomOwnProv(n, f) { const l = ownedProvs(n.id).filter(p => p.controller === n.id && (!f || f(p))); return l.length ? pick(l) : null; }

const EVENTS = [
  {
    id: 'drifter', title: '異世界からの漂流者',
    text: (n) => `${esc(prov(n.capital).name)}の郊外で、見慣れぬ服を着た若者が保護された。<br>「ニホン」という国から来たと言っている……。転生者である陛下には、どこか懐かしい響きだ。`,
    options: [
      { label: '知識を授けてもらう', desc: '統治点+80、外交点+40', fx: n => { n.adm += 80; n.dip += 40; } },
      { label: '騎士として取り立てる', desc: '人的資源+3000、軍事点+40', fx: n => { n.manpower += 3000; n.mil += 40; } },
    ],
  },
  {
    id: 'dungeon', title: 'ダンジョンの発見', prep: n => randomOwnProv(n, p => !p.dungeon),
    text: (n, p) => `${esc(p.name)}の地下深くで、古代のダンジョンへの入口が発見された。<br>中からは魔物の気配と、財宝の輝きが漏れている。`,
    options: [
      { label: '冒険者ギルドを誘致する', desc: '金貨-30、この州の生産収入+1/月（恒久）', fx: (n, p) => { n.gold -= 30; p.dungeon = true; } },
      { label: '財宝を回収して封印する', desc: '金貨+60', fx: n => { n.gold += 60; } },
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
      { label: '聖女を国の象徴とする', desc: '外交点+60、全ての国との関係+10', fx: n => { n.dip += 60; for (const o of S.nations) if (o.id > 0 && o.id !== n.id) addRel(n.id, o.id, 10); } },
      { label: '聖女を戦場へ', desc: '2年間 士気+0.5', fx: n => addTimed(n, 'morale', 0.5, 720, '聖女の加護') },
    ],
  },
  {
    id: 'harvest', title: '大豊作',
    text: () => `天候に恵まれ、今年は国中で記録的な豊作となった。`,
    options: [
      { label: '国庫に納める', desc: '金貨+(月収×5)', fx: n => { n.gold += Math.max(20, calcIncome(n).net * 5); } },
      { label: '民に還元する', desc: 'ランダムな2州の税+1', fx: n => { for (let i = 0; i < 2; i++) { const p = randomOwnProv(n); if (p) p.tax++; } } },
    ],
  },
  {
    id: 'manavein', title: '魔石鉱脈の発見', prep: n => randomOwnProv(n, p => p.good !== 'manastone'),
    text: (n, p) => `${esc(p.name)}の山中で、青く輝く魔石の大鉱脈が見つかった。`,
    options: [
      { label: '採掘を始める', desc: '交易品が「魔石」になる', fx: (n, p) => { p.good = 'manastone'; mapDirty = true; } },
      { label: '魔導研究に回す', desc: '統治点+50、軍事点+30', fx: n => { n.adm += 50; n.mil += 30; } },
    ],
  },
  {
    id: 'heroparty', title: '勇者パーティの来訪',
    text: () => `聖剣を携えた勇者と、その仲間たちが王宮を訪れた。<br>「この国のために剣を振るいたい」と申し出ている。`,
    options: [
      { label: '王宮に迎える（金貨-80）', desc: '3年間 戦闘力+15%', fx: n => { n.gold -= 80; addTimed(n, 'combat', 0.15, 1080, '勇者パーティ'); } },
      { label: '丁重にお帰りいただく', desc: '外交点+25', fx: n => { n.dip += 25; } },
    ],
  },
  {
    id: 'awakening', title: 'チート能力の覚醒',
    text: (n) => `転生者である${esc(n.ruler.name)}の内に眠っていた力が、ついに目覚めた。<br>脳裏に「スキルポイントを割り振ってください」という声が響く。`,
    options: [
      { label: '統治の才', desc: '統治点+120', fx: n => { n.adm += 120; } },
      { label: '交渉の才', desc: '外交点+120', fx: n => { n.dip += 120; } },
      { label: '戦の才', desc: '軍事点+120', fx: n => { n.mil += 120; } },
    ],
  },
  {
    id: 'envoy', title: '魔王の使者',
    cond: n => !n.demonKing && S.nations.some(o => o.demonKing && o.alive && !hostile(o.id, n.id)),
    text: () => `魔王国の使者が密かに訪れた。<br>「我が主と手を組めば、人族どもの領地は思いのまま……」`,
    options: [
      { label: '申し出を受ける', desc: '魔王国との関係+50、人族国家との関係-20', fx: n => { const dk = S.nations.find(o => o.demonKing); addRel(n.id, dk.id, 50); for (const o of S.nations) if (o.race === 'human' && o.id !== n.id) addRel(n.id, o.id, -20); } },
      { label: '使者を斬る', desc: '魔王国との関係-50、人族国家との関係+15、軍事点+30', fx: n => { const dk = S.nations.find(o => o.demonKing); addRel(n.id, dk.id, -50); for (const o of S.nations) if (o.race === 'human' && o.id !== n.id) addRel(n.id, o.id, 15); n.mil += 30; } },
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
    cond: n => n.tech.adm < 8,
    text: (n) => `${esc(n.ruler.name)}は前世の記憶をもとに、職人たちに「活版印刷」の仕組みを説明した。`,
    options: [
      { label: '量産して識字率を上げる', desc: '統治技術Lv+1', fx: n => { n.tech.adm++; } },
      { label: '軍の教練書を刷る', desc: '軍事点+80', fx: n => { n.mil += 80; } },
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
    provinces: w.provinces, nations: w.nations, rel: w.rel, relBase: w.relBase,
    armies: [], wars: [], battles: {}, nextArmyId: 1, nextWarId: 1, log: [], sel: null, over: false,
  };
  mapDirty = true;
}
function startGame(playerId, cheat, rulerName) {
  S.player = playerId;
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
  p.ruler = { name: rulerName || '転生者', adm: 3, dip: 3, mil: 3, reincarnated: true };
  if (cheat === 'hero') createArmy(playerId, p.capital, 6, 4, 2, { hero: true, name: '勇者隊' });
  p.gold += 50;
  S.started = true; S.paused = true;
  mapDirty = true;
  hooks.log(`✨ ${p.ruler.name}は${p.name}の君主として転生した。王国暦${START_YEAR}年、物語が始まる。`, 'good');
}

// ---------- セーブ／ロード ----------
const SAVE_KEY = 'isekai-senki-save-v1';
const DYN_KEYS = ['owner', 'controller', 'tax', 'prod', 'mp', 'fort', 'b', 'siege', 'colonizing', 'coreUntil', 'dungeon', 'good', 'terrain'];
function serialize() {
  return JSON.stringify({
    v: 1, seed: S.seed, day: S.day, speed: S.speed, player: S.player,
    nations: S.nations, rel: S.rel, relBase: S.relBase, armies: S.armies, wars: S.wars,
    nextArmyId: S.nextArmyId, nextWarId: S.nextWarId, log: S.log.slice(-40),
    provs: S.provinces.map(p => DYN_KEYS.map(k => p[k])),
  });
}
function saveGame() { try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; } }
function autosave() { if (S && S.started && !S.over) saveGame(); }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  newWorld(d.seed);
  Object.assign(S, { day: d.day, speed: d.speed, player: d.player, nations: d.nations, rel: d.rel, relBase: d.relBase, armies: d.armies, wars: d.wars, nextArmyId: d.nextArmyId, nextWarId: d.nextWarId, log: d.log || [] });
  d.provs.forEach((vals, i) => DYN_KEYS.forEach((k, j) => S.provinces[i][k] = vals[j]));
  S.started = true; S.paused = true; S.battles = {};
  mapDirty = true;
  return true;
}
