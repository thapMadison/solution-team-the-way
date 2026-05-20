/**
 * IntersectionObserver-based reveal for `.fade-in` elements.
 * Bonus: fills any `.bar-fill[data-width]` inside a revealed element.
 */

export function initFadeIn() {
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
