import { usePwaInstallStore } from '../store/pwaInstallStore';

export function usePwaInstall() {
  const isInstallable = usePwaInstallStore((s) => s.isInstallable);
  const isInstalled = usePwaInstallStore((s) => s.isInstalled);
  const promptInstall = usePwaInstallStore((s) => s.promptInstall);
  const appName = usePwaInstallStore((s) => s.appName);
  const activeZone = usePwaInstallStore((s) => s.activeZone);

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    appName,
    activeZone,
  };
}
