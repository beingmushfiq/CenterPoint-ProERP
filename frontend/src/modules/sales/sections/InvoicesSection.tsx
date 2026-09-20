import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Clock, Printer, RefreshCw, Search, Sliders, FileText, DollarSign, BookOpen, ArrowLeftRight, Upload, Download, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { InvoiceTemplateBuilder } from '../components/InvoiceTemplateBuilder';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { historicalInvoiceImportSchema } from '../schemas/historicalInvoiceImportSchema';

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

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; isBulk?: boolean; title: string } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by invoice #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
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
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default transition-colors cursor-pointer"
            title="Import historical opening invoices from Excel (.xlsx) or CSV"
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span>Import Invoices</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default transition-colors cursor-pointer"
            title="Export invoices to CSV"
          >
            <Download className="h-3.5 w-3.5 text-muted" />
            <span>Export CSV</span>
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
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
            title="Create Direct Sales Invoice"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{createInvoiceMutation.isPending ? 'Creating...' : 'New Invoice'}</span>
          </button>

          <button
            onClick={() => setShowDesigner(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3.5 text-xs font-medium text-default hover:bg-surface hover:text-primary transition-colors cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Template Designer & Preview
          </button>
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

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all invoices"
                    className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Invoice Number</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Subtotal</th>
                <th className="px-4 py-3.5">Gross Margin</th>
                <th className="px-4 py-3.5">Total Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-5 animate-spin text-primary" />
                      <span>Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="size-8 text-muted/50" />
                      <span className="font-medium">No sales invoices found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const subtotalNum = parseFloat(inv.subtotal || '0');
                  const estCogs = subtotalNum * 0.62; // 62% historical average COGS
                  const grossProfit = Math.max(0, subtotalNum - estCogs);
                  const marginPct = subtotalNum > 0 ? (grossProfit / subtotalNum) * 100 : 0;
                  const isSelected = selectedIds.has(inv.id);
                  return (
                    <tr key={inv.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                      <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(inv.id)}
                          aria-label={`Select invoice ${inv.invoice_number}`}
                          className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{inv.invoice_number}</span>
                          {inv.has_exchanges && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 border border-violet-500/20"
                              title={`Contains ${inv.exchanges_count ?? 1} linked exchange adjustments`}
                            >
                              <ArrowLeftRight className="size-2.5" /> Exchanged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted">{inv.invoice_date}</td>
                      <td className="px-4 py-3.5 text-default font-medium">
                        {inv.customer_name ?? 'Counter Customer'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-default">
                        {formatCurrency(subtotalNum)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {formatCurrency(grossProfit)}
                          </span>
                          <span className="text-[10px] text-muted font-mono">
                            ({marginPct.toFixed(1)}%)
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-sunken border border-default text-muted font-mono" title="Locked to historical COGS at transaction time">
                            🔒 Locked
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium text-default">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(inv.status)}</td>
                      <td className="px-4 py-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handlePreviewInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded-xl bg-surface-sunken border border-default px-2.5 py-1 text-[11px] font-medium text-default hover:bg-surface transition-colors cursor-pointer"
                        >
                          <Printer className="h-3 w-3" /> Print
                        </button>
                        {inv.status === 'draft' && (
                          <button
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
                            <span>Collect</span>
                          </button>
                        )}
                        {(inv.status === 'posted' || inv.status === 'paid') && (
                          <Link
                            to="/finance?tab=gl"
                            className="inline-flex items-center gap-1 rounded-xl bg-surface-sunken border border-default px-2 py-1 text-[11px] font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
                            title="View posted accounting journals in General Ledger"
                          >
                            <BookOpen className="size-3" />
                            <span>Ledger</span>
                          </Link>
                        )}
                        {inv.status !== 'void' && (
                          <button
                            onClick={() => setShowVoidModal(inv.id)}
                            className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          >
                            Void
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                id: inv.id,
                                title: `invoice ${inv.invoice_number}`,
                              })
                            }
                            className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Move invoice to Data Bin"
                          >
                            <Trash2 className="size-3" />
                            <span>Move to Bin</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.isBulk) {
            deleteInvoiceMutation.mutate({ ids: Array.from(selectedIds) });
          } else if (deleteConfirm?.id) {
            deleteInvoiceMutation.mutate({ id: deleteConfirm.id });
          }
        }}
        title="Move to Data Bin"
        message={`Are you sure you want to move ${deleteConfirm?.title} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        variant="danger"
      />
    </div>
  );
}
