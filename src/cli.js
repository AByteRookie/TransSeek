/**
 * CLI 命令行入口
 * 命令：
 *   ds [选项] "文本"          翻译（自动判断单词/句子）
 *   ds -w "word"              单词模式
 *   ds -s "sentence"          句子模式
 *   ds -f file.txt            翻译文件内容
 *   ds config [show|get|set|init|reset]
 *   ds server [--port N]      启动 HTTP 服务（网页版）
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadConfig,
  saveConfig,
  ensureConfig,
  maskApiKey,
  SETTABLE_KEYS,
  PROMPT_KEYS,
  CONFIG_PATH,
  DEFAULT_CONFIG
} from './config.js';
import { detectMode } from './detect.js';
import { translate } from './translator.js';
import { renderResult, renderPlain } from './formatter.js';

const VERSION = '1.0.0';

export async function main(argv) {
  if (argv.length === 0) {
    printHelp();
    return;
  }
  const first = argv[0];
  switch (first) {
    case 'config':
      return handleConfig(argv.slice(1));
    case 'server':
      return handleServer(argv.slice(1));
    case 'help':
    case '-h':
    case '--help':
      return printHelp();
    case 'version':
    case '-V':
    case '--version':
      console.log(VERSION);
      return;
    default:
      return handleTranslate(argv);
  }
}

/* ----------------------------- 翻译命令 ----------------------------- */

async function handleTranslate(argv) {
  let mode = 'auto';
  let mock = false;
  let stream = false;
  let plain = false;
  let file = null;
  let model = null;
  let sourceLang = null;
  let targetLang = null;
  const textParts = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-w': case '--word': mode = 'word'; break;
      case '-s': case '--sentence': mode = 'sentence'; break;
      case '-a': case '--auto': mode = 'auto'; break;
      case '-m': case '--mock': mock = true; break;
      case '--stream': stream = true; break;
      case '--plain': plain = true; break;
      case '-f': case '--file': file = argv[++i]; break;
      case '--model': model = argv[++i]; break;
      case '--source-lang': sourceLang = argv[++i]; break;
      case '--target-lang': targetLang = argv[++i]; break;
      default:
        if (a.startsWith('-') && a !== '-') {
          throw new Error(`未知参数: ${a}（用 ds --help 查看用法）`);
        }
        textParts.push(a);
    }
  }

  if (file && !file) throw new Error('--file 需要指定文件路径');

  let text;
  if (file) {
    text = readFileSync(resolve(file), 'utf8').trim();
    if (!text) throw new Error(`文件为空: ${file}`);
  } else if (textParts.length) {
    text = textParts.join(' ');
  } else if (!process.stdin.isTTY) {
    text = readStdinSync();
  }

  if (!text) {
    printHelp();
    return;
  }

  const cfg = loadConfig();
  if (model) cfg.model = model;
  if (sourceLang) cfg.sourceLang = sourceLang;
  if (targetLang) cfg.targetLang = targetLang;

  try {
    if (stream) {
      const resolved = mode === 'auto' ? detectMode(text) : mode;
      if (!plain) {
        process.stdout.write(`## ${resolved === 'word' ? '词典结果' : '翻译结果'}\n\n`);
      }
      await translate({
        text, mode, config: cfg, stream: true, mock,
        onToken: (chunk) => process.stdout.write(chunk)
      });
      process.stdout.write('\n');
    } else {
      const result = await translate({ text, mode, config: cfg, mock });
      const out = plain
        ? renderPlain(result.content)
        : renderResult({
            text,
            mode: result.mode,
            content: result.content,
            meta: { model: result.model, ms: result.ms }
          });
      process.stdout.write(out);
    }
  } catch (err) {
    console.error(`[错误] ${err?.message ?? err}`);
    process.exit(1);
  }
}

