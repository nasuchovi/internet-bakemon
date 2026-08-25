/**
 * OpenAI 互換 API アダプタ（Ollama / llama.cpp / LM Studio / vLLM など）
 * 既定: http://127.0.0.1:11434/v1 (Ollama)
 *
 * 商用クラウドAPIは成人向け出力を規約で禁じていることが多い。
 * ローカル推論を既定にしてあるのはそのため。
 */
export const chat = {
  id: 'openai-compat',
  label: 'ローカルLLM (OpenAI互換API)',
  defaults: { endpoint: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:14b-instruct', apiKey: '', maxTokens: 200, temperature: 0.9 },

  async reply({ persona, history = [], message, settings = {} }) {
    const s = { ...this.defaults, ...settings };
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;

    const res = await fetch(`${s.endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: s.model,
        temperature: s.temperature,
        max_tokens: s.maxTokens,
        messages: [
          { role: 'system', content: persona },
          ...history.slice(-12),
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM が ${res.status} を返しました`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('応答が空でした');
    return { text, engine: 'openai-compat' };
  },
};
