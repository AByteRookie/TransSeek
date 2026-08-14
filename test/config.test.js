import { test } from 'node:test';
import assert from 'node:assert';
import { loadConfig, maskApiKey, DEFAULT_CONFIG } from '../src/config.js';

test('loadConfig：返回完整结构', () => {
  const cfg = loadConfig();
  assert.equal(typeof cfg.model, 'string');
  assert.ok(cfg.model.length > 0);
  assert.equal(typeof cfg.prompts.word, 'string');
  assert.equal(typeof cfg.prompts.sentence, 'string');
  assert.ok(cfg.prompts.word.includes('{text}'));
  assert.ok(cfg.prompts.sentence.includes('{text}'));
});

test('DEFAULT_CONFIG：默认模型为 deepseek-chat', () => {
  assert.equal(DEFAULT_CONFIG.model, 'deepseek-chat');
  assert.equal(DEFAULT_CONFIG.targetLang, '简体中文');
});

test('maskApiKey：遮蔽', () => {
  assert.equal(maskApiKey(''), '(未设置)');
  assert.equal(maskApiKey('sk-1234567890'), 'sk-1****7890');
  assert.equal(maskApiKey('short'), '****');
});
