/**
 * 模式检测：区分「单词模式」与「句子模式」。
 * 规则：
 *  - 含空白字符（多词）→ 句子
 *  - 含句子标点 → 句子
 *  - 含中文：长度 > 2 → 句子，否则 → 单词
 *  - 单个英文/拉丁词（含连字符、撇号）→ 单词
 */

const CJK_RE = /[\u4e00-\u9fff]/;
const SENTENCE_PUNCT_RE = /[.!?;:。！？；：，,\n]/;

/**
 * @param {string} text
 * @returns {'word'|'sentence'}
 */
export function detectMode(text) {
  const t = (text ?? '').trim();
  if (!t) {
    throw new Error('输入文本为空，无法翻译');
  }
  if (/\s/.test(t)) return 'sentence';            // 含空格 → 多词/句子
  if (SENTENCE_PUNCT_RE.test(t)) return 'sentence'; // 句子标点
  if (CJK_RE.test(t)) {
    return t.length > 2 ? 'sentence' : 'word';    // 中文 >2 字按句子/短语处理
  }
  return 'word';                                   // 单个英文单词
}

/**
 * 规范化用户传入的模式参数。
 * @param {string|undefined} mode
 * @returns {'auto'|'word'|'sentence'}
 */
export function normalizeMode(mode) {
  if (!mode) return 'auto';
  const m = String(mode).toLowerCase();
  if (['auto', 'word', 'sentence'].includes(m)) return m;
  if (['w', '单词'].includes(m)) return 'word';
  if (['s', '句子'].includes(m)) return 'sentence';
  throw new Error(`未知模式: ${mode}（可选 auto / word / sentence）`);
}

/**
 * 检测文本主要语言（用于中英互译方向判断）。
 * @param {string} text
 * @returns {'zh'|'en'|null} null 表示无法判断（如纯数字/符号/混合）
 */
export function detectLanguage(text) {
  const t = text ?? '';
  const zh = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  if (zh > latin) return 'zh';
  if (latin > zh) return 'en';
  return null;
}
