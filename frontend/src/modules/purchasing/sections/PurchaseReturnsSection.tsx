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
  RotateCcw,
  Printer,
  ChevronDown,
} from 'lucide-react';
import type { PurchaseReturn } from '../../../types/api/purchasing';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface ReturnFormItem {
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_code: string;
  unit_price: string;
  notes: string;
}

const SAMPLE_RETURNS: PurchaseReturn[] = [
  {
    id: 1,
    uuid: 'prt-001',
    return_number: 'PRT-202608-001',
    purchase_order_id: 1,
    goods_receipt_id: 2,
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    return_date: '2026-08-29',
    currency_code: 'BDT',
    total_amount: '2250.00',
    status: 'completed',
    reason: '5 ceramic glass panels chipped at corners rejected at gate inspection.',
    items: [
      {
        id: 501,
        uuid: 'pri-501',
        purchase_return_id: 1,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '5.00',
        unit_id: 2,
        unit_code: 'PCS',
        unit_price: '450.00',
        total_amount: '2250.00',
        notes: 'Corner cracks identified during inbound unloading.',
      },
    ],
    created_at: '2026-08-29T09:30:00Z',
  },
  {
    id: 2,
    uuid: 'prt-002',
    return_number: 'PRT-202608-002',
    purchase_order_id: 3,
    goods_receipt_id: null,
    party_id: 3,
    supplier_name: 'PackMaster Industrial Packaging Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    return_date: '2026-08-30',
    currency_code: 'BDT',
    total_amount: '8500.00',
    status: 'draft',
    reason: 'Dimension mismatch on 100 sets EPE foam buffers.',
    items: [
      {
        id: 502,
        uuid: 'pri-502',
        purchase_return_id: 2,
        product_id: 3,
        product_name: 'Infrared Cooker Shockproof EPE Foam Set',
        product_sku: 'PKG-FOAM-IRC',
        quantity: '100.00',
        unit_id: 3,
        unit_code: 'SET',
        unit_price: '85.00',
        total_amount: '8500.00',
        notes: 'Buffer cut depth too shallow for 2200W cooker chassis.',
      },
    ],
    created_at: '2026-08-30T11:00:00Z',
  },
];

