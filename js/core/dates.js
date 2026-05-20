/**
 * Generic date helpers operating on ISO `yyyy-mm-dd` strings.
 */

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function parseDate(iso) {
  return new Date(iso + 'T00:00:00');
}

export function toISO(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
}

export function addDays(iso, days) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function startOfMonth(iso) {
  const d = parseDate(iso);
  d.setDate(1);
  return toISO(d);
}

/** Build month metadata array between two ISO dates. */
export function buildMonths(start, end) {
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
