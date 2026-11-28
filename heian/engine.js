/* =========================================================
   550万分の1 ― 平安時代に生まれたら
   人生エンジン（DOM非依存。ブラウザでも node でも動く）
   ※確率・数値は史料・研究をもとにゲーム用に丸めた推定値
========================================================= */
(function (root) {
"use strict";

const R = () => Math.random();
const pick = (a) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + R() * (b - a);
function wpick(list) {
  let t = 0;
  for (const x of list) t += x.w;
  let r = R() * t;
  for (const x of list) { if ((r -= x.w) < 0) return x; }
  return list[list.length - 1];
}
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/* ---------------- 元号 ---------------- */
const ERAS = [
  [782,"延暦"],[806,"大同"],[810,"弘仁"],[824,"天長"],[834,"承和"],[848,"嘉祥"],[851,"仁寿"],
  [854,"斉衡"],[857,"天安"],[859,"貞観"],[877,"元慶"],[885,"仁和"],[889,"寛平"],[898,"昌泰"],
  [901,"延喜"],[923,"延長"],[931,"承平"],[938,"天慶"],[947,"天暦"],[957,"天徳"],[961,"応和"],
  [964,"康保"],[968,"安和"],[970,"天禄"],[973,"天延"],[976,"貞元"],[978,"天元"],[983,"永観"],
  [985,"寛和"],[987,"永延"],[989,"永祚"],[990,"正暦"],[995,"長徳"],[999,"長保"],[1004,"寛弘"],
  [1012,"長和"],[1017,"寛仁"],[1021,"治安"],[1024,"万寿"],[1028,"長元"],[1037,"長暦"],[1040,"長久"],
  [1044,"寛徳"],[1046,"永承"],[1053,"天喜"],[1058,"康平"],[1065,"治暦"],[1069,"延久"],[1074,"承保"],
  [1077,"承暦"],[1081,"永保"],[1084,"応徳"],[1087,"寛治"],[1094,"嘉保"],[1096,"永長"],[1097,"承徳"],
  [1099,"康和"],[1104,"長治"],[1106,"嘉承"],[1108,"天仁"],[1110,"天永"],[1113,"永久"],[1118,"元永"],
  [1120,"保安"],[1124,"天治"],[1126,"大治"],[1131,"天承"],[1132,"長承"],[1135,"保延"],[1141,"永治"],
  [1142,"康治"],[1144,"天養"],[1145,"久安"],[1151,"仁平"],[1154,"久寿"],[1156,"保元"],[1159,"平治"],
  [1160,"永暦"],[1161,"応保"],[1163,"長寛"],[1165,"永万"],[1166,"仁安"],[1169,"嘉応"],[1171,"承安"],
  [1175,"安元"],[1177,"治承"],[1181,"養和"],[1182,"寿永"],[1184,"元暦"],[1185,"文治"],[1190,"建久"],
  [1199,"正治"],[1201,"建仁"],[1204,"元久"],[1206,"建永"],[1207,"承元"],[1211,"建暦"],[1213,"建保"],
  [1219,"承久"],[1222,"貞応"],[1224,"元仁"],[1225,"嘉禄"],[1227,"安貞"],[1229,"寛喜"],[1232,"貞永"],
  [1233,"天福"],[1234,"文暦"],[1235,"嘉禎"],[1238,"暦仁"],[1239,"延応"],[1240,"仁治"],[1243,"寛元"],
  [1247,"宝治"],[1249,"建長"],[1256,"康元"],[1257,"正嘉"],[1259,"正元"],[1260,"文応"],[1261,"弘長"],
  [1264,"文永"]
];
const KN = ["","一","二","三","四","五","六","七","八","九"];
function kanjiNum(n) {
  if (n < 10) return KN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? "" : KN[t]) + "十" + KN[o];
}
function kazoe(n) { return n < 10 ? kanjiNum(n) + "つ" : n + "歳"; }
function wareki(y) {
  let e = ERAS[0];
  for (const x of ERAS) { if (x[0] <= y) e = x; else break; }
  const n = y - e[0] + 1;
  return e[1] + (n === 1 ? "元" : kanjiNum(n)) + "年";
}

/* ---------------- 地域 ---------------- */
const REGION = {
  kyo: "平安京", kinai: "畿内", togoku: "東国", saigoku: "西国", kyushu: "九州", michinoku: "陸奥・出羽"
};
const RURAL_REGIONS = [
  { k: "kinai", w: 20 }, { k: "togoku", w: 28 }, { k: "saigoku", w: 26 }, { k: "kyushu", w: 13 }, { k: "michinoku", w: 13 }
];

/* ---------------- 身分 ---------------- */
// p: 生まれる確率（推定）。income/upkeep: 年あたりの財（石換算・ゲーム単位）
const STATUS = {
  kouzoku: { name: "皇族", p: 0.00002, income: 300, upkeep: 190, haz: 0.75, sc: 60, w0: 1500, noble: true, official: true,
    birth: ["天皇の皇子", "天皇の皇女"] },
  kugyo:   { name: "公卿", p: 0.00004, income: 360, upkeep: 230, haz: 0.75, sc: 60, w0: 2000, noble: true, official: true,
    birth: ["公卿の家の若君", "公卿の家の姫君"] },
  kizoku:  { name: "中級貴族", p: 0.0003, income: 46, upkeep: 32, haz: 0.8, sc: 10, w0: 150, noble: true, official: true,
    birth: ["中級貴族（五位）の家の息子", "中級貴族（五位）の家の姫君"] },
  kanjin:  { name: "下級官人", p: 0.008, income: 6.6, upkeep: 5.2, haz: 0.9, sc: 2, w0: 10, official: true,
    birth: ["下級官人の家の息子", "下級官人の家の娘"] },
  kyomin:  { name: "京の庶民", p: 0.015, wpw: 1.2, income: 2.8, upkeep: 2.4, haz: 1.12, sc: 1, w0: 2,
    birth: ["京の庶民の家の息子", "京の庶民の家の娘"] },
  gozoku:  { name: "地方豪族", p: 0.03, income: 24, upkeep: 17, haz: 0.88, sc: 8, w0: 60,
    birth: ["地方豪族の家の息子", "地方豪族の家の娘"] },
  gyomin:  { name: "漁民", p: 0.04, wpw: 1.08, income: 2.45, upkeep: 2.05, haz: 1.05, sc: 1, w0: 1,
    birth: ["海辺の漁民の家の息子", "海辺の漁民の家の娘"] },
  genin:   { name: "下人", p: 0.05, income: 0, upkeep: 0, haz: 1.22, sc: 0, w0: 0,
    birth: ["下人（奴婢）の息子", "下人（奴婢）の娘"] },
  nomin:   { name: "農民", p: 0, wpw: 1.1, income: 2.5, upkeep: 2.1, haz: 1.0, sc: 1, w0: 1.5,
    birth: ["農民の家の息子", "農民の家の娘"] },
  // 途中でなれる身分
  so:      { name: "僧", income: 1.9, upkeep: 1.5, haz: 0.92, sc: 1, w0: 0 },
  furo:    { name: "浮浪人", wpw: 0.92, income: 1.95, upkeep: 1.7, haz: 1.15, sc: 1, w0: 0 },
  bushi:   { name: "武士", income: 18, upkeep: 12, haz: 1.0, sc: 6, w0: 0 },
  eji:     { name: "衛士", income: 1.7, upkeep: 1.3, haz: 1.08, sc: 1, w0: 0 }
};
(function () {
  let s = 0;
  for (const k in STATUS) if (k !== "nomin" && STATUS[k].p) s += STATUS[k].p;
  STATUS.nomin.p = 1 - s;
})();
const BIRTH_KEYS = ["kouzoku","kugyo","kizoku","kanjin","kyomin","gozoku","gyomin","genin","nomin"];

/* ---------------- 家の暮らし向き（同じ身分の中での差） ---------------- */
// w: 生まれたときの財の倍率 / inc: 稼ぎの倍率 / en: 縁 / flags: 最初から持っているもの
const TIERS = {
  nomin: [
    { id: "fugo", p: 0.10, short: "富豪", label: "富豪の輩の家", desc: "私営田や稲の貸し付けで蓄えのある、村の有力者の家です。", w: 4, inc: 1.3, en: 8, flags: { ox: 1, tools: 1 }, src: "Wikipedia「富豪層」（史料では「富豪之輩」）" },
    { id: "mid", p: 0.45, label: "人並みの百姓の家", desc: "自分の田を耕して暮らす、ごく普通の家です。", w: 1, inc: 1 },
    { id: "poor", p: 0.30, short: "田の少ない家", label: "田の少ない家", desc: "田が少なく、凶作の年はすぐに食べ物が尽きます。", w: 0.3, inc: 0.93 },
    { id: "sakunin", p: 0.15, short: "作人", label: "人の田を請けて耕す家", desc: (y) => y >= 950 ? "自分の田を持たず、荘園や公田を請け負って耕し、地子（請料）を納めて暮らします（作人）。" : "自分の田がほとんどなく、人の田を手伝って食いつないでいます。", w: 0, inc: 0.88, src: (y) => y >= 950 ? "Wikipedia「作人」（10世紀に地子を払って荘園の田を請作した田堵に始まる）" : undefined }
  ],
  gyomin: [
    { id: "fune", p: 0.25, short: "舟持ち", label: "舟を持つ家", desc: "自分の舟を持ち、人を乗せて漁に出る家です。", w: 2, inc: 1.2 },
    { id: "mid", p: 0.50, label: "人並みの漁民の家", desc: "小さな舟で、家族と漁をして暮らしています。", w: 1, inc: 1 },
    { id: "poor", p: 0.25, short: "雇われ", label: "人の舟に乗る家", desc: "舟を持たず、人の舟に乗って分け前をもらいます。", w: 0.3, inc: 0.9 }
  ],
  kyomin: [
    { id: "ichi", p: 0.20, short: "商い", label: "市で商いをする家", desc: "東西の市に店を出して暮らす家です。", w: 3, inc: 1.25 },
    { id: "mid", p: 0.50, label: "雑役で暮らす家", desc: "貴族の屋敷や役所の雑役で暮らしを立てています。", w: 1, inc: 1 },
    { id: "poor", p: 0.30, short: "その日暮らし", label: "その日暮らしの家", desc: "決まった仕事がなく、その日の食べ物を探して暮らしています。", w: 0.2, inc: 0.88 }
  ],
  gozoku: [
    { id: "gunji", p: 0.30, short: "郡司の家", label: "郡司を出す家", desc: "代々、郡の役人（郡司）を務めてきた、土地の名家です。", w: 1.5, inc: 1.2, en: 6, src: "Wikipedia「郡司」（在地首長としての権威を持つ）" },
    { id: "tato", p: 0.70, label: "富豪の輩（田堵）の家", desc: "田を請け負い、人を使って耕す、新しく力をつけた家です。", w: 1, inc: 1, src: "Wikipedia「富豪層」" }
  ],
  kanjin: [
    { id: "good", p: 0.20, short: "家産あり", label: "家産のある官人の家", desc: "役所勤めの給料のほかに、いくらかの田や蓄えがある家です。", w: 2, inc: 1.3 },
    { id: "mid", p: 0.55, label: "並の官人の家", desc: "役所勤めで、どうにか暮らしを立てている家です。", w: 1, inc: 1 },
    { id: "poor", p: 0.25, short: "つましい家", label: "つましい官人の家", desc: "位は低く、暮らしは庶民と大して変わりません。", w: 0.4, inc: 0.8 }
  ],
  kizoku: [
    { id: "juryo", p: 0.30, short: "受領の家", label: "受領を務める家", desc: "父は地方の国司（受領）を務め、任国で蓄えた富があります。", w: 3, inc: 1.6, flags: { juryoHouse: 1 }, src: "Wikipedia「受領」（受領は莫大な蓄財が可能だった）" },
    { id: "keishi", p: 0.45, short: "諸大夫", label: "摂関家に家司として仕える家", desc: "摂関家に仕えて引き立てを受ける、諸大夫の家です。", w: 1, inc: 1, en: 6, src: "Wikipedia「諸大夫」（家司として摂家に奉仕する家格）" },
    { id: "raku", p: 0.25, short: "零落", label: "零落した家", desc: "位だけはありますが、暮らしは苦しい家です。『今昔物語集』の、芋粥を夢見る五位のように。", w: 0.3, inc: 0.6, en: -4, src: "『今昔物語集』巻26第17話" }
  ],
  kugyo: [
    { id: "kindachi", p: 0.35, short: "君達", label: "君達（きんだち）の家", desc: "摂関家につらなり、子は将来の公卿と見なされる家です。", w: 1.8, inc: 1.5, en: 10, src: "Wikipedia「諸大夫」（藤原忠平の子孫などは「君達」と位置づけられた）" },
    { id: "mid", p: 0.65, label: "並の公卿の家", desc: "公卿の家ですが、摂関家の一門ではありません。", w: 1, inc: 1 }
  ]
};
function pickTier(st, year) {
  const list = TIERS[st];
  if (!list) return null;
  const t = wpick(list.map(x => Object.assign({}, x, { w: x.p, wMul: x.w })));
  return { id: t.id, short: t.short, label: t.label, desc: typeof t.desc === "function" ? t.desc(year) : t.desc, src: typeof t.src === "function" ? t.src(year) : t.src, share: t.p, wMul: t.wMul, inc: t.inc, en: t.en || 0, flags: t.flags || {} };
}

/* ---------------- 官位 ---------------- */
const RANKS = ["無位","少初位","大初位","従八位","正八位","従七位","正七位","従六位","正六位",
  "従五位下","従五位上","正五位","従四位","正四位","従三位","正三位","従二位","正二位","従一位","正一位"];
function rankIncome(r) {
  if (r <= 0) return 0;
  if (r < 9) return r * 0.35;
  return 30 * Math.pow(r - 8, 1.45);
}

/* ---------------- 年齢別の基礎死亡率（年あたり） ---------------- */
function baseHazard(a) {
  if (a === 0) return 0.135;
  if (a < 5) return 0.046;
  if (a < 15) return 0.011;
  if (a < 30) return 0.012;
  if (a < 40) return 0.015;
  if (a < 50) return 0.024;
  if (a < 60) return 0.045;
  if (a < 70) return 0.08;
  if (a < 80) return 0.15;
  return 0.28;
}
function naturalCause(s) {
  const a = s.age, rich = s.noble || s.st === "kugyo";
  if (a < 5) return wpick([
    { w: 34, c: "痢病（下痢）", d: "この時代、子どもの命を最も多く奪ったのは、ありふれたお腹の病でした。" },
    { w: 24, c: "咳の病", d: "ただの咳の病でした。ただの咳の病で、十分でした。" },
    { w: 26, c: "物の怪", d: "加持祈祷が行われましたが、物の怪のほうが強かったようです。" },
    { w: rich ? 2 : 16, c: "飢え", d: "家族の分の粥も、あなたに回されていました。" }
  ]);
  if (a < 15) return wpick([
    { w: 30, c: "痢病（下痢）", d: "井戸の水が悪かったのかもしれません。誰にも分かりませんでした。" },
    { w: 22, c: "瘧病（わらわやみ）", d: "熱と震えを繰り返す病でした。マラリアの類だったと考えられています。光源氏もかかりました。" },
    { w: s.st === "gyomin" ? 30 : 12, c: "溺死", d: "川（あるいは海）は、いつも通りそこにありました。" },
    { w: 18, c: "物の怪", d: "陰陽師は「方角が悪かった」と言いました。" }
  ]);
  if (a < 50) return wpick([
    { w: 26, c: "痢病（下痢）", d: "大人でも、普通に死ぬ病でした。" },
    { w: 18, c: "瘧病（わらわやみ）", d: "熱が引いたと思った三日後に、また熱が出ました。それを繰り返しました。" },
    { w: 16, c: "咳病（流行り風邪）", d: "都でも鄙でも、毎年のように流行していました。" },
    { w: rich ? 26 : 12, c: "物の怪", d: "枕元で僧が三人がかりで読経しました。三人とも途中で居眠りしました。" },
    { w: 10, c: "傷が膿んで", d: "小さな傷でした。薬は、ありませんでした。" },
    { w: rich ? 2 : 8, c: "盗賊に襲われて", d: "犯人は捕まりませんでした。探されもしませんでした。" }
  ]);
  return wpick([
    { w: a >= 62 ? 40 : 8, c: "老衰", d: "この時代としては、かなりの大往生です。" },
    { w: 20, c: "中風（卒中）", d: "朝、起きてきませんでした。" },
    { w: rich ? 22 : 3, c: "喉の渇く病（糖尿病か）", d: "昼も夜も水ばかり飲む病でした。『小右記』は、晩年の藤原道長も口が渇いて水を多く飲んだと記しています。誇っていいのかは分かりません。" },
    { w: 16, c: "胸の病", d: "長く咳が続いていました。" },
    { w: rich ? 14 : 8, c: "物の怪", d: "最期まで「あの者の霊が来る」とうなされていました。心当たりはあったようです。" },
    { w: 12, c: "痢病（下痢）", d: "年を取ると、お腹の病はなおさら命取りでした。" }
  ]);
}

/* ---------------- 名前（名付けの慣習は史料・研究の実例にならう） ---------------- */
const NM = {
  // 古代型（〜950年ごろ）：戸籍の実名（大嶋郷戸籍・筑前国川辺里戸籍・平城京木簡など）
  mOld: ["黒人", "刀良", "比都自", "佐留", "宇多麻呂", "宮麻呂", "牧夫", "牛養", "馬甘", "犬万呂", "猪手", "龍麻呂", "鯛麻呂", "得麻呂", "黒麻呂", "宮人"],
  // 女性名（戸籍・出雲国大税賑給歴名帳）
  fOld: ["阿古売", "佐久良売", "奈為売", "由良売", "姉売", "荒売", "呰売", "伊布賀志売", "子日女", "田特女", "麻蘇売"],
  // 平安中期以降の百姓：氏＋二字の実名（秦成重、名田名の恒貞・国弘・弘重、『新猿楽記』の豊益）の字を組み合わせる
  newChars: ["成", "重", "恒", "貞", "国", "弘", "豊", "益"],
  // 童名（坂本信道「古代童名一覧稿」、牛飼童の例）
  boyMaru: ["乙若丸", "金剛丸", "千寿丸", "苔雄丸", "光仙丸", "春童丸", "犬男丸"],
  boyKimi: ["田鶴君", "くま君", "苔君", "小千代君", "小若君"],
  // 奴婢（戸籍などに氏なしで記される）
  genin: ["太者", "粳売", "身売", "狛売", "垂水麻呂", "広山女", "小楓女"],
  // 氏（地域ごとの戸籍の例）
  uji: {
    togoku: ["孔王部", "刑部", "私部", "長谷部", "大伴部", "土師部"],
    michinoku: ["大伴部", "孔王部", "長谷部"],
    kinai: ["秦", "秦人部", "県主族", "物部"],
    saigoku: ["出雲臣", "物部", "秦", "日下部"],
    kyushu: ["卜部", "葛野部", "物部"],
    kyo: ["秦", "物部", "日下部"]
  },
  ujiNew: ["秦", "物部", "田中", "日下部"],
  // 下級官人の氏（官司請負制のもとで家業ごとに固定した氏）
  kanjinUji: ["菅原", "大江", "中原", "清原", "坂上", "小槻", "和気", "丹波", "賀茂", "安倍", "大中臣"],
  // 摂関家の通字の例（忠平・師輔・道長・頼通・師実・師通）
  sekkan: ["忠", "師", "道", "頼", "実", "通", "平", "輔", "長"],
  // 賜姓源氏の一字名（嵯峨源氏・仁明源氏）
  genji: ["信", "弘", "常", "定", "明", "融", "多", "冷", "光", "覚"],
  // 親王の名（実例）
  shinno: ["道康", "宗康", "時康", "人康", "本康", "国康", "常康", "成康", "恒貞", "為平", "敦康", "敦成", "敦良", "敦明"],
  // 女房名（父や夫の官職から）
  nyoboOffice: ["式部", "少納言", "中納言", "衛門", "侍従", "宰相", "大輔"],
  // 家の中での呼び名（出生順）
  kimi: ["大君", "中君", "三君"],
  kimiOrd: ["大君", "中君", "三君", "四君", "五君", "六君", "七君", "八君", "九君", "十君"],
  // 僧の名の字（良源・源信・明尊・仁海・覚運）
  monk: ["良", "源", "信", "明", "尊", "仁", "海", "覚", "運"]
};
function oldEra(y) { return y < 950; }
let AVOID = [];
function pickN(pool) { const free = pool.filter(x => !AVOID.includes(x)); return pick(free.length ? free : pool); }
function adultNm(st, sex, year, region, opt) {
  const nm = makeName(st, sex, year, region, opt);
  if (sex === "m" && !nm.given && !nm.adult) nm.adult = twoChars(st === "kanjin" ? NM.newChars : NM.sekkan, nm.tsuji);
  if (st === "kouzoku" && sex === "m") { nm.uji = "源"; nm.adult = pick(NM.genji); nm.given = ""; }
  return nm;
}
function spouseName(s) { return s.spouse ? nameOf(s.spouse.nm, 30, s.sex === "m" ? "f" : "m") : ""; }
function pickUji(region, y) {
  if (!oldEra(y)) return pick(NM.ujiNew);
  return pick(NM.uji[region] || NM.uji.kinai);
}
function twoChars(pool, first) {
  const a = first || pick(pool);
  let b = pick(pool); let g = 0;
  while (b === a && g++ < 10) b = pick(pool);
  return a + b;
}
// 人の名前を作る。kind: self / spouse / child
function makeName(st, sex, year, region, opt) {
  opt = opt || {};
  AVOID = opt.avoid || [];
  const nm = { uji: "", given: "", child: "", call: "" };
  if (st === "genin") { nm.given = sex === "m" ? pickN(NM.genin.filter(n => !/売|女$/.test(n))) : pickN(NM.genin.filter(n => /売|女$/.test(n))); return nm; }
  if (st === "kouzoku") { if (sex === "m") nm.given = pickN(NM.shinno); else nm.call = pick(NM.kimi); nm.child = sex === "m" ? pickN(NM.boyKimi) : ""; return nm; }
  if (st === "kugyo" || st === "kizoku") {
    nm.uji = st === "kugyo" && opt.tier === "kindachi" ? "藤原" : (R() < 0.75 ? "藤原" : "源");
    if (sex === "m") { nm.child = pickN(R() < 0.5 ? NM.boyKimi : NM.boyMaru); nm.tsuji = opt.tsuji || pick(NM.sekkan); }
    else nm.call = opt.call || pick(NM.kimi);
    return nm;
  }
  if (st === "kanjin") {
    nm.uji = pick(NM.kanjinUji);
    if (sex === "m") { nm.child = pickN(NM.boyMaru); nm.tsuji = opt.tsuji || pick(NM.newChars); }
    else nm.call = opt.call || pick(NM.kimi);
    return nm;
  }
  // 庶民・豪族
  nm.uji = opt.uji || (st === "gozoku" && region === "kyushu" && oldEra(year) ? "肥君" : pickUji(region, year));
  if (oldEra(year)) { nm.given = sex === "m" ? pickN(NM.mOld) : pickN(NM.fOld); }
  else if (sex === "m") { nm.child = pickN(NM.boyMaru); nm.given = twoChars(NM.newChars, opt.tsuji); }
  else { nm.given = pickN(NM.fOld); nm.ujime = nm.uji + "氏女"; }
  return nm;
}
// 表示名。age は数えではなく満
function nameOf(nm, age, sex, st) {
  if (!nm) return "";
  if (nm.dharma) return nm.dharma;
  if (nm.nyobo) return nm.nyobo;
  if (nm.imina && sex === "f") return nm.imina;
  if (age < 13 && nm.child) return nm.child;
  if (nm.call && !nm.given) return (nm.uji ? nm.uji + "氏の" : "") + nm.call;
  if (nm.adult) return (nm.uji ? nm.uji + " " : "") + nm.adult;
  if (nm.given) return (nm.uji ? nm.uji + " " : "") + nm.given;
  return nm.child || nm.call || "";
}
function myName(s) { return s.nm && s.nm.custom ? s.nm.custom : nameOf(s.nm, s.age, s.sex, s.st); }
function renameSelf(s, how) {
  if (how && how.custom != null) { const t = String(how.custom).trim().slice(0, 12); s.nm.custom = t || null; }
  else { s.nm = makeName(s.birthStatus, s.sex, s.birthYear, s.birthRegion, { tier: s.tier && s.tier.id, avoid: [myName(s)] }); }
  s.logs[0].t = s.logs[0].t.replace(/名は「[^」]*」。$/, "名は「" + myName(s) + "」。");
  return myName(s);
}
function childName(c, year) { return nameOf(c.nm, year - c.y, c.sex); }
// 節目で名が変わる（元服・出家・宮仕え・入内）
function nameMilestones(s) {
  const nm = s.nm; if (!nm) return;
  const m = s.sex === "m";
  if (m && s.flags.genpuku && !nm.adult && (isNoble(s) || s.st === "kanjin")) {
    if (s.st === "kouzoku" && !s.flags.shisei) { nm.adult = nm.given + "親王"; nm.uji = ""; }
    else if (s.st === "kouzoku" && s.flags.shisei) { nm.uji = "源"; nm.adult = pick(NM.genji); nm.given = ""; }
    else nm.adult = twoChars(s.st === "kanjin" ? NM.newChars : NM.sekkan, nm.tsuji);
    log(s, "元服して、幼名の「" + (nm.child || "") + "」を改め、「" + (nm.uji ? nm.uji + " " : "") + nm.adult + "」と名乗ることになりました。", "choice", s.flags.shisei ? "嵯峨源氏・仁明源氏の一字名（鳥取県立公文書館の教材、林陸朗の研究による）" : "Wikipedia「諱」（通字の慣習）");
  }
  if (s.st === "bushi" && m && !nm.adult && s.age >= 15 && !oldEra(s.birthYear)) nm.adult = nm.given;
  if (s.st === "so" && !nm.dharma) {
    nm.secular = nameOf(nm, s.age, s.sex, s.st);
    const t = pick(NM.monk);
    nm.dharma = twoChars(NM.monk, t);
    log(s, "法名を「" + nm.dharma + "」としました。師の名から一字をもらうこともあったそうです（良源の弟子、源信のように）。", "choice", "源信の名の由来についての伝記ほか");
  }
  if (s.flags.nyobo && !nm.nyobo && !m) {
    nm.nyobo = (nm.uji ? nm.uji[0] : "") + pick(NM.nyoboOffice);
  }
  if (s.flags.kisaki && !nm.imina && !m) {
    nm.imina = pick(["彰", "定", "明", nm.tsuji || "忠"]) + "子";
    log(s, "入内にあたって、「" + nm.imina + "」という名が記録されました。女性の実名が記録に残るのは、こういうときくらいです。", "choice", "角田文衞『日本の女性名』ほか");
  }
}

/* ---------------- 状態 ---------------- */
function newLife(opt) {
  opt = opt || {};
  let st = opt.status;
  if (!st) {
    const r = R(); let acc = 0; st = "nomin";
    for (const k of BIRTH_KEYS) { acc += STATUS[k].p; if (r < acc) { st = k; break; } }
  }
  const sex = opt.sex || (R() < 0.5 ? "m" : "f");
  const def = STATUS[st];
  const region = (def.noble || st === "kanjin" || st === "kyomin") ? "kyo" : wpick(RURAL_REGIONS.map(x => ({ w: x.w, k: x.k }))).k;
  const year = opt.year || (794 + Math.floor(R() * 377)); // 794〜1170
  const s = {
    birthStatus: st, st, sex, region, birthRegion: region, birthYear: year, year, age: 0,
    hp: Math.round(rnd(40, 68)),
    sai: def.noble ? 18 : (st === "kanjin" ? 10 : 2),
    en: def.noble ? 30 : (st === "gozoku" ? 18 : (st === "genin" ? 2 : 8)),
    toku: 8,
    wealth: def.w0 * rnd(0.7, 1.3),
    rank: 0, juryo: 0, married: false, spouseAlive: false, marriages: 0,
    children: [], plan: null, planAge: -1,
    flags: {}, queue: [], prepared: false, alive: true, cause: null, causeDesc: "",
    logs: [], yearLogs: [], branchThisYear: false, kokumo: false, gaiseki: false,
    origin: st, // 出家前の身分などを覚えておく
    birthP: def.p
  };
  if (st === "kouzoku") s.en = 50;
  if (st === "kugyo") s.en = 42;
  const tier = opt.tier === undefined ? pickTier(st, year) : opt.tier;
  s.nm = opt.nm || makeName(st, sex, year, region, { tier: tier && tier.id });
  if (tier) {
    s.tier = tier;
    s.wealth *= tier.wMul;
    s.en = clamp(s.en + tier.en, 0, 100);
    Object.assign(s.flags, tier.flags);
  }
  s.logs.push({ age: 0, year, t: birthText(s) + (s.tier ? "暮らし向きは「" + s.tier.label + "」。" : "") + "名は「" + myName(s) + "」。", k: "birth", src: s.tier && s.tier.src });
  return s;
}
function birthText(s) {
  return wareki(s.year) + "（" + s.year + "年）、" + REGION[s.region] + "にて、" + STATUS[s.st].birth[s.sex === "m" ? 0 : 1] + "として生まれる。";
}
function birthLabel(s) { return STATUS[s.birthStatus].birth[s.sex === "m" ? 0 : 1]; }
function isNoble(s) { return s.st === "kouzoku" || s.st === "kugyo" || s.st === "kizoku"; }
function isOfficial(s) { return (s.st === "kouzoku" || s.st === "kugyo" || s.st === "kizoku" || s.st === "kanjin") && s.sex === "m" && s.flags.genpuku; }
function isRural(s) { return ["nomin", "gyomin", "gozoku", "genin", "furo"].includes(s.st); }
function isCommoner(s) { return ["nomin", "gyomin", "kyomin", "furo"].includes(s.st); }
function curLabel(s) {
  if (s.st === "so") return (s.sex === "m" ? "僧" : "尼") + (s.flags.shido ? "（私度）" : "");
  if (s.st === "kouzoku" && !s.flags.shisei) return s.sex === "m" ? "親王" : "内親王";
  if (isOfficial(s)) return RANKS[s.rank] + (s.juryo > 0 ? "・受領" : "") + (s.rank >= 14 ? "（公卿）" : "");
  if (s.kokumo) return "国母";
  if (s.flags.nyobo) return "女房";
  if (s.st === "bushi" && s.flags.rodo) return "武士の郎党";
  return STATUS[s.st].name + (s.tier && s.tier.short && s.st === s.birthStatus ? "（" + s.tier.short + "）" : "");
}
function log(s, t, k, src) { s.yearLogs.push({ age: s.age, year: s.year, t, k: k || "n", src }); }
function addRisk(s, p, cause, desc) { (s.risks = s.risks || []).push({ p, cause, desc }); }
function adj(s, o) {
  if (o.hp) s.hp = clamp(s.hp + o.hp, 0, 100);
  if (o.sai) s.sai = clamp(s.sai + o.sai, 0, 100);
  if (o.en) s.en = clamp(s.en + o.en, 0, 100);
  if (o.toku) s.toku = clamp(s.toku + o.toku, 0, 100);
  if (o.w) s.wealth += o.w;
}
function sc(s) { if (s.st === "bushi" && s.flags.rodo) return 2; return STATUS[s.st].sc || 1; }
function fmtW(w) {
  const a = Math.abs(w);
  const v = a >= 100 ? Math.round(a) : (a >= 10 ? a.toFixed(0) : a.toFixed(1));
  return (w < 0 ? "−" : "") + v;
}

/* ---------------- 過ごし方（節目ごと） ---------------- */
function plansFor(s) {
  const a = s.age, m = s.sex === "m";
  if (s.st === "genin") return [
    { id: "g_serve", label: "主人に尽くす", desc: "縁↑ まれに解放されることも", eff: { en: 2, hp: -0.5, free: 0.03 } },
    { id: "g_work", label: "黙々と働く", desc: "体↓ 何も起きない", eff: { hp: -1 } },
    { id: "g_run", label: "こっそり逃げる準備をする", desc: "逃亡の機会が来るかも 見つかると危険", eff: { escape: 0.25, risk: 0.006, riskC: "逃亡に失敗して", riskD: "連れ戻され、ひどく打たれました。" } }
  ];
  if (a < 15) {
    if (isNoble(s) || s.st === "kanjin") return [
      { id: "c_kanseki", label: "漢籍（『史記』『文選』など）を学ぶ", desc: "才↑↑", eff: { sai: 3.5, hp: -0.3 } },
      { id: "c_waka", label: "和歌と管弦を習う", desc: "才↑ 縁↑", eff: { sai: 2, en: 2 } },
      { id: "c_play", label: m ? "蹴鞠と遊びに明け暮れる" : "雛遊び（ひいな遊び）に明け暮れる", desc: "体↑ 縁↑", eff: { hp: 1.5, en: 1 } }
    ];
    return [
      { id: "c_help", label: "親の仕事を手伝う", desc: "財↑ 体↓", eff: { inc: 0.12, hp: -0.3 } },
      { id: "c_run", label: "野山を走り回る", desc: "体↑ 川や崖が危ない", eff: { hp: 1.8, risk: 0.004, riskC: "溺死", riskD: "夏の川遊びでした。" } },
      { id: "c_tera", label: "寺の童子として経を習う", desc: "才↑ 徳↑", eff: { sai: 2.5, toku: 1, inc: -0.05 } }
    ];
  }
  if (s.st === "so") {
    const o = [
      { id: "s_gyo", label: "厳しい修行に励む", desc: "徳↑↑ 体↓", eff: { toku: 4, hp: -0.8 } },
      { id: "s_kaji", label: "加持祈祷で稼ぐ", desc: "財↑ 縁↑", eff: { inc: 0.6, en: 2, toku: 0.5 } },
      { id: "s_nen", label: "静かに念仏を唱える", desc: "徳↑ 体→", eff: { toku: 2.5 } }
    ];
    if (m && s.year >= 1040) o.push({ id: "s_sohei", label: "僧兵として強訴に加わる", desc: "縁↑ 徳↓ 危険", eff: { en: 3, toku: -2, risk: 0.012, riskC: "強訴の乱闘", riskD: "神輿を担いで内裏に押しかけ、そのまま戻りませんでした。" } });
    return o;
  }
  if (s.st === "furo") return [
    { id: "f_sho", label: "荘園に潜り込んで働く", desc: "財↑", eff: { inc: 0.3, hp: -0.8 } },
    { id: "f_hijiri", label: "聖（ひじり）を名乗って托鉢する", desc: "徳↑ 財↓", eff: { toku: 2, inc: -0.2 } },
    { id: "f_tou", label: "群盗に加わる", desc: "財↑↑ 徳↓↓ とても危険", eff: { inc: 1.2, toku: -4, risk: 0.04, riskC: "検非違使に討たれて", riskD: "首は東の獄門に懸けられました。" } }
  ];
  if (s.st === "bushi") return [
    { id: "b_bu", label: "弓馬の道を磨く", desc: "体↑ 縁↑ 戦では強い", eff: { hp: 1, en: 1.5, war: -0.4 } },
    { id: "b_ryo", label: "所領の経営に力を入れる", desc: "財↑", eff: { inc: 0.35 } },
    { id: "b_kyo", label: "京に上って権門に仕える", desc: "縁↑↑ 財↓", eff: { en: 3.5, inc: -0.25 } }
  ];
  if (isNoble(s) || s.st === "kanjin") {
    if (m) {
      const o = [
        { id: "n_work", label: "出仕して真面目に勤める", desc: "出世↑ 縁↑", eff: { en: 1.2, promo: 0.06 } },
        { id: "n_kenmon", label: "摂関家に取り入る", desc: "出世↑↑ 縁↑↑ 財↓", eff: { en: 3, promo: 0.1, inc: -0.3 } },
        { id: "n_kanshi", label: "漢詩文を極める", desc: "才↑↑ 出世↑", eff: { sai: 3, promo: 0.03 } },
        { id: "n_koi", label: "恋と和歌に生きる", desc: "才↑ 縁↑ 結婚↑", eff: { sai: 1.5, en: 1.5, marry: 0.15 } },
        { id: "n_imi", label: "物忌みと称して休む", desc: "体↑ 出世↓", eff: { hp: 1.5, promo: -0.05, en: -0.5 } }
      ];
      if (a >= 45) o.push({ id: "n_bud", label: "仏道に心を寄せる", desc: "徳↑↑", eff: { toku: 3, promo: -0.03 } });
      return o;
    }
    return [
      { id: "nf_nyobo", label: "女房として宮仕えする", desc: "縁↑↑ 才↑ 財↑", eff: { en: 3, sai: 1.5, inc: 0.15, nyobo: 1 } },
      { id: "nf_mono", label: "物語を読みふける", desc: "才↑↑", eff: { sai: 3 } },
      { id: "nf_otoko", label: "通ってくる男を品定めする", desc: "結婚↑ 縁↑", eff: { en: 1, marry: 0.2 } },
      { id: "nf_bud", label: "仏道に励む", desc: "徳↑↑", eff: { toku: 3.5 } }
    ];
  }
  // 庶民・豪族
  const o = [
    { id: "p_hard", label: s.st === "gozoku" ? "田堵として田を広げる" : "ひたすら働く", desc: "財↑↑ 体↓", eff: { inc: 0.4, hp: -1.4 } },
    { id: "p_mid", label: "ほどほどに働く", desc: "変化なし", eff: {} },
    { id: "p_tera", label: "寺に通い、念仏を唱える", desc: "徳↑↑ 財↓", eff: { toku: 3, inc: -0.15 } }
  ];
  if (a < 35 && !s.married) o.push({ id: "p_utagaki", label: m ? "妻問い（想う相手のもとへ夜に通う）に精を出す" : "通ってくる相手を待つ", desc: "縁↑ 結婚↑", eff: { en: 2.5, marry: 0.25 } });
  if (s.st === "gyomin") o[0] = { id: "p_sea", label: "遠くの漁場まで船を出す", desc: "財↑↑ 海が危ない", eff: { inc: 0.6, risk: 0.012, riskC: "海難", riskD: "その日の海は、朝だけ穏やかでした。" } };
  if (s.st === "kyomin") o[1] = { id: "p_ichi", label: "東西の市で商いをする", desc: "財が大きく増えたり減ったり", eff: { gamble: 1 } };
  if (s.st === "gozoku" && m) o.push({ id: "p_bu", label: "武芸を磨く（兵の道）", desc: "体↑ 縁↑ 武士への道", eff: { hp: 1, en: 1.5, bu: 1 } });
  return o;
}
const PLAN_SHORT = {
  g_serve: "主人に尽くす", g_work: "黙々と働く", g_run: "逃げる準備",
  c_kanseki: "漢籍を学ぶ", c_waka: "和歌と管弦", c_help: "親の手伝い", c_run: "野山で遊ぶ", c_tera: "寺で経を習う",
  s_gyo: "修行", s_kaji: "加持祈祷", s_nen: "念仏", s_sohei: "強訴に加わる",
  f_sho: "荘園で働く", f_hijiri: "托鉢", f_tou: "群盗",
  b_bu: "弓馬の道", b_ryo: "所領の経営", b_kyo: "権門に仕える",
  n_work: "真面目に出仕", n_kenmon: "摂関家に取り入る", n_kanshi: "漢詩文", n_koi: "恋と和歌", n_imi: "物忌みで休む", n_bud: "仏道",
  nf_nyobo: "宮仕え", nf_mono: "物語", nf_otoko: "男の品定め", nf_bud: "仏道",
  p_mid: "ほどほどに働く", p_tera: "寺通い", p_sea: "遠くの漁場", p_ichi: "市で商い", p_bu: "武芸を磨く"
};
function planShort(p, s) {
  if (p.id === "c_play") return s.sex === "m" ? "蹴鞠と遊び" : "雛遊び";
  if (p.id === "p_hard") return s.st === "gozoku" ? "田を広げる" : "ひたすら働く";
  if (p.id === "p_utagaki") return s.sex === "m" ? "妻問い" : "相手を待つ";
  return PLAN_SHORT[p.id] || p.label;
}
// 過ごし方はいつでも変えられる（画面下のボタン）。年齢や身分が変わって選べなくなったら、自動で切り替える
function planOptions(s) {
  if (!s.alive || s.age < 6) return [];
  return plansFor(s).map(p => Object.assign({}, p, { short: planShort(p, s) }));
}
function setPlan(s, id) {
  const p = plansFor(s).find(x => x.id === id);
  if (!p || (s.plan && s.plan.id === id)) return null;
  s.plan = p; s.planAge = s.age;
  const l = { age: s.age, year: s.year, t: "過ごし方を「" + p.label + "」に変えました。", k: "choice" };
  s.logs.push(l);
  return l;
}
function planPrompt(s) {
  const opts = planOptions(s);
  if (!opts.length) return null;
  const seen = s.flags.seenPlans || (s.flags.seenPlans = []);
  const fresh = opts.filter(p => !seen.includes(p.id));
  const invalid = !s.plan || !opts.some(p => p.id === s.plan.id);
  if (!fresh.length && !invalid) return null;
  fresh.forEach(p => seen.push(p.id));
  let lead;
  if (!s.plan) lead = "数えで" + (s.age + 1) + "。物心がつきました。この先をどう過ごしますか。選んだあとも、画面下のボタンでいつでも変えられます。";
  else if (invalid) lead = "暮らしが変わりました。これからどう過ごしますか。";
  else lead = "新しい過ごし方を選べるようになりました（" + fresh.map(p => "「" + p.label + "」").join("、") + "）。どうしますか。";
  const options = opts.map(p => ({ label: p.label + (fresh.length && !invalid && fresh.some(f => f.id === p.id) ? "（新）" : ""), desc: p.desc, apply: (st) => { st.plan = plansFor(st).find(x => x.id === p.id); st.planAge = st.age; return ["過ごし方を「" + p.label + "」にしました。"]; } }));
  if (!invalid) options.unshift({ label: "今のまま「" + s.plan.label + "」を続ける", desc: "変えない", apply: () => [] });
  return { kind: "plan", title: "過ごし方", lead, options };
}
function ensurePlan(s) {
  const opts = planOptions(s);
  if (!opts.length) return;
  if (s.plan && opts.some(p => p.id === s.plan.id)) return;
  const first = !s.plan;
  const def = opts.find(p => p.id === "p_mid") || opts.find(p => p.id === "n_work") || opts[0];
  s.plan = plansFor(s).find(p => p.id === def.id);
  log(s, first ? "これからの過ごし方は「" + def.label + "」。画面下のボタンで、いつでも変えられます。" : "暮らしが変わったので、過ごし方を「" + def.label + "」にしました。", "choice");
}
function isMilestone(a) { return a === 6 || a === 12 || (a >= 15 && a % 5 === 0); }

/* ---------------- 財の使い道（節目ごと） ---------------- */
function spendFor(s) {
  const k = sc(s), W = s.wealth, o = [];
  const opt = (label, desc, cost, fn) => o.push({ label, desc: desc + (cost > 0 ? "（財 " + fmtW(cost) + "）" : ""), cost, disabled: cost > 0 && W < cost, reason: "財が足りない", apply: (st) => { st.wealth -= cost; return fn(st); } });
  opt("蓄えておく", "何もしない", 0, () => ["財を蓄えておくことにしました。"]);
  opt("寺社に寄進する", "徳↑↑", 2 * k, (st) => { adj(st, { toku: 9 }); return ["寺に寄進しました。功徳を積みました。住職の暮らしも少し良くなりました。"]; });
  if (isNoble(s) || s.st === "gozoku" || s.st === "bushi") {
    opt("唐渡りの薬を買い求める", "体↑↑", 3 * k, (st) => { adj(st, { hp: 12 }); return ["大宰府に来た" + merchant(st.year) + "が持ち込んだ薬（唐物）を買い求めました。中身はよく分かりませんが、効いた気がします。"]; });
  } else {
    opt("薬草を煎じて飲む", "体↑", 0.6, (st) => { adj(st, { hp: 5 }); return ["山で採れた薬草を煎じて飲みました。苦いので効いていると信じています。"]; });
  }
  const onmyo = isNoble(s) || s.st === "kanjin" ? "陰陽師" : "法師陰陽師";
  opt(onmyo + "に祓いを頼む", "効果は運しだい", 1.2 * k, (st) => {
    const extra = onmyo === "法師陰陽師" ? "紙の冠をつけた僧形の陰陽師で、清少納言には「見苦しきもの」と書かれています。" : "";
    if (R() < 0.5) { adj(st, { hp: 4 }); return [onmyo + "が祓いをしました。なんとなく体が軽くなりました。" + extra]; }
    return [onmyo + "が祓いをしました。特に何も起きませんでした。" + onmyo + "は満足そうでした。" + extra];
  });
  if (s.st === "so") opt("法会を開いて人々にふるまう", "縁↑↑ 徳↑", 2 * k, (st) => { adj(st, { en: 8, toku: 2 }); return ["法会を開きました。集まった人の目当ては、主に読経のあとの食事でした。"]; });
  else opt(isNoble(s) ? "宴を開いて贈り物をする" : "酒と餅をふるまう", "縁↑↑", 2 * k, (st) => { adj(st, { en: 9 }); return [isNoble(st) ? "宴を開きました。翌日には誰が来たかより、誰が来なかったかが噂になりました。" : "近所に酒と餅をふるまいました。次に困ったとき、誰かが助けてくれるかもしれません。"]; });
  if (s.st === "nomin") {
    if (!s.flags.ox) opt("田を耕す牛を手に入れる", "以後ずっと財↑", 4, (st) => { st.flags.ox = 1; return ["牛を手に入れました。家族の中で一番大事に扱われています。『新猿楽記』の大名田堵も、まず牛馬と農具をそろえていました。"]; });
  }
  if (s.st === "gozoku") {
    opt("荒れ地を開墾する", "以後ずっと財↑", 12, (st) => { st.flags.konden = (st.flags.konden || 0) + 1; return ["荒れ地を開墾しました。開いた田は自分のものです（墾田永年私財法のおかげです）。"]; });
    if (!s.flags.kishin && s.year >= 1000) opt("田を貴族に寄進して荘園にする", "国司の取り立てを避ける 財↓", 0, (st) => { st.flags.kishin = 1; return ["田を京の有力貴族に寄進し、荘園にしてもらいました。年貢の一部を上納する代わりに、国司が手を出しにくくなります。"]; });
  }
  // ---- 財を元手にする ----
  const notPoor = s.st !== "genin" && s.st !== "furo";
  if (notPoor && W >= 4 * k) {
    const amt = Math.round(Math.min(W * 0.5, 20 * k) * 10) / 10;
    opt("近隣に稲を貸し付ける（私出挙）", "毎年3割ほどの利息 取りはぐれや恨みも", amt, (st) => {
      st.loans = (st.loans || 0) + amt; adj(st, { toku: -2 });
      return ["近隣の家々に稲を貸し付けました（私出挙）。稲の私出挙は何度も禁じられていますが、富豪の輩はやめません。あなたもその一人になりました。"];
    });
  }
  if (s.st === "nomin" && !s.flags.tools) opt("鉄の鋤と鍬をそろえる", "以後ずっと財↑", 2, (st) => { st.flags.tools = 1; return ["鉄の鋤と鍬をそろえました。木の鍬とは、土の起き方がまるで違います。"]; });
  if (s.st === "nomin" && s.year >= 900 && !s.flags.tato) opt("田堵として田を請け負う", "財↑ ただし凶作の年は大損", 3.5, (st) => { st.flags.tato = 1; return ["国衙や荘園の田を請け負って耕す、田堵になりました。人を雇い、種籾を用意する元手が要ります。当たれば大きく、外れれば借金です。"]; });
  if (["kyomin", "gyomin", "gozoku", "bushi", "kanjin", "kizoku", "kugyo"].includes(s.st) && !(s.st === "bushi" && s.flags.rodo) && W >= 2 * k) {
    const t = {
      kyomin: ["東西の市で布と塩を仕入れて売る", "市での商いがうまくいきました。", "市で仕入れた品が売れ残りました。"],
      gyomin: ["干物と塩を内陸の市へ運んで売る", "干物と塩が、山の村でよく売れました。", "運ぶ途中で荷が傷み、安く手放しました。"],
      gozoku: ["国府の市で絹と布を売り買いする", "国府の市で、うまく売り抜けました。", "国府の市で、買い叩かれました。"],
      bushi: ["馬を育てて売る", "育てた馬が、いい値で売れました。", "育てた馬が病で死にました。"]
    }[s.st] || ["大宰府から届く唐物を買い付けて転売する", "唐物が都でよく売れました。", "買い付けた唐物が、偽物でした。"];
    const amt = 2 * k;
    opt(t[0], "1年後に増えるか減るか", amt, (st) => { st.flags.trade = { amt, ok: t[1], ng: t[2] }; return [t[0].replace(/する$/, "") + "ことにしました。結果は一年後です。"]; });
  }
  if ((s.st === "nomin" || s.st === "gozoku" || s.st === "gyomin") && !s.flags.kishin && !(s.flags.guard > 0)) opt("国司の館に付け届けをする", "数年は取り立てが緩む", 1.2 * k, (st) => { st.flags.guard = 5; return ["国司の館に絹と米を届けました。しばらくは、取り立てに来る使いの顔つきが穏やかになるはずです。"]; });
  if (isOfficial(s) && s.rank >= 9 && s.rank <= 13 && s.juryo === 0 && !(s.flags.shinbumi > 0)) opt("除目に向けて申文と贈り物を用意する", "受領の口がかかりやすくなる", 4 * k, (st) => { st.flags.shinbumi = 3; return ["除目を前に、申文（任官の願い書）を書き、有力者に贈り物を届けました。除目では、蔵人が山のような申文を選り分けるそうです。"]; });
  if (isOfficial(s) && s.rank < 16 && s.year >= 960) {
    const cost = Math.max(8, 4 * k) * (s.rank >= 9 ? 3 : 1);
    opt("成功（じょうごう）で官位を買う", "官位↑", cost, (st) => {
      if (R() < 0.7) { st.rank = Math.min(st.rank + 1, rankCap(st)); return ["寺の造営を請け負う見返りに、" + RANKS[st.rank] + "に叙されました（成功）。お金で買える地位もあります。"]; }
      return ["造営費を出しましたが、官位は別の人に回されました。造られた寺だけが残りました。"];
    });
  }
  if ((s.st === "kugyo" || s.st === "kouzoku") && s.sex === "m" && !s.flags.nyudai && s.children.some(c => c.alive && c.sex === "f" && s.year - c.y >= 11)) {
    opt("娘を入内させる", "天皇の外戚を狙う", 6 * k, (st) => {
      st.flags.nyudai = 1;
      if (R() < 0.3) { st.gaiseki = true; adj(st, { en: 40 }); st.rank = Math.min(st.rank + 2, 18); return ["娘が入内し、皇子を産みました。あなたは次の天皇の外祖父です。摂関政治の完成です。"]; }
      return ["娘が入内しましたが、皇子は生まれませんでした。ライバルの娘が産みました。"];
    });
  }
  return o;
}
function rankCap(s) {
  if (s.birthStatus === "kanjin") return 10;
  if (s.birthStatus === "kizoku") return 14;
  return 18;
}

/* ---------------- 人生の分岐点 ---------------- */
function branch(s, title, lead, options, src) { return { kind: "branch", title, lead, options, src }; }

function chGenpuku(s) {
  const m = s.sex === "m";
  if (!m) {
    return branch(s, "裳着（もぎ）", "数えで" + (s.age + 1) + "。成人の儀式・裳着を迎え、大人の女性として扱われるようになりました。この先をどう生きますか。", [
      { label: "宮仕えを目指す", desc: "女房として出仕する道。縁と才が物を言う", apply: (st) => { st.flags.genpuku = 1; st.flags.wantNyobo = 1; adj(st, { en: 5 }); return ["裳着を済ませ、宮仕えの準備を始めました。"]; } },
      { label: "良い婿を待つ", desc: "家で通ってくる男を待つ。結婚しやすい", apply: (st) => { st.flags.genpuku = 1; st.flags.wantMarry = 1; return ["裳着を済ませました。家の者たちが婿選びを始めました。本人の意見は、あまり聞かれません。"]; } },
      ...(s.st === "kugyo" || s.st === "kouzoku" ? [{ label: "入内（天皇に嫁ぐ）を目指す", desc: "大当たりなら国母。たいていは後宮の権力争い", apply: (st) => {
        st.flags.genpuku = 1;
        if (R() < 0.35) {
          st.married = true; st.spouseAlive = true; st.marriages++; st.flags.kisaki = 1;
          if (R() < 0.45) { st.kokumo = true; adj(st, { en: 40 }); return ["入内し、皇子を産みました。その子が即位し、あなたは国母（天皇の母）になりました。"]; }
          adj(st, { en: 15 }); return ["入内しました。皇子は産めませんでしたが、宮中で暮らすことになりました。"];
        }
        adj(st, { en: -5 }); return ["入内の話は、もっと有力な家の姫に持っていかれました。"];
      } }] : [])
    ]);
  }
  if (s.st === "kouzoku" && s.year >= 814) {
    return branch(s, "元服 ― 臣籍降下", "数えで" + (s.age + 1) + "。元服の日、皇族のままでいるか、姓を賜って臣下になるかを問われました。", [
      { label: "源の姓を賜り、臣下になる", desc: "官位を上げて公卿を目指せる（賜姓源氏）", apply: (st) => { st.flags.genpuku = 1; st.flags.shisei = 1; st.rank = 12; return ["「源」の姓を賜り、臣下になりました。天皇の子で臣下になった一世源氏は、従四位上から始まるのが通例です。皇族のままでは就ける官職が限られ、暮らしが安定しないため、自ら臣籍降下を願い出る例もありました。"]; } },
      { label: "親王のまま暮らす", desc: "収入は安定。ただし仕事はほぼない", apply: (st) => { st.flags.genpuku = 1; return ["親王のままでいることにしました。品位（ほんい）はありますが、仕事はあまりありません。"]; } }
    ], "『類聚三代格』巻17（弘仁5年の賜姓の詔）／『西宮記』／Wikipedia「臣籍降下」");
  }
  if (s.st === "kouzoku") return branch(s, "元服", "数えで" + (s.age + 1) + "。元服の儀を迎えました。", [
    { label: "親王として暮らす", desc: "源氏賜姓が始まるのは弘仁5年（814）から", apply: (st) => { st.flags.genpuku = 1; return ["親王として元服しました。"]; } }
  ]);
  const start = s.st === "kugyo" ? 9 : (s.st === "kizoku" ? 3 : 0);
  const opts = s.st === "kanjin" ? [
    { label: "官司の下役として出仕する", desc: "無位から。六位以下の子に蔭位はない", apply: (st) => { st.flags.genpuku = 1; st.rank = 0; return ["元服し、役所の下役として出仕しました。父は六位なので、蔭位（親の位による叙位）はありません。位は自分でつかむしかありません。"]; } }
  ] : [
    { label: "蔭位（おんい）で出仕する", desc: "親の位のおかげで最初から位がもらえる", apply: (st) => { st.flags.genpuku = 1; st.rank = start; return ["元服し、父の位のおかげで" + RANKS[st.rank] + "を授かりました（蔭位の制。" + (st.st === "kugyo" ? "一位の嫡子は従五位下" : "五位の嫡子は従八位上") + "）。実力は特に問われませんでした。"]; } },
    { label: "大学寮で学問の道へ", desc: "位は低く始まるが才が伸び、出世しやすい", apply: (st) => { st.flags.genpuku = 1; st.flags.daigaku = 1; st.rank = Math.max(1, start - 2); adj(st, { sai: 10 }); return ["元服し、大学寮で漢文と歴史を学び始めました。学問で出世した菅原道真のようになれるかもしれません。最後は左遷されましたが。"]; } }
  ];
  if (s.st === "kanjin" && s.year >= 890) opts.push({ label: "武官として滝口に仕える", desc: "内裏を警護する武士。体を使う", apply: (st) => { st.flags.genpuku = 1; st.rank = 1; st.flags.takiguchi = 1; adj(st, { hp: 5, en: 3 }); return ["元服し、蔵人所のもとで内裏を警護する「滝口の武士」に加わりました。"]; } });
  return branch(s, "元服", "数えで" + (s.age + 1) + "。元服の儀を迎え、冠をかぶりました。どの道で身を立てますか。", opts, "『養老令』選叙令（蔭位の規定）");
}

function chComing(s) {
  const m = s.sex === "m";
  const o = [
    { label: "このまま村で暮らす", desc: "家を継ぎ、土地とともに生きる", apply: (st) => { st.flags.coming = 1; return ["村に残ることにしました。生まれた場所で生き、たぶん生まれた場所で死にます。"]; } },
    { label: "京へ上る", desc: m ? "雑役や下働きの口を探しに都へ。一旗あげられるか" : "都の貴族の家に下働きとして仕える", apply: (st) => {
      st.flags.coming = 1; st.region = "kyo"; st.st = "kyomin"; st.wealth = Math.min(st.wealth, 1);
      adj(st, { en: 3 });
      return [m ? "都に上りました。思っていたより、道に死体が多い街でした。" : "都の貴族の家に下働きとして入りました。御簾の内側を見ることは、一度もありませんでした。"];
    } },
    { label: "出家する（私度僧）", desc: "勝手に頭を剃る。税は逃れられる。朝廷は禁止している", apply: (st) => { st.flags.coming = 1; return shukke(st, true); } }
  ];
  if (m && (s.st === "nomin" || s.st === "gyomin")) o.push({ label: "衛士として都へ上る", desc: "国から選ばれ、宮城の門を守る。数年で帰れるはず", apply: (st) => { st.flags.coming = 1; becomeEji(st); return ["衛士として都へ上ることになりました。夜は宮門で篝火を焚き、昼は門を守ります。"]; } });
  if (m && (s.st === "nomin" || s.st === "gyomin") && s.year >= 900) o.push({ label: "近くの武士の郎党になる", desc: "弓と馬の世界へ。戦があれば真っ先に危ない", apply: (st) => { st.flags.coming = 1; becomeRodo(st); return ["近くの兵（つわもの）の館に入り、郎党として仕えることになりました。主人の戦は、あなたの戦です。"]; } });
  if (s.st === "gozoku" && m && s.year >= 900) o.push({ label: "兵（つわもの）の道を選ぶ", desc: "一族を率いて武士になる", apply: (st) => { st.flags.coming = 1; st.st = "bushi"; adj(st, { hp: 4, en: 4 }); return ["弓と馬を手に、武士として生きることにしました。この選択が流行るのは、もう少し先のことです。"]; } });
  return branch(s, "人生の分岐点", "数えで" + (s.age + 1) + "。一人前とみなされる年になりました。この先、どう生きますか。", o);
}

function shukke(s, shido) {
  const wasNoble = isNoble(s);
  s.flags.shukkeFrom = s.st;
  s.st = "so"; s.juryo = 0; s.flags.nyobo = 0;
  if (shido) s.flags.shido = 1;
  adj(s, { toku: 15 });
  if (wasNoble) s.flags.nobleMonk = 1;
  const lines = [];
  if (shido) lines.push("頭を剃り、勝手に出家しました（私度僧）。三善清行は、課役を逃れるために勝手に頭を剃る民があまりに多いと朝廷に訴えていました。あなたはその一人です。");
  else lines.push(s.sex === "m" ? "髪を下ろし、出家しました。俗世の官位も財も、ひとまず手放しました。" : "髪を下ろし、尼になりました。");
  return lines;
}

function chMarry(s) {
  const m = s.sex === "m", noble = isNoble(s) || s.st === "kanjin";
  let lead;
  if (s.st === "genin") lead = "主人が、あなたの結婚相手を決めてきました。";
  else if (noble) lead = m ? "ある家の姫君と、歌のやりとりが続いています。返事が来るようになりました。" : "毎晩のように恋文（歌）が届く男がいます。字は上手です。顔は、まだ見たことがありません。";
  else lead = m ? "隣の村に、気になる相手ができました。何度か夜に通っています。" : "夜、戸を叩く男がいます。何度も来ます。";
  if (s.marriages > 0) lead = (s.flags.lastLoss === "divorce" ? "連れ合いと別れてしばらく経ちました。" : "連れ合いを亡くしてしばらく経ちました。") + lead;
  return branch(s, "結婚", lead, [
    { label: s.st === "genin" ? "従う" : (s.marriages > 0 ? "再婚する" : "結婚する"), desc: "子ができ、家が続く。出産は命がけ", apply: (st) => {
      const again = st.marriages > 0;
      st.married = true; st.spouseAlive = true; st.marriages++; st.flags.widowedAt = null;
      const spSt = ["kouzoku", "kugyo", "kizoku", "kanjin", "genin", "gozoku"].includes(st.st) ? (st.st === "kouzoku" ? "kugyo" : st.st) : (st.st === "bushi" || st.st === "eji" || st.st === "furo" ? "nomin" : st.st);
      st.spouse = { nm: adultNm(spSt, st.sex === "m" ? "f" : "m", st.year - 20, st.region) };
      (st.spouses = st.spouses || []).push(spouseName(st));
      const who = "相手は「" + spouseName(st) + "」。";
      if (again && st.st !== "genin") return [(noble ? "新しい相手と三日夜餅を食べました。二度目なので、段取りは慣れたものです。" : "新しい連れ合いと所帯を持ちました。この時代、再婚はまったく珍しくありません。") + who];
      if (st.st === "genin") return ["主人の決めた相手と夫婦になりました。生まれる子も、主人の財産になります。" + who];
      if (noble) return [(m ? "三晩続けて通い、三日夜餅（みかよのもちい）を食べました。これで結婚成立です。" : "三晩通ってきた男と、三日夜餅を食べました。結婚成立です。翌月から、通ってくる日が少し減りました。") + who];
      return ["夫婦になりました。庶民の婚礼の様子は、史料にほとんど残っていません。" + who];
    } },
    { label: s.st === "genin" ? "拒む" : "見送る", desc: "まだ一人でいる", apply: (st) => {
      if (st.st === "genin") { adj(st, { hp: -6, en: -3 }); return ["拒みました。主人の機嫌を損ね、食事を減らされました。"]; }
      return [noble && !m ? "返事を出さないことにしました。歌の出来が、いまいちだったので。" : "見送りました。"];
    } }
  ], noble ? "国立国会図書館「本の万華鏡」第38回（婿取婚と三日夜餅）" : undefined);
}

function chEscape(s) {
  return branch(s, "人生の分岐点 ― 借財", "出挙（すいこ）の借りが膨らみ、返せる見込みがありません。利息は年3割です。", [
    { label: "戸籍を捨てて逃げる", desc: "浮浪人になる。借りも税も置いていく", apply: (st) => {
      st.st = "furo"; st.wealth = 0; st.region = pick(["kinai", "togoku", "saigoku", "kyushu", "michinoku"].filter(r => r !== st.region));
      adj(st, { en: -8 });
      return ["夜のうちに村を抜け出し、" + REGION[st.region] + "へ流れました。戸籍の上では「逃亡」と記されました。"];
    } },
    { label: "有力者の下人になる", desc: "借りは消える。自由も消える", apply: (st) => { st.st = "genin"; st.wealth = 0; adj(st, { en: -5 }); return ["借りの代わりに、身を差し出しました。今日からあなたは、ある豪族の家の財産です。"]; } },
    { label: "耐える", desc: "このまま返し続ける", apply: (st) => { adj(st, { hp: -4 }); return ["耐えることにしました。利息のほうが、あなたより元気です。"]; } }
  ]);
}

function chJuryo(s) {
  return branch(s, "人生の分岐点 ― 除目", "除目で、地方の国司（受領）の口がかかりました。任期は数年。うまくやれば一財産です。", [
    { label: "受領として任国へ下る", desc: "財↑↑↑ 訴えられることも", apply: (st) => { st.juryo = 4; st.flags.juryoEver = 1; return ["受領として任国へ下りました。「受領は倒るる所に土をつかめ」――転んでもただでは起きない、という意味です。"]; } },
    { label: "京に残る", desc: "都での出世を狙う", apply: (st) => { adj(st, { en: 2 }); return ["京に残ることにしました。都を離れると、出世の噂から取り残されるので。"]; } }
  ], "『今昔物語集』巻28第38話（信濃守藤原陳忠）");
}

function chSick(s) {
  return branch(s, "病床にて", "重い病で、起き上がれなくなりました。枕元の僧が、出家を勧めています。", [
    { label: "出家する（臨終出家）", desc: "徳↑↑ 死んだら往生しやすい", apply: (st) => { const nb = isNoble(st); st.flags.rinju = 1; shukke(st, false); adj(st, { hp: 8 }); return ["病床で髪を下ろし、出家しました（臨終出家）。極楽への、駆け込みです。"]; } },
    { label: "まだ俗世に未練がある", desc: "生きる気力で治す", apply: (st) => { adj(st, { hp: R() < 0.5 ? 10 : 2 }); return ["出家を断りました。まだやり残したことがあります。具体的には特に思いつきませんが。"]; } }
  ]);
}

function chGenpei(s) {
  return branch(s, "人生の分岐点 ― 治承・寿永の乱", "以仁王の令旨が諸国の源氏に届き、各地で兵が挙がりました。どちらにつきますか。", [
    { label: "源氏につく", desc: "最初は劣勢。最後まで生き残れば…", apply: (st) => { st.flags.genpei = "genji"; return ["源氏の旗の下に加わりました。"]; } },
    { label: "平家につく", desc: "今は「平家にあらずんば人にあらず」", apply: (st) => { st.flags.genpei = "heike"; adj(st, { en: 4 }); return ["平家に味方することにしました。今のところ、勝っているほうです。"]; } },
    { label: "様子を見る", desc: "どっちつかず。勝ったほうにつく", apply: (st) => { st.flags.genpei = "mi"; adj(st, { en: -3 }); return ["様子を見ることにしました。歴史にはまったく名前が残りませんが、命は残りやすい作戦です。"]; } }
  ], "『平家物語』／『吾妻鏡』");
}

/* ---------------- 史実イベント（年・地域固定） ---------------- */
// y: 年 or [開始, 終了], reg: 地域配列（null=全国）, when: 追加条件
const HIST = [
  { y: 794, t: "都が平安京に移されました。ここから約四百年、「平安」と呼ばれる時代が始まります。名前ほど平安ではありません。", k: "hist" },
  { y: 818, reg: ["togoku"], tags: ["disaster"], t: "相模・武蔵・下総・常陸・上野・下野などで大地震がありました（弘仁地震）。山が崩れて谷を埋め、押しつぶされた人は数えきれないと記録されています。", k: "hist", src: "『類聚国史』巻171 弘仁9年7月条", fx: (s) => { adj(s, { w: -0.4 * sc(s) }); addRisk(s, 0.012, "地震", "家が潰れ、そのまま梁の下にいました。"); } },
  { y: 842, reg: ["kyo"], t: "朝廷の命令で、島田や鴨川の河原などに捨て置かれていた髑髏、あわせて五千五百余りが焼かれ、葬られました。この街では、遺体は河原に置いておくものでした。", k: "hist", src: "『続日本後紀』巻12 承和9年10月条" },
  { y: 863, reg: ["kyo"], t: "神泉苑で御霊会が開かれました。非業の死を遂げた人々の霊を鎮め、疫病を払うためです。都の人々にも見物が許されました。", k: "hist", src: "『日本三代実録』貞観5年5月20日条" },
  { y: 864, reg: ["togoku"], tags: ["disaster"], t: "富士山が噴火しました（貞観大噴火）。溶岩が「せの海」を埋めて湖を二つに分けました。その溶岩の上に、のちに青木ヶ原の樹海が育ちます。", k: "hist", src: "『日本三代実録』貞観6年条" },
  { y: 869, reg: ["michinoku"], tags: ["disaster"], t: "陸奥で巨大な地震と津波がありました（貞観地震）。溺れ死んだ者は千人ほどと記録されています。", k: "hist", src: "『日本三代実録』貞観11年5月26日条", fx: (s) => { adj(s, { w: -0.6 * sc(s) }); addRisk(s, s.st === "gyomin" ? 0.25 : 0.06, "津波", "海が、山のように盛り上がってきました。"); } },
  { y: 887, reg: ["kinai", "saigoku"], tags: ["disaster"], t: "諸国で大地震がありました（仁和地震）。摂津がとりわけひどく、海があふれて溺れ死んだ人は数えきれないと記録されています。", k: "hist", src: "『日本三代実録』仁和3年7月30日条", fx: (s) => addRisk(s, 0.012, "地震", "揺れが止まったとき、家の屋根が上にありませんでした。") },
  { y: 894, when: isNoble, t: "菅原道真が「唐は衰え、渡海は危うい。遣唐使を送るかどうか、公卿で議定してほしい」と奏上しました。遣唐使は取りやめになりました。", k: "hist", src: "『菅家文草』巻9（寛平6年9月14日の奏状）" },
  { y: 902, when: (s) => isRural(s) && s.st !== "genin", t: "朝廷が、百姓が課役を逃れるために田を有力者へ「寄進」したことにするのを禁じました（延喜の荘園整理令）。逆に言えば、それだけ流行っていたということです。", k: "hist", src: "『類聚三代格』延喜2年3月13日太政官符" },
  { y: 914, t: "三善清行が朝廷に意見書を出し、天下の民の三分の二が、課役を逃れるために勝手に頭を剃った者になっていると訴えました（意見十二箇条）。", k: "hist", src: "三善清行『意見十二箇条』第11条（『本朝文粋』巻2）" },
  { y: 915, epi: "hoso", tags: ["epidemic"], t: "疱瘡（天然痘）が全国で流行しています。「疱瘡」という呼び名は、この年に世間で生まれたと記録されています。", k: "hist", src: "『日本紀略』延喜15年" },
  { y: 915, reg: ["michinoku"], tags: ["disaster", "famine"], t: "北の山（十和田）が大噴火しました。出羽国では灰が二寸積もり、桑畑が枯れたと報告されています。日本の有史以来、最大級の噴火とされます。", k: "hist", src: "『扶桑略記』延喜15年7月13日条／気象庁「十和田」", fx: (s) => { adj(s, { w: -0.8 * sc(s), hp: -5 }); addRisk(s, 0.03, "十和田の噴火", "空が、昼なのに暗くなりました。"); } },
  { y: 909, when: isNoble, t: "左大臣藤原時平が、数えで三十九歳で亡くなりました。のちの『大鏡』は、道真を陥れた報いだと語ります。", k: "hist", src: "『大鏡』時平伝", fx: (s) => { if (s.flags.pol_shotai === "win") { adj(s, { en: -4 }); log(s, "時平についていたあなたは、なんとなく落ち着かない日々を過ごしています。", "bad"); } } },
  { y: 923, when: isNoble, t: "亡き菅原道真が右大臣に戻され、正二位を贈られました。左遷の詔書は破棄されました。", k: "hist", src: "『日本紀略』延喜23年4月20日条", fx: (s) => { if (s.flags.pol_shotai === "lose") { adj(s, { en: 6 }); log(s, "道真を慕っていたあなたの立場も、少しだけ良くなりました。", "good"); } } },
  { y: 930, reg: ["kyo"], t: "内裏の清涼殿に雷が落ち、大納言藤原清貫らが亡くなりました。のちに、これは道真の祟りだと語られるようになります。", k: "hist", src: "『日本紀略』延長8年6月26日条／『北野天神縁起』", fx: (s) => { if (s.st === "kugyo" || s.flags.pol_shotai === "win") addRisk(s, s.flags.pol_shotai === "win" ? 0.08 : 0.04, "落雷（道真の祟り）", "清涼殿で会議中でした。祟られる心当たりは、たぶんありました。"); } },
  { y: 939, reg: ["togoku"], tags: ["war"], t: "平将門が坂東の国府を次々に落とし、「新皇」を名乗りました。あなたの村は、どちらの味方か聞かれる前に焼かれました。", k: "hist", src: "『将門記』", fx: (s) => { adj(s, { w: -0.8 * sc(s), hp: -6 }); addRisk(s, s.st === "bushi" ? 0.12 : 0.035, "平将門の乱", "兵が通り過ぎていきました。あなたは通り過ぎられませんでした。"); } },
  { y: [939, 941], reg: ["saigoku"], tags: ["war"], t: "藤原純友が兵を挙げ、瀬戸内の国々を襲っています（藤原純友の乱）。", k: "hist", src: "『日本紀略』『扶桑略記』", fx: (s) => { addRisk(s, s.st === "gyomin" ? 0.05 : 0.012, "藤原純友の乱", "海賊は、漁師の舟から先に奪っていきました。"); } },
  { y: 935, reg: ["saigoku"], t: "土佐守の任期を終えた紀貫之の一行が、船で都へ帰っていきました。一行の誰かが、女のふりをして仮名の日記を書いているそうです。", k: "hist", src: "紀貫之『土佐日記』" },
  { y: 947, epi: "hoso", tags: ["epidemic"], t: "また疱瘡が流行しています。内裏の中にまで広がっています。", k: "hist", src: "『日本紀略』天暦元年" },
  { y: 960, when: isNoble, t: "清涼殿で、村上天皇の主催する歌合が開かれました（天徳内裏歌合）。のちのちまで歌合の手本とされる、晴れの舞台です。", k: "hist", src: "『殿上日記』『村上天皇御記』" },
  { y: 960, reg: ["kyo"], t: "平安京遷都以来はじめて、内裏が焼けました。", k: "hist", src: "天徳4年の内裏焼亡（京都市埋蔵文化財研究所の資料ほか）" },
  { y: 974, epi: "hoso", tags: ["epidemic"], t: "疱瘡がまた流行しています。疱瘡を払う大祓が行われ、帝までかかりました。", k: "hist", src: "『日本紀略』天延2年" },
  { y: 980, reg: ["kyo"], t: "暴風雨で、都の正門・羅城門が倒れました。その後、再建されることはありませんでした。", k: "hist", src: "『百錬抄』天元3年7月9日条" },
  { y: 985, t: "源信が『往生要集』を著しました。地獄の描写が、とても具体的です。", k: "hist", src: "源信『往生要集』", fx: (s) => adj(s, { toku: 3 }) },
  { y: 988, when: (s) => isRural(s) && s.st !== "genin", t: "尾張国の郡司と百姓が、国司・藤原元命の悪政を三十一か条にわたって朝廷に訴え出ました。翌年、国司は解任されました。", k: "hist", src: "『尾張国郡司百姓等解文』" },
  { y: 994, epi: "eki", tags: ["epidemic"], t: "疫病が猛威を振るっています。夏までに都の人の半ばが亡くなり、五位以上の貴族だけで六十七人が死んだと記録されています。", k: "hist", src: "『日本紀略』正暦5年" },
  { y: 995, epi: "eki", tags: ["epidemic"], t: "疫病がまだ続いています。", k: "hist", src: "『日本紀略』長徳元年" },
  { y: 995, when: isNoble, t: "関白が二人続けて亡くなりました。空いた席には、藤原道長が座りました。", k: "hist", src: "『日本紀略』『栄花物語』" },
  { y: 998, epi: "hashika", tags: ["epidemic"], t: "赤斑瘡（あかもがさ）という新しい病が流行しています。はしかの、記録に残る最初の大流行とされます。", k: "hist", src: "『日本紀略』長徳4年7月条／『栄花物語』巻5" },
  { y: 1008, when: (s) => isNoble(s) && s.sex === "f", t: "宮中で『源氏の物語』という読み物が評判です。作者の紫式部は、漢字が読めることを周囲に隠しているそうです。", k: "hist", src: "『紫式部日記』" },
  { y: 1018, when: isNoble, t: "藤原道長の宴で「この世をば我が世とぞ思ふ望月の欠けたることもなしと思へば」という歌が詠まれ、居並ぶ人々が声をそろえて吟じました。", k: "hist", src: "『御堂関白記』『小右記』寛仁2年10月16日条", fx: (s) => { if (s.flags.pol_chotoku === "win") { adj(s, { en: 3 }); log(s, "あなたも声をそろえて吟じました。道長派であることは、こういうときに得です。", "good"); } } },
  { y: 1019, reg: ["kyushu"], tags: ["war"], t: "海の向こうから刀伊（女真族）の船団が襲ってきました。壱岐・対馬から筑前まで、約360人が殺され、約1300人が連れ去られました。", k: "hist", src: "『小右記』『朝野群載』", fx: (s) => addRisk(s, 0.05, "刀伊の入寇", "船団は、朝の霧の中から来ました。") },
  { y: 1020, epi: "hoso", tags: ["epidemic"], t: "春から疱瘡が流行しています。大赦が行われ、調庸と雑徭が免除されました。", k: "hist", src: "『日本紀略』寛仁4年" },
  { y: 1020, reg: ["togoku"], t: "上総介の一家が、任期を終えて都へ帰っていきました。十三歳の娘は、都で物語を好きなだけ読めるよう、薬師仏に祈っていたそうです。", k: "hist", src: "菅原孝標女『更級日記』" },
  { y: 1023, reg: ["kyo"], when: isNoble, t: "藤原道長が土御門殿で田植えの催しを開き、娘の彰子に見せました。鼓と笛で囃し、田植え歌が歌われたそうです。貴族にとって、田植えは見物するものです。", k: "hist", src: "『栄花物語』巻十九「御裳着」" },
  { y: [1028, 1031], reg: ["togoku"], tags: ["war"], t: "上総・下総で平忠常の乱が続いています。追討使が送られましたが、なかなか鎮まりません。", k: "hist", src: "平忠常の乱（1028〜1031年。和洋女子大学紀要の論文ほか）", fx: (s) => { adj(s, { w: -0.5 * sc(s), hp: -3 }); addRisk(s, 0.015, "平忠常の乱", "乱そのものより、乱のあとの飢えのほうが長く続きました。"); } },
  { y: [1051, 1062], reg: ["michinoku"], tags: ["war"], t: "陸奥で安倍氏と源氏の戦が続いています（前九年合戦）。", k: "hist", src: "『陸奥話記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.06 : 0.015, "前九年合戦", "戦は十二年続きました。あなたはその途中で終わりました。") },
  { y: 1052, t: "今年から末法の世に入ったと言われています。仏の教えが廃れ、世が乱れる時代だそうです。みんな薄々そう思っていました。", k: "hist", src: "『扶桑略記』", fx: (s) => adj(s, { toku: 2 }) },
  { y: 1053, when: isNoble, t: "藤原頼通が、宇治の平等院に阿弥陀堂（のちの鳳凰堂）を建てて供養しました。極楽を、自腹で、先に建てた人です。", k: "hist", src: "平等院の阿弥陀堂供養（天喜元年）" },
  { y: 1069, when: (s) => s.st === "gozoku" || isNoble(s), t: "後三条天皇が荘園整理令を出し、記録荘園券契所で荘園の証拠書類を調べ始めました。あなたの荘園の書類は、たぶん大丈夫です。たぶん。", k: "hist", src: "延久の荘園整理令（延久元年）", fx: (s) => { if (s.flags.kishin && R() < 0.3) { adj(s, { w: -2 * sc(s) }); log(s, "……大丈夫ではありませんでした。一部の田が没収されました。", "bad"); } } },
  { y: [1083, 1087], reg: ["michinoku"], tags: ["war"], t: "陸奥で清原氏の内紛に源義家が介入し、戦が続いています（後三年合戦）。", k: "hist", src: "『奥州後三年記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.06 : 0.012, "後三年合戦", "雪の中の籠城戦でした。") },
  { y: 1096, reg: ["kyo"], tags: ["fest"], t: "都じゅうが田楽に熱狂しています（永長の大田楽）。庶民から公卿まで、笛と鼓で踊り歩いています。大江匡房いわく「一城の人、皆狂へるがごとし」。", k: "hist", src: "大江匡房『洛陽田楽記』／『中右記』永長元年" },
  { y: 1108, reg: ["togoku"], tags: ["disaster", "famine"], t: "上野国の浅間山が大噴火しました。国司の報告によれば、国中の田畑がことごとく駄目になったそうです。", k: "hist", src: "『中右記』天仁元年9月5日条", fx: (s) => { adj(s, { w: -1.2 * sc(s), hp: -6 }); addRisk(s, 0.03, "浅間山の噴火", "山の火は、七月の末に上がりました。"); } },
  { y: 1156, reg: ["kyo"], tags: ["war"], t: "天皇方と上皇方が武士を集めて都で戦いました（保元の乱）。敗れた側の武士が処刑されました。朝廷による死刑は、約350年ぶりとされます。", k: "hist", src: "『兵範記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.1 : 0.008, "保元の乱", "夜明け前の白河殿でした。") },
  { y: 1159, reg: ["kyo"], tags: ["war"], t: "源義朝と平清盛が都で戦いました（平治の乱）。平家の時代が始まります。", k: "hist", src: "『平治物語』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.1 : 0.008, "平治の乱", "六波羅でした。") },
  { y: 1167, t: "平清盛が太政大臣になりました。平時忠いわく「此一門にあらざらむ人は、皆人非人なるべし」（俗に言う「平家にあらずんば人にあらず」）。あなたは平家ではありません。", k: "hist", src: "『平家物語』巻一「禿髪」" },
  { y: 1177, reg: ["kyo"], tags: ["disaster"], t: "都で大火事がありました（安元の大火）。大極殿まで焼け落ちました。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => { adj(s, { w: -0.25 * Math.max(0, s.wealth) }); addRisk(s, 0.02, "安元の大火", "風が強い夜でした。"); } },
  { y: 1180, reg: ["kyo"], tags: ["disaster"], t: "四月、都につむじ風が吹き荒れ、家々が吹き飛ばされました。六月には、平清盛が都を福原へ移しました。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => adj(s, { w: -0.15 * Math.max(0, s.wealth) }) },
  { y: 1180, t: "以仁王の令旨をきっかけに、源氏と平家の戦が各地で始まりました（治承・寿永の乱）。", k: "hist", src: "『平家物語』『吾妻鏡』", tags: ["war"] },
  { y: [1181, 1185], t: "", tags: ["war"] },
  { y: [1181, 1182], reg: ["togoku", "michinoku"], t: "西国や都が大飢饉だと伝わってきます（養和の飢饉）。前の年の日照りは、西の国々でとりわけひどかったそうです。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => adj(s, { hp: -2 }) },
  { y: [1181, 1182], reg: ["kyo", "kinai", "saigoku", "kyushu"], tags: ["famine"], t: "大飢饉です（養和の飢饉）。『方丈記』は、都で道ばたに捨て置かれた遺体を四万二千三百余りと記します（実数かどうかは研究者の間で議論があります）。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => {
    const poor = !(isNoble(s) || s.st === "gozoku" || s.wealth > 20);
    adj(s, { hp: poor ? -12 : -3, w: poor ? -1.2 : -0.1 * Math.max(0, s.wealth) });
    addRisk(s, poor ? (s.region === "kyo" || s.region === "saigoku" ? 0.12 : 0.06) : 0.01, "飢え（養和の飢饉）", "最後に食べたのは、木の皮を煮たものでした。");
  } },
  { y: 1185, reg: ["kyo"], tags: ["disaster"], t: "都を大地震が襲いました（元暦の大地震）。山は崩れ、海は傾き、寺も塔も無事なものはなかったといいます。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => addRisk(s, 0.02, "元暦の大地震", "揺れは、何か月も続きました。") },
  { y: 1192, t: "源頼朝が征夷大将軍になりました。教科書的には時代が変わりましたが、あなたの暮らしは特に変わりません。", k: "hist", src: "建久3年7月12日の任官（『吾妻鏡』7月26日条に知らせ）" },
  { y: 1212, t: "鴨長明という男が、方丈の庵で『方丈記』を書き上げました。あなたが見てきた災害が、だいたい全部載っています。", k: "hist" },
  { y: 1221, when: (s) => !polAffected(s), t: "後鳥羽上皇が幕府に挑み、負けました（承久の乱）。上皇が島流しになる時代です。", k: "hist", src: "『吾妻鏡』" },
  { y: [1230, 1231], tags: ["famine"], t: "大飢饉です（寛喜の飢饉）。寛喜2年6月には美濃国で雪が降ったと、鎌倉に報告されています。もう鎌倉時代です。", k: "hist", src: "『吾妻鏡』寛喜2年6月16日条", fx: (s) => { const poor = !(isNoble(s) || s.wealth > 20); adj(s, { hp: poor ? -10 : -2, w: poor ? -1 : 0 }); addRisk(s, poor ? 0.07 : 0.01, "飢え（寛喜の飢饉）", "冷たい夏でした。"); } }
];
/* ---------------- 政変（貴族が「どちらにつくか」を選ぶ） ---------------- */
// sides: win=勝った側 lose=負けた側 mid=関わらない。sev: 負けた側への処分の重さ（exile=左遷・流罪 / death=処刑の危険あり / dismiss=解官）
const POLITICS = [
  { id: "kusuko", y: 810, title: "薬子の変", src: "『日本後紀』弘仁元年9月条",
    lead: "平城上皇が平城旧京への遷都を命じ、嵯峨天皇と対立しています。朝廷が二つに割れかけています。",
    sides: [["win", "嵯峨天皇に従う", "今の帝の側"], ["lose", "平城上皇（藤原薬子・仲成）に従う", "前の帝の側"], ["mid", "どちらにも与しない", "様子を見る"]],
    winText: "嵯峨天皇方の勝ちでした。藤原仲成は射殺され、上皇は剃髪し、薬子は毒を仰いで自ら命を絶ちました。", sev: "exile" },
  { id: "jowa", y: 842, title: "承和の変", src: "『続日本後紀』承和9年7月条",
    lead: "嵯峨上皇が重い病です。皇太子恒貞親王の周りと、藤原良房の周りで、不穏な噂が流れています。",
    sides: [["win", "藤原良房に近づく", "良房の甥・道康親王を推す側"], ["lose", "皇太子恒貞親王に仕える", "今の皇太子の側"], ["mid", "関わらない", "様子を見る"]],
    winText: "上皇の崩御直後、伴健岑・橘逸勢が謀反の罪で捕らえられ、皇太子は廃されました。健岑は隠岐、逸勢は伊豆へ流され、良房の甥の道康親王が新しい皇太子になりました。", sev: "exile" },
  { id: "otenmon", y: 866, title: "応天門の変", src: "『日本三代実録』貞観8年条",
    lead: "応天門が焼けました。犯人をめぐって噂が飛び交い、大納言伴善男の名も取り沙汰されています。太政大臣藤原良房が動き始めました。",
    sides: [["win", "藤原良房に従う", "摂政となる良房の側"], ["lose", "大納言伴善男に与する", "伴氏の側"], ["mid", "関わらない", "様子を見る"]],
    winText: "藤原良房は臣下として初めて摂政に任じられました。その後、伴善男と子の中庸らが犯人とされて遠流となり、縁者も流されました。", sev: "exile" },
  { id: "shotai", y: 901, title: "昌泰の変", src: "『日本紀略』",
    lead: "右大臣菅原道真が、娘婿の斉世親王を帝に立てようとしている、という讒言が流れています。左大臣藤原時平の周りが騒がしくなっています。",
    sides: [["win", "左大臣藤原時平につく", "藤原氏の側"], ["lose", "右大臣菅原道真を慕う", "学者・道真の側"], ["mid", "関わらない", "様子を見る"]],
    winText: "道真は大宰員外帥（大宰府の名ばかりの長官）に落とされ、九州へ送られました。道真の子らも、各地へ左遷されました。", sev: "exile" },
  { id: "anna", y: 969, title: "安和の変", src: "『日本紀略』安和2年3月条",
    lead: "源満仲らが謀反を密告しました。左大臣源高明も関わっているとされています。",
    sides: [["win", "藤原氏の側につく", "右大臣藤原師尹らの側"], ["lose", "左大臣源高明に仕える", "源氏の側"], ["mid", "関わらない", "様子を見る"]],
    winText: "源高明は大宰府へ左遷され、右大臣藤原師尹が左大臣に昇りました。以後、藤原氏に並ぶ家はほとんどなくなります。", sev: "exile" },
  { id: "chotoku", y: 996, title: "長徳の変", src: "『小右記』／『栄花物語』巻5「浦々の別」",
    lead: "内大臣藤原伊周・弟の隆家と、花山法皇の一行が争い、法皇の童子が殺される事件が起きました（『栄花物語』は、矢が法皇の袖を射抜いたと描きます）。叔父の藤原道長が動いています。",
    sides: [["win", "藤原道長につく", "左大臣の側"], ["lose", "内大臣藤原伊周・隆家兄弟につく", "中関白家の側"], ["mid", "関わらない", "様子を見る"]],
    winText: "伊周は大宰権帥、隆家は出雲権守に左遷されました。道長は左大臣に進み、道長の時代が始まります。", sev: "exile", pardon: 1 },
  { id: "insei", y: 1086, title: "院政のはじまり", src: "応徳3年（1086）11月の譲位",
    lead: "白河天皇が位を譲り、上皇として政治を続けることにしました。院の御所に、中級の貴族たちが集まり始めています。",
    sides: [["win", "院の近臣になる", "受領などの中級貴族が出世しやすい"], ["mid", "摂関家に仕え続ける", "これまでどおり"]],
    winText: "院のもとで、近臣に取り立てられた受領層の中級貴族が力を伸ばしていきます。", sev: "none" },
  { id: "hogen", y: 1156, title: "保元の乱", src: "『兵範記』『保元物語』",
    lead: "鳥羽法皇が亡くなりました。崇徳上皇と後白河天皇、藤原頼長と忠通の兄弟が、それぞれ武士を集めています。",
    sides: [["win", "後白河天皇方につく", "平清盛・源義朝らの側"], ["lose", "崇徳上皇方につく", "藤原頼長・源為義らの側"], ["mid", "関わらない", "屋敷にこもる"]],
    winText: "天皇方が夜討ちで勝ちました。崇徳上皇は讃岐へ流され、頼長は流れ矢で亡くなりました。上皇方の武士は処刑されました。", sev: "death" },
  { id: "heiji", y: 1159, title: "平治の乱", src: "『平治物語』『愚管抄』",
    lead: "平清盛が熊野詣でに出た隙に、藤原信頼と源義朝が兵を挙げて院の御所を襲いました。信西は逃れた先で自害に追い込まれました。",
    sides: [["win", "平清盛につく", "熊野から戻る清盛の側"], ["lose", "藤原信頼・源義朝につく", "都を押さえた側"], ["mid", "関わらない", "屋敷にこもる"]],
    winText: "清盛が勝ちました。藤原信頼は六条河原で斬られ、源義朝は東国へ逃げる途中、尾張で討たれました。", sev: "death" },
  { id: "jisho", y: 1179, title: "治承三年の政変", src: "『玉葉』『山槐記』治承3年11月条",
    lead: "平清盛が福原から大軍を率いて都に入りました。後白河法皇の周りの貴族が、次々に呼び出されています。",
    sides: [["win", "平家に近づく", "今の勝ち組"], ["lose", "後白河法皇に仕え続ける", "法皇の側"], ["mid", "関わらない", "屋敷にこもる"]],
    winText: "関白藤原基房が解官・配流され、続いて太政大臣藤原師長以下39人が官職を解かれました。後白河法皇は鳥羽殿に移され、院政は止められました。", sev: "dismiss", later: 1185 },
  { id: "jokyu", y: 1221, title: "承久の乱", src: "『吾妻鏡』承久3年条",
    lead: "後鳥羽上皇が、執権北条義時を討てという命令を出しました。都の貴族は、上皇に従うよう求められています。",
    sides: [["lose", "後鳥羽上皇に従う", "朝廷の側"], ["win", "ひそかに幕府に通じる", "鎌倉の側"], ["mid", "関わらない", "屋敷にこもる"]],
    winText: "幕府軍が都を制しました。後鳥羽上皇は隠岐へ流され、院宣を奉じた葉室光親ら、上皇方の公卿の一部が処刑されました。", sev: "death" }
];
function polChoiceEligible(s) { return isOfficial(s) && s.age >= 15 && !(s.flags.exile > 0); }
function polAffected(s) { return isNoble(s) || isOfficial(s); }
function polChoice(s, P) {
  return branch(s, "政変 ― " + P.title, P.lead, P.sides.map(([k, label, desc]) => ({
    label, desc, apply: (st) => { st.flags["pol_" + P.id] = k; return [k === "mid" && P.sev !== "none" ? "どちらにも与せず、成り行きを見守ることにしました。" : label + "ことにしました。"]; }
  })), P.src);
}
function polAuto(s, P) {
  const r = R(), winP = 0.35 + s.en / 250;
  const k = P.sev === "none" ? (r < winP ? "win" : "mid") : (r < winP ? "win" : (r < winP + 0.25 ? "lose" : "mid"));
  s.flags["pol_" + P.id] = k; s.flags["polAuto_" + P.id] = 1;
}
function exile(s, years, why) {
  s.flags.exile = years; s.flags.exiledEver = 1; s.flags.exileWhy = why;
  s.rank = Math.max(0, s.rank - 1); s.juryo = 0;
  s.wealth *= 0.6; adj(s, { en: -15 });
  const dest = pick([["kyushu", "大宰府"], ["saigoku", "土佐"], ["togoku", "伊豆"], ["saigoku", "隠岐"]]);
  s.region = dest[0];
  log(s, why + "の連座で、" + dest[1] + "へ左遷（流罪）となりました。位も一つ下げられました。", "bad");
}
function polResolve(s, P) {
  const k = s.flags["pol_" + P.id];
  if (!k || s.flags["polDone_" + P.id]) return;
  s.flags["polDone_" + P.id] = 1;
  const auto = s.flags["polAuto_" + P.id];
  const who = auto ? (s.sex === "f" ? (s.married && s.spouseAlive ? "夫の家" : "実家") : "家") : "あなた";
  log(s, P.winText, "hist", P.src);
  if (k === "win") {
    adj(s, { en: auto ? 4 : 10 });
    if (!auto && isOfficial(s) && R() < 0.5 && s.rank < rankCap(s)) { s.rank++; log(s, "勝った側についた恩賞として、" + RANKS[s.rank] + "に昇進しました。", "good"); }
    else log(s, who + "は勝った側でした。周りの態度が、少し丁寧になりました。", "good");
    if (P.id === "insei" && !auto) s.flags.inshin = 1;
    if (P.later) s.flags["polLater_" + P.id] = 1;
  } else if (k === "mid") {
    adj(s, { en: -1 });
    log(s, P.sev === "none" ? "これまでどおり摂関家に仕えています。その摂関家の力は、かつてほどではありません。" : who + "はどちらにも与しませんでした。嵐は頭の上を通り過ぎていきました。", "n");
  } else {
    if (auto) { adj(s, { en: -6 }); log(s, who + "は負けた側でした。後ろ盾を失い、肩身の狭い思いをしています。", "bad"); return; }
    const pPunish = clamp(0.35 + s.rank * 0.03, 0.3, 0.85);
    if (R() >= pPunish) { adj(s, { en: -8 }); log(s, "負けた側でしたが、処分は免れました。ただし、出世の道は細くなりました。", "bad"); return; }
    if (P.sev === "dismiss") { s.rank = Math.max(0, s.rank - 1); s.juryo = 0; adj(s, { en: -12 }); log(s, "官職を解かれました（解官）。", "bad"); return; }
    if (P.sev === "death" && s.rank >= 9 && R() < 0.4) { log(s, "謀反に加わった罪を問われ、捕らえられました。", "bad"); addRisk(s, 0.6, P.title + "の処刑", "謀反に与した罪で、斬られました。"); if (R() < 0.6) return; }
    exile(s, P.pardon ? 1 + Math.floor(R() * 2) : 3 + Math.floor(R() * 5), P.title);
  }
}

function yearTags(s) {
  const t = new Set();
  for (const h of HIST) if (h.tags && histMatch(h, s)) h.tags.forEach(x => t.add(x));
  return t;
}
function blocked(ev, tags) { return !!(ev.block && ev.block.some(x => tags.has(x))); }
function histMatch(h, s) {
  const y = s.year;
  if (Array.isArray(h.y)) { if (y < h.y[0] || y > h.y[1]) return false; }
  else if (h.y !== y) return false;
  if (h.reg && !h.reg.includes(s.region)) return false;
  if (h.when && !h.when(s)) return false;
  return true;
}

/* ---------------- 疫病 ---------------- */
function epidemic(s, kind) {
  const hm = hpMult(s);
  if (kind === "hoso") {
    if (s.flags.abata) { log(s, "一度かかった者は、二度はかからないようです。あばたが、お守りの代わりになりました。", "n"); return; }
    const inf = R() < 0.5;
    if (!inf) { log(s, "幸い、うつりませんでした。", "n"); return; }
    const pd = clamp(0.3 * hm * (s.age < 10 ? 1.25 : 1), 0.08, 0.55);
    if (R() < pd) { s.forceDeath = { cause: "疱瘡（天然痘）", desc: "高い熱と全身の発疹。この時代、最も恐れられた病でした。" }; return; }
    s.flags.abata = 1; adj(s, { hp: -10 });
    log(s, "疱瘡にかかりましたが、生き延びました。顔にあばたが残りました。", "bad");
  } else if (kind === "hashika") {
    if (s.flags.hashika) return;
    if (R() < 0.6) {
      const pd = clamp((s.age < 10 ? 0.16 : 0.06) * hm, 0.02, 0.3);
      if (R() < pd) { s.forceDeath = { cause: "赤斑瘡（はしか）", desc: "体中が赤い斑点で覆われました。" }; return; }
      s.flags.hashika = 1; adj(s, { hp: -5 }); log(s, "赤斑瘡にかかりましたが、治りました。", "bad");
    }
  } else {
    const pd = clamp(0.07 * hm * (s.region === "kyo" ? 1.4 : 1), 0.02, 0.25);
    if (R() < pd) { s.forceDeath = { cause: "疫病（長徳の大疫）", desc: "身分の上下を問わず、都の誰もがかかっていました。" }; return; }
    adj(s, { hp: -6 });
  }
}

/* ---------------- 毎年のランダムイベント ---------------- */
const EVENTS = [
  // ---- 農村 ----
  { p: 0.11, tag: "good_harvest", block: ["famine", "bad_harvest", "flood", "disaster", "war"], when: (s) => ["nomin", "gozoku"].includes(s.st), src: "『尾張国郡司百姓等解文』（国司による過重な徴収の訴え）", fx: (s) => { adj(s, { w: 0.9 * sc(s) }); log(s, pick(["豊作でした。増えた分は、だいたい国司が持っていきました。", "豊作でした。出挙で借りた稲を、今年は利息ごと返せました。"]), "good"); } },
  { p: 0.055, tag: "bad_harvest", block: ["good_harvest", "flood"], when: (s) => ["nomin", "gozoku", "furo"].includes(s.st), fx: (s) => { s.ytags.add("drought"); adj(s, { w: -1.2 * sc(s), hp: -4 }); log(s, "日照りでした。都の神泉苑では雨乞いの修法が行われたそうです。村には届きませんでした。", "bad"); } },
  { p: 0.055, tag: "bad_harvest", block: ["good_harvest", "drought"], when: (s) => ["nomin", "gozoku", "furo"].includes(s.st), fx: (s) => { s.ytags.add("rain"); adj(s, { w: -1.2 * sc(s), hp: -4 }); log(s, pick(["長雨で稲が腐りました。", "虫の害で、稲が一晩で枯れました。"]), "bad"); } },
  { p: 0.04, when: (s) => isRural(s) && s.st !== "genin" && !s.flags.kishin && s.st !== "furo" && !(s.flags.guard > 0), src: "『尾張国郡司百姓等解文』（988年）", fx: (s) => { adj(s, { w: -0.8 * sc(s) }); log(s, pick(["新しい国司が着任しました。前の国司より、取り立てに熱心な方です。", "国司の使いが来て、決まりより多くの稲を取り立てていきました。尾張の百姓が訴えた手口と同じです。"]), "bad"); } },
  { p: 0.035, when: (s) => (s.st === "nomin" || s.st === "gyomin") && s.sex === "m" && s.age >= 17 && s.age < 60, src: "『養老令』賦役令／延暦14年（795）の雑徭半減", fx: (s) => { adj(s, { hp: -4 }); log(s, "国司のもとでの雑徭（ぞうよう＝年30日までの労役）に駆り出されました。国府の修理と、国司の私用の区別はつきませんでした。", "bad"); } },
  { p: 0.04, tag: "flood", block: ["good_harvest", "drought", "irrigation"], when: (s) => isRural(s), fx: (s) => { adj(s, { w: -0.6 * sc(s) }); log(s, "川があふれ、田が流されました。", "bad"); addRisk(s, 0.008, "洪水", "濁流は、夜に来ました。"); } },
  { p: 0.03, when: (s) => isRural(s) || s.st === "kyomin", src: "『今昔物語集』巻29第18話ほか（盗人の話）", fx: (s) => { adj(s, { w: -0.4 * sc(s) }); log(s, "盗賊に入られました。盗られて困るものは、あまりありませんでした。", "bad"); addRisk(s, 0.006, "盗賊に襲われて", "抵抗したのが、まずかったようです。"); } },
  { p: 0.02, when: (s) => s.age >= 6, src: "『日本霊異記』上巻第二縁", fx: (s) => log(s, "狐が女に化けて人の妻になったという昔話を、村の年寄りが繰り返し話しています。「来つ寝（きつね）」の由来だそうです。", "n") },
  { p: 0.02, when: (s) => s.age >= 6 && s.region === "kyo", src: "『大鏡』（藤原師輔の百鬼夜行）", fx: (s) => log(s, "夜の大路で百鬼夜行に出くわしかけた、という貴族の話が広まっています。尊勝陀羅尼を唱えて助かったそうです。", "n") },
  { p: 0.035, block: ["famine", "disaster", "war"], when: (s) => s.st === "gyomin", src: "『延喜式』巻24 主計上（駿河・伊豆の調の堅魚）", fx: (s) => { adj(s, { w: 0.8 }); if (s.region === "togoku") log(s, "大漁でした。鰹を干して堅魚（かたうお）にし、調として納めました。駿河や伊豆の調の定番です。", "good"); else log(s, "大漁でした。干物にして、蓄えに回しました。", "good"); } },
  { p: 0.03, when: (s) => s.st === "gyomin", fx: (s) => { log(s, "嵐で舟が壊れました。", "bad"); adj(s, { w: -0.8 }); addRisk(s, 0.02, "海難", "嵐の夜、浜に戻ってきたのは舟の板だけでした。"); } },
  { p: 0.035, when: (s) => isRural(s), fx: (s) => { adj(s, { w: -0.3 * sc(s) }); log(s, pick(["猪が田を荒らしました。", "鹿が稲穂を食べていきました。"]), "bad"); } },
  { p: 0.025, block: ["famine", "disaster"], when: (s) => isRural(s), src: "『今昔物語集』巻28第38話（平茸）", fx: (s) => { adj(s, { hp: 2 }); log(s, "山で平茸がたくさん採れました。信濃守が谷に落ちても手放さなかった、あの茸です。", "good"); } },
  { p: 0.025, when: (s) => isRural(s), src: "『枕草子』第一段", fx: (s) => log(s, "夏の夜、蛍がたくさん飛び交っていました。都の女房が「をかし」と書いた景色は、村ではただの夜です。", "n") },
  { p: 0.03, tag: "fest", block: ["famine", "epidemic", "war", "disaster", "drought"], when: (s) => isRural(s) && s.year >= 1000, src: "『栄花物語』巻十九「御裳着」（田植えの囃子）", fx: (s) => log(s, "田植えの日、腰鼓や笛で囃し、田植え歌を歌いながら苗を植えました。", "n") },
  { p: 0.03, when: (s) => isRural(s) && s.st !== "genin", src: "『養老令』雑令（出挙）", fx: (s) => log(s, "稲刈りのあと、収穫のかなりの分が租と出挙の返済で消えました。", "n") },
  { p: 0.04, when: (s) => isRural(s) && (s.region === "togoku" || s.region === "michinoku"), fx: (s) => { adj(s, { hp: -3 }); log(s, pick(["大雪で、家が半分埋まりました。", "冬が長く、蓄えの粟が春までもちませんでした。"]), "bad"); } },
  { p: 0.015, when: (s) => isRural(s) && (s.region === "togoku" || s.region === "michinoku") && s.age >= 10, fx: (s) => { log(s, "山で熊に出くわしました。", "bad"); addRisk(s, 0.08, "熊に襲われて", "山菜採りの帰りでした。"); } },
  { p: 0.03, when: (s) => s.age >= 6, fx: (s) => { adj(s, { hp: -1 }); log(s, "雷が近くの大木に落ちました。", "n"); } },
  { p: 0.03, tag: "irrigation", block: ["famine", "flood"], when: (s) => s.st === "gozoku", src: "藤原明衡『新猿楽記』（大名田堵・田中豊益）", fx: (s) => { adj(s, { w: 0.5 * sc(s) }); log(s, "日照りに備えて堰と用水路を整え、農具を手入れしました。『新猿楽記』に描かれた大名田堵の仕事ぶりと同じです。", "good"); } },
  // ---- 都 ----
  { p: 0.05, when: (s) => s.region === "kyo", src: "『日本紀略』ほか（京中の火事の記事）", fx: (s) => { adj(s, { w: -0.12 * Math.max(0, s.wealth) - 0.2 }); log(s, "近所から火が出ました。平安京は、よく燃える街です。", "bad"); addRisk(s, 0.004, "火事", "煙が先に来ました。"); } },
  { p: 0.04, tag: "fest", block: ["epidemic", "famine", "war"], when: (s) => s.region === "kyo" && s.age >= 6, src: "『源氏物語』葵巻（御禊の日の車争い）", fx: (s) => { adj(s, { en: 1 }); log(s, "賀茂祭の行列を見物しました。『源氏物語』では、斎院の御禊の見物で牛車の場所取りの喧嘩が起きます。今年は起きませんでした。", "n"); } },
  { p: 0.03, when: (s) => s.st === "kyomin", src: "鴨長明『方丈記』", fx: (s) => log(s, "鴨川の河原に、また遺体が置かれていました。もう誰も驚きません。", "n") },
  { p: 0.05, when: (s) => s.region === "kyo" && s.year >= 938 && s.year <= 972 && s.age >= 6, src: "『日本往生極楽記』空也伝", fx: (s) => { adj(s, { toku: 2 }); log(s, "市で、空也という聖が念仏を唱えながら、井戸を掘ったり施しをしたりしています。人々は「市聖」と呼んでいます。", "n"); } },
  // ---- 貴族・官人 ----
  { p: 0.09, when: (s) => (isNoble(s) || s.st === "kanjin") && s.age >= 6, src: "『枕草子』「すさまじきもの」", fx: (s) => { adj(s, { hp: 1, en: -0.5 }); const adult = s.age >= 15 && s.sex === "m"; log(s, pick([adult ? "陰陽師に物忌みを言い渡され、屋敷にこもりました。出仕を休めるので、わりと助かっています。" : "陰陽師に物忌みを言い渡され、何日も屋敷から出られませんでした。", "方違えに知人の家へ行ったのに、何のもてなしもありませんでした。清少納言が「すさまじきもの」に挙げた仕打ちです。", adult ? "夢見が悪かったので物忌みとし、出仕を取りやめました。" : "夢見が悪かったので物忌みとし、一日じゅう御簾の内で過ごしました。"]), "n"); } },
  { p: 0.045, tag: "fest", block: ["epidemic", "famine"], when: (s) => isNoble(s) && s.age >= 15, fx: (s) => {
    if (s.sai >= 45) { adj(s, { en: 4 }); log(s, "歌合で、あなたの歌が勝ちました。しばらく宮中の話題になりました。", "good"); }
    else { adj(s, { en: -1 }); log(s, "歌合に出ました。判者の評は「歌の姿はよろしいが、心が浅い」。負けです。", "n"); }
  } },
  { p: 0.035, when: (s) => isNoble(s) && s.age >= 30 && s.sex === "m" && s.year >= 931, fx: (s) => { log(s, "政敵が亡くなりました。道真の一件以来、雷が鳴るたびに全員があなたを見ます。", "n"); adj(s, { toku: -1 }); } },
  { p: 0.05, tag: "fest", block: ["epidemic", "famine"], when: (s) => isNoble(s) && s.age >= 15 && s.sex === "m", fx: (s) => { adj(s, { w: -0.6 * sc(s), en: 2 }); log(s, "大臣家の大饗（だいきょう）に招かれました。宴の席順で、今の自分の立場がよく分かりました。", "n"); } },
  { p: 0.06, when: (s) => s.sex === "f" && isNoble(s) && s.married && s.spouseAlive, src: "藤原道綱母『蜻蛉日記』", fx: (s) => { adj(s, { en: -1 }); log(s, "夫の訪れが途絶えがちです。『蜻蛉日記』を書くなら、今です。", "bad"); } },
  { p: 0.05, when: (s) => s.flags.nyobo && s.sex === "f", fx: (s) => {
    if (s.sai >= 50) { adj(s, { en: 3 }); log(s, "雪の朝、主人に「香炉峰の雪はいかならむ」と問われ、黙って御簾を高く上げてみせました。清少納言と同じ手です。", "good", "『枕草子』「雪のいと高う降りたるを」"); }
    else { log(s, "宮仕え先で、漢字が読めないふりをしました。紫式部は「一」の字すら書けないふりをしたそうです。あなたは本当に読めません。", "n", "『紫式部日記』"); }
  } },
  { p: 0.05, when: (s) => isOfficial(s) && (s.rank === 9 || s.rank === 10), src: "『今昔物語集』巻26第17話", fx: (s) => log(s, "同僚の五位が「一度でいいから、芋粥を飽きるほど食べてみたい」とこぼしていました。あなたも同じことを思っています。", "n") },
  // ---- 衛士 ----
  { p: 0.12, when: (s) => s.st === "eji", src: "大中臣能宣（異説あり）の歌（『詞花和歌集』恋上）", fx: (s) => { adj(s, { hp: -1 }); log(s, "夜通し、宮門で篝火を焚いて番をしました。「みかきもり 衛士のたく火の 夜はもえ」と、のちに貴族が歌に詠む、あの火です。", "n"); } },
  { p: 0.06, when: (s) => s.st === "eji", fx: (s) => { adj(s, { w: -0.3 }); log(s, "故郷から届くはずの食料が、今年も遅れています。", "bad"); } },
  // ---- 郎党 ----
  { p: 0.06, when: (s) => s.st === "bushi" && s.flags.rodo, fx: (s) => { adj(s, { hp: 1, en: 1 }); log(s, pick(["主人の狩りのお供をしました。獲物は主人のものです。", "毎朝、弓の稽古をしています。", "主人の館で、夜の警固につきました。"]), "n"); } },
  // ---- 僧 ----
  { p: 0.06, when: (s) => s.st === "so", src: "『紫式部日記』（中宮彰子の御産の加持）", fx: (s) => { adj(s, { toku: 2, w: 0.3 * sc(s) }); log(s, "貴族の屋敷で、物の怪調伏の加持祈祷をつとめました。物の怪は憑坐（よりまし）に移され、大声でわめいていました。", "n"); } },
  { p: 0.04, when: (s) => s.st === "so" && s.year >= 1086 && s.sex === "m", src: "『平家物語』巻一「願立」", fx: (s) => log(s, "白河法皇が「賀茂川の水、双六の賽、山法師。これぞ我が心にかなわぬもの」と嘆いているそうです。山法師とは、比叡山の僧のことです。", "n") },
  // ---- 武士 ----
  { p: 0.05, when: (s) => s.st === "bushi", fx: (s) => { adj(s, { en: 2 }); log(s, "隣の武士と、境目の田をめぐって小競り合いになりました。", "bad"); addRisk(s, 0.02, "所領争い", "境界の杭一本のための戦いでした。"); } },
  // ---- 下人 ----
  { p: 0.05, when: (s) => s.st === "genin", fx: (s) => { adj(s, { hp: -3 }); log(s, pick([s.year < 900 ? "戸籍に、あなたは「奴（ぬ）」「婢（ひ）」として記されています。名はあっても、姓はありません。" : "主人の家では、あなたは「下人」と呼ばれます。名はあっても、姓はありません。", "主人が別の家と取引し、あなたの兄弟が譲り渡されていきました。", "朝から晩まで主人の田で働きました。明日も同じです。"]), "bad"); } },
  // ---- 浮浪人 ----
  { p: 0.05, when: (s) => s.st === "furo", fx: (s) => { adj(s, { hp: -3 }); log(s, "国司の役人に「浮浪人」として捕まりかけました。走って逃げました。", "bad"); } },
  // ---- 子ども時代 ----
  { p: 0.035, when: (s) => s.age >= 2 && s.age < 15 && !s.flags.orphan, fx: (s) => {
    const who = R() < 0.5 ? "父" : "母";
    s.flags.orphan = 1; adj(s, { hp: -3, w: -0.25 * Math.max(0, s.wealth) });
    log(s, who + "が亡くなりました。この時代、親が子の成人を見届けられるとは限りません。", "bad");
  } },
  // ---- 全般 ----
  { p: 0.04, when: (s) => s.age >= 8, fx: (s) => { adj(s, { hp: -6 }); const k = R(); if (k < 0.34) log(s, "瘧病（わらわやみ）にかかり、熱と震えを繰り返しました。光源氏が北山の聖を訪ねた、あの病です。", "bad", "『源氏物語』若紫巻"); else log(s, k < 0.67 ? "ひどい腹下しで寝込みました。" : "咳の出る病が流行り、寝込みました。", "bad"); } },
  { p: 0.02, when: (s) => s.age >= 10 && s.region !== "kyo", src: "『日本往生極楽記』", fx: (s) => { adj(s, { toku: 2 }); log(s, "旅の聖（ひじり）が村に来て、念仏を勧めていきました。", "n"); } }
];

/* ---------------- 衛士・郎党・成り上がり ---------------- */
function becomeEji(s) { s.st = "eji"; s.region = "kyo"; s.flags.ejiTerm = 3 + Math.floor(R() * 4); s.flags.ejiEver = 1; }
function becomeRodo(s) { s.st = "bushi"; s.flags.rodo = 1; s.flags.rodoEver = 1; adj(s, { hp: 2 }); }
function chEjiEnd(s) {
  const o = [
    { label: "故郷の村へ帰る", desc: "元の暮らしに戻る", apply: (st) => { st.st = "nomin"; st.region = st.birthRegion === "kyo" ? "kinai" : st.birthRegion; return ["衛士の務めを終え、故郷へ帰りました。都の話を、村で何度もすることになります。"]; } },
    { label: "都に残る", desc: "京の庶民として暮らす", apply: (st) => { st.st = "kyomin"; return ["故郷には戻らず、都に残ることにしました。"]; } }
  ];
  if (s.year >= 900) o.push({ label: "都の武士に仕える", desc: "郎党になる。腕っぷししだい", apply: (st) => { becomeRodo(st); st.region = "kyo"; return ["門番ぶりを見込まれ、都の武士の郎党になりました。"]; } });
  return branch(s, "人生の分岐点 ― 衛士の任期明け", "衛士の務めが明けました。この先、どうしますか。", o);
}
function chRise(s) {
  return branch(s, "人生の分岐点 ― 富豪の輩", "貸し付けた稲の利息と、請け負った田の実りで、蔵がいっぱいになりました。村では「富豪の輩」と呼ばれています。", [
    { label: "人を雇って田を広げ、名を上げる", desc: "地方豪族（大名田堵）になる", apply: (st) => { st.st = "gozoku"; st.flags.risen = 1; adj(st, { en: 6 }); return ["人を雇い、田を広げました。『新猿楽記』の大名田堵のように、農具と牛馬をそろえ、堰と用水を整える身になりました。もう、ただの農民ではありません。"]; } },
    { label: "今のままでいい", desc: "目立つと国司ににらまれる", apply: () => ["今のままでいることにしました。出る杭は、国司に打たれます。"] }
  ], "藤原明衡『新猿楽記』（大名田堵）／私出挙の禁令");
}

/* ---------------- 庶民の小さな出来事（選択式） ---------------- */
function ev(title, lead, options, src) { return { title, lead, options, src }; }
function merchant(y) { return y < 907 ? "唐の商人" : (y < 960 ? "唐や呉越の商人" : "宋の商人"); }
const SMALL = [
  { id: "rodo", once: true, when: (s) => (s.st === "nomin" || s.st === "gyomin") && s.sex === "m" && s.age >= 16 && s.age <= 35 && s.year >= 900, build: (s) => ev("郎党の誘い", "近くの兵（つわもの）が、腕の立つ若者を郎党として集めています。", [
    { label: "郎党になる", desc: "武士の世界へ。戦があれば危ない", apply: (st) => { becomeRodo(st); return ["郎党になりました。鍬を弓に持ち替えます。"]; } },
    { label: "断る", desc: "村で暮らし続ける", apply: () => ["断りました。主人を持つと、主人の敵まで持つことになります。"] }
  ], "『将門記』（伴類）／『今昔物語集』巻25「本朝付世俗」（武士の説話）") },
  { id: "ejiflee", once: true, when: (s) => s.st === "eji", build: (s) => ev("衛士の逃亡", "同じ衛士の仲間が、夜のうちに逃げようと誘ってきました。", [
    { label: "一緒に逃げる", desc: "浮浪人になる", apply: (st) => { st.st = "furo"; st.region = pick(["kinai", "saigoku", "togoku"]); return ["夜のうちに都を抜け出しました。戸籍の上では、行方知れずの衛士です。"]; } },
    { label: "務めを続ける", desc: "任期明けまで耐える", apply: () => ["務めを続けることにしました。翌朝、仲間の姿はありませんでした。"] }
  ], "「衛士」（年限は1年と定められたが実際はもっと長く、逃亡者も出た。百科事典マイペディア）") },
  { id: "kenden", when: (s) => (s.st === "nomin" || s.st === "gozoku") && !s.flags.kishin && !(s.flags.guard > 0), build: (s) => ev("検田使が来た", "国司の検田使（田の広さを調べる役人）が村に来ました。", [
    { label: "酒と贈り物でもてなす", desc: "財↓ 田の記録が甘くなるかも", apply: (st) => { adj(st, { w: -0.6 * sc(st) }); if (R() < 0.7) { adj(st, { w: 0.9 * sc(st) }); return ["もてなしました。田の広さは、なぜか少なめに記録されました。"]; } return ["もてなしました。検田使は酒だけ飲んで、田はきっちり測っていきました。"]; } },
    { label: "正直に申告する", desc: "財↓ 何も起きない", apply: (st) => { adj(st, { w: -0.5 * sc(st), toku: 1 }); return ["正直に申告しました。正直者は、きっちり課税されました。"]; } },
    { label: "一部の田を隠す", desc: "うまくいけば財↑ ばれたら大変", apply: (st) => { if (R() < 0.6) { adj(st, { w: 0.8 * sc(st) }); return ["田を隠し通しました。隠した田の米は、格別の味がしました。"]; } adj(st, { w: -1.5 * sc(st), hp: -8 }); return ["ばれました。罰として、笞（むち）で打たれました。"]; } }
  ], "国司の検田使と検田帳（佐藤泰弘『史林』75巻5号の研究）") },
  { id: "mizu", when: (s) => s.st === "nomin" || s.st === "gozoku", build: (s) => ev("水争い", "日照りが続き、隣の家と田の水をめぐって揉めています。", [
    { label: "水を譲る", desc: "縁↑ 財↓", apply: (st) => { adj(st, { en: 4, w: -0.5 * sc(st) }); return ["水を譲りました。隣の家の稲はよく育ちました。あなたの稲は、それなりでした。"]; } },
    { label: "夜中にこっそり水を引く", desc: "財↑ 縁↓ 喧嘩になるかも", apply: (st) => { adj(st, { w: 0.6 * sc(st), en: -4 }); if (R() < 0.3) { adj(st, { hp: -8 }); return ["水を引きました。翌朝ばれて、鍬を持った隣人と殴り合いになりました。"]; } return ["こっそり水を引きました。隣の家は、まだ気づいていません。"]; } },
    { label: "刀禰（とね）に裁いてもらう", desc: "結果は刀禰しだい", apply: (st) => { if (R() < 0.5) { adj(st, { en: 1, w: 0.3 * sc(st) }); return ["村の刀禰は、あなたの言い分を認めました。日ごろの付け届けのおかげです。"]; } adj(st, { w: -0.3 * sc(st) }); return ["刀禰は隣の家の言い分を認めました。隣の家の付け届けのほうが多かったようです。"]; } }
  ], "藤原明衡『新猿楽記』（田堵の堰・用水の管理）") },
  { id: "tabiso", when: () => true, build: (s) => ev("旅の僧", "日暮れどき、粗末な身なりの僧が一夜の宿と食べ物を求めてきました。", [
    { label: "泊めて食べさせる", desc: "徳↑ 財↓", apply: (st) => { adj(st, { toku: 5, w: -0.2 }); return ["泊めてあげました。『日本霊異記』には、乞食の僧を打った男が罰を受ける話がいくつもあります。念のためです。"]; } },
    { label: "追い返す", desc: "徳↓", apply: (st) => { adj(st, { toku: -3 }); return ["追い返しました。その晩、少しだけ悪い夢を見ました。"]; } }
  ], "『日本霊異記』下巻第15縁・第33縁（乞食の僧を打った者の報い）") },
  { id: "shoen", once: true, when: (s) => (s.st === "nomin" || s.st === "gozoku") && s.year >= 1000 && !s.flags.kishin, build: (s) => ev("荘園への誘い", "近くの荘園の荘官が、「うちの荘園の寄人（よりうど）にならないか」と誘ってきました。", [
    { label: "荘園の寄人になる", desc: "国司の取り立てを避けられる。年貢は荘園へ", apply: (st) => { st.flags.kishin = 1; return ["荘園の寄人になりました。国司の代わりに、荘園の領主へ年貢を納めます。払う相手が変わっただけ、とも言います。"]; } },
    { label: "断る", desc: "国の公民のままでいる", apply: () => ["断りました。国司は、課役を負う公民が減って困っているそうです。"] }
  ], "延喜2年（902）の荘園整理令（『類聚三代格』）ほか") },
  { id: "kanbyo", when: () => true, build: (s) => ev("隣家の病人", "隣の家で、ひどい熱の病人が出ました。看病の手が足りないようです。", [
    { label: "看病する", desc: "徳↑↑ 縁↑ うつるかも", apply: (st) => { adj(st, { toku: 6, en: 4 }); addRisk(st, 0.04, "看病でうつった熱病", "隣の家の病人は、助かりました。"); return ["看病しました。"]; } },
    { label: "穢れを避けて近づかない", desc: "徳↓", apply: (st) => { adj(st, { toku: -3, en: -2 }); return ["近づきませんでした。人の死の穢れに触れると、三十日のあいだ忌み慎まねばなりません。賢い判断ですが、近所の目は冷たくなりました。"]; } }
  ], "『延喜式』巻3 臨時祭式（触穢の規定）") },
  { id: "matsuri", block: ["famine", "epidemic", "war", "disaster"], when: (s) => s.st !== "furo" && s.year >= 1000, build: (s) => ev("田楽", "村の田植えで、田楽を舞う役を頼まれました。", [
    { label: "舞う", desc: "縁↑↑", apply: (st) => { adj(st, { en: 5, hp: -1 }); return ["腰鼓を打って舞いました。翌年も頼まれることが、その場で決まりました。"]; } },
    { label: "見物だけする", desc: "縁↑", apply: (st) => { adj(st, { en: 1 }); return ["見物だけしました。"]; } },
    { label: "酒を飲みすぎる", desc: "縁↑ 体↓", apply: (st) => { adj(st, { en: 3, hp: -3 }); return ["酒を飲みすぎました。翌日の記憶がありません。村の全員が覚えています。"]; } }
  ], "『栄花物語』巻十九「御裳着」（田植えの田楽）") },
  { id: "suiko", when: (s) => (s.st === "nomin" || s.st === "gyomin") && s.year < 1000, build: (s) => ev("出挙の稲", "春、国府の使いが出挙（すいこ）の稲を貸し付けに来ました。秋に利息をつけて返す決まりです。", [
    { label: "借りる", desc: "今は財↑ 利息は年3割", apply: (st) => { adj(st, { w: 1 }); st.flags.suikoDebt = (st.flags.suikoDebt || 0) + 1.3; return ["稲を借りました。秋には、三割の利息をつけて返します。"]; } },
    { label: "断る", desc: "断れるとは限らない", apply: (st) => { if (R() < 0.6) { adj(st, { w: 1 }); st.flags.suikoDebt = (st.flags.suikoDebt || 0) + 1.3; return ["断りましたが、国府の使いは聞き入れませんでした。出挙の利息は、国府の大事な収入なのです。"]; } return ["今年はなんとか断れました。"]; } }
  ], "『養老令』雑令／弘仁元年（810）以降、公出挙の利率は3割／村井康彦（『史林』）の研究（出挙利稲は国衙の主要な収入）") },
  { id: "kitsune", when: () => true, build: (s) => ev("罠にかかった狐", "仕掛けた罠に、狐がかかっていました。", [
    { label: "逃がしてやる", desc: "徳↑", apply: (st) => { adj(st, { toku: 3 }); return ["逃がしてやりました。狐は一度だけ振り返りました。昔話なら、このあと美しい娘が訪ねてきます。"]; } },
    { label: "皮を売る", desc: "財↑ 徳↓", apply: (st) => { adj(st, { w: 0.5, toku: -2 }); return ["皮を売りました。いい値がつきました。"]; } }
  ], "『日本霊異記』上巻第二縁（狐を妻とする話）") },
  { id: "unkyaku", when: (s) => s.st === "nomin" && s.sex === "m" && s.year < 960 && s.age < 50, build: (s) => ev("調を都へ運ぶ", "調・庸（布や特産物で納める税）を都まで背負って運ぶ運脚の番が回ってきました。往復の食料は、出す側の負担とされています。", [
    { label: "自分で運ぶ", desc: "体↓ 都が見られる 帰り道が危ない", apply: (st) => { adj(st, { hp: -6, en: 2 }); addRisk(st, 0.02, "運脚の帰り道", "食料が尽きたのは、故郷まであと三日のところでした。"); return ["調を背負って都まで運びました。朱雀大路の広さに驚きました。"]; } },
    { label: "米を払って代わりの者に頼む", desc: "財↓", apply: (st) => { adj(st, { w: -1.2 }); return ["米を払って、代わりの者に運ばせました。"]; } }
  ], "『養老令』賦役令／『続日本紀』和銅5年正月条（帰路に飢える役民）") },
  { id: "kaikon", once: true, block: ["famine", "war", "disaster"], when: (s) => s.st === "nomin", build: (s) => ev("荒れ地の開墾", "村はずれの荒れ地を、村の皆で開こうという話が持ち上がりました。", [
    { label: "加わる", desc: "体↓ 以後ずっと財↑", apply: (st) => { adj(st, { hp: -5, en: 2 }); st.flags.konden = (st.flags.konden || 0) + 0.15; return ["開墾に加わりました。手のひらの皮が三回むけたころ、新しい田ができました。"]; } },
    { label: "加わらない", desc: "縁↓", apply: (st) => { adj(st, { en: -3 }); return ["加わりませんでした。新しい田の分け前の話には、呼ばれませんでした。"]; } }
  ], "墾田永年私財法（『続日本紀』天平15年）") },
  { id: "ichi", block: ["war"], when: (s) => s.st !== "kyomin", build: (s) => ev("国府の市", "麻布と塩を交換しに、国府の近くの市まで行こうか迷っています。", [
    { label: "市へ行く", desc: "財が増えるか減るか", apply: (st) => { const g = rnd(-0.5, 0.9); adj(st, { w: g, en: 1 }); return [g >= 0 ? "市で、いい取引ができました。" : "市で、よく分からない壺を買わされました。"]; } },
    { label: "行かない", desc: "変化なし", apply: () => ["行きませんでした。"] }
  ], "『日本霊異記』（深津市・軽市などの市の話）") },
  { id: "fune", when: (s) => s.st === "gyomin" && s.region === "kyushu", build: (s) => ev("沖の大船", "博多の沖に、大きな唐船が見えます。", [
    { label: "舟を出して近づく", desc: "取引できれば儲け", apply: (st) => { if (R() < 0.6) { adj(st, { w: 1.5 }); return [merchant(st.year) + "の船でした。魚と引き換えに、珍しい陶器をもらいました。役所に知られたら、たぶん怒られます。"]; } adj(st, { w: -0.3 }); return [st.year < 1047 ? "近づきすぎて、大宰府の役人に追い払われました。交易は、鴻臚館を通すのが決まりです。" : "近づきすぎて、博多の役人に追い払われました。"]; } },
    { label: "浜から眺める", desc: "何もしない", apply: () => ["浜から眺めました。あの船の荷は、都の貴族の「唐物」になるそうです。"] }
  ], "大宰府鴻臚館と博多の交易（福岡市の発掘調査報告ほか）") },
  { id: "kaizoku", when: (s) => s.st === "gyomin" && s.region === "saigoku", build: (s) => ev("海賊の噂", "瀬戸内に海賊が出ると噂です。明日は遠くの漁場まで出る予定でした。", [
    { label: "予定どおり舟を出す", desc: "財↑ 危険", apply: (st) => { adj(st, { w: 0.8 }); addRisk(st, 0.04, "海賊に襲われて", "見慣れない舟が、島陰から出てきました。"); return ["舟を出しました。"]; } },
    { label: "しばらく近くの浜で漁をする", desc: "財↓", apply: (st) => { adj(st, { w: -0.3 }); return ["近場で漁をしました。獲れたのは小魚ばかりでした。"]; } }
  ], "『日本紀略』承平6年6月条（海賊の記事）") },
  { id: "shio", when: (s) => s.st === "gyomin", build: (s) => ev("塩焼き", "浜で塩を焼く仕事を手伝わないかと誘われました。", [
    { label: "手伝う", desc: "財↑ 体↓", apply: (st) => { adj(st, { w: 0.8, hp: -3 }); return ["海水を煮詰めて、塩を焼きました。煙が目にしみました。"]; } },
    { label: "断る", desc: "変化なし", apply: () => ["断りました。"] }
  ], "『延喜式』主計上（若狭国の調の塩など）") },
  { id: "rajomon", once: true, when: (s) => s.region === "kyo" && s.year < 980, build: (s) => ev("羅城門の噂", "荒れ果てた羅城門の楼上に、夜な夜な何かがいるという噂です。", [
    { label: "見に行く", desc: "怖いもの見たさ", apply: (st) => { adj(st, { toku: -1, en: 1 }); return ["楼上では、白髪の老婆が若い女の亡骸から髪を抜いていました。かつらにして売るのだそうです。"]; } },
    { label: "やめておく", desc: "近づかない", apply: () => ["やめておきました。賢明です。"] }
  ], "『今昔物語集』巻29第18話") },
  { id: "utage", block: ["famine", "epidemic"], when: (s) => s.region === "kyo", build: (s) => ev("屋敷の下働き", "貴族の屋敷で、大饗（宴）の下働きの人手を探しています。", [
    { label: "働きに行く", desc: "財↑", apply: (st) => { adj(st, { w: 0.6 }); return [R() < 0.4 ? "働きました。帰りに、宴の残りの唐菓子（からくだもの）をもらいました。" : "働きました。宴の間じゅう、庭で松明を持って立っていました。"]; } },
    { label: "行かない", desc: "変化なし", apply: () => ["行きませんでした。"] }
  ], "『和名類聚抄』（「八種唐菓子」の名が見える）") },
  { id: "mikkoku", when: (s) => s.region === "kyo", build: (s) => ev("検非違使の手先", "検非違使の手先（放免）が、盗人の居場所を教えれば褒美をやると言っています。心当たりがあります。", [
    { label: "教える", desc: "財↑ 縁↓ 恨まれるかも", apply: (st) => { adj(st, { w: 1, en: -3 }); addRisk(st, 0.02, "密告の報復", "夜道で、後ろから声をかけられました。"); return ["教えました。褒美の米は、思ったより少なめでした。"]; } },
    { label: "黙っている", desc: "変化なし", apply: () => ["黙っていました。この街では、それが長生きの秘訣です。"] }
  ], "検非違使の下部「放免」（倉本一宏の解説ほか）") }
];

/* ---------------- 1年の処理 ---------------- */
/* ---------------- 家計（世帯）と、財を元手にした稼ぎ ---------------- */
// 庶民は「働き手×1人あたりの稼ぎ − 食べる口」で収支を出す。幼い子が多い時期は赤字になりやすい
function household(s) {
  const home = s.children.filter(c => c.alive && !c.out && s.year - c.y >= 0);
  const spouse = s.married && s.spouseAlive && s.st !== "so" && s.st !== "eji";
  let workers = s.age >= 60 ? 0.5 : 1, mouths = 1;
  if (spouse) { workers += s.age >= 60 ? 0.5 : 1; mouths += 1; }
  for (const c of home) {
    const a = s.year - c.y;
    if (a < 10) mouths += 0.45;
    else if (a < 15) { mouths += 0.7; workers += 0.4; }
    else { mouths += 1; workers += 1; }
  }
  const small = home.filter(c => s.year - c.y < 15).length;
  let extra = 0;
  // 貴族は婿取り（妻方で子を育てる）が基本なので、子の養育費は母の側が多く負う
  if (isNoble(s)) extra = small * (s.sex === "f" ? 3 : 1.5);
  else if (s.st === "kanjin") extra = small * (s.sex === "f" ? 1.2 : 0.6);
  else if (s.st === "gozoku" || s.st === "bushi") extra = (spouse ? 1.5 : 0) + small * 0.8;
  return { workers, mouths, extra, size: 1 + (spouse ? 1 : 0) + home.length };
}
function investments(s, tags) {
  const bad = tags.has("famine") || tags.has("disaster") || tags.has("war");
  if (s.loans > 0) {
    s.wealth += s.loans * 0.2;
    if (R() < (bad ? 0.35 : 0.12)) {
      const loss = s.loans * rnd(0.2, 0.5); s.loans -= loss;
      log(s, bad ? "この年の災いで、稲を貸した家々が返せなくなりました。夜逃げした家もあります。" : "稲を貸した家が逃げ、貸した分の一部が戻りませんでした。", "bad");
    } else if (R() < 0.08) { adj(s, { en: -2 }); log(s, "利息の取り立てに回りました。隣人の目が、年々冷たくなっています。", "n"); }
  }
  if (s.flags.trade) {
    const t = s.flags.trade; s.flags.trade = 0;
    const back = t.amt * (bad ? rnd(0.2, 1.1) : rnd(0.4, 2.0));
    s.wealth += back;
    log(s, back >= t.amt ? t.ok + "（元手 " + fmtW(t.amt) + " 石 → " + fmtW(back) + " 石）" : t.ng + "（元手 " + fmtW(t.amt) + " 石 → " + fmtW(back) + " 石）", back >= t.amt ? "good" : "bad");
  }
  if (s.flags.guard > 0) s.flags.guard--;
  if (s.flags.shinbumi > 0) s.flags.shinbumi--;
}

function hpMult(s) { return clamp(1.6 - s.hp / 80, 0.45, 1.8); }

function prepareYear(s) {
  const a = s.age, q = s.queue;
  s.branchThisYear = false;
  const m = s.sex === "m";
  // 元服・裳着
  if (a === 12 && (isNoble(s) || s.st === "kanjin") && !s.flags.genpuku) { q.push(chGenpuku(s)); s.branchThisYear = true; }
  // 庶民の一人前
  if (a === 15 && ["nomin", "gyomin", "gozoku"].includes(s.st) && !s.flags.coming) { q.push(chComing(s)); s.branchThisYear = true; }
  // 政変
  for (const P of POLITICS) {
    if (P.y !== s.year || s.flags["pol_" + P.id] || !polAffected(s)) continue;
    if (polChoiceEligible(s)) { q.unshift(polChoice(s, P)); s.branchThisYear = true; }
    else if (s.age >= 6) polAuto(s, P);
  }
  // 源平
  if (s.year === 1180 && a >= 15 && a < 60 && !s.flags.genpei && m && (s.st === "bushi" || s.st === "gozoku")) { q.push(chGenpei(s)); s.branchThisYear = true; }
  if (!s.branchThisYear) {
    // 重病
    if (s.hp < 22 && s.st !== "so" && a >= 25 && !s.flags.sickAsked) { s.flags.sickAsked = 1; q.push(chSick(s)); s.branchThisYear = true; }
    // 借財
    else if (s.wealth < -4.5 && ["nomin", "gyomin", "kyomin"].includes(s.st) && a >= 15 && (s.flags.escAsked || 0) <= a - 5) { s.flags.escAsked = a; q.push(chEscape(s)); s.branchThisYear = true; }
    // 下人の逃亡
    else if (s.st === "genin" && a >= 14 && s.plan && s.plan.eff.escape && R() < s.plan.eff.escape) {
      q.push(branch(s, "人生の分岐点 ― 逃亡", "見張りが手薄な夜が来ました。今なら逃げられそうです。", [
        { label: "逃げる", desc: "成功すれば浮浪人。失敗すれば…", apply: (st) => {
          if (R() < 0.6) { st.st = "furo"; st.region = pick(["kinai", "togoku", "saigoku", "kyushu", "michinoku"].filter(r => r !== st.region)); return ["逃げ切りました。" + REGION[st.region] + "で、名前を変えて暮らし始めました。"]; }
          adj(st, { hp: -15 }); addRisk(st, 0.08, "逃亡に失敗して", "連れ戻され、ひどく打たれました。"); return ["捕まりました。"];
        } },
        { label: "やめておく", desc: "今夜は見送る", apply: () => ["やめておきました。明日も同じ朝が来ます。"] }
      ]));
      s.branchThisYear = true;
    }
    // 受領
    else if (isOfficial(s) && !(s.flags.exile > 0) && s.rank >= 9 && s.rank <= 13 && s.juryo === 0 && a >= 28 && (s.flags.juryoAsked || -99) <= a - (s.flags.shinbumi > 0 ? 3 : 8) && R() < 0.12 + s.en / 500 + (s.flags.inshin ? 0.12 : 0) + (s.flags.shinbumi > 0 ? 0.25 : 0) + (s.flags.juryoHouse ? 0.08 : 0)) { s.flags.juryoAsked = a; q.push(chJuryo(s)); s.branchThisYear = true; }
    // 結婚
    else if ((!s.married || (!s.spouseAlive && s.flags.widowedAt != null && a - s.flags.widowedAt >= 1)) && s.st !== "so" && a >= (s.sex === "f" ? 13 : 15) && a <= (s.marriages > 0 ? 48 : 40) && !s.kokumo && R() < marryChance(s)) { q.push(chMarry(s)); s.branchThisYear = true; }
    // 衛士の任期明け
    else if (s.st === "eji" && s.flags.ejiTerm <= 0) { q.push(chEjiEnd(s)); s.branchThisYear = true; }
    // 富豪の輩として成り上がる
    else if (s.st === "nomin" && a >= 20 && !s.flags.riseAsked && s.wealth >= 18 && ((s.loans || 0) >= 5 || s.flags.tato)) { s.flags.riseAsked = 1; q.push(chRise(s)); s.branchThisYear = true; }
    // 庶民の出来事（選択式）
    else if (a >= 14 && ["nomin", "gyomin", "kyomin", "gozoku", "furo", "eji", "bushi"].includes(s.st) && R() < 0.2) {
      const yt = yearTags(s);
      const pool = SMALL.filter(e => e.when(s) && !blocked(e, yt) && !(s.flags["ev_" + e.id] && e.once));
      if (pool.length) { const e = pick(pool); s.flags["ev_" + e.id] = (s.flags["ev_" + e.id] || 0) + 1; q.push(Object.assign({ kind: "event" }, e.build(s))); s.branchThisYear = true; }
    }
    // 晩年の出家
    else if (s.st !== "so" && a >= 50 && a % 5 === 2 && R() < 0.45) {
      q.push(branch(s, "人生の分岐点 ― 出家", "数えで" + (a + 1) + "。白髪も増え、来世のことを考えるようになりました。", [
        { label: "出家する", desc: "徳↑↑ 俗世の身分は手放す", apply: (st) => shukke(st, false) },
        { label: "まだ早い", desc: "俗世にとどまる", apply: () => ["まだ早いと思いました。この時代、それなりに遅い年齢です。"] }
      ]));
      s.branchThisYear = true;
    }
    // 連れ合いと死別後の出家
    else if (s.married && !s.spouseAlive && s.flags.lastLoss === "death" && s.st !== "so" && s.flags.widowedAt === a - 1 && a >= 30 && R() < 0.5) {
      q.push(branch(s, "人生の分岐点", "連れ合いの四十九日が明けました。", [
        { label: "出家して菩提を弔う", desc: "徳↑↑", apply: (st) => shukke(st, false) },
        { label: "俗世で生きていく", desc: "再婚もありうる", apply: (st) => ["俗世で生きていくことにしました。"] }
      ]));
      s.branchThisYear = true;
    }
  }
  // 過ごし方：初めて選べるようになったときと、選択肢の中身が変わったときだけ選ぶ（以後は画面下のボタン）
  q.push(() => planPrompt(s));
  // 節目：財の使い道
  if (isMilestone(a)) {
    if (a >= 15) q.push(() => (s.st !== "genin" && !(s.st === "so" && s.flags.shido && s.wealth < 1)) ? { kind: "spend", title: "財の使い道", lead: "手元の財は " + fmtW(s.wealth) + " 石ほど。どう使いますか。", options: spendFor(s) } : null);
  }
}

function marryChance(s) {
  let p = 0.12 + s.en / 400 + (s.plan && s.plan.eff.marry ? s.plan.eff.marry : 0);
  if (s.flags.wantMarry) p += 0.15;
  if (s.marriages > 0) p *= 0.85;
  if (s.age > 30) p *= 0.6;
  if (s.st === "genin") p = 0.1;
  return clamp(p, 0, 0.7);
}

function runYear(s) {
  s.risks = s.risks || [];
  nameMilestones(s);
  ensurePlan(s);
  const a = s.age, e = (s.plan && s.plan.eff) || {};
  const before = { hp: s.hp, sai: s.sai, en: s.en, toku: s.toku };

  // 過ごし方の効果
  if (s.plan && a >= 3) {
    adj(s, { hp: e.hp || 0, sai: e.sai || 0, en: e.en || 0, toku: e.toku || 0 });
    if (e.risk) addRisk(s, e.risk, e.riskC, e.riskD);
    if (e.nyobo && s.sex === "f" && !s.flags.nyobo && R() < 0.25 + s.en / 200 + (s.flags.wantNyobo ? 0.2 : 0)) { s.flags.nyobo = 1; nameMilestones(s); log(s, "女房として宮中に出仕することになりました。「" + s.nm.nyobo + "」と呼ばれます。父や夫の官職からつけられる女房名です。本名で呼ばれることは、もうありません。", "good", "Wikipedia「女房名」"); }
    if (e.free && R() < e.free) { s.st = "nomin"; s.wealth = 0; log(s, "長年の働きを認められ、主人から解放されました。今日からは、税を払う側です。", "good"); }
    if (e.bu && s.sex === "m" && s.st === "gozoku" && s.year >= 900 && R() < 0.06) { s.st = "bushi"; log(s, "一族を率いる武士として、名が知られるようになりました。", "good"); }
  }

  // 経済
  const d2 = STATUS[s.st];
  const hh = household(s);
  const ecoTags = yearTags(s);
  let inc, up;
  const hhMode = !!(d2.wpw && s.age >= 15);
  const tMul = s.tier && s.st === s.birthStatus ? s.tier.inc : 1;
  if (hhMode) { inc = d2.wpw * tMul * hh.workers * rnd(0.75, 1.25); up = hh.mouths; }
  else { inc = d2.income * tMul * rnd(0.75, 1.25); up = d2.upkeep + hh.extra; }
  if (s.st === "bushi" && s.flags.rodo) { inc = 8 * rnd(0.75, 1.25); up = 6 + hh.extra; }
  if (s.st === "so" && s.flags.nobleMonk) inc = 35 * rnd(0.8, 1.2);
  if (s.st === "kouzoku" && !s.flags.shisei && s.sex === "m") inc = d2.income;
  if (isOfficial(s)) inc += rankIncome(s.rank);
  if (s.juryo > 0) inc += 150 * rnd(0.5, 1.5);
  if (s.flags.ox) inc += 0.6;
  if (s.flags.tools) inc += 0.35;
  if (s.flags.tato) inc += ecoTags.has("famine") || ecoTags.has("disaster") ? -0.8 : 0.9;
  if (s.flags.konden) inc += 3 * s.flags.konden;
  if (s.flags.nyobo) inc += 6;
  if (e.inc) inc *= (1 + e.inc);
  if (e.gamble) inc *= rnd(0.3, 2.0);
  if (s.st === "so" && s.flags.nobleMonk) up = 22;
  if (s.juryo > 0) up += 60;
  if (s.flags.kishin) inc *= 0.85;
  if (s.flags.exile > 0) inc *= 0.3;
  s.wealth += inc - up;
  investments(s, ecoTags);
  if (s.flags.suikoDebt) { s.wealth -= s.flags.suikoDebt; s.flags.suikoDebt = 0; }
  // 出挙（借りの利息）
  if (s.wealth < 0 && s.st !== "genin") {
    if (!s.flags.suiko) { s.flags.suiko = 1; log(s, "食べる米が尽き、国府から稲を借りました（出挙）。利息は年3割です。", "bad", "『養老令』雑令／弘仁元年（810）以降の公出挙の利率"); }
    s.wealth = Math.max(s.wealth * 1.3, -25 * sc(s));
    if (s.wealth < -1) adj(s, { hp: -2 });
  }
  if (s.st === "genin") s.wealth = 0;

  // 衛士の任期
  if (s.st === "eji" && s.flags.ejiTerm > 0) s.flags.ejiTerm--;
  // 受領の任期
  if (s.juryo > 0) {
    if (R() < 0.07) { adj(s, { en: -8 }); s.juryo = 0; log(s, "任国の郡司と百姓に、苛政を朝廷へ訴えられました。任期途中で解任です。蓄えた財は、そのまま持ち帰りました。", "bad", "『尾張国郡司百姓等解文』"); }
    else { s.juryo--; if (s.juryo === 0) log(s, "受領の任期を終えて帰京しました。行きは牛車一台、帰りは荷車が十数台でした。", "good"); }
  }

  // 史実
  s.ytags = yearTags(s);
  for (const h of HIST) {
    if (!histMatch(h, s)) continue;
    if (h.t) log(s, h.t, h.k || "hist", h.src);
    if (h.epi) epidemic(s, h.epi);
    if (h.fx) h.fx(s);
    if (s.forceDeath) break;
  }
  // 郎党の戦（その土地で戦乱がある年）
  if (s.st === "bushi" && s.flags.rodo && s.ytags.has("war") && !s.forceDeath) {
    addRisk(s, 0.06, "主人の戦で討たれて", "郎党は、主人より先に前へ出るものでした。");
    if (R() < 0.3) { s.flags.rodo = 0; s.flags.rodoUp = 1; adj(s, { en: 8, w: 6 }); log(s, "戦で手柄を立て、主人からわずかな所領を与えられました。郎党から、一人前の武士になりました。", "good", "『今昔物語集』巻25「本朝付世俗」（武士の説話）"); }
    else log(s, "主人に従って戦に出ました。生きて帰れただけで十分です。", "bad", "『将門記』（従者とは別に味方として加わる「伴類」）");
  }
  // 政変の決着
  if (!s.forceDeath) for (const P of POLITICS) if (P.y === s.year) polResolve(s, P);
  if (s.year === 1185 && s.flags.polLater_jisho && !s.flags.jishoDone) {
    s.flags.jishoDone = 1;
    log(s, "平家が滅びました。平時忠ら平家に近かった人々が、流罪と決まりました。", "hist", "『吾妻鏡』文治元年5月20日条");
    if (isOfficial(s) && !(s.flags.exile > 0) && R() < 0.5) exile(s, 3 + Math.floor(R() * 4), "平家への与同");
    else adj(s, { en: -10 });
  }
  // 流罪からの赦免
  if (s.flags.exile > 0 && !s.forceDeath) {
    s.flags.exile--;
    if (s.flags.exile === 0) { s.region = "kyo"; adj(s, { en: 4 }); log(s, "罪を赦されて、都に戻ることを許されました。", "good"); }
  }
  // 源平合戦
  if (s.flags.genpei && s.year >= 1180 && s.year <= 1185 && !s.forceDeath) {
    const g = s.flags.genpei;
    if (g !== "mi") addRisk(s, (s.plan && s.plan.eff.war ? 0.05 : 0.08), "治承・寿永の乱", g === "heike" ? "富士川で水鳥の羽音に驚いて逃げた側でした。逃げきれませんでした。" : "倶利伽羅峠か、一ノ谷か。どこで倒れたのか、記録には残っていません。");
    if (s.year === 1185) {
      if (g === "heike") { log(s, "平家が壇ノ浦で滅びました。あなたは、負けた側です。", "bad"); addRisk(s, 0.45, "壇ノ浦の戦い", "平家の人々とともに、海に沈みました。"); s.flags.genpei = "lost"; }
      else if (g === "genji") { log(s, "平家が壇ノ浦で滅びました。あなたは勝った側です。恩賞として、新しい所領の地頭に任じられました。", "good"); adj(s, { en: 15, w: 30 }); s.flags.jito = 1; s.flags.genpei = "won"; }
      else { log(s, "平家が壇ノ浦で滅びました。勝った側に「最初から源氏の味方でした」と挨拶しに行きました。", "n"); s.flags.genpei = "mi2"; }
    }
  }
  if (s.flags.jito) s.wealth += 4;

  // ランダムイベント
  if (!s.forceDeath) {
    let n = 0;
    for (const ev of shuffle(EVENTS)) {
      if (n >= 2) break;
      if (!ev.when(s) || blocked(ev, s.ytags)) continue;
      if (R() < ev.p) { const b = s.yearLogs.length; ev.fx(s); n++; if (ev.tag) s.ytags.add(ev.tag); if (ev.src) for (let i = b; i < s.yearLogs.length; i++) if (!s.yearLogs[i].src) s.yearLogs[i].src = ev.src; }
    }
  }

  // 出世（除目）
  if (isOfficial(s) && s.age >= 15 && !s.forceDeath && !(s.flags.exile > 0)) promote(s);

  // 家族
  family(s);

  // 加齢
  if (a >= 40) adj(s, { hp: -0.6 });
  if (a >= 55) adj(s, { hp: -0.8 });
  if (a >= 65) adj(s, { hp: -1.2 });
  if (s.wealth > 5 * sc(s) && a >= 5) adj(s, { hp: 0.4 });
  if (s.hp < 45 && a < 50) adj(s, { hp: 0.8 });

  // 死亡判定
  let dead = null;
  if (s.forceDeath) dead = s.forceDeath;
  if (!dead && s.hp <= 0) addRisk(s, 0.3, "衰弱", "体が、もう持ちませんでした。");
  if (!dead) {
    const h = baseHazard(a) * STATUS[s.st].haz * hpMult(s) * (s.flags.abata ? 0.97 : 1);
    const all = shuffle([{ p: h, cause: null }].concat(s.risks));
    for (const r of all) {
      if (R() < r.p) {
        if (!r.cause) { const nc = naturalCause(s); dead = { cause: nc.c, desc: nc.d }; }
        else dead = { cause: r.cause, desc: r.desc };
        break;
      }
    }
  }
  if (dead) {
    s.alive = false; s.cause = dead.cause; s.causeDesc = dead.desc;
    log(s, "数えで" + (a + 1) + "、" + dead.cause + "により死去。", "death");
  }
  s.risks = [];
  s.delta = { hp: s.hp - before.hp, sai: s.sai - before.sai, en: s.en - before.en, toku: s.toku - before.toku };
}

function promote(s) {
  const cap = rankCap(s);
  if (s.st === "kouzoku" && !s.flags.shisei) return;
  const e = (s.plan && s.plan.eff) || {};
  let p = 0.1 + (s.en + s.sai) / 900 + (e.promo || 0) + (s.flags.daigaku ? 0.03 : 0);
  if (s.birthStatus === "kanjin" && s.rank >= 8) p *= 0.08;
  if (s.birthStatus === "kizoku" && s.rank >= 12) p *= 0.15;
  if (s.rank >= 14) p *= 0.45;
  if (s.rank >= cap) p = 0;
  if (R() < clamp(p, 0, 0.6)) {
    s.rank++;
    if (s.rank === 9) log(s, "ついに従五位下に叙されました。ここからが「貴族」です。殿上への道が開けました。", "good");
    else if (s.rank === 14) log(s, RANKS[s.rank] + "に叙され、公卿の仲間入りを果たしました。毎年の公卿の名簿『公卿補任』に、あなたの名が載ります。", "good");
    else log(s, "除目で" + RANKS[s.rank] + "に昇進しました。", "good");
  } else if (R() < 0.06) {
    if (s.birthStatus === "kanjin" && s.rank >= 8) log(s, "五位の壁です。ここから上は、実力ではなく家柄で決まります。", "bad");
    else log(s, "除目で、今年も望んだ官職にありつけませんでした。清少納言が「すさまじきもの（興ざめなもの）」に挙げた家の様子そのものです。", "bad", "『枕草子』すさまじきもの");
  }
}

function family(s) {
  // 配偶者
  if (s.married && s.spouseAlive) {
    if (R() < 0.022 + (s.age > 45 ? 0.02 : 0)) {
      s.spouseAlive = false; s.flags.widowedAt = s.age; s.flags.lastLoss = "death"; s.flags.spouseDeaths = (s.flags.spouseDeaths || 0) + 1;
      log(s, (s.sex === "m" ? "妻" : "夫") + "の「" + spouseName(s) + "」が亡くなりました。", "bad"); adj(s, { hp: -3 });
    } else if (s.age < 45 && s.st !== "genin" && R() < 0.014) {
      s.spouseAlive = false; s.flags.widowedAt = s.age; s.flags.lastLoss = "divorce";
      const noble = isNoble(s) || s.st === "kanjin";
      log(s, noble ? (s.sex === "f" ? "夫が通ってこなくなりました。この時代、それがそのまま離婚です。" : "妻の家から、もう通ってこなくてよいと言われました。離婚です。") : "連れ合いが、別の村の誰かのところへ行ってしまいました。", "bad");
      adj(s, { en: -2 });
    } else {
      // 出産
      const fertile = s.sex === "f" ? (s.age >= 14 && s.age <= 42) : (s.age >= 16 && s.age <= 60);
      if (fertile && s.children.length < 12 && R() < (s.st === "so" ? 0 : 0.27)) {
        const sex = R() < 0.5 ? "m" : "f";
        const cSt = s.st === "bushi" || s.st === "eji" || s.st === "furo" ? "nomin" : (s.st === "kouzoku" ? "kugyo" : s.st);
        const fatherNm = s.sex === "m" ? s.nm : (s.spouse && s.spouse.nm);
        const order = s.children.filter(c => c.sex === "f").length;
        const used = s.children.map(c => c.nm && (c.nm.child || c.nm.given || c.nm.call)).filter(Boolean).concat([s.nm && s.nm.given, s.spouse && s.spouse.nm && s.spouse.nm.given].filter(Boolean));
        const cnm = makeName(cSt, sex, s.year, s.region, { uji: fatherNm && fatherNm.uji, tsuji: fatherNm && (fatherNm.tsuji || (fatherNm.adult || fatherNm.given || "")[0]), call: NM.kimiOrd[Math.min(order, 9)], avoid: used });
        if (fatherNm && fatherNm.uji && cnm.uji !== undefined && cSt !== "genin") cnm.uji = fatherNm.uji;
        s.children.push({ y: s.year, sex, alive: true, nm: cnm });
        const n = s.children.length;
        const cName = "名は「" + nameOf(cnm, 0, sex) + "」。";
        if (s.sex === "f") {
          log(s, kanjiNum(n) + "人目の子（" + (sex === "m" ? "男" : "女") + "）を産みました。" + cName, "good");
          if (R() < 0.016 * hpMult(s)) addRisk(s, 1, "お産（産褥）", "産屋では僧たちが物の怪を祓う読経を続けていました。祓うべきものは、別のところにありました。");
          adj(s, { hp: -2 });
        } else {
          log(s, kanjiNum(n) + "人目の子（" + (sex === "m" ? "男" : "女") + "）が生まれました。" + cName, "good");
          if (R() < 0.016) { s.spouseAlive = false; s.flags.widowedAt = s.age; s.flags.lastLoss = "death"; s.flags.spouseDeaths = (s.flags.spouseDeaths || 0) + 1; log(s, "妻の「" + spouseName(s) + "」は、お産のあと、そのまま亡くなりました。", "bad"); }
        }
      }
    }
  }
  // 子どもの生死
  s.children.forEach((c, i) => {
    if (!c.alive) return;
    const ca = s.year - c.y;
    if (ca <= 0) return;
    if (R() < baseHazard(ca) * 0.95 * (STATUS[s.st].haz || 1)) {
      c.alive = false; c.dieAge = ca;
      log(s, kanjiNum(i + 1) + "人目の子「" + childName(c, s.year) + "」が、数えで" + kazoe(ca + 1) + "で亡くなりました。", "bad");
      adj(s, { hp: -2 });
    }
  });
  // 貴族・官人の男の子の元服（実名を名乗る）
  s.children.forEach((c, i) => {
    if (!c.alive || c.sex !== "m" || !c.nm || c.nm.adult || c.nm.given || !c.nm.tsuji) return;
    if (s.year - c.y >= 13) {
      const old = c.nm.child;
      const usedA = s.children.map(x => x.nm && x.nm.adult).filter(Boolean);
      let ad = twoChars(s.st === "kanjin" ? NM.newChars : NM.sekkan, c.nm.tsuji), g = 0;
      while (usedA.includes(ad) && g++ < 12) ad = twoChars(s.st === "kanjin" ? NM.newChars : NM.sekkan, c.nm.tsuji);
      c.nm.adult = ad;
      log(s, kanjiNum(i + 1) + "人目の子「" + old + "」が元服し、「" + (c.nm.uji ? c.nm.uji + " " : "") + c.nm.adult + "」と名乗りました。", "good");
    }
  });
  // 跡取りと、子の独立
  if (s.st !== "so" && s.st !== "genin") {
    const grown = s.children.filter(c => c.alive && !c.out && s.year - c.y >= 15);
    if (grown.length && !s.children.some(c => c.alive && c.heir)) {
      const h = grown.find(c => c.sex === (isNoble(s) || s.st === "kanjin" ? "m" : "m")) || grown[0];
      h.heir = 1;
      const n = s.children.indexOf(h) + 1;
      if (!isNoble(s)) log(s, kanjiNum(n) + "人目の子「" + childName(h, s.year) + "」を跡取りと決めました。家に残って、一緒に働きます。", "n");
    }
    s.children.forEach((c, i) => {
      if (!c.alive || c.out || c.heir) return;
      const ca = s.year - c.y;
      if (ca >= 16 && R() < 0.25) {
        c.out = 1;
        const noble = isNoble(s) || s.st === "kanjin";
        log(s, kanjiNum(i + 1) + "人目の子「" + childName(c, s.year) + "」が" + (noble ? (c.sex === "m" ? "、婿として妻の家に通うようになり、手を離れました。" : "、婿を迎えて自分の対屋で暮らし始めました。") : "独立して、自分の所帯を持ちました。食べる口が一つ減りました。"), "n");
      }
    });
  }
}

/* ---------------- 進行 API ---------------- */
// 戻り値: {choice} | {logs, dead}
function headChoice(s) {
  while (s.queue.length) {
    if (typeof s.queue[0] === "function") s.queue[0] = s.queue[0]();
    if (s.queue[0]) return s.queue[0];
    s.queue.shift();
  }
  return null;
}
function advance(s) {
  if (!s.alive) return { dead: true, logs: [] };
  let c = headChoice(s);
  if (c) return { choice: c };
  if (!s.prepared) {
    s.prepared = true;
    prepareYear(s);
    c = headChoice(s);
    if (c) return { choice: c };
  }
  s.yearLogs = s.pendingLogs || [];
  s.pendingLogs = [];
  runYear(s);
  const logs = s.yearLogs;
  s.logs.push(...logs);
  s.yearLogs = [];
  const res = { logs, dead: !s.alive, age: s.age, year: s.year, delta: s.delta };
  if (s.alive) { s.age++; s.year++; s.prepared = false; }
  return res;
}
function choose(s, idx) {
  const c = s.queue.shift();
  if (!c) return [];
  const o = c.options[idx];
  if (!o || o.disabled) { s.queue.unshift(c); return null; }
  const lines = o.apply(s) || [];
  const src = o.src || c.src;
  s.pendingLogs = (s.pendingLogs || []).concat(lines.map((t, i) => ({ age: s.age, year: s.year, t, k: "choice", src: i === lines.length - 1 ? src : undefined })));
  return lines;
}

/* ---------------- 最期のまとめ ---------------- */
const JISEI = {
  generic: "露の身を　つゆとも知らで　ながらへて　消ゆるきはにぞ　露と知りける",
  epi: "はやりやみ　都も鄙も　わかずして　わが名ばかりは　はやらざりけり",
  poor: "米二石　ためしことなき　わが一生　租は払ひきて　死ぬるばかりぞ",
  wall: "五位の壁　越えむとすれど　越えかねて　たてし梯子は　棺とぞなる",
  mononoke: "物の怪の　しわざと言ひて　祓へども　まことの敵は　薬師なかりき",
  long: "数へれば　知る人みなを　見送りて　われ一人のみ　米を食みけり",
  rich: "倒れても　土をつかみし　この手には　極楽までは　持ちてゆかれじ",
  monk: "末の世に　仏の御名を　唱へども　届くか否か　知るよしもなし",
  love: "通ひ路の　絶えて久しき　わが宿に　来るは迎への　雲ばかりなり",
  war: "弓取りの　名を上げむとて　出でしかど　上がりしものは　首ばかりなり",
  nameless: "戸籍にも　名を残さずて　去る身なり　浮世の帳に　墨ひとつなし"
};
function jisei(s) {
  if (s.age < 12) return null;
  const c = s.cause || "";
  if (/乱|合戦|戦い|討たれ|強訴|所領/.test(c)) return JISEI.war;
  if (s.st === "so") return JISEI.monk;
  if (/疱瘡|疫病|はしか/.test(c)) return JISEI.epi;
  if (/物の怪|祟り/.test(c)) return JISEI.mononoke;
  if (s.age >= 65) return JISEI.long;
  if (s.flags.juryoEver || s.wealth > 500) return JISEI.rich;
  if (s.birthStatus === "kanjin" && s.rank === 8) return JISEI.wall;
  if (s.st === "genin" || s.st === "furo") return JISEI.nameless;
  if (s.sex === "f" && isNoble(s) && s.married) return JISEI.love;
  if (isCommoner(s) || /飢え/.test(c)) return JISEI.poor;
  return JISEI.generic;
}
function ojo(s) {
  let sc = s.toku + (s.st === "so" ? 15 : 0) + (s.flags.rinju ? 10 : 0) + rnd(-12, 12);
  if (s.age < 12) return { k: "rinne", t: "六道輪廻", d: "幼くして亡くなった子は、賽の河原で石を積むと言われます。ただしこの話が広まるのは、もう少し後の時代です。" };
  if (sc >= 58) return { k: "gokuraku", t: "極楽往生", d: "臨終のとき、紫の雲がたなびき、空から音楽が聞こえたと周囲が言い張りました。往生伝によくある話です。" };
  if (sc >= 22) return { k: "rinne", t: "六道輪廻", d: "たぶん、また人間に生まれます。次も平安時代かもしれません。" };
  return { k: "jigoku", t: "地獄行き", d: "『往生要集』によれば、等活地獄の寿命は五百歳。ただし地獄の一日は、人間の年に直すと気が遠くなるほど長いそうです。" };
}
function epithet(s) {
  const a = s.age + 1;
  const sx = s.sex === "m" ? "男" : "女";
  if (s.age < 5) return "数えで" + kazoe(a) + "の、名もなき幼子";
  if (s.age < 14) return "数えで" + kazoe(a) + "で逝った" + STATUS[s.birthStatus].name + "の" + (s.sex === "m" ? "息子" : "娘");
  if (s.kokumo) return "天皇の母となった姫君";
  if (s.gaiseki) return "天皇の外祖父";
  if (s.flags.genpei === "lost") return "壇ノ浦に沈んだ平家方";
  if (s.flags.jito) return "勝ち馬に乗った鎌倉の地頭";
  if (s.rank >= 14 && s.st !== "so") return "公卿まで上り詰めた人";
  if (s.flags.juryoEver && s.wealth > 300) return "倒れても土をつかんだ受領";
  if (s.st === "so") return (s.flags.shido ? "税から逃げた私度" : "仏にすがった") + (s.sex === "m" ? "僧" : "尼");
  if (s.flags.exiledEver && s.rank >= 9) return (s.flags.exileWhy || "政変") + "に敗れた貴族";
  if (s.flags.risen) return "富を元手に成り上がった豪族";
  if (s.flags.rodoUp) return "郎党から身を起こした武士";
  if (s.st === "bushi" && s.flags.rodo) return "主人の戦に生きた郎党";
  if (s.flags.ejiEver && s.st !== "so") return "都の篝火を見た衛士";
  if ((s.loans || 0) >= 10) return "利息で肥えた富豪の輩";
  if (s.st === "furo") return "戸籍を捨てた浮浪人";
  if (s.st === "genin") return "名を残さなかった下人";
  if (s.birthStatus === "kanjin" && s.rank === 8) return "五位の壁に阻まれた官人";
  if (s.flags.nyobo) return "本名の残らなかった女房";
  if (s.st === "bushi") return "時代を先取りした武士";
  const kids = s.children.length;
  if (kids >= 7) return "子だくさんの" + STATUS[s.st].name;
  if (s.age >= 65) return "しぶとく長生きした" + STATUS[s.st].name;
  if (/飢え/.test(s.cause || "")) return "飢饉に呑まれた" + STATUS[s.st].name;
  return "ありふれた" + STATUS[s.birthStatus].name + "の" + sx;
}
function summary(s) {
  const kids = s.children.length, grown = s.children.filter(c => c.alive ? (s.year - c.y >= 15) : (c.dieAge >= 15)).length;
  const died = s.children.filter(c => !c.alive).length;
  return {
    birthText: birthText(Object.assign({}, s, { year: s.birthYear, region: s.birthRegion, st: s.birthStatus })),
    birthLabel: birthLabel(s),
    name: myName(s) + (s.nm && s.nm.dharma && !s.nm.custom && s.nm.secular ? "（俗名 " + s.nm.secular + "）" : ""),
    spouses: (s.spouses || []).slice(),
    childNames: s.children.map(c => ({ name: childName(c, s.year), alive: c.alive, dieAge: c.dieAge })),
    tier: s.tier ? { label: s.tier.label, share: s.tier.share } : null,
    birthYear: s.birthYear, deathYear: s.year,
    birthWareki: wareki(s.birthYear), deathWareki: wareki(s.year),
    region: REGION[s.birthRegion], deathRegion: REGION[s.region],
    kyonen: s.age + 1, age: s.age,
    cause: s.cause, causeDesc: s.causeDesc,
    finalLabel: curLabel(s), rank: s.rank, rankName: RANKS[s.rank],
    wealth: s.wealth, wealthText: fmtW(s.wealth),
    kids, grown, kidsDied: died,
    married: s.marriages,
    jisei: jisei(s), ojo: ojo(s), epithet: epithet(s),
    birthP: s.birthP, odds: Math.round(1 / s.birthP),
    sex: s.sex, nameRecorded: s.sex === "m" ? (isOfficial(s) && s.rank >= 9) : (s.kokumo),
    stats: { hp: Math.round(s.hp), sai: Math.round(s.sai), en: Math.round(s.en), toku: Math.round(s.toku) }
  };
}

/* ---------------- シミュレーション（統計比較用） ---------------- */
function autoLife(opt) {
  const s = newLife(opt);
  let guard = 0;
  while (s.alive && guard++ < 2000) {
    if (isMilestone(s.age) && s.flags._autoPlan !== s.age) { s.flags._autoPlan = s.age; const o = planOptions(s); if (o.length) setPlan(s, pick(o).id); }
    const r = advance(s);
    if (r.choice) {
      const ok = r.choice.options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
      choose(s, pick(ok));
    }
  }
  return s;
}
function simulate(n, opt) {
  const ages = [], causes = {};
  for (let i = 0; i < n; i++) {
    const s = autoLife(opt);
    ages.push(s.age);
    causes[s.cause] = (causes[s.cause] || 0) + 1;
  }
  ages.sort((a, b) => a - b);
  const mean = ages.reduce((a, b) => a + b, 0) / n;
  return { n, ages, causes, mean, under5: ages.filter(a => a < 5).length / n };
}

// node 側で wpick の regions 用に k を返せるよう調整
const api = {
  newLife, advance, choose, summary, simulate, autoLife, wareki, REGION, STATUS, RANKS,
  curLabel, fmtW, kanjiNum, isMilestone, planOptions, setPlan, myName, renameSelf, spouseName, childName, makeName, nameOf
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.Heian = api;

})(typeof window !== "undefined" ? window : globalThis);
