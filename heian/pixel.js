/* =========================================================
   550万分の1 ― ドット絵の情景
   128×64 の論理ピクセルに、住まい・本人・家族・出来事を描く。
   絵はすべてこのゲーム用にコードで描いたもの。
========================================================= */
(function (root) {
"use strict";

const W = 128, H = 64, GROUND = 46, FEET = 60;

/* ---------- 人物のテンプレート ---------- */
// . 透明  h 髪  s 肌  c 衣  e 衣の差し色・帯・袈裟  k 烏帽子  p 袴  f 足  y おくるみ
const T = {
  mCommon: [
    "...h...",
    "..hhh..",
    "..sss..",
    "..sss..",
    ".ccccc.",
    "ccccccc",
    "s.cec.s",
    "..ccc..",
    "..ccc..",
    "..c.c..",
    "..s.s..",
    "..s.s..",
    ".ff.ff."
  ],
  fCommon: [
    "..hhh..",
    ".hhhhh.",
    ".hsssh.",
    ".hsssh.",
    ".hcccc.",
    "ccccccc",
    "s.cec.s",
    "..ccc..",
    "..ccc..",
    "..ccc..",
    "..ccc..",
    "..s.s..",
    ".ff.ff."
  ],
  mNoble: [
    "...kk..",
    "..kkk..",
    "..kkk..",
    "..sss..",
    "..sss..",
    ".ccccc.",
    "ccccccc",
    "ccccccc",
    "s.cec.s",
    ".ccccc.",
    ".ppppp.",
    ".ppppp.",
    ".pp.pp.",
    ".pp.pp.",
    ".ff.ff."
  ],
  fNoble: [
    "...hhh...",
    "..hhhhh..",
    "..hsssh..",
    "..hsssh..",
    "..hhccc..",
    ".chheccc.",
    "cchheeccc",
    "cchheeccc",
    "cchheeccc",
    "cchheeccc",
    "ccchheccc",
    "ccchheccc",
    "eeeeeeeee"
  ],
  monk: [
    "..sss..",
    ".sssss.",
    "..sss..",
    "..sss..",
    ".ccccc.",
    "cccceec",
    "s.cec.s",
    "..ecc..",
    "..ccc..",
    "..ccc..",
    "..ccc..",
    "..ccc..",
    ".ff.ff."
  ],
  child: [
    ".hhh.",
    ".sss.",
    ".sss.",
    "ccccc",
    "scecs",
    ".ccc.",
    ".s.s.",
    ".f.f."
  ],
  childF: [
    ".hhh.",
    "hsssh",
    "hsssh",
    "ccccc",
    "scecs",
    ".ccc.",
    ".s.s.",
    ".f.f."
  ],
  baby: [
    ".ss.",
    "yyyy",
    "yyyy"
  ]
};

const SKIN = "#e7c6a0", SKIN_D = "#c89c74", HAIR = "#1d1712", GRAY = "#d8d4cc";

/* 位袍の色：『養老令』衣服令の服色。1000年以降は四位以上を黒とする平安中期の慣行に合わせる */
function rankColor(rank, year) {
  if (rank >= 12 && year >= 1000) return "#262321";
  if (rank >= 16) return "#5b3a73";        // 一位：深紫
  if (rank >= 14) return "#8a6aa3";        // 二・三位：浅紫
  if (rank >= 12) return "#8e2a1e";        // 四位：深緋
  if (rank >= 9) return "#c2493a";         // 五位：浅緋
  if (rank >= 7) return "#3f6a3c";         // 六位：深緑
  if (rank >= 5) return "#6f9a63";         // 七位：浅緑
  if (rank >= 3) return "#2f4f78";         // 八位：深縹
  return "#6f8fb3";                         // 初位・無位：浅縹
}

function palette(p) {
  // p: {st, sex, rank, year, elder, nyobo}
  const hair = p.elder ? GRAY : HAIR;
  let c = "#b9a47c", e = "#7a6a4c", pa = "#8a7a5a", k = "#1d1a18";
  switch (p.st) {
    case "genin": c = "#8c7a5c"; e = "#5e5240"; break;
    case "furo": c = "#9a8d75"; e = "#6a5d48"; break;
    case "gyomin": c = "#a9a088"; e = "#3f5f78"; break;
    case "kyomin": c = "#a7b0b4"; e = "#5c6870"; break;
    case "gozoku": c = "#8a6a44"; e = "#4e3a24"; break;
    case "bushi": c = "#5d6e4c"; e = "#2e3a26"; pa = "#3f4a33"; break;
    case "eji": c = "#d6ccb0"; e = "#8e2a1e"; pa = "#8a7a5a"; break;
    case "so": c = "#3a3634"; e = "#8a6236"; break;
    case "kanjin": case "kizoku": case "kugyo": case "kouzoku":
      if (p.sex === "m") { c = rankColor(p.rank, p.year); e = "#e8e0cc"; pa = p.rank >= 9 ? "#6a4f7a" : "#d8d0bc"; }
      else { c = p.nyobo ? "#9e2f3a" : "#7a3a58"; e = "#c9a64a"; }
      break;
  }
  return { h: hair, s: SKIN, c, e, k, p: pa, f: p.st === "kizoku" || p.st === "kugyo" || p.st === "kouzoku" ? "#2a2420" : SKIN_D, y: "#e9e1cf" };
}

function sprite(ctx, rows, x, y, pal) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      ctx.fillStyle = pal[ch] || "#f0f";
      ctx.fillRect(x + i, y + r, 1, 1);
    }
  }
}

