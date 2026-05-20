/**
 * Shared state for the Request Log feature.
 *
 * Other modules in this folder import these references — mutating
 * `state.foo = bar` from any module updates the singleton.
 */

import { STATUS, PRIORITY, PRIORITY_BARS } from '../../config/constants.js';

export const STATUS_KEYS   = Object.keys(STATUS);
export const PRIORITY_KEYS = Object.keys(PRIORITY);

/** How many rows to add per infinite-scroll tick. */
export const CHUNK_SIZE = 30;

export const state = {
  all:          [],
  filtered:     [],
  visibleCount: CHUNK_SIZE,
  view:         'rows',         // 'rows' | 'board'
  status:       'all',          // 'all' | one of STATUS_KEYS
  type:         'all',
  priority:     'all',
  query:        '',
  unsubscribe:  null,
  rowsObserver: null,
  teamMembers:  ['Unassigned']  // Dynamic list from Firebase
};

/** Cached DOM nodes — populated by `cacheDom()` at bootstrap. */
export const dom = {};

// ── Pure helpers (derive from request data, no DOM/state mutation) ──

export function statusClass(status) {
  if (status === 'in-progress') return 'is-progress';
  if (status === 'pending')     return 'is-pending';
  if (status === 'completed')   return 'is-completed';
  if (status === 'cancelled')   return 'is-cancelled';
  return '';
}

export function priorityClass(priority) {
  return `is-${priority || 'medium'}`;
}

export function priorityBars(priority) {
  return PRIORITY_BARS[priority] || PRIORITY_BARS.medium;
}

export function shortId(req) {
  const raw = String(req.id || '').trim();
  if (!raw) return 'REQ-----';
  // New format: stored as "REQ-N" → display with 4-digit zero-pad.
  const reqMatch = raw.match(/^REQ-(\d+)$/i);
  if (reqMatch) return `REQ-${reqMatch[1].padStart(4, '0')}`;
  // Legacy format: stored as a timestamp/numeric string — take last 4 digits.
  const digits = raw.replace(/\D/g, '');
  return `REQ-${digits.slice(-4).padStart(4, '0')}`;
}

/**
 * Compute the next sequential request ID by scanning the current cached list.
 * For "REQ-N" records the counter is `N`; for legacy timestamp IDs we extract
 * the last 4 digits so the new series doesn't collide with displayed shortIds.
 */
export function nextRequestId() {
  let max = 0;
  for (const r of state.all) {
    const raw = String(r.id || '').trim();
    const m = raw.match(/^REQ-(\d+)$/i);
    let n = NaN;
    if (m) {
      n = parseInt(m[1], 10);
    } else {
      const digits = raw.replace(/\D/g, '');
      if (digits) n = parseInt(digits.slice(-4), 10);
    }
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `REQ-${max + 1}`;
}

/**
 * Derive a 0–100 progress number for a request.
 *
 * Rules (highest precedence first):
 *   - completed  → always 100
 *   - cancelled  → always 0
 *   - explicit numeric `progress` → respect as manual override
 *   - pending    → 0
 *   - in-progress with estimate + logged → round(logged / estimate × 100),
 *     capped at 95 so 100% is reserved for the explicit "completed" state
 *   - in-progress without time tracking → 25 (sensible default)
 */
export function safeProgress(req) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  if (req.status === 'completed') return 100;
  if (req.status === 'cancelled') return 0;
  if (typeof req.progress === 'number') return clamp(req.progress, 0, 100);
  if (req.status === 'pending') return 0;

  const est = parseFloat(req.estimatedTime);
  const log = parseFloat(req.loggedEffort);
  if (Number.isFinite(est) && est > 0 && Number.isFinite(log) && log >= 0) {
    return clamp(Math.round((log / est) * 100), 0, 95);
  }
  return 25;
}

export function commentsCount(req) {
  if (Array.isArray(req.comments)) return req.comments.length;
  if (typeof req.comments === 'number') return req.comments;
  return 0;
}
