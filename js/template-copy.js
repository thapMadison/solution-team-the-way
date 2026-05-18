/**
 * Template copy/select widget used on request-process.html.
 * Wires up two buttons by data-action attributes.
 *
 * If the button has a child `[data-btn-label]`, only that label is flashed
 * (preserves leading SVG icon). Otherwise the whole button text is flashed.
 */
(function () {
  'use strict';

  const RESET_MS = 1500;

  function flash(btn, text, color) {
    const label = btn.querySelector('[data-btn-label]') || btn;
    const original = label.textContent;
    const originalColor = btn.style.color;
    label.textContent = text;
    if (color) btn.style.color = color;
    setTimeout(() => {
      label.textContent = original;
      btn.style.color = originalColor;
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

    flash(btn, 'Selected!');
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
      flash(btn, 'Đã copy');
    } catch (err) {
      flash(btn, 'Lỗi');
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
