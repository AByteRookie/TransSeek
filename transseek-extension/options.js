// 深译 TransSeek 划词翻译 —— 设置页逻辑
const DEFAULT_SERVER = 'http://127.0.0.1:9177';
const serverEl = document.getElementById('server');
const statusEl = document.getElementById('status');

chrome.storage.sync.get({ server: DEFAULT_SERVER }, (data) => {
  serverEl.value = data.server;
});

document.getElementById('save').addEventListener('click', () => {
  const server = serverEl.value.trim().replace(/\/+$/, '');
  chrome.storage.sync.set({ server }, () => {
    statusEl.textContent = '已保存 ✓';
    setTimeout(() => { statusEl.textContent = ''; }, 1500);
  });
});
