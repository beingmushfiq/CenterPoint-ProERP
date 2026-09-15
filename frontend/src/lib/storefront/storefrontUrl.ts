/**
 * storefrontUrl.ts
 *
 * Centralised helper for generating correct storefront URLs in all
 * deployment contexts:
 *
 *   - Production subdomain  (demoerp.devcenterpoint.com)  → "/"
 *   - Custom branded domain (myshop.com)                  → "/"
 *   - Local dev / ERP app   (localhost / demoerp.domain/erp)   → "/store/:subdomain"
 *
 * Usage:
 *   import { getStorefrontUrl } from '@/lib/storefront/storefrontUrl';
 *   const href = getStorefrontUrl('demoerp', '/products');
 */

const TENANT_BASE_DOMAIN = (
  typeof import.meta !== 'undefined'
    ? (import.meta.env?.['VITE_TENANT_BASE_DOMAIN'] as string | undefined)
    : undefined
) || 'devcenterpoint.com';

const MASTER_DOMAIN = (
  typeof import.meta !== 'undefined'
    ? (import.meta.env?.['VITE_MASTER_DOMAIN'] as string | undefined)
    : undefined
) || 'proerp.devcenterpoint.com';

const RESERVED_SUBDOMAINS = ['www', 'api', 'mail', 'cpanel', 'webmail', 'proerp', 'platform', 'admin'];

/**
 * Returns `true` when the current browser host is itself a tenant storefront
 * domain (e.g. `demoerp.devcenterpoint.com` or a custom domain), so the
 * storefront is served at the root path "/".
 */
export function isStorefrontDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase().split(':')[0] ?? '';
  if (!host || ['localhost', '127.0.0.1'].includes(host)) return false;

  // Master platform domain is never a storefront
  if (host === MASTER_DOMAIN || host.startsWith('proerp.') || host.startsWith('platform.') || host.startsWith('admin.')) {
    return false;
  }

  // Tenant subdomains on the base domain
  if (host.endsWith('.' + TENANT_BASE_DOMAIN)) {
    const sub = host.slice(0, -(TENANT_BASE_DOMAIN.length + 1));
    return Boolean(sub && !RESERVED_SUBDOMAINS.includes(sub));
  }

  // Any other non-localhost domain is treated as a custom storefront domain
  return true;
}

/**
 * Builds the correct URL to navigate to within the storefront.
 *
 * @param subdomain  - The tenant subdomain / slug (e.g. "demoerp")
 * @param path       - An optional path within the storefront, starting with "/"
 *                     (default: "/")
 * @returns  An absolute URL string when on a storefront domain,
 *           or a relative path "/store/:subdomain[path]" otherwise.
 *
 * Examples (on demoerp.devcenterpoint.com):
 *   getStorefrontUrl('demoerp')              → '/'
 *   getStorefrontUrl('demoerp', '/products') → '/products'
 *
 * Examples (on localhost or proerp.devcenterpoint.com):
 *   getStorefrontUrl('demoerp')              → '/store/demoerp'
 *   getStorefrontUrl('demoerp', '/products') → '/store/demoerp/products'
 */
export function getStorefrontUrl(subdomain: string, path: string = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (isStorefrontDomain()) {
    // On a storefront domain the storefront IS the root — no prefix needed.
    return normalizedPath === '/' ? '/' : normalizedPath;
  }

  // Local dev or ERP app shell context — use the /store/:subdomain prefix.
  const base = `/store/${subdomain}`;
  return normalizedPath === '/' ? base : `${base}${normalizedPath}`;
}

/**
 * Returns the storefront base URL suitable for an `<a href>` that opens the
 * storefront in a new tab from within the ERP application shell.
 *
 * On a production tenant subdomain the storefront lives at "/", but since the
 * ERP app is served from the *same* origin the link can just be "/".
 *
 * If the ERP is on the master domain (proerp.*) and we know the tenant's
 * subdomain, we build the full external storefront URL instead.
 *
 * From a tenant subdomain ERP (e.g. demoerp.devcenterpoint.com/dashboard),
 * we also return the full external URL so it opens correctly.
 */
export function getStorefrontExternalUrl(subdomain: string, path: string = '/'): string {
  if (typeof window === 'undefined') return getStorefrontUrl(subdomain, path);

  const host = window.location.hostname.toLowerCase().split(':')[0] ?? '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const isMaster =
    host === MASTER_DOMAIN ||
    host.startsWith('proerp.') ||
    host.startsWith('platform.') ||
    host.startsWith('admin.');

  // From master domain or from any non-localhost — always build full external URL
  if ((isMaster || (!['localhost', '127.0.0.1'].includes(host) && host !== '')) && subdomain && subdomain !== 'store') {
    const tenantHost = `${subdomain}.${TENANT_BASE_DOMAIN}`;
    const protocol = window.location.protocol;
    return normalizedPath === '/' ? `${protocol}//${tenantHost}` : `${protocol}//${tenantHost}${normalizedPath}`;
  }

  return getStorefrontUrl(subdomain, path);
}

/**
 * Canonical path aliases: maps legacy or shorthand paths to their proper
 * storefront equivalents.
 */
const PATH_ALIASES: Record<string, string> = {
  '/orders': '/track',
  '/order-tracking': '/track',
  '/contact': '/pages/contact',
  '/about': '/pages/about-us',
  '/about-us': '/pages/about-us',
  '/collections': '/products',
  '/catalog': '/products',
  '/catalogue': '/products',
  '/cart': '/checkout',
  '/faq': '/pages/faq',
  '/warranty': '/pages/warranty-support',
  '/warranty-care': '/pages/warranty-support',
  '/shipping': '/pages/shipping-fulfillment',
  '/returns': '/pages/return-policy',
  '/privacy': '/pages/privacy-policy',
  '/terms': '/pages/terms-conditions',
};

/**
 * Normalizes any raw menu/footer URL into a correct storefront URL,
 * stripping legacy `/store/:subdomain` prefixes and resolving aliases.
 *
 * Preserves external URLs (http/https/mailto/tel) unchanged.
 */
export function normalizeStorefrontPath(subdomain: string, rawUrl: string): string {
  if (!rawUrl) return getStorefrontUrl(subdomain);

  // External links — leave untouched
  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('mailto:') ||
    rawUrl.startsWith('tel:')
  ) {
    return rawUrl;
  }

  let path = rawUrl;

  // Strip legacy /store/:subdomain or /store prefixes
  const storeSubPrefix = `/store/${subdomain}`;
  if (path.startsWith(storeSubPrefix)) {
    path = path.slice(storeSubPrefix.length) || '/';
  } else if (path === '/store' || path.startsWith('/store/')) {
    // Generic /store or /store/someOtherSlug — redirect to root
    path = '/';
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Resolve canonical aliases
  const alias = PATH_ALIASES[path.split('?')[0] ?? path];
  if (alias) {
    path = alias;
  }

  return getStorefrontUrl(subdomain, path);
}
