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
  kyomin:  { name: "京の庶民", p: 0.015, income: 2.8, upkeep: 2.4, haz: 1.12, sc: 1, w0: 2,
    birth: ["京の庶民の家の息子", "京の庶民の家の娘"] },
  gozoku:  { name: "地方豪族", p: 0.03, income: 24, upkeep: 17, haz: 0.88, sc: 8, w0: 60,
    birth: ["地方豪族の家の息子", "地方豪族の家の娘"] },
  gyomin:  { name: "漁民", p: 0.04, income: 2.45, upkeep: 2.05, haz: 1.05, sc: 1, w0: 1,
    birth: ["海辺の漁民の家の息子", "海辺の漁民の家の娘"] },
  genin:   { name: "下人", p: 0.05, income: 0, upkeep: 0, haz: 1.22, sc: 0, w0: 0,
    birth: ["下人（奴婢）の息子", "下人（奴婢）の娘"] },
  nomin:   { name: "農民", p: 0, income: 2.5, upkeep: 2.1, haz: 1.0, sc: 1, w0: 1.5,
    birth: ["農民の家の息子", "農民の家の娘"] },
  // 途中でなれる身分
  so:      { name: "僧", income: 1.9, upkeep: 1.5, haz: 0.92, sc: 1, w0: 0 },
  furo:    { name: "浮浪人", income: 1.95, upkeep: 1.7, haz: 1.15, sc: 1, w0: 0 },
  bushi:   { name: "武士", income: 18, upkeep: 12, haz: 1.0, sc: 6, w0: 0 }
};
(function () {
  let s = 0;
  for (const k in STATUS) if (k !== "nomin" && STATUS[k].p) s += STATUS[k].p;
  STATUS.nomin.p = 1 - s;
})();
const BIRTH_KEYS = ["kouzoku","kugyo","kizoku","kanjin","kyomin","gozoku","gyomin","genin","nomin"];

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
    { w: 24, c: "咳病（しわぶきやみ）", d: "ただの咳の病でした。ただの咳の病で、十分でした。" },
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
    { w: rich ? 22 : 3, c: "飲水病（糖尿病）", d: "やたらと喉が渇く病でした。藤原道長と同じ病です。誇っていいのかは分かりません。" },
    { w: 16, c: "胸の病", d: "長く咳が続いていました。" },
    { w: rich ? 14 : 8, c: "物の怪", d: "最期まで「あの者の霊が来る」とうなされていました。心当たりはあったようです。" },
    { w: 12, c: "痢病（下痢）", d: "年を取ると、お腹の病はなおさら命取りでした。" }
  ]);
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
  s.logs.push({ age: 0, year, t: birthText(s), k: "birth" });
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
  return STATUS[s.st].name;
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
function sc(s) { return STATUS[s.st].sc || 1; }
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
  if (isOfficial(s) && s.rank < 16 && s.year >= 900) {
    const cost = Math.max(8, 4 * k) * (s.rank >= 9 ? 3 : 1);
    opt("成功（じょうごう）で官位を買う", "官位↑", cost, (st) => {
      if (R() < 0.7) { st.rank = Math.min(st.rank + 1, rankCap(st)); return ["寺の造営費を負担する見返りに、" + RANKS[st.rank] + "に叙されました（成功）。お金で買える地位もあります。"]; }
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
      { label: "源の姓を賜り、臣下になる", desc: "官位を上げて公卿を目指せる（賜姓源氏）", apply: (st) => { st.flags.genpuku = 1; st.flags.shisei = 1; st.rank = 12; return ["「源」の姓を賜り、臣下になりました。天皇の子で臣下になった一世源氏は、従四位上から始まるのが通例です。親の七光りは、この時代とても明るく光ります。"]; } },
      { label: "親王のまま暮らす", desc: "収入は安定。ただし仕事はほぼない", apply: (st) => { st.flags.genpuku = 1; return ["親王のままでいることにしました。品位（ほんい）はありますが、仕事はあまりありません。"]; } }
    ], "『類聚三代格』巻17（弘仁5年の賜姓の詔）／『西宮記』");
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
  if (s.st === "kanjin" && s.year >= 890) opts.push({ label: "武官として滝口に仕える", desc: "内裏を警護する武士。体を使う", apply: (st) => { st.flags.genpuku = 1; st.rank = 1; st.flags.takiguchi = 1; adj(st, { hp: 5, en: 3 }); return ["元服し、内裏を警護する「滝口の武士」に加わりました。"]; } });
  return branch(s, "元服", "数えで" + (s.age + 1) + "。元服の儀を迎え、冠をかぶりました。どの道で身を立てますか。", opts, "『養老令』選叙令（蔭位の規定）");
}

function chComing(s) {
  const m = s.sex === "m";
  const o = [
    { label: "このまま村で暮らす", desc: "家を継ぎ、土地とともに生きる", apply: (st) => { st.flags.coming = 1; return ["村に残ることにしました。生まれた場所で生き、たぶん生まれた場所で死にます。"]; } },
    { label: "京へ上る", desc: m ? "衛士や雑役として都へ。一旗あげられるか" : "都の貴族の家に下働きとして仕える", apply: (st) => {
      st.flags.coming = 1; st.region = "kyo"; st.st = "kyomin"; st.wealth = Math.min(st.wealth, 1);
      adj(st, { en: 3 });
      return [m ? "都に上りました。思っていたより、道に死体が多い街でした。" : "都の貴族の家に下働きとして入りました。御簾の内側を見ることは、一度もありませんでした。"];
    } },
    { label: "出家する（私度僧）", desc: "勝手に頭を剃る。税は逃れられる。朝廷は禁止している", apply: (st) => { st.flags.coming = 1; return shukke(st, true); } }
  ];
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
      if (again && st.st !== "genin") return [noble ? "新しい相手と三日夜餅を食べました。二度目なので、段取りは慣れたものです。" : "新しい連れ合いと所帯を持ちました。この時代、再婚はまったく珍しくありません。"];
      if (st.st === "genin") return ["主人の決めた相手と夫婦になりました。生まれる子も、主人の財産になります。"];
      if (noble) return [m ? "三晩続けて通い、三日夜餅（みかよのもちい）を食べました。これで結婚成立です。" : "三晩通ってきた男と、三日夜餅を食べました。結婚成立です。翌月から、通ってくる日が少し減りました。"];
      return ["夫婦になりました。庶民の婚礼の様子は、史料にほとんど残っていません。"];
    } },
    { label: s.st === "genin" ? "拒む" : "見送る", desc: "まだ一人でいる", apply: (st) => {
      if (st.st === "genin") { adj(st, { hp: -6, en: -3 }); return ["拒みました。主人の機嫌を損ね、食事を減らされました。"]; }
      return [noble && !m ? "返事を出さないことにしました。歌の出来が、いまいちだったので。" : "見送りました。"];
    } }
  ], noble ? "『源氏物語』葵巻（三日夜餅）" : undefined);
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
  return branch(s, "人生の分岐点 ― 除目", "除目で、地方の国司（受領）の口がかかりました。任期は4年。うまくやれば一財産です。", [
    { label: "受領として任国へ下る", desc: "財↑↑↑ 訴えられることも", apply: (st) => { st.juryo = 4; st.flags.juryoEver = 1; return ["受領として任国へ下りました。「受領は倒るる所に土をつかめ」――転んでもただでは起きない、という意味です。"]; } },
    { label: "京に残る", desc: "都での出世を狙う", apply: (st) => { adj(st, { en: 2 }); return ["京に残ることにしました。都を離れると、出世の噂から取り残されるので。"]; } }
  ], "『今昔物語集』巻28第38話（信濃守藤原陳忠）");
}

