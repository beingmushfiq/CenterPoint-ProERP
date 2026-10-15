import React from 'react';
import { Briefcase, CheckCircle, Percent, Clock, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { FinancingMatchData, FinancingProduct } from '../../types/copilot';

interface FinancingMatchCardProps {
  data: FinancingMatchData;
  onSelectProduct?: (product: FinancingProduct) => void;
}

export const FinancingMatchCard: React.FC<FinancingMatchCardProps> = ({
  data,
  onSelectProduct,
}) => {
  const { formatCurrency } = useCurrency();

  const getStatusBadge = (status: FinancingProduct['qualification_status']) => {
    switch (status) {
      case 'pre_approved':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'eligible':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'conditionally_eligible':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-muted/10 text-muted border-default';
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Briefcase className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-default">
                WeBank SME Financing Match Recommendations
              </h4>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-2.5" />
                AI Scored
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Customized credit facilities based on real-time ledger health & turnover
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-muted">Recommended Facility</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-primary">
            {formatCurrency(data.recommended_financing)}
          </div>
        </div>
      </div>

      {/* Evaluation Summary */}
      {data.evaluation_summary && (
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70 text-xs text-default leading-relaxed">
          <span className="font-semibold text-primary">Credit Appraisal Summary: </span>
          {data.evaluation_summary}
        </div>
      )}

      {/* Matched Products List */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
          Matched Financial Facilities ({data.matched_products?.length || 0})
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.matched_products?.map((prod) => (
            <div
              key={prod.product_id}
              className="p-4 rounded-xl border border-default bg-surface hover:border-primary/50 transition-all space-y-3 shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                {/* Product Title & Match Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted tracking-wider">
                      {prod.institution}
                    </span>
                    <h5 className="text-sm font-bold text-default leading-tight">
                      {prod.product_name}
                    </h5>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(
                        prod.qualification_status
                      )}`}
                    >
                      {prod.eligibility_score}% Match
                    </span>
                  </div>
                </div>

                {/* Rates & Terms */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-surface-sunken/70 text-xs">
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold flex items-center gap-1">
                      <Percent className="size-3" />
                      Interest Rate
                    </span>
                    <span className="font-mono font-bold text-default mt-0.5 block">
                      {prod.interest_rate_pct}% p.a.
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold flex items-center gap-1">
                      <Clock className="size-3" />
                      Turnaround
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {prod.application_turnaround}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Max Limit</span>
                    <span className="font-mono font-bold text-primary mt-0.5 block">
                      {formatCurrency(prod.eligible_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Terms</span>
                    <span className="text-default font-medium mt-0.5 block truncate">
                      {prod.repayment_terms}
                    </span>
                  </div>
                </div>

                {/* Collateral & Key Benefits */}
                <div className="text-[11px] space-y-1">
                  <div className="text-muted flex items-center gap-1">
                    <ShieldCheck className="size-3 text-muted shrink-0" />
                    <span>Collateral: <strong className="text-default">{prod.required_collateral}</strong></span>
                  </div>
                  {prod.benefits && prod.benefits.length > 0 && (
                    <div className="space-y-0.5 pt-1">
                      {prod.benefits.slice(0, 2).map((b, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-muted">
                          <CheckCircle className="size-3 text-primary shrink-0" />
                          <span className="truncate">{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-default/50">
                <button
                  type="button"
                  onClick={() => onSelectProduct?.(prod)}
                  className="w-full py-2 px-3 rounded-lg bg-surface border border-default hover:bg-surface-sunken text-default font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>Pre-Qualify for Facility</span>
                  <ArrowRight className="size-3 text-primary" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
