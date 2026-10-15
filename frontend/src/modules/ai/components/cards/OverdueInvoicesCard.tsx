import React from 'react';
import { AlertCircle, Calendar, User, FileText } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { OverdueInvoicesData } from '../../types/copilot';

interface OverdueInvoicesCardProps {
  data: OverdueInvoicesData;
}

export const OverdueInvoicesCard: React.FC<OverdueInvoicesCardProps> = ({ data }) => {
  const { formatCurrency } = useCurrency();

  const getAgingBadgeColor = (bucket: string) => {
    switch (bucket) {
      case '90+':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case '61-90':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case '31-60':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
            <AlertCircle className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">Overdue Customer Receivables</h4>
            <p className="text-[11px] text-muted">
              {data.total_invoices_count} uncollected invoices impacting working capital
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-muted">Total Overdue</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-rose-600 dark:text-rose-400">
            {formatCurrency(data.total_overdue)}
          </div>
        </div>
      </div>

      {/* Aging Distribution Bar */}
      {data.aging_summary && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Aging Distribution
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['1-30', '31-60', '61-90', '90+'] as const).map((bucket) => {
              const amount = data.aging_summary[bucket] || 0;
              return (
                <div
                  key={bucket}
                  className="p-2.5 rounded-xl bg-surface-sunken/60 border border-default/70 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-default">{bucket} Days</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getAgingBadgeColor(
                        bucket
                      )}`}
                    >
                      {bucket}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-mono font-bold text-default mt-1">
                    {formatCurrency(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices List */}
      {data.invoices && data.invoices.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            High Priority Receivables ({data.invoices.length})
          </div>
          <div className="divide-y divide-default/40 rounded-xl border border-default/60 overflow-hidden bg-surface max-h-60 overflow-y-auto">
            {data.invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-surface-sunken/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary flex items-center gap-1">
                      <FileText className="size-3 text-muted" />
                      {inv.invoice_number}
                    </span>
                    <span className="text-default font-medium flex items-center gap-1">
                      <User className="size-3 text-muted" />
                      {inv.customer_name}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted flex items-center gap-1">
                    <Calendar className="size-3" />
                    Due: {inv.due_date}
                    <span
                      className={`ml-1.5 px-1.5 py-0.2 rounded-full font-semibold border ${getAgingBadgeColor(
                        inv.aging_bucket
                      )}`}
                    >
                      {inv.days_overdue} days overdue
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(inv.amount_due)}
                  </div>
                  {inv.amount_paid > 0 && (
                    <div className="text-[10px] text-muted font-mono">
                      Paid: {formatCurrency(inv.amount_paid)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
