/**
 * VOICEVOX ENGINE アダプタ (既定: http://127.0.0.1:50021)
 *
 * 注意: VOICEVOX は「エンジン」と「音声ライブラリ(キャラクター)」で
 * 利用規約が別。多くのキャラクターは成人向け用途を禁止している。
 * R18 作品で使う場合は必ず各キャラクターの規約を確認すること。
 * このアダプタは検証用として同梱している。
 */
import { playAudio } from './sbv2.js';

export const voice = {
  id: 'voicevox',
  label: 'VOICEVOX ENGINE (ローカル・規約要確認)',
  defaults: { endpoint: 'http://127.0.0.1:50021', speaker: 1 },

  async speak({ text, params, settings = {} }) {
    const s = { ...this.defaults, ...settings };
    const base = s.endpoint.replace(/\/$/, '');
    const qres = await fetch(`${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${s.speaker}`, { method: 'POST' });
    if (!qres.ok) throw new Error(`VOICEVOX が ${qres.status} を返しました`);
    const query = await qres.json();

    query.pitchScale = round2(params.pitch * 0.15);              // -0.15 .. 0.15
    query.speedScale = round2(1 + params.speed * 0.4);           //  0.6 .. 1.4
    query.intonationScale = round2(0.4 + params.emotion * 1.2);  //  0.4 .. 1.6
    query.volumeScale = 1;
    query.prePhonemeLength = round2(0.1 + params.breath * 0.2);
    query.postPhonemeLength = round2(0.1 + params.breath * 0.2);

    const sres = await fetch(`${base}/synthesis?speaker=${s.speaker}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!sres.ok) throw new Error(`VOICEVOX 合成が ${sres.status} を返しました`);
    const url = URL.createObjectURL(await sres.blob());
    await playAudio(url);
    return { played: true, engine: 'voicevox', url, mapped: query };
  },
};

const round2 = (x) => Math.round(x * 100) / 100;
