'use strict';
// ===== UI・入力・メインループ =====
const $ = id => document.getElementById(id);
let tab = 'sel', moveMode = false, diploSel = -1, lastPanelHTML = '', modalQueue = [], startSel = -1, startCheat = 'admin', startDiff = 'normal', startCfg = Object.assign({}, AI_PRESETS.normal);
hooks.fx = (kind, pid, text) => { addFx(kind, pid, text); sfx(kind); };
// 足りない資源の理由
function need(have, cost, label) { return have >= cost ? null : `${label}があと${Math.ceil(cost - have)}必要`; }

// ---------- ログ ----------
hooks.log = (text, cls = 'info') => {
  S.log.push({ day: S.day, text, cls });
  if (S.log.length > 80) S.log.shift();
  renderLog();
};
function renderLog() {
  const items = S.log.slice(-7);
  $('log').innerHTML = items.map((l, i) => `<div class="${l.cls}${i < items.length - 4 ? ' old' : ''}"><small>${dateStr(l.day).replace(/^\d+年/, '')}</small>${esc(l.text)}</div>`).join('');
}

// ---------- モーダル ----------
hooks.modal = (m) => { modalQueue.push(m); if (modalQueue.length === 1) showModal(); };
function closeModal() { modalQueue.shift(); $('modal-wrap').classList.add('hidden'); mapDirty = true; refresh(true); if (modalQueue.length) showModal(); }
function showModal() {
  const m = modalQueue[0];
  if (!m) { $('modal-wrap').classList.add('hidden'); return; }
  $('modal').innerHTML = `<h2>${m.title}</h2><div class="mbody">${m.body}</div><div class="mbtns">${(m.buttons || [{ label: 'OK' }]).map((b, i) =>
    `<button data-mi="${i}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}${b.desc ? `<small>${esc(b.desc)}</small>` : ''}</button>`).join('')}</div>`;
  $('modal-wrap').classList.remove('hidden');
  $('modal').classList.remove('ssr-flash');
  if (m.sound) sfx(m.sound); else if (/^✦/.test(m.title)) sfx('event'); else if (/^(⚔ 魔王討伐|🌑|👑)/.test(m.title)) sfx('levelup');
  if (m.mount) m.mount($('modal'));
  $('modal').querySelectorAll('[data-mi]').forEach(el => el.onclick = () => {
    const b = (m.buttons || [{}])[+el.dataset.mi];
    if (b.keep) { if (b.fn) b.fn(); return; }
    modalQueue.shift();
    $('modal-wrap').classList.add('hidden');
    if (b.fn) b.fn();
    mapDirty = true; refresh(true);
    if (modalQueue.length) showModal();
  });
}
hooks.gameOver = (victory) => {
  if (S.over) return;
  S.over = true; S.paused = true;
  if (!victory) {
    const alive = S.nations.filter(n => n.alive && !n.isMonster).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
    if (alive.length) {
      sfx('lose');
      hooks.modal({
        title: '☠ 滅亡……そして再転生', body: `${esc(nat(S.player).name)}は滅亡した。<br>しかし転生者の魂は消えない——女神の声が響く。<br>「もう一度だけ、別の国の君主として生きる機会を与えましょう」<br><br><span class="note">レベル・スキル・チートスキルは引き継がれる（将軍・顧問・秘宝は失われる）。</span><div class="plist" style="max-height:220px">${alive.map(({ n, d }) => `<label data-reb="${n.id}" style="cursor:pointer"><i class="dot" style="background:${rgb(n.color)}"></i><span>${esc(n.name)} <small style="color:var(--ink-3)">${RACES[n.race].name}</small></span><em>開発度 ${d}</em></label>`).join('')}</div>`,
        mount: (el) => el.querySelectorAll('[data-reb]').forEach(l => l.onclick = () => {
          const id = +l.dataset.reb; closeModal();
          if (rebirth(id)) { S.tut = null; focusCapital(prov(nat(id).capital)); select({ type: 'prov', id: nat(id).capital }); tab = 'nation'; hooks.fx('levelup', null, '再転生！'); refresh(true); }
        }),
        buttons: [{ label: '転生をあきらめる', fn: () => { S.over = false; showEnding(false); } }],
      });
      return;
    }
  }
  showEnding(victory);
};
function showEnding(victory) {
  S.over = true;
  const ranks = S.nations.filter(n => !n.isMonster && n.alive).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  const me = ranks.findIndex(r => r.n.id === S.player);
  const v = S.victories || {};
  const body = victory && me >= 0
    ? `王国暦${END_YEAR}年。転生から百年、${esc(nat(S.player).ruler.name)}の物語は伝説となった。<br><br>最終順位：<b>第${me + 1}位</b>（総開発度 ${ranks[me].d}）<br>達成：${[v.demon ? (nat(S.player).demonKing ? '魔界統一' : '魔王討伐') : null, v.hegemon ? '大陸の覇者' : null].filter(Boolean).join('、') || 'なし'}<br>君主レベル：${nat(S.player).ruler.lv}<br><br>${ranks.slice(0, 5).map((r, i) => `${i + 1}. ${esc(r.n.name)}（${r.d}）`).join('<br>')}`
    : `${esc(nat(S.player).name)}は滅亡した……。<br>転生者の物語はここで終わる。`;
  hooks.modal({ title: victory ? '👑 百年の覇道、完' : '☠ 滅亡', body, buttons: [{ label: '新しい大陸で転生しなおす', fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } }, { label: '地図を眺める' }] });
};

// ---------- トップバー ----------
function renderTop() {
  const n = S.player >= 0 ? nat(S.player) : null;
  $('date').textContent = '王国暦 ' + dateStr(S.day) + (S.started ? '・' + ERAS[eraOf()] : '');
  if (S.started && document.body.dataset.era !== String(eraOf())) document.body.dataset.era = eraOf();
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  $('btn-music').style.opacity = musicOn ? '1' : '.4';
  if (S.started) setMusicState(eraOf(), warsOf(S.player).length > 0);
  if (!n) return;
  const inc = calcIncome(n);
  $('tb-flag').style.background = rgb(n.color); $('tb-name').textContent = n.name;
  const set = (id, v, sm, cls) => { const el = $(id); el.querySelector('b').textContent = v; const s = el.querySelector('small'); if (s) { s.textContent = sm || ''; s.className = cls || ''; } };
  set('r-gold', fmt(Math.floor(n.gold)), (inc.net >= 0 ? '+' : '') + fmt(inc.net, 1), inc.net >= 0 ? 'pos' : 'neg');
  set('r-mp', fmtMen(n.manpower), '/' + fmtMen(maxManpower(n)));
  set('r-gov', Math.floor(n.gov), '+' + fmt(govIncome(n), 1), 'pos'); set('r-know', Math.floor(n.know), '+' + fmt(knowIncome(n), 1), 'pos');
  set('r-mana', Math.floor(n.mana), '+' + fmt(manaIncome(n), 1), 'pos');
  set('r-stab', (n.stab > 0 ? '+' : '') + (n.stab || 0));
  set('r-army', inc.regs, '/' + inc.fl, inc.regs > inc.fl ? 'neg' : '');
  $('btn-pause').classList.toggle('paused', S.paused);
  $('btn-pause').textContent = S.paused ? '▶' : '⏸';
  $('speed-dots').innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i <= S.speed ? 'on' : ''}"></i>`).join('');
  $('pausedtag').classList.toggle('hidden', !S.paused || !S.started || S.over);
  $('sp-dot').classList.toggle('hidden', !(n.sp > 0 && SKILLS.some(s => canLearn(n, s.id))));
}

// ---------- パネル共通 ----------
function renderPanel(force) {
  if (!S.started) return;
  document.querySelectorAll('.tabs button[data-act="tab"]').forEach(b => b.classList.toggle('on', b.dataset.arg === tab));
  const html = ({ sel: selPanel, nation: nationPanel, diplo: diploPanel, war: warPanel, econ: econPanel, hero: heroPanel, skill: skillPanel }[tab] || selPanel)();
  if (force || html !== lastPanelHTML) {
    const body = $('panel-body'), st = body.scrollTop;
    body.innerHTML = html; body.scrollTop = st; lastPanelHTML = html;
  }
}
const me = () => nat(S.player);
const natTag = (id) => id < 0 ? '<span class="chip">未開の地</span>' : `<span class="chip" data-act="nation" data-arg="${id}" style="cursor:pointer"><i class="dot" style="background:${rgb(nat(id).color)}"></i>${esc(nat(id).name)}</span>`;
function btn(act, arg, label, opts = {}) {
  const b = `<button class="btn ${opts.cls || ''}" data-act="${act}" data-arg="${arg}" ${opts.disabled ? 'disabled' : ''} ${opts.title ? `title="${esc(opts.title)}"` : ''}>${label}</button>`;
  if (opts.disabled && opts.why) return `<span class="bw">${b}<small class="why">${esc(opts.why)}</small></span>`;
  return b;
}
function relStatus(id) {
  const P = S.player, out = [];
  if (id === P) return '<span class="chip me">自国</span>';
  if (atWar(P, id)) out.push('<span class="chip war">戦争中</span>');
  if (nat(id).overlord === P) out.push('<span class="chip ally">属国</span>');
  else if (isAlly(P, id)) out.push('<span class="chip ally">同盟</span>');
  if (nat(id).overlord && nat(id).overlord !== P) out.push(`<span class="chip">${esc(nat(nat(id).overlord).short)}の属国</span>`);
  if (hasTruce(P, id)) out.push(`<span class="chip truce">休戦</span>`);
  return out.join('');
}
function relSpan(v) { v = Math.round(v); return `<span class="${v >= 0 ? 'rel-pos' : 'rel-neg'}">${v > 0 ? '+' : ''}${v}</span>`; }
const MOD_LABELS = { taxMod: '税収', prodMod: '生産', tradeMod: '商会収入', combat: '戦闘力', morale: '士気', inventCost: '発明コスト', devCost: '開拓コスト', buildCost: '建設費', govPts: '政務/月', knowPts: '前世の知識/月', manaPts: '魔力/月', mpMod: '人的資源', moveSpeed: '移動速度', siege: '包囲速度', unrest: '反乱', relMult: '関係改善', allyAccept: '同盟受諾', guilds: '商会枠', vsMonster: '対魔物', summonCost: '召喚コスト', annexCost: '併合コスト', devGrowth: '代官の発展', shipCost: '造船費', colonizeCost: '入植費', stabCost: '安定度費用', magePower: '魔導兵' };
function modsText(m) {
  return Object.entries(m || {}).map(([k, v]) => {
    const pct = !['govPts', 'knowPts', 'manaPts', 'unrest', 'allyAccept', 'guilds', 'morale'].includes(k);
    return `${MOD_LABELS[k] || k}${v > 0 ? '+' : ''}${pct ? Math.round(v * 100) + '%' : Math.round(v * 10) / 10}`;
  }).join('、');
}
function rarTag(r) { const R = RARITIES.find(x => x.id === r); return R ? `<span class="rar" style="background:${R.color}">${r}</span>` : ''; }
function charHTML(c, extra = '') {
  const icon = c.role === 'general' ? (c.summoned ? '⚔' : '🎖') : '📜';
  return `<div class="char"><div class="av">${icon}</div><div class="bd"><div class="nm2">${c.rarity ? rarTag(c.rarity) : ''}${esc(c.title)} ${esc(c.name)}</div>${c.desc ? `<div class="ds">${esc(c.desc)}</div>` : ''}${c.role === 'general' ? `<div class="pips">${['att', 'def', 'man', 'sie'].map((k, i) => `<span>${GEN_STAT_NAMES[i]}<b>${c[k]}</b></span>`).join('')}</div>` : ''}${Object.keys(c.mods || {}).length ? `<div class="md">${modsText(c.mods)}</div>` : ''}${extra}</div></div>`;
}

