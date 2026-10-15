import React from 'react';
import { TrendingUp, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { PLSummaryData } from '../../types/copilot';

interface PLSummaryCardProps {
  data: PLSummaryData;
}

export const PLSummaryCard: React.FC<PLSummaryCardProps> = ({ data }) => {
  const { formatCurrency } = useCurrency();

  const isProfitable = data.net_operating_income >= 0;

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
            <TrendingUp className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">Profit & Loss Performance</h4>
            <p className="text-[11px] text-muted">
              Period: {data.period_start} to {data.period_end}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isProfitable
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}
        >
          {isProfitable ? (
            <ArrowUpRight className="size-3" />
          ) : (
            <ArrowDownRight className="size-3" />
          )}
          <span>{data.net_margin_pct.toFixed(1)}% Net Margin</span>
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Total Revenue</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-primary mt-0.5">
            {formatCurrency(data.total_revenue)}
          </div>
          <div className="text-[10px] text-muted mt-0.5">Top-line turnover</div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Cost of Goods (COGS)</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
            {formatCurrency(data.cogs)}
          </div>
          <div className="text-[10px] text-muted mt-0.5">Direct production cost</div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Gross Profit</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(data.gross_profit)}
          </div>
          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {data.gross_margin_pct.toFixed(1)}% Gross Margin
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Net Operating Income</div>
          <div
            className={`text-base sm:text-lg font-mono font-extrabold mt-0.5 ${
              isProfitable
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(data.net_operating_income)}
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            OpEx: {formatCurrency(data.operating_expenses)}
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      {data.expense_breakdown && data.expense_breakdown.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <PieChart className="size-3.5 text-muted" />
            <span>Operating Expense Distribution</span>
          </div>
          <div className="space-y-2 rounded-xl border border-default/60 p-3 bg-surface">
            {data.expense_breakdown.map((exp, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-default capitalize">{exp.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-default">
                      {formatCurrency(exp.amount)}
                    </span>
                    <span className="text-[10px] font-mono text-muted w-10 text-right">
                      ({exp.pct_of_total.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, exp.pct_of_total)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
