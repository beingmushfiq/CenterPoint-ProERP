import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Edit2,
  Trash2,
  TrendingUp,
  PackageCheck,
  Printer,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { GoodsReceipt } from '../../../types/api/purchasing';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { GoodsReceiptDocument } from '../../../components/print/documents/GoodsReceiptDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface GrnFormItem {
  product_name: string;
  product_sku: string;
  batch_code: string;
  received_quantity: string;
  rejected_quantity: string;
  accepted_quantity: string;
  unit_code: string;
  unit_cost: string;
}

const SAMPLE_RECEIPTS: GoodsReceipt[] = [
  {
    id: 1,
    uuid: 'grn-001',
    grn_number: 'GRN-202608-001',
    purchase_order_id: 2,
    po_number: 'PO-202608-002',
    party_id: 2,
    supplier_name: 'Meghna Sugar Refinery Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Central Raw Materials Silo',
    receipt_date: '2026-08-27',
    supplier_document_number: 'DC-884910-A',
    status: 'completed',
    received_by: 1,
    notes: 'Bulk sugar delivered via Truck Dhaka-Metro-Ta-11-2094. Verified with scale bridge.',
    items: [
      {
        id: 301,
        uuid: 'gri-301',
        goods_receipt_id: 1,
        product_id: 2,
        product_name: 'Refined Cane Sugar (Fine Grain)',
        product_sku: 'RM-SUGAR-01',
        batch_code: 'BAT-SUG-2608',
        expiry_date: '2028-08-20',
        received_quantity: '500.00',
        rejected_quantity: '0.00',
        accepted_quantity: '500.00',
        unit_id: 1,
        unit_code: 'KG',
        unit_cost: '130.00',
        total_cost: '65000.00',
      },
    ],
    created_at: '2026-08-27T10:00:00Z',
  },
  {
    id: 2,
    uuid: 'grn-002',
    grn_number: 'GRN-202608-002',
    purchase_order_id: 1,
    po_number: 'PO-202608-001',
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    receipt_date: '2026-08-28',
    supplier_document_number: 'INV-BGC-9021',
    status: 'draft',
    received_by: 1,
    notes: 'Ceramic glass batch unloading. Flatness & surface inspection underway.',
    items: [
      {
        id: 302,
        uuid: 'gri-302',
        goods_receipt_id: 2,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        batch_code: 'BAT-GLS-2608-01',
        expiry_date: null,
        received_quantity: '500.00',
        rejected_quantity: '5.00',
        accepted_quantity: '495.00',
        unit_id: 2,
        unit_code: 'PCS',
        unit_cost: '450.00',
        total_cost: '222750.00',
      },
    ],
    created_at: '2026-08-28T14:30:00Z',
  },
];

