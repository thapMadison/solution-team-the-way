/**
 * Page-level access control. Hides Request Log content for guests and shows
 * a login prompt. Toggles role classes on <body> so CSS can hide elements
 * per role.
 */

import * as Auth          from './auth-service.js';
import { openLoginModal } from './auth-ui.js';

const RESTRICTED_PAGES = ['requests-log.html'];

function isRestrictedPage() {
  const path = window.location.pathname;
  return RESTRICTED_PAGES.some((p) => path.endsWith(p));
}

function mainEl() {
  return document.querySelector('main') || document.querySelector('.rl-main');
}

function showAccessDenied() {
  const main = mainEl();
  if (!main) return;

  main.innerHTML = `
    <div class="access-denied">
      <div class="access-denied__icon">🔒</div>
      <h1>Yêu cầu đăng nhập</h1>
      <p>Bạn cần đăng nhập để xem Request Log.</p>
      <button class="auth-btn auth-btn--primary" id="btnAccessLogin" type="button">
        Đăng nhập
      </button>
      <p class="access-denied__hint">Hoặc quay về <a href="index.html">trang chủ</a></p>
    </div>
  `;

  document.getElementById('btnAccessLogin')?.addEventListener('click', openLoginModal);
}

function setMainOpacity(value) {
  const main = mainEl();
  if (main) main.style.opacity = value;
}

function updateRoleBasedUI(profile) {
  const isSolutionTeam = profile?.role === 'solution-team';

  const btnAllocation = document.getElementById('btnAllocation');
  if (btnAllocation) btnAllocation.style.display = isSolutionTeam ? '' : 'none';

  document.body.classList.remove('role-guest', 'role-user', 'role-solution-team');
  document.body.classList.add(profile ? 'role-' + profile.role : 'role-guest');
}

function checkAccess(user, profile) {
  if (!isRestrictedPage()) { setMainOpacity('1'); return; }

  if (!user) {
    showAccessDenied();
    setMainOpacity('1');   // Reveal the access-denied screen
    return;
  }

  setMainOpacity('1');
  updateRoleBasedUI(profile);
}

export function initAccessControl() {
  if (isRestrictedPage()) setMainOpacity('0');
  Auth.onAuthChange(checkAccess);
}
