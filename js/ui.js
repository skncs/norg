/* ============================================================
   Norg · UI 基础组件（弹层 / toast / 通用片段）
   ============================================================ */
(function (global) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1700);
  }

  /* ---------- sheet ---------- */
  let onClose = null;
  function openSheet(title, html, opts) {
    $('#sheetTitle').textContent = title;
    // 用克隆节点替换，确保旧的事件监听被彻底丢弃
    const old = $('#sheetBody');
    const fresh = old.cloneNode(false);
    fresh.innerHTML = html;
    old.parentNode.replaceChild(fresh, old);

    $('#sheetMask').hidden = false;
    $('#sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    onClose = (opts && opts.onClose) || null;
    if (opts && opts.after) setTimeout(opts.after, 20);
  }
  function closeSheet() {
    $('#sheetMask').hidden = true;
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
    if (onClose) { const f = onClose; onClose = null; f(); }
  }

  /* ---------- 图标 ---------- */
  const ICON = {
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>`,
    bowl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 11h18a9 9 0 01-9 9 9 9 0 01-9-9z"/><path d="M8 7c0-2 1-3 2-3M13 7c0-2 1-3 2-3"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
    fire: `<svg viewBox="0 0 24 24"><path d="M12 2c1 4-2 5-2 8a2 2 0 004 0c0-1 0-2 .5-2.5C16 9 18 12 18 15a6 6 0 11-12 0c0-4 3-7 6-13z" fill="currentColor"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 5H5v2a3 3 0 003 3M16 5h3v2a3 3 0 01-3 3"/><path d="M10 13v3h4v-3M9 20h6"/></svg>`,
    medal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="15" r="5.5"/><path d="M9 3l1.5 5M15 3l-1.5 5"/></svg>`,
    plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>`,
    rank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v6a5 5 0 01-10 0V4z"/><path d="M12 15v4M9 21h6"/></svg>`,
    store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l2-5h12l2 5M4 9h16v10H4z"/><path d="M9 19v-5h6v5"/></svg>`,
    water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3s6 6.5 6 10.5a6 6 0 01-12 0C6 9.5 12 3 12 3z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14a8 8 0 11-9-11 7 7 0 009 11z"/></svg>`,
    scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 10a4 4 0 008 0"/><path d="M12 10l2-2"/></svg>`,
    dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 9v6M21 9v6M6.5 6.5v11M17.5 6.5v11M6.5 12h11"/></svg>`,
  };

  /* ---------- 分段控件 ---------- */
  function seg(items, active, dataAttr) {
    return `<div class="seg">${items.map(it =>
      `<button class="${it.v === active ? 'on' : ''}" ${dataAttr}="${it.v}">${esc(it.t)}</button>`
    ).join('')}</div>`;
  }

  global.NorgUI = { $, $$, esc, toast, openSheet, closeSheet, ICON, seg };
})(window);
