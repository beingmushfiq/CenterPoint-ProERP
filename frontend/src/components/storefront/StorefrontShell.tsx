import React, { useEffect, useState, Suspense } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { useStorefrontWishlistStore } from '../../lib/storefront/storefrontWishlistStore';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';
import { StorefrontCartDrawer } from './StorefrontCartDrawer';
import { StorefrontWishlistDrawer } from './StorefrontWishlistDrawer';
import { SeoHead } from '../seo/SeoHead';
import { JsonLdSchema } from '../seo/JsonLdSchema';
import { useAuthStore } from '../../lib/auth/authStore';
import { StorefrontRouteLoadingFallback } from '../routing/RouteLoadingFallback';
import type { StorefrontConfig } from '../../types/api/storefront';
import { initStorefrontTracking, trackStorefrontPageView } from '../../lib/storefront/storefrontTracking';
import {
  applyStorefrontThemeVariables,
  subscribeToThemeDraft,
  getStoredThemeDraft,
  type StorefrontThemeConfig,
} from '../../lib/storefront/themeSync';

export const StorefrontShell: React.FC = () => {
  const { subdomain: paramSubdomain } = useParams<{ subdomain?: string }>();
  const location = useLocation();
  const tenantSubdomain = useAuthStore((state) => state.tenant?.subdomain);

  const host = typeof window !== 'undefined' ? (window.location.hostname.toLowerCase().split(':')[0] ?? '') : '';
  const tenantBaseDomain = (import.meta.env['VITE_TENANT_BASE_DOMAIN'] || 'devcenterpoint.com').toLowerCase();

  const hostSubdomain = (() => {
    if (host && host.endsWith('.' + tenantBaseDomain)) {
      const sub = host.slice(0, -(tenantBaseDomain.length + 1));
      if (sub && !['www', 'api', 'mail', 'cpanel', 'webmail', 'proerp', 'platform', 'admin'].includes(sub)) {
        return sub;
      }
    }
    return undefined;
  })();

  const isCustomDomain = Boolean(
    host &&
    !['localhost', '127.0.0.1'].includes(host) &&
    !hostSubdomain &&
    !host.startsWith('admin.') &&
    !host.startsWith('platform.') &&
    !host.startsWith('app.') &&
    !host.startsWith('erp.') &&
    !host.startsWith('proerp.')
  );

  const [activeSubdomain, setActiveSubdomain] = useState<string>(
    paramSubdomain || hostSubdomain || tenantSubdomain || 'store'
  );
  const subdomain = activeSubdomain;

  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setSubdomain, fetchCart } = useStorefrontCartStore();

  // 1. Initial config fetch + apply stored draft if present
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (hostSubdomain) {
          headers['X-Storefront-Subdomain'] = hostSubdomain;
        } else if (isCustomDomain) {
          headers['X-Storefront-Domain'] = host;
        } else if (paramSubdomain) {
          headers['X-Storefront-Subdomain'] = paramSubdomain;
        } else if (tenantSubdomain) {
          headers['X-Storefront-Subdomain'] = tenantSubdomain;
        }

        const response = await api.get<StorefrontConfig>('/storefront/config', {
          headers,
        });

        const initialConfig = response.data;
        const resolvedSubdomain = initialConfig.subdomain || paramSubdomain || tenantSubdomain || 'store';
        setActiveSubdomain(resolvedSubdomain);
        setSubdomain(resolvedSubdomain);
        useStorefrontWishlistStore.getState().setSubdomain(resolvedSubdomain);

        // Check if there is an active local draft from the customizer
        const draft = getStoredThemeDraft(resolvedSubdomain);
        const mergedTheme = {
          ...initialConfig.theme,
          ...draft,
        } as StorefrontThemeConfig;

        const finalConfig: StorefrontConfig = {
          ...initialConfig,
          theme: mergedTheme,
        };

        setConfig(finalConfig);
        applyStorefrontThemeVariables(mergedTheme);

        // Initialize Meta Pixel & GA4 tracking if configured in CMS
        if (mergedTheme.meta_pixel_id || mergedTheme.google_analytics_id) {
          initStorefrontTracking(
            mergedTheme.meta_pixel_id,
            mergedTheme.google_analytics_id
          );
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Storefront could not be loaded');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
    fetchCart();
  }, [paramSubdomain, tenantSubdomain, host, isCustomDomain, setSubdomain, fetchCart]);

  // 2. Real-time Live Theme Subscription across tabs & windows
  useEffect(() => {
    const unsubscribe = subscribeToThemeDraft(subdomain, (updatedTheme) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const newTheme = {
          ...prev.theme,
          ...updatedTheme,
        } as StorefrontThemeConfig;
        applyStorefrontThemeVariables(newTheme);
        return {
          ...prev,
          theme: newTheme,
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [subdomain]);

  // Track page view on route transitions
  useEffect(() => {
    trackStorefrontPageView(location.pathname);
  }, [location.pathname]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div
            style={{ borderColor: 'var(--store-primary, #10b981)', borderTopColor: 'transparent' }}
            className="h-8 w-8 animate-spin rounded-full border-2"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Loading Storefront...
          </span>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-center">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <h2 className="text-lg font-bold text-zinc-100">Storefront Unavailable</h2>
          <p className="mt-2 text-xs text-zinc-400">
            {error || 'This storefront does not exist or has been temporarily suspended.'}
          </p>
        </div>
      </div>
    );
  }

  const extendedConfig = config as StorefrontConfig & {
    seo?: {
      organization_schema?: Record<string, unknown>;
      website_schema?: Record<string, unknown>;
    };
  };
  const orgSchema = extendedConfig.seo?.organization_schema;
  const websiteSchema = extendedConfig.seo?.website_schema;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-200">
      <SeoHead
        title={config.meta_title || config.name}
        description={
          config.meta_description ||
          'Direct factory manufacturing and online commercial storefront.'
        }
        brandName={config.name}
      />
      {orgSchema && <JsonLdSchema id="global-org-schema" schema={orgSchema} />}
      {websiteSchema && <JsonLdSchema id="global-website-schema" schema={websiteSchema} />}

      <div>
        <StorefrontHeader config={config} subdomain={subdomain} />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Suspense fallback={<StorefrontRouteLoadingFallback />}>
            <Outlet context={{ config, subdomain }} />
          </Suspense>
        </main>
      </div>

      <StorefrontFooter config={config} />
      <StorefrontCartDrawer config={config} subdomain={subdomain} />
      <StorefrontWishlistDrawer config={config} subdomain={subdomain} />
    </div>
  );
};
