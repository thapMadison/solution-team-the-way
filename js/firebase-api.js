/**
 * Firebase Realtime Database access layer for the `requests` + `allocations` nodes.
 * All callers should go through this object — never touch `firebase.database()` directly.
 */
(function (global) {
  'use strict';

  const REQUESTS_PATH    = 'requests';
  const ALLOCATIONS_PATH = 'allocations';

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
    /** One-shot read — used during seeding to detect an empty node. */
    async getAllocationsOnce() {
      const snapshot = await firebaseDb.ref(ALLOCATIONS_PATH).once('value');
      return toArray(snapshot.val());
    },

    /** Bulk write — used to seed the node with `SEED_ASSIGNMENTS` on first run. */
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
    }
  };

  global.FirebaseAPI = FirebaseAPI;
})(window);
