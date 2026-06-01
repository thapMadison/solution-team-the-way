/**
 * Firebase project configuration.
 * API key is intentionally public — real access control lives in
 * Realtime Database security rules. See docs/FIREBASE_SETUP.md.
 */

export const firebaseConfig = {
  apiKey:            'AIzaSyClDROjeaCVTCj0JVYrMOgWRVVEVsb91do',
  authDomain:        'solution-team-requests.firebaseapp.com',
  databaseURL:       'https://solution-team-requests-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'solution-team-requests',
  storageBucket:     'solution-team-requests.firebasestorage.app',
  messagingSenderId: '671669366587',
  appId:             '1:671669366587:web:c65704074f2bcb2cbad11e',
  measurementId:     'G-3Y34LLDC5R'
};

export const RECAPTCHA_KEY = '6LfwAfMsAAAAALaOyFaWAgofFAjLJEOYkM8BwLwz';

/** Realtime Database paths. */
export const PATHS = {
  requests:    'requests',
  allocations: 'allocations',
  users:       'users',
  counters:    'counters',
};
