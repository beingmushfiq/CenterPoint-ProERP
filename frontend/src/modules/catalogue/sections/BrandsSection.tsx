import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, Search, Eye, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { brandImportSchema } from '../schemas/brandImportSchema';
import type { Brand } from '../../../types/api/catalog';

interface BrandFormDraft {
  code: string;
  name: string;
  logo_path?: string | null;
  is_active?: boolean;
}

export function BrandsSection() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [viewingBrand, setViewingBrand] = useState<Brand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<BrandFormDraft>({
    code: '',
    name: '',
    logo_path: null,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const brandsQuery = useQuery({
    queryKey: ['catalogue', 'brands', search],
    queryFn: ({ signal }) =>
      api.get<Brand[]>('/brands', {
        signal,
        params: search.trim().length >= 2 ? { q: search.trim() } : {},
      }),
  });

  useQuery({
    queryKey: ['catalogue', 'brands', 'options'],
    queryFn: ({ signal }) => api.get<Brand[]>('/brands/options', { signal }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: BrandFormDraft) => api.post<Brand>('/brands', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'brands'] });
      setIsCreateOpen(false);
      setDraft({ code: '', name: '', logo_path: null, is_active: true });
      setErrorMsg(null);
      notify.success('Brand registered successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('Brand code already exists.');
        else setErrorMsg(err.message ?? 'Failed to create brand.');
      } else {
        setErrorMsg('Error creating brand.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BrandFormDraft> }) =>
      api.patch<Brand>(`/brands/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'brands'] });
      setEditingBrand(null);
      setErrorMsg(null);
      notify.success('Brand updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update brand.');
      } else {
        setErrorMsg('Error updating brand.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'brands'] });
      setDeletingBrand(null);
      notify.success('Brand deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete brand.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (brand: Brand) => {
    setErrorMsg(null);
    setDraft({
      code: brand.code,
      name: brand.name,
      logo_path: brand.logo_path || null,
      is_active: brand.is_active,
    });
    setEditingBrand(brand);
    const brandId = (brand as { uuid?: string }).uuid || brand.id;
    void api.get<Brand>(`/brands/${brandId}`).then((res) => {
      if (res.data) setEditingBrand(res.data);
    }).catch(() => {});
  };

  const brands = brandsQuery.data?.data ?? [];

  const handleExportCsv = () => {
    if (!brands.length) {
      notify.info('No brands to export.');
      return;
    }
    const headers = ['code', 'name', 'logo_path', 'is_active'];
    const rows = brands.map((b) => [
      b.code,
      `"${(b.name || '').replace(/"/g, '""')}"`,
      `"${(b.logo_path || '').replace(/"/g, '""')}"`,
      b.is_active ? 'TRUE' : 'FALSE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `brands_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${brands.length} brands to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Search and New Brand Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search brands by code or name..."
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
            title="Import brands from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export brands to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setDraft({ code: '', name: '', logo_path: null, is_active: true });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Brand</span>
          </Button>
        </div>
      </div>

      <QueryBoundary
        status={brandsQuery.status}
        error={brandsQuery.error}
        data={brandsQuery.data}
        isFetching={brandsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="border-b border-default bg-surface-sunken/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Code</th>
                <th className="py-3.5 px-3">Brand Name</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {brands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted">
                    No brands found.
                  </td>
                </tr>
              ) : (
                brands.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-mono font-semibold text-primary">
                      {b.code}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-default flex items-center gap-1.5">
                      <Boxes className="size-3.5 text-muted" />
                      <span>{b.name}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          b.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingBrand(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="View Brand Details"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Edit Brand"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBrand(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Delete Brand"
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
        title="Register New Brand"
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

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Brand Code *</label>
            <input
              required
              type="text"
              placeholder="e.g. APEX, ARTISAN"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Brand Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Apex Classic, Artisan Reserve"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Brand'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingBrand && (
        <Modal
          open={Boolean(editingBrand)}
          onClose={() => setEditingBrand(null)}
          title={`Edit Brand: ${editingBrand.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingBrand.id,
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

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Brand Code *</label>
              <input
                required
                type="text"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Brand Name *</label>
              <input
                required
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="brand_edit_is_active"
                checked={draft.is_active ?? true}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="brand_edit_is_active" className="text-xs font-medium text-default">
                Active Brand Status
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingBrand(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Brand'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingBrand && (
        <Modal
          open={Boolean(viewingBrand)}
          onClose={() => setViewingBrand(null)}
          title={`Brand Details: ${viewingBrand.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingBrand.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Name</span>
                <span className="font-medium text-default">{viewingBrand.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {viewingBrand.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingBrand(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBrand && (
        <Modal
          open={Boolean(deletingBrand)}
          onClose={() => setDeletingBrand(null)}
          title="Delete Brand"
        >
          <div className="space-y-4 text-xs">
            <p className="text-default">
              Are you sure you want to delete brand{' '}
              <strong className="text-primary font-mono">{deletingBrand.name}</strong> (
              {deletingBrand.code})?
            </p>
            <p className="text-muted text-[11px]">
              This operation cannot be undone if products are assigned to this trademark line.
            </p>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" onClick={() => setDeletingBrand(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingBrand.id)}
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
        schema={brandImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'brands'] });
        }}
      />
    </div>
  );
}
