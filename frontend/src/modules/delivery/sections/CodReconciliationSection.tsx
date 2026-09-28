import React, { useState } from 'react';
import type { CodReconciliation, RunSheet, CourierProvider } from '../../../types/api/delivery';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ChevronDown, Eye, FileText, Banknote, Plus, X } from 'lucide-react';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface CodReconciliationSectionProps {
  reconciliations: CodReconciliation[];
  completedRunSheets: RunSheet[];
  providers: CourierProvider[];
  onCreateReconciliation: (data: {
    source_type: 'run_sheet' | 'courier_provider';
    source_id: number;
    expected_amount: string;
    received_amount: string;
    notes?: string;
  }) => Promise<void>;
}

export const CodReconciliationSection: React.FC<CodReconciliationSectionProps> = ({
  reconciliations,
  completedRunSheets,
  providers,
  onCreateReconciliation,
}) => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'run_sheet' | 'courier_provider'>('run_sheet');
  const [sourceId, setSourceId] = useState<number>(0);
  const [expectedAmount, setExpectedAmount] = useState<string>('0.00');
  const [receivedAmount, setReceivedAmount] = useState<string>('0.00');
  const [courierFee, setCourierFee] = useState<string>('0.00');
  const [codFee, setCodFee] = useState<string>('0.00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeItemForDetails, setActiveItemForDetails] = useState<CodReconciliation | null>(null);

  const handleSourceSelect = (type: 'run_sheet' | 'courier_provider', id: number) => {
    setSourceType(type);
    setSourceId(id);
    if (type === 'run_sheet') {
      const sheet = completedRunSheets.find((s) => s.id === id);
      if (sheet) {
        setExpectedAmount(Number(sheet.total_cod_collected || sheet.total_cod_expected).toFixed(2));
        setReceivedAmount(Number(sheet.total_cod_collected || sheet.total_cod_expected).toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId) return;
    setIsSubmitting(true);
    try {
      const deductionNotes =
        Number(courierFee) > 0 || Number(codFee) > 0
          ? ` [Courier Fee: ${formatCurrency(courierFee)}, COD Fee: ${formatCurrency(codFee)}, Net: ${formatCurrency(
              Math.max(0, Number(receivedAmount) - Number(courierFee) - Number(codFee))
            )}]`
          : '';

      await onCreateReconciliation({
        source_type: sourceType,
        source_id: sourceId,
        expected_amount: expectedAmount,
        received_amount: receivedAmount,
        notes: (notes + deductionNotes).trim(),
      });
      setIsModalOpen(false);
      setSourceId(0);
      setCourierFee('0.00');
      setCodFee('0.00');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      reconciled: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      disputed: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
      draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
    const badgeClass = map[status] || 'bg-surface-sunken text-muted border-default';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
          badgeClass
        )}
      >
        <span className="size-1 rounded-full bg-current" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-default font-sans flex items-center gap-2">
            <Banknote className="size-5 text-primary" />
            <span>Cash On Delivery (COD) Reconciliation</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Audit rider cash collections and 3PL courier bank remittances against expected delivery totals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>Reconcile Cash</span>
        </button>
      </div>

      {/* Reconciliation KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-surface border border-default shadow-2xs">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
            Total Expected COD
          </span>
          <span className="text-base font-mono font-bold text-default mt-0.5 block">
            {formatCurrency(
              reconciliations.reduce((s, r) => s + (parseFloat(r.expected_amount) || 0), 0)
            )}
          </span>
          <span className="text-[10px] text-muted">{reconciliations.length} settlement cycles</span>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-default shadow-2xs">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
            Total Received & Remitted
          </span>
          <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {formatCurrency(
              reconciliations.reduce((s, r) => s + (parseFloat(r.received_amount) || 0), 0)
            )}
          </span>
          <span className="text-[10px] text-emerald-600">Settled to company accounts</span>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-default shadow-2xs">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
            Net Settlement Variance
          </span>
          {(() => {
            const netVar = reconciliations.reduce((s, r) => s + (parseFloat(r.variance_amount) || 0), 0);
            return (
              <>
                <span
                  className={cn(
                    'text-base font-mono font-bold mt-0.5 block',
                    netVar === 0 ? 'text-emerald-600' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {netVar > 0 ? '+' : ''}
                  {formatCurrency(netVar)}
                </span>
                <span className="text-[10px] text-muted">Over / (Shortage) delta</span>
              </>
            );
          })()}
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-default shadow-2xs">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
            Disputed Settlements
          </span>
          <span className="text-base font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
            {reconciliations.filter((r) => r.status === 'disputed').length} Records
          </span>
          <span className="text-[10px] text-amber-600">Pending courier clarification</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl border border-default shadow-2xs">
        <table className="w-full text-left text-xs min-w-187.5">
          <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
            <tr>
              <th className="px-4 py-3">RECONCILIATION #</th>
              <th className="px-4 py-3">SOURCE CHANNEL</th>
              <th className="px-4 py-3">EXPECTED COD</th>
              <th className="px-4 py-3">RECEIVED AMOUNT</th>
              <th className="px-4 py-3">VARIANCE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">RECONCILED DATE</th>
              <th className="px-4 py-3">AUDITOR</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default text-default">
            {reconciliations.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted text-xs font-sans">
                  No COD reconciliation records found.
                </td>
              </tr>
            ) : (
              reconciliations.map((r) => (
                <tr key={r.id} className="hover:bg-surface-sunken/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-primary">
                    {r.reconciliation_number}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-default capitalize">
                      {r.source_type.replace(/_/g, ' ')} #{r.source_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">
                    {formatCurrency(r.expected_amount)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(r.received_amount)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    <span
                      className={
                        Number(r.variance_amount) === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {Number(r.variance_amount) > 0 ? '+' : ''}
                      {Number(r.variance_amount).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-muted text-[11px]">
                    {r.reconciled_at ? new Date(r.reconciled_at).toLocaleDateString() : 'Pending'}
                  </td>
                  <td className="px-4 py-3 text-muted text-[11px]">
                    {r.reconciled_by_name || 'System Auto'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveItemForDetails(r)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer shadow-2xs"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openActionMenuId === r.id) {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                          } else {
                            setOpenActionMenuId(r.id);
                            setActionMenuAnchor(e.currentTarget);
                          }
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 p-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer shadow-2xs',
                          openActionMenuId === r.id
                            ? 'bg-primary text-primary-fg border-primary shadow-xs'
                            : 'bg-surface hover:bg-surface-sunken border-default text-default'
                        )}
                        aria-label="Actions"
                      >
                        <ChevronDown className="size-3.5 text-muted" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Floating Action Menu via ActionMenuPortal */}
        {openActionMenuId !== null && actionMenuAnchor !== null && (
          <ActionMenuPortal
            anchorEl={actionMenuAnchor}
            open={true}
            onClose={() => {
              setOpenActionMenuId(null);
              setActionMenuAnchor(null);
            }}
          >
            {(() => {
              const activeItem = reconciliations.find((r) => r.id === openActionMenuId);
              if (!activeItem) return null;
              return (
                <div className="min-w-44 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setActiveItemForDetails(activeItem);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                  >
                    <Eye className="size-3.5 text-primary" />
                    <span>View Audit Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      navigator.clipboard?.writeText(activeItem.reconciliation_number);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                  >
                    <FileText className="size-3.5 text-emerald-600" />
                    <span>Copy Rec Reference</span>
                  </button>
                </div>
              );
            })()}
          </ActionMenuPortal>
        )}
      </div>

      {/* Details Modal */}
      {activeItemForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface-raised p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <div>
                <h3 className="text-base font-bold text-default">
                  {activeItemForDetails.reconciliation_number}
                </h3>
                <p className="text-xs text-muted">
                  Source: {activeItemForDetails.source_type} #{activeItemForDetails.source_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(activeItemForDetails.status)}
                <button
                  type="button"
                  onClick={() => setActiveItemForDetails(null)}
                  className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-default">
              <div className="flex justify-between py-1.5 border-b border-default">
                <span className="text-muted">Expected COD:</span>
                <span className="font-mono font-bold text-default">
                  {formatCurrency(activeItemForDetails.expected_amount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-default">
                <span className="text-muted">Received Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(activeItemForDetails.received_amount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-default">
                <span className="text-muted">Variance:</span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    Number(activeItemForDetails.variance_amount) === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {Number(activeItemForDetails.variance_amount) > 0 ? '+' : ''}
                  {Number(activeItemForDetails.variance_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-default">
                <span className="text-muted">Audited By:</span>
                <span className="text-default font-medium">
                  {activeItemForDetails.reconciled_by_name || 'System Auto'}
                </span>
              </div>
              {activeItemForDetails.notes && (
                <div className="pt-2">
                  <span className="text-muted block mb-1">Notes:</span>
                  <p className="p-3 bg-surface-sunken rounded-xl text-default border border-default text-xs leading-relaxed">
                    {activeItemForDetails.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-default flex justify-end">
              <button
                type="button"
                onClick={() => setActiveItemForDetails(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-raised p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">
                New Cash on Delivery Reconciliation
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Reconciliation Source
                </label>
                <div className="flex items-center gap-4 mb-2.5">
                  <label className="flex items-center gap-2 text-xs font-medium text-default cursor-pointer">
                    <input
                      type="radio"
                      name="sourceType"
                      checked={sourceType === 'run_sheet'}
                      onChange={() => {
                        setSourceType('run_sheet');
                        setSourceId(0);
                      }}
                      className="size-4 text-primary focus:ring-primary/20"
                    />
                    <span>Rider Run Sheet</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-default cursor-pointer">
                    <input
                      type="radio"
                      name="sourceType"
                      checked={sourceType === 'courier_provider'}
                      onChange={() => {
                        setSourceType('courier_provider');
                        setSourceId(0);
                      }}
                      className="size-4 text-primary focus:ring-primary/20"
                    />
                    <span>3PL Courier Partner</span>
                  </label>
                </div>

                <SelectDropdown
                  options={[
                    { value: 0, label: '-- Select Source Record --' },
                    ...(sourceType === 'run_sheet'
                      ? completedRunSheets.map((s) => ({
                          value: s.id,
                          label: `${s.run_sheet_number} (${s.rider_name || 'Rider'}) — ${formatCurrency(s.total_cod_collected)}`,
                        }))
                      : providers.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))),
                  ]}
                  value={sourceId}
                  onChange={(val) => handleSourceSelect(sourceType, Number(val))}
                  size="md"
                  buttonClassName="w-full"
                  aria-label="Select source record"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5">
                    Expected Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5">
                    Actual Cash Received ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* 3PL Courier Deductions Breakdown */}
              {sourceType === 'courier_provider' && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default space-y-2.5">
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center justify-between">
                    <span>Courier Deductions & Net Bank Remittance</span>
                    <span className="font-mono text-primary font-bold">
                      Net: {formatCurrency(Math.max(0, Number(receivedAmount) - Number(courierFee) - Number(codFee)))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-muted uppercase mb-1">
                        Shipping Fee ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={courierFee}
                        onChange={(e) => setCourierFee(e.target.value)}
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted uppercase mb-1">
                        COD Fee % ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={codFee}
                        onChange={(e) => setCodFee(e.target.value)}
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Auditor Notes / Variance Reason
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes on shortage, bank deposit reference, etc."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !sourceId}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Post Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
