import { useMemo } from 'react';
import {
  X,
  Printer,
  Clock,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import type { PosSession } from '../../../types/api/pos';
import { useCurrency } from '../../../hooks/useCurrency';

interface MidShiftSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PosSession;
}

export function MidShiftSummaryModal({ isOpen, onClose, session }: MidShiftSummaryModalProps) {
  const { formatCurrency } = useCurrency();

  // Metrics calculations
  const openingFloat = parseFloat(session.opening_cash || '0');
  const expectedCash = parseFloat(session.expected_cash || '0');
  const cardTotal = parseFloat(session.card_total || '0');
  const mobileTotal = parseFloat(session.mobile_total || '0');
  const creditTotal = parseFloat(session.credit_total || '0');
  const refundTotal = parseFloat(session.refund_total || '0');
  const salesCount = session.sales_count || 0;

  // Cash collected from actual sales (excluding opening float)
  const cashSalesCollected = Math.max(0, expectedCash - openingFloat);
  const grossRevenue = cashSalesCollected + cardTotal + mobileTotal + creditTotal;
  const averageBasket = salesCount > 0 ? grossRevenue / salesCount : 0;

  // Tender share percentages
  const tenderPercentages = useMemo(() => {
    if (grossRevenue <= 0) return { cash: 0, card: 0, mobile: 0, credit: 0 };
    return {
      cash: Math.round((cashSalesCollected / grossRevenue) * 100),
      card: Math.round((cardTotal / grossRevenue) * 100),
      mobile: Math.round((mobileTotal / grossRevenue) * 100),
      credit: Math.round((creditTotal / grossRevenue) * 100),
    };
  }, [grossRevenue, cashSalesCollected, cardTotal, mobileTotal, creditTotal]);

  // Duration since shift opened
  const shiftDuration = useMemo(() => {
    if (!session.opened_at) return 'N/A';
    try {
      const opened = new Date(session.opened_at);
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - opened.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m elapsed`;
    } catch {
      return 'In progress';
    }
  }, [session.opened_at]);

  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default px-6 py-4 bg-surface-sunken">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-default">Mid-Shift Summary (X-Report)</h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Shift
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {session.session_number} &bull; {session.terminal_name ?? 'POS Terminal'} &bull; {session.branch_name ?? 'Main Outlet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-default text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer"
            title="Close summary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Metadata Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-surface-sunken border border-default text-xs">
            <div>
              <span className="text-[10px] text-muted uppercase font-semibold block">Operator / Cashier</span>
              <span className="font-semibold text-default truncate block">{session.operator_name ?? 'Cashier'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted uppercase font-semibold block">Opened At</span>
              <span className="font-mono text-default block">
                {session.opened_at ? new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted uppercase font-semibold block">Shift Duration</span>
              <span className="font-medium text-primary block flex items-center gap-1">
                <Clock className="size-3" /> {shiftDuration}
              </span>
            </div>
          </div>

          {/* Primary Top KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-default bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-semibold uppercase">Gross Sales</span>
                <TrendingUp className="size-3.5 text-primary" />
              </div>
              <div className="text-lg font-bold font-mono text-default">
                {formatCurrency(grossRevenue)}
              </div>
              <div className="text-[10px] text-muted mt-0.5">{salesCount} orders</div>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-semibold uppercase">Drawer Cash</span>
                <DollarSign className="size-3.5 text-emerald-500" />
              </div>
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(expectedCash)}
              </div>
              <div className="text-[10px] text-muted mt-0.5">Float + Sales</div>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-semibold uppercase">Avg Basket</span>
                <ShoppingBag className="size-3.5 text-blue-500" />
              </div>
              <div className="text-lg font-bold font-mono text-default">
                {formatCurrency(averageBasket)}
              </div>
              <div className="text-[10px] text-muted mt-0.5">Per ticket</div>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-semibold uppercase">Refunds</span>
                <RotateCcw className="size-3.5 text-rose-500" />
              </div>
              <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                {formatCurrency(refundTotal)}
              </div>
              <div className="text-[10px] text-muted mt-0.5">Processed</div>
            </div>
          </div>

          {/* Tender Breakdown Card */}
          <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center justify-between">
              <span>Tender Settlement Breakdown</span>
              <span className="text-[11px] text-muted font-normal">Gross: {formatCurrency(grossRevenue)}</span>
            </h4>

            {/* Split Progress Bar */}
            <div className="h-2 w-full rounded-full bg-surface-sunken overflow-hidden flex">
              <div style={{ width: `${tenderPercentages.cash}%` }} className="bg-emerald-500 transition-all" title={`Cash: ${tenderPercentages.cash}%`} />
              <div style={{ width: `${tenderPercentages.card}%` }} className="bg-blue-500 transition-all" title={`Card: ${tenderPercentages.card}%`} />
              <div style={{ width: `${tenderPercentages.mobile}%` }} className="bg-purple-500 transition-all" title={`Mobile: ${tenderPercentages.mobile}%`} />
              <div style={{ width: `${tenderPercentages.credit}%` }} className="bg-amber-500 transition-all" title={`Credit: ${tenderPercentages.credit}%`} />
            </div>

            {/* Tender Rows */}
            <div className="divide-y divide-default/50 text-xs">
              <div className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-default">Cash Sales Collected</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-default">{formatCurrency(cashSalesCollected)}</span>
                  <span className="text-[10px] text-muted ml-2">({tenderPercentages.cash}%)</span>
                </div>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-500" />
                  <span className="font-medium text-default">Card Payments (POS Terminal)</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-default">{formatCurrency(cardTotal)}</span>
                  <span className="text-[10px] text-muted ml-2">({tenderPercentages.card}%)</span>
                </div>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-purple-500" />
                  <span className="font-medium text-default">Mobile Banking (bKash / Nagad)</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-default">{formatCurrency(mobileTotal)}</span>
                  <span className="text-[10px] text-muted ml-2">({tenderPercentages.mobile}%)</span>
                </div>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-amber-500" />
                  <span className="font-medium text-default">Customer Credit / Account Adjustment</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-default">{formatCurrency(creditTotal)}</span>
                  <span className="text-[10px] text-muted ml-2">({tenderPercentages.credit}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Float Reconciliation Snapshot */}
          <div className="rounded-xl border border-default bg-surface-sunken p-3.5 space-y-2 text-xs">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              Drawer Cash Calculation
            </span>
            <div className="flex justify-between text-muted">
              <span>Opening Float (Base Cash):</span>
              <span className="font-mono">{formatCurrency(openingFloat)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>+ Cash Inflow (Customer Sales):</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(cashSalesCollected)}</span>
            </div>
            {refundTotal > 0 && (
              <div className="flex justify-between text-muted">
                <span>- Cash Paid Out (Refunds / Returns):</span>
                <span className="font-mono text-rose-500">-{formatCurrency(refundTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-default pt-2 border-t border-default/50 text-sm">
              <span>Expected Cash in Drawer Right Now:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-default px-6 py-4 bg-surface-sunken">
          <div className="text-[11px] text-muted flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>X-Report does not close the cashier register session.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSlip}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-raised cursor-pointer transition-colors"
            >
              <Printer className="size-3.5 text-primary" />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-fg hover:opacity-90 cursor-pointer transition-opacity"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
