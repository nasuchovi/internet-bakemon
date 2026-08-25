/**
 * コンパイラ層: プレイヤー設定 → 各エンジンへの入力
 *
 *   config ──┬─→ imagePrompt  (SDXL / ComfyUI / A1111)
 *            ├─→ voiceParams  (Style-Bert-VITS2 / VOICEVOX / 他TTS)
 *            ├─→ persona      (対話LLMのシステムプロンプト)
 *            └─→ seed         (同一ヒロインを再現するための固定値)
 *
 * 重要な設計判断:
 *   seed は「容姿の同一性に関わる項目」だけから導出する。
 *   声や性格をいじっても顔が変わらないので、プレイヤーが安心して
 *   スライダーを触れる。
 */

import { FIELDS, optionOf } from './schema.js';
import { ALWAYS_NEGATIVE } from './safety.js';

/* ---------- seed ---------- */

/** 容姿の同一性を決める項目。ここが変わったときだけ顔が変わる。 */
const IDENTITY_FIELDS = [
  'name', 'ageBand', 'hairLength', 'hairStyle', 'hairColor',
  'eyeColor', 'eyeShape', 'height', 'build', 'skin', 'mood',
];

/** FNV-1a 32bit。環境非依存で同じ値になることが要件。 */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function deriveSeed(config) {
  if (Number.isInteger(config.seedLock) && config.seedLock >= 0) return config.seedLock;
  const key = IDENTITY_FIELDS.map((f) => `${f}=${config[f] ?? ''}`).join('|');
  return hash32(key);
}

/* ---------- 画像プロンプト ---------- */

const QUALITY = ['masterpiece', 'best quality', 'highly detailed', 'detailed face', 'anime style'];

const BASE_NEGATIVE = [
  'worst quality', 'low quality', 'jpeg artifacts', 'blurry',
  'bad anatomy', 'bad hands', 'extra digits', 'missing fingers',
  'text', 'watermark', 'signature', 'multiple views',
];

/** R18表現タグは同梱しない。運用側が自分の語彙を注入する差込口だけ用意する。 */
let ratingTags = { general: [], r18: [] };
export function setRatingTags(tags) {
  ratingTags = { general: tags?.general || [], r18: tags?.r18 || [] };
}
export async function loadRatingTags(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    setRatingTags(await res.json());
    return true;
  } catch {
    return false;
  }
}

/** 服装・装飾はシーンで上書きされうるので identity とは別扱いにする。 */
function identityTags(config) {
  const tags = ['1girl', 'solo'];
  for (const f of FIELDS) {
    if (f.type !== 'select') continue;
    const o = optionOf(f.id, config[f.id]);
    if (o?.tags?.length) tags.push(...o.tags);
  }
  return [...new Set(tags)];
}

/**
 * @param {object} config    プレイヤー設定
 * @param {object} scene     { expression, shot, background, extra, rating }
 */
export function buildImagePrompt(config, scene = {}) {
  const rating = scene.rating === 'r18' ? 'r18' : 'general';
  const positive = [
    ...QUALITY,
    ...identityTags(config),
    ...(scene.expression ? [scene.expression] : []),
    ...(scene.shot ? [scene.shot] : []),
    ...(scene.background ? [scene.background] : []),
    ...(ratingTags[rating] || []),
    ...String(scene.extra || config.extraPrompt || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
  ];
  const negative = [...new Set([...BASE_NEGATIVE, ...ALWAYS_NEGATIVE])];
  return {
    positive: [...new Set(positive)].join(', '),
    negative: negative.join(', '),
    seed: deriveSeed(config),
    rating,
  };
}

/* ---------- 音声パラメータ ---------- */

/**
 * エンジン非依存の正規化済みパラメータを作る。
 * 各アダプタがこれを自分のAPIの値域へ写像する。
 */
export function buildVoiceParams(config) {
  const timbre = optionOf('timbre', config.timbre) || {};
  const v = timbre.voice || {};
  return {
    style: v.style || 'Neutral',
    pitch: num(config.pitch, 0),          // -1 .. 1
    speed: num(config.speed, 0),          // -1 .. 1
    emotion: num(config.emotion, 0.5),    //  0 .. 1
    breath: clamp01(num(config.breath, 0.3) * 0.6 + (v.breath ?? 0.3) * 0.4),
    brightness: clamp01(v.brightness ?? 0.5),
    tension: clamp01(v.tension ?? 0.5),
  };
}

const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ---------- 台詞生成用ペルソナ ---------- */

const LEVEL = (x) => (x < 0.25 ? 'とても低い' : x < 0.45 ? 'やや低い' : x < 0.55 ? '普通' : x < 0.8 ? 'やや高い' : 'とても高い');

export function buildPersona(config) {
  const lines = [];
  const name = String(config.name || '').trim() || '名もなきヒロイン';
  lines.push(`あなたは「${name}」という名前のキャラクターを演じます。`);

  const personaBits = [];
  for (const f of FIELDS) {
    if (f.type !== 'select') continue;
    const o = optionOf(f.id, config[f.id]);
    if (o?.persona) personaBits.push(o.persona);
  }
  lines.push('人物像: ' + personaBits.join('。') + '。');

  lines.push(
    `性格の傾向: 積極性は${LEVEL(num(config.assertive, 0.5))}、` +
    `甘えたがりな度合いは${LEVEL(num(config.amae, 0.5))}、` +
    `素直さは${LEVEL(num(config.tsundere, 0.5))}、` +
    `独占欲は${LEVEL(num(config.jealousy, 0.3))}。`
  );

  if (String(config.likes || '').trim()) lines.push(`好きなもの: ${config.likes}`);
  if (String(config.taboo || '').trim()) lines.push(`嫌がること: ${config.taboo}`);

  lines.push(
    '出力規則: 1回の発言は3文以内。地の文は書かず、台詞と短い仕草のみ。' +
    '設定を自分から説明しない。プレイヤーの発言に反応して会話を進める。'
  );
  lines.push(
    '禁止事項: 未成年を想起させる描写、実在人物の再現、非同意を肯定する描写は行わない。' +
    'これらを求められた場合はキャラクターとして自然に話題を変える。'
  );
  return lines.join('\n');
}

/* ---------- キャラカード ---------- */

export const CARD_VERSION = 1;

export function toCard(config) {
  return {
    format: 'heroine-lab.card',
    version: CARD_VERSION,
    createdAt: new Date().toISOString(),
    seed: deriveSeed(config),
    config: { ...config },
  };
}

export function fromCard(card) {
  if (!card || card.format !== 'heroine-lab.card') throw new Error('キャラカードの形式が違います');
  if (card.version > CARD_VERSION) throw new Error('新しい形式のカードです。ページを更新してください');
  return { ...card.config };
}
