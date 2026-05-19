/**
 * Authentication UI — Microsoft OAuth login, user menu.
 *
 * Injects UI into nav and handles all auth-related user interactions.
 * Depends on: AuthService, Utils (optional for notifications).
 */
(function (global) {
  'use strict';

  const dom = {};

  // ── Inject HTML ───────────────────────────────────────────────

  function injectAuthUI() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Find or create the auth container (before theme toggle)
    let authContainer = nav.querySelector('.nav-auth');
    if (!authContainer) {
      authContainer = document.createElement('div');
      authContainer.className = 'nav-auth';
      const themeToggle = nav.querySelector('.theme-toggle');
      if (themeToggle) {
        nav.insertBefore(authContainer, themeToggle);
      } else {
        nav.appendChild(authContainer);
      }
    }

    authContainer.innerHTML = `
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

    // Login modal with Microsoft button
    if (!document.getElementById('loginModal')) {
      document.body.insertAdjacentHTML('beforeend', `
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
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                <span class="btn-text">Đăng nhập với Microsoft</span>
                <span class="btn-loader" hidden>
                  <span class="auth-spinner"></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      `);
    }

    cacheDom();
    wireEvents();
  }

  function cacheDom() {
    dom.btnLogin = document.getElementById('btnLogin');
    dom.authUser = document.getElementById('authUser');
    dom.btnUserMenu = document.getElementById('btnUserMenu');
    dom.authDropdown = document.getElementById('authDropdown');
    dom.userAvatar = document.getElementById('userAvatar');
    dom.userName = document.getElementById('userName');
    dom.userEmail = document.getElementById('userEmail');
    dom.userRole = document.getElementById('userRole');
    dom.btnLogout = document.getElementById('btnLogout');

    dom.loginModal = document.getElementById('loginModal');
    dom.loginError = document.getElementById('loginError');
    dom.btnMicrosoftLogin = document.getElementById('btnMicrosoftLogin');
  }

  function wireEvents() {
    // Login button
    dom.btnLogin?.addEventListener('click', openLoginModal);

    // Microsoft login
    dom.btnMicrosoftLogin?.addEventListener('click', handleMicrosoftLogin);

    // User menu toggle
    dom.btnUserMenu?.addEventListener('click', toggleUserMenu);
    document.addEventListener('click', (e) => {
      if (!dom.authDropdown?.hidden && !e.target.closest('.auth-user')) {
        dom.authDropdown.hidden = true;
      }
    });

    // Logout
    dom.btnLogout?.addEventListener('click', handleLogout);

    // Modal close buttons (delegation)
    document.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'close-login') closeLoginModal();
    });

    // ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.loginModal?.hidden) {
        closeLoginModal();
      }
    });
  }

  // ── Modal helpers ─────────────────────────────────────────────

  function openLoginModal() {
    dom.loginModal.hidden = false;
    dom.loginError.hidden = true;
  }

  function closeLoginModal() {
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
      await AuthService.signInWithMicrosoft();
      closeLoginModal();
      notify('Đăng nhập thành công', 'success');
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
      await AuthService.signOut();
      notify('Đã đăng xuất', 'info');
      // Redirect to index if on restricted page
      if (window.location.pathname.includes('requests-log')) {
        window.location.href = 'index.html';
      }
    } catch (err) {
      console.error(err);
      notify('Đăng xuất thất bại', 'error');
    }
  }

  // ── UI Updates ────────────────────────────────────────────────

  function updateUI(user, profile) {
    renderAuthState(user ? {
      email: user.email,
      displayName: profile?.displayName || user.displayName || user.email.split('@')[0],
      role: profile?.role || 'user'
    } : null);
  }

  function renderAuthState(data) {
    // Sync html.is-logged-in class (CSS uses this for Request Log link visibility)
    document.documentElement.classList.toggle('is-logged-in', !!data);

    if (data) {
      dom.btnLogin.hidden = true;
      dom.authUser.hidden = false;
      dom.userAvatar.textContent = getInitials(data.displayName || data.email);
      dom.userName.textContent = data.displayName || data.email.split('@')[0];
      dom.userEmail.textContent = data.email;
      dom.userRole.textContent = data.role === 'solution-team' ? 'Solution Team' : 'User';
      dom.userRole.className = 'auth-dropdown__role' + (data.role === 'solution-team' ? ' is-team' : '');
    } else {
      dom.btnLogin.hidden = false;
      dom.authUser.hidden = true;
    }
  }

  function renderFromCache() {
    if (!global.AuthService) return;
    const cache = AuthService.getCache();
    if (cache) {
      renderAuthState({
        email: cache.email,
        displayName: cache.displayName,
        role: cache.role
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (text) text.hidden = loading;
    if (loader) loader.hidden = !loading;
  }

  function mapAuthError(err) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user') return 'Đăng nhập bị hủy';
    if (code === 'auth/popup-blocked') return 'Popup bị chặn. Vui lòng cho phép popup.';
    if (code === 'auth/cancelled-popup-request') return 'Đăng nhập bị hủy';
    if (code === 'auth/account-exists-with-different-credential') return 'Email đã được sử dụng với phương thức đăng nhập khác';
    if (code === 'auth/user-disabled') return 'Tài khoản đã bị vô hiệu hóa';
    return err?.message || 'Đã có lỗi xảy ra';
  }

  function notify(text, type) {
    if (global.Utils && Utils.showNotification) {
      Utils.showNotification(type || 'info', text);
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────

  function bootstrap() {
    injectAuthUI();

    // Render immediately from cache (no flicker)
    renderFromCache();

    // Then listen for Firebase verification
    if (global.AuthService) {
      AuthService.onAuthChange(updateUI);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  global.AuthUI = {
    openLoginModal,
    closeLoginModal
  };
})(window);
