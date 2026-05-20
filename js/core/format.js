/**
 * Pure formatting helpers — HTML escaping, date display, enum label lookup.
 */

import { STATUS, PRIORITY, TYPE } from '../config/constants.js';

const HTML_ESCAPE_MAP = {
  '&':  '&amp;',
  '<':  '&lt;',
  '>':  '&gt;',
  '"':  '&quot;',
  "'":  '&#039;'
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

export function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '-';
  return dateTimeFormatter.format(new Date(value));
}

export function statusInfo(key)   { return STATUS[key]   || { icon: '⚪', label: key || '-' }; }
export function priorityInfo(key) { return PRIORITY[key] || { icon: '⚪', label: key || '-' }; }
export function typeInfo(key)     { return TYPE[key]     || { icon: '📦', label: key || '-' }; }

/** Returns 1-2 character initials from a name ("Thap Nguyen" → "TN"). */
export function initials(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
