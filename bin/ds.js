#!/usr/bin/env node
/**
 * ds 命令入口
 * 用法示例：
 *   ds "hello"
 *   ds -w "apple"
 *   ds -s "Hello, how are you?"
 *   ds config set apiKey sk-xxx
 */
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((err) => {
  // 已由 cli 内部处理的错误不应重复打印，这里兜底打印未捕获异常
  console.error(`\n[错误] ${err?.message ?? err}`);
  process.exit(1);
});
