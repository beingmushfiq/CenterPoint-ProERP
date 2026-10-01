import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnterpriseSystemNavigator } from './EnterpriseSystemNavigator';
import { useAuthStore } from '../../../lib/auth/authStore';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EnterpriseSystemNavigator', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
    });
  });

  it('renders Enterprise Subsystem Cockpit showing all wings for Super Administrator', () => {
    useAuthStore.setState({
      user: {
        id: '1',
        name: 'System Administrator',
        email: 'admin@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'Super Administrator',
        roles: ['Super Administrator'],
        locale: 'en',
        theme: 'light',
        density: 'comfortable',
        landing_page: '/dashboard',
        tenant_id: 1,
        default_company_id: 1,
        default_branch_id: 1,
        default_factory_id: 1,
        default_warehouse_id: 1,
      },
      permissions: new Set(['*']),
    });

    renderWithProviders(<EnterpriseSystemNavigator />);

    // Cockpit is present
    expect(screen.getByText('Enterprise Subsystem Cockpit')).toBeInTheDocument();
    expect(screen.getByText(/Navigate any operational wing/i)).toBeInTheDocument();

    // All operational wings are accessible
    expect(screen.getByText('Commercial & Omnichannel Demand')).toBeInTheDocument();
    expect(screen.getByText('Supply Chain, SCM & Inventory')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing & Quality Assurance')).toBeInTheDocument();
    expect(screen.getByText('Finance, Treasury & Assets')).toBeInTheDocument();
    expect(screen.getByText('Workforce & Human Capital')).toBeInTheDocument();
    expect(screen.getByText('Governance, Intelligence & Security')).toBeInTheDocument();
  });

  it('restricts Enterprise Subsystem Cockpit to permitted modules for Sales Officer', () => {
    useAuthStore.setState({
      user: {
        id: '5',
        name: 'Kamal Sales Officer',
        email: 'sales@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'Sales Officer',
        roles: ['Sales Officer'],
        locale: 'en',
        theme: 'light',
        density: 'comfortable',
        landing_page: '/dashboard',
        tenant_id: 1,
        default_company_id: 1,
        default_branch_id: 1,
        default_factory_id: 1,
        default_warehouse_id: 1,
      },
      permissions: new Set([
        'sales.order.view',
        'sales.invoice.view',
        'pos.terminal.view',
        'pos.sale.create',
      ]),
    });

    renderWithProviders(<EnterpriseSystemNavigator />);

    expect(screen.getByText('Enterprise Subsystem Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Commercial & Omnichannel Demand')).toBeInTheDocument();

    // Disallowed wings should not be displayed
    expect(screen.queryByText('Manufacturing & Quality Assurance')).not.toBeInTheDocument();
    expect(screen.queryByText('Finance, Treasury & Assets')).not.toBeInTheDocument();
    expect(screen.queryByText('Workforce & Human Capital')).not.toBeInTheDocument();
    expect(screen.queryByText('Governance, Intelligence & Security')).not.toBeInTheDocument();
  });
});
