/**
 * Inline SVG strings used by the Request Log UI.
 * Kept as a flat map so render functions can just `${ICONS.clock}` into HTML.
 */

export const ICONS = {
  clock:    '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>',
  chat:     '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.4 7.3L4 21l1.7-5.6A8 8 0 1 1 21 12z" stroke-linejoin="round"/></svg>',
  chev:     '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folder:   '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  plus:     '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
  x:        '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
  trash:    '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"/></svg>',
  save:     '<svg viewBox="0 0 24 24" class="rl-icon-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  dot:      '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
  commit:   '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M2 12h6M16 12h6"/></svg>',
  check:    '<svg viewBox="0 0 24 24" class="rl-icon-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
