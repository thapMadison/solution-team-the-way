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

  function svgIcon(name) {
    const ICONS = {
      'shield-check':
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
      'zap':
        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      'file-text':
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
      'microscope':
        '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
      'graduation-cap':
        '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
      'network':
        '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
      'x':
        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      'alert-triangle':
        '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    };
    return ICONS[name] || '';
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
      headIcon.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + svgIcon(r.icon) + '</svg>';
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
