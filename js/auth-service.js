/**
 * Authentication service — wraps Firebase Authentication.
 *
 * Roles:
 *   - guest:         not logged in → can only view Roles & Request Process pages
 *   - user:          logged in, role="user" → view Request Log (masked), limited edit
 *   - solution-team: logged in, role="solution-team" → full access
 *
 * User data stored in Firebase Realtime Database at `users/{uid}`:
 *   { email, displayName, role, memberId?, createdAt }
 *
 * The memberId links to AllocationData.MEMBERS for solution team members.
 */
(function (global) {
  'use strict';

  const USERS_PATH = 'users';

  const state = {
    user: null,           // Firebase Auth user object
    profile: null,        // { email, displayName, role, memberId, ... } from /users/{uid}
    ready: false,         // true after first auth state check
    listeners: []
  };

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

  async function createUserProfile(uid, email, displayName, role, memberId) {
    const profile = {
      email,
      displayName: displayName || email.split('@')[0],
      role: role || 'user',
      createdAt: new Date().toISOString()
    };
    if (memberId) profile.memberId = memberId;
    await firebaseDb.ref(`${USERS_PATH}/${uid}`).set(profile);
    return profile;
  }

  // ── Auth actions ──────────────────────────────────────────────

  async function signIn(email, password) {
    const auth = firebase.auth();
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signOut() {
    await firebase.auth().signOut();
  }

  async function changePassword(currentPassword, newPassword) {
    const user = firebase.auth().currentUser;
    if (!user || !user.email) throw new Error('Not logged in');
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPassword);
  }

  async function sendPasswordReset(email) {
    await firebase.auth().sendPasswordResetEmail(email);
  }

  // ── Bootstrap ─────────────────────────────────────────────────

  function bootstrap() {
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
          state.profile = await createUserProfile(user.uid, user.email, user.displayName, 'user', null);
        }
      } else {
        state.profile = null;
      }
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

  /**
   * Seed test users (run once from browser console).
   * Usage: AuthService.seedTestUsers()
   */
  async function seedTestUsers() {
    const auth = firebase.auth();
    const testUsers = [
      // Role: solution-team
      {
        email: 'thap.nguyen@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Thap Nguyen',
        role: 'solution-team',
        memberId: 'm1'
      },
      {
        email: 'gianh.tran@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Gianh Tran',
        role: 'solution-team',
        memberId: 'm2'
      },
      {
        email: 'lam.pham.tung@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Lam Pham',
        role: 'solution-team',
        memberId: 'm3'
      },
      {
        email: 'qua.vo.van@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Qua Vo Van',
        role: 'solution-team',
        memberId: 'm4'
      },
      {
        email: 'huy.phan@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Huy Phan',
        role: 'solution-team',
        memberId: 'm5'
      },

      // Role: user
      {
        email: 'bao.duong.huy@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Bao Duong Huy',
        role: 'user',
        memberId: null
      },
      {
        email: 'dieu.bui@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Dieu Bui',
        role: 'user',
        memberId: null
      },
      {
        email: 'dung.nguyen@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Dung Nguyen',
        role: 'user',
        memberId: null
      },
      {
        email: 'duy.nguyen@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Duy Nguyen',
        role: 'user',
        memberId: null
      },
      {
        email: 'hanh.ha@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hanh Ha',
        role: 'user',
        memberId: null
      },
      {
        email: 'hien.duong.thi.thu@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hien Duong',
        role: 'user',
        memberId: null
      },
      {
        email: 'hieu.pham@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hieu Pham',
        role: 'user',
        memberId: null
      },
      {
        email: 'hieu.tran.minh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hieu Tran Minh',
        role: 'user',
        memberId: null
      },
      {
        email: 'huy.do@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Huy Do',
        role: 'user',
        memberId: null
      },
      {
        email: 'phuong.phan@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Phuong Phan',
        role: 'user',
        memberId: null
      },
      {
        email: 'son.le@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Son Le',
        role: 'user',
        memberId: null
      },
      {
        email: 'tin.nguyen.trung@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Tin Nguyen',
        role: 'user',
        memberId: null
      },
      {
        email: 'tong.ngo@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Tong Ngo',
        role: 'user',
        memberId: null
      },
      {
        email: 'tram.pham@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Tram Pham',
        role: 'user',
        memberId: null
      },
      {
        email: 'truong.huynh.le.thanh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Truong Huynh',
        role: 'user',
        memberId: null
      },
      {
        email: 'viet.le@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Viet Le',
        role: 'user',
        memberId: null
      },
      {
        email: 'thien.tran.phan.huy@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Thien Huy',
        role: 'user',
        memberId: null
      },
      {
        email: 'huy.doan.quoc@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Huy Doan',
        role: 'user',
        memberId: null
      },
      {
        email: 'dieu.tran.thi.huyen@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Dieu Tran Thi Huyen',
        role: 'user',
        memberId: null
      },
      {
        email: 'nina@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Nhi Dang',
        role: 'user',
        memberId: null
      },
      {
        email: 'hoang.nguyen.the@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hoang Nguyen The',
        role: 'user',
        memberId: null
      },
      {
        email: 'hieu.nguyen.phuoc.minh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hieu Nguyen Phuoc Minh',
        role: 'user',
        memberId: null
      },
      {
        email: 'ngan.phan.thi.kim@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Ngan Phan',
        role: 'user',
        memberId: null
      },
      {
        email: 'yen.nguyen.thi@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Yen Nguyen Thi',
        role: 'user',
        memberId: null
      },
      {
        email: 'luyen.ngo@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Luyen Ngo',
        role: 'user',
        memberId: null
      },
      {
        email: 'yen.tran.thi.hoang@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Yen Tran',
        role: 'user',
        memberId: null
      },
      {
        email: 'tracy.huynh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Tracy Huynh',
        role: 'user',
        memberId: null
      },
      {
        email: 'thanh.nguyen.van.dat@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Thanh Nguyen Van Dat',
        role: 'user',
        memberId: null
      },
      {
        email: 'duc.dang.hoai@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Duc Dang',
        role: 'user',
        memberId: null
      },
      {
        email: 'duy.hoang.khanh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Duy Hoang Khanh',
        role: 'user',
        memberId: null
      },
      {
        email: 'phuong.trinh.dinh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Phuong Trinh Dinh',
        role: 'user',
        memberId: null
      },
      {
        email: 'hoang.le.viet@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Hoang Le Viet',
        role: 'user',
        memberId: null
      },
      {
        email: 'dat.nguyen.tien@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Dat Nguyen Tien',
        role: 'user',
        memberId: null
      },
      {
        email: 'quy@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Quy Thi',
        role: 'user',
        memberId: null
      },
      {
        email: 'vinh@madison.dev',
        password: 'Maddie123^^',
        displayName: 'Vinh (David)',
        role: 'user',
        memberId: null
      }
    ];

    const results = [];
    for (const u of testUsers) {
      try {
        // Create user in Firebase Auth
        const cred = await auth.createUserWithEmailAndPassword(u.email, u.password);
        // Create profile in Realtime Database
        await createUserProfile(cred.user.uid, u.email, u.displayName, u.role, u.memberId);
        results.push({ email: u.email, status: 'created', uid: cred.user.uid });
        console.log(`✓ Created: ${u.email} (${u.role})`);
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          results.push({ email: u.email, status: 'already exists' });
          console.log(`• Skipped: ${u.email} (already exists)`);
        } else {
          results.push({ email: u.email, status: 'error', error: err.message });
          console.error(`✗ Failed: ${u.email}`, err.message);
        }
      }
    }

    // Sign out after seeding
    await auth.signOut();
    console.log('\nDone!');
    return results;
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
    onAuthChange,
    signIn,
    signOut,
    changePassword,
    sendPasswordReset,
    fetchProfile,
    saveProfile,
    createUserProfile,
    seedTestUsers,
    USERS_PATH
  };
})(window);
