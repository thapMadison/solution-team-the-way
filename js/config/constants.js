/**
 * Domain constants — enum labels/icons, validation rules, project list.
 * Pure data, no side effects.
 */

export const STATUS = {
  pending:       { icon: '⏳', label: 'Pending' },
  'in-progress': { icon: '🔄', label: 'In Progress' },
  completed:     { icon: '✅', label: 'Completed' },
  cancelled:     { icon: '❌', label: 'Cancelled' }
};

export const PRIORITY = {
  low:      { icon: '⚪', label: 'Low' },
  medium:   { icon: '🔵', label: 'Medium' },
  high:     { icon: '🟠', label: 'High' },
  critical: { icon: '🔴', label: 'Critical' }
};

export const TYPE = {
  'technical-support': { icon: '🔧', label: 'Technical Support' },
  proposal:            { icon: '📋', label: 'Proposal / Presale' },
  'code-review':       { icon: '🔍', label: 'Code Review' },
  architecture:        { icon: '🏗️', label: 'Architecture Consultation' },
  infrastructure:      { icon: '🖥️', label: 'DevOps & Infrastructure' },
  rd:                  { icon: '🧪', label: 'R&D Request' },
  training:            { icon: '📚', label: 'Training / Knowledge Sharing' },
  other:               { icon: '📦', label: 'Other' }
};

export const PAGINATION = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100]
};

export const VALIDATION = {
  requester:   { max: 100 },
  email:       { max: 100, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  title:       { max: 200 },
  description: { max: 2000 },
  project:     { max: 100 }
};

export const PROJECTS = [
  'Toppen Website & App Maintainance',
  'IPC Web App Maintainance',
  'IPC Soulmates',
  'RPD Maintainance',
  'GL App',
  'MediaMice',
  'Gamuda Defect Management Maintenance',
  'PEMANDU Website and Hosting Maintenance Retainer',
  'Gamuda GDOS Plus',
  'Gamuda GDOS Maintenance',
  'RSG Dedicated Resource',
  'VetIT',
  'Fave Sea',
  'iuGO (RSG) Phase 1',
  'Gamuda Land Viet Nam (GLVN) Phase 2',
  'Toppen enhancement (Mobile APP)',
  'GDOS'
];

/** Shared hue palette for member/project color rotation. */
export const HUE_PALETTE = ['264', '290', '320', '20', '60', '160', '200', '340', '120', '30', '40', '50', '70'];

/** UI timing constants (ms). */
export const TIMING = {
  notificationToast: 4000,
  copyFeedback:      1500,
  keyboardJumpArm:   1200
};

/** Mapping from priority key → number of visual bars in the priority indicator. */
export const PRIORITY_BARS = { low: 1, medium: 2, high: 3, critical: 4 };
