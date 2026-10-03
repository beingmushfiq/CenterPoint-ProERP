import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Plus, Search, Eye, Edit2, Trash2, Upload, Download, History } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { partyImportSchema } from '../schemas/partyImportSchema';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import type { Party } from '../../../types/api/party';
import { useCurrency } from '../../../hooks/useCurrency';
import { cn } from '../../../lib/utils';
import { TableControls, type ColumnDef } from '../../../components/ui/TableControls';
import { useTablePrefs } from '../../../hooks/useTablePrefs';
import { DestructiveConfirmationDialog } from '../../../components/ui/DestructiveConfirmationDialog';
import { useAuthStore } from '../../../lib/auth/authStore';
import { AuditTimelineDrawer } from '../../../components/ui/AuditTimelineDrawer';

const PARTY_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Party Name & Code', required: true },
  { key: 'roles', label: 'Roles' },
  { key: 'contact', label: 'Contact' },
  { key: 'balance', label: 'Current Balance' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', required: true },
];

interface PartyFormDraft {
  code: string;
  name: string;
  legal_name?: string;
  is_customer: boolean;
  is_supplier: boolean;
  is_dealer: boolean;
  is_agent: boolean;
  type: string;
  phone?: string;
  email?: string;
  credit_limit: string;
  credit_days: number;
  line1?: string;
  city?: string;
  is_active?: boolean;
}