function isNobleSt(st) { return st === "kizoku" || st === "kugyo" || st === "kouzoku"; }

// 人物を描いて、幅を返す。feet は足元のy
function person(ctx, x, feet, p) {
  const pal = palette(p);
  let rows;
  if (p.age < 2) rows = T.baby;
  else if (p.age < 12) rows = p.sex === "f" ? T.childF : T.child;
  else if (p.st === "so") rows = T.monk;
  else if ((isNobleSt(p.st) || p.st === "kanjin") && p.sex === "m" && p.age >= 12) rows = T.mNoble;
  else if (isNobleSt(p.st) && p.sex === "f") rows = T.fNoble;
  else if (p.st === "bushi" || p.st === "gozoku" || p.st === "eji") rows = p.sex === "m" ? withHat(T.mCommon) : T.fCommon;
  else rows = p.sex === "m" ? T.mCommon : T.fCommon;
  const w = rows[0].length, h = rows.length;
  const top = feet - h + 1 + (p.elder ? 1 : 0);
  sprite(ctx, rows, x, top, pal);
  if (p.elder && p.age >= 12) { ctx.fillStyle = "#6b5236"; ctx.fillRect(x - 1, top + 5, 1, h - 5); }
  if (p.st === "bushi" && p.age >= 12 && p.sex === "m") {
    ctx.fillStyle = "#6b4a2a";
    for (let i = 0; i < 11; i++) ctx.fillRect(x + w + (i === 0 || i === 10 ? 0 : 1), top + 1 + i, 1, 1);
  }
  return { w, h, top };
}
function withHat(rows) {
  const r = rows.slice();
  r[0] = "..kkk..";
  r[1] = "..kkk..";
  return r;
}

/* ---------- 背景 ---------- */
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function tri(ctx, cx, top, half, bottom, c) {
  ctx.fillStyle = c;
  for (let y = top; y <= bottom; y++) {
    const k = (y - top) / Math.max(1, bottom - top);
    const hw = Math.round(half * k);
    ctx.fillRect(cx - hw, y, hw * 2 + 1, 1);
  }
}

function sky(ctx, fx) {
  let bands = ["#cfe0e6", "#dbe7e4", "#e8ecdc"];
  if (fx.dead) bands = ["#b9a7b8", "#d6b9a6", "#e6cfa8"];
  else if (fx.epi) bands = ["#b8b2c4", "#c8c2cc", "#d6d0d0"];
  else if (fx.famine) bands = ["#e6d7a8", "#ecdcae", "#efe2b8"];
  else if (fx.rain || fx.snow) bands = ["#a9b4ba", "#bcc4c6", "#cbd0cc"];
  else if (fx.fire || fx.war) bands = ["#d9b39a", "#e2c3a6", "#ead2b4"];
  rect(ctx, 0, 0, W, 16, bands[0]);
  rect(ctx, 0, 16, W, 14, bands[1]);
  rect(ctx, 0, 30, W, GROUND - 30, bands[2]);
  if (fx.famine && !fx.dead) { rect(ctx, 104, 6, 7, 7, "#f2d27a"); rect(ctx, 103, 8, 9, 3, "#f2d27a"); }
}

