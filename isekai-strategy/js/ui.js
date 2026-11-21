'use strict';
// ===== UI・入力・メインループ =====
const $ = id => document.getElementById(id);
let tab = 'sel', moveMode = false, diploSel = -1, lastPanelHTML = '', modalQueue = [], startSel = -1, startCheat = 'admin';

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
function showModal() {
  const m = modalQueue[0];
  if (!m) { $('modal-wrap').classList.add('hidden'); return; }
  $('modal').innerHTML = `<h2>${m.title}</h2><div class="mbody">${m.body}</div><div class="mbtns">${(m.buttons || [{ label: 'OK' }]).map((b, i) =>
    `<button data-mi="${i}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}${b.desc ? `<small>${esc(b.desc)}</small>` : ''}</button>`).join('')}</div>`;
  $('modal-wrap').classList.remove('hidden');
  if (m.mount) m.mount($('modal'));
  $('modal').querySelectorAll('[data-mi]').forEach(el => el.onclick = () => {
    const b = (m.buttons || [{}])[+el.dataset.mi];
    if (b.keep && b.fn) { b.fn(); return; }
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
  const ranks = S.nations.filter(n => !n.isMonster && n.alive).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  const me = ranks.findIndex(r => r.n.id === S.player);
  const body = victory && me >= 0
    ? `王国暦${END_YEAR}年。転生から百年、${esc(nat(S.player).ruler.name)}の物語は伝説となった。<br><br>最終順位：<b>第${me + 1}位</b>（総開発度 ${ranks[me].d}）<br><br>${ranks.slice(0, 5).map((r, i) => `${i + 1}. ${esc(r.n.name)}（${r.d}）`).join('<br>')}`
    : `${esc(nat(S.player).name)}は滅亡した……。<br>転生者の物語はここで終わる。`;
  hooks.modal({ title: victory ? '👑 百年の覇道、完' : '☠ 滅亡', body, buttons: [{ label: '新しい大陸で転生しなおす', fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } }, { label: '地図を眺める' }] });
};

// ---------- トップバー ----------
function renderTop() {
  const n = S.player >= 0 ? nat(S.player) : null;
  $('date').textContent = '王国暦 ' + dateStr(S.day);
  if (!n) return;
  const inc = calcIncome(n);
  $('tb-flag').style.background = rgb(n.color); $('tb-name').textContent = n.name;
  const set = (id, v, sm, cls) => { const el = $(id); el.querySelector('b').textContent = v; const s = el.querySelector('small'); if (s) { s.textContent = sm || ''; s.className = cls || ''; } };
  set('r-gold', fmt(Math.floor(n.gold)), (inc.net >= 0 ? '+' : '') + fmt(inc.net, 1), inc.net >= 0 ? 'pos' : 'neg');
  set('r-mp', fmtMen(n.manpower), '/' + fmtMen(maxManpower(n)));
  set('r-adm', Math.floor(n.adm)); set('r-dip', Math.floor(n.dip)); set('r-mil', Math.floor(n.mil));
  set('r-army', inc.regs, '/' + inc.fl, inc.regs > inc.fl ? 'neg' : '');
  $('btn-pause').classList.toggle('paused', S.paused);
  $('btn-pause').textContent = S.paused ? '▶' : '⏸';
  $('speed-dots').innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i <= S.speed ? 'on' : ''}"></i>`).join('');
  $('pausedtag').classList.toggle('hidden', !S.paused || !S.started || S.over);
}

// ---------- パネル ----------
function renderPanel(force) {
  if (!S.started) return;
  document.querySelectorAll('.tabs button[data-act="tab"]').forEach(b => b.classList.toggle('on', b.dataset.arg === tab));
  let html = '';
  if (tab === 'sel') html = selPanel();
  else if (tab === 'nation') html = nationPanel();
  else if (tab === 'diplo') html = diploPanel();
  else if (tab === 'war') html = warPanel();
  else if (tab === 'tech') html = techPanel();
  if (force || html !== lastPanelHTML) {
    const body = $('panel-body'), st = body.scrollTop;
    body.innerHTML = html; body.scrollTop = st; lastPanelHTML = html;
  }
}
const me = () => nat(S.player);
const natTag = (id) => id < 0 ? '<span class="chip">未開の地</span>' : `<span class="chip" data-act="nation" data-arg="${id}" style="cursor:pointer"><i class="dot" style="background:${rgb(nat(id).color)}"></i>${esc(nat(id).name)}</span>`;
function btn(act, arg, label, opts = {}) {
  return `<button class="btn ${opts.cls || ''}" data-act="${act}" data-arg="${arg}" ${opts.disabled ? 'disabled' : ''} ${opts.title ? `title="${esc(opts.title)}"` : ''}>${label}</button>`;
}
function relStatus(id) {
  const P = S.player, out = [];
  if (id === P) return '<span class="chip me">自国</span>';
  if (atWar(P, id)) out.push('<span class="chip war">戦争中</span>');
  if (isAlly(P, id)) out.push('<span class="chip ally">同盟</span>');
  if (hasTruce(P, id)) out.push(`<span class="chip truce">休戦 ${START_YEAR + Math.floor(nat(P).truces[id] / 360)}年まで</span>`);
  return out.join('');
}
function relSpan(v) { v = Math.round(v); return `<span class="${v >= 0 ? 'rel-pos' : 'rel-neg'}">${v > 0 ? '+' : ''}${v}</span>`; }

