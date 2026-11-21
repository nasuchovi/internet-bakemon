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
  { id: 'admin', name: '内政チート', desc: '統治点+3/月、税収+15%', mods: { admPts: 3, taxMod: 0.15 } },
  { id: 'knowledge', name: '現代知識', desc: '技術コスト-30%、開発コスト-20%', mods: { techCost: -0.3, devCost: -0.2 } },
  { id: 'alchemy', name: '錬金術', desc: '生産収入+30%、建設費-30%', mods: { prodMod: 0.3, buildCost: -0.3 } },
  { id: 'strategist', name: '軍略の天才', desc: '戦闘力+20%、士気+1.0', mods: { combat: 0.2, morale: 1.0 } },
  { id: 'hero', name: '勇者召喚', desc: '開始時に勇者の精鋭軍(戦闘力+30%)を得る。人的資源+30%', mods: { mpMod: 0.3 } },
  { id: 'charisma', name: '人たらし', desc: '外交点+3/月、関係改善2倍、同盟を組みやすい', mods: { dipPts: 3, relMult: 1, allyAccept: 30 } },
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
