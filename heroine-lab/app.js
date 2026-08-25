/**
 * 配線層。
 *
 *   フォーム(SCHEMA由来) → config → [safety] → compile → adapter → 画面
 *
 * safety.validate() を通らない要求はアダプタへ渡さない。
 * 生成呼び出しは必ず guard() を経由すること。
 */

import { SCHEMA, FIELDS, defaultConfig } from './schema.js';
import * as safety from './safety.js';
import {
  buildImagePrompt, buildVoiceParams, buildPersona,
  deriveSeed, toCard, fromCard, loadRatingTags,
} from './compile.js';
import {
  IMAGE_ADAPTERS, VOICE_ADAPTERS, CHAT_ADAPTERS,
  getImage, getVoice, getChat, loadSettings, saveSettings,
} from './adapters/index.js';

const $ = (sel) => document.querySelector(sel);
const AUTOSAVE_KEY = 'heroine-lab.config.v1';

let config = restore();
let settings = loadSettings();
let history = [];

/* ---------------- 起動 ---------------- */

init();

async function init() {
  // 任意の外部定義。無くても動く。
  await Promise.all([
    safety.loadExtraBlocklist('./blocklist.local.json'),
    loadRatingTags('./ratings.local.json'),
  ]);

  renderForm();
  renderEngineSettings();
  bindGate();
  bindActions();
  bindTabs();
  refresh();

  if (safety.ageGatePassed()) showMain();
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    return saved ? { ...defaultConfig(), ...saved } : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

function persist() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(config)); } catch { /* 保存不可でも継続 */ }
}

/* ---------------- 年齢確認 ---------------- */

function bindGate() {
  $('#gate-yes').addEventListener('click', () => { safety.passAgeGate(); showMain(); });
  $('#gate-no').addEventListener('click', () => {
    document.body.innerHTML =
      '<div style="max-width:520px;margin:22vh auto;padding:24px;text-align:center;' +
      'font-family:monospace;color:#9d93aa">18歳未満の方はご利用いただけません。</div>';
  });
}

function showMain() {
  $('#gate').classList.remove('active');
  $('#main').classList.add('active');
}

/* ---------------- フォーム描画 ---------------- */

function renderForm() {
  const form = $('#form');
  form.innerHTML = SCHEMA.map((g) => `
    <fieldset class="group">
      <legend>${g.label}</legend>
      <div class="grid">${g.fields.map(fieldHtml).join('')}</div>
    </fieldset>
  `).join('');

  form.addEventListener('input', (e) => {
    const id = e.target.dataset?.field;
    if (!id) return;
    config[id] = e.target.type === 'range' ? Number(e.target.value) : e.target.value;
    const out = form.querySelector(`#val-${id}`);
    if (out) out.textContent = fmt(config[id]);
    persist();
    refresh();
  });
}

function fieldHtml(f) {
  const v = config[f.id];
  const note = f.note ? `<div class="note">${f.note}</div>` : '';
  if (f.type === 'select') {
    return `<div class="field">
      <label for="f-${f.id}">${f.label}</label>
      <select id="f-${f.id}" data-field="${f.id}">
        ${f.options.map((o) => `<option value="${o.id}"${o.id === v ? ' selected' : ''}>${o.label}</option>`).join('')}
      </select>${note}
    </div>`;
  }
  if (f.type === 'range') {
    return `<div class="field">
      <label for="f-${f.id}">${f.label}<span class="val" id="val-${f.id}">${fmt(v)}</span></label>
      <input type="range" id="f-${f.id}" data-field="${f.id}"
             min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
      <div class="ticks"><span>${f.ticks?.[0] ?? ''}</span><span>${f.ticks?.[1] ?? ''}</span></div>${note}
    </div>`;
  }
  return `<div class="field">
    <label for="f-${f.id}">${f.label}</label>
    <input type="text" id="f-${f.id}" data-field="${f.id}"
           value="${escapeAttr(v ?? '')}" placeholder="${escapeAttr(f.placeholder || '')}">${note}
  </div>`;
}

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));
const escapeAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------------- エンジン接続設定 ---------------- */

