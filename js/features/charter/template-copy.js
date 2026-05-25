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

/**
 * Teams-compatible color palette (matches the color picker in Teams compose).
 * Bold + colored section headings survive paste into Teams.
 */
const TEAMS_COLORS = {
  jade:    '#5B9595',
  pear:    '#A4D75C',
  orange:  '#F7630C',
  magenta: '#B146C2',
  green:   '#13A10E',
  gold:    '#FFB900',
  red:     '#C4314B',
  muted:   '#605E5C'
};

function buildTemplateHtml() {
  const C = TEAMS_COLORS;
  const h = (color, text) => `<span style="color:${color};font-weight:bold"><b>${text}</b></span>`;
  const br = '<br>';
  const indent = '&nbsp;&nbsp;&nbsp;';
  const indent2 = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

  return [
    h(C.pear, '@Solution-Team-Lead'),
    br,
    h(C.red, 'REQUEST HỖ TRỢ TỪ SOLUTION TEAM'),
    br, br,
    h(C.jade, '1. 👤 THÔNG TIN CƠ BẢN'), br,
    `${indent}- Người yêu cầu (Name - Email):`, br,
    `${indent}- Dự án liên quan:`, br, br,
    h(C.orange, '2. 🚦 PHÂN LOẠI, PRIORITY &amp; TIMELINE'), br,
    `${indent}- Loại hỗ trợ: [Technical Support / Proposal / Code Review / Architecture / DevOps / R&amp;D / Training / Other]`, br,
    `${indent}- Priority: [Critical / High / Medium / Low]`, br,
    `${indent}- Timeline/Deadline mong muốn (nếu có):`, br, br,
    h(C.magenta, '3. 📝 CHI TIẾT YÊU CẦU'), br,
    `${indent}- Title (tóm tắt ngắn gọn):`, br,
    `${indent}- Mô tả yêu cầu:`, br,
    `${indent2}• Vấn đề:`, br,
    `${indent2}• Context:`, br,
    `${indent2}• Tech details:`, br, br,
    h(C.green, '4. 🎯 KẾT QUẢ MONG ĐỢI'), br,
    `${indent}- Output mong đợi &amp; tiêu chí hoàn thành:`, br, br,
    h(C.gold, '5. 💰 BUDGET (Bỏ qua nếu chấp nhận default Yes/Yes)'), br,
    `${indent}- Dự án có budget: Yes`, br,
    `${indent}- Chấp nhận allocation: Yes`
  ].join('');
}

async function copyTemplate(btn) {
  const pre = document.getElementById('templateContent');
  if (!pre) return;
  const text = pre.textContent;
  const html = buildTemplateHtml();

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    flash(btn, 'Đã copy');
  } catch (_) {
    try {
      await navigator.clipboard?.writeText(text);
      flash(btn, 'Đã copy (plain)');
    } catch {
      flash(btn, 'Lỗi');
    }
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
