/**
 * Responsibility detail modal opened from cards on index.html.
 *
 * Markup contract:
 *   <button class="ro-resp" data-resp="R-01">…</button>
 *   <dialog class="ch-modal" id="respModal">…</dialog>
 *   <script id="respData" type="application/json">{ "R-01": {…}, … }</script>
 */

import { escapeHtml } from '../../core/format.js';

/** Pull the SVG straight off the responsibility card so the modal icon
 *  always mirrors what's on the card — no duplicated icon table. */
function cardSvgFor(code) {
  const card = document.querySelector(`[data-resp="${code}"]`);
  if (!card) return '';
  const svg = card.querySelector('.ro-resp__icon svg');
  return svg ? svg.outerHTML : '';
}

export function initResponsibilityModal() {
  const modal = document.getElementById('respModal');
  if (!modal) return;

  const dataEl = document.getElementById('respData');
  let DATA = {};
  try { DATA = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (_) {}

  const refs = {
    headIcon: modal.querySelector('[data-modal-icon]'),
    code:     modal.querySelector('[data-modal-code]'),
    primary:  modal.querySelector('[data-modal-primary]'),
    title:    modal.querySelector('[data-modal-title]'),
    lead:     modal.querySelector('[data-modal-lead]'),
    bullets:  modal.querySelector('[data-modal-bullets]'),
    warn:     modal.querySelector('[data-modal-warn]'),
    warnText: modal.querySelector('[data-modal-warn-text]'),
    tags:     modal.querySelector('[data-modal-tags]'),
    close:    modal.querySelector('[data-modal-close]')
  };

  function open(code) {
    const r = DATA[code];
    if (!r) return;

    refs.headIcon.innerHTML = cardSvgFor(code);
    refs.code.textContent  = r.code;
    refs.title.textContent = r.title;
    refs.lead.textContent  = r.short;

    refs.primary.hidden = r.weight !== 'primary';
    refs.primary.style.setProperty('--h', r.hue);

    refs.bullets.innerHTML = r.bullets.map((b, i) =>
      `<li><span>${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(b)}</span></li>`
    ).join('');

    if (r.warning) {
      refs.warn.hidden = false;
      refs.warnText.innerHTML = `<b>Nguyên tắc:</b> ${escapeHtml(r.warning)}`;
    } else {
      refs.warn.hidden = true;
    }

    refs.tags.innerHTML = r.tags.map((t) =>
      `<span class="ch-modal__tag">#${escapeHtml(t)}</span>`
    ).join('');

    modal.style.setProperty('--h', r.hue);

    if (typeof modal.showModal === 'function') modal.showModal();
    else                                       modal.setAttribute('open', '');
  }

  function close() {
    if (typeof modal.close === 'function') modal.close();
    else                                   modal.removeAttribute('open');
  }

  document.querySelectorAll('[data-resp]').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.dataset.resp));
  });

  refs.close?.addEventListener('click', close);

  // Click on backdrop closes
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}
