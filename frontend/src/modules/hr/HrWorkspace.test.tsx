import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HrWorkspace } from './HrWorkspace';

// Mock Toast notification
vi.mock('../../components/ui/Toast', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Currency hook
vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatCurrency: (val: number | string) => `৳ ${parseFloat(String(val)).toLocaleString()}`,
  }),
}));

// Mock Auth hook
const mockAuthState = {
  user: { id: 1, name: 'Admin User', role: 'admin' },
  hasPermission: () => true,
  hasModuleAccess: () => true,
};

vi.mock('../../lib/auth/authStore', () => ({
  useAuthStore: (selector?: (s: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (initialEntries = ['/hr']) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <HrWorkspace />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('HrWorkspace Component & Action Controls', () => {
  it('renders module title and contextual action controls on Payroll tab', () => {
    renderWithProviders(['/hr?tab=payroll']);

    expect(screen.getByRole('heading', { level: 1, name: /Team, Attendance & Payroll/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New Pay Period/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Export Bank Advice/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders payslip action buttons and opens itemized breakdown modal', () => {
    renderWithProviders(['/hr?tab=payroll']);

    const viewItemsButtons = screen.getAllByRole('button', { name: /View Items/i });
    expect(viewItemsButtons.length).toBeGreaterThanOrEqual(1);
    expect(viewItemsButtons[0]).toBeDefined();

    fireEvent.click(viewItemsButtons[0]!);
    expect(screen.getByText(/Payslip Breakdown:/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Payable Payout/i)).toBeInTheDocument();
  });

  it('renders contextual actions on Staff Directory tab and opens profile modal with document vault', () => {
    renderWithProviders(['/hr?tab=employees']);

    expect(screen.getAllByRole('button', { name: /Add Employee/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Export Staff/i }).length).toBeGreaterThanOrEqual(1);

    const profileButtons = screen.getAllByRole('button', { name: /^Profile$/i });
    expect(profileButtons.length).toBeGreaterThanOrEqual(1);
    expect(profileButtons[0]).toBeDefined();

    fireEvent.click(profileButtons[0]!);
    expect(screen.getByText(/Employee Profile:/i)).toBeInTheDocument();
    expect(screen.getByText(/Employee Document Vault & Compliance/i)).toBeInTheDocument();
  });

  it('renders ID Badge action in menu and opens security pass modal', () => {
    renderWithProviders(['/hr?tab=employees']);

    const moreButtons = screen.getAllByRole('button', { name: /^More options for/i });
    expect(moreButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(moreButtons[0]!);
    const printBadgeBtn = screen.getByRole('button', { name: /Print ID Badge/i });
    expect(printBadgeBtn).toBeInTheDocument();

    fireEvent.click(printBadgeBtn);
    expect(screen.getByText(/Workforce Security ID Card/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Badge/i })).toBeInTheDocument();
  });

  it('renders interactive Approve and Reject actions for pending leave requests', () => {
    renderWithProviders(['/hr?tab=leaves']);

    expect(screen.getAllByRole('button', { name: /Request Leave/i }).length).toBeGreaterThanOrEqual(1);

    // There should be an Approve button for the pending leave request
    const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
    expect(approveButtons.length).toBeGreaterThanOrEqual(1);
    expect(approveButtons[0]).toBeDefined();

    // Click Approve
    fireEvent.click(approveButtons[0]!);

    // Should now show approved / revoke
    expect(screen.getAllByRole('button', { name: /Revoke/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders contextual actions on Daily Attendance tab', () => {
    renderWithProviders(['/hr?tab=attendance']);

    expect(screen.getAllByRole('button', { name: /Mark Attendance/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Export Log/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Import/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Compensation & Salary Structures tab with interactive calculation', () => {
    renderWithProviders(['/hr?tab=salary-structures']);

    expect(screen.getByText(/Compensation Tiers & Salary Structures/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ New Salary Structure/i })).toBeInTheDocument();
    expect(screen.getByText(/Benchmark Simulation Calculator/i)).toBeInTheDocument();
  });

  it('renders Salary Advances & Loans tab with loan granting modal', () => {
    renderWithProviders(['/hr?tab=advances']);

    expect(screen.getByText(/Total Disbursed Advances/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Outstanding Balance/i)).toBeInTheDocument();

    const grantButtons = screen.getAllByRole('button', { name: /\+ Grant Advance/i });
    expect(grantButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(grantButtons[0]!);
    expect(screen.getByText(/Approve Employee Salary Advance \/ Emergency Loan/i)).toBeInTheDocument();
  });

  it('renders Create Payslip button and opens the Create Payslip modal', () => {
    renderWithProviders(['/hr?tab=payroll']);

    const createButtons = screen.getAllByRole('button', { name: /Create Payslip/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(createButtons[0]!);
    expect(screen.getByText(/Create New Payslip/i)).toBeInTheDocument();
    expect(screen.getByText(/Earnings Calculation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Issue & Save Payslip/i })).toBeInTheDocument();
  });

  it('switches pay periods and executes automated batch payroll for open period', () => {
    renderWithProviders(['/hr?tab=payroll']);

    // Period switcher buttons should exist
    const period9Button = screen.getByRole('button', { name: /PAY-202609/i });
    expect(period9Button).toBeInTheDocument();

    // Click PAY-202609 to switch to open period
    fireEvent.click(period9Button);

    // Empty state should be visible initially for PAY-202609
    expect(screen.getByText(/No payslips generated for this period yet/i)).toBeInTheDocument();

    // Run batch payroll
    const batchButtons = screen.getAllByRole('button', { name: /⚡ Run Payroll/i });
    expect(batchButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(batchButtons[0]!);

    // Now payslips should be generated and View Items buttons should be rendered
    const viewButtons = screen.getAllByRole('button', { name: /View Items/i });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders bulk selection controls and toggles selection via toolbar and header checkbox', () => {
    renderWithProviders(['/hr?tab=employees']);

    // Table header select all checkbox button
    const headerCheckbox = screen.getByRole('button', { name: /Select all employees/i });
    expect(headerCheckbox).toBeInTheDocument();

    // Row selection checkboxes should exist
    const rowCheckboxes = screen.getAllByRole('button', { name: /^Select employee/i });
    expect(rowCheckboxes.length).toBeGreaterThanOrEqual(1);

    // Click select all
    fireEvent.click(headerCheckbox);

    // Ribbon should appear
    expect(screen.getByText(/Employees Selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Inactive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Badges/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move to Bin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deselect All/i })).toBeInTheDocument();
  });

  it('renders More options menu for employee rows with clearly labeled Delete Employee action', () => {
    renderWithProviders(['/hr?tab=employees']);

    const moreButtons = screen.getAllByRole('button', { name: /^More options for/i });
    expect(moreButtons.length).toBeGreaterThanOrEqual(1);

    // Click More options on the first employee
    fireEvent.click(moreButtons[0]!);

    // Dropdown should be visible with explicit options
    expect(screen.getByText(/ERP Access & Roles/i)).toBeInTheDocument();
    const deleteBtn = screen.getByRole('button', { name: /Move to Bin/i });
    expect(deleteBtn).toBeInTheDocument();

    // Click Move to Bin (Delete)
    fireEvent.click(deleteBtn);

    // Confirmation modal should open with confirm action button
    expect(screen.getAllByRole('button', { name: /Move to Bin/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders attendance view mode switcher and toggles Month Calendar view', () => {
    renderWithProviders(['/hr?tab=attendance']);

    // Check Daily Log and Month Calendar switcher buttons
    expect(screen.getByRole('button', { name: /Daily Attendance Table View/i })).toBeInTheDocument();
    const calendarSwitchBtn = screen.getByRole('button', { name: /Attendance Month Calendar View/i });
    expect(calendarSwitchBtn).toBeInTheDocument();

    // Toggle to Month Calendar
    fireEvent.click(calendarSwitchBtn);

    // Verify Month Calendar KPIs and calendar view
    expect(screen.getByText(/Workforce Attendance Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled Workdays/i)).toBeInTheDocument();
    expect(screen.getByText(/Present & Punctual/i)).toBeInTheDocument();
    expect(screen.getByText(/Late Arrivals/i)).toBeInTheDocument();
  });

  it('renders Calculation Preview button and opens comprehensive payroll calculation breakdown modal', () => {
    renderWithProviders(['/hr?tab=payroll']);

    const calcButtons = screen.getAllByRole('button', { name: /Calculation Preview/i });
    expect(calcButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(calcButtons[0]!);

    expect(screen.getByText(/Payslip Breakdown:/i)).toBeInTheDocument();
    expect(screen.getByText(/Double-Entry GL Auto-Posting Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Itemized Earnings & Allowances/i)).toBeInTheDocument();
    expect(screen.getByText(/Itemized Deductions & Recoveries/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Payable Payout/i)).toBeInTheDocument();
  });

  it('logs leave decision in in-app notification feed banner when leave request is approved', () => {
    renderWithProviders(['/hr?tab=leaves']);

    const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
    expect(approveButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(approveButtons[0]!);

    // Expect In-App Leave Notifications & Decision Feed section to appear
    expect(screen.getByText(/In-App Leave Notifications & Decision Feed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Approved/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Abdul Karim/i).length).toBeGreaterThanOrEqual(1);
  });

  it('verifies salary advances auto-deduct toggle in Grant Advance modal and table badges', () => {
    renderWithProviders(['/hr?tab=advances']);

    // Auto-Deduct column header
    expect(screen.getByText(/Auto-Deduct/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Next Run/i).length).toBeGreaterThanOrEqual(1);

    // Open Grant Advance modal
    const grantButtons = screen.getAllByRole('button', { name: /\+ Grant Advance/i });
    fireEvent.click(grantButtons[0]!);

    expect(screen.getByText(/Auto-deduct from next payroll cycle/i)).toBeInTheDocument();
  });
});

