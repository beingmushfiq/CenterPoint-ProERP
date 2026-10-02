import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FinancialStatementPrintDocument } from '../../components/print/documents/FinancialStatementPrintDocument';
import { DEFAULT_BUSINESS_CONFIG } from '../../lib/document/useBusinessConfig';
import { FinanceWorkspace } from './FinanceWorkspace';

// Mock react-apexcharts for JSDOM
vi.mock('react-apexcharts', () => ({
  default: () => <div data-testid="mock-apexchart">ApexChart Mock</div>,
}));

// Mock matchMedia for modal responsiveness
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Financial Statement Print & Preview', () => {
  const mockBusinessConfig = {
    ...DEFAULT_BUSINESS_CONFIG,
    name: 'SliceMart Bakery & Foods Ltd.',
    address: 'Plot 42, Tejgaon Industrial Area, Dhaka',
    currencySymbol: '৳',
    currencyCode: 'BDT',
    vatNumber: 'BIN-002938471-0101',
  };

  it('renders FinancialStatementPrintDocument with full P&L, balance sheet and reconciliation', () => {
    render(
      <FinancialStatementPrintDocument
        businessConfig={mockBusinessConfig}
        fiscalPeriodText="Q3 FY2026 (1 Jul 2026 – 30 Sep 2026)"
      />
    );

    // Header & Company Identity
    expect(screen.getByText('SliceMart Bakery & Foods Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Financial Statement')).toBeInTheDocument();
    expect(screen.getByText('Q3 FY2026 (1 Jul 2026 – 30 Sep 2026)')).toBeInTheDocument();

    // Executive KPI Summary Cards
    expect(screen.getByText('Gross Sales Revenue')).toBeInTheDocument();
    expect(screen.getByText('Net Operating Income')).toBeInTheDocument();
    expect(screen.getByText('Total Balance Assets')).toBeInTheDocument();

    // Part I: Income Statement (P&L) Breakdown
    expect(
      screen.getByText('PART I: STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)')
    ).toBeInTheDocument();
    expect(screen.getByText(/4000 • Gross Operating Sales Revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/5100 • Direct Material & Packaging Consumption/i)).toBeInTheDocument();
    expect(screen.getByText(/5200 • Direct Factory & Production Labour/i)).toBeInTheDocument();
    expect(screen.getByText(/GROSS PROFIT \(Operational Margin\)/i)).toBeInTheDocument();
    expect(screen.getByText(/NET OPERATING INCOME \(EBIT\)/i)).toBeInTheDocument();

    // Part II: Balance Sheet & Equation
    expect(
      screen.getByText('PART II: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET SUMMARY)')
    ).toBeInTheDocument();
    expect(screen.getByText(/1010 • Liquid Cash & Commercial Bank Balances/i)).toBeInTheDocument();
    expect(screen.getByText(/1050 • Trade Accounts Receivable/i)).toBeInTheDocument();
    expect(screen.getByText(/2010 • Trade Accounts Payable/i)).toBeInTheDocument();
    expect(screen.getByText(/3010 • Owner's Contributed Equity/i)).toBeInTheDocument();
    expect(screen.getByText(/3050 • Retained Fiscal Earnings/i)).toBeInTheDocument();

    // Reconciliation Check
    expect(screen.getByText('✓ 100% RECONCILED & BALANCED')).toBeInTheDocument();

    // Institutional Signatures
    expect(screen.getByText('Prepared By (Finance & Costing)')).toBeInTheDocument();
    expect(screen.getByText('Verified By (General Ledger Audit)')).toBeInTheDocument();
    expect(screen.getByText('Executive Approval & Authorization')).toBeInTheDocument();
  });

  it('opens PrintPreviewModal when clicking Print Financial Statement button in statements tab', async () => {
    render(
      <MemoryRouter initialEntries={['/finance?tab=statements']}>
        <FinanceWorkspace />
      </MemoryRouter>
    );

    // Locate the print button (await lazy-loaded StatementsSection)
    const printButton = await screen.findByRole(
      'button',
      {
        name: /Print Financial Statement/i,
      },
      { timeout: 7000 }
    );
    expect(printButton).toBeInTheDocument();

    // Click to launch the Print Preview modal
    fireEvent.click(printButton);

    // Modal dialog title should appear
    expect(
      await screen.findByText(/Print Financial Statement: Profit & Loss and Financial Position/i, {}, { timeout: 7000 })
    ).toBeInTheDocument();

    // Document contents inside the PrintPreviewModal must be rendered and non-empty
    expect(
      screen.getByText('PART I: STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('PART II: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET SUMMARY)')
    ).toBeInTheDocument();
    expect(screen.getByText('✓ 100% RECONCILED & BALANCED')).toBeInTheDocument();

    // Close preview modal via ESC or close button
    const closeBtn = screen.getByRole('button', { name: /Close preview/i });
    fireEvent.click(closeBtn);

    // Modal should be closed
    expect(
      screen.queryByText(/Print Financial Statement: Profit & Loss and Financial Position/i)
    ).not.toBeInTheDocument();
  });
});
