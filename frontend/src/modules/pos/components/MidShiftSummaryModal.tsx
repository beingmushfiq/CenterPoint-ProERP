import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Receipt,
  RefreshCw,
} from 'lucide-react';
import type { PosSession } from '../../../types/api/pos';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { useDocumentPrint } from '../../../components/print/useDocumentPrint';
import { useBusinessConfig, type BusinessConfig } from '../../../lib/document/useBusinessConfig';

export interface XReportThermalSlipProps {
  curr: PosSession;
  businessConfig: BusinessConfig;
  openingFloat: number;
  expectedCash: number;
  cashSalesCollected: number;
  cardTotal: number;
  mobileTotal: number;
  creditTotal: number;
  refundTotal: number;
  salesCount: number;
  grossRevenue: number;
  netRevenue: number;
  averageBasket: number;
  tenderPercentages: { cash: number; card: number; mobile: number; credit: number };
  currencySymbol: string;
  isPrintOnly?: boolean;
}

export function XReportThermalSlip({
  curr,
  businessConfig,
  openingFloat,
  expectedCash,
  cashSalesCollected,
  cardTotal,
  mobileTotal,
  creditTotal,
  refundTotal,
  salesCount,
  grossRevenue,
  netRevenue,
  averageBasket,
  tenderPercentages,
  currencySymbol,
  isPrintOnly = false,
}: XReportThermalSlipProps) {
  return (
    <div
      id="pos-x-report-thermal-slip"
      className={`font-mono text-[11px] leading-tight text-zinc-950 space-y-3 ${
        isPrintOnly ? 'w-[74mm] mx-auto bg-white p-2' : 'w-full'
      }`}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      }}
    >
      {/* Store Header */}
      <div className="text-center space-y-0.5 border-b border-dashed border-zinc-400 pb-2">
        <div className="text-sm font-black tracking-tight uppercase">
          {businessConfig.name || 'SLICEMART INDUSTRIES'}
        </div>
        {businessConfig.tagline && (
          <div className="text-[9px] text-zinc-600">{businessConfig.tagline}</div>
        )}
        <div className="text-[10px] font-semibold">
          {curr.branch_name ?? businessConfig.address ?? 'Main Outlet'}
        </div>
        <div className="text-xs font-extrabold uppercase pt-1 tracking-wider">
          MID-SHIFT SUMMARY (X-REPORT)
        </div>
        <div className="text-[9px] text-zinc-600 font-bold">
          *** NON-CLOSING REPORT ***
        </div>
      </div>

      {/* Session Meta */}
      <div className="space-y-0.5 text-[10px] border-b border-dashed border-zinc-300 pb-2">
        <div className="flex justify-between">
          <span className="text-zinc-600">SESSION #:</span>
          <span className="font-bold">{curr.session_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">TERMINAL:</span>
          <span>{curr.terminal_name ?? 'POS Terminal'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">CASHIER:</span>
          <span className="font-bold">{curr.operator_name ?? 'Cashier'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">OPENED:</span>
          <span>
            {curr.opened_at
              ? new Date(curr.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
              : 'Today'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">PRINTED:</span>
          <span>{new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2">
        <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-700">1. SALES PERFORMANCE</div>
        <div className="flex justify-between">
          <span>Transaction Count:</span>
          <span className="font-bold">{salesCount} Tickets</span>
        </div>
        <div className="flex justify-between">
          <span>Gross Sales:</span>
          <span className="font-bold">{currencySymbol}{grossRevenue.toFixed(2)}</span>
        </div>
        {refundTotal > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>Refunds / Returns:</span>
            <span>-{currencySymbol}{refundTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-zinc-200 pt-0.5">
          <span>Net Billed Revenue:</span>
          <span>{currencySymbol}{netRevenue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>Average Ticket Basket:</span>
          <span>{currencySymbol}{averageBasket.toFixed(2)}</span>
        </div>
      </div>

      {/* Tender Settlement Breakdown */}
      <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2">
        <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-700">2. TENDER BREAKDOWN</div>
        <div className="flex justify-between">
          <span>Cash Sales:</span>
          <span className="font-bold">{currencySymbol}{cashSalesCollected.toFixed(2)} ({tenderPercentages.cash}%)</span>
        </div>
        <div className="flex justify-between">
          <span>Card (POS):</span>
          <span>{currencySymbol}{cardTotal.toFixed(2)} ({tenderPercentages.card}%)</span>
        </div>
        <div className="flex justify-between">
          <span>bKash / Nagad:</span>
          <span>{currencySymbol}{mobileTotal.toFixed(2)} ({tenderPercentages.mobile}%)</span>
        </div>
        <div className="flex justify-between">
          <span>Credit / Due:</span>
          <span>{currencySymbol}{creditTotal.toFixed(2)} ({tenderPercentages.credit}%)</span>
        </div>
      </div>

      {/* Drawer Reconciliation */}
      <div className="space-y-1 border-b border-dashed border-zinc-400 pb-2">
        <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-700">3. DRAWER CASH STATUS</div>
        <div className="flex justify-between text-zinc-700">
          <span>Opening Float:</span>
          <span>{currencySymbol}{openingFloat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-700">
          <span>+ Cash Inflow:</span>
          <span>+{currencySymbol}{cashSalesCollected.toFixed(2)}</span>
        </div>
        {refundTotal > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>- Cash Refunds:</span>
            <span>-{currencySymbol}{refundTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-zinc-300">
          <span>EXPECTED IN DRAWER:</span>
          <span>{currencySymbol}{expectedCash.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer Disclaimers & Signatures */}
      <div className="space-y-3 pt-1 text-center">
        <p className="text-[9px] text-zinc-600 leading-tight">
          This X-Report is an informational snapshot.<br />
          Session remains active and open for transactions.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-4 text-[9px] text-zinc-700">
          <div>
            <div className="border-b border-zinc-400 mb-1" />
            <span>Cashier Signature</span>
          </div>
          <div>
            <div className="border-b border-zinc-400 mb-1" />
            <span>Supervisor Sign</span>
          </div>
        </div>

        <div className="text-[8px] text-zinc-400 pt-1 tracking-wider uppercase">
          {businessConfig.name || 'SLICE-POS'} &bull; X-REPORT SUMMARY
        </div>
      </div>
    </div>
  );
}

interface MidShiftSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PosSession;
}

export function MidShiftSummaryModal({ isOpen, onClose, session }: MidShiftSummaryModalProps) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const { config: businessConfig } = useBusinessConfig();
  const { printDocument, isPrinting } = useDocumentPrint();
  const [viewMode, setViewMode] = useState<'dashboard' | 'thermal'>('dashboard');

  // Live session query: fetches live up-to-the-second sales & drawer stats from backend
  const {
    data: liveSession,
    isFetching,
    refetch,
  } = useQuery<PosSession>({
    queryKey: ['pos', 'sessions', session.id, 'mid-shift'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PosSession } | PosSession>(`/pos/sessions/${session.id}`);
        const raw = res.data;
        return 'data' in raw && raw.data ? raw.data : (raw as PosSession);
      } catch (err) {
        console.warn('Live session query fallback to initial session', err);
        return session;
      }
    },
    initialData: session,
    enabled: isOpen && !!session.id,
    refetchInterval: isOpen ? 5000 : false,
  });

  const curr = liveSession ?? session;

  // Real-time Metrics calculations
  const openingFloat = parseFloat(curr.opening_cash || '0');
  const expectedCash = parseFloat(curr.expected_cash || '0');
  const cardTotal = parseFloat(curr.card_total || '0');
  const mobileTotal = parseFloat(curr.mobile_total || '0');
  const creditTotal = parseFloat(curr.credit_total || '0');
  const refundTotal = parseFloat(curr.refund_total || '0');
  const salesCount = curr.sales_count || 0;

  // Cash collected from actual customer sales (excluding opening base float)
  const cashSalesCollected = Math.max(0, expectedCash - openingFloat + refundTotal);
  const grossRevenue = cashSalesCollected + cardTotal + mobileTotal + creditTotal;
  const netRevenue = Math.max(0, grossRevenue - refundTotal);
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
    if (!curr.opened_at) return 'N/A';
    try {
      const opened = new Date(curr.opened_at);
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - opened.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m elapsed`;
    } catch {
      return 'In progress';
    }
  }, [curr.opened_at]);

  const handlePrintSlip = () => {
    printDocument(
      <XReportThermalSlip
        curr={curr}
        businessConfig={businessConfig}
        openingFloat={openingFloat}
        expectedCash={expectedCash}
        cashSalesCollected={cashSalesCollected}
        cardTotal={cardTotal}
        mobileTotal={mobileTotal}
        creditTotal={creditTotal}
        refundTotal={refundTotal}
        salesCount={salesCount}
        grossRevenue={grossRevenue}
        netRevenue={netRevenue}
        averageBasket={averageBasket}
        tenderPercentages={tenderPercentages}
        currencySymbol={currencySymbol}
        isPrintOnly={true}
      />,
      {
        pageClass: 'print-page-thermal-80',
        documentTitle: `X-Report-${curr.session_number}`,
      }
    );
  };

  // Keyboard shortcut Ctrl+P / Cmd+P while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrintSlip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, curr, businessConfig, openingFloat, expectedCash, cashSalesCollected, cardTotal, mobileTotal, creditTotal, refundTotal, salesCount, grossRevenue, netRevenue, averageBasket, tenderPercentages, currencySymbol]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                  Live Sync
                </span>
                {isFetching && <RefreshCw className="size-3 text-muted animate-spin" />}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {curr.session_number} &bull; {curr.terminal_name ?? 'POS Terminal'} &bull; {curr.branch_name ?? 'Main Outlet'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-surface p-0.5 rounded-xl border border-default">
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'dashboard'
                    ? 'bg-primary text-white shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'thermal'
                    ? 'bg-primary text-white shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                }`}
              >
                <Receipt className="size-3" />
                <span>Thermal Slip</span>
              </button>
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
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {viewMode === 'dashboard' ? (
            <div className="space-y-5">
              {/* Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-surface-sunken border border-default text-xs">
                <div>
                  <span className="text-[10px] text-muted uppercase font-semibold block">Cashier / Rep</span>
                  <span className="font-semibold text-default truncate block">{curr.operator_name ?? 'Cashier'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase font-semibold block">Opened At</span>
                  <span className="font-mono text-default block">
                    {curr.opened_at ? new Date(curr.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase font-semibold block">Shift Duration</span>
                  <span className="font-medium text-primary block flex items-center gap-1">
                    <Clock className="size-3" /> {shiftDuration}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase font-semibold block">Total Transactions</span>
                  <span className="font-bold text-default block font-mono">{salesCount} Orders</span>
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
                  <div className="text-[10px] text-muted mt-0.5">{salesCount} tickets</div>
                </div>

                <div className="rounded-xl border border-default bg-surface-sunken p-3">
                  <div className="flex items-center justify-between text-muted mb-1">
                    <span className="text-[10px] font-semibold uppercase">Drawer Cash</span>
                    <DollarSign className="size-3.5 text-emerald-500" />
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(expectedCash)}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">Float + Cash Sales</div>
                </div>

                <div className="rounded-xl border border-default bg-surface-sunken p-3">
                  <div className="flex items-center justify-between text-muted mb-1">
                    <span className="text-[10px] font-semibold uppercase">Avg Ticket</span>
                    <ShoppingBag className="size-3.5 text-blue-500" />
                  </div>
                  <div className="text-lg font-bold font-mono text-default">
                    {formatCurrency(averageBasket)}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">Per customer</div>
                </div>

                <div className="rounded-xl border border-default bg-surface-sunken p-3">
                  <div className="flex items-center justify-between text-muted mb-1">
                    <span className="text-[10px] font-semibold uppercase">Returns / Refunds</span>
                    <RotateCcw className="size-3.5 text-rose-500" />
                  </div>
                  <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(refundTotal)}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{refundTotal > 0 ? 'Processed' : 'Zero refunds'}</div>
                </div>
              </div>

              {/* Tender Breakdown Card */}
              <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
                <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center justify-between">
                  <span>Tender Settlement Breakdown</span>
                  <span className="text-[11px] text-muted font-normal font-mono">Gross: {formatCurrency(grossRevenue)}</span>
                </h4>

                {/* Split Progress Bar */}
                <div className="h-2.5 w-full rounded-full bg-surface-sunken overflow-hidden flex">
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
                      <span className="font-medium text-default">Cash Sales Inflow</span>
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
                      <span className="font-medium text-default">Customer Credit / Due Account</span>
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
                  Cash Drawer Reconciliation Formula
                </span>
                <div className="flex justify-between text-muted">
                  <span>Opening Float (Base Cash at start):</span>
                  <span className="font-mono">{formatCurrency(openingFloat)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>+ Cash Inflow from Sales:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(cashSalesCollected)}</span>
                </div>
                {refundTotal > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>- Cash Paid Out (Refunds / Returns):</span>
                    <span className="font-mono text-rose-500">-{formatCurrency(refundTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-default pt-2 border-t border-default/50 text-sm">
                  <span>Expected Physical Cash in Drawer:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(expectedCash)}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Thermal Slip Preview View */
            <div className="flex flex-col items-center">
              <div className="mb-3 text-center">
                <span className="text-xs font-semibold text-muted">
                  Thermal Receipt Printer Preview (80mm / Standard POS Roll)
                </span>
              </div>

              {/* Dedicated Printable Thermal Receipt Slip */}
              <div className="w-full max-w-[340px] bg-white text-zinc-950 p-5 border border-zinc-200 shadow-md rounded-xl">
                <XReportThermalSlip
                  curr={curr}
                  businessConfig={businessConfig}
                  openingFloat={openingFloat}
                  expectedCash={expectedCash}
                  cashSalesCollected={cashSalesCollected}
                  cardTotal={cardTotal}
                  mobileTotal={mobileTotal}
                  creditTotal={creditTotal}
                  refundTotal={refundTotal}
                  salesCount={salesCount}
                  grossRevenue={grossRevenue}
                  netRevenue={netRevenue}
                  averageBasket={averageBasket}
                  tenderPercentages={tenderPercentages}
                  currencySymbol={currencySymbol}
                  isPrintOnly={false}
                />
              </div>
            </div>
          )}
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
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-default transition-colors cursor-pointer"
              title="Refresh live session figures"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Sync Now</span>
            </button>
            <button
              type="button"
              onClick={handlePrintSlip}
              disabled={isPrinting}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-raised cursor-pointer transition-colors shadow-2xs disabled:opacity-60"
            >
              <Printer className={`size-3.5 ${isPrinting ? 'animate-bounce text-primary' : 'text-primary'}`} />
              <span>{isPrinting ? 'Preparing Slip...' : 'Print Slip'}</span>
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
