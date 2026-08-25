/**
 * ComfyUI アダプタ (既定: http://127.0.0.1:8188)
 *
 * ワークフローは API 形式の JSON をテンプレートとして受け取り、
 * 文字列 "%positive%" "%negative%" "%seed%" "%ckpt%" を置換して投げる。
 * 独自ワークフロー（LoRA・IPAdapter・ControlNet 込み）を使いたい場合は
 * ComfyUI で「Save (API Format)」した JSON を settings.workflow に渡す。
 */

const DEFAULT_WORKFLOW = {
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '%ckpt%' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 1024, batch_size: 1 } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: '%positive%', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: '%negative%', clip: ['4', 1] } },
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: '%seed%', steps: 28, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'heroine', images: ['8', 0] } },
};

function fill(node, prompt, ckpt) {
  return JSON.parse(
    JSON.stringify(node)
      .replaceAll('"%positive%"', JSON.stringify(prompt.positive))
      .replaceAll('"%negative%"', JSON.stringify(prompt.negative))
      .replaceAll('"%seed%"', String(prompt.seed))
      .replaceAll('"%ckpt%"', JSON.stringify(ckpt))
  );
}

export const image = {
  id: 'comfyui',
  label: 'ComfyUI (ローカル)',
  defaults: { endpoint: 'http://127.0.0.1:8188', ckpt: 'model.safetensors', timeoutMs: 180000 },

  async generate({ prompt, settings = {} }) {
    const s = { ...this.defaults, ...settings };
    const base = s.endpoint.replace(/\/$/, '');
    const workflow = fill(s.workflow || DEFAULT_WORKFLOW, prompt, s.ckpt);
    const clientId = `heroine-lab-${prompt.seed}`;

    const queued = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!queued.ok) throw new Error(`ComfyUI が ${queued.status} を返しました`);
    const { prompt_id: id } = await queued.json();

    // /history をポーリングして完成を待つ（WebSocket でも良いが依存を減らす）
    const deadline = Date.now() + s.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 900));
      const h = await fetch(`${base}/history/${id}`);
      if (!h.ok) continue;
      const hist = await h.json();
      const entry = hist[id];
      if (!entry) continue;
      const images = Object.values(entry.outputs || {}).flatMap((o) => o.images || []);
      if (images.length) {
        const i = images[0];
        const q = new URLSearchParams({ filename: i.filename, subfolder: i.subfolder || '', type: i.type || 'output' });
        return { url: `${base}/view?${q}`, meta: { engine: 'comfyui', seed: prompt.seed, promptId: id } };
      }
    }
    throw new Error('ComfyUI の生成がタイムアウトしました');
  },
};
