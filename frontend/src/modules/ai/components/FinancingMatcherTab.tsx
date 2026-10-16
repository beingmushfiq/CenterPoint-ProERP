import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  History,
  FileText,
} from 'lucide-react';
import { copilotApi } from '../api/copilotApi';
import type {
  FinancingMatchData,
  FinancingAssessmentRecord,
  FinancingProduct,
} from '../types/copilot';
import { useCurrency } from '../../../hooks/useCurrency';
import { notify } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';

export const FinancingMatcherTab: React.FC = () => {
  const { formatCurrency } = useCurrency();

  const [requestedAmount, setRequestedAmount] = useState<number>(500000);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [collateral, setCollateral] = useState<string>('unsecured');
  const [purpose, setPurpose] = useState<string>('working_capital');

  const [isMatching, setIsMatching] = useState(false);
  const [matchData, setMatchData] = useState<FinancingMatchData | null>(null);

  const [history, setHistory] = useState<FinancingAssessmentRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Application Modal
  const [selectedProduct, setSelectedProduct] = useState<FinancingProduct | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const runMatch = useCallback(async () => {
    setIsMatching(true);
    try {
      const data = await copilotApi.matchFinancing({
        requested_amount: requestedAmount,
        preferred_term_months: termMonths,
        collateral_available: collateral,
        purpose: purpose,
      });
      setMatchData(data);
    } catch {
      notify.error('Unable to match financing options at this time');
    } finally {
      setIsMatching(false);
    }
  }, [requestedAmount, termMonths, collateral, purpose]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const records = await copilotApi.getFinancingHistory();
      setHistory(records);
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        runMatch();
        loadHistory();
      }
    });
    return () => {
      active = false;
    };
  }, [runMatch, loadHistory]);

  const handleApply = async () => {
    if (!selectedProduct) return;
    setIsApplying(true);
    try {
      const response = await copilotApi.preQualifyWebank({
        product_id: selectedProduct.product_id,
        requested_amount: selectedProduct.eligible_amount || requestedAmount,
        collateral_type: collateral,
      });
      notify.success(
        `Pre-qualification approved for ${selectedProduct.product_name}! Ref: ${response.application_reference}`
      );
      setShowApplyModal(false);
      loadHistory();
    } catch {
      notify.error('Application submission failed. Please verify eligibility.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration & Simulation Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-default shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-default flex items-center gap-2">
              <Briefcase className="size-5 text-primary" />
              <span>WeBank Intelligent SME Financing Assessment Engine</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Instant AI evaluation matching verified ledger data with pre-approved credit lines
            </p>
          </div>

          <button
            type="button"
            onClick={runMatch}
            disabled={isMatching}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Sparkles className="size-3.5" />
            <span>{isMatching ? 'Matching...' : 'Re-Evaluate Financing'}</span>
          </button>
        </div>

        {/* Input Parameters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Requested Amount */}
          <div>
            <label className="block text-xs font-semibold text-default mb-1.5">
              Requested Facility (BDT)
            </label>
            <div className="relative">
              <input
                type="number"
                step="50000"
                min="50000"
                max="10000000"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Preferred Term */}
          <div>
            <label className="block text-xs font-semibold text-default mb-1.5">
              Repayment Horizon
            </label>
            <select
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            >
              <option value={3}>3 Months (Short-Term Liquidity)</option>
              <option value={6}>6 Months (Working Capital)</option>
              <option value={12}>12 Months (Annual Term Line)</option>
              <option value={24}>24 Months (Capital Equipment)</option>
              <option value={36}>36 Months (Expansion Loan)</option>
            </select>
          </div>

          {/* Collateral Type */}
          <div>
            <label className="block text-xs font-semibold text-default mb-1.5">
              Available Collateral
            </label>
            <select
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            >
              <option value="unsecured">Clean / Unsecured (Cash Flow Backed)</option>
              <option value="receivables">Accounts Receivable (Invoice Factoring)</option>
              <option value="inventory">Warehouse Inventory / Stock</option>
              <option value="equipment">Machinery & Production Equipment</option>
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-default mb-1.5">
              Financing Purpose
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            >
              <option value="working_capital">Working Capital & Payroll</option>
              <option value="supplier_bills">Pay Supplier & Vendor Dues</option>
              <option value="inventory_stocking">Seasonal Bulk Inventory Purchase</option>
              <option value="expansion">Production Line Expansion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Real-time Match Results */}
      {isMatching ? (
        <div className="p-12 text-center text-xs text-muted space-y-2 bg-surface rounded-2xl border border-default">
          <Sparkles className="size-6 text-primary mx-auto animate-spin" />
          <p>Running credit scoring models & matching financing facilities...</p>
        </div>
      ) : matchData ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider">
              Recommended Financing Facilities ({matchData.matched_products?.length || 0})
            </h4>
            <div className="text-xs text-muted">
              Recommended Amount:{' '}
              <span className="font-bold font-mono text-primary">
                {formatCurrency(matchData.recommended_financing)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchData.matched_products?.map((product) => (
              <div
                key={product.product_id}
                className="p-5 rounded-2xl bg-surface border border-default shadow-xs hover:border-primary/50 transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                        {product.institution}
                      </span>
                      <h4 className="text-base font-extrabold text-default leading-tight">
                        {product.product_name}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                      {product.eligibility_score}% Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-sunken/60 text-xs">
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">
                        Annual Interest
                      </span>
                      <div className="font-mono font-extrabold text-default text-sm mt-0.5">
                        {product.interest_rate_pct}% p.a.
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">
                        Eligible Facility Limit
                      </span>
                      <div className="font-mono font-extrabold text-primary text-sm mt-0.5">
                        {formatCurrency(product.eligible_amount)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">
                        Approval Turnaround
                      </span>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                        {product.application_turnaround}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">
                        Collateral Required
                      </span>
                      <div className="text-default font-medium text-xs mt-0.5 truncate">
                        {product.required_collateral}
                      </div>
                    </div>
                  </div>

                  {product.benefits && product.benefits.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        Highlights
                      </div>
                      {product.benefits.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-muted">
                          <CheckCircle className="size-3.5 text-primary shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-default/60">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowApplyModal(true);
                    }}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Instant Pre-Qualification</span>
                    <Sparkles className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Historical Assessments */}
      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-default shadow-xs space-y-4">
        <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-2">
          <History className="size-4 text-muted" />
          <span>Historical SME Financing Assessments</span>
        </h4>

        {isLoadingHistory ? (
          <div className="p-6 text-center text-xs text-muted">Loading historical assessments...</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted">
            No previous financing evaluations saved.
          </div>
        ) : (
          <div className="divide-y divide-default/40 rounded-xl border border-default/70 overflow-hidden">
            {history.map((rec) => (
              <div
                key={rec.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-surface-sunken/40 transition"
              >
                <div>
                  <div className="font-mono font-bold text-primary flex items-center gap-2">
                    <FileText className="size-3.5 text-muted" />
                    <span>Evaluation {rec.uuid}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold bg-primary/10 text-primary">
                      {rec.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    Evaluated on: {new Date(rec.created_at).toLocaleString()} • Requested:{' '}
                    <strong className="text-default font-mono">
                      {formatCurrency(rec.requested_amount)}
                    </strong>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted">Runway Days: </span>
                  <span className="font-bold text-default">{rec.projected_runway_days} Days</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {selectedProduct && (
        <Modal
          open={showApplyModal}
          onClose={() => !isApplying && setShowApplyModal(false)}
          title={`Pre-Qualify for ${selectedProduct.product_name}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <ShieldCheck className="size-4" />
                <span>WeBank Instant Digital SME Credit Verification</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Applying will securely package your encrypted ledger verification metrics (P&L
                turnover, bank inflows, accounts receivable aging) and transmit them directly to
                WeBank SME lending facilities.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-surface-sunken border border-default space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Facility Name:</span>
                <span className="font-bold text-default">{selectedProduct.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Lending Institution:</span>
                <span className="font-bold text-default">{selectedProduct.institution}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Eligible Amount:</span>
                <span className="font-mono font-bold text-primary">
                  {formatCurrency(selectedProduct.eligible_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Annual Rate:</span>
                <span className="font-mono font-bold text-default">
                  {selectedProduct.interest_rate_pct}% p.a.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                disabled={isApplying}
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={handleApply}
                className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Sparkles className="size-3.5" />
                <span>{isApplying ? 'Submitting Application...' : 'Confirm & Transmit'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
