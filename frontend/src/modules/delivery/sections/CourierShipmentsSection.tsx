import React, { useState, useRef, useEffect } from 'react';
import type { CourierShipment, CourierProvider } from '../../../types/api/delivery';
import type { DeliveryOrder } from '../../../types/api/sales';
import { useCurrency } from '../../../hooks/useCurrency';
import { useAuthStore } from '../../../lib/auth/authStore';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ChevronDown, RefreshCw, Printer, XCircle, Plus, Search, Truck, X, Trash2 } from 'lucide-react';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { cn } from '../../../lib/utils';

interface CourierShipmentsSectionProps {
  shipments: CourierShipment[];
  providers: CourierProvider[];
  pendingDeliveries: DeliveryOrder[];
  onBookShipment: (deliveryOrderId: number, providerId: number, notes?: string) => Promise<void>;
  onTrackShipment: (shipmentId: number) => Promise<void>;
  onCancelShipment: (shipmentId: number, reason: string) => Promise<void>;
  onOpenLabel: (shipment: CourierShipment) => void;
  onDeleteShipment?: (shipmentId: number) => Promise<void>;
  onBulkDeleteShipments?: (shipmentIds: number[]) => Promise<void>;
}

export const CourierShipmentsSection: React.FC<CourierShipmentsSectionProps> = ({
  shipments,
  providers,
  pendingDeliveries,
  onBookShipment,
  onTrackShipment,
  onCancelShipment,
  onOpenLabel,
  onDeleteShipment,
  onBulkDeleteShipments,
}) => {
  const { formatCurrency } = useCurrency();
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('logistics.shipment.delete');

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number>(0);
  const [selectedProviderId, setSelectedProviderId] = useState<number>(0);
  const [bookNotes, setBookNotes] = useState('');
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

  const filteredShipments = shipments.filter((s) => {
    const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;
    const matchesProvider =
      selectedProvider === 'all' || s.courier_provider_id === Number(selectedProvider);
    const matchesSearch =
      (s.consignment_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (s.awb_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (s.delivery_number?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesStatus && matchesProvider && matchesSearch;
  });

  const isAllSelected = filteredShipments.length > 0 && selectedIds.size === filteredShipments.length;
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
      setSelectedIds(new Set(filteredShipments.map((s) => s.id)));
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

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
      confirmed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
      in_transit: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      out_for_delivery: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      delivered: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      failed: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
      cancelled: 'bg-surface-sunken text-muted border-default',
      returned: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
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

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryId || !selectedProviderId) return;
    setIsSubmitting(true);
    try {
      await onBookShipment(selectedDeliveryId, selectedProviderId, bookNotes);
      setIsBookModalOpen(false);
      setSelectedDeliveryId(0);
      setSelectedProviderId(0);
      setBookNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-default font-sans flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <span>Courier Consignments & Tracking</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Book 3PL parcel consignments (Pathao, Steadfast, RedX) and track live dispatch statuses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsBookModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>Book 3PL Shipment</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-surface p-3.5 rounded-2xl border border-default shadow-xs">
        <div className="relative flex-1 min-w-50">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search Consignment / AWB / Delivery #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3 py-1.5 text-xs font-medium text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <SelectDropdown
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'pending', label: 'Pending', colorDot: 'bg-amber-500' },
            { value: 'confirmed', label: 'Confirmed', colorDot: 'bg-blue-500' },
            { value: 'in_transit', label: 'In Transit', colorDot: 'bg-indigo-500' },
            { value: 'out_for_delivery', label: 'Out For Delivery', colorDot: 'bg-cyan-500' },
            { value: 'delivered', label: 'Delivered', colorDot: 'bg-emerald-500' },
            { value: 'failed', label: 'Failed', colorDot: 'bg-rose-500' },
            { value: 'returned', label: 'Returned', colorDot: 'bg-purple-500' },
            { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-slate-400' },
          ]}
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val)}
          size="sm"
          aria-label="Filter shipments by status"
        />
        <SelectDropdown
          options={[
            { value: 'all', label: 'All Providers' },
            ...providers.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
          value={selectedProvider}
          onChange={(val) => setSelectedProvider(val)}
          size="sm"
          aria-label="Filter shipments by provider"
        />
      </div>

      {/* Bulk Actions Toolbar */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-2xl animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {selectedIds.size} Shipment{selectedIds.size > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  open: true,
                  isBulk: true,
                  title: `${selectedIds.size} selected shipments`,
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

      {/* Shipments Table */}
      <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl border border-default shadow-2xs">
        <table className="w-full text-left text-xs min-w-162.5">
          <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  aria-label="Select all shipments"
                />
              </th>
              <th className="px-4 py-3">CONSIGNMENT / AWB</th>
              <th className="px-4 py-3">COURIER PARTNER</th>
              <th className="px-4 py-3">DELIVERY ORDER</th>
              <th className="px-4 py-3">COD AMOUNT</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">SYNCED AT</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default text-default">
            {filteredShipments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted text-xs font-sans">
                  No courier shipments found matching the active filters.
                </td>
              </tr>
            ) : (
              filteredShipments.map((s) => (
                <tr
                  key={s.id}
                  className={cn(
                    'hover:bg-surface-sunken/40 transition-colors',
                    selectedIds.has(s.id) && 'bg-primary/5'
                  )}
                >
                  <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelectOne(s.id)}
                      className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      aria-label={`Select shipment ${s.consignment_id || s.id}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">
                      {s.consignment_id || 'Generating...'}
                    </div>
                    {s.awb_number && (
                      <div className="text-[10px] font-mono text-muted">
                        AWB: {s.awb_number}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-default">
                      {s.provider_name || '3PL Partner'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">
                    {s.delivery_number || `#${s.delivery_order_id}`}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-default">
                    {formatCurrency(s.cod_amount)}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(s.status)}</td>
                  <td className="px-4 py-3 text-muted text-[11px]">
                    {s.last_synced_at
                      ? new Date(s.last_synced_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenLabel(s)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer shadow-2xs"
                        title="Print Courier Shipping Label"
                      >
                        Label
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openActionMenuId === s.id) {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                          } else {
                            setOpenActionMenuId(s.id);
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
              const item = shipments.find((s) => s.id === openActionMenuId);
              if (!item) return null;
              return (
                <div className="min-w-44 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onTrackShipment(item.id);
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <RefreshCw className="size-3.5 text-primary" />
                    <span>Sync Live Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLabel(item);
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Download Label</span>
                  </button>
                  {item.status !== 'cancelled' && item.status !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt('Reason for cancelling courier consignment:');
                        if (reason) {
                          onCancelShipment(item.id, reason);
                        }
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      <span>Cancel Consignment</span>
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
                          title: `Shipment ${item.consignment_id || '#' + item.id}`,
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
            await onBulkDeleteShipments?.(Array.from(selectedIds));
            setSelectedIds(new Set());
          } else if (deleteConfirm.id) {
            await onDeleteShipment?.(deleteConfirm.id);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(deleteConfirm.id!);
              return next;
            });
          }
          setDeleteConfirm({ open: false, isBulk: false });
        }}
        title="Move to Data Bin"
        message={`Are you sure you want to move ${deleteConfirm.title || 'this shipment'} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        variant="danger"
      />

      {/* Book Shipment Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-raised p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">
                Book 3PL Courier Shipment
              </h3>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Select Delivery Order
                </label>
                <select
                  value={selectedDeliveryId}
                  onChange={(e) => setSelectedDeliveryId(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">-- Choose Pending Delivery Order --</option>
                  {pendingDeliveries.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.delivery_number} — {d.recipient_name} ({formatCurrency(d.cod_amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Select Courier Partner
                </label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">-- Choose Courier Provider --</option>
                  {providers
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Standard rate: {formatCurrency(p.default_charge)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Special Instructions / Pickup Notes
                </label>
                <textarea
                  value={bookNotes}
                  onChange={(e) => setBookNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Fragile ceramic glass appliances, handle with care."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedDeliveryId || !selectedProviderId}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Booking...' : 'Confirm Shipment Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
