import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantRoleDashboard } from './TenantRoleDashboard';
import { useAuthStore } from '../../lib/auth/authStore';

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

// Mock Recharts ResponsiveContainer to avoid size rendering issues in test DOM
vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  };
});

describe('TenantRoleDashboard Dynamic Role Perspectives', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    try {
      sessionStorage.setItem('erp_onboarding_skipped', 'true');
    } catch {
      // ignore
    }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    });
    useAuthStore.setState({
      user: null,
      tenant: null,
      permissions: new Set(),
      status: 'authenticated',
      error: null,
    });
  });

  it('renders Executive Overview dashboard for Super Administrator', () => {
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

    renderWithProviders(<TenantRoleDashboard />);

    // Active role header indicator
    expect(screen.getByText('Super Administrator')).toBeInTheDocument();

    // Perspective switcher tabs available for Admin
    expect(screen.getByRole('button', { name: /Executive Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Factory Production/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stock & Warehouse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quality Control/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales & POS/i })).toBeInTheDocument();

    // Executive overview contents
    expect(screen.getByText('Executive Operations Overview')).toBeInTheDocument();
    expect(screen.getByText("TODAY'S REVENUE")).toBeInTheDocument();
  });

  it('defaults to Commercial & POS dashboard for Sales Officer', () => {
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
        'sales.order.create',
        'sales.invoice.view',
        'pos.terminal.view',
        'pos.session.view',
        'pos.sale.create',
        'catalog.product.view',
      ]),
    });

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('Sales Officer')).toBeInTheDocument();
    expect(screen.getByText('Commercial & POS Operations')).toBeInTheDocument();
    expect(screen.getByText('POS DRAWER')).toBeInTheDocument();
  });

  it('defaults to Stock & Warehouse dashboard for Warehouse Storekeeper', () => {
    useAuthStore.setState({
      user: {
        id: '4',
        name: 'Rafiq Store In-Charge',
        email: 'store@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'Warehouse Storekeeper',
        roles: ['Warehouse Storekeeper'],
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
        'inventory.stock.view',
        'inventory.warehouse.view',
        'inventory.movement.view',
        'inventory.transfer.view',
        'inventory.count.view',
        'purchasing.grn.view',
        'catalog.product.view',
      ]),
    });

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('Warehouse Storekeeper')).toBeInTheDocument();
    expect(screen.getByText('Warehouse & Stock Inventory')).toBeInTheDocument();
    expect(screen.getByText('TOTAL SKUS')).toBeInTheDocument();
  });

  it('defaults to Quality Assurance dashboard for QC Inspector', () => {
    useAuthStore.setState({
      user: {
        id: '3',
        name: 'Farhana QC Lead',
        email: 'qc@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'QC Inspector',
        roles: ['QC Inspector'],
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
        'qc.inspection.view',
        'qc.inspection.create',
        'qc.parameter.view',
        'qc.wastage.view',
        'catalog.product.view',
      ]),
    });

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('QC Inspector')).toBeInTheDocument();
    expect(screen.getByText('Quality Assurance & Testing')).toBeInTheDocument();
    expect(screen.getByText('PENDING AUDIT')).toBeInTheDocument();
  });

  it('renders PWA banner with SliceMart ERP branding when install event fires', () => {
    useAuthStore.setState({
      tenant: {
        id: 1,
        uuid: 'ten-1',
        name: 'SliceMart ERP',
        slug: 'slicemart',
        status: 'active',
        currency_code: 'BDT',
        timezone: 'UTC',
      },
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

    renderWithProviders(<TenantRoleDashboard />);

    // Trigger PWA install event
    act(() => {
      window.dispatchEvent(new Event('pwa-install-available'));
    });

    expect(screen.getByText(/Install SliceMart ERP/i)).toBeInTheDocument();
    expect(screen.getByText(/Business Operations Platform PWA/i)).toBeInTheDocument();
    expect(screen.getByText(/faster business operations/i)).toBeInTheDocument();
    expect(screen.getByText('Install App')).toBeInTheDocument();
    expect(screen.getByText('Maybe Later')).toBeInTheDocument();
  });

  it('defaults to Finance & Accounts dashboard for Finance Manager', () => {
    useAuthStore.setState({
      user: {
        id: '6',
        name: 'Tariq Finance Lead',
        email: 'finance@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'Finance Manager',
        roles: ['Finance Manager'],
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
        'finance.account.view',
        'finance.journal.view',
        'finance.expense.view',
        'sales.invoice.view',
      ]),
    });

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('Finance Manager')).toBeInTheDocument();
    expect(screen.getByText('Finance & Accounts Command')).toBeInTheDocument();
    expect(screen.getByText('RECEIVABLES DUE')).toBeInTheDocument();
    expect(screen.getByText('COLLECTIONS TODAY')).toBeInTheDocument();
  });

  it('defaults to Workforce & HR dashboard for HR Officer', () => {
    useAuthStore.setState({
      user: {
        id: '7',
        name: 'Nasrin HR Lead',
        email: 'hr@slicemart.test',
        is_active: true,
        is_platform_admin: false,
        role: 'HR Officer',
        roles: ['HR Officer'],
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
        'hr.employee.view',
        'hr.attendance.view',
        'hr.payroll.view',
        'production.worker_entry.view',
      ]),
    });

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('HR Officer')).toBeInTheDocument();
    expect(screen.getByText('Workforce & HR Command')).toBeInTheDocument();
    expect(screen.getByText('TOTAL PERSONNEL')).toBeInTheDocument();
    expect(screen.getByText('PRESENT TODAY')).toBeInTheDocument();
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

    renderWithProviders(<TenantRoleDashboard />);

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

    renderWithProviders(<TenantRoleDashboard />);

    expect(screen.getByText('Enterprise Subsystem Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Commercial & Omnichannel Demand')).toBeInTheDocument();

    // Disallowed wings should not be displayed
    expect(screen.queryByText('Manufacturing & Quality Assurance')).not.toBeInTheDocument();
    expect(screen.queryByText('Finance, Treasury & Assets')).not.toBeInTheDocument();
    expect(screen.queryByText('Workforce & Human Capital')).not.toBeInTheDocument();
    expect(screen.queryByText('Governance, Intelligence & Security')).not.toBeInTheDocument();
  });
});

