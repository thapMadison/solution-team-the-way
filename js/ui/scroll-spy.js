/**
 * Sub-nav scroll spy. Toggles `.active` on links whose href matches the
 * `[id]` section currently visible.
 */

export function initScrollSpy() {
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
