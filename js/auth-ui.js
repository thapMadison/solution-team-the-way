/**
 * Authentication UI — login modal, user menu, change password.
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
          <button class="auth-dropdown__item" id="btnChangePassword" type="button">
            <svg viewBox="0 0 24 24" class="auth-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            <span>Đổi mật khẩu</span>
          </button>
          <button class="auth-dropdown__item auth-dropdown__item--danger" id="btnLogout" type="button">
            <svg viewBox="0 0 24 24" class="auth-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;

    // Login modal
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
              <h2>Chào mừng trở lại</h2>
              <p>Đăng nhập để truy cập Request Log và các tính năng khác</p>
            </div>
            <form id="loginForm" class="auth-form">
              <div class="auth-field">
                <label for="loginEmail">Email</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 6l-10 7L2 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                  <input type="email" id="loginEmail" name="email" required placeholder="email@company.com" autocomplete="email">
                </div>
              </div>
              <div class="auth-field">
                <label for="loginPassword">Mật khẩu</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                  <input type="password" id="loginPassword" name="password" required placeholder="••••••••" autocomplete="current-password">
                </div>
              </div>
              <div class="auth-error" id="loginError" hidden></div>
              <div class="auth-field auth-field--actions">
                <button type="submit" class="auth-btn auth-btn--primary" id="btnLoginSubmit">
                  <span class="btn-text">Đăng nhập</span>
                  <span class="btn-loader" hidden>
                    <span class="auth-spinner"></span> Đang xử lý...
                  </span>
                </button>
              </div>
              <div class="auth-link">
                <a href="#" id="linkForgotPassword">Quên mật khẩu?</a>
              </div>
            </form>
          </div>
        </div>
      `);
    }

    // Change password modal
    if (!document.getElementById('changePasswordModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="changePasswordModal" class="auth-modal" hidden>
          <div class="modal-overlay" data-action="close-change-password"></div>
          <div class="modal-content modal-content--auth">
            <button class="modal-close" data-action="close-change-password" aria-label="Đóng">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <div class="auth-modal__brand">
              <div class="auth-modal__logo">
                <svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
              </div>
            </div>
            <div class="auth-modal__head">
              <h2>Đổi mật khẩu</h2>
              <p>Tạo mật khẩu mới để bảo mật tài khoản của bạn</p>
            </div>
            <form id="changePasswordForm" class="auth-form">
              <div class="auth-field">
                <label for="currentPassword">Mật khẩu hiện tại</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                  <input type="password" id="currentPassword" name="currentPassword" required placeholder="••••••••" autocomplete="current-password">
                </div>
              </div>
              <div class="auth-field">
                <label for="newPassword">Mật khẩu mới</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                  <input type="password" id="newPassword" name="newPassword" required placeholder="••••••••" minlength="8" autocomplete="new-password">
                </div>
                <small>Tối thiểu 8 ký tự</small>
              </div>
              <div class="auth-field">
                <label for="confirmPassword">Xác nhận mật khẩu mới</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="••••••••" autocomplete="new-password">
                </div>
              </div>
              <div class="auth-error" id="changePasswordError" hidden></div>
              <div class="auth-field auth-field--actions">
                <button type="submit" class="auth-btn auth-btn--primary" id="btnChangePasswordSubmit">
                  <span class="btn-text">Cập nhật mật khẩu</span>
                  <span class="btn-loader" hidden>
                    <span class="auth-spinner"></span> Đang xử lý...
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `);
    }

    // Forgot password modal
    if (!document.getElementById('forgotPasswordModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="forgotPasswordModal" class="auth-modal" hidden>
          <div class="modal-overlay" data-action="close-forgot-password"></div>
          <div class="modal-content modal-content--auth">
            <button class="modal-close" data-action="close-forgot-password" aria-label="Đóng">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <div class="auth-modal__brand">
              <div class="auth-modal__logo">
                <svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
            </div>
            <div class="auth-modal__head">
              <h2>Quên mật khẩu</h2>
              <p>Nhập email và chúng tôi sẽ gửi link đặt lại mật khẩu</p>
            </div>
            <form id="forgotPasswordForm" class="auth-form">
              <div class="auth-field">
                <label for="forgotEmail">Email</label>
                <div class="auth-input-wrap">
                  <svg viewBox="0 0 24 24" class="auth-input-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 6l-10 7L2 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                  <input type="email" id="forgotEmail" name="email" required placeholder="email@company.com" autocomplete="email">
                </div>
              </div>
              <div class="auth-error" id="forgotPasswordError" hidden></div>
              <div class="auth-success" id="forgotPasswordSuccess" hidden></div>
              <div class="auth-field auth-field--actions">
                <button type="submit" class="auth-btn auth-btn--primary" id="btnForgotSubmit">
                  <span class="btn-text">Gửi link đặt lại</span>
                  <span class="btn-loader" hidden>
                    <span class="auth-spinner"></span> Đang xử lý...
                  </span>
                </button>
              </div>
              <div class="auth-link">
                <a href="#" id="linkBackToLogin">← Quay lại đăng nhập</a>
              </div>
            </form>
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
    dom.btnChangePassword = document.getElementById('btnChangePassword');
    dom.btnLogout = document.getElementById('btnLogout');

    dom.loginModal = document.getElementById('loginModal');
    dom.loginForm = document.getElementById('loginForm');
    dom.loginError = document.getElementById('loginError');
    dom.btnLoginSubmit = document.getElementById('btnLoginSubmit');

    dom.changePasswordModal = document.getElementById('changePasswordModal');
    dom.changePasswordForm = document.getElementById('changePasswordForm');
    dom.changePasswordError = document.getElementById('changePasswordError');
    dom.btnChangePasswordSubmit = document.getElementById('btnChangePasswordSubmit');

    dom.forgotPasswordModal = document.getElementById('forgotPasswordModal');
    dom.forgotPasswordForm = document.getElementById('forgotPasswordForm');
    dom.forgotPasswordError = document.getElementById('forgotPasswordError');
    dom.forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess');

    dom.linkForgotPassword = document.getElementById('linkForgotPassword');
    dom.linkBackToLogin = document.getElementById('linkBackToLogin');
  }

  function wireEvents() {
    // Login button
    dom.btnLogin?.addEventListener('click', openLoginModal);

    // User menu toggle
    dom.btnUserMenu?.addEventListener('click', toggleUserMenu);
    document.addEventListener('click', (e) => {
      if (!dom.authDropdown?.hidden && !e.target.closest('.auth-user')) {
        dom.authDropdown.hidden = true;
      }
    });

    // Logout
    dom.btnLogout?.addEventListener('click', handleLogout);

    // Change password
    dom.btnChangePassword?.addEventListener('click', () => {
      dom.authDropdown.hidden = true;
      openChangePasswordModal();
    });

    // Login form
    dom.loginForm?.addEventListener('submit', handleLogin);

    // Change password form
    dom.changePasswordForm?.addEventListener('submit', handleChangePassword);

    // Forgot password form
    dom.forgotPasswordForm?.addEventListener('submit', handleForgotPassword);

    // Forgot password link
    dom.linkForgotPassword?.addEventListener('click', (e) => {
      e.preventDefault();
      closeLoginModal();
      openForgotPasswordModal();
    });

    // Back to login link
    dom.linkBackToLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      closeForgotPasswordModal();
      openLoginModal();
    });

    // Modal close buttons (delegation)
    document.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'close-login') closeLoginModal();
      if (action === 'close-change-password') closeChangePasswordModal();
      if (action === 'close-forgot-password') closeForgotPasswordModal();
    });

    // ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!dom.loginModal?.hidden) closeLoginModal();
      if (!dom.changePasswordModal?.hidden) closeChangePasswordModal();
      if (!dom.forgotPasswordModal?.hidden) closeForgotPasswordModal();
    });
  }

  // ── Modal helpers ─────────────────────────────────────────────

  function openLoginModal() {
    dom.loginModal.hidden = false;
    dom.loginForm.reset();
    dom.loginError.hidden = true;
    dom.loginForm.querySelector('input')?.focus();
  }

  function closeLoginModal() {
    dom.loginModal.hidden = true;
  }

  function openChangePasswordModal() {
    dom.changePasswordModal.hidden = false;
    dom.changePasswordForm.reset();
    dom.changePasswordError.hidden = true;
    dom.changePasswordForm.querySelector('input')?.focus();
  }

  function closeChangePasswordModal() {
    dom.changePasswordModal.hidden = true;
  }

  function openForgotPasswordModal() {
    dom.forgotPasswordModal.hidden = false;
    dom.forgotPasswordForm.reset();
    dom.forgotPasswordError.hidden = true;
    dom.forgotPasswordSuccess.hidden = true;
    dom.forgotPasswordForm.querySelector('input')?.focus();
  }

  function closeForgotPasswordModal() {
    dom.forgotPasswordModal.hidden = true;
  }

  function toggleUserMenu() {
    dom.authDropdown.hidden = !dom.authDropdown.hidden;
  }

  // ── Handlers ──────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault();
    const email = dom.loginForm.email.value.trim();
    const password = dom.loginForm.password.value;

    setLoading(dom.btnLoginSubmit, true);
    dom.loginError.hidden = true;

    try {
      await AuthService.signIn(email, password);
      closeLoginModal();
      notify('Đăng nhập thành công', 'success');
    } catch (err) {
      dom.loginError.textContent = mapAuthError(err);
      dom.loginError.hidden = false;
    } finally {
      setLoading(dom.btnLoginSubmit, false);
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

  async function handleChangePassword(e) {
    e.preventDefault();
    const currentPassword = dom.changePasswordForm.currentPassword.value;
    const newPassword = dom.changePasswordForm.newPassword.value;
    const confirmPassword = dom.changePasswordForm.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      dom.changePasswordError.textContent = 'Mật khẩu mới không khớp';
      dom.changePasswordError.hidden = false;
      return;
    }

    if (newPassword.length < 8) {
      dom.changePasswordError.textContent = 'Mật khẩu mới phải có ít nhất 8 ký tự';
      dom.changePasswordError.hidden = false;
      return;
    }

    setLoading(dom.btnChangePasswordSubmit, true);
    dom.changePasswordError.hidden = true;

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      closeChangePasswordModal();
      notify('Đổi mật khẩu thành công', 'success');
    } catch (err) {
      dom.changePasswordError.textContent = mapAuthError(err);
      dom.changePasswordError.hidden = false;
    } finally {
      setLoading(dom.btnChangePasswordSubmit, false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    const email = dom.forgotPasswordForm.email.value.trim();

    setLoading(document.getElementById('btnForgotSubmit'), true);
    dom.forgotPasswordError.hidden = true;
    dom.forgotPasswordSuccess.hidden = true;

    try {
      await AuthService.sendPasswordReset(email);
      dom.forgotPasswordSuccess.textContent = 'Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư của bạn.';
      dom.forgotPasswordSuccess.hidden = false;
    } catch (err) {
      dom.forgotPasswordError.textContent = mapAuthError(err);
      dom.forgotPasswordError.hidden = false;
    } finally {
      setLoading(document.getElementById('btnForgotSubmit'), false);
    }
  }

  // ── UI Updates ────────────────────────────────────────────────

  function updateUI(user, profile) {
    // Update auth buttons
    if (user && profile) {
      dom.btnLogin.hidden = true;
      dom.authUser.hidden = false;
      dom.userAvatar.textContent = getInitials(profile.displayName || user.email);
      dom.userName.textContent = profile.displayName || user.email.split('@')[0];
      dom.userEmail.textContent = user.email;
      dom.userRole.textContent = profile.role === 'solution-team' ? 'Solution Team' : 'User';
      dom.userRole.className = 'auth-dropdown__role' + (profile.role === 'solution-team' ? ' is-team' : '');
    } else {
      dom.btnLogin.hidden = false;
      dom.authUser.hidden = true;
    }

    // Show/hide Request Log link based on auth state
    // Link is hidden by default in CSS, add .is-visible when logged in
    const requestLogLink = document.querySelector('.nav-links a[href="requests-log.html"]');
    if (requestLogLink) {
      requestLogLink.classList.toggle('is-visible', !!user);
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
    if (code === 'auth/user-not-found') return 'Email không tồn tại';
    if (code === 'auth/wrong-password') return 'Mật khẩu không đúng';
    if (code === 'auth/invalid-email') return 'Email không hợp lệ';
    if (code === 'auth/user-disabled') return 'Tài khoản đã bị vô hiệu hóa';
    if (code === 'auth/too-many-requests') return 'Quá nhiều lần thử. Vui lòng thử lại sau.';
    if (code === 'auth/weak-password') return 'Mật khẩu quá yếu';
    if (code === 'auth/requires-recent-login') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
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

    // Listen for auth state changes
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
    closeLoginModal,
    openChangePasswordModal,
    closeChangePasswordModal
  };
})(window);
