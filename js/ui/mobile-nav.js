/**
 * Hamburger menu for mobile viewport. Injects a slide-out panel that mirrors
 * the desktop nav and proxies clicks to the desktop login / user menu buttons.
 */

export function initMobileNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const hamburger = createHamburger();
  nav.appendChild(hamburger);

  const navLinks = nav.querySelector('.nav-links.nav-main');
  const links = navLinks ? Array.from(navLinks.querySelectorAll('a')) : [];

  const menu = createMenu(links);
  document.body.appendChild(menu);

  syncThemeToggle(menu);
  wireEvents(nav, menu, hamburger);
}

function createHamburger() {
  const btn = document.createElement('button');
  btn.className = 'nav-hamburger';
  btn.setAttribute('aria-label', 'Menu');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
  return btn;
}

function createMenu(links) {
  const menu = document.createElement('div');
  menu.className = 'nav-mobile-menu';
  menu.innerHTML = `
    <div class="nav-mobile-menu__overlay"></div>
    <div class="nav-mobile-menu__panel">
      <div class="nav-mobile-menu__header">
        <span class="nav-mobile-menu__title">Menu</span>
        <button class="nav-mobile-menu__close" aria-label="Đóng">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <ul class="nav-mobile-menu__links">
        ${links.map((link) => `<li><a href="${link.getAttribute('href')}" class="${link.classList.contains('active') ? 'active' : ''}">${link.textContent}</a></li>`).join('')}
      </ul>
      <div class="nav-mobile-menu__footer">
        <div class="nav-mobile-menu__auth"></div>
        <button class="theme-toggle" id="mobileThemeToggle" title="Chuyển chế độ sáng/tối">🌙</button>
      </div>
    </div>
  `;
  return menu;
}

function syncThemeToggle(menu) {
  const mobileBtn = menu.querySelector('#mobileThemeToggle');
  const desktopBtn = document.getElementById('themeToggle');
  if (!mobileBtn || !desktopBtn) return;

  mobileBtn.textContent = desktopBtn.textContent;
  mobileBtn.addEventListener('click', () => {
    desktopBtn.click();
    mobileBtn.textContent = desktopBtn.textContent;
  });
}

function wireEvents(nav, menu, hamburger) {
  const overlay = menu.querySelector('.nav-mobile-menu__overlay');
  const close   = menu.querySelector('.nav-mobile-menu__close');

  const openMenu = () => {
    menu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    copyAuthIntoMenu(nav, menu);
  };

  const closeMenu = () => {
    menu.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  hamburger.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  close.addEventListener('click', closeMenu);

  menu.querySelectorAll('.nav-mobile-menu__links a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
  });
}

function copyAuthIntoMenu(nav, menu) {
  const authContainer = nav.querySelector('.nav-auth');
  const mobileAuth    = menu.querySelector('.nav-mobile-menu__auth');
  if (!authContainer || !mobileAuth) return;

  mobileAuth.innerHTML = authContainer.innerHTML;

  const closeMenu = () => {
    menu.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  // Re-bind login/user menu buttons inside the cloned auth HTML so they
  // dismiss the panel and trigger their desktop counterparts.
  const proxy = (id) => {
    const mobileBtn = mobileAuth.querySelector('#' + id);
    if (!mobileBtn) return;
    mobileBtn.addEventListener('click', () => {
      closeMenu();
      nav.querySelector('#' + id)?.click();
    });
  };
  proxy('btnLogin');
  proxy('btnUserMenu');
}
