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
    expect(manifestLink?.getAttribute('href')).toBe('/manifest.json');
    expect(appNameMeta).not.toBeNull();
    expect(appNameMeta?.getAttribute('content')).toBe('Operations Console ERP');
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
    expect(manifestLink?.getAttribute('href')).toBe('/store/slicemart/manifest.json');
    expect(appNameMeta).not.toBeNull();
    expect(appNameMeta?.getAttribute('content')).toBe('SLICEMART Store');
  });
});