// ---------- 選択 ----------
function selPanel() {
  if (!S.sel) return `<p class="note" style="margin-top:20px;text-align:center">地図上の州・軍・艦隊をクリックしてください。<br><br>自国の州では開発・建設・徴兵・造船ができます。<br>軍を選んで右クリックで移動します。</p>`;
  if (S.sel.type === 'army') { const a = S.armies.find(x => x.id === S.sel.id); if (a) return armyPanel(a); S.sel = null; return selPanel(); }
  if (S.sel.type === 'fleet') { const f = S.fleets.find(x => x.id === S.sel.id); if (f) return fleetPanel(f); S.sel = null; return selPanel(); }
  const p = prov(S.sel.id);
  return p.sea ? seaPanel(p) : provPanel(p);
}
function presenceList(pid) {
  const here = S.armies.filter(a => a.prov === pid), fl = S.fleets.filter(f => f.prov === pid);
  if (!here.length && !fl.length) return '';
  return `<h3>駐留部隊</h3><div class="rows">` +
    here.map(a => `<div class="row" data-act="army" data-arg="${a.id}"><i class="dot" style="background:${rgb(nat(a.owner).color)}"></i><span class="nm">${esc(a.name)}${isRogue(a.owner) ? '' : ' <small style="color:var(--ink-3)">' + esc(nat(a.owner).short) + '</small>'}</span><span class="num">${fmtMen(armyMen(a))}</span></div>`).join('') +
    fl.map(f => `<div class="row" data-act="fleet" data-arg="${f.id}"><i class="dot" style="background:${rgb(nat(f.owner).color)}"></i><span class="nm">⛵ ${esc(f.name)} <small style="color:var(--ink-3)">${esc(nat(f.owner).short)}</small></span><span class="num">戦${f.war} 輸${f.trans}</span></div>`).join('') + `</div>`;
}
function seaPanel(p) {
  const n = me();
  let h = `<h2>🌊 ${esc(p.name)}</h2><div class="sub"><span>海域</span>${p.lnb.length ? `<span>・沿岸 ${p.lnb.slice(0, 3).map(l => esc(prov(l).name)).join('、')}</span>` : ''}</div>`;
  h += `<p class="note">軍は輸送艦の数（1隻＝1連隊）まで海を渡れる。敵の戦列艦がいる海域には、味方の戦列艦がいないと入れない。</p>`;
  h += `<div class="kv" style="margin-top:6px"><span>自国の輸送能力</span><span>${regsAtSea(S.player)} / ${transportCap(S.player)} 連隊</span></div>`;
  return h + presenceList(p.id);
}
function provPanel(p) {
  const n = me(), mine = p.owner === S.player, ctrl = p.controller === S.player;
  let h = `<h2>${esc(p.name)}</h2><div class="sub">${natTag(p.owner)}<span>${TERRAIN[p.terrain].name}</span><span>・${GOODS[p.good].name}</span><span>・${RACES[p.race].name}</span><span>・${RELIGIONS[p.religion].name}</span>${p.id === (p.owner > 0 ? nat(p.owner).capital : -1) ? '<span class="chip">首都</span>' : ''}${p.coastal ? '<span class="chip">沿岸</span>' : ''}</div>`;
  if (p.owner >= 0 && p.controller !== p.owner) h += `<div class="warn">${esc(nat(p.controller).name)}に占領されている</div>`;
  if (p.siege) h += `<div class="warn">🏰 ${esc(nat(p.siege.by).name)}が包囲中 — ${Math.round(p.siege.prog / p.siege.need * 100)}%</div>`;
  if (p.coreUntil > S.day && p.owner >= 0) h += `<div class="note">未統合地（${START_YEAR + Math.floor(p.coreUntil / 360)}年まで収入・兵力半減）</div>`;
  if (p.owner > 0 && p.religion !== nat(p.owner).religion) h += `<div class="note">異教徒の州（収入-25%、不穏+3）</div>`;
  const capD = DEV_CAP + (p.owner > 0 && nat(p.owner).capital === p.id ? 10 : 0);
  h += `<h3>発展度 <small>${dev(p)} / ${capD}</small></h3><div class="meter"><i style="width:${dev(p) / capD * 100}%;background:var(--gold)"></i></div>`;
  if (mine) {
    const c = devCost(n, p), ci = investCost(n, p), full = p.dev >= capD;
    h += `<div class="btns full">${btn('dev', p.id, `🏗 開拓 <small class="cost-adm">政${c}</small>`, { disabled: n.gov < c || full, why: full ? '上限' : need(n.gov, c, '政務') })}${btn('invest', p.id, `💰 投資 <small>${ci}</small>`, { disabled: n.gold < ci || full || !ctrl, why: full ? '上限' : !ctrl ? '占領されている' : need(n.gold, ci, '金貨') })}</div><p class="note">発展度は代官を置くと毎月少しずつ伸びる。開拓（政務）や投資（金貨）で即座に上げることもできる。</p>`;
  }
  if (p.owner >= 0) {
    const inc = provIncome(p, nat(p.owner)), u = provUnrest(p);
    h += `<div class="kv" style="margin-top:8px"><span>要塞</span><span>${effFort(p) > 0 ? 'Lv' + effFort(p) : 'なし'}</span><span>月収（税＋生産）</span><span>${fmt(inc.tax + inc.prod, 2)}</span><span>不穏度</span><span class="${u > 0 ? 'rel-neg' : 'rel-pos'}">${u.toFixed(1)}${u > 0 ? '（反乱の危険）' : ''}</span></div>`;
  }
  // 代官
  if (p.owner > 0) {
    const gv = governorAt(p);
    h += `<h3>代官</h3>`;
    if (gv) h += charHTML(gv, `<div class="md">代官としての効果：${govEffect(gv).desc}${gv.rarity && gv.rarity !== 'R' && gv.rarity !== 'SR' ? '' : ''}</div>`);
    else h += `<p class="note" style="margin-top:0">代官がいない。${mine ? '異世界人や現地の人材を派遣すると、州が発展し特別な効果が得られる。' : ''}</p>`;
    if (mine) {
      const cands = [...n.bench, ...n.governors.filter(c => c !== gv), ...n.advisors];
      if (cands.length) h += `<select class="sel" data-change="gov" data-arg="${p.id}"><option value="">${gv ? '（代官を外す）' : '（派遣する人物を選ぶ）'}</option>${cands.map(c => `<option value="${c.id}">${c.rarity ? '[' + c.rarity + '] ' : ''}${esc(c.title)} ${esc(c.name)} — ${govEffect(c).desc}${c.pid != null ? '（' + esc(prov(c.pid).name) + 'から異動）' : n.advisors.includes(c) ? '（顧問から異動）' : ''}</option>`).join('')}</select>`;
      h += `<div class="btns" style="margin-top:5px">${btn('gov-native', p.id, `現地の代官を登用 <small class="cost-adm">政${NATIVE_GOV_COST}</small>`, { disabled: n.gov < NATIVE_GOV_COST, why: need(n.gov, NATIVE_GOV_COST, '政務') })}</div>`;
    }
  }
  // 商会
  if (p.owner >= 0) {
    const here = S.guilds.filter(g => g.pid === p.id);
    h += `<h3>商会 <small>自国 ${guildsOf(S.player).length} / ${maxGuilds(n)}</small></h3>`;
    if (here.length) h += here.map(g => `<div class="row" style="cursor:default"><i class="dot" style="background:${rgb(nat(g.owner).color)}"></i><span class="nm">⚖ ${esc(nat(g.owner).short)}の商会</span><span class="num">+${fmt(guildIncome(g), 2)}/月${guildLinks(g) ? '・連携' + guildLinks(g) : ''}</span></div>`).join('');
    if (!S.guilds.some(g => g.pid === p.id && g.owner === S.player)) {
      const est = guildIncome({ owner: S.player, pid: p.id }), c = guildCost(n), ok = canFoundGuild(S.player, p.id);
      const why = ok ? need(n.gold, c, '金貨') : guildsOf(S.player).length >= maxGuilds(n) ? '商会枠が足りない' : p.owner !== S.player ? (hostile(S.player, p.owner) ? '敵国' : '関係値25以上か同盟が必要') : '占領されている';
      h += `<div class="btns full" style="margin-top:4px">${btn('guild', p.id, `⚖ 商会を設立 <small>💰${c}・見込み+${fmt(est, 1)}/月</small>`, { cls: 'blue', disabled: !ok || n.gold < c, why })}</div>`;
    }
    h += `<p class="note">近く（2州以内か同じ海に面した港）にある自国の商会と連携すると収入が増える。他国の商会と隣り合うと競合で減る。友好国の州にも出店でき、相手国も税収を得る。開戦すると敵国内の商会は接収される。</p>`;
  }
  if (p.dungeon) {
    h += `<h3>ダンジョン <small>Lv${p.dungeon.lv}</small></h3>`;
    h += p.dungeon.cleared ? `<div class="okbox">🏆 攻略済み — 冒険者ギルドが生産収入+1/月をもたらす</div>`
      : `<div class="note">🕳 未踏のダンジョン。軍をこの州に置き「ダンジョン攻略」を命じると、財宝・魔力・秘宝が手に入るかもしれない（攻略日数 ${delveNeed(p.dungeon.lv)}日）。</div>`;
  }
  // 大建造物
  if (p.owner >= 0) {
    const w = wonderAt(p.id);
    const proj = S.nations.find(o => o.alive && o.project && o.project.pid === p.id);
    if (w) { const W = WONDER_BY_ID[w.id]; h += `<h3>大建造物</h3><div class="wonder done"><div class="wi">${W.icon}</div><div><b>${esc(W.name)}</b><small>${esc(W.desc)}</small><small class="fl">${START_YEAR + Math.floor(w.day / 360)}年、${esc(nat(w.owner).short)}が建造。現在は支配国が効果を得る。</small></div></div>`; }
    else if (proj) { const W = WONDER_BY_ID[proj.project.id]; h += `<h3>大建造物</h3><div class="wonder"><div class="wi">🏗</div><div><b>${esc(W.name)}（建設中）</b><small>${esc(nat(proj.id).short)}・残り${proj.project.need - proj.project.prog}か月</small><div class="meter"><i style="width:${proj.project.prog / proj.project.need * 100}%;background:var(--gold)"></i></div></div></div>`; }
    else if (mine) {
      const list = WONDERS.filter(W => !wonderBuilt(W.id));
      if (list.length) h += `<details class="wlist"><summary>🏛 大建造物を建てる（建造可能 ${list.filter(W => !wonderReq(n, W, p.id)).length} / 残り${list.length}種）</summary>${list.map(W => { const c = wonderCost(n, W), why = wonderReq(n, W, p.id); const other = S.nations.filter(o => o.alive && o.project && o.project.id === W.id && o.id !== S.player); return `<div class="wonder"><div class="wi">${W.icon}</div><div style="flex:1"><b>${esc(W.name)}</b><small>${esc(W.desc)}・${W.months}か月</small>${other.length ? `<small class="warnline">⚠ ${other.map(o => esc(o.short)).join('、')}が建設中</small>` : ''}${btn('wonder', W.id + ':' + p.id, `建設 💰${c}`, { cls: 'gold', disabled: !!why || n.gold < c, why: why || need(n.gold, c, '金貨') })}</div></div>`; }).join('')}</details>`;
    }
  }
  if (mine) {
    if (p.converting) h += `<div class="okbox">⛪ 改宗中（${dateStr(p.converting.until)}完了予定）</div>`;
    else if (canConvert(S.player, p.id)) h += `<div style="margin-top:6px">${btn('convert', p.id, `⛪ 宣教師を派遣（改宗） 💰${CONVERT_COST}`, { disabled: n.gold < CONVERT_COST, why: need(n.gold, CONVERT_COST, '金貨') })}</div>`;
    h += `<h3>建物</h3><div class="blist">`;
    for (const k in BUILDINGS) {
      const B = BUILDINGS[k], c = buildCost(n, k);
      h += p.b[k] ? `<div class="bitem done"><b>✓ ${B.name}</b><small>${B.desc}</small></div>`
        : `<div class="bitem"><b>${B.name}</b><small>${B.desc}</small>${btn('build', k, `建設 💰${c}`, { disabled: n.gold < c || !ctrl, why: !ctrl ? '占領されている' : need(n.gold, c, '金貨') })}</div>`;
    }
    h += `</div><h3>徴兵 <small>人的資源 ${fmtMen(n.manpower)}</small></h3>`;
    if (canRecruitAt(S.player, p.id)) {
      h += `<div class="btns full">`;
      for (const t in UNITS) h += btn('recruit', t, `${unitName(S.player, t)}<small>💰${UNITS[t].cost}</small>`, { disabled: n.gold < UNITS[t].cost || n.manpower < 1000, title: `1連隊(1000人) 維持費${UNITS[t].maint}/月 戦闘力${UNITS[t].power}`, why: need(n.gold, UNITS[t].cost, '金貨') || need(n.manpower, 1000, '人的資源') });
      h += `</div><p class="note">1連隊＝1000人。シフト＋クリックで5連隊まとめて徴兵。</p>`;
    } else h += `<p class="note">占領中または敵軍がいるため徴兵できない。</p>`;
    if (p.coastal) {
      h += `<h3>造船</h3><div class="btns full">${btn('ship', 'war', `戦列艦<small>💰${SHIPS.war.cost}</small>`, { disabled: n.gold < SHIPS.war.cost || !ctrl, title: '海戦・海上封鎖用。維持費0.5/月', why: !ctrl ? '占領されている' : need(n.gold, SHIPS.war.cost, '金貨') })}${btn('ship', 'trans', `輸送艦<small>💰${SHIPS.trans.cost}</small>`, { disabled: n.gold < SHIPS.trans.cost || !ctrl, title: '1隻で1連隊を運べる。維持費0.15/月', why: !ctrl ? '占領されている' : need(n.gold, SHIPS.trans.cost, '金貨') })}</div><p class="note">完成した艦は隣接する海域（${esc(prov(p.snb[0]).name)}）に配置される。</p>`;
    }
  } else if (p.owner < 0) {
    h += `<h3>入植</h3>`;
    if (p.colonizing) h += `<div class="okbox">⛺ ${esc(nat(p.colonizing.by).name)}が入植中（${dateStr(p.colonizing.until)}完了予定）</div>`;
    else if (canColonize(S.player, p.id)) { const c = colonizeCost(n); h += btn('colonize', p.id, `⛺ 入植する 💰${c}`, { cls: 'gold', disabled: n.gold < c, why: need(n.gold, c, '金貨') }) + `<p class="note">150日後に自国領となる。</p>`; }
    else h += `<p class="note">自国領に隣接する（または同じ海に面した）未開の地にのみ入植できる。</p>`;
  } else {
    h += `<h3>外交</h3><div class="btns">${btn('nation', p.owner, '国を見る')}${diploButtons(p.owner)}</div>`;
  }
  return h + presenceList(p.id);
}
function armyStatus(a) {
  if (S.battles[a.prov] && a.inBattle) return '<span class="chip war">⚔ 交戦中</span>';
  if (a.retreat) return '<span class="chip war">退却中</span>';
  if (a.delve) return `<span class="chip">🕳 ダンジョン攻略中 ${Math.round(a.delve.prog / a.delve.need * 100)}%</span>`;
  if (a.path.length) return `<span class="chip">→ ${esc(prov(a.path[a.path.length - 1]).name)}へ移動中</span>`;
  const p = prov(a.prov);
  if (p.sea) return '<span class="chip">⛵ 洋上</span>';
  if (p.siege && p.siege.by === a.owner) return `<span class="chip">🏰 包囲中 ${Math.round(p.siege.prog / p.siege.need * 100)}%</span>`;
  return '<span class="chip">待機中</span>';
}
function armyPanel(a) {
  const mine = a.owner === S.player, mm = maxMorale(a.owner);
  let h = `<h2>${a.hero ? '★ ' : ''}${esc(a.name)}</h2><div class="sub">${isRogue(a.owner) ? `<span class="chip war">${a.owner === REBEL ? '✊ 反乱軍' : '👹 魔物'}</span>` : natTag(a.owner)}<span>📍 <a data-act="prov" data-arg="${a.prov}" style="cursor:pointer;text-decoration:underline">${esc(prov(a.prov).name)}</a></span>${armyStatus(a)}</div>`;
  h += `<h3>士気 <small>${a.morale.toFixed(2)} / ${mm.toFixed(1)}</small></h3><div class="meter"><i style="width:${clamp(a.morale / mm, 0, 1) * 100}%;background:${a.morale / mm > .5 ? 'var(--good)' : 'var(--war)'}"></i></div>`;
  h += `<h3>編成 <small>総兵力 ${fmt(Math.round(armyMen(a)))}</small></h3><table class="unit-tbl"><tr><td style="color:var(--ink-3)">兵種</td><td style="color:var(--ink-3)">連隊</td><td style="color:var(--ink-3)">兵数</td></tr>`;
  for (const t in UNITS) if (a.regs[t] || a.men[t] > 1) h += `<tr><td>${isRogue(a.owner) ? '雑兵' : unitName(a.owner, t)}</td><td>${a.regs[t]}</td><td>${fmt(Math.round(a.men[t]))}</td></tr>`;
  h += `</table>`;
  if (!isRogue(a.owner)) h += `<div class="kv" style="margin-top:8px"><span>推定戦闘力</span><span>${armyPower(a).toFixed(1)}</span><span>戦闘力補正</span><span>${Math.round(combatMod(a, a.prov) * 100)}%</span></div>`;
  if (a.expire && isRogue(a.owner)) h += `<p class="note">${dateStr(a.expire)}頃に散り散りになる。</p>`;
  const g = genOf(a);
  if (!isRogue(a.owner)) {
    h += `<h3>指揮官</h3>`;
    if (mine) {
      const n = me();
      h += `<select class="sel" data-change="assign" data-arg="${a.id}"><option value="">（なし）</option>${n.generals.map(x => { const used = S.armies.find(b => b.gen === x.id && b.owner === S.player && b !== a); return `<option value="${x.id}" ${a.gen === x.id ? 'selected' : ''}>${x.rarity ? '[' + x.rarity + '] ' : ''}${esc(x.title)} ${esc(x.name)}（${x.att}/${x.def}/${x.man}/${x.sie}）${used ? ' ※' + esc(used.name) + 'から異動' : ''}</option>`; }).join('')}</select>`;
      if (!n.generals.length) h += `<p class="note">将軍がいない。「英雄」タブで任命・召喚できる。</p>`;
    }
    if (g) h += charHTML(g);
    else if (!mine) h += `<p class="note">指揮官なし</p>`;
  }
  if (mine) {
    const others = S.armies.filter(b => b !== a && b.owner === a.owner && b.prov === a.prov && !b.inBattle && !b.retreat);
    h += `<h3>命令</h3><div class="btns full">${btn('army-move', a.id, moveMode ? '移動先を選択中…' : '🚩 移動', { cls: 'gold', disabled: a.inBattle || a.retreat, why: a.inBattle ? '交戦中' : a.retreat ? '退却中' : null })}${btn('army-stop', a.id, '停止', { disabled: (!a.path.length && !a.delve) || a.retreat })}</div>
      <div class="btns full" style="margin-top:5px">${btn('army-split', a.id, '分割', { disabled: armyRegs(a) < 2 || a.inBattle, why: a.inBattle ? '交戦中' : armyRegs(a) < 2 ? '2連隊以上必要' : null })}${btn('army-merge', a.id, `統合${others.length ? '(' + others.length + ')' : ''}`, { disabled: !others.length || a.inBattle, why: !others.length ? '同じ州に自軍がいない' : a.inBattle ? '交戦中' : null })}${btn('army-disband', a.id, '解散', { cls: 'red', disabled: a.inBattle })}</div>`;
    const p = prov(a.prov);
    if (p.dungeon && !p.dungeon.cleared) h += `<div class="btns full" style="margin-top:5px">${btn('delve', a.id, `🕳 ダンジョン攻略（Lv${p.dungeon.lv}・${delveNeed(p.dungeon.lv)}日）`, { cls: 'gold', disabled: !canDelve(a), why: a.delve ? '攻略中' : a.inBattle ? '交戦中' : a.retreat ? '退却中' : '敵の支配地では攻略できない' })}<p class="note">成功率の目安：約${Math.round(clamp(0.3 + (armyPower(a) + (genOf(a) ? (genOf(a).att + genOf(a).def) * 1.5 : 0)) / (p.dungeon.lv * 6) * 0.35, 0.1, 0.95) * 100)}%（兵力・将軍で上がる）</p></div>`;
    h += `<p class="note">右クリック（スマホは「移動」→タップ）で移動先を指定。海域を指定すると輸送艦で渡海する。自国が支配する州にいると毎月兵が補充される。</p>`;
  }
  return h;
}
function fleetPanel(f) {
  const mine = f.owner === S.player;
  let h = `<h2>⛵ ${esc(f.name)}</h2><div class="sub">${natTag(f.owner)}<span>📍 ${esc(prov(f.prov).name)}</span>${f.inBattle ? '<span class="chip war">⚓ 海戦中</span>' : f.retreat ? '<span class="chip war">退却中</span>' : f.path.length ? `<span class="chip">→ ${esc(prov(f.path[f.path.length - 1]).name)}</span>` : '<span class="chip">停泊中</span>'}</div>`;
  h += `<h3>艦の状態 <small>${Math.round(f.str * 100)}%</small></h3><div class="meter"><i style="width:${f.str * 100}%;background:#7fc8f0"></i></div>`;
  h += `<table class="unit-tbl"><tr><td>${SHIPS.war.name}</td><td>${f.war}隻</td></tr><tr><td>${SHIPS.trans.name}</td><td>${f.trans}隻（${f.trans}連隊分）</td></tr></table>`;
  if (mine) {
    const others = S.fleets.filter(x => x !== f && x.owner === f.owner && x.prov === f.prov);
    h += `<h3>命令</h3><div class="btns full">${btn('fleet-move', f.id, moveMode ? '移動先を選択中…' : '🚩 移動', { cls: 'gold', disabled: f.retreat })}${btn('fleet-stop', f.id, '停止', { disabled: !f.path.length })}${btn('fleet-merge', f.id, '統合', { disabled: !others.length })}${btn('fleet-disband', f.id, '解体', { cls: 'red' })}</div>
      <p class="note">戦列艦は敵艦隊と戦い、隣接する敵の州を海上封鎖する（包囲速度+25%）。輸送艦は国全体の渡海能力になる。自国の沿岸にいると修理される。</p>`;
  }
  return h;
}
function diploButtons(id) {
  const P = S.player, n = me(), o = nat(id);
  if (id === P || id < 0 || isRogue(id) || !o.alive) return '';
  let h = '';
  h += btn('improve', id, `関係改善 <small class="cost-adm">政${improveRelCost()}</small>`, { disabled: n.gov < improveRelCost(), title: '政務を使って関係値を上げる', why: need(n.gov, improveRelCost(), '政務') });
  if (o.overlord === P) {
    const c = annexCost(n, o), ok = canAnnex(n, o);
    h += btn('annex', id, `👑 外交併合 <small class="cost-adm">政${c}</small>`, { cls: 'gold', disabled: !ok || n.gov < c, why: !ok ? (S.day - o.vassalSince < 360 * ANNEX_YEARS ? `${START_YEAR + Math.ceil((o.vassalSince + 360 * ANNEX_YEARS) / 360)}年から可能` : getRel(n.id, o.id) < 30 ? '関係値30以上が必要' : '戦争中は不可') : need(n.gov, c, '政務') });
  } else if (isAlly(P, id)) h += btn('unally', id, '同盟破棄');
  else if (!o.overlord) h += btn('ally', id, '同盟提案', { cls: 'blue', disabled: atWar(P, id) });
  if (!o.overlord && !isAlly(P, id) && !atWar(P, id)) h += btn('reqvassal', id, '属国化要求', { title: '国力差が4倍以上・開発度差が3倍以上・関係値30以上で受諾される' });
  if (!atWar(P, id) && o.overlord !== P) h += btn('declare', id, '⚔ 宣戦布告', { cls: 'red', disabled: isAlly(P, id) || hasTruce(P, id), why: isAlly(P, id) ? '同盟国には宣戦できない' : hasTruce(P, id) ? `休戦中（${START_YEAR + Math.ceil(n.truces[id] / 360)}年まで）` : null });
  return h;
}

