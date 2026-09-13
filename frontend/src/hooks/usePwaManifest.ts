import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * usePwaManifest
 * Dynamically swaps the document <link rel="manifest"> and application metadata
 * based on whether the user is browsing the ERP operations console or a customer storefront.
 *
 * This allows a single frontend engine to operate as two distinct W3C Progressive Web Apps:
 * 1. ERP Operations Console (scoped to `/`)
 * 2. Tenant E-Commerce Storefront (scoped to `/store/:subdomain/`)
 */
export function usePwaManifest() {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const pathname = location.pathname;
    const storeMatch = pathname.match(/^\/store\/([^/]+)/);

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    let appNameMeta = document.querySelector('meta[name="application-name"]') as HTMLMetaElement | null;
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta');
      appNameMeta.name = 'application-name';
      document.head.appendChild(appNameMeta);
    }

    const subdomain = storeMatch?.[1];

    if (subdomain) {
      // Switch to tenant-scoped customer storefront manifest
      const storefrontManifestUrl = `/store/${subdomain}/manifest.json`;
      if (manifestLink.getAttribute('href') !== storefrontManifestUrl) {
        manifestLink.setAttribute('href', storefrontManifestUrl);
      }
      appNameMeta.setAttribute('content', `${subdomain.toUpperCase()} Store`);
    } else {
      // Restore standard ERP Operations Console manifest
      const erpManifestUrl = '/manifest.json';
      if (manifestLink.getAttribute('href') !== erpManifestUrl) {
        manifestLink.setAttribute('href', erpManifestUrl);
      }
      appNameMeta.setAttribute('content', 'Operations Console ERP');
    }
  }, [location.pathname]);
}
