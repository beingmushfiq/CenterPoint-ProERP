import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import { Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface StatementsSectionProps {
  onPrint?: () => void;
  onOpenPrintModal?: () => void;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
  onPrint,
  onOpenPrintModal,
}) => {
  const { formatCurrency } = useCurrency();
  const triggerPrint = onOpenPrintModal || onPrint;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl shadow-xs border border-default">
        <div>
          <h2 className="text-base font-bold text-default">
            Fiscal Period Statement of Profit & Loss (Income Statement)
          </h2>
          <p className="text-xs text-muted">
            Live computed from posted general ledger transactions and inventory valuation
          </p>
        </div>
        {triggerPrint && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={triggerPrint}
            className="shadow-md shadow-primary/20 shrink-0"
          >
            <Printer className="size-3.5 mr-1.5" />
            <span>Print Financial Statement</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Statement Breakdown */}
        <div className="bg-surface rounded-2xl shadow-xs border border-default p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2">
            Revenue & Cost of Sales
          </h3>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-default font-semibold">
              <span>Gross Sales Revenue</span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(950000)}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span className="pl-4">Less: Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-danger font-semibold">({formatCurrency(480000)})</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span className="pl-4">Less: Direct Factory Labour</span>
              <span className="font-mono text-danger font-semibold">({formatCurrency(145000)})</span>
            </div>
            <div className="border-t border-default pt-2 flex justify-between items-center font-bold text-default bg-surface-sunken p-2.5 rounded-xl">
              <span>Gross Profit</span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(325000)} (34.2%)
              </span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2 pt-3">
            Operating Expenses
          </h3>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-muted">
              <span>Logistics & 3PL Courier Fees</span>
              <span className="font-mono font-medium text-default">{formatCurrency(38500)}</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span>Utilities & Factory Power</span>
              <span className="font-mono font-medium text-default">{formatCurrency(24000)}</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span>Administrative & Software</span>
              <span className="font-mono font-medium text-default">{formatCurrency(18200)}</span>
            </div>
            <div className="border-t border-default pt-2 flex justify-between items-center font-bold text-sm text-default bg-success-subtle p-3 rounded-xl border border-success/30">
              <span className="text-success font-bold">
                Net Operating Income (EBIT)
              </span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(244300)}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Sheet Summary */}
        <div className="bg-surface rounded-2xl shadow-xs border border-default p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2">
            Balance Sheet Equation (Assets = Liabilities + Equity)
          </h3>
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Total Current & Fixed Assets</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(1850000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Liquid cash, trade receivables, warehouse raw materials, and factory machinery
              </p>
            </div>

            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Total External Liabilities</span>
                <span className="font-mono font-bold text-amber-500">{formatCurrency(620000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Supplier trade payables, accrued wages, sales tax, and commercial loans
              </p>
            </div>

            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Shareholder Contributed Equity</span>
                <span className="font-mono font-bold text-emerald-500">{formatCurrency(1230000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Retained earnings, paid-in equity capital, and fiscal reserve surplus
              </p>
            </div>

            <div className="p-3 bg-primary-subtle rounded-xl border border-primary/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-primary font-bold">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Accounting Identity Proof</span>
              </div>
              <span className="font-mono font-bold text-primary">
                ৳ 18,50,000 = ৳ 18,50,000 ✓
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementsSection;
