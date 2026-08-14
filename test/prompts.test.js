import { test } from 'node:test';
import assert from 'node:assert';
import { buildMessages, renderPrompt, DEFAULT_PROMPTS } from '../src/prompts.js';

const cfg = { sourceLang: '英语', targetLang: '简体中文', prompts: DEFAULT_PROMPTS };

test('buildMessages：单词模式完成占位符替换', () => {
  const msgs = buildMessages('apple', 'word', cfg);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs[1].role, 'user');
  assert.match(msgs[1].content, /apple/);
  assert.match(msgs[1].content, /英语/);
  assert.match(msgs[1].content, /简体中文/);
  assert.doesNotMatch(msgs[1].content, /\{text\}/);
  assert.doesNotMatch(msgs[1].content, /\{sourceLang\}/);
  assert.doesNotMatch(msgs[1].content, /\{targetLang\}/);
});

test('buildMessages：句子模式完成占位符替换', () => {
  const msgs = buildMessages('Hello world', 'sentence', cfg);
  assert.match(msgs[1].content, /Hello world/);
});

test('renderPrompt：基本替换', () => {
  assert.equal(renderPrompt('你好 {name}！', { name: '世界' }), '你好 世界！');
});

test('renderPrompt：缺失变量保留占位符', () => {
  assert.equal(renderPrompt('{a}{b}', { a: '1' }), '1{b}');
});