function mountains(ctx, region, fx) {
  const far = fx.snow ? "#c8ccd0" : "#a9b8a8", near = fx.snow ? "#dfe2e2" : "#8fa58c";
  const big = region === "togoku" || region === "michinoku";
  tri(ctx, 22, big ? 14 : 22, 30, GROUND, far);
  tri(ctx, 92, big ? 10 : 20, 38, GROUND, far);
  tri(ctx, 60, big ? 20 : 27, 26, GROUND, near);
  if (region === "michinoku" || fx.snow) { tri(ctx, 92, big ? 10 : 20, 6, (big ? 10 : 20) + 5, "#f4f4f2"); tri(ctx, 22, big ? 14 : 22, 5, (big ? 14 : 22) + 4, "#f4f4f2"); }
  if (fx.erupt) {
    const t = fx.t;
    for (let i = 0; i < 9; i++) { const yy = 9 - i * 1.2; rect(ctx, 90 + Math.round(Math.sin(t / 300 + i) * 2) - i % 3, Math.max(0, yy), 4 + (i % 3), 2, i < 2 ? "#d0562c" : "#6e6a66"); }
  }
}

function ground(ctx, kind, fx) {
  let g = "#9bb06a", g2 = "#86a05a";
  if (fx.snow) { g = "#eeeeea"; g2 = "#dcdedc"; }
  else if (fx.famine) { g = "#c4ac74"; g2 = "#b09a62"; }
  rect(ctx, 0, GROUND, W, H - GROUND, g);
  if (kind === "paddy") {
    const water = fx.flood ? "#7fa3b8" : (fx.famine ? "#a8915c" : "#8fae5c");
    for (let y = GROUND + 2; y < H; y += 3) {
      rect(ctx, 52, y, 76, 1, water);
      if (!fx.famine && !fx.flood && !fx.snow) for (let x = 54; x < W; x += 4) rect(ctx, x, y - 1, 1, 1, "#5f8a3a");
    }
  } else {
    for (let x = 3; x < W; x += 9) rect(ctx, x, GROUND + 3 + (x % 5), 2, 1, g2);
  }
  if (fx.flood) rect(ctx, 0, H - 5, W, 5, "#7fa3b8");
}

function hut(ctx, x, big) {
  const w = big ? 34 : 24;
  rect(ctx, x, GROUND - 10, w, 10, "#7a5c3c");
  rect(ctx, x + Math.floor(w / 2) - 2, GROUND - 7, 5, 7, "#3a2a1c");
  tri(ctx, x + Math.floor(w / 2), GROUND - (big ? 24 : 20), Math.floor(w / 2) + 3, GROUND - 10, "#a88d55");
  rect(ctx, x + Math.floor(w / 2) - 1, GROUND - (big ? 25 : 21), 3, 2, "#7a6438");
  if (big) { for (let i = -6; i < w + 10; i += 3) rect(ctx, x + i, GROUND - 5, 1, 5, "#6b5236"); rect(ctx, x - 6, GROUND - 4, w + 16, 1, "#6b5236"); }
}

function shinden(ctx, x) {
  // 寝殿造：檜皮葺の屋根、高床、蔀戸、池と松
  rect(ctx, x, GROUND - 12, 46, 9, "#c9b48c");
  for (let i = 0; i < 46; i += 5) rect(ctx, x + i, GROUND - 12, 1, 9, "#6b4a2a");
  rect(ctx, x, GROUND - 3, 46, 1, "#6b4a2a");
  for (let i = 1; i < 46; i += 6) rect(ctx, x + i, GROUND - 2, 1, 2, "#6b4a2a");
  rect(ctx, x - 3, GROUND - 16, 52, 4, "#5c4636");
  rect(ctx, x + 2, GROUND - 19, 42, 3, "#6d5442");
  rect(ctx, x + 8, GROUND - 20, 30, 1, "#4a382c");
  // 池
  rect(ctx, x + 4, GROUND + 4, 26, 4, "#89aabb");
  rect(ctx, x + 6, GROUND + 3, 22, 1, "#89aabb");
  // 松
  rect(ctx, x + 50, GROUND - 14, 2, 14, "#6b4a2a");
  rect(ctx, x + 46, GROUND - 18, 10, 3, "#3f6a3c");
  rect(ctx, x + 47, GROUND - 22, 8, 3, "#3f6a3c");
}

