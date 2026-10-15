import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2, TrendingDown } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { CashFlowRiskData } from '../../types/copilot';

interface CashFlowRiskCardProps {
  data: CashFlowRiskData;
  onExploreFinancing?: () => void;
}

export const CashFlowRiskCard: React.FC<CashFlowRiskCardProps> = ({
  data,
  onExploreFinancing,
}) => {
  const { formatCurrency } = useCurrency();

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
      case 'severe':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'moderate':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
            <ShieldAlert className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">Cash Flow Risk & Liquidity Stress Test</h4>
            <p className="text-[11px] text-muted">{data.horizon_days}-Day Predictive Horizon</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getRiskBadge(
            data.risk_level
          )}`}
        >
          <AlertTriangle className="size-3" />
          <span>{data.risk_level} Risk</span>
        </span>
      </div>

      {/* Deficit Alert Banner if Shortfall */}
      {data.liquidity_shortfall && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
          <TrendingDown className="size-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="text-xs space-y-1">
            <div className="font-bold">
              Liquidity Deficit Detected: {formatCurrency(data.shortfall_amount)}
            </div>
            <p className="text-[11px] opacity-90">
              {data.days_until_deficit !== null
                ? `Projected cash deficit in approximately ${data.days_until_deficit} days based on current burn rate and vendor obligations.`
                : 'Projected cash deficit within the horizon.'}
            </p>
          </div>
        </div>
      )}

      {/* Projection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Starting Cash</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-default mt-1">
            {formatCurrency(data.starting_cash)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Projected Inflows</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            +{formatCurrency(data.projected_inflows)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Projected Outflows</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
            -{formatCurrency(data.projected_outflows)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Ending Balance</div>
          <div
            className={`text-xs sm:text-sm font-mono font-extrabold mt-1 ${
              data.ending_cash >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(data.ending_cash)}
          </div>
        </div>
      </div>

      {/* Recommended Action Items */}
      {data.recommended_actions && data.recommended_actions.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            AI Recommended Mitigations
          </div>
          <div className="space-y-1.5">
            {data.recommended_actions.map((action, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-sunken/50 border border-default/60 text-xs text-default"
              >
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span className="leading-relaxed">{action}</span>
              </div>
            ))}
          </div>

          {onExploreFinancing && data.liquidity_shortfall && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onExploreFinancing}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <span>Explore Matched WeBank SME Financing Options</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
