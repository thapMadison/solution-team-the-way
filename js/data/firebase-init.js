/**
 * Firebase initialization. Must be imported before any module that uses
 * `firebaseDb` or `firebaseAuth`.
 *
 * Assumes the firebase compat SDK scripts (v9) have been loaded as classic
 * scripts in the page, populating the global `firebase` object.
 */

import { firebaseConfig, RECAPTCHA_KEY } from '../config/firebase.js';

firebase.initializeApp(firebaseConfig);

firebase.appCheck().activate(RECAPTCHA_KEY, true);

export const firebaseDb   = firebase.database();
export const firebaseAuth = firebase.auth();
