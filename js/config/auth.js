/**
 * Authentication configuration: tenant, role mapping, mock users for local dev.
 */

/** Azure AD Tenant ID (from Azure Portal → Azure AD → Overview). */
export const AZURE_TENANT_ID = 'fa190090-4fc1-416a-bd41-a480b5dad5b7';

/** Email → memberId mapping for Solution Team members. */
export const SOLUTION_TEAM_EMAILS = {
  'thap.nguyen@madison.dev':   'm1',
  'gianh.tran@madison.dev':    'm2',
  'lam.pham.tung@madison.dev': 'm3',
  'qua.vo.van@madison.dev':    'm4',
  'huy.phan@madison.dev':      'm5'
};

/** Mock users for localhost testing (no real Microsoft OAuth). */
export const MOCK_USERS = {
  'solution-team': {
    uid:         'mock-solution-team-uid',
    email:       'thap.nguyen@madison.dev',
    displayName: 'Thap Nguyen (Mock)',
    role:        'solution-team',
    memberId:    'm1'
  },
  user: {
    uid:         'mock-user-uid',
    email:       'test.user@madison.dev',
    displayName: 'Test User (Mock)',
    role:        'user',
    memberId:    null
  }
};

/** True when running on localhost, 127.0.0.1, or file:// (dev mode). */
export const IS_LOCALHOST =
  ['localhost', '127.0.0.1', ''].includes(location.hostname) ||
  location.protocol === 'file:';

/** Cache key in localStorage for the auth session snapshot. */
export const AUTH_CACHE_KEY = 'auth_cache';

/** Cache expires after this many milliseconds. */
export const AUTH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
