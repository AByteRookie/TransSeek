/**
 * 输出格式化模块：统一结果渲染（Markdown 对照 + 头部信息）。
 */

/**
 * 渲染翻译结果。
 * @param {object} opts
 * @param {string} opts.text 原文
 * @param {'word'|'sentence'} opts.mode
 * @param {string} opts.content 模型返回内容
 * @param {object} [opts.meta] 附加信息（模型、耗时等）
 * @returns {string}
 */
export function renderResult({ text, mode, content, meta = {} }) {
  const lines = [];
  const modeLabel = mode === 'word' ? '词典' : '翻译';
  lines.push(`## ${modeLabel}结果`);
  lines.push('');
  lines.push(content.trim());
  if (meta.model) {
    lines.push('');
    lines.push(`> 模型：\`${meta.model}\`${meta.ms ? ` · 耗时 ${meta.ms}ms` : ''}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * 无样式纯文本输出（供管道/脚本消费，仅保留模型原文）。
 * @param {string} content
 * @returns {string}
 */
export function renderPlain(content) {
  return content.trim() + '\n';
}
