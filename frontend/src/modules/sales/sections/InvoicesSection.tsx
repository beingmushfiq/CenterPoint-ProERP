import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Clock, Printer, RefreshCw, Search, Sliders, FileText, DollarSign, BookOpen, ArrowLeftRight, Upload, Download, Trash2, X, MoreHorizontal, History } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { InvoiceTemplateBuilder } from '../components/InvoiceTemplateBuilder';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { historicalInvoiceImportSchema } from '../schemas/historicalInvoiceImportSchema';
import { TableControls, type ColumnDef } from '../../../components/ui/TableControls';
import { useTablePrefs } from '../../../hooks/useTablePrefs';
import { DestructiveConfirmationDialog } from '../../../components/ui/DestructiveConfirmationDialog';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { AuditTimelineDrawer } from '../../../components/ui/AuditTimelineDrawer';
import { ResponsiveDataTable } from '../../../components/ui/ResponsiveDataTable';
import { cn } from '../../../lib/utils';

interface InvoicesSectionProps {
  onNavigateToTab?: (tab: string) => void;
}

export function InvoicesSection({ onNavigateToTab }: InvoicesSectionProps = {}) {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.invoice.delete');
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showVoidModal, setShowVoidModal] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showDesigner, setShowDesigner] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [auditingInvoice, setAuditingInvoice] = useState<Invoice | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; isBulk?: boolean; title: string; invoice?: Invoice } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Table Preferences & Column Visibility (Sprint C1)
  const INVOICE_TABLE_COLUMNS: ColumnDef[] = [
    { key: 'invoice_number', label: 'Invoice Number', required: true },
    { key: 'date', label: 'Date' },
    { key: 'customer', label: 'Customer' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'margin', label: 'Gross Margin' },
    { key: 'total', label: 'Total Amount' },
    { key: 'status', label: 'Status' },
  ];

  const {
    density,
    setDensity,
    visibleColumns,
    toggleColumn,
    isVisible,
  } = useTablePrefs({
    tableId: 'sales_invoices',
    defaultColumns: {
      date: true,
      customer: true,
      subtotal: true,
      margin: true,
      total: true,
      status: true,
    },
    defaultDensity: 'comfortable',
  });

  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  const handleExportCsv = () => {
    if (invoices.length === 0) {
      toast.info('No invoices to export.');
      return;
    }
    const headers = [
      'Invoice Number',
      'Customer Code',
      'Invoice Date',
      'Due Date',
      'Total Amount',
      'Paid Amount',
      'Status',
      'Notes',
    ];
    const rows = invoices.map((inv) => [
      `"${(inv.invoice_number || '').replace(/"/g, '""')}"`,
      `"${(inv.customer_name || '').replace(/"/g, '""')}"`,
      inv.invoice_date || '',
      inv.due_date || '',
      inv.total_amount || '0.00',
      inv.paid_amount || '0.00',
      inv.status || 'posted',
      `"${(inv.void_reason || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historical_invoices_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${invoices.length} invoices to CSV.`);
  };

  const { data: invoices = [], isLoading, isFetching, refetch } = useQuery<Invoice[]>({
    queryKey: ['sales', 'invoices'],
    queryFn: async () => {
      const res = await api.get<Invoice[]>('/sales/invoices');
      return res.data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      await api.post(`/sales/invoices/${invoiceId}/approve`, {});
    },
    onSuccess: () => {
      toast.success('Invoice approved and posted to ledger.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to post invoice');
    },
  });

  const voidMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: number; reason: string }) => {
      await api.post(`/sales/invoices/${invoiceId}/void`, { void_reason: reason });
    },
    onSuccess: () => {
      toast.success('Invoice voided successfully.');
      setShowVoidModal(null);
      setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to void invoice');
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: {
      sales_order_id?: number;
      party_id?: number;
      invoice_date: string;
      items: Array<{ product_id: number; quantity: string; unit_price: string; unit_id?: number }>;
      notes?: string;
    }) => {
      const res = await api.post<Invoice>('/sales/invoices', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Sales invoice created successfully.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice');
    },
  });

  const handlePreviewInvoice = async (inv: Invoice) => {
    setPreviewInvoice(inv);
    try {
      const res = await api.get<Invoice>(`/sales/invoices/${inv.id}`);
      if (res.data) setPreviewInvoice(res.data);
    } catch {
      // Keep cached invoice
    }
  };

  const handleVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVoidModal) return;
    voidMutation.mutate({ invoiceId: showVoidModal, reason: voidReason });
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.sales_order_number?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const isAllSelected = filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteInvoiceMutation = useMutation({
    mutationFn: async ({ id, ids }: { id?: number; ids?: number[] }) => {
      if (ids && ids.length > 0) {
        let count = 0;
        for (const invoiceId of ids) {
          await api.delete(`/sales/invoices/${invoiceId}`);
          count++;
        }
        return count;
      } else if (id) {
        await api.delete(`/sales/invoices/${id}`);
        return 1;
      }
      return 0;
    },
    onSuccess: (count) => {
      toast.success(`Moved ${count} invoice(s) to Data Bin`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice');
    },
  });

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Clock className="h-3 w-3 text-zinc-400" /> Draft
          </span>
        );
      case 'posted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3 text-blue-400" /> Posted
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Paid
          </span>
        );
      case 'void':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Ban className="h-3 w-3 text-rose-400" /> Voided
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-sunken text-muted border border-default">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by invoice #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 sm:h-9 w-full sm:w-64 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft', colorDot: 'bg-slate-400' },
              { value: 'posted', label: 'Posted', colorDot: 'bg-blue-500' },
              { value: 'paid', label: 'Paid', colorDot: 'bg-emerald-500' },
              { value: 'void', label: 'Void', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter invoices by status"
          />

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default transition-colors cursor-pointer"
            title="Import historical opening invoices from Excel (.xlsx) or CSV"
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default transition-colors cursor-pointer"
            title="Export invoices to CSV"
          >
            <Download className="h-3.5 w-3.5 text-muted" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              createInvoiceMutation.mutate({
                invoice_date: new Date().toISOString().slice(0, 10),
                items: [{ product_id: 1, quantity: '1', unit_price: '0.00' }],
                notes: 'Direct generated invoice draft',
              });
            }}
            disabled={createInvoiceMutation.isPending}
            className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
            title="Create Direct Sales Invoice"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{createInvoiceMutation.isPending ? 'Creating...' : 'New Invoice'}</span>
          </button>

          <button
            onClick={() => setShowDesigner(true)}
            className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3 text-xs font-medium text-default hover:bg-surface hover:text-primary transition-colors cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Template Designer</span>
          </button>

          <TableControls
            density={density}
            onDensityChange={setDensity}
            columns={INVOICE_TABLE_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
          />
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} invoice(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  isBulk: true,
                  title: `${selectedIds.size} selected invoice(s)`,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Move to Bin ({selectedIds.size})</span>
            </button>
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

      {/* Invoices Responsive Data Table with Card Reflow on Mobile */}
      <ResponsiveDataTable<Invoice>
        data={filteredInvoices}
        isLoading={isLoading}
        keyExtractor={(inv) => inv.id}
        emptyMessage="No sales invoices found."
        emptyIcon={FileText}
        selectedIds={selectedIds}
        onSelectRow={(id) => toggleSelect(Number(id))}
        onSelectAll={toggleSelectAll}
        mobileCardBreakpoint="sm"
        mobileActions={(inv) => [
          {
            id: 'print',
            label: 'Print Invoice',
            icon: Printer,
            onClick: () => handlePreviewInvoice(inv),
          },
          ...(inv.status === 'draft' ? [{
            id: 'post',
            label: 'Post Invoice',
            icon: CheckCircle2,
            onClick: () => approveMutation.mutate(inv.id),
          }] : []),
          ...(onNavigateToTab && inv.status === 'posted' ? [{
            id: 'collect',
            label: 'Collect Payment',
            icon: DollarSign,
            onClick: () => onNavigateToTab('payments'),
          }] : []),
          ...((inv.status === 'posted' || inv.status === 'paid') ? [{
            id: 'gl',
            label: 'View General Ledger',
            icon: BookOpen,
            onClick: () => {
              window.location.hash = '#/finance?tab=gl';
            },
          }] : []),
          ...(inv.status !== 'void' ? [{
            id: 'void',
            label: 'Void Invoice',
            icon: Ban,
            variant: 'warning' as const,
            onClick: () => setShowVoidModal(inv.id),
          }] : []),
          {
            id: 'audit',
            label: 'View Audit History',
            icon: History,
            onClick: () => setAuditingInvoice(inv),
          },
          ...(canDelete ? [{
            id: 'delete',
            label: 'Move to Bin',
            icon: Trash2,
            variant: 'danger' as const,
            onClick: () =>
              setDeleteConfirm({
                id: inv.id,
                title: `invoice ${inv.invoice_number}`,
                invoice: inv,
              }),
          }] : []),
        ]}
        columns={[
          {
            id: 'invoice_number',
            header: 'Invoice Number',
            isPrimary: true,
            cell: (inv) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{inv.invoice_number}</span>
                {inv.has_exchanges && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 border border-violet-500/20"
                    title={`Contains ${inv.exchanges_count ?? 1} linked exchange adjustments`}
                  >
                    <ArrowLeftRight className="size-2.5" /> Exchanged
                  </span>
                )}
              </div>
            ),
          },
          ...(isVisible('date') ? [{
            id: 'date',
            header: 'Date',
            priority: 'medium' as const,
            cell: (inv: Invoice) => <span className="text-muted">{inv.invoice_date}</span>,
          }] : []),
          ...(isVisible('customer') ? [{
            id: 'customer',
            header: 'Customer',
            cell: (inv: Invoice) => (
              <span className="font-medium text-default">{inv.customer_name ?? 'Counter Customer'}</span>
            ),
          }] : []),
          ...(isVisible('subtotal') ? [{
            id: 'subtotal',
            header: 'Subtotal',
            priority: 'low' as const,
            cell: (inv: Invoice) => (
              <span className="font-mono text-default">{formatCurrency(parseFloat(inv.subtotal || '0'))}</span>
            ),
          }] : []),
          ...(isVisible('margin') ? [{
            id: 'margin',
            header: 'Gross Margin',
            priority: 'low' as const,
            cell: (inv: Invoice) => {
              const subtotalNum = parseFloat(inv.subtotal || '0');
              const estCogs = subtotalNum * 0.62;
              const grossProfit = Math.max(0, subtotalNum - estCogs);
              const marginPct = subtotalNum > 0 ? (grossProfit / subtotalNum) * 100 : 0;
              return (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {formatCurrency(grossProfit)}
                  </span>
                  <span className="text-[10px] text-muted font-mono">({marginPct.toFixed(1)}%)</span>
                </div>
              );
            },
          }] : []),
          ...(isVisible('total') ? [{
            id: 'total',
            header: 'Total Amount',
            cell: (inv: Invoice) => (
              <span className="font-mono font-medium text-default">{formatCurrency(inv.total_amount)}</span>
            ),
          }] : []),
          ...(isVisible('status') ? [{
            id: 'status',
            header: 'Status',
            isStatus: true,
            cell: (inv: Invoice) => getStatusBadge(inv.status),
          }] : []),
          {
            id: 'actions',
            header: 'Actions',
            isAction: true,
            align: 'right' as const,
            cell: (inv: Invoice) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreviewInvoice(inv)}
                  className="inline-flex items-center gap-1 rounded-xl bg-surface-sunken border border-default px-2.5 py-1 text-[11px] font-medium text-default hover:bg-surface transition-colors cursor-pointer"
                >
                  <Printer className="h-3 w-3" /> <span className="hidden sm:inline">Print</span>
                </button>
                {inv.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(inv.id)}
                    disabled={approveMutation.isPending}
                    className="rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {approveMutation.isPending ? 'Posting...' : 'Post'}
                  </button>
                )}
                {onNavigateToTab && inv.status === 'posted' && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('payments')}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    title="Collect payment from customer"
                  >
                    <DollarSign className="size-3" />
                    <span className="hidden sm:inline">Collect</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openActionMenuId === inv.id) {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    } else {
                      setOpenActionMenuId(inv.id);
                      setActionMenuAnchor(e.currentTarget);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-xl transition-all cursor-pointer border shadow-2xs",
                    openActionMenuId === inv.id
                      ? "bg-primary text-primary-fg border-primary shadow-xs"
                      : "text-muted hover:text-default bg-surface-sunken hover:bg-surface border-default"
                  )}
                  title="More Invoice Actions"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Invoice Registry Summary Ribbon */}
      {filteredInvoices.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-default bg-surface-sunken/80 text-xs text-default shadow-2xs">
          <div className="flex items-center gap-2 font-bold">
            <span>Total:</span>
            <span className="font-mono text-primary font-bold">{filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}</span>
            <span className="text-muted text-[11px] font-normal">({filteredInvoices.filter((inv) => inv.status === 'paid').length} Paid)</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs flex-wrap">
            <div>
              <span className="text-muted mr-1 font-sans text-[11px]">Subtotal:</span>
              <span className="font-medium text-default">
                {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.subtotal || '0') || 0), 0))}
              </span>
            </div>
            <div>
              <span className="text-muted mr-1 font-sans text-[11px]">Gross Margin:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  filteredInvoices.reduce((sum, inv) => {
                    const s = parseFloat(inv.subtotal || '0') || 0;
                    return sum + Math.max(0, s - s * 0.62);
                  }, 0)
                )}
              </span>
            </div>
            <div className="border-l border-default pl-4">
              <span className="text-muted mr-1 font-sans text-[11px]">Total Billed:</span>
              <span className="font-bold text-primary text-sm">
                {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount || '0') || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {openActionMenuId && (() => {
        const inv = filteredInvoices.find((x) => x.id === openActionMenuId);
        if (!inv) return null;
        return (
          <ActionMenuPortal
            isOpen={Boolean(openActionMenuId && actionMenuAnchor)}
            anchorEl={actionMenuAnchor}
            onClose={() => {
              setOpenActionMenuId(null);
              setActionMenuAnchor(null);
            }}
            width="13rem"
          >
            <div className="p-1 space-y-0.5 text-xs">
              <div className="px-2.5 py-1.5 border-b border-default text-2xs text-muted font-mono truncate">
                Invoice #{inv.invoice_number}
              </div>
              {(inv.status === 'posted' || inv.status === 'paid') && (
                <Link
                  to="/finance?tab=gl"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <BookOpen className="size-3.5 text-primary" />
                  <span>General Ledger</span>
                </Link>
              )}
              {inv.status !== 'void' && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setShowVoidModal(inv.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  <Ban className="size-3.5" />
                  <span>Void Invoice</span>
                </button>
              )}
              <div className="my-1 border-t border-default" />
              <button
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                  setAuditingInvoice(inv);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <History className="size-3.5 text-primary" />
                <span>View Audit History...</span>
              </button>
              {canDelete && (
                <>
                  <div className="my-1 border-t border-default" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setDeleteConfirm({
                        id: inv.id,
                        title: `invoice ${inv.invoice_number}`,
                        invoice: inv,
                      });
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer font-medium"
                  >
                    <Trash2 className="size-3.5 text-rose-500" />
                    <span>Move to Bin</span>
                  </button>
                </>
              )}
            </div>
          </ActionMenuPortal>
        );
      })()}

      {/* Void Confirmation Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <h3 className="text-base font-semibold text-default">Void Invoice</h3>
            <p className="mt-1 text-xs text-muted">
              Provide a valid reason for voiding this invoice. This operation is permanent.
            </p>
            <form onSubmit={handleVoid} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-default mb-1">Void Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Order cancelled prior to delivery or duplicate invoice..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoidModal(null);
                    setVoidReason('');
                  }}
                  className="rounded-xl border border-default px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidMutation.isPending}
                  className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {voidMutation.isPending ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Template Designer Modal */}
      {(showDesigner || previewInvoice) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-default bg-surface p-2 shadow-2xl">
            <InvoiceTemplateBuilder
              invoice={previewInvoice ?? undefined}
              onClose={() => {
                setShowDesigner(false);
                setPreviewInvoice(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={historicalInvoiceImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
        }}
      />

      {/* Delete Confirmation Dialog (Destructive UX Overhaul - Sprint C3) */}
      {deleteConfirm && (
        <DestructiveConfirmationDialog
          open={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirmDelete={() => {
            if (deleteConfirm.isBulk) {
              deleteInvoiceMutation.mutate({ ids: Array.from(selectedIds) });
            } else if (deleteConfirm.id) {
              deleteInvoiceMutation.mutate({ id: deleteConfirm.id });
            }
          }}
          title={deleteConfirm.isBulk ? `Delete ${selectedIds.size} Invoices` : 'Delete Invoice'}
          entityType="Invoice"
          entityName={deleteConfirm.title}
          entityCode={deleteConfirm.invoice?.invoice_number}
          impactItems={
            deleteConfirm.invoice
              ? [
                  {
                    label: 'Total Amount',
                    count: formatCurrency(deleteConfirm.invoice.total_amount),
                    warning: parseFloat(deleteConfirm.invoice.total_amount || '0') > 0,
                  },
                  {
                    label: 'Invoice Status',
                    count: (deleteConfirm.invoice.status || 'posted').toUpperCase(),
                  },
                  {
                    label: 'Customer',
                    count: deleteConfirm.invoice.customer_name || 'Counter Customer',
                  },
                  {
                    label: 'Exchanges Count',
                    count: deleteConfirm.invoice.has_exchanges ? String(deleteConfirm.invoice.exchanges_count ?? 1) : 'None',
                    warning: Boolean(deleteConfirm.invoice.has_exchanges),
                  },
                ]
              : [
                  {
                    label: 'Total Selected Invoices',
                    count: selectedIds.size,
                    warning: true,
                  },
                  {
                    label: 'Combined Total Value',
                    count: formatCurrency(
                      filteredInvoices
                        .filter((inv) => selectedIds.has(inv.id))
                        .reduce((sum, inv) => sum + (parseFloat(inv.total_amount || '0') || 0), 0)
                    ),
                  },
                ]
          }
          warningMessage={`Moving ${deleteConfirm.title} to Data Bin will withdraw it from the active ledger while retaining audit records. You can restore it anytime from Settings > Data Bin.`}
          isDeleting={deleteInvoiceMutation.isPending}
        />
      )}

      {/* Entity Audit History Drawer */}
      <AuditTimelineDrawer
        isOpen={Boolean(auditingInvoice)}
        onClose={() => setAuditingInvoice(null)}
        entityType="Invoice"
        entityId={auditingInvoice?.id}
        entityTitle={`Invoice #${auditingInvoice?.invoice_number}`}
        entityCode={auditingInvoice?.status}
      />
    </div>
  );
}
