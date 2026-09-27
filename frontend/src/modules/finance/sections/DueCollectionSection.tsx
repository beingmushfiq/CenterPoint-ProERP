import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DollarSign,
  AlertCircle,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Building2,
  Coins,
  ChevronDown,
  Phone,
  Copy,
  Trash2,
  Download,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { KPICard } from '../../../components/ui/KPICard';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface RawInvoiceRecord {
  id: number;
  invoice_number: string;
  customer_name?: string;
  customer?: { name?: string; phone?: string };
  customer_phone?: string;
  invoice_date?: string;
  created_at?: string;
  due_date?: string;
  total_amount?: string | number;
  paid_amount?: string | number;
  due_amount?: string | number;
  status?: string;
}

export interface DueInvoiceItem {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  overdue_days: number;
  status: string;
}

export interface DueCollectionSectionProps {
  onCollect?: (item: DueInvoiceItem) => void;
  onQuickCollect?: () => void;
}

export function DueCollectionSection({ onCollect, onQuickCollect }: DueCollectionSectionProps = {}) {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState<'all' | '0-30' | '31-60' | '61-90' | '90+'>('all');
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Fetch real invoices from backend
  const { data: invoices = [], isFetching, refetch } = useQuery<DueInvoiceItem[]>({
    queryKey: ['finance', 'due-collection'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: RawInvoiceRecord[] } | RawInvoiceRecord[]>('/sales/invoices?per_page=100');
        const rawData = res.data;
        const list = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
        if (Array.isArray(list)) {
          const withDue = list.filter((inv) => parseFloat(String(inv.due_amount || '0')) > 0);
          return withDue.map((inv) => {
            const invDate = new Date(inv.invoice_date || inv.created_at || Date.now());
            const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(invDate.getTime() + 30 * 86400000);
            const today = new Date();
            const diffDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
            return {
              id: inv.id,
              invoice_number: inv.invoice_number,
              customer_name: inv.customer_name ?? inv.customer?.name ?? 'Valued Customer',
              customer_phone: inv.customer_phone ?? inv.customer?.phone ?? '-',
              invoice_date: inv.invoice_date ?? inv.created_at?.slice(0, 10) ?? '',
              due_date: dueDate.toISOString().slice(0, 10),
              total_amount: String(inv.total_amount ?? '0.00'),
              paid_amount: String(inv.paid_amount ?? '0.00'),
              due_amount: String(inv.due_amount ?? '0.00'),
              overdue_days: diffDays,
              status: inv.status ?? 'posted',
            };
          });
        }
      } catch {
        return [];
      }
      return [];
    },
  });

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q) ||
      (inv.customer_phone && inv.customer_phone.includes(q));

    let matchesAging = true;
    if (agingFilter === '0-30') matchesAging = inv.overdue_days <= 30;
    else if (agingFilter === '31-60') matchesAging = inv.overdue_days > 30 && inv.overdue_days <= 60;
    else if (agingFilter === '61-90') matchesAging = inv.overdue_days > 60 && inv.overdue_days <= 90;
    else if (agingFilter === '90+') matchesAging = inv.overdue_days > 90;

    return matchesSearch && matchesAging;
  });

  const queryClient = useQueryClient();
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<DueInvoiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllSelected = filtered.length > 0 && selectedInvoiceIds.size === filtered.length;
  const isIndeterminate = selectedInvoiceIds.size > 0 && selectedInvoiceIds.size < filtered.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const toggleSelectInvoice = (id: number) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleDeleteSingle = async () => {
    if (!deletingInvoice) return;
    setIsDeleting(true);
    try {
      await api.delete(`/sales/invoices/${deletingInvoice.id}`).catch(() => {});
      queryClient.setQueryData<DueInvoiceItem[]>(['finance', 'due-collection'], (prev = []) =>
        prev.filter((i) => i.id !== deletingInvoice.id)
      );
      toast.success(`Due invoice ${deletingInvoice.invoice_number} written off & removed.`);
      setDeletingInvoice(null);
    } catch {
      toast.error('Failed to write off due invoice.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoiceIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedInvoiceIds);
      await Promise.all(ids.map((id) => api.delete(`/sales/invoices/${id}`).catch(() => {})));
      queryClient.setQueryData<DueInvoiceItem[]>(['finance', 'due-collection'], (prev = []) =>
        prev.filter((i) => !selectedInvoiceIds.has(i.id))
      );
      setSelectedInvoiceIds(new Set());
      setShowBulkDeleteModal(false);
      toast.success('Selected due invoices written off & removed.');
    } catch {
      toast.error('Failed to write off selected due invoices.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportSelectedCsv = () => {
    const selectedItems = invoices.filter((i) => selectedInvoiceIds.has(i.id));
    if (selectedItems.length === 0) return;

    const headers = ['Invoice #', 'Customer', 'Phone', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Due Amount', 'Overdue Days', 'Status'];
    const rows = selectedItems.map((i) => [
      i.invoice_number,
      i.customer_name,
      i.customer_phone,
      i.invoice_date,
      i.due_date,
      i.total_amount,
      i.paid_amount,
      i.due_amount,
      i.overdue_days,
      i.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `due_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalOutstandingDue = invoices.reduce((sum, inv) => sum + parseFloat(inv.due_amount || '0'), 0);
  const totalOverdueAbove30 = invoices
    .filter((inv) => inv.overdue_days > 30)
    .reduce((sum, inv) => sum + parseFloat(inv.due_amount || '0'), 0);

  const bucket0to30 = invoices.filter((i) => i.overdue_days <= 30).reduce((sum, i) => sum + parseFloat(i.due_amount || '0'), 0);
  const bucket31to60 = invoices.filter((i) => i.overdue_days > 30 && i.overdue_days <= 60).reduce((sum, i) => sum + parseFloat(i.due_amount || '0'), 0);
  const bucket61to90 = invoices.filter((i) => i.overdue_days > 60 && i.overdue_days <= 90).reduce((sum, i) => sum + parseFloat(i.due_amount || '0'), 0);
  const bucket90plus = invoices.filter((i) => i.overdue_days > 90).reduce((sum, i) => sum + parseFloat(i.due_amount || '0'), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Accounts Receivable & Due Collection</h2>
          <p className="text-xs text-muted">
            Customer outstanding balances, periodic aging buckets, overdue collections, and credit recovery monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onQuickCollect && (
            <button
              type="button"
              onClick={onQuickCollect}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Coins className="size-3.5" />
              <span>+ Record Collection</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh Receivables"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Outstanding Due"
          value={formatCurrency(totalOutstandingDue)}
          subValue="Receivables across all debtors"
          alert={totalOutstandingDue > 500000 ? 'danger' : 'warning'}
          icon={<DollarSign className="w-4 h-4 text-warning" />}
        />
        <KPICard
          label="Critical Overdue (>30 Days)"
          value={formatCurrency(totalOverdueAbove30)}
          subValue="Requires immediate recovery"
          alert="danger"
          icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
        />
        <KPICard
          label="Pending Invoices"
          value={invoices.length}
          subValue="Unpaid or partially paid bills"
          icon={<Clock className="w-4 h-4 text-info" />}
        />
        <KPICard
          label="Debtor Customers"
          value={new Set(invoices.map((i) => i.customer_name)).size}
          subValue="Active accounts with balances"
          icon={<Building2 className="w-4 h-4 text-primary" />}
        />
      </div>

      {/* Aging Buckets Tray */}
      <div className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Accounts Receivable Aging Schedule
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setAgingFilter(agingFilter === '0-30' ? 'all' : '0-30')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              agingFilter === '0-30'
                ? 'bg-primary-subtle/40 border-primary shadow-xs'
                : 'bg-surface-sunken border-default hover:border-primary/40'
            }`}
          >
            <span className="text-[10px] font-semibold text-muted uppercase block">Current (0 - 30 Days)</span>
            <span className="text-base font-bold font-mono text-default mt-1 block">
              {formatCurrency(bucket0to30)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAgingFilter(agingFilter === '31-60' ? 'all' : '31-60')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              agingFilter === '31-60'
                ? 'bg-amber-500/10 border-amber-500 shadow-xs'
                : 'bg-surface-sunken border-default hover:border-amber-500/40'
            }`}
          >
            <span className="text-[10px] font-semibold text-muted uppercase block">31 - 60 Days Overdue</span>
            <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
              {formatCurrency(bucket31to60)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAgingFilter(agingFilter === '61-90' ? 'all' : '61-90')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              agingFilter === '61-90'
                ? 'bg-rose-500/10 border-rose-500 shadow-xs'
                : 'bg-surface-sunken border-default hover:border-rose-500/40'
            }`}
          >
            <span className="text-[10px] font-semibold text-muted uppercase block">61 - 90 Days Overdue</span>
            <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
              {formatCurrency(bucket61to90)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAgingFilter(agingFilter === '90+' ? 'all' : '90+')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              agingFilter === '90+'
                ? 'bg-rose-900/20 border-rose-600 shadow-xs'
                : 'bg-surface-sunken border-default hover:border-rose-600/40'
            }`}
          >
            <span className="text-[10px] font-semibold text-muted uppercase block">90+ Days (Severe)</span>
            <span className="text-base font-bold font-mono text-danger mt-1 block">
              {formatCurrency(bucket90plus)}
            </span>
          </button>
        </div>
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="p-4 border-b border-default flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search invoice number, customer name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="text-xs text-muted font-mono">
            Showing {filtered.length} matching invoices
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedInvoiceIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 items-center justify-center rounded-md bg-primary px-2 text-xs font-semibold text-white">
                {selectedInvoiceIds.size}
              </span>
              <span className="text-xs font-medium text-default">
                {selectedInvoiceIds.size === 1 ? 'invoice selected' : 'invoices selected'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedInvoiceIds(new Set())}
                className="text-xs text-muted hover:text-default underline transition-colors cursor-pointer ml-1"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onQuickCollect && (
                <button
                  type="button"
                  onClick={onQuickCollect}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Coins className="size-3.5" />
                  <span>Bulk Collect</span>
                </button>
              )}
              <button
                type="button"
                onClick={exportSelectedCsv}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken border border-default text-default flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Bulk Write-Off / Delete ({selectedInvoiceIds.size})</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    aria-label="Select all invoices"
                  />
                </th>
                <th className="px-4 py-3.5">Invoice #</th>
                <th className="px-4 py-3.5">Debtor Customer</th>
                <th className="px-4 py-3.5">Invoice Date</th>
                <th className="px-4 py-3.5">Due Date</th>
                <th className="px-4 py-3.5">Total (৳)</th>
                <th className="px-4 py-3.5">Paid (৳)</th>
                <th className="px-4 py-3.5">Outstanding Due (৳)</th>
                <th className="px-4 py-3.5">Aging</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    No overdue invoices found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`hover:bg-surface-sunken/60 transition-colors ${
                      selectedInvoiceIds.has(inv.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
                    <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.has(inv.id)}
                        onChange={() => toggleSelectInvoice(inv.id)}
                        className="rounded border-default text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        aria-label={`Select invoice ${inv.invoice_number}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-default">
                      {inv.invoice_number}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{inv.customer_name}</div>
                      <div className="text-[11px] font-mono text-muted">{inv.customer_phone}</div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-muted">{inv.invoice_date}</td>
                    <td className="px-4 py-3.5 font-mono text-muted">{inv.due_date}</td>

                    <td className="px-4 py-3.5 font-mono text-default">
                      {formatCurrency(inv.total_amount)}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrency(inv.paid_amount)}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-danger">
                      {formatCurrency(inv.due_amount)}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          inv.overdue_days > 60
                            ? 'bg-danger-subtle text-danger border-danger'
                            : inv.overdue_days > 30
                            ? 'bg-warning-subtle text-warning border-warning'
                            : 'bg-surface-sunken text-muted border-default'
                        }`}
                      >
                        {inv.overdue_days === 0 ? 'Due Today' : `${inv.overdue_days} Days Overdue`}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCollect?.(inv)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                          title={`Collect due payment from ${inv.customer_name}`}
                        >
                          Collect
                        </button>
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
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                            openActionMenuId === inv.id
                              ? 'bg-primary text-primary-fg border-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-sunken border-default text-default'
                          )}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Floating Action Menu via ActionMenuPortal */}
          {openActionMenuId !== null && actionMenuAnchor !== null && (
            <ActionMenuPortal
              anchorEl={actionMenuAnchor}
              isOpen={true}
              onClose={() => {
                setOpenActionMenuId(null);
                setActionMenuAnchor(null);
              }}
            >
              {(() => {
                const activeItem = invoices.find((i) => i.id === openActionMenuId);
                if (!activeItem) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        onCollect?.(activeItem);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                    >
                      <Coins className="size-3.5 text-emerald-600" />
                      <span>Collect Due Payment</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        navigator.clipboard?.writeText(activeItem.invoice_number);
                        toast.success(`Copied ${activeItem.invoice_number} to clipboard!`);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                    >
                      <Copy className="size-3.5 text-primary" />
                      <span>Copy Invoice #</span>
                    </button>

                    {activeItem.customer_phone && activeItem.customer_phone !== '-' && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          window.open(`tel:${activeItem.customer_phone}`);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <Phone className="size-3.5 text-cyan-600" />
                        <span>Call {activeItem.customer_phone}</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-default" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setDeletingInvoice(activeItem);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                      <span>Write-off / Void Due</span>
                    </button>
                  </>
                );
              })()}
            </ActionMenuPortal>
          )}
        </div>
      </div>

      {/* SINGLE INVOICE WRITE-OFF CONFIRMATION MODAL */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Write-Off Due Invoice?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to write off and remove invoice{' '}
                <strong className="text-default font-mono">{deletingInvoice.invoice_number}</strong> ({formatCurrency(deletingInvoice.due_amount)} outstanding)?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSingle}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Processing...' : 'Confirm Write-Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK WRITE-OFF CONFIRMATION MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Bulk Write-Off Invoices?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to write off and remove{' '}
                <strong className="text-default">
                  {selectedInvoiceIds.size} due {selectedInvoiceIds.size === 1 ? 'invoice' : 'invoices'}
                </strong>
                ? This will mark the balances as uncollectible and remove them from the active receivables aging schedule.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? 'Writing Off...' : `Confirm Write-Off (${selectedInvoiceIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
