/**
 * Pure utility helpers — formatting, escaping, validation, notifications.
 * No DOM mutation other than the toast (which only touches a known element).
 */
(function (global) {
  'use strict';

  const HTML_ESCAPE_MAP = {
    '&':  '&amp;',
    '<':  '&lt;',
    '>':  '&gt;',
    '"':  '&quot;',
    "'":  '&#039;'
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
  }

  function isValidEmail(email) {
    return AppConfig.VALIDATION.email.pattern.test(email);
  }

  const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  function formatDate(value) {
    if (!value) return '-';
    return dateFormatter.format(new Date(value));
  }

  function formatDateTime(value) {
    if (!value) return '-';
    return dateTimeFormatter.format(new Date(value));
  }

  function statusInfo(key)   { return AppConfig.STATUS[key]   || { icon: '⚪', label: key || '-' }; }
  function priorityInfo(key) { return AppConfig.PRIORITY[key] || { icon: '⚪', label: key || '-' }; }
  function typeInfo(key)     { return AppConfig.TYPE[key]     || { icon: '📦', label: key || '-' }; }

  /**
   * Show a transient toast. Reuses #notification element rendered in the page.
   * Type: 'success' | 'error' | 'info'
   */
  let notifTimer = null;
  function showNotification(type, message) {
    const el = document.getElementById('notification');
    if (!el) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.querySelector('.notif-icon').textContent = icons[type] || icons.info;
    el.querySelector('.notif-text').textContent = message;
    el.className = `notification ${type}`;
    el.style.display = 'flex';

    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  global.Utils = {
    escapeHtml,
    isValidEmail,
    formatDate,
    formatDateTime,
    statusInfo,
    priorityInfo,
    typeInfo,
    showNotification
  };
})(window);
