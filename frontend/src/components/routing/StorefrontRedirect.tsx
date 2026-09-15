import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { isStorefrontDomain } from '../../lib/storefront/storefrontUrl';

export function StorefrontRedirect() {
  const location = useLocation();
  const tenantSubdomain = useAuthStore((state) => state.tenant?.subdomain || state.tenant?.slug) || 'store';

  // On a tenant storefront domain, "/" is the storefront root.
  // Cleanly strip any /store or /store/:subdomain prefix to land on the correct storefront page.
  if (isStorefrontDomain()) {
    const cleanPath = location.pathname.replace(/^\/store(?:\/[^/]+)?/, '') || '/';
    return <Navigate to={`${cleanPath}${location.search}${location.hash}`} replace />;
  }

  // On localhost or non-storefront domain: redirect to /store/:subdomain
  return <Navigate to={`/store/${tenantSubdomain}`} replace />;
}
