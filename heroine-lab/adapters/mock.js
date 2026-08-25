/**
 * モックアダプタ: バックエンドが無くても動くデモ用。
 * 画像は設定値から決定的に組み立てた SVG、音声はブラウザ内蔵の
 * SpeechSynthesis、台詞はテンプレートで生成する。
 * 「配線が正しいか」をローカル環境ゼロで確認するためのもの。
 */

import { optionOf } from '../schema.js';

const pick = (fieldId, value, key, fallback) => optionOf(fieldId, value)?.[key] ?? fallback;

export const image = {
  id: 'mock',
  label: 'モック（SVG／バックエンド不要）',
  async generate({ config, prompt }) {
    const hair = pick('hairColor', config.hairColor, 'hex', '#221c26');
    const eye = pick('eyeColor', config.eyeColor, 'hex', '#7a4a2b');
    const skin = pick('skin', config.skin, 'hex', '#f3ddd0');
    const long = ['long', 'verylong'].includes(config.hairLength);
    const hairLen = { short: 96, bob: 118, semilong: 150, long: 200, verylong: 250 }[config.hairLength] || 150;
    const width = { slim: 52, normal: 60, glamour: 70, fit: 62, plump: 78 }[config.build] || 60;
    const seed = prompt.seed;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400" width="320" height="400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b1522"/><stop offset="100%" stop-color="#0a080e"/>
    </linearGradient>
  </defs>
  <rect width="320" height="400" fill="url(#bg)"/>
  <g transform="translate(160 0)">
    <path d="M0 400 L${-width} 400 Q${-width} 300 0 292 Q${width} 300 ${width} 400 Z" fill="${skin}" opacity=".9"/>
    <path d="M${-hairLen / 3.2} 120 Q${-hairLen / 2.6} ${120 + hairLen} 0 ${120 + hairLen} Q${hairLen / 2.6} ${120 + hairLen} ${hairLen / 3.2} 120 Z" fill="${hair}" opacity=".95"/>
    <ellipse cx="0" cy="150" rx="60" ry="72" fill="${skin}"/>
    <path d="M-62 140 Q0 60 62 140 Q40 92 0 88 Q-40 92 -62 140 Z" fill="${hair}"/>
    ${long ? `<path d="M-62 140 Q-84 ${150 + hairLen} -46 ${170 + hairLen}" stroke="${hair}" stroke-width="26" fill="none" stroke-linecap="round"/>
    <path d="M62 140 Q84 ${150 + hairLen} 46 ${170 + hairLen}" stroke="${hair}" stroke-width="26" fill="none" stroke-linecap="round"/>` : ''}
    <ellipse cx="-24" cy="158" rx="11" ry="${config.eyeShape === 'half' ? 5 : 13}" fill="${eye}"/>
    <ellipse cx="24" cy="158" rx="11" ry="${config.eyeShape === 'half' ? 5 : 13}" fill="${config.eyeColor === 'odd' ? '#d8a63c' : eye}"/>
    <path d="M-10 190 Q0 197 10 190" stroke="#8a4b53" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
  <text x="12" y="386" fill="#5c5468" font-family="monospace" font-size="11">MOCK seed=${seed}</text>
</svg>`;
    return {
      url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      meta: { engine: 'mock', seed },
    };
  },
};

export const voice = {
  id: 'mock',
  label: 'モック（ブラウザ読み上げ／バックエンド不要）',
  async speak({ text, params }) {
    if (!('speechSynthesis' in window)) throw new Error('このブラウザは読み上げに対応していません');
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.pitch = Math.min(2, Math.max(0, 1 + params.pitch));         // -1..1 -> 0..2
    u.rate = Math.min(2, Math.max(0.5, 1 + params.speed * 0.5));  // -1..1 -> 0.5..1.5
    const ja = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('ja'));
    if (ja) u.voice = ja;
    window.speechSynthesis.speak(u);
    return { played: true, engine: 'mock' };
  },
};

export const chat = {
  id: 'mock',
  label: 'モック（テンプレート／バックエンド不要）',
  async reply({ config, message }) {
    const call = { anata: 'あなた', kimi: 'きみ', omae: 'おまえ', san: 'あなた', kun: 'あなた' }[config.callPlayer] || 'あなた';
    const me = { watashi: 'わたし', atashi: 'あたし', watakushi: 'わたくし', boku: 'ぼく', jibun: '自分', name: (config.name || 'わたし') }[config.firstPerson] || 'わたし';
    const end = { polite: 'ですね。', casual: 'だね。', onee: 'かしら。', blunt: '。', kansai: 'やんな。' }[config.tone] || 'ですね。';
    return {
      text: `${call}がそう言うなら、${me}はそう思うことにします${end}（モック応答。実際の台詞は対話モデルが生成します）`,
      engine: 'mock',
    };
  },
};
