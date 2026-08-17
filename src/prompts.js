/**
 * 结构化提示词模块
 * - 单词模式：输出词典条目（音标/词性/释义/例句）
 * - 句子模式：仅输出译文（逐句一行，无「原文/译文」标签）
 * 通过 {sourceLang} {targetLang} {text} 占位符锁定语境，避免模型误判。
 */

export const DEFAULT_PROMPTS = {
  word: `你是一名专业词典编纂者，精通【{sourceLang}】与【{targetLang}】。
请将下面的【{sourceLang}】单词翻译为【{targetLang}】，输出规范的词典条目。

【单词】
{text}

【输出要求】
1. 严格使用 Markdown 格式，结构如下：
   - **单词**：原文
   - **音标**：英式 /x/ 与美式 /x/（若难以确定，可只给一种，并注明）
   - **词性**：n. / v. / adj. / adv. / prep. / conj. 等（可多个，逐个列出）
   - **释义**：每个词性下用带序号的列表列出常见中文义项，按常用度排序
   - **例句**：为每个核心词性给出 1-2 个英文例句，并附简体中文翻译
2. 术语保持专业一致，释义准确、分义项、避免歧义。
3. 只输出词典条目本身，不要任何额外解释或开场白。`,

  wordZh: `你是一名专业词典编纂者，精通【{sourceLang}】与【{targetLang}】。
请将下面的【{sourceLang}】单词/词语翻译为【{targetLang}】，输出规范的词典条目。

【单词】
{text}

【输出要求】
1. 严格使用 Markdown 格式，结构如下：
   - **单词**：原文
   - **拼音**：该词的标准拼音（带声调）
   - **词性**：n. / v. / adj. / adv. 等（可多个，逐个列出）
   - **释义**：每个词性下用带序号的列表列出常见的{targetLang}义项，按常用度排序
   - **例句**：为每个核心词性给出 1-2 个{targetLang}例句，并附{sourceLang}翻译
2. 术语保持专业一致，释义准确、分义项、避免歧义。
3. 只输出词典条目本身，不要任何额外解释或开场白。`,

  sentence: `你是一名专业翻译，精通【{sourceLang}】与【{targetLang}】。
请将下面的【{sourceLang}】句子/段落翻译为【{targetLang}】。

【句子】
{text}

【输出要求】
1. 保持专业术语一致性，术语按行业通行标准翻译。
2. 译文流畅自然，符合【{targetLang}】表达习惯，不逐字硬译。
3. 将原文按句子/意群切分，逐句翻译，每句译文独占一行，保持与原文句子顺序一致。
4. 只输出译文本身：不要输出原文，不要加「原文：」「译文：」等任何标签或前缀，不要使用 Markdown 加粗或列表符号。
5. 最后必须单独一行，以「要点：」开头，简要说明关键术语或翻译难点（1-3 条）；即使句子简单，也至少要写一条。
6. 只输出上述内容，不要任何额外解释或开场白。`
};

/** 系统提示词：全局约束，与具体模式解耦 */
export const SYSTEM_PROMPT = '你是一名严谨、专业的翻译助手。严格遵守用户给出的输出格式，只输出结果，不添加额外解释。';

/**
 * 用 vars 替换模板中的 {key} 占位符。
 * @param {string} template
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function renderPrompt(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.split(`{${key}}`).join(String(value ?? '')),
    template
  );
}

/** 语言名是否指向中文（用于选择中文源词典模板）。 */
function isChineseLang(name) {
  return /中文|汉语|Chinese/i.test(String(name ?? ''));
}

/**
 * 根据模式和配置构建 messages。
 * @param {string} text 待翻译文本
 * @param {'word'|'sentence'} mode
 * @param {object} cfg 已合并的配置对象
 * @returns {Array<{role:string, content:string}>}
 */
export function buildMessages(text, mode, cfg) {
  // 单词模式：中文源用 wordZh 模板（拼音/词性/目标语言释义/例句），否则用通用词典模板
  let promptTemplate;
  if (mode === 'word' && isChineseLang(cfg?.sourceLang)) {
    promptTemplate = cfg?.prompts?.wordZh ?? DEFAULT_PROMPTS.wordZh;
  } else {
    promptTemplate = cfg?.prompts?.[mode] ?? DEFAULT_PROMPTS[mode];
  }
  const vars = {
    sourceLang: cfg.sourceLang,
    targetLang: cfg.targetLang,
    text
  };
  const userPrompt = renderPrompt(promptTemplate, vars);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];
}
