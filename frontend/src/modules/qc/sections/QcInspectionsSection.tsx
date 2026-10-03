import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit2,
  Eye,
  Microscope,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
  RotateCcw,
  ChevronDown,
  Calculator,
  AlertOctagon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { isApiError } from '../../../lib/api/errors';
import type { QcInspection, QcParameter } from '../../../types/api/qc';
import type { ProductionBatch } from '../../../types/api/production';
import type { Product } from '../../../types/api/catalog';

interface CreateInspectionDraft {
  batch_id?: string | undefined;
  product_id: string;
  inspection_type: 'incoming' | 'in_process' | 'final';
  sample_size: string;
  inspected_quantity: string;
  passed_quantity: string;
  rejected_quantity: string;
  inspection_date: string;
  result: 'pass' | 'fail' | 'partial' | 'hold';
  notes?: string;
  results: {
    qc_parameter_id: string;
    parameter_name?: string;
    measured_value?: string;
    is_passed: boolean;
    remarks?: string;
  }[];
  defects: {
    defect_type: string;
    severity: 'minor' | 'major' | 'critical';
    quantity: string;
    description?: string;
  }[];
}

interface EditInspectionDraft {
  sample_size: string;
  inspected_quantity: string;
  passed_quantity: string;
  rejected_quantity: string;
  result: 'pass' | 'fail' | 'partial' | 'hold';
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  notes?: string;
}

