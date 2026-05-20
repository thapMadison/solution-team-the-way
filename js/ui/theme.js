/**
 * Light/dark theme toggle. Persists choice in localStorage.
 */

const THEME_KEY = 'theme';
const LIGHT     = 'light';
const ICON_LIGHT = '☀️';
const ICON_DARK  = '🌙';

export function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const html = document.documentElement;
  const stored = localStorage.getItem(THEME_KEY);

  if (stored === LIGHT) {
    html.dataset.theme = LIGHT;
    toggle.textContent = ICON_LIGHT;
  }

  toggle.addEventListener('click', () => {
    const isLight = html.dataset.theme === LIGHT;
    html.dataset.theme = isLight ? '' : LIGHT;
    toggle.textContent = isLight ? ICON_DARK : ICON_LIGHT;
    localStorage.setItem(THEME_KEY, isLight ? 'dark' : LIGHT);
  });
}
