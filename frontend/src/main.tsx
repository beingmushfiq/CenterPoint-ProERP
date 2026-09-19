import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import type { ReducedMotionConfig } from 'framer-motion';

import './styles/index.css';
import App from './App';
import { bootFail, bootStep } from './app/boot';
import { GlobalBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toast';
import { createQueryClient } from './lib/api/queryClient';
import { installGlobalErrorHandlers } from './lib/observability/logger';
import { registerServiceWorker } from './registerSW';
import { prefersReducedMotion } from './lib/motion/tokens';

/* The module graph has executed. Second real milestone on the boot rail. */
bootStep('scripts');

/* §8.4: global error handlers must be installed before React mounts so they
   catch errors from the boot path and from event handlers/timers outside the
   React call stack. Idempotent — safe to call once. */
installGlobalErrorHandlers();

/* Automatically reload if a dynamic import fails due to new asset hash deployment */
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload chunk error detected, reloading...', event);
  window.location.reload();
});

/* §7.6 rule 1 — reduced motion is resolved once, globally, at the provider
   level. The pre-paint script in index.html has already reconciled the stored
   user preference with the OS setting and written the result to
   <html data-reduced-motion>. We read that once here; individual components
   never re-check.

   'always' | 'never', deliberately not Framer's 'user'. 'user' would delegate
   the decision back to `matchMedia`, which §7.6 rule 2 forbids: a stored
   preference must override the OS in BOTH directions, including a user who
   explicitly opts *in* to motion on a device that requests less of it. */
const reducedMotion: ReducedMotionConfig = prefersReducedMotion() ? 'always' : 'never';

/* One client for the process. Created here rather than inside a component so a
   re-render can never swap the cache out from under in-flight queries. */
const queryClient = createQueryClient();

const container = document.getElementById('root');

if (!container) {
  /* The mount point is missing, which means index.html was tampered with or a
     proxy mangled the response. There is no React to render an error with, so
     the boot loader becomes the error surface. */
  bootFail('The application could not start. Please reload the page.');
} else {
  createRoot(container).render(
    <StrictMode>
      {/* Outermost, and deliberately outside every provider: §8.4 level ① and
          ARCHITECTURE.md §6.7 give the root boundary "provider/bootstrap
          failure" as its job, which it cannot do from inside the providers it
          is meant to catch. Its fallback imports only React, lucide and Button,
          so it renders correctly with no context available at all. */}
      <GlobalBoundary>
        <MotionConfig reducedMotion={reducedMotion}>
          <LazyMotion features={domAnimation}>
            <QueryClientProvider client={queryClient}>
              <App />
              {/* §8.1 row 5, transient variant. A sibling of <App />, not a
                  child of any route, so a route-level boundary tearing down
                  cannot take an in-flight confirmation with it. */}
              <Toaster />
            </QueryClientProvider>
          </LazyMotion>
        </MotionConfig>
      </GlobalBoundary>
    </StrictMode>
  );

  /* Registered after mount, never before. A service worker that installs while
     the shell is still booting competes for the same connection budget. */
  registerServiceWorker();
}
