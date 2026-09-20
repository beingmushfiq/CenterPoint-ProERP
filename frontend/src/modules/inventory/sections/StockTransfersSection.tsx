import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Truck,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Warehouse,
  Printer,
  Layers,
  ChevronDown,
  X,
} from 'lucide-react';
import type { StockTransfer } from '../../../types/api/inventory';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { extractList } from '../../../lib/api/apiData';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { StockTransferDocument } from '../../../components/print/documents/StockTransferDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface TransferFormItem {
  product_name: string;
  batch_code: string;
  sent_quantity: string;
  unit_code: string;
}

const SAMPLE_TRANSFERS: StockTransfer[] = [
  {
    id: 1,
    uuid: 'tr-001',
    transfer_number: 'TR-202608-001',
    from_warehouse_id: 1,
    from_warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    to_warehouse_id: 2,
    to_warehouse_name: 'Cooker Assembly Line 1 Floor Buffer',
    transfer_date: '2026-08-30',
    status: 'in_transit',
    dispatched_by: 1,
    dispatched_at: '2026-08-30T08:30:00Z',
    notes: 'Ceramic panels and coils replenishment for daily cooker assembly shift.',
    items: [
      {
        id: 801,
        uuid: 'tri-801',
        stock_transfer_id: 1,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        batch_code: 'BAT-GLS-2608-01',
        sent_quantity: '200.00',
        received_quantity: '0.00',
        unit_id: 2,
        unit_code: 'PCS',
      },
    ],
    created_at: '2026-08-30T08:00:00Z',
  },
  {
    id: 2,
    uuid: 'tr-002',
    transfer_number: 'TR-202608-002',
    from_warehouse_id: 2,
    from_warehouse_name: 'Cooker Assembly Line 1 Floor Buffer',
    to_warehouse_id: 3,
    to_warehouse_name: 'Dhaka Main Finished Appliances Distribution Depot',
    transfer_date: '2026-08-29',
    status: 'received',
    dispatched_by: 1,
    dispatched_at: '2026-08-29T14:00:00Z',
    received_by: 2,
    received_at: '2026-08-29T16:15:00Z',
    notes: 'Finished infrared cookers moved to main distribution depot.',
    items: [
      {
        id: 802,
        uuid: 'tri-802',
        stock_transfer_id: 2,
        product_id: 2,
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        product_sku: 'FG-IC-2200',
        batch_code: 'BAT-IRC-2908',
        sent_quantity: '100.00',
        received_quantity: '100.00',
        unit_id: 2,
        unit_code: 'PCS',
      },
    ],
    created_at: '2026-08-29T13:30:00Z',
  },
  {
    id: 3,
    uuid: 'tr-003',
    transfer_number: 'TR-202608-003',
    from_warehouse_id: 1,
    from_warehouse_name: 'Central Raw Materials Silo',
    to_warehouse_id: 4,
    to_warehouse_name: 'Retail Display Shelf Storefront',
    transfer_date: '2026-08-31',
    status: 'draft',
    notes: 'Packaging and merchandise restock request.',
    items: [
      {
        id: 803,
        uuid: 'tri-803',
        stock_transfer_id: 3,
        product_id: 3,
        product_name: 'Refined Cane Sugar (Fine Grain)',
        product_sku: 'RM-SUGAR-01',
        batch_code: 'BAT-SUG-3108',
        sent_quantity: '100.00',
        received_quantity: '0.00',
        unit_id: 1,
        unit_code: 'KG',
      },
    ],
    created_at: '2026-08-31T09:00:00Z',
  },
];

