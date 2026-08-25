/**
 * セーフティ層
 *
 * この層はパイプラインの必須通過点。ここを通らない生成要求は
 * アダプタに到達しない設計にしてある（app.js 側で強制）。
 *
 * 目的は2つ:
 *   1. 未成年を想起させる生成の遮断（年齢層は成人のみ、negative へ常時注入、
 *      自由入力の語彙チェック）
 *   2. 実在人物の肖像の再現の遮断（自由入力に実名を書かせない）
 *
 * BLOCKLIST は最低限の骨格。実運用では配布先プラットフォームの禁止語彙と
 * 実在人物名リストを blocklist.local.json として供給し、loadExtraBlocklist()
 * で読み込んで拡張する。
 */

/** 常に negative prompt へ注入される。UI から外せない。 */
export const ALWAYS_NEGATIVE = [
  'child', 'children', 'kid', 'toddler', 'baby', 'infant',
  'loli', 'lolita', 'shota', 'minor', 'underage', 'teenager', 'teen',
  'elementary school', 'middle school', 'schoolgirl', 'school uniform',
  'young girl', 'petite child', 'flat chest child', 'childlike face',
  'real person', 'photorealistic celebrity', 'celebrity face',
];

/** 自由入力欄で拒否する語（部分一致、大小文字無視） */
const BLOCKLIST = [
  // 年齢
  'ロリ', 'ろり', 'loli', 'shota', 'ショタ', '幼女', '幼児', '児童', '園児',
  '小学生', '中学生', '小学校', '中学校', '高校生', '女子高生', 'jc', 'js', 'jk',
  '未成年', '未成年者', '子供', '子ども', 'こども', '赤ちゃん',
  'child', 'minor', 'underage', 'preteen', 'toddler', 'infant',
  // 非同意・実在人物の示唆
  '実在', '本人そっくり', 'ディープフェイク', 'deepfake', 'real person',
];

let extraBlocklist = [];

/**
 * 追加ブロックリストを読み込む（任意）。
 * 例: await loadExtraBlocklist('./blocklist.local.json')
 * ファイルが無い場合は黙って無視する（開発環境で落とさないため）。
 */
export async function loadExtraBlocklist(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return 0;
    const list = await res.json();
    if (Array.isArray(list)) {
      extraBlocklist = list.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.toLowerCase());
    }
    return extraBlocklist.length;
  } catch {
    return 0;
  }
}

function hits(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return [];
  return [...BLOCKLIST, ...extraBlocklist].filter((w) => t.includes(w));
}

/**
 * 生成前の検査。
 * @returns {{ok: boolean, violations: {field: string, words: string[]}[]}}
 */
export function validate(config, freeTextFields = ['name', 'likes', 'taboo', 'extraPrompt']) {
  const violations = [];
  for (const f of freeTextFields) {
    const words = hits(config[f]);
    if (words.length) violations.push({ field: f, words });
  }
  // 年齢層は成人の選択肢しか存在しないが、キャラカード読み込み等で
  // 不正な値が入る余地があるため明示的に検査する。
  const ADULT_AGE_BANDS = ['a20e', 'a20l', 'a30', 'a40'];
  if (!ADULT_AGE_BANDS.includes(config.ageBand)) {
    violations.push({ field: 'ageBand', words: [String(config.ageBand)] });
  }
  return { ok: violations.length === 0, violations };
}

export function describeViolations(violations) {
  const LABEL = { name: '名前', likes: '好きなもの', taboo: '嫌がること', extraPrompt: '追加プロンプト', ageBand: '年齢層' };
  return violations
    .map((v) => `${LABEL[v.field] || v.field}: 「${v.words.join('」「')}」は使用できません`)
    .join(' / ');
}

/* ---------- 年齢確認ゲート ---------- */

const GATE_KEY = 'heroine-lab.agegate.v1';

export function ageGatePassed() {
  try {
    return localStorage.getItem(GATE_KEY) === 'ok';
  } catch {
    return false;
  }
}

export function passAgeGate() {
  try {
    localStorage.setItem(GATE_KEY, 'ok');
  } catch { /* プライベートモード等。セッション内のみ有効になる */ }
}
