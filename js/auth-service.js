/**
 * Authentication service — wraps Firebase Authentication with Microsoft OAuth.
 *
 * Roles:
 *   - guest:         not logged in → can only view Roles & Request Process pages
 *   - user:          logged in, role="user" → view Request Log (masked), limited edit
 *   - solution-team: logged in, role="solution-team" → full access
 *
 * User data stored in Firebase Realtime Database at `users/{uid}`:
 *   { email, displayName, role, memberId?, createdAt }
 *
 * The memberId is used for Resource Allocation integration.
 */
(function (global) {
  'use strict';

  const USERS_PATH = 'users';
  const CACHE_KEY = 'auth_cache';

  // Solution team members - email to memberId mapping
  const SOLUTION_TEAM_EMAILS = {
    'thap.nguyen@madison.dev': 'm1',
    'gianh.tran@madison.dev': 'm2',
    'lam.pham.tung@madison.dev': 'm3',
    'qua.vo.van@madison.dev': 'm4',
    'huy.phan@madison.dev': 'm5'
  };

  const state = {
    user: null,           // Firebase Auth user object
    profile: null,        // { email, displayName, role, memberId, ... } from /users/{uid}
    ready: false,         // true after first auth state check
    listeners: [],
    cachedState: null     // Restored from localStorage on load
  };

  // ── LocalStorage Cache ────────────────────────────────────────
  function saveCache(user, profile) {
    if (user && profile) {
      const cache = {
        uid: user.uid,
        email: user.email,
        displayName: profile.displayName,
        role: profile.role,
        memberId: profile.memberId || null,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) { /* quota exceeded, ignore */ }
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      // Cache expires after 7 days
      if (Date.now() - cache.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cache;
    } catch (e) {
      return null;
    }
  }

  function getCache() {
    return state.cachedState;
  }

  function isGuest()        { return !state.user; }
  function isLoggedIn()     { return !!state.user; }
  function isSolutionTeam() { return state.profile && state.profile.role === 'solution-team'; }
  function isNormalUser()   { return state.profile && state.profile.role === 'user'; }

  function getUser()    { return state.user; }
  function getProfile() { return state.profile; }
  function getRole()    { return state.profile ? state.profile.role : 'guest'; }
  function getMemberId(){ return state.profile ? state.profile.memberId : null; }

  function onAuthChange(fn) {
    state.listeners.push(fn);
    if (state.ready) fn(state.user, state.profile);
    return () => { state.listeners = state.listeners.filter((f) => f !== fn); };
  }

  function notifyListeners() {
    state.listeners.forEach((fn) => {
      try { fn(state.user, state.profile); } catch (e) { console.error(e); }
    });
  }

  async function fetchProfile(uid) {
    if (!global.firebaseDb) return null;
    try {
      const snap = await firebaseDb.ref(`${USERS_PATH}/${uid}`).once('value');
      return snap.val();
    } catch (e) {
      console.warn('[auth] fetchProfile failed', e);
      return null;
    }
  }

  async function saveProfile(uid, data) {
    if (!global.firebaseDb) return;
    await firebaseDb.ref(`${USERS_PATH}/${uid}`).update(data);
  }

  function determineRole(email) {
    const lowerEmail = (email || '').toLowerCase();
    if (SOLUTION_TEAM_EMAILS[lowerEmail]) {
      return { role: 'solution-team', memberId: SOLUTION_TEAM_EMAILS[lowerEmail] };
    }
    return { role: 'user', memberId: null };
  }

  async function createUserProfile(uid, email, displayName) {
    const { role, memberId } = determineRole(email);
    const profile = {
      email,
      displayName: displayName || email.split('@')[0],
      role,
      createdAt: new Date().toISOString()
    };
    if (memberId) profile.memberId = memberId;
    await firebaseDb.ref(`${USERS_PATH}/${uid}`).set(profile);
    return profile;
  }

  // ── Auth actions ──────────────────────────────────────────────

  // Azure AD Tenant ID - get from Azure Portal → Azure AD → Overview
  const AZURE_TENANT_ID = 'fa190090-4fc1-416a-bd41-a480b5dad5b7';

  // Check if running on localhost (for mock login)
  const IS_LOCALHOST = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';

  // Mock users for local testing
  const MOCK_USERS = {
    'solution-team': {
      uid: 'mock-solution-team-uid',
      email: 'thap.nguyen@madison.dev',
      displayName: 'Thap Nguyen (Mock)',
      role: 'solution-team',
      memberId: 'm1'
    },
    'user': {
      uid: 'mock-user-uid',
      email: 'test.user@madison.dev',
      displayName: 'Test User (Mock)',
      role: 'user',
      memberId: null
    }
  };

  async function signInWithMicrosoft() {
    // On localhost, show mock login selector
    if (IS_LOCALHOST) {
      return showMockLoginSelector();
    }

    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    provider.setCustomParameters({
      prompt: 'select_account',
      tenant: AZURE_TENANT_ID
    });
    const result = await firebase.auth().signInWithPopup(provider);
    return result.user;
  }

  async function showMockLoginSelector() {
    const role = prompt('🧪 MOCK LOGIN (localhost only)\n\nChọn role để test:\n1 = solution-team\n2 = user\n\nNhập 1 hoặc 2:');

    if (role === '1' || role?.toLowerCase() === 'solution-team') {
      return mockLogin('solution-team');
    } else if (role === '2' || role?.toLowerCase() === 'user') {
      return mockLogin('user');
    } else {
      throw new Error('Cancelled');
    }
  }

  async function mockLogin(roleKey) {
    const mockUser = MOCK_USERS[roleKey];

    // Use Firebase Anonymous Auth to get real auth token for database access
    let firebaseUser;
    try {
      const result = await firebase.auth().signInAnonymously();
      firebaseUser = result.user;
    } catch (e) {
      console.warn('[auth] Anonymous auth failed, using pure mock:', e);
      firebaseUser = { uid: mockUser.uid, email: mockUser.email, displayName: mockUser.displayName };
    }

    // Create/update profile with mock role
    const profile = {
      email: mockUser.email,
      displayName: mockUser.displayName,
      role: mockUser.role,
      memberId: mockUser.memberId,
      isMock: true,
      createdAt: new Date().toISOString()
    };

    // Save to Firebase (so other features work)
    try {
      await firebaseDb.ref(`${USERS_PATH}/${firebaseUser.uid}`).set(profile);
    } catch (e) {
      console.warn('[auth] Failed to save mock profile:', e);
    }

    state.user = firebaseUser;
    state.profile = profile;

    // Save cache with mock flag
    const cache = {
      uid: firebaseUser.uid,
      email: mockUser.email,
      displayName: mockUser.displayName,
      role: mockUser.role,
      memberId: mockUser.memberId,
      isMock: true,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

    state.ready = true;
    notifyListeners();

    return firebaseUser;
  }

  async function signOut() {
    localStorage.removeItem(CACHE_KEY);
    await firebase.auth().signOut();
  }

  // ── Bootstrap ─────────────────────────────────────────────────

  function bootstrap() {
    // Load cache immediately (before Firebase)
    state.cachedState = loadCache();

    // On localhost with mock session, let Firebase anonymous auth restore the session
    // The onAuthStateChanged will handle it with the isMock flag in cache

    if (!global.firebase || !firebase.auth) {
      console.warn('[auth] Firebase Auth SDK not loaded');
      state.ready = true;
      notifyListeners();
      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      state.user = user;
      if (user) {
        state.profile = await fetchProfile(user.uid);
        if (!state.profile) {
          // Check if this is a mock session being restored
          if (IS_LOCALHOST && state.cachedState?.isMock && user.isAnonymous) {
            state.profile = {
              email: state.cachedState.email,
              displayName: state.cachedState.displayName,
              role: state.cachedState.role,
              memberId: state.cachedState.memberId,
              isMock: true
            };
            // Save to Firebase
            try {
              await firebaseDb.ref(`${USERS_PATH}/${user.uid}`).set(state.profile);
            } catch (e) { /* ignore */ }
          } else {
            // First login - create profile from Microsoft account info
            state.profile = await createUserProfile(user.uid, user.email, user.displayName);
          }
        }
      } else {
        state.profile = null;
      }
      // Update cache
      saveCache(state.user, state.profile);
      state.ready = true;
      notifyListeners();
    });
  }

  // Auto-bootstrap when DOM ready and Firebase loaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    setTimeout(bootstrap, 0);
  }

  global.AuthService = {
    isGuest,
    isLoggedIn,
    isSolutionTeam,
    isNormalUser,
    getUser,
    getProfile,
    getRole,
    getMemberId,
    getCache,
    onAuthChange,
    signInWithMicrosoft,
    signOut,
    fetchProfile,
    saveProfile,
    createUserProfile,
    USERS_PATH
  };
})(window);