function selPanel() {
  if (!S.sel) return `<p class="note" style="margin-top:20px;text-align:center">地図上の州や軍をクリックしてください。<br><br>自国の州では開発・建設・徴兵ができます。<br>軍を選んで右クリックで移動します。</p>`;
  if (S.sel.type === 'army') {
    const a = S.armies.find(x => x.id === S.sel.id);
    if (a) return armyPanel(a);
    S.sel = null; return selPanel();
  }
  return provPanel(prov(S.sel.id));
}
function provPanel(p) {
  const n = me(), mine = p.owner === S.player, ctrl = p.controller === S.player;
  let h = `<h2>${esc(p.name)}</h2><div class="sub">${natTag(p.owner)}<span>${TERRAIN[p.terrain].name}</span><span>・${GOODS[p.good].name}</span><span>・${RACES[p.race].name}</span>${p.id === (p.owner > 0 ? nat(p.owner).capital : -1) ? '<span class="chip">首都</span>' : ''}${p.dungeon ? '<span class="chip">ダンジョン</span>' : ''}</div>`;
  if (p.owner >= 0 && p.controller !== p.owner) h += `<div class="warn">${p.controller === MONSTER ? '👹 魔物' : esc(nat(p.controller).name)}に占領されている</div>`;
  if (p.siege) h += `<div class="warn">🏰 ${p.siege.by === MONSTER ? '魔物' : esc(nat(p.siege.by).name)}が包囲中 — ${Math.round(p.siege.prog / p.siege.need * 100)}%</div>`;
  if (p.coreUntil > S.day && p.owner >= 0) h += `<div class="note">未統合地（${START_YEAR + Math.floor(p.coreUntil / 360)}年まで収入・兵力半減）</div>`;
  h += `<h3>開発度 <small>合計 ${dev(p)}</small></h3><div class="devgrid">`;
  for (const k in DEV_TYPES) {
    const pt = DEV_TYPES[k].pt, c = devCost(n, p);
    h += `<div class="devbox"><div class="lbl">${DEV_TYPES[k].name}</div><div class="val">${p[k]}</div>${mine ? btn('dev', k, `+1 <small class="cost-${pt}">${c}</small>`, { disabled: n[pt] < c, title: `${PT_NAMES[pt]}点${c}で${DEV_TYPES[k].name}+1` }) : ''}</div>`;
  }
  h += `</div>`;
  if (p.owner >= 0) {
    const inc = provIncome(p, nat(p.owner));
    h += `<div class="kv" style="margin-top:8px"><span>要塞</span><span>${p.fort > 0 ? 'Lv' + p.fort : 'なし'}</span><span>月収（税＋生産）</span><span>${fmt(inc.tax + inc.prod, 2)}</span></div>`;
  }
  if (mine) {
    h += `<h3>建物</h3><div class="blist">`;
    for (const k in BUILDINGS) {
      const B = BUILDINGS[k], c = buildCost(n, k);
      h += p.b[k] ? `<div class="bitem done"><b>✓ ${B.name}</b><small>${B.desc}</small></div>`
        : `<div class="bitem"><b>${B.name}</b><small>${B.desc}</small>${btn('build', k, `建設 💰${c}`, { disabled: n.gold < c || !ctrl })}</div>`;
    }
    h += `</div>`;
    h += `<h3>徴兵 <small>人的資源 ${fmtMen(n.manpower)}</small></h3>`;
    if (canRecruitAt(S.player, p.id)) {
      h += `<div class="btns full">`;
      for (const t in UNITS) h += btn('recruit', t, `${unitName(S.player, t)}<small>💰${UNITS[t].cost}</small>`, { disabled: n.gold < UNITS[t].cost || n.manpower < 1000, title: `1連隊(1000人) 維持費${UNITS[t].maint}/月 戦闘力${UNITS[t].power}` });
      h += `</div><p class="note">1連隊＝1000人。シフト＋クリックで5連隊まとめて徴兵。</p>`;
    } else h += `<p class="note">占領中または敵軍がいるため徴兵できない。</p>`;
  } else if (p.owner < 0) {
    h += `<h3>入植</h3>`;
    if (p.colonizing) h += `<div class="okbox">⛺ ${esc(nat(p.colonizing.by).name)}が入植中（${dateStr(p.colonizing.until)}完了予定）</div>`;
    else if (canColonize(S.player, p.id)) { const c = colonizeCost(n); h += btn('colonize', p.id, `⛺ 入植する 💰${c}`, { cls: 'gold', disabled: n.gold < c }) + `<p class="note">150日後に自国領となる。</p>`; }
    else h += `<p class="note">自国領に隣接する未開の地にのみ入植できる。</p>`;
  } else {
    h += `<h3>外交</h3><div class="btns">${btn('nation', p.owner, '国を見る')}${diploButtons(p.owner)}</div>`;
  }
  const here = S.armies.filter(a => a.prov === p.id);
  if (here.length) {
    h += `<h3>駐留軍</h3><div class="rows">` + here.map(a => `<div class="row" data-act="army" data-arg="${a.id}"><i class="dot" style="background:${rgb(nat(a.owner).color)}"></i><span class="nm">${esc(a.name)}${a.owner === MONSTER ? '' : ' <small style="color:var(--ink-3)">' + esc(nat(a.owner).short) + '</small>'}</span><span class="num">${fmtMen(armyMen(a))}</span></div>`).join('') + `</div>`;
  }
  return h;
}
function armyStatus(a) {
  if (S.battles[a.prov] && a.inBattle) return '<span class="chip war">⚔ 交戦中</span>';
  if (a.retreat) return '<span class="chip war">退却中</span>';
  if (a.path.length) return `<span class="chip">→ ${esc(prov(a.path[a.path.length - 1]).name)}へ移動中</span>`;
  const p = prov(a.prov);
  if (p.siege && p.siege.by === a.owner) return `<span class="chip">🏰 包囲中 ${Math.round(p.siege.prog / p.siege.need * 100)}%</span>`;
  return '<span class="chip">待機中</span>';
}
function armyPanel(a) {
  const mine = a.owner === S.player, mm = maxMorale(a.owner);
  let h = `<h2>${a.hero ? '★ ' : ''}${esc(a.name)}</h2><div class="sub">${a.owner === MONSTER ? '<span class="chip war">👹 魔物</span>' : natTag(a.owner)}<span>📍 <a data-act="prov" data-arg="${a.prov}" style="cursor:pointer;text-decoration:underline">${esc(prov(a.prov).name)}</a></span>${armyStatus(a)}</div>`;
  h += `<h3>士気 <small>${a.morale.toFixed(2)} / ${mm.toFixed(1)}</small></h3><div class="meter"><i style="width:${clamp(a.morale / mm, 0, 1) * 100}%;background:${a.morale / mm > .5 ? 'var(--good)' : 'var(--war)'}"></i></div>`;
  h += `<h3>編成 <small>総兵力 ${fmt(Math.round(armyMen(a)))}</small></h3><table class="unit-tbl"><tr><td style="color:var(--ink-3)">兵種</td><td style="color:var(--ink-3)">連隊</td><td style="color:var(--ink-3)">兵数</td></tr>`;
  for (const t in UNITS) if (a.regs[t] || a.men[t]) h += `<tr><td>${a.owner === MONSTER ? '魔物' : unitName(a.owner, t)}</td><td>${a.regs[t]}</td><td>${fmt(Math.round(a.men[t]))}</td></tr>`;
  h += `</table>`;
  if (a.owner !== MONSTER) h += `<div class="kv" style="margin-top:8px"><span>推定戦闘力</span><span>${armyPower(a).toFixed(1)}</span><span>戦闘力補正</span><span>${Math.round(combatMod(a, a.prov) * 100)}%</span></div>`;
  if (a.expire && a.owner === MONSTER) h += `<p class="note">${dateStr(a.expire)}頃に散り散りになる。</p>`;
  if (mine) {
    const others = S.armies.filter(b => b !== a && b.owner === a.owner && b.prov === a.prov && !b.inBattle && !b.retreat);
    h += `<h3>命令</h3><div class="btns full">${btn('army-move', a.id, moveMode ? '移動先を選択中…' : '🚩 移動', { cls: 'gold', disabled: a.inBattle || a.retreat })}${btn('army-stop', a.id, '停止', { disabled: !a.path.length || a.retreat })}</div>
      <div class="btns full" style="margin-top:5px">${btn('army-split', a.id, '分割', { disabled: armyRegs(a) < 2 || a.inBattle })}${btn('army-merge', a.id, `統合${others.length ? '(' + others.length + ')' : ''}`, { disabled: !others.length || a.inBattle })}${btn('army-disband', a.id, '解散', { cls: 'red', disabled: a.inBattle })}</div>
      <p class="note">右クリック（スマホは「移動」→タップ）で移動先を指定。自国が支配する州にいると毎月兵が補充される。</p>`;
  }
  return h;
}
function diploButtons(id) {
  const P = S.player, n = me();
  if (id === P || id < 0 || id === MONSTER || !nat(id).alive) return '';
  let h = '';
  h += btn('improve', id, `関係改善 <small class="cost-dip">${improveRelCost()}</small>`, { disabled: n.dip < improveRelCost(), title: '外交点を使って関係値を上げる' });
  if (isAlly(P, id)) h += btn('unally', id, '同盟破棄');
  else h += btn('ally', id, '同盟提案', { cls: 'blue', disabled: atWar(P, id) });
  if (!atWar(P, id)) h += btn('declare', id, '⚔ 宣戦布告', { cls: 'red', disabled: isAlly(P, id) || hasTruce(P, id), title: hasTruce(P, id) ? '休戦中は宣戦できない' : '' });
  return h;
}
function nationPanel() {
  const n = me(), inc = calcIncome(n), c = CHEAT_BY_ID[n.cheat];
  let h = `<h2><i class="dot" style="background:${rgb(n.color)};width:16px;height:16px;margin-right:6px"></i>${esc(n.name)}</h2><div class="sub"><span>${RACES[n.race].name}</span><span>・${n.gov}</span><span>・首都 ${esc(prov(n.capital).name)}</span></div>`;
  h += `<h3>君主</h3><div class="ruler"><div class="portrait">👑</div><div><b style="font-family:var(--serif);font-size:15px">${esc(n.ruler.name)}</b> <span class="chip me">転生者</span><div class="stats3"><span class="cost-adm">統 ${n.ruler.adm}</span><span class="cost-dip">外 ${n.ruler.dip}</span><span class="cost-mil">軍 ${n.ruler.mil}</span></div><div class="note" style="margin-top:2px">チート：<b style="color:var(--gold-2)">${c.name}</b> — ${c.desc}</div></div></div>`;
  h += `<div class="note">種族特性（${RACES[n.race].name}）：${RACES[n.race].desc}</div>`;
  if (n.timed.length) h += `<div class="note">一時効果：${n.timed.map(m => `${esc(m.label || m.key)}（${START_YEAR + Math.floor(m.until / 360)}年まで）`).join('、')}</div>`;
  h += `<h3>月次収支</h3><div class="kv"><span>税収</span><span>+${fmt(inc.tax, 2)}</span><span>生産</span><span>+${fmt(inc.prod, 2)}</span><span>軍の維持費</span><span>−${fmt(inc.maint, 2)}</span><span>建物の維持費</span><span>−${fmt(inc.bmaint, 2)}</span><span class="tot">収支</span><span class="tot ${inc.net >= 0 ? 'rel-pos' : 'rel-neg'}">${inc.net >= 0 ? '+' : ''}${fmt(inc.net, 2)}</span></div>`;
  if (inc.regs > inc.fl) h += `<div class="warn">維持限界を超えている：維持費が増大中</div>`;
  if (n.gold < 0) h += `<div class="warn">財政赤字：軍の士気と人的資源の回復が低下</div>`;
  h += `<h3>国力</h3><div class="kv"><span>州数</span><span>${ownedProvs(n.id).length}</span><span>総開発度</span><span>${inc.dev}</span><span>連隊 / 維持限界</span><span>${inc.regs} / ${inc.fl}</span><span>人的資源</span><span>${fmt(Math.round(n.manpower))} / ${fmt(maxManpower(n))}</span><span>月間獲得点</span><span><span class="cost-adm">${3 + n.ruler.adm + natMod(n, 'admPts')}</span> / <span class="cost-dip">${3 + n.ruler.dip + natMod(n, 'dipPts')}</span> / <span class="cost-mil">${3 + n.ruler.mil + natMod(n, 'milPts')}</span></span><span>世界順位（開発度）</span><span>${worldRank()}位</span></div>`;
  h += `<h3>自軍一覧</h3><div class="rows">` + (S.armies.filter(a => a.owner === S.player).map(a => `<div class="row" data-act="army" data-arg="${a.id}"><span class="nm">${a.hero ? '★' : ''}${esc(a.name)} <small style="color:var(--ink-3)">${esc(prov(a.prov).name)}</small></span><span class="num">${fmtMen(armyMen(a))}</span></div>`).join('') || '<p class="note">軍がない。州を選んで徴兵しよう。</p>') + `</div>`;
  h += `<h3>システム</h3><div class="btns full">${btn('save', 0, '💾 セーブ')}${btn('load', 0, '📂 ロード', { disabled: !hasSave() })}${btn('newgame', 0, '最初から', { cls: 'red' })}</div><p class="note">毎年1月1日に自動セーブされる。</p>`;
  return h;
}
function worldRank() {
  const r = S.nations.filter(n => !n.isMonster && n.alive).map(n => ({ id: n.id, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  return r.findIndex(x => x.id === S.player) + 1;
}
function diploPanel() {
  const list = S.nations.filter(n => !n.isMonster && n.alive && n.id !== S.player).map(n => ({ n, d: totalDev(n.id) })).sort((a, b) => b.d - a.d);
  let h = `<h2>外交</h2><p class="note">関係値が高い国ほど同盟を受け入れやすい。同盟国は防衛戦争に参戦する。</p><div class="rows" style="margin-top:8px">`;
  for (const { n, d } of list) {
    h += `<div class="row ${diploSel === n.id ? 'on' : ''}" data-act="dsel" data-arg="${n.id}"><i class="dot" style="background:${rgb(n.color)}"></i><span class="nm">${esc(n.name)}</span>${relStatus(n.id)}<span class="num">${relSpan(getRel(S.player, n.id))}</span></div>`;
    if (diploSel === n.id) {
      const pw = nationPower(n.id), mp = nationPower(S.player);
      h += `<div class="detail"><div class="kv"><span>種族・政体</span><span>${RACES[n.race].name}・${n.gov}</span><span>君主</span><span>${esc(n.ruler.name)}（${n.ruler.adm}/${n.ruler.dip}/${n.ruler.mil}）</span><span>総開発度</span><span>${d}</span><span>軍勢</span><span>約${fmtMen(S.armies.filter(a => a.owner === n.id).reduce((s, a) => s + armyMen(a), 0))}（自国比 ${mp > 0 ? Math.round(pw / mp * 100) : '—'}%）</span><span>同盟国</span><span>${n.allies.map(i => esc(nat(i).short)).join('、') || 'なし'}</span><span>戦争</span><span>${warsOf(n.id).length ? warsOf(n.id).map(w => esc(w.name)).join('、') : 'なし'}</span></div><div class="btns" style="margin-top:8px">${btn('goto', n.capital, '📍 首都へ')}${diploButtons(n.id)}</div></div>`;
    }
  }
  return h + `</div>`;
}
function warPanel() {
  const mine = warsOf(S.player), others = S.wars.filter(w => !sideOf(w, S.player));
  let h = `<h2>戦争</h2>`;
  if (!mine.length) h += `<p class="note">我が国は平和だ。他国の州を選ぶか外交タブから宣戦布告できる。<br>敵の州を包囲・占領し、会戦に勝利すると戦勝点が貯まる。戦勝点の分だけ占領地を割譲させられる。</p>`;
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
function techPanel() {
  const n = me();
  let h = `<h2>技術</h2><p class="note">君主の点数を使って技術を研究する。技術が上がるほど国は豊かに、軍は強くなる。</p><div style="margin-top:10px">`;
  for (const t in TECHS) {
    const c = techCost(n, t);
    h += `<div class="techrow"><div class="lv">${n.tech[t]}</div><div class="info"><b class="cost-${t}">${TECHS[t].name}</b><small>${TECHS[t].desc}</small><small>所持 ${Math.floor(n[t])} / 必要 ${c}</small></div>${btn('tech', t, '研究', { cls: 'gold', disabled: n[t] < c })}</div>`;
  }
  h += `</div><h3>点数の使い道</h3><p class="note"><span class="cost-adm">統治点</span>：統治技術、州の「税」開発<br><span class="cost-dip">外交点</span>：外交技術、州の「生産」開発、関係改善<br><span class="cost-mil">軍事点</span>：軍事技術、州の「兵力」開発</p>`;
  return h;
}

// ---------- 行動 ----------
function act(name, arg, ev) {
  const n = S.player >= 0 ? me() : null;
  const selProv = S.sel && S.sel.type === 'prov' ? prov(S.sel.id) : null;
  const selArmy = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  switch (name) {
    case 'tab': tab = arg; openPanel(); break;
    case 'close': $('panel').classList.add('hidden'); document.body.classList.remove('panel-open'); break;
    case 'prov': select({ type: 'prov', id: +arg }); { const p = prov(+arg); centerOn(p.x, p.y); } break;
    case 'army': select({ type: 'army', id: +arg }); break;
    case 'nation': tab = 'diplo'; diploSel = +arg; break;
    case 'dsel': diploSel = diploSel === +arg ? -1 : +arg; break;
    case 'goto': { const p = prov(+arg); centerOn(p.x, p.y, Math.max(cam.s, 1.6)); select({ type: 'prov', id: +arg }, true); } break;
    case 'dev': if (selProv) develop(n, selProv, arg); break;
    case 'build': if (selProv) build(n, selProv, arg); mapDirty = true; break;
    case 'recruit': if (selProv) { const k = ev && ev.shiftKey ? 5 : 1; let ok = 0; for (let i = 0; i < k; i++) if (recruit(S.player, selProv.id, arg)) ok++; if (!ok) hooks.log('金貨か人的資源が足りない', 'bad'); } break;
    case 'colonize': if (colonize(S.player, +arg)) { hooks.log(`⛺ ${prov(+arg).name}への入植を開始した`, 'info'); mapDirty = true; } break;
    case 'improve': if (improveRel(n, +arg)) hooks.log(`${nat(+arg).name}との関係が改善した`, 'good'); break;
    case 'ally': proposeAlliance(+arg); break;
    case 'unally': breakAlliance(S.player, +arg); addRel(S.player, +arg, -30); hooks.log(`${nat(+arg).name}との同盟を破棄した`, 'bad'); break;
    case 'declare': confirmDeclare(+arg); break;
    case 'peace': openPeace(S.wars.find(w => w.id === +arg)); break;
    case 'tech': if (buyTech(n, arg)) hooks.log(`${TECHS[arg].name}がLv${n.tech[arg]}になった`, 'good'); break;
    case 'army-move': moveMode = !moveMode; updateBanner(); break;
    case 'army-stop': if (selArmy) { selArmy.path = []; selArmy.prog = 0; } break;
    case 'army-split': if (selArmy) { const b = splitArmy(selArmy); if (b) select({ type: 'army', id: b.id }); } break;
    case 'army-merge': if (selArmy) mergeArmies([selArmy, ...S.armies.filter(b => b !== selArmy && b.owner === selArmy.owner && b.prov === selArmy.prov && !b.inBattle && !b.retreat)]); break;
    case 'army-disband': if (selArmy) hooks.modal({ title: '軍の解散', body: `${esc(selArmy.name)}（${fmtMen(armyMen(selArmy))}）を解散しますか？<br>兵の半数は人的資源に戻る。`, buttons: [{ label: '解散する', fn: () => { n.manpower = Math.min(maxManpower(n), n.manpower + armyMen(selArmy) / 2); destroyArmy(selArmy); S.sel = { type: 'prov', id: selArmy.prov }; } }, { label: 'やめる' }] }); break;
    case 'save': hooks.log(saveGame() ? '💾 セーブした' : 'セーブに失敗した', 'info'); break;
    case 'load': if (loadGame()) { afterLoad(); hooks.log('📂 ロードした', 'info'); } break;
    case 'newgame': hooks.modal({ title: '最初から', body: '現在のゲームを破棄して、新しい大陸で始めますか？', buttons: [{ label: '新しく始める', fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } }, { label: 'やめる' }] }); break;
  }
  refresh(true);
}
function proposeAlliance(id) {
  const o = nat(id), r = getRel(S.player, id) + natMod(me(), 'allyAccept');
  const ok = r >= 40 && o.allies.length < 3 && !hostile(S.player, id);
  if (ok) { addAlliance(S.player, id); hooks.log(`🤝 ${o.name}と同盟を結んだ`, 'good'); }
  else hooks.log(`${o.name}は同盟を拒否した（関係値40以上が必要${o.allies.length >= 3 ? '、同盟枠が埋まっている' : ''}）`, 'bad');
}
function confirmDeclare(id) {
  const o = nat(id);
  const joiners = o.allies.filter(a => a !== S.player && !isAlly(a, S.player) && nat(a).alive);
  hooks.modal({
    title: '⚔ 宣戦布告', body: `<b>${esc(o.name)}</b>に宣戦布告しますか？<br><br>敵の同盟国（参戦見込み）：${joiners.map(a => esc(nat(a).name)).join('、') || 'なし'}<br>我が同盟国は60%の確率で参戦する。<br><br>敵戦力：約${fmtMen(S.armies.filter(a => a.owner === id).reduce((s, a) => s + armyMen(a), 0))}　自軍：約${fmtMen(S.armies.filter(a => a.owner === S.player).reduce((s, a) => s + armyMen(a), 0))}`,
    buttons: [{ label: '宣戦布告する', fn: () => { const w = declareWar(S.player, id); if (w) { for (const al of me().allies) { if (!sideOf(w, al)) continue; } hooks.log(`⚔ ${o.name}に宣戦布告した！ 参戦：${w.att.map(i => nat(i).short).join('・')} 対 ${w.def.map(i => nat(i).short).join('・')}`, 'war'); tab = 'war'; } } }, { label: 'やめる' }],
  });
}
function openPeace(w) {
  if (!w) return;
  const side = sideOf(w, S.player), lose = side === 'att' ? 'def' : 'att';
  const s = warScore(w), sP = side === 'att' ? s : -s;
  const cand = S.provinces.filter(p => w[lose].includes(p.owner) && w[side].includes(p.controller)).sort((a, b) => dev(b) - dev(a));
  const enemy = nat(w[lose][0]);
  const body = `<div class="wsbar"><i style="left:${sP >= 0 ? 50 : 50 + sP / 2}%;width:${Math.abs(sP) / 2}%;background:${sP >= 0 ? 'var(--good)' : 'var(--bad)'}"></i><div class="mid"></div><span>戦勝点 ${Math.round(sP)}</span></div>
    相手：<b>${esc(enemy.name)}</b><br>${cand.length ? '割譲を要求する州を選ぶ（合計コストが戦勝点以下なら受諾される）：' : '<span class="note">要求できる占領地がない。</span>'}
    <div class="plist">${cand.map(p => `<label><input type="checkbox" data-pid="${p.id}"><span>${esc(p.name)} <small style="color:var(--ink-3)">${esc(nat(p.owner).short)}・開発${dev(p)}</small></span><em>${Math.round(provPeaceCost(w, p, lose))}</em></label>`).join('')}</div>
    <div>選択コスト：<b id="pc-total">0</b> / ${Math.max(0, Math.round(sP))}</div>`;
  hooks.modal({
    title: '🕊 講和交渉', body,
    mount: (el) => {
      const upd = () => { let t = 0; el.querySelectorAll('[data-pid]:checked').forEach(c => t += provPeaceCost(w, prov(+c.dataset.pid), lose)); el.querySelector('#pc-total').textContent = Math.round(t); el.querySelector('#pc-total').style.color = t <= sP + 0.01 ? 'var(--good)' : 'var(--bad)'; };
      el.querySelectorAll('[data-pid]').forEach(c => c.onchange = upd);
    },
    buttons: [
      { label: '割譲を要求する', desc: '選んだ州を割譲させる', fn: null, keep: true },
      { label: '白紙和平を提案する', desc: '領土の変更なしで戦争を終える' },
      { label: 'やめる' },
    ],
  });
  const m = modalQueue[modalQueue.length - 1];
  m.buttons[0].fn = () => {
    const ids = [...$('modal').querySelectorAll('[data-pid]:checked')].map(c => +c.dataset.pid);
    if (!ids.length) return;
    modalQueue.shift(); $('modal-wrap').classList.add('hidden');
    if (aiAcceptsPeace(w, side, ids)) makePeace(w, side, ids);
    else hooks.log(`${enemy.name}は講和を拒否した（戦勝点が足りない）`, 'bad');
    refresh(true); if (modalQueue.length) showModal();
  };
  m.buttons[1].fn = () => { if (aiAcceptsPeace(w, side, [])) makePeace(w, null, []); else hooks.log(`${enemy.name}は白紙和平を拒否した`, 'bad'); };
  if (modalQueue.length === 1) showModal();
}

function select(sel, keepTab) {
  S.sel = sel; moveMode = false; updateBanner();
  if (!keepTab) tab = 'sel';
  openPanel(); mapDirty = true;
}
function openPanel() { $('panel').classList.remove('hidden'); document.body.classList.add('panel-open'); }
function updateBanner() {
  $('banner').classList.toggle('hidden', !moveMode);
  $('banner').textContent = '🚩 移動先の州をクリック（Escでキャンセル）';
  $('map').classList.toggle('targeting', moveMode);
}
function orderMove(a, pid) {
  if (a.inBattle) { hooks.log('交戦中の軍は移動できない', 'bad'); return; }
  if (a.retreat) { hooks.log('退却中の軍には命令できない', 'bad'); return; }
  if (pid === a.prov) { a.path = []; a.prog = 0; return; }
  if (!moveArmyTo(a, pid)) hooks.log(`${prov(pid).name}へは進軍できない（通行権がない／経路がない）`, 'bad');
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
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(mx, my, (pinch.s * d / pinch.d) / cam.s);
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
    if (drag && !drag.moved && pts.size === 0) {
      if (drag.button === 2) rightClick(e.offsetX, e.offsetY); else leftClick(e.offsetX, e.offsetY);
    }
    if (pts.size === 0) { drag = null; cv.classList.remove('dragging'); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) { act(el.dataset.act, el.dataset.arg, e); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { mapMode = m.dataset.mode; document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b === m)); mapDirty = true; }
  });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (!S.started || S.over || modalQueue.length) return;
    if (e.code === 'Space') { e.preventDefault(); S.paused = !S.paused; }
    else if (e.key >= '1' && e.key <= '5') S.speed = +e.key;
    else if (e.key === '+' || e.key === '=') S.speed = Math.min(5, S.speed + 1);
    else if (e.key === '-') S.speed = Math.max(1, S.speed - 1);
    else if (e.key === 'Escape') { if (moveMode) { moveMode = false; updateBanner(); } else { S.sel = null; mapDirty = true; } }
    refresh(true);
  });
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
  if (moveMode && selArmy) {
    const pid = provAt(x, y);
    if (pid >= 0) orderMove(selArmy, pid);
    moveMode = false; updateBanner(); refresh(true); return;
  }
  const bid = badgeAt(x, y);
  if (bid >= 0) {
    // 同じ場所の軍を順に選択
    select({ type: 'army', id: bid }); refresh(true); return;
  }
  const pid = provAt(x, y);
  if (pid >= 0) select({ type: 'prov', id: pid });
  else { S.sel = null; mapDirty = true; }
  refresh(true);
}
function rightClick(x, y) {
  if (!S.started) return;
  const selArmy = S.sel && S.sel.type === 'army' ? S.armies.find(a => a.id === S.sel.id) : null;
  if (!selArmy || selArmy.owner !== S.player) return;
  const pid = provAt(x, y);
  if (pid >= 0) orderMove(selArmy, pid);
  moveMode = false; updateBanner(); refresh(true);
}

