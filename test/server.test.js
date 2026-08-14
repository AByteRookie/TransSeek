import { test } from 'node:test';
import assert from 'node:assert';
import { startServer } from '../src/server.js';

test('server：/health 与 /translate（mock）', async (t) => {
  process.env.DS_MOCK = '1';
  t.after(() => delete process.env.DS_MOCK);

  const server = startServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.ok, true);

  const tr = await (await fetch(`${base}/translate?text=hello&mode=word`)).json();
  assert.equal(tr.mode, 'word');
  assert.equal(tr.mock, true);
  assert.match(tr.content, /hello/);

  const missing = await fetch(`${base}/translate`);
  assert.equal(missing.status, 400);

  // 首页返回网页版界面（HTML）
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(await home.text(), /深译/);

  // 路径穿越被拒绝
  const trav = await fetch(`${base}/../package.json`);
  assert.ok([403, 404].includes(trav.status));
});
