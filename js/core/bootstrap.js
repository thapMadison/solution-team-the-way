/**
 * Run a callback when the DOM is ready.
 * ES modules execute deferred, so by the time a module runs the DOM is usually
 * parsed — but this helper keeps things explicit and safe when scripts are
 * loaded conditionally.
 */
export function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}
