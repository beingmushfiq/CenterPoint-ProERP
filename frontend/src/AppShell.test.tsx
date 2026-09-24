import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuthStore } from './lib/auth/authStore';
import { useTenantCapabilityStore } from './lib/capabilities/tenantCapabilityStore';

describe('AppShell Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => {},
    });
    useAuthStore.setState({
      user: {
        id: '1',
        name: 'Manager User',
        email: 'manager@slicemart.com',
        role: 'Operations Manager',
        is_active: true,
        is_platform_admin: false,
        locale: 'en',
        theme: 'light',
        density: 'normal',
        landing_page: '/dashboard',
        tenant_id: 1,
        default_company_id: 1,
        default_branch_id: 1,
        default_factory_id: null,
        default_warehouse_id: null,
      },
      tenant: {
        id: 1,
        uuid: 'tenant-1',
        name: 'SliceMart Foods',
        slug: 'slicemart',
        status: 'active',
        currency_code: 'BDT',
        timezone: 'UTC',
      },
      permissions: new Set(['*']),
      status: 'authenticated',
      error: null,
      hasPermission: () => true,
    });

    useTenantCapabilityStore.setState({
      manifest: null,
      status: 'ready',
      error: null,
      isModuleEnabled: () => true,
      getTerm: (_key, fallback) => fallback || _key,
    });
  });

  it('renders app shell with navigation and outlet container', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
  });
});
