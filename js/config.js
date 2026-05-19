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
    low:      { icon: '⚪', label: 'Low' },
    medium:   { icon: '🔵', label: 'Medium' },
    high:     { icon: '🟠', label: 'High' },
    critical: { icon: '🔴', label: 'Critical' }
  };

  const TYPE = {
    'technical-support': { icon: '🔧', label: 'Technical Support' },
    proposal:            { icon: '📋', label: 'Proposal / Presale' },
    'code-review':       { icon: '🔍', label: 'Code Review' },
    architecture:        { icon: '🏗️', label: 'Architecture Consultation' },
    infrastructure:      { icon: '🖥️', label: 'DevOps & Infrastructure' },
    rd:                  { icon: '🧪', label: 'R&D Request' },
    training:            { icon: '📚', label: 'Training / Knowledge Sharing' },
    other:               { icon: '📦', label: 'Other' }
  };

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

  const PROJECTS = [
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

  global.AppConfig = { STATUS, PRIORITY, TYPE, PAGINATION, VALIDATION, PROJECTS };
})(window);
