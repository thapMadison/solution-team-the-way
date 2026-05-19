/**
 * Request Management app — wires requests-log.html to Firebase.
 *
 * Sections:
 *   1. State + helpers
 *   2. SVG icon helpers
 *   3. Stat strip + status rail rendering
 *   4. Rows view rendering + pagination
 *   5. Board view rendering (HTML5 drag & drop)
 *   6. Filtering (search / status / type / priority)
 *   7. New-request form
 *   8. Detail modal (load / render / save / delete)
 *   9. Event wiring + bootstrap
 */
(function () {
  'use strict';

  const { escapeHtml, formatDate, formatDateTime, statusInfo, priorityInfo, typeInfo, isValidEmail, showNotification } = Utils;
  const { TEAM_MEMBERS, PAGINATION, VALIDATION, STATUS, PRIORITY, TYPE } = AppConfig;

  // ────────────────────────────────────────────────────────────
  // 1. State
  // ────────────────────────────────────────────────────────────

  const STATUS_KEYS = ['pending', 'in-progress', 'completed', 'cancelled'];
  const PRIORITY_KEYS = ['low', 'medium', 'high', 'critical'];

  const CHUNK_SIZE = 30; // how many rows to add per infinite-scroll tick

  const state = {
    all:          [],
    filtered:     [],
    visibleCount: CHUNK_SIZE,
    view:         'rows',          // 'rows' | 'board'
    status:       'all',           // 'all' | one of STATUS_KEYS
    type:         'all',
    priority:     'all',
    query:        '',
    unsubscribe:  null,
    rowsObserver: null
  };

  const dom = {};

  function statusClass(status) {
    if (status === 'in-progress') return 'is-progress';
    if (status === 'pending')     return 'is-pending';
    if (status === 'completed')   return 'is-completed';
    if (status === 'cancelled')   return 'is-cancelled';
    return '';
  }

  function priorityClass(priority) {
    return `is-${priority || 'medium'}`;
  }

  function priorityBars(priority) {
    return ({ low: 1, medium: 2, high: 3, critical: 4 })[priority] || 2;
  }

  function initials(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const parts = s.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function shortId(req) {
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
   * Compute the next sequential request ID by scanning the current cached
   * list and returning `REQ-{max+1}`. For "REQ-N" records the counter is
   * `N`; for legacy timestamp IDs we extract the last 4 digits so the new
   * series doesn't collide with the displayed shortId of older records.
   */
  function nextRequestId() {
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
   *   - explicit numeric `progress` on the record → respect as manual override
   *   - pending    → 0
   *   - in-progress with estimate + logged → round(logged / estimate × 100),
   *     capped at 95 so 100% is reserved for the explicit "completed" state
   *   - in-progress without time tracking → 25 (sensible default)
   */
  function safeProgress(req) {
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

    if (req.status === 'completed') return 100;
    if (req.status === 'cancelled') return 0;

    if (typeof req.progress === 'number') return clamp(req.progress, 0, 100);

    if (req.status === 'pending') return 0;

    // in-progress: derive from time tracking
    const est = parseFloat(req.estimatedTime);
    const log = parseFloat(req.loggedEffort);
    if (Number.isFinite(est) && est > 0 && Number.isFinite(log) && log >= 0) {
      return clamp(Math.round((log / est) * 100), 0, 95);
    }
    return 25;
  }

  function commentsCount(req) {
    if (Array.isArray(req.comments)) return req.comments.length;
    if (typeof req.comments === 'number') return req.comments;
    return 0;
  }

  // ────────────────────────────────────────────────────────────
  // 2. SVG icons
  // ────────────────────────────────────────────────────────────

  const ICONS = {
    clock: '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>',
    chat:  '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.4 7.3L4 21l1.7-5.6A8 8 0 1 1 21 12z" stroke-linejoin="round"/></svg>',
    chev:  '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus:  '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
    x:     '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg>',
    save:  '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    dot:   '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
    commit:'<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M2 12h6M16 12h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ────────────────────────────────────────────────────────────
  // 3. Stat strip + status rail
  // ────────────────────────────────────────────────────────────

  function renderStats() {
    const total     = state.all.length;
    const active    = state.all.filter((r) => r.status === 'pending' || r.status === 'in-progress').length;
    const completed = state.all.filter((r) => r.status === 'completed').length;
    const cancelled = state.all.filter((r) => r.status === 'cancelled').length;

    dom.statTotal.textContent     = total;
    dom.statActive.textContent    = active;
    dom.statCompleted.textContent = completed;
    dom.statCancelled.textContent = cancelled;

    renderSparklines();
  }

  /**
   * Build a 7-day rolling-creation count series per status bucket.
   * Returns array of integers for the last 7 days (oldest → newest).
   */
  function sparkSeries(filterFn) {
    const days = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = new Array(days).fill(0);

    state.all.forEach((r) => {
      if (!filterFn(r)) return;
      const ts = new Date(r.timestamp || r.createdAt || Date.now());
      ts.setHours(0, 0, 0, 0);
      const diff = Math.floor((today - ts) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
    });
    return buckets;
  }

  function sparkSvg(values) {
    if (!values || values.length === 0) return '';
    const max = Math.max(...values, 1);
    const w = 88, h = 36, step = w / (values.length - 1 || 1);
    const points = values.map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 4) - 2;
      return [x, y];
    });

    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;
    const id = `g${Math.random().toString(36).slice(2, 8)}`;

    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stop-color="currentColor" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#${id})"/>
        <path d="${line}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function renderSparklines() {
    const series = {
      total:     sparkSeries(() => true),
      active:    sparkSeries((r) => r.status === 'pending' || r.status === 'in-progress'),
      completed: sparkSeries((r) => r.status === 'completed'),
      cancelled: sparkSeries((r) => r.status === 'cancelled')
    };
    Object.entries(series).forEach(([k, vals]) => {
      const host = document.querySelector(`[data-spark="${k}"]`);
      if (host) host.innerHTML = sparkSvg(vals);
    });
  }

  function renderStatusRail() {
    const counts = STATUS_KEYS.reduce((acc, s) => {
      acc[s] = state.all.filter((r) => r.status === s).length;
      return acc;
    }, {});
    const total = state.all.length;

    // Bar segments
    STATUS_KEYS.forEach((s) => {
      const seg = document.querySelector(`.rl-status-bar__seg[data-seg="${s}"]`);
      if (seg) seg.style.width = total ? `${(counts[s] / total) * 100}%` : '0%';
    });

    // Chip counts + active state
    dom.statusChips.querySelectorAll('[data-status]').forEach((chip) => {
      const key = chip.dataset.status;
      chip.classList.toggle('is-active', state.status === key);
      chip.setAttribute('aria-selected', state.status === key ? 'true' : 'false');
    });
    STATUS_KEYS.forEach((s) => {
      const node = document.querySelector(`[data-count="${s}"]`);
      if (node) node.textContent = counts[s];
    });
    const allCount = document.querySelector('[data-count="all"]');
    if (allCount) allCount.textContent = total;
  }

  // ────────────────────────────────────────────────────────────
  // 4. Rows view + pagination
  // ────────────────────────────────────────────────────────────

  function renderRowsHead() {
    dom.rowsShownCount.textContent = state.filtered.length;
    dom.rowsTotalCount.textContent = state.all.length;
  }

  function renderRows() {
    renderRowsHead();
    const container = dom.rowsContainer;

    if (state.filtered.length === 0) {
      detachRowsObserver();
      container.innerHTML = `
        <div class="rl-empty">
          <div class="rl-empty__icon">${state.all.length === 0 ? '📋' : '🔍'}</div>
          <h3>${state.all.length === 0 ? 'No requests yet' : 'No matching requests'}</h3>
          <p>${state.all.length === 0
            ? 'Click “New request” to create the first one.'
            : 'Try changing your filters or search term.'}</p>
        </div>
      `;
      renderInfiniteFooter();
      return;
    }

    const visible = Math.min(state.visibleCount, state.filtered.length);
    const slice   = state.filtered.slice(0, visible);

    container.innerHTML = slice.map(rowMarkup).join('');
    renderInfiniteFooter();
    attachRowsObserver();
  }

  function renderInfiniteFooter() {
    const total   = state.filtered.length;
    const visible = Math.min(state.visibleCount, total);
    const hasMore = visible < total;

    dom.infiniteFooter.innerHTML = total === 0
      ? ''
      : hasMore
        ? `
          <div class="rl-infinite__sentinel" id="rowsSentinel" aria-hidden="true">
            <div class="rl-loader rl-loader--sm"></div>
            <span>Loading more… (${visible.toLocaleString()} of ${total.toLocaleString()})</span>
          </div>
        `
        : `
          <div class="rl-infinite__end">
            All ${total.toLocaleString()} requests loaded
          </div>
        `;
  }

  function attachRowsObserver() {
    detachRowsObserver();
    const sentinel = document.getElementById('rowsSentinel');
    if (!sentinel) return;

    state.rowsObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (state.visibleCount >= state.filtered.length) return;
        state.visibleCount = Math.min(state.visibleCount + CHUNK_SIZE, state.filtered.length);
        renderRows();
        return;
      }
    }, { rootMargin: '300px 0px' });

    state.rowsObserver.observe(sentinel);
  }

  function detachRowsObserver() {
    if (state.rowsObserver) {
      state.rowsObserver.disconnect();
      state.rowsObserver = null;
    }
  }

  function rowMarkup(req) {
    const sCls = statusClass(req.status);
    const pCls = priorityClass(req.priority);
    const bars = priorityBars(req.priority);
    const typeLabel = typeInfo(req.type).label;
    const status = statusInfo(req.status).label;
    const progress = safeProgress(req);
    const comments = commentsCount(req);

    const priorityBarsHtml = [1, 2, 3, 4].map((i) => {
      const isOn = i <= bars;
      const height = 6 + i * 2;
      return `<span class="rl-row__prio-bar ${isOn ? 'is-on ' + pCls : ''}" style="height:${height}px"></span>`;
    }).join('');

    return `
      <button class="rl-row" data-firebase-id="${escapeHtml(req.firebaseId)}" type="button">
        <span class="rl-row__lead">
          <span class="rl-row__dot ${sCls}"></span>
          <span class="rl-row__id">${escapeHtml(shortId(req))}</span>
        </span>

        <span class="rl-row__main">
          <span class="rl-row__title">${escapeHtml(req.title)}</span>
          <span class="rl-row__meta">
            <span class="rl-row__meta-item">${escapeHtml(typeLabel)}</span>
            <span class="rl-row__meta-item">${ICONS.clock}${escapeHtml(formatDate(req.timestamp))}</span>
            ${comments > 0 ? `<span class="rl-row__meta-item">${ICONS.chat}${comments}</span>` : ''}
          </span>
        </span>

        <span class="rl-row__prio-cell" title="Priority: ${escapeHtml(priorityInfo(req.priority).label)}">
          <span class="rl-row__prio">${priorityBarsHtml}</span>
          <span class="rl-row__prio-label ${pCls}">${escapeHtml(priorityInfo(req.priority).label)}</span>
        </span>

        <span class="rl-row__progress">
          <span class="rl-row__progress-track">
            <span class="rl-row__progress-fill ${sCls}" style="width:${progress}%"></span>
          </span>
          <span class="rl-row__progress-num">${progress}%</span>
        </span>

        <span class="rl-row__assignee">
          ${assigneeMarkup(req.assignee)}
        </span>

        <span class="rl-row__status">
          <span class="rl-row__status-text ${sCls}">${escapeHtml(status)}</span>
          <span class="rl-row__chev">${ICONS.chev}</span>
        </span>
      </button>
    `;
  }

  function shouldMaskMemberInfo() {
    return window.AuthService && !AuthService.isSolutionTeam();
  }

  const MASKED_ASSIGNEE_NAME = 'Solution Team';
  const MASKED_ASSIGNEE_INITIALS = 'ST';

  /**
   * Check if normal user can edit a given request.
   * Normal users can only edit when status is 'pending'.
   */
  function canNormalUserEdit(req) {
    return req && req.status === 'pending';
  }

  /**
   * Get list of fields normal users can edit.
   */
  function normalUserEditableFields() {
    return ['title', 'description', 'requestType', 'priority'];
  }

  /**
   * Check if user can perform full edit (solution team member).
   */
  function canFullEdit() {
    return window.AuthService && AuthService.isSolutionTeam();
  }

  function assigneeMarkup(name) {
    const isEmpty = !name || name === 'Unassigned';
    if (isEmpty) {
      return `<span class="rl-avatar is-empty">?</span><span class="rl-row__assignee-name is-empty">Unassigned</span>`;
    }
    // Mask for normal users
    if (shouldMaskMemberInfo()) {
      return `<span class="rl-avatar is-masked">${MASKED_ASSIGNEE_INITIALS}</span><span class="rl-row__assignee-name">${MASKED_ASSIGNEE_NAME}</span>`;
    }
    return `<span class="rl-avatar">${escapeHtml(initials(name))}</span><span class="rl-row__assignee-name">${escapeHtml(name)}</span>`;
  }

  // ────────────────────────────────────────────────────────────
  // 5. Board view
  // ────────────────────────────────────────────────────────────

  function renderBoard() {
    const container = dom.boardContainer;
    const columns = STATUS_KEYS.map((status) => {
      const items = state.filtered.filter((r) => r.status === status);
      const sCls = statusClass(status);
      const label = statusInfo(status).label;
      return `
        <section class="rl-col" data-col="${status}">
          <header class="rl-col__head">
            <div class="rl-col__title">
              <span class="rl-dot ${sCls}"></span>
              <span>${escapeHtml(label)}</span>
              <span class="rl-col__count">${items.length}</span>
            </div>
          </header>
          <div class="rl-col__body" data-drop="${status}">
            ${items.length === 0
              ? `<div class="rl-col__empty">No requests</div>`
              : items.map(cardMarkup).join('')}
          </div>
        </section>
      `;
    }).join('');

    container.innerHTML = columns;
    bindBoardDragDrop();
  }

  function cardMarkup(req) {
    const sCls = statusClass(req.status);
    const pCls = priorityClass(req.priority);
    const bars = priorityBars(req.priority);
    const typeLabel = typeInfo(req.type).label;
    const progress = safeProgress(req);
    const comments = commentsCount(req);

    const priorityBarsHtml = [1, 2, 3, 4].map((i) => {
      const isOn = i <= bars;
      const height = 5 + i * 1.5;
      return `<span class="rl-row__prio-bar ${isOn ? 'is-on ' + pCls : ''}" style="height:${height}px"></span>`;
    }).join('');

    return `
      <button class="rl-card" draggable="true"
              data-firebase-id="${escapeHtml(req.firebaseId)}"
              data-status="${escapeHtml(req.status)}"
              type="button">
        <div class="rl-card__head">
          <span>${escapeHtml(shortId(req))}</span>
          <span>${escapeHtml(typeLabel)}</span>
        </div>
        <div class="rl-card__title">${escapeHtml(req.title)}</div>
        <div class="rl-card__progress">
          <div class="rl-card__progress-fill ${sCls}" style="width:${progress}%"></div>
        </div>
        <div class="rl-card__foot">
          <div class="rl-card__foot-left">
            <span class="rl-row__prio" title="Priority: ${escapeHtml(priorityInfo(req.priority).label)}">${priorityBarsHtml}</span>
            ${comments > 0 ? `<span class="rl-row__meta-item">${ICONS.chat}${comments}</span>` : ''}
          </div>
          ${req.assignee && req.assignee !== 'Unassigned'
            ? shouldMaskMemberInfo()
              ? `<span class="rl-avatar is-masked" title="${MASKED_ASSIGNEE_NAME}">${MASKED_ASSIGNEE_INITIALS}</span>`
              : `<span class="rl-avatar" title="${escapeHtml(req.assignee)}">${escapeHtml(initials(req.assignee))}</span>`
            : `<span class="rl-avatar is-empty">?</span>`}
        </div>
      </button>
    `;
  }

  let dragPayload = null;

  function bindBoardDragDrop() {
    const cards = dom.boardContainer.querySelectorAll('.rl-card');
    cards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragPayload = {
          firebaseId: card.dataset.firebaseId,
          from:       card.dataset.status
        };
        card.classList.add('is-dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragPayload.firebaseId); } catch (_) {}
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        dragPayload = null;
        dom.boardContainer.querySelectorAll('.rl-col.is-drop-active').forEach((c) => c.classList.remove('is-drop-active'));
      });
      card.addEventListener('click', (e) => {
        if (card.classList.contains('is-dragging')) return;
        e.preventDefault();
        openRequestDetail(card.dataset.firebaseId);
      });
    });

    const columns = dom.boardContainer.querySelectorAll('.rl-col');
    columns.forEach((col) => {
      const targetStatus = col.dataset.col;
      const body = col.querySelector('.rl-col__body');

      col.addEventListener('dragover', (e) => {
        if (!dragPayload || dragPayload.from === targetStatus) return;
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
        col.classList.add('is-drop-active');
      });
      col.addEventListener('dragleave', (e) => {
        if (col.contains(e.relatedTarget)) return;
        col.classList.remove('is-drop-active');
      });
      col.addEventListener('drop', async (e) => {
        if (!dragPayload || dragPayload.from === targetStatus) return;
        e.preventDefault();
        col.classList.remove('is-drop-active');
        try {
          const reqData = await FirebaseAPI.getRequest(dragPayload.firebaseId);
          await FirebaseAPI.updateRequest(dragPayload.firebaseId, {
            status: targetStatus,
            updatedAt: new Date().toISOString()
          });

          // Auto-create allocation when dragging to in-progress
          if (canFullEdit() && targetStatus === 'in-progress' && dragPayload.from !== 'in-progress') {
            await tryCreateAllocationForRequest(reqData, reqData.assignee, reqData.deadline, reqData.estimatedTime);
          }

          showNotification('success', `Moved to ${statusInfo(targetStatus).label}`);
        } catch (err) {
          showNotification('error', `Move failed: ${err.message}`);
        }
      });
      body.addEventListener('dragover', (e) => {
        if (!dragPayload || dragPayload.from === targetStatus) return;
        e.preventDefault();
      });
    });
  }

  // ────────────────────────────────────────────────────────────
  // 6. Filtering
  // ────────────────────────────────────────────────────────────

  function applyFilters() {
    state.query    = dom.searchInput.value.toLowerCase().trim();
    state.type     = dom.filterType.value;
    state.priority = dom.filterPriority.value;
    // status comes from the rail (state.status); legacy <select> kept hidden

    state.filtered = state.all.filter((req) => {
      if (state.status   !== 'all' && req.status   !== state.status)   return false;
      if (state.type     !== 'all' && req.type     !== state.type)     return false;
      if (state.priority !== 'all' && req.priority !== state.priority) return false;
      if (state.query) {
        const hay = `${req.title || ''} ${req.requester || ''} ${shortId(req)}`.toLowerCase();
        if (!hay.includes(state.query)) return false;
      }
      return true;
    });

    state.visibleCount = CHUNK_SIZE;
    renderActiveChips();
    renderViews();
    renderStatusRail();
  }

  function renderActiveChips() {
    const chips = [];
    if (state.type !== 'all')     chips.push({ key: 'type',     value: typeInfo(state.type).label });
    if (state.priority !== 'all') chips.push({ key: 'priority', value: priorityInfo(state.priority).label });

    if (chips.length === 0) {
      dom.activeFilterChips.hidden = true;
      dom.activeFilterChips.innerHTML = '';
      return;
    }
    dom.activeFilterChips.hidden = false;
    dom.activeFilterChips.innerHTML = `
      <span class="rl-active-chips__label">Active</span>
      ${chips.map((c) => `
        <button class="rl-active-chip" data-clear="${c.key}" type="button">
          <span class="rl-active-chip__key">${escapeHtml(c.key)}:</span>
          <span>${escapeHtml(c.value)}</span>
          <span class="rl-active-chip__close">${ICONS.x}</span>
        </button>
      `).join('')}
    `;
  }

  function renderViews() {
    if (state.view === 'rows') {
      dom.rowsSection.hidden  = false;
      dom.boardSection.hidden = true;
      renderRows();
    } else {
      dom.rowsSection.hidden  = true;
      dom.boardSection.hidden = false;
      renderBoard();
    }
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('.rl-view-btn').forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    renderViews();
  }

  function setStatusFilter(status) {
    state.status = status;
    applyFilters();
  }

  // ────────────────────────────────────────────────────────────
  // 7. New-request form
  // ────────────────────────────────────────────────────────────

  function collectFormData() {
    const get = (id) => document.getElementById(id).value.trim();
    const now = new Date().toISOString();

    return {
      id:               nextRequestId(),
      timestamp:        now,
      requester:        get('requester'),
      requesterEmail:   get('requesterEmail'),
      type:             document.getElementById('requestType').value,
      priority:         document.getElementById('priority').value,
      title:            get('title'),
      description:      get('description'),
      deadline:         document.getElementById('deadline').value || null,
      project:          get('project') || null,
      status:           'pending',
      assignee:         'Unassigned',
      createdAt:        now,
      updatedAt:        now,
      comments:         [],
      outcomeAndFeedback: null,
      lessonsLearned:     null,
      estimatedTime:      null,
      loggedEffort:       null,
      history:            []
    };
  }

  function validateRequest(data) {
    if (!data.requester      || data.requester.length      > VALIDATION.requester.max)   return 'Invalid requester';
    if (!data.requesterEmail || !isValidEmail(data.requesterEmail))                       return 'Invalid email';
    if (!data.type     || !(data.type     in TYPE))     return 'Invalid type';
    if (!data.priority || !(data.priority in PRIORITY)) return 'Invalid priority';
    if (!data.title       || data.title.length       > VALIDATION.title.max)       return 'Invalid title';
    if (!data.description || data.description.length > VALIDATION.description.max) return 'Invalid description';
    return null;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('.submit-btn');
    const btnText   = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    submitBtn.disabled       = true;
    btnText.style.display    = 'none';
    btnLoader.style.display  = 'inline';

    try {
      const data  = collectFormData();
      const error = validateRequest(data);
      if (error) throw new Error(error);

      await FirebaseAPI.createRequest(data);

      showNotification('success', 'Request created!');
      e.target.reset();
      document.querySelector('.char-count').textContent = `0/${VALIDATION.description.max}`;
      closeNewRequestModal();
    } catch (err) {
      console.error('Error submitting request:', err);
      showNotification('error', `Error: ${err.message}`);
    } finally {
      submitBtn.disabled      = false;
      btnText.style.display   = 'inline';
      btnLoader.style.display = 'none';
    }
  }

  function openNewRequestModal() {
    dom.newRequestModal.style.display = 'flex';
    setTimeout(() => document.getElementById('requester').focus(), 100);
  }

  function closeNewRequestModal() {
    dom.newRequestModal.style.display = 'none';
    dom.requestForm.reset();
    document.querySelector('.char-count').textContent = `0/${VALIDATION.description.max}`;
  }

  // ────────────────────────────────────────────────────────────
  // 8. Detail modal
  // ────────────────────────────────────────────────────────────

  let activeRequestId = null;

  function openRequestDetail(firebaseId) {
    activeRequestId = firebaseId;
    dom.modalBody.innerHTML = `
      <div class="rl-loading">
        <div class="rl-loader"></div>
        <p>Loading…</p>
      </div>
    `;
    dom.requestModal.style.display = 'flex';

    FirebaseAPI.getRequest(firebaseId)
      .then((data) => {
        if (!data) throw new Error('Request not found');
        dom.modalBody.innerHTML = renderRequestDetail(data);
      })
      .catch((err) => {
        console.error('Error loading request details:', err);
        dom.modalBody.innerHTML = `
          <div class="rl-empty">
            <div class="rl-empty__icon">⚠️</div>
            <h3>Failed to load</h3>
            <p>${escapeHtml(err.message)}</p>
          </div>
        `;
      });
  }

  function renderRequestDetail(data) {
    const sCls = statusClass(data.status);
    const pCls = priorityClass(data.priority);
    const bars = priorityBars(data.priority);
    const type = typeInfo(data.type);
    const status = statusInfo(data.status);
    const priority = priorityInfo(data.priority);
    const progress = safeProgress(data);
    const comments = commentsCount(data);

    const priorityBarsHtml = [1, 2, 3, 4].map((i) => {
      const isOn = i <= bars;
      const height = 6 + i * 2;
      return `<span class="rl-row__prio-bar ${isOn ? 'is-on ' + pCls : ''}" style="height:${height}px"></span>`;
    }).join('');

    const history = Array.isArray(data.history) ? data.history.slice().reverse() : [];
    const activityItems = buildActivity(data, history);

    return `
      <div class="rl-detail">
        <!-- MAIN -->
        <div class="rl-detail__main">
          <div class="rl-detail__topbar">
            <span class="rl-detail__id">${escapeHtml(shortId(data))}</span>
            <span class="rl-divider">·</span>
            <span>${escapeHtml(type.label)}</span>
            <span class="rl-divider">·</span>
            <span class="rl-row__status">
              <span class="rl-dot ${sCls}"></span>
              <span class="rl-row__status-text ${sCls}">${escapeHtml(status.label)}</span>
            </span>
          </div>

          <div class="rl-detail__scroll">
            <h2 class="rl-detail__title">${escapeHtml(data.title)}</h2>

            <div class="rl-detail__meta">
              <span class="rl-detail__meta-item">
                <span class="rl-avatar" style="width:20px;height:20px;font-size:10px;">${escapeHtml(initials(data.requester))}</span>
                ${escapeHtml(data.requester)}
              </span>
              <span class="rl-divider">·</span>
              <span class="rl-detail__meta-item">${ICONS.clock}Opened ${escapeHtml(formatDate(data.createdAt))}</span>
              <span class="rl-divider">·</span>
              <span class="rl-detail__meta-item">${ICONS.chat}${comments} comment${comments === 1 ? '' : 's'}</span>
            </div>

            <div class="rl-detail__progress-card">
              <div class="rl-detail__progress-col">
                <div class="rl-detail__progress-head">
                  <span class="label">Progress</span>
                  <span class="value">${progress}%</span>
                </div>
                <div class="rl-detail__progress-track">
                  <div class="rl-detail__progress-fill ${sCls}" style="background:${cssVarColorForStatus(data.status)};width:${progress}%"></div>
                </div>
              </div>
              <div class="rl-detail__divider-v"></div>
              <div class="rl-detail__priority-col">
                <span class="label">Priority</span>
                <div class="rl-detail__priority-val">
                  <span class="rl-row__prio">${priorityBarsHtml}</span>
                  <span class="rl-row__status-text" style="color:${cssVarColorForPriority(data.priority)}">${escapeHtml(priority.label)}</span>
                </div>
              </div>
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Description</div>
              ${canFullEdit() || (canNormalUserEdit(data))
                ? `<textarea id="descriptionEdit" class="modal-input" rows="4">${escapeHtml(data.description || '')}</textarea>`
                : `<div class="rl-section__body"><p>${escapeHtml(data.description)}</p></div>`
              }
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Outcome &amp; feedback</div>
              <textarea id="outcomeAndFeedback" class="modal-input" placeholder="Describe outcome and feedback from PM/customer…">${escapeHtml(data.outcomeAndFeedback || '')}</textarea>
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Lessons learned</div>
              <textarea id="lessonsLearned" class="modal-input" placeholder="Key takeaways…">${escapeHtml(data.lessonsLearned || '')}</textarea>
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Activity</div>
              <div class="rl-activity">
                ${activityItems.map((a, i, arr) => `
                  <div class="rl-activity__item">
                    <div class="rl-activity__rail">
                      <div class="rl-activity__icon" style="color:${a.color || 'inherit'}">${a.icon}</div>
                      ${i < arr.length - 1 ? '<div class="rl-activity__line"></div>' : ''}
                    </div>
                    <div class="rl-activity__body">
                      <div class="rl-activity__line-text">
                        <strong>${escapeHtml(a.actor)}</strong>
                        <em>${escapeHtml(a.text)}</em>
                        ${a.badge ? `<span class="rl-tag">${escapeHtml(a.badge)}</span>` : ''}
                      </div>
                      <div class="rl-activity__meta">${escapeHtml(a.meta)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- SIDEBAR -->
        <aside class="rl-detail__sidebar">
          <div class="rl-detail__sidebar-inner">
            ${canFullEdit() ? `
            <div class="rl-field">
              <label>Status</label>
              <select id="statusSelect">
                ${Object.entries(STATUS).map(([key, info]) => `
                  <option value="${key}" ${key === data.status ? 'selected' : ''}>${info.icon} ${escapeHtml(info.label)}</option>
                `).join('')}
              </select>
            </div>
            ` : `
            <div class="rl-field">
              <label>Status</label>
              <div style="padding:8px 10px;border:1px solid var(--rl-border);border-radius:var(--rl-radius-sm);background:var(--rl-card);font-size:13px;">
                <span class="rl-dot ${sCls}"></span>
                <span style="margin-left:6px;">${escapeHtml(status.label)}</span>
              </div>
            </div>
            `}

            <div class="rl-field">
              <label>Priority</label>
              <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--rl-border);border-radius:var(--rl-radius-sm);background:var(--rl-card);">
                <span class="rl-row__prio">${priorityBarsHtml}</span>
                <span style="font-size:13px;color:${cssVarColorForPriority(data.priority)}">${escapeHtml(priority.label)}</span>
              </div>
            </div>

            <div class="rl-field">
              <label>Requester</label>
              <div class="rl-field__user">
                <span class="rl-avatar">${escapeHtml(initials(data.requester))}</span>
                <div class="rl-field__user-info">
                  <span class="rl-field__user-name">${escapeHtml(data.requester)}</span>
                  <span class="rl-field__user-email">${escapeHtml(data.requesterEmail || '')}</span>
                </div>
              </div>
            </div>

            <div class="rl-field" id="assigneeField">
              <label>Assignee</label>
              ${shouldMaskMemberInfo()
                ? `<div class="rl-field__user">
                     <span class="rl-avatar is-masked">${MASKED_ASSIGNEE_INITIALS}</span>
                     <span style="font-size:13px;">${MASKED_ASSIGNEE_NAME}</span>
                   </div>`
                : `<select id="assigneeSelect">
                     ${TEAM_MEMBERS.map((m) => `
                       <option value="${escapeHtml(m)}" ${m === data.assignee ? 'selected' : ''}>${escapeHtml(m)}</option>
                     `).join('')}
                   </select>`
              }
            </div>

            <div class="rl-sidebar-divider"></div>

            <div class="rl-field">
              <label>Timeline</label>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-variant-numeric:tabular-nums;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--rl-muted);font-size:11px;">Created</span>
                  <span>${escapeHtml(formatDateTime(data.createdAt))}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:var(--rl-muted);font-size:11px;">Updated</span>
                  <span>${escapeHtml(formatDateTime(data.updatedAt))}</span>
                </div>
              </div>
            </div>

            ${canFullEdit() ? `
            <div class="rl-field">
              <label>Due date</label>
              <input type="date" id="deadlineInput" value="${escapeHtml(data.deadline || '')}">
            </div>

            <div class="rl-field">
              <label>Time tracking</label>
              <div class="rl-time-grid">
                <div class="rl-time-cell">
                  <label>Estimate (h)</label>
                  <input type="number" id="estimatedTime" min="0" step="0.5" value="${escapeHtml(data.estimatedTime || '')}" placeholder="0">
                </div>
                <div class="rl-time-cell">
                  <label>Logged (h)</label>
                  <input type="number" id="loggedEffort"  min="0" step="0.5" value="${escapeHtml(data.loggedEffort  || '')}" placeholder="0">
                </div>
            ` : `
            <div class="rl-field">
              <label>Due date</label>
              <div style="padding:8px 10px;border:1px solid var(--rl-border);border-radius:var(--rl-radius-sm);background:var(--rl-card);font-size:13px;">
                ${data.deadline ? escapeHtml(formatDate(data.deadline)) : '<span style="color:var(--rl-muted);">Not set</span>'}
              </div>
            </div>
            <input type="hidden" id="deadlineInput" value="${escapeHtml(data.deadline || '')}">
            <input type="hidden" id="estimatedTime" value="${escapeHtml(data.estimatedTime || '')}">
            <input type="hidden" id="loggedEffort"  value="${escapeHtml(data.loggedEffort  || '')}">
            <div class="rl-field">
              <label>Time tracking</label>
              <div class="rl-time-grid">
                <div class="rl-time-cell">
                  <label>Estimate</label>
                  <div style="font-size:13px;">${data.estimatedTime ? data.estimatedTime + 'h' : '—'}</div>
                </div>
                <div class="rl-time-cell">
                  <label>Logged</label>
                  <div style="font-size:13px;">${data.loggedEffort ? data.loggedEffort + 'h' : '—'}</div>
                </div>
            `}
              </div>
            </div>
          </div>

          <div class="rl-detail__actions">
            ${(canFullEdit() || canNormalUserEdit(data))
              ? `<button class="rl-btn rl-btn--primary rl-btn--block" data-action="save-request" type="button">Save changes</button>`
              : ''
            }
            ${canFullEdit()
              ? `<button class="rl-btn--danger" data-action="delete-request" type="button">${ICONS.trash}Delete request</button>`
              : ''
            }
          </div>
        </aside>
      </div>
    `;
  }

  function cssVarColorForStatus(status) {
    return ({
      'pending':     'var(--rl-pending)',
      'in-progress': 'var(--rl-progress)',
      'completed':   'var(--rl-completed)',
      'cancelled':   'var(--rl-cancelled)'
    })[status] || 'var(--rl-muted)';
  }
  function cssVarColorForPriority(p) {
    return ({
      'low':      'var(--rl-prio-low)',
      'medium':   'var(--rl-prio-medium)',
      'high':     'var(--rl-prio-high)',
      'critical': 'var(--rl-prio-critical)'
    })[p] || 'var(--rl-muted)';
  }

  function buildActivity(data, history) {
    const items = [{
      icon: ICONS.dot,
      actor: data.requester || 'Unknown',
      text: 'opened this request',
      badge: '',
      meta: formatDateTime(data.createdAt),
      color: 'var(--rl-muted)'
    }];

    history.forEach((h) => {
      const changes = Array.isArray(h.changes) ? h.changes : [];
      changes.forEach((c) => {
        items.push({
          icon: ICONS.commit,
          actor: h.actor || 'System',
          text: `updated ${c.field.toLowerCase()}`,
          badge: c.newValue,
          meta: formatDateTime(h.timestamp),
          color: 'var(--rl-muted)'
        });
      });
    });

    if (data.status === 'completed') {
      items.push({
        icon: ICONS.check,
        actor: data.assignee || '—',
        text: 'marked as completed',
        badge: '',
        meta: formatDateTime(data.updatedAt),
        color: 'var(--rl-completed)'
      });
    }
    return items;
  }

  function diffField(label, oldValue, newValue, formatter = (v) => v) {
    const a = oldValue == null ? '' : String(oldValue);
    const b = newValue == null ? '' : String(newValue);
    if (a === b) return null;
    return {
      field:    label,
      oldValue: a ? formatter(a) : 'Not set',
      newValue: b ? formatter(b) : 'Not set'
    };
  }

  /**
   * Auto-create an allocation when starting a request (status → in-progress).
   * - Start = today
   * - End = deadline (due date)
   * - Percent = estimatedTime / (days * 8) * 100  (8h/day = 100%)
   * - ProjectKey = request ID
   * - ProjectName = request title
   */
  async function tryCreateAllocationForRequest(reqData, assignee, deadline, estimatedTime) {
    if (!window.AllocationData || !window.FirebaseAPI) return;

    const MEMBERS = AllocationData.MEMBERS;
    if (!MEMBERS || !MEMBERS.length) return;

    // Find memberId from assignee name
    const member = MEMBERS.find((m) => m.name === assignee);
    if (!member) {
      console.warn('[requests-app] Could not find member for assignee:', assignee);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const endDate = deadline || today;

    // Calculate percent: estimatedTime / (days * 8) * 100
    const startDt = new Date(today);
    const endDt   = new Date(endDate);
    const days    = Math.max(1, Math.ceil((endDt - startDt) / (1000 * 60 * 60 * 24)) + 1);
    const hours   = parseFloat(estimatedTime) || 8;
    const percent = Math.min(100, Math.round((hours / (days * 8)) * 100));

    const allocation = {
      memberId:    member.id,
      kind:        'solution',
      projectKey:  shortId(reqData),
      projectName: `Request: ${reqData.title || shortId(reqData)}`,
      percent:     percent,
      start:       today,
      end:         endDate
    };

    try {
      await FirebaseAPI.createAllocation(allocation);
      console.log('[requests-app] Auto-created allocation for request:', shortId(reqData));
    } catch (err) {
      console.error('[requests-app] Failed to auto-create allocation:', err);
    }
  }

  async function saveRequest() {
    if (!activeRequestId) return;

    try {
      const oldData = await FirebaseAPI.getRequest(activeRequestId);
      const isSolutionTeamMember = canFullEdit();
      const isNormalUserEditAllowed = !isSolutionTeamMember && canNormalUserEdit(oldData);

      // Normal user can only edit when status is pending
      if (!isSolutionTeamMember && !isNormalUserEditAllowed) {
        showNotification('error', 'Bạn không có quyền chỉnh sửa request này');
        return;
      }

      // Get field values based on permissions
      const descriptionEl = document.getElementById('descriptionEdit');
      const newDescription = descriptionEl ? descriptionEl.value.trim() : oldData.description;

      let newStatus, newAssignee, newDeadline, newEstimatedTime, newLoggedEffort, newOutcome, newLessons;

      if (isSolutionTeamMember) {
        newStatus        = document.getElementById('statusSelect').value;
        const assigneeEl = document.getElementById('assigneeSelect');
        newAssignee      = assigneeEl ? assigneeEl.value : oldData.assignee;
        newDeadline      = document.getElementById('deadlineInput').value;
        newEstimatedTime = document.getElementById('estimatedTime').value;
        newLoggedEffort  = document.getElementById('loggedEffort').value;
        newOutcome       = document.getElementById('outcomeAndFeedback').value.trim();
        newLessons       = document.getElementById('lessonsLearned').value.trim();
      } else {
        // Normal users can only edit description (and title/type/priority but we don't have UI for those yet)
        newStatus        = oldData.status;
        newAssignee      = oldData.assignee;
        newDeadline      = oldData.deadline;
        newEstimatedTime = oldData.estimatedTime;
        newLoggedEffort  = oldData.loggedEffort;
        newOutcome       = oldData.outcomeAndFeedback;
        newLessons       = oldData.lessonsLearned;
      }

      if (isSolutionTeamMember) {
        if (newStatus === 'in-progress') {
          if (!newDeadline)      { showNotification('error', 'Please set a due date before moving to In Progress'); return; }
          if (!newEstimatedTime) { showNotification('error', 'Please set the estimated time before moving to In Progress'); return; }
        }

        if (newStatus === 'completed' && !newLoggedEffort) {
          showNotification('error', 'Please log the time spent before marking as completed');
          return;
        }
      }

      const hours = (v) => `${v}h`;
      const candidates = [
        diffField('Description',        oldData.description,        newDescription,   () => 'Updated'),
        diffField('Status',             oldData.status,             newStatus,        (k) => statusInfo(k).label),
        diffField('Assignee',           oldData.assignee || 'Unassigned', newAssignee || 'Unassigned'),
        diffField('Deadline',           oldData.deadline,           newDeadline),
        diffField('Estimated Time',     oldData.estimatedTime,      newEstimatedTime, hours),
        diffField('Time Spent',         oldData.loggedEffort,       newLoggedEffort,  hours),
        diffField('Outcome & Feedback', oldData.outcomeAndFeedback, newOutcome,       () => 'Updated'),
        diffField('Lessons Learned',    oldData.lessonsLearned,     newLessons,       () => 'Updated')
      ];
      const changes = candidates.filter(Boolean);

      const updates = {
        description:        newDescription,
        status:             newStatus,
        assignee:           newAssignee,
        deadline:           newDeadline      || null,
        estimatedTime:      newEstimatedTime || null,
        loggedEffort:       newLoggedEffort  || null,
        outcomeAndFeedback: newOutcome       || null,
        lessonsLearned:     newLessons       || null,
        updatedAt:          new Date().toISOString()
      };

      const userName = window.AuthService && AuthService.getProfile()
        ? AuthService.getProfile().displayName || AuthService.getUser()?.email
        : 'Unknown';

      if (changes.length > 0) {
        updates.history = [
          ...(oldData.history || []),
          { timestamp: updates.updatedAt, actor: userName, changes }
        ];
      }

      await FirebaseAPI.updateRequest(activeRequestId, updates);

      // Auto-create allocation when starting a request (status → in-progress)
      if (isSolutionTeamMember && newStatus === 'in-progress' && oldData.status !== 'in-progress') {
        await tryCreateAllocationForRequest(oldData, newAssignee, newDeadline, newEstimatedTime);
      }

      showNotification('success', 'Request updated');
      closeRequestModal();
    } catch (err) {
      console.error('Error updating request:', err);
      showNotification('error', `Error: ${err.message}`);
    }
  }

  async function deleteRequest() {
    if (!activeRequestId) return;
    if (!confirm('Delete this request? This action cannot be undone.')) return;

    try {
      await FirebaseAPI.deleteRequest(activeRequestId);
      showNotification('success', 'Request deleted');
      closeRequestModal();
    } catch (err) {
      console.error('Error deleting request:', err);
      showNotification('error', `Error: ${err.message}`);
    }
  }

  function closeRequestModal() {
    dom.requestModal.style.display = 'none';
    activeRequestId = null;
  }

  // ────────────────────────────────────────────────────────────
  // 9. Event wiring
  // ────────────────────────────────────────────────────────────

  function cacheDom() {
    dom.searchInput       = document.getElementById('searchInput');
    dom.filterStatus      = document.getElementById('filterStatus');
    dom.filterType        = document.getElementById('filterType');
    dom.filterPriority    = document.getElementById('filterPriority');
    dom.btnToggleFilters  = document.getElementById('btnToggleFilters');
    dom.filterPanel       = document.getElementById('filterPanel');
    dom.statusChips       = document.getElementById('statusChips');
    dom.activeFilterChips = document.getElementById('activeFilterChips');

    dom.rowsSection       = document.getElementById('rowsSection');
    dom.rowsContainer     = document.getElementById('rowsContainer');
    dom.rowsShownCount    = document.getElementById('rowsShownCount');
    dom.rowsTotalCount    = document.getElementById('rowsTotalCount');

    dom.boardSection      = document.getElementById('boardSection');
    dom.boardContainer    = document.getElementById('boardContainer');

    dom.infiniteFooter    = document.getElementById('infiniteFooter');

    dom.statTotal         = document.getElementById('statTotal');
    dom.statActive        = document.getElementById('statActive');
    dom.statCompleted     = document.getElementById('statCompleted');
    dom.statCancelled     = document.getElementById('statCancelled');

    dom.requestModal      = document.getElementById('requestModal');
    dom.modalBody         = document.getElementById('modalBody');
    dom.modalClose        = document.getElementById('modalClose');
    dom.newRequestModal   = document.getElementById('newRequestModal');
    dom.requestForm       = document.getElementById('requestForm');
    dom.btnNewRequest     = document.getElementById('btnNewRequest');
  }

  function bindEvents() {
    dom.requestForm.addEventListener('submit', handleFormSubmit);

    document.getElementById('description').addEventListener('input', (e) => {
      e.target.nextElementSibling.textContent = `${e.target.value.length}/${VALIDATION.description.max}`;
    });

    dom.filterType.addEventListener('change', applyFilters);
    dom.filterPriority.addEventListener('change', applyFilters);
    dom.searchInput.addEventListener('input', applyFilters);

    // Filter popover
    dom.btnToggleFilters.addEventListener('click', () => {
      const open = dom.filterPanel.hidden;
      dom.filterPanel.hidden = !open;
      dom.btnToggleFilters.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!dom.filterPanel.hidden &&
          !dom.filterPanel.contains(e.target) &&
          e.target !== dom.btnToggleFilters &&
          !dom.btnToggleFilters.contains(e.target)) {
        dom.filterPanel.hidden = true;
        dom.btnToggleFilters.setAttribute('aria-expanded', 'false');
      }
    });

    // Active chip removal
    dom.activeFilterChips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-clear]');
      if (!btn) return;
      const key = btn.dataset.clear;
      if (key === 'type')     { dom.filterType.value = 'all'; }
      if (key === 'priority') { dom.filterPriority.value = 'all'; }
      applyFilters();
    });

    // Status rail chips
    dom.statusChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-status]');
      if (!chip) return;
      setStatusFilter(chip.dataset.status);
    });

    // View toggle
    document.querySelectorAll('.rl-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    // Row click → open detail
    dom.rowsContainer.addEventListener('click', (e) => {
      const row = e.target.closest('[data-firebase-id]');
      if (!row) return;
      openRequestDetail(row.dataset.firebaseId);
    });

    // Detail modal
    dom.modalClose.addEventListener('click', closeRequestModal);
    dom.requestModal.querySelector('.modal-overlay').addEventListener('click', closeRequestModal);
    dom.modalBody.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'save-request')   saveRequest();
      if (action === 'delete-request') deleteRequest();
    });

    // New-request modal
    dom.btnNewRequest.addEventListener('click', openNewRequestModal);
    dom.newRequestModal.querySelectorAll('[data-action="close-new-request"]').forEach((el) => {
      el.addEventListener('click', closeNewRequestModal);
    });
  }

  function subscribeToRequests() {
    state.unsubscribe = FirebaseAPI.onRequestsChange((requests) => {
      requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      state.all = requests;
      renderStats();
      applyFilters();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    bindEvents();
    subscribeToRequests();
  });
})();
