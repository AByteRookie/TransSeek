/**
 * dsh-term-lookup 浏览器半侧（browser half）
 * 职责：监听用户在 DSH 界面里选中的文字，弹出「译」小按钮，点击后调用
 * /term/translate 获取释义并展示，支持一键复制。
 *
 * 形态与 dsh-pet 一致：用 window.__ModuleLoader__.load 注册客户端 bundle，
 * React 从 DSH 外壳 require（不自己打包），组件挂到 shell.overlay 槽位。
 */
window.__ModuleLoader__.load({
  id: 'dsh-term-lookup',
  factory: (require) => {
    const { useEffect, useState } = require('react');
    const { jsx: h } = require('react/jsx-runtime');

    // ---- 内联 CSS（注入一次） ----
    const css = [
      '.tl-btn{position:fixed;z-index:9998;transform:translate(-50%,-100%);margin-top:-8px;padding:3px 10px;border-radius:12px;background:#566eff;color:#fff;font-size:13px;font-weight:600;cursor:pointer;border:none;box-shadow:0 2px 8px rgba(0,0,0,.35)}',
      '.tl-btn:hover{background:#6d82ff}',
      '.tl-pop{position:fixed;z-index:9999;transform:translate(-50%,8px);width:260px;background:#1a1f33;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.45);font-size:13px;line-height:1.6}',
      '.tl-pop-term{color:#97a0b8;font-size:12px;margin-bottom:4px;word-break:break-all}',
      '.tl-pop-meaning{color:#e8eaf2;white-space:pre-wrap;word-break:break-all}',
      '.tl-pop-loading{color:#97a0b8}',
      '.tl-pop-error{color:#ff6b6b}',
      '.tl-pop-bar{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}',
      '.tl-pop-bar button{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#c6cde6;font-size:12px;padding:2px 10px;border-radius:8px;cursor:pointer}',
      '.tl-pop-bar button:hover{color:#fff;border-color:#566eff}'
    ].join('\n');
    const cssTag = 'dsh-term-lookup/style.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + cssTag + '"]') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-term-lookup';
      tag.dataset.pluginCss = cssTag;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    const MAX_TERM_LEN = 120; // 超过此长度的选中内容（整句）不触发

    function TermLookup() {
      // sel：当前选中的术语及其屏幕坐标；popup：释义弹窗状态
      const [sel, setSel] = useState(null);
      const [popup, setPopup] = useState(null);

      // 监听鼠标松开：检测选中文字
      useEffect(() => {
        const onMouseUp = (e) => {
          // 点击自己的按钮/弹窗时不重置
          if (e.target && e.target.closest && e.target.closest('.tl-root')) return;
          const selection = window.getSelection();
          const text = (selection ? selection.toString() : '').trim();
          if (!text || text.length > MAX_TERM_LEN || selection.rangeCount === 0) {
            setSel(null);
            return;
          }
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          if (!rect || (rect.width === 0 && rect.height === 0)) {
            setSel(null);
            return;
          }
          setSel({ text, x: rect.left + rect.width / 2, y: rect.top });
        };
        document.addEventListener('mouseup', onMouseUp);
        return () => document.removeEventListener('mouseup', onMouseUp);
      }, []);

      // 点击弹窗/按钮以外的区域：关闭弹窗和「译」按钮
      useEffect(() => {
        const onPointerDown = (e) => {
          if (e.target && e.target.closest && e.target.closest('.tl-root')) return;
          setPopup(null);
          setSel(null);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
      }, []);

      const doTranslate = async () => {
        if (!sel) return;
        const { text: term, x, y } = sel;
        setSel(null);
        setPopup({ term, status: 'loading', x, y });
        try {
          const res = await fetch('/term/translate?text=' + encodeURIComponent(term));
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          setPopup({ term, status: 'done', meaning: data.meaning, x, y });
        } catch (err) {
          setPopup({ term, status: 'error', error: err.message, x, y });
        }
      };

      const closePopup = () => setPopup(null);
      const copyMeaning = () => {
        if (popup && popup.meaning) {
          try { navigator.clipboard.writeText(popup.meaning); } catch (e) { /* ignore */ }
        }
      };

      // ---- 渲染（children 一律走 props.children，与 jsx-runtime 签名一致） ----
      const els = [];
      if (sel) {
        els.push(h('button', {
          key: 'btn',
          className: 'tl-btn tl-root',
          style: { left: sel.x + 'px', top: sel.y + 'px' },
          onClick: doTranslate,
          children: '译'
        }));
      }
      if (popup) {
        const style = { left: popup.x + 'px', top: popup.y + 'px' };
        let body;
        if (popup.status === 'loading') {
          body = h('div', { className: 'tl-pop-loading', children: '翻译中…' });
        } else if (popup.status === 'error') {
          body = h('div', { className: 'tl-pop-error', children: popup.error });
        } else {
          body = [
            h('div', { key: 'term', className: 'tl-pop-term', children: popup.term }),
            h('div', { key: 'meaning', className: 'tl-pop-meaning', children: popup.meaning })
          ];
        }
        els.push(h('div', {
          key: 'pop',
          className: 'tl-pop tl-root',
          style,
          children: [
            body,
            h('div', {
              className: 'tl-pop-bar',
              children: [
                popup.status === 'done' ? h('button', { key: 'copy', onClick: copyMeaning, children: '复制' }) : null,
                h('button', { key: 'close', onClick: closePopup, children: '关闭' })
              ]
            })
          ]
        }));
      }
      return els.length ? h('div', { className: 'tl-root', style: { display: 'contents' }, children: els }) : null;
    }

    // ---- Cordis 插件三件套 ----
    const name = 'term-lookup';
    const inject = ['slots'];
    function apply(ctx, config) {
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({
          name: 'shell.overlay',
          id: 'term-lookup',
          order: 1000
        }, () => h(TermLookup, {}));
      });
    }

    const module = { exports: {} };
    module.exports.apply = apply;
    module.exports.inject = inject;
    module.exports.name = name;
    return module.exports;
  }
});
