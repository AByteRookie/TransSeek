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

test('buildMessages：中文源单词模式使用 wordZh（拼音/目标语言释义）', () => {
  const zhCfg = { sourceLang: '简体中文', targetLang: '英语', prompts: DEFAULT_PROMPTS };
  const msgs = buildMessages('苹果', 'word', zhCfg);
  assert.match(msgs[1].content, /苹果/);
  assert.match(msgs[1].content, /拼音/);          // 中文源词典用拼音而非音标
  assert.doesNotMatch(msgs[1].content, /音标/);
  assert.match(msgs[1].content, /英语/);           // 释义/例句用目标语言
});

test('buildMessages：英文源单词模式仍用音标词典', () => {
  const msgs = buildMessages('apple', 'word', cfg);
  assert.match(msgs[1].content, /音标/);
  assert.doesNotMatch(msgs[1].content, /拼音/);
});

test('renderPrompt：基本替换', () => {
  assert.equal(renderPrompt('你好 {name}！', { name: '世界' }), '你好 世界！');
});

test('renderPrompt：缺失变量保留占位符', () => {
  assert.equal(renderPrompt('{a}{b}', { a: '1' }), '1{b}');
});
