'use strict';
// ===== 基本定数・ユーティリティ・ゲームデータ =====
const MAP_W = 1600, MAP_H = 1000;
const MONSTER = 0;
const START_YEAR = 1000, END_YEAR = 1100;
const SPEEDS = [0, 1.5, 4, 8, 16, 32]; // 日/秒

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const R = mulberry32(seed | 0);
  const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint16Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = R();
  const h = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
  function vn(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    oct = oct || 4; let s = 0, amp = 1, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += vn(x * f + i * 17.1, y * f + i * 31.7) * amp; n += amp; amp *= 0.5; f *= 2.02; }
    return s / n;
  }
  return { vn, fbm };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr, R) => arr[Math.floor((R || Math.random)() * arr.length)];
function shuffle(arr, R) { R = R || Math.random; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function fmt(n, d = 0) { return Number(n).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtMen(m) { m = Math.max(0, m); return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + 'k' : String(Math.round(m)); }
function dateStr(day) {
  const y = START_YEAR + Math.floor(day / 360), m = Math.floor(day % 360 / 30) + 1, d = day % 30 + 1;
  return `${y}年${m}月${d}日`;
}
function rgb(c, a) { return a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const TERRAIN = {
  plains:    { name: '平原', move: 1.0, def: 0, color: [156, 186, 104], dev: 1.15, shade: 1.0 },
  forest:    { name: '森林', move: 1.3, def: 1, color: [70, 124, 70],   dev: 0.9,  shade: 0.93 },
  hills:     { name: '丘陵', move: 1.4, def: 1, color: [176, 160, 104], dev: 0.95, shade: 0.95 },
  mountains: { name: '山岳', move: 1.8, def: 2, color: [138, 128, 118], dev: 0.7,  shade: 0.86 },
  desert:    { name: '砂漠', move: 1.3, def: 0, color: [224, 200, 136], dev: 0.6,  shade: 1.05 },
  marsh:     { name: '湿地', move: 1.5, def: 1, color: [96, 134, 116],  dev: 0.8,  shade: 0.95 },
  miasma:    { name: '魔境', move: 1.6, def: 1, color: [116, 82, 146],  dev: 0.75, shade: 0.9 },
};
const GOODS = {
  grain:      { name: '穀物',   price: 2.0, color: [232, 210, 110] },
  wood:       { name: '木材',   price: 2.0, color: [128, 88, 52] },
  iron:       { name: '鉄',     price: 3.0, color: [118, 128, 146] },
  fur:        { name: '毛皮',   price: 2.5, color: [176, 122, 82] },
  spice:      { name: '香辛料', price: 3.5, color: [222, 122, 52] },
  herb:       { name: '薬草',   price: 2.8, color: [96, 200, 120] },
  wine:       { name: '葡萄酒', price: 3.0, color: [150, 40, 84] },
  manastone:  { name: '魔石',   price: 4.5, color: [80, 156, 255] },
  mithril:    { name: 'ミスリル', price: 5.0, color: [200, 232, 255] },
  dragonbone: { name: '竜骨',   price: 5.0, color: [244, 240, 214] },
};
const TERRAIN_GOODS = {
  plains: ['grain', 'grain', 'grain', 'wine', 'herb'], forest: ['wood', 'wood', 'fur', 'herb'],
  hills: ['iron', 'wine', 'grain', 'manastone'], mountains: ['iron', 'iron', 'mithril', 'manastone'],
  desert: ['spice', 'spice', 'dragonbone'], marsh: ['herb', 'fur', 'manastone'], miasma: ['manastone', 'dragonbone', 'herb'],
};

const RACES = {
  human: {
    name: '人族', desc: '税収+10%', mods: { taxMod: 0.10 }, pref: ['plains'],
    pre: ['アル', 'ベル', 'カル', 'ドレ', 'エド', 'フォル', 'グラ', 'ハル', 'リン', 'ロー', 'マル', 'ノル', 'セル', 'ヴィン', 'オル', 'テオ', 'クレ', 'ラン', 'ウェス', 'アウ'],
    mid: ['ダ', 'ミ', 'ネ', 'ロ', 'ス', 'ヴァ', 'テ'],
    suf: ['ヘイム', 'ブルク', 'ガルド', 'ミア', 'トン', 'リア', 'ニア', 'ベルク', 'ウッド', 'フォード', 'ディア', 'ハイン'],
    rulers: ['アルベルト', 'レオン', 'エリザ', 'フリードリヒ', 'マリアンヌ', 'ジークハルト', 'クラウス', 'セシリア', 'オスカー', 'ヴィルヘルム'],
    units: { inf: '歩兵', cav: '騎士', mage: '魔導兵' },
  },
  elf: {
    name: 'エルフ', desc: '森林・湿地で戦闘力+25%、外交点+1/月', mods: { dipPts: 1 }, pref: ['forest', 'marsh'],
    pre: ['シル', 'ルー', 'ファ', 'エア', 'リ', 'ティ', 'メル', 'イル', 'ナ', 'セレ', 'ア', 'ロス', 'フィ'],
    mid: ['ラ', 'ネ', 'ウィ', 'リ', 'エ'],
    suf: ['ヴァーナ', 'リエル', 'ノール', 'ウィン', 'ディル', 'ローレ', 'ミル', 'シア', 'ティア', 'フェン'],
    rulers: ['シルヴィア', 'ルシエル', 'ファリス', 'イリアス', 'メルティナ', 'セレスタ', 'ティリエル'],
    units: { inf: '森の射手', cav: '鹿騎兵', mage: '精霊術師' },
  },
  dwarf: {
    name: 'ドワーフ', desc: '生産収入+15%、首都の要塞+1', mods: { prodMod: 0.15 }, pref: ['mountains', 'hills'],
    pre: ['ドゥル', 'カズ', 'グリム', 'ボル', 'トール', 'ザン', 'ガン', 'ブロ', 'ドゥ', 'クル', 'モル', 'バル'],
    mid: ['ガ', 'ド', 'ル', 'グ'],
    suf: ['ドゥーム', 'ハイム', 'モルグ', 'ガズ', 'ダル', 'ボルン', 'カル', 'ゴル'],
    rulers: ['ボルグ', 'グリムナー', 'トルガン', 'ブロック', 'ドゥーラ', 'カズラク'],
    units: { inf: '斧兵', cav: '猪騎兵', mage: 'ルーン術師' },
  },
  beast: {
    name: '獣人', desc: '人的資源+25%、移動速度+15%', mods: { mpMod: 0.25, moveSpeed: 0.15 }, pref: ['plains', 'marsh', 'forest'],
    pre: ['ガル', 'ルガ', 'ウル', 'ファン', 'ロウ', 'ジン', 'ハク', 'キバ', 'ラオ', 'グル', 'シシ', 'タイ'],
    mid: ['ガ', 'ル', 'ン', 'ウ'],
    suf: ['ラ', 'ガ', 'ロウ', 'ザ', 'ジャ', 'ホ', 'ゴウ', 'マル'],
    rulers: ['ガロウ', 'ルガ', 'ファング', 'シシマル', 'ハクロウ', 'キバ'],
    units: { inf: '獣戦士', cav: '狼騎兵', mage: '呪術師' },
  },
  demon: {
    name: '魔族', desc: '戦闘力+10%、他種族から警戒される', mods: { combat: 0.10 }, pref: ['miasma', 'mountains'],
    pre: ['ヴォル', 'ザル', 'モル', 'ネク', 'ディア', 'バル', 'グラ', 'アズ', 'ベル', 'ルシ', 'アス'],
    mid: ['ガ', 'ゼ', 'ロ', 'ヴァ'],
    suf: ['ゴス', 'ザード', 'ヘル', 'モア', 'ギア', 'デス', 'ゼル', 'ロス'],
    rulers: ['ヴォルガス', 'ザルディア', 'モルゲン', 'ネクロス', 'ベルゼ', 'アズラエル'],
    units: { inf: '魔兵', cav: '魔獣騎兵', mage: '黒魔導師' },
  },
  dragon: {
    name: '竜人', desc: '騎兵(竜騎兵)の戦闘力+30%、士気+0.5', mods: { morale: 0.5, cavPower: 0.3 }, pref: ['desert', 'mountains'],
    pre: ['ドラ', 'ヴァル', 'イグ', 'サラ', 'ラグ', 'ファフ', 'ティア', 'バハ', 'ニド'],
    mid: ['マ', 'グ', 'ル'],
    suf: ['ニール', 'ゴン', 'ヴァス', 'ムート', 'ノス', 'ラ'],
    rulers: ['イグニス', 'ヴァルナ', 'サラマ', 'ラグナ', 'ティアマ'],
    units: { inf: '竜鱗兵', cav: '竜騎兵', mage: '竜語術師' },
  },
};

const CHEATS = [
  { id: 'admin', name: '内政チート', desc: '政務+3/月、税収+15%', mods: { govPts: 3, taxMod: 0.15 } },
  { id: 'knowledge', name: '現代知識', desc: '前世の知識+1.5/月、発明コスト-20%', mods: { knowPts: 1.5, inventCost: -0.2 } },
  { id: 'alchemy', name: '錬金術', desc: '生産収入+30%、建設費-30%', mods: { prodMod: 0.3, buildCost: -0.3 } },
  { id: 'strategist', name: '軍略の天才', desc: '戦闘力+20%、士気+1.0', mods: { combat: 0.2, morale: 1.0 } },
  { id: 'hero', name: '勇者召喚', desc: '開始時に勇者の精鋭軍(戦闘力+30%)を得る。人的資源+30%', mods: { mpMod: 0.3 } },
  { id: 'charisma', name: '人たらし', desc: '政務+2/月、関係改善2倍、同盟を組みやすい', mods: { govPts: 2, relMult: 1, allyAccept: 30 } },
];
const CHEAT_BY_ID = Object.fromEntries(CHEATS.map(c => [c.id, c]));

const UNITS = {
  inf:  { name: '歩兵',   cost: 12, maint: 0.25, power: 1.0 },
  cav:  { name: '騎兵',   cost: 30, maint: 0.6,  power: 1.6 },
  mage: { name: '魔導兵', cost: 35, maint: 0.7,  power: 1.3 },
};
const BUILDINGS = {
  temple:   { name: '神殿', cost: 60,  desc: '税収+40%' },
  workshop: { name: '工房', cost: 70,  desc: '生産収入+50%' },
  barracks: { name: '兵舎', cost: 50,  desc: '人的資源+50%' },
  walls:    { name: '城壁', cost: 100, desc: '要塞Lv+1 (維持費0.4/月)' },
};
const DEV_TYPES = {
  tax:  { pt: 'adm', name: '税' },
  prod: { pt: 'dip', name: '生産' },
  mp:   { pt: 'mil', name: '兵力' },
};
const TECHS = {
  adm: { name: '統治技術', desc: 'Lvごとに税収・生産+4%' },
  dip: { name: '外交技術', desc: 'Lvごとに生産+3%、入植費-5%' },
  mil: { name: '軍事技術', desc: 'Lvごとに戦闘力+6%、士気+0.1' },
};
const PT_NAMES = { adm: '統治', dip: '外交', mil: '軍事' };

const NATION_TEMPLATES = [
  { race: 'human', gov: '帝国', size: 'big', color: [176, 38, 50] },
  { race: 'human', gov: '王国', size: 'mid', color: [50, 96, 184] },
  { race: 'human', gov: '公国', size: 'small', color: [214, 156, 46] },
  { race: 'human', gov: '聖教国', size: 'mid', color: [236, 232, 214] },
  { race: 'human', gov: '自由都市同盟', size: 'small', color: [206, 104, 160] },
  { race: 'elf', gov: '森王国', size: 'mid', color: [44, 150, 80] },
  { race: 'elf', gov: '盟約国', size: 'small', color: [150, 204, 90] },
  { race: 'dwarf', gov: '山岳王国', size: 'mid', color: [128, 82, 44] },
  { race: 'dwarf', gov: '氏族連合', size: 'small', color: [190, 140, 92] },
  { race: 'beast', gov: '大部族連合', size: 'mid', color: [210, 96, 36] },
  { race: 'beast', gov: '族長国', size: 'small', color: [232, 200, 60] },
  { race: 'demon', gov: '魔王国', size: 'big', color: [74, 28, 98], demonKing: true },
  { race: 'demon', gov: '辺境伯領', size: 'small', color: [150, 62, 150] },
  { race: 'dragon', gov: '竜帝国', size: 'small', color: [36, 146, 156] },
];
const SIZE_RANGE = { big: [16, 20], mid: [9, 13], small: [5, 8] };
const SIZE_LABEL = { big: 'やさしい', mid: 'ふつう', small: 'むずかしい' };
const UNOWNED_COLOR = [206, 198, 178];
const MONSTER_COLOR = [36, 18, 40];
const MONSTER_NAMES = ['ゴブリンの大群', 'オークの軍勢', 'アンデッドの群れ', 'ワイバーンの群れ', '魔獣の群れ', 'トロールの一団', 'リザードマンの戦団'];

// ===== 拡張データ =====
const REBEL = NATION_TEMPLATES.length + 1;
const REBEL_COLOR = [96, 20, 20];
TERRAIN.sea = { name: '海', move: 1.2, def: 0, color: [40, 80, 120], dev: 0, shade: 1 };

const RELIGIONS = {
  light:    { name: '光輪教',   color: [240, 222, 140] },
  spirit:   { name: '精霊信仰', color: [110, 200, 120] },
  ancestor: { name: '祖霊信仰', color: [176, 120, 72] },
  beastgod: { name: '獣神信仰', color: [222, 132, 60] },
  abyss:    { name: '深淵教',   color: [120, 60, 160] },
  dragon:   { name: '竜神信仰', color: [60, 170, 180] },
};
const RACE_RELIGION = { human: 'light', elf: 'spirit', dwarf: 'ancestor', beast: 'beastgod', demon: 'abyss', dragon: 'dragon' };

const SHIPS = {
  war:   { name: '戦列艦', cost: 40, maint: 0.5 },
  trans: { name: '輸送艦', cost: 15, maint: 0.15 },
};

// 転生者のスキルツリー（4系統×4段）
const SKILL_BRANCHES = { adm: '内政', dip: '外交', mil: '武勇', mag: '魔導' };
const SKILLS = [
  { id: 'k1', br: 'adm', name: '鑑定眼', desc: '税収+10%', mods: { taxMod: 0.1 } },
  { id: 'k2', br: 'adm', name: '経営学', desc: '代官による発展+30%、生産+10%', mods: { devGrowth: 0.3, prodMod: 0.1 }, req: 'k1' },
  { id: 'k3', br: 'adm', name: '都市計画', desc: '開拓コスト-20%、反乱-1', mods: { devCost: -0.2, unrest: -1 }, req: 'k2' },
  { id: 'k4', br: 'adm', name: '黄金律', desc: '建設費-20%、税収+10%', mods: { buildCost: -0.2, taxMod: 0.1 }, req: 'k3' },
  { id: 'd1', br: 'dip', name: '交渉術', desc: '政務+1/月', mods: { govPts: 1 } },
  { id: 'd2', br: 'dip', name: '魅了', desc: '関係改善+50%、同盟受諾+10', mods: { relMult: 0.5, allyAccept: 10 }, req: 'd1' },
  { id: 'd3', br: 'dip', name: '商会網', desc: '商会収入+20%、商会枠+1', mods: { tradeMod: 0.2, guilds: 1 }, req: 'd2' },
  { id: 'd4', br: 'dip', name: '宗主の威光', desc: '外交併合コスト-30%', mods: { annexCost: -0.3 }, req: 'd3' },
  { id: 'm1', br: 'mil', name: '剣術', desc: '戦闘力+5%', mods: { combat: 0.05 } },
  { id: 'm2', br: 'mil', name: '統率', desc: '士気+0.5', mods: { morale: 0.5 }, req: 'm1' },
  { id: 'm3', br: 'mil', name: '攻城術', desc: '包囲速度+30%', mods: { siege: 0.3 }, req: 'm2' },
  { id: 'm4', br: 'mil', name: '覇王の覇気', desc: '戦闘力+10%、人的資源+20%', mods: { combat: 0.1, mpMod: 0.2 }, req: 'm3' },
  { id: 's1', br: 'mag', name: '魔力感知', desc: '魔力+1/月', mods: { manaPts: 1 } },
  { id: 's2', br: 'mag', name: '召喚術', desc: '召喚コスト-25%', mods: { summonCost: -0.25 }, req: 's1' },
  { id: 's3', br: 'mag', name: '大魔導', desc: '召喚のレア度が上がりやすい', mods: { rarityUp: 1 }, req: 's2' },
  { id: 's4', br: 'mag', name: '次元干渉', desc: '召喚事故が起きなくなる、魔力+2/月', mods: { noAccident: 1, manaPts: 2 }, req: 's3' },
];
const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

// 召喚（異世界からチート能力者を呼ぶ）
const RARITIES = [
  { id: 'N', mult: 0.5, w: 50, w2: 30, color: '#b9b2a4' },
  { id: 'R', mult: 0.75, w: 30, w2: 35, color: '#7ab8f0' },
  { id: 'SR', mult: 1.0, w: 15, w2: 25, color: '#d58cf0' },
  { id: 'SSR', mult: 1.5, w: 5, w2: 10, color: '#ffd45a' },
];
const SUMMON_POOL = [
  { id: 'swordsaint', title: '剣聖', role: 'general', desc: '元剣道部主将。剣の極致に至った', stats: [4, 2, 2, 1], mods: { combat: 0.15 } },
  { id: 'hero', title: '勇者', role: 'general', desc: '聖剣に選ばれし者', stats: [4, 3, 3, 2], mods: { combat: 0.2, morale: 0.5 }, minR: 2 },
  { id: 'tactician', title: '軍師', role: 'general', desc: '戦史オタクの大学院生', stats: [2, 3, 4, 3], mods: { moveSpeed: 0.15, siege: 0.25 } },
  { id: 'tamer', title: '魔物使い', role: 'general', desc: '魔物の言葉がわかる', stats: [2, 2, 3, 1], mods: { combat: 0.08, vsMonster: 0.6 } },
  { id: 'archmage', title: '殲滅魔導士', role: 'general', desc: '詠唱破棄で戦略級魔法を撃つ', stats: [5, 1, 1, 3], mods: { combat: 0.12, siege: 0.3 } },
  { id: 'sage', title: '大賢者', role: 'advisor', desc: '理系の院卒。知識チート', mods: { inventCost: -0.15, knowPts: 0.6, manaPts: 1 } },
  { id: 'saint', title: '聖女', role: 'advisor', desc: '癒しの奇跡で民を導く', mods: { unrest: -2, morale: 0.3 } },
  { id: 'merchant', title: '商人', role: 'advisor', desc: '前世はコンビニ店長', mods: { tradeMod: 0.25, guilds: 1 } },
  { id: 'cook', title: '料理人', role: 'advisor', desc: 'マヨネーズで外交を制す', mods: { mpMod: 0.15, relMult: 0.5 } },
  { id: 'architect', title: '建築士', role: 'advisor', desc: '一級建築士。耐震設計で城を建てる', mods: { buildCost: -0.25 } },
  { id: 'alchemist', title: '錬金術師', role: 'advisor', desc: '化学の知識で錬金術を極めた', mods: { prodMod: 0.2 } },
  { id: 'salaryman', title: '元営業マン', role: 'advisor', desc: '接待と根回しのプロ', mods: { govPts: 1.5, allyAccept: 15 } },
  { id: 'clerk', title: '元公務員', role: 'advisor', desc: '書類仕事で国が回り出す', mods: { govPts: 2, unrest: -1 } },
  { id: 'otaku', title: 'ミリオタ', role: 'advisor', desc: '近代戦術を持ち込んだ', mods: { govPts: 1, combat: 0.08 } },
  { id: 'farmer', title: '農業チート', role: 'advisor', desc: '輪作と肥料で収穫倍増', mods: { taxMod: 0.15 } },
];
const JP_SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '松本', '井上', '木村', '清水', '山崎', '森', '池田'];
const JP_GIVEN = ['ユウキ', 'ハルト', 'ソウタ', 'レン', 'ミナト', 'アオイ', 'ヒナタ', 'サクラ', 'ユイ', 'リン', 'カナタ', 'ミオ', 'ツムギ', 'コハル', 'タクミ', 'ダイチ', 'シオン', 'メイ', 'ケンジ', 'マコト'];
const GEN_STAT_NAMES = ['攻撃', '防御', '機動', '包囲'];

const ARTIFACTS = [
  { id: 'orb', name: '星詠みの宝珠', desc: '前世の知識+1/月', mods: { knowPts: 1 } },
  { id: 'shield', name: '竜王の鱗盾', desc: '戦闘力+8%', mods: { combat: 0.08 } },
  { id: 'horn', name: '豊穣の角杯', desc: '税収+10%', mods: { taxMod: 0.1 } },
  { id: 'feather', name: '風精の羽', desc: '移動速度+10%', mods: { moveSpeed: 0.1 } },
  { id: 'scale', name: '黄金の天秤', desc: '交易収入+15%', mods: { tradeMod: 0.15 } },
  { id: 'shard', name: '魔王の欠片', desc: '魔力+2/月', mods: { manaPts: 2 } },
  { id: 'banner', name: '不屈の軍旗', desc: '士気+0.5', mods: { morale: 0.5 } },
  { id: 'crown', name: '古王の冠', desc: '政務+1/月、反乱-1', mods: { govPts: 1, unrest: -1 } },
  { id: 'grimoire', name: '禁書グリモワール', desc: '召喚コスト-20%', mods: { summonCost: -0.2 } },
];
const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map(a => [a.id, a]));

// ===== 種族特性（長所・短所・時代成長）=====
const ERAS = ['黎明期', '興隆期', '動乱期', '魔導期', '終末期'];
Object.assign(RACES.human, { mods: { taxMod: 0.10, inventCost: -0.10, combat: -0.05 }, grow: { inventCost: -0.05, taxMod: 0.05 },
  pros: '税収+10%、発明コスト-10%', cons: '戦闘力-5%', growDesc: '時代ごとに発明コスト-5%・税収+5%（適応力）' });
Object.assign(RACES.elf, { mods: { forestCombat: 0.30, govPts: 1, mpMod: -0.30, prodMod: -0.10 }, grow: { forestCombat: 0.10, manaPts: 0.5 },
  pros: '森林・湿地で戦闘力+30%、政務+1/月', cons: '人的資源-30%、生産-10%', growDesc: '時代ごとに森での戦闘力+10%・魔力+0.5/月' });
Object.assign(RACES.dwarf, { mods: { prodMod: 0.20, siege: 0.20, moveSpeed: -0.15 }, grow: { prodMod: 0.05, siege: 0.10 },
  pros: '生産+20%、包囲速度+20%、首都の要塞+1', cons: '移動速度-15%', growDesc: '時代ごとに生産+5%・包囲速度+10%' });
Object.assign(RACES.beast, { mods: { mpMod: 0.40, moveSpeed: 0.15, inventCost: 0.15 }, grow: { mpMod: 0.10, combat: 0.03 },
  pros: '人的資源+40%、移動速度+15%', cons: '発明コスト+15%', growDesc: '時代ごとに人的資源+10%・戦闘力+3%' });
Object.assign(RACES.demon, { mods: { combat: 0.15, morale: 0.5, unrest: 1 }, grow: { combat: 0.05 },
  pros: '戦闘力+15%、士気+0.5', cons: '反乱+1、他種族から警戒される', growDesc: '時代ごとに戦闘力+5%' });
Object.assign(RACES.dragon, { mods: { cavPower: 0.40, morale: 0.5, mpMod: -0.25, devCost: 0.20 }, grow: { cavPower: 0.15, morale: 0.25 },
  pros: '竜騎兵の戦闘力+40%、士気+0.5', cons: '人的資源-25%、開拓コスト+20%', growDesc: '時代ごとに竜騎兵+15%・士気+0.25' });
for (const r of Object.values(RACES)) r.desc = `${r.pros}／短所：${r.cons}`;

const DIFFICULTY = {
  easy:   { name: 'やさしい', aggr: 0.5, rogue: 0.5, grace: 360 * 5, desc: 'AIは穏やか、魔物・反乱は少なめ。最初の5年は攻められない' },
  normal: { name: 'ふつう',   aggr: 1.0, rogue: 1.0, grace: 360 * 2, desc: '標準的な難易度' },
  hard:   { name: 'むずかしい', aggr: 1.5, rogue: 1.3, grace: 360, desc: 'AIは好戦的、魔物・反乱も多い' },
};

// ===== 前世の知識（発明ツリー） =====
const INVENTION_COST = [0, 60, 130, 230, 380];
const INVENTIONS = [
  { id: 'rotation', tier: 1, icon: '🌾', name: '輪作農法', desc: '税収+10%', mods: { taxMod: 0.1 } },
  { id: 'mayo', tier: 1, icon: '🥚', name: 'マヨネーズ', desc: '関係改善+50%、人的資源+5%', mods: { relMult: 0.5, mpMod: 0.05 } },
  { id: 'soap', tier: 1, icon: '🧼', name: '石鹸と衛生', desc: '人的資源+10%、反乱-1', mods: { mpMod: 0.1, unrest: -1 } },
  { id: 'bookkeeping', tier: 1, icon: '📒', name: '複式簿記', desc: '商会収入+15%、政務+1/月', mods: { tradeMod: 0.15, govPts: 1 } },
  { id: 'crossbow', tier: 1, icon: '🏹', name: '改良クロスボウ', desc: '戦闘力+6%', mods: { combat: 0.06 } },
  { id: 'printing', tier: 2, icon: '📰', name: '活版印刷', req: 'bookkeeping', desc: '政務+1/月、前世の知識+0.5/月', mods: { govPts: 1, knowPts: 0.5 } },
  { id: 'compass', tier: 2, icon: '🧭', name: '羅針盤', desc: '造船費-25%、入植費-30%', mods: { shipCost: -0.25, colonizeCost: -0.3 } },
  { id: 'gunpowder', tier: 2, icon: '💥', name: '火薬', req: 'crossbow', desc: '戦闘力+10%、包囲速度+20%', mods: { combat: 0.1, siege: 0.2 } },
  { id: 'stock', tier: 2, icon: '🏦', name: '株式会社', req: 'bookkeeping', desc: '商会収入+15%、商会枠+1', mods: { tradeMod: 0.15, guilds: 1 } },
  { id: 'irrigation', tier: 2, icon: '💧', name: '灌漑', req: 'rotation', desc: '代官による発展+40%', mods: { devGrowth: 0.4 } },
  { id: 'steam', tier: 3, icon: '⚙', name: '蒸気機関', req: 'printing', desc: '生産+25%', mods: { prodMod: 0.25 } },
  { id: 'medicine', tier: 3, icon: '💊', name: '近代医学', req: 'soap', desc: '人的資源+20%、士気+0.5', mods: { mpMod: 0.2, morale: 0.5 } },
  { id: 'rifle', tier: 3, icon: '🔫', name: 'ライフル', req: 'gunpowder', desc: '戦闘力+12%、士気+0.3', mods: { combat: 0.12, morale: 0.3 } },
  { id: 'newspaper', tier: 3, icon: '🗞', name: '新聞', req: 'printing', desc: '反乱-1、安定度の費用-25%', mods: { unrest: -1, stabCost: -0.25 } },
  { id: 'railway', tier: 4, icon: '🚂', name: '鉄道', req: 'steam', desc: '移動速度+25%、商会収入+15%', mods: { moveSpeed: 0.25, tradeMod: 0.15 } },
  { id: 'telegraph', tier: 4, icon: '📡', name: '電信', req: 'newspaper', desc: '政務+2/月', mods: { govPts: 2 } },
  { id: 'magitech', tier: 4, icon: '🔮', name: '魔導工学', req: 'steam', desc: '魔力+2/月、魔導兵の戦闘力+40%', mods: { manaPts: 2, magePower: 0.4 } },
  { id: 'constitution', tier: 4, icon: '📜', name: '憲法', req: 'newspaper', desc: '税収+15%、反乱-2', mods: { taxMod: 0.15, unrest: -2 } },
];
const INVENTION_BY_ID = Object.fromEntries(INVENTIONS.map(i => [i.id, i]));

// ===== 代官（州に派遣する人物の効果） =====
const GOV_EFFECTS = {
  native:    { growth: 1.0, tax: 0.10, desc: '発展、税+10%' },
  sage:      { growth: 1.5, know: 0.4, desc: '発展+、前世の知識+0.4/月' },
  saint:     { growth: 1.0, unrest: -3, mp: 0.2, desc: '不穏-3、兵力+20%' },
  merchant:  { growth: 1.0, prod: 0.3, guild: 0.5, desc: '生産+30%、この州の商会+50%' },
  cook:      { growth: 1.2, mp: 0.3, unrest: -1, desc: '兵力+30%、不穏-1' },
  architect: { growth: 1.5, fort: 1, desc: '発展+、要塞Lv+1' },
  alchemist: { growth: 1.0, prod: 0.6, desc: '生産+60%' },
  salaryman: { growth: 1.0, tax: 0.3, guild: 0.3, desc: '税+30%、商会+30%' },
  clerk:     { growth: 1.2, tax: 0.4, unrest: -1, desc: '税+40%、不穏-1' },
  otaku:     { growth: 1.0, mp: 0.4, fort: 1, desc: '兵力+40%、要塞Lv+1' },
  farmer:    { growth: 2.0, tax: 0.6, desc: '発展++、税+60%' },
};
const NATIVE_GOV_COST = 40;

// ===== 大建造物（世界に一つ） =====
const WONDERS = [
  { id: 'garden', icon: '🌳', name: '空中庭園', cost: 900, months: 36, minDev: 15, desc: '税収+15%、反乱-2', mods: { taxMod: 0.15, unrest: -2 }, flavor: '魔石の浮力で天に浮かぶ大庭園。転生者の記憶にある古代の伝説を、魔法で再現した。' },
  { id: 'tower', icon: '🗼', name: '大魔導塔', cost: 800, months: 30, minDev: 12, desc: '魔力+4/月、次元の歪みの回復+2/月', mods: { manaPts: 4, riftDecay: 2 }, flavor: '雲を貫く魔導の塔。大陸中の魔力の流れがここに集う。' },
  { id: 'library', icon: '📚', name: '叡智の大図書館', cost: 850, months: 32, minDev: 14, desc: '前世の知識+2/月、発明コスト-10%', mods: { knowPts: 2, inventCost: -0.1 }, flavor: '前世の記憶を書き写した写本が、天井まで積み上がる。' },
  { id: 'lighthouse', icon: '🔆', name: '天空灯台', cost: 700, months: 28, minDev: 10, coastal: true, desc: '商会収入+20%、海戦の戦闘力+25%', mods: { tradeMod: 0.2, navalCombat: 0.25 }, flavor: '魔石の光は百里先の船をも導く。沿岸の州にしか建てられない。' },
  { id: 'bazaar', icon: '🪙', name: '黄金の大市場', cost: 1000, months: 30, minDev: 15, desc: '商会収入+30%、商会枠+2', mods: { tradeMod: 0.3, guilds: 2 }, flavor: '大陸中の品が並ぶ、黄金の屋根の大市場。' },
  { id: 'arena', icon: '🏟', name: '竜骨の大闘技場', cost: 750, months: 26, minDev: 12, desc: '士気+0.5、戦闘力+5%、人的資源+15%', mods: { morale: 0.5, combat: 0.05, mpMod: 0.15 }, flavor: '古竜の骨で組まれた闘技場。勇士たちが名を競う。' },
  { id: 'cathedral', icon: '⛪', name: '聖光大聖堂', cost: 800, months: 30, minDev: 12, desc: '反乱-2、関係改善+50%、安定度の費用-30%', mods: { unrest: -2, relMult: 0.5, stabCost: -0.3 }, flavor: '光輪の紋章を戴く大聖堂。巡礼者が絶えない。' },
  { id: 'gate', icon: '🌀', name: '次元門', cost: 1200, months: 40, minDev: 16, desc: '召喚コスト-30%、高レア度が出やすい', mods: { summonCost: -0.3, rarityUp: 1 }, flavor: '異界と常につながる巨大な門。禁忌とされた技術の結晶。' },
  { id: 'worldtree', icon: '🌲', name: '世界樹の聖域', cost: 900, months: 34, minDev: 10, terrain: 'forest', desc: '人的資源+25%、代官による発展+30%', mods: { mpMod: 0.25, devGrowth: 0.3 }, flavor: '世界樹の若木を祀る聖域。森林の州にしか建てられない。' },
];
const WONDER_BY_ID = Object.fromEntries(WONDERS.map(w => [w.id, w]));

// ===== AIの詳細設定 =====
const AI_SETTINGS = [
  { key: 'aggr', name: '攻撃性', desc: 'AIが戦争を仕掛ける頻度', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'expand', name: '入植意欲', desc: 'AIが未開の地へ入植する頻度', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'ally', name: '同盟の結びやすさ', desc: 'AI同士が同盟を組む頻度', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'summon', name: '召喚の頻度', desc: 'AIが異世界人を召喚する頻度', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'wonder', name: '大建造物への意欲', desc: 'AIが大建造物を建てようとする頻度', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'aiEcon', name: 'AIの経済力', desc: 'AIの黒字収入の倍率', min: 0.5, max: 2, step: 0.05, pct: true },
  { key: 'aiKnow', name: 'AIの知識収入', desc: 'AIが前世の知識を得る速さ', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'ae', name: '警戒されやすさ', desc: '領土を奪った時に上がる警戒度の倍率', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'monster', name: '魔物の出現', desc: '大陸全体の魔物の湧きやすさ', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'rebel', name: '反乱の頻度', desc: '大陸全体の反乱の起きやすさ', min: 0, max: 2, step: 0.1, pct: true },
  { key: 'grace', name: '開始時の猶予', desc: 'AIがプレイヤーに宣戦しない期間', min: 0, max: 10, step: 1, unit: '年' },
];
const AI_PRESETS = {
  easy:   { aggr: 0.5, expand: 0.8, ally: 1.0, summon: 0.7, wonder: 0.7, aiEcon: 0.85, aiKnow: 0.8, ae: 0.7, monster: 0.6, rebel: 0.6, grace: 5 },
  normal: { aggr: 1.0, expand: 1.0, ally: 1.0, summon: 1.0, wonder: 1.0, aiEcon: 1.0, aiKnow: 1.0, ae: 1.0, monster: 1.0, rebel: 1.0, grace: 2 },
  hard:   { aggr: 1.5, expand: 1.2, ally: 1.2, summon: 1.3, wonder: 1.3, aiEcon: 1.25, aiKnow: 1.2, ae: 1.3, monster: 1.2, rebel: 1.2, grace: 1 },
};