function chSick(s) {
  return branch(s, "病床にて", "重い病で、起き上がれなくなりました。枕元の僧が、出家を勧めています。", [
    { label: "出家する（臨終出家）", desc: "徳↑↑ 死んだら往生しやすい", apply: (st) => { const nb = isNoble(st); st.flags.rinju = 1; shukke(st, false); adj(st, { hp: 8 }); return ["病床で髪を下ろし、出家しました（臨終出家）。" + (nb ? "この時代の貴族には、よくある駆け込みです。" : "極楽への、駆け込み乗車です。")]; } },
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
  { y: 810, when: isNoble, t: "上皇と天皇が対立し、都が二つに割れかけました（薬子の変）。", k: "hist", src: "『日本後紀』" },
  { y: 818, reg: ["togoku"], t: "東国で大きな地震がありました（弘仁地震）。", k: "hist", src: "『類聚国史』", fx: (s) => { adj(s, { w: -0.4 * sc(s) }); addRisk(s, 0.012, "地震", "家が潰れ、そのまま梁の下にいました。"); } },
  { y: 842, when: isNoble, t: "嵯峨上皇が亡くなった直後、伴健岑・橘逸勢が謀反の罪で流され、皇太子が廃されました（承和の変）。", k: "hist", src: "『続日本後紀』承和9年7月条" },
  { y: 842, reg: ["kyo"], t: "朝廷の命令で、島田や鴨川の河原などに捨て置かれていた髑髏、あわせて五千五百余りが焼かれ、葬られました。この街では、遺体は河原に置いておくものでした。", k: "hist", src: "『続日本後紀』巻12 承和9年10月条" },
  { y: 863, reg: ["kyo"], t: "神泉苑で御霊会が開かれました。非業の死を遂げた人々の霊を鎮め、疫病を払うためです。都の人々にも見物が許されました。", k: "hist", src: "『日本三代実録』貞観5年5月20日条" },
  { y: 864, reg: ["togoku"], t: "富士山が噴火しました（貞観大噴火）。流れた溶岩が湖を埋め、のちに樹海になります。", k: "hist", src: "『日本三代実録』" },
  { y: 866, when: isNoble, t: "応天門が燃えました。犯人探しの結果、大納言伴善男が流罪となり、なぜか藤原氏だけが得をしました（応天門の変）。", k: "hist", src: "『日本三代実録』" },
  { y: 869, reg: ["michinoku"], t: "陸奥で巨大な地震と津波がありました（貞観地震）。溺死者は千人ほどと記録されています。", k: "hist", src: "『日本三代実録』", fx: (s) => { adj(s, { w: -0.6 * sc(s) }); addRisk(s, s.st === "gyomin" ? 0.25 : 0.06, "津波", "海が、山のように盛り上がってきました。"); } },
  { y: 887, reg: ["kinai", "saigoku"], t: "畿内から西国にかけて大きな地震がありました（仁和地震）。", k: "hist", src: "『日本三代実録』", fx: (s) => addRisk(s, 0.012, "地震", "揺れが止まったとき、家の屋根が上にありませんでした。") },
  { y: 894, when: isNoble, t: "菅原道真が「唐は衰え、渡海は危うい。遣唐使を送るかどうか、公卿で議定してほしい」と奏上しました。遣唐使は取りやめになりました。", k: "hist", src: "『菅家文草』巻9（寛平6年9月14日の奏状）" },
  { y: 901, when: isNoble, t: "右大臣菅原道真が大宰府へ左遷されました。このあと都で雷が鳴るたびに、関係者は気が気でなくなります。", k: "hist", src: "『日本紀略』" },
  { y: 902, when: (s) => isRural(s) && s.st !== "genin", t: "朝廷が、百姓が課役を逃れるために田を有力者へ「寄進」したことにするのを禁じました（延喜の荘園整理令）。逆に言えば、それだけ流行っていたということです。", k: "hist", src: "『類聚三代格』延喜2年3月13日太政官符" },
  { y: 914, t: "三善清行が朝廷に意見書を出し、天下の民の三分の二が、課役を逃れるために勝手に頭を剃った者になっていると訴えました（意見十二箇条）。", k: "hist", src: "三善清行『意見十二箇条』第11条（『本朝文粋』巻2）" },
  { y: 915, epi: "hoso", t: "疱瘡（天然痘）が全国で流行しています。「疱瘡」という呼び名は、この年に世間で生まれたと記録されています。", k: "hist", src: "『日本紀略』延喜15年" },
  { y: 915, reg: ["michinoku"], t: "北の山（十和田）が大噴火しました。出羽国では灰が二寸積もり、桑畑が枯れたと報告されています。日本の有史以来、最大級の噴火とされます。", k: "hist", src: "『扶桑略記』延喜15年7月13日条／気象庁「十和田」", fx: (s) => { adj(s, { w: -0.8 * sc(s), hp: -5 }); addRisk(s, 0.03, "十和田の噴火", "空が、昼なのに暗くなりました。"); } },
  { y: 930, reg: ["kyo"], t: "内裏の清涼殿に雷が落ち、死者が出ました。全員が、道真の祟りだと確信しました。", k: "hist", src: "『日本紀略』延長8年", fx: (s) => { if (s.st === "kugyo") addRisk(s, 0.04, "落雷（道真の祟り）", "清涼殿で会議中でした。祟られる心当たりは、たぶんありました。"); } },
  { y: 939, reg: ["togoku"], t: "平将門が坂東の国府を次々に落とし、「新皇」を名乗りました。あなたの村は、どちらの味方か聞かれる前に焼かれました。", k: "hist", src: "『将門記』", fx: (s) => { adj(s, { w: -0.8 * sc(s), hp: -6 }); addRisk(s, s.st === "bushi" ? 0.12 : 0.035, "平将門の乱", "兵が通り過ぎていきました。あなたは通り過ぎられませんでした。"); } },
  { y: [939, 941], reg: ["saigoku"], t: "藤原純友が瀬戸内の海賊を率いて暴れています。", k: "hist", src: "『日本紀略』『本朝世紀』", fx: (s) => { addRisk(s, s.st === "gyomin" ? 0.05 : 0.012, "藤原純友の乱", "海賊は、漁師の舟から先に奪っていきました。"); } },
  { y: 935, reg: ["saigoku"], t: "土佐守の任期を終えた紀貫之の一行が、船で都へ帰っていきました。一行の誰かが、女のふりをして仮名の日記を書いているそうです。", k: "hist", src: "紀貫之『土佐日記』" },
  { y: 947, epi: "hoso", t: "また疱瘡が流行しています。内裏の中にまで広がっています。", k: "hist", src: "『日本紀略』天暦元年" },
  { y: 960, when: isNoble, t: "清涼殿で、村上天皇の主催する歌合が開かれました（天徳内裏歌合）。のちのちまで歌合の手本とされる、晴れの舞台です。", k: "hist", src: "『殿上日記』『村上天皇御記』" },
  { y: 960, reg: ["kyo"], t: "平安京遷都以来はじめて、内裏が丸焼けになりました。", k: "hist", src: "『日本紀略』天徳4年" },
  { y: 969, when: isNoble, t: "左大臣源高明が謀反の疑いで大宰府に流されました（安和の変）。これで藤原氏に逆らえる家は、ほぼなくなりました。", k: "hist", src: "『日本紀略』" },
  { y: 974, epi: "hoso", t: "疱瘡がまた流行しています。疱瘡を払う大祓が行われ、帝までかかりました。", k: "hist", src: "『日本紀略』天延2年" },
  { y: 980, reg: ["kyo"], t: "暴風雨で、都の正門・羅城門が倒れました。その後、再建されることはありませんでした。", k: "hist", src: "『百錬抄』天元3年7月9日条" },
  { y: 985, t: "源信が『往生要集』を著しました。地獄の描写があまりに具体的で、人々はこぞって念仏を唱え始めました。", k: "hist", src: "源信『往生要集』", fx: (s) => adj(s, { toku: 3 }) },
  { y: 988, when: (s) => isRural(s) && s.st !== "genin", t: "尾張国の郡司と百姓が、国司・藤原元命の悪政を三十一か条にわたって朝廷に訴え出ました。訴えは通り、国司は解任されました。こういうことは、とても珍しいです。", k: "hist", src: "『尾張国郡司百姓等解文』" },
  { y: 994, epi: "eki", t: "疫病が猛威を振るっています。夏までに都の人の半ばが亡くなり、五位以上の貴族だけで六十七人が死んだと記録されています。", k: "hist", src: "『日本紀略』正暦5年" },
  { y: 995, epi: "eki", t: "疫病がまだ続いています。", k: "hist", src: "『日本紀略』長徳元年" },
  { y: 995, when: isNoble, t: "関白が二人続けて亡くなりました。空いた席には、藤原道長が座りました。", k: "hist", src: "『日本紀略』『栄花物語』" },
  { y: 998, epi: "hashika", t: "赤斑瘡（あかもがさ）という新しい病が流行しています。はしかの、記録に残る最初の大流行とされます。", k: "hist", src: "『日本紀略』長徳4年7月条／『栄花物語』巻5" },
  { y: 1008, when: (s) => isNoble(s) && s.sex === "f", t: "宮中で『源氏の物語』という読み物が評判です。作者の紫式部は、漢字が読めることを周囲に隠しているそうです。", k: "hist", src: "『紫式部日記』" },
  { y: 1018, when: isNoble, t: "藤原道長の宴で「この世をば我が世とぞ思ふ望月の欠けたることもなしと思へば」という歌が詠まれました。返歌を求められた藤原実資は、全員で唱和しようと提案して逃げ切りました。", k: "hist", src: "藤原実資『小右記』寛仁2年" },
  { y: 1019, reg: ["kyushu"], t: "海の向こうから刀伊（女真族）の船団が襲ってきました。壱岐・対馬から筑前まで、約360人が殺され、約1300人が連れ去られました。", k: "hist", src: "『小右記』『朝野群載』", fx: (s) => addRisk(s, 0.05, "刀伊の入寇", "船団は、朝の霧の中から来ました。") },
  { y: 1020, epi: "hoso", t: "春から疱瘡が流行しています。大赦が行われ、調庸と雑徭が免除されました。", k: "hist", src: "『日本紀略』寛仁4年" },
  { y: 1020, reg: ["togoku"], t: "上総介の一家が、任期を終えて都へ帰っていきました。十三歳の娘は、都で物語を好きなだけ読めるよう、薬師仏に祈っていたそうです。", k: "hist", src: "菅原孝標女『更級日記』" },
  { y: 1023, reg: ["kyo"], when: isNoble, t: "藤原道長が土御門殿で田植えの催しを開き、娘の彰子に見せました。鼓と笛で囃し、田植え歌が歌われたそうです。貴族にとって、田植えは見物するものです。", k: "hist", src: "『栄花物語』巻十九「御裳着」" },
  { y: [1028, 1031], reg: ["togoku"], t: "平忠常の乱が続き、房総の村々は荒れ果てています。", k: "hist", src: "『左経記』", fx: (s) => { adj(s, { w: -0.5 * sc(s), hp: -3 }); addRisk(s, 0.015, "平忠常の乱", "乱そのものより、乱のあとの飢えのほうが長く続きました。"); } },
  { y: [1051, 1062], reg: ["michinoku"], t: "陸奥で安倍氏と源氏の戦が続いています（前九年合戦）。", k: "hist", src: "『陸奥話記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.06 : 0.015, "前九年合戦", "戦は十二年続きました。あなたはその途中で終わりました。") },
  { y: 1052, t: "今年から末法の世に入ったと言われています。仏の教えが廃れ、世が乱れる時代だそうです。みんな薄々そう思っていました。", k: "hist", src: "『扶桑略記』", fx: (s) => adj(s, { toku: 2 }) },
  { y: 1053, when: isNoble, t: "藤原頼通が宇治に平等院鳳凰堂を建てました。極楽を、自腹で、先に建てた人です。", k: "hist" },
  { y: 1069, when: (s) => s.st === "gozoku" || isNoble(s), t: "後三条天皇が荘園整理令を出しました。あなたの荘園の書類は、たぶん大丈夫です。たぶん。", k: "hist", src: "『愚管抄』ほか（記録荘園券契所の設置）", fx: (s) => { if (s.flags.kishin && R() < 0.3) { adj(s, { w: -2 * sc(s) }); log(s, "……大丈夫ではありませんでした。一部の田が没収されました。", "bad"); } } },
  { y: [1083, 1087], reg: ["michinoku"], t: "陸奥で清原氏の内紛に源義家が介入し、戦が続いています（後三年合戦）。", k: "hist", src: "『奥州後三年記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.06 : 0.012, "後三年合戦", "雪の中の籠城戦でした。") },
  { y: 1096, reg: ["kyo"], t: "都じゅうが田楽に熱狂しています（永長の大田楽）。庶民から公卿まで、笛と鼓で踊り歩いています。大江匡房いわく「一城の人、皆狂へるがごとし」。", k: "hist", src: "大江匡房『洛陽田楽記』／『中右記』永長元年" },
  { y: 1108, reg: ["togoku"], t: "上野国の浅間山が大噴火しました。国司の報告によれば、国中の田畑がことごとく駄目になったそうです。", k: "hist", src: "『中右記』天仁元年9月5日条", fx: (s) => { adj(s, { w: -1.2 * sc(s), hp: -6 }); addRisk(s, 0.03, "浅間山の噴火", "山の火は、七月の末に上がりました。"); } },
  { y: 1086, when: isNoble, t: "白河天皇が位を譲り、上皇として政治を続けることにしました。偉い人が一人増えました（院政のはじまり）。", k: "hist" },
  { y: 1156, reg: ["kyo"], t: "天皇方と上皇方が武士を集めて都で戦いました（保元の乱）。敗れた側の武士が処刑されました。朝廷による死刑は、約350年ぶりとされます。", k: "hist", src: "『兵範記』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.1 : 0.008, "保元の乱", "夜明け前の白河殿でした。") },
  { y: 1159, reg: ["kyo"], t: "源義朝と平清盛が都で戦いました（平治の乱）。平家の時代が始まります。", k: "hist", src: "『平治物語』", fx: (s) => addRisk(s, s.st === "bushi" ? 0.1 : 0.008, "平治の乱", "雪の六波羅でした。") },
  { y: 1167, t: "平清盛が太政大臣になりました。「平家にあらずんば人にあらず」と言われる時代です。あなたは平家ではありません。", k: "hist", src: "『平家物語』" },
  { y: 1177, reg: ["kyo"], t: "都で大火事がありました（安元の大火）。大極殿まで焼け落ちました。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => { adj(s, { w: -0.25 * Math.max(0, s.wealth) }); addRisk(s, 0.02, "安元の大火", "風が強い夜でした。"); } },
  { y: 1180, reg: ["kyo"], t: "都につむじ風が吹き荒れ、家々が吹き飛ばされました。その二か月後、平清盛が都を福原へ移しました。半年で戻りました。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => adj(s, { w: -0.15 * Math.max(0, s.wealth) }) },
  { y: [1181, 1182], t: "大飢饉です（養和の飢饉）。都の左京だけで、道ばたの遺体が四万二千三百余りと数えられました。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => {
    const poor = !(isNoble(s) || s.st === "gozoku" || s.wealth > 20);
    adj(s, { hp: poor ? -12 : -3, w: poor ? -1.2 : -0.1 * Math.max(0, s.wealth) });
    addRisk(s, poor ? (s.region === "kyo" || s.region === "saigoku" ? 0.12 : 0.06) : 0.01, "飢え（養和の飢饉）", "最後に食べたのは、木の皮を煮たものでした。");
  } },
  { y: 1185, reg: ["kyo"], t: "都を大地震が襲いました（元暦の大地震）。山は崩れ、海は傾き、寺も塔も無事なものはなかったといいます。", k: "hist", src: "鴨長明『方丈記』", fx: (s) => addRisk(s, 0.02, "元暦の大地震", "揺れは、何か月も続きました。") },
  { y: 1192, t: "源頼朝が征夷大将軍になりました。教科書的には時代が変わりましたが、あなたの暮らしは特に変わりません。", k: "hist", src: "『吾妻鏡』" },
  { y: 1212, t: "鴨長明という男が、方丈の庵で『方丈記』を書き上げました。あなたが見てきた災害が、だいたい全部載っています。", k: "hist" },
  { y: 1221, t: "後鳥羽上皇が幕府に挑み、負けました（承久の乱）。上皇が島流しになる時代です。", k: "hist", src: "『吾妻鏡』" },
  { y: [1230, 1231], t: "大飢饉です（寛喜の飢饉）。寛喜2年6月には美濃国で雪が降ったと、鎌倉に報告されています。もう鎌倉時代です。", k: "hist", src: "『吾妻鏡』寛喜2年6月16日条", fx: (s) => { const poor = !(isNoble(s) || s.wealth > 20); adj(s, { hp: poor ? -10 : -2, w: poor ? -1 : 0 }); addRisk(s, poor ? 0.07 : 0.01, "飢え（寛喜の飢饉）", "冷たい夏でした。"); } }
];
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
  { p: 0.11, when: (s) => ["nomin", "gozoku"].includes(s.st), src: "『尾張国郡司百姓等解文』（国司による過重な徴収の訴え）", fx: (s) => { adj(s, { w: 0.9 * sc(s) }); log(s, pick(["豊作でした。増えた分は、だいたい国司が持っていきました。", "豊作でした。出挙で借りた稲を、今年は利息ごと返せました。"]), "good"); } },
  { p: 0.11, when: (s) => ["nomin", "gozoku", "furo"].includes(s.st), fx: (s) => { adj(s, { w: -1.2 * sc(s), hp: -4 }); log(s, pick(["日照りでした。都の神泉苑では雨乞いの修法が行われたそうです。村には届きませんでした。", "長雨で稲が腐りました。", "虫の害で、稲が一晩で枯れました。"]), "bad"); } },
  { p: 0.04, when: (s) => isRural(s) && s.st !== "genin" && !s.flags.kishin && s.st !== "furo", src: "『尾張国郡司百姓等解文』（988年）", fx: (s) => { adj(s, { w: -0.8 * sc(s) }); log(s, pick(["新しい国司が着任しました。前の国司より、取り立てに熱心な方です。", "国司の使いが来て、決まりより多くの稲を取り立てていきました。尾張の百姓が訴えた手口と同じです。"]), "bad"); } },
  { p: 0.035, when: (s) => (s.st === "nomin" || s.st === "gyomin") && s.sex === "m" && s.age >= 17 && s.age < 60, src: "『養老令』賦役令／延暦14年（795）の雑徭半減", fx: (s) => { adj(s, { hp: -4 }); log(s, "国司のもとでの雑徭（ぞうよう＝年30日までの労役）に駆り出されました。国府の修理と、国司の私用の区別はつきませんでした。", "bad"); } },
  { p: 0.04, when: (s) => isRural(s), fx: (s) => { adj(s, { w: -0.6 * sc(s) }); log(s, "川があふれ、田が流されました。", "bad"); addRisk(s, 0.008, "洪水", "濁流は、夜に来ました。"); } },
  { p: 0.03, when: (s) => isRural(s) || s.st === "kyomin", src: "『今昔物語集』巻29（本朝付悪行）", fx: (s) => { adj(s, { w: -0.4 * sc(s) }); log(s, "盗賊に入られました。盗られて困るものは、あまりありませんでした。", "bad"); addRisk(s, 0.006, "盗賊に襲われて", "抵抗したのが、まずかったようです。"); } },
  { p: 0.02, when: (s) => s.age >= 6, src: "『日本霊異記』上巻第二縁", fx: (s) => log(s, "狐が女に化けて人の妻になったという昔話を、村の年寄りが繰り返し話しています。「来つ寝（きつね）」の由来だそうです。", "n") },
  { p: 0.02, when: (s) => s.age >= 6 && s.region === "kyo", src: "『大鏡』（藤原師輔の百鬼夜行）", fx: (s) => log(s, "夜の大路で百鬼夜行に出くわしかけた、という貴族の話が広まっています。尊勝陀羅尼を唱えて助かったそうです。", "n") },
  { p: 0.035, when: (s) => s.st === "gyomin", src: "『延喜式』主計寮（諸国の調）", fx: (s) => { adj(s, { w: 0.8 }); log(s, "大漁でした。鰹を干して堅魚（かたうお）にし、調として納めました。", "good"); } },
  { p: 0.03, when: (s) => s.st === "gyomin", fx: (s) => { log(s, "嵐で舟が壊れました。", "bad"); adj(s, { w: -0.8 }); addRisk(s, 0.02, "海難", "嵐の夜、浜に戻ってきたのは舟の板だけでした。"); } },
  { p: 0.035, when: (s) => isRural(s), fx: (s) => { adj(s, { w: -0.3 * sc(s) }); log(s, pick(["猪が田を荒らしました。", "鹿が稲穂を食べていきました。"]), "bad"); } },
  { p: 0.025, when: (s) => isRural(s), src: "『今昔物語集』巻28第38話（平茸）", fx: (s) => { adj(s, { hp: 2 }); log(s, "山で平茸がたくさん採れました。信濃守が谷に落ちても手放さなかった、あの茸です。", "good"); } },
  { p: 0.025, when: (s) => isRural(s), src: "『枕草子』第一段", fx: (s) => log(s, "夏の夜、蛍がたくさん飛び交っていました。都の女房が「をかし」と書いた景色は、村ではただの夜です。", "n") },
  { p: 0.03, when: (s) => isRural(s) && s.year >= 1000, src: "『栄花物語』巻十九「御裳着」（田植えの囃子）", fx: (s) => log(s, "田植えの日、腰鼓や笛で囃し、田植え歌を歌いながら苗を植えました。", "n") },
  { p: 0.03, when: (s) => isRural(s) && s.st !== "genin", src: "『養老令』雑令（出挙）", fx: (s) => log(s, "稲刈りのあと、収穫のかなりの分が租と出挙の返済で消えました。", "n") },
  { p: 0.04, when: (s) => isRural(s) && (s.region === "togoku" || s.region === "michinoku"), fx: (s) => { adj(s, { hp: -3 }); log(s, pick(["大雪で、家が半分埋まりました。", "冬が長く、蓄えの粟が春までもちませんでした。"]), "bad"); } },
  { p: 0.015, when: (s) => isRural(s) && (s.region === "togoku" || s.region === "michinoku") && s.age >= 10, fx: (s) => { log(s, "山で熊に出くわしました。", "bad"); addRisk(s, 0.08, "熊に襲われて", "山菜採りの帰りでした。"); } },
  { p: 0.03, when: (s) => s.year >= 931 && s.age >= 6, src: "『日本紀略』延長8年（清涼殿落雷）", fx: (s) => { adj(s, { hp: -1 }); log(s, "雷が近くに落ちました。清涼殿に雷が落ちて以来、雷は菅原道真の怨霊だと言われています。", "n"); } },
  { p: 0.03, when: (s) => s.st === "gozoku", src: "藤原明衡『新猿楽記』（大名田堵・田中豊益）", fx: (s) => { adj(s, { w: 0.5 * sc(s) }); log(s, "日照りに備えて堰と用水路を整え、農具を手入れしました。『新猿楽記』に描かれた大名田堵の仕事ぶりと同じです。", "good"); } },
  // ---- 都 ----
  { p: 0.05, when: (s) => s.region === "kyo", src: "『日本紀略』ほか（京中の火事の記事）", fx: (s) => { adj(s, { w: -0.12 * Math.max(0, s.wealth) - 0.2 }); log(s, "近所から火が出ました。平安京は、よく燃える街です。", "bad"); addRisk(s, 0.004, "火事", "煙が先に来ました。"); } },
  { p: 0.04, when: (s) => s.region === "kyo" && s.age >= 6, src: "『源氏物語』葵巻（車争い）", fx: (s) => { adj(s, { en: 1 }); log(s, "賀茂祭の行列を見物しました。牛車の場所取りで、貴族の従者同士が喧嘩していました。", "n"); } },
  { p: 0.03, when: (s) => s.st === "kyomin", src: "鴨長明『方丈記』", fx: (s) => log(s, "鴨川の河原に、また遺体が置かれていました。もう誰も驚きません。", "n") },
  { p: 0.05, when: (s) => s.region === "kyo" && s.year >= 938 && s.year <= 972 && s.age >= 6, src: "『日本往生極楽記』空也伝", fx: (s) => { adj(s, { toku: 2 }); log(s, "市で、空也という聖が念仏を唱えながら、井戸を掘ったり施しをしたりしています。人々は「市聖」と呼んでいます。", "n"); } },
  // ---- 貴族・官人 ----
  { p: 0.09, when: (s) => (isNoble(s) || s.st === "kanjin") && s.age >= 6, src: "『枕草子』「すさまじきもの」", fx: (s) => { adj(s, { hp: 1, en: -0.5 }); const adult = s.age >= 15 && s.sex === "m"; log(s, pick([adult ? "陰陽師に物忌みを言い渡され、屋敷にこもりました。出仕を休めるので、わりと助かっています。" : "陰陽師に物忌みを言い渡され、何日も屋敷から出られませんでした。", "方違えに知人の家へ行ったのに、何のもてなしもありませんでした。清少納言が「すさまじきもの」に挙げた仕打ちです。", adult ? "夢見が悪かったので物忌みとし、出仕を取りやめました。" : "夢見が悪かったので物忌みとし、一日じゅう御簾の内で過ごしました。"]), "n"); } },
  { p: 0.045, when: (s) => isNoble(s) && s.age >= 15, fx: (s) => {
    if (s.sai >= 45) { adj(s, { en: 4 }); log(s, "歌合で、あなたの歌が勝ちました。しばらく宮中の話題になりました。", "good"); }
    else { adj(s, { en: -1 }); log(s, "歌合に出ました。判者の評は「歌の姿はよろしいが、心が浅い」。負けです。", "n"); }
  } },
  { p: 0.035, when: (s) => isNoble(s) && s.age >= 30 && s.sex === "m" && s.year >= 931, fx: (s) => { log(s, "政敵が亡くなりました。道真の一件以来、雷が鳴るたびに全員があなたを見ます。", "n"); adj(s, { toku: -1 }); } },
  { p: 0.05, when: (s) => isNoble(s) && s.age >= 15 && s.sex === "m", fx: (s) => { adj(s, { w: -0.6 * sc(s), en: 2 }); log(s, "大臣家の大饗（だいきょう）に招かれました。宴の席順で、今の自分の立場がよく分かりました。", "n"); } },
  { p: 0.06, when: (s) => s.sex === "f" && isNoble(s) && s.married && s.spouseAlive, src: "藤原道綱母『蜻蛉日記』", fx: (s) => { adj(s, { en: -1 }); log(s, "夫の訪れが途絶えがちです。『蜻蛉日記』を書くなら、今です。", "bad"); } },
  { p: 0.05, when: (s) => s.flags.nyobo && s.sex === "f", fx: (s) => {
    if (s.sai >= 50) { adj(s, { en: 3 }); log(s, "雪の朝、主人に「香炉峰の雪はいかならむ」と問われ、黙って御簾を高く上げてみせました。清少納言と同じ手です。", "good", "『枕草子』「雪のいと高う降りたるを」"); }
    else { log(s, "宮仕え先で、漢字が読めないふりをしました。紫式部は「一」の字すら書けないふりをしたそうです。あなたは本当に読めません。", "n", "『紫式部日記』"); }
  } },
  { p: 0.04, when: (s) => isOfficial(s) && s.rank < 9, fx: (s) => log(s, "季禄（官人の給与）の支給が、今年も遅れています。国の財政は、平安です。", "bad") },
  { p: 0.05, when: (s) => isOfficial(s) && (s.rank === 9 || s.rank === 10), src: "『今昔物語集』巻26第17話", fx: (s) => log(s, "同僚の五位が「一度でいいから、芋粥を飽きるほど食べてみたい」とこぼしていました。あなたも同じことを思っています。", "n") },
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
  { p: 0.04, when: (s) => s.age >= 8, fx: (s) => { adj(s, { hp: -6 }); const k = R(); if (k < 0.34) log(s, "瘧病（わらわやみ）にかかり、熱と震えを繰り返しました。光源氏が北山の聖を訪ねた、あの病です。", "bad", "『源氏物語』若紫巻"); else log(s, k < 0.67 ? "ひどい腹下しで寝込みました。" : "咳病（しわぶきやみ）が流行り、寝込みました。", "bad"); } },
  { p: 0.02, when: (s) => s.age >= 10 && s.region !== "kyo", src: "『日本往生極楽記』", fx: (s) => { adj(s, { toku: 2 }); log(s, "旅の聖（ひじり）が村に来て、念仏を勧めていきました。", "n"); } }
];

/* ---------------- 庶民の小さな出来事（選択式） ---------------- */
function ev(title, lead, options, src) { return { title, lead, options, src }; }
function merchant(y) { return y < 907 ? "唐の商人" : (y < 960 ? "唐や呉越の商人" : "宋の商人"); }
const SMALL = [
  { id: "kenden", when: (s) => (s.st === "nomin" || s.st === "gozoku") && !s.flags.kishin, build: (s) => ev("検田使が来た", "国司の検田使（田の広さを調べる役人）が村に来ました。", [
    { label: "酒と贈り物でもてなす", desc: "財↓ 田の記録が甘くなるかも", apply: (st) => { adj(st, { w: -0.6 * sc(st) }); if (R() < 0.7) { adj(st, { w: 0.9 * sc(st) }); return ["もてなしました。田の広さは、なぜか少なめに記録されました。"]; } return ["もてなしました。検田使は酒だけ飲んで、田はきっちり測っていきました。"]; } },
    { label: "正直に申告する", desc: "財↓ 何も起きない", apply: (st) => { adj(st, { w: -0.5 * sc(st), toku: 1 }); return ["正直に申告しました。正直者は、きっちり課税されました。"]; } },
    { label: "一部の田を隠す（隠田）", desc: "うまくいけば財↑ ばれたら大変", apply: (st) => { if (R() < 0.6) { adj(st, { w: 0.8 * sc(st) }); return ["田を隠し通しました。隠田の米は、格別の味がしました。"]; } adj(st, { w: -1.5 * sc(st), hp: -8 }); return ["ばれました。罰として、笞（むち）で打たれました。"]; } }
  ], "『尾張国郡司百姓等解文』（国司の検田をめぐる訴え）") },
  { id: "mizu", when: (s) => s.st === "nomin" || s.st === "gozoku", build: (s) => ev("水争い", "日照りが続き、隣の家と田の水をめぐって揉めています。", [
    { label: "水を譲る", desc: "縁↑ 財↓", apply: (st) => { adj(st, { en: 4, w: -0.5 * sc(st) }); return ["水を譲りました。隣の家の稲はよく育ちました。あなたの稲は、それなりでした。"]; } },
    { label: "夜中にこっそり水を引く", desc: "財↑ 縁↓ 喧嘩になるかも", apply: (st) => { adj(st, { w: 0.6 * sc(st), en: -4 }); if (R() < 0.3) { adj(st, { hp: -8 }); return ["水を引きました。翌朝ばれて、鍬を持った隣人と殴り合いになりました。"]; } return ["こっそり水を引きました。隣の家は、まだ気づいていません。"]; } },
    { label: "刀禰（とね）に裁いてもらう", desc: "結果は刀禰しだい", apply: (st) => { if (R() < 0.5) { adj(st, { en: 1, w: 0.3 * sc(st) }); return ["村の刀禰は、あなたの言い分を認めました。日ごろの付け届けのおかげです。"]; } adj(st, { w: -0.3 * sc(st) }); return ["刀禰は隣の家の言い分を認めました。隣の家の付け届けのほうが多かったようです。"]; } }
  ], "藤原明衡『新猿楽記』（田堵の堰・用水の管理）") },
  { id: "tabiso", when: () => true, build: (s) => ev("旅の僧", "日暮れどき、粗末な身なりの僧が一夜の宿と食べ物を求めてきました。", [
    { label: "泊めて食べさせる", desc: "徳↑ 財↓", apply: (st) => { adj(st, { toku: 5, w: -0.2 }); return ["泊めてあげました。『日本霊異記』には、乞食の僧を打った男が罰を受ける話がいくつもあります。念のためです。"]; } },
    { label: "追い返す", desc: "徳↓", apply: (st) => { adj(st, { toku: -3 }); return ["追い返しました。その晩、少しだけ悪い夢を見ました。"]; } }
  ], "『日本霊異記』（乞食僧への施しと報い）") },
  { id: "shoen", once: true, when: (s) => (s.st === "nomin" || s.st === "gozoku") && s.year >= 1000 && !s.flags.kishin, build: (s) => ev("荘園への誘い", "近くの荘園の荘官が、「うちの荘園の寄人（よりうど）にならないか」と誘ってきました。", [
    { label: "荘園の寄人になる", desc: "国司の取り立てを避けられる。年貢は荘園へ", apply: (st) => { st.flags.kishin = 1; return ["荘園の寄人になりました。国司の代わりに、荘園の領主へ年貢を納めます。払う相手が変わっただけ、とも言います。"]; } },
    { label: "断る", desc: "国の公民のままでいる", apply: () => ["断りました。国司は、課役を負う公民が減って困っているそうです。"] }
  ], "延喜2年（902）の荘園整理令（『類聚三代格』）ほか") },
  { id: "kanbyo", when: () => true, build: (s) => ev("隣家の病人", "隣の家で、ひどい熱の病人が出ました。看病の手が足りないようです。", [
    { label: "看病する", desc: "徳↑↑ 縁↑ うつるかも", apply: (st) => { adj(st, { toku: 6, en: 4 }); addRisk(st, 0.04, "看病でうつった熱病", "隣の家の病人は、助かりました。"); return ["看病しました。"]; } },
    { label: "穢れを避けて近づかない", desc: "徳↓", apply: (st) => { adj(st, { toku: -3, en: -2 }); return ["近づきませんでした。人の死の穢れに触れると、三十日のあいだ忌み慎まねばなりません。賢い判断ですが、近所の目は冷たくなりました。"]; } }
  ], "『延喜式』巻3 臨時祭式（触穢の規定）") },
  { id: "matsuri", when: (s) => s.st !== "furo" && s.year >= 1000, build: (s) => ev("田楽", "村の田植えで、田楽を舞う役を頼まれました。", [
    { label: "舞う", desc: "縁↑↑", apply: (st) => { adj(st, { en: 5, hp: -1 }); return ["腰鼓を打って舞いました。翌年も頼まれることが、その場で決まりました。"]; } },
    { label: "見物だけする", desc: "縁↑", apply: (st) => { adj(st, { en: 1 }); return ["見物だけしました。"]; } },
    { label: "酒を飲みすぎる", desc: "縁↑ 体↓", apply: (st) => { adj(st, { en: 3, hp: -3 }); return ["酒を飲みすぎました。翌日の記憶がありません。村の全員が覚えています。"]; } }
  ], "『栄花物語』巻十九「御裳着」（田植えの田楽）") },
  { id: "suiko", when: (s) => (s.st === "nomin" || s.st === "gyomin") && s.year < 1000, build: (s) => ev("出挙の稲", "春、国府の使いが出挙（すいこ）の稲を貸し付けに来ました。秋に利息をつけて返す決まりです。", [
    { label: "借りる", desc: "今は財↑ 利息は年3割", apply: (st) => { adj(st, { w: 1 }); st.flags.suikoDebt = (st.flags.suikoDebt || 0) + 1.3; return ["稲を借りました。秋には、三割の利息をつけて返します。"]; } },
    { label: "断る", desc: "断れるとは限らない", apply: (st) => { if (R() < 0.6) { adj(st, { w: 1 }); st.flags.suikoDebt = (st.flags.suikoDebt || 0) + 1.3; return ["断りましたが、断れませんでした。公出挙は、事実上の税です。"]; } return ["今年はなんとか断れました。"]; } }
  ], "『養老令』雑令／弘仁元年（810）以降、公出挙の利率は3割") },
  { id: "kitsune", when: () => true, build: (s) => ev("罠にかかった狐", "仕掛けた罠に、狐がかかっていました。", [
    { label: "逃がしてやる", desc: "徳↑", apply: (st) => { adj(st, { toku: 3 }); return ["逃がしてやりました。狐は一度だけ振り返りました。昔話なら、このあと美しい娘が訪ねてきます。"]; } },
    { label: "皮を売る", desc: "財↑ 徳↓", apply: (st) => { adj(st, { w: 0.5, toku: -2 }); return ["皮を売りました。いい値がつきました。"]; } }
  ], "『日本霊異記』上巻第二縁（狐を妻とする話）") },
  { id: "unkyaku", when: (s) => s.st === "nomin" && s.sex === "m" && s.year < 960 && s.age < 50, build: (s) => ev("調を都へ運ぶ", "調・庸（布や特産物で納める税）を都まで背負って運ぶ運脚の番が回ってきました。往復の食料は、出す側の負担とされています。", [
    { label: "自分で運ぶ", desc: "体↓ 都が見られる 帰り道が危ない", apply: (st) => { adj(st, { hp: -6, en: 2 }); addRisk(st, 0.02, "運脚の帰り道", "食料が尽きたのは、故郷まであと三日のところでした。"); return ["調を背負って都まで運びました。朱雀大路の広さに驚きました。"]; } },
    { label: "米を払って代わりの者に頼む", desc: "財↓", apply: (st) => { adj(st, { w: -1.2 }); return ["米を払って、代わりの者に運ばせました。"]; } }
  ], "『養老令』賦役令／『続日本紀』和銅5年正月条（帰路に飢える役民）") },
  { id: "kaikon", once: true, when: (s) => s.st === "nomin", build: (s) => ev("荒れ地の開墾", "村はずれの荒れ地を、村の皆で開こうという話が持ち上がりました。", [
    { label: "加わる", desc: "体↓ 以後ずっと財↑", apply: (st) => { adj(st, { hp: -5, en: 2 }); st.flags.konden = (st.flags.konden || 0) + 0.15; return ["開墾に加わりました。手のひらの皮が三回むけたころ、新しい田ができました。"]; } },
    { label: "加わらない", desc: "縁↓", apply: (st) => { adj(st, { en: -3 }); return ["加わりませんでした。新しい田の分け前の話には、呼ばれませんでした。"]; } }
  ], "墾田永年私財法（『続日本紀』天平15年）") },
  { id: "ichi", when: (s) => s.st !== "kyomin", build: (s) => ev("国府の市", "麻布と塩を交換しに、国府の近くの市まで行こうか迷っています。", [
    { label: "市へ行く", desc: "財が増えるか減るか", apply: (st) => { const g = rnd(-0.5, 0.9); adj(st, { w: g, en: 1 }); return [g >= 0 ? "市で、いい取引ができました。" : "市で、よく分からない壺を買わされました。"]; } },
    { label: "行かない", desc: "変化なし", apply: () => ["行きませんでした。"] }
  ], "『日本霊異記』（諸国の市の話）") },
  { id: "fune", when: (s) => s.st === "gyomin" && s.region === "kyushu", build: (s) => ev("沖の大船", "博多の沖に、大きな唐船が見えます。", [
    { label: "舟を出して近づく", desc: "取引できれば儲け", apply: (st) => { if (R() < 0.6) { adj(st, { w: 1.5 }); return [merchant(st.year) + "の船でした。魚と引き換えに、珍しい陶器をもらいました。役所に知られたら、たぶん怒られます。"]; } adj(st, { w: -0.3 }); return ["近づきすぎて、大宰府の役人に追い払われました。交易は、鴻臚館を通すのが決まりです。"]; } },
    { label: "浜から眺める", desc: "何もしない", apply: () => ["浜から眺めました。あの船の荷は、都の貴族の「唐物」になるそうです。"] }
  ], "大宰府鴻臚館の交易（福岡市の調査報告ほか）") },
  { id: "kaizoku", when: (s) => s.st === "gyomin" && s.region === "saigoku", build: (s) => ev("海賊の噂", "瀬戸内に海賊が出ると噂です。明日は遠くの漁場まで出る予定でした。", [
    { label: "予定どおり舟を出す", desc: "財↑ 危険", apply: (st) => { adj(st, { w: 0.8 }); addRisk(st, 0.04, "海賊に襲われて", "見慣れない舟が、島陰から出てきました。"); return ["舟を出しました。"]; } },
    { label: "しばらく近くの浜で漁をする", desc: "財↓", apply: (st) => { adj(st, { w: -0.3 }); return ["近場で漁をしました。獲れたのは小魚ばかりでした。"]; } }
  ], "『日本紀略』承平・天慶年間の海賊の記事") },
  { id: "shio", when: (s) => s.st === "gyomin", build: (s) => ev("塩焼き", "浜で塩を焼く仕事を手伝わないかと誘われました。", [
    { label: "手伝う", desc: "財↑ 体↓", apply: (st) => { adj(st, { w: 0.8, hp: -3 }); return ["海水を煮詰めて、塩を焼きました。煙が目にしみました。"]; } },
    { label: "断る", desc: "変化なし", apply: () => ["断りました。"] }
  ], "『延喜式』主計寮（調としての塩）") },
  { id: "rajomon", once: true, when: (s) => s.region === "kyo" && s.year < 980, build: (s) => ev("羅城門の噂", "荒れ果てた羅城門の楼上に、夜な夜な何かがいるという噂です。", [
    { label: "見に行く", desc: "怖いもの見たさ", apply: (st) => { adj(st, { toku: -1, en: 1 }); return ["楼上では、白髪の老婆が若い女の亡骸から髪を抜いていました。かつらにして売るのだそうです。"]; } },
    { label: "やめておく", desc: "近づかない", apply: () => ["やめておきました。賢明です。"] }
  ], "『今昔物語集』巻29第18話") },
  { id: "utage", when: (s) => s.region === "kyo", build: (s) => ev("屋敷の下働き", "貴族の屋敷で、大饗（宴）の下働きの人手を探しています。", [
    { label: "働きに行く", desc: "財↑", apply: (st) => { adj(st, { w: 0.6 }); return [R() < 0.4 ? "働きました。帰りに、宴の残りの唐菓子（からくだもの）をもらいました。" : "働きました。宴の間じゅう、庭で松明を持って立っていました。"]; } },
    { label: "行かない", desc: "変化なし", apply: () => ["行きませんでした。"] }
  ], "『和名類聚抄』（唐菓子）") },
  { id: "mikkoku", when: (s) => s.region === "kyo", build: (s) => ev("検非違使の手先", "検非違使の手先（放免）が、盗人の居場所を教えれば褒美をやると言っています。心当たりがあります。", [
    { label: "教える", desc: "財↑ 縁↓ 恨まれるかも", apply: (st) => { adj(st, { w: 1, en: -3 }); addRisk(st, 0.02, "密告の報復", "夜道で、後ろから声をかけられました。"); return ["教えました。褒美の米は、思ったより少なめでした。"]; } },
    { label: "黙っている", desc: "変化なし", apply: () => ["黙っていました。この街では、それが長生きの秘訣です。"] }
  ], "『今昔物語集』（放免の登場する話）") }
];

/* ---------------- 1年の処理 ---------------- */
function hpMult(s) { return clamp(1.6 - s.hp / 80, 0.45, 1.8); }

function prepareYear(s) {
  const a = s.age, q = s.queue;
  s.branchThisYear = false;
  const m = s.sex === "m";
  // 元服・裳着
  if (a === 12 && (isNoble(s) || s.st === "kanjin") && !s.flags.genpuku) { q.push(chGenpuku(s)); s.branchThisYear = true; }
  // 庶民の一人前
  if (a === 15 && ["nomin", "gyomin", "gozoku"].includes(s.st) && !s.flags.coming) { q.push(chComing(s)); s.branchThisYear = true; }
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
    else if (isOfficial(s) && s.rank >= 9 && s.rank <= 13 && s.juryo === 0 && a >= 28 && (s.flags.juryoAsked || -99) <= a - 8 && R() < 0.12 + s.en / 500) { s.flags.juryoAsked = a; q.push(chJuryo(s)); s.branchThisYear = true; }
    // 結婚
    else if ((!s.married || (!s.spouseAlive && s.flags.widowedAt != null && a - s.flags.widowedAt >= 1)) && s.st !== "so" && a >= (s.sex === "f" ? 13 : 15) && a <= (s.marriages > 0 ? 48 : 40) && !s.kokumo && R() < marryChance(s)) { q.push(chMarry(s)); s.branchThisYear = true; }
    // 庶民の出来事（選択式）
    else if (a >= 14 && ["nomin", "gyomin", "kyomin", "gozoku", "furo"].includes(s.st) && R() < 0.2) {
      const pool = SMALL.filter(e => e.when(s) && !(s.flags["ev_" + e.id] && e.once));
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
  // 節目：過ごし方と財の使い道
  if (isMilestone(a)) {
    q.push(() => {
    const plans = plansFor(s);
    return {
      kind: "plan", title: "これからの過ごし方", lead: "数えで" + (a + 1) + "。この先" + (a < 15 ? "しばらく" : "の数年") + "を、どう過ごしますか。",
      options: plans.map(p => ({ label: p.label, desc: p.desc, apply: (st) => { st.plan = p; st.planAge = st.age; return ["この先しばらくは「" + p.label + "」と決めました。"]; } }))
    };
    });
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
  const a = s.age, e = (s.plan && s.plan.eff) || {};
  const before = { hp: s.hp, sai: s.sai, en: s.en, toku: s.toku };

  // 過ごし方の効果
  if (s.plan && a >= 3) {
    adj(s, { hp: e.hp || 0, sai: e.sai || 0, en: e.en || 0, toku: e.toku || 0 });
    if (e.risk) addRisk(s, e.risk, e.riskC, e.riskD);
    if (e.nyobo && s.sex === "f" && !s.flags.nyobo && R() < 0.25 + s.en / 200 + (s.flags.wantNyobo ? 0.2 : 0)) { s.flags.nyobo = 1; log(s, "女房として宮中に出仕することになりました。「" + pick(["式部", "少納言", "中納言", "宰相", "侍従", "衛門", "右近", "小式部", "伊勢", "大輔"]) + "」と呼ばれます。本名で呼ばれることは、もうありません。", "good"); }
    if (e.free && R() < e.free) { s.st = "nomin"; s.wealth = 0; log(s, "長年の働きを認められ、主人から解放されました。今日からは、税を払う側です。", "good"); }
    if (e.bu && s.sex === "m" && s.st === "gozoku" && s.year >= 900 && R() < 0.06) { s.st = "bushi"; log(s, "一族を率いる武士として、名が知られるようになりました。", "good"); }
  }

  // 経済
  const d2 = STATUS[s.st];
  let inc = d2.income * rnd(0.75, 1.25);
  if (s.st === "so" && s.flags.nobleMonk) inc = 35 * rnd(0.8, 1.2);
  if (s.st === "kouzoku" && !s.flags.shisei && s.sex === "m") inc = d2.income;
  if (isOfficial(s)) inc += rankIncome(s.rank);
  if (s.juryo > 0) inc += 150 * rnd(0.5, 1.5);
  if (s.flags.ox) inc += 0.7;
  if (s.flags.konden) inc += 3 * s.flags.konden;
  if (s.flags.nyobo) inc += 6;
  if (e.inc) inc *= (1 + e.inc);
  if (e.gamble) inc *= rnd(0.3, 2.0);
  let up = d2.upkeep;
  if (s.st === "so" && s.flags.nobleMonk) up = 22;
  if (s.juryo > 0) up += 60;
  const kids = s.children.filter(c => c.alive && s.year - c.y < 15).length;
  up += kids * (isNoble(s) ? 2 : (s.st === "gozoku" || s.st === "bushi" ? 0.8 : 0.22));
  if (s.flags.kishin) inc *= 0.85;
  s.wealth += inc - up;
  if (s.flags.suikoDebt) { s.wealth -= s.flags.suikoDebt; s.flags.suikoDebt = 0; }
  // 出挙（借りの利息）
  if (s.wealth < 0 && s.st !== "genin") {
    if (!s.flags.suiko) { s.flags.suiko = 1; log(s, "食べる米が尽き、国府から稲を借りました（出挙）。利息は年3割です。", "bad", "『養老令』雑令／弘仁元年（810）以降の公出挙の利率"); }
    s.wealth = Math.max(s.wealth * 1.3, -25 * sc(s));
    if (s.wealth < -1) adj(s, { hp: -2 });
  }
  if (s.st === "genin") s.wealth = 0;

  // 受領の任期
  if (s.juryo > 0) {
    if (R() < 0.07) { adj(s, { en: -8 }); s.juryo = 0; log(s, "任国の郡司と百姓に、苛政を朝廷へ訴えられました。任期途中で解任です。蓄えた財は、そのまま持ち帰りました。", "bad", "『尾張国郡司百姓等解文』"); }
    else { s.juryo--; if (s.juryo === 0) log(s, "受領の任期を終えて帰京しました。行きは牛車一台、帰りは荷車が十数台でした。", "good"); }
  }

  // 史実
  for (const h of HIST) {
    if (!histMatch(h, s)) continue;
    log(s, h.t, h.k || "hist", h.src);
    if (h.epi) epidemic(s, h.epi);
    if (h.fx) h.fx(s);
    if (s.forceDeath) break;
  }
  // 源平合戦
  if (s.flags.genpei && s.year >= 1180 && s.year <= 1185 && !s.forceDeath) {
    const g = s.flags.genpei;
    if (g !== "mi") addRisk(s, (s.plan && s.plan.eff.war ? 0.05 : 0.08), "治承・寿永の乱", g === "heike" ? "富士川で水鳥の羽音に驚いて逃げた側でした。逃げきれませんでした。" : "倶利伽羅峠か、一ノ谷か。どこで倒れたのか、記録には残っていません。");
    if (s.year === 1185) {
      if (g === "heike") { log(s, "平家が壇ノ浦で滅びました。あなたは、負けた側です。", "bad"); addRisk(s, 0.45, "壇ノ浦の戦い", "最後は、海の底に都があると言われて飛び込みました。"); s.flags.genpei = "lost"; }
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
      if (!ev.when(s)) continue;
      if (R() < ev.p) { const b = s.yearLogs.length; ev.fx(s); n++; if (ev.src) for (let i = b; i < s.yearLogs.length; i++) if (!s.yearLogs[i].src) s.yearLogs[i].src = ev.src; }
    }
  }

  // 出世（除目）
  if (isOfficial(s) && s.age >= 15 && !s.forceDeath) promote(s);

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
    else if (s.rank === 14) log(s, RANKS[s.rank] + "に叙され、公卿の仲間入りを果たしました。この国で、上から数十人の一人です。", "good");
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
      s.spouseAlive = false; s.flags.widowedAt = s.age; s.flags.lastLoss = "death";
      log(s, (s.sex === "m" ? "妻" : "夫") + "が亡くなりました。", "bad"); adj(s, { hp: -3 });
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
        s.children.push({ y: s.year, sex, alive: true });
        const n = s.children.length;
        if (s.sex === "f") {
          log(s, kanjiNum(n) + "人目の子（" + (sex === "m" ? "男" : "女") + "）を産みました。", "good");
          if (R() < 0.016 * hpMult(s)) addRisk(s, 1, "お産（産褥）", "産屋では僧たちが物の怪を祓う読経を続けていました。祓うべきものは、別のところにありました。");
          adj(s, { hp: -2 });
        } else {
          log(s, kanjiNum(n) + "人目の子（" + (sex === "m" ? "男" : "女") + "）が生まれました。", "good");
          if (R() < 0.016) { s.spouseAlive = false; s.flags.widowedAt = s.age; s.flags.lastLoss = "death"; log(s, "妻はお産のあと、そのまま亡くなりました。", "bad"); }
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
      log(s, kanjiNum(i + 1) + "人目の子が、数えで" + kazoe(ca + 1) + "で亡くなりました。", "bad");
      adj(s, { hp: -2 });
    }
  });
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
  curLabel, fmtW, kanjiNum, isMilestone
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.Heian = api;

})(typeof window !== "undefined" ? window : globalThis);