function readStdinSync() {
  try {
    return readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

/* ----------------------------- 配置命令 ----------------------------- */

function handleConfig(args) {
  if (args.length === 0 || args[0] === 'show' || args[0] === 'view') {
    showConfig(loadConfig());
    return;
  }
  const sub = args[0];
  switch (sub) {
    case 'init': {
      const { created } = ensureConfig();
      console.log(created ? `已初始化配置：${CONFIG_PATH}` : `配置文件已存在：${CONFIG_PATH}`);
      return;
    }
    case 'reset': {
      saveConfig(DEFAULT_CONFIG);
      console.log('已重置为默认配置');
      return;
    }
    case 'set': {
      if (args.length < 3) throw new Error('用法：ds config set <key> <value>');
      setConfigValue(args[1], args.slice(2).join(' '));
      return;
    }
    case 'get': {
      if (args.length < 2) throw new Error('用法：ds config get <key>');
      console.log(getConfigValue(loadConfig(), args[1]));
      return;
    }
    default:
      throw new Error(`未知 config 子命令: ${sub}`);
  }
}

function setConfigValue(key, rawValue) {
  const cfg = loadConfig();
  if (key.startsWith('prompt.')) {
    const name = key.slice('prompt.'.length);
    if (!PROMPT_KEYS.has(name)) {
      throw new Error(`未知提示词: ${name}（可选 word / sentence）`);
    }
    cfg.prompts[name] = rawValue;
    saveConfig(cfg);
    console.log(`已更新 prompt.${name}`);
    return;
  }
  if (!SETTABLE_KEYS.has(key)) {
    throw new Error(
      `不可设置的键: ${key}（可选 ${[...SETTABLE_KEYS].join(', ')}，或 prompt.word / prompt.sentence）`
    );
  }
  let value = rawValue;
  if (['temperature', 'maxTokens', 'timeoutMs'].includes(key)) {
    value = Number(rawValue);
    if (Number.isNaN(value)) throw new Error(`${key} 需要数字值`);
  }
  cfg[key] = value;
  saveConfig(cfg);
  console.log(`已设置 ${key} = ${key === 'apiKey' ? maskApiKey(value) : value}`);
}

function getConfigValue(cfg, key) {
  if (key.startsWith('prompt.')) {
    const name = key.slice('prompt.'.length);
    return cfg.prompts?.[name] ?? '';
  }
  if (key === 'apiKey') return maskApiKey(cfg.apiKey);
  return cfg[key] ?? '';
}

function showConfig(cfg) {
  const lines = [
    '当前配置：',
    `  配置文件 : ${CONFIG_PATH}`,
    `  apiKey   : ${maskApiKey(cfg.apiKey)}`,
    `  baseUrl  : ${cfg.baseUrl}`,
    `  model    : ${cfg.model}`,
    `  sourceLang : ${cfg.sourceLang}`,
    `  targetLang : ${cfg.targetLang}`,
    `  temperature : ${cfg.temperature}`,
    `  maxTokens   : ${cfg.maxTokens}`,
    `  timeoutMs   : ${cfg.timeoutMs}`,
    '  prompts :',
    '    word     (已配置)' ,
    '    sentence (已配置)'
  ];
  console.log(lines.join('\n'));
}

/* ----------------------------- server 命令 ----------------------------- */

async function handleServer(args) {
  let port = 9177;
  let host = '127.0.0.1';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') port = Number(args[++i]);
    else if (args[i] === '--host') host = args[++i];
    else if (args[i] === '--lan' || args[i] === '--share') host = '0.0.0.0';
  }
  const { startServer } = await import('./server.js');
  startServer({ port, host });
}

/* ----------------------------- 帮助 ----------------------------- */

function printHelp() {
  console.log(`深译 TransSeek —— 基于 DeepSeek API 的中英互译工具

用法：
  ds "文本"                    自动判断单词/句子并翻译
  ds -w "apple"                单词模式（词典：音标/词性/释义/例句）
  ds -s "Hello world"          句子模式（整句流畅翻译）
  ds -f 文件路径                翻译文件内容
  ds --stream "文本"            流式输出
  ds --plain "文本"             纯文本输出（便于脚本管道）
  ds --mock "文本"              离线演示（无需 API Key）
  echo "hello" | ds            从标准输入读取

选项：
  -w, --word        单词模式      -s, --sentence   句子模式
  -a, --auto        自动判断（默认） -f, --file      翻译文件
  -m, --mock        离线 Mock      --stream        流式输出
  --plain           纯文本输出     --model 名称     本次覆盖模型
  --source-lang 语言  本次覆盖源语言    --target-lang 语言 本次覆盖目标语言

配置：
  ds config                      查看配置（API Key 已遮蔽）
  ds config set apiKey sk-xxx    设置 API Key
  ds config set model deepseek-chat
  ds config set prompt.word "..." 自定义单词模式提示词
  ds config set prompt.sentence "..." 自定义句子模式提示词
  ds config get model            读取单个配置
  ds config init                 初始化配置文件
  ds config reset                重置为默认配置

其他：
  ds server [--port 9177]        启动 HTTP 服务（网页版，仅本机可访问）
  ds server --lan                启动并监听局域网，供同学/其他设备访问
  ds --help                      显示本帮助
  ds --version                   显示版本
`);
}
