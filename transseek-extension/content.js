// 深译 TransSeek 划词翻译 —— 内容脚本
// 在任意网页选中文字后弹出「译」按钮，点击后调用本地服务并就地显示结果。

(function () {
  if (window.__transseekContentLoaded) return;
  window.__transseekContentLoaded = true;
  // 在 <html> 上打一个标记，方便从页面控制台确认脚本已注入
  // （window 上的变量属于隔离世界，页面控制台看不到，DOM 标记则可见）
  if (document.documentElement) document.documentElement.setAttribute('data-transseek-loaded', '1');

  const MAX_LEN = 800; // 超过此长度的选中内容不触发（避免整篇/超长段落）
  let button = null;
  let popup = null;

  // ---- DOM 辅助 ----
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function removeButton() { if (button) { button.remove(); button = null; } }
  function removePopup() { if (popup) { popup.remove(); popup = null; } }

  function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }

  // ---- 极简 Markdown 渲染：**加粗** + 换行 ----
  function renderMarkdown(md) {
    return String(md || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function stripMarkdown(s) { return String(s || '').replace(/\*\*/g, ''); }

  // ---- 选中后显示「译」按钮 ----
  function showButton(text, x, y) {
    removeButton();
    removePopup();
    button = el('button', { class: 'ts-btn', title: '翻译' }, [el('span', { text: '译' })]);
    button.style.left = x + 'px';
    button.style.top = y + 'px';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      doTranslate(text, x, y);
    });
    document.body.appendChild(button);
  }

  async function doTranslate(text, x, y) {
    removeButton();
    showPopup(text, x, y, 'loading');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'translate', text, mode: 'auto' });
      if (res && res.ok) showPopup(text, x, y, 'done', res.content, res.mode);
      else showPopup(text, x, y, 'error', res && res.error);
    } catch (err) {
      showPopup(text, x, y, 'error', err && err.message);
    }
  }

  // ---- 结果弹窗 ----
  function showPopup(text, x, y, status, content, mode) {
    removePopup();
    popup = el('div', { class: 'ts-pop' });
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    const head = el('div', { class: 'ts-pop-head' });
    head.appendChild(el('span', { class: 'ts-pop-term', text: truncate(text, 60) }));
    const close = el('button', { class: 'ts-pop-close', text: '×', title: '关闭' });
    close.addEventListener('click', removePopup);
    head.appendChild(close);
    popup.appendChild(head);

    const body = el('div', { class: 'ts-pop-body' });
    if (status === 'loading') {
      body.appendChild(el('div', { class: 'ts-pop-loading', text: '翻译中…' }));
    } else if (status === 'error') {
      body.appendChild(el('div', { class: 'ts-pop-error', text: '翻译失败：' + (content || '未知错误') }));
    } else {
      body.appendChild(el('div', { class: 'ts-pop-content', html: renderMarkdown(content) }));
    }
    popup.appendChild(body);

    // 结果底部操作栏：复制
    if (status === 'done') {
      const bar = el('div', { class: 'ts-pop-bar' });
      const copy = el('button', { class: 'ts-pop-copy', text: '复制' });
      copy.addEventListener('click', () => {
        navigator.clipboard.writeText(stripMarkdown(content)).then(() => {
          copy.textContent = '已复制';
          setTimeout(() => { copy.textContent = '复制'; }, 1200);
        }).catch(() => {});
      });
      bar.appendChild(copy);
      popup.appendChild(bar);
    }

    document.body.appendChild(popup);
    clampToViewport(popup);
  }

  function clampToViewport(node) {
    const r = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    let top = r.top;
    if (r.right > vw - 8) left = Math.max(8, vw - r.width - 8);
    if (r.bottom > vh - 8) top = Math.max(8, vh - r.height - 8);
    node.style.left = left + 'px';
    node.style.top = top + 'px';
  }

  // ---- 选中监听（mouseup，捕获阶段：先于页面自己的 mouseup 处理器，
  //      避免页面调用 stopPropagation 导致这里收不到事件）----
  document.addEventListener('mouseup', (e) => {
    if (e.target && e.target.closest && (e.target.closest('.ts-btn') || e.target.closest('.ts-pop'))) return;
    const sel = window.getSelection();
    const text = (sel ? sel.toString() : '').trim();
    if (!text || text.length > MAX_LEN || sel.rangeCount === 0) {
      removeButton();
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      removeButton();
      return;
    }
    showButton(text, rect.left + rect.width, rect.top + rect.height + 6);
  }, true);

  // ---- 点击别处关闭弹窗/按钮（捕获阶段）----
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && (e.target.closest('.ts-btn') || e.target.closest('.ts-pop'))) return;
    removeButton();
    removePopup();
  }, true);

  // ---- Esc 关闭（捕获阶段）----
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { removeButton(); removePopup(); }
  }, true);

  // ---- 滚动/缩放时关闭，避免位置错乱 ----
  window.addEventListener('scroll', () => { removeButton(); removePopup(); }, true);
  window.addEventListener('resize', () => { removeButton(); removePopup(); });
})();
