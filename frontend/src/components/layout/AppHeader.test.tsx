import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';

describe('AppHeader Mobile Responsiveness & Navigation Trigger', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: '1',
        name: 'Quick Sales Manager',
        email: 'qs@slicemart.com',
        role: 'Commercial Manager',
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
      branches: [
        {
          id: 1,
          uuid: 'branch-1',
          code: 'HQ',
          name: 'Head Office',
          is_head_office: true,
        },
      ],
      activeBranch: {
        id: 1,
        uuid: 'branch-1',
        code: 'HQ',
        name: 'Head Office',
        is_head_office: true,
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

  it('renders anchored mobile navigation toggle button with shrink-0', () => {
    const handleToggle = vi.fn();
    render(
      <MemoryRouter>
        <AppHeader onToggleSidebar={handleToggle} />
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton.className).toContain('shrink-0');
  });

  it('invokes onToggleSidebar when mobile navigation trigger is clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    render(
      <MemoryRouter>
        <AppHeader onToggleSidebar={handleToggle} />
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });
    await user.click(toggleButton);

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders POS button with responsive compact labels', () => {
    render(
      <MemoryRouter>
        <AppHeader onToggleSidebar={() => {}} />
      </MemoryRouter>
    );

    const posLink = screen.getByRole('link', { name: /pos/i });
    expect(posLink).toBeInTheDocument();
    expect(posLink.className).toContain('shrink-0');
  });
});
