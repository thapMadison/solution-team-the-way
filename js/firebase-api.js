/**
 * Firebase Realtime Database access layer for the `requests` + `allocations` nodes.
 * All callers should go through this object — never touch `firebase.database()` directly.
 */
(function (global) {
  'use strict';

  const REQUESTS_PATH    = 'requests';
  const ALLOCATIONS_PATH = 'allocations';
  const USERS_PATH       = 'users';

  function toArray(snapshotVal) {
    if (!snapshotVal) return [];
    return Object.keys(snapshotVal).map((key) => ({
      firebaseId: key,
      ...snapshotVal[key]
    }));
  }

  const FirebaseAPI = {
    // ── Requests ──────────────────────────────────────────────
    async createRequest(data) {
      const ref = firebaseDb.ref(REQUESTS_PATH).push();
      await ref.set(data);
      return ref.key;
    },

    async getRequest(firebaseId) {
      const snapshot = await firebaseDb.ref(`${REQUESTS_PATH}/${firebaseId}`).once('value');
      return snapshot.val();
    },

    async updateRequest(firebaseId, updates) {
      await firebaseDb.ref(`${REQUESTS_PATH}/${firebaseId}`).update(updates);
    },

    async deleteRequest(firebaseId) {
      await firebaseDb.ref(`${REQUESTS_PATH}/${firebaseId}`).remove();
    },

    /**
     * Subscribe to real-time changes. Returns an unsubscribe function.
     */
    onRequestsChange(callback) {
      const ref = firebaseDb.ref(REQUESTS_PATH);
      const handler = (snapshot) => callback(toArray(snapshot.val()));
      ref.on('value', handler);
      return () => ref.off('value', handler);
    },

    // ── Allocations ───────────────────────────────────────────
    /** One-shot read of all allocations. */
    async getAllocationsOnce() {
      const snapshot = await firebaseDb.ref(ALLOCATIONS_PATH).once('value');
      return toArray(snapshot.val());
    },

    /** Bulk write multiple allocation records. */
    async seedAllocations(records) {
      const updates = {};
      for (const r of records) {
        const ref = firebaseDb.ref(ALLOCATIONS_PATH).push();
        const { firebaseId, ...rest } = r;
        updates[ref.key] = rest;
      }
      await firebaseDb.ref(ALLOCATIONS_PATH).update(updates);
    },

    async createAllocation(data) {
      const ref = firebaseDb.ref(ALLOCATIONS_PATH).push();
      await ref.set(data);
      return ref.key;
    },

    async updateAllocation(firebaseId, updates) {
      await firebaseDb.ref(`${ALLOCATIONS_PATH}/${firebaseId}`).update(updates);
    },

    async deleteAllocation(firebaseId) {
      await firebaseDb.ref(`${ALLOCATIONS_PATH}/${firebaseId}`).remove();
    },

    onAllocationsChange(callback) {
      const ref = firebaseDb.ref(ALLOCATIONS_PATH);
      const handler = (snapshot) => callback(toArray(snapshot.val()));
      ref.on('value', handler);
      return () => ref.off('value', handler);
    },

    async getAllocationsByRequestKey(requestKey) {
      const snapshot = await firebaseDb.ref(ALLOCATIONS_PATH)
        .orderByChild('projectKey')
        .equalTo(requestKey)
        .once('value');
      return toArray(snapshot.val());
    },

    async syncAllocationStatusForRequest(requestKey, requestStatus) {
      const statusMap = {
        'pending': 'scheduled',
        'in-progress': 'active',
        'completed': 'done',
        'cancelled': 'done'
      };
      const allocStatus = statusMap[requestStatus] || 'active';
      const allocations = await this.getAllocationsByRequestKey(requestKey);
      for (const alloc of allocations) {
        if (alloc.kind === 'solution' && alloc.firebaseId) {
          await this.updateAllocation(alloc.firebaseId, { status: allocStatus });
        }
      }
    },

    // ── Users ─────────────────────────────────────────────────
    async getSolutionTeamMembers() {
      const snapshot = await firebaseDb.ref(USERS_PATH)
        .orderByChild('role')
        .equalTo('solution-team')
        .once('value');
      const val = snapshot.val();
      if (!val) return [];
      return Object.values(val).map(u => u.displayName).filter(Boolean).sort();
    },

    async getSolutionTeamMembersFull() {
      const snapshot = await firebaseDb.ref(USERS_PATH)
        .orderByChild('role')
        .equalTo('solution-team')
        .once('value');
      const val = snapshot.val();
      if (!val) return [];
      const hues = ['264', '290', '320', '20', '60', '160', '200', '340'];
      return Object.entries(val).map(([uid, u], idx) => ({
        id: u.memberId || uid,
        uid,
        name: u.displayName || u.email?.split('@')[0] || 'Unknown',
        email: u.email,
        initials: getInitials(u.displayName),
        role: 'Solution Team',
        hue: hues[idx % hues.length]
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  global.FirebaseAPI = FirebaseAPI;
})(window);