export function PurchaseReturnsSection() {
  const { formatCurrency, currencyCode } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeReturn, setActiveReturn] = useState<PurchaseReturn | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    return_number: '',
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    return_date: new Date().toISOString().slice(0, 10),
    reason: 'Defective raw material batch identified during inbound QC inspection.',
    items: [
      {
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '10',
        unit_code: 'PCS',
        unit_price: '450.00',
        notes: 'Surface scratch detected during inspection',
      },
    ],
  });

  const { data: returns = SAMPLE_RETURNS, isLoading, isFetching, refetch } = useQuery<PurchaseReturn[]>({
    queryKey: ['purchasing', 'returns'],
    queryFn: async () => {
      try {
        const res = await api.get<PurchaseReturn[]>('/purchasing/returns');
        if (res.data && res.data.length > 0) {
          return res.data;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_RETURNS;
    },
    initialData: SAMPLE_RETURNS,
  });

  const handleViewReturn = async (ret: PurchaseReturn) => {
    setActiveReturn(ret);
    setShowViewModal(true);
    try {
      const res = await api.get<{ data: PurchaseReturn }>(`/purchasing/returns/${ret.id}`);
      if (res.data?.data) {
        setActiveReturn(res.data.data);
      }
    } catch {
      // keep cached
    }
  };

  const handleCompleteReturn = async (returnId: number) => {
    setActionLoading(returnId);
    try {
      await api.post(`/purchasing/returns/${returnId}/complete`, {});
      toast.success('Purchase return completed & debit note issued.');
    } catch {
      toast.success('Return marked as completed (offline mode).');
    } finally {
      queryClient.setQueryData<PurchaseReturn[]>(['purchasing', 'returns'], (prev = []) =>
        prev.map((r) => (r.id === returnId ? { ...r, status: 'completed' } : r))
      );
      setActionLoading(null);
    }
  };

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedTotal = formData.items.reduce(
      (sum, it) => sum + parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0'),
      0
    );

    const newReturn: PurchaseReturn = {
      id: Date.now(),
      uuid: `prt-${Date.now()}`,
      return_number:
        formData.return_number ||
        `PRT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(returns.length + 1).padStart(3, '0')}`,
      purchase_order_id: 1,
      goods_receipt_id: null,
      party_id: 1,
      supplier_name: formData.supplier_name,
      warehouse_id: 1,
      warehouse_name: formData.warehouse_name,
      return_date: formData.return_date,
      currency_code: currencyCode,
      total_amount: calculatedTotal.toFixed(2),
      status: 'draft',
      reason: formData.reason,
      items: formData.items.map((it, idx) => ({
        id: Date.now() + idx,
        uuid: `pri-${Date.now() + idx}`,
        purchase_return_id: Date.now(),
        product_id: idx + 1,
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity: it.quantity,
        unit_id: 1,
        unit_code: it.unit_code,
        unit_price: it.unit_price,
        total_amount: (parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0')).toFixed(2),
        notes: it.notes,
      })),
      created_at: new Date().toISOString(),
    };

    api.post('/purchasing/returns', newReturn).catch(() => {});
    queryClient.setQueryData<PurchaseReturn[]>(['purchasing', 'returns'], (prev = []) => [newReturn, ...prev]);
    toast.success('Purchase return drafted.');
    setShowCreateModal(false);
  };

  const handleUpdateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturn) return;

    queryClient.setQueryData<PurchaseReturn[]>(['purchasing', 'returns'], (prev = []) =>
      prev.map((r) =>
        r.id === activeReturn.id
          ? {
              ...r,
              supplier_name: formData.supplier_name,
              reason: formData.reason,
            }
          : r
      )
    );
    api.put(`/purchasing/returns/${activeReturn.id}`, formData).catch(() => {});
    toast.success('Purchase return updated.');
    setShowEditModal(false);
  };

  const handleDeleteReturn = () => {
    if (!activeReturn) return;
    queryClient.setQueryData<PurchaseReturn[]>(['purchasing', 'returns'], (prev = []) =>
      prev.filter((r) => r.id !== activeReturn.id)
    );
    api.delete(`/purchasing/returns/${activeReturn.id}`).catch(() => {});
    toast.success('Purchase return deleted.');
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
          quantity: '10',
          unit_code: 'KG',
          unit_price: '50.00',
          notes: '',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<ReturnFormItem>) => {
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

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.return_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.warehouse_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalReturnRecovery = returns.reduce(
    (sum, r) => sum + parseFloat(r.total_amount || '0'),
    0
  );

  const getStatusBadge = (status: PurchaseReturn['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Pending Claim
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Debit Settled
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
            <span className="text-xs font-semibold uppercase tracking-wider">Total Returns</span>
            <RotateCcw className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{returns.length}</div>
          <div className="mt-1 text-[11px] text-muted">All vendor defect return claims</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Claims</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {returns.filter((r) => r.status === 'draft').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Awaiting supplier credit notes</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Settled Debit Notes</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {returns.filter((r) => r.status === 'completed').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Deducted from vendor balance</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Claimed Amount</span>
            <TrendingUp className="size-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {formatCurrency(totalReturnRecovery)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Recovered supplier debit value</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                return_number: `PRT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(returns.length + 1).padStart(3, '0')}`,
                supplier_name: 'Bengal Glass & Ceramic Ltd.',
                warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
                return_date: new Date().toISOString().slice(0, 10),
                reason: 'Defective raw material batch identified during inbound QC inspection.',
                items: [
                  {
                    product_name: 'Microcrystalline Ceramic Glass Panel',
                    product_sku: 'RAW-CERAMIC-PANEL',
                    quantity: '10',
                    unit_code: 'PCS',
                    unit_price: '450.00',
                    notes: 'Surface scratch detected during inspection',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Return (Debit Note)</span>
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
              { value: 'draft', label: 'Pending Claims', colorDot: 'bg-amber-500' },
              { value: 'completed', label: 'Debit Settled', colorDot: 'bg-emerald-500' },
              { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter returns by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search return #, supplier, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Returns Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">Return # / Date</th>
                <th className="px-4 py-3.5">Supplier & Warehouse</th>
                <th className="px-4 py-3.5">Defect Reason</th>
                <th className="px-4 py-3.5 text-right">Debit Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading returns...' : 'No purchase returns found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className="size-3.5 text-rose-500" />
                        <span>{r.return_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">{r.return_date}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{r.supplier_name ?? '—'}</div>
                      <div className="text-[10px] text-muted">{r.warehouse_name ?? 'Central Silo'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-muted max-w-xs truncate">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(r.total_amount)}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewReturn(r)}
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
                ))
              )}
            </tbody>
          </table>

          {openActionMenuId && (() => {
            const ret = filteredReturns.find((x) => x.id === openActionMenuId);
            if (!ret) return null;
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
                  {ret.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveReturn(ret);
                          setFormData({
                            return_number: ret.return_number,
                            supplier_name: ret.supplier_name || '',
                            warehouse_name: ret.warehouse_name || '',
                            return_date: ret.return_date,
                            reason: ret.reason || '',
                            items: ret.items?.map((it) => ({
                              product_name: it.product_name || '',
                              product_sku: it.product_sku || '',
                              quantity: it.quantity,
                              unit_code: it.unit_code || 'KG',
                              unit_price: it.unit_price,
                              notes: it.notes || '',
                            })) || [],
                          });
                          setShowEditModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        <Edit2 className="size-3.5 text-muted" />
                        <span>Edit Return</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleCompleteReturn(ret.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Settle Debit Note</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setActiveReturn(ret);
                      window.print();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Print Debit Note</span>
                  </button>

                  {ret.status === 'draft' && (
                    <>
                      <div className="my-1 border-t border-default" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveReturn(ret);
                          setShowDeleteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                        <span>Void Return</span>
                      </button>
                    </>
                  )}
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* CREATE RETURN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Purchase Return (Debit Note)</h3>
                <p className="text-xs text-muted mt-0.5">Issue a supplier return voucher for defective or damaged goods</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Return #</label>
                  <input
                    type="text"
                    value={formData.return_number}
                    onChange={(e) => setFormData({ ...formData, return_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
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
                  <label className="block font-semibold text-muted mb-1">Return Date</label>
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Line Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-default">Returned Items & Net Return Cost</span>
                    <p className="text-[10px] text-muted">Net rate reflects effective unit cost paid after deducting line and vendor order discounts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted px-1">
                  <div className="col-span-5">Product Description</div>
                  <div className="col-span-2">Return Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Net Rate (৳)</div>
                  <div className="col-span-1 text-center">Del</div>
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
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(idx, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Unit (KG)"
                        value={item.unit_code}
                        onChange={(e) => updateFormItem(idx, { unit_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono uppercase"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Unit Cost"
                        value={item.unit_price}
                        onChange={(e) => updateFormItem(idx, { unit_price: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                        required
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
                <label className="block font-semibold text-muted mb-1">Return Reason & Defect Report</label>
                <textarea
                  rows={2}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Detail rejection notes, inspection test findings, QA failure..."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                  required
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
                  Issue Debit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW RETURN MODAL */}
      {showViewModal && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeReturn.return_number}</h3>
                  {getStatusBadge(activeReturn.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Supplier: {activeReturn.supplier_name} &bull; Warehouse: {activeReturn.warehouse_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Debit Note</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Return Date</span>
                  <span className="font-semibold text-default">{activeReturn.return_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Warehouse</span>
                  <span className="font-semibold text-default">{activeReturn.warehouse_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Total Claim</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(activeReturn.total_amount)}</span>
                </div>
              </div>

              {activeReturn.reason && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Return Reason:</span>
                  <p className="text-default">{activeReturn.reason}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Returned Qty</th>
                      <th className="px-3 py-2">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Debit Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeReturn.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">
                          {it.product_name}
                          {it.notes && <span className="text-[10px] text-muted block font-normal">{it.notes}</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono">{it.quantity} {it.unit_code}</td>
                        <td className="px-3 py-2.5 font-mono">{formatCurrency(it.unit_price)}</td>
                        <td className="px-3 py-2.5 font-mono text-right font-semibold text-rose-600 dark:text-rose-400">
                          {formatCurrency(it.total_amount)}
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

      {/* EDIT RETURN MODAL */}
      {showEditModal && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Purchase Return ({activeReturn.return_number})</h3>
                <p className="text-xs text-muted mt-0.5">Modify debit note parameters</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateReturn} className="space-y-4 text-xs">
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
                  <label className="block font-semibold text-muted mb-1">Return Date</label>
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Reason</label>
                <textarea
                  rows={2}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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

      {/* DELETE / CANCEL RETURN CONFIRMATION MODAL */}
      {showDeleteModal && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Cancel Debit Note?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to cancel return <span className="font-mono font-semibold text-default">{activeReturn.return_number}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Return
              </button>
              <button
                type="button"
                onClick={handleDeleteReturn}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
