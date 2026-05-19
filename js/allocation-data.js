/**
 * Resource Allocation Timeline — data model + helpers.
 *
 * Ported from `Redesign request log page/src/app/components/resource-allocation/data.ts`.
 * Date helpers and timeline utilities live here as plain JS.
 *
 * Members: fetched from Firebase (users with role='solution-team')
 * Projects: from AppConfig.PROJECTS in config.js
 */
(function (global) {
  'use strict';

  const TODAY = '2026-05-18';

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