// ---------- 国家 ----------
function nationPanel() {
  const n = me(), inc = calcIncome(n), c = CHEAT_BY_ID[n.cheat];
  let h = `<h2><i class="dot" style="background:${rgb(n.color)};width:16px;height:16px;margin-right:6px"></i>${esc(n.name)}</h2><div class="sub"><span>${RACES[n.race].name}</span><span>・${n.polity}</span><span>・${RELIGIONS[n.religion].name}</span><span>・首都 ${esc(prov(n.capital).name)}</span></div>`;
  h += `<h3>君主</h3><div class="ruler"><div class="portrait">👑</div><div><b style="font-family:var(--serif);font-size:15px">${esc(n.ruler.name)}</b> <span class="chip me">転生者 Lv${n.ruler.lv}</span><div class="stats3"><span>器量 ${n.ruler.cap}</span><span class="cost-adm">政務 +${fmt(govIncome(n), 1)}/月</span><span>📚 +${fmt(knowIncome(n), 1)}/月</span></div><div class="note" style="margin-top:2px">チート：<b style="color:var(--gold-2)">${c.name}</b> — ${c.desc}</div></div></div>`;
  const R = RACES[n.race];
  h += `<h3>種族特性 <small>${R.name}・${ERAS[eraOf()]}（第${eraOf() + 1}時代）</small></h3><div class="kv"><span>長所</span><span style="text-align:left">${R.pros}</span><span>短所</span><span style="text-align:left">${R.cons}</span></div><div class="note">${R.growDesc}。20年ごとに時代が進み、種族の差が広がっていく。</div>`;
  h += traitAndMissions(n, true);
  const co = coalitionOf(n.id);
  const aeList = S.nations.filter(o => o.alive && !o.isMonster && getAE(n.id, o.id) >= 10).sort((a, b) => getAE(n.id, b.id) - getAE(n.id, a.id));
  if (aeList.length) h += `<h3>警戒度 <small>50以上で対抗同盟に参加</small></h3>${co.length >= 2 ? `<div class="warn">⚠ ${co.length}か国が対抗同盟を組める状態にある。国力で上回られると一斉に宣戦される。</div>` : ''}<div class="btns" style="margin-top:4px">${aeList.slice(0, 10).map(o => `<span class="ae ${getAE(n.id, o.id) >= 50 ? 'hi' : ''}">${esc(o.short)} ${Math.round(getAE(n.id, o.id))}</span>`).join('')}</div><p class="note">警戒度は毎月少しずつ下がる。領土を奪うほど（特に近隣・同種族から）上がる。</p>`;
  if (n.timed.length) h += `<div class="note">一時効果：${n.timed.map(m => `${esc(m.label || m.key)}（${START_YEAR + Math.floor(m.until / 360)}年まで）`).join('、')}</div>`;
  h += `<h3>目標</h3>${objectives(n)}`;
  h += `<h3>安定度 <small>${n.stab > 0 ? '+' : ''}${n.stab}</small></h3><div class="note" style="margin-top:0">安定度が高いほど税収が増え、反乱が起きにくい。</div><div class="btns" style="margin-top:5px">${btn('stab', 0, `安定度を上げる <small class="cost-adm">政${stabCost(n)}</small>`, { disabled: n.gov < stabCost(n) || n.stab >= 3, why: n.stab >= 3 ? '最大値' : need(n.gov, stabCost(n), '政務') })}</div>`;
  h += `<h3>月次収支</h3><div class="kv"><span>税収</span><span>+${fmt(inc.tax, 2)}</span><span>生産</span><span>+${fmt(inc.prod, 2)}</span><span>商会</span><span>+${fmt(inc.trade, 2)}</span>${inc.tribute ? `<span>貢納金</span><span>${inc.tribute > 0 ? '+' : ''}${fmt(inc.tribute, 2)}</span>` : ''}<span>陸軍の維持費</span><span>−${fmt(inc.maint, 2)}</span><span>海軍の維持費</span><span>−${fmt(inc.navy, 2)}</span><span>建物の維持費</span><span>−${fmt(inc.bmaint, 2)}</span><span class="tot">収支</span><span class="tot ${inc.net >= 0 ? 'rel-pos' : 'rel-neg'}">${inc.net >= 0 ? '+' : ''}${fmt(inc.net, 2)}</span></div>`;
  if (inc.regs > inc.fl) h += `<div class="warn">維持限界を超えている：維持費が増大中</div>`;
  if (n.gold < 0) h += `<div class="warn">財政赤字：士気・人的資源の回復が低下し、不穏度+2</div>`;
  const vs = vassalsOf(n.id);
  h += `<h3>国力</h3><div class="kv"><span>州数</span><span>${ownedProvs(n.id).length}</span><span>総開発度</span><span>${inc.dev}</span><span>連隊 / 維持限界</span><span>${inc.regs} / ${inc.fl}</span><span>人的資源</span><span>${fmt(Math.round(n.manpower))} / ${fmt(maxManpower(n))}</span><span>属国</span><span>${vs.map(v => esc(v.short)).join('、') || 'なし'}</span><span>世界順位（開発度）</span><span>${worldRank()}位</span></div>`;
  h += `<h3>自軍・艦隊</h3><div class="rows">` + (S.armies.filter(a => a.owner === S.player).map(a => `<div class="row" data-act="army" data-arg="${a.id}"><span class="nm">${a.gen != null || a.hero ? '★' : ''}${esc(a.name)} <small style="color:var(--ink-3)">${esc(prov(a.prov).name)}</small></span><span class="num">${fmtMen(armyMen(a))}</span></div>`).join('') +
    S.fleets.filter(f => f.owner === S.player).map(f => `<div class="row" data-act="fleet" data-arg="${f.id}"><span class="nm">⛵ ${esc(f.name)} <small style="color:var(--ink-3)">${esc(prov(f.prov).name)}</small></span><span class="num">戦${f.war} 輸${f.trans}</span></div>`).join('') || '<p class="note">軍がない。州を選んで徴兵しよう。</p>') + `</div>`;
  h += `<h3>システム</h3><div class="btns full">${btn('save', 0, '💾 セーブ')}${btn('load', 0, '📂 ロード', { disabled: !hasSave() })}${btn('newgame', 0, '最初から', { cls: 'red' })}</div><p class="note">毎年1月1日に自動セーブされる。</p>`;
  return h;
}
function traitAndMissions(n, mine) {
  const T = NATION_TRAITS[n.polity]; if (!T) return '';
  let h = `<h3>固有特性 <small>${esc(n.polity)}</small></h3><div class="trait"><b>${esc(T.name)}</b><span>${esc(T.desc)}</span></div>`;
  const done = n.missionsDone || [];
  h += `<h3>国家目標 <small>${done.length} / ${missionsOf(n).length} 達成</small></h3>`;
  for (const M of missionsOf(n)) {
    const ok = done.includes(M.id), [cur, tgt] = M.prog(n), pct = clamp(cur / tgt, 0, 1);
    h += `<div class="mission ${ok ? 'done' : ''}"><div class="mi">${ok ? '✔' : '◇'}</div><div style="flex:1"><b>${esc(M.name)}</b><small>${esc(M.desc)}${ok ? '' : `（${fmt(Math.min(cur, tgt))} / ${fmt(tgt)}）`}</small>${ok ? '' : `<div class="meter"><i style="width:${pct * 100}%;background:var(--gold)"></i></div>`}<small class="rw">報酬：${esc(M.reward.label)}</small></div></div>`;
  }
  return h;
}
function objectives(n) {
  const v = S.victories || {};
  let all = 0; for (const p of S.provinces) if (p.owner > 0) all += dev(p);
  const share = Math.round(totalDev(n.id) / Math.max(1, all) * 100);
  const dk = S.nations.find(o => o.demonKing);
  const items = n.demonKing
    ? [[v.demon, '魔界統一', `人族の国家をすべて滅ぼす（残り${S.nations.filter(o => o.alive && !o.isMonster && o.race === 'human').length}国）`]]
    : [[v.demon, '魔王討伐', dk.alive ? `${esc(dk.name)}を自らの手で滅ぼす` : (S.demonKingSlayer === S.player ? '達成' : '魔王国は他国に滅ぼされた')]];
  items.push([v.hegemon, '大陸の覇者', `大陸の開発度の50%を支配する（現在${share}%）`]);
  items.push([false, '百年の繁栄', `${END_YEAR}年まで国を存続させ、上位を目指す`]);
  return items.map(([done, t, d]) => `<div class="objective ${done ? 'done' : ''}"><span class="ck">${done ? '✔' : '◇'}</span><span><b>${t}</b> <span class="note">${d}</span></span></div>`).join('');
}
function worldRank() {
  const r = S.nations.filter(n => !n.isMonster && n.alive).map(n => ({ id: n.id, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  return r.findIndex(x => x.id === S.player) + 1;
}

// ---------- 外交 ----------
function diploPanel() {
  const list = S.nations.filter(n => !n.isMonster && n.alive && n.id !== S.player).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  let h = `<h2>外交</h2><p class="note">関係値が高い国ほど同盟を受け入れやすい。同盟国は防衛戦争に参戦する。属国は貢納金（収入の15%）を納め、${ANNEX_YEARS}年後に外交併合できる。</p><div class="rows" style="margin-top:8px">`;
  for (const { n, d } of list) {
    h += `<div class="row ${diploSel === n.id ? 'on' : ''}" data-act="dsel" data-arg="${n.id}"><i class="dot" style="background:${rgb(n.color)}"></i><span class="nm">${esc(n.name)}</span>${relStatus(n.id)}${getAE(S.player, n.id) >= 10 ? `<span class="ae ${getAE(S.player, n.id) >= 50 ? 'hi' : ''}" title="我が国への警戒度">警戒${Math.round(getAE(S.player, n.id))}</span>` : ''}<span class="num">${relSpan(getRel(S.player, n.id))}</span></div>`;
    if (diploSel === n.id) {
      const pw = nationPower(n.id), mp = nationPower(S.player);
      h += `<div class="detail"><div class="kv"><span>種族・宗教</span><span>${RACES[n.race].name}・${RELIGIONS[n.religion].name}</span><span>固有特性</span><span title="${esc((NATION_TRAITS[n.polity] || {}).desc || '')}">${esc((NATION_TRAITS[n.polity] || {}).name || '—')}</span><span>国家目標</span><span>${(n.missionsDone || []).length} / ${missionsOf(n).length}</span><span>君主</span><span>${esc(n.ruler.name)}（器量${n.ruler.cap}）</span><span>発明</span><span>${n.inventions.length}種</span><span>商会</span><span>${guildsOf(n.id).length}軒</span><span>総開発度</span><span>${d}</span><span>軍勢</span><span>約${fmtMen(S.armies.filter(a => a.owner === n.id).reduce((s, a) => s + armyMen(a), 0))}（自国比 ${mp > 0 ? Math.round(pw / mp * 100) : '—'}%）</span><span>同盟国</span><span>${n.allies.map(i => esc(nat(i).short)).join('、') || 'なし'}</span><span>異世界人</span><span>${n.generals.filter(g => g.summoned).length + n.advisors.filter(c => c.summoned).length}人</span><span>戦争</span><span>${warsOf(n.id).length ? warsOf(n.id).map(w => esc(w.name)).join('、') : 'なし'}</span></div><div class="btns" style="margin-top:8px">${btn('goto', n.capital, '📍 首都へ')}${diploButtons(n.id)}</div></div>`;
    }
  }
  return h + `</div>`;
}

// ---------- 戦争 ----------
function warPanel() {
  const mine = warsOf(S.player), others = S.wars.filter(w => !sideOf(w, S.player));
  let h = `<h2>戦争</h2>`;
  if (!mine.length) h += `<p class="note">我が国は平和だ。他国の州を選ぶか外交タブから宣戦布告できる。<br>敵の州を包囲・占領し、会戦に勝利すると戦勝点が貯まる。戦勝点で占領地の割譲や属国化を要求できる。</p>`;
  for (const w of mine) h += warCard(w, true);
  if (others.length) { h += `<h3>世界の戦争</h3>`; for (const w of others) h += warCard(w, false); }
  return h;
}
function warCard(w, mine) {
  const side = sideOf(w, S.player) || 'att';
  const s = warScore(w), sP = side === 'att' ? s : -s;
  const leader = mine && w[side][0] === S.player;
  const col = (ids) => ids.map(i => `<span><i class="dot" style="background:${rgb(nat(i).color)}"></i>${esc(nat(i).short)}${i === S.player ? '（自国）' : ''}</span>`).join('');
  const my = mine ? w[side] : w.att, en = mine ? w[side === 'att' ? 'def' : 'att'] : w.def, v = mine ? sP : s;
  const left = v >= 0 ? 50 : 50 + v / 2, width = Math.abs(v) / 2;
  let h = `<div class="warcard"><div class="t">${esc(w.name)}</div><div class="note" style="margin-top:0">${dateStr(w.start)}開戦</div>
    <div class="wsbar"><i style="left:${left}%;width:${width}%;background:${v >= 0 ? 'var(--good)' : 'var(--bad)'}"></i><div class="mid"></div><span>戦勝点 ${v > 0 ? '+' : ''}${Math.round(v)}</span></div>
    <div class="sides"><div><b style="color:var(--ink-2)">${mine ? '味方' : '攻撃側'}</b>${col(my)}</div><div><b style="color:var(--ink-2)">${mine ? '敵' : '防衛側'}</b>${col(en)}</div></div>`;
  if (mine) h += leader ? `<div class="btns full" style="margin-top:8px">${btn('peace', w.id, '🕊 講和交渉', { cls: 'gold' })}</div>` : `<p class="note">講和は戦争指導国（${esc(nat(w[side][0]).short)}）が行う。</p>`;
  return h + `</div>`;
}

// ---------- 経済（前世の知識・商会） ----------
function econPanel() {
  const n = me();
  let h = `<h2>経済</h2><h3>前世の知識 <small>📚 ${Math.floor(n.know)}（+${fmt(knowIncome(n), 1)}/月）</small></h3><p class="note" style="margin-top:0">前世の記憶をもとに、この世界にない技術を「発明」する。転生者の国は知識が貯まりやすい。上の段に進むには、発明の総数が一定以上必要。</p>`;
  for (let tier = 1; tier <= 4; tier++) {
    const needN = (tier - 1) * 2, locked = n.inventions.length < needN;
    h += `<div class="note" style="margin:8px 0 3px;color:var(--gold)">第${tier}段 — 各 📚${inventCost(n, { tier })}${locked ? `（発明${needN}種で解放）` : ''}</div><div class="blist">`;
    for (const inv of INVENTIONS.filter(i => i.tier === tier)) {
      const got = n.inventions.includes(inv.id), can = canInvent(n, inv.id), c = inventCost(n, inv);
      const why = got ? null : !can ? (inv.req && !n.inventions.includes(inv.req) ? `「${INVENTION_BY_ID[inv.req].name}」が必要` : `発明${needN}種で解放`) : need(n.know, c, '前世の知識');
      h += `<div class="bitem ${got ? 'done' : ''}"><b>${inv.icon} ${got ? '✓ ' : ''}${inv.name}</b><small>${inv.desc}</small>${got ? '' : btn('invent', inv.id, `発明 📚${c}`, { cls: 'gold', disabled: !can || n.know < c, why })}</div>`;
    }
    h += `</div>`;
  }
  const mine = guildsOf(n.id);
  h += `<h3>商会 <small>${mine.length} / ${maxGuilds(n)}軒　収入 +${fmt(tradeIncome(n), 2)}/月</small></h3><p class="note" style="margin-top:0">州の画面から設立する。近くの自国商会と連携するほど稼ぐ（地図モード「商会」で網を確認できる）。商会枠は発展度50ごとに+1。</p><div class="rows" style="margin-top:6px">`;
  h += mine.map(g => `<div class="row" data-act="prov" data-arg="${g.pid}"><i class="dot" style="background:${rgb(nat(prov(g.pid).owner >= 0 ? prov(g.pid).owner : n.id).color)}"></i><span class="nm">⚖ ${esc(prov(g.pid).name)}${prov(g.pid).owner !== n.id ? ' <small style="color:var(--ink-3)">（' + esc(nat(prov(g.pid).owner).short) + '）</small>' : ''}</span><span class="num">+${fmt(guildIncome(g), 2)}${guildLinks(g) ? '・連携' + guildLinks(g) : ''}${guildRivals(g) ? '・競合' + guildRivals(g) : ''}</span></div>`).join('') || '<p class="note">商会がない。</p>';
  h += `</div><h3>大建造物 <small>世界に一つずつ・建造中は他国と競争</small></h3>`;
  if (n.project) { const W = WONDER_BY_ID[n.project.id]; h += `<div class="okbox">🏗 ${esc(prov(n.project.pid).name)}で「${esc(W.name)}」を建設中 — 残り${n.project.need - n.project.prog}か月</div>`; }
  h += WONDERS.map(W => {
    const w = wonderBuilt(W.id), bs = S.nations.filter(o => o.alive && o.project && o.project.id === W.id);
    const st = w ? `完成：${esc(prov(w.pid).name)}（現在の支配：${prov(w.pid).owner >= 0 ? esc(nat(prov(w.pid).owner).short) : '—'}）` : bs.length ? `建設中：${bs.map(o => `${esc(o.short)} ${Math.round(o.project.prog / o.project.need * 100)}%`).join('、')}` : `未建造・💰${wonderCost(n, W)}・発展度${W.minDev}以上${W.coastal ? '・沿岸' : ''}${W.terrain ? '・' + TERRAIN[W.terrain].name : ''}`;
    return `<div class="wonder ${w ? 'done' : ''}" ${w ? `data-act="prov" data-arg="${w.pid}" style="cursor:pointer"` : ''}><div class="wi">${W.icon}</div><div><b>${esc(W.name)}</b><small>${esc(W.desc)}</small><small class="fl">${st}</small></div></div>`;
  }).join('') + `<p class="note">州の画面から建設できる。完成した大建造物は、その州を支配する国に効果をもたらす（征服すれば奪える）。</p>`;
  h += `<h3>資源の使い道</h3><p class="note"><span class="cost-adm">政務</span>：開拓、代官・将軍の任命、安定度、関係改善、外交併合<br>📚 前世の知識：発明<br>🔮 魔力：召喚<br>💰 金貨：徴兵・建設・造船・商会・投資・大建造物</p>`;
  return h;
}

// ---------- 英雄（召喚・将軍・顧問・秘宝） ----------
function heroPanel() {
  const n = me(), sc = summonCost(n);
  let h = `<h2>英雄</h2>`;
  h += `<h3>召喚魔法 <small>魔力 ${Math.floor(n.mana)}（+${fmt(manaIncome(n), 1)}/月）</small></h3><p class="note" style="margin-top:0">異世界（日本）からチート能力者を呼び出す。将軍として軍を率いる者、顧問として国を支える者がいる。召喚するたびにコストが上がる。<br>魔力は魔石の州・魔境・魔導兵から得られる。</p>`;
  const rift = n.rift || 0;
  h += `<div class="kv" style="margin-top:6px"><span>次元の歪み</span><span>${Math.round(rift)} / 100</span></div><div class="rift"><i style="width:${Math.min(100, rift)}%"></i></div><p class="note" style="margin-top:0">召喚するたびに溜まり（高レア度ほど大きい）、毎月1ずつ戻る。歪みが大きいほど自国に魔物が湧き、召喚事故（現在${Math.round(accidentChance(n) * 100)}%）が起きやすい。100に達すると<b>次元の裂け目</b>が開き、強大な魔獣が現れる。光輪教の国々は召喚を嫌う。</p>`;
  h += `<div class="btns full" style="margin-top:6px">${btn('summon', 0, `✨ 召喚の儀を行う <small>🔮${sc} 💰${SUMMON_GOLD}</small>`, { cls: 'gold', disabled: !canSummon(n), why: need(n.mana, sc, '魔力') || need(n.gold, SUMMON_GOLD, '金貨') })}</div>${!canSummon(n) && n.mana < sc ? `<p class="note">現在の魔力収入なら約${Math.ceil((sc - n.mana) / Math.max(0.1, manaIncome(n)))}か月で召喚できる。時代が進むほど魔力は増える。</p>` : ''}`;
  h += `<p class="note">出現率：${RARITIES.map(r => `${r.id} ${natMod(n, 'rarityUp') ? r.w2 : r.w}%`).join(' / ')}</p>`;
  h += `<h3>顧問 <small>${n.advisors.length} / 3</small></h3>`;
  h += n.advisors.map(c => charHTML(c, `<div class="btns" style="margin-top:4px">${btn('adv-bench', c.id, '控えに回す')}</div>`)).join('') || '<p class="note">顧問がいない。召喚で異世界人を呼ぼう。</p>';
  if (n.bench.length) h += `<h3>控え</h3>` + n.bench.map(c => charHTML(c, `<div class="btns" style="margin-top:4px">${btn('adv-up', c.id, '顧問に任命', { disabled: n.advisors.length >= 3, why: '顧問の枠（3人）が埋まっている' })}${btn('adv-fire', c.id, '暇を出す', { cls: 'red' })}</div>`)).join('');
  h += `<h3>代官 <small>${n.governors.filter(c => c.pid != null).length}人が州に赴任中</small></h3><p class="note" style="margin-top:0">顧問・控えの異世界人は、州の画面から代官として派遣できる。</p>`;
  h += n.governors.map(c => charHTML(c, `<div class="ds">${c.pid != null ? `赴任先：<a data-act="prov" data-arg="${c.pid}" style="cursor:pointer;text-decoration:underline">${esc(prov(c.pid).name)}</a>` : '待機中'}・${govEffect(c).desc}</div>`)).join('') || '<p class="note">代官がいない。</p>';
  h += `<h3>将軍 <small>${n.generals.length}人</small></h3><div class="btns" style="margin-bottom:6px">${btn('gen-new', 0, `🎖 将軍を任命 <small class="cost-adm">政${generalCost(n)}</small>`, { disabled: n.gov < generalCost(n), why: need(n.gov, generalCost(n), '政務') })}</div>`;
  h += n.generals.map(g => { const a = S.armies.find(a => a.owner === S.player && a.gen === g.id); return charHTML(g, `<div class="ds">${a ? `指揮：<a data-act="army" data-arg="${a.id}" style="cursor:pointer;text-decoration:underline">${esc(a.name)}</a>` : '待機中（軍の画面で配属できる）'}${g.summoned ? '' : `・${START_YEAR + Math.floor(g.until / 360)}年頃引退`}</div>`); }).join('') || '<p class="note">将軍がいない。</p>';
  h += `<h3>秘宝 <small>${n.artifacts.length}個</small></h3>`;
  h += n.artifacts.map(id => { const a = ARTIFACT_BY_ID[id]; return `<div class="char"><div class="av">🏺</div><div class="bd"><div class="nm2">${esc(a.name)}</div><div class="md">${esc(a.desc)}</div></div></div>`; }).join('') || '<p class="note">ダンジョンの奥深くには秘宝が眠っているという……</p>';
  return h;
}

// ---------- 技能（スキルツリー） ----------
function skillPanel() {
  const n = me(), r = n.ruler;
  let h = `<h2>転生者の技能</h2><div class="sub"><span>${esc(r.name)}</span><span class="chip me">Lv${r.lv}</span><span>スキルポイント <b style="color:var(--gold-2)">${n.sp || 0}</b></span></div>`;
  h += `<div class="xpbar" style="margin-top:8px"><i style="width:${(r.xp || 0) / xpNeed(r.lv) * 100}%"></i></div><p class="note">経験値 ${Math.floor(r.xp || 0)} / ${xpNeed(r.lv)}　— 時間経過・戦勝・ダンジョン攻略・イベントで得られる。</p>`;
  h += `<div class="skilltree" style="margin-top:10px">`;
  for (const br in SKILL_BRANCHES) {
    h += `<div class="skcol"><h4>${SKILL_BRANCHES[br]}</h4>`;
    for (const s of SKILLS.filter(s => s.br === br)) {
      const got = n.skills.includes(s.id), can = canLearn(n, s.id);
      h += `<button class="sk ${got ? 'got' : can ? 'can' : ''}" ${can ? `data-act="learn" data-arg="${s.id}"` : ''} title="${esc(s.desc)}"><b>${s.name}</b>${s.desc}</button>`;
    }
    h += `</div>`;
  }
  return h + `</div><p class="note" style="margin-top:6px">光っているスキルが習得可能。上から順に習得する。</p>`;
}

// ---------- 行動 ----------
function act(name, arg, ev) {
  const n = S.player >= 0 ? me() : null;
  const selProv = S.sel && S.sel.type === 'prov' ? prov(S.sel.id) : null;
  const selArmy = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  const selFleet = S.sel && S.sel.type === 'fleet' ? S.fleets.find(f => f.id === S.sel.id) : null;
  switch (name) {
    case 'tab': tab = arg; openPanel(); break;
    case 'close': $('panel').classList.add('hidden'); document.body.classList.remove('panel-open'); break;
    case 'prov': select({ type: 'prov', id: +arg }); { const p = prov(+arg); centerOn(p.x, p.y); } break;
    case 'army': select({ type: 'army', id: +arg }); break;
    case 'fleet': select({ type: 'fleet', id: +arg }); break;
    case 'nation': tab = 'diplo'; diploSel = +arg; break;
    case 'dsel': diploSel = diploSel === +arg ? -1 : +arg; break;
    case 'goto': { const p = prov(+arg); centerOn(p.x, p.y, Math.max(cam.s, 1.6)); select({ type: 'prov', id: +arg }, true); } break;
    case 'dev': if (develop(n, prov(+arg))) hooks.fx('win', +arg, '発展！'); break;
    case 'wonder': { const [id, pid] = arg.split(':'); if (startWonder(n, id, +pid)) { hooks.fx('siege', +pid, '着工！'); hooks.log(`🏗 ${prov(+pid).name}で「${WONDER_BY_ID[id].name}」の建設を始めた`, 'good'); } } break;
    case 'invest': if (invest(n, prov(+arg))) hooks.fx('win', +arg, '発展！'); break;
    case 'invent': if (invent(n, arg)) { const inv = INVENTION_BY_ID[arg]; hooks.fx('levelup', null, `${inv.icon} ${inv.name}`); hooks.log(`💡 前世の知識で「${inv.name}」を発明した！ — ${inv.desc}`, 'good'); } break;
    case 'guild': if (foundGuild(S.player, +arg)) { hooks.fx('siege', +arg, '商会設立！'); hooks.log(`⚖ ${prov(+arg).name}に商会を設立した`, 'good'); } break;
    case 'gov-native': { const c = recruitNativeGov(n); if (c) { assignGovernor(n, c, +arg); hooks.log(`🏛 ${c.name}を${prov(+arg).name}の代官に任命した`, 'good'); } } break;
    case 'build': if (selProv) build(n, selProv, arg); mapDirty = true; break;
    case 'recruit': if (selProv) { const k = ev && ev.shiftKey ? 5 : 1; let ok = 0; for (let i = 0; i < k; i++) if (recruit(S.player, selProv.id, arg)) ok++; if (!ok) hooks.log('金貨か人的資源が足りない', 'bad'); } break;
    case 'ship': if (selProv) { const k = ev && ev.shiftKey ? 5 : 1; for (let i = 0; i < k; i++) buildShip(S.player, selProv.id, arg); } break;
    case 'colonize': if (colonize(S.player, +arg)) { hooks.log(`⛺ ${prov(+arg).name}への入植を開始した`, 'info'); mapDirty = true; } break;
    case 'convert': if (convert(S.player, +arg)) hooks.log(`⛪ ${prov(+arg).name}に宣教師を派遣した`, 'info'); break;
    case 'stab': if (raiseStab(n)) hooks.log(`⚖ 安定度が${n.stab}になった`, 'good'); break;
    case 'improve': if (improveRel(n, +arg)) hooks.log(`${nat(+arg).name}との関係が改善した`, 'good'); break;
    case 'ally': proposeAlliance(+arg); break;
    case 'unally': breakAlliance(S.player, +arg); addRel(S.player, +arg, -30); hooks.log(`${nat(+arg).name}との同盟を破棄した`, 'bad'); break;
    case 'reqvassal': { const o = nat(+arg); if (vassalAccepts(n, o)) { makeVassal(n, o); hooks.log(`📜 ${o.name}が我が国の属国となった`, 'good'); } else hooks.log(`${o.name}は属国化を拒否した（国力差4倍・開発度差3倍・関係値30以上が必要）`, 'bad'); } break;
    case 'annex': { const o = nat(+arg); if (!annex(n, o)) hooks.log('外交併合できない', 'bad'); } break;
    case 'declare': confirmDeclare(+arg); break;
    case 'peace': openPeace(S.wars.find(w => w.id === +arg)); break;
    case 'summon': summonRitual(); break;
    case 'adv-bench': { const c = n.advisors.find(x => x.id === +arg); if (c) { n.advisors = n.advisors.filter(x => x !== c); n.bench.push(c); } } break;
    case 'adv-up': { const c = n.bench.find(x => x.id === +arg); if (c && n.advisors.length < 3) { n.bench = n.bench.filter(x => x !== c); n.advisors.push(c); } } break;
    case 'adv-fire': n.bench = n.bench.filter(x => x.id !== +arg); break;
    case 'gen-new': { const g = recruitGeneral(n); if (g) hooks.log(`🎖 ${g.name}を将軍に任命した（${g.att}/${g.def}/${g.man}/${g.sie}）`, 'good'); } break;
    case 'learn': if (learnSkill(n, arg)) hooks.log(`📖 スキル「${SKILL_BY_ID[arg].name}」を習得した`, 'good'); break;
    case 'army-move': case 'fleet-move': moveMode = !moveMode; updateBanner(); break;
    case 'army-stop': if (selArmy) { selArmy.path = []; selArmy.prog = 0; selArmy.delve = null; } break;
    case 'army-split': if (selArmy) { const b = splitArmy(selArmy); if (b) select({ type: 'army', id: b.id }); } break;
    case 'army-merge': if (selArmy) mergeArmies([selArmy, ...S.armies.filter(b => b !== selArmy && b.owner === selArmy.owner && b.prov === selArmy.prov && !b.inBattle && !b.retreat)]); break;
    case 'army-disband': if (selArmy) hooks.modal({ title: '軍の解散', body: `${esc(selArmy.name)}（${fmtMen(armyMen(selArmy))}）を解散しますか？<br>兵の半数は人的資源に戻る。`, buttons: [{ label: '解散する', fn: () => { n.manpower = Math.min(maxManpower(n), n.manpower + armyMen(selArmy) / 2); destroyArmy(selArmy); S.sel = { type: 'prov', id: selArmy.prov }; } }, { label: 'やめる' }] }); break;
    case 'delve': if (selArmy && startDelve(selArmy)) hooks.log(`🕳 ${selArmy.name}がダンジョンに突入した`, 'info'); break;
    case 'fleet-stop': if (selFleet) { selFleet.path = []; selFleet.prog = 0; } break;
    case 'fleet-merge': if (selFleet) { for (const o of S.fleets.filter(x => x !== selFleet && x.owner === selFleet.owner && x.prov === selFleet.prov)) { selFleet.war += o.war; selFleet.trans += o.trans; selFleet.str = Math.min(selFleet.str, o.str); destroyFleet(o); } } break;
    case 'fleet-disband': if (selFleet) { destroyFleet(selFleet); S.sel = null; } break;
    case 'save': hooks.log(saveGame() ? '💾 セーブした' : 'セーブに失敗した', 'info'); break;
    case 'load': if (loadGame()) { afterLoad(); hooks.log('📂 ロードした', 'info'); } break;
    case 'newgame': hooks.modal({ title: '最初から', body: '現在のゲームを破棄して、新しい大陸で始めますか？', buttons: [{ label: '新しく始める', fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } }, { label: 'やめる' }] }); break;
  }
  refresh(true);
}
function summonRitual() {
  const n = me();
  const r = doSummon(n);
  if (!r) return;
  if (r.accident && r.tamed) {
    sfx('accident'); hooks.fx('win', n.capital, '魔物が従った！');
    hooks.modal({ title: '😈 魔界の軍勢、来たる', body: `魔法陣が紫に染まり、空間が裂けた。現れたのは異世界人ではなく<b>${esc(r.army.name)}（${fmtMen(armyMen(r.army))}）</b>だった。<br><br>しかし魔物たちは魔王の前にひれ伏した——<b>「魔物の王」</b>の力により、彼らは我が軍に加わった。`, buttons: [{ label: '我が配下とする' }] });
    return;
  }
  if (r.accident) {
    sfx('accident'); hooks.fx('lost', n.capital, '召喚事故！');
    hooks.modal({ title: '💥 召喚事故！', body: `魔法陣が不気味な紫に染まり、空間が裂けた——！<br>現れたのは異世界人ではなく、<b>${esc(r.army.name)}（${fmtMen(armyMen(r.army))}）</b>だった！<br><br><span class="note">首都${esc(prov(n.capital).name)}に魔物が出現した。急ぎ討伐せよ。</span>`, buttons: [{ label: '迎え撃て！' }] });
    return;
  }
  const c = r.char, R = RARITIES.find(x => x.id === c.rarity);
  gainXP(n, 5);
  sfx('summon');
  const where = c.role === 'general' ? '将軍として軍の指揮を任せられる（軍の画面で配属）。' : n.advisors.includes(c) ? '顧問として国政に参加した。' : '顧問の枠が埋まっているため、控えに回った。';
  hooks.modal({
    title: '✨ 召喚の儀', mount: (el) => {
      const body = el.querySelector('.mbody'), btns = el.querySelector('.mbtns'), real = body.innerHTML;
      body.innerHTML = `<div class="magic"></div><p style="text-align:center" class="note">魔法陣に魔力が満ちていく……</p>`; btns.style.visibility = 'hidden';
      setTimeout(() => { body.innerHTML = real; btns.style.visibility = ''; el.querySelector('h2').textContent = c.rarity === 'SSR' ? '🌟 超レア召喚！' : '✨ 召喚成功'; sfx('reveal-' + c.rarity); if (c.rarity === 'SSR') el.classList.add('ssr-flash'); }, 1400);
    },
    body: `魔法陣がまばゆく輝き、光の中から一人の人物が現れた。<div class="summon-card" style="color:${R.color};border-color:${R.color}"><div class="big">${c.rarity}</div><div style="color:var(--ink);font-family:var(--serif);font-size:17px;font-weight:700;margin-top:2px">${esc(c.title)}　${esc(c.name)}</div><div class="note" style="color:var(--ink-2)">${esc(c.desc || '')}</div>${c.role === 'general' ? `<div class="pips" style="justify-content:center;margin-top:6px">${['att', 'def', 'man', 'sie'].map((k, i) => `<span>${GEN_STAT_NAMES[i]}<b>${c[k]}</b></span>`).join('')}</div>` : ''}<div class="md" style="color:var(--gold-2);margin-top:4px">${modsText(c.mods)}</div></div>「え、ここどこ……？ もしかして、異世界転生ってやつ？」<br><br>${where}`,
    buttons: [{ label: '歓迎する' }],
  });
  hooks.log(`✨ ${c.title} ${c.name}（${c.rarity}）を召喚した`, 'good');
}
function proposeAlliance(id) {
  const o = nat(id), r = getRel(S.player, id) + natMod(me(), 'allyAccept');
  const ok = r >= 40 && o.allies.length < 3 && !hostile(S.player, id) && !o.overlord;
  if (ok) { addAlliance(S.player, id); hooks.log(`🤝 ${o.name}と同盟を結んだ`, 'good'); }
  else hooks.log(`${o.name}は同盟を拒否した（関係値40以上が必要${o.allies.length >= 3 ? '、同盟枠が埋まっている' : ''}）`, 'bad');
}
function confirmDeclare(id) {
  let o = nat(id);
  const real = o.overlord ? nat(o.overlord) : o;
  const joiners = real.allies.filter(a => a !== S.player && !isAlly(a, S.player) && nat(a).alive);
  hooks.modal({
    title: '⚔ 宣戦布告', body: `<b>${esc(real.name)}</b>に宣戦布告しますか？${real !== o ? `<br><span class="note">${esc(o.name)}は${esc(real.name)}の属国のため、宗主国との戦争になる。</span>` : ''}<br><br>敵の同盟国（参戦見込み）：${joiners.map(a => esc(nat(a).name)).join('、') || 'なし'}<br>我が同盟国は60%の確率で参戦する。<br><br>敵戦力：約${fmtMen(S.armies.filter(a => a.owner === real.id).reduce((s, a) => s + armyMen(a), 0))}　自軍：約${fmtMen(S.armies.filter(a => a.owner === S.player).reduce((s, a) => s + armyMen(a), 0))}`,
    buttons: [{ label: '宣戦布告する', fn: () => { const w = declareWar(S.player, id); if (w) { hooks.log(`⚔ ${nat(w.def[0]).name}に宣戦布告した！ 参戦：${w.att.map(i => nat(i).short).join('・')} 対 ${w.def.map(i => nat(i).short).join('・')}`, 'war'); tab = 'war'; } } }, { label: 'やめる' }],
  });
}
function openPeace(w) {
  if (!w) return;
  const side = sideOf(w, S.player), lose = side === 'att' ? 'def' : 'att';
  const s = warScore(w), sP = side === 'att' ? s : -s;
  const enemy = nat(w[lose][0]);
  const cand = S.provinces.filter(p => w[lose].includes(p.owner) && w[side].includes(p.controller)).sort((a, b) => dev(b) - dev(a));
  const vCost = vassalPeaceCost(w, lose), canV = !enemy.demonKing && !enemy.overlord && totalDev(enemy.id) * 2 < totalDev(S.player);
  const body = `<div class="wsbar"><i style="left:${sP >= 0 ? 50 : 50 + sP / 2}%;width:${Math.abs(sP) / 2}%;background:${sP >= 0 ? 'var(--good)' : 'var(--bad)'}"></i><div class="mid"></div><span>戦勝点 ${Math.round(sP)}</span></div>
    相手：<b>${esc(enemy.name)}</b><br>要求を選ぶ（合計コストが戦勝点以下なら受諾される）：
    <div class="plist">${canV ? `<label style="border:1px solid var(--gold)"><input type="checkbox" data-vassal="1"><span>👑 <b>${esc(enemy.name)}を属国化</b> <small style="color:var(--ink-3)">（この国の州の割譲は含まれなくなる）</small></span><em>${Math.round(vCost)}</em></label>` : `<div class="note">属国化：${enemy.demonKing ? '魔王国は属国にできない' : '開発度が自国の半分未満の国のみ可能'}</div>`}
    ${cand.map(p => `<label><input type="checkbox" data-pid="${p.id}"><span>${esc(p.name)} <small style="color:var(--ink-3)">${esc(nat(p.owner).short)}・開発${dev(p)}</small></span><em>${Math.round(provPeaceCost(w, p, lose))}</em></label>`).join('')}</div>
    ${!cand.length ? '<div class="note">割譲を要求できる占領地がない。</div>' : ''}
    <div>選択コスト：<b id="pc-total">0</b> / ${Math.max(0, Math.round(sP))}</div>
    <div class="note" id="pc-ae">領土を奪うと周辺国の警戒度が上がる。</div>`;
  const read = (el) => { const v = !!el.querySelector('[data-vassal]:checked'); const ids = [...el.querySelectorAll('[data-pid]:checked')].map(c => +c.dataset.pid); return { v, ids }; };
  const cost = ({ v, ids }) => (v ? vCost : 0) + ids.reduce((t, i) => t + (v && prov(i).owner === enemy.id ? 0 : provPeaceCost(w, prov(i), lose)), 0);
  hooks.modal({
    title: '🕊 講和交渉', body,
    mount: (el) => {
      const upd = () => {
        const r = read(el), t = cost(r); const e = el.querySelector('#pc-total'); e.textContent = Math.round(t); e.style.color = t <= sP + 0.01 ? 'var(--good)' : 'var(--bad)';
        const list = r.ids.filter(i => !(r.v && prov(i).owner === enemy.id)).map(i => ({ p: prov(i), from: prov(i).owner }));
        const est = aeEstimate(S.player, list); if (r.v) { const e2 = aeEstimate(S.player, ownedProvs(enemy.id).map(p => ({ p, from: enemy.id })), 0.5); for (const k in e2) est[k] = (est[k] || 0) + e2[k]; }
        const after = Object.keys(est).map(id => ({ id: +id, v: Math.min(100, getAE(S.player, +id) + est[id]) })).sort((a, b) => b.v - a.v);
        const hi = after.filter(x => x.v >= AE_THRESHOLD && x.id !== enemy.id);
        el.querySelector('#pc-ae').innerHTML = list.length || r.v ? `警戒度の上昇：${after.slice(0, 5).map(x => `<span class="ae ${x.v >= AE_THRESHOLD ? 'hi' : ''}">${esc(nat(x.id).short)} →${Math.round(x.v)}</span>`).join(' ')}${hi.length >= 2 ? `<br><b style="color:var(--bad)">⚠ ${hi.length}か国が対抗同盟を組める状態になる</b>` : ''}` : '領土を奪うと周辺国の警戒度が上がる。';
      };
      el.querySelectorAll('input').forEach(c => c.onchange = upd);
    },
    buttons: [
      { label: '要求を突きつける', desc: '選んだ条件で講和を提案する', keep: true, fn: () => {
        const r = read($('modal'));
        if (!r.ids.length && !r.v) return;
        closeModal();
        if (aiAcceptsPeace(w, side, r.ids, r.v)) makePeace(w, side, r.ids, r.v);
        else hooks.log(`${enemy.name}は講和を拒否した（戦勝点が足りない）`, 'bad');
      } },
      { label: '白紙和平を提案する', desc: '領土の変更なしで戦争を終える', fn: () => { if (aiAcceptsPeace(w, side, [])) makePeace(w, null, []); else hooks.log(`${enemy.name}は白紙和平を拒否した`, 'bad'); } },
      { label: 'やめる' },
    ],
  });
}

function select(sel, keepTab) {
  S.sel = sel; moveMode = false; updateBanner();
  if (!keepTab) tab = 'sel';
  openPanel(); mapDirty = true;
}
function openPanel() { $('panel').classList.remove('hidden'); document.body.classList.add('panel-open'); }
function updateBanner() {
  $('banner').classList.toggle('hidden', !moveMode);
  $('banner').textContent = '🚩 移動先をクリック（Escでキャンセル）';
  $('map').classList.toggle('targeting', moveMode);
}
function orderMove(a, pid) {
  if (a.inBattle) { hooks.log('交戦中の軍は移動できない', 'bad'); return; }
  if (a.retreat) { hooks.log('退却中の軍には命令できない', 'bad'); return; }
  if (pid === a.prov) { a.path = []; a.prog = 0; return; }
  if (!moveArmyTo(a, pid)) {
    const cap = transportCap(S.player) - regsAtSea(S.player, a), need = armyRegs(a);
    hooks.log(`${prov(pid).name}へは進軍できない（${cap < need ? `海を渡るには輸送艦が${need}隻必要：現在${Math.max(0, cap)}隻／` : ''}通行権がない、または敵艦隊が封鎖中）`, 'bad');
  }
}
function orderFleet(f, pid) {
  if (!prov(pid).sea) { const z = prov(pid).snb && prov(pid).snb[0]; if (z == null) { hooks.log('艦隊は海域にしか移動できない', 'bad'); return; } pid = z; }
  if (!moveFleetTo(f, pid)) hooks.log('そこへは航行できない', 'bad');
}

// ---------- 入力 ----------
function initInput() {
  const cv = $('map');
  const pts = new Map(); let drag = null, pinch = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: cam.x, cy: cam.y, moved: false, button: e.button };
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; if (drag) drag.moved = true; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.s * d / pinch.d) / cam.s);
    } else if (drag && pts.size === 1) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; cv.classList.add('dragging'); }
      if (drag.moved) { cam.x = drag.cx - dx / cam.s; cam.y = drag.cy - dy / cam.s; clampCam(); }
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && pts.size === 0) { if (drag.button === 2) rightClick(e.offsetX, e.offsetY); else leftClick(e.offsetX, e.offsetY); }
    if (pts.size === 0) { drag = null; cv.classList.remove('dragging'); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) { sfx(['dev', 'invest', 'wonder', 'build', 'recruit', 'ship', 'invent', 'guild', 'gov-native', 'colonize', 'convert', 'stab', 'learn', 'gen-new'].includes(el.dataset.act) ? 'coin' : 'click'); act(el.dataset.act, el.dataset.arg, e); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { mapMode = m.dataset.mode; document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b === m)); mapDirty = true; }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    if (el.dataset.change === 'gov') {
      const n = me(), pid = +el.dataset.arg;
      if (el.value === '') { const g = governorAt(prov(pid)); if (g) unassignGov(n, g); }
      else { const c = [...n.bench, ...n.governors, ...n.advisors].find(x => x.id === +el.value); if (c) { assignGovernor(n, c, pid); hooks.fx('win', pid, '代官着任'); hooks.log(`🏛 ${c.title} ${c.name}が${prov(pid).name}の代官に着任した`, 'good'); } }
      refresh(true); return;
    }
    if (el.dataset.change === 'assign') { const a = S.armies.find(x => x.id === +el.dataset.arg); if (a) { if (el.value === '') a.gen = null; else assignGeneral(a, +el.value); } refresh(true); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (!S.started || S.over || modalQueue.length) return;
    if (e.code === 'Space') { e.preventDefault(); S.paused = !S.paused; }
    else if (e.key >= '1' && e.key <= '5') S.speed = +e.key;
    else if (e.key === '+' || e.key === '=') S.speed = Math.min(5, S.speed + 1);
    else if (e.key === '-') S.speed = Math.max(1, S.speed - 1);
    else if (e.key === 'Escape') { if (moveMode) { moveMode = false; updateBanner(); } else { S.sel = null; mapDirty = true; } }
    refresh(true);
  });
  $('btn-mute').onclick = () => { toggleMute(); refresh(true); };
  $('btn-music').onclick = () => { toggleMusic(); refresh(true); };
  // ブラウザは操作があるまで音を出せないので、最初の操作で音楽を始める
  const kick = () => { if (S && S.started) startMusic(); };
  document.addEventListener('pointerdown', kick); document.addEventListener('keydown', kick);
  $('btn-export').onclick = () => { if (!S) return; exportMap(); sfx('coin'); if (S.started) hooks.log(`🗺 王国暦${START_YEAR + Math.floor(S.day / 360)}年の勢力図を古地図として保存した`, 'info'); };
  $('btn-pause').onclick = () => { if (S.started && !S.over) S.paused = !S.paused; refresh(true); };
  $('btn-faster').onclick = () => { S.speed = Math.min(5, S.speed + 1); refresh(true); };
  $('btn-slower').onclick = () => { S.speed = Math.max(1, S.speed - 1); refresh(true); };
}
function leftClick(x, y) {
  if (!S.started) {
    const pid = provAt(x, y);
    if (pid >= 0 && prov(pid).owner > 0) chooseStartNation(prov(pid).owner);
    return;
  }
  const selArmy = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  const selFleet = S.sel && S.sel.type === 'fleet' ? S.fleets.find(f => f.id === S.sel.id) : null;
  if (moveMode && (selArmy || selFleet)) {
    const pid = provAt(x, y);
    if (pid >= 0) { if (selArmy) orderMove(selArmy, pid); else orderFleet(selFleet, pid); }
    moveMode = false; updateBanner(); refresh(true); return;
  }
  const b = badgeAt(x, y);
  if (b) { select({ type: b.fleet ? 'fleet' : 'army', id: b.id }); refresh(true); return; }
  const pid = provAt(x, y);
  if (pid >= 0) select({ type: 'prov', id: pid });
  else { S.sel = null; mapDirty = true; }
  refresh(true);
}
function rightClick(x, y) {
  if (!S.started) return;
  const pid = provAt(x, y); if (pid < 0) return;
  const selArmy = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  const selFleet = S.sel && S.sel.type === 'fleet' ? S.fleets.find(f => f.id === S.sel.id) : null;
  if (selArmy && selArmy.owner === S.player) orderMove(selArmy, pid);
  else if (selFleet && selFleet.owner === S.player) orderFleet(selFleet, pid);
  moveMode = false; updateBanner(); refresh(true);
}

