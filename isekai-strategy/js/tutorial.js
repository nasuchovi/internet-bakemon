'use strict';
// ===== チュートリアル（本編の中で目標をこなす形式） =====
function tutMonster() { return S.armies.find(a => a.id === S.tut.monsterId); }
const TUT_STEPS = [
  {
    title: '魔物を迎え撃て',
    start() {
      const cap = prov(nat(S.player).capital);
      const p = prov(cap.nb.find(q => prov(q).owner === S.player) ?? cap.id);
      const a = spawnMonsters(p, 2500); a.name = 'ゴブリンの群れ'; a.expire = S.day + 3600; a.bounty = true;
      S.tut.monsterId = a.id; S.tut.target = p.id;
      centerOn((cap.x + p.x) / 2, (cap.y + p.y) / 2 + (window.innerWidth <= 760 ? viewH() * 0.12 / cam.s : 0));
    },
    text: () => document.body.classList.contains('m')
      ? `首都の隣の<b>${esc(prov(S.tut.target).name)}</b>に魔物が現れた！<br>① 自軍の旗（★のついたもの）をタップして選ぶ<br>② 魔物の旗をタップし「<b>⚔ 向かわせて攻撃</b>」を選ぶ（長押しなら即移動）`
      : `首都の隣の<b>${esc(prov(S.tut.target).name)}</b>に魔物が現れた！<br>① 地図上の自軍の旗（★のついたもの）をクリックして選ぶ<br>② 魔物のいる州を<b>右クリック</b>`,
    check: () => !tutMonster() || S.armies.some(a => a.owner === S.player && (a.prov === S.tut.target || a.path.includes(S.tut.target))),
  },
  {
    title: '時間を進めて戦う',
    focus: '#btn-pause',
    text: () => `${document.body.classList.contains('m') ? '右下の<b>▶ボタン</b>' : '右上の<b>▶ボタン（またはSpace）</b>'}で時間が進む。<br>軍が到着すると戦闘が始まる。勝てば魔物は消える。`,
    check: () => !tutMonster(),
    reward: { gold: 50, label: '金貨+50' },
  },
  {
    title: '州を開発する',
    start() { S.tut.dev0 = totalDev(S.player); },
    text: () => `自国の州を${document.body.classList.contains('m') ? 'タップ' : 'クリック'}し、「<b>🏗 開拓</b>」を押して発展度を上げよう。<br>政務は毎月貯まる。発展度が上がると収入や兵力が増える。州に<b>代官</b>を置けば自然に発展していく。`,
    check: () => totalDev(S.player) > S.tut.dev0,
    reward: { mana: true, label: '初回の召喚に必要な魔力' },
  },
  {
    title: '異世界人を召喚する',
    focus: '.tabs [data-arg="hero"]',
    start() { S.tutSafe = true; },
    text: () => `「<b>英雄</b>」タブを開き、「召喚の儀を行う」を押そう。<br>日本からチート能力者がやってくる。将軍は軍の画面で配属できる。`,
    check: () => (nat(S.player).summonCount || 0) >= 1,
    end() { S.tutSafe = false; },
    reward: { xp: 20, label: '経験値+20' },
  },
  {
    title: 'ダンジョンに挑む',
    start() {
      const P = S.player, cap = nat(P).capital;
      let p = ownedProvs(P).find(q => q.dungeon && !q.dungeon.cleared && q.controller === P);
      if (!p) { p = ownedProvs(P).filter(q => q.id !== cap && q.id !== S.tut.target && q.controller === P).sort((a, b) => Math.hypot(a.x - prov(cap).x, a.y - prov(cap).y) - Math.hypot(b.x - prov(cap).x, b.y - prov(cap).y))[0] || prov(cap); p.dungeon = { lv: 1, cleared: false }; }
      S.tut.dg = p.id; S.tutDelve = false;
    },
    text: () => `地図の<b>🕳</b>はダンジョン。<b>${esc(prov(S.tut.dg).name)}</b>に軍を移動させ、軍の画面で「<b>ダンジョン攻略</b>」を押そう。<br>財宝・魔力・秘宝が手に入る。`,
    check: () => !!S.tutDelve,
    reward: { xp: 20, label: '経験値+20' },
  },
  {
    title: '覇道へ',
    text: () => `これで基本はおしまい！<br>・他国に宣戦して領土を奪うと、周辺国の<b>警戒度</b>が上がる。50を超えた国々は<b>対抗同盟</b>を組んで襲ってくる。<br>・召喚を重ねると<b>次元の歪み</b>が溜まり、魔物や召喚事故が増える。<br>・「<b>技能</b>」タブでスキルを習得しよう。`,
    button: '覇道を歩み始める',
    check: () => false,
    reward: { xp: 30, label: '経験値+30' },
  },
];
function tutTick() {
  const box = document.getElementById('tut');
  document.querySelectorAll('.pulse').forEach(el => el.classList.remove('pulse'));
  if (!S || !S.started || !S.tut || S.tut.done) { box.classList.add('hidden'); return; }
  const st = TUT_STEPS[S.tut.step];
  if (!S.tut.started) { S.tut.started = true; if (st.start) st.start(); }
  if (st.check()) { tutComplete(); return; }
  if (st.focus) document.querySelectorAll(st.focus).forEach(el => el.classList.add('pulse'));
  const html = `<div class="tut-h"><span>📖 チュートリアル ${S.tut.step + 1}/${TUT_STEPS.length}</span><button data-tut="skip">スキップ</button></div><b class="tut-t">${st.title}</b><div class="tut-b">${st.text()}</div>${st.button ? `<button class="btn gold" data-tut="next" style="margin-top:8px;width:100%">${st.button}</button>` : ''}${st.reward ? `<div class="tut-r">報酬：${st.reward.label}</div>` : ''}`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  box.classList.remove('hidden');
}
function tutComplete() {
  const st = TUT_STEPS[S.tut.step], n = nat(S.player);
  if (st.end) st.end();
  const r = st.reward || {};
  if (r.gold) n.gold += r.gold;
  if (r.mana) n.mana = Math.max(n.mana, summonCost(n));
  if (r.xp) gainXP(n, r.xp);
  hooks.fx('win', null, '目標達成！');
  if (r.label) hooks.log(`📖 チュートリアル「${st.title}」達成 — ${r.label}`, 'good');
  S.tut.step++; S.tut.started = false;
  if (S.tut.step >= TUT_STEPS.length) { S.tut.done = true; S.tutSafe = false; hooks.log('📖 チュートリアル完了！ 百年の覇道が始まる', 'good'); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tut]'); if (!b || !S || !S.tut) return;
  if (b.dataset.tut === 'skip') { const st = TUT_STEPS[S.tut.step]; if (st && st.end) st.end(); S.tut.done = true; S.tutSafe = false; }
  if (b.dataset.tut === 'next') tutComplete();
  tutTick();
});
