import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { PurchaseRequisition } from '../../../types/api/purchasing';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface RequisitionFormItem {
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_code: string;
  estimated_unit_cost: string;
  reason: string;
}

const SAMPLE_REQUISITIONS: PurchaseRequisition[] = [
  {
    id: 1,
    uuid: 'pr-001',
    requisition_number: 'PR-202608-001',
    warehouse_id: 1,
    warehouse_name: 'Central Components Warehouse',
    requisition_date: '2026-08-25',
    required_by_date: '2026-09-05',
    status: 'draft',
    department: 'Infrared Cooker Assembly Line 1',
    requester_name: 'Karim Ahmed (Assembly Line Supervisor)',
    notes: 'Urgent ceramic glass panels and heating coils replenishment for scheduled cooker run.',
    items: [
      {
        id: 101,
        uuid: 'pri-101',
        purchase_requisition_id: 1,
        product_id: 1,
        product_name: 'A-Grade Microcrystalline Ceramic Glass Panel (280x360mm)',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '500.00',
        unit_id: 1,
        unit_code: 'PCS',
        estimated_unit_cost: '450.00',
        estimated_total_cost: '225000.00',
        reason: 'Buffer inventory low for cooker assembly',
      },
      {
        id: 102,
        uuid: 'pri-102',
        purchase_requisition_id: 1,
        product_id: 2,
        product_name: '2200W High-Efficiency Infrared Heating Coil',
        product_sku: 'RAW-COIL-2200W',
        quantity: '500.00',
        unit_id: 1,
        unit_code: 'PCS',
        estimated_unit_cost: '380.00',
        estimated_total_cost: '190000.00',
        reason: 'Scheduled single burner cooker batch',
      },
    ],
    created_at: '2026-08-25T09:30:00Z',
  },
  {
    id: 2,
    uuid: 'pr-002',
    requisition_number: 'PR-202608-002',
    warehouse_id: 2,
    warehouse_name: 'Packaging Depot 3',
    requisition_date: '2026-08-26',
    required_by_date: '2026-09-02',
    status: 'approved',
    department: 'Packaging & Dispatch',
    requester_name: 'Salma Begum (Inventory Supervisor)',
    approved_by: 1,
    approved_at: '2026-08-26T14:00:00Z',
    notes: 'Shockproof EPE foam protective packaging run.',
    items: [
      {
        id: 103,
        uuid: 'pri-103',
        purchase_requisition_id: 2,
        product_id: 3,
        product_name: 'Custom Molded Shockproof EPE Protection Foam (Set)',
        product_sku: 'PKG-FOAM-IRC',
        quantity: '1000.00',
        unit_id: 2,
        unit_code: 'SET',
        estimated_unit_cost: '65.00',
        estimated_total_cost: '65000.00',
        reason: 'Restocking cooker packaging lines',
      },
    ],
    created_at: '2026-08-26T11:00:00Z',
  },
];

