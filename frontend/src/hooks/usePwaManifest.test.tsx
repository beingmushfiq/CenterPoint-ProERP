import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { usePwaManifest } from './usePwaManifest';

describe('usePwaManifest hook', () => {
  beforeEach(() => {
    // Clear existing tags from document.head
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
    document.querySelectorAll('meta[name="application-name"]').forEach((el) => el.remove());
    document.querySelectorAll('meta[name="apple-mobile-web-app-title"]').forEach((el) => el.remove());
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((el) => el.remove());
  });

  it('sets ERP manifest and metadata when on an ERP route', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard']}>
        {children}
      </MemoryRouter>
    );

    renderHook(() => usePwaManifest(), { wrapper });

    const manifestLink = document.querySelector('link[rel="manifest"]');
    const appNameMeta = document.querySelector('meta[name="application-name"]');

    expect(manifestLink).not.toBeNull();
    expect(manifestLink?.getAttribute('href')).toBe('/api/v1/pwa/erp-manifest.json');
    expect(appNameMeta).not.toBeNull();
    expect(appNameMeta?.getAttribute('content')).toBe('Enterprise Operations ERP');
  });

  it('swaps to tenant storefront manifest when on a /store/:subdomain route', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/store/slicemart/products']}>
        {children}
      </MemoryRouter>
    );

    renderHook(() => usePwaManifest(), { wrapper });

    const manifestLink = document.querySelector('link[rel="manifest"]');
    const appNameMeta = document.querySelector('meta[name="application-name"]');

    expect(manifestLink).not.toBeNull();
    expect(manifestLink?.getAttribute('href')).toBe('/api/v1/pwa/storefront-manifest.json?subdomain=slicemart');
    expect(appNameMeta).not.toBeNull();
    expect(appNameMeta?.getAttribute('content')).toBe('Enterprise Operations Store');
  });
});