function renderEngineSettings() {
  const box = $('#engine-settings');
  box.innerHTML = `
    ${adapterSelect('imageAdapter', '画像生成', IMAGE_ADAPTERS)}
    ${endpointInput('image', '画像エンドポイント', 'http://127.0.0.1:7860')}
    ${adapterSelect('voiceAdapter', '音声合成', VOICE_ADAPTERS)}
    ${endpointInput('voice', '音声エンドポイント', 'http://127.0.0.1:5000')}
    ${adapterSelect('chatAdapter', '台詞生成', CHAT_ADAPTERS)}
    ${endpointInput('chat', 'LLMエンドポイント', 'http://127.0.0.1:11434/v1')}
    <div class="field">
      <label for="s-model">LLMモデル名</label>
      <input type="text" id="s-model" value="${escapeAttr(settings.chat.model || '')}" placeholder="qwen2.5:14b-instruct">
    </div>
    <div class="field">
      <label for="s-ckpt">画像モデル名 (ComfyUI/checkpoint)</label>
      <input type="text" id="s-ckpt" value="${escapeAttr(settings.image.ckpt || '')}" placeholder="model.safetensors">
    </div>`;

  box.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.adapter) settings[t.dataset.adapter] = t.value;
    if (t.dataset.endpoint) settings[t.dataset.endpoint].endpoint = t.value;
    if (t.id === 's-model') settings.chat.model = t.value;
    if (t.id === 's-ckpt') { settings.image.ckpt = t.value; settings.image.checkpoint = t.value; }
    saveSettings(settings);
  });
}

const adapterSelect = (key, label, list) => `
  <div class="field">
    <label for="s-${key}">${label}</label>
    <select id="s-${key}" data-adapter="${key}">
      ${list.map((a) => `<option value="${a.id}"${a.id === settings[key] ? ' selected' : ''}>${a.label}</option>`).join('')}
    </select>
  </div>`;

const endpointInput = (kind, label, ph) => `
  <div class="field">
    <label for="s-ep-${kind}">${label}</label>
    <input type="text" id="s-ep-${kind}" data-endpoint="${kind}"
           value="${escapeAttr(settings[kind].endpoint || '')}" placeholder="${ph}">
  </div>`;

/* ---------------- 出力プレビュー ---------------- */

function refresh() {
  const prompt = buildImagePrompt(config, { expression: 'looking at viewer' });
  $('#out-prompt').innerHTML =
    `＜positive＞\n${escapeHtml(prompt.positive)}\n\n<span class="neg">＜negative（安全側は常時固定）＞\n${escapeHtml(prompt.negative)}</span>\n\nseed = ${prompt.seed}`;
  $('#out-voice').textContent = JSON.stringify(buildVoiceParams(config), null, 2);
  $('#out-persona').textContent = buildPersona(config);
  $('#meta-seed').textContent = `seed: ${deriveSeed(config)}`;
}

function bindTabs() {
  const panes = { prompt: '#out-prompt', voice: '#out-voice', persona: '#out-persona', chat: '#out-chat' };
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      for (const [k, sel] of Object.entries(panes)) $(sel).hidden = k !== tab.dataset.tab;
    });
  });
}

/* ---------------- 生成アクション ---------------- */

