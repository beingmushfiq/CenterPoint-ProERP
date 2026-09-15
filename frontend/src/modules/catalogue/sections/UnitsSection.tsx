import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Ruler, Search, Eye, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { unitImportSchema } from '../schemas/unitImportSchema';
import type { Unit } from '../../../types/api/unit';

interface UnitFormDraft {
  code: string;
  name: string;
  type: string;
  is_base: boolean;
  precision: number;
  is_active?: boolean;
}

export function UnitsSection() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<UnitFormDraft>({
    code: '',
    name: '',
    type: 'piece',
    is_base: true,
    precision: 2,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const unitsQuery = useQuery({
    queryKey: ['catalogue', 'units', search],
    queryFn: ({ signal }) =>
      api.get<Unit[]>('/units', {
        signal,
        params: search.trim().length >= 2 ? { q: search.trim() } : {},
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: UnitFormDraft) => api.post<Unit>('/units', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'units'] });
      setIsCreateOpen(false);
      setDraft({ code: '', name: '', type: 'piece', is_base: true, precision: 2, is_active: true });
      setErrorMsg(null);
      notify.success('Unit of measurement created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('Unit code already exists.');
        else setErrorMsg(err.message ?? 'Failed to create unit.');
      } else {
        setErrorMsg('Error creating unit.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UnitFormDraft> }) =>
      api.patch<Unit>(`/units/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'units'] });
      setEditingUnit(null);
      setErrorMsg(null);
      notify.success('Unit updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update unit.');
      } else {
        setErrorMsg('Error updating unit.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/units/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'units'] });
      setDeletingUnit(null);
      notify.success('Unit deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete unit.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (unit: Unit) => {
    setErrorMsg(null);
    setDraft({
      code: unit.code,
      name: unit.name,
      type: unit.type,
      is_base: unit.is_base,
      precision: unit.precision,
      is_active: unit.is_active,
    });
    setEditingUnit(unit);
  };

  const { data: _unitOptions } = useQuery({
    queryKey: ['catalogue', 'units', 'options'],
    queryFn: async () => {
      const res = await api.get<any>('/units/options');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
  });

  const handleViewUnit = async (u: Unit) => {
    try {
      const res = await api.get<any>(`/units/${u.uuid || u.id}`);
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? res.data.data
        : res.data;
      setViewingUnit(payload || u);
    } catch {
      setViewingUnit(u);
    }
  };

  const units = unitsQuery.data?.data ?? [];

  const handleExportCsv = () => {
    if (!units.length) {
      notify.info('No units to export.');
      return;
    }
    const headers = ['code', 'name', 'type', 'precision', 'is_base', 'is_active'];
    const rows = units.map((u) => [
      u.code,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      u.type,
      u.precision,
      u.is_base ? 'TRUE' : 'FALSE',
      u.is_active ? 'TRUE' : 'FALSE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `units_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${units.length} units to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Search and Add Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search units by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Import units from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export units to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setDraft({ code: '', name: '', type: 'piece', is_base: true, precision: 2, is_active: true });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Unit</span>
          </Button>
        </div>
      </div>

      <QueryBoundary
        status={unitsQuery.status}
        error={unitsQuery.error}
        data={unitsQuery.data}
        isFetching={unitsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="border-b border-default bg-surface-sunken/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Code</th>
                <th className="py-3.5 px-3">Name</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3">Classification</th>
                <th className="py-3.5 px-3">Precision</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No measurement units found.
                  </td>
                </tr>
              ) : (
                units.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-mono font-semibold text-primary">
                      {u.code}
                    </td>
                    <td className="py-3.5 px-3 text-default font-medium">{u.name}</td>
                    <td className="py-3.5 px-3 capitalize">
                      <span className="inline-flex items-center gap-1 text-muted">
                        <Ruler className="h-3.5 w-3.5 text-muted" />
                        {u.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          u.is_base
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-surface-sunken text-muted border border-default'
                        }`}
                      >
                        {u.is_base ? 'Base Unit' : 'Derived'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-muted">{u.precision} decimal(s)</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewUnit(u)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="View Unit Details"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Edit Unit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUnit(u)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Delete Unit"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </QueryBoundary>

      {/* Create Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Unit of Measurement"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(draft);
          }}
          className="space-y-4"
        >
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. PCS, KG, LTR"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Type *</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="piece">Piece (Discrete)</option>
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
                <option value="length">Length</option>
                <option value="area">Area</option>
                <option value="time">Time</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Pieces, Kilogram, Litre"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Decimal Precision
              </label>
              <input
                type="number"
                min="0"
                max="4"
                value={draft.precision}
                onChange={(e) =>
                  setDraft({ ...draft, precision: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="create_is_base"
                checked={draft.is_base}
                onChange={(e) => setDraft({ ...draft, is_base: e.target.checked })}
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="create_is_base" className="text-xs font-medium text-default">
                Is Base Unit
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Unit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingUnit && (
        <Modal
          open={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          title={`Edit Unit: ${editingUnit.code}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingUnit.id,
                payload: draft,
              });
            }}
            className="space-y-4"
          >
            {errorMsg && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Code *</label>
                <input
                  required
                  type="text"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Type *</label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="piece">Piece (Discrete)</option>
                  <option value="weight">Weight</option>
                  <option value="volume">Volume</option>
                  <option value="length">Length</option>
                  <option value="area">Area</option>
                  <option value="time">Time</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Name *</label>
              <input
                required
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">
                  Decimal Precision
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={draft.precision}
                  onChange={(e) =>
                    setDraft({ ...draft, precision: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_base"
                    checked={draft.is_base}
                    onChange={(e) => setDraft({ ...draft, is_base: e.target.checked })}
                    className="size-4 rounded border-default text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="edit_is_base" className="text-xs font-medium text-default">
                    Is Base Unit
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={draft.is_active ?? true}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                    className="size-4 rounded border-default text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="edit_is_active" className="text-xs font-medium text-default">
                    Active Status
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingUnit(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Unit'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingUnit && (
        <Modal
          open={Boolean(viewingUnit)}
          onClose={() => setViewingUnit(null)}
          title={`Unit Details: ${viewingUnit.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingUnit.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Type</span>
                <span className="font-medium text-default capitalize">{viewingUnit.type}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Classification</span>
                <span className="font-medium text-default">{viewingUnit.is_base ? 'Primary Base Unit' : 'Derived Unit'}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Precision</span>
                <span className="font-mono text-default">{viewingUnit.precision} Decimal Place(s)</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {viewingUnit.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingUnit(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUnit && (
        <Modal
          open={Boolean(deletingUnit)}
          onClose={() => setDeletingUnit(null)}
          title="Delete Unit"
        >
          <div className="space-y-4 text-xs">
            <p className="text-default">
              Are you sure you want to delete unit{' '}
              <strong className="text-primary font-mono">{deletingUnit.code}</strong> (
              {deletingUnit.name})?
            </p>
            <p className="text-muted text-[11px]">
              This action cannot be undone if products or recipes are actively linked to this measurement unit.
            </p>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" onClick={() => setDeletingUnit(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingUnit.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={unitImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'units'] });
        }}
      />
    </div>
  );
}
