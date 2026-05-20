/**
 * Resource Allocation Timeline — domain-specific data helpers.
 * Generic date utilities live in `core/dates.js`.
 */

import { parseDate, daysBetween, startOfMonth, toISO } from '../../core/dates.js';

/** Compute the visible timeline range from a list of assignments, padded to
 *  whole months on both ends. Falls back to a 4-year window when empty. */
export function getDataRange(assignments) {
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

/** project / solution / total % allocated to `memberId` on a given date. */
export function getCurrentAllocation(memberId, date, assignments) {
  const active = assignments.filter(
    (a) => a.memberId === memberId && date >= a.start && date <= a.end
  );
  const project  = active.filter((a) => a.kind === 'project').reduce((s, a) => s + Number(a.percent || 0), 0);
  const solution = active.filter((a) => a.kind === 'solution').reduce((s, a) => s + Number(a.percent || 0), 0);
  return { project, solution, total: project + solution };
}

export function getTimeRangeDays(range) {
  switch (range) {
    case '6M':  return 183;
    case '1Y':  return 366;
    case '2Y':  return 731;
    case 'ALL': return 365 * 10;
    default:    return 366;
  }
}

export function getTimeRangeLabel(range) {
  switch (range) {
    case '6M':  return '6 tháng';
    case '1Y':  return '1 năm';
    case '2Y':  return '2 năm';
    case 'ALL': return 'Tất cả';
    default:    return range;
  }
}

// Re-export date primitives so the rest of the allocation feature only needs
// one import.
export { parseDate, daysBetween };
