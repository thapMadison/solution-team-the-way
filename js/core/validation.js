/**
 * Input validation helpers.
 */

import { VALIDATION } from '../config/constants.js';

export function isValidEmail(email) {
  return VALIDATION.email.pattern.test(email);
}
