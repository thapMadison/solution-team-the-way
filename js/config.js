/**
 * Application configuration: enums, labels, icons, team members.
 * Loaded as a global before any page-specific script.
 */
(function (global) {
  'use strict';

  const STATUS = {
    pending:       { icon: '⏳', label: 'Pending' },
    'in-progress': { icon: '🔄', label: 'In Progress' },
    completed:     { icon: '✅', label: 'Completed' },
    cancelled:     { icon: '❌', label: 'Cancelled' }
  };

  const PRIORITY = {
    low:      { icon: '🔵', label: 'Low' },
    medium:   { icon: '🟡', label: 'Medium' },
    high:     { icon: '🟠', label: 'High' },
    critical: { icon: '🔴', label: 'Critical' }
  };

  const TYPE = {
    'technical-support': { icon: '🔧', label: 'Technical Support' },
    proposal:            { icon: '📋', label: 'Proposal' },
    'code-review':       { icon: '🔍', label: 'Code Review' },
    architecture:        { icon: '🏗️', label: 'Architecture' },
    rd:                  { icon: '🧪', label: 'R&D' },
    training:            { icon: '📚', label: 'Training' },
    other:               { icon: '📦', label: 'Other' }
  };

  // Must match AllocationData.MEMBERS for auto-allocation to work
  const TEAM_MEMBERS = [
    'Unassigned',
    'Nguyễn An',
    'Trần Bảo',
    'Lê Chi',
    'Phạm Dũng',
    'Hoàng Em',
    'Đỗ Phúc'
  ];

  const PAGINATION = {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100]
  };

  const VALIDATION = {
    requester:   { max: 100 },
    email:       { max: 100, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    title:       { max: 200 },
    description: { max: 2000 },
    project:     { max: 100 }
  };

  global.AppConfig = { STATUS, PRIORITY, TYPE, TEAM_MEMBERS, PAGINATION, VALIDATION };
})(window);
