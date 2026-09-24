import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';

describe('MobileBottomNav Component', () => {
  beforeEach(() => {
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

  it('renders thumb navigation buttons for Dashboard, POS, Quick Action, Stock, and Menu', () => {
    const handleToggle = vi.fn();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MobileBottomNav
          onToggleSidebar={handleToggle}
          isSidebarOpen={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open full navigation menu/i })).toBeInTheDocument();
  });

  it('triggers onToggleSidebar when the Menu button is clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MobileBottomNav
          onToggleSidebar={handleToggle}
          isSidebarOpen={false}
        />
      </MemoryRouter>
    );

    const menuBtn = screen.getByRole('button', { name: /open full navigation menu/i });
    await user.click(menuBtn);

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenQuickAdd when the center plus action button is clicked', async () => {
    const user = userEvent.setup();
    const handleQuickAdd = vi.fn();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MobileBottomNav
          onToggleSidebar={vi.fn()}
          isSidebarOpen={false}
          onOpenQuickAdd={handleQuickAdd}
        />
      </MemoryRouter>
    );

    const quickAddBtn = screen.getByRole('button', { name: /quick create action/i });
    await user.click(quickAddBtn);

    expect(handleQuickAdd).toHaveBeenCalledTimes(1);
  });
});
