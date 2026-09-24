import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MobileQuickAddDrawer } from './MobileQuickAddDrawer';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MobileQuickAddDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders quick action items when open', () => {
    render(
      <MemoryRouter>
        <MobileQuickAddDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Quick Actions Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/POS Terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/Sales Invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/Catalogue Product/i)).toBeInTheDocument();
    expect(screen.getByText(/Production Batch/i)).toBeInTheDocument();
  });

  it('navigates and closes drawer when an action item is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <MobileQuickAddDrawer isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const posBtn = screen.getByText(/POS Terminal/i).closest('button');
    expect(posBtn).not.toBeNull();
    await user.click(posBtn!);

    expect(mockNavigate).toHaveBeenCalledWith('/pos');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <MemoryRouter>
        <MobileQuickAddDrawer isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('filters actions dynamically when searching', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MobileQuickAddDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/search actions/i);
    await user.type(searchInput, 'Expense');

    expect(screen.getByText(/Operational Expense/i)).toBeInTheDocument();
    expect(screen.queryByText(/POS Terminal/i)).not.toBeInTheDocument();
  });

  it('filters actions by category pill', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MobileQuickAddDrawer isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    const factoryFilter = screen.getByRole('button', { name: /factory & qc/i });
    await user.click(factoryFilter);

    expect(screen.getByText(/New Production Batch/i)).toBeInTheDocument();
    expect(screen.queryByText(/POS Terminal/i)).not.toBeInTheDocument();
  });
});
