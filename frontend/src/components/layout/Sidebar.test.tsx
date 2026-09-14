import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';

describe('Sidebar Navigation Highlighting & Tab Outlining', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });

    useAuthStore.setState({
      user: {
        id: '1',
        name: 'System Administrator',
        email: 'admin@slicemart.com',
        role: 'Super Administrator',
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
        name: 'SliceMart Bakery & Foods',
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

  it('outlines Finance & Accounts when on default /finance route', () => {
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const financeLink = screen.getByRole('link', { name: /finance & accounts/i });
    expect(financeLink).toBeInTheDocument();
    expect(financeLink.className).toContain('border-(--nav-active-marker)');
  });

  it('correctly outlines Finance & Accounts when inside a sub-tab (e.g., /finance?tab=statements)', () => {
    render(
      <MemoryRouter initialEntries={['/finance?tab=statements']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const financeLink = screen.getByRole('link', { name: /finance & accounts/i });
    expect(financeLink).toBeInTheDocument();
    // Must remain active and highlighted
    expect(financeLink.className).toContain('text-primary');
    expect(financeLink.className).toContain('bg-(--nav-active-bg)');
  });

  it('correctly outlines Finance & Accounts on expenses, coa, costing tabs', () => {
    render(
      <MemoryRouter initialEntries={['/finance?tab=expenses']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const financeLink = screen.getByRole('link', { name: /finance & accounts/i });
    expect(financeLink.className).toContain('text-primary');
    expect(financeLink.className).toContain('bg-(--nav-active-bg)');
  });

  it('outlines Customer Leads & CRM when on /sales?tab=leads, and NOT Sales & Invoices', () => {
    render(
      <MemoryRouter initialEntries={['/sales?tab=leads']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const crmLink = screen.getByRole('link', { name: /customer leads & crm/i });
    const salesLink = screen.getByRole('link', { name: /sales & invoices/i });

    expect(crmLink.className).toContain('text-primary');
    expect(salesLink.className).not.toContain('text-primary');
    expect(salesLink.className).toContain('text-muted');
  });

  it('outlines Sales & Invoices when in another sales tab (e.g. /sales?tab=invoices)', () => {
    render(
      <MemoryRouter initialEntries={['/sales?tab=invoices']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const crmLink = screen.getByRole('link', { name: /customer leads & crm/i });
    const salesLink = screen.getByRole('link', { name: /sales & invoices/i });

    expect(salesLink.className).toContain('text-primary');
    expect(crmLink.className).not.toContain('text-primary');
  });

  it('outlines Team & Workforce when in HR tabs (/hr?tab=payroll)', () => {
    render(
      <MemoryRouter initialEntries={['/hr?tab=payroll']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const hrLink = screen.getByRole('link', { name: /team & workforce/i });
    expect(hrLink.className).toContain('text-primary');
  });

  it('renders title name and brand monogram linking to dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/sales']}>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const brandLink = screen.getByRole('link', { name: /slicemart bakery & foods - go to dashboard/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/dashboard');
  });
});

