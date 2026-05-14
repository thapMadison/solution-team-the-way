// Request Management System
let allRequests = [];
let filteredRequests = [];

// ══════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initializeEventListeners();
  await loadRequests();
  updateStats();
});

function initializeEventListeners() {
  // Form submission
  document.getElementById('requestForm').addEventListener('submit', handleFormSubmit);

  // Character count for description
  document.getElementById('description').addEventListener('input', (e) => {
    const count = e.target.value.length;
    e.target.nextElementSibling.textContent = `${count}/2000`;
  });

  // Filter changes
  document.getElementById('filterStatus').addEventListener('change', applyFilters);
  document.getElementById('filterType').addEventListener('change', applyFilters);
  document.getElementById('filterPriority').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await loadRequests();
    showNotification('info', '🔄 Requests đã được làm mới!');
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.querySelector('.modal-overlay').addEventListener('click', closeModal);
}

// ══════════════════════════════════════════════════════════════
// FORM SUBMISSION
// ══════════════════════════════════════════════════════════════

async function handleFormSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('.submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  // Disable form
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    // Collect form data
    const requestData = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      requester: document.getElementById('requester').value.trim(),
      requesterEmail: document.getElementById('requesterEmail').value.trim(),
      type: document.getElementById('requestType').value,
      priority: document.getElementById('priority').value,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      deadline: document.getElementById('deadline').value || null,
      project: document.getElementById('project').value.trim() || null,
      status: 'pending',
      assignee: 'Unassigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: []
    };

    // Validate
    if (!validateRequest(requestData)) {
      throw new Error('Dữ liệu không hợp lệ');
    }

    // Save to GitHub
    await saveRequest(requestData);

    // Success
    showNotification('success', '✅ Request đã được tạo thành công!');
    form.reset();
    document.querySelector('.char-count').textContent = '0/2000';

    // Close modal
    closeNewRequestModal();

    // Reload requests
    await loadRequests();
    updateStats();

    // Scroll to requests list
    setTimeout(() => {
      document.getElementById('active').scrollIntoView({ behavior: 'smooth' });
    }, 500);

  } catch (error) {
    console.error('Error submitting request:', error);
    showNotification('error', `❌ Lỗi: ${error.message}`);
  } finally {
    // Re-enable form
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

function validateRequest(data) {
  if (!data.requester || data.requester.length > 100) return false;
  if (!data.requesterEmail || !isValidEmail(data.requesterEmail)) return false;
  if (!data.type || !data.priority) return false;
  if (!data.title || data.title.length > 200) return false;
  if (!data.description || data.description.length > 2000) return false;

  // Sanitize HTML
  data.requester = escapeHtml(data.requester);
  data.title = escapeHtml(data.title);
  data.description = escapeHtml(data.description);
  if (data.project) data.project = escapeHtml(data.project);

  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ══════════════════════════════════════════════════════════════
// GITHUB DATA OPERATIONS
// ══════════════════════════════════════════════════════════════

async function saveRequest(requestData) {
  // Get month path (YYYY-MM)
  const date = new Date(requestData.timestamp);
  const monthPath = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Save individual request file
  const requestFilePath = `${GITHUB_CONFIG.requestsDataPath}/${monthPath}/request-${requestData.id}.json`;
  await GitHubAPI.putFile(
    requestFilePath,
    requestData,
    `New request: ${requestData.title} (ID: ${requestData.id})`
  );

  // Update index file
  await updateRequestIndex(requestData);
}

async function updateRequestIndex(newRequest) {
  // Get current index
  let indexData = await GitHubAPI.getFile(GITHUB_CONFIG.requestsIndexPath);

  if (!indexData) {
    // Create new index if doesn't exist
    indexData = {
      content: {
        lastUpdated: new Date().toISOString(),
        totalCount: 0,
        requests: []
      },
      sha: null
    };
  }

  // Add new request to index (prepend to show latest first)
  const date = new Date(newRequest.timestamp);
  const monthPath = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  indexData.content.requests.unshift({
    id: newRequest.id,
    timestamp: newRequest.timestamp,
    requester: newRequest.requester,
    type: newRequest.type,
    priority: newRequest.priority,
    status: newRequest.status,
    title: newRequest.title,
    assignee: newRequest.assignee,
    path: `${GITHUB_CONFIG.requestsDataPath}/${monthPath}/request-${newRequest.id}.json`
  });

  indexData.content.totalCount = indexData.content.requests.length;
  indexData.content.lastUpdated = new Date().toISOString();

  // Save updated index
  await GitHubAPI.putFile(
    GITHUB_CONFIG.requestsIndexPath,
    indexData.content,
    `Update index: +1 request (${newRequest.id})`,
    indexData.sha
  );
}

async function loadRequests() {
  const listContainer = document.getElementById('requestsList');
  listContainer.innerHTML = `
    <div class="loading-state">
      <div class="loader"></div>
      <p>Đang tải requests...</p>
    </div>
  `;

  try {
    // Load index file
    const indexData = await GitHubAPI.getFile(GITHUB_CONFIG.requestsIndexPath);

    if (!indexData || indexData.content.requests.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>Chưa có request nào</h3>
          <p>Tạo request đầu tiên bằng form ở trên!</p>
        </div>
      `;
      allRequests = [];
      filteredRequests = [];
      return;
    }

    allRequests = indexData.content.requests;
    filteredRequests = [...allRequests];

    renderRequests();
    updateStats();

  } catch (error) {
    console.error('Error loading requests:', error);
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Lỗi tải dữ liệu</h3>
        <p>${error.message}</p>
        <p style="margin-top: 12px;">
          <strong>Lưu ý:</strong> Đảm bảo đã tạo file <code>data/requests-index.json</code> trong repo.
        </p>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════════
// FILTERING & SEARCH
// ══════════════════════════════════════════════════════════════

function applyFilters() {
  const statusFilter = document.getElementById('filterStatus').value;
  const typeFilter = document.getElementById('filterType').value;
  const priorityFilter = document.getElementById('filterPriority').value;
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

  filteredRequests = allRequests.filter(request => {
    // Status filter
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;

    // Type filter
    if (typeFilter !== 'all' && request.type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter !== 'all' && request.priority !== priorityFilter) return false;

    // Search filter
    if (searchQuery) {
      const searchText = `${request.title} ${request.requester}`.toLowerCase();
      if (!searchText.includes(searchQuery)) return false;
    }

    return true;
  });

  renderRequests();
}

// ══════════════════════════════════════════════════════════════
// RENDERING
// ══════════════════════════════════════════════════════════════

function renderRequests() {
  const listContainer = document.getElementById('requestsList');

  if (filteredRequests.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>Không tìm thấy request nào</h3>
        <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filteredRequests.map(request => `
    <div class="request-card priority-${request.priority}" onclick="openRequestDetail('${request.id}')">
      <div class="request-header">
        <h3 class="request-title">${request.title}</h3>
        <span class="request-id">#${request.id}</span>
      </div>

      <div class="request-badges">
        <span class="badge status-${request.status}">${getStatusLabel(request.status)}</span>
        <span class="badge priority-${request.priority}">${getPriorityLabel(request.priority)}</span>
        <span class="badge type">${getTypeLabel(request.type)}</span>
      </div>

      <div class="request-meta">
        <div class="request-meta-item">
          <span>👤</span>
          <span>${request.requester}</span>
        </div>
        ${request.assignee && request.assignee !== 'Unassigned' ? `
          <div class="request-meta-item">
            <span>👨‍💻</span>
            <span>Assigned: ${request.assignee}</span>
          </div>
        ` : ''}
      </div>

      <div class="request-footer">
        <div class="request-date">
          📅 ${formatDate(request.timestamp)}
        </div>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const total = allRequests.length;
  const active = allRequests.filter(r => r.status === 'pending' || r.status === 'in-progress').length;
  const completed = allRequests.filter(r => r.status === 'completed').length;

  document.getElementById('totalRequests').textContent = total;
  document.getElementById('activeRequests').textContent = active;
  document.getElementById('completedRequests').textContent = completed;
}

// ══════════════════════════════════════════════════════════════
// REQUEST DETAIL MODAL
// ══════════════════════════════════════════════════════════════

async function openRequestDetail(requestId) {
  const request = allRequests.find(r => r.id === requestId);
  if (!request) return;

  const modal = document.getElementById('requestModal');
  const modalBody = document.getElementById('modalBody');

  // Show loading
  modalBody.innerHTML = `
    <div class="loading-state">
      <div class="loader"></div>
      <p>Đang tải chi tiết...</p>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    // Load full request details from GitHub
    const fullRequest = await GitHubAPI.getFile(request.path);

    if (!fullRequest) {
      throw new Error('Không tìm thấy request');
    }

    const data = fullRequest.content;

    // Render modal content
    modalBody.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${data.title}</h2>
        <div class="modal-badges">
          <span class="badge status-${data.status}">${getStatusLabel(data.status)}</span>
          <span class="badge priority-${data.priority}">${getPriorityLabel(data.priority)}</span>
          <span class="badge type">${getTypeLabel(data.type)}</span>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Request ID</div>
        <div class="modal-section-content">
          <code style="background: var(--surface2); padding: 4px 8px; border-radius: 4px;">#${data.id}</code>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Người yêu cầu</div>
        <div class="modal-section-content">
          👤 <strong>${data.requester}</strong><br>
          📧 ${data.requesterEmail}
        </div>
      </div>

      ${data.project ? `
        <div class="modal-section">
          <div class="modal-section-title">Dự án liên quan</div>
          <div class="modal-section-content">🗂️ ${data.project}</div>
        </div>
      ` : ''}

      <div class="modal-section">
        <div class="modal-section-title">Mô tả chi tiết</div>
        <div class="modal-section-content" style="white-space: pre-wrap;">${data.description}</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Timeline</div>
        <div class="modal-section-content">
          <div style="display: grid; gap: 8px;">
            <div>📅 <strong>Tạo lúc:</strong> ${formatDateTime(data.createdAt)}</div>
            <div>🔄 <strong>Cập nhật:</strong> ${formatDateTime(data.updatedAt)}</div>
            ${data.deadline ? `<div>⏰ <strong>Deadline:</strong> ${formatDate(data.deadline)}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Phân công</div>
        <div class="modal-section-content">
          <select id="assigneeSelect" class="form-group select" style="width: 100%; padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
            ${GITHUB_CONFIG.teamMembers.map(member => `
              <option value="${member}" ${member === data.assignee ? 'selected' : ''}>${member}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Cập nhật trạng thái</div>
        <div class="modal-section-content">
          <select id="statusSelect" class="form-group select" style="width: 100%; padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
            <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}>🔄 In Progress</option>
            <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
            <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </div>
      </div>

      <div class="modal-actions">
        <button class="modal-btn" onclick="updateRequest('${data.id}', '${request.path}', '${fullRequest.sha}')">
          💾 Lưu thay đổi
        </button>
        <button class="modal-btn danger" onclick="deleteRequest('${data.id}', '${request.path}', '${fullRequest.sha}')">
          🗑️ Xóa request
        </button>
      </div>
    `;

  } catch (error) {
    console.error('Error loading request details:', error);
    modalBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Lỗi tải dữ liệu</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

async function updateRequest(requestId, requestPath, currentSha) {
  try {
    // Get current data
    const fullRequest = await GitHubAPI.getFile(requestPath);
    const data = fullRequest.content;

    // Get new values from modal
    const newStatus = document.getElementById('statusSelect').value;
    const newAssignee = document.getElementById('assigneeSelect').value;

    // Update data
    data.status = newStatus;
    data.assignee = newAssignee;
    data.updatedAt = new Date().toISOString();

    // Save to GitHub
    await GitHubAPI.putFile(
      requestPath,
      data,
      `Update request #${requestId}: status=${newStatus}, assignee=${newAssignee}`,
      fullRequest.sha
    );

    // Update index
    await updateRequestIndexItem(requestId, { status: newStatus, assignee: newAssignee });

    showNotification('success', '✅ Request đã được cập nhật!');
    closeModal();
    await loadRequests();

  } catch (error) {
    console.error('Error updating request:', error);
    showNotification('error', `❌ Lỗi: ${error.message}`);
  }
}

async function updateRequestIndexItem(requestId, updates) {
  const indexData = await GitHubAPI.getFile(GITHUB_CONFIG.requestsIndexPath);

  if (!indexData) return;

  // Find and update request in index
  const requestIndex = indexData.content.requests.findIndex(r => r.id === requestId);
  if (requestIndex !== -1) {
    indexData.content.requests[requestIndex] = {
      ...indexData.content.requests[requestIndex],
      ...updates
    };
    indexData.content.lastUpdated = new Date().toISOString();

    await GitHubAPI.putFile(
      GITHUB_CONFIG.requestsIndexPath,
      indexData.content,
      `Update index for request #${requestId}`,
      indexData.sha
    );
  }
}

async function deleteRequest(requestId, requestPath, sha) {
  if (!confirm('Bạn có chắc muốn xóa request này? Hành động này không thể hoàn tác.')) {
    return;
  }

  try {
    // Delete file from GitHub
    await GitHubAPI.deleteFile(
      requestPath,
      sha,
      `Delete request #${requestId}`
    );

    // Remove from index
    const indexData = await GitHubAPI.getFile(GITHUB_CONFIG.requestsIndexPath);
    if (indexData) {
      indexData.content.requests = indexData.content.requests.filter(r => r.id !== requestId);
      indexData.content.totalCount = indexData.content.requests.length;
      indexData.content.lastUpdated = new Date().toISOString();

      await GitHubAPI.putFile(
        GITHUB_CONFIG.requestsIndexPath,
        indexData.content,
        `Remove request #${requestId} from index`,
        indexData.sha
      );
    }

    showNotification('success', '✅ Request đã được xóa!');
    closeModal();
    await loadRequests();

  } catch (error) {
    console.error('Error deleting request:', error);
    showNotification('error', `❌ Lỗi: ${error.message}`);
  }
}

function closeModal() {
  document.getElementById('requestModal').style.display = 'none';
}

// ══════════════════════════════════════════════════════════════
// NEW REQUEST MODAL
// ══════════════════════════════════════════════════════════════

function openNewRequestModal() {
  document.getElementById('newRequestModal').style.display = 'flex';
  // Focus first input
  setTimeout(() => {
    document.getElementById('requester').focus();
  }, 100);
}

function closeNewRequestModal() {
  document.getElementById('newRequestModal').style.display = 'none';
  // Clear form
  document.getElementById('requestForm').reset();
  document.querySelector('.char-count').textContent = '0/2000';
}

// ══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

function getStatusLabel(status) {
  const labels = {
    'pending': '⏳ Pending',
    'in-progress': '🔄 In Progress',
    'completed': '✅ Completed',
    'cancelled': '❌ Cancelled'
  };
  return labels[status] || status;
}

function getPriorityLabel(priority) {
  const labels = {
    'low': '🟢 Low',
    'medium': '🟡 Medium',
    'high': '🟠 High',
    'critical': '🔴 Critical'
  };
  return labels[priority] || priority;
}

function getTypeLabel(type) {
  const labels = {
    'technical-support': '🔧 Technical Support',
    'proposal': '📋 Proposal',
    'code-review': '🔍 Code Review',
    'architecture': '🏗️ Architecture',
    'rd': '🧪 R&D',
    'training': '📚 Training',
    'other': '📦 Other'
  };
  return labels[type] || type;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function showNotification(type, message) {
  const notification = document.getElementById('notification');
  const icon = notification.querySelector('.notif-icon');
  const text = notification.querySelector('.notif-text');

  // Set icon
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  icon.textContent = icons[type] || 'ℹ️';

  // Set message
  text.textContent = message;

  // Set class
  notification.className = `notification ${type}`;

  // Show notification
  notification.style.display = 'flex';

  // Auto hide after 4 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 4000);
}