export function PartiesSection() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'customer' | 'supplier' | 'dealer' | 'agent'
  >('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [viewingParty, setViewingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [auditingParty, setAuditingParty] = useState<Party | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(['catalog.party.create', 'catalog.party.manage', 'catalog.*']);
  const canEdit = hasPermission(['catalog.party.update', 'catalog.party.manage', 'catalog.*']);
  const canDelete = hasPermission(['catalog.party.delete', 'catalog.party.manage', 'catalog.*']);

  const { density, setDensity, visibleColumns, toggleColumn, isVisible, cellClass } = useTablePrefs({
    tableId: 'catalogue_parties',
    defaultColumns: {
      roles: true,
      contact: true,
      balance: true,
      status: true,
    },
  });

  const [draft, setDraft] = useState<PartyFormDraft>({
    code: '',
    name: '',
    legal_name: '',
    is_customer: true,
    is_supplier: false,
    is_dealer: false,
    is_agent: false,
    type: 'business',
    phone: '',
    email: '',
    credit_limit: '0.0000',
    credit_days: 0,
    line1: '',
    city: 'Dhaka',
    is_active: true,
  });

  const queryClient = useQueryClient();

  const partiesQuery = useQuery({
    queryKey: ['catalogue', 'parties', search, roleFilter],
    queryFn: ({ signal }) => {
      const params: Record<string, string> = {};
      if (search.trim().length >= 2) params['q'] = search.trim();
      if (roleFilter === 'customer') params['is_customer'] = 'true';
      if (roleFilter === 'supplier') params['is_supplier'] = 'true';
      if (roleFilter === 'dealer') params['is_dealer'] = 'true';
      if (roleFilter === 'agent') params['is_agent'] = 'true';

      return api.get<Party[]>('/parties', { signal, params });
    },
  });

  const createMutation = useMutation({
    mutationFn: (form: PartyFormDraft) => {
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        legal_name: form.legal_name || null,
        is_customer: form.is_customer,
        is_supplier: form.is_supplier,
        is_dealer: form.is_dealer,
        is_agent: form.is_agent,
        type: form.type,
        phone: form.phone || null,
        email: form.email || null,
        credit_limit: form.credit_limit,
        credit_days: form.credit_days,
      };

      if (form.line1 && form.city) {
        payload['addresses'] = [
          {
            type: 'billing',
            line1: form.line1,
            city: form.city,
            is_default: true,
          },
        ];
      }

      return api.post<Party>('/parties', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      setIsCreateOpen(false);
      setDraft({
        code: '',
        name: '',
        legal_name: '',
        is_customer: true,
        is_supplier: false,
        is_dealer: false,
        is_agent: false,
        type: 'business',
        phone: '',
        email: '',
        credit_limit: '0.0000',
        credit_days: 0,
        line1: '',
        city: 'Dhaka',
        is_active: true,
      });
      setErrorMsg(null);
      notify.success('Party contact created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('Party code already in use.');
        else setErrorMsg(err.message ?? 'Failed to create party.');
      } else {
        setErrorMsg('Error creating party.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PartyFormDraft> }) =>
      api.patch<Party>(`/parties/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      setEditingParty(null);
      setErrorMsg(null);
      notify.success('Party updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update party.');
      } else {
        setErrorMsg('Error updating party.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/parties/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      setDeletingParty(null);
      notify.success('Party deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete party.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (p: Party) => {
    setErrorMsg(null);
    setDraft({
      code: p.code,
      name: p.name,
      legal_name: p.legal_name || '',
      is_customer: p.is_customer,
      is_supplier: p.is_supplier,
      is_dealer: p.is_dealer,
      is_agent: p.is_agent,
      type: p.type,
      phone: p.phone || '',
      email: p.email || '',
      credit_limit: p.credit_limit,
      credit_days: p.credit_days,
      line1: '',
      city: 'Dhaka',
      is_active: p.status === 'active',
    });
    setEditingParty(p);
  };

  const parties = partiesQuery.data?.data ?? [];

  const handleExportPartiesCsv = () => {
    if (parties.length === 0) {
      notify.warning('No parties to export.');
      return;
    }
    const headers = ['Code', 'Name', 'Type', 'Roles', 'Phone', 'Email', 'Credit Limit', 'Balance', 'Status'];
    const rows = parties.map((p) => [
      `"${p.code}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.type}"`,
      `"${[p.is_customer ? 'Customer' : '', p.is_supplier ? 'Supplier' : '', p.is_dealer ? 'Dealer' : '', p.is_agent ? 'Agent' : ''].filter(Boolean).join('; ')}"`,
      `"${p.phone || ''}"`,
      `"${p.email || ''}"`,
      `"${p.credit_limit || '0.00'}"`,
      `"${p.current_balance || '0.00'}"`,
      `"${p.status}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `parties_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${parties.length} parties to CSV.`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full">
      {/* Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by code, name, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
            />
          </div>

          <div className="flex overflow-x-auto no-scrollbar rounded-xl border border-default bg-surface p-1 shadow-2xs w-full sm:w-auto">
            {(['all', 'customer', 'supplier', 'dealer', 'agent'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                  roleFilter === r
                    ? 'bg-primary text-primary-fg shadow-2xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                {r === 'all' ? 'All Parties' : `${r}s`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <TableControls
            density={density}
            onDensityChange={setDensity}
            columns={PARTY_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
          />

          <Button
            variant="secondary"
            onClick={handleExportPartiesCsv}
            className="flex items-center gap-1.5 shadow-xs"
            title="Export parties to CSV"
          >
            <Download className="h-4 w-4 text-muted" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 shadow-xs"
            title="Bulk import parties from Excel (.xlsx) or CSV"
          >
            <Upload className="h-4 w-4 text-primary" />
            <span>Import Parties</span>
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              onClick={() => {
                setErrorMsg(null);
                setDraft({
                  code: '',
                  name: '',
                  legal_name: '',
                  is_customer: true,
                  is_supplier: false,
                  is_dealer: false,
                  is_agent: false,
                  type: 'business',
                  phone: '',
                  email: '',
                  credit_limit: '0.0000',
                  credit_days: 0,
                  line1: '',
                  city: 'Dhaka',
                  is_active: true,
                });
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Party</span>
            </Button>
          )}
        </div>
      </div>

      {/* Parties Table */}
      <QueryBoundary
        status={partiesQuery.status}
        error={partiesQuery.error}
        data={partiesQuery.data}
        isFetching={partiesQuery.isFetching}
      >
        <div className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin rounded-2xl border border-default bg-surface shadow-2xs max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-180 text-left text-xs text-default border-collapse">
            <thead className="sticky top-0 z-10 border-b border-default bg-surface-sunken/95 backdrop-blur-xs text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                {isVisible('name') && <th className={cn("py-3.5 pl-4 pr-3", cellClass)}>Party Name & Code</th>}
                {isVisible('roles') && <th className={cn("py-3.5 px-3", cellClass)}>Roles</th>}
                {isVisible('contact') && <th className={cn("py-3.5 px-3", cellClass)}>Contact</th>}
                {isVisible('balance') && <th className={cn("py-3.5 px-3", cellClass)}>Current Balance</th>}
                {isVisible('status') && <th className={cn("py-3.5 px-3", cellClass)}>Status</th>}
                {isVisible('actions') && <th className={cn("py-3.5 pr-4 pl-3 text-right", cellClass)}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    No parties found matching the criteria.
                  </td>
                </tr>
              ) : (
                parties.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-sunken/50 transition-colors">
                    {isVisible('name') && (
                      <td className={cn("py-3.5 pl-4 pr-3", cellClass)}>
                        <div className="font-semibold text-default">{p.name}</div>
                        <div className="text-[11px] text-primary font-mono mt-0.5">{p.code}</div>
                      </td>
                    )}
                    {isVisible('roles') && (
                      <td className={cn("py-3.5 px-3", cellClass)}>
                        <div className="flex flex-wrap gap-1">
                          {p.is_customer && (
                            <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                              Customer
                            </span>
                          )}
                          {p.is_supplier && (
                            <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                              Supplier
                            </span>
                          )}
                          {p.is_dealer && (
                            <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                              Dealer
                            </span>
                          )}
                          {p.is_agent && (
                            <span className="rounded bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-teal-600 dark:text-teal-400">
                              Agent
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {isVisible('contact') && (
                      <td className={cn("py-3.5 px-3 space-y-0.5", cellClass)}>
                        {p.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-muted">
                            <Phone className="size-3 text-muted" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1 text-[11px] text-muted">
                            <Mail className="size-3 text-muted" />
                            <span>{p.email}</span>
                          </div>
                        )}
                      </td>
                    )}
                    {isVisible('balance') && (
                      <td className={cn("py-3.5 px-3 font-mono", cellClass)}>
                        <span
                          className={
                            Number(p.current_balance) > 0
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-default'
                          }
                        >
                          {formatCurrency(p.current_balance)}
                        </span>
                      </td>
                    )}
                    {isVisible('status') && (
                      <td className={cn("py-3.5 px-3", cellClass)}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            p.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    )}
                    {isVisible('actions') && (
                      <td className={cn("py-3.5 pr-4 pl-3 text-right", cellClass)}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingParty(p)}
                            className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                            title="View Party Details"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditingParty(p)}
                            className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                            title="View Audit History"
                          >
                            <History className="size-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                              title="Edit Party"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeletingParty(p)}
                              className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                              title="Delete Party"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {parties.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 border-t-2 border-default bg-surface-sunken/95 backdrop-blur-xs font-semibold text-xs text-default">
                <tr>
                  <td
                    colSpan={
                      (isVisible('name') ? 1 : 0) +
                      (isVisible('roles') ? 1 : 0) +
                      (isVisible('contact') ? 1 : 0)
                    }
                    className={cn("py-3 pl-4 pr-3 font-medium text-muted", cellClass)}
                  >
                    Total ({parties.length} Parties)
                  </td>
                  {isVisible('balance') && (
                    <td className={cn("py-3 px-3 font-mono font-bold text-default", cellClass)}>
                      {formatCurrency(
                        parties.reduce((sum, p) => sum + parseFloat(p.current_balance || '0'), 0)
                      )}
                    </td>
                  )}
                  {isVisible('status') && (
                    <td className={cn("py-3 px-3 text-muted text-2xs", cellClass)}>
                      {parties.filter((p) => p.status === 'active').length} Active
                    </td>
                  )}
                  {isVisible('actions') && (
                    <td className={cn("py-3 pr-4 pl-3 text-right text-2xs text-muted font-normal", cellClass)}>
                      Summary
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </QueryBoundary>

      {/* Create Party Modal */}
      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Party">
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
                placeholder="e.g. CUST-001, SUP-004"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Entity Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="business">Corporate / Business</option>
                <option value="individual">Individual / Retail</option>
                <option value="government">Government Body</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Display Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Acme Supermarket Ltd."
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Party Roles *</label>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-default">
                <input
                  type="checkbox"
                  checked={draft.is_customer}
                  onChange={(e) => setDraft({ ...draft, is_customer: e.target.checked })}
                  className="size-4 rounded border-default text-primary"
                />
                <span>Customer</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-default">
                <input
                  type="checkbox"
                  checked={draft.is_supplier}
                  onChange={(e) => setDraft({ ...draft, is_supplier: e.target.checked })}
                  className="size-4 rounded border-default text-primary"
                />
                <span>Supplier</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-default">
                <input
                  type="checkbox"
                  checked={draft.is_dealer}
                  onChange={(e) => setDraft({ ...draft, is_dealer: e.target.checked })}
                  className="size-4 rounded border-default text-primary"
                />
                <span>Dealer / Distributor</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-default">
                <input
                  type="checkbox"
                  checked={draft.is_agent}
                  onChange={(e) => setDraft({ ...draft, is_agent: e.target.checked })}
                  className="size-4 rounded border-default text-primary"
                />
                <span>Sales Agent</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Phone</label>
              <input
                type="text"
                placeholder="+880 1700-000000"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Email</label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Party'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Party Modal */}
      {editingParty && (
        <Modal
          open={Boolean(editingParty)}
          onClose={() => setEditingParty(null)}
          title={`Edit Party: ${editingParty.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingParty.id,
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
                <label className="block text-xs font-semibold text-default mb-1">Entity Type</label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="business">Corporate / Business</option>
                  <option value="individual">Individual / Retail</option>
                  <option value="government">Government Body</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Display Name *</label>
              <input
                required
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Phone</label>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Email</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="party_edit_is_active"
                checked={draft.is_active ?? true}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="size-4 rounded border-default text-primary focus:ring-primary/20"
              />
              <label htmlFor="party_edit_is_active" className="text-xs font-medium text-default">
                Active Party Status
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingParty(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Party'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Party Modal */}
      {viewingParty && (
        <Modal
          open={Boolean(viewingParty)}
          onClose={() => setViewingParty(null)}
          title={`Party Record: ${viewingParty.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingParty.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Type</span>
                <span className="font-medium text-default capitalize">{viewingParty.type}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Phone</span>
                <span className="font-mono text-default">{viewingParty.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Email</span>
                <span className="text-default">{viewingParty.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Current Ledger Balance</span>
                <span className="font-mono font-bold text-default">{formatCurrency(viewingParty.current_balance)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingParty(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Party Modal (Sprint C3 Destructive UX Overhaul) */}
      {deletingParty && (
        <DestructiveConfirmationDialog
          open={Boolean(deletingParty)}
          onClose={() => setDeletingParty(null)}
          onConfirmDelete={() => deleteMutation.mutate(deletingParty.id)}
          title="Delete Party"
          entityType="Party"
          entityName={deletingParty.name}
          entityCode={deletingParty.code}
          impactItems={[
            {
              label: 'Party Roles',
              count: [
                deletingParty.is_customer ? 'Customer' : '',
                deletingParty.is_supplier ? 'Supplier' : '',
                deletingParty.is_dealer ? 'Dealer' : '',
                deletingParty.is_agent ? 'Agent' : '',
              ].filter(Boolean).join(', ') || 'None',
            },
            {
              label: 'Current Ledger Balance',
              count: formatCurrency(deletingParty.current_balance),
              warning: parseFloat(deletingParty.current_balance || '0') > 0,
            },
            {
              label: 'Credit Limit',
              count: formatCurrency(deletingParty.credit_limit),
            },
            {
              label: 'Credit Days',
              count: `${deletingParty.credit_days || 0} days`,
            },
          ]}
          warningMessage={
            parseFloat(deletingParty.current_balance || '0') > 0
              ? 'This party has an active balance. The database will reject permanent deletion if historical invoices or transactions exist.'
              : 'Party deletion will be rejected if open orders, shipments, or transaction ledgers are linked to this record.'
          }
          isDeleting={deleteMutation.isPending}
        />
      )}
      {/* Audit Timeline Drawer */}
      <AuditTimelineDrawer
        isOpen={Boolean(auditingParty)}
        onClose={() => setAuditingParty(null)}
        entityType="Party"
        entityId={auditingParty?.id}
        entityTitle={auditingParty ? `${auditingParty.name} (${auditingParty.code})` : undefined}
      />

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={partyImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
        }}
      />
    </div>
  );
}
