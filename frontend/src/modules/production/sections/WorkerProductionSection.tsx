import { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Download,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  FileUp,
  ChevronDown,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { StatusBadge } from '../../../components/ui/Badge';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../../components/ui/ResponsiveDataTable';
import { isApiError } from '../../../lib/api/errors';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { pieceRateLogImportSchema } from '../schemas/pieceRateLogImportSchema';
import type {
  WorkerProductionEntry,
  WorkerOutputSummary,
  Employee,
  ProductionBatch,
} from '../../../types/api/production';
import type { Product } from '../../../types/api/catalog';
import { useCurrency } from '../../../hooks/useCurrency';

interface CreateEntryDraft {
  batch_id: string;
  employee_id: string;
  product_id: string;
  work_date: string;
  shift: 'morning' | 'evening' | 'night' | 'general';
  wage_type: 'piece_rate' | 'hourly';
  good_quantity: string;
  rework_quantity: string;
  rejected_quantity: string;
  hours_worked?: string;
  piece_rate?: string;
  notes?: string;
}

interface EditEntryDraft {
  id: string;
  worker_name?: string | undefined;
  batch_number?: string | undefined;
  product_name?: string | undefined;
  good_quantity: string;
  rework_quantity: string;
  rejected_quantity: string;
  piece_rate: string;
  hours_worked?: string | undefined;
  wage_type: 'piece_rate' | 'hourly';
}

interface BulkGridRow {
  employee_id: string;
  good_quantity: string;
  rework_quantity: string;
  rejected_quantity: string;
  piece_rate: string;
}

export function WorkerProductionSection() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditEntryDraft | null>(null);
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });

  // Bulk Piece-Rate Grid State
  const [isBulkGridOpen, setIsBulkGridOpen] = useState(false);
  const [bulkGridBatchId, setBulkGridBatchId] = useState('');
  const [bulkGridShift, setBulkGridShift] = useState<'morning' | 'evening' | 'night' | 'general'>('morning');
  const [bulkGridDate, setBulkGridDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkGridRows, setBulkGridRows] = useState<BulkGridRow[]>([]);
  const [bulkGridSubmitting, setBulkGridSubmitting] = useState(false);
  const [bulkGridError, setBulkGridError] = useState<string | null>(null);

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

  const [draft, setDraft] = useState<CreateEntryDraft>({
    batch_id: '',
    employee_id: '',
    product_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    shift: 'morning',
    wage_type: 'piece_rate',
    good_quantity: '50.0000',
    rework_quantity: '0.0000',
    rejected_quantity: '0.0000',
    piece_rate: '2.5000',
  });

  const queryClient = useQueryClient();

  // Queries
  const entriesQuery = useQuery({
    queryKey: ['production', 'worker-entries', search, shiftFilter, statusFilter],
    queryFn: ({ signal }) =>
      api.get<WorkerProductionEntry[]>('/production/worker-entries', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(shiftFilter !== 'all' ? { shift: shiftFilter } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        },
      }),
  });

  const summaryQuery = useQuery({
    queryKey: ['production', 'worker-entries', 'summary'],
    queryFn: ({ signal }) =>
      api.get<WorkerOutputSummary>('/production/worker-entries/summary', { signal }),
  });

  const batchesQuery = useQuery({
    queryKey: ['production', 'batches', 'options'],
    queryFn: ({ signal }) => api.get<ProductionBatch[]>('/production/batches', { signal }),
  });

  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'options'],
    queryFn: ({ signal }) => api.get<Product[]>('/products', { signal }),
  });

  const employeesQuery = useQuery({
    queryKey: ['production', 'employees', 'options'],
    queryFn: async ({ signal }) => {
      try {
        return await api.get<Employee[]>('/hr/employees', { signal });
      } catch {
        try {
          return await api.get<Employee[]>('/workforce/employees', { signal });
        } catch {
          return { data: [] };
        }
      }
    },
  });

  const entries = entriesQuery.data?.data ?? [];
  const summary = summaryQuery.data?.data;
  const batches = useMemo(() => batchesQuery.data?.data ?? [], [batchesQuery.data?.data]);
  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data?.data]);
  const employees = useMemo(() => employeesQuery.data?.data ?? [], [employeesQuery.data?.data]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateEntryDraft) => {
      const selectedBatch = batches.find((b) => b.id === payload.batch_id);
      const selectedProduct = products.find(
        (p) => p.id === (payload.product_id || selectedBatch?.product_id)
      );
      const mappedPayload = {
        production_batch_id: payload.batch_id,
        batch_id: payload.batch_id,
        employee_id: payload.employee_id,
        product_id: payload.product_id || selectedBatch?.product_id || selectedProduct?.id,
        work_date: payload.work_date,
        shift: payload.shift,
        measure_type: 'piece',
        quantity: payload.good_quantity,
        good_quantity: payload.good_quantity,
        unit_id: selectedBatch?.output_unit_id ?? selectedProduct?.base_unit_id,
        rework_quantity: payload.rework_quantity || '0.0000',
        rejected_quantity: payload.rejected_quantity || '0.0000',
        rate_type: payload.wage_type,
        wage_type: payload.wage_type,
        rate: payload.piece_rate || '2.5000',
        piece_rate: payload.piece_rate || '2.5000',
        hours_worked: payload.hours_worked || (payload.wage_type === 'hourly' ? '8.00' : undefined),
      };
      return api.post<WorkerProductionEntry>('/production/worker-entries', mappedPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
      setIsCreateOpen(false);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) {
        const fieldErrors =
          err.fields && Object.keys(err.fields).length > 0
            ? Object.entries(err.fields)
                .map(([field, msgs]) => `${field.replace(/_/g, ' ')}: ${msgs.join(', ')}`)
                .join('; ')
            : null;
        setErrorMsg(fieldErrors || err.message || 'Failed to log worker output.');
      } else {
        setErrorMsg('Error logging worker output. Please check inputs.');
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<WorkerProductionEntry>(`/production/worker-entries/${id}/verify`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (draftPayload: EditEntryDraft) => {
      const payload = {
        quantity: draftPayload.good_quantity,
        rework_quantity: draftPayload.rework_quantity,
        rejected_quantity: draftPayload.rejected_quantity,
        rate: draftPayload.piece_rate,
        rate_type: draftPayload.wage_type,
        ...(draftPayload.hours_worked ? { hours_worked: draftPayload.hours_worked } : {}),
      };
      return api.patch<WorkerProductionEntry>(`/production/worker-entries/${draftPayload.id}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
      setEditDraft(null);
      setEditErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) {
        const fieldErrors = err.fields ? Object.values(err.fields).flat().join(', ') : null;
        setEditErrorMsg(fieldErrors || err.message || 'Failed to update entry.');
      } else {
        setEditErrorMsg('Error updating entry.');
      }
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/production/worker-entries/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to delete worker entry.');
    },
  });

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatShiftDisplay = (shiftStr?: string) => {
    if (!shiftStr) return 'General Shift';
    return `${shiftStr.charAt(0).toUpperCase() + shiftStr.slice(1)} Shift`;
  };

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkVerifying, setIsBulkVerifying] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllSelected = entries.length > 0 && selectedEntryIds.size === entries.length;
  const isSomeSelected = selectedEntryIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEntryIds.size > 0) {
        setSelectedEntryIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntryIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(entries.map((e) => e.id)));
    }
  };

  const toggleSelectEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedEntryIds(new Set());

  const handleBulkVerify = async () => {
    setIsBulkVerifying(true);
    try {
      await Promise.allSettled(
        Array.from(selectedEntryIds).map((id) => api.post(`/production/worker-entries/${id}/verify`))
      );
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
      setSelectedEntryIds(new Set());
    } finally {
      setIsBulkVerifying(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await Promise.allSettled(
        Array.from(selectedEntryIds).map((id) => api.delete(`/production/worker-entries/${id}`))
      );
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
      setSelectedEntryIds(new Set());
      setShowBulkDeleteModal(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleOpenBulkGrid = () => {
    setBulkGridError(null);
    const defaultBatch = batches[0];
    setBulkGridBatchId(defaultBatch?.id ?? '');
    setBulkGridDate(new Date().toISOString().slice(0, 10));
    setBulkGridShift('morning');
    if (employees.length > 0) {
      setBulkGridRows(
        employees.slice(0, Math.min(5, employees.length)).map((emp) => ({
          employee_id: emp.id,
          good_quantity: '50.0000',
          rework_quantity: '0.0000',
          rejected_quantity: '0.0000',
          piece_rate: '2.5000',
        }))
      );
    } else {
      setBulkGridRows([
        {
          employee_id: '',
          good_quantity: '50.0000',
          rework_quantity: '0.0000',
          rejected_quantity: '0.0000',
          piece_rate: '2.5000',
        },
      ]);
    }
    setIsBulkGridOpen(true);
  };

  const handleBulkGridSubmit = async () => {
    if (!bulkGridBatchId) {
      setBulkGridError('Please select a production batch.');
      return;
    }
    const validRows = bulkGridRows.filter((r) => r.employee_id && parseFloat(r.good_quantity) >= 0);
    if (validRows.length === 0) {
      setBulkGridError('Please configure at least one valid worker output row.');
      return;
    }
    const batch = batches.find((b) => b.id === bulkGridBatchId);
    const productId = batch?.product_id ?? products[0]?.id ?? '';

    setBulkGridSubmitting(true);
    setBulkGridError(null);
    try {
      await Promise.all(
        validRows.map((row) =>
          api.post('/production/worker-entries', {
            batch_id: bulkGridBatchId,
            employee_id: row.employee_id,
            product_id: productId,
            work_date: bulkGridDate,
            shift: bulkGridShift,
            wage_type: 'piece_rate',
            good_quantity: row.good_quantity,
            rework_quantity: row.rework_quantity,
            rejected_quantity: row.rejected_quantity,
            piece_rate: row.piece_rate,
          })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries', 'summary'] });
      setIsBulkGridOpen(false);
    } catch (err) {
      if (isApiError(err)) setBulkGridError(err.message ?? 'Failed to log bulk entries.');
      else setBulkGridError('Failed to save bulk worker outputs.');
    } finally {
      setBulkGridSubmitting(false);
    }
  };

  const exportSelectedCsv = (selectedEntries: WorkerProductionEntry[]) => {
    if (selectedEntries.length === 0) return;
    const headers = ['Worker', 'Employee Code', 'Batch', 'Product', 'Date', 'Shift', 'Good Qty', 'Rework Qty', 'Rejected Qty', 'Total Earned', 'Status'];
    const rows = selectedEntries.map((e) => [
      `"${(e.employee_name ?? e.employee_id ?? '').replace(/"/g, '""')}"`,
      `"${e.employee_code ?? ''}"`,
      `"${e.batch_number ?? e.batch_id ?? ''}"`,
      `"${(e.product_name ?? e.product_id ?? '').replace(/"/g, '""')}"`,
      `"${e.work_date}"`,
      `"${e.shift}"`,
      `"${e.good_quantity}"`,
      `"${e.rework_quantity}"`,
      `"${e.rejected_quantity}"`,
      `"${e.total_earned ?? ''}"`,
      `"${e.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worker-production-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const entryColumns: ResponsiveColumn<WorkerProductionEntry>[] = useMemo(() => [
    {
      id: 'select',
      header: (
        <input
          ref={headerCheckboxRef}
          type="checkbox"
          checked={isAllSelected}
          onChange={toggleSelectAll}
          aria-label="Select all entries"
          className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
        />
      ),
      className: 'w-10 text-center',
      accessor: (entry) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedEntryIds.has(entry.id)}
            onChange={() => toggleSelectEntry(entry.id)}
            aria-label={`Select entry for ${entry.employee_name ?? entry.employee_id}`}
            className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
          />
        </div>
      ),
    },
    {
      id: 'worker',
      header: 'Worker',
      isPrimary: true,
      accessor: (entry) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold text-default flex items-center gap-1.5" title={entry.employee_name ?? entry.employee_id}>
            <UserCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{entry.employee_name ?? entry.employee_id}</span>
          </div>
          {entry.employee_code && (
            <div className="text-[10px] text-muted font-mono mt-0.5">{entry.employee_code}</div>
          )}
        </div>
      ),
    },
    {
      id: 'batch_product',
      header: 'Batch & Product',
      accessor: (entry) => (
        <div>
          <div className="font-mono font-medium text-primary whitespace-nowrap">
            {entry.batch_number ?? entry.batch_id}
          </div>
          <div className="text-[10px] text-muted mt-0.5" title={entry.product_name ?? entry.product_id}>
            {entry.product_name ?? entry.product_id}
          </div>
        </div>
      ),
    },
    {
      id: 'shift_date',
      header: 'Shift & Date',
      priority: 'medium',
      accessor: (entry) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-default text-xs">{formatDateDisplay(entry.work_date)}</div>
          <div className="text-[10px] uppercase font-semibold text-muted mt-0.5">
            {formatShiftDisplay(entry.shift)}
          </div>
        </div>
      ),
    },
    {
      id: 'quantities',
      header: 'Good / Rew / Rej',
      align: 'center',
      priority: 'medium',
      accessor: (entry) => (
        <div className="font-mono text-center whitespace-nowrap">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{entry.good_quantity}</span>
          <span className="text-muted/60"> / </span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">{entry.rework_quantity}</span>
          <span className="text-muted/60"> / </span>
          <span className="text-rose-600 dark:text-rose-400 font-medium">{entry.rejected_quantity}</span>
        </div>
      ),
    },
    {
      id: 'earned',
      header: 'Earned',
      align: 'right',
      priority: 'medium',
      accessor: (entry) => (
        <div className="font-mono text-default font-bold text-right whitespace-nowrap">
          {entry.total_earned
            ? formatCurrency(Number(entry.total_earned))
            : formatCurrency(Number(entry.good_quantity || 0) * Number(entry.piece_rate || 2.5))}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      priority: 'medium',
      accessor: (entry) => <StatusBadge status={entry.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      priority: 'low',
      accessor: (entry) => (
        <div className="flex items-center justify-end gap-1.5 relative">
          {entry.status === 'draft' ? (
            <button
              type="button"
              onClick={() => verifyMutation.mutate(entry.id)}
              disabled={verifyMutation.isPending}
              className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs touch-target"
              title="Verify and Lock Entry"
            >
              <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Verify</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditDraft({
                  id: entry.id,
                  worker_name: entry.employee_name,
                  batch_number: entry.batch_number,
                  product_name: entry.product_name,
                  good_quantity: entry.good_quantity,
                  rework_quantity: entry.rework_quantity,
                  rejected_quantity: entry.rejected_quantity,
                  piece_rate: entry.piece_rate || '2.5000',
                  hours_worked: entry.hours_worked || '',
                  wage_type: entry.wage_type || 'piece_rate',
                });
                setEditErrorMsg(null);
              }}
              className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs touch-target"
              title="Edit Worker Entry"
            >
              <Edit3 className="size-3 text-primary shrink-0" />
              <span>Edit</span>
            </button>
          )}

          <div className="relative inline-block text-left">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (openActionMenuId === entry.id) {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                } else {
                  setOpenActionMenuId(entry.id);
                  setActionMenuAnchor(e.currentTarget);
                }
              }}
              className={`px-2 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs touch-target ${
                openActionMenuId === entry.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-default bg-surface hover:bg-surface-sunken text-default'
              }`}
              title="More actions for entry"
              aria-label="More options for worker entry"
            >
              <span>Actions</span>
              <ChevronDown className="size-3 text-muted" />
            </button>

            <ActionMenuPortal
              isOpen={openActionMenuId === entry.id}
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
                  setEditDraft({
                    id: entry.id,
                    worker_name: entry.employee_name,
                    batch_number: entry.batch_number,
                    product_name: entry.product_name,
                    good_quantity: entry.good_quantity,
                    rework_quantity: entry.rework_quantity,
                    rejected_quantity: entry.rejected_quantity,
                    piece_rate: entry.piece_rate || '2.5000',
                    hours_worked: entry.hours_worked || '',
                    wage_type: entry.wage_type || 'piece_rate',
                  });
                  setEditErrorMsg(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <Edit3 className="size-3.5 text-primary shrink-0" />
                <span>Edit Quantities</span>
              </button>

              {entry.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    verifyMutation.mutate(entry.id);
                  }}
                  disabled={verifyMutation.isPending}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Verify and Lock</span>
                </button>
              )}

              <div className="my-1 border-t border-default/50" />
              <button
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                  setDeleteConfirm({
                    open: true,
                    id: entry.id,
                    name: `${entry.employee_name ?? 'Worker'} (${entry.good_quantity} units)`,
                  });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                <span>Delete Entry</span>
              </button>
            </ActionMenuPortal>
          </div>
        </div>
      ),
    },
  ], [isAllSelected, selectedEntryIds, openActionMenuId, actionMenuAnchor, verifyMutation.isPending, formatCurrency]);

  const getMobileActions = (entry: WorkerProductionEntry) => {
    const actions = [
      {
        label: 'Edit Quantities',
        icon: <Edit3 className="size-4 text-primary" />,
        onClick: () => {
          setEditDraft({
            id: entry.id,
            worker_name: entry.employee_name,
            batch_number: entry.batch_number,
            product_name: entry.product_name,
            good_quantity: entry.good_quantity,
            rework_quantity: entry.rework_quantity,
            rejected_quantity: entry.rejected_quantity,
            piece_rate: entry.piece_rate || '2.5000',
            hours_worked: entry.hours_worked || '',
            wage_type: entry.wage_type || 'piece_rate',
          });
          setEditErrorMsg(null);
        },
      },
    ];
    if (entry.status === 'draft') {
      actions.push({
        label: 'Verify and Lock',
        icon: <ShieldCheck className="size-4 text-emerald-500" />,
        onClick: () => verifyMutation.mutate(entry.id),
      });
    }
    actions.push({
      label: 'Delete Entry',
      icon: <Trash2 className="size-4 text-rose-500" />,
      variant: 'destructive' as const,
      onClick: () => {
        setDeleteConfirm({
          open: true,
          id: entry.id,
          name: `${entry.employee_name ?? 'Worker'} (${entry.good_quantity} units)`,
        });
      },
    });
    return actions;
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total Good Output
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {summary.total_good_quantity ?? '0.0000'}
            </div>
          </div>
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Rework Quantity
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {summary.total_rework_quantity ?? '0.0000'}
            </div>
          </div>
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Rejected Quantity
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {summary.total_rejected_quantity ?? '0.0000'}
            </div>
          </div>
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Earned Wages
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(summary.total_earned ?? 0))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by worker name or employee code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Shifts' },
              { value: 'morning', label: 'Morning Shift', colorDot: 'bg-amber-400' },
              { value: 'evening', label: 'Evening Shift', colorDot: 'bg-indigo-500' },
              { value: 'night', label: 'Night Shift', colorDot: 'bg-purple-600' },
              { value: 'general', label: 'General Shift', colorDot: 'bg-blue-500' },
            ]}
            value={shiftFilter}
            onChange={(val) => setShiftFilter(val)}
            size="sm"
            aria-label="Filter production by shift"
          />

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft', colorDot: 'bg-slate-400' },
              { value: 'verified', label: 'Verified', colorDot: 'bg-emerald-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter production by status"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleOpenBulkGrid}
            className="flex items-center gap-1.5 min-h-11"
          >
            <LayoutGrid className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Bulk Piece-Rate Grid</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 min-h-11"
          >
            <FileUp className="h-4 w-4 text-primary" />
            <span>Import Piece-Rate Logs</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              const defaultBatch = batches[0];
              const defaultProduct = defaultBatch
                ? products.find((p) => p.id === defaultBatch.product_id) ?? products[0]
                : products[0];
              setDraft({
                batch_id: defaultBatch?.id ?? '',
                employee_id: employees[0]?.id ?? '',
                product_id: defaultProduct?.id ?? defaultBatch?.product_id ?? '',
                work_date: new Date().toISOString().slice(0, 10),
                shift: 'morning',
                wage_type: 'piece_rate',
                good_quantity: '50.0000',
                rework_quantity: '0.0000',
                rejected_quantity: '0.0000',
                piece_rate: '2.5000',
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 min-h-11"
          >
            <Plus className="h-4 w-4" />
            <span>Log Worker Output</span>
          </Button>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedEntryIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedEntryIds.size} log{selectedEntryIds.size > 1 ? 's' : ''} selected</span>
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
                const selected = entries.filter((e) => selectedEntryIds.has(e.id));
                exportSelectedCsv(selected);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkVerify}
              disabled={isBulkVerifying}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700"
            >
              <ShieldCheck className="size-3.5" />
              <span>{isBulkVerifying ? 'Verifying...' : 'Bulk Verify'}</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="size-3.5" />
              <span>Bulk Delete ({selectedEntryIds.size})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <QueryBoundary
        status={entriesQuery.status}
        error={entriesQuery.error}
        data={entriesQuery.data}
        isFetching={entriesQuery.isFetching}
      >
        <ResponsiveDataTable<WorkerProductionEntry>
          data={entries}
          columns={entryColumns}
          keyExtractor={(entry) => entry.id}
          mobileActions={getMobileActions}
          emptyState={{
            icon: <Users className="size-6 text-muted" />,
            title: 'No worker production entries found',
            description: 'Log your first worker output or run a bulk piece-rate shift.',
          }}
        />
      </QueryBoundary>

      {/* Log Output Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Log Worker Production Output"
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
                Employee / Worker
              </label>
              <select
                value={draft.employee_id || employees[0]?.id || ''}
                onChange={(e) => setDraft((d) => ({ ...d, employee_id: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} - {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Production Batch
              </label>
              <select
                value={draft.batch_id || batches[0]?.id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const b = batches.find((item) => item.id === val);
                  setDraft((d) => ({
                    ...d,
                    batch_id: val,
                    product_id: b?.product_id ?? d.product_id,
                  }));
                }}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} ({b.product_name ?? 'Product'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Work Date
              </label>
              <input
                type="date"
                value={draft.work_date}
                onChange={(e) => setDraft((d) => ({ ...d, work_date: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Shift
              </label>
              <select
                value={draft.shift}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    shift: e.target.value as 'morning' | 'evening' | 'night' | 'general',
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Wage Basis
              </label>
              <select
                value={draft.wage_type}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    wage_type: e.target.value as 'piece_rate' | 'hourly',
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="piece_rate">Piece Rate</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Good Qty (Units)
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.good_quantity}
                onChange={(e) => setDraft((d) => ({ ...d, good_quantity: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Rework Qty
              </label>
              <input
                type="number"
                step="0.0001"
                value={draft.rework_quantity}
                onChange={(e) => setDraft((d) => ({ ...d, rework_quantity: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-amber-600 dark:text-amber-400 focus:border-primary focus:outline-none"
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
                onChange={(e) => setDraft((d) => ({ ...d, rejected_quantity: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-rose-600 dark:text-rose-400 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const effectiveBatchId = draft.batch_id || batches[0]?.id || '';
                const effectiveEmployeeId = draft.employee_id || employees[0]?.id || '';
                const selectedBatch = batches.find((b) => b.id === effectiveBatchId);
                createMutation.mutate({
                  ...draft,
                  batch_id: effectiveBatchId,
                  employee_id: effectiveEmployeeId,
                  product_id: draft.product_id || selectedBatch?.product_id || '',
                });
              }}
              disabled={
                createMutation.isPending ||
                (!draft.employee_id && !employees[0]?.id) ||
                (!draft.batch_id && !batches[0]?.id)
              }
              className="min-h-11"
            >
              {createMutation.isPending ? 'Logging...' : 'Save Entry'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Output Modal */}
      {editDraft && (
        <Modal
          open={Boolean(editDraft)}
          onClose={() => setEditDraft(null)}
          title="Edit Worker Production Output"
        >
          <div className="space-y-4">
            {editErrorMsg && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {editErrorMsg}
              </div>
            )}

            <div className="rounded-xl bg-surface-sunken p-3 border border-default text-xs space-y-1">
              <div className="font-semibold text-default">{editDraft.worker_name}</div>
              <div className="text-muted">
                Batch: <span className="font-mono text-default font-semibold">{editDraft.batch_number}</span> · Product: <span className="text-default">{editDraft.product_name}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Good Output
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editDraft.good_quantity}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, good_quantity: e.target.value } : null))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Rework Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editDraft.rework_quantity}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, rework_quantity: e.target.value } : null))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-amber-600 dark:text-amber-400 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Rejected Qty
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editDraft.rejected_quantity}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, rejected_quantity: e.target.value } : null))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-rose-600 dark:text-rose-400 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Piece Rate
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editDraft.piece_rate}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, piece_rate: e.target.value } : null))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Hours Worked
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editDraft.hours_worked ?? ''}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, hours_worked: e.target.value } : null))}
                  placeholder="e.g. 8.00"
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs font-mono text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setEditDraft(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => editDraft && updateMutation.mutate(editDraft)}
                disabled={updateMutation.isPending || !editDraft.good_quantity}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Entry'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Entry Confirmation Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: '', name: '' })}
        title="Confirm Entry Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-default">
            Are you sure you want to delete worker production entry for{' '}
            <span className="font-semibold text-rose-600 dark:text-rose-400">
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
                deleteEntryMutation.mutate(deleteConfirm.id);
                setDeleteConfirm({ open: false, id: '', name: '' });
              }}
              disabled={deleteEntryMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {deleteEntryMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <Modal
          open={showBulkDeleteModal}
          onClose={() => !isBulkDeleting && setShowBulkDeleteModal(false)}
          title="Confirm Bulk Deletion"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm Bulk Worker Output Logs Deletion</p>
                <p className="mt-1 text-muted">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-default font-mono">
                    {selectedEntryIds.size}
                  </strong>{' '}
                  selected worker production entries? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-default">
              <Button
                variant="ghost"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedEntryIds.size} Logs`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        config={pieceRateLogImportSchema}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries'] });
          queryClient.invalidateQueries({ queryKey: ['production', 'worker-entries', 'summary'] });
        }}
      />

      {/* Bulk Piece-Rate Entry Grid Modal */}
      {isBulkGridOpen && (
        <Modal
          open={isBulkGridOpen}
          onClose={() => !bulkGridSubmitting && setIsBulkGridOpen(false)}
          title="Bulk Piece-Rate Floor Entry Grid"
          size="lg"
        >
          <div className="space-y-4">
            {bulkGridError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
                {bulkGridError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-surface-sunken border border-border">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Batch
                </label>
                <select
                  value={bulkGridBatchId}
                  onChange={(e) => setBulkGridBatchId(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} - {b.product_name ?? b.product_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Work Date
                </label>
                <input
                  type="date"
                  value={bulkGridDate}
                  onChange={(e) => setBulkGridDate(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Shift
                </label>
                <select
                  value={bulkGridShift}
                  onChange={(e) => setBulkGridShift(e.target.value as any)}
                  className="w-full rounded-xl border border-default bg-surface p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="morning">Morning Shift</option>
                  <option value="evening">Evening Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="general">General Shift</option>
                </select>
              </div>
            </div>

            {/* Grid Table */}
            <div className="overflow-x-auto rounded-xl border border-default">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Worker</th>
                    <th className="px-3 py-2.5 w-28 text-right">Good Qty</th>
                    <th className="px-3 py-2.5 w-24 text-right">Rework Qty</th>
                    <th className="px-3 py-2.5 w-24 text-right">Rejected</th>
                    <th className="px-3 py-2.5 w-28 text-right">Rate ($)</th>
                    <th className="px-3 py-2.5 w-28 text-right">Earned ($)</th>
                    <th className="px-2 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {bulkGridRows.map((row, idx) => {
                    const earned = (parseFloat(row.good_quantity) || 0) * (parseFloat(row.piece_rate) || 0);
                    return (
                      <tr key={idx} className="hover:bg-surface-sunken/40">
                        <td className="px-3 py-2">
                          <select
                            value={row.employee_id}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkGridRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, employee_id: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-default bg-surface p-1.5 text-xs text-default focus:border-primary focus:outline-none"
                          >
                            <option value="">Select Worker</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={row.good_quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkGridRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, good_quantity: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-default bg-surface p-1.5 text-xs text-right font-mono focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={row.rework_quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkGridRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, rework_quantity: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-default bg-surface p-1.5 text-xs text-right font-mono focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={row.rejected_quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkGridRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, rejected_quantity: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-default bg-surface p-1.5 text-xs text-right font-mono focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={row.piece_rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkGridRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, piece_rate: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-default bg-surface p-1.5 text-xs text-right font-mono focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(earned)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {bulkGridRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setBulkGridRows((rows) => rows.filter((_, i) => i !== idx))
                              }
                              className="text-muted hover:text-rose-500 p-1 cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-default bg-surface-sunken font-semibold text-xs">
                  <tr>
                    <td className="px-3 py-2 text-default">
                      Total ({bulkGridRows.length} workers)
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {bulkGridRows.reduce((acc, r) => acc + (parseFloat(r.good_quantity) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-600">
                      {bulkGridRows.reduce((acc, r) => acc + (parseFloat(r.rework_quantity) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600">
                      {bulkGridRows.reduce((acc, r) => acc + (parseFloat(r.rejected_quantity) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">-</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                      {formatCurrency(
                        bulkGridRows.reduce(
                          (acc, r) =>
                            acc + (parseFloat(r.good_quantity) || 0) * (parseFloat(r.piece_rate) || 0),
                          0
                        )
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setBulkGridRows((rows) => [
                    ...rows,
                    {
                      employee_id: '',
                      good_quantity: '50.0000',
                      rework_quantity: '0.0000',
                      rejected_quantity: '0.0000',
                      piece_rate: '2.5000',
                    },
                  ])
                }
                className="flex items-center gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Add Worker Row</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsBulkGridOpen(false)}
                  disabled={bulkGridSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkGridSubmit}
                  disabled={bulkGridSubmitting}
                  className="flex items-center gap-1.5"
                >
                  <Users className="size-3.5" />
                  <span>{bulkGridSubmitting ? 'Logging...' : `Submit Output for ${bulkGridRows.length} Workers`}</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
