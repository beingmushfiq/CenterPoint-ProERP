import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePwaInstallStore } from '../store/pwaInstallStore';
import { useAuthStore } from '../lib/auth/authStore';

const ERP_PATHS = [
  '/dashboard',
  '/catalogue',
  '/catalog',
  '/production',
  '/qc',
  '/inventory',
  '/purchasing',
  '/procurement',
  '/sales',
  '/pos',
  '/logistics',
  '/delivery',
  '/finance',
  '/accounting',
  '/assets',
  '/hr',
  '/workforce',
  '/payroll',
  '/employees',
  '/attendance',
  '/reports',
  '/rms',
  '/audit-logs',
  '/activity-logs',
  '/users',
  '/roles',
  '/settings',
  '/profile',
  '/bin',
  '/workflows',
  '/seo',
  '/tutorial',
  '/guide',
  '/onboarding',
  '/login',
  '/platform',
];

/**
 * usePwaManifest
 * Dynamically swaps the document <link rel="manifest"> and application metadata
 * based on whether the user is browsing the ERP operations console or customer storefront.
 *
 * Provides strict W3C and Apple WebKit compliance for two independent PWAs:
 * 1. ERP Operations Console (scoped to `/`, id `/erp`)
 * 2. Tenant E-Commerce Storefront (scoped to `/` or `/store/:sub`, id `/storefront`)
 */
export function usePwaManifest() {
  const location = useLocation();
  const authTenantName = useAuthStore((s) => s.tenant?.name);
  const setActiveZone = usePwaInstallStore((s) => s.setActiveZone);
  const setAppBranding = usePwaInstallStore((s) => s.setAppBranding);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const pathname = location.pathname.toLowerCase();
    const rawHost = window.location.hostname.toLowerCase().split(':')[0] ?? '';
    const tenantBaseDomain = (import.meta.env['VITE_TENANT_BASE_DOMAIN'] || 'devcenterpoint.com').toLowerCase();

    // Check if on a tenant storefront domain
    const isTenantSubdomain =
      rawHost.endsWith('.' + tenantBaseDomain) &&
      !['www', 'api', 'mail', 'cpanel', 'webmail', 'proerp', 'platform', 'admin'].includes(
        rawHost.slice(0, -(tenantBaseDomain.length + 1))
      );

    const isCustomStorefrontDomain =
      Boolean(rawHost) &&
      !['localhost', '127.0.0.1'].includes(rawHost) &&
      !isTenantSubdomain &&
      !rawHost.startsWith('admin.') &&
      !rawHost.startsWith('platform.') &&
      !rawHost.startsWith('proerp.');

    // Path matching
    const storePathMatch = pathname.match(/^\/store\/([^/]+)/);
    const pathSubdomain = storePathMatch?.[1];

    const isExplicitErpRoute = ERP_PATHS.some((erpPath) => pathname === erpPath || pathname.startsWith(erpPath + '/'));
    const isStorefrontZone =
      Boolean(pathSubdomain) ||
      pathname.startsWith('/products') ||
      pathname.startsWith('/collections') ||
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/order-confirmed') ||
      pathname.startsWith('/track') ||
      pathname.startsWith('/account') ||
      pathname.startsWith('/pages/') ||
      ((isTenantSubdomain || isCustomStorefrontDomain) && !isExplicitErpRoute);

    // Ensure link[rel="manifest"]
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    // Ensure meta[name="application-name"]
    let appNameMeta = document.querySelector('meta[name="application-name"]') as HTMLMetaElement | null;
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta');
      appNameMeta.name = 'application-name';
      document.head.appendChild(appNameMeta);
    }

    // Ensure meta[name="apple-mobile-web-app-title"]
    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitleMeta);
    }

    // Ensure link[rel="apple-touch-icon"]
    let appleIconLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleIconLink) {
      appleIconLink = document.createElement('link');
      appleIconLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleIconLink);
    }

    // Ensure meta[name="theme-color"]
    let themeColorMeta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }

function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

    // Resolve tenant names & logos
    const storedCompanyName = safeGetLocalStorage('company_name') || authTenantName || 'Enterprise Operations';
    const cleanCompanyBase = storedCompanyName.replace(/\s+ERP$/i, '').trim();
    const storedLogo = safeGetLocalStorage('brand_logo_url') || '/favicon.svg';

    if (isStorefrontZone) {
      setActiveZone('storefront');

      const subdomainParam = pathSubdomain ? `?subdomain=${encodeURIComponent(pathSubdomain)}` : '';
      const storefrontManifestUrl = `/api/v1/pwa/storefront-manifest.json${subdomainParam}`;

      if (manifestLink.getAttribute('href') !== storefrontManifestUrl) {
        manifestLink.setAttribute('href', storefrontManifestUrl);
      }

      // Inherit or get storefront specific name
      const storedStoreName = safeGetLocalStorage('storefront_name') || `${cleanCompanyBase}`;
      const cleanStoreBase = storedStoreName.replace(/\s+Store$/i, '').trim();
      const pwaStoreName = `${cleanStoreBase} Store`;

      appNameMeta.setAttribute('content', pwaStoreName);
      appleTitleMeta.setAttribute('content', pwaStoreName);

      const storeLogo = safeGetLocalStorage('storefront_logo_url') || storedLogo;
      appleIconLink.setAttribute('href', storeLogo);

      const storeColor = safeGetLocalStorage('storefront_primary_color') || '#10b981';
      themeColorMeta.setAttribute('content', storeColor);

      setAppBranding(pwaStoreName, storeLogo);
    } else {
      setActiveZone('erp');

      const erpManifestUrl = '/api/v1/pwa/erp-manifest.json';
      if (manifestLink.getAttribute('href') !== erpManifestUrl) {
        manifestLink.setAttribute('href', erpManifestUrl);
      }

      const pwaErpName = `${cleanCompanyBase} ERP`;

      appNameMeta.setAttribute('content', pwaErpName);
      appleTitleMeta.setAttribute('content', pwaErpName);
      appleIconLink.setAttribute('href', storedLogo);
      themeColorMeta.setAttribute('content', '#0F172A');

      setAppBranding(pwaErpName, storedLogo);
    }
  }, [location.pathname, authTenantName, setActiveZone, setAppBranding]);
}
