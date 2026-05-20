/**
 * Resource Allocation Timeline configuration: layout, time ranges, anchor date.
 */

/** Reference date used as "today" in the timeline view. */
export const TODAY = '2026-05-18';

/** Pixels per day per time-range zoom level. */
export const DAY_W_BY_RANGE = {
  '6M':  4.4,
  '1Y':  2.4,
  '2Y':  1.3,
  ALL:   0.9
};

/** Row / block layout constants. */
export const TIMELINE_LAYOUT = {
  rowMinHeight: 48,
  rowPadding:   6,
  segHeight:    20,
  segGap:       4
};