function machiya(ctx) {
  // 築地塀と京の家並み
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 16;
    rect(ctx, x, GROUND - 9, 14, 9, "#b8a17a");
    tri(ctx, x + 7, GROUND - 15, 9, GROUND - 9, "#6d5a46");
    rect(ctx, x + 5, GROUND - 6, 4, 6, "#3a2a1c");
  }
  rect(ctx, 52, GROUND - 6, 76, 6, "#d9c9a4");
  rect(ctx, 52, GROUND - 8, 76, 2, "#5c4a3a");
}

function temple(ctx) {
  rect(ctx, 6, GROUND - 11, 34, 11, "#8c5a3a");
  for (let i = 0; i < 34; i += 5) rect(ctx, 6 + i, GROUND - 11, 1, 11, "#5a3622");
  rect(ctx, 2, GROUND - 15, 42, 4, "#4c4440");
  rect(ctx, 8, GROUND - 18, 30, 3, "#4c4440");
  // 五重塔
  const tx = 47;
  for (let i = 0; i < 5; i++) {
    const y = GROUND - 6 - i * 6;
    rect(ctx, tx - 7 + i, y, 15 - i * 2, 2, "#4c4440");
    rect(ctx, tx - 3 + Math.floor(i / 2), y + 2, 7 - Math.floor(i / 2) * 2, 4, "#8c5a3a");
  }
  rect(ctx, tx, GROUND - 40, 1, 7, "#b59a4a");
}

function shore(ctx, fx) {
  rect(ctx, 0, GROUND, W, H - GROUND, "#d8c99c");
  rect(ctx, 70, GROUND - 4, 58, H - GROUND + 4, fx.rain ? "#6f8796" : "#7fa0b4");
  for (let x = 72; x < W; x += 7) rect(ctx, x + Math.round(Math.sin(fx.t / 400 + x) * 1), GROUND - 2 + (x % 3), 3, 1, "#cfe0e6");
  // 舟
  rect(ctx, 92, GROUND - 6, 16, 3, "#6b4a2a");
  rect(ctx, 94, GROUND - 3, 12, 1, "#4a3220");
}

function yakata(ctx) {
  hut(ctx, 8, true);
  rect(ctx, 46, GROUND - 22, 6, 22, "#6b4a2a");
  rect(ctx, 44, GROUND - 25, 10, 3, "#a88d55");
}

function ox(ctx, x) {
  const rows = ["n.......", "oo......", ".oooooo.", "ooooooo.", ".o.o.o.o", ".o.o.o.o"];
  sprite(ctx, rows, x, FEET - 5, { o: "#5a4030", n: "#e8e0cc" });
}
function horse(ctx, x) {
  const rows = [
    ".mo........",
    "mooo.......",
    "moooo......",
    "..oooooooo.",
    "..ooooooooo",
    "..ooooooo.m",
    "..o.o..o.o.",
    "..o.o..o.o.",
    "..d.d..d.d."
  ];
  sprite(ctx, rows, x, FEET - 8, { o: "#7a5236", m: "#2a1e16", d: "#2a1e16" });
}

function grave(ctx, x, small) {
  if (small) { rect(ctx, x, FEET - 1, 4, 2, "#8a7a5a"); rect(ctx, x + 1, FEET - 2, 2, 1, "#8a7a5a"); rect(ctx, x + 1, FEET - 5, 1, 3, "#cbb88e"); return; }
  rect(ctx, x, FEET - 2, 10, 3, "#8a7a5a");
  rect(ctx, x + 2, FEET - 4, 6, 2, "#8a7a5a");
  rect(ctx, x + 4, FEET - 13, 2, 9, "#cbb88e");
  rect(ctx, x + 4, FEET - 13, 2, 1, "#8a7a5a");
}

