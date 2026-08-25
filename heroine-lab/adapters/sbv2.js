/**
 * Style-Bert-VITS2 アダプタ (既定: http://127.0.0.1:5000)
 *
 * 正規化パラメータ(-1..1 / 0..1) を SBV2 の値域へ写像する:
 *   pitch   -1..1 -> pitch_scale   0.7 .. 1.3
 *   speed   -1..1 -> length        1.4 .. 0.7  (length は「長さ」なので反転)
 *   emotion  0..1 -> style_weight  0.5 .. 8.0
 *   breath   0..1 -> sdp_ratio     0.1 .. 0.6  (揺らぎ=息づかいの近似)
 */
export const voice = {
  id: 'sbv2',
  label: 'Style-Bert-VITS2 (ローカル)',
  defaults: { endpoint: 'http://127.0.0.1:5000', model_id: 0, speaker_id: 0 },

  map(p) {
    return {
      pitch_scale: round2(1 + p.pitch * 0.3),
      length: round2(1.05 - p.speed * 0.35),
      style_weight: round2(0.5 + p.emotion * 7.5),
      sdp_ratio: round2(0.1 + p.breath * 0.5),
      style: p.style || 'Neutral',
    };
  },

  async speak({ text, params, settings = {} }) {
    const s = { ...this.defaults, ...settings };
    const m = this.map(params);
    const q = new URLSearchParams({
      text,
      model_id: String(s.model_id),
      speaker_id: String(s.speaker_id),
      language: 'JP',
      sdp_ratio: String(m.sdp_ratio),
      length: String(m.length),
      style: m.style,
      style_weight: String(m.style_weight),
      pitch_scale: String(m.pitch_scale),
    });
    const res = await fetch(`${s.endpoint.replace(/\/$/, '')}/voice?${q}`);
    if (!res.ok) throw new Error(`Style-Bert-VITS2 が ${res.status} を返しました`);
    const url = URL.createObjectURL(await res.blob());
    await playAudio(url);
    return { played: true, engine: 'sbv2', url, mapped: m };
  },
};

const round2 = (x) => Math.round(x * 100) / 100;

export function playAudio(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('音声の再生に失敗しました'));
    a.play().catch(reject);
  });
}
