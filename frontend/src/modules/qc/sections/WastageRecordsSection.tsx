import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  DollarSign,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { Modal, ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { Badge } from '../../../components/ui/Badge';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { isApiError } from '../../../lib/api/errors';
import type { WastageRecord } from '../../../types/api/qc';
import type { ProductionBatch } from '../../../types/api/production';
import type { Product, Warehouse } from '../../../types/api/catalog';
import type { Unit } from '../../../types/api/unit';

interface ReasonCodeOption {
  id: string;
  label: string;
  code: string;
  name: string;
  context: string;
}

interface CreateWastageDraft {
  wastage_number: string;
  product_id: string;
  production_batch_id?: string | undefined;
  stage: 'input' | 'in_process' | 'output' | 'qc' | 'storage' | 'transit';
  quantity: string;
  unit_id: string;
  reason_code_id: string;
  estimated_cost: string;
  is_recoverable: boolean;
  recovered_quantity?: string | undefined;
  warehouse_id?: string | undefined;
  notes?: string | undefined;
}

interface EditWastageDraft {
  quantity: string;
  stage: 'input' | 'in_process' | 'output' | 'qc' | 'storage' | 'transit';
  estimated_cost: string;
  warehouse_id?: string | undefined;
  is_recoverable: boolean;
  recovered_quantity?: string | undefined;
  notes?: string | undefined;
}

export function WastageRecordsSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('qc.wastage.delete');

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WastageRecord | null>(null);
  const [editForm, setEditForm] = useState<EditWastageDraft>({
    quantity: '1.0000',
    stage: 'in_process',
    estimated_cost: '0.0000',
    warehouse_id: '',
    is_recoverable: false,
    recovered_quantity: '0.0000',
    notes: '',
  });
  const [deletingRecord, setDeletingRecord] = useState<WastageRecord | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateWastageDraft>({
    wastage_number: '',
    product_id: '',
    stage: 'in_process',
    quantity: '5.0000',
    unit_id: '',
    reason_code_id: '',
    estimated_cost: '25.0000',
    is_recoverable: false,
  });

  const queryClient = useQueryClient();

  // Queries
  const wastageQuery = useQuery({
    queryKey: ['qc', 'wastage-records', search, stageFilter],
    queryFn: ({ signal }) =>
      api.get<WastageRecord[]>('/qc/wastage-records', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(stageFilter !== 'all' ? { stage: stageFilter } : {}),
        },
      }),
  });

  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'options'],
    queryFn: ({ signal }) => api.get<Product[]>('/products', { signal }),
  });

  const unitsQuery = useQuery({
    queryKey: ['catalogue', 'units', 'options'],
    queryFn: ({ signal }) => api.get<Unit[]>('/units', { signal }),
  });

  const batchesQuery = useQuery({
    queryKey: ['production', 'batches', 'options'],
    queryFn: ({ signal }) => api.get<ProductionBatch[]>('/production/batches', { signal }),
  });

  const warehousesQuery = useQuery({
    queryKey: ['catalogue', 'warehouses', 'options'],
    queryFn: ({ signal }) => api.get<Warehouse[]>('/warehouses', { signal }),
  });

  const reasonCodesQuery = useQuery({
    queryKey: ['catalogue', 'reason-codes', 'options'],
    queryFn: ({ signal }) => api.get<ReasonCodeOption[]>('/reason-codes/options', { signal }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateWastageDraft) =>
      api.post<WastageRecord>('/qc/wastage-records', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
      setIsCreateOpen(false);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to log wastage record.');
      else setErrorMsg('Error logging wastage record.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditWastageDraft }) =>
      api.put<WastageRecord>(`/qc/wastage-records/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
      setEditingRecord(null);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to update wastage record.');
      else setErrorMsg('Error updating wastage record.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/qc/wastage-records/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
      setDeletingRecord(null);
      setErrorMsg(null);
      notify.success('Wastage record moved to Data Bin successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to move wastage record to Data Bin.');
      else notify.error('Failed to move wastage record to Data Bin.');
    },
  });

  const openEditModal = (rec: WastageRecord) => {
    setErrorMsg(null);
    setEditingRecord(rec);
    setEditForm({
      quantity: rec.quantity ?? '1.0000',
      stage: ((rec as { stage?: string }).stage ?? 'in_process') as EditWastageDraft['stage'],
      estimated_cost: (rec as { estimated_cost?: string }).estimated_cost ?? rec.total_cost ?? '0.0000',
      warehouse_id: rec.warehouse_id ?? '',
      is_recoverable: Boolean((rec as { is_recoverable?: boolean }).is_recoverable),
      recovered_quantity: (rec as { recovered_quantity?: string }).recovered_quantity ?? '0.0000',
      notes: rec.notes ?? '',
    });
    void api.get<WastageRecord>(`/qc/wastage-records/${(rec as unknown as { uuid?: string }).uuid || rec.id}`).then((res) => {
      if (res.data) {
        setEditingRecord(res.data);
      }
    }).catch(() => {});
  };

  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const records = wastageQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const units = unitsQuery.data?.data ?? [];
  const batches = batchesQuery.data?.data ?? [];
  const warehouses = warehousesQuery.data?.data ?? [];
  const reasonCodes = reasonCodesQuery.data?.data ?? [];

  const isAllSelected = records.length > 0 && selectedRecordIds.size === records.length;
  const isSomeSelected = selectedRecordIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedRecordIds.size > 0) {
        setSelectedRecordIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecordIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map((r) => r.id)));
    }
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedRecordIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedRecordIds.size === 0) return;
    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const id of selectedRecordIds) {
        try {
          await api.delete(`/qc/wastage-records/${id}`);
          successCount++;
        } catch {
          failCount++;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
      setSelectedRecordIds(new Set());
      setShowBulkDeleteModal(false);

      if (failCount === 0) {
        notify.success(`${successCount} wastage record(s) moved to Data Bin successfully.`);
      } else if (successCount > 0) {
        notify.warning(`Moved ${successCount} wastage record(s) to Data Bin, but ${failCount} failed.`);
      } else {
        notify.error('Failed to move selected wastage records to Data Bin.');
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportSelectedCsv = (recs: WastageRecord[]) => {
    if (recs.length === 0) return;
    const headers = ['Record Number', 'Product', 'Batch', 'Stage', 'Reason', 'Quantity', 'Cost Impact', 'Recoverable'];
    const rows = recs.map((r) => [
      `"${r.record_number ?? r.wastage_number ?? ''}"`,
      `"${(r.product_name ?? r.product_id ?? '').replace(/"/g, '""')}"`,
      `"${r.batch_number ?? ''}"`,
      `"${((r as { stage?: string }).stage ?? 'in_process')}"`,
      `"${typeof r.reason_code === 'object' && r.reason_code !== null ? ((r.reason_code as { name?: string }).name ?? '') : (r.reason_name ?? '')}"`,
      `"${r.quantity ?? '0'}"`,
      `"${r.total_cost ?? (r as { estimated_cost?: string }).estimated_cost ?? '0'}"`,
      `"${(r as { is_recoverable?: boolean }).is_recoverable ? 'YES' : 'NO'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wastage-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by wastage number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Stages' },
              { value: 'input', label: 'Material Input', colorDot: 'bg-blue-500' },
              { value: 'in_process', label: 'In-Process', colorDot: 'bg-amber-500' },
              { value: 'output', label: 'Output Sorting', colorDot: 'bg-emerald-500' },
              { value: 'qc', label: 'QC Rejection', colorDot: 'bg-rose-500' },
              { value: 'storage', label: 'Storage Shrinkage', colorDot: 'bg-purple-500' },
              { value: 'transit', label: 'Transit Loss', colorDot: 'bg-slate-500' },
            ]}
            value={stageFilter}
            onChange={(val) => setStageFilter(val)}
            size="sm"
            aria-label="Filter wastage by stage"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setErrorMsg(null);
            setDraft({
              wastage_number: `WST-${Date.now().toString().slice(-6)}`,
              product_id: products[0]?.id ?? '',
              production_batch_id: batches[0]?.id,
              stage: 'in_process',
              quantity: '1.0000',
              unit_id: units[0]?.id ?? '',
              reason_code_id: reasonCodes[0]?.id ?? '',
              estimated_cost: '10.0000',
              is_recoverable: false,
              warehouse_id: warehouses[0]?.id,
            });
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>Log Material Wastage</span>
        </Button>
      </div>

      {/* Bulk Selection Bar */}
      {selectedRecordIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedRecordIds.size} record{selectedRecordIds.size > 1 ? 's' : ''} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-muted hover:text-default underline cursor-pointer ml-2"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const selected = records.filter((r) => selectedRecordIds.has(r.id));
                exportSelectedCsv(selected);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Move to Bin ({selectedRecordIds.size})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <QueryBoundary
        status={wastageQuery.status}
        error={wastageQuery.error}
        data={wastageQuery.data}
        isFetching={wastageQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <div className="overflow-x-auto min-h-75">
            <table className="w-full text-left text-xs text-default">
              <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all records"
                      className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3">Record Number</th>
                  <th className="py-3.5 px-3">Product / Batch</th>
                  <th className="py-3.5 px-3">Process Stage</th>
                  <th className="py-3.5 px-3">Reason Code</th>
                  <th className="py-3.5 px-3">Quantity</th>
                  <th className="py-3.5 px-3">Cost Impact</th>
                  <th className="py-3.5 px-3">Recovery Status</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken border border-default mb-2">
                        <Trash2 className="h-5 w-5 text-muted" />
                      </div>
                      <div className="text-sm font-medium text-default">
                        No wastage records found
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Track process scrap, damaged materials and manufacturing shrinkage.
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr
                      key={rec.id}
                      className={`hover:bg-surface-sunken/60 transition-colors ${
                        selectedRecordIds.has(rec.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.has(rec.id)}
                          onChange={() => toggleSelectRecord(rec.id)}
                          aria-label={`Select record ${rec.record_number ?? rec.wastage_number}`}
                          className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {rec.record_number ?? rec.wastage_number}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-default font-medium">
                          {rec.product_name ?? rec.product_id}
                        </div>
                        {rec.batch_number && (
                          <div className="text-[10px] font-mono text-muted">
                            Batch: {rec.batch_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 capitalize text-default">
                        <span className="rounded-md bg-surface-sunken border border-default px-2 py-0.5 text-[10px] font-medium text-muted">
                          {((rec as { stage?: string }).stage ?? 'in_process').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-default flex items-center gap-1">
                          <AlertOctagon className="h-3.5 w-3.5 text-amber-500" />
                          <span>
                            {typeof rec.reason_code === 'object' && rec.reason_code !== null
                              ? ((rec.reason_code as { name?: string; code?: string }).name ??
                                 (rec.reason_code as { name?: string; code?: string }).code ??
                                 'Defect')
                              : (rec.reason_name ?? (typeof rec.reason_code === 'string' ? rec.reason_code : 'Defect'))}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {rec.quantity}
                      </td>
                      <td className="py-3 px-3 font-mono text-default flex items-center gap-0.5">
                        <DollarSign className="h-3.5 w-3.5 text-muted" />
                        <span>{rec.total_cost ?? (rec as { estimated_cost?: string }).estimated_cost ?? '0.0000'}</span>
                      </td>
                      <td className="py-3 px-3">
                        {(rec as { is_recoverable?: boolean }).is_recoverable ? (
                          <Badge tone="success-subtle">
                            Recoverable ({(rec as { recovered_quantity?: string }).recovered_quantity ?? '0.00'})
                          </Badge>
                        ) : (
                          <Badge tone="surface-sunken">Scrapped</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Edit wastage record"
                          >
                            <Edit2 className="size-3 text-primary shrink-0" />
                            <span>Edit</span>
                          </button>

                          {/* Prominent Actions Dropdown Button */}
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openActionMenuId === rec.id) {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                } else {
                                  setOpenActionMenuId(rec.id);
                                  setActionMenuAnchor(e.currentTarget);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                openActionMenuId === rec.id
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-default bg-surface hover:bg-surface-sunken text-default'
                              }`}
                              title={`More options for ${rec.record_number ?? rec.wastage_number}`}
                              aria-label={`More options for wastage record`}
                            >
                              <span>Actions</span>
                              <ChevronDown className="size-3 text-muted" />
                            </button>

                            <ActionMenuPortal
                              isOpen={openActionMenuId === rec.id}
                              anchorEl={actionMenuAnchor}
                              onClose={() => {
                                setOpenActionMenuId(null);
                                setActionMenuAnchor(null);
                              }}
                              width={192}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                  openEditModal(rec);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Edit2 className="size-3.5 text-muted shrink-0" />
                                <span>Edit Quantities & Reason</span>
                              </button>

                              {canDelete && (
                                <>
                                  <div className="my-1 border-t border-default/50" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      setDeletingRecord(rec);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                                    <span>Move to Bin</span>
                                  </button>
                                </>
                              )}
                            </ActionMenuPortal>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </QueryBoundary>

      {/* Create Wastage Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Record Scrap / Material Wastage"
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Wastage Number
              </label>
              <input
                type="text"
                value={draft.wastage_number}
                onChange={(e) => setDraft((d) => ({ ...d, wastage_number: e.target.value }))}
                placeholder="e.g. WST-2026-001"
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Process Stage
              </label>
              <select
                value={draft.stage}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    stage: e.target.value as CreateWastageDraft['stage'],
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="input">Material Input</option>
                <option value="in_process">In-Process</option>
                <option value="output">Output Sorting</option>
                <option value="qc">QC Rejection</option>
                <option value="storage">Storage Shrinkage</option>
                <option value="transit">Transit Damage</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Product Item
              </label>
              <select
                value={draft.product_id}
                onChange={(e) => setDraft((d) => ({ ...d, product_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Batch Run (Optional)
              </label>
              <select
                value={draft.production_batch_id ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    production_batch_id: e.target.value || undefined,
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">None (Independent Shrinkage)</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Scrap Quantity
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <select
                value={draft.unit_id}
                onChange={(e) => setDraft((d) => ({ ...d, unit_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Cost Impact
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.estimated_cost}
                onChange={(e) => setDraft((d) => ({ ...d, estimated_cost: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Reason Code
              </label>
              <select
                value={draft.reason_code_id}
                onChange={(e) => setDraft((d) => ({ ...d, reason_code_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                {reasonCodes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Target Warehouse
              </label>
              <select
                value={draft.warehouse_id ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, warehouse_id: e.target.value || undefined }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">None / Floor Scrap</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recoverable"
                checked={draft.is_recoverable}
                onChange={(e) => setDraft((d) => ({ ...d, is_recoverable: e.target.checked }))}
                className="rounded border-default text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="is_recoverable" className="text-xs text-default font-medium">
                Partially recoverable material (Can be recycled or melted back into production)
              </label>
            </div>

            {draft.is_recoverable && (
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Expected Recovery Quantity
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={draft.recovered_quantity ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, recovered_quantity: e.target.value }))}
                  placeholder="e.g. 2.0000"
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Remarks & Root Cause
            </label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
              placeholder="Root cause notes, defective batch run details, operator observations..."
              className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => createMutation.mutate(draft)}
              disabled={
                createMutation.isPending ||
                !draft.product_id ||
                !draft.reason_code_id ||
                !draft.wastage_number
              }
            >
              {createMutation.isPending ? 'Logging...' : 'Confirm Wastage Entry'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Wastage Modal */}
      {editingRecord && (
        <Modal
          open={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Wastage Record: ${editingRecord.record_number ?? editingRecord.wastage_number}`}
        >
          <div className="space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Process Stage
                </label>
                <select
                  value={editForm.stage}
                  onChange={(e) =>
                    setEditForm((d) => ({
                      ...d,
                      stage: e.target.value as EditWastageDraft['stage'],
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="input">Material Input</option>
                  <option value="in_process">In-Process</option>
                  <option value="output">Output Sorting</option>
                  <option value="qc">QC Rejection</option>
                  <option value="storage">Storage Shrinkage</option>
                  <option value="transit">Transit Damage</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Warehouse
                </label>
                <select
                  value={editForm.warehouse_id ?? ''}
                  onChange={(e) =>
                    setEditForm((d) => ({
                      ...d,
                      warehouse_id: e.target.value || undefined,
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="">None / Floor Scrap</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((d) => ({ ...d, quantity: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Cost Impact
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.estimated_cost}
                  onChange={(e) => setEditForm((d) => ({ ...d, estimated_cost: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_recoverable"
                  checked={editForm.is_recoverable}
                  onChange={(e) => setEditForm((d) => ({ ...d, is_recoverable: e.target.checked }))}
                  className="rounded border-default text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="edit_is_recoverable" className="text-xs text-default font-medium">
                  Partially recoverable material
                </label>
              </div>

              {editForm.is_recoverable && (
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Recovered / Salvaged Quantity
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editForm.recovered_quantity ?? ''}
                    onChange={(e) =>
                      setEditForm((d) => ({ ...d, recovered_quantity: e.target.value }))
                    }
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Remarks
              </label>
              <textarea
                value={editForm.notes ?? ''}
                onChange={(e) => setEditForm((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setEditingRecord(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  updateMutation.mutate({
                    id: editingRecord.id,
                    payload: editForm,
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Record'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Move to Bin Dialog */}
      <ConfirmDialog
        open={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={() => {
          if (deletingRecord) {
            deleteMutation.mutate(deletingRecord.id);
          }
        }}
        title="Move Wastage Record to Data Bin"
        message={`Are you sure you want to move wastage record "${deletingRecord?.record_number ?? deletingRecord?.wastage_number ?? ''}" to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel={deleteMutation.isPending ? 'Moving...' : 'Move to Bin'}
        variant="danger"
      />

      {/* Bulk Move to Bin Dialog */}
      <ConfirmDialog
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Move Selected Wastage Records to Data Bin"
        message={`Are you sure you want to move ${selectedRecordIds.size} wastage record(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`}
        confirmLabel={isBulkDeleting ? 'Moving...' : `Move ${selectedRecordIds.size} Record(s) to Bin`}
        variant="danger"
      />
    </div>
  );
}
