/**
 * Cross-page UI behaviors: theme toggle, sub-nav scroll spy, fade-in observer.
 * Auto-initialized on DOMContentLoaded — assumes IDs/classes used in the HTML.
 */
(function () {
  'use strict';

  const THEME_KEY = 'theme';
  const LIGHT     = 'light';

  function initTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const html = document.documentElement;
    const stored = localStorage.getItem(THEME_KEY);

    if (stored === LIGHT) {
      html.dataset.theme = LIGHT;
      toggle.textContent = '☀️';
    }

    toggle.addEventListener('click', () => {
      const isLight = html.dataset.theme === LIGHT;
      html.dataset.theme = isLight ? '' : LIGHT;
      toggle.textContent = isLight ? '🌙' : '☀️';
      localStorage.setItem(THEME_KEY, isLight ? 'dark' : LIGHT);
    });
  }

  function initFadeIn() {
    const targets = document.querySelectorAll('.fade-in');
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('.bar-fill').forEach((bar) => {
          const width = bar.dataset.width;
          if (width) bar.style.width = `${width}%`;
        });
      });
    }, { threshold: 0.12 });

    targets.forEach((el) => observer.observe(el));

    document.querySelectorAll('.bar-fill').forEach((bar) => {
      if (bar.dataset.width && bar.closest('.visible')) {
        bar.style.width = `${bar.dataset.width}%`;
      }
    });
  }

  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const links    = document.querySelectorAll('.subnav-link');
    if (!sections.length || !links.length) return;

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const match = document.querySelector(`.subnav-link[href="#${entry.target.id}"]`);
        if (match) match.classList.add('active');
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach((s) => spy.observe(s));
  }

  function initMobileNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Create hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'nav-hamburger';
    hamburger.setAttribute('aria-label', 'Menu');
    hamburger.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`;

    // Append hamburger at the end so it sits on the right edge
    nav.appendChild(hamburger);

    // Get nav links
    const navLinks = nav.querySelector('.nav-links.nav-main');
    const links = navLinks ? Array.from(navLinks.querySelectorAll('a')) : [];

    // Create mobile menu
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
          ${links.map(link => `<li><a href="${link.getAttribute('href')}" class="${link.classList.contains('active') ? 'active' : ''}">${link.textContent}</a></li>`).join('')}
        </ul>
        <div class="nav-mobile-menu__footer">
          <div class="nav-mobile-menu__auth"></div>
          <button class="theme-toggle" id="mobileThemeToggle" title="Chuyển chế độ sáng/tối">🌙</button>
        </div>
      </div>
    `;
    document.body.appendChild(menu);

    // Sync theme toggle state
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const desktopThemeToggle = document.getElementById('themeToggle');
    if (mobileThemeToggle && desktopThemeToggle) {
      mobileThemeToggle.textContent = desktopThemeToggle.textContent;
      mobileThemeToggle.addEventListener('click', () => {
        desktopThemeToggle.click();
        mobileThemeToggle.textContent = desktopThemeToggle.textContent;
      });
    }

    // Event handlers
    const openMenu = () => {
      menu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      // Copy auth state to mobile menu
      const authContainer = nav.querySelector('.nav-auth');
      const mobileAuth = menu.querySelector('.nav-mobile-menu__auth');
      if (authContainer && mobileAuth) {
        mobileAuth.innerHTML = authContainer.innerHTML;
        // Re-attach event listeners for mobile auth
        const mobileLoginBtn = mobileAuth.querySelector('#btnLogin');
        const mobileUserBtn = mobileAuth.querySelector('#btnUserMenu');
        if (mobileLoginBtn) {
          mobileLoginBtn.addEventListener('click', () => {
            closeMenu();
            const desktopBtn = nav.querySelector('#btnLogin');
            if (desktopBtn) desktopBtn.click();
          });
        }
        if (mobileUserBtn) {
          mobileUserBtn.addEventListener('click', () => {
            closeMenu();
            const desktopBtn = nav.querySelector('#btnUserMenu');
            if (desktopBtn) desktopBtn.click();
          });
        }
      }
    };

    const closeMenu = () => {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
    };

    hamburger.addEventListener('click', openMenu);
    menu.querySelector('.nav-mobile-menu__overlay').addEventListener('click', closeMenu);
    menu.querySelector('.nav-mobile-menu__close').addEventListener('click', closeMenu);

    // Close on link click
    menu.querySelectorAll('.nav-mobile-menu__links a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFadeIn();
    initScrollSpy();
    initMobileNav();
  });
})();
