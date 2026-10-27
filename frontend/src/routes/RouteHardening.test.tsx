import React from 'react';
import { describe, it, expect } from 'vitest';
import { getStorefrontExternalUrl, isExternalUrl } from '../lib/storefront/storefrontUrl';
import { storefrontRouteChildren, erpWorkspaceRouteChildren } from './index';

describe('Route Hardening & Storefront Boundary Isolation', () => {
  describe('Storefront External URL Helper', () => {
    it('returns an absolute URL on localhost so links always trigger external opening', () => {
      const url = getStorefrontExternalUrl('demoerp');
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('/store/demoerp');
      expect(isExternalUrl(url)).toBe(true);
    });

    it('returns an absolute URL for specific subpaths on localhost', () => {
      const url = getStorefrontExternalUrl('demoerp', '/products/p-100');
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('/store/demoerp/products/p-100');
      expect(isExternalUrl(url)).toBe(true);
    });

    it('isExternalUrl detects external protocols correctly', () => {
      expect(isExternalUrl('https://demoerp.devcenterpoint.com')).toBe(true);
      expect(isExternalUrl('http://localhost:5173/store/demoerp')).toBe(true);
      expect(isExternalUrl('//cdn.example.com/asset.png')).toBe(true);
      expect(isExternalUrl('mailto:support@slice.mart')).toBe(true);
      expect(isExternalUrl('tel:+8801700000000')).toBe(true);

      // Internal SPA routes must NOT be detected as external
      expect(isExternalUrl('/orders')).toBe(false);
      expect(isExternalUrl('/sales?tab=orders')).toBe(false);
      expect(isExternalUrl('/dashboard')).toBe(false);
      expect(isExternalUrl('')).toBe(false);
    });
  });

  describe('Storefront Route Isolation (No Conflicting ERP Aliases)', () => {
    const conflictingAliases = ['orders', 'returns', 'shipping', 'collections', 'cart'];

    it('does NOT contain conflicting ERP route aliases in storefrontRouteChildren', () => {
      const storefrontPaths = storefrontRouteChildren.map((r) => r.path);

      conflictingAliases.forEach((alias) => {
        expect(
          storefrontPaths,
          `storefrontRouteChildren must not include conflicting alias "${alias}"`
        ).not.toContain(alias);
      });
    });

    it('does NOT contain a greedy catch-all wildcard in storefrontRouteChildren', () => {
      const wildcardRoute = storefrontRouteChildren.find((r) => r.path === '*');
      expect(
        wildcardRoute,
        'storefrontRouteChildren must not contain a greedy catch-all wildcard route'
      ).toBeUndefined();
    });

    it('preserves public non-conflicting storefront aliases', () => {
      const storefrontPaths = storefrontRouteChildren.map((r) => r.path);
      const expectedPublicAliases = [
        'order-tracking',
        'contact',
        'about',
        'about-us',
        'faq',
        'warranty',
        'privacy-policy',
        'terms',
      ];

      expectedPublicAliases.forEach((alias) => {
        expect(storefrontPaths).toContain(alias);
      });
    });
  });

  describe('Canonical ERP Route Aliases & Deep-Link Hardening', () => {
    // Helper to find the target route destination in an element (e.g. <Navigate to="..." />)
    const getRedirectTarget = (path: string): string | undefined => {
      const route = erpWorkspaceRouteChildren.find((r) => r.path === path);
      if (!route) return undefined;
      const element = route.element as React.ReactElement<{ to?: string }>;
      return element?.props?.to;
    };

    it('redirects sales and order aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('orders')).toBe('/sales?tab=orders');
      expect(getRedirectTarget('returns')).toBe('/sales?tab=returns');
      expect(getRedirectTarget('customers')).toBe('/sales?tab=customers');
      expect(getRedirectTarget('invoices')).toBe('/sales?tab=invoices');
    });

    it('redirects purchasing and procurement aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('purchase-orders')).toBe('/purchasing?tab=orders');
      expect(getRedirectTarget('po')).toBe('/purchasing?tab=orders');
      expect(getRedirectTarget('bills')).toBe('/purchasing?tab=bills');
      expect(getRedirectTarget('suppliers')).toBe('/purchasing?tab=suppliers');
      expect(getRedirectTarget('requisitions')).toBe('/purchasing?tab=requisitions');
      expect(getRedirectTarget('purchasing/requisitions')).toBe('/purchasing?tab=requisitions');
      expect(getRedirectTarget('grn')).toBe('/purchasing?tab=grn');
    });

    it('redirects catalogue and master data aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('products')).toBe('/catalogue?tab=products');
      expect(getRedirectTarget('collections')).toBe('/catalogue?tab=categories');
      expect(getRedirectTarget('categories')).toBe('/catalogue?tab=categories');
      expect(getRedirectTarget('brands')).toBe('/catalogue?tab=brands');
      expect(getRedirectTarget('recipes')).toBe('/catalogue?tab=bom');
      expect(getRedirectTarget('bom')).toBe('/catalogue?tab=bom');
    });

    it('redirects logistics and delivery aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('shipping')).toBe('/logistics?tab=shipments');
      expect(getRedirectTarget('shipments')).toBe('/logistics?tab=shipments');
      expect(getRedirectTarget('couriers')).toBe('/logistics?tab=providers');
    });

    it('redirects production and factory aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('batches')).toBe('/production?tab=batches');
      expect(getRedirectTarget('plans')).toBe('/production?tab=plans');
    });

    it('redirects inventory and warehouse aliases to /inventory', () => {
      expect(getRedirectTarget('stock')).toBe('/inventory');
      expect(getRedirectTarget('warehouse')).toBe('/inventory');
      expect(getRedirectTarget('warehouses')).toBe('/inventory');
    });

    it('redirects finance and GL aliases to appropriate ERP tabs', () => {
      expect(getRedirectTarget('due')).toBe('/finance?tab=due-collection');
      expect(getRedirectTarget('due-collection')).toBe('/finance?tab=due-collection');
      expect(getRedirectTarget('banking')).toBe('/finance?tab=banking');
      expect(getRedirectTarget('expenses')).toBe('/finance?tab=expenses');
      expect(getRedirectTarget('journal')).toBe('/finance?tab=journal');
      expect(getRedirectTarget('coa')).toBe('/finance?tab=coa');
      expect(getRedirectTarget('finance/journal')).toBe('/finance?tab=journal');
      expect(getRedirectTarget('finance/gl')).toBe('/finance?tab=journal');
    });

    it('redirects commercial point-of-sale, profile, and assistant aliases', () => {
      expect(getRedirectTarget('cart')).toBe('/pos');
      expect(getRedirectTarget('checkout')).toBe('/pos');
      expect(getRedirectTarget('account')).toBe('/profile');
      expect(getRedirectTarget('ai')).toBe('/dashboard?brain=open');
      expect(getRedirectTarget('custom-fields')).toBe('/settings/custom_fields');
      expect(getRedirectTarget('custom_fields')).toBe('/settings/custom_fields');
    });
  });
});
