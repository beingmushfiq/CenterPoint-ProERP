import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Search, Warehouse as WarehouseIcon, Eye, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { warehouseImportSchema } from '../schemas/warehouseImportSchema';
import type { Warehouse, WarehouseLocation } from '../../../types/api/catalog';

interface WarehouseFormDraft {
  code: string;
  name: string;
  type: string;
  address: string;
  allows_negative_stock: boolean;
  is_default: boolean;
  is_active?: boolean;
}

export function WarehousesSection() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [selectedWarehouseForLocation, setSelectedWarehouseForLocation] = useState<Warehouse | null>(null);
  const [locationDraft, setLocationDraft] = useState({ code: '', name: '', type: 'bin' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState<WarehouseFormDraft>({
    code: '',
    name: '',
    type: 'general',
    address: '',
    allows_negative_stock: false,
    is_default: false,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const warehousesQuery = useQuery({
    queryKey: ['catalogue', 'warehouses', search],
    queryFn: ({ signal }) =>
      api.get<Warehouse[]>('/warehouses', {
        signal,
        params: search.trim().length >= 2 ? { q: search.trim() } : {},
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: WarehouseFormDraft) => api.post<Warehouse>('/warehouses', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
      setIsCreateOpen(false);
      setDraft({
        code: '',
        name: '',
        type: 'general',
        address: '',
        allows_negative_stock: false,
        is_default: false,
        is_active: true,
      });
      setErrorMsg(null);
      notify.success('Warehouse facility created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('Warehouse code already exists.');
        else setErrorMsg(err.message ?? 'Failed to create warehouse.');
      } else {
        setErrorMsg('Error creating warehouse.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WarehouseFormDraft> }) =>
      api.patch<Warehouse>(`/warehouses/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
      setEditingWarehouse(null);
      setErrorMsg(null);
      notify.success('Warehouse updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update warehouse.');
      } else {
        setErrorMsg('Error updating warehouse.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
      setDeletingWarehouse(null);
      notify.success('Warehouse deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete warehouse.';
      notify.error(msg);
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: (payload: { code: string; name: string; type: string }) => {
      const warehouseId = selectedWarehouseForLocation?.id;
      if (!warehouseId) {
        throw new Error('Please select a warehouse before adding a location.');
      }
      return api.post<WarehouseLocation>(
        `/warehouses/${warehouseId}/locations`,
        payload
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
      setSelectedWarehouseForLocation(null);
      setLocationDraft({ code: '', name: '', type: 'bin' });
      notify.success('Location bin added.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to add location bin.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (w: Warehouse) => {
    setErrorMsg(null);
    setDraft({
      code: w.code,
      name: w.name,
      type: w.type,
      address: w.address || '',
      allows_negative_stock: w.allows_negative_stock,
      is_default: w.is_default,
      is_active: w.is_active,
    });
    setEditingWarehouse(w);
  };

  const warehouses = warehousesQuery.data?.data ?? [];

  const handleExportCsv = () => {
    if (!warehouses.length) {
      notify.info('No warehouses to export.');
      return;
    }
    const headers = ['code', 'name', 'type', 'address', 'allows_negative_stock', 'is_default', 'is_active'];
    const rows = warehouses.map((w) => [
      w.code,
      `"${(w.name || '').replace(/"/g, '""')}"`,
      w.type,
      `"${(w.address || '').replace(/"/g, '""')}"`,
      w.allows_negative_stock ? 'TRUE' : 'FALSE',
      w.is_default ? 'TRUE' : 'FALSE',
      w.is_active ? 'TRUE' : 'FALSE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `warehouses_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${warehouses.length} warehouses to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Search and New Warehouse Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search warehouses by name or code..."
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
            title="Import warehouses from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export warehouses to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setDraft({
                code: '',
                name: '',
                type: 'general',
                address: '',
                allows_negative_stock: false,
                is_default: false,
                is_active: true,
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Warehouse</span>
          </Button>
        </div>
      </div>

      <QueryBoundary
        status={warehousesQuery.status}
        error={warehousesQuery.error}
        data={warehousesQuery.data}
        isFetching={warehousesQuery.isFetching}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted border border-dashed border-default rounded-2xl bg-surface">
              No warehouses or depots registered yet.
            </div>
          ) : (
            warehouses.map((w) => (
              <div
                key={w.id}
                className="flex flex-col justify-between rounded-2xl border border-default bg-surface p-5 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <WarehouseIcon className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-default text-sm">{w.name}</h3>
                        <p className="font-mono text-[11px] text-primary font-bold">{w.code}</p>
                      </div>
                    </div>
                    {w.is_default && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Default
                      </span>
                    )}
                  </div>

                  {w.address && (
                    <div className="mt-3.5 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="size-3.5 shrink-0 text-muted" />
                      <span className="truncate">{w.address}</span>
                    </div>
                  )}

                  <div className="mt-3.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-md bg-surface-sunken border border-default px-2 py-0.5 text-muted capitalize font-medium">
                      {w.type} storage
                    </span>
                    {w.allows_negative_stock && (
                      <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-600 dark:text-amber-400 font-medium">
                        Negative Stock Allowed
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-default flex items-center justify-between">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingWarehouse(w)}
                      className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(w)}
                      className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                      title="Edit Warehouse"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingWarehouse(w)}
                      className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                      title="Delete Warehouse"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWarehouseForLocation(w);
                    }}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3" />
                    <span>Add Bin</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </QueryBoundary>

      {/* Create Warehouse Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Warehouse"
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
                placeholder="e.g. WH-CENTRAL"
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
                <option value="general">General Warehouse</option>
                <option value="raw_materials">Raw Materials Store</option>
                <option value="finished_goods">Finished Goods Depot</option>
                <option value="cold_storage">Cold Storage / Temperature Controlled</option>
                <option value="transit">In-Transit / Buffer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Dhaka Central Packaging Depot"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Address Location</label>
            <textarea
              rows={2}
              placeholder="Full physical address..."
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create_is_default"
                checked={draft.is_default}
                onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="create_is_default" className="text-xs font-medium text-default">
                Set as Default Branch Warehouse
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create_allows_negative"
                checked={draft.allows_negative_stock}
                onChange={(e) =>
                  setDraft({ ...draft, allows_negative_stock: e.target.checked })
                }
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="create_allows_negative" className="text-xs font-medium text-default">
                Allow Negative Stock Balance
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Warehouse'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Warehouse Modal */}
      {editingWarehouse && (
        <Modal
          open={Boolean(editingWarehouse)}
          onClose={() => setEditingWarehouse(null)}
          title={`Edit Warehouse: ${editingWarehouse.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingWarehouse.id,
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
                  <option value="general">General Warehouse</option>
                  <option value="raw_materials">Raw Materials Store</option>
                  <option value="finished_goods">Finished Goods Depot</option>
                  <option value="cold_storage">Cold Storage / Temperature Controlled</option>
                  <option value="transit">In-Transit / Buffer</option>
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

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Address</label>
              <textarea
                rows={2}
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_default"
                  checked={draft.is_default}
                  onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                  className="size-4 rounded border-default text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit_is_default" className="text-xs font-medium text-default">
                  Default Warehouse
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_allows_negative"
                  checked={draft.allows_negative_stock}
                  onChange={(e) =>
                    setDraft({ ...draft, allows_negative_stock: e.target.checked })
                  }
                  className="size-4 rounded border-default text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit_allows_negative" className="text-xs font-medium text-default">
                  Allow Negative Stock
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingWarehouse(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Warehouse'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Location / Bin Modal */}
      {selectedWarehouseForLocation && (
        <Modal
          open={Boolean(selectedWarehouseForLocation)}
          onClose={() => setSelectedWarehouseForLocation(null)}
          title={`Add Storage Bin: ${selectedWarehouseForLocation.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createLocationMutation.mutate(locationDraft);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Bin Code *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. BIN-A1, RACK-04"
                  value={locationDraft.code}
                  onChange={(e) =>
                    setLocationDraft({ ...locationDraft, code: e.target.value.toUpperCase() })
                  }
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Location Type *</label>
                <select
                  value={locationDraft.type}
                  onChange={(e) => setLocationDraft({ ...locationDraft, type: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="bin">Storage Bin</option>
                  <option value="shelf">Shelf / Tier</option>
                  <option value="aisle">Aisle / Zone</option>
                  <option value="pallet">Pallet Bay</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Bin Label Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Row 1 Shelf B Upper Bin"
                value={locationDraft.name}
                onChange={(e) => setLocationDraft({ ...locationDraft, name: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSelectedWarehouseForLocation(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={createLocationMutation.isPending}>
                {createLocationMutation.isPending ? 'Saving...' : 'Add Storage Bin'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingWarehouse && (
        <Modal
          open={Boolean(viewingWarehouse)}
          onClose={() => setViewingWarehouse(null)}
          title={`Warehouse Details: ${viewingWarehouse.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingWarehouse.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Type</span>
                <span className="font-medium text-default capitalize">{viewingWarehouse.type}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Address</span>
                <span className="font-medium text-default">{viewingWarehouse.address || 'No physical address specified'}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Operating Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {viewingWarehouse.is_active ? 'Active Facility' : 'Deactivated'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Default Branch Depot</span>
                <span className="font-medium text-default">{viewingWarehouse.is_default ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingWarehouse(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Warehouse Modal */}
      {deletingWarehouse && (
        <Modal
          open={Boolean(deletingWarehouse)}
          onClose={() => setDeletingWarehouse(null)}
          title="Delete Warehouse Facility"
        >
          <div className="space-y-4 text-xs">
            <p className="text-default">
              Are you sure you want to delete warehouse{' '}
              <strong className="text-primary font-mono">{deletingWarehouse.name}</strong> (
              {deletingWarehouse.code})?
            </p>
            <p className="text-muted text-[11px]">
              This operation will be rejected if existing stock ledgers or inventory lots are stored in this facility.
            </p>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" onClick={() => setDeletingWarehouse(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingWarehouse.id)}
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
        schema={warehouseImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
        }}
      />
    </div>
  );
}
