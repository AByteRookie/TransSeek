/**
 * dsh-term-lookup 宿主半侧（host half）
 * 职责：注册 /term/translate 路由，接收术语文本，调用 DSH 自己的 LLM 生成简短释义。
 */
import { BlockAssembler, createUserMessage, deepFreeze } from '@deepseek-ai/dsh-llm';

const name = 'term-lookup';
const inject = ['webServer', 'llm'];

/** 术语速查的系统提示词：约束输出为「全称/英文 + 一句中文释义」 */
const SYSTEM_PROMPT = [
  '你是术语速查助手。用户会给出一个专业术语、英文缩写或单词。',
  '请用简体中文简洁解释：',
  '1. 英文缩写（如 LLM、RAG）：先给出英文全称，再给一句中文释义。',
  '2. 单词/术语：直接给一句中文释义，可注明所属领域。',
  '3. 中文输入：给出对应的英文表达，再给一句中文解释。',
  '4. 输出格式：第一行英文/全称（如有），第二行中文释义；总长度控制在 100 字以内。',
  '只输出释义本身，不要任何额外解释、标题、列表符号或 Markdown 格式。'
].join('\n');

/** 调用 DSH 的 LLM，把术语翻译成简短释义。 */
async function translateTerm(ctx, provider, model, text) {
  const messages = [createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'dsh-term-lookup' }
  })];
  const options = deepFreeze({
    provider,
    model,
    messages,
    system: SYSTEM_PROMPT,
    maxTokens: 500
  });

  const assembler = new BlockAssembler();
  for await (const chunk of ctx.llm.stream(options)) {
    assembler.push(chunk);
  }

  // 先取文本：即使 finish 是 max-tokens（输出被截断），已有部分文本也照用
  const blocks = assembler.blocks();
  const out = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (out) return out;
  if (assembler.finish?.kind !== 'stop') {
    const detail = assembler.finish?.failure?.message || assembler.finish?.kind || 'unknown';
    throw new Error(`翻译失败：${detail}`);
  }
  throw new Error('翻译结果为空');
}

function apply(ctx, config) {
  const provider = config?.provider || 'deepseek-official';
  const model = config?.model || 'deepseek-chat';

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/term',
    handler: async (req, res) => {
      const json = (status, obj) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(obj));
      };

      const url = new URL(req.url ?? '/', 'http://localhost');
      const rest = decodeURIComponent(url.pathname.slice('/term'.length + 1));
      if (rest !== 'translate') {
        json(404, { error: 'not found' });
        return;
      }

      const text = (url.searchParams.get('text') || '').trim();
      if (!text) {
        json(400, { error: 'missing text' });
        return;
      }

      try {
        const meaning = await translateTerm(ctx, provider, model, text);
        json(200, { term: text, meaning });
      } catch (err) {
        json(500, { error: err?.message || String(err) });
      }
    }
  }), 'dsh-term-lookup: /term route');
}

export { apply, inject, name };
