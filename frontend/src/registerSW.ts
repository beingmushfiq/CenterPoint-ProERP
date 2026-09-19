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

// Global hook for beforeinstallprompt.
// `beforeinstallprompt` is not in the TypeScript DOM lib (it is a Chromium
// extension to the spec), so the event shape is declared locally and the
// listener narrows via a cast at the single boundary where it arrives.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('pwa-install-available'));
  });
}

export function promptPWAInstall(): Promise<boolean> {
  const prompt = deferredPrompt;
  if (!prompt) return Promise.resolve(false);
  // The prompt is single-use: the browser discards it once shown, so clear our
  // reference immediately rather than after the choice resolves. Otherwise
  // `isPWAInstallable()` keeps reporting true for a prompt that can no longer
  // be raised, and the banner offers a button that does nothing.
  deferredPrompt = null;
  void prompt.prompt();
  return prompt.userChoice.then(({ outcome }) => outcome === 'accepted');
}

export function isPWAInstallable(): boolean {
  return Boolean(deferredPrompt);
}
