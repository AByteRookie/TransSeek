/**
 * DeepSeek API 封装模块
 * 使用 Node 18+ 原生 fetch，支持流式（SSE）与非流式输出。
 * 文档：https://api-docs.deepseek.com/
 */

export class DeepSeekError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'DeepSeekError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 调用 DeepSeek chat/completions。
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.baseUrl
 * @param {string} opts.model
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs]
 * @param {boolean} [opts.stream] 是否流式返回
 * @param {(chunk:string)=>void} [opts.onToken] 流式时的增量回调
 * @returns {Promise<{content:string, usage?:object}>}
 */
export async function chatCompletion(opts) {
  const {
    apiKey,
    baseUrl,
    model,
    messages,
    temperature = 0.3,
    maxTokens = 2048,
    timeoutMs = 60000,
    stream = false,
    onToken
  } = opts;

  if (!apiKey) {
    throw new DeepSeekError('未配置 API Key。请执行 `ds config set apiKey sk-xxx` 或设置环境变量 DEEPSEEK_API_KEY');
  }

  const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new DeepSeekError(
        `DeepSeek API 请求失败（HTTP ${res.status}）：${detail}`,
        { status: res.status, code: res.status }
      );
    }

    if (stream) {
      return { content: await readStream(res, onToken) };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { content, usage: data?.usage };
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    if (err?.name === 'AbortError') {
      throw new DeepSeekError(`请求超时（>${timeoutMs}ms）`, { code: 'TIMEOUT' });
    }
    throw new DeepSeekError(`网络错误：${err?.message ?? err}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 读取 SSE 流，累积增量内容，并逐块回调。
 * @param {Response} res
 * @param {(chunk:string)=>void} [onToken]
 * @returns {Promise<string>}
 */
async function readStream(res, onToken) {
  const reader = res.body?.getReader();
  if (!reader) throw new DeepSeekError('响应流不可用');

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行分隔
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }
  return full;
}