// ---------- 開始画面 ----------
function renderStart() {
  const list = S.nations.filter(n => !n.isMonster).map(n => ({ n, d: totalDev(n.id), c: ownedProvs(n.id).length }));
  $('st-nations').innerHTML = list.map(({ n, d, c }) => `<button class="ncard ${startSel === n.id ? 'on' : ''}" data-sn="${n.id}"><i class="dot" style="background:${rgb(n.color)}"></i><span class="nm">${esc(n.name)}<span class="diff ${n.size}">${SIZE_LABEL[n.size]}</span></span><span class="meta">${RACES[n.race].name}・${c}州<br>開発度 ${d}</span></button>`).join('');
  if (startSel > 0) {
    const n = nat(startSel);
    const T = NATION_TRAITS[n.polity];
    $('st-nations').querySelector(`[data-sn="${startSel}"]`).insertAdjacentHTML('afterend', `<div class="detail" id="st-detail"><b>固有特性「${esc(T.name)}」</b>：${esc(T.desc)}<br><b>国家目標</b>：${missionsOf(n).map(M => esc(M.name)).join('／')}<br><b>${RACES[n.race].name}</b>（${RELIGIONS[n.religion].name}）：${RACES[n.race].desc}<br><span class="note">同盟：${n.allies.map(i => esc(nat(i).name)).join('、') || 'なし'}${n.demonKing ? '<br>⚠ 魔王国は周辺国すべてから敵視されている。勝利条件は「魔界統一」。' : ''}</span></div>`);
  }
  $('st-diff').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) => `<button class="dcard ${startDiff === k ? 'on' : ''}" data-sd="${k}"><b>${d.name}</b><small>${d.desc}</small></button>`).join('');
  $('st-diff').querySelectorAll('[data-sd]').forEach(b => b.onclick = () => { startDiff = b.dataset.sd; startCfg = Object.assign({}, AI_PRESETS[startDiff]); renderStart(); });
  $('st-ai-label').textContent = startDiff === 'custom' ? '（カスタム）' : `（${DIFFICULTY[startDiff].name}の設定）`;
  $('st-ai-body').innerHTML = AI_SETTINGS.map(A => { const v = startCfg[A.key]; return `<label class="slider"><span class="sl-h"><b>${A.name}</b><em data-slv="${A.key}">${A.pct ? Math.round(v * 100) + '%' : v + A.unit}</em></span><input type="range" min="${A.min}" max="${A.max}" step="${A.step}" value="${v}" data-sl="${A.key}"><small>${A.desc}</small></label>`; }).join('') + `<button class="btn" id="st-ai-reset" style="margin-top:6px">標準に戻す</button>`;
  $('st-ai-body').querySelectorAll('[data-sl]').forEach(inp => inp.oninput = () => {
    const A = AI_SETTINGS.find(x => x.key === inp.dataset.sl); startCfg[A.key] = +inp.value; startDiff = 'custom';
    $('st-ai-body').querySelector(`[data-slv="${A.key}"]`).textContent = A.pct ? Math.round(+inp.value * 100) + '%' : inp.value + A.unit;
    $('st-diff').querySelectorAll('.dcard').forEach(c => c.classList.remove('on')); $('st-ai-label').textContent = '（カスタム）';
  });
  $('st-ai-reset').onclick = (e) => { e.preventDefault(); startDiff = 'normal'; startCfg = Object.assign({}, AI_PRESETS.normal); renderStart(); };
  $('st-cheats').innerHTML = CHEATS.map(c => `<button class="ccard ${startCheat === c.id ? 'on' : ''}" data-sc="${c.id}"><b>${c.name}</b><small>${c.desc}</small></button>`).join('');
  $('st-start').disabled = startSel < 0;
  $('st-nations').querySelectorAll('[data-sn]').forEach(b => b.onclick = () => chooseStartNation(+b.dataset.sn));
  $('st-cheats').querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { startCheat = b.dataset.sc; renderStart(); });
}
function chooseStartNation(id) {
  startSel = id; highlightNation = id; mapDirty = true;
  const c = prov(nat(id).capital);
  const st = $('start').getBoundingClientRect();
  const narrow = window.innerWidth <= 760;
  cam.s = fitScale() * 1.5;
  centerOn(c.x + (narrow ? 0 : st.width / 2 / cam.s), c.y + (narrow ? viewH() * 0.25 / cam.s : 0));
  renderStart();
  const el = $('st-nations').querySelector(`[data-sn="${id}"]`); if (el) el.scrollIntoView({ block: 'nearest' });
}
function beginPlay() {
  highlightNation = -1;
  const tut = $('st-tut').checked;
  startMusic();
  startGame(startSel, startCheat, $('st-name').value.trim() || 'カイト', { diff: startDiff === 'custom' ? 'normal' : startDiff, aiCfg: startCfg });
  if (tut) S.tut = { step: 0, done: false };
  $('start').classList.add('hidden');
  const c = prov(nat(S.player).capital);
  focusCapital(c);
  select({ type: 'prov', id: c.id });
  tab = 'nation';
  sfx('levelup');
  if (tut) { refresh(true); hooks.modal({ title: '✨ 転生', body: `目を覚ますと、豪奢な天蓋付きの寝台の上だった。<br>侍従が告げる——「陛下、${esc(nat(S.player).name)}の民がお待ちです」<br><br>あなたは<b>${esc(nat(S.player).ruler.name)}</b>として、この国を百年導くことになった。<br>……と、その時、伝令が駆け込んできた。「陛下！ 国境に魔物が！」`, buttons: [{ label: '出陣だ！' }] }); return; }
  hooks.modal({
    title: '✨ 転生', body: `目を覚ますと、豪奢な天蓋付きの寝台の上だった。<br>侍従が告げる——「陛下、${esc(nat(S.player).name)}の民がお待ちです」<br><br>あなたは<b>${esc(nat(S.player).ruler.name)}</b>として、この国を百年導くことになった。<br>授かったスキルは<b>「${CHEAT_BY_ID[startCheat].name}」</b>。<br><br><span class="note">▶ Spaceまたは右上の▶で時間が進む。<br>▶ 「技能」タブでスキルポイントを1つ使える。<br>▶ 魔力が貯まったら「英雄」タブで異世界人を召喚しよう。<br>▶ 地図上の🕳はダンジョン。軍を送り込むと財宝や秘宝が手に入る。<br>▶ 魔物の群れや反乱軍が各地に湧く。放置すると州を占領される。</span>`,
    buttons: [{ label: '覇道を歩み始める' }],
  });
  refresh(true);
}
function focusCapital(c) {
  const narrow = window.innerWidth <= 760;
  cam.s = narrow ? Math.max(fitScale() * 2.2, 0.9) : fitScale() * 2.2;
  centerOn(c.x - (narrow ? 0 : 160 / cam.s), c.y + (narrow ? viewH() * 0.22 / cam.s : 0));
}
function afterLoad() {
  prepareStatic();
  $('start').classList.add('hidden');
  highlightNation = -1;
  focusCapital(prov(nat(S.player).capital));
  tab = 'nation'; openPanel(); renderLog(); refresh(true);
}

