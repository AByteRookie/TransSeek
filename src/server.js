/**
 * 深译 TransSeek HTTP 服务 + 网页版界面托管
 * 路由：
 *   GET  /                    网页版翻译界面（HTML）
 *   GET  /style.css /app.js   网页静态资源
 *   GET  /health              健康检查（JSON）
 *   GET  /config              查看配置（API Key 遮蔽，JSON）
 *   GET  /translate?text=...&mode=auto|word|sentence
 *   POST /translate           JSON: { text, mode? }
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { loadConfig, maskApiKey } from './config.js';
import { translate } from './translator.js';

const DEFAULT_PORT = 9177;
const DEFAULT_HOST = '127.0.0.1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/** 获取本机所有局域网 IPv4 地址（用于分享给其他设备访问）。 */
function getLanIPv4() {
  const ips = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

/**
 * 启动 HTTP 服务。
 * @param {object} [opts]
 * @param {number} [opts.port=9177]
 * @param {string} [opts.host='127.0.0.1']
 * @returns {import('node:http').Server}
 */
export function startServer({ port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  const server = createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);
      const path = url.pathname;

      if (path === '/health') {
        return sendJson(res, 200, {
          ok: true,
          service: 'TransSeek',
          ui: '/',
          routes: ['/translate', '/config', '/health']
        });
      }

      if (path === '/config') {
        const cfg = loadConfig();
        return sendJson(res, 200, {
          model: cfg.model,
          sourceLang: cfg.sourceLang,
          targetLang: cfg.targetLang,
          apiKey: maskApiKey(cfg.apiKey),
          configured: Boolean(cfg.apiKey || process.env.DEEPSEEK_API_KEY)
        });
      }

      if (path === '/translate') {
        let text, mode;
        if (req.method === 'GET') {
          text = url.searchParams.get('text');
          mode = url.searchParams.get('mode') ?? 'auto';
        } else if (req.method === 'POST') {
          const body = await readBody(req);
          text = body.text;
          mode = body.mode ?? 'auto';
        } else {
          return sendJson(res, 405, { error: '仅支持 GET / POST' });
        }

        if (!text || !String(text).trim()) {
          return sendJson(res, 400, { error: '缺少 text 参数' });
        }

        const cfg = loadConfig();
        const result = await translate({ text: String(text).trim(), mode, config: cfg });
        return sendJson(res, 200, result);
      }

      // 其余路径作为静态资源处理（含首页 /）
      return await serveStatic(res, path);
    } catch (err) {
      return sendJson(res, 500, { error: err?.message ?? String(err) });
    }
  });

  server.listen(port, host, () => {
    console.log('[TransSeek] 服务已启动');
    console.log(`  本机访问：http://127.0.0.1:${port}/`);
    if (host === '0.0.0.0' || host === '::') {
      const lanIps = getLanIPv4();
      if (lanIps.length) {
        for (const ip of lanIps) {
          console.log(`  局域网分享：http://${ip}:${port}/`);
        }
      } else {
        console.log('  （已监听 0.0.0.0，但未检测到局域网 IPv4）');
      }
    }
    console.log(`  接口示例：http://127.0.0.1:${port}/translate?text=hello&mode=word`);
  });
  return server;
}

/** 托管 web/ 目录下的静态资源。 */
async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = normalize(join(WEB_DIR, rel));

  // 路径穿越防护：仅允许 WEB_DIR 内部文件
  if (filePath !== WEB_DIR && !filePath.startsWith(WEB_DIR + sep)) {
    return sendJson(res, 403, { error: '禁止访问' });
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: `未找到资源: ${pathname}` });
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2) + '\n');
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) rejectBody(new Error('请求体过大'));
    });
    req.on('end', () => {
      try {
        resolveBody(data ? JSON.parse(data) : {});
      } catch {
        rejectBody(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', rejectBody);
  });
}

// 直接运行 `node src/server.js` 时启动服务
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.DS_SERVER_PORT ?? DEFAULT_PORT);
  startServer({ port, host: process.env.DS_SERVER_HOST ?? DEFAULT_HOST });
}
