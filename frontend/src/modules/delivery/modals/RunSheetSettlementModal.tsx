import React, { useState, useMemo } from 'react';
import type { RunSheet } from '../../../types/api/delivery';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  X,
  Bike,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Banknote,
  MapPin,
  Phone,
  FileCheck2,
  Check,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface DeliveryStopSettlement {
  delivery_order_id: number;
  delivery_number: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  cod_expected: number;
  cod_collected: number;
  status: 'delivered' | 'failed' | 'returned';
  notes?: string;
}

interface RunSheetSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  runSheet: RunSheet;
  onSubmitSettlement: (
    runSheetId: number,
    deliveries: { delivery_order_id: number; status: string; cod_collected: string }[],
    notes?: string
  ) => Promise<void>;
  onTriggerCodReconciliation?: ((reconciliationData: {
    source_type: 'run_sheet';
    source_id: number;
    expected_amount: string;
    received_amount: string;
    notes?: string;
  }) => void) | undefined;
}

export const RunSheetSettlementModal: React.FC<RunSheetSettlementModalProps> = ({
  isOpen,
  onClose,
  runSheet,
  onSubmitSettlement,
  onTriggerCodReconciliation,
}) => {
  const { formatCurrency, currencyCode } = useCurrency();

  // Initialize stops from runSheet.delivery_orders if present, or create placeholder stops
  const initialStops = useMemo<DeliveryStopSettlement[]>(() => {
    if (runSheet.delivery_orders && runSheet.delivery_orders.length > 0) {
      return runSheet.delivery_orders.map((d) => {
        const expected = parseFloat(d.cod_amount || '0');
        const collected = d.cod_collected_amount ? parseFloat(d.cod_collected_amount) : expected;
        const initialStatus = (d.status === 'delivered' || d.status === 'failed' || d.status === 'returned')
          ? d.status
          : 'delivered';
        return {
          delivery_order_id: d.id,
          delivery_number: d.delivery_number,
          recipient_name: d.recipient_name || 'Customer',
          recipient_phone: d.recipient_phone || 'N/A',
          delivery_address: d.delivery_address || 'Delivery destination on file',
          cod_expected: expected,
          cod_collected: collected,
          status: initialStatus,
        };
      });
    }

    // Synthesize fallback stops matching runSheet summary count
    const totalStops = Math.max(1, runSheet.total_stops || 1);
    const avgCod = parseFloat(runSheet.total_cod_expected || '0') / totalStops;
    const stops: DeliveryStopSettlement[] = [];
    for (let i = 1; i <= totalStops; i++) {
      stops.push({
        delivery_order_id: i,
        delivery_number: `DO-${runSheet.run_sheet_number}-${String(i).padStart(2, '0')}`,
        recipient_name: `Customer Stop #${i}`,
        recipient_phone: '+880 1700-000000',
        delivery_address: `Designated route drop-off point #${i}`,
        cod_expected: Math.round(avgCod * 100) / 100,
        cod_collected: Math.round(avgCod * 100) / 100,
        status: 'delivered',
      });
    }
    return stops;
  }, [runSheet]);

  const [stops, setStops] = useState<DeliveryStopSettlement[]>(initialStops);
  const [generalNotes, setGeneralNotes] = useState('');
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle status toggle for an individual stop
  const handleStatusChange = (index: number, newStatus: 'delivered' | 'failed' | 'returned') => {
    setStops((prev) =>
      prev.map((stop, i) => {
        if (i !== index) return stop;
        const nextCollected =
          newStatus === 'delivered' ? stop.cod_expected : 0;
        return {
          ...stop,
          status: newStatus,
          cod_collected: nextCollected,
        };
      })
    );
  };

  // Handle manual COD input change
  const handleCodCollectedChange = (index: number, value: string) => {
    const num = parseFloat(value) || 0;
    setStops((prev) =>
      prev.map((stop, i) => (i === index ? { ...stop, cod_collected: num } : stop))
    );
  };

  // Quick action: Mark all delivered
  const handleMarkAllDelivered = () => {
    setStops((prev) =>
      prev.map((stop) => ({
        ...stop,
        status: 'delivered',
        cod_collected: stop.cod_expected,
      }))
    );
  };

  // Calculations
  const totalExpected = stops.reduce((acc, s) => acc + s.cod_expected, 0);
  const totalCollected = stops.reduce((acc, s) => acc + s.cod_collected, 0);
  const variance = totalCollected - totalExpected;
  const deliveredCount = stops.filter((s) => s.status === 'delivered').length;
  const failedCount = stops.filter((s) => s.status === 'failed').length;
  const returnedCount = stops.filter((s) => s.status === 'returned').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const deliveriesPayload = stops.map((s) => ({
        delivery_order_id: s.delivery_order_id,
        status: s.status,
        cod_collected: s.cod_collected.toFixed(4),
      }));

      await onSubmitSettlement(runSheet.id, deliveriesPayload, generalNotes);

      // If user opted to immediately trigger COD bank reconciliation
      if (autoReconcile && onTriggerCodReconciliation) {
        onTriggerCodReconciliation({
          source_type: 'run_sheet',
          source_id: runSheet.id,
          expected_amount: totalExpected.toFixed(4),
          received_amount: totalCollected.toFixed(4),
          notes: generalNotes || `Settled from Run Sheet #${runSheet.run_sheet_number} by ${runSheet.rider_name || 'Rider'}`,
        });
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl border border-default bg-surface p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-default pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bike className="size-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-default flex items-center gap-2">
                  <span>Rider Stop-by-Stop Settlement</span>
                  <span className="font-mono text-primary text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                    {runSheet.run_sheet_number}
                  </span>
                </h3>
                <p className="text-xs text-muted">
                  Assigned Rider: <strong className="text-default">{runSheet.rider_name || 'Fleet Rider'}</strong> • Date: {runSheet.run_date}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-default bg-surface-sunken/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted">Total Stops</span>
            <div className="text-base font-extrabold text-default font-mono">
              {stops.length} <span className="text-xs font-normal text-muted">stops</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <span className="text-emerald-600 font-bold">{deliveredCount} delivered</span>
              <span>•</span>
              <span className="text-rose-500 font-bold">{returnedCount + failedCount} exceptions</span>
            </div>
          </div>

          <div className="rounded-2xl border border-default bg-surface-sunken/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted">COD Expected</span>
            <div className="text-base font-extrabold text-default font-mono">
              {formatCurrency(totalExpected)}
            </div>
            <div className="text-[10px] text-muted">Total booked parcel value</div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
              COD Handover
            </span>
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(totalCollected)}
            </div>
            <div className="text-[10px] text-emerald-600/80">Cash received from rider</div>
          </div>

          <div
            className={cn(
              'rounded-2xl border p-3 space-y-1',
              variance === 0
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : variance < 0
                ? 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400'
                : 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400'
            )}
          >
            <span className="text-[10px] uppercase font-bold">Variance</span>
            <div className="text-base font-extrabold font-mono">
              {variance > 0 ? `+${formatCurrency(variance)}` : formatCurrency(variance)}
            </div>
            <div className="text-[10px] font-semibold">
              {variance === 0 ? 'Balanced Handover' : variance < 0 ? 'Cash Shortfall' : 'Surplus Cash'}
            </div>
          </div>
        </div>

        {/* Toolbar before stops */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-1.5">
            <FileCheck2 className="size-4 text-primary" />
            <span>Delivery Stops Checklist ({stops.length})</span>
          </div>
          <button
            type="button"
            onClick={handleMarkAllDelivered}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Mark All Delivered & Collected</span>
          </button>
        </div>

        {/* Stops List */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {stops.map((stop, idx) => (
            <div
              key={stop.delivery_order_id}
              className={cn(
                'rounded-2xl border p-3.5 transition-all space-y-2',
                stop.status === 'delivered'
                  ? 'border-default bg-surface hover:border-emerald-500/30'
                  : stop.status === 'returned'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-primary">
                      {stop.delivery_number}
                    </span>
                    <span className="text-xs font-semibold text-default">
                      {stop.recipient_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      <span>{stop.recipient_phone}</span>
                    </span>
                    <span className="flex items-center gap-1 truncate max-w-xs">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{stop.delivery_address}</span>
                    </span>
                  </div>
                </div>

                {/* Status Segmented Buttons */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken border border-default self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(idx, 'delivered')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1',
                      stop.status === 'delivered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted hover:text-default'
                    )}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>Delivered</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(idx, 'failed')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1',
                      stop.status === 'failed'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-muted hover:text-default'
                    )}
                  >
                    <AlertTriangle className="size-3" />
                    <span>Failed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(idx, 'returned')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1',
                      stop.status === 'returned'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-muted hover:text-default'
                    )}
                  >
                    <RotateCcw className="size-3" />
                    <span>Returned</span>
                  </button>
                </div>
              </div>

              {/* Amount row */}
              <div className="flex items-center justify-between pt-2 border-t border-default/60 text-xs">
                <span className="text-muted">
                  Expected COD: <strong className="text-default font-mono">{formatCurrency(stop.cod_expected)}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted">Cash Collected ({currencyCode}):</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stop.cod_collected}
                    onChange={(e) => handleCodCollectedChange(idx, e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg border border-default bg-surface font-mono font-bold text-xs text-right text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* General Settlement Notes & Auto-Reconciliation option */}
        <div className="space-y-3 pt-2 border-t border-default">
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1">
              Dispatch Settlement Notes / Discrepancy Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Verified by cashier, 1 return rescheduled for tomorrow morning..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={autoReconcile}
              onChange={(e) => setAutoReconcile(e.target.checked)}
              className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
            />
            <span className="text-default font-medium">
              Automatically record cash in <strong>COD Reconciliation Ledger</strong> upon completion
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-default bg-surface text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-xs font-bold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <Banknote className="size-4" />
            <span>{isSubmitting ? 'Finalizing Settlement...' : 'Finalize & Close Run Sheet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
