/**
 * Resource Allocation Timeline — main UI controller.
 *
 * Ported from the React component at
 * `Redesign request log page/src/app/components/resource-allocation/AllocationTimeline.tsx`.
 *
 * Layout (rendered into `#allocTimeline`):
 *   [Filter tabs] [Time range tabs] [Legend]
 *   ┌───────┬────────────────────────────────┐
 *   │ Mem   │ Year row                       │
 *   │ /Alloc│ Month row                      │
 *   ├───────┼────────────────────────────────┤
 *   │ ...   │ Member rows w/ project/solution blocks
 *   ├───────┴────────────────────────────────┤
 *   │ Mini-map (drag to pan)                 │
 *   └────────────────────────────────────────┘
 *
 * State lives in a single `state` object; renders are full re-renders of each
 * sub-region (header / body / minimap) so we don't pay diffing cost in plain JS.
 *
 * Persistence: Firebase Realtime Database under the `allocations` node. On
 * first run we seed it from `AllocationData.SEED_ASSIGNMENTS` so a fresh
 * database doesn't show an empty timeline.
 */
(function (global) {
  'use strict';

  const D = global.AllocationData;
  const {
    TODAY, MEMBERS, PROJECTS, SEED_ASSIGNMENTS, MONTH_NAMES_SHORT,
    DAY_W_BY_RANGE,
    parseDate, toISO, daysBetween, addDays, buildMonths,
    getDataRange, getCurrentAllocation, getTimeRangeDays, getTimeRangeLabel
  } = D;

  const ROW_H_COMPACT = 56;
  const PROJECT_TOP_COMPACT  = 6;
  const SOLUTION_TOP_COMPACT = 30;
  const SEG_H_COMPACT = 20;

  const state = {
    assignments: SEED_ASSIGNMENTS.map((a) => ({ ...a })),
    seeded: false,
    filter: 'all',                 // 'all' | 'project' | 'solution' | 'over'
    timeRange: '1Y',               // '6M' | '1Y' | '2Y' | 'ALL'
    hoveredBlock: null,            // assignment.id
    hoverRow: null,                // { memberId, xPx }
    editingBlock: null,            // assignment (inline editor)
    creatingAt: null,              // { memberId, start, end }
    detailModal: null,             // assignment (large modal)
    scrollLeft: 0,
    viewportPx: 800,
    isOpen: false,
    unsubscribe: null
  };

  const dom = {};
  const draggingMini = { active: false };

  // ── Derived helpers ───────────────────────────────────────────

  function dayW() { return DAY_W_BY_RANGE[state.timeRange]; }

  function dataRange() { return getDataRange(state.assignments); }

  function totalDays() {
    const r = dataRange();
    return daysBetween(r.start, r.end) + 1;
  }

  function totalWidth() { return totalDays() * dayW(); }

  function dateToPx(iso) {
    return daysBetween(dataRange().start, iso) * dayW();
  }

  function pxToISO(px) {
    const day = Math.round(px / dayW());
    return addDays(dataRange().start, day);
  }

  // ── Boot / Firebase wiring ────────────────────────────────────

  function bootstrap() {
    // Cache DOM nodes used across the controller.
    dom.btnOpen      = document.getElementById('btnAllocation');
    dom.drawer       = document.getElementById('allocationDrawer');
    dom.drawerClose  = document.getElementById('allocDrawerClose');
    dom.drawerPanel  = dom.drawer && dom.drawer.querySelector('.alloc-drawer__panel');
    dom.drawerOverlay= dom.drawer && dom.drawer.querySelector('.alloc-drawer__overlay');
    dom.root         = document.getElementById('allocTimeline');
    dom.editorModal  = document.getElementById('allocEditorModal');
    dom.editorBody   = document.getElementById('allocEditorBody');
    dom.detailModal  = document.getElementById('allocDetailModal');
    dom.detailBody   = document.getElementById('allocDetailBody');

    if (!dom.root || !dom.btnOpen) return;

    dom.btnOpen.addEventListener('click', openDrawer);
    if (dom.drawerClose)   dom.drawerClose.addEventListener('click', closeDrawer);
    if (dom.drawerOverlay) dom.drawerOverlay.addEventListener('click', closeDrawer);

    // Event delegation: editor + detail modals (overlay + buttons inside).
    // Avoids re-attaching listeners on every openEditor()/openDetail().
    if (dom.editorModal) {
      dom.editorModal.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'alloc-close-editor') cancelEditor();
        else if (action.dataset.action === 'alloc-delete-inline') {
          if (!state.editingBlock) return;
          if (confirm('Xác nhận xóa allocation này?')) {
            deleteAllocation(state.editingBlock);
            cancelEditor();
          }
        }
      });
    }
    if (dom.detailModal) {
      dom.detailModal.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'alloc-close-detail') closeDetail();
        else if (action.dataset.action === 'alloc-detail-delete') {
          const a = state.detailModal;
          if (!a) return;
          if (!confirm('Xác nhận xóa allocation này?')) return;
          await deleteAllocation(a);
          closeDetail();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (state.editingBlock || state.creatingAt) { cancelEditor(); return; }
      if (state.detailModal) { closeDetail(); return; }
      if (state.isOpen) { closeDrawer(); }
    });

    renderShell();
    subscribeFirebase();
  }

  function subscribeFirebase() {
    if (!global.FirebaseAPI) return;
    state.unsubscribe = FirebaseAPI.onAllocationsChange(async (records) => {
      if (records.length === 0 && !state.seeded) {
        state.seeded = true;
        try {
          await FirebaseAPI.seedAllocations(SEED_ASSIGNMENTS);
          return; // next callback will pull seeded values
        } catch (err) {
          console.warn('[allocation] seed failed — falling back to local mock data', err);
          // Render the in-memory SEED_ASSIGNMENTS so the UI is still usable
          // when Firebase rules block writes (path not configured yet).
          renderTimeline();
          return;
        }
      }
      state.assignments = records.map((r) => ({
        id: r.firebaseId,
        firebaseId: r.firebaseId,
        memberId: r.memberId,
        kind: r.kind,
        projectKey: r.projectKey,
        projectName: r.projectName,
        percent: Number(r.percent || 0),
        start: r.start,
        end: r.end,
        status: r.status || 'active'
      }));
      renderTimeline();
    });
  }

  // ── Drawer open/close ─────────────────────────────────────────

  function openDrawer() {
    state.isOpen = true;
    dom.drawer.hidden = false;
    requestAnimationFrame(() => dom.drawer.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    // Re-render so timeline picks up current viewport sizing.
    renderTimeline();
    // Auto-scroll today into view after the panel has mounted.
    requestAnimationFrame(() => scrollToToday());
  }

  function closeDrawer() {
    state.isOpen = false;
    dom.drawer.classList.remove('is-open');
    setTimeout(() => { dom.drawer.hidden = true; }, 220);
    document.body.style.overflow = '';
  }

  // ── Shell layout (one-shot) ───────────────────────────────────

  function renderShell() {
    dom.root.innerHTML = `
      <div class="alloc-toolbar">
        <div class="alloc-tab-group" data-group="filter">
          <button class="alloc-tab is-active" data-filter="all">Tất cả</button>
          <button class="alloc-tab" data-filter="project">Project</button>
          <button class="alloc-tab" data-filter="solution">Solution Team</button>
          <button class="alloc-tab" data-filter="over">Over</button>
        </div>
        <div class="alloc-tab-group" data-group="range">
          <button class="alloc-tab" data-range="6M">6M</button>
          <button class="alloc-tab is-active" data-range="1Y">1Y</button>
          <button class="alloc-tab" data-range="2Y">2Y</button>
          <button class="alloc-tab" data-range="ALL">ALL</button>
        </div>
        <div class="alloc-legend">
          <span><span class="alloc-legend__sw alloc-legend__sw--project"></span>Project</span>
          <span><span class="alloc-legend__sw alloc-legend__sw--solution"></span>Solution Team</span>
          <span><span class="alloc-legend__sw alloc-legend__sw--today"></span>Today</span>
        </div>
      </div>

      <div class="alloc-board">
        <!-- Header strip -->
        <div class="alloc-header">
          <div class="alloc-header__left">Member / Alloc</div>
          <div class="alloc-header__scroll" data-role="headerScroll">
            <div class="alloc-header__inner" data-role="headerInner">
              <div class="alloc-row alloc-row--year"  data-role="yearRow"></div>
              <div class="alloc-row alloc-row--month" data-role="monthRow"></div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="alloc-body">
          <div class="alloc-body__left" data-role="memberCol"></div>
          <div class="alloc-body__scroll" data-role="bodyScroll">
            <div class="alloc-body__inner" data-role="bodyInner"></div>
          </div>
        </div>

        <!-- Mini-map -->
        <div class="alloc-mini">
          <div class="alloc-mini__label">Mini-map</div>
          <div class="alloc-mini__track" data-role="mini"></div>
        </div>
      </div>

      <p class="alloc-help" data-role="help"></p>
    `;

    dom.headerScroll = dom.root.querySelector('[data-role="headerScroll"]');
    dom.headerInner  = dom.root.querySelector('[data-role="headerInner"]');
    dom.yearRow      = dom.root.querySelector('[data-role="yearRow"]');
    dom.monthRow     = dom.root.querySelector('[data-role="monthRow"]');
    dom.memberCol    = dom.root.querySelector('[data-role="memberCol"]');
    dom.bodyScroll   = dom.root.querySelector('[data-role="bodyScroll"]');
    dom.bodyInner    = dom.root.querySelector('[data-role="bodyInner"]');
    dom.mini         = dom.root.querySelector('[data-role="mini"]');
    dom.help         = dom.root.querySelector('[data-role="help"]');

    // Filter / range toolbar wiring.
    dom.root.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        dom.root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderTimeline();
      });
    });
    dom.root.querySelectorAll('[data-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timeRange = btn.dataset.range;
        dom.root.querySelectorAll('[data-range]').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderTimeline();
        requestAnimationFrame(scrollToToday);
      });
    });

    // Sync scrolls between header and body.
    dom.bodyScroll.addEventListener('scroll', () => {
      dom.headerScroll.scrollLeft = dom.bodyScroll.scrollLeft;
      state.scrollLeft = dom.bodyScroll.scrollLeft;
      state.viewportPx = dom.bodyScroll.clientWidth;
      updateMiniViewport();
    });
    dom.headerScroll.addEventListener('scroll', () => {
      dom.bodyScroll.scrollLeft = dom.headerScroll.scrollLeft;
      state.scrollLeft = dom.headerScroll.scrollLeft;
      updateMiniViewport();
    });

    // Mini-map drag.
    dom.mini.addEventListener('mousedown', (e) => {
      draggingMini.active = true;
      jumpMini(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
      if (draggingMini.active) jumpMini(e.clientX);
    });
    window.addEventListener('mouseup', () => { draggingMini.active = false; });

    // Resize observer keeps viewport size in sync (mini-map width).
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        state.viewportPx = dom.bodyScroll.clientWidth;
        updateMiniViewport();
      });
      ro.observe(dom.bodyScroll);
    }
  }

  // ── Full re-render of header + body + minimap + help ─────────

  function renderTimeline() {
    if (!dom.root) return;

    const range  = dataRange();
    const w      = dayW();
    const total  = totalWidth();
    const months = buildMonths(range.start, range.end);

    // Year header — coalesce consecutive months by year.
    const years = [];
    let cursor = 0;
    for (const m of months) {
      const wPx = m.days * w;
      const last = years[years.length - 1];
      if (last && last.year === m.year) last.widthPx += wPx;
      else years.push({ year: m.year, offsetPx: cursor, widthPx: wPx });
      cursor += wPx;
    }

    // Header rows ─────────────────────────────────────────────
    dom.headerInner.style.width = total + 'px';

    dom.yearRow.innerHTML = years.map((y) => `
      <div class="alloc-year" style="left:${y.offsetPx}px; width:${y.widthPx}px;">${y.year}</div>
    `).join('');

    let mOffset = 0;
    dom.monthRow.innerHTML = months.map((m) => {
      const left = mOffset;
      const widthPx = m.days * w;
      mOffset += widthPx;
      const cls = m.month === 0 ? 'is-year-start' : '';
      return `<div class="alloc-month ${cls}" style="left:${left}px; width:${widthPx}px;">${MONTH_NAMES_SHORT[m.month]}</div>`;
    }).join('');

    // Member sidebar ──────────────────────────────────────────
    dom.memberCol.innerHTML = MEMBERS.map((m) => {
      const alloc = getCurrentAllocation(m.id, TODAY, state.assignments);
      let pctCls = 'alloc-pct';
      if (alloc.total > 100)      pctCls += ' is-over';
      else if (alloc.total > 90)  pctCls += ' is-warn';
      else if (alloc.total === 0) pctCls += ' is-empty';
      const initialsStyle =
        `background:linear-gradient(135deg, oklch(0.7 0.22 ${m.hue} / 0.25), oklch(0.7 0.22 ${m.hue} / 0.08));` +
        `border-color:oklch(0.7 0.22 ${m.hue} / 0.35);` +
        `color:oklch(0.95 0.12 ${m.hue});`;
      return `
        <div class="alloc-member" style="height:${ROW_H_COMPACT}px;">
          <span class="alloc-member__avatar" style="${initialsStyle}">${m.initials}</span>
          <div class="alloc-member__meta">
            <div class="alloc-member__name">${escapeHtml(m.name)}</div>
            <div class="alloc-member__role">${escapeHtml(m.role)}</div>
          </div>
          <div class="${pctCls}" title="Project ${alloc.project}% + Solution ${alloc.solution}%">${alloc.total}%</div>
        </div>
      `;
    }).join('');

    // Body grid ───────────────────────────────────────────────
    const bodyHeight = MEMBERS.length * ROW_H_COMPACT;
    dom.bodyInner.style.width = total + 'px';
    dom.bodyInner.style.height = bodyHeight + 'px';

    let bg = '';

    // Month grid lines.
    let gLeft = 0;
    bg += months.map((m) => {
      const left = gLeft;
      gLeft += m.days * w;
      const cls = m.month === 0 ? 'is-year-start' : '';
      return `<div class="alloc-grid-line ${cls}" style="left:${left}px;"></div>`;
    }).join('');

    // Today line.
    const tPx = dateToPx(TODAY);
    if (tPx >= 0 && tPx <= total) {
      bg += `<div class="alloc-today-line" style="left:${tPx}px;"></div>`;
    }

    // Rows + blocks.
    bg += MEMBERS.map((m, rowIdx) => {
      const allocNow = getCurrentAllocation(m.id, TODAY, state.assignments);
      const isOver = allocNow.total > 100;
      const dim    = state.filter === 'over' && !isOver;

      const blocks = state.assignments
        .filter((a) => a.memberId === m.id)
        .filter((a) => {
          if (state.filter === 'project')  return a.kind === 'project';
          if (state.filter === 'solution') return a.kind === 'solution';
          return true;
        })
        .map((a) => renderBlock(a, w, total))
        .join('');

      return `
        <div class="alloc-trow ${dim ? 'is-dim' : ''}"
             data-row="${m.id}"
             style="height:${ROW_H_COMPACT}px; top:${rowIdx * ROW_H_COMPACT}px;">
          ${blocks}
        </div>
      `;
    }).join('');

    dom.bodyInner.innerHTML = bg;
    dom.hoverHint = null; // wiped by innerHTML; ensureHoverHint() re-creates

    // Wire row + block interaction.
    wireRows();

    // Mini-map ────────────────────────────────────────────────
    dom.mini.innerHTML = renderMiniMap(years, total);
    updateMiniViewport();

    // Help line.
    dom.help.innerHTML =
      `${escapeHtml(getTimeRangeLabel(state.timeRange))} · Dữ liệu từ ` +
      `<span class="alloc-mono">${range.start}</span> đến ` +
      `<span class="alloc-mono">${range.end}</span>. ` +
      `Click vào khoảng trống để tạo allocation, click vào block để edit, hover để hiện toolbar.`;
  }

  function renderBlock(a, w, total) {
    const startPx = Math.max(0, dateToPx(a.start));
    const endPx   = Math.min(total, dateToPx(a.end) + w);
    if (endPx <= 0 || startPx >= total) return '';
    const left  = startPx + 1;
    const width = Math.max(20, endPx - startPx - 2);
    const isProject = a.kind === 'project';
    const top = isProject ? PROJECT_TOP_COMPACT : SOLUTION_TOP_COMPACT;

    const bg = isProject
      ? 'linear-gradient(90deg, oklch(0.55 0.18 264 / 0.4), oklch(0.55 0.2 320 / 0.4))'
      : 'linear-gradient(90deg, oklch(0.55 0.18 30 / 0.45), oklch(0.55 0.18 160 / 0.45))';
    const border = isProject
      ? 'oklch(0.7 0.22 290 / 0.45)'
      : 'oklch(0.7 0.22 60 / 0.5)';
    const accent = isProject
      ? 'linear-gradient(180deg, oklch(0.8 0.2 264), oklch(0.7 0.22 320))'
      : 'linear-gradient(180deg, oklch(0.8 0.18 30), oklch(0.78 0.18 160))';
    const textColor = isProject ? 'oklch(0.95 0.08 290)' : 'oklch(0.95 0.1 60)';

    return `
      <div class="alloc-block ${isProject ? 'is-project' : 'is-solution'}"
           data-block="${a.id}"
           style="left:${left}px; width:${width}px; top:${top}px; height:${SEG_H_COMPACT}px;
                  background:${bg}; border-color:${border}; color:${textColor};">
        <span class="alloc-block__accent" style="background:${accent};"></span>
        <span class="alloc-block__title">${escapeHtml(a.projectName)}</span>
        <span class="alloc-block__pct">${a.percent}%</span>
        <div class="alloc-block__tools" data-tools>
          <button data-tool="edit"   title="Quick edit">${iconEdit()}</button>
          <button data-tool="detail" title="Detail">${iconChevron()}</button>
          <span class="alloc-block__tools-sep"></span>
          <button data-tool="delete" title="Xóa">${iconTrash()}</button>
        </div>
      </div>
    `;
  }

  function ensureHoverHint() {
    if (dom.hoverHint) return dom.hoverHint;
    const el = document.createElement('div');
    el.className = 'alloc-hover-hint';
    el.innerHTML = '<svg viewBox="0 0 24 24" class="alloc-icon"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Click để tạo</span>';
    el.style.display = 'none';
    dom.bodyInner.appendChild(el);
    dom.hoverHint = el;
    return el;
  }

  function wireRows() {
    const hint = ensureHoverHint();

    dom.bodyInner.querySelectorAll('[data-row]').forEach((rowEl) => {
      const memberId = rowEl.dataset.row;

      rowEl.addEventListener('mousemove', (e) => {
        if (e.target.closest('[data-block]')) { hint.style.display = 'none'; return; }
        const rect = rowEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        hint.style.display = 'inline-flex';
        hint.style.left = (rowEl.offsetLeft + x + 8) + 'px';
        hint.style.top  = (rowEl.offsetTop + ROW_H_COMPACT / 2 - 12) + 'px';
      });
      rowEl.addEventListener('mouseleave', () => { hint.style.display = 'none'; });

      rowEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-block]')) return;
        const rect = dom.bodyScroll.getBoundingClientRect();
        const x = e.clientX - rect.left + dom.bodyScroll.scrollLeft;
        const start = pxToISO(x);
        const end   = addDays(start, 30);
        state.creatingAt   = { memberId, start, end };
        state.editingBlock = null;
        openEditor();
      });
    });

    dom.bodyInner.querySelectorAll('[data-block]').forEach((blockEl) => {
      const id = blockEl.dataset.block;
      const a  = state.assignments.find((x) => x.id === id);
      if (!a) return;

      blockEl.addEventListener('click', (e) => {
        const toolBtn = e.target.closest('[data-tool]');
        if (toolBtn) {
          e.stopPropagation();
          const tool = toolBtn.dataset.tool;
          if (tool === 'edit') {
            state.editingBlock = a; state.creatingAt = null; openEditor();
          } else if (tool === 'detail') {
            state.detailModal = a; openDetail();
          } else if (tool === 'delete') {
            if (confirm('Xác nhận xóa allocation này?')) deleteAllocation(a);
          }
          return;
        }
        // Default: open inline editor.
        state.editingBlock = a; state.creatingAt = null; openEditor();
      });
    });
  }

  // ── Mini-map ──────────────────────────────────────────────────

  function renderMiniMap(years, total) {
    let html = '';
    html += years.map((y) => `
      <div class="alloc-mini__year" style="left:${(y.offsetPx / total) * 100}%; width:${(y.widthPx / total) * 100}%;">${y.year}</div>
    `).join('');

    const w = dayW();
    html += state.assignments.map((a) => {
      const left  = (dateToPx(a.start) / total) * 100;
      const width = ((daysBetween(a.start, a.end) + 1) * w / total) * 100;
      const isProject = a.kind === 'project';
      const top = isProject ? 30 : 60;
      const color = isProject ? 'oklch(0.7 0.22 290 / 0.55)' : 'oklch(0.78 0.18 60 / 0.55)';
      return `<div class="alloc-mini__bar" style="left:${left}%; width:${Math.max(0.2, width)}%; top:${top}%; background:${color};"></div>`;
    }).join('');

    const tPct = (dateToPx(TODAY) / total) * 100;
    html += `<div class="alloc-mini__today" style="left:${tPct}%;"></div>`;
    html += `<div class="alloc-mini__viewport" data-role="miniViewport"></div>`;
    return html;
  }

  function updateMiniViewport() {
    const vp = dom.mini && dom.mini.querySelector('[data-role="miniViewport"]');
    if (!vp) return;
    const total = totalWidth();
    if (!total) return;
    const leftPct  = (state.scrollLeft / total) * 100;
    const widthPct = Math.max(2, (state.viewportPx / total) * 100);
    vp.style.left  = leftPct + '%';
    vp.style.width = widthPct + '%';
  }

  function jumpMini(clientX) {
    const rect = dom.mini.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = ratio * (totalWidth() - dom.bodyScroll.clientWidth);
    dom.bodyScroll.scrollLeft = Math.max(0, target);
  }

  function scrollToToday() {
    const visibleDays = getTimeRangeDays(state.timeRange);
    const target = Math.max(0, dateToPx(TODAY) - visibleDays * dayW() * 0.4);
    dom.bodyScroll.scrollLeft = target;
    dom.headerScroll.scrollLeft = target;
    state.scrollLeft = target;
    state.viewportPx = dom.bodyScroll.clientWidth;
    updateMiniViewport();
  }

  // ── Inline editor popover ─────────────────────────────────────

  function openEditor() {
    const src = state.editingBlock;
    const memberId   = (src && src.memberId)   || (state.creatingAt && state.creatingAt.memberId) || MEMBERS[0].id;
    const kind       = (src && src.kind)       || 'project';
    const projectKey = (src && src.projectKey) || PROJECTS[0].key;
    const projectName= (src && src.projectName)|| PROJECTS[0].name;
    const percent    = (src && src.percent)    || 80;
    const start      = (src && src.start)      || (state.creatingAt && state.creatingAt.start) || TODAY;
    const end        = (src && src.end)        || (state.creatingAt && state.creatingAt.end)   || addDays(TODAY, 30);

    dom.editorBody.innerHTML = `
      <div class="alloc-editor">
        <header class="alloc-editor__head">
          <h3>${src ? 'Chỉnh sửa Allocation' : 'Tạo Allocation mới'}</h3>
          <button type="button" class="alloc-editor__close" data-action="alloc-close-editor">×</button>
        </header>
        <form class="alloc-editor__form" id="allocEditorForm">
          <div class="alloc-field">
            <label>Member</label>
            <select name="memberId">${MEMBERS.map((m) => `<option value="${m.id}" ${m.id === memberId ? 'selected' : ''}>${escapeHtml(m.name)} - ${escapeHtml(m.role)}</option>`).join('')}</select>
          </div>

          <div class="alloc-field">
            <label>Type</label>
            <div class="alloc-kind">
              <button type="button" class="alloc-kind__opt is-project ${kind === 'project'  ? 'is-active' : ''}" data-kind="project">Project</button>
              <button type="button" class="alloc-kind__opt is-solution ${kind === 'solution' ? 'is-active' : ''}" data-kind="solution">Solution Team</button>
            </div>
            <input type="hidden" name="kind" value="${kind}">
          </div>

          <div class="alloc-field">
            <label>Project</label>
            <select name="projectKey">${PROJECTS.map((p) => `<option value="${p.key}" ${p.key === projectKey ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>
          </div>

          <div class="alloc-field">
            <label>Allocation % <span class="alloc-mono" data-role="pctLabel">(${percent}%)</span></label>
            <input type="range" name="percent" min="10" max="100" step="10" value="${percent}">
          </div>

          <div class="alloc-field-row">
            <div class="alloc-field">
              <label>Start</label>
              <input type="date" name="start" value="${start}">
            </div>
            <div class="alloc-field">
              <label>End</label>
              <input type="date" name="end" value="${end}">
            </div>
          </div>

          <div class="alloc-editor__actions">
            <button type="submit" class="alloc-btn alloc-btn--primary">${src ? 'Cập nhật' : 'Tạo mới'}</button>
            ${src ? '<button type="button" class="alloc-btn alloc-btn--danger" data-action="alloc-delete-inline">Xóa</button>' : ''}
          </div>
        </form>
      </div>
    `;
    dom.editorModal.hidden = false;

    const form = document.getElementById('allocEditorForm');
    const kindInput = form.querySelector('[name="kind"]');
    const pctRange  = form.querySelector('[name="percent"]');
    const pctLabel  = form.querySelector('[data-role="pctLabel"]');

    form.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        kindInput.value = btn.dataset.kind;
        form.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    pctRange.addEventListener('input', () => { pctLabel.textContent = `(${pctRange.value}%)`; });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const proj = PROJECTS.find((p) => p.key === fd.get('projectKey')) || PROJECTS[0];
      const data = {
        memberId:    fd.get('memberId'),
        kind:        fd.get('kind'),
        projectKey:  proj.key,
        projectName: proj.name,
        percent:     Number(fd.get('percent')),
        start:       fd.get('start'),
        end:         fd.get('end'),
        status:      (src && src.status) || 'active'
      };
      saveInline(data);
    });

    // Close + delete buttons are handled via delegation in bootstrap().
  }

  function cancelEditor() {
    state.editingBlock = null;
    state.creatingAt = null;
    if (dom.editorModal) dom.editorModal.hidden = true;
  }

  function fbErr(err) {
    const msg = (err && err.message) || String(err);
    if (/permission_denied|PERMISSION_DENIED/i.test(msg)) {
      return 'Firebase từ chối: thêm rule cho path `allocations` (xem docs/FIREBASE_SETUP.md)';
    }
    return msg;
  }

  async function saveInline(data) {
    if (state.editingBlock) {
      const fid = state.editingBlock.firebaseId;
      if (fid && global.FirebaseAPI) {
        try { await FirebaseAPI.updateAllocation(fid, data); }
        catch (err) { console.error(err); notify('Cập nhật thất bại — ' + fbErr(err), 'error'); return; }
      } else {
        Object.assign(state.editingBlock, data);
        renderTimeline();
      }
      notify('Đã cập nhật allocation');
    } else {
      if (global.FirebaseAPI) {
        try { await FirebaseAPI.createAllocation(data); }
        catch (err) { console.error(err); notify('Tạo allocation thất bại — ' + fbErr(err), 'error'); return; }
      } else {
        state.assignments.push({ id: 'tmp-' + Date.now(), ...data });
        renderTimeline();
      }
      notify('Đã tạo allocation mới');
    }
    cancelEditor();
  }

  async function deleteAllocation(a) {
    if (a.firebaseId && global.FirebaseAPI) {
      try { await FirebaseAPI.deleteAllocation(a.firebaseId); }
      catch (err) { console.error(err); notify('Xóa thất bại — ' + fbErr(err), 'error'); return; }
    } else {
      state.assignments = state.assignments.filter((x) => x.id !== a.id);
      renderTimeline();
    }
    notify('Đã xóa allocation');
  }

  // ── Detail modal ──────────────────────────────────────────────

  function openDetail() {
    const a = state.detailModal;
    if (!a) return;
    const member = MEMBERS.find((m) => m.id === a.memberId);
    const memberStyle = member
      ? `background:linear-gradient(135deg, oklch(0.7 0.22 ${member.hue} / 0.25), oklch(0.7 0.22 ${member.hue} / 0.08));border-color:oklch(0.7 0.22 ${member.hue} / 0.35);color:oklch(0.92 0.12 ${member.hue});`
      : '';

    dom.detailBody.innerHTML = `
      <header class="alloc-detail__head">
        <div class="alloc-detail__avatar" style="${memberStyle}">${member ? member.initials : '?'}</div>
        <div>
          <h2>Chi tiết Allocation</h2>
          <p>${member ? escapeHtml(member.name + ' - ' + member.role) : ''}</p>
        </div>
        <button class="modal-close" data-action="alloc-close-detail">×</button>
      </header>
      <form class="alloc-detail__form" id="allocDetailForm">
        <div class="alloc-field-row">
          <div class="alloc-field">
            <label>Member</label>
            <select name="memberId">${MEMBERS.map((m) => `<option value="${m.id}" ${m.id === a.memberId ? 'selected' : ''}>${escapeHtml(m.name)} - ${escapeHtml(m.role)}</option>`).join('')}</select>
          </div>
          <div class="alloc-field">
            <label>Type</label>
            <div class="alloc-kind">
              <button type="button" class="alloc-kind__opt is-project ${a.kind === 'project'  ? 'is-active' : ''}" data-kind="project">Project</button>
              <button type="button" class="alloc-kind__opt is-solution ${a.kind === 'solution' ? 'is-active' : ''}" data-kind="solution">Solution</button>
            </div>
            <input type="hidden" name="kind" value="${a.kind}">
          </div>
        </div>

        <div class="alloc-field">
          <label>Project</label>
          <select name="projectKey">${PROJECTS.map((p) => `<option value="${p.key}" ${p.key === a.projectKey ? 'selected' : ''}>${p.key} - ${escapeHtml(p.name)}</option>`).join('')}</select>
        </div>

        <div class="alloc-field">
          <label>Allocation % <span class="alloc-mono" data-role="pctLabel">${a.percent}%</span></label>
          <input type="range" name="percent" min="10" max="100" step="5" value="${a.percent}">
          <div class="alloc-range-scale"><span>10%</span><span class="alloc-range-scale__sep"></span><span>50%</span><span class="alloc-range-scale__sep"></span><span>100%</span></div>
        </div>

        <div class="alloc-field-row">
          <div class="alloc-field">
            <label>Start Date</label>
            <input type="date" name="start" value="${a.start}">
          </div>
          <div class="alloc-field">
            <label>End Date</label>
            <input type="date" name="end" value="${a.end}">
          </div>
        </div>

        <div class="alloc-field">
          <label>Status</label>
          <div class="alloc-status-group">
            ${['scheduled','active','done'].map((s) => `<button type="button" class="alloc-status-opt ${(a.status || 'active') === s ? 'is-active' : ''}" data-status="${s}">${s}</button>`).join('')}
          </div>
          <input type="hidden" name="status" value="${a.status || 'active'}">
        </div>

        <div class="alloc-detail__actions">
          <button type="submit" class="alloc-btn alloc-btn--primary">Lưu thay đổi</button>
          <button type="button" class="alloc-btn alloc-btn--danger" data-action="alloc-detail-delete">Xóa</button>
          <button type="button" class="alloc-btn" data-action="alloc-close-detail">Hủy</button>
        </div>
      </form>
    `;
    dom.detailModal.hidden = false;

    const form = document.getElementById('allocDetailForm');
    const kindInput   = form.querySelector('[name="kind"]');
    const statusInput = form.querySelector('[name="status"]');
    const pctRange    = form.querySelector('[name="percent"]');
    const pctLabel    = form.querySelector('[data-role="pctLabel"]');

    form.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        kindInput.value = btn.dataset.kind;
        form.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });
    form.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        statusInput.value = btn.dataset.status;
        form.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });
    pctRange.addEventListener('input', () => { pctLabel.textContent = `${pctRange.value}%`; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const proj = PROJECTS.find((p) => p.key === fd.get('projectKey')) || PROJECTS[0];
      const data = {
        memberId:    fd.get('memberId'),
        kind:        fd.get('kind'),
        projectKey:  proj.key,
        projectName: proj.name,
        percent:     Number(fd.get('percent')),
        start:       fd.get('start'),
        end:         fd.get('end'),
        status:      fd.get('status')
      };
      if (a.firebaseId && global.FirebaseAPI) {
        try { await FirebaseAPI.updateAllocation(a.firebaseId, data); }
        catch (err) { console.error(err); notify('Cập nhật thất bại', 'error'); return; }
      } else {
        Object.assign(a, data);
        renderTimeline();
      }
      notify('Đã lưu thay đổi');
      closeDetail();
    });

    // Close + delete buttons are handled via delegation in bootstrap().
  }

  function closeDetail() {
    state.detailModal = null;
    if (dom.detailModal) dom.detailModal.hidden = true;
  }

  // ── Helpers ───────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function notify(text, type) {
    if (global.Utils && Utils.showNotification) {
      Utils.showNotification(type || 'success', text);
    }
  }

  function iconEdit() {
    return `<svg viewBox="0 0 24 24" class="alloc-icon"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function iconChevron() {
    return `<svg viewBox="0 0 24 24" class="alloc-icon"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function iconTrash() {
    return `<svg viewBox="0 0 24 24" class="alloc-icon"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ── Init ──────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