/** すべての生成呼び出しの唯一の入口。ここで安全検査を強制する。 */
async function guard(label, btn, fn) {
  const check = safety.validate(config);
  if (!check.ok) {
    toast(safety.describeViolations(check.violations), 'err');
    return;
  }
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = `${label}中…`; }
  try {
    await fn();
  } catch (err) {
    toast(err.message || String(err), 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}

function bindActions() {
  $('#btn-image').addEventListener('click', (e) => guard('生成', e.currentTarget, async () => {
    const adapter = getImage(settings.imageAdapter);
    const prompt = buildImagePrompt(config, { expression: 'looking at viewer', shot: 'upper body' });
    const { url, meta } = await adapter.generate({ config, prompt, settings: settings.image });
    $('#portrait').innerHTML = `<img src="${url}" alt="生成された立ち絵">`;
    $('#meta-engine').textContent = `engine: ${meta.engine}`;
    $('#meta-seed').textContent = `seed: ${meta.seed}`;
    toast('生成しました', 'ok');
  }));

  $('#btn-voice').addEventListener('click', (e) => guard('合成', e.currentTarget, async () => {
    const adapter = getVoice(settings.voiceAdapter);
    await adapter.speak({
      text: $('#sample-line').value || 'こんにちは。',
      params: buildVoiceParams(config),
      settings: settings.voice,
    });
  }));

  $('#btn-chat').addEventListener('click', (e) => guard('生成', e.currentTarget, sendChat));
  $('#chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); guard('生成', $('#btn-chat'), sendChat); }
  });

  $('#btn-random').addEventListener('click', randomize);
  $('#btn-save').addEventListener('click', saveCard);
  $('#btn-load').addEventListener('click', () => $('#file-load').click());
  $('#file-load').addEventListener('change', loadCard);
}

async function sendChat() {
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message) return;
  appendLog('you', message);
  input.value = '';

  const adapter = getChat(settings.chatAdapter);
  const { text } = await adapter.reply({
    config,
    persona: buildPersona(config),
    history,
    message,
    settings: settings.chat,
  });
  history.push({ role: 'user', content: message }, { role: 'assistant', content: text });
  appendLog('her', text);

  // 同じ設定の声でそのまま読み上げる（配線の確認を兼ねる）
  try {
    await getVoice(settings.voiceAdapter).speak({ text, params: buildVoiceParams(config), settings: settings.voice });
  } catch { /* 音声が無くても会話は続く */ }
}

function appendLog(who, text) {
  const log = $('#chat-log');
  const name = who === 'you' ? 'あなた' : (config.name || 'ヒロイン');
  log.insertAdjacentHTML('beforeend', `<p class="${who}"><b>${escapeHtml(name)}：</b>${escapeHtml(text)}</p>`);
  log.scrollTop = log.scrollHeight;
}

/* ---------------- カード / ランダム ---------------- */

function randomize() {
  for (const f of FIELDS) {
    if (f.type === 'select') config[f.id] = f.options[Math.floor(Math.random() * f.options.length)].id;
    else if (f.type === 'range') {
      const steps = Math.round((f.max - f.min) / f.step);
      config[f.id] = Number((f.min + Math.floor(Math.random() * (steps + 1)) * f.step).toFixed(2));
    }
  }
  renderForm();
  persist();
  refresh();
  toast('ランダム生成しました', 'ok');
}

function saveCard() {
  const card = toCard(config);
  const name = (config.name || 'heroine').replace(/[^\w぀-ヿ一-龯-]/g, '_');
  const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.heroine.json`;
  // 切り離したままの <a> では download 属性が無視されるブラウザがあるため一度挿す
  document.body.appendChild(a);
  a.click();
  // 即座に revoke するとダウンロード開始前にURLが消え、ファイル名まで失われる
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('キャラカードを保存しました', 'ok');
}

async function loadCard(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const loaded = fromCard(JSON.parse(await file.text()));
    const merged = { ...defaultConfig(), ...loaded };
    // 外部ファイル由来なので、取り込む前に必ず検査する。
    const check = safety.validate(merged);
    if (!check.ok) {
      toast('読み込めません — ' + safety.describeViolations(check.violations), 'err');
      return;
    }
    config = merged;
    renderForm();
    persist();
    refresh();
    toast('キャラカードを読み込みました', 'ok');
  } catch (err) {
    toast(err.message || 'カードの読み込みに失敗しました', 'err');
  } finally {
    e.target.value = '';
  }
}

/* ---------------- 通知 ---------------- */

let toastTimer;
function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}
