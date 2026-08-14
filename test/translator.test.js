import { test } from 'node:test';
import assert from 'node:assert';
import { translate } from '../src/translator.js';
import { loadConfig } from '../src/config.js';

test('translate：mock 单词模式（auto 识别）', async () => {
  const r = await translate({ text: 'apple', mode: 'auto', config: loadConfig(), mock: true });
  assert.equal(r.mode, 'word');
  assert.equal(r.mock, true);
  assert.match(r.content, /apple/);
});

test('translate：mock 句子模式（auto 识别）', async () => {
  const r = await translate({ text: 'Hello world', mode: 'auto', config: loadConfig(), mock: true });
  assert.equal(r.mode, 'sentence');
  assert.match(r.content, /Hello world/);
});

test('translate：mock 流式一次性回调', async () => {
  const chunks = [];
  const r = await translate({
    text: 'hello', mode: 'auto', config: loadConfig(),
    mock: true, stream: true, onToken: (c) => chunks.push(c)
  });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], r.content);
});

test('translate：无 API Key 且非 mock 时抛错', async () => {
  const cfg = loadConfig();
  cfg.apiKey = '';
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DS_MOCK;
  await assert.rejects(
    () => translate({ text: 'hello', config: cfg }),
    /未配置 API Key/
  );
});
