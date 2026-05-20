/**
 * Charter section nav — floating right rail with scroll spy & sliding highlight.
 *
 * Markup contract:
 *   <nav class="ch-rail" data-section-nav>
 *     <div class="ch-rail__inner">
 *       <div class="ch-rail__track"></div>
 *       <div class="ch-rail__highlight"></div>
 *       <button class="ch-rail__item" data-section="mission">…</button>
 *     </div>
 *   </nav>
 *   <section id="mission">…</section>
 *
 * Keyboard shortcut: press G then 1..9 to jump to the n-th section.
 */

import { TIMING } from '../../config/constants.js';

function initRail(rail) {
  const items = Array.from(rail.querySelectorAll('.ch-rail__item'));
  if (!items.length) return null;

  const sections = items
    .map((btn) => ({ btn, id: btn.dataset.section, el: document.getElementById(btn.dataset.section) }))
    .filter((entry) => !!entry.el);
  if (!sections.length) return null;

  const inner = rail.querySelector('.ch-rail__inner');
  let activeIdx = 0;

  function paint() {
    sections.forEach((s, i) => {
      s.btn.classList.toggle('is-active', i === activeIdx);
      s.btn.classList.toggle('is-past', i < activeIdx);
    });
    const progress = sections.length > 1 ? (activeIdx / (sections.length - 1)) * 100 : 0;
    inner.style.setProperty('--rail-active', String(activeIdx));
    inner.style.setProperty('--rail-progress', progress + '%');
  }

  sections.forEach((s, i) => {
    s.btn.addEventListener('click', () => {
      s.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { activeIdx = i; paint(); }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    io.observe(s.el);
  });

  paint();
  return sections;
}

function initKeyboardJump(sections) {
  if (!sections) return;

  let armed = false;
  let armTimer = null;

  const disarm = () => {
    armed = false;
    if (armTimer) { clearTimeout(armTimer); armTimer = null; }
  };

  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (!armed && (e.key === 'g' || e.key === 'G')) {
      armed = true;
      if (armTimer) clearTimeout(armTimer);
      armTimer = setTimeout(disarm, TIMING.keyboardJumpArm);
      return;
    }

    if (armed && /^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      sections[idx]?.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      disarm();
    } else if (armed) {
      disarm();
    }
  });
}

export function initSectionNav() {
  const rails = Array.from(document.querySelectorAll('[data-section-nav]'));
  if (!rails.length) return;
  const sectionsByRail = rails.map(initRail).filter(Boolean);
  initKeyboardJump(sectionsByRail[0]);
}
