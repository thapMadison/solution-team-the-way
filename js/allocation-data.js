/**
 * Resource Allocation Timeline — data model + helpers.
 *
 * Ported from `Redesign request log page/src/app/components/resource-allocation/data.ts`.
 * Members, projects and seed assignments live here as plain JS so the timeline
 * can render before Firebase finishes loading.
 *
 * The seed `ASSIGNMENTS` array is also used as fallback content when the
 * Firebase `allocations` node is empty — `allocation-app.js` seeds the
 * database on first run so subsequent loads can persist edits.
 */
(function (global) {
  'use strict';

  const TODAY = '2026-05-18';

  // ── Static reference data ─────────────────────────────────────

  const MEMBERS = [
    { id: 'm1', name: 'Nguyễn An',  initials: 'NA', role: 'Senior Fullstack',  hue: '264' },
    { id: 'm2', name: 'Trần Bảo',   initials: 'TB', role: 'Tech Lead',         hue: '290' },
    { id: 'm3', name: 'Lê Chi',     initials: 'LC', role: 'Senior Backend',    hue: '320' },
    { id: 'm4', name: 'Phạm Dũng',  initials: 'PD', role: 'Senior Frontend',   hue: '20'  },
    { id: 'm5', name: 'Hoàng Em',   initials: 'HE', role: 'DevOps / SRE',      hue: '60'  },
    { id: 'm6', name: 'Đỗ Phúc',    initials: 'ĐP', role: 'Security Engineer', hue: '160' }
  ];

  const PROJECTS = [
    { key: 'PRJ-Atlas',   name: 'Atlas Platform',     hue: '264' },
    { key: 'PRJ-Helios',  name: 'Helios Migration',   hue: '200' },
    { key: 'PRJ-Nova',    name: 'Nova Analytics',     hue: '320' },
    { key: 'PRJ-Orion',   name: 'Orion Mobile',       hue: '20'  },
    { key: 'PRJ-Legacy',  name: 'Legacy Maintenance', hue: '120' },
    { key: 'PRJ-Phoenix', name: 'Phoenix Rewrite',    hue: '340' },
    { key: 'ST-CodeReview',   name: 'ST · Code Review',        hue: '30'  },
    { key: 'ST-Architecture', name: 'ST · Architecture Review', hue: '60'  },
    { key: 'ST-TechConsult',  name: 'ST · Tech Consulting',     hue: '40'  },
    { key: 'ST-Mentoring',    name: 'ST · Mentoring',           hue: '50'  },
    { key: 'ST-Performance',  name: 'ST · Performance Opt',     hue: '70'  },
    { key: 'ST-Security',     name: 'ST · Security Review',     hue: '160' }
  ];

  // Seed used when Firebase `allocations` is empty.
  const SEED_ASSIGNMENTS = [
    { id: 'a-m1-1', memberId: 'm1', kind: 'project',  projectKey: 'PRJ-Legacy',   projectName: 'Legacy Maintenance',  percent: 80, start: '2024-03-01', end: '2024-09-30' },
    { id: 'a-m1-2', memberId: 'm1', kind: 'solution', projectKey: 'ST-CodeReview', projectName: 'ST · Code Review',   percent: 20, start: '2024-03-01', end: '2024-12-31' },
    { id: 'a-m1-3', memberId: 'm1', kind: 'project',  projectKey: 'PRJ-Helios',   projectName: 'Helios Migration',    percent: 80, start: '2024-10-01', end: '2025-04-30' },
    { id: 'a-m1-4', memberId: 'm1', kind: 'project',  projectKey: 'PRJ-Atlas',    projectName: 'Atlas Platform',      percent: 80, start: '2025-05-01', end: '2026-06-28' },
    { id: 'a-m1-5', memberId: 'm1', kind: 'solution', projectKey: 'ST-CodeReview', projectName: 'ST · Code Review',   percent: 20, start: '2025-01-01', end: '2026-06-28' },
    { id: 'a-m1-6', memberId: 'm1', kind: 'project',  projectKey: 'PRJ-Nova',     projectName: 'Nova Analytics',      percent: 60, start: '2026-06-29', end: '2026-12-26' },
    { id: 'a-m1-7', memberId: 'm1', kind: 'solution', projectKey: 'ST-TechConsult', projectName: 'ST · Tech Consulting', percent: 20, start: '2026-06-29', end: '2026-12-26' },

    { id: 'a-m2-1', memberId: 'm2', kind: 'project',  projectKey: 'PRJ-Legacy',     projectName: 'Legacy Maintenance',     percent: 60, start: '2023-06-01', end: '2024-02-29' },
    { id: 'a-m2-2', memberId: 'm2', kind: 'solution', projectKey: 'ST-Architecture', projectName: 'ST · Architecture Review', percent: 30, start: '2023-06-01', end: '2026-07-12' },
    { id: 'a-m2-3', memberId: 'm2', kind: 'project',  projectKey: 'PRJ-Helios',     projectName: 'Helios Migration',       percent: 50, start: '2024-03-01', end: '2026-07-12' },
    { id: 'a-m2-4', memberId: 'm2', kind: 'project',  projectKey: 'PRJ-Atlas',      projectName: 'Atlas Platform',         percent: 30, start: '2025-08-01', end: '2026-06-14' },
    { id: 'a-m2-5', memberId: 'm2', kind: 'project',  projectKey: 'PRJ-Phoenix',    projectName: 'Phoenix Rewrite',        percent: 60, start: '2026-07-13', end: '2027-03-31' },

    { id: 'a-m3-1', memberId: 'm3', kind: 'project',  projectKey: 'PRJ-Legacy',     projectName: 'Legacy Maintenance',  percent: 70, start: '2024-01-01', end: '2024-08-31' },
    { id: 'a-m3-2', memberId: 'm3', kind: 'solution', projectKey: 'ST-CodeReview', projectName: 'ST · Code Review',     percent: 20, start: '2024-01-01', end: '2026-06-14' },
    { id: 'a-m3-3', memberId: 'm3', kind: 'project',  projectKey: 'PRJ-Atlas',      projectName: 'Atlas Platform',      percent: 80, start: '2024-09-01', end: '2026-06-14' },
    { id: 'a-m3-4', memberId: 'm3', kind: 'project',  projectKey: 'PRJ-Helios',     projectName: 'Helios Migration',    percent: 80, start: '2026-06-15', end: '2026-12-26' },
    { id: 'a-m3-5', memberId: 'm3', kind: 'solution', projectKey: 'ST-Mentoring',   projectName: 'ST · Mentoring',      percent: 20, start: '2026-06-15', end: '2026-12-26' },

    { id: 'a-m4-1', memberId: 'm4', kind: 'project',  projectKey: 'PRJ-Orion',     projectName: 'Orion Mobile',        percent: 70, start: '2025-01-01', end: '2026-07-05' },
    { id: 'a-m4-2', memberId: 'm4', kind: 'project',  projectKey: 'PRJ-Nova',      projectName: 'Nova Analytics',      percent: 40, start: '2026-05-18', end: '2026-06-14' },
    { id: 'a-m4-3', memberId: 'm4', kind: 'solution', projectKey: 'ST-CodeReview', projectName: 'ST · Code Review',    percent: 20, start: '2025-01-01', end: '2026-07-05' },
    { id: 'a-m4-4', memberId: 'm4', kind: 'project',  projectKey: 'PRJ-Phoenix',   projectName: 'Phoenix Rewrite',     percent: 80, start: '2026-07-06', end: '2027-02-28' },

    { id: 'a-m5-1', memberId: 'm5', kind: 'project',  projectKey: 'PRJ-Helios',    projectName: 'Helios Migration',    percent: 80, start: '2024-11-01', end: '2026-12-26' },
    { id: 'a-m5-2', memberId: 'm5', kind: 'solution', projectKey: 'ST-Performance', projectName: 'ST · Performance Opt', percent: 20, start: '2024-11-01', end: '2026-12-26' },

    { id: 'a-m6-1', memberId: 'm6', kind: 'project',  projectKey: 'PRJ-Atlas',     projectName: 'Atlas Platform',      percent: 40, start: '2025-09-01', end: '2026-06-14' },
    { id: 'a-m6-2', memberId: 'm6', kind: 'solution', projectKey: 'ST-Security',   projectName: 'ST · Security Review', percent: 30, start: '2025-09-01', end: '2026-12-26' },
    { id: 'a-m6-3', memberId: 'm6', kind: 'project',  projectKey: 'PRJ-Phoenix',   projectName: 'Phoenix Rewrite',     percent: 50, start: '2026-06-15', end: '2027-01-31' }
  ];

  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── Date helpers (string ISO yyyy-mm-dd) ──────────────────────

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  function parseDate(iso) {
    return new Date(iso + 'T00:00:00');
  }

  function toISO(d) {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function daysBetween(a, b) {
    return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
  }

  function addDays(iso, days) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
  }

  function startOfMonth(iso) {
    const d = parseDate(iso);
    d.setDate(1);
    return toISO(d);
  }

  function buildMonths(start, end) {
    const out = [];
    const cur = parseDate(startOfMonth(start));
    const endD = parseDate(end);
    while (cur <= endD) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      out.push({ iso: toISO(cur), year: y, month: m, days });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }

  // Compute timeline range from a list of assignments (string starts/ends),
  // padded to whole months on both ends. Falls back to a 4-year window.
  function getDataRange(assignments) {
    if (!assignments || assignments.length === 0) {
      return { start: '2024-01-01', end: '2027-12-31' };
    }
    const starts = assignments.map((a) => a.start).sort();
    const ends   = assignments.map((a) => a.end).sort();
    const minStart = startOfMonth(starts[0]);
    const last = parseDate(ends[ends.length - 1]);
    last.setMonth(last.getMonth() + 1);
    last.setDate(0);
    return { start: minStart, end: toISO(last) };
  }

  // Returns project/solution/total % for a member on a given date.
  function getCurrentAllocation(memberId, date, assignments) {
    const active = assignments.filter(
      (a) => a.memberId === memberId && date >= a.start && date <= a.end
    );
    const project  = active.filter((a) => a.kind === 'project').reduce((s, a) => s + Number(a.percent || 0), 0);
    const solution = active.filter((a) => a.kind === 'solution').reduce((s, a) => s + Number(a.percent || 0), 0);
    return { project, solution, total: project + solution };
  }

  // Pixels per day per time range — matches the React design.
  const DAY_W_BY_RANGE = {
    '6M':  4.4,
    '1Y':  2.4,
    '2Y':  1.3,
    'ALL': 0.9
  };

  function getTimeRangeDays(range) {
    switch (range) {
      case '6M':  return 183;
      case '1Y':  return 366;
      case '2Y':  return 731;
      case 'ALL': return 365 * 10;
      default:    return 366;
    }
  }

  function getTimeRangeLabel(range) {
    switch (range) {
      case '6M':  return '6 tháng';
      case '1Y':  return '1 năm';
      case '2Y':  return '2 năm';
      case 'ALL': return 'Tất cả';
      default:    return range;
    }
  }

  global.AllocationData = {
    TODAY,
    MEMBERS,
    PROJECTS,
    SEED_ASSIGNMENTS,
    MONTH_NAMES_SHORT,
    DAY_W_BY_RANGE,
    parseDate,
    toISO,
    daysBetween,
    addDays,
    startOfMonth,
    buildMonths,
    getDataRange,
    getCurrentAllocation,
    getTimeRangeDays,
    getTimeRangeLabel
  };
})(window);
