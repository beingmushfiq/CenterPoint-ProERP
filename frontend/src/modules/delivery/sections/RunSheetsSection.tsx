import React, { useState, useRef, useEffect } from 'react';
import type { RunSheet } from '../../../types/api/delivery';
import type { DeliveryOrder } from '../../../types/api/sales';
import { useCurrency } from '../../../hooks/useCurrency';
import { useAuthStore } from '../../../lib/auth/authStore';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { RiderRunSheetChallanDocument } from '../../../components/print/documents/RiderRunSheetChallanDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ChevronDown, Printer, CheckCircle2, Plus, Bike, X, Trash2 } from 'lucide-react';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { cn } from '../../../lib/utils';

interface RunSheetsSectionProps {
  runSheets: RunSheet[];
  pendingDeliveries: DeliveryOrder[];
  riders: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  onCreateRunSheet: (data: {
    branch_id: number;
    rider_id?: number;
    run_date: string;
    delivery_order_ids: number[];
  }) => Promise<void>;
  onCompleteRunSheet: (
    runSheetId: number,
    deliveries: { delivery_order_id: number; status: string; cod_collected: string }[]
  ) => Promise<void>;
  onDeleteRunSheet?: (runSheetId: number) => Promise<void>;
  onBulkDeleteRunSheets?: (runSheetIds: number[]) => Promise<void>;
}

