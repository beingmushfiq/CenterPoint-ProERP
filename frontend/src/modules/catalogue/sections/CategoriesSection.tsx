import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Tag, Eye, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { categoryImportSchema } from '../schemas/categoryImportSchema';
import type { Category } from '../../../types/api/catalog';

interface CategoryFormDraft {
  code: string;
  name: string;
  parent_id?: string | null;
  is_active?: boolean;
}

export function CategoriesSection() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<CategoryFormDraft>({
    code: '',
    name: '',
    parent_id: null,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['catalogue', 'categories', search],
    queryFn: ({ signal }) =>
      api.get<Category[]>('/categories', {
        signal,
        params: search.trim().length >= 2 ? { q: search.trim() } : {},
      }),
  });

  useQuery({
    queryKey: ['catalogue', 'categories', 'options'],
    queryFn: ({ signal }) => api.get<Category[]>('/categories/options', { signal }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CategoryFormDraft) => api.post<Category>('/categories', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'categories'] });
      setIsCreateOpen(false);
      setDraft({ code: '', name: '', parent_id: null, is_active: true });
      setErrorMsg(null);
      notify.success('Category created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('Category code already exists.');
        else setErrorMsg(err.message ?? 'Failed to create category.');
      } else {
        setErrorMsg('Error creating category.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CategoryFormDraft> }) =>
      api.patch<Category>(`/categories/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'categories'] });
      setEditingCategory(null);
      setErrorMsg(null);
      notify.success('Category updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update category.');
      } else {
        setErrorMsg('Error updating category.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'categories'] });
      setDeletingCategory(null);
      notify.success('Category deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete category.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (category: Category) => {
    setErrorMsg(null);
    setDraft({
      code: category.code,
      name: category.name,
      parent_id: category.parent_id || null,
      is_active: category.is_active,
    });
    setEditingCategory(category);
    const categoryId = (category as { uuid?: string }).uuid || category.id;
    void api.get<Category>(`/categories/${categoryId}`).then((res) => {
      if (res.data) setEditingCategory(res.data);
    }).catch(() => {});
  };

  const categories = categoriesQuery.data?.data ?? [];

  const handleExportCsv = () => {
    if (!categories.length) {
      notify.info('No categories to export.');
      return;
    }
    const headers = ['code', 'name', 'parent', 'is_active'];
    const rows = categories.map((c) => [
      c.code,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.parent?.name || c.parent_id || '').replace(/"/g, '""')}"`,
      c.is_active ? 'TRUE' : 'FALSE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `categories_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${categories.length} categories to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Search and Add Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search categories by name or code..."
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
            title="Import categories from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export categories to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setDraft({ code: '', name: '', parent_id: null, is_active: true });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Category</span>
          </Button>
        </div>
      </div>

      <QueryBoundary
        status={categoriesQuery.status}
        error={categoriesQuery.error}
        data={categoriesQuery.data}
        isFetching={categoriesQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="border-b border-default bg-surface-sunken/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Code</th>
                <th className="py-3.5 px-3">Name</th>
                <th className="py-3.5 px-3">Taxonomy Path</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    No categories registered.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-mono font-semibold text-primary">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-default flex items-center gap-1.5">
                      <Tag className="size-3.5 text-muted" />
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-muted">
                      {c.path || c.code}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          c.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingCategory(c)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="View Category Details"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(c)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Delete Category"
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
        title="Create Category"
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
                placeholder="e.g. RAW-GLS, RAW-COIL"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Parent Category (Optional)
              </label>
              <select
                value={draft.parent_id ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, parent_id: e.target.value ? e.target.value : null })
                }
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">None (Top-Level Root Category)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Ceramic Glass Panels & Coils"
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
              {createMutation.isPending ? 'Saving...' : 'Save Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingCategory && (
        <Modal
          open={Boolean(editingCategory)}
          onClose={() => setEditingCategory(null)}
          title={`Edit Category: ${editingCategory.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingCategory.id,
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
                <label className="block text-xs font-semibold text-default mb-1">
                  Parent Category
                </label>
                <select
                  value={draft.parent_id ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, parent_id: e.target.value ? e.target.value : null })
                  }
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="">None (Top-Level Root Category)</option>
                  {categories
                    .filter((c) => c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
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

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="cat_edit_is_active"
                checked={draft.is_active ?? true}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="cat_edit_is_active" className="text-xs font-medium text-default">
                Active Status
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingCategory(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Category'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingCategory && (
        <Modal
          open={Boolean(viewingCategory)}
          onClose={() => setViewingCategory(null)}
          title={`Category Details: ${viewingCategory.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingCategory.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Name</span>
                <span className="font-medium text-default">{viewingCategory.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Taxonomy Path</span>
                <span className="font-mono text-default">{viewingCategory.path || viewingCategory.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {viewingCategory.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingCategory(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <Modal
          open={Boolean(deletingCategory)}
          onClose={() => setDeletingCategory(null)}
          title="Delete Category"
        >
          <div className="space-y-4 text-xs">
            <p className="text-default">
              Are you sure you want to delete category{' '}
              <strong className="text-primary font-mono">{deletingCategory.name}</strong> (
              {deletingCategory.code})?
            </p>
            <p className="text-muted text-[11px]">
              This operation cannot be undone if child subcategories or items are assigned.
            </p>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" onClick={() => setDeletingCategory(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingCategory.id)}
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
        schema={categoryImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'categories'] });
        }}
      />
    </div>
  );
}