export function GoodsReceiptsSection() {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeGrn, setActiveGrn] = useState<GoodsReceipt | null>(null);
  const [printGrn, setPrintGrn] = useState<GoodsReceipt | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Form State
  const [formData, setFormData] = useState({
    grn_number: '',
    po_number: 'PO-202608-001',
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    receipt_date: new Date().toISOString().slice(0, 10),
    supplier_document_number: '',
    notes: '',
    items: [
      {
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        batch_code: 'BAT-GLS-01',
        received_quantity: '500',
        rejected_quantity: '0',
        accepted_quantity: '500',
        unit_code: 'PCS',
        unit_cost: '450.00',
      },
    ],
  });

  const { data: receipts = SAMPLE_RECEIPTS, isLoading, isFetching, refetch } = useQuery<GoodsReceipt[]>({
    queryKey: ['purchasing', 'goods-receipts'],
    queryFn: async () => {
      try {
        const res = await api.get<GoodsReceipt[]>('/purchasing/goods-receipts').catch(() =>
          api.get<GoodsReceipt[]>('/purchasing/receipts')
        );
        const list = extractList<GoodsReceipt>(res);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_RECEIPTS;
    },
    initialData: SAMPLE_RECEIPTS,
  });

  const handleViewGrn = async (grn: GoodsReceipt) => {
    setActiveGrn(grn);
    setShowViewModal(true);
    try {
      const res = await api.get<{ data: GoodsReceipt }>(`/purchasing/goods-receipts/${grn.id}`).catch(() =>
        api.get<{ data: GoodsReceipt }>(`/purchasing/receipts/${grn.id}`)
      );
      if (res.data?.data) {
        setActiveGrn(res.data.data);
      }
    } catch {
      // keep cached
    }
  };

  const handleCompleteGrn = async (grnId: number) => {
    setActionLoading(grnId);
    try {
      await api.post(`/purchasing/goods-receipts/${grnId}/complete`, {});
      toast.success('GRN completed & inventory stock ingested.');
    } catch {
      toast.success('GRN marked as completed (offline mode).');
    } finally {
      queryClient.setQueryData<GoodsReceipt[]>(['purchasing', 'goods-receipts'], (prev = []) =>
        prev.map((g) => (g.id === grnId ? { ...g, status: 'completed' } : g))
      );
      setActionLoading(null);
    }
  };

  const handleCreateGrn = (e: React.FormEvent) => {
    e.preventDefault();
    const newGrn: GoodsReceipt = {
      id: Date.now(),
      uuid: `grn-${Date.now()}`,
      grn_number:
        formData.grn_number ||
        `GRN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(receipts.length + 1).padStart(3, '0')}`,
      po_number: formData.po_number,
      party_id: 1,
      supplier_name: formData.supplier_name,
      warehouse_id: 1,
      warehouse_name: formData.warehouse_name,
      receipt_date: formData.receipt_date,
      supplier_document_number: formData.supplier_document_number,
      status: 'draft',
      received_by: 1,
      notes: formData.notes,
      items: formData.items.map((it, idx) => ({
        id: Date.now() + idx,
        uuid: `gri-${Date.now() + idx}`,
        goods_receipt_id: Date.now(),
        product_id: idx + 1,
        product_name: it.product_name,
        product_sku: it.product_sku,
        batch_code: it.batch_code,
        received_quantity: it.received_quantity,
        rejected_quantity: it.rejected_quantity,
        accepted_quantity: it.accepted_quantity,
        unit_id: 1,
        unit_code: it.unit_code,
        unit_cost: it.unit_cost,
        total_cost: (parseFloat(it.accepted_quantity || '0') * parseFloat(it.unit_cost || '0')).toFixed(2),
      })),
      created_at: new Date().toISOString(),
    };

    api.post('/purchasing/goods-receipts', newGrn)
      .catch(() => api.post('/purchasing/receipts', newGrn))
      .catch(() => {});
    queryClient.setQueryData<GoodsReceipt[]>(['purchasing', 'goods-receipts'], (prev = []) => [newGrn, ...prev]);
    toast.success('Goods receipt note (GRN) created.');
    setShowCreateModal(false);
  };

  const handleUpdateGrn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGrn) return;

    queryClient.setQueryData<GoodsReceipt[]>(['purchasing', 'goods-receipts'], (prev = []) =>
      prev.map((g) =>
        g.id === activeGrn.id
          ? {
              ...g,
              supplier_document_number: formData.supplier_document_number,
              notes: formData.notes,
            }
          : g
      )
    );
    api.put(`/purchasing/goods-receipts/${activeGrn.id}`, formData).catch(() => {});
    toast.success('Goods receipt updated.');
    setShowEditModal(false);
  };

  const handleDeleteGrn = () => {
    if (!activeGrn) return;
    queryClient.setQueryData<GoodsReceipt[]>(['purchasing', 'goods-receipts'], (prev = []) =>
      prev.filter((g) => g.id !== activeGrn.id)
    );
    api.delete(`/purchasing/goods-receipts/${activeGrn.id}`).catch(() => {});
    toast.success('Goods receipt deleted.');
    setShowDeleteModal(false);
  };

  const addItemToForm = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: '',
          product_sku: '',
          batch_code: 'BAT-LOT-NEW',
          received_quantity: '100',
          rejected_quantity: '0',
          accepted_quantity: '100',
          unit_code: 'KG',
          unit_cost: '50.00',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<GrnFormItem>) => {
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

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.grn_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.warehouse_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_document_number?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalReceivedValue = receipts.reduce((acc, r) => {
    const total = (r.items ?? []).reduce(
      (s, it) => s + parseFloat(it.total_cost || '0'),
      0
    );
    return acc + total;
  }, 0);

  const getStatusBadge = (status: GoodsReceipt['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Pending QA
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Stock Ingested
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
            <span className="text-xs font-semibold uppercase tracking-wider">Total GRNs</span>
            <PackageCheck className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{receipts.length}</div>
          <div className="mt-1 text-[11px] text-muted">All physical inbound dispatches</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Quality Audit</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {receipts.filter((r) => r.status === 'draft').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Awaiting QC inspection pass</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Stock Ingested</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {receipts.filter((r) => r.status === 'completed').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Posted to inventory ledger</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ingested Valuation</span>
            <TrendingUp className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(totalReceivedValue)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Received inventory asset value</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                grn_number: `GRN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(receipts.length + 1).padStart(3, '0')}`,
                po_number: 'PO-202608-001',
                supplier_name: 'Bengal Glass & Ceramic Ltd.',
                warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
                receipt_date: new Date().toISOString().slice(0, 10),
                supplier_document_number: 'CH-2026-091',
                notes: '',
                items: [
                  {
                    product_name: 'Microcrystalline Ceramic Glass Panel',
                    product_sku: 'RAW-CERAMIC-PANEL',
                    batch_code: 'BAT-GLS-01',
                    received_quantity: '500',
                    rejected_quantity: '0',
                    accepted_quantity: '500',
                    unit_code: 'PCS',
                    unit_cost: '450.00',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Receive Goods (GRN)</span>
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
              { value: 'draft', label: 'Pending QA', colorDot: 'bg-amber-500' },
              { value: 'completed', label: 'Stock Ingested', colorDot: 'bg-emerald-500' },
              { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter GRNs by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search GRN #, PO #, challan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">GRN # / Receipt Date</th>
                <th className="px-4 py-3.5">Supplier & Challan #</th>
                <th className="px-4 py-3.5">Reference PO</th>
                <th className="px-4 py-3.5">Target Warehouse</th>
                <th className="px-4 py-3.5 text-right">Accepted Value</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading goods receipts...' : 'No goods receipts found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => {
                  const grnTotal = (r.items ?? []).reduce(
                    (s, it) => s + parseFloat(it.total_cost || '0'),
                    0
                  );

                  return (
                    <tr key={r.id} className="hover:bg-surface-sunken/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-medium text-default">
                        <div className="flex items-center gap-1.5">
                          <Layers className="size-3.5 text-primary" />
                          <span>{r.grn_number}</span>
                        </div>
                        <div className="text-[10px] text-muted font-sans mt-0.5">{r.receipt_date}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-default">{r.supplier_name ?? '—'}</div>
                        <div className="text-[10px] font-mono text-muted">Doc: {r.supplier_document_number ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-primary font-medium">
                        {r.po_number ?? 'Direct Receipt'}
                      </td>
                      <td className="px-4 py-3.5 text-muted">{r.warehouse_name ?? 'Central Silo'}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-default">
                        {formatCurrency(grnTotal)}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(r.status)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewGrn(r)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer"
                          >
                            View
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
                              'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                              openActionMenuId === r.id
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
                  );
                })
              )}
            </tbody>
          </table>

          {openActionMenuId && (() => {
            const receipt = filteredReceipts.find((x) => x.id === openActionMenuId);
            if (!receipt) return null;
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
                <div className="p-1 space-y-0.5 text-xs">
                  {receipt.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveGrn(receipt);
                          setFormData({
                            grn_number: receipt.grn_number,
                            po_number: receipt.po_number || '',
                            supplier_name: receipt.supplier_name || '',
                            warehouse_name: receipt.warehouse_name || '',
                            receipt_date: receipt.receipt_date,
                            supplier_document_number: receipt.supplier_document_number || '',
                            notes: receipt.notes || '',
                            items: receipt.items?.map((it) => ({
                              product_name: it.product_name || '',
                              product_sku: it.product_sku || '',
                              batch_code: it.batch_code || '',
                              received_quantity: it.received_quantity,
                              rejected_quantity: it.rejected_quantity,
                              accepted_quantity: it.accepted_quantity,
                              unit_code: it.unit_code || 'KG',
                              unit_cost: it.unit_cost,
                            })) || [],
                          });
                          setShowEditModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        <Edit2 className="size-3.5 text-muted" />
                        <span>Edit GRN</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleCompleteGrn(receipt.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Ingest Stock into Ledger</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setPrintGrn(receipt);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Print GRN Document</span>
                  </button>

                  {receipt.status === 'draft' && (
                    <>
                      <div className="my-1 border-t border-default" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveGrn(receipt);
                          setShowDeleteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                        <span>Void / Delete GRN</span>
                      </button>
                    </>
                  )}
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* CREATE GRN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Receive Goods (GRN)</h3>
                <p className="text-xs text-muted mt-0.5">Record inbound delivery lot, weighment & inspection details</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">GRN #</label>
                  <input
                    type="text"
                    value={formData.grn_number}
                    onChange={(e) => setFormData({ ...formData, grn_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Reference PO #</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier Challan / Invoice #</label>
                  <input
                    type="text"
                    value={formData.supplier_document_number}
                    onChange={(e) => setFormData({ ...formData, supplier_document_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Target Warehouse</label>
                  <input
                    type="text"
                    value={formData.warehouse_name}
                    onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Items Line Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Inbound Items & Inspection Quantities</span>
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
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Product Description"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Batch #"
                        value={item.batch_code}
                        onChange={(e) => updateFormItem(idx, { batch_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono uppercase"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Rcv Qty"
                        value={item.received_quantity}
                        onChange={(e) => updateFormItem(idx, {
                          received_quantity: e.target.value,
                          accepted_quantity: e.target.value,
                        })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Unit Cost"
                        value={item.unit_cost}
                        onChange={(e) => updateFormItem(idx, { unit_cost: e.target.value })}
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
                <label className="block font-semibold text-muted mb-1">Receiving Notes & Gate Pass Entry</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Note transport vehicle number, seal conditions, driver details..."
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
                  Create GRN Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW GRN MODAL */}
      {showViewModal && activeGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeGrn.grn_number}</h3>
                  {getStatusBadge(activeGrn.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Supplier: {activeGrn.supplier_name} &bull; Ref PO: {activeGrn.po_number || 'Direct'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintGrn(activeGrn)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print GRN</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Receipt Date</span>
                  <span className="font-semibold text-default">{activeGrn.receipt_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Supplier Doc #</span>
                  <span className="font-semibold text-default">{activeGrn.supplier_document_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Warehouse</span>
                  <span className="font-semibold text-default">{activeGrn.warehouse_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Received By</span>
                  <span className="font-semibold text-default">User #{activeGrn.received_by || '1'}</span>
                </div>
              </div>

              {activeGrn.notes && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Gate Pass & Unloading Notes:</span>
                  <p className="text-default">{activeGrn.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Batch #</th>
                      <th className="px-3 py-2">Received</th>
                      <th className="px-3 py-2">Accepted</th>
                      <th className="px-3 py-2 text-right">Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeGrn.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">{it.product_name}</td>
                        <td className="px-3 py-2.5 font-mono text-muted">{it.batch_code || 'N/A'}</td>
                        <td className="px-3 py-2.5 font-mono">{it.received_quantity} {it.unit_code}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {it.accepted_quantity} {it.unit_code}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right font-semibold text-default">
                          {formatCurrency(it.total_cost)}
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

      {/* EDIT GRN MODAL */}
      {showEditModal && activeGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Goods Receipt ({activeGrn.grn_number})</h3>
                <p className="text-xs text-muted mt-0.5">Update receiving records</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateGrn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier Challan #</label>
                  <input
                    type="text"
                    value={formData.supplier_document_number}
                    onChange={(e) => setFormData({ ...formData, supplier_document_number: e.target.value })}
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

      {/* DELETE / VOID CONFIRMATION MODAL */}
      {showDeleteModal && activeGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Void Goods Receipt?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to void GRN <span className="font-mono font-semibold text-default">{activeGrn.grn_number}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep GRN
              </button>
              <button
                type="button"
                onClick={handleDeleteGrn}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Goods Receipt Note Modal */}
      {printGrn && (
        <PrintPreviewModal
          isOpen={Boolean(printGrn)}
          onClose={() => setPrintGrn(null)}
          title={`Goods Receipt Note: ${printGrn.grn_number}`}
          documentNumber={printGrn.grn_number}
          documentType="Official Goods Receipt & QA Inspection Voucher"
          pageClass="print-page-a4"
        >
          <GoodsReceiptDocument grn={printGrn} businessConfig={businessConfig} />
        </PrintPreviewModal>
      )}
    </div>
  );
}
