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

// Mock react-apexcharts for JSDOM
vi.mock('react-apexcharts', () => ({
  default: () => <div data-testid="mock-apexchart">ApexChart Mock</div>,
}));

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
    expect(screen.getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Production$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Inventory$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quality$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales & POS/i })).toBeInTheDocument();

    // Executive overview contents
    expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
    expect(screen.getByText('Today Revenue')).toBeInTheDocument();
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
    expect(screen.getByText('Recent Invoices & Receivables')).toBeInTheDocument();
    expect(screen.getByText('Catalogue SKUs')).toBeInTheDocument();
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
    expect(screen.getByText('Recent Stock Movements')).toBeInTheDocument();
    expect(screen.getByText('Inventory Categories')).toBeInTheDocument();
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
    expect(screen.getByText('Recent QC Inspections')).toBeInTheDocument();
    expect(screen.getByText('Quality Scorecard')).toBeInTheDocument();
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
    expect(screen.getByText(/Business Operations PWA/i)).toBeInTheDocument();
    expect(screen.getByText(/faster access and offline caching/i)).toBeInTheDocument();
    expect(screen.getByText('Install App')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
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
    expect(screen.getByText('Enterprise Cash Flow Trend')).toBeInTheDocument();
    expect(screen.getByText('Aged Receivables')).toBeInTheDocument();
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
    expect(screen.getByText("Today's Attendance Log")).toBeInTheDocument();
    expect(screen.getByText('Department Headcount')).toBeInTheDocument();
  });

  it('does not render Enterprise Subsystem Cockpit on the dashboard for Super Administrator', () => {
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

    // Enterprise Subsystem Cockpit should not be rendered
    expect(screen.queryByText('Enterprise Subsystem Cockpit')).not.toBeInTheDocument();
  });
});