function generateInspectionNumber(): string {
  return `QC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

function generateReworkNumber(): string {
  return `RWK-${Date.now().toString().slice(-6)}`;
}

function generateWastageNumber(): string {
  return `WST-${Date.now().toString().slice(-6)}`;
}

export function QcInspectionsSection() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<QcInspection | null>(null);
  const [editingInspection, setEditingInspection] = useState<QcInspection | null>(null);
  const [editForm, setEditForm] = useState<EditInspectionDraft>({
    sample_size: '10.0000',
    inspected_quantity: '10.0000',
    passed_quantity: '10.0000',
    rejected_quantity: '0.0000',
    result: 'pass',
    status: 'draft',
    notes: '',
  });
  const [deletingInspection, setDeletingInspection] = useState<QcInspection | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateInspectionDraft>({
    product_id: '',
    inspection_type: 'in_process',
    sample_size: '10.0000',
    inspected_quantity: '10.0000',
    passed_quantity: '10.0000',
    rejected_quantity: '0.0000',
    inspection_date: new Date().toISOString().slice(0, 10),
    result: 'pass',
    results: [],
    defects: [],
  });

  // AQL Calculator & Defect Routing State
  const [showAqlModal, setShowAqlModal] = useState(false);
  const [aqlLotSize, setAqlLotSize] = useState('500');
  const [aqlLevel, setAqlLevel] = useState<'I' | 'II' | 'III'>('II');
  const [aqlTarget, setAqlTarget] = useState<1.0 | 1.5 | 2.5 | 4.0>(2.5);
  const [autoCreateRework, setAutoCreateRework] = useState(true);
  const [autoCreateWastage, setAutoCreateWastage] = useState(false);
  const [isDispatchingRework, setIsDispatchingRework] = useState(false);

  const getAqlCalculation = (
    lotSize: number,
    level: 'I' | 'II' | 'III' = 'II',
    aql: 1.0 | 1.5 | 2.5 | 4.0 = 2.5
  ) => {
    let rangeIdx: number;
    if (lotSize <= 8) rangeIdx = 0;
    else if (lotSize <= 15) rangeIdx = 1;
    else if (lotSize <= 25) rangeIdx = 2;
    else if (lotSize <= 50) rangeIdx = 3;
    else if (lotSize <= 90) rangeIdx = 4;
    else if (lotSize <= 150) rangeIdx = 5;
    else if (lotSize <= 280) rangeIdx = 6;
    else if (lotSize <= 500) rangeIdx = 7;
    else if (lotSize <= 1200) rangeIdx = 8;
    else if (lotSize <= 3200) rangeIdx = 9;
    else if (lotSize <= 10000) rangeIdx = 10;
    else if (lotSize <= 35000) rangeIdx = 11;
    else if (lotSize <= 150000) rangeIdx = 12;
    else if (lotSize <= 500000) rangeIdx = 13;
    else rangeIdx = 14;

    const letterMatrix: Record<'I' | 'II' | 'III', string[]> = {
      I: ['A', 'A', 'B', 'C', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N'],
      II: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q'],
      III: ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'],
    };

    const codeLetter = letterMatrix[level][rangeIdx] ?? 'J';
    const sampleSizeMap: Record<string, number> = {
      A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50,
      J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000,
    };
    const sampleSize = sampleSizeMap[codeLetter] || 80;

    const aqlTable: Record<string, Record<number, [number, number]>> = {
      A: { 1.0: [0, 1], 1.5: [0, 1], 2.5: [0, 1], 4.0: [0, 1] },
      B: { 1.0: [0, 1], 1.5: [0, 1], 2.5: [0, 1], 4.0: [0, 1] },
      C: { 1.0: [0, 1], 1.5: [0, 1], 2.5: [0, 1], 4.0: [0, 1] },
      D: { 1.0: [0, 1], 1.5: [0, 1], 2.5: [0, 1], 4.0: [1, 2] },
      E: { 1.0: [0, 1], 1.5: [0, 1], 2.5: [1, 2], 4.0: [1, 2] },
      F: { 1.0: [0, 1], 1.5: [1, 2], 2.5: [1, 2], 4.0: [2, 3] },
      G: { 1.0: [1, 2], 1.5: [1, 2], 2.5: [2, 3], 4.0: [3, 4] },
      H: { 1.0: [1, 2], 1.5: [2, 3], 2.5: [3, 4], 4.0: [5, 6] },
      J: { 1.0: [2, 3], 1.5: [3, 4], 2.5: [5, 6], 4.0: [7, 8] },
      K: { 1.0: [3, 4], 1.5: [5, 6], 2.5: [7, 8], 4.0: [10, 11] },
      L: { 1.0: [5, 6], 1.5: [7, 8], 2.5: [10, 11], 4.0: [14, 15] },
      M: { 1.0: [7, 8], 1.5: [10, 11], 2.5: [14, 15], 4.0: [21, 22] },
      N: { 1.0: [10, 11], 1.5: [14, 15], 2.5: [21, 22], 4.0: [21, 22] },
      P: { 1.0: [14, 15], 1.5: [21, 22], 2.5: [21, 22], 4.0: [21, 22] },
      Q: { 1.0: [21, 22], 1.5: [21, 22], 2.5: [21, 22], 4.0: [21, 22] },
    };

    const [ac, re] = aqlTable[codeLetter]?.[aql] ?? [2, 3];
    return { codeLetter, sampleSize, acceptanceNum: ac, rejectionNum: re };
  };

  const queryClient = useQueryClient();

  // Queries
  const inspectionsQuery = useQuery({
    queryKey: ['qc', 'inspections', search, statusFilter, typeFilter],
    queryFn: ({ signal }) =>
      api.get<QcInspection[]>('/qc/inspections', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(typeFilter !== 'all' ? { inspection_type: typeFilter } : {}),
        },
      }),
  });

  const batchesQuery = useQuery({
    queryKey: ['production', 'batches', 'options'],
    queryFn: ({ signal }) => api.get<ProductionBatch[]>('/production/batches', { signal }),
  });

  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'options'],
    queryFn: ({ signal }) => api.get<Product[]>('/products', { signal }),
  });

  const paramsQuery = useQuery({
    queryKey: ['qc', 'parameters', 'options'],
    queryFn: ({ signal }) => api.get<QcParameter[]>('/qc/parameters', { signal }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payloadDraft: CreateInspectionDraft) => {
      const payload = {
        inspection_number: generateInspectionNumber(),
        production_batch_id: payloadDraft.batch_id || undefined,
        batch_id: payloadDraft.batch_id || undefined,
        product_id: payloadDraft.product_id,
        inspection_type: payloadDraft.inspection_type,
        inspection_date: payloadDraft.inspection_date,
        sample_size: payloadDraft.sample_size,
        inspected_quantity: payloadDraft.inspected_quantity || payloadDraft.sample_size,
        passed_quantity: payloadDraft.passed_quantity,
        failed_quantity: payloadDraft.rejected_quantity,
        rejected_quantity: payloadDraft.rejected_quantity,
        result: payloadDraft.result,
        notes: payloadDraft.notes,
        results: payloadDraft.results.map((r) => ({
          qc_parameter_id: r.qc_parameter_id,
          value_numeric: isNaN(Number(r.measured_value)) ? undefined : r.measured_value,
          value_text: r.measured_value,
          is_within_spec: r.is_passed,
          notes: r.remarks,
        })),
        defects: payloadDraft.defects,
      };

      const res = await api.post<QcInspection>('/qc/inspections', payload);

      // Auto-create Rework Order if flagged on rejection
      if (autoCreateRework && (payloadDraft.result === 'fail' || parseFloat(payloadDraft.rejected_quantity) > 0)) {
        try {
          const selectedBatch = batches.find((b) => b.id === payloadDraft.batch_id);
          const selectedProduct = products.find((p) => p.id === payloadDraft.product_id);
          await api.post('/qc/rework-orders', {
            rework_number: generateReworkNumber(),
            batch_id: payloadDraft.batch_id || selectedBatch?.id,
            batch_number: selectedBatch?.batch_number,
            product_id: payloadDraft.product_id,
            product_name: selectedProduct?.name,
            defect_category: payloadDraft.defects[0]?.defect_type || 'QC Parameter Failure',
            defect_notes: `Auto-generated from inspection ${payload.inspection_number}. ${payloadDraft.notes || ''}`.trim(),
            qty_defective: payloadDraft.rejected_quantity || '1.0000',
            unit: 'units',
            assigned_station: 'Rework Bay 1',
            assigned_operator: 'Floor Technician',
            status: 'pending',
            rework_cost: '25.0000',
            salvage_qty: 0,
            scrap_qty: 0,
            created_at: new Date().toISOString(),
          });
          await queryClient.invalidateQueries({ queryKey: ['qc', 'rework-orders'] });
        } catch (e) {
          console.warn('Could not auto-create rework order', e);
        }
      }

      // Auto-create Wastage Record if scrap flagged
      if (autoCreateWastage && parseFloat(payloadDraft.rejected_quantity) > 0) {
        try {
          await api.post('/qc/wastage-records', {
            wastage_number: generateWastageNumber(),
            product_id: payloadDraft.product_id,
            production_batch_id: payloadDraft.batch_id,
            stage: 'qc',
            quantity: payloadDraft.rejected_quantity,
            unit_id: 'default',
            reason_code_id: 'default',
            estimated_cost: '20.0000',
            is_recoverable: false,
            notes: `Auto-recorded scrap from inspection ${payload.inspection_number}`,
          });
          await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
        } catch (e) {
          console.warn('Could not auto-create wastage record', e);
        }
      }

      return res;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      setIsCreateOpen(false);
      setErrorMsg(null);
      toast.success('Inspection recorded successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to log QC inspection.');
      else setErrorMsg('Error logging QC inspection.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditInspectionDraft }) => {
      const body = {
        sample_size: payload.sample_size,
        inspected_quantity: payload.inspected_quantity,
        passed_quantity: payload.passed_quantity,
        failed_quantity: payload.rejected_quantity,
        rejected_quantity: payload.rejected_quantity,
        result: payload.result,
        status: payload.status,
        notes: payload.notes,
      };
      return api.put<QcInspection>(`/qc/inspections/${id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      setEditingInspection(null);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to update inspection.');
      else setErrorMsg('Error updating inspection.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put<QcInspection>(`/qc/inspections/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post<QcInspection>(`/qc/inspections/${id}/approve`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      if (selectedInspection) {
        setSelectedInspection((insp) => (insp ? { ...insp, status: 'approved' } : null));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/qc/inspections/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      setDeletingInspection(null);
      if (selectedInspection) setSelectedInspection(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to delete inspection.');
      else setErrorMsg('Error deleting inspection.');
    },
  });

  const openEditModal = (insp: QcInspection) => {
    setErrorMsg(null);
    setEditingInspection(insp);
    setEditForm({
      sample_size: insp.sample_size ?? '10.0000',
      inspected_quantity: insp.inspected_quantity ?? '10.0000',
      passed_quantity: insp.passed_quantity ?? '10.0000',
      rejected_quantity: insp.rejected_quantity ?? insp.failed_quantity ?? '0.0000',
      result: (insp.result ?? 'pass') as EditInspectionDraft['result'],
      status: (insp.status ?? 'draft') as EditInspectionDraft['status'],
      notes: insp.notes ?? '',
    });
    void api.get<QcInspection>(`/qc/inspections/${(insp as unknown as { uuid?: string }).uuid || insp.id}`).then((res) => {
      if (res.data) {
        setEditingInspection(res.data);
      }
    }).catch(() => {});
  };

  const [selectedInspectionIds, setSelectedInspectionIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const inspections = inspectionsQuery.data?.data ?? [];
  const batches = batchesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const parameters = paramsQuery.data?.data ?? [];

  const isAllSelected = inspections.length > 0 && selectedInspectionIds.size === inspections.length;
  const isIndeterminate = selectedInspectionIds.size > 0 && selectedInspectionIds.size < inspections.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const toggleSelectInspection = (id: string) => {
    setSelectedInspectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInspectionIds(new Set());
    } else {
      setSelectedInspectionIds(new Set(inspections.map((i) => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInspectionIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedInspectionIds);
      await Promise.all(ids.map((id) => api.delete(`/qc/inspections/${id}`)));
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      setSelectedInspectionIds(new Set());
      setShowBulkDeleteModal(false);
    } catch (err) {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to delete selected inspections.');
      else setErrorMsg('Error deleting selected inspections.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedInspectionIds.size === 0) return;
    setIsBulkApproving(true);
    try {
      const ids = Array.from(selectedInspectionIds);
      await Promise.all(ids.map((id) => api.post(`/qc/inspections/${id}/approve`)));
      await queryClient.invalidateQueries({ queryKey: ['qc', 'inspections'] });
      setSelectedInspectionIds(new Set());
    } catch (err) {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to approve selected inspections.');
      else setErrorMsg('Error approving selected inspections.');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const exportSelectedCsv = () => {
    const selectedItems = inspections.filter((i) => selectedInspectionIds.has(i.id));
    if (selectedItems.length === 0) return;

    const headers = ['Inspection #', 'Type', 'Date', 'Product', 'Batch', 'Sample Size', 'Inspected', 'Passed', 'Rejected', 'Status', 'Result'];
    const rows = selectedItems.map((i) => [
      i.inspection_number,
      i.inspection_type,
      i.inspection_date,
      i.product_name ?? i.product_id,
      i.batch_number ?? '',
      i.sample_size,
      i.inspected_quantity,
      i.passed_quantity,
      i.rejected_quantity ?? i.failed_quantity ?? '0',
      i.status ?? 'draft',
      i.result ?? 'pass',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `qc_inspections_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by inspection number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft', colorDot: 'bg-slate-400' },
              { value: 'submitted', label: 'Submitted', colorDot: 'bg-blue-500' },
              { value: 'approved', label: 'Approved', colorDot: 'bg-emerald-500' },
              { value: 'rejected', label: 'Rejected', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter inspections by status"
          />

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'incoming', label: 'Incoming', colorDot: 'bg-cyan-500' },
              { value: 'in_process', label: 'In-Process', colorDot: 'bg-indigo-500' },
              { value: 'final', label: 'Final QC', colorDot: 'bg-emerald-500' },
            ]}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            size="sm"
            aria-label="Filter inspections by type"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setErrorMsg(null);
            setDraft({
              ...(batches[0]?.id ? { batch_id: batches[0].id } : {}),
              product_id: products[0]?.id ?? '',
              inspection_type: 'final',
              sample_size: '10.0000',
              inspected_quantity: '10.0000',
              passed_quantity: '10.0000',
              rejected_quantity: '0.0000',
              result: 'pass',
              inspection_date: new Date().toISOString().slice(0, 10),
              results: parameters.slice(0, 3).map((p) => ({
                qc_parameter_id: p.id,
                parameter_name: p.name,
                measured_value: p.target_value ?? '1.0000',
                is_passed: true,
              })),
              defects: [],
            });
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>New QC Inspection</span>
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedInspectionIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center justify-center rounded-md bg-primary px-2 text-xs font-semibold text-white">
              {selectedInspectionIds.size}
            </span>
            <span className="text-xs font-medium text-default">
              {selectedInspectionIds.size === 1 ? 'inspection selected' : 'inspections selected'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedInspectionIds(new Set())}
              className="text-xs text-muted hover:text-default underline transition-colors cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isBulkApproving ? 'Approving...' : 'Bulk Approve'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportSelectedCsv}
              className="flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Bulk Delete ({selectedInspectionIds.size})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <QueryBoundary
        status={inspectionsQuery.status}
        error={inspectionsQuery.error}
        data={inspectionsQuery.data}
        isFetching={inspectionsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          {/* Mobile Card List (< md viewports) */}
          <div className="md:hidden divide-y divide-default">
            {inspections.length === 0 ? (
              <div className="py-12 text-center text-muted px-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken border border-default mb-2">
                  <Microscope className="h-5 w-5 text-muted" />
                </div>
                <div className="text-sm font-medium text-default">No inspections logged</div>
                <div className="text-xs text-muted mt-1">
                  Execute physical, chemical or packaging QA runs on materials and floor output.
                </div>
              </div>
            ) : (
              inspections.map((insp) => (
                <div
                  key={insp.id}
                  className={`p-4 space-y-3 transition-colors ${
                    selectedInspectionIds.has(insp.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedInspectionIds.has(insp.id)}
                        onChange={() => toggleSelectInspection(insp.id)}
                        className="rounded border-default text-primary focus:ring-primary h-5 w-5 cursor-pointer touch-target"
                        aria-label={`Select inspection ${insp.inspection_number}`}
                      />
                      <div>
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {insp.inspection_number}
                        </span>
                        <div className="text-[11px] text-muted capitalize">
                          {(insp.inspection_type ?? 'final').replace('_', ' ')} · {insp.inspection_date}
                        </div>
                      </div>
                    </div>
                    <select
                      value={insp.status ?? 'draft'}
                      onChange={(e) =>
                        updateStatusMutation.mutate({
                          id: insp.id,
                          status: e.target.value,
                        })
                      }
                      className="rounded-lg border border-default bg-surface py-1.5 px-2 text-xs font-medium text-default focus:border-primary focus:outline-none touch-target"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="rounded-xl bg-surface-sunken p-3 border border-default/60 space-y-1.5 text-xs">
                    <div className="font-semibold text-default truncate">
                      {insp.product_name ?? insp.product_id}
                    </div>
                    {insp.batch_number && (
                      <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                        Batch: {insp.batch_number}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-default/40 text-xs font-mono">
                      <span className="text-muted">Sample: {insp.sample_size} / {insp.inspected_quantity}</span>
                      <span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{insp.passed_quantity}</span>
                        <span className="text-muted"> / </span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          {insp.rejected_quantity ?? insp.failed_quantity ?? '0.0000'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedInspection(insp)}
                      className="flex-1 min-h-11 bg-surface border border-default hover:bg-surface-sunken text-default rounded-xl font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs touch-target"
                    >
                      <Eye className="size-4 text-primary shrink-0" />
                      <span>Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(insp)}
                      className="min-h-11 px-3 bg-surface border border-default hover:bg-surface-sunken text-default rounded-xl font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs touch-target"
                    >
                      <Edit2 className="size-4 text-muted shrink-0" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingInspection(insp)}
                      className="min-h-11 px-3 bg-surface border border-default hover:bg-rose-500/10 text-rose-600 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center justify-center shadow-2xs touch-target"
                      title="Delete"
                    >
                      <Trash2 className="size-4 text-rose-600 shrink-0" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md viewports) */}
          <div className="hidden md:block overflow-x-auto min-h-75">
            <table className="w-full text-left text-xs text-default">
              <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      aria-label="Select all inspections"
                    />
                  </th>
                  <th className="py-3.5 pl-2 pr-3">Inspection #</th>
                  <th className="py-3.5 px-3">Type & Date</th>
                  <th className="py-3.5 px-3">Product / Batch</th>
                  <th className="py-3.5 px-3">Sample / Inspected</th>
                  <th className="py-3.5 px-3">Passed / Rejected</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {inspections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken border border-default mb-2">
                        <Microscope className="h-5 w-5 text-muted" />
                      </div>
                      <div className="text-sm font-medium text-default">No inspections logged</div>
                      <div className="text-xs text-muted mt-1">
                        Execute physical, chemical or packaging QA runs on materials and floor output.
                      </div>
                    </td>
                  </tr>
                ) : (
                  inspections.map((insp) => (
                    <tr
                      key={insp.id}
                      className={`hover:bg-surface-sunken/60 transition-colors ${
                        selectedInspectionIds.has(insp.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedInspectionIds.has(insp.id)}
                          onChange={() => toggleSelectInspection(insp.id)}
                          className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          aria-label={`Select inspection ${insp.inspection_number}`}
                        />
                      </td>
                      <td className="py-3.5 pl-2 pr-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {insp.inspection_number}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="capitalize font-medium text-default">
                          {(insp.inspection_type ?? 'final').replace('_', ' ')}
                        </div>
                        <div className="text-[10px] text-muted">{insp.inspection_date}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-default font-medium">
                          {insp.product_name ?? insp.product_id}
                        </div>
                        {insp.batch_number && (
                          <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            Batch: {insp.batch_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-muted">
                        {insp.sample_size} <span className="text-muted">/</span>{' '}
                        {insp.inspected_quantity}
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {insp.passed_quantity}
                        </span>
                        <span className="text-muted"> / </span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          {insp.rejected_quantity ?? insp.failed_quantity ?? '0.0000'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <select
                          value={insp.status ?? 'draft'}
                          onChange={(e) =>
                            updateStatusMutation.mutate({
                              id: insp.id,
                              status: e.target.value,
                            })
                          }
                          className="rounded-lg border border-default bg-surface py-1 px-2 text-[11px] font-medium text-default focus:border-primary focus:outline-none"
                        >
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInspection(insp)}
                            className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="View inspection details"
                          >
                            <Eye className="size-3 text-primary shrink-0" />
                            <span>Details</span>
                          </button>

                          {/* Prominent Actions Dropdown Button */}
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openActionMenuId === insp.id) {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                } else {
                                  setOpenActionMenuId(insp.id);
                                  setActionMenuAnchor(e.currentTarget);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                openActionMenuId === insp.id
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-default bg-surface hover:bg-surface-sunken text-default'
                              }`}
                              title={`More options for ${insp.inspection_number}`}
                              aria-label={`More options for inspection ${insp.inspection_number}`}
                            >
                              <span>Actions</span>
                              <ChevronDown className="size-3 text-muted" />
                            </button>

                            <ActionMenuPortal
                              isOpen={openActionMenuId === insp.id}
                              anchorEl={actionMenuAnchor}
                              onClose={() => {
                                setOpenActionMenuId(null);
                                setActionMenuAnchor(null);
                              }}
                              width={210}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                  setSelectedInspection(insp);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Eye className="size-3.5 text-primary shrink-0" />
                                <span>View Run Details</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                  openEditModal(insp);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Edit2 className="size-3.5 text-muted shrink-0" />
                                <span>Edit Parameters & Form</span>
                              </button>

                              {insp.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                    approveMutation.mutate(insp.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                  <span>Quick Approve</span>
                                </button>
                              )}

                              {parseFloat(insp.rejected_quantity || insp.failed_quantity || '0') > 0 && (
                                <Link
                                  to="/production?tab=batches"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="size-3.5 text-amber-500 shrink-0" />
                                  <span>Route to Rework</span>
                                </Link>
                              )}

                              <div className="my-1 border-t border-default/50" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                  setDeletingInspection(insp);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                                <span>Delete Inspection</span>
                              </button>
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

      {/* Create Inspection Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Execute QC Inspection"
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Inspection Type
              </label>
              <select
                value={draft.inspection_type}
                onChange={(e) => {
                  const val = e.target.value as 'incoming' | 'in_process' | 'final';
                  setDraft((d) => ({
                    ...d,
                    inspection_type: val,
                    ...(val === 'incoming' ? { batch_id: undefined } : {}),
                  }));
                }}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="incoming">Incoming Receiving (Raw Materials & Purchased FG)</option>
                <option value="in_process">In-Process Floor Check</option>
                <option value="final">Final Finished Good QA</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Production Batch
              </label>
              <select
                value={draft.batch_id ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ...(e.target.value ? { batch_id: e.target.value } : { batch_id: undefined }),
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">{draft.inspection_type === 'incoming' ? 'None (Incoming Vendor Shipment)' : 'None (Independent)'}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Product Inspected
              </label>
              <select
                value={draft.product_id}
                onChange={(e) => setDraft((d) => ({ ...d, product_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <optgroup label="Finished Goods (Manufactured / Purchased)">
                  {products
                    .filter((p) => p.type === 'finished' || p.type === 'finished_good')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Raw Materials & Components">
                  {products
                    .filter((p) => p.type !== 'finished' && p.type !== 'finished_good')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Inspection Date
              </label>
              <input
                type="date"
                value={draft.inspection_date}
                onChange={(e) => setDraft((d) => ({ ...d, inspection_date: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Sample Size
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const selBatch = batches.find((b) => b.id === draft.batch_id);
                    if (selBatch?.target_quantity) {
                      setAqlLotSize(String(Math.round(parseFloat(selBatch.target_quantity))));
                    }
                    setShowAqlModal(true);
                  }}
                  className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  title="Calculate standard AQL sample size from lot size"
                >
                  <Calculator className="size-3" />
                  <span>AQL Tool</span>
                </button>
              </div>
              <input
                type="number"
                step="0.0001"
                value={draft.sample_size}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sample_size: e.target.value,
                    inspected_quantity: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Passed Qty
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.passed_quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  const passedNum = parseFloat(val) || 0;
                  const sampleNum = parseFloat(draft.sample_size) || 10;
                  const rejectedNum = Math.max(0, sampleNum - passedNum);
                  setDraft((d) => ({
                    ...d,
                    passed_quantity: val,
                    rejected_quantity: rejectedNum.toFixed(4),
                    result: rejectedNum > 0 ? (passedNum > 0 ? 'partial' : 'fail') : 'pass',
                  }));
                }}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Rejected Qty
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.rejected_quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  const rejectedNum = parseFloat(val) || 0;
                  const sampleNum = parseFloat(draft.sample_size) || 10;
                  const passedNum = Math.max(0, sampleNum - rejectedNum);
                  setDraft((d) => ({
                    ...d,
                    rejected_quantity: val,
                    passed_quantity: passedNum.toFixed(4),
                    result: rejectedNum > 0 ? (passedNum > 0 ? 'partial' : 'fail') : 'pass',
                  }));
                }}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-rose-600 dark:text-rose-400 font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Inspection Result
              </label>
              <select
                value={draft.result}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    result: e.target.value as CreateInspectionDraft['result'],
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="pass">Pass (All Specs Verified)</option>
                <option value="partial">Partial Pass (Conditional Acceptance)</option>
                <option value="fail">Fail (Rejection Required)</option>
                <option value="hold">Hold (Pending Lab / Rework)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Inspector Notes
              </label>
              <input
                type="text"
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Optional inspection observations..."
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic Parameter Tests */}
          <div className="space-y-2 pt-2 border-t border-default">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Parameter Checklist ({draft.results.length})
              </span>
              <div className="flex items-center gap-2">
                {parameters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const relevant = parameters.filter((p) => !p.product_id || p.product_id === draft.product_id);
                      const listToUse = relevant.length > 0 ? relevant : parameters;
                      setDraft((d) => ({
                        ...d,
                        results: listToUse.map((p) => ({
                          qc_parameter_id: p.id,
                          parameter_name: p.name,
                          measured_value: p.target_value ?? '1.0000',
                          is_passed: true,
                        })),
                      }));
                    }}
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Quick-load All ({parameters.length}) Specs
                  </button>
                )}
                {parameters.length > draft.results.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const unadded = parameters.find(
                        (p) => !draft.results.some((r) => r.qc_parameter_id === p.id)
                      );
                      if (unadded) {
                        setDraft((d) => ({
                          ...d,
                          results: [
                            ...d.results,
                            {
                              qc_parameter_id: unadded.id,
                              parameter_name: unadded.name,
                              measured_value: unadded.target_value ?? '1.0000',
                              is_passed: true,
                            },
                          ],
                        }));
                      }
                    }}
                    className="text-xs text-primary flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Parameter</span>
                  </Button>
                )}
              </div>
            </div>

            {draft.results.length > 0 && (
              <div className="rounded-xl border border-default divide-y divide-default overflow-hidden bg-surface">
                {draft.results.map((res, idx) => (
                  <div key={res.qc_parameter_id} className="p-2.5 flex items-center gap-3 text-xs">
                    <div className="flex-1 font-medium text-default">
                      {res.parameter_name ?? `Parameter #${idx + 1}`}
                    </div>
                    <div className="w-32">
                      <input
                        type="text"
                        placeholder="Value"
                        value={res.measured_value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((d) => ({
                            ...d,
                            results: d.results.map((r, i) =>
                              i === idx ? { ...r, measured_value: val } : r
                            ),
                          }));
                        }}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedResults = draft.results.map((r, i) =>
                          i === idx ? { ...r, is_passed: !r.is_passed } : r
                        );
                        const anyFailed = updatedResults.some((r) => !r.is_passed);
                        setDraft((d) => ({
                          ...d,
                          results: updatedResults,
                          result: anyFailed ? 'fail' : 'pass',
                          rejected_quantity:
                            anyFailed && parseFloat(d.rejected_quantity) === 0 ? '1.0000' : d.rejected_quantity,
                        }));
                      }}
                      className={`min-h-11 min-w-18 sm:min-h-9 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs flex items-center justify-center touch-target-factory ${
                        res.is_passed
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {res.is_passed ? 'Pass' : 'Fail'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          results: d.results.filter((_, i) => i !== idx),
                        }));
                      }}
                      className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-muted hover:text-rose-600 rounded-xl hover:bg-rose-500/10 cursor-pointer transition-colors p-2 touch-target"
                      title="Remove test"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Defect Logging */}
          <div className="space-y-2 pt-2 border-t border-default">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Defect Entries ({draft.defects.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    defects: [
                      ...d.defects,
                      {
                        defect_type: 'Surface Imperfection',
                        severity: 'minor',
                        quantity: '1.0000',
                      },
                    ],
                  }));
                }}
                className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Log Defect</span>
              </Button>
            </div>

            {draft.defects.length > 0 && (
              <div className="rounded-xl border border-rose-500/20 divide-y divide-rose-500/10 overflow-hidden bg-surface">
                {draft.defects.map((def, idx) => (
                  <div key={idx} className="p-2.5 flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Defect description..."
                      value={def.defect_type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          defects: d.defects.map((item, i) =>
                            i === idx ? { ...item, defect_type: val } : item
                          ),
                        }));
                      }}
                      className="flex-1 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs"
                    />
                    <select
                      value={def.severity}
                      onChange={(e) => {
                        const val = e.target.value as 'minor' | 'major' | 'critical';
                        setDraft((d) => ({
                          ...d,
                          defects: d.defects.map((item, i) =>
                            i === idx ? { ...item, severity: val } : item
                          ),
                        }));
                      }}
                      className="w-24 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs capitalize"
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Qty"
                      value={def.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          defects: d.defects.map((item, i) =>
                            i === idx ? { ...item, quantity: val } : item
                          ),
                        }));
                      }}
                      className="w-20 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          defects: d.defects.filter((_, i) => i !== idx),
                        }));
                      }}
                      className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-muted hover:text-rose-600 rounded-xl hover:bg-rose-500/10 cursor-pointer transition-colors p-2 touch-target"
                      title="Remove defect"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automated Disposition Routing on Failure */}
          {(draft.result === 'fail' || draft.result === 'partial' || parseFloat(draft.rejected_quantity) > 0) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                <span>Non-Conformance Handling: Automated Workflow Actions</span>
              </div>
              <div className="space-y-1.5 text-xs text-default">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={autoCreateRework}
                    onChange={(e) => setAutoCreateRework(e.target.checked)}
                    className="rounded text-primary border-default"
                  />
                  <span>
                    Auto-create <strong>QC Rework Order</strong> for salvage & repair
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={autoCreateWastage}
                    onChange={(e) => setAutoCreateWastage(e.target.checked)}
                    className="rounded text-primary border-default"
                  />
                  <span>
                    Record scrapped units as <strong>Material Wastage</strong>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-default">
            <Button variant="ghost" className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target"
              onClick={() => createMutation.mutate(draft)}
              disabled={createMutation.isPending || !draft.product_id}
            >
              {createMutation.isPending ? 'Logging...' : 'Save Inspection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Inspection Modal */}
      {editingInspection && (
        <Modal
          open={Boolean(editingInspection)}
          onClose={() => setEditingInspection(null)}
          title={`Edit QC Inspection: ${editingInspection.inspection_number}`}
        >
          <div className="space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      status: e.target.value as EditInspectionDraft['status'],
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Result
                </label>
                <select
                  value={editForm.result}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      result: e.target.value as EditInspectionDraft['result'],
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="pass">Pass</option>
                  <option value="partial">Partial Pass</option>
                  <option value="fail">Fail</option>
                  <option value="hold">Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Sample Size
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.sample_size}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      sample_size: e.target.value,
                      inspected_quantity: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs font-mono text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Passed Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.passed_quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, passed_quantity: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Rejected Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editForm.rejected_quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, rejected_quantity: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs font-mono text-rose-600 dark:text-rose-400 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Inspection Notes
              </label>
              <textarea
                value={editForm.notes ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target" onClick={() => setEditingInspection(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target"
                onClick={() =>
                  updateMutation.mutate({
                    id: editingInspection.id,
                    payload: editForm,
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Inspection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingInspection && (
        <Modal
          open={Boolean(deletingInspection)}
          onClose={() => setDeletingInspection(null)}
          title="Delete QC Inspection"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm Inspection Deletion</p>
                <p className="mt-1 text-muted">
                  Are you sure you want to delete inspection record{' '}
                  <strong className="text-default font-mono">
                    {deletingInspection.inspection_number}
                  </strong>
                  ? This will delete the inspection run and its associated defect logs.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-default">
              <Button variant="ghost" className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target" onClick={() => setDeletingInspection(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target"
                onClick={() => deleteMutation.mutate(deletingInspection.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Inspection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <Modal
          open={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          title="Delete Inspections in Bulk"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm Bulk Inspection Deletion</p>
                <p className="mt-1 text-muted">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-default">
                    {selectedInspectionIds.size} inspection {selectedInspectionIds.size === 1 ? 'record' : 'records'}
                  </strong>
                  ? This will delete these inspection runs and their associated defect logs. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-default">
              <Button variant="ghost" className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target" onClick={() => setShowBulkDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="w-full sm:w-auto min-h-11 sm:min-h-9.5 touch-target"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedInspectionIds.size} Records`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Details View Modal */}
      {selectedInspection && (
        <Modal
          open={Boolean(selectedInspection)}
          onClose={() => setSelectedInspection(null)}
          title={`Inspection Details: ${selectedInspection.inspection_number}`}
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl bg-surface-sunken p-3 border border-default">
              <div>
                <div className="text-sm font-semibold text-default">
                  {selectedInspection.product_name ?? selectedInspection.product_id}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  Type: {(selectedInspection.inspection_type ?? 'final').replace('_', ' ')} · Date:{' '}
                  {selectedInspection.inspection_date}
                </div>
              </div>
              <div>
                <StatusBadge status={selectedInspection.status} />
              </div>
            </div>

            {/* Results Table */}
            {selectedInspection.results && selectedInspection.results.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Measured Parameter Tests
                </div>
                <div className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin rounded-xl border border-default">
                  <table className="w-full min-w-112.5 text-left text-xs">
                    <thead className="bg-surface-sunken text-muted border-b border-default">
                      <tr>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5">Measured Value</th>
                        <th className="p-2.5 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default bg-surface">
                      {selectedInspection.results.map((res) => (
                        <tr key={res.id}>
                          <td className="p-2.5 text-default font-medium">
                            {res.parameter_name ?? res.qc_parameter_id}
                          </td>
                          <td className="p-2.5 font-mono text-muted">
                            {res.measured_value ?? res.measured_text ?? 'N/A'}
                          </td>
                          <td className="p-2.5 text-right">
                            {res.is_passed ? (
                              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                                <XCircle className="h-3.5 w-3.5" /> Fail
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface-sunken border border-default text-xs font-mono">
              <div>
                <span className="text-[10px] text-muted font-sans uppercase">Inspected</span>
                <div className="font-bold text-default">{selectedInspection.inspected_quantity}</div>
              </div>
              <div>
                <span className="text-[10px] text-muted font-sans uppercase">Passed</span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedInspection.passed_quantity}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted font-sans uppercase">Rejected</span>
                <div className="font-bold text-rose-600 dark:text-rose-400">
                  {selectedInspection.rejected_quantity ?? selectedInspection.failed_quantity ?? '0.0000'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-default">
              {parseFloat(selectedInspection.rejected_quantity || selectedInspection.failed_quantity || '0') > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isDispatchingRework}
                    onClick={async () => {
                      setIsDispatchingRework(true);
                      try {
                        const rejQty = selectedInspection.rejected_quantity ?? selectedInspection.failed_quantity ?? '1.0000';
                        await api.post('/qc/rework-orders', {
                          rework_number: generateReworkNumber(),
                          batch_id: selectedInspection.production_batch_id || selectedInspection.batch_id,
                          product_id: selectedInspection.product_id,
                          product_name: selectedInspection.product_name,
                          defect_category: selectedInspection.defects?.[0]?.defect_type || 'QC Inspection Rejection',
                          defect_notes: `Created from inspection ${selectedInspection.inspection_number}`,
                          qty_defective: rejQty,
                          unit: 'units',
                          assigned_station: 'Rework Bay 1',
                          assigned_operator: 'Floor Technician',
                          status: 'pending',
                          rework_cost: '30.0000',
                          salvage_qty: 0,
                          scrap_qty: 0,
                          created_at: new Date().toISOString(),
                        });
                        await queryClient.invalidateQueries({ queryKey: ['qc', 'rework-orders'] });
                        toast.success(`Rework Order created for ${rejQty} units.`);
                      } catch {
                        toast.error('Failed to create rework order.');
                      } finally {
                        setIsDispatchingRework(false);
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white min-h-11 sm:min-h-9 w-full sm:w-auto touch-target flex items-center gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>
                      {isDispatchingRework
                        ? 'Creating...'
                        : `Dispatch to Rework (${selectedInspection.rejected_quantity ?? selectedInspection.failed_quantity} units)`}
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const rejQty = selectedInspection.rejected_quantity ?? selectedInspection.failed_quantity ?? '1.0000';
                        await api.post('/qc/wastage-records', {
                          wastage_number: generateWastageNumber(),
                          product_id: selectedInspection.product_id,
                          production_batch_id: selectedInspection.production_batch_id || selectedInspection.batch_id,
                          stage: 'qc',
                          quantity: rejQty,
                          unit_id: 'default',
                          reason_code_id: 'default',
                          estimated_cost: '25.0000',
                          is_recoverable: false,
                          notes: `Direct scrap logged from inspection ${selectedInspection.inspection_number}`,
                        });
                        await queryClient.invalidateQueries({ queryKey: ['qc', 'wastage-records'] });
                        toast.success(`Scrap recorded as material wastage.`);
                      } catch {
                        toast.error('Failed to record wastage.');
                      }
                    }}
                    className="text-rose-600 border-rose-500/30 hover:bg-rose-500/10 min-h-11 sm:min-h-9 w-full sm:w-auto touch-target flex items-center gap-1.5"
                  >
                    <AlertOctagon className="size-3.5" />
                    <span>Record Scrap as Wastage</span>
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-9 touch-target"
                  onClick={() => {
                    const toEdit = selectedInspection;
                    setSelectedInspection(null);
                    openEditModal(toEdit);
                  }}
                >
                  Edit Run
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 sm:flex-none min-h-11 sm:min-h-9 touch-target" onClick={() => setSelectedInspection(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* AQL Sample Size Calculator Modal */}
      {showAqlModal && (
        <Modal
          open={showAqlModal}
          onClose={() => setShowAqlModal(false)}
          title="AQL Sampling Calculator (ISO 2859-1 / ANSI ASQ Z1.4)"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-default">
              Calculate statistically valid sample sizes and acceptance/rejection (Ac/Re) defect thresholds according to standard single sampling inspection plans.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Lot Size (Units)
                </label>
                <input
                  type="number"
                  min="2"
                  value={aqlLotSize}
                  onChange={(e) => setAqlLotSize(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Inspection Level
                </label>
                <select
                  value={aqlLevel}
                  onChange={(e) => setAqlLevel(e.target.value as 'I' | 'II' | 'III')}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="I">Level I (Reduced)</option>
                  <option value="II">Level II (Normal - Standard)</option>
                  <option value="III">Level III (Tightened)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Target AQL Limit
                </label>
                <select
                  value={aqlTarget}
                  onChange={(e) => setAqlTarget(parseFloat(e.target.value) as 1.0 | 1.5 | 2.5 | 4.0)}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value={1.0}>1.0% (Critical Specs)</option>
                  <option value={1.5}>1.5% (Major Tolerance)</option>
                  <option value={2.5}>2.5% (Standard Manufacturing)</option>
                  <option value={4.0}>4.0% (Minor Cosmetic)</option>
                </select>
              </div>
            </div>

            {/* Real-time Calculation Result */}
            {(() => {
              const lot = Math.max(2, parseFloat(aqlLotSize) || 500);
              const result = getAqlCalculation(lot, aqlLevel, aqlTarget);
              return (
                <div className="rounded-xl bg-surface-sunken p-3.5 border border-default space-y-3">
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Sampling Plan Specification
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-surface border border-default">
                      <span className="text-[10px] text-muted block uppercase">Code Letter</span>
                      <span className="text-base font-bold font-mono text-primary">{result.codeLetter}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface border border-default">
                      <span className="text-[10px] text-muted block uppercase">Sample Size</span>
                      <span className="text-base font-bold font-mono text-default">{result.sampleSize}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-[10px] text-emerald-600 block uppercase font-bold">Ac (Pass &le;)</span>
                      <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {result.acceptanceNum}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
                      <span className="text-[10px] text-rose-600 block uppercase font-bold">Re (Reject &ge;)</span>
                      <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                        {result.rejectionNum}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    Inspect <strong>{result.sampleSize} units</strong> randomly from the lot of {lot}. Accept the lot if defects &le; <strong>{result.acceptanceNum}</strong>; reject the lot if defects &ge; <strong>{result.rejectionNum}</strong>.
                  </p>

                  <div className="flex justify-end gap-2 pt-2 border-t border-default/50">
                    <Button variant="ghost" onClick={() => setShowAqlModal(false)}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setDraft((d) => {
                          const sampleStr = result.sampleSize.toFixed(4);
                          return {
                            ...d,
                            sample_size: sampleStr,
                            inspected_quantity: sampleStr,
                            passed_quantity: sampleStr,
                            rejected_quantity: '0.0000',
                            result: 'pass',
                          };
                        });
                        setShowAqlModal(false);
                        toast.success(`Applied AQL sample size: ${result.sampleSize} units.`);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Apply Sample Size ({result.sampleSize} units)</span>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
