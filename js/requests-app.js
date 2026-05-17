/**
 * Request Management app — wires the requests-log.html page to Firebase.
 *
 * Dependencies (loaded in order in requests-log.html):
 *   - firebase SDK (compat)
 *   - js/config.js          (AppConfig)
 *   - js/utils.js           (Utils)
 *   - js/firebase-config.js (initializes firebase + window.firebaseDb)
 *   - js/firebase-api.js    (FirebaseAPI)
 *   - js/common.js          (theme toggle, observers)
 *
 * Internal sections:
 *   1. State
 *   2. Rendering (table, badges, modal)
 *   3. Filtering & pagination
 *   4. Form: create request
 *   5. Modal: detail / update / delete
 *   6. Event wiring (init)
 */
(function () {
  'use strict';

  const { escapeHtml, formatDate, formatDateTime, statusInfo, priorityInfo, typeInfo, isValidEmail, showNotification } = Utils;
  const { TEAM_MEMBERS, PAGINATION, VALIDATION, STATUS, PRIORITY, TYPE } = AppConfig;

  // ────────────────────────────────────────────────────────────
  // 1. State
  // ────────────────────────────────────────────────────────────

  const state = {
    all:      [],
    filtered: [],
    page:     1,
    pageSize: PAGINATION.defaultPageSize,
    unsubscribe: null
  };

  const dom = {};

  // ────────────────────────────────────────────────────────────
  // 2. Rendering
  // ────────────────────────────────────────────────────────────

  function badge(kind, key, info) {
    return `<span class="badge ${kind}-${escapeHtml(key)}" title="${escapeHtml(info.label)}">`
         + `<span class="badge-icon">${info.icon}</span>`
         + `<span class="badge-text">${escapeHtml(info.label)}</span>`
         + `</span>`;
  }

  function initials(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const parts = s.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function avatarColor(name) {
    const s = String(name || 'x');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
    const palette = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    return palette[Math.abs(h) % palette.length];
  }

  function userCell(name, { unassigned = false } = {}) {
    if (unassigned) {
      return `<div class="user-cell user-cell--empty">`
           + `<span class="avatar avatar--empty">?</span>`
           + `<span class="user-name user-name--muted">Unassigned</span>`
           + `</div>`;
    }
    const safe = escapeHtml(name);
    return `<div class="user-cell">`
         + `<span class="avatar" style="background:${avatarColor(name)}">${escapeHtml(initials(name))}</span>`
         + `<span class="user-name">${safe}</span>`
         + `</div>`;
  }

  function renderTable() {
    const tbody = dom.tableBody;
    const total = state.filtered.length;

    if (total === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            <div class="empty-state-icon">${state.all.length === 0 ? '📋' : '🔍'}</div>
            <h3>${state.all.length === 0 ? 'Chưa có request nào' : 'Không tìm thấy request nào'}</h3>
            <p>${state.all.length === 0
              ? 'Tạo request đầu tiên bằng nút ➕ ở góc phải dưới!'
              : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'}</p>
          </td>
        </tr>
      `;
      renderPagination();
      return;
    }

    const start = (state.page - 1) * state.pageSize;
    const slice = state.filtered.slice(start, start + state.pageSize);

    tbody.innerHTML = slice.map((req) => {
      const status   = statusInfo(req.status);
      const priority = priorityInfo(req.priority);
      const type     = typeInfo(req.type);
      const shortId  = String(req.id || '').slice(-6) || '------';

      return `
        <tr class="table-row row-prio-${escapeHtml(req.priority || 'medium')}" data-firebase-id="${escapeHtml(req.firebaseId)}">
          <td><span class="request-id">#${escapeHtml(shortId)}</span></td>
          <td class="title-cell"><div class="title-text">${escapeHtml(req.title)}</div></td>
          <td>${userCell(req.requester)}</td>
          <td>${badge('type', req.type, type)}</td>
          <td>${badge('priority', req.priority, priority)}</td>
          <td>${badge('status', req.status, status)}</td>
          <td>${userCell(req.assignee, { unassigned: !req.assignee })}</td>
          <td class="date-cell">${formatDate(req.timestamp)}</td>
          <td>
            <button class="action-btn" data-action="view-detail" title="Xem chi tiết">👁️</button>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination();
  }

  function renderPagination() {
    const total      = state.filtered.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const start      = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const end        = Math.min(state.page * state.pageSize, total);

    dom.paginationInfo.textContent = `${start}-${end} of ${total}`;
    dom.prevPageBtn.disabled = state.page <= 1;
    dom.nextPageBtn.disabled = state.page >= totalPages || totalPages === 0;
    dom.pageNumbers.innerHTML = buildPageNumbers(state.page, totalPages);
  }

  function buildPageNumbers(current, total) {
    if (total === 0) return '';
    const btn = (n, active = false) =>
      `<button class="page-number ${active ? 'active' : ''}" data-page="${n}">${n}</button>`;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => btn(i + 1, i + 1 === current)).join('');
    }

    const parts = [];
    if (current <= 3) {
      for (let i = 1; i <= 5; i++) parts.push(btn(i, i === current));
      parts.push('<span>...</span>', btn(total));
    } else if (current >= total - 2) {
      parts.push(btn(1), '<span>...</span>');
      for (let i = total - 4; i <= total; i++) parts.push(btn(i, i === current));
    } else {
      parts.push(btn(1), '<span>...</span>');
      for (let i = current - 1; i <= current + 1; i++) parts.push(btn(i, i === current));
      parts.push('<span>...</span>', btn(total));
    }
    return parts.join('');
  }

  function renderStats() {
    const total     = state.all.length;
    const active    = state.all.filter((r) => r.status === 'pending' || r.status === 'in-progress').length;
    const completed = state.all.filter((r) => r.status === 'completed').length;

    dom.statTotal.textContent     = total;
    dom.statActive.textContent    = active;
    dom.statCompleted.textContent = completed;
  }

  // ────────────────────────────────────────────────────────────
  // 3. Filtering
  // ────────────────────────────────────────────────────────────

  function applyFilters() {
    const status   = dom.filterStatus.value;
    const type     = dom.filterType.value;
    const priority = dom.filterPriority.value;
    const query    = dom.searchInput.value.toLowerCase().trim();

    state.filtered = state.all.filter((req) => {
      if (status   !== 'all' && req.status   !== status)   return false;
      if (type     !== 'all' && req.type     !== type)     return false;
      if (priority !== 'all' && req.priority !== priority) return false;

      if (query) {
        const haystack = `${req.title || ''} ${req.requester || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    state.page = 1;
    renderTable();
  }

  // ────────────────────────────────────────────────────────────
  // 4. Form: create request
  // ────────────────────────────────────────────────────────────

  function collectFormData() {
    const get = (id) => document.getElementById(id).value.trim();
    const now = new Date().toISOString();

    return {
      id:               Date.now().toString(),
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
    if (!data.requester      || data.requester.length      > VALIDATION.requester.max)   return 'Requester không hợp lệ';
    if (!data.requesterEmail || !isValidEmail(data.requesterEmail))                       return 'Email không hợp lệ';
    if (!data.type     || !(data.type     in TYPE))     return 'Type không hợp lệ';
    if (!data.priority || !(data.priority in PRIORITY)) return 'Priority không hợp lệ';
    if (!data.title       || data.title.length       > VALIDATION.title.max)       return 'Title không hợp lệ';
    if (!data.description || data.description.length > VALIDATION.description.max) return 'Description không hợp lệ';
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

      showNotification('success', 'Request đã được tạo thành công!');
      e.target.reset();
      document.querySelector('.char-count').textContent = `0/${VALIDATION.description.max}`;
      closeNewRequestModal();
    } catch (err) {
      console.error('Error submitting request:', err);
      showNotification('error', `Lỗi: ${err.message}`);
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
  // 5. Modal: detail view
  // ────────────────────────────────────────────────────────────

  let activeRequestId = null;

  function openRequestDetail(firebaseId) {
    activeRequestId = firebaseId;
    const modalContent = dom.requestModal.querySelector('.modal-content');
    modalContent.classList.add('modal-content--detail');
    dom.modalBody.innerHTML = `
      <div class="loading-state" style="padding: 60px;">
        <div class="loader"></div>
        <p>Đang tải chi tiết...</p>
      </div>
    `;
    dom.requestModal.style.display = 'flex';

    FirebaseAPI.getRequest(firebaseId)
      .then((data) => {
        if (!data) throw new Error('Không tìm thấy request');
        dom.modalBody.innerHTML = renderRequestDetail(data);
      })
      .catch((err) => {
        console.error('Error loading request details:', err);
        dom.modalBody.innerHTML = `
          <div class="empty-state" style="padding: 60px;">
            <div class="empty-state-icon">⚠️</div>
            <h3>Lỗi tải dữ liệu</h3>
            <p>${escapeHtml(err.message)}</p>
          </div>
        `;
      });
  }

  function renderRequestDetail(data) {
    const status   = statusInfo(data.status);
    const priority = priorityInfo(data.priority);
    const type     = typeInfo(data.type);
    const hasHistory = Array.isArray(data.history) && data.history.length > 0;

    return `
      <div class="detail-layout">
        <!-- Main Content (Left) -->
        <div class="detail-main">
          <div class="detail-header">
            <div class="detail-id">#${escapeHtml(data.id)}</div>
            <h2 class="detail-title">${escapeHtml(data.title)}</h2>
            <div class="detail-badges">
              <span class="badge type">${type.icon} ${escapeHtml(type.label)}</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">📝 Mô tả chi tiết</div>
            <div class="detail-description">${escapeHtml(data.description)}</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">📤 Outcome & Feedback</div>
            <textarea id="outcomeAndFeedback" rows="3" class="modal-input" placeholder="Mô tả kết quả và feedback từ khách hàng/PM...">${escapeHtml(data.outcomeAndFeedback || '')}</textarea>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">💡 Lessons Learned</div>
            <textarea id="lessonsLearned" rows="3" class="modal-input" placeholder="Bài học rút ra...">${escapeHtml(data.lessonsLearned || '')}</textarea>
          </div>

          ${hasHistory ? `
            <div class="detail-section">
              <div class="detail-section-title">📜 Lịch sử thay đổi</div>
              <div class="history-compact">
                <div class="history-timeline">
                  ${data.history.slice().reverse().map(renderHistoryEntry).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <div class="detail-actions">
            <button class="modal-btn" data-action="save-request">💾 Lưu thay đổi</button>
            <button class="modal-btn danger" data-action="delete-request">🗑️ Xóa request</button>
          </div>
        </div>

        <!-- Sidebar (Right) -->
        <div class="detail-sidebar">
          <div class="sidebar-section">
            <div class="sidebar-label">Trạng thái</div>
            <select id="statusSelect" class="sidebar-select">
              ${Object.entries(STATUS).map(([key, info]) => `
                <option value="${key}" ${key === data.status ? 'selected' : ''}>${info.icon} ${escapeHtml(info.label)}</option>
              `).join('')}
            </select>
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Mức độ ưu tiên</div>
            <div class="sidebar-value">
              <span class="badge priority-${escapeHtml(data.priority)}">${priority.icon} ${escapeHtml(priority.label)}</span>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Người yêu cầu</div>
            <div class="sidebar-user">
              <span class="avatar" style="background:${avatarColor(data.requester)}">${escapeHtml(initials(data.requester))}</span>
              <div class="sidebar-user-info">
                <div class="sidebar-user-name">${escapeHtml(data.requester)}</div>
                <div class="sidebar-user-email">${escapeHtml(data.requesterEmail)}</div>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Assignee</div>
            <select id="assigneeSelect" class="sidebar-select">
              ${TEAM_MEMBERS.map((m) => `
                <option value="${escapeHtml(m)}" ${m === data.assignee ? 'selected' : ''}>${escapeHtml(m)}</option>
              `).join('')}
            </select>
          </div>

          ${data.project ? `
            <div class="sidebar-section">
              <div class="sidebar-label">Dự án</div>
              <div class="sidebar-value">🗂️ ${escapeHtml(data.project)}</div>
            </div>
          ` : ''}

          <div class="sidebar-section">
            <div class="sidebar-label">Timeline</div>
            <div class="timeline-list">
              <div class="timeline-item">
                <span class="timeline-icon">📅</span>
                <span class="timeline-label">Tạo lúc</span>
                <span class="timeline-date">${formatDateTime(data.createdAt)}</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-icon">🔄</span>
                <span class="timeline-label">Cập nhật</span>
                <span class="timeline-date">${formatDateTime(data.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Due Date</div>
            <input type="date" id="deadlineInput" class="sidebar-input" value="${escapeHtml(data.deadline || '')}">
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Time Tracking</div>
            <div class="time-tracking-grid">
              <div class="time-item">
                <div class="time-label">Estimated (h)</div>
                <input type="number" id="estimatedTime" class="sidebar-input" value="${escapeHtml(data.estimatedTime || '')}" placeholder="0" style="margin-top:4px;" min="0" step="0.5">
              </div>
              <div class="time-item">
                <div class="time-label">Time spent (h)</div>
                <input type="number" id="loggedEffort" class="sidebar-input" value="${escapeHtml(data.loggedEffort || '')}" placeholder="0" style="margin-top:4px;" min="0" step="0.5">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderHistoryEntry(entry) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    return `
      <div class="history-entry">
        <div class="history-timestamp">${formatDateTime(entry.timestamp)}</div>
        <div class="history-changes">
          ${changes.map((c) => `
            <div class="history-change">
              <strong>${escapeHtml(c.field)}:</strong>
              ${c.oldValue ? `<span class="old-value">${escapeHtml(c.oldValue)}</span> → ` : ''}
              <span class="new-value">${escapeHtml(c.newValue)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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

  async function saveRequest() {
    if (!activeRequestId) return;

    try {
      const oldData = await FirebaseAPI.getRequest(activeRequestId);

      const newStatus        = document.getElementById('statusSelect').value;
      const newAssignee      = document.getElementById('assigneeSelect').value;
      const newDeadline      = document.getElementById('deadlineInput').value;
      const newEstimatedTime = document.getElementById('estimatedTime').value;
      const newLoggedEffort  = document.getElementById('loggedEffort').value;
      const newOutcome       = document.getElementById('outcomeAndFeedback').value.trim();
      const newLessons       = document.getElementById('lessonsLearned').value.trim();

      if (newStatus === 'in-progress') {
        if (!newDeadline) {
          showNotification('error', 'Vui lòng nhập Due Date khi chuyển sang In Progress');
          return;
        }
        if (!newEstimatedTime) {
          showNotification('error', 'Vui lòng nhập Estimated Time khi chuyển sang In Progress');
          return;
        }
      }

      if (newStatus === 'completed') {
        if (!newLoggedEffort) {
          showNotification('error', 'Vui lòng nhập Time Spent khi chuyển sang Completed');
          return;
        }
      }

      const hours = (v) => `${v}h`;
      const candidates = [
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
        status:             newStatus,
        assignee:           newAssignee,
        deadline:           newDeadline      || null,
        estimatedTime:      newEstimatedTime || null,
        loggedEffort:       newLoggedEffort  || null,
        outcomeAndFeedback: newOutcome       || null,
        lessonsLearned:     newLessons       || null,
        updatedAt:          new Date().toISOString()
      };

      if (changes.length > 0) {
        updates.history = [
          ...(oldData.history || []),
          { timestamp: updates.updatedAt, changes }
        ];
      }

      await FirebaseAPI.updateRequest(activeRequestId, updates);
      showNotification('success', 'Request đã được cập nhật!');
      closeRequestModal();
    } catch (err) {
      console.error('Error updating request:', err);
      showNotification('error', `Lỗi: ${err.message}`);
    }
  }

  async function deleteRequest() {
    if (!activeRequestId) return;
    if (!confirm('Bạn có chắc muốn xóa request này? Hành động này không thể hoàn tác.')) return;

    try {
      await FirebaseAPI.deleteRequest(activeRequestId);
      showNotification('success', 'Request đã được xóa!');
      closeRequestModal();
    } catch (err) {
      console.error('Error deleting request:', err);
      showNotification('error', `Lỗi: ${err.message}`);
    }
  }

  function closeRequestModal() {
    dom.requestModal.style.display = 'none';
    dom.requestModal.querySelector('.modal-content').classList.remove('modal-content--detail');
    activeRequestId = null;
  }

  // ────────────────────────────────────────────────────────────
  // 6. Event wiring
  // ────────────────────────────────────────────────────────────

  function cacheDom() {
    dom.tableBody         = document.getElementById('requestsTableBody');
    dom.searchInput       = document.getElementById('searchInput');
    dom.filterStatus      = document.getElementById('filterStatus');
    dom.filterType        = document.getElementById('filterType');
    dom.filterPriority    = document.getElementById('filterPriority');
    dom.refreshBtn        = document.getElementById('refreshBtn');
    dom.prevPageBtn       = document.getElementById('prevPage');
    dom.nextPageBtn       = document.getElementById('nextPage');
    dom.pageNumbers       = document.getElementById('pageNumbers');
    dom.pageSizeSelect    = document.getElementById('pageSize');
    dom.paginationInfo    = document.getElementById('paginationInfo');
    dom.statTotal         = document.getElementById('totalRequests');
    dom.statActive        = document.getElementById('activeRequests');
    dom.statCompleted     = document.getElementById('completedRequests');
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

    dom.filterStatus.addEventListener('change', applyFilters);
    dom.filterType.addEventListener('change', applyFilters);
    dom.filterPriority.addEventListener('change', applyFilters);
    dom.searchInput.addEventListener('input', applyFilters);

    dom.prevPageBtn.addEventListener('click', () => {
      if (state.page > 1) { state.page--; renderTable(); }
    });
    dom.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filtered.length / state.pageSize);
      if (state.page < totalPages) { state.page++; renderTable(); }
    });
    dom.pageSizeSelect.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value, 10) || PAGINATION.defaultPageSize;
      state.page     = 1;
      renderTable();
    });

    dom.pageNumbers.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn) return;
      state.page = parseInt(btn.dataset.page, 10);
      renderTable();
    });

    dom.refreshBtn.addEventListener('click', () => {
      showNotification('info', 'Firebase tự động sync real-time, không cần refresh!');
    });

    dom.tableBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-firebase-id]');
      if (!row) return;
      openRequestDetail(row.dataset.firebaseId);
    });

    dom.modalClose.addEventListener('click', closeRequestModal);
    dom.requestModal.querySelector('.modal-overlay').addEventListener('click', closeRequestModal);

    dom.modalBody.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'save-request')   saveRequest();
      if (action === 'delete-request') deleteRequest();
    });

    dom.btnNewRequest.addEventListener('click', openNewRequestModal);
    dom.newRequestModal.querySelectorAll('[data-action="close-new-request"]').forEach((el) => {
      el.addEventListener('click', closeNewRequestModal);
    });
  }

  function subscribeToRequests() {
    state.unsubscribe = FirebaseAPI.onRequestsChange((requests) => {
      requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      state.all      = requests;
      state.filtered = [...requests];
      state.page     = 1;

      renderStats();
      renderTable();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    bindEvents();
    subscribeToRequests();
  });
})();