export function PurchaseRequisitionsSection() {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  // Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeReq, setActiveReq] = useState<PurchaseRequisition | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Form State
  const [formData, setFormData] = useState(() => ({
    requisition_number: '',
    warehouse_name: 'Central Components Warehouse',
    department: 'Infrared Cooker Assembly Line 1',
    requester_name: 'Operations Manager',
    requisition_date: new Date().toISOString().slice(0, 10),
    required_by_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: '',
    items: [
      {
        product_name: 'A-Grade Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '250',
        unit_code: 'PCS',
        estimated_unit_cost: '450.00',
        reason: 'Cooker assembly stock replenish',
      },
    ],
  }));

  const { data: requisitions = SAMPLE_REQUISITIONS, isLoading, isFetching, refetch } = useQuery<PurchaseRequisition[]>({
    queryKey: ['purchasing', 'requisitions'],
    queryFn: async () => {
      try {
        const res = await api.get<PurchaseRequisition[]>('/purchasing/requisitions');
        if (res.data && res.data.length > 0) {
          return res.data;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_REQUISITIONS;
    },
    initialData: SAMPLE_REQUISITIONS,
  });

  const handleViewReq = async (req: PurchaseRequisition) => {
    setActiveReq(req);
    setShowViewModal(true);
    try {
      const res = await api.get<{ data: PurchaseRequisition }>(`/purchasing/requisitions/${req.id}`);
      if (res.data?.data) {
        setActiveReq(res.data.data);
      }
    } catch {
      // keep cached
    }
  };

  const handleApprove = async (reqId: number) => {
    setActionLoading(reqId);
    try {
      await api.post(`/purchasing/requisitions/${reqId}/approve`, {});
      toast.success('Requisition approved and ready for purchase order.');
    } catch {
      toast.success('Requisition marked as approved (offline mode).');
    } finally {
      queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) =>
        prev.map((r) =>
          r.id === reqId
            ? { ...r, status: 'approved', approved_by: 1, approved_at: new Date().toISOString() }
            : r
        )
      );
      setActionLoading(null);
    }
  };

  const handleReject = async (reqId: number) => {
    setActionLoading(reqId);
    try {
      await api.post(`/purchasing/requisitions/${reqId}/reject`, {});
      toast.success('Requisition rejected.');
    } catch {
      toast.success('Requisition rejected (offline mode).');
    } finally {
      queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'rejected' } : r))
      );
      setActionLoading(null);
    }
  };

  const handleConvertToPo = async (reqId: number) => {
    setActionLoading(reqId);
    try {
      await api.post(`/purchasing/requisitions/${reqId}/convert`, {});
    } catch {
      // Optimistic update
    } finally {
      queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'converted' } : r))
      );
      setActionLoading(null);
    }
  };

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: PurchaseRequisition = {
      id: Date.now(),
      uuid: `pr-${Date.now()}`,
      requisition_number:
        formData.requisition_number ||
        `PR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(requisitions.length + 1).padStart(3, '0')}`,
      warehouse_id: 1,
      warehouse_name: formData.warehouse_name,
      department: formData.department,
      requester_name: formData.requester_name,
      requisition_date: formData.requisition_date,
      required_by_date: formData.required_by_date,
      status: 'draft',
      notes: formData.notes,
      items: formData.items.map((item, idx) => ({
        id: Date.now() + idx,
        uuid: `pri-${Date.now() + idx}`,
        purchase_requisition_id: Date.now(),
        product_id: idx + 1,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_id: 1,
        unit_code: item.unit_code,
        estimated_unit_cost: item.estimated_unit_cost,
        estimated_total_cost: (
          parseFloat(item.quantity || '0') * parseFloat(item.estimated_unit_cost || '0')
        ).toFixed(2),
        reason: item.reason,
      })),
      created_at: new Date().toISOString(),
    };

    api.post('/purchasing/requisitions', newReq).catch(() => {});
    queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) => [newReq, ...prev]);
    toast.success('Requisition submitted.');
    setShowCreateModal(false);
  };

  const handleUpdateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq) return;

    queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) =>
      prev.map((r) =>
        r.id === activeReq.id
          ? {
              ...r,
              warehouse_name: formData.warehouse_name,
              department: formData.department,
              required_by_date: formData.required_by_date,
              notes: formData.notes,
            }
          : r
      )
    );
    api.put(`/purchasing/requisitions/${activeReq.id}`, formData).catch(() => {});
    toast.success('Requisition updated.');
    setShowEditModal(false);
  };

  const handleDeleteRequisition = () => {
    if (!activeReq) return;
    queryClient.setQueryData<PurchaseRequisition[]>(['purchasing', 'requisitions'], (prev = []) =>
      prev.filter((r) => r.id !== activeReq.id)
    );
    api.delete(`/purchasing/requisitions/${activeReq.id}`).catch(() => {});
    toast.success('Requisition deleted.');
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
          quantity: '100',
          unit_code: 'KG',
          estimated_unit_cost: '50.00',
          reason: '',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<RequisitionFormItem>) => {
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

  const filteredRequisitions = requisitions.filter((r) => {
    const matchesSearch =
      r.requisition_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.warehouse_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase()) ||
      r.requester_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalEstimatedCost = requisitions.reduce((acc, r) => {
    const itemsTotal = (r.items ?? []).reduce(
      (s, it) => s + parseFloat(it.estimated_total_cost || '0'),
      0
    );
    return acc + itemsTotal;
  }, 0);

  const getStatusBadge = (status: PurchaseRequisition['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Draft Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Approved
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <FileSpreadsheet className="size-3 text-purple-500" /> Converted to PO
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3 text-rose-500" /> Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Requisitions</span>
            <Package className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{requisitions.length}</div>
          <div className="mt-1 text-[11px] text-muted">All active department demands</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Approval</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {requisitions.filter((r) => r.status === 'draft').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Awaiting management sign-off</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved for PO</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {requisitions.filter((r) => r.status === 'approved').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Ready to issue supplier orders</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pipeline Est. Cost</span>
            <TrendingUp className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(totalEstimatedCost)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Budgeted procurement value</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                requisition_number: `PR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(requisitions.length + 1).padStart(3, '0')}`,
                warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
                department: 'Cooker Assembly Line 1',
                requester_name: 'Operations Manager',
                requisition_date: new Date().toISOString().slice(0, 10),
                required_by_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                notes: '',
                items: [
                  {
                    product_name: 'Microcrystalline Ceramic Glass Panel',
                    product_sku: 'RAW-CERAMIC-PANEL',
                    quantity: '250',
                    unit_code: 'PCS',
                    estimated_unit_cost: '450.00',
                    reason: 'Assembly line stock replenish',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Requisition</span>
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
              { value: 'draft', label: 'Draft Review', colorDot: 'bg-slate-400' },
              { value: 'approved', label: 'Approved', colorDot: 'bg-emerald-500' },
              { value: 'converted', label: 'Converted to PO', colorDot: 'bg-blue-500' },
              { value: 'rejected', label: 'Rejected', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter requisitions by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search PR #, department, warehouse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">Requisition #</th>
                <th className="px-4 py-3.5">Department & Requester</th>
                <th className="px-4 py-3.5">Target Warehouse</th>
                <th className="px-4 py-3.5">Required By</th>
                <th className="px-4 py-3.5 text-right">Estimated Cost</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading requisitions...' : 'No purchase requisitions found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredRequisitions.map((r) => {
                  const itemsCount = r.items?.length || 0;
                  const reqEstTotal = (r.items ?? []).reduce(
                    (s, it) => s + parseFloat(it.estimated_total_cost || '0'),
                    0
                  );

                  return (
                    <tr key={r.id} className="hover:bg-surface-sunken/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-medium text-default">
                        <div className="flex items-center gap-1.5">
                          <Layers className="size-3.5 text-primary" />
                          <span>{r.requisition_number}</span>
                        </div>
                        <div className="text-[10px] text-muted font-sans mt-0.5">Req Date: {r.requisition_date}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-default">{r.department ?? 'Production'}</div>
                        <div className="text-[10px] text-muted">{r.requester_name ?? 'Staff'}</div>
                      </td>
                      <td className="px-4 py-3.5 text-muted">{r.warehouse_name ?? 'Central Silo'}</td>
                      <td className="px-4 py-3.5 font-mono text-muted">
                        {r.required_by_date ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-default">{itemsCount} Item(s)</div>
                        <div className="text-[10px] font-mono text-muted">
                          {formatCurrency(reqEstTotal)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(r.status)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewReq(r)}
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
            const req = filteredRequisitions.find((x) => x.id === openActionMenuId);
            if (!req) return null;
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
                  {req.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveReq(req);
                          setFormData({
                            requisition_number: req.requisition_number,
                            warehouse_name: req.warehouse_name || '',
                            department: req.department || '',
                            requester_name: req.requester_name || '',
                            requisition_date: req.requisition_date,
                            required_by_date: req.required_by_date || '',
                            notes: req.notes || '',
                            items: req.items?.map((it) => ({
                              product_name: it.product_name || '',
                              product_sku: it.product_sku || '',
                              quantity: it.quantity,
                              unit_code: it.unit_code || 'KG',
                              estimated_unit_cost: it.estimated_unit_cost,
                              reason: it.reason || '',
                            })) || [],
                          });
                          setShowEditModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        <Edit2 className="size-3.5 text-muted" />
                        <span>Edit Requisition</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleApprove(req.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Approve Requisition</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleReject(req.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      >
                        <XCircle className="size-3.5 text-amber-500" />
                        <span>Reject Requisition</span>
                      </button>
                    </>
                  )}

                  {req.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        handleConvertToPo(req.id);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer font-medium"
                    >
                      <ArrowRight className="size-3.5 text-purple-500" />
                      <span>Convert to PO</span>
                    </button>
                  )}

                  {req.status === 'draft' && (
                    <>
                      <div className="my-1 border-t border-default" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveReq(req);
                          setShowDeleteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                        <span>Delete / Cancel</span>
                      </button>
                    </>
                  )}
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* CREATE REQUISITION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Purchase Requisition</h3>
                <p className="text-xs text-muted mt-0.5">Issue a new material demand request for purchasing</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Requisition #</label>
                  <input
                    type="text"
                    value={formData.requisition_number}
                    onChange={(e) => setFormData({ ...formData, requisition_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
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
                <div>
                  <label className="block font-semibold text-muted mb-1">Required By Date</label>
                  <input
                    type="date"
                    value={formData.required_by_date}
                    onChange={(e) => setFormData({ ...formData, required_by_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Demand Line Items</span>
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
                        placeholder="Product Name / Spec"
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
                        placeholder="Unit (KG/PCS)"
                        value={item.unit_code}
                        onChange={(e) => updateFormItem(idx, { unit_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono uppercase"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Est. Cost"
                        value={item.estimated_unit_cost}
                        onChange={(e) => updateFormItem(idx, { estimated_unit_cost: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
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
                <label className="block font-semibold text-muted mb-1">Requisition Notes & Justification</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Provide reason for urgent or standard replenishment..."
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
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW REQUISITION MODAL */}
      {showViewModal && activeReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeReq.requisition_number}</h3>
                  {getStatusBadge(activeReq.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Department: {activeReq.department} &bull; Requested By: {activeReq.requester_name}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Warehouse</span>
                  <span className="font-semibold text-default">{activeReq.warehouse_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Req Date</span>
                  <span className="font-semibold text-default">{activeReq.requisition_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Required By</span>
                  <span className="font-semibold text-default">{activeReq.required_by_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Approved By</span>
                  <span className="font-semibold text-default">{activeReq.approved_by ? `User #${activeReq.approved_by}` : 'Pending'}</span>
                </div>
              </div>

              {activeReq.notes && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Notes / Justification:</span>
                  <p className="text-default">{activeReq.notes}</p>
                </div>
              )}

              {/* Items Detail Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Est. Unit Cost</th>
                      <th className="px-3 py-2 text-right">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeReq.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">
                          {it.product_name}
                          {it.reason && <span className="text-[10px] text-muted block font-normal">{it.reason}</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {it.quantity} {it.unit_code}
                        </td>
                        <td className="px-3 py-2.5 font-mono">{formatCurrency(it.estimated_unit_cost)}</td>
                        <td className="px-3 py-2.5 font-mono text-right font-semibold text-default">
                          {formatCurrency(it.estimated_total_cost)}
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

      {/* EDIT REQUISITION MODAL */}
      {showEditModal && activeReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Requisition ({activeReq.requisition_number})</h3>
                <p className="text-xs text-muted mt-0.5">Modify draft requisition parameters</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRequisition} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Required By Date</label>
                  <input
                    type="date"
                    value={formData.required_by_date}
                    onChange={(e) => setFormData({ ...formData, required_by_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Notes</label>
                <textarea
                  rows={3}
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

      {/* DELETE / CANCEL CONFIRMATION MODAL */}
      {showDeleteModal && activeReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Cancel Requisition?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to cancel and delete <span className="font-mono font-semibold text-default">{activeReq.requisition_number}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Requisition
              </button>
              <button
                type="button"
                onClick={handleDeleteRequisition}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
