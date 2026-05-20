/**
 * Authentication UI — Microsoft OAuth login button, user menu, login modal.
 * Injects markup into <nav> and <body>, then wires events.
 */

import * as Auth                 from './auth-service.js';
import { initials }              from '../../core/format.js';
import { showNotification }      from '../../core/notifications.js';

const dom = {};

const LOGIN_BTN_HTML = `
  <button class="auth-btn auth-btn--login" id="btnLogin" type="button">
    <svg viewBox="0 0 24 24" class="auth-icon"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>Login</span>
  </button>
  <div class="auth-user" id="authUser" hidden>
    <button class="auth-user__btn" id="btnUserMenu" type="button">
      <span class="auth-user__avatar" id="userAvatar">?</span>
      <span class="auth-user__name" id="userName">User</span>
      <svg viewBox="0 0 24 24" class="auth-icon auth-icon--xs"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="auth-dropdown" id="authDropdown" hidden>
      <div class="auth-dropdown__header">
        <span class="auth-dropdown__email" id="userEmail">user@example.com</span>
        <span class="auth-dropdown__role" id="userRole">User</span>
      </div>
      <div class="auth-dropdown__sep"></div>
      <button class="auth-dropdown__item auth-dropdown__item--danger" id="btnLogout" type="button">
        <svg viewBox="0 0 24 24" class="auth-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Đăng xuất</span>
      </button>
    </div>
  </div>
`;

const LOGIN_MODAL_HTML = `
  <div id="loginModal" class="auth-modal" hidden>
    <div class="modal-overlay" data-action="close-login"></div>
    <div class="modal-content modal-content--auth">
      <button class="modal-close" data-action="close-login" aria-label="Đóng">
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="auth-modal__brand">
        <div class="auth-modal__logo">
          <svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>
        </div>
      </div>
      <div class="auth-modal__head">
        <h2>Chào mừng</h2>
        <p>Đăng nhập bằng tài khoản Microsoft để truy cập Request Log và các tính năng khác</p>
      </div>
      <div class="auth-form">
        <div class="auth-error" id="loginError" hidden></div>
        <button type="button" class="auth-btn auth-btn--microsoft" id="btnMicrosoftLogin">
          <svg viewBox="0 0 21 21" width="20" height="20" class="microsoft-logo">
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span class="btn-text">Đăng nhập với Microsoft</span>
          <span class="btn-loader" hidden><span class="auth-spinner"></span></span>
        </button>
      </div>
    </div>
  </div>
`;

// ── Inject markup ─────────────────────────────────────────────

function injectAuthUI() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  let authContainer = nav.querySelector('.nav-auth');
  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.className = 'nav-auth';
    const themeToggle = nav.querySelector('.theme-toggle');
    if (themeToggle) nav.insertBefore(authContainer, themeToggle);
    else             nav.appendChild(authContainer);
  }

  authContainer.innerHTML = LOGIN_BTN_HTML;

  if (!document.getElementById('loginModal')) {
    document.body.insertAdjacentHTML('beforeend', LOGIN_MODAL_HTML);
  }

  cacheDom();
  wireEvents();
}

function cacheDom() {
  dom.btnLogin          = document.getElementById('btnLogin');
  dom.authUser          = document.getElementById('authUser');
  dom.btnUserMenu       = document.getElementById('btnUserMenu');
  dom.authDropdown      = document.getElementById('authDropdown');
  dom.userAvatar        = document.getElementById('userAvatar');
  dom.userName          = document.getElementById('userName');
  dom.userEmail         = document.getElementById('userEmail');
  dom.userRole          = document.getElementById('userRole');
  dom.btnLogout         = document.getElementById('btnLogout');
  dom.loginModal        = document.getElementById('loginModal');
  dom.loginError        = document.getElementById('loginError');
  dom.btnMicrosoftLogin = document.getElementById('btnMicrosoftLogin');
}

