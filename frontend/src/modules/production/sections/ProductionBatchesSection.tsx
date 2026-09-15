import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Box,
  Calendar,
  CheckCircle2,
  Factory,
  Info,
  Layers,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Download,
  CheckSquare,
  X,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { isApiError } from '../../../lib/api/errors';
import { cn } from '../../../lib/utils';
import type { ProductionBatch } from '../../../types/api/production';
import type { Product, Warehouse } from '../../../types/api/catalog';
import type { BillOfMaterial } from '../../../types/api/bom';

interface CreateBatchDraft {
  batch_number: string;
  plan_id?: string;
  product_id: string;
  bom_id: string;
  target_quantity: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

interface RecordInputDraft {
  product_id: string;
  warehouse_id: string;
  warehouse_location_id?: string;
  planned_quantity: string;
  actual_quantity: string;
  unit_cost: string;
}

interface RecordOutputDraft {
  product_id: string;
  warehouse_id: string;
  warehouse_location_id?: string;
  output_type: 'finished_good' | 'byproduct' | 'co_product';
  good_quantity: string;
  rejected_quantity: string;
  unit_cost: string;
}

export function ProductionBatchesSection() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeBatchModal, setActiveBatchModal] = useState<{
    batch: ProductionBatch;
    type: 'input' | 'output' | 'details';
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<CreateBatchDraft>(() => ({
    batch_number: '',
    product_id: '',
    bom_id: '',
    target_quantity: '100.0000',
    scheduled_start: new Date().toISOString().slice(0, 10),
    scheduled_end: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  }));

  const [inputDraft, setInputDraft] = useState<RecordInputDraft>({
    product_id: '',
    warehouse_id: '',
    planned_quantity: '50.0000',
    actual_quantity: '50.0000',
    unit_cost: '10.0000',
  });

  const [outputDraft, setOutputDraft] = useState<RecordOutputDraft>({
    product_id: '',
    warehouse_id: '',
    output_type: 'finished_good',
    good_quantity: '98.0000',
    rejected_quantity: '2.0000',
    unit_cost: '15.0000',
  });

  const queryClient = useQueryClient();

  // Queries
  const batchesQuery = useQuery({
    queryKey: ['production', 'batches', search, statusFilter],
    queryFn: ({ signal }) =>
      api.get<ProductionBatch[]>('/production/batches', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        },
      }),
  });

  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'options'],
    queryFn: ({ signal }) => api.get<Product[]>('/products', { signal }),
  });

  const bomsQuery = useQuery({
    queryKey: ['catalogue', 'boms', 'options'],
    queryFn: ({ signal }) => api.get<BillOfMaterial[]>('/bill-of-materials', { signal }),
  });

  const warehousesQuery = useQuery({
    queryKey: ['catalogue', 'warehouses', 'options'],
    queryFn: ({ signal }) => api.get<Warehouse[]>('/warehouses', { signal }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateBatchDraft) => {
      const selectedBom = boms.find((b) => b.id === payload.bom_id);
      const selectedProduct = products.find((p) => p.id === payload.product_id);
      const requestPayload = {
        batch_number: payload.batch_number,
        product_id: payload.product_id,
        bill_of_material_id: payload.bom_id,
        bom_id: payload.bom_id,
        planned_quantity: payload.target_quantity,
        target_quantity: payload.target_quantity,
        batch_date: payload.scheduled_start || new Date().toISOString().slice(0, 10),
        scheduled_start: payload.scheduled_start || new Date().toISOString().slice(0, 10),
        output_unit_id: selectedBom?.output_unit_id || selectedProduct?.base_unit_id,
      };
      return api.post<ProductionBatch>('/production/batches', requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      setIsCreateOpen(false);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.fields && typeof err.fields === 'object') {
          const firstErr = Object.values(err.fields).flat()[0];
          setErrorMsg(typeof firstErr === 'string' ? firstErr : (err.message ?? 'Failed to create batch.'));
        } else {
          setErrorMsg(err.message ?? 'Failed to create batch.');
        }
      } else {
        setErrorMsg('Error creating batch.');
      }
    },
  });

  const startMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.post<ProductionBatch>(`/production/batches/${batchId}/start`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
  });

  const recordInputMutation = useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: RecordInputDraft }) =>
      api.post(`/production/batches/${batchId}/inputs`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      setActiveBatchModal(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to record material input.');
    },
  });

  const recordOutputMutation = useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: RecordOutputDraft }) =>
      api.post(`/production/batches/${batchId}/outputs`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      setActiveBatchModal(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to record output.');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.post<ProductionBatch>(`/production/batches/${batchId}/analyze`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.post<ProductionBatch>(`/production/batches/${batchId}/complete`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.post<ProductionBatch>(`/production/batches/${batchId}/close`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to close batch.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ batchId, status }: { batchId: string; status: string }) =>
      api.patch<ProductionBatch>(`/production/batches/${batchId}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to update batch status.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (batchId: string) => api.delete(`/production/batches/${batchId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to delete batch.');
    },
  });

  const batches = batchesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const boms = bomsQuery.data?.data ?? [];
  const warehouses = warehousesQuery.data?.data ?? [];

  // Multi-Record Batch Selection & Floating Toolbar State
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await Promise.allSettled(
        Array.from(selectedBatchIds).map((id) => api.delete(`/production/batches/${id}`))
      );
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      setSelectedBatchIds(new Set());
      setShowBulkDeleteModal(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleOpenBatchDetails = (batch: ProductionBatch) => {
    setActiveBatchModal({ batch, type: 'details' });
    void api.get<ProductionBatch>(`/production/batches/${(batch as unknown as { uuid?: string }).uuid || batch.id}`).then((res) => {
      if (res.data) {
        setActiveBatchModal((prev) => (prev?.type === 'details' ? { ...prev, batch: res.data } : prev));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const isAllSelected = batches.length > 0 && selectedBatchIds.size === batches.length;
  const isSomeSelected = selectedBatchIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedBatchIds.size > 0) {
        setSelectedBatchIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBatchIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(batches.map((b) => b.id)));
    }
  };

  const toggleSelectBatch = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedBatchIds(new Set());

  const exportBatchesCsv = (batchesToExport: ProductionBatch[]) => {
    if (batchesToExport.length === 0) {
      return;
    }
    const headers = ['Batch Number', 'Product', 'SKU', 'BOM', 'Status', 'Target Qty', 'Actual Qty', 'Yield Pct', 'Scheduled Start', 'Scheduled End'];
    const rows = batchesToExport.map((b) => [
      `"${(b.batch_number || '').replace(/"/g, '""')}"`,
      `"${(b.product_name || b.product_id || '').replace(/"/g, '""')}"`,
      `"${b.product_sku || ''}"`,
      `"${(b.bom_name || '').replace(/"/g, '""')}"`,
      `"${b.status}"`,
      `"${b.target_quantity}"`,
      `"${b.actual_quantity}"`,
      `"${b.actual_yield_pct ?? b.yield_percentage ?? ''}"`,
      `"${b.scheduled_start || ''}"`,
      `"${b.scheduled_end || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `production_batches_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCompletenessBadge = (state: ProductionBatch['context_completeness']) => {
    switch (state) {
      case 'context_complete':
      case 'analysed':
        return <Badge tone="success-subtle">Complete</Badge>;
      case 'collecting':
        return <Badge tone="warning-subtle">Collecting</Badge>;
      case 'closed':
        return <Badge tone="surface-sunken">Closed</Badge>;
      default:
        return <Badge tone="surface-sunken">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search batches by batch number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken py-2 pl-9 pr-3.5 text-xs text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-2xs"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft', colorDot: 'bg-slate-400' },
              { value: 'scheduled', label: 'Scheduled', colorDot: 'bg-indigo-500' },
              { value: 'in_progress', label: 'In Progress', colorDot: 'bg-blue-500' },
              { value: 'completed', label: 'Completed', colorDot: 'bg-emerald-500' },
              { value: 'closed', label: 'Closed', colorDot: 'bg-purple-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter batches by status"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setErrorMsg(null);
            const firstProduct = products[0];
            const matchingBom = firstProduct
              ? boms.find((b) => b.product_id === firstProduct.id) || boms[0]
              : boms[0];
            setCreateDraft({
              batch_number: `BAT-${Date.now().toString().slice(-6)}`,
              product_id: firstProduct?.id ?? '',
              bom_id: matchingBom?.id ?? '',
              target_quantity: '100.0000',
              scheduled_start: new Date().toISOString().slice(0, 10),
              scheduled_end: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
            });
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="size-4" />
          <span>New Production Batch</span>
        </Button>
      </div>

      {/* Selection Summary & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="font-medium text-default">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'} listed
          </span>
          {selectedBatchIds.size > 0 && (
            <span className="text-primary font-semibold">
              ({selectedBatchIds.size} selected)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedBatchIds.size > 0 ? (
            <>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-muted hover:text-default underline cursor-pointer"
              >
                Clear Selection
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const selected = batches.filter((b) => selectedBatchIds.has(b.id));
                  exportBatchesCsv(selected);
                }}
                className="flex items-center gap-1.5 text-xs text-primary"
              >
                <Download className="size-3.5" />
                <span>Export Selected CSV ({selectedBatchIds.size})</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowBulkDeleteModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="size-3.5" />
                <span>Bulk Delete ({selectedBatchIds.size})</span>
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-muted hover:text-default underline cursor-pointer"
              >
                Select All
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportBatchesCsv(batches)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-default"
                disabled={batches.length === 0}
              >
                <Download className="size-3.5 text-muted" />
                <span>Export All Batches CSV</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Batches Table with Subtle 1px Outline */}
      <QueryBoundary
        status={batchesQuery.status}
        error={batchesQuery.error}
        data={batchesQuery.data}
        isFetching={batchesQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <div className="overflow-x-auto min-h-75">
            <table className="w-full text-left text-xs text-default border-collapse">
              <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all batches"
                      className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Batch No</th>
                  <th className="px-4 py-3.5">Product / BOM</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Target / Actual</th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">Yield</th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">Context</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-surface-sunken mb-2 border border-default">
                        <Factory className="size-5 text-muted" />
                      </div>
                      <div className="text-sm font-medium text-default">
                        No production batches found
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Create your first batch to start tracking shop floor execution.
                      </div>
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => {
                    const isSelected = selectedBatchIds.has(batch.id);
                    return (
                      <tr
                        key={batch.id}
                        className={cn(
                          'hover:bg-surface-sunken/60 transition-colors',
                          isSelected && 'bg-primary/5'
                        )}
                      >
                        <td className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectBatch(batch.id)}
                            aria-label={`Select batch ${batch.batch_number}`}
                            className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-primary">
                            {batch.batch_number}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-default">
                            {batch.product_name ?? batch.product_id}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                            {batch.product_sku && (
                              <span className="font-mono">{batch.product_sku}</span>
                            )}
                            {batch.bom_name && (
                              <span>• BOM: {batch.bom_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="font-mono text-default font-semibold flex items-baseline justify-end gap-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{batch.actual_quantity}</span>
                            <span className="text-muted text-[11px]">/</span>
                            <span className="text-muted font-normal">{batch.target_quantity}</span>
                          </div>
                          <div className="mt-1 w-24 ml-auto h-1.5 rounded-full bg-surface-sunken overflow-hidden border border-default/50">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, (Number(batch.actual_quantity || 0) / (Number(batch.target_quantity) || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {batch.actual_yield_pct !== null ? (
                            <div className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                              <TrendingUp className="size-3.5" />
                              <span>{batch.actual_yield_pct}%</span>
                              {batch.yield_variance_pct && (
                                <span className="text-[10px] text-muted font-normal">
                                  ({batch.yield_variance_pct}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => analyzeMutation.mutate(batch.id)}
                              disabled={analyzeMutation.isPending}
                              className="group inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors cursor-pointer py-0.5 px-2 rounded-lg hover:bg-surface-sunken border border-dashed border-default"
                              title="Click to calculate and analyze yield"
                            >
                              <Sparkles className="size-3 text-amber-500 group-hover:scale-110 transition-transform" />
                              <span>Yield</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <StatusBadge status={batch.status} />
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {getCompletenessBadge(batch.context_completeness)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 relative">
                            {/* 1. Context-Sensitive Primary Action */}
                            {(batch.status === 'draft' || batch.status === 'scheduled') && (
                              <button
                                type="button"
                                onClick={() => startMutation.mutate(batch.id)}
                                disabled={startMutation.isPending}
                                className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Start Production Run"
                              >
                                <Play className="size-3 fill-emerald-600 dark:fill-emerald-400 shrink-0" />
                                <span>Start</span>
                              </button>
                            )}

                            {batch.status === 'in_progress' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setErrorMsg(null);
                                  setOutputDraft({
                                    product_id: batch.product_id,
                                    warehouse_id: warehouses[0]?.id ?? '',
                                    output_type: 'finished_good',
                                    good_quantity: batch.target_quantity,
                                    rejected_quantity: '0.0000',
                                    unit_cost: '15.0000',
                                  });
                                  setActiveBatchModal({ batch, type: 'output' });
                                }}
                                className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Record Finished Output"
                              >
                                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Output</span>
                              </button>
                            )}

                            {batch.status === 'completed' && (
                              <Link
                                to={`/qc?tab=inspections`}
                                className="px-2.5 py-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors shadow-2xs flex items-center gap-1"
                                title="Route finished batch to Quality Control for inspection"
                              >
                                <ShieldCheck className="size-3 shrink-0" />
                                <span>QC</span>
                              </Link>
                            )}

                            {batch.status === 'closed' && (
                              <button
                                type="button"
                                onClick={() => handleOpenBatchDetails(batch)}
                                className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="View batch details"
                              >
                                <Layers className="size-3 text-primary shrink-0" />
                                <span>Details</span>
                              </button>
                            )}

                            {/* 2. Prominent Actions Dropdown Button */}
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openActionMenuId === batch.id) {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                  } else {
                                    setOpenActionMenuId(batch.id);
                                    setActionMenuAnchor(e.currentTarget);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                  openActionMenuId === batch.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-default bg-surface hover:bg-surface-sunken text-default'
                                }`}
                                title={`More actions for batch ${batch.batch_number}`}
                                aria-label={`More options for batch ${batch.batch_number}`}
                              >
                                <span>Actions</span>
                                <ChevronDown className="size-3 text-muted" />
                              </button>

                              {/* Dropdown Menu via Portal */}
                              <ActionMenuPortal
                                isOpen={openActionMenuId === batch.id}
                                anchorEl={actionMenuAnchor}
                                onClose={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                }}
                                width={208}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                    handleOpenBatchDetails(batch);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <Layers className="size-3.5 text-primary shrink-0" />
                                  <span>Batch Details</span>
                                </button>

                                {batch.status === 'in_progress' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      setErrorMsg(null);
                                      setInputDraft({
                                        product_id: batch.product_id,
                                        warehouse_id: warehouses[0]?.id ?? '',
                                        planned_quantity: '50.0000',
                                        actual_quantity: '50.0000',
                                        unit_cost: '10.0000',
                                      });
                                      setActiveBatchModal({ batch, type: 'input' });
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                                  >
                                    <Box className="size-3.5 text-blue-500 shrink-0" />
                                    <span>Issue Raw Materials</span>
                                  </button>
                                )}

                                {batch.status === 'in_progress' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      completeMutation.mutate(batch.id);
                                    }}
                                    disabled={completeMutation.isPending}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                    <span>Mark Complete</span>
                                  </button>
                                )}

                                {batch.status === 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      closeMutation.mutate(batch.id);
                                    }}
                                    disabled={closeMutation.isPending}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                                  >
                                    <CheckSquare className="size-3.5 text-purple-500 shrink-0" />
                                    <span>Close Batch</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                    analyzeMutation.mutate(batch.id);
                                  }}
                                  disabled={analyzeMutation.isPending}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                                  <span>Analyze Yield</span>
                                </button>

                                <div className="px-2.5 py-1.5">
                                  <span className="text-[10px] uppercase font-semibold text-muted block mb-1">Set Status</span>
                                  <select
                                    value={batch.status}
                                    onChange={(e) => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      updateStatusMutation.mutate({ batchId: batch.id, status: e.target.value });
                                    }}
                                    className="w-full h-7 rounded-lg border border-default bg-surface-sunken px-2 text-[11px] font-medium text-default focus:border-primary focus:outline-none cursor-pointer"
                                  >
                                    <option value="draft">Draft</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="closed">Closed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>

                                <div className="my-1 border-t border-default/50" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                    setDeleteConfirm({
                                      open: true,
                                      id: batch.id,
                                      name: batch.batch_number,
                                    });
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                                  <span>Delete Batch</span>
                                </button>
                              </ActionMenuPortal>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </QueryBoundary>

      {/* Create Batch Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Launch Production Batch"
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Batch Number
            </label>
            <input
              type="text"
              value={createDraft.batch_number}
              onChange={(e) => setCreateDraft((d) => ({ ...d, batch_number: e.target.value }))}
              placeholder="e.g. BAT-2026-001"
              className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Product to Produce
              </label>
              <select
                value={createDraft.product_id}
                onChange={(e) => {
                  const newProductId = e.target.value;
                  const matchingBom = boms.find((b) => b.product_id === newProductId);
                  setCreateDraft((d) => ({
                    ...d,
                    product_id: newProductId,
                    bom_id: matchingBom ? matchingBom.id : d.bom_id,
                  }));
                }}
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
                BOM Specification
              </label>
              <select
                value={createDraft.bom_id}
                onChange={(e) => setCreateDraft((d) => ({ ...d, bom_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                {(boms.filter((b) => !createDraft.product_id || b.product_id === createDraft.product_id).length > 0
                  ? boms.filter((b) => !createDraft.product_id || b.product_id === createDraft.product_id)
                  : boms
                ).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code ? `${b.code} - ` : ''}{b.name} (v{b.version})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Target Quantity
            </label>
            <input
              type="number"
              step="0.0001"
              value={createDraft.target_quantity}
              onChange={(e) => setCreateDraft((d) => ({ ...d, target_quantity: e.target.value }))}
              className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => createMutation.mutate(createDraft)}
              disabled={createMutation.isPending || !createDraft.batch_number}
            >
              {createMutation.isPending ? 'Launching...' : 'Launch Batch'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Record Input Modal */}
      {activeBatchModal?.type === 'input' && (
        <Modal
          open={Boolean(activeBatchModal)}
          onClose={() => setActiveBatchModal(null)}
          title={`Record Material Input: ${activeBatchModal.batch.batch_number}`}
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
                  Raw Material / Component
                </label>
                <select
                  value={inputDraft.product_id}
                  onChange={(e) => setInputDraft((d) => ({ ...d, product_id: e.target.value }))}
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
                  Source Warehouse
                </label>
                <select
                  value={inputDraft.warehouse_id}
                  onChange={(e) => setInputDraft((d) => ({ ...d, warehouse_id: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Actual Issued Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={inputDraft.actual_quantity}
                  onChange={(e) =>
                    setInputDraft((d) => ({ ...d, actual_quantity: e.target.value }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Unit Cost (Standard)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={inputDraft.unit_cost}
                  onChange={(e) => setInputDraft((d) => ({ ...d, unit_cost: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setActiveBatchModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  recordInputMutation.mutate({
                    batchId: activeBatchModal.batch.id,
                    payload: inputDraft,
                  })
                }
                disabled={recordInputMutation.isPending}
              >
                {recordInputMutation.isPending ? 'Recording...' : 'Record Issue'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Output Modal */}
      {activeBatchModal?.type === 'output' && (
        <Modal
          open={Boolean(activeBatchModal)}
          onClose={() => setActiveBatchModal(null)}
          title={`Record Batch Output: ${activeBatchModal.batch.batch_number}`}
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
                  Destination Warehouse
                </label>
                <select
                  value={outputDraft.warehouse_id}
                  onChange={(e) => setOutputDraft((d) => ({ ...d, warehouse_id: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Output Type
                </label>
                <select
                  value={outputDraft.output_type}
                  onChange={(e) =>
                    setOutputDraft((d) => ({
                      ...d,
                      output_type: e.target.value as 'finished_good' | 'byproduct' | 'co_product',
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="finished_good">Finished Good</option>
                  <option value="byproduct">Byproduct</option>
                  <option value="co_product">Co-Product</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Good Quantity
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={outputDraft.good_quantity}
                  onChange={(e) => setOutputDraft((d) => ({ ...d, good_quantity: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Rejected / Scrap Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={outputDraft.rejected_quantity}
                  onChange={(e) =>
                    setOutputDraft((d) => ({ ...d, rejected_quantity: e.target.value }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setActiveBatchModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  recordOutputMutation.mutate({
                    batchId: activeBatchModal.batch.id,
                    payload: outputDraft,
                  })
                }
                disabled={recordOutputMutation.isPending}
              >
                {recordOutputMutation.isPending ? 'Recording...' : 'Record Output'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Full Details Modal */}
      {activeBatchModal?.type === 'details' && (
        <Modal
          open={Boolean(activeBatchModal)}
          onClose={() => setActiveBatchModal(null)}
          title={`Batch Overview: ${activeBatchModal.batch.batch_number}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Batch Context & Header Info */}
            <div className="rounded-xl bg-surface-sunken p-3.5 border border-border space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeBatchModal.batch.status} />
                  {getCompletenessBadge(activeBatchModal.batch.context_completeness)}
                </div>
                {activeBatchModal.batch.batch_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar className="size-3.5 text-muted" />
                    <span>Batch Date: <strong className="font-mono text-default">{activeBatchModal.batch.batch_date}</strong></span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Product
                  </div>
                  <div className="font-semibold text-default mt-0.5 flex items-center gap-1.5">
                    <Box className="size-3.5 text-primary shrink-0" />
                    <span>{activeBatchModal.batch.product_name ?? activeBatchModal.batch.product_id}</span>
                  </div>
                  {activeBatchModal.batch.product_sku && (
                    <div className="text-[10px] text-muted font-mono pl-5">
                      SKU: {activeBatchModal.batch.product_sku}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    BOM Specification
                  </div>
                  <div className="font-medium text-default mt-0.5 flex items-center gap-1.5">
                    <Factory className="size-3.5 text-muted shrink-0" />
                    <span>{activeBatchModal.batch.bom_name ?? 'Standard Production Assembly BOM'}</span>
                  </div>
                  <div className="text-[10px] text-muted pl-5">
                    Target: <span className="font-mono font-semibold text-default">{activeBatchModal.batch.target_quantity ?? activeBatchModal.batch.planned_quantity ?? '0.0000'}</span> {activeBatchModal.batch.output_unit_code ?? 'Units'}
                  </div>
                </div>
              </div>
            </div>

            {/* Input / Output / Loss Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-sunken p-3 border border-border">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Total Input
                </div>
                <div className="text-base font-bold font-mono text-default mt-1">
                  {activeBatchModal.batch.total_input_quantity || '0.0000'}
                </div>
                <div className="text-[10px] text-muted mt-0.5">Raw materials issued</div>
              </div>
              <div className="rounded-xl bg-surface-sunken p-3 border border-border">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Total Output
                </div>
                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {activeBatchModal.batch.total_output_quantity || activeBatchModal.batch.actual_quantity || '0.0000'}
                </div>
                <div className="text-[10px] text-muted mt-0.5">Finished good units</div>
              </div>
              <div className="rounded-xl bg-surface-sunken p-3 border border-border">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Process Loss
                </div>
                <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                  {activeBatchModal.batch.process_loss_quantity || activeBatchModal.batch.variance_quantity || '0.0000'}
                </div>
                <div className="text-[10px] text-muted mt-0.5">Scrap & test variance</div>
              </div>
            </div>

            {/* Yield & Process Performance */}
            <div className="rounded-xl bg-surface-sunken p-3.5 border border-border space-y-2.5">
              <div className="text-xs font-semibold text-default flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="size-4 text-emerald-500" />
                  <span>Yield & Process Performance</span>
                </div>
                {activeBatchModal.batch.yield_percentage && (
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {activeBatchModal.batch.yield_percentage}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-surface/50 p-2 border border-border/40">
                  <span className="text-muted block text-[10px] uppercase">Expected</span>
                  <span className="font-mono text-default font-semibold">
                    {activeBatchModal.batch.expected_yield_pct ?? '100.00'}%
                  </span>
                </div>
                <div className="rounded-lg bg-surface/50 p-2 border border-border/40">
                  <span className="text-muted block text-[10px] uppercase">Actual</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {activeBatchModal.batch.actual_yield_pct ?? activeBatchModal.batch.yield_percentage ?? (Number(activeBatchModal.batch.total_input_quantity) > 0 ? `${((Number(activeBatchModal.batch.total_output_quantity) / Number(activeBatchModal.batch.total_input_quantity)) * 100).toFixed(2)}` : null) ?? 'Pending'}%
                  </span>
                </div>
                <div className="rounded-lg bg-surface/50 p-2 border border-border/40">
                  <span className="text-muted block text-[10px] uppercase">Variance</span>
                  <span className="font-mono text-default font-semibold">
                    {activeBatchModal.batch.yield_variance_pct ?? activeBatchModal.batch.variance_percentage ?? '0.00'}%
                  </span>
                </div>
              </div>

              {Number(activeBatchModal.batch.total_input_quantity) === 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface/60 border border-border/60 text-[11px] text-muted">
                  <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    This batch is freshly initialized. Issue raw materials from inventory and log production outputs to begin real-time yield tracking.
                  </span>
                </div>
              )}
            </div>

            {/* Actions / Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                {(activeBatchModal.batch.status === 'draft' || activeBatchModal.batch.status === 'scheduled') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      startMutation.mutate(activeBatchModal.batch.id);
                      setActiveBatchModal(null);
                    }}
                    disabled={startMutation.isPending}
                    className="flex items-center gap-1.5"
                  >
                    <Play className="size-3.5" />
                    <span>Start Batch</span>
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setErrorMsg(null);
                    setInputDraft({
                      product_id: activeBatchModal.batch.product_id,
                      warehouse_id: warehouses[0]?.id ?? '',
                      planned_quantity: '50.0000',
                      actual_quantity: '50.0000',
                      unit_cost: '10.0000',
                    });
                    setActiveBatchModal({ batch: activeBatchModal.batch, type: 'input' });
                  }}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  <Plus className="size-3.5" />
                  <span>Issue Material</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setErrorMsg(null);
                    setOutputDraft({
                      product_id: activeBatchModal.batch.product_id,
                      warehouse_id: warehouses[0]?.id ?? '',
                      output_type: 'finished_good',
                      good_quantity: activeBatchModal.batch.target_quantity,
                      rejected_quantity: '0.0000',
                      unit_cost: '15.0000',
                    });
                    setActiveBatchModal({ batch: activeBatchModal.batch, type: 'output' });
                  }}
                  className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                >
                  <Plus className="size-3.5" />
                  <span>Record Output</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    analyzeMutation.mutate(activeBatchModal.batch.id);
                    setActiveBatchModal(null);
                  }}
                  disabled={analyzeMutation.isPending}
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-400"
                >
                  <Sparkles className="size-3.5" />
                  <span>Analyze Yield</span>
                </Button>
              </div>

              <Button variant="secondary" onClick={() => setActiveBatchModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Batch Confirmation Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: '', name: '' })}
        title="Confirm Batch Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-default">
            Are you sure you want to delete production batch{' '}
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              {deleteConfirm.name}
            </span>
            ? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirm({ open: false, id: '', name: '' })}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                deleteMutation.mutate(deleteConfirm.id);
                setDeleteConfirm({ open: false, id: '', name: '' });
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Bottom Docked Action Toolbar */}
      {selectedBatchIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface border border-primary/40 shadow-xl ring-1 ring-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-default">
            <CheckSquare className="size-4 text-primary" />
            <span className="text-xs font-bold text-default whitespace-nowrap">
              {selectedBatchIds.size} {selectedBatchIds.size === 1 ? 'batch' : 'batches'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const selected = batches.filter((b) => selectedBatchIds.has(b.id));
                exportBatchesCsv(selected);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Bulk Delete ({selectedBatchIds.size})</span>
            </Button>

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              title="Clear selection (Esc)"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <Modal
          open={showBulkDeleteModal}
          onClose={() => !isBulkDeleting && setShowBulkDeleteModal(false)}
          title="Confirm Bulk Deletion"
        >
          <div className="space-y-4">
            <p className="text-sm text-default">
              Are you sure you want to permanently delete{' '}
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {selectedBatchIds.size}
              </span>{' '}
              selected production batches? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button
                variant="ghost"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedBatchIds.size} Batches`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
