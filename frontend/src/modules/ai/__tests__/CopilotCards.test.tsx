import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashPositionCard } from '../components/cards/CashPositionCard';
import { OverdueInvoicesCard } from '../components/cards/OverdueInvoicesCard';
import { PLSummaryCard } from '../components/cards/PLSummaryCard';
import { CashFlowRiskCard } from '../components/cards/CashFlowRiskCard';
import { FinancingMatchCard } from '../components/cards/FinancingMatchCard';
import { InventoryValueCard } from '../components/cards/InventoryValueCard';
import { Tier2ConfirmDialog } from '../components/Tier2ConfirmDialog';
import type {
  CashPositionData,
  OverdueInvoicesData,
  PLSummaryData,
  CashFlowRiskData,
  FinancingMatchData,
  InventoryValuationData,
  PendingAction,
} from '../types/copilot';

describe('AI Copilot Financial Cards & Supervised Actions', () => {
  it('renders CashPositionCard with health badge and breakdown', () => {
    const mockCashPosition: CashPositionData = {
      total_liquid_cash: 970000,
      bank_balance: 845000,
      cash_on_hand: 125000,
      accounts_breakdown: [
        { id: 101, code: '1010', name: 'Petty Cash', type: 'cash', balance: 125000 },
        { id: 102, code: '1020', name: 'BRAC Bank', type: 'bank', balance: 845000 },
      ],
      daily_burn_rate: 15000,
      runway_days: 64,
      health_status: 'healthy',
      as_of_date: '2026-10-16',
    };

    render(<CashPositionCard data={mockCashPosition} />);
    expect(screen.getByText('Real-Time Liquid Cash Position')).toBeDefined();
    expect(screen.getByText(/healthy liquidity/i)).toBeDefined();
    expect(screen.getByText('64 Days')).toBeDefined();
    expect(screen.getByText('Petty Cash')).toBeDefined();
    expect(screen.getByText('BRAC Bank')).toBeDefined();
  });

  it('renders OverdueInvoicesCard with aging distribution and invoice details', () => {
    const mockOverdueData: OverdueInvoicesData = {
      total_overdue: 420000,
      total_invoices_count: 2,
      aging_summary: {
        '1-30': 180000,
        '31-60': 240000,
        '61-90': 0,
        '90+': 0,
      },
      invoices: [
        {
          id: 1,
          invoice_number: 'INV-2026-001',
          customer_name: 'Apex Superstore',
          total_amount: 250000,
          amount_paid: 10000,
          amount_due: 240000,
          due_date: '2026-09-01',
          days_overdue: 45,
          aging_bucket: '31-60',
        },
      ],
    };

    render(<OverdueInvoicesCard data={mockOverdueData} />);
    expect(screen.getByText('Overdue Customer Receivables')).toBeDefined();
    expect(screen.getByText('Apex Superstore')).toBeDefined();
    expect(screen.getByText('INV-2026-001')).toBeDefined();
    expect(screen.getByText('45 days overdue')).toBeDefined();
  });

  it('renders PLSummaryCard with margins and expense breakdown', () => {
    const mockPL: PLSummaryData = {
      period_start: '2026-07-01',
      period_end: '2026-09-30',
      total_revenue: 1200000,
      cogs: 650000,
      gross_profit: 550000,
      gross_margin_pct: 45.8,
      operating_expenses: 280000,
      net_operating_income: 270000,
      net_margin_pct: 22.5,
      expense_breakdown: [
        { category: 'Utilities', amount: 80000, pct_of_total: 28.5 },
        { category: 'Logistics', amount: 120000, pct_of_total: 42.8 },
      ],
    };

    render(<PLSummaryCard data={mockPL} />);
    expect(screen.getByText('Profit & Loss Performance')).toBeDefined();
    expect(screen.getByText('22.5% Net Margin')).toBeDefined();
    expect(screen.getByText('Utilities')).toBeDefined();
    expect(screen.getByText('Logistics')).toBeDefined();
  });

  it('renders CashFlowRiskCard with deficit warning and recommended mitigations', () => {
    const mockRisk: CashFlowRiskData = {
      horizon_days: 30,
      starting_cash: 300000,
      projected_inflows: 200000,
      projected_outflows: 650000,
      projected_net_cash_flow: -450000,
      ending_cash: -150000,
      liquidity_shortfall: true,
      days_until_deficit: 14,
      shortfall_amount: 150000,
      risk_level: 'critical',
      recommended_actions: [
        'Accelerate overdue receivables collection',
        'Secure WeBank Working Capital Term Facility',
      ],
    };

    render(<CashFlowRiskCard data={mockRisk} />);
    expect(screen.getByText('Cash Flow Risk & Liquidity Stress Test')).toBeDefined();
    expect(screen.getByText(/critical risk/i)).toBeDefined();
    expect(screen.getByText(/Liquidity Deficit Detected/)).toBeDefined();
    expect(screen.getByText(/14 days/)).toBeDefined();
    expect(screen.getByText('Accelerate overdue receivables collection')).toBeDefined();
  });

  it('renders FinancingMatchCard with WeBank SME products', () => {
    const mockFinancing: FinancingMatchData = {
      cash_deficit_amount: 250000,
      recommended_financing: 500000,
      credit_score_indicator: 88,
      matched_products: [
        {
          product_id: 'wb-wc-01',
          product_name: 'Working Capital Term Loan',
          institution: 'WeBank SME',
          interest_rate_pct: 7.5,
          repayment_terms: '12-36 Months',
          eligible_amount: 1000000,
          eligibility_score: 95,
          qualification_status: 'pre_approved',
          required_collateral: 'Cash Flow / GST Verification',
          application_turnaround: '24 Hours',
          benefits: ['No physical mortgage required', 'Revolving credit drawdown'],
        },
      ],
      evaluation_summary: 'SME qualifies for instant credit line backed by sales velocity.',
    };

    render(<FinancingMatchCard data={mockFinancing} />);
    expect(screen.getByText('WeBank SME Financing Match Recommendations')).toBeDefined();
    expect(screen.getByText('Working Capital Term Loan')).toBeDefined();
    expect(screen.getByText('95% Match')).toBeDefined();
    expect(screen.getByText('7.5% p.a.')).toBeDefined();
  });

  it('renders InventoryValueCard with stock valuation and holding cost', () => {
    const mockInventory: InventoryValuationData = {
      total_valuation: 850000,
      item_count: 42,
      high_value_items: [
        { id: 1, sku: 'SKU-001', name: 'Premium Flour 50kg', quantity: 200, unit_cost: 2500, total_value: 500000 },
      ],
      slow_moving_valuation: 120000,
      estimated_holding_cost_monthly: 18000,
    };

    render(<InventoryValueCard data={mockInventory} />);
    expect(screen.getByText('Inventory Asset & Working Capital Valuation')).toBeDefined();
    expect(screen.getByText('Premium Flour 50kg')).toBeDefined();
    expect(screen.getByText('42 Items')).toBeDefined();
  });

  it('handles Tier2ConfirmDialog approval and decline lifecycle', () => {
    const mockAction: PendingAction = {
      action_id: 'act-789',
      tool: 'create_cash_flow_alert',
      description: 'Broadcast high liquidity risk alert to management',
      arguments: { severity: 'high', shortfall: 150000 },
      permission_tier: 2,
      risk_level: 'high',
    };

    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    render(
      <Tier2ConfirmDialog
        open={true}
        action={mockAction}
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
      />
    );

    expect(screen.getByText('Supervisor Action Authorization (Tier 2)')).toBeDefined();
    expect(screen.getByText('create_cash_flow_alert')).toBeDefined();
    expect(screen.getByText('Broadcast high liquidity risk alert to management')).toBeDefined();

    // Click Authorize
    const approveBtn = screen.getByText('Authorize & Execute');
    fireEvent.click(approveBtn);
    expect(onConfirmMock).toHaveBeenCalledWith('act-789', true);
  });
});