function wireEvents() {
  dom.btnLogin?.addEventListener('click', openLoginModal);
  dom.btnMicrosoftLogin?.addEventListener('click', handleMicrosoftLogin);
  dom.btnUserMenu?.addEventListener('click', toggleUserMenu);
  dom.btnLogout?.addEventListener('click', handleLogout);

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!dom.authDropdown?.hidden && !e.target.closest('.auth-user')) {
      dom.authDropdown.hidden = true;
    }
  });

  // Modal close (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')?.dataset.action === 'close-login') {
      closeLoginModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.loginModal?.hidden) closeLoginModal();
  });
}

// ── Modal control ─────────────────────────────────────────────

export function openLoginModal() {
  dom.loginModal.hidden = false;
  dom.loginError.hidden = true;
}

export function closeLoginModal() {
  dom.loginModal.hidden = true;
}

function toggleUserMenu() {
  dom.authDropdown.hidden = !dom.authDropdown.hidden;
}

// ── Handlers ──────────────────────────────────────────────────

async function handleMicrosoftLogin() {
  setLoading(dom.btnMicrosoftLogin, true);
  dom.loginError.hidden = true;

  try {
    await Auth.signInWithMicrosoft();
    closeLoginModal();
    showNotification('success', 'Đăng nhập thành công');
  } catch (err) {
    console.error('[auth] Microsoft login failed:', err);
    dom.loginError.textContent = mapAuthError(err);
    dom.loginError.hidden = false;
  } finally {
    setLoading(dom.btnMicrosoftLogin, false);
  }
}

async function handleLogout() {
  dom.authDropdown.hidden = true;
  try {
    await Auth.signOut();
    showNotification('info', 'Đã đăng xuất');
    if (window.location.pathname.includes('requests-log')) {
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error(err);
    showNotification('error', 'Đăng xuất thất bại');
  }
}

// ── Rendering ─────────────────────────────────────────────────

function renderAuthState(data) {
  // CSS uses this class to toggle Request Log link visibility in nav.
  document.documentElement.classList.toggle('is-logged-in', !!data);

  if (data) {
    dom.btnLogin.hidden  = true;
    dom.authUser.hidden  = false;
    dom.userAvatar.textContent = initials(data.displayName || data.email);
    dom.userName.textContent   = data.displayName || data.email.split('@')[0];
    dom.userEmail.textContent  = data.email;
    dom.userRole.textContent   = data.role === 'solution-team' ? 'Solution Team' : 'User';
    dom.userRole.className     = 'auth-dropdown__role' + (data.role === 'solution-team' ? ' is-team' : '');
  } else {
    dom.btnLogin.hidden  = false;
    dom.authUser.hidden  = true;
  }
}

function renderFromCache() {
  const cache = Auth.getCache();
  if (!cache) return;
  renderAuthState({
    email:       cache.email,
    displayName: cache.displayName,
    role:        cache.role
  });
}

function updateUI(user, profile) {
  renderAuthState(user ? {
    email:       user.email,
    displayName: profile?.displayName || user.displayName || user.email.split('@')[0],
    role:        profile?.role || 'user'
  } : null);
}

// ── Helpers ───────────────────────────────────────────────────

function setLoading(btn, loading) {
  if (!btn) return;
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.hidden   = loading;
  if (loader) loader.hidden = !loading;
}

function mapAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user')                    return 'Đăng nhập bị hủy';
  if (code === 'auth/popup-blocked')                           return 'Popup bị chặn. Vui lòng cho phép popup.';
  if (code === 'auth/cancelled-popup-request')                 return 'Đăng nhập bị hủy';
  if (code === 'auth/account-exists-with-different-credential') return 'Email đã được sử dụng với phương thức đăng nhập khác';
  if (code === 'auth/user-disabled')                           return 'Tài khoản đã bị vô hiệu hóa';
  return err?.message || 'Đã có lỗi xảy ra';
}

// ── Bootstrap ─────────────────────────────────────────────────

export function initAuthUI() {
  injectAuthUI();
  renderFromCache();          // Paint immediately from cache — no flicker
  Auth.onAuthChange(updateUI); // Then refresh from Firebase verification
}
