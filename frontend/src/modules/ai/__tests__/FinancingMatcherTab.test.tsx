import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinancingMatcherTab } from '../components/FinancingMatcherTab';
import { copilotApi } from '../api/copilotApi';
import { notify } from '../../../components/ui/Toast';
import type { FinancingMatchData, FinancingAssessmentRecord } from '../types/copilot';

vi.mock('../api/copilotApi', () => ({
  copilotApi: {
    matchFinancing: vi.fn(),
    getFinancingHistory: vi.fn(),
    preQualifyWebank: vi.fn(),
  },
}));

vi.mock('../../../components/ui/Toast', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockMatchData: FinancingMatchData = {
  cash_deficit_amount: 150000,
  recommended_financing: 500000,
  credit_score_indicator: 85,
  evaluation_summary: 'Enterprise maintains positive operating margin and healthy ledger liquidity.',
  matched_products: [
    {
      product_id: 'prod_we_invoice_01',
      product_name: 'WeBank SME Accounts Receivable Dynamic Factoring',
      institution: 'WeBank Open SME Facility',
      interest_rate_pct: 7.2,
      repayment_terms: 'Up to 90 days',
      eligible_amount: 350000,
      eligibility_score: 92,
      qualification_status: 'pre_approved',
      required_collateral: 'Assigned verified accounts receivable',
      application_turnaround: 'Instant digital wallet payout (< 10 min)',
      benefits: ['Fast disbursement', 'Low interest rate'],
    },
  ],
};

const mockHistory: FinancingAssessmentRecord[] = [
  {
    id: 1,
    uuid: 'fa-1111',
    requested_amount: 500000,
    projected_runway_days: 60,
    burn_rate: 15000,
    revenue_run_rate: 1500000,
    collateral_value: 0,
    recommended_products: [],
    status: 'approved',
    created_at: '2026-10-10 12:00:00',
  },
];

describe('FinancingMatcherTab & WeBank Pre-Qualification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(copilotApi.matchFinancing).mockResolvedValue(mockMatchData);
    vi.mocked(copilotApi.getFinancingHistory).mockResolvedValue(mockHistory);
    vi.mocked(copilotApi.preQualifyWebank).mockResolvedValue({
      application_reference: 'WB-SME-REF12345',
      institution: 'WeBank Digital SME Micro-Finance',
      partner_platform: 'CenterPoint ProERP',
      tenant_id: 1,
      status: 'PRE_QUALIFIED',
      product_selected: null,
      credit_assessment: {
        solvency_score: 90,
        annual_turnover: 1200000,
        operating_margin_pct: 18.5,
        debt_service_coverage: 2.4,
        risk_classification: 'LOW_RISK_A1',
        verified_at: '2026-10-17T00:00:00Z',
      },
      disbursement_route: 'INSTANT_DIGITAL_WALLET',
      underwriting_timestamp: '2026-10-17T00:00:00Z',
    });
  });

  it('renders products and submits real pre-qualification to WeBank API', async () => {
    render(<FinancingMatcherTab />);

    await waitFor(() => {
      expect(copilotApi.matchFinancing).toHaveBeenCalled();
      expect(screen.getByText('WeBank SME Accounts Receivable Dynamic Factoring')).toBeDefined();
    });

    // Open apply modal
    const preQualBtn = screen.getByRole('button', { name: /instant pre-qualification/i });
    fireEvent.click(preQualBtn);

    // Modal is visible
    expect(screen.getByText(/WeBank Instant Digital SME Credit Verification/i)).toBeDefined();

    // Click Confirm & Transmit
    const confirmBtn = screen.getByRole('button', { name: /confirm & transmit/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(copilotApi.preQualifyWebank).toHaveBeenCalledWith({
        product_id: 'prod_we_invoice_01',
        requested_amount: 350000,
        collateral_type: 'unsecured',
      });
      expect(notify.success).toHaveBeenCalledWith(
        expect.stringContaining('WB-SME-REF12345')
      );
    });
  });
});
