/**
 * Firebase Realtime Database access layer for the `requests` node.
 * All callers should go through this object — never touch `firebase.database()` directly.
 */
(function (global) {
  'use strict';

  const REQUESTS_PATH = 'requests';

  function toArray(snapshotVal) {
    if (!snapshotVal) return [];
    return Object.keys(snapshotVal).map((key) => ({
      firebaseId: key,
      ...snapshotVal[key]
    }));
  }

  const FirebaseAPI = {
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
    }
  };

  global.FirebaseAPI = FirebaseAPI;
})(window);
