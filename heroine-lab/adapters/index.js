/**
 * アダプタ登録所。
 * UI とエンジンの間はここだけで繋がっているので、
 * 新しい生成エンジンを足すときはモジュールを1つ書いて登録するだけでよい。
 */
import * as mock from './mock.js';
import * as a1111 from './a1111.js';
import * as comfyui from './comfyui.js';
import * as sbv2 from './sbv2.js';
import * as voicevox from './voicevox.js';
import * as llm from './llm.js';

export const IMAGE_ADAPTERS = [mock.image, a1111.image, comfyui.image];
export const VOICE_ADAPTERS = [mock.voice, sbv2.voice, voicevox.voice];
export const CHAT_ADAPTERS = [mock.chat, llm.chat];

const byId = (list, id) => list.find((a) => a.id === id) || list[0];
export const getImage = (id) => byId(IMAGE_ADAPTERS, id);
export const getVoice = (id) => byId(VOICE_ADAPTERS, id);
export const getChat = (id) => byId(CHAT_ADAPTERS, id);

/* ---------- 接続設定の保存 ---------- */

const KEY = 'heroine-lab.settings.v1';

export const DEFAULT_SETTINGS = {
  imageAdapter: 'mock',
  voiceAdapter: 'mock',
  chatAdapter: 'mock',
  image: {},
  voice: {},
  chat: {},
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* 保存できなくても動作は続ける */ }
}
