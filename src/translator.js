/**
 * 翻译编排模块：模式解析 → 提示词构建 → 调用 API（或 Mock）→ 返回结果。
 */
import { detectMode, detectLanguage } from './detect.js';
import { buildMessages } from './prompts.js';
import { chatCompletion } from './deepseek.js';
import { mockTranslate } from './mock.js';
import { resolveApiKey } from './config.js';

/** 语言名是否指向中文（用于方向判断）。 */
function isZhLang(name) {
  return /中文|汉语|Chinese/i.test(String(name ?? ''));
}
/** 语言名是否指向英文。 */
function isEnLang(name) {
  return /英语|英文|English/i.test(String(name ?? ''));
}

/**
 * 中英互译：根据输入语言自动决定翻译方向。
 * 例：配置为「英语 → 简体中文」时，输入中文会自动「简体中文 → 英语」。
 */
function resolveDirection(text, cfg) {
  const lang = detectLanguage(text);
  let sourceLang = cfg.sourceLang;
  let targetLang = cfg.targetLang;
  if ((lang === 'zh' && isZhLang(targetLang)) || (lang === 'en' && isEnLang(targetLang))) {
    sourceLang = cfg.targetLang;
    targetLang = cfg.sourceLang;
  }
  return { sourceLang, targetLang };
}

/**
 * 执行一次翻译。
 * @param {object} opts
 * @param {string} opts.text 待翻译文本
 * @param {'auto'|'word'|'sentence'} [opts.mode='auto']
 * @param {object} opts.config 已合并配置
 * @param {boolean} [opts.stream=false]
 * @param {(chunk:string)=>void} [opts.onToken]
 * @param {boolean} [opts.mock=false] 强制使用 Mock（离线演示）
 * @returns {Promise<{mode:string, content:string, mock:boolean, model?:string, ms?:number, sourceLang?:string, targetLang?:string}>}
 */
export async function translate({
  text,
  mode = 'auto',
  config,
  stream = false,
  onToken,
  mock = false
}) {
  const resolved = mode === 'auto' ? detectMode(text) : mode;
  const useMock = mock || process.env.DS_MOCK === '1';
  const { sourceLang, targetLang } = resolveDirection(text, config);

  if (useMock) {
    const content = mockTranslate(text, resolved);
    // 模拟流式：一次性回调完整内容
    if (stream) onToken?.(content);
    return { mode: resolved, content, mock: true, sourceLang, targetLang };
  }

  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new Error(
      '未配置 API Key。请执行 `ds config set apiKey sk-xxx` 或设置环境变量 DEEPSEEK_API_KEY；' +
      '也可用 `ds --mock "text"` 离线体验。'
    );
  }

  const messages = buildMessages(text, resolved, { ...config, sourceLang, targetLang });
  const started = Date.now();
  const { content } = await chatCompletion({
    apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    messages,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    stream,
    onToken
  });

  return {
    mode: resolved,
    content,
    mock: false,
    model: config.model,
    ms: Date.now() - started,
    sourceLang,
    targetLang
  };
}
