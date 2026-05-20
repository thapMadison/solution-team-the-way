/**
 * Entry point for requests-log.html (Request Log + Allocation Timeline).
 */

import { initAuth }          from '../features/auth/auth-service.js';
import { initAuthUI }        from '../features/auth/auth-ui.js';
import { initAccessControl } from '../features/auth/access-control.js';
import { initRequests }      from '../features/requests/index.js';
import { initAllocation }    from '../features/allocation/index.js';
import { initTheme }         from '../ui/theme.js';
import { initMobileNav }     from '../ui/mobile-nav.js';
import { onReady }           from '../core/bootstrap.js';

initAuth();
onReady(() => {
  initTheme();
  initMobileNav();
  initAuthUI();
  initAccessControl();
  initRequests();
  initAllocation();
});
