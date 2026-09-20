// ─────────────────────────────────────────────────────────────
// SERVICE WORKER REGISTRATION & PWA HOOKS
// ─────────────────────────────────────────────────────────────

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && (import.meta.env.PROD || !import.meta.env.DEV)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[App] ServiceWorker registered with scope:', registration.scope);

          // Check for worker updates
          registration.update().catch(() => {});

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  installing.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[App] ServiceWorker registration failed:', error);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  } else if ('serviceWorker' in navigator) {
    // Also register in dev preview mode if supported
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

import { usePwaInstallStore } from './store/pwaInstallStore';

export function promptPWAInstall(): Promise<boolean> {
  return usePwaInstallStore.getState().promptInstall();
}

export function isPWAInstallable(): boolean {
  return usePwaInstallStore.getState().isInstallable;
}

