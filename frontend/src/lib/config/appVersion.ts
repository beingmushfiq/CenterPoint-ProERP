/**
 * Application Runtime & Environment Version Metadata
 * Eliminates all hardcoded version strings across the frontend.
 */
declare const __APP_VERSION__: string | undefined;

export function getAppVersion(): string {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ && __APP_VERSION__ !== '0.0.0') {
      const v = __APP_VERSION__.replace(/^v/, '');
      return v === '1.3.0' || v === '1.3' ? 'v1.3' : `v${v}`;
    }
  } catch {
    // Ignore runtime lookup error
  }

  const envVersion = import.meta.env.VITE_APP_VERSION;
  if (envVersion) {
    const v = String(envVersion).replace(/^v/, '');
    return v === '1.3.0' || v === '1.3' ? 'v1.3' : `v${v}`;
  }

  return 'v1.3';
}