// ---------- ループ ----------
let lastT = performance.now(), acc = 0, lastUI = 0;
function refresh(force) { renderTop(); renderPanel(force); if (typeof tutTick === 'function') tutTick(); }
function loop(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000); lastT = t;
  if (S && S.started && !S.paused && !S.over && !modalQueue.length) {
    acc += dt * SPEEDS[S.speed];
    let steps = 0;
    while (acc >= 1 && steps < 12) { dailyTick(); acc -= 1; steps++; if (modalQueue.length || S.over) { acc = 0; break; } }
    if (steps >= 12) acc = 0;
  }
  draw();
  if (t - lastUI > 250) { lastUI = t; if (S && S.started) refresh(false); }
  requestAnimationFrame(loop);
}
function boot(seed) {
  $('loading').classList.remove('hidden');
  setTimeout(() => {
    newWorld(seed);
    prepareStatic();
    startSel = -1; highlightNation = -1;
    cam.s = fitScale(); centerOn(MAP_W / 2 + (window.innerWidth > 760 ? $('start').getBoundingClientRect().width / 2 / cam.s : 0), MAP_H / 2 + (window.innerWidth <= 760 ? viewH() * 0.25 / cam.s : 0));
    renderStart();
    $('loading').classList.add('hidden');
  }, 30);
}
window.addEventListener('load', () => {
  initRender(); initInput();
  $('st-start').onclick = () => { if (startSel > 0) beginPlay(); };
  $('st-reroll').onclick = () => boot(Math.floor(Math.random() * 1e6));
  if (hasSave()) { $('st-load').classList.remove('hidden'); $('st-load').onclick = () => { if (loadGame()) afterLoad(); }; }
  boot(Math.floor(Math.random() * 1e6));
  requestAnimationFrame(loop);
});
