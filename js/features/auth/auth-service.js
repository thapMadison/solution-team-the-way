/**
 * Authentication service — wraps Firebase Authentication with Microsoft OAuth.
 *
 * Roles:
 *   - guest:         not logged in → can only view Roles & Request Process pages
 *   - user:          logged in, role="user" → view Request Log (masked), limited edit
 *   - solution-team: logged in, role="solution-team" → full access
 *
 * User data stored at `users/{uid}`: { email, displayName, role, memberId?, createdAt }.
 * The memberId is used for Resource Allocation integration.
 */

import { firebaseDb }                                                       from '../../data/firebase-init.js';
import { PATHS }                                                            from '../../config/firebase.js';
import {
  AZURE_TENANT_ID, SOLUTION_TEAM_EMAILS, MOCK_USERS,
  IS_LOCALHOST, AUTH_CACHE_KEY, AUTH_CACHE_TTL_MS
} from '../../config/auth.js';

const state = {
  user:        null,   // Firebase Auth user object
  profile:     null,   // { email, displayName, role, memberId, ... } from /users/{uid}
  ready:       false,  // true after first auth state check
  listeners:   [],
  cachedState: null    // Restored from localStorage on load
};

// ── LocalStorage Cache ────────────────────────────────────────

function saveCache(user, profile) {
  if (user && profile) {
    const cache = {
      uid:         user.uid,
      email:       user.email,
      displayName: profile.displayName,
      role:        profile.role,
      memberId:    profile.memberId || null,
      timestamp:   Date.now()
    };
    try { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache)); }
    catch (_) { /* quota exceeded — ignore */ }
  } else {
    localStorage.removeItem(AUTH_CACHE_KEY);
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > AUTH_CACHE_TTL_MS) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return cache;
  } catch (_) {
    return null;
  }
}

// ── Public selectors ──────────────────────────────────────────

export const getCache         = () => state.cachedState;
export const isGuest          = () => !state.user;
export const isLoggedIn       = () => !!state.user;
export const isSolutionTeam   = () => state.profile?.role === 'solution-team';
export const isNormalUser     = () => state.profile?.role === 'user';
export const getUser          = () => state.user;
export const getProfile       = () => state.profile;
export const getRole          = () => state.profile ? state.profile.role : 'guest';
export const getMemberId      = () => state.profile ? state.profile.memberId : null;

export function onAuthChange(fn) {
  state.listeners.push(fn);
  if (state.ready) fn(state.user, state.profile);
  return () => { state.listeners = state.listeners.filter((f) => f !== fn); };
}

function notifyListeners() {
  state.listeners.forEach((fn) => {
    try { fn(state.user, state.profile); } catch (e) { console.error(e); }
  });
}

// ── Profile I/O ───────────────────────────────────────────────

export async function fetchProfile(uid) {
  if (!firebaseDb) return null;
  try {
    const snap = await firebaseDb.ref(`${PATHS.users}/${uid}`).once('value');
    return snap.val();
  } catch (e) {
    console.warn('[auth] fetchProfile failed', e);
    return null;
  }
}

export async function saveProfile(uid, data) {
  if (!firebaseDb) return;
  await firebaseDb.ref(`${PATHS.users}/${uid}`).update(data);
}

function determineRole(email) {
  const lower = (email || '').toLowerCase();
  if (SOLUTION_TEAM_EMAILS[lower]) {
    return { role: 'solution-team', memberId: SOLUTION_TEAM_EMAILS[lower] };
  }
  return { role: 'user', memberId: null };
}

export async function createUserProfile(uid, email, displayName) {
  const { role, memberId } = determineRole(email);
  const profile = {
    email,
    displayName: displayName || email.split('@')[0],
    role,
    createdAt: new Date().toISOString()
  };
  if (memberId) profile.memberId = memberId;
  await firebaseDb.ref(`${PATHS.users}/${uid}`).set(profile);
  return profile;
}

// ── Auth actions ──────────────────────────────────────────────

export async function signInWithMicrosoft() {
  if (IS_LOCALHOST) return showMockLoginSelector();

  const provider = new firebase.auth.OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account', tenant: AZURE_TENANT_ID });
  const result = await firebase.auth().signInWithPopup(provider);
  return result.user;
}

async function showMockLoginSelector() {
  const choice = prompt('🧪 MOCK LOGIN (localhost only)\n\nChọn role để test:\n1 = solution-team\n2 = user\n\nNhập 1 hoặc 2:');
  if (choice === '1' || choice?.toLowerCase() === 'solution-team') return mockLogin('solution-team');
  if (choice === '2' || choice?.toLowerCase() === 'user')          return mockLogin('user');
  throw new Error('Cancelled');
}

async function mockLogin(roleKey) {
  const mockUser = MOCK_USERS[roleKey];

  // Use Firebase Anonymous Auth so the session has a real token for DB access.
  let firebaseUser;
  try {
    const result = await firebase.auth().signInAnonymously();
    firebaseUser = result.user;
  } catch (e) {
    console.warn('[auth] Anonymous auth failed, using pure mock:', e);
    firebaseUser = { uid: mockUser.uid, email: mockUser.email, displayName: mockUser.displayName };
  }

  const profile = {
    email:       mockUser.email,
    displayName: mockUser.displayName,
    role:        mockUser.role,
    memberId:    mockUser.memberId,
    isMock:      true,
    createdAt:   new Date().toISOString()
  };

  try { await firebaseDb.ref(`${PATHS.users}/${firebaseUser.uid}`).set(profile); }
  catch (e) { console.warn('[auth] Failed to save mock profile:', e); }

  state.user = firebaseUser;
  state.profile = profile;

  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
    uid:         firebaseUser.uid,
    email:       mockUser.email,
    displayName: mockUser.displayName,
    role:        mockUser.role,
    memberId:    mockUser.memberId,
    isMock:      true,
    timestamp:   Date.now()
  }));

  state.ready = true;
  notifyListeners();
  return firebaseUser;
}

export async function signOut() {
  localStorage.removeItem(AUTH_CACHE_KEY);
  await firebase.auth().signOut();
}

// ── Bootstrap ─────────────────────────────────────────────────

export function initAuth() {
  state.cachedState = loadCache();

  if (!firebase || !firebase.auth) {
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
        if (IS_LOCALHOST && state.cachedState?.isMock && user.isAnonymous) {
          state.profile = {
            email:       state.cachedState.email,
            displayName: state.cachedState.displayName,
            role:        state.cachedState.role,
            memberId:    state.cachedState.memberId,
            isMock:      true
          };
          try { await firebaseDb.ref(`${PATHS.users}/${user.uid}`).set(state.profile); }
          catch (_) { /* ignore */ }
        } else {
          state.profile = await createUserProfile(user.uid, user.email, user.displayName);
        }
      }
    } else {
      state.profile = null;
    }

    saveCache(state.user, state.profile);
    state.ready = true;
    notifyListeners();
  });
}

// Re-export the users path so callers don't need a separate import.
export { PATHS };
