/**
 * 配置管理模块
 * 配置文件位置：~/.ds-translate/config.json（可用环境变量 DS_CONFIG_DIR 覆盖）
 * API Key 优先级：配置文件 apiKey < 环境变量 DEEPSEEK_API_KEY
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DEFAULT_PROMPTS } from './prompts.js';

export const CONFIG_DIR = process.env.DS_CONFIG_DIR || join(homedir(), '.ds-translate');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export const DEFAULT_CONFIG = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  sourceLang: '英语',
  targetLang: '简体中文',
  temperature: 0.3,
  maxTokens: 2048,
  timeoutMs: 60000,
  prompts: { ...DEFAULT_PROMPTS }
};

/** 可被 `ds config set` 修改的标量键 */
export const SETTABLE_KEYS = new Set([
  'apiKey', 'baseUrl', 'model', 'sourceLang', 'targetLang',
  'temperature', 'maxTokens', 'timeoutMs'
]);

/** 可被 `ds config set prompt.<name>` 修改的提示词 */
export const PROMPT_KEYS = new Set(['word', 'wordZh', 'sentence']);

function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object') {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * 读取并合并配置：默认值 → 配置文件 → 环境变量。
 * @returns {object}
 */
export function loadConfig() {
  let fileConfig = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      throw new Error(`配置文件解析失败（${CONFIG_PATH}）：${err.message}`);
    }
  }
  const cfg = deepMerge(DEFAULT_CONFIG, fileConfig);

  // 环境变量覆盖
  if (process.env.DEEPSEEK_API_KEY) cfg.apiKey = process.env.DEEPSEEK_API_KEY;
  if (process.env.DEEPSEEK_MODEL) cfg.model = process.env.DEEPSEEK_MODEL;
  if (process.env.DEEPSEEK_BASE_URL) cfg.baseUrl = process.env.DEEPSEEK_BASE_URL;

  return cfg;
}

/**
 * 保存配置（写回用户配置文件）。
 * @param {object} cfg
 */
export function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

/**
 * 解析有效的 API Key。
 * @param {object} cfg
 * @returns {string} 可能为空字符串
 */
export function resolveApiKey(cfg) {
  return (cfg.apiKey || process.env.DEEPSEEK_API_KEY || '').trim();
}

/**
 * 遮蔽 API Key，用于日志/展示。
 * @param {string} key
 * @returns {string}
 */
export function maskApiKey(key) {
  if (!key) return '(未设置)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

/**
 * 确保配置文件存在：不存在则按默认值初始化。
 * @returns {{created: boolean, path: string}}
 */
export function ensureConfig() {
  if (existsSync(CONFIG_PATH)) {
    return { created: false, path: CONFIG_PATH };
  }
  saveConfig(DEFAULT_CONFIG);
  return { created: true, path: CONFIG_PATH };
}
