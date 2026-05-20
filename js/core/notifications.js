/**
 * Transient toast notifications. Reuses the #notification element rendered in the page.
 */

import { TIMING } from '../config/constants.js';

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

let timer = null;

/**
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 */
export function showNotification(type, message) {
  const el = document.getElementById('notification');
  if (!el) return;

  el.querySelector('.notif-icon').textContent = ICONS[type] || ICONS.info;
  el.querySelector('.notif-text').textContent = message;
  el.className = `notification ${type}`;
  el.style.display = 'flex';

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { el.style.display = 'none'; }, TIMING.notificationToast);
}
