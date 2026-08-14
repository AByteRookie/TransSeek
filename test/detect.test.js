import { test } from 'node:test';
import assert from 'node:assert';
import { detectMode, normalizeMode } from '../src/detect.js';

test('detectMode：单个英文单词 → word', () => {
  assert.equal(detectMode('hello'), 'word');
  assert.equal(detectMode("don't"), 'word');
  assert.equal(detectMode('well-known'), 'word');
});

test('detectMode：多词/句子 → sentence', () => {
  assert.equal(detectMode('Hello world'), 'sentence');
  assert.equal(detectMode('How are you?'), 'sentence');
  assert.equal(detectMode('I am fine, thanks.'), 'sentence');
});

test('detectMode：中文（2 字为词，>2 字为句）', () => {
  assert.equal(detectMode('你好'), 'word');
  assert.equal(detectMode('今天天气很好'), 'sentence');
});

test('detectMode：空输入抛错', () => {
  assert.throws(() => detectMode('   '), /为空/);
});

test('normalizeMode：规范化', () => {
  assert.equal(normalizeMode('auto'), 'auto');
  assert.equal(normalizeMode('W'), 'word');
  assert.equal(normalizeMode('句子'), 'sentence');
  assert.equal(normalizeMode(undefined), 'auto');
  assert.throws(() => normalizeMode('foo'), /未知模式/);
});
