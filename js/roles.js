/**
 * Responsibility modal: opens a <dialog> with details for the clicked card.
 *
 * Markup contract:
 *   <button class="ro-resp" data-resp="R-01">…</button>
 *   <dialog class="ch-modal" id="respModal">…</dialog>
 *   <script id="respData" type="application/json">{ "R-01": {…}, … }</script>
 */
(function () {
  'use strict';

  /** Pull the SVG straight off the responsibility card so the modal icon
   *  always mirrors what's shown on the card — no duplicated icon table. */
  function cardSvgFor(code) {
    const card = document.querySelector('[data-resp="' + code + '"]');
    if (!card) return '';
    const svg = card.querySelector('.ro-resp__icon svg');
    return svg ? svg.outerHTML : '';
  }

  function init() {
    const modal = document.getElementById('respModal');
    if (!modal) return;

    const dataEl = document.getElementById('respData');
    let DATA = {};
    try { DATA = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (_) {}

    const headIcon = modal.querySelector('[data-modal-icon]');
    const codeEl   = modal.querySelector('[data-modal-code]');
    const primaryEl= modal.querySelector('[data-modal-primary]');
    const titleEl  = modal.querySelector('[data-modal-title]');
    const leadEl   = modal.querySelector('[data-modal-lead]');
    const bulletEl = modal.querySelector('[data-modal-bullets]');
    const warnEl   = modal.querySelector('[data-modal-warn]');
    const warnText = modal.querySelector('[data-modal-warn-text]');
    const tagsEl   = modal.querySelector('[data-modal-tags]');
    const closeEl  = modal.querySelector('[data-modal-close]');

    function open(code) {
      const r = DATA[code];
      if (!r) return;
      headIcon.innerHTML = cardSvgFor(code);
      codeEl.textContent = r.code;
      titleEl.textContent = r.title;
      leadEl.textContent = r.short;

      if (r.weight === 'primary') primaryEl.hidden = false; else primaryEl.hidden = true;
      primaryEl.style.setProperty('--h', r.hue);

      bulletEl.innerHTML = r.bullets.map((b, i) =>
        '<li><span>' + String(i + 1).padStart(2, '0') + '</span><span>' + escapeHtml(b) + '</span></li>'
      ).join('');

      if (r.warning) {
        warnEl.hidden = false;
        warnText.innerHTML = '<b>Nguyên tắc:</b> ' + escapeHtml(r.warning);
      } else {
        warnEl.hidden = true;
      }

      tagsEl.innerHTML = r.tags.map((t) =>
        '<span class="ch-modal__tag">#' + escapeHtml(t) + '</span>'
      ).join('');

      modal.style.setProperty('--h', r.hue);

      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }

    function close() {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }

    document.querySelectorAll('[data-resp]').forEach((btn) => {
      btn.addEventListener('click', () => open(btn.dataset.resp));
    });

    if (closeEl) closeEl.addEventListener('click', close);

    // Click on backdrop closes modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
