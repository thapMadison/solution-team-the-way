/**
 * Realtime Database access layer for the `requests`, `allocations`, and `users` nodes.
 * Callers should never touch `firebase.database()` directly.
 */

import { firebaseDb }                from './firebase-init.js';
import { PATHS }                     from '../config/firebase.js';
import { HUE_PALETTE }               from '../config/constants.js';
import { initials }                  from '../core/format.js';

function toArray(snapshotVal) {
  if (!snapshotVal) return [];
  return Object.keys(snapshotVal).map((key) => ({
    firebaseId: key,
    ...snapshotVal[key]
  }));
}

// ── Requests ──────────────────────────────────────────────────

export async function createRequest(data) {
  const ref = firebaseDb.ref(PATHS.requests).push();
  await ref.set(data);
  return ref.key;
}

export async function getRequest(firebaseId) {
  const snap = await firebaseDb.ref(`${PATHS.requests}/${firebaseId}`).once('value');
  return snap.val();
}

export async function updateRequest(firebaseId, updates) {
  await firebaseDb.ref(`${PATHS.requests}/${firebaseId}`).update(updates);
}

export async function deleteRequest(firebaseId) {
  await firebaseDb.ref(`${PATHS.requests}/${firebaseId}`).remove();
}

/** Subscribe to real-time changes. Returns an unsubscribe function. */
export function onRequestsChange(callback) {
  const ref = firebaseDb.ref(PATHS.requests);
  const handler = (snap) => callback(toArray(snap.val()));
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

// ── Allocations ───────────────────────────────────────────────

export async function getAllocationsOnce() {
  const snap = await firebaseDb.ref(PATHS.allocations).once('value');
  return toArray(snap.val());
}

export async function seedAllocations(records) {
  const updates = {};
  for (const r of records) {
    const ref = firebaseDb.ref(PATHS.allocations).push();
    const { firebaseId, ...rest } = r;
    updates[ref.key] = rest;
  }
  await firebaseDb.ref(PATHS.allocations).update(updates);
}

export async function createAllocation(data) {
  const ref = firebaseDb.ref(PATHS.allocations).push();
  await ref.set(data);
  return ref.key;
}

export async function updateAllocation(firebaseId, updates) {
  await firebaseDb.ref(`${PATHS.allocations}/${firebaseId}`).update(updates);
}

export async function deleteAllocation(firebaseId) {
  await firebaseDb.ref(`${PATHS.allocations}/${firebaseId}`).remove();
}

export function onAllocationsChange(callback) {
  const ref = firebaseDb.ref(PATHS.allocations);
  const handler = (snap) => callback(toArray(snap.val()));
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function getAllocationsByRequestKey(requestKey) {
  const snap = await firebaseDb.ref(PATHS.allocations)
    .orderByChild('projectKey')
    .equalTo(requestKey)
    .once('value');
  return toArray(snap.val());
}

const REQUEST_TO_ALLOC_STATUS = {
  'pending':     'scheduled',
  'in-progress': 'active',
  'completed':   'done',
  'cancelled':   'done'
};

export async function syncAllocationStatusForRequest(requestKey, requestStatus) {
  const allocStatus = REQUEST_TO_ALLOC_STATUS[requestStatus] || 'active';
  const allocations = await getAllocationsByRequestKey(requestKey);
  for (const alloc of allocations) {
    if (alloc.kind === 'solution' && alloc.firebaseId) {
      await updateAllocation(alloc.firebaseId, { status: allocStatus });
    }
  }
}

// ── Users ─────────────────────────────────────────────────────

export async function getSolutionTeamMembers() {
  const snap = await firebaseDb.ref(PATHS.users)
    .orderByChild('role')
    .equalTo('solution-team')
    .once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val).map((u) => u.displayName).filter(Boolean).sort();
}

export async function getSolutionTeamMembersFull() {
  const snap = await firebaseDb.ref(PATHS.users)
    .orderByChild('role')
    .equalTo('solution-team')
    .once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.entries(val).map(([uid, u], idx) => ({
    id:       u.memberId || uid,
    uid,
    name:     u.displayName || u.email?.split('@')[0] || 'Unknown',
    email:    u.email,
    initials: initials(u.displayName),
    role:     'Solution Team',
    hue:      HUE_PALETTE[idx % HUE_PALETTE.length]
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Backward-compatible namespaced object — eases gradual migration in large
 * caller files (e.g. requests-app.js).
 */
export const FirebaseAPI = {
  createRequest, getRequest, updateRequest, deleteRequest, onRequestsChange,
  getAllocationsOnce, seedAllocations,
  createAllocation, updateAllocation, deleteAllocation, onAllocationsChange,
  getAllocationsByRequestKey, syncAllocationStatusForRequest,
  getSolutionTeamMembers, getSolutionTeamMembersFull
};
