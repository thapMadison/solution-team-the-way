/**
 * Page-level access control.
 *
 * Restricts access based on user role:
 *   - Guest: can only view index.html, request-process.html
 *   - User: can view requests-log.html (limited features)
 *   - Solution Team: full access
 *
 * This script should be loaded on restricted pages (requests-log.html).
 * Shows login modal if user is not authenticated.
 */
(function (global) {
  'use strict';

  const RESTRICTED_PAGES = ['requests-log.html'];
  const PUBLIC_PAGES = ['index.html', 'request-process.html'];

  function isRestrictedPage() {
    const path = window.location.pathname;
    return RESTRICTED_PAGES.some((p) => path.endsWith(p));
  }

  function showAccessDenied() {
    const main = document.querySelector('main') || document.querySelector('.rl-main');
    if (!main) return;

    main.innerHTML = `
      <div class="access-denied">
        <div class="access-denied__icon">🔒</div>
        <h1>Yêu cầu đăng nhập</h1>
        <p>Bạn cần đăng nhập để xem Request Log.</p>
        <button class="auth-btn auth-btn--primary" id="btnAccessLogin" type="button">
          Đăng nhập
        </button>
        <p class="access-denied__hint">
          Hoặc quay về <a href="index.html">trang chủ</a>
        </p>
      </div>
    `;

    document.getElementById('btnAccessLogin')?.addEventListener('click', () => {
      if (global.AuthUI) AuthUI.openLoginModal();
    });
  }

  function showPageContent() {
    const main = document.querySelector('main') || document.querySelector('.rl-main');
    if (main) main.style.opacity = '1';
  }

  function hidePageContent() {
    const main = document.querySelector('main') || document.querySelector('.rl-main');
    if (main) main.style.opacity = '0';
  }

  function checkAccess(user, profile) {
    if (!isRestrictedPage()) {
      showPageContent();
      return;
    }

    if (!user) {
      hidePageContent();
      showAccessDenied();
      return;
    }

    // User is logged in — show content
    showPageContent();

    // Update UI based on role
    updateRoleBasedUI(profile);
  }

  function updateRoleBasedUI(profile) {
    const isSolutionTeam = profile && profile.role === 'solution-team';

    // Hide/show Allocation button based on role
    const btnAllocation = document.getElementById('btnAllocation');
    if (btnAllocation) {
      btnAllocation.style.display = isSolutionTeam ? '' : 'none';
    }

    // Add role class to body for CSS-based hiding
    document.body.classList.remove('role-guest', 'role-user', 'role-solution-team');
    if (profile) {
      document.body.classList.add('role-' + profile.role);
    } else {
      document.body.classList.add('role-guest');
    }
  }

  function bootstrap() {
    if (!global.AuthService) {
      console.warn('[access-control] AuthService not loaded');
      showPageContent();
      return;
    }

    // Initially hide content on restricted pages until auth check completes
    if (isRestrictedPage()) {
      hidePageContent();
    }

    AuthService.onAuthChange(checkAccess);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  global.AccessControl = {
    isRestrictedPage,
    checkAccess,
    updateRoleBasedUI
  };
})(window);
