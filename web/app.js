/**
 * 深译 TransSeek 网页版前端逻辑
 * 依赖 TransSeek 服务提供的 /config 与 /translate 接口。
 * 纯原生 JS，无第三方库。
 */
const inputEl = document.getElementById('input');
const resultEl = document.getElementById('result');
const btnEl = document.getElementById('btn');
const clearEl = document.getElementById('clear');
const copyEl = document.getElementById('copy');
const statusEl = document.getElementById('status');
const langsEl = document.getElementById('langs');
const modesEl = document.getElementById('modes');
const brainCounterEl = document.getElementById('brain-counter');
const brainTodayEl = document.getElementById('brain-today');
const brainTipTodayEl = document.getElementById('brain-tip-today');
const brainTipTotalEl = document.getElementById('brain-tip-total');

let mode = 'auto';
let lastContent = '';

/* ---------- 脑容量木鱼计数器 ---------- */
const BRAIN_KEY = 'ds-brain-counter';
const todayKey = () => new Date().toISOString().slice(0, 10);

function loadBrain() {
  let data = { date: todayKey(), today: 0, total: 0 };
  try {
    const raw = localStorage.getItem(BRAIN_KEY);
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch {}
  if (data.date !== todayKey()) {
    data.date = todayKey();
    data.today = 0;
  }
  return data;
}

function saveBrain(data) {
  try { localStorage.setItem(BRAIN_KEY, JSON.stringify(data)); } catch {}
}

const brain = loadBrain();

function updateBrainDisplay() {
  brainTodayEl.textContent = brain.today;
  brainTipTodayEl.textContent = brain.today;
  brainTipTotalEl.textContent = brain.total;
}

function spawnBrainBubble() {
  const bubble = document.createElement('span');
  bubble.className = 'brain-bubble';
  bubble.textContent = '脑容量+1';
  brainCounterEl.appendChild(bubble);
  bubble.addEventListener('animationend', () => bubble.remove());
}

function addBrain() {
  brain.today += 1;
  brain.total += 1;
  saveBrain(brain);
  updateBrainDisplay();
  // 数字滚动动效（借鉴 motion-lexicon number-ticker）
  brainTodayEl.classList.remove('roll');
  void brainTodayEl.offsetWidth;
  brainTodayEl.classList.add('roll');
  spawnBrainBubble();
  brainCounterEl.classList.remove('pulse');
  void brainCounterEl.offsetWidth; // 触发重排以重启动画
  brainCounterEl.classList.add('pulse');
}

updateBrainDisplay();

/* ------------------------- 模式切换 ------------------------- */

modesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  mode = btn.dataset.mode;
  modesEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
});

/* ------------------------- 配置加载 ------------------------- */

async function loadConfig() {
  try {
    const cfg = await (await fetch('/config')).json();
    langsEl.textContent = `${cfg.sourceLang} ⇄ ${cfg.targetLang}（自动）`;
    if (cfg.configured) {
      statusEl.textContent = `已连接 · ${cfg.model}`;
      statusEl.className = 'status ok';
    } else {
      statusEl.textContent = '未配置 API Key（演示模式）';
      statusEl.className = 'status warn';
    }
  } catch {
    statusEl.textContent = '服务未连接';
    statusEl.className = 'status err';
  }
}

/* ------------------------- 翻译 ------------------------- */

async function doTranslate() {
  const text = inputEl.value.trim();
  if (!text) {
    resultEl.innerHTML = '<div class="placeholder">请输入内容</div>';
    inputEl.focus();
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = '翻译中…';
  resultEl.innerHTML = '<div class="placeholder">翻译中…</div>';

  try {
    const url = `/translate?text=${encodeURIComponent(text)}&mode=${mode}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastContent = data.content || '';
    if (data.sourceLang && data.targetLang) {
      langsEl.textContent = `${data.sourceLang} → ${data.targetLang}`;
    }
    render(data.content || '');
    if (data.mock) appendTag('离线演示 · 配置 API Key 后获得真实翻译');
    addBrain();
  } catch (err) {
    lastContent = '';
    copyEl.disabled = true;
    resultEl.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'error';
    d.textContent = `翻译失败：${err.message}`;
    resultEl.appendChild(d);
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = '翻 译';
  }
}

btnEl.addEventListener('click', doTranslate);

inputEl.addEventListener('keydown', (e) => {
  // 直接按 Enter 翻译；Shift+Enter 换行（保留多行输入）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    doTranslate();
  }
});

clearEl.addEventListener('click', () => {
  inputEl.value = '';
  inputEl.focus();
  lastContent = '';
  copyEl.disabled = true;
  resultEl.innerHTML = '<div class="placeholder">结果将显示在这里</div>';
});

copyEl.addEventListener('click', async () => {
  if (!lastContent) return;
  try {
    await navigator.clipboard.writeText(lastContent);
    copyEl.textContent = '已复制';
    setTimeout(() => (copyEl.textContent = '复制'), 1500);
  } catch {
    // 剪贴板 API 不可用时静默忽略
  }
});

/* ------------------------- Markdown-lite 渲染 ------------------------- */

function render(content) {
  resultEl.innerHTML = '';
  copyEl.disabled = false;
  const lines = String(content).split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // 定义行：兼容「- **标签**：值」「**标签**：值」及无加粗的「标签：值」
    let def = line.match(/^\s*(?:[-•]\s+)?\*\*(.+?)\*\*[：:]\s*(.*)$/)
      || line.match(/^\s*(?:[-•]\s+)?(原文|译文|要点)[：:]\s*(.*)$/);
    if (def) {
      const label = def[1];
      const value = def[2];
      // 不显示原文；译文去掉标签，只保留翻译内容
      if (label === '原文') continue;
      if (label === '译文') {
        const row = document.createElement('div');
        row.className = 'para';
        row.textContent = value;
        resultEl.appendChild(row);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'def';
      const labelEl = document.createElement('div');
      labelEl.className = 'def-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = 'def-value';
      valueEl.textContent = value;
      row.append(labelEl, valueEl);
      resultEl.appendChild(row);
      continue;
    }

    if (/^\s*[-•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const item = document.createElement('div');
      item.className = 'bullet';
      item.textContent = line.replace(/^\s*[-•]\s+/, '').replace(/^\s*\d+\.\s+/, '');
      resultEl.appendChild(item);
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const h = document.createElement('div');
      h.className = 'heading';
      h.textContent = line.replace(/^#{1,6}\s+/, '');
      resultEl.appendChild(h);
      continue;
    }

    const t = line.trim();
    if (!t) continue;
    const p = document.createElement('div');
    p.className = 'para';
    p.textContent = line;
    resultEl.appendChild(p);
  }

  // 结果进入动效：淡入 + 上滑（借鉴 motion-lexicon slide-in）
  resultEl.classList.remove('enter');
  void resultEl.offsetWidth;
  resultEl.classList.add('enter');
}

function appendTag(text) {
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = text;
  resultEl.appendChild(tag);
}

/* ------------------------- 初始化 ------------------------- */

loadConfig();

/* ------------------------- 按钮水波纹 ------------------------- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spawnRipple(btn, clientX, clientY) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = rect.width;
  ripple.style.width = size + 'px';
  ripple.style.height = size + 'px';
  ripple.style.left = (clientX - rect.left) + 'px';
  ripple.style.top = (clientY - rect.top) + 'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

document.addEventListener('pointerdown', (e) => {
  if (reduceMotion) return;
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  spawnRipple(btn, e.clientX, e.clientY);
});
