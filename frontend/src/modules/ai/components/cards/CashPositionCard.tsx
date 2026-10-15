import React from 'react';
import { Landmark, TrendingDown, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { CashPositionData } from '../../types/copilot';

interface CashPositionCardProps {
  data: CashPositionData;
}

export const CashPositionCard: React.FC<CashPositionCardProps> = ({ data }) => {
  const { formatCurrency } = useCurrency();

  const isHealthy = data.health_status === 'healthy';
  const isModerate = data.health_status === 'moderate';

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Landmark className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">Real-Time Liquid Cash Position</h4>
            <p className="text-[11px] text-muted">As of {data.as_of_date || 'Today'}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isHealthy
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : isModerate
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}
        >
          {isHealthy ? (
            <ShieldCheck className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          <span className="capitalize">{data.health_status} Liquidity</span>
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Total Liquid Cash</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(data.total_liquid_cash)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Cash Runway</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-primary mt-0.5 flex items-center gap-1">
            <Clock className="size-3.5" />
            <span>{data.runway_days} Days</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Daily Burn Rate</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
            <TrendingDown className="size-3.5" />
            <span>{formatCurrency(data.daily_burn_rate)}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Bank vs Cash</div>
          <div className="text-xs font-mono font-semibold text-default mt-1">
            Bank: {formatCurrency(data.bank_balance)}
            <br />
            Cash: {formatCurrency(data.cash_on_hand)}
          </div>
        </div>
      </div>

      {/* Accounts Breakdown Table */}
      {data.accounts_breakdown && data.accounts_breakdown.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Operating Accounts ({data.accounts_breakdown.length})
          </div>
          <div className="divide-y divide-default/40 rounded-xl border border-default/60 overflow-hidden bg-surface">
            {data.accounts_breakdown.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-sunken/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-primary">{acc.code}</span>
                  <span className="text-default font-medium">{acc.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-sunken text-muted uppercase">
                    {acc.type}
                  </span>
                </div>
                <div className="font-mono font-bold text-default">
                  {formatCurrency(acc.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