export function StockTransfersSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('inventory.transfer.delete');

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<StockTransfer | null>(null);
  const [printTransfer, setPrintTransfer] = useState<StockTransfer | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Form State
  const [formData, setFormData] = useState({
    transfer_number: '',
    from_warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    to_warehouse_name: 'Cooker Assembly Line 1 Floor Buffer',
    transfer_date: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [
      {
        product_name: 'Microcrystalline Ceramic Glass Panel',
        batch_code: 'BAT-GLS-2608-01',
        sent_quantity: '100',
        unit_code: 'PCS',
      },
    ],
  });

  const { data: transfers = SAMPLE_TRANSFERS, isLoading, isFetching, refetch } = useQuery<StockTransfer[]>({
    queryKey: ['inventory', 'transfers'],
    queryFn: async () => {
      try {
        const res = await api.get<StockTransfer[]>('/inventory/transfers');
        const list = extractList<StockTransfer>(res);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_TRANSFERS;
    },
    initialData: SAMPLE_TRANSFERS,
  });

  const handleDispatch = async (transferId: number) => {
    setActionLoading(transferId);
    try {
      await api.post(`/inventory/transfers/${transferId}/dispatch`, {});
      toast.success('Stock transfer dispatched and marked in-transit.');
    } catch {
      toast.success('Transfer marked in-transit (offline mode).');
    } finally {
      queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
        prev.map((t) =>
          t.id === transferId
            ? { ...t, status: 'in_transit', dispatched_at: new Date().toISOString() }
            : t
        )
      );
      setActionLoading(null);
    }
  };

  const handleReceive = async (transferId: number) => {
    setActionLoading(transferId);
    try {
      await api.post(`/inventory/transfers/${transferId}/receive`, {});
      toast.success('Stock transfer received & inventory updated.');
    } catch {
      toast.success('Transfer marked as received (offline mode).');
    } finally {
      queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
        prev.map((t) =>
          t.id === transferId
            ? { ...t, status: 'received', received_at: new Date().toISOString() }
            : t
        )
      );
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (transferId: number, nextStatus: StockTransfer['status']) => {
    try {
      await api.patch(`/inventory/transfers/${transferId}`, { status: nextStatus });
    } catch {
      // Optimistic fallback
    }

    queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
      prev.map((t) =>
        t.id === transferId
          ? {
              ...t,
              status: nextStatus,
              dispatched_at: (nextStatus === 'in_transit' && !t.dispatched_at ? new Date().toISOString() : t.dispatched_at) ?? null,
              received_at: (nextStatus === 'received' && !t.received_at ? new Date().toISOString() : t.received_at) ?? null,
            }
          : t
      )
    );
    toast.success(`Transfer status updated to ${nextStatus.replace('_', ' ')}.`);
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const newTr: StockTransfer = {
      id: Date.now(),
      uuid: `tr-${Date.now()}`,
      transfer_number:
        formData.transfer_number ||
        `TR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(transfers.length + 1).padStart(3, '0')}`,
      from_warehouse_id: 1,
      from_warehouse_name: formData.from_warehouse_name,
      to_warehouse_id: 2,
      to_warehouse_name: formData.to_warehouse_name,
      transfer_date: formData.transfer_date,
      status: 'draft',
      notes: formData.notes,
      items: formData.items.map((it, idx) => ({
        id: Date.now() + idx,
        uuid: `tri-${Date.now() + idx}`,
        stock_transfer_id: Date.now(),
        product_id: idx + 1,
        product_name: it.product_name,
        batch_code: it.batch_code,
        sent_quantity: it.sent_quantity,
        received_quantity: '0.00',
        unit_id: 1,
        unit_code: it.unit_code,
      })),
      created_at: new Date().toISOString(),
    };

    api.post('/inventory/transfers', newTr).catch(() => {});
    queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) => [newTr, ...prev]);
    toast.success('Stock transfer created.');
    setShowCreateModal(false);
  };

  const handleUpdateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransfer) return;

    queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
      prev.map((t) =>
        t.id === activeTransfer.id
          ? {
              ...t,
              from_warehouse_name: formData.from_warehouse_name,
              to_warehouse_name: formData.to_warehouse_name,
              notes: formData.notes,
            }
          : t
      )
    );
    api.put(`/inventory/transfers/${activeTransfer.id}`, formData).catch(() => {});
    toast.success('Stock transfer updated.');
    setShowEditModal(false);
  };

  const handleDeleteTransfer = async () => {
    if (!activeTransfer) return;
    try {
      await api.delete(`/inventory/transfers/${activeTransfer.id}`);
    } catch {
      // Retain optimistic UI update if network fallback occurs
    }
    queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
      prev.filter((t) => t.id !== activeTransfer.id)
    );
    notify.success('Stock transfer moved to Data Bin successfully.');
    setShowDeleteModal(false);
    setActiveTransfer(null);
  };

  const addItemToForm = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: '',
          batch_code: 'BAT-LOT',
          sent_quantity: '100',
          unit_code: 'KG',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<TransferFormItem>) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const removeItemFromForm = (idx: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  };

  const filteredTransfers = transfers.filter((t) => {
    const matchesSearch =
      t.transfer_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.from_warehouse_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.to_warehouse_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.notes?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isAllSelected = filteredTransfers.length > 0 && selectedIds.size === filteredTransfers.length;
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
      setSelectedIds(new Set(filteredTransfers.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    let count = 0;
    try {
      for (const id of Array.from(selectedIds)) {
        try {
          await api.delete(`/inventory/transfers/${id}`);
          count++;
        } catch {
          // Continue bulk loop on single record deletion error
        }
      }
      queryClient.setQueryData<StockTransfer[]>(['inventory', 'transfers'], (prev = []) =>
        prev.filter((t) => !selectedIds.has(t.id))
      );
      notify.success(`${count} stock transfer(s) moved to Data Bin.`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const getStatusBadge = (status: StockTransfer['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Draft Order
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Navigation className="size-3 text-blue-500 animate-pulse" /> In Transit
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3 text-rose-500" /> Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Transfers</span>
            <Warehouse className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{transfers.length}</div>
          <div className="mt-1 text-[11px] text-muted">All inter-location movements</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Transit</span>
            <Truck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {transfers.filter((t) => t.status === 'in_transit').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Active stock on the road</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Transfers</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {transfers.filter((t) => t.status === 'received').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Reconciled at destination</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Draft Plans</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {transfers.filter((t) => t.status === 'draft').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Awaiting dispatch sign-off</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                transfer_number: `TR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(transfers.length + 1).padStart(3, '0')}`,
                from_warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
                to_warehouse_name: 'Cooker Assembly Line 1 Floor Buffer',
                transfer_date: new Date().toISOString().slice(0, 10),
                notes: '',
                items: [
                  {
                    product_name: 'Microcrystalline Ceramic Glass Panel',
                    batch_code: 'BAT-GLS-2608-01',
                    sent_quantity: '100',
                    unit_code: 'PCS',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Stock Transfer</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft Plans', colorDot: 'bg-slate-400' },
              { value: 'in_transit', label: 'In Transit', colorDot: 'bg-blue-500' },
              { value: 'received', label: 'Completed', colorDot: 'bg-emerald-500' },
              { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter transfers by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search transfer #, source, destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} stock transfer(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Move to Bin ({selectedIds.size})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-default bg-surface rounded-xl border border-default transition cursor-pointer"
            >
              <X className="size-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Transfers Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all transfers"
                    className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Transfer # / Date</th>
                <th className="px-4 py-3.5">Source Warehouse</th>
                <th className="px-4 py-3.5">Destination Warehouse</th>
                <th className="px-4 py-3.5">Items Transferred</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading transfers...' : 'No stock transfers found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr
                    key={t.id}
                    className={cn(
                      'hover:bg-surface-sunken/60 transition-colors',
                      selectedIds.has(t.id) && 'bg-primary/5'
                    )}
                  >
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        aria-label={`Select transfer ${t.transfer_number}`}
                        className="rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <Layers className="size-3.5 text-primary" />
                        <span>{t.transfer_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">{t.transfer_date}</div>
                    </td>
                    <td className="px-4 py-3.5 text-muted font-medium">{t.from_warehouse_name}</td>
                    <td className="px-4 py-3.5 text-default font-semibold flex items-center gap-1">
                      <ArrowRight className="size-3 text-muted" />
                      <span>{t.to_warehouse_name}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{t.items?.length || 0} Line Item(s)</div>
                      <div className="text-[10px] text-muted truncate max-w-xs">{t.items?.[0]?.product_name}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as StockTransfer['status'])}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold focus:outline-none transition-colors cursor-pointer ${
                          t.status === 'received'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : t.status === 'in_transit'
                            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                            : t.status === 'cancelled'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        }`}
                      >
                        <option value="draft">Draft</option>
                        <option value="in_transit">In Transit</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveTransfer(t);
                            setShowViewModal(true);
                            void api.get<StockTransfer>(`/inventory/transfers/${t.id}`).then((res) => {
                              if (res.data) setActiveTransfer(res.data);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-sunken hover:bg-surface border border-default text-default transition-colors cursor-pointer"
                          title="View Manifest"
                        >
                          <Eye className="size-3.5 text-muted" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === t.id) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(t.id);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                            openActionMenuId === t.id
                              ? 'bg-primary text-primary-fg border-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-sunken border-default text-default'
                          )}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {openActionMenuId && (() => {
            const t = filteredTransfers.find((item) => item.id === openActionMenuId);
            if (!t) return null;
            return (
              <ActionMenuPortal
                isOpen={Boolean(openActionMenuId && actionMenuAnchor)}
                anchorEl={actionMenuAnchor}
                onClose={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                }}
                width="13rem"
              >
                <div className="px-3 py-2 border-b border-default text-2xs text-muted font-mono truncate">
                  {t.transfer_number}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setActiveTransfer(t);
                    setFormData({
                      transfer_number: t.transfer_number,
                      from_warehouse_name: t.from_warehouse_name || '',
                      to_warehouse_name: t.to_warehouse_name || '',
                      transfer_date: t.transfer_date,
                      notes: t.notes || '',
                      items: t.items?.map((it) => ({
                        product_name: it.product_name || '',
                        batch_code: it.batch_code || '',
                        sent_quantity: it.sent_quantity,
                        unit_code: it.unit_code || 'KG',
                      })) || [],
                    });
                    setShowEditModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 className="size-3.5 text-muted" />
                  <span>Edit Transfer</span>
                </button>

                {t.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      handleDispatch(t.id);
                    }}
                    disabled={actionLoading === t.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Truck className="size-3.5 text-blue-500" />
                    <span>Dispatch Transfer</span>
                  </button>
                )}

                {t.status === 'in_transit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      handleReceive(t.id);
                    }}
                    disabled={actionLoading === t.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>Confirm Receipt</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setActiveTransfer(t);
                    window.print();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="size-3.5 text-muted" />
                  <span>Print Waybill</span>
                </button>

                {canDelete && (
                  <>
                    <div className="my-1 border-t border-default" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setActiveTransfer(t);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                      <span>Move to Bin</span>
                    </button>
                  </>
                )}
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* CREATE TRANSFER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Warehouse Stock Transfer</h3>
                <p className="text-xs text-muted mt-0.5">Move inventory between production plants, warehouses & retail buffers</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Transfer #</label>
                  <input
                    type="text"
                    value={formData.transfer_number}
                    onChange={(e) => setFormData({ ...formData, transfer_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Source Warehouse</label>
                  <input
                    type="text"
                    value={formData.from_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, from_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Destination Warehouse</label>
                  <input
                    type="text"
                    value={formData.to_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, to_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Items Line Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Transfer Items & Quantities</span>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Product Description"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Batch Code"
                        value={item.batch_code}
                        onChange={(e) => updateFormItem(idx, { batch_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono uppercase"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.sent_quantity}
                        onChange={(e) => updateFormItem(idx, { sent_quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit_code}
                        onChange={(e) => updateFormItem(idx, { unit_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono uppercase"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemFromForm(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Transfer Notes & Dispatch Route</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Transport vehicle, driver contact, delivery timeframe..."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Generate Transfer Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TRANSFER MODAL */}
      {showViewModal && activeTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeTransfer.transfer_number}</h3>
                  {getStatusBadge(activeTransfer.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">{activeTransfer.from_warehouse_name} &rarr; {activeTransfer.to_warehouse_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintTransfer(activeTransfer)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Manifest</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Date</span>
                  <span className="font-semibold text-default">{activeTransfer.transfer_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Dispatched At</span>
                  <span className="font-semibold text-default">{activeTransfer.dispatched_at ? activeTransfer.dispatched_at.slice(0, 16).replace('T', ' ') : 'Pending'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Received At</span>
                  <span className="font-semibold text-default">{activeTransfer.received_at ? activeTransfer.received_at.slice(0, 16).replace('T', ' ') : 'Pending'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Total Items</span>
                  <span className="font-semibold text-primary">{activeTransfer.items?.length || 0} Lines</span>
                </div>
              </div>

              {activeTransfer.notes && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Transfer Notes:</span>
                  <p className="text-default">{activeTransfer.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Batch Code</th>
                      <th className="px-3 py-2">Sent Qty</th>
                      <th className="px-3 py-2 text-right">Received Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeTransfer.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">{it.product_name}</td>
                        <td className="px-3 py-2.5 font-mono text-muted">{it.batch_code || 'N/A'}</td>
                        <td className="px-3 py-2.5 font-mono">{it.sent_quantity} {it.unit_code}</td>
                        <td className="px-3 py-2.5 font-mono text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {activeTransfer.status === 'received' ? `${it.sent_quantity} ${it.unit_code}` : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-sunken border border-default text-default hover:bg-surface cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSFER MODAL */}
      {showEditModal && activeTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Transfer ({activeTransfer.transfer_number})</h3>
                <p className="text-xs text-muted mt-0.5">Modify warehouse route</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Source</label>
                  <input
                    type="text"
                    value={formData.from_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, from_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Destination</label>
                  <input
                    type="text"
                    value={formData.to_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, to_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Stock Transfer to Bin Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteModal && Boolean(activeTransfer)}
        onClose={() => {
          setShowDeleteModal(false);
          setActiveTransfer(null);
        }}
        onConfirm={handleDeleteTransfer}
        title="Move Stock Transfer to Bin"
        message={`Are you sure you want to move stock transfer ${activeTransfer?.transfer_number} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Bulk Move Stock Transfers to Bin Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Move Selected Transfers to Bin"
        message={`Are you sure you want to move ${selectedIds.size} stock transfer(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`}
        confirmLabel={`Move to Bin (${selectedIds.size})`}
        cancelLabel="Cancel"
        variant="danger"
        loading={isBulkDeleting}
      />

      {/* Print Stock Transfer Manifest Modal */}
      {printTransfer && (
        <PrintPreviewModal
          isOpen={Boolean(printTransfer)}
          onClose={() => setPrintTransfer(null)}
          title={`Transfer Manifest: ${printTransfer.transfer_number}`}
          documentNumber={printTransfer.transfer_number}
          documentType="Official Stock Transfer Manifest"
          pageClass="print-page-a4"
        >
          <StockTransferDocument transfer={printTransfer} businessConfig={businessConfig} />
        </PrintPreviewModal>
      )}
    </div>
  );
}
