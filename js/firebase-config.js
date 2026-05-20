/**
 * Firebase initialization.
 * The API key here is public by design — true access control lives in
 * Firebase Realtime Database security rules (see docs/FIREBASE_SETUP.md).
 */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey:            'AIzaSyClDROjeaCVTCj0JVYrMOgWRVVEVsb91do',
    authDomain:        'solution-team-requests.firebaseapp.com',
    databaseURL:       'https://solution-team-requests-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'solution-team-requests',
    storageBucket:     'solution-team-requests.firebasestorage.app',
    messagingSenderId: '671669366587',
    appId:             '1:671669366587:web:c65704074f2bcb2cbad11e',
    measurementId:     'G-3Y34LLDC5R'
  };

  firebase.initializeApp(firebaseConfig);

  // App Check with reCAPTCHA v3
  const appCheck = firebase.appCheck();
  appCheck.activate('6LfwAfMsAAAAALaOyFaWAgofFAjLJEOYkM8BwLwz', true);

  window.firebaseDb = firebase.database();
})();