export const RunSheetsSection: React.FC<RunSheetsSectionProps> = ({
  runSheets,
  pendingDeliveries,
  riders,
  branches,
  onCreateRunSheet,
  onCompleteRunSheet,
  onDeleteRunSheet,
  onBulkDeleteRunSheets,
}) => {
  const { formatCurrency } = useCurrency();
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('logistics.run_sheet.delete');

  const { config: businessConfig } = useBusinessConfig();
  const [selectedRunSheetForChallan, setSelectedRunSheetForChallan] = useState<RunSheet | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(branches[0]?.id || 1);
  const [selectedRiderId, setSelectedRiderId] = useState<number>(0);
  const [runDate, setRunDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] ?? ''
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Selection & Delete Confirmation State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    isBulk: boolean;
    id?: number;
    title?: string;
  }>({ open: false, isBulk: false });
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllSelected = runSheets.length > 0 && selectedIds.size === runSheets.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runSheets.map((rs) => rs.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOrderSelection = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload: {
        branch_id: number;
        rider_id?: number;
        run_date: string;
        delivery_order_ids: number[];
      } = {
        branch_id: selectedBranchId,
        run_date: runDate,
        delivery_order_ids: selectedOrderIds,
      };
      if (selectedRiderId > 0) {
        payload.rider_id = selectedRiderId;
      }
      await onCreateRunSheet(payload);
      setIsCreateModalOpen(false);
      setSelectedOrderIds([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSheet = async (runSheet: RunSheet) => {
    setIsSubmitting(true);
    try {
      await onCompleteRunSheet(runSheet.id, []);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-surface-sunken text-muted border-default',
      dispatched: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
      in_progress: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
      completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      reconciled: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
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
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-default font-sans flex items-center gap-2">
            <Bike className="size-5 text-primary" />
            <span>Rider Delivery Run Sheets</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Dispatch multi-stop delivery challans to in-house delivery fleet and reconcile rider COD.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>Create Run Sheet</span>
        </button>
      </div>

      {/* Bulk Actions Toolbar */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-2xl animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {selectedIds.size} Run Sheet{selectedIds.size > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  open: true,
                  isBulk: true,
                  title: `${selectedIds.size} selected run sheets`,
                })
              }
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Move to Bin ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1 rounded-lg text-rose-700 hover:bg-rose-500/20 transition cursor-pointer text-xs font-medium"
              title="Clear selection (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Run Sheets Table */}
      <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl border border-default shadow-2xs">
        <table className="w-full text-left text-xs min-w-175">
          <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  aria-label="Select all run sheets"
                />
              </th>
              <th className="px-4 py-3">RUN SHEET #</th>
              <th className="px-4 py-3">BRANCH</th>
              <th className="px-4 py-3">ASSIGNED RIDER</th>
              <th className="px-4 py-3">DATE</th>
              <th className="px-4 py-3">STOPS (DONE/TOTAL)</th>
              <th className="px-4 py-3">COD EXPECTED</th>
              <th className="px-4 py-3">COD COLLECTED</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default text-default">
            {runSheets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted text-xs font-sans">
                  No rider run sheets created yet.
                </td>
              </tr>
            ) : (
              runSheets.map((rs) => (
                <tr
                  key={rs.id}
                  className={cn(
                    'hover:bg-surface-sunken/40 transition-colors',
                    selectedIds.has(rs.id) && 'bg-primary/5'
                  )}
                >
                  <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rs.id)}
                      onChange={() => toggleSelectOne(rs.id)}
                      className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      aria-label={`Select run sheet ${rs.run_sheet_number || rs.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">
                    {rs.run_sheet_number}
                  </td>
                  <td className="px-4 py-3">{rs.branch_name || 'Main Branch'}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-default">{rs.rider_name || 'Unassigned'}</span>
                  </td>
                  <td className="px-4 py-3 text-muted text-[11px]">{rs.run_date}</td>
                  <td className="px-4 py-3 font-mono">
                    {rs.completed_stops} / {rs.total_stops}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {formatCurrency(rs.total_cod_expected)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(rs.total_cod_collected)}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(rs.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedRunSheetForChallan(rs)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer shadow-2xs"
                        title="Print Delivery Challan"
                      >
                        Challan
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openActionMenuId === rs.id) {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                          } else {
                            setOpenActionMenuId(rs.id);
                            setActionMenuAnchor(e.currentTarget);
                          }
                        }}
                        className="p-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-colors cursor-pointer shadow-2xs"
                        aria-label="More actions"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Action Menu Portal */}
        {openActionMenuId !== null && actionMenuAnchor && (
          <ActionMenuPortal
            anchorEl={actionMenuAnchor}
            open={true}
            onClose={() => {
              setOpenActionMenuId(null);
              setActionMenuAnchor(null);
            }}
          >
            {(() => {
              const item = runSheets.find((rs) => rs.id === openActionMenuId);
              if (!item) return null;
              return (
                <div className="min-w-44 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRunSheetForChallan(item);
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Print Challan</span>
                  </button>
                  {item.status !== 'completed' && item.status !== 'reconciled' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleCompleteSheet(item);
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Complete & Reconcile</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          open: true,
                          isBulk: false,
                          id: item.id,
                          title: `Run Sheet ${item.run_sheet_number || '#' + item.id}`,
                        });
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Move to Bin</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </ActionMenuPortal>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, isBulk: false })}
        onConfirm={async () => {
          if (deleteConfirm.isBulk) {
            await onBulkDeleteRunSheets?.(Array.from(selectedIds));
            setSelectedIds(new Set());
          } else if (deleteConfirm.id) {
            await onDeleteRunSheet?.(deleteConfirm.id);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(deleteConfirm.id!);
              return next;
            });
          }
          setDeleteConfirm({ open: false, isBulk: false });
        }}
        title="Move to Data Bin"
        message={`Are you sure you want to move ${deleteConfirm.title || 'this run sheet'} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        variant="danger"
      />

      {/* Create Run Sheet Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface-raised p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">
                Create Fleet Dispatch Run Sheet
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSheet} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5">
                    Dispatch Branch
                  </label>
                  <SelectDropdown
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    value={selectedBranchId}
                    onChange={(val) => setSelectedBranchId(Number(val))}
                    size="md"
                    buttonClassName="w-full"
                    aria-label="Select dispatch branch"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5">
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    value={runDate}
                    onChange={(e) => setRunDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5">
                    Assign Rider
                  </label>
                  <SelectDropdown
                    options={[
                      { value: 0, label: 'Unassigned (Self-pickup / TBD)' },
                      ...riders.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                    value={selectedRiderId}
                    onChange={(val) => setSelectedRiderId(Number(val))}
                    size="md"
                    buttonClassName="w-full"
                    aria-label="Assign rider"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Select Delivery Orders to Batch ({selectedOrderIds.length} selected)
                </label>
                <div className="max-h-56 overflow-y-auto border border-default rounded-xl p-2 flex flex-col gap-1.5 bg-surface-sunken/30">
                  {pendingDeliveries.length === 0 ? (
                    <div className="p-4 text-center text-muted text-xs font-sans">
                      No pending delivery orders available.
                    </div>
                  ) : (
                    pendingDeliveries.map((d) => {
                      const isChecked = selectedOrderIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={cn(
                            'flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer text-xs',
                            isChecked
                              ? 'bg-primary/10 border-primary/30 text-default'
                              : 'bg-surface border-default/70 hover:border-default text-default'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrderSelection(d.id)}
                            className="size-4 rounded border-default text-primary focus:ring-primary/20"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-default truncate">
                              {d.delivery_number} — {d.recipient_name}
                            </div>
                            <div className="text-[11px] text-muted font-mono">
                              {d.recipient_phone}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-primary shrink-0">
                            {formatCurrency(d.cod_amount)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedOrderIds.length === 0}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Creating...'
                    : `Create Run Sheet (${selectedOrderIds.length} orders)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rider Delivery Challan Print Modal */}
      {selectedRunSheetForChallan && (
        <PrintPreviewModal
          isOpen={Boolean(selectedRunSheetForChallan)}
          onClose={() => setSelectedRunSheetForChallan(null)}
          title={`Delivery Challan - ${selectedRunSheetForChallan.run_sheet_number}`}
          documentNumber={selectedRunSheetForChallan.run_sheet_number}
          documentType="Rider Delivery Run Sheet Challan"
        >
          <RiderRunSheetChallanDocument
            runSheet={selectedRunSheetForChallan}
            businessConfig={businessConfig}
          />
        </PrintPreviewModal>
      )}
    </div>
  );
};