/* ---------- 出来事の演出 ---------- */
function overlays(ctx, fx) {
  const t = fx.t;
  if (fx.rain || fx.flood) { ctx.fillStyle = "rgba(90,110,125,.55)"; for (let i = 0; i < 40; i++) { const x = (i * 37 + Math.floor(t / 40)) % W, y = (i * 23 + Math.floor(t / 25)) % H; ctx.fillRect(x, y, 1, 3); } }
  if (fx.snow) { ctx.fillStyle = "#ffffff"; for (let i = 0; i < 34; i++) { const x = (i * 41 + Math.floor(Math.sin(t / 600 + i) * 3)) % W, y = (i * 19 + Math.floor(t / 90)) % H; ctx.fillRect(x, y, 1, 1); } }
  if (fx.fire) { for (let i = 0; i < 10; i++) { const h = 4 + ((i * 7 + Math.floor(t / 120)) % 6); ctx.fillStyle = i % 2 ? "#e0702c" : "#f2b23c"; ctx.fillRect(8 + i * 4, GROUND - 14 - h, 3, h); } }
  if (fx.epi) { ctx.fillStyle = "rgba(120,90,150,.45)"; for (let i = 0; i < 26; i++) { const x = (i * 29 + Math.floor(t / 70)) % W, y = 10 + (i * 13 + Math.floor(Math.sin(t / 500 + i) * 4)) % 40; ctx.fillRect(x, y, 2, 1); } }
  if (fx.war) { for (let i = 0; i < 4; i++) { const x = 100 + i * 6; rect(ctx, x, GROUND - 18, 1, 18, "#5a4030"); rect(ctx, x + 1, GROUND - 18, 4, 5, i % 2 ? "#e9e4d6" : "#b5321e"); } ctx.fillStyle = "#3a2a1c"; for (let i = 0; i < 5; i++) { const x = (Math.floor(t / 30) + i * 25) % W; ctx.fillRect(x, 8 + i * 5, 5, 1); } }
  if (fx.fest) { ctx.fillStyle = "#b5321e"; for (let i = 0; i < 6; i++) { const y = 18 + ((i * 9 + Math.floor(t / 150)) % 14); ctx.fillRect(96 + i * 5, y, 2, 2); } rect(ctx, 112, FEET - 8, 6, 6, "#8c5a3a"); rect(ctx, 113, FEET - 7, 4, 4, "#e9e4d6"); }
  if (fx.birth) { ctx.fillStyle = "#e8b0b8"; for (let i = 0; i < 5; i++) { const x = 40 + i * 9 + Math.round(Math.sin(t / 300 + i) * 2), y = 14 + ((i * 5 + Math.floor(t / 200)) % 10); ctx.fillRect(x, y, 2, 2); } }
}

/* ---------- 全体 ---------- */
function homeKind(s) {
  if (s.st === "so") return "temple";
  if (s.st === "bushi") return "yakata";
  if (isNobleSt(s.st)) return "shinden";
  if (s.st === "gyomin") return "shore";
  if (s.region === "kyo") return "machiya";
  if (s.st === "gozoku") return "bighut";
  return "hut";
}

