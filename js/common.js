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

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initFadeIn();
    initScrollSpy();
  });
})();
