/**
 * Mock 翻译器：无 API Key 时离线联调/测试使用。
 * 返回结构化的 Markdown 结果，格式与真实模型一致。
 */

/**
 * @param {string} text
 * @param {'word'|'sentence'} mode
 * @returns {string} 模拟的 Markdown 翻译结果
 */
export function mockTranslate(text, mode) {
  if (mode === 'word') {
    return `- **单词**：${text}
- **音标**：英式 /mɒk/ · 美式 /mɑːk/（示例音标）
- **词性**：n.
- **释义**：
  1. 模拟数据（Mock，用于离线演示）
  2. 请在配置中填入真实 API Key 后重试
- **例句**：
  - This is a mock result for offline preview. —— 这是一条离线预览的模拟结果。`;
  }
  return `（模拟译文）这是对“${text}”的翻译（离线预览）。
要点：当前为 Mock 模式，填入真实 API Key 后可获得真实翻译。`;
}