function draw(ctx, s, fx) {
  fx = fx || {};
  fx.t = fx.t || 0;
  ctx.save();
  if (fx.quake) ctx.translate(Math.round(Math.sin(fx.t / 30) * 1), 0);
  sky(ctx, fx);
  const kind = homeKind(s);
  if (kind !== "machiya" && kind !== "shinden") mountains(ctx, s.region, fx);
  if (kind === "shore") shore(ctx, fx);
  else ground(ctx, kind === "hut" || kind === "bighut" ? "paddy" : "plain", fx);
  if (kind === "hut") hut(ctx, 10, false);
  else if (kind === "bighut") hut(ctx, 6, true);
  else if (kind === "shinden") shinden(ctx, 4);
  else if (kind === "machiya") machiya(ctx);
  else if (kind === "temple") temple(ctx);
  else if (kind === "yakata") yakata(ctx);
  else if (kind === "shore") hut(ctx, 8, false);

  // 墓（先立った家族）
  let gx = 2;
  const graves = (s.flags.spouseDeaths || 0) + s.children.filter(c => !c.alive).length + (s.flags.kinDeaths || 0);
  for (let i = 0; i < Math.min(graves, 7); i++) { grave(ctx, gx, true); gx += 5; }

  // 家畜
  if (s.flags.ox && kind === "hut") ox(ctx, 36);
  if (s.st === "bushi" && !s.flags.rodo) horse(ctx, 38);

  // 家族
  const age = fx.age != null ? fx.age : s.age;
  const year = fx.year != null ? fx.year : s.year;
  const baseP = { st: s.st, rank: s.rank, year, nyobo: s.flags.nyobo };
  // 一緒に暮らす親・祖父母（祖父母 → 父母の順に、本人の左へ）
  const H = root.Heian;
  const elders = (H && H.kinAtHome ? H.kinAtHome(s) : []).slice().sort((a, b) => (a.side ? 0 : 1) - (b.side ? 0 : 1)).slice(0, 4);
  let x = elders.length ? Math.max(24, 52 - elders.length * 10) : 52;
  for (const k of elders) {
    const kst = k.st === "kouzoku" ? "kugyo" : k.st;
    const kr = kst === "kugyo" ? 14 : kst === "kizoku" ? 9 : kst === "kanjin" ? 5 : 0;
    const kp = person(ctx, x, FEET, { st: kst, rank: kr, year, sex: k.sex, age: Math.max(18, k.age), elder: k.age >= 55, nyobo: false });
    x += kp.w + 2;
  }
  if (fx.dead) {
    grave(ctx, x - 2, false);
  } else {
    const me = person(ctx, x, FEET, Object.assign({}, baseP, { age, sex: s.sex, elder: age >= 55 }));
    if (Math.floor(fx.t / 500) % 2 === 0) { ctx.fillStyle = "#b5321e"; ctx.fillRect(x + Math.floor(me.w / 2) - 1, me.top - 4, 3, 1); ctx.fillRect(x + Math.floor(me.w / 2), me.top - 3, 1, 1); }
    x += me.w + 2;
  }
  if (fx.dead) x += 12;
  if (s.married && s.spouseAlive && s.st !== "so") {
    const spSt = s.st === "genin" ? "genin" : (isNobleSt(s.st) || s.st === "kanjin" ? s.st : s.st);
    const sp = person(ctx, x, FEET, { st: spSt, rank: Math.max(0, s.rank - 1), year, sex: s.sex === "m" ? "f" : "m", age: Math.max(16, age), elder: age >= 55, nyobo: false });
    x += sp.w + 3;
  }
  const kids = s.children.filter(c => c.alive && !c.out).slice(-7);
  for (const c of kids) {
    const ca = year - c.y;
    if (ca < 0) continue;
    const st = isNobleSt(s.st) || s.st === "kanjin" ? s.st : (s.st === "so" ? "nomin" : s.st);
    const k = person(ctx, x, FEET, { st, rank: 0, year, sex: c.sex, age: ca, elder: false });
    x += k.w + 2;
    if (x > W - 6) break;
  }
  overlays(ctx, fx);
  ctx.restore();
}

/* 1年分の記録から、演出の種類を読み取る */
function fxFromLogs(logs) {
  const t = logs.map(l => l.t + (l.src || "")).join("\n");
  return {
    fire: /火が出|大火|焼け落ち|丸焼け|焼かれ/.test(t),
    epi: /疫病|疱瘡|赤斑瘡|咳病が流行|はやり/.test(t),
    famine: /飢饉|日照り|飢え|虫の害/.test(t),
    flood: /あふれ|洪水|田が流され/.test(t),
    rain: /長雨|嵐|暴風/.test(t),
    snow: /大雪|雪が降/.test(t),
    quake: /地震|噴火|津波/.test(t),
    erupt: /噴火/.test(t),
    war: /乱|合戦|戦い|戦が|刀伊|海賊|小競り合い/.test(t),
    fest: /田楽|祭|歌合|大饗|宴/.test(t),
    birth: /人目の子（/.test(t)
  };
}

const api = { draw, fxFromLogs, W, H, rankColor };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.HeianPixel = api;
})(typeof window !== "undefined" ? window : globalThis);
