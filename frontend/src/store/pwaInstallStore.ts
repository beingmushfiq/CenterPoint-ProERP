import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PwaZone = 'storefront' | 'erp';

export interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  activeZone: PwaZone;
  appName: string;
  logoUrl: string | null;

  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setIsInstalled: (installed: boolean) => void;
  setActiveZone: (zone: PwaZone) => void;
  setAppBranding: (appName: string, logoUrl: string | null) => void;
  promptInstall: () => Promise<boolean>;
}

export const usePwaInstallStore = create<PwaInstallState>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  isInstalled:
    typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
      : false,
  activeZone: 'erp',
  appName: 'Operations ERP',
  logoUrl: null,

  setDeferredPrompt: (prompt) => {
    set({
      deferredPrompt: prompt,
      isInstallable: Boolean(prompt),
    });
  },

  setIsInstalled: (installed) => {
    set({
      isInstalled: installed,
      isInstallable: installed ? false : Boolean(get().deferredPrompt),
    });
  },

  setActiveZone: (zone) => {
    set({ activeZone: zone });
  },

  setAppBranding: (appName, logoUrl) => {
    set({ appName, logoUrl });
  },

  promptInstall: async () => {
    const prompt = get().deferredPrompt;
    if (!prompt) return false;

    // Prompt is single-use in Chromium: clear reference immediately
    set({ deferredPrompt: null, isInstallable: false });

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        set({ isInstalled: true });
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Prompt installation failed:', err);
    }
    return false;
  },
}));

// Global event listeners to capture beforeinstallprompt regardless of React render timing
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaInstallStore.getState().setDeferredPrompt(e as BeforeInstallPromptEvent);
    window.dispatchEvent(new Event('pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    usePwaInstallStore.getState().setIsInstalled(true);
    usePwaInstallStore.getState().setDeferredPrompt(null);
  });
}
