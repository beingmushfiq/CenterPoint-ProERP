import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../auth/authStore';

export interface TenantBranding {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  loading: boolean;
}

export const isStaleEngineName = (name: string | null | undefined): boolean => {
  if (!name) return true;
  const lower = name.trim().toLowerCase();
  return (
    lower === 'centerpoint proerp' ||
    lower === 'centerpoint pro erp' ||
    lower === 'centerpoint proerp erp' ||
    lower === 'devcenterpoint proerp' ||
    lower === 'devcenterpoint pro erp' ||
    lower === 'enterprise cloud erp' ||
    lower === 'enterprise cloud' ||
    lower === 'operations erp'
  );
};

export const sanitizeTenantBusinessName = (name: string | null | undefined, fallback = 'Operations Platform'): string => {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (isStaleEngineName(trimmed)) {
    return fallback;
  }
  return trimmed;
};

const sanitizeName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (isStaleEngineName(trimmed)) {
    return null;
  }
  return trimmed;
};

export function useTenantBranding(): TenantBranding {
  const authTenant = useAuthStore((s) => s.tenant);
  const authTenantName = authTenant?.name;
  const authBranding = authTenant?.branding as Record<string, unknown> | undefined;
  const authBrandingName = (authBranding?.company_name || authBranding?.company_legal_name) as string | undefined;

  const [customCompanyName, setCustomCompanyName] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('company_name');
      if (stored && isStaleEngineName(stored)) {
        localStorage.removeItem('company_name');
        return null;
      }
      return sanitizeName(stored);
    } catch {
      return null;
    }
  });

  const resolvedAuthName = sanitizeName(authBrandingName) || sanitizeName(authTenantName);
  const companyName = customCompanyName || resolvedAuthName || (authTenantName && !isStaleEngineName(authTenantName) ? authTenantName : 'Operations Platform');

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('brand_logo_url') || null;
    } catch {
      return null;
    }
  });

  const [faviconUrl, setFaviconUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('brand_favicon_url') || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Sync favicon with document head
  useEffect(() => {
    if (faviconUrl && typeof document !== 'undefined') {
      let iconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
      }
      iconLink.href = faviconUrl;
    }
  }, [faviconUrl]);

  // Listen for real-time branding updates across windows and components
  useEffect(() => {
    const handleBrandingSync = (e?: Event) => {
      try {
        const customEvent = e as CustomEvent<{ name?: string; logo_url?: string; favicon_url?: string }> | undefined;
        if (customEvent?.detail?.name) {
          const sanitized = sanitizeName(customEvent.detail.name);
          if (sanitized) setCustomCompanyName(sanitized);
        } else {
          const stored = sanitizeName(localStorage.getItem('company_name'));
          if (stored) setCustomCompanyName(stored);
        }
        const storedLogo = localStorage.getItem('brand_logo_url');
        if (storedLogo) setLogoUrl(storedLogo);
        const storedFavicon = localStorage.getItem('brand_favicon_url');
        if (storedFavicon) setFaviconUrl(storedFavicon);
      } catch {}
    };

    window.addEventListener('storage', handleBrandingSync);
    window.addEventListener('tenant_branding_updated', handleBrandingSync);
    return () => {
      window.removeEventListener('storage', handleBrandingSync);
      window.removeEventListener('tenant_branding_updated', handleBrandingSync);
    };
  }, []);

  // Fetch latest branding from public branding endpoint
  useEffect(() => {
    let ignore = false;

    api
      .get<{ name?: string; logo_url?: string | null; favicon_url?: string | null }>('/auth/branding')
      .then((res) => {
        if (ignore) return;
        const data = res.data;
        if (data) {
          if (data.name) {
            const sanitized = sanitizeName(data.name);
            if (sanitized) {
              setCustomCompanyName(sanitized);
              try {
                localStorage.setItem('company_name', sanitized);
              } catch {}
            }
          }
          if (data.logo_url) {
            setLogoUrl(data.logo_url);
            try {
              localStorage.setItem('brand_logo_url', data.logo_url);
            } catch {
              // Ignore localStorage write failures
            }
          }
          if (data.favicon_url) {
            setFaviconUrl(data.favicon_url);
            try {
              localStorage.setItem('brand_favicon_url', data.favicon_url);
            } catch {
              // Ignore localStorage write failures
            }
          }
        }
      })
      .catch(() => {
        // Fallback gracefully to localStorage or defaults
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return { companyName, logoUrl, faviconUrl, loading };
}
