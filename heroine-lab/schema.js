/**
 * ヒロイン設定スキーマ
 *
 * ここが唯一の真実。UI・プロンプト生成・キャラカード(JSON)の
 * すべてがこの定義から自動的に組み立てられる。
 * 項目を足したいときは、このファイルに1行足すだけでよい。
 *
 * select 項目:  options[].tags  … 画像プロンプトへ足すタグ
 *               options[].voice … 音声パラメータへのマージ値
 *               options[].persona … 台詞生成用ペルソナ文へ足す文
 * range 項目:   min/max/step/default、voiceKey があれば音声パラメータへ写像
 */

export const SCHEMA = [
  {
    id: 'basic',
    label: '基本',
    fields: [
      { id: 'name', type: 'text', label: '名前', placeholder: '例: 綾瀬 しおり', default: '' },
      {
        id: 'ageBand', type: 'select', label: '年齢層', default: 'a20e',
        note: '本システムは成人キャラクターのみを対象とします。',
        options: [
          { id: 'a20e', label: '20代前半', tags: ['adult woman', 'early 20s'], persona: '20代前半の成人女性' },
          { id: 'a20l', label: '20代後半', tags: ['adult woman', 'late 20s'], persona: '20代後半の成人女性' },
          { id: 'a30',  label: '30代',     tags: ['adult woman', '30s', 'mature female'], persona: '30代の成人女性' },
          { id: 'a40',  label: '40代',     tags: ['adult woman', '40s', 'mature female'], persona: '40代の成人女性' },
        ],
      },
    ],
  },
  {
    id: 'appearance',
    label: '容姿',
    fields: [
      {
        id: 'hairLength', type: 'select', label: '髪の長さ', default: 'semilong',
        options: [
          { id: 'short',    label: 'ショート',   tags: ['short hair'] },
          { id: 'bob',      label: 'ボブ',       tags: ['bob cut'] },
          { id: 'semilong', label: 'セミロング', tags: ['medium hair'] },
          { id: 'long',     label: 'ロング',     tags: ['long hair'] },
          { id: 'verylong', label: '超ロング',   tags: ['very long hair'] },
        ],
      },
      {
        id: 'hairStyle', type: 'select', label: '髪型', default: 'straight',
        options: [
          { id: 'straight', label: 'ストレート',   tags: ['straight hair'] },
          { id: 'wavy',     label: 'ゆるふわ',     tags: ['wavy hair'] },
          { id: 'ponytail', label: 'ポニーテール', tags: ['ponytail'] },
          { id: 'twin',     label: 'ツインテール', tags: ['twintails'] },
          { id: 'bun',      label: 'お団子',       tags: ['hair bun'] },
          { id: 'braid',    label: '編み込み',     tags: ['braided hair'] },
        ],
      },
      {
        id: 'hairColor', type: 'select', label: '髪の色', default: 'black',
        options: [
          { id: 'black',  label: '黒',     tags: ['black hair'],       hex: '#221c26' },
          { id: 'brown',  label: '濃茶',   tags: ['dark brown hair'],  hex: '#4a3226' },
          { id: 'flax',   label: '亜麻色', tags: ['light brown hair'], hex: '#b99464' },
          { id: 'blonde', label: '金',     tags: ['blonde hair'],      hex: '#e6c96a' },
          { id: 'red',    label: '赤',     tags: ['red hair'],         hex: '#c0392b' },
          { id: 'silver', label: '銀',     tags: ['silver hair'],      hex: '#c9c6d4' },
          { id: 'blue',   label: '青',     tags: ['blue hair'],        hex: '#4a6fd4' },
          { id: 'purple', label: '紫',     tags: ['purple hair'],      hex: '#8f5fc0' },
          { id: 'pink',   label: '桃',     tags: ['pink hair'],        hex: '#e07a9c' },
        ],
      },
      {
        id: 'eyeColor', type: 'select', label: '瞳の色', default: 'brown',
        options: [
          { id: 'black',  label: '黒',       tags: ['black eyes'],  hex: '#2a2430' },
          { id: 'brown',  label: '茶',       tags: ['brown eyes'],  hex: '#7a4a2b' },
          { id: 'blue',   label: '青',       tags: ['blue eyes'],   hex: '#3f7fd0' },
          { id: 'green',  label: '緑',       tags: ['green eyes'],  hex: '#3f9e6c' },
          { id: 'gold',   label: '金',       tags: ['yellow eyes'], hex: '#d8a63c' },
          { id: 'red',    label: '赤',       tags: ['red eyes'],    hex: '#cc3d4a' },
          { id: 'purple', label: '紫',       tags: ['purple eyes'], hex: '#9b5fd0' },
          { id: 'odd',    label: 'オッドアイ', tags: ['heterochromia'], hex: '#7fb4d8' },
        ],
      },
      {
        id: 'eyeShape', type: 'select', label: '目つき', default: 'normal',
        options: [
          { id: 'sharp',  label: 'つり目',   tags: ['tsurime'],      persona: '目つきは少しきつい' },
          { id: 'droopy', label: 'たれ目',   tags: ['tareme'],       persona: '目元がやわらかい' },
          { id: 'half',   label: 'ジト目',   tags: ['half-closed eyes'], persona: '半眼で見てくる癖がある' },
          { id: 'normal', label: '標準',     tags: [] },
          { id: 'big',    label: '大きな瞳', tags: ['large eyes'] },
        ],
      },
      {
        id: 'height', type: 'select', label: '身長', default: 'avg',
        options: [
          { id: 'petite', label: '低め (〜155cm)', tags: ['petite'] },
          { id: 'avg',    label: '平均 (156-165cm)', tags: [] },
          { id: 'tall',   label: '高め (166-172cm)', tags: ['tall female'] },
          { id: 'vtall',  label: '長身 (173cm〜)',   tags: ['very tall female'] },
        ],
      },
      {
        id: 'build', type: 'select', label: '体型', default: 'normal',
        options: [
          { id: 'slim',    label: '華奢',     tags: ['slender'] },
          { id: 'normal',  label: '標準',     tags: [] },
          { id: 'glamour', label: 'グラマー', tags: ['curvy'] },
          { id: 'fit',     label: '引き締まった', tags: ['toned body'] },
          { id: 'plump',   label: 'ふくよか', tags: ['plump'] },
        ],
      },
      {
        id: 'skin', type: 'select', label: '肌', default: 'fair',
        options: [
          { id: 'fair',   label: '色白',   tags: ['pale skin'],   hex: '#f3ddd0' },
          { id: 'normal', label: '健康的', tags: [],              hex: '#e8c3a8' },
          { id: 'tan',    label: '褐色',   tags: ['dark skin'],   hex: '#a9754f' },
        ],
      },
      {
        id: 'outfit', type: 'select', label: '服装', default: 'casual',
        options: [
          { id: 'casual',  label: '私服カジュアル', tags: ['casual clothes'] },
          { id: 'office',  label: 'オフィススーツ', tags: ['business suit', 'office lady'] },
          { id: 'kimono',  label: '和装',           tags: ['kimono'] },
          { id: 'dress',   label: 'ドレス',         tags: ['evening dress'] },
          { id: 'nurse',   label: 'ナース',         tags: ['nurse uniform'] },
          { id: 'maid',    label: 'メイド',         tags: ['maid outfit'] },
          { id: 'bar',     label: 'バーテンダー',   tags: ['bartender vest', 'necktie'] },
          { id: 'room',    label: '部屋着',         tags: ['loungewear'] },
        ],
      },
      {
        id: 'accessory', type: 'select', label: '装飾', default: 'none',
        options: [
          { id: 'none',     label: 'なし',       tags: [] },
          { id: 'glasses',  label: '眼鏡',       tags: ['glasses'] },
          { id: 'choker',   label: 'チョーカー', tags: ['choker'] },
          { id: 'earrings', label: 'ピアス',     tags: ['earrings'] },
          { id: 'ribbon',   label: 'リボン',     tags: ['hair ribbon'] },
          { id: 'headphone',label: 'ヘッドホン', tags: ['headphones around neck'] },
        ],
      },
      {
        id: 'mood', type: 'select', label: '雰囲気', default: 'pure',
        options: [
          { id: 'pure',   label: '清楚',         tags: ['elegant', 'soft lighting'], persona: '物腰がしとやか' },
          { id: 'sexy',   label: '妖艶',         tags: ['sultry expression'],        persona: '色気のある振る舞いをする' },
          { id: 'cool',   label: 'クール',       tags: ['cool expression'],          persona: '感情をあまり顔に出さない' },
          { id: 'genki',  label: '元気',         tags: ['cheerful smile'],           persona: '表情がころころ変わる' },
          { id: 'frail',  label: '儚げ',         tags: ['melancholic expression'],   persona: 'どこか影のある話し方をする' },
          { id: 'myst',   label: 'ミステリアス', tags: ['mysterious atmosphere'],    persona: '本心を明かさない' },
        ],
      },
    ],
  },
  {
    id: 'voice',
    label: '声質',
    fields: [
      {
        id: 'timbre', type: 'select', label: '声色', default: 'clear',
        options: [
          { id: 'clear',  label: '透明感',   voice: { style: 'Neutral', brightness: 0.6 }, persona: '澄んだ声' },
          { id: 'husky',  label: 'ハスキー', voice: { style: 'Neutral', brightness: 0.2, breath: 0.7 }, persona: '掠れた低い声' },
          { id: 'sweet',  label: '甘い',     voice: { style: 'Happy',   brightness: 0.75, breath: 0.5 }, persona: '甘く柔らかい声' },
          { id: 'calm',   label: '落ち着き', voice: { style: 'Neutral', brightness: 0.35 }, persona: '落ち着いた低めの声' },
          { id: 'crisp',  label: '凛とした', voice: { style: 'Neutral', brightness: 0.55, tension: 0.7 }, persona: 'はきはきした声' },
        ],
      },
      { id: 'pitch',   type: 'range', label: '声の高さ', min: -1, max: 1, step: 0.05, default: 0, ticks: ['低い', '高い'], voiceKey: 'pitch' },
      { id: 'speed',   type: 'range', label: '話す速さ', min: -1, max: 1, step: 0.05, default: 0, ticks: ['ゆっくり', '早口'], voiceKey: 'speed' },
      { id: 'emotion', type: 'range', label: '感情の起伏', min: 0, max: 1, step: 0.05, default: 0.5, ticks: ['平坦', '豊か'], voiceKey: 'emotion' },
      { id: 'breath',  type: 'range', label: '息づかい',   min: 0, max: 1, step: 0.05, default: 0.3, ticks: ['少ない', '多い'], voiceKey: 'breath' },
      {
        id: 'tone', type: 'select', label: '口調', default: 'polite',
        options: [
          { id: 'polite', label: '丁寧語',     persona: '常に丁寧語で話す（〜です、〜ます）' },
          { id: 'casual', label: 'タメ口',     persona: 'くだけたタメ口で話す' },
          { id: 'onee',   label: 'お姉さん口調', persona: '余裕のあるお姉さん口調（〜かしら、〜ね）で話す' },
          { id: 'blunt',  label: 'ぶっきらぼう', persona: '言葉少なでぶっきらぼうに話す' },
          { id: 'kansai', label: '関西弁',     persona: '関西弁で話す' },
        ],
      },
      {
        id: 'firstPerson', type: 'select', label: '一人称', default: 'watashi',
        options: [
          { id: 'watashi',  label: 'わたし',   persona: '一人称は「わたし」' },
          { id: 'atashi',   label: 'あたし',   persona: '一人称は「あたし」' },
          { id: 'watakushi',label: 'わたくし', persona: '一人称は「わたくし」' },
          { id: 'boku',     label: 'ぼく',     persona: '一人称は「ぼく」' },
          { id: 'jibun',    label: '自分',     persona: '一人称は「自分」' },
          { id: 'name',     label: '自分の名前', persona: '一人称に自分の名前を使う' },
        ],
      },
      {
        id: 'callPlayer', type: 'select', label: 'プレイヤーの呼び方', default: 'anata',
        options: [
          { id: 'anata', label: 'あなた',   persona: 'プレイヤーを「あなた」と呼ぶ' },
          { id: 'kimi',  label: 'きみ',     persona: 'プレイヤーを「きみ」と呼ぶ' },
          { id: 'omae',  label: 'おまえ',   persona: 'プレイヤーを「おまえ」と呼ぶ' },
          { id: 'san',   label: '名前＋さん', persona: 'プレイヤーを「（名前）さん」と呼ぶ' },
          { id: 'kun',   label: '名前＋くん', persona: 'プレイヤーを「（名前）くん」と呼ぶ' },
        ],
      },
    ],
  },
  {
    id: 'personality',
    label: '性格',
    fields: [
      { id: 'assertive', type: 'range', label: '積極性',   min: 0, max: 1, step: 0.05, default: 0.5, ticks: ['受け身', '積極的'] },
      { id: 'amae',      type: 'range', label: '甘えたがり', min: 0, max: 1, step: 0.05, default: 0.5, ticks: ['自立', '甘えたがり'] },
      { id: 'tsundere',  type: 'range', label: '素直さ',   min: 0, max: 1, step: 0.05, default: 0.5, ticks: ['ツン', 'デレ'] },
      { id: 'jealousy',  type: 'range', label: '独占欲',   min: 0, max: 1, step: 0.05, default: 0.3, ticks: ['淡白', '重い'] },
      { id: 'likes', type: 'text', label: '好きなもの', placeholder: '例: 珈琲、雨の日、古い映画', default: '' },
      { id: 'taboo', type: 'text', label: '嫌がること', placeholder: '例: 嘘、急かされること', default: '' },
    ],
  },
];

/** 全フィールドを平坦化した配列 */
export const FIELDS = SCHEMA.flatMap((g) => g.fields.map((f) => ({ ...f, group: g.id })));

/** id -> field */
export const FIELD_BY_ID = Object.fromEntries(FIELDS.map((f) => [f.id, f]));

/** スキーマの default だけを集めた初期値 */
export function defaultConfig() {
  const c = {};
  for (const f of FIELDS) c[f.id] = f.default;
  return c;
}

/** select の選択肢オブジェクトを引く */
export function optionOf(fieldId, value) {
  const f = FIELD_BY_ID[fieldId];
  if (!f || f.type !== 'select') return null;
  return f.options.find((o) => o.id === value) || f.options[0];
}
