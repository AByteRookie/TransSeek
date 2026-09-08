// 深译 TransSeek 划词翻译 —— 后台 Service Worker
// 职责：1) 把翻译请求转发到本地 TransSeek 服务；2) 点击扩展图标打开设置页。

const DEFAULT_SERVER = 'http://127.0.0.1:9177';

async function getServer() {
  const { server } = await chrome.storage.sync.get({ server: DEFAULT_SERVER });
  return String(server || DEFAULT_SERVER).trim().replace(/\/+$/, '');
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'translate') {
    translate(msg.text, msg.mode)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true; // 保持消息通道，异步响应
  }
  return false;
});

async function translate(text, mode = 'auto') {
  const server = await getServer();
  const url = new URL(server + '/translate');
  url.searchParams.set('text', text);
  url.searchParams.set('mode', mode);

  let res;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new Error(`无法连接本地服务 ${server}，请确认 TransSeek 已启动（可双击 start-transseek.vbs）`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { ok: true, ...data };
}

// 点击扩展图标 → 打开设置页
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
