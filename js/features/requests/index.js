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
import { escapeHtml, formatDate, formatDateTime, statusInfo, priorityInfo, typeInfo, initials } from '../../core/format.js';
import { isValidEmail }                       from '../../core/validation.js';
import { showNotification }                   from '../../core/notifications.js';
import { PAGINATION, VALIDATION, STATUS, PRIORITY, TYPE, PROJECTS } from '../../config/constants.js';
import { FirebaseAPI }                        from '../../data/firebase-api.js';
import * as Auth                              from '../auth/auth-service.js';
import { ICONS }                              from './icons.js';
import {
  state, dom, STATUS_KEYS, PRIORITY_KEYS, CHUNK_SIZE,
  statusClass, priorityClass, priorityBars,
  shortId, nextRequestId, safeProgress, commentsCount
} from './state.js';

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
            ${req.project ? `<span class="rl-row__meta-item rl-row__project">${ICONS.folder}${escapeHtml(req.project)}</span>` : ''}
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
    return !Auth.isSolutionTeam();
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
    return Auth.isSolutionTeam();
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

          // Sync allocation status
          await FirebaseAPI.syncAllocationStatusForRequest(shortId(reqData), targetStatus);

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
    state.project  = dom.filterProject?.value || 'all';
    state.assignee = dom.filterAssignee?.value || 'all';
    // status comes from the rail (state.status); legacy <select> kept hidden

    state.filtered = state.all.filter((req) => {
      if (state.status   !== 'all' && req.status   !== state.status)   return false;
      if (state.type     !== 'all' && req.type     !== state.type)     return false;
      if (state.priority !== 'all' && req.priority !== state.priority) return false;
      if (state.project  !== 'all' && req.project  !== state.project)  return false;
      if (state.assignee !== 'all' && req.assignee !== state.assignee) return false;
      if (state.query) {
        const hay = `${req.title || ''} ${req.requester || ''} ${shortId(req)} ${req.project || ''}`.toLowerCase();
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
    if (state.project !== 'all')  chips.push({ key: 'project',  value: state.project });
    if (state.assignee !== 'all') chips.push({ key: 'assignee', value: state.assignee });

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

    const requesterEl = document.getElementById('requester');
    const emailEl = document.getElementById('requesterEmail');

    // Autofill from logged-in user profile
    if (Auth.isLoggedIn()) {
      const profile = Auth.getProfile();
      if (profile) {
        requesterEl.value = profile.displayName || '';
        emailEl.value = profile.email || '';

        // Disable fields for normal users, enable for solution-team
        const isNormalUser = profile.role === 'user';
        requesterEl.disabled = isNormalUser;
        emailEl.disabled = isNormalUser;
        requesterEl.classList.toggle('is-disabled', isNormalUser);
        emailEl.classList.toggle('is-disabled', isNormalUser);
      }
    }

    setTimeout(() => {
      const firstEditable = requesterEl.disabled ? document.getElementById('requestType') : requesterEl;
      firstEditable.focus();
    }, 100);
  }

  function closeNewRequestModal() {
    dom.newRequestModal.style.display = 'none';
    dom.requestForm.reset();
    document.querySelector('.char-count').textContent = `0/${VALIDATION.description.max}`;

    // Reset disabled state
    const requesterEl = document.getElementById('requester');
    const emailEl = document.getElementById('requesterEmail');
    requesterEl.disabled = false;
    emailEl.disabled = false;
    requesterEl.classList.remove('is-disabled');
    emailEl.classList.remove('is-disabled');
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
              ${!canFullEdit() && canNormalUserEdit(data)
                ? `<textarea id="descriptionEdit" class="modal-input" rows="4">${escapeHtml(data.description || '')}</textarea>`
                : `<div class="rl-section__body"><p>${escapeHtml(data.description)}</p></div>`
              }
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Outcome &amp; feedback</div>
              ${canFullEdit()
                ? `<textarea id="outcomeAndFeedback" class="modal-input" placeholder="Describe outcome and feedback from PM/customer…">${escapeHtml(data.outcomeAndFeedback || '')}</textarea>`
                : `<div class="rl-section__body"><p>${data.outcomeAndFeedback ? escapeHtml(data.outcomeAndFeedback) : '<span style="color:var(--rl-muted);">Not set</span>'}</p></div>`
              }
            </div>

            <div class="rl-section">
              <div class="rl-section__title">Lessons learned</div>
              ${canFullEdit()
                ? `<textarea id="lessonsLearned" class="modal-input" placeholder="Key takeaways…">${escapeHtml(data.lessonsLearned || '')}</textarea>`
                : `<div class="rl-section__body"><p>${data.lessonsLearned ? escapeHtml(data.lessonsLearned) : '<span style="color:var(--rl-muted);">Not set</span>'}</p></div>`
              }
            </div>

            <div class="rl-section">
              <div class="rl-tabs">
                <button class="rl-tab" data-tab="activity">Activity</button>
                <button class="rl-tab is-active" data-tab="comments">Comments <span class="rl-tab__count">${(data.comments || []).length}</span></button>
              </div>

              <div class="rl-tab-content" data-tab-content="activity" hidden>
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

              <div class="rl-tab-content" data-tab-content="comments">
                <div class="rl-comments" id="commentsContainer">
                  ${renderCommentsHtml(data.comments || [])}
                </div>
                <div class="rl-comment-form" id="commentForm">
                  <div class="rl-comment-form__reply-to" id="replyIndicator" hidden>
                    <span>Replying to <strong id="replyToName"></strong></span>
                    <button type="button" class="rl-comment-form__cancel-reply" data-action="cancel-reply">${ICONS.x}</button>
                  </div>
                  <div class="rl-comment-input-wrapper">
                    <textarea id="commentInput" class="rl-comment-input" placeholder="Add a comment... Use @ to mention" rows="2"></textarea>
                    <div class="rl-mention-dropdown" id="mentionDropdown" hidden></div>
                  </div>
                  <div class="rl-comment-form__actions">
                    <button type="button" class="rl-btn rl-btn--primary" data-action="submit-comment">Post comment</button>
                  </div>
                </div>
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
              ${!canFullEdit() && canNormalUserEdit(data)
                ? `<select id="prioritySelect">
                     ${Object.entries(PRIORITY).map(([key, info]) => `
                       <option value="${key}" ${key === data.priority ? 'selected' : ''}>${escapeHtml(info.label)}</option>
                     `).join('')}
                   </select>`
                : `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--rl-border);border-radius:var(--rl-radius-sm);background:var(--rl-card);">
                     <span class="rl-row__prio">${priorityBarsHtml}</span>
                     <span style="font-size:13px;color:${cssVarColorForPriority(data.priority)}">${escapeHtml(priority.label)}</span>
                   </div>`
              }
            </div>

            ${data.project ? `
            <div class="rl-field">
              <label>Project</label>
              <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--rl-border);border-radius:var(--rl-radius-sm);background:var(--rl-card);font-size:13px;">
                ${ICONS.folder}
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(data.project)}">${escapeHtml(data.project)}</span>
              </div>
            </div>
            ` : ''}

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
                     ${state.teamMembers.map((m) => `
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

  // ── Comment system ─────────────────────────────────────────

  let replyToCommentId = null;

  function renderCommentsHtml(comments) {
    if (!comments || comments.length === 0) {
      return '<div class="rl-comments__empty">No comments yet. Be the first to comment!</div>';
    }

    // Separate top-level comments and replies
    const topLevel = comments.filter(c => !c.parentId);
    const replies = comments.filter(c => c.parentId);

    // Group replies by parentId
    const repliesByParent = {};
    replies.forEach(r => {
      if (!repliesByParent[r.parentId]) repliesByParent[r.parentId] = [];
      repliesByParent[r.parentId].push(r);
    });

    return topLevel.map(comment => renderCommentWithReplies(comment, repliesByParent)).join('');
  }

  function renderCommentWithReplies(comment, repliesByParent) {
    const commentReplies = repliesByParent[comment.id] || [];
    const currentUserEmail = Auth.getProfile()?.email;
    const isOwner = currentUserEmail === comment.authorEmail;
    const canDelete = isOwner || canFullEdit();
    const editedIndicator = comment.editedAt ? `<span class="rl-comment__edited">(edited)</span>` : '';

    return `
      <div class="rl-comment" data-comment-id="${escapeHtml(comment.id)}">
        <div class="rl-comment__main">
          <div class="rl-comment__avatar">
            <span class="rl-avatar">${escapeHtml(initials(comment.author))}</span>
          </div>
          <div class="rl-comment__content">
            <div class="rl-comment__header">
              <strong class="rl-comment__author">${escapeHtml(comment.author)}</strong>
              <span class="rl-comment__time">${escapeHtml(formatDateTime(comment.createdAt))} ${editedIndicator}</span>
            </div>
            <div class="rl-comment__text" data-comment-text="${escapeHtml(comment.id)}">${formatCommentText(comment.text)}</div>
            <div class="rl-comment__actions" data-comment-actions="${escapeHtml(comment.id)}">
              <button type="button" class="rl-comment__action" data-action="reply-comment" data-comment-id="${escapeHtml(comment.id)}" data-author="${escapeHtml(comment.author)}">Reply</button>
              ${isOwner ? `<button type="button" class="rl-comment__action" data-action="edit-comment" data-comment-id="${escapeHtml(comment.id)}">Edit</button>` : ''}
              ${canDelete ? `<button type="button" class="rl-comment__action rl-comment__action--danger" data-action="delete-comment" data-comment-id="${escapeHtml(comment.id)}">Delete</button>` : ''}
            </div>
          </div>
        </div>
        ${commentReplies.length > 0 ? `
          <div class="rl-comment__replies">
            ${commentReplies.map(reply => renderReply(reply, comment.id)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderReply(reply, parentId) {
    const currentUserEmail = Auth.getProfile()?.email;
    const isOwner = currentUserEmail === reply.authorEmail;
    const canDelete = isOwner || canFullEdit();
    const editedIndicator = reply.editedAt ? `<span class="rl-comment__edited">(edited)</span>` : '';

    return `
      <div class="rl-comment rl-comment--reply" data-comment-id="${escapeHtml(reply.id)}">
        <div class="rl-comment__main">
          <div class="rl-comment__avatar">
            <span class="rl-avatar" style="width:24px;height:24px;font-size:10px;">${escapeHtml(initials(reply.author))}</span>
          </div>
          <div class="rl-comment__content">
            <div class="rl-comment__header">
              <strong class="rl-comment__author">${escapeHtml(reply.author)}</strong>
              <span class="rl-comment__time">${escapeHtml(formatDateTime(reply.createdAt))} ${editedIndicator}</span>
            </div>
            <div class="rl-comment__text" data-comment-text="${escapeHtml(reply.id)}">${formatCommentText(reply.text)}</div>
            <div class="rl-comment__actions" data-comment-actions="${escapeHtml(reply.id)}">
              <button type="button" class="rl-comment__action" data-action="reply-comment" data-comment-id="${escapeHtml(parentId)}" data-author="${escapeHtml(reply.author)}">Reply</button>
              ${isOwner ? `<button type="button" class="rl-comment__action" data-action="edit-comment" data-comment-id="${escapeHtml(reply.id)}">Edit</button>` : ''}
              ${canDelete ? `<button type="button" class="rl-comment__action rl-comment__action--danger" data-action="delete-comment" data-comment-id="${escapeHtml(reply.id)}">Delete</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function formatCommentText(text) {
    if (!text) return '';
    // Escape HTML first, then convert @mentions to styled spans
    let escaped = escapeHtml(text);
    // Convert @mentions - match @[Name] format or @Name (supports Unicode)
    escaped = escaped.replace(/@\[([^\]]+)\]/g, '<span class="rl-mention">@$1</span>');
    escaped = escaped.replace(/@([\p{L}\p{N}_.]+)/gu, '<span class="rl-mention">@$1</span>');
    return escaped;
  }

  function getMentionableUsers() {
    // Combine team members with requester info if available
    const users = [];
    state.teamMembers.forEach(name => {
      if (name !== 'Unassigned') {
        users.push({ name, email: null });
      }
    });
    return users;
  }

  function showMentionDropdown(query, inputEl) {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;

    const users = getMentionableUsers();
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (filtered.length === 0) {
      dropdown.hidden = true;
      return;
    }

    dropdown.innerHTML = filtered.map((u, i) => `
      <button type="button" class="rl-mention-item ${i === 0 ? 'is-selected' : ''}" data-mention="${escapeHtml(u.name)}">
        <span class="rl-avatar" style="width:24px;height:24px;font-size:10px;">${escapeHtml(initials(u.name))}</span>
        <span>${escapeHtml(u.name)}</span>
      </button>
    `).join('');

    dropdown.hidden = false;
  }

  function hideMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) dropdown.hidden = true;
  }

  function insertMention(name) {
    const input = document.getElementById('commentInput');
    if (!input) return;

    const text = input.value;
    const cursorPos = input.selectionStart;

    // Find the @ or @[ before cursor
    const beforeCursor = text.substring(0, cursorPos);
    let atIndex = beforeCursor.lastIndexOf('@[');
    if (atIndex === -1) atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      // Use bracket format for names with spaces
      const mention = name.includes(' ') ? `@[${name}]` : `@${name}`;
      const newText = text.substring(0, atIndex) + mention + ' ' + text.substring(cursorPos);
      input.value = newText;
      const newPos = atIndex + mention.length + 1;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }

    hideMentionDropdown();
  }

  async function submitComment() {
    const input = document.getElementById('commentInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
      showNotification('error', 'Please enter a comment');
      return;
    }

    if (!activeRequestId) return;

    const profile = Auth.getProfile();
    const user = Auth.getUser();

    const comment = {
      id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      author: profile?.displayName || user?.email?.split('@')[0] || 'Anonymous',
      authorEmail: profile?.email || user?.email || null,
      text: text,
      createdAt: new Date().toISOString(),
      parentId: replyToCommentId || null,
      mentions: extractMentions(text)
    };

    try {
      const reqData = await FirebaseAPI.getRequest(activeRequestId);
      const comments = Array.isArray(reqData.comments) ? [...reqData.comments, comment] : [comment];

      await FirebaseAPI.updateRequest(activeRequestId, {
        comments,
        updatedAt: new Date().toISOString()
      });

      // Reset form
      input.value = '';
      replyToCommentId = null;
      document.getElementById('replyIndicator').hidden = true;

      // Re-render comments
      document.getElementById('commentsContainer').innerHTML = renderCommentsHtml(comments);

      // Update comment count in tab
      const countEl = document.querySelector('.rl-tab[data-tab="comments"] .rl-tab__count');
      if (countEl) countEl.textContent = comments.length;

      showNotification('success', 'Comment added');
    } catch (err) {
      console.error('Error adding comment:', err);
      showNotification('error', 'Failed to add comment');
    }
  }

  async function deleteComment(commentId) {
    if (!activeRequestId || !commentId) return;
    if (!confirm('Delete this comment?')) return;

    try {
      const reqData = await FirebaseAPI.getRequest(activeRequestId);
      let comments = Array.isArray(reqData.comments) ? reqData.comments : [];

      // Remove the comment and its replies
      comments = comments.filter(c => c.id !== commentId && c.parentId !== commentId);

      await FirebaseAPI.updateRequest(activeRequestId, {
        comments,
        updatedAt: new Date().toISOString()
      });

      // Re-render comments
      document.getElementById('commentsContainer').innerHTML = renderCommentsHtml(comments);

      // Update comment count in tab
      const countEl = document.querySelector('.rl-tab[data-tab="comments"] .rl-tab__count');
      if (countEl) countEl.textContent = comments.length;

      showNotification('success', 'Comment deleted');
    } catch (err) {
      console.error('Error deleting comment:', err);
      showNotification('error', 'Failed to delete comment');
    }
  }

  function extractMentions(text) {
    const mentions = [];
    // Match @[Name with spaces] format
    const bracketRegex = /@\[([^\]]+)\]/g;
    let match;
    while ((match = bracketRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    // Match @Name format (Unicode support)
    const simpleRegex = /@([\p{L}\p{N}_.]+)/gu;
    while ((match = simpleRegex.exec(text)) !== null) {
      if (!mentions.includes(match[1])) {
        mentions.push(match[1]);
      }
    }
    return mentions;
  }

  function setReplyTo(commentId, authorName) {
    replyToCommentId = commentId;
    const indicator = document.getElementById('replyIndicator');
    const nameEl = document.getElementById('replyToName');
    const input = document.getElementById('commentInput');

    if (indicator && nameEl) {
      nameEl.textContent = authorName;
      indicator.hidden = false;
    }

    // Auto-mention the author being replied to (use bracket format for names with spaces)
    if (input) {
      const mention = authorName.includes(' ') ? `@[${authorName}] ` : `@${authorName} `;
      if (!input.value.includes(mention.trim())) {
        input.value = mention + input.value;
      }
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function cancelReply() {
    replyToCommentId = null;
    const indicator = document.getElementById('replyIndicator');
    if (indicator) indicator.hidden = true;

    // Clear the input if it only contains the auto-mention
    const input = document.getElementById('commentInput');
    if (input && input.value.match(/^@\[?[^\]]*\]?\s*$/)) {
      input.value = '';
    }
  }

  let editingCommentId = null;

  function startEditComment(commentId) {
    // Cancel any previous edit
    if (editingCommentId) cancelEditComment();

    editingCommentId = commentId;
    const textEl = document.querySelector(`[data-comment-text="${commentId}"]`);
    const actionsEl = document.querySelector(`[data-comment-actions="${commentId}"]`);

    if (!textEl || !actionsEl) return;

    // Get current comment data
    FirebaseAPI.getRequest(activeRequestId).then(reqData => {
      const comments = reqData.comments || [];
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      // Replace text with textarea
      const originalText = comment.text;
      textEl.innerHTML = `
        <textarea class="rl-comment-edit-input" data-original="${escapeHtml(originalText)}">${escapeHtml(originalText)}</textarea>
      `;

      // Replace actions with save/cancel
      actionsEl.innerHTML = `
        <button type="button" class="rl-comment__action rl-comment__action--primary" data-action="save-edit-comment" data-comment-id="${escapeHtml(commentId)}">Save</button>
        <button type="button" class="rl-comment__action" data-action="cancel-edit-comment" data-comment-id="${escapeHtml(commentId)}">Cancel</button>
      `;

      // Focus the textarea
      const textarea = textEl.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
  }

  function cancelEditComment() {
    if (!editingCommentId) return;

    // Re-render comments to restore original state
    FirebaseAPI.getRequest(activeRequestId).then(reqData => {
      document.getElementById('commentsContainer').innerHTML = renderCommentsHtml(reqData.comments || []);
    });

    editingCommentId = null;
  }

  async function saveEditComment(commentId) {
    const textEl = document.querySelector(`[data-comment-text="${commentId}"]`);
    const textarea = textEl?.querySelector('textarea');

    if (!textarea) return;

    const newText = textarea.value.trim();
    if (!newText) {
      showNotification('error', 'Comment cannot be empty');
      return;
    }

    try {
      const reqData = await FirebaseAPI.getRequest(activeRequestId);
      const comments = (reqData.comments || []).map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            text: newText,
            editedAt: new Date().toISOString(),
            mentions: extractMentions(newText)
          };
        }
        return c;
      });

      await FirebaseAPI.updateRequest(activeRequestId, {
        comments,
        updatedAt: new Date().toISOString()
      });

      editingCommentId = null;

      // Re-render comments
      document.getElementById('commentsContainer').innerHTML = renderCommentsHtml(comments);

      showNotification('success', 'Comment updated');
    } catch (err) {
      console.error('Error updating comment:', err);
      showNotification('error', 'Failed to update comment');
    }
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
    // Get solution-team members from Firebase
    let members;
    try {
      members = await FirebaseAPI.getSolutionTeamMembersFull();
    } catch (e) {
      console.warn('[requests-app] Could not fetch members:', e);
      return;
    }
    if (!members || !members.length) return;

    // Find memberId from assignee name
    const member = members.find((m) => m.name === assignee);
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
      end:         endDate,
      status:      'active'
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
      // User: can only edit Description and Priority when status is Pending
      // Solution-team: cannot edit Description
      const descriptionEl = document.getElementById('descriptionEdit');
      const newDescription = descriptionEl ? descriptionEl.value.trim() : oldData.description;

      let newStatus, newAssignee, newDeadline, newEstimatedTime, newLoggedEffort, newOutcome, newLessons, newPriority;

      if (isSolutionTeamMember) {
        newStatus        = document.getElementById('statusSelect').value;
        const assigneeEl = document.getElementById('assigneeSelect');
        newAssignee      = assigneeEl ? assigneeEl.value : oldData.assignee;
        newDeadline      = document.getElementById('deadlineInput').value;
        newEstimatedTime = document.getElementById('estimatedTime').value;
        newLoggedEffort  = document.getElementById('loggedEffort').value;
        newOutcome       = document.getElementById('outcomeAndFeedback').value.trim();
        newLessons       = document.getElementById('lessonsLearned').value.trim();
        newPriority      = oldData.priority; // Solution team cannot change priority via detail modal
      } else {
        // Normal users can only edit description and priority when pending
        const priorityEl = document.getElementById('prioritySelect');
        newPriority      = priorityEl ? priorityEl.value : oldData.priority;
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
        diffField('Priority',           oldData.priority,           newPriority,      (k) => priorityInfo(k).label),
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
        priority:           newPriority,
        assignee:           newAssignee,
        deadline:           newDeadline      || null,
        estimatedTime:      newEstimatedTime || null,
        loggedEffort:       newLoggedEffort  || null,
        outcomeAndFeedback: newOutcome       || null,
        lessonsLearned:     newLessons       || null,
        updatedAt:          new Date().toISOString()
      };

      const userName = Auth.getProfile()
        ? Auth.getProfile().displayName || Auth.getUser()?.email
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

      // Sync allocation status when request status changes
      if (newStatus !== oldData.status) {
        const requestKey = shortId(oldData);
        await FirebaseAPI.syncAllocationStatusForRequest(requestKey, newStatus);
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
    dom.filterProject     = document.getElementById('filterProject');
    dom.filterAssignee    = document.getElementById('filterAssignee');
    dom.filterAssigneeField = document.getElementById('filterAssigneeField');
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
    dom.filterProject?.addEventListener('change', applyFilters);
    dom.filterAssignee?.addEventListener('change', applyFilters);
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
      if (key === 'project')  { dom.filterProject.value = 'all'; }
      if (key === 'assignee') { dom.filterAssignee.value = 'all'; }
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
      if (action === 'submit-comment') submitComment();
      if (action === 'cancel-reply')   cancelReply();
      if (action === 'reply-comment') {
        const btn = e.target.closest('[data-action="reply-comment"]');
        setReplyTo(btn.dataset.commentId, btn.dataset.author);
      }
      if (action === 'delete-comment') {
        const btn = e.target.closest('[data-action="delete-comment"]');
        deleteComment(btn.dataset.commentId);
      }
      if (action === 'edit-comment') {
        const btn = e.target.closest('[data-action="edit-comment"]');
        startEditComment(btn.dataset.commentId);
      }
      if (action === 'save-edit-comment') {
        const btn = e.target.closest('[data-action="save-edit-comment"]');
        saveEditComment(btn.dataset.commentId);
      }
      if (action === 'cancel-edit-comment') {
        cancelEditComment();
      }

      // Tab switching
      const tab = e.target.closest('.rl-tab');
      if (tab) {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.rl-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
        document.querySelectorAll('.rl-tab-content').forEach(c => c.hidden = c.dataset.tabContent !== tabName);
      }

      // Mention dropdown selection
      const mentionItem = e.target.closest('.rl-mention-item');
      if (mentionItem) {
        insertMention(mentionItem.dataset.mention);
      }
    });

    // Mention input handling (delegated)
    dom.modalBody.addEventListener('input', (e) => {
      if (e.target.id === 'commentInput') {
        const text = e.target.value;
        const cursorPos = e.target.selectionStart;
        const beforeCursor = text.substring(0, cursorPos);
        // Match @query or @[partial query (without closing bracket yet)
        const atMatch = beforeCursor.match(/@\[?([^\]@]*)$/);

        if (atMatch && !beforeCursor.match(/@\[[^\]]+\]$/)) {
          showMentionDropdown(atMatch[1], e.target);
        } else {
          hideMentionDropdown();
        }
      }
    });

    // Handle keyboard in comment input
    dom.modalBody.addEventListener('keydown', (e) => {
      if (e.target.id === 'commentInput') {
        const dropdown = document.getElementById('mentionDropdown');
        if (dropdown && !dropdown.hidden) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = dropdown.querySelectorAll('.rl-mention-item');
            const selected = dropdown.querySelector('.is-selected');
            const idx = Array.from(items).indexOf(selected);
            const newIdx = e.key === 'ArrowDown'
              ? Math.min(idx + 1, items.length - 1)
              : Math.max(idx - 1, 0);
            items.forEach((item, i) => item.classList.toggle('is-selected', i === newIdx));
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            const selected = dropdown.querySelector('.is-selected');
            if (selected) {
              e.preventDefault();
              insertMention(selected.dataset.mention);
            }
          } else if (e.key === 'Escape') {
            hideMentionDropdown();
          }
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submitComment();
        }
      }

      // Edit comment textarea keyboard handling
      if (e.target.classList.contains('rl-comment-edit-input')) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const commentId = e.target.closest('[data-comment-id]')?.dataset.commentId;
          if (commentId) saveEditComment(commentId);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditComment();
        }
      }
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

  function populateProjectDropdown() {
    const sel = document.getElementById('project');
    if (!sel || !PROJECTS) return;
    PROJECTS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  }

  function populateTypeDropdown() {
    if (!TYPE) return;
    const options = Object.entries(TYPE).map(([key, { icon, label }]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${icon} ${label}`;
      return opt;
    });

    // Populate create form dropdown
    const createSel = document.getElementById('requestType');
    if (createSel) {
      options.forEach(opt => createSel.appendChild(opt.cloneNode(true)));
    }

    // Populate filter dropdown
    const filterSel = document.getElementById('filterType');
    if (filterSel) {
      options.forEach(opt => filterSel.appendChild(opt.cloneNode(true)));
    }
  }

  function populatePriorityDropdown() {
    if (!PRIORITY) return;
    const options = Object.entries(PRIORITY).map(([key, { icon, label }]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${icon} ${label}`;
      return opt;
    });

    // Populate create form dropdown
    const createSel = document.getElementById('priority');
    if (createSel) {
      options.forEach(opt => createSel.appendChild(opt.cloneNode(true)));
    }

    // Populate filter dropdown
    const filterSel = document.getElementById('filterPriority');
    if (filterSel) {
      options.forEach(opt => filterSel.appendChild(opt.cloneNode(true)));
    }
  }

  function populateProjectFilter() {
    if (!PROJECTS || !dom.filterProject) return;
    PROJECTS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      dom.filterProject.appendChild(opt);
    });
  }

  function populateAssigneeFilter() {
    if (!dom.filterAssignee || !dom.filterAssigneeField) return;
    // Only show for solution-team
    if (!canFullEdit()) return;
    dom.filterAssigneeField.hidden = false;

    state.teamMembers.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      dom.filterAssignee.appendChild(opt);
    });
  }

  async function fetchTeamMembers() {
    try {
      const members = await FirebaseAPI.getSolutionTeamMembers();
      state.teamMembers = ['Unassigned', ...members];
    } catch (e) {
      console.warn('[requests] Failed to fetch team members:', e);
    }
  }

export function initRequests() {
  cacheDom();
  populateTypeDropdown();
  populatePriorityDropdown();
  populateProjectDropdown();
  populateProjectFilter();
  fetchTeamMembers().then(() => populateAssigneeFilter());
  bindEvents();
  subscribeToRequests();
}