// ---------- 開始画面 ----------
function renderStart() {
  const list = S.nations.filter(n => !n.isMonster).map(n => ({ n, d: totalDev(n.id), c: ownedProvs(n.id).length }));
  $('st-nations').innerHTML = list.map(({ n, d, c }) => `<button class="ncard ${startSel === n.id ? 'on' : ''}" data-sn="${n.id}"><i class="dot" style="background:${rgb(n.color)}"></i><span class="nm">${esc(n.name)}<span class="diff ${n.size}">${SIZE_LABEL[n.size]}</span></span><span class="meta">${RACES[n.race].name}・${c}州<br>開発度 ${d}</span></button>`).join('');
  if (startSel > 0) {
    const n = nat(startSel);
    $('st-nations').querySelector(`[data-sn="${startSel}"]`).insertAdjacentHTML('afterend', `<div class="detail" id="st-detail"><b>${RACES[n.race].name}</b>：${RACES[n.race].desc}<br><span class="note">同盟：${n.allies.map(i => esc(nat(i).name)).join('、') || 'なし'}${n.demonKing ? '<br>⚠ 魔王国は周辺国すべてから敵視されている。' : ''}</span></div>`);
  }
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
  startGame(startSel, startCheat, $('st-name').value.trim() || 'カイト');
  $('start').classList.add('hidden');
  const c = prov(nat(S.player).capital);
  focusCapital(c);
  select({ type: 'prov', id: c.id });
  tab = 'nation';
  hooks.modal({
    title: '✨ 転生', body: `目を覚ますと、豪奢な天蓋付きの寝台の上だった。<br>侍従が告げる——「陛下、${esc(nat(S.player).name)}の民がお待ちです」<br><br>あなたは<b>${esc(nat(S.player).ruler.name)}</b>として、この国を百年導くことになった。<br>授かったスキルは<b>「${CHEAT_BY_ID[startCheat].name}」</b>。<br><br><span class="note">▶ Spaceまたは右上の▶で時間が進む。<br>▶ まずは州を開発し、軍を整え、隣国の動きに注意しよう。<br>▶ 魔物の群れが各地に湧く。放置すると州を占領される。</span>`,
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
function refresh(force) { renderTop(); renderPanel(force); }
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
