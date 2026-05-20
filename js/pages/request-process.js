/**
 * Entry point for request-process.html (Request Process & Templates).
 */

import { initAuth }          from '../features/auth/auth-service.js';
import { initAuthUI }        from '../features/auth/auth-ui.js';
import { initSectionNav }    from '../features/charter/section-nav.js';
import { initTemplateCopy }  from '../features/charter/template-copy.js';
import { initTheme }         from '../ui/theme.js';
import { initFadeIn }        from '../ui/fade-in.js';
import { initScrollSpy }     from '../ui/scroll-spy.js';
import { initMobileNav }     from '../ui/mobile-nav.js';
import { onReady }           from '../core/bootstrap.js';

initAuth();
onReady(() => {
  initTheme();
  initFadeIn();
  initScrollSpy();
  initMobileNav();
  initAuthUI();
  initSectionNav();
  initTemplateCopy();
});
