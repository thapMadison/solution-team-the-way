/**
 * Template copy/select widget used on request-process.html.
 * Wires up two buttons by data-action attributes — no inline onclick needed.
 */
(function () {
  'use strict';

  const RESET_MS = 1500;

  function flash(btn, text, bg) {
    const original     = btn.textContent;
    const originalBg   = btn.style.background;
    btn.textContent    = text;
    btn.style.background = bg;
    setTimeout(() => {
      btn.textContent      = original;
      btn.style.background = originalBg;
    }, RESET_MS);
  }

  function selectTemplate(btn) {
    const pre = document.getElementById('templateContent');
    if (!pre) return;

    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    flash(btn, '✓ Selected!', '#10b981');
  }

  async function copyTemplate(btn) {
    const pre = document.getElementById('templateContent');
    if (!pre) return;
    const text = pre.textContent;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      flash(btn, '✓ Đã copy!', '#10b981');
    } catch (err) {
      flash(btn, '❌ Lỗi', '#ef4444');
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity  = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-action="select-template"]').forEach((btn) => {
      btn.addEventListener('click', () => selectTemplate(btn));
    });
    document.querySelectorAll('[data-action="copy-template"]').forEach((btn) => {
      btn.addEventListener('click', () => copyTemplate(btn));
    });
  });
})();
