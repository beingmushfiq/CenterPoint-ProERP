import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  Sliders,
  Plus,
  Search,
  XCircle,
  Edit2,
  Trash2,
  FileUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { Modal, ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { isApiError } from '../../../lib/api/errors';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { qcParameterImportSchema } from '../schemas/qcParameterImportSchema';
import { cn } from '../../../lib/utils';
import type { QcParameter } from '../../../types/api/qc';

interface ParameterFormData {
  code: string;
  name: string;
  category: string;
  data_type: 'numeric' | 'boolean' | 'options' | 'text';
  min_value?: string;
  max_value?: string;
  target_value?: string;
  unit_of_measure?: string;
  is_mandatory: boolean;
}

export function QcParametersSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('qc.parameter.delete');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<QcParameter | null>(null);
  const [editForm, setEditForm] = useState<ParameterFormData>({
    code: '',
    name: '',
    category: 'physical',
    data_type: 'numeric',
    min_value: '0.0000',
    max_value: '100.0000',
    target_value: '50.0000',
    unit_of_measure: 'mm',
    is_mandatory: true,
  });
  const [deletingParameter, setDeletingParameter] = useState<QcParameter | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<ParameterFormData>({
    code: '',
    name: '',
    category: 'physical',
    data_type: 'numeric',
    min_value: '0.0000',
    max_value: '100.0000',
    target_value: '50.0000',
    unit_of_measure: 'mm',
    is_mandatory: true,
  });

  const queryClient = useQueryClient();

  const paramsQuery = useQuery({
    queryKey: ['qc', 'parameters', search, categoryFilter],
    queryFn: ({ signal }) =>
      api.get<QcParameter[]>('/qc/parameters', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
        },
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ParameterFormData) => {
      const body = {
        name: payload.name,
        type: payload.data_type,
        data_type: payload.data_type,
        category: payload.category,
        code: payload.code,
        is_mandatory: payload.is_mandatory,
        ...(payload.data_type === 'numeric'
          ? {
              min_value: payload.min_value || undefined,
              max_value: payload.max_value || undefined,
            }
          : {}),
      };
      return api.post<QcParameter>('/qc/parameters', body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });
      setIsCreateOpen(false);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to create parameter.');
      else setErrorMsg('Error creating QC parameter.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ParameterFormData }) => {
      const body = {
        name: payload.name,
        type: payload.data_type,
        data_type: payload.data_type,
        category: payload.category,
        is_mandatory: payload.is_mandatory,
        ...(payload.data_type === 'numeric'
          ? {
              min_value: payload.min_value || undefined,
              max_value: payload.max_value || undefined,
            }
          : {
              min_value: null,
              max_value: null,
            }),
      };
      return api.put<QcParameter>(`/qc/parameters/${id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });
      setEditingParameter(null);
      setErrorMsg(null);
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to update parameter.');
      else setErrorMsg('Error updating QC parameter.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/qc/parameters/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });
      setDeletingParameter(null);
      setErrorMsg(null);
      notify.success('QC parameter moved to Data Bin successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) setErrorMsg(err.message ?? 'Failed to move parameter to Data Bin.');
      else notify.error('Failed to move QC parameter to Data Bin.');
    },
  });

  const toggleMandatoryMutation = useMutation({
    mutationFn: (param: QcParameter) =>
      api.put(`/qc/parameters/${param.id}`, { is_mandatory: !param.is_mandatory }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });
    },
  });

  const openEditModal = (param: QcParameter) => {
    setErrorMsg(null);
    setEditingParameter(param);
    setEditForm({
      code: param.code ?? '',
      name: param.name ?? '',
      category: (param as { category?: string }).category ?? 'physical',
      data_type: (param.data_type ?? param.type ?? 'numeric') as 'numeric' | 'boolean' | 'options' | 'text',
      min_value: param.min_value ?? '0.0000',
      max_value: param.max_value ?? '100.0000',
      target_value: param.target_value ?? '50.0000',
      unit_of_measure: param.unit_of_measure ?? '',
      is_mandatory: Boolean(param.is_mandatory),
    });
    void api.get<QcParameter>(`/qc/parameters/${(param as unknown as { uuid?: string }).uuid || param.id}`).then((res) => {
      if (res.data) {
        setEditingParameter(res.data);
      }
    }).catch(() => {});
  };

  const parameters = paramsQuery.data?.data ?? [];

  const toggleSelectAll = () => {
    if (selectedIds.size === parameters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parameters.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < parameters.length;
    }
  }, [selectedIds, parameters.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await api.delete(`/qc/parameters/${id}`);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsBulkDeleting(false);
    setShowBulkDeleteModal(false);
    setSelectedIds(new Set());
    await queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });

    if (failCount === 0) {
      notify.success(`${successCount} QC parameter(s) moved to Data Bin successfully.`);
    } else if (successCount > 0) {
      notify.warning(`Moved ${successCount} parameter(s) to Data Bin, but ${failCount} failed.`);
    } else {
      notify.error('Failed to move selected QC parameters to Data Bin.');
    }
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
              placeholder="Search parameters by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-default bg-surface-sunken py-2 px-3 text-xs text-default focus:border-primary focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="physical">Physical Inspection</option>
            <option value="chemical">Chemical Analysis</option>
            <option value="microbiological">Microbiological</option>
            <option value="packaging">Packaging Quality</option>
            <option value="sensory">Sensory & Taste</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5"
          >
            <FileUp className="h-4 w-4 text-primary" />
            <span>Import Parameters</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setDraft({
                code: `QC-${Date.now().toString().slice(-4)}`,
                name: '',
                category: 'physical',
                data_type: 'numeric',
                min_value: '0.0000',
                max_value: '100.0000',
                target_value: '50.0000',
                unit_of_measure: 'mm',
                is_mandatory: true,
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New QC Parameter</span>
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} QC parameter(s) selected
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

      {/* Table */}
      <QueryBoundary
        status={paramsQuery.status}
        error={paramsQuery.error}
        data={paramsQuery.data}
        isFetching={paramsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <div className="overflow-x-auto min-h-75">
            <table className="w-full text-left text-xs text-default">
              <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-10 py-3.5 pl-4 pr-3">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      aria-label="Select all parameters"
                      checked={parameters.length > 0 && selectedIds.size === parameters.length}
                      onChange={toggleSelectAll}
                      className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 pl-4 pr-3">Parameter Code</th>
                  <th className="py-3.5 px-3">Name & Category</th>
                  <th className="py-3.5 px-3">Type & Unit</th>
                  <th className="py-3.5 px-3">Tolerance Specs</th>
                  <th className="py-3.5 px-3">Mandatory</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {parameters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken border border-default mb-2">
                        <Sliders className="h-5 w-5 text-muted" />
                      </div>
                      <div className="text-sm font-medium text-default">
                        No QC parameters configured
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Configure your standard quality specs and tolerance bands.
                      </div>
                    </td>
                  </tr>
                ) : (
                  parameters.map((param) => (
                    <tr
                      key={param.id}
                      className={cn(
                        'hover:bg-surface-sunken/60 transition-colors',
                        selectedIds.has(param.id) && 'bg-primary/5'
                      )}
                    >
                      <td className="py-3 pl-4 pr-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select parameter ${param.name}`}
                          checked={selectedIds.has(param.id)}
                          onChange={() => toggleSelect(param.id)}
                          className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 pl-4 pr-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {param.code ?? `QC-${param.id.slice(0, 4).toUpperCase()}`}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-default">{param.name}</div>
                        <div className="text-[10px] text-muted uppercase">
                          {(param as { category?: string }).category ?? 'physical'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="capitalize text-default">
                          {param.data_type ?? param.type}
                        </div>
                        {param.unit_of_measure && (
                          <div className="text-[10px] text-muted">
                            Unit: {param.unit_of_measure}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted">
                        {(param.data_type ?? param.type) === 'numeric' ? (
                          <span>
                            [{param.min_value ?? '-∞'} ..{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {param.target_value ?? '—'}
                            </strong>{' '}
                            .. {param.max_value ?? '+∞'}]
                          </span>
                        ) : (
                          <span className="italic text-muted">Discrete check</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleMandatoryMutation.mutate(param)}
                          title="Click to toggle mandatory status"
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {param.is_mandatory ? (
                            <Badge tone="warning-subtle">Mandatory</Badge>
                          ) : (
                            <Badge tone="surface-sunken">Optional</Badge>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        {param.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted text-xs font-medium">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(param)}
                            className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Edit parameter"
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
                                if (openActionMenuId === param.id) {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                } else {
                                  setOpenActionMenuId(param.id);
                                  setActionMenuAnchor(e.currentTarget);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                openActionMenuId === param.id
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-default bg-surface hover:bg-surface-sunken text-default'
                              }`}
                              title={`More options for ${param.name}`}
                              aria-label={`More options for parameter ${param.name}`}
                            >
                              <span>Actions</span>
                              <ChevronDown className="size-3 text-muted" />
                            </button>

                            <ActionMenuPortal
                              isOpen={openActionMenuId === param.id}
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
                                  openEditModal(param);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Edit2 className="size-3.5 text-muted shrink-0" />
                                <span>Edit Specs & Range</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setActionMenuAnchor(null);
                                  toggleMandatoryMutation.mutate(param);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Sliders className="size-3.5 text-primary shrink-0" />
                                <span>{param.is_mandatory ? 'Mark as Optional' : 'Mark as Mandatory'}</span>
                              </button>

                              {canDelete && (
                                <>
                                  <div className="my-1 border-t border-default/50" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                      setDeletingParameter(param);
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

      {/* Create Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add QC Standard Parameter"
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
                Parameter Code
              </label>
              <input
                type="text"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                placeholder="e.g. QC-WT-01"
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Parameter Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Net Unit Weight"
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="physical">Physical Inspection</option>
                <option value="chemical">Chemical Analysis</option>
                <option value="microbiological">Microbiological</option>
                <option value="packaging">Packaging Quality</option>
                <option value="sensory">Sensory & Taste</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Data Type
              </label>
              <select
                value={draft.data_type}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    data_type: e.target.value as 'numeric' | 'boolean' | 'options' | 'text',
                  }))
                }
                className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="numeric">Numeric (Measurement)</option>
                <option value="boolean">Boolean (Pass/Fail)</option>
                <option value="text">Text Notes</option>
              </select>
            </div>
          </div>

          {draft.data_type === 'numeric' && (
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-muted uppercase">Min Value</label>
                <input
                  type="number"
                  step="0.0001"
                  value={draft.min_value}
                  onChange={(e) => setDraft((d) => ({ ...d, min_value: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase">Target Value</label>
                <input
                  type="number"
                  step="0.0001"
                  value={draft.target_value}
                  onChange={(e) => setDraft((d) => ({ ...d, target_value: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase">Max Value</label>
                <input
                  type="number"
                  step="0.0001"
                  value={draft.max_value}
                  onChange={(e) => setDraft((d) => ({ ...d, max_value: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase">Unit of Measure</label>
                <input
                  type="text"
                  value={draft.unit_of_measure}
                  onChange={(e) => setDraft((d) => ({ ...d, unit_of_measure: e.target.value }))}
                  placeholder="e.g. g, ml, mm"
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="create_is_mandatory"
              checked={draft.is_mandatory}
              onChange={(e) => setDraft((d) => ({ ...d, is_mandatory: e.target.checked }))}
              className="rounded border-default text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="create_is_mandatory" className="text-xs text-default font-medium">
              Mandatory specification (Failure blocks product release)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => createMutation.mutate(draft)}
              disabled={createMutation.isPending || !draft.code || !draft.name}
            >
              {createMutation.isPending ? 'Saving...' : 'Create Parameter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editingParameter && (
        <Modal
          open={Boolean(editingParameter)}
          onClose={() => setEditingParameter(null)}
          title={`Edit QC Parameter: ${editForm.name}`}
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
                  Parameter Code
                </label>
                <input
                  type="text"
                  value={editForm.code}
                  disabled
                  className="w-full rounded-xl border border-default bg-surface-sunken/60 p-2 text-xs text-muted cursor-not-allowed focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Parameter Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((d) => ({ ...d, category: e.target.value }))}
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="physical">Physical Inspection</option>
                  <option value="chemical">Chemical Analysis</option>
                  <option value="microbiological">Microbiological</option>
                  <option value="packaging">Packaging Quality</option>
                  <option value="sensory">Sensory & Taste</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Data Type
                </label>
                <select
                  value={editForm.data_type}
                  onChange={(e) =>
                    setEditForm((d) => ({
                      ...d,
                      data_type: e.target.value as 'numeric' | 'boolean' | 'options' | 'text',
                    }))
                  }
                  className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="numeric">Numeric (Measurement)</option>
                  <option value="boolean">Boolean (Pass/Fail)</option>
                  <option value="text">Text Notes</option>
                </select>
              </div>
            </div>

            {editForm.data_type === 'numeric' && (
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-muted uppercase">Min Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editForm.min_value}
                    onChange={(e) => setEditForm((d) => ({ ...d, min_value: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase">Target Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editForm.target_value}
                    onChange={(e) => setEditForm((d) => ({ ...d, target_value: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase">Max Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editForm.max_value}
                    onChange={(e) => setEditForm((d) => ({ ...d, max_value: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase">Unit of Measure</label>
                  <input
                    type="text"
                    value={editForm.unit_of_measure}
                    onChange={(e) => setEditForm((d) => ({ ...d, unit_of_measure: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit_is_mandatory"
                checked={editForm.is_mandatory}
                onChange={(e) => setEditForm((d) => ({ ...d, is_mandatory: e.target.checked }))}
                className="rounded border-default text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="edit_is_mandatory" className="text-xs text-default font-medium">
                Mandatory specification (Failure blocks product release)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setEditingParameter(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  updateMutation.mutate({
                    id: editingParameter.id,
                    payload: editForm,
                  })
                }
                disabled={updateMutation.isPending || !editForm.name}
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Parameter'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Move to Bin Dialog */}
      <ConfirmDialog
        open={Boolean(deletingParameter)}
        onClose={() => setDeletingParameter(null)}
        onConfirm={() => {
          if (deletingParameter) {
            deleteMutation.mutate(deletingParameter.id);
          }
        }}
        title="Move QC Parameter to Data Bin"
        message={`Are you sure you want to move QC parameter "${deletingParameter?.code ?? deletingParameter?.name ?? ''}" to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel={deleteMutation.isPending ? 'Moving...' : 'Move to Bin'}
        variant="danger"
      />

      {/* Bulk Move to Bin Dialog */}
      <ConfirmDialog
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Move Selected QC Parameters to Data Bin"
        message={`Are you sure you want to move ${selectedIds.size} QC parameter(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`}
        confirmLabel={isBulkDeleting ? 'Moving...' : `Move ${selectedIds.size} Parameter(s) to Bin`}
        variant="danger"
      />

      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        config={qcParameterImportSchema}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['qc', 'parameters'] });
        }}
      />
    </div>
  );
}
