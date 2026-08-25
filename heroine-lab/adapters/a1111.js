/**
 * AUTOMATIC1111 / Forge WebUI アダプタ (--api で起動したローカルサーバ)
 * 既定: http://127.0.0.1:7860
 */
export const image = {
  id: 'a1111',
  label: 'AUTOMATIC1111 / Forge (ローカル)',
  defaults: { endpoint: 'http://127.0.0.1:7860', steps: 28, cfg: 6, width: 768, height: 1024, sampler: 'DPM++ 2M Karras' },

  async generate({ prompt, settings = {} }) {
    const s = { ...this.defaults, ...settings };
    const res = await fetch(`${s.endpoint.replace(/\/$/, '')}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.positive,
        negative_prompt: prompt.negative,
        seed: prompt.seed,
        steps: s.steps,
        cfg_scale: s.cfg,
        width: s.width,
        height: s.height,
        sampler_name: s.sampler,
        override_settings: s.checkpoint ? { sd_model_checkpoint: s.checkpoint } : undefined,
      }),
    });
    if (!res.ok) throw new Error(`WebUI が ${res.status} を返しました`);
    const data = await res.json();
    if (!data.images?.length) throw new Error('画像が返りませんでした');
    return { url: `data:image/png;base64,${data.images[0]}`, meta: { engine: 'a1111', seed: prompt.seed } };
  },
};
