/**
 * Template copy/select widget used on request-process.html.
 * Wires buttons by data-action attributes.
 *
 * If a button contains `[data-btn-label]`, only that label flashes; otherwise
 * the whole button text flashes.
 */

import { TIMING } from '../../config/constants.js';

function flash(btn, text) {
  const label = btn.querySelector('[data-btn-label]') || btn;
  const original = label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = original; }, TIMING.copyFeedback);
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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    flash(btn, 'Đã copy');
  } catch (_) {
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
  try { document.execCommand('copy'); }
  finally { document.body.removeChild(textarea); }
}

export function initTemplateCopy() {
  document.querySelectorAll('[data-action="select-template"]').forEach((btn) => {
    btn.addEventListener('click', () => selectTemplate(btn));
  });
  document.querySelectorAll('[data-action="copy-template"]').forEach((btn) => {
    btn.addEventListener('click', () => copyTemplate(btn));
  });
}
