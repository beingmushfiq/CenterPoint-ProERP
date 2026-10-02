import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Phone,
  Mail,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  User,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import type { Party } from '../../../types/api/party';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { DestructiveConfirmationDialog } from '../../../components/ui/DestructiveConfirmationDialog';
import { useCurrency } from '../../../hooks/useCurrency';
import { cn } from '../../../lib/utils';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../../components/ui/ResponsiveDataTable';

export const SuppliersSection: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Party | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Party | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkPermanent, setIsBulkPermanent] = useState(false);

  // Action Menu Portal Anchor State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  const { data: suppliers = [], isLoading, isFetching, refetch } = useQuery<Party[]>({
    queryKey: ['catalogue', 'parties', 'suppliers-list'],
    queryFn: async () => {
      try {
        const res = await api.get<Party[]>('/parties?is_supplier=true&per_page=100');
        return extractList<Party>(res);
      } catch {
        return [];
      }
    },
  });

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.legal_name && s.legal_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        s.contacts?.some((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));

      const matchesStatus =
        statusFilter === 'all' || s.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.status === 'active').length;
    const inactive = suppliers.filter((s) => s.status === 'inactive').length;
    const blacklisted = suppliers.filter((s) => s.status === 'blacklisted').length;
    const totalCredit = suppliers.reduce((acc, s) => acc + (parseFloat(s.credit_limit || '0') || 0), 0);
    return { total, active, inactive, blacklisted, totalCredit };
  }, [suppliers]);

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      const url = force ? `/parties/${id}?force=true` : `/parties/${id}`;
      return api.delete(url);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
      toast.success(
        variables.force
          ? 'Supplier record permanently deleted.'
          : 'Supplier moved to Data Bin successfully.'
      );
      setDeletingSupplier(null);
      setIsPermanentDelete(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to delete supplier.';
      toast.error(message);
    },
  });

  const handleDelete = () => {
    if (!deletingSupplier) return;
    deleteMutation.mutate({ id: deletingSupplier.id, force: isPermanentDelete });
  };

  // Bulk Delete
  const handleBulkDelete = async (force: boolean) => {
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      let successCount = 0;
      for (const id of ids) {
        try {
          const url = force ? `/parties/${id}?force=true` : `/parties/${id}`;
          await api.delete(url);
          successCount++;
        } catch {
          // continue
        }
      }
      queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
      toast.success(
        force
          ? `${successCount} supplier(s) permanently purged.`
          : `${successCount} supplier(s) moved to Data Bin.`
      );
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    } catch {
      toast.error('Failed to complete bulk delete.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSuppliers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSuppliers.map((s) => s.id)));
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

  // CSV Export
  const exportCsv = (dataToExport = filteredSuppliers) => {
    const headers = [
      'Vendor Code',
      'Supplier Name',
      'Legal Name',
      'Type',
      'Phone',
      'Email',
      'City',
      'Payment Days',
      'Credit Limit',
      'Status',
    ];
    const rows = dataToExport.map((s) => {
      const address = s.addresses?.[0];
      return [
        s.code || '',
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.legal_name || '').replace(/"/g, '""')}"`,
        s.type || '',
        s.phone || '',
        s.email || '',
        address?.city || '',
        s.credit_days || 30,
        s.credit_limit || 0,
        s.status || '',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suppliers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${dataToExport.length} suppliers to CSV.`);
  };

  const supplierColumns: ResponsiveColumn<Party>[] = useMemo(() => [
    {
      id: 'code',
      header: 'Vendor Code',
      priority: 'low',
      accessor: (s) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-default">{s.code}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-sunken text-muted border border-default/60 uppercase">
            {s.type}
          </span>
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Supplier / Entity Name',
      isPrimary: true,
      accessor: (s) => (
        <div>
          <div className="font-semibold text-default text-[13px]">{s.name}</div>
          {s.legal_name && (
            <div className="text-[11px] text-muted">{s.legal_name}</div>
          )}
          {s.tax_identifier && (
            <div className="text-[10px] font-mono text-muted/80">TIN: {s.tax_identifier}</div>
          )}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Key Contact & Comm',
      priority: 'medium',
      accessor: (s) => {
        const primaryContact = s.contacts?.[0];
        return (
          <div className="space-y-0.5">
            {primaryContact?.name && (
              <div className="flex items-center gap-1 text-default font-medium">
                <User className="size-3 text-muted" />
                <span>{primaryContact.name}</span>
              </div>
            )}
            {s.phone && (
              <div className="flex items-center gap-1 text-muted text-[11px]">
                <Phone className="size-3 text-muted" />
                <a href={`tel:${s.phone}`} className="hover:text-primary transition-colors">
                  {s.phone}
                </a>
              </div>
            )}
            {s.email && (
              <div className="flex items-center gap-1 text-muted text-[11px]">
                <Mail className="size-3 text-muted" />
                <a href={`mailto:${s.email}`} className="hover:text-primary transition-colors truncate max-w-[160px]">
                  {s.email}
                </a>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'location',
      header: 'Location',
      priority: 'low',
      accessor: (s) => {
        const primaryAddress = s.addresses?.[0];
        return (
          <div className="flex items-center gap-1 text-default">
            <MapPin className="size-3 text-muted shrink-0" />
            <span>{primaryAddress?.city || '—'}</span>
            {primaryAddress?.district && (
              <span className="text-muted text-[11px]">({primaryAddress.district})</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'credit',
      header: 'Payment Terms',
      priority: 'medium',
      accessor: (s) => (
        <div>
          <div className="flex items-center gap-1 text-default font-medium">
            <Clock className="size-3 text-muted" />
            <span>Net {s.credit_days ?? 30} Days</span>
          </div>
          {parseFloat(s.credit_limit || '0') > 0 && (
            <div className="text-[11px] font-mono text-muted">
              Limit: {formatCurrency(s.credit_limit)}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      priority: 'medium',
      accessor: (s) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
            s.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : s.status === 'blacklisted'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              s.status === 'active'
                ? 'bg-emerald-500'
                : s.status === 'blacklisted'
                ? 'bg-rose-500'
                : 'bg-amber-500'
            )}
          />
          {s.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      priority: 'low',
      accessor: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setEditingSupplier(s);
              setShowCreateModal(true);
            }}
            className="flex size-7 items-center justify-center rounded-lg border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer touch-target"
            title="Edit Supplier"
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (activeMenuId === s.id) {
                setActiveMenuId(null);
                setActionMenuAnchor(null);
              } else {
                setActiveMenuId(s.id);
                setActionMenuAnchor(e.currentTarget);
              }
            }}
            className="flex size-7 items-center justify-center rounded-lg border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer touch-target"
            title="More Actions"
          >
            <MoreVertical className="size-3.5" />
          </button>
        </div>
      ),
    },
  ], [formatCurrency, activeMenuId]);

  const getMobileActions = (s: Party) => [
    {
      label: 'Edit Profile...',
      icon: <Edit2 className="size-4" />,
      onClick: () => {
        setEditingSupplier(s);
        setShowCreateModal(true);
      },
    },
    {
      label: 'Move to Data Bin',
      icon: <Trash2 className="size-4 text-amber-500" />,
      variant: 'warning' as const,
      onClick: () => {
        setDeletingSupplier(s);
        setIsPermanentDelete(false);
      },
    },
    {
      label: 'Delete Permanently',
      icon: <Trash2 className="size-4 text-rose-500" />,
      variant: 'destructive' as const,
      onClick: () => {
        setDeletingSupplier(s);
        setIsPermanentDelete(true);
      },
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* SECTION HEADER & KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Suppliers</span>
            <Building2 className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-default">{stats.total}</div>
          <div className="text-[10px] text-muted mt-0.5">Approved vendor network</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Partners</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</div>
          <div className="text-[10px] text-muted mt-0.5">Eligible for PO issuance</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inactive / Review</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.inactive + stats.blacklisted}</div>
          <div className="text-[10px] text-muted mt-0.5">Restricted or archived</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Approved Credit</span>
            <CreditCard className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-default font-mono">{formatCurrency(stats.totalCredit)}</div>
          <div className="text-[10px] text-muted mt-0.5">Cumulative credit limit</div>
        </div>
      </div>

      {/* FILTER & CONTROL TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-2xl border border-default shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search supplier, code, phone, or key contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-default bg-surface-sunken text-xs text-default focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default transition-colors cursor-pointer"
            title="Export supplier list to CSV"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center justify-center size-9 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSupplier(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-fg text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* SUPPLIER MASTER RESPONSIVE DATA TABLE */}
      <ResponsiveDataTable<Party>
        data={filteredSuppliers}
        columns={supplierColumns}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        loadingRows={6}
        selectedIds={selectedIds}
        onSelectRow={(id) => toggleSelect(String(id))}
        onSelectAll={toggleSelectAll}
        mobileActions={getMobileActions}
        isFiltered={Boolean(search || statusFilter !== 'all')}
        searchEmptyState={
          <div className="py-12 text-center text-muted">
            <Building2 className="size-8 mx-auto mb-2 opacity-40 text-muted" />
            <p className="font-semibold text-default text-sm">No suppliers match your filters</p>
            <p className="text-xs text-muted mt-1">Try adjusting your search query or reset status filter.</p>
          </div>
        }
        emptyState={
          <div className="py-12 text-center text-muted">
            <Building2 className="size-8 mx-auto mb-2 opacity-40 text-muted" />
            <p className="font-semibold text-default text-sm">No suppliers found</p>
            <p className="text-xs text-muted mt-1">Get started by creating your first supplier profile.</p>
            <button
              type="button"
              onClick={() => {
                setEditingSupplier(null);
                setShowCreateModal(true);
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-fg text-xs font-semibold cursor-pointer"
            >
              <Plus className="size-3.5" />
              Create Supplier
            </button>
          </div>
        }
      />

      {/* ACTION MENU PORTAL FOR ROW ACTIONS */}
      {activeMenuId && actionMenuAnchor && (() => {
        const supplier = suppliers.find((s) => s.id === activeMenuId);
        if (!supplier) return null;
        return (
          <ActionMenuPortal
            anchorEl={actionMenuAnchor}
            open={Boolean(activeMenuId)}
            onClose={() => {
              setActiveMenuId(null);
              setActionMenuAnchor(null);
            }}
          >
            <div className="w-48 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveMenuId(null);
                  setActionMenuAnchor(null);
                  setEditingSupplier(supplier);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <Edit2 className="size-3.5 text-muted" />
                <span>Edit Profile...</span>
              </button>

              <div className="my-1 border-t border-default/60" />

              <button
                type="button"
                onClick={() => {
                  setActiveMenuId(null);
                  setActionMenuAnchor(null);
                  setDeletingSupplier(supplier);
                  setIsPermanentDelete(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5 text-amber-500" />
                <span>Move to Data Bin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMenuId(null);
                  setActionMenuAnchor(null);
                  setDeletingSupplier(supplier);
                  setIsPermanentDelete(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5 text-rose-500" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </ActionMenuPortal>
        );
      })()}

      {/* FLOATING MULTI-RECORD BOTTOM TOOLBAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-6 duration-200">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-default/80 bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center gap-2 border-r border-default pr-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold text-default">
                Supplier{selectedIds.size > 1 ? 's' : ''} Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportCsv(filteredSuppliers.filter((s) => selectedIds.has(s.id)))}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3 text-xs font-semibold text-default hover:bg-surface transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="size-3 text-primary" />
                Export Selected
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBulkPermanent(false);
                  setShowBulkDeleteConfirm(true);
                }}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3" />
                Move to Bin ({selectedIds.size})
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBulkPermanent(true);
                  setShowBulkDeleteConfirm(true);
                }}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3 text-rose-500" />
                Delete Permanently ({selectedIds.size})
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="flex size-8 items-center justify-center rounded-xl border border-default bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer ml-1"
                title="Deselect all (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      <SupplierFormModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* SINGLE DELETE CONFIRMATION DIALOG */}
      {deletingSupplier && (
        <DestructiveConfirmationDialog
          open={Boolean(deletingSupplier)}
          onClose={() => {
            setDeletingSupplier(null);
            setIsPermanentDelete(false);
          }}
          onConfirmDelete={handleDelete}
          title={isPermanentDelete ? 'Permanently Purge Supplier' : 'Move Supplier to Data Bin'}
          entityType="Supplier & Vendor"
          entityName={deletingSupplier.name}
          entityCode={deletingSupplier.code}
          impactItems={[
            {
              label: 'Vendor Code',
              count: deletingSupplier.code,
            },
            {
              label: 'Payment Terms',
              count: `Net ${deletingSupplier.credit_days ?? 30} Days`,
            },
            {
              label: 'Approved Credit Limit',
              count: formatCurrency(deletingSupplier.credit_limit || '0'),
            },
          ]}
          warningMessage={
            isPermanentDelete
              ? 'WARNING: This action is permanent and completely erases this supplier profile from the database. It cannot be recovered from the Data Bin.'
              : 'Moving this supplier to the Data Bin will soft-delete the record. It can be audited or restored at any time from Intelligence & System > Data Bin & Recovery Vault.'
          }
        />
      )}

      {/* BULK DELETE CONFIRMATION DIALOG */}
      {showBulkDeleteConfirm && (
        <DestructiveConfirmationDialog
          open={showBulkDeleteConfirm}
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirmDelete={() => handleBulkDelete(isBulkPermanent)}
          isDeleting={isBulkDeleting}
          title={isBulkPermanent ? `Permanently Purge ${selectedIds.size} Suppliers` : `Move ${selectedIds.size} Suppliers to Data Bin`}
          entityType="Bulk Suppliers"
          entityName={`${selectedIds.size} selected vendor records`}
          impactItems={[
            {
              label: 'Records Targeted',
              count: `${selectedIds.size} suppliers`,
              warning: true,
            },
            {
              label: 'Deletion Mode',
              count: isBulkPermanent ? 'Permanent Hard Delete' : 'Soft Delete (Data Bin Recoverable)',
            },
          ]}
          warningMessage={
            isBulkPermanent
              ? `You are about to PERMANENTLY ERASE ${selectedIds.size} supplier records. This bypasses the Data Bin and cannot be recovered.`
              : `You are about to soft-delete ${selectedIds.size} suppliers. They will be archived to the Data Bin & Recovery Vault where they can be restored.`
          }
        />
      )}
    </div>
  );
};
