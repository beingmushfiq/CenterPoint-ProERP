import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw, Search, Printer, DollarSign, Trash2, X, Split } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { PaymentReceiptDocument } from '../../../components/print/documents/PaymentReceiptDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { PaymentSplitEditor } from '../../../components/payment/PaymentSplitEditor';
import type { PaymentSplitRow, BankAccountOption } from '../../../components/payment/PaymentSplitEditor';
import { ResponsiveDataTable } from '../../../components/ui/ResponsiveDataTable';

export function PaymentsSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.payment.delete');
  const queryClient = useQueryClient();
  const { currencyCode, formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [printPayment, setPrintPayment] = useState<Payment | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; isBulk?: boolean; title: string } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Payment form state
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'mobile_banking' | 'credit_adjustment';
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Multi-Payment Split State
  const [isMultiPayMode, setIsMultiPayMode] = useState(false);
  const [splits, setSplits] = useState<PaymentSplitRow[]>([
    { id: 'split-1', method: 'cash', amount: 0 },
  ]);
  const [isSplitValid, setIsSplitValid] = useState(true);

  // Bank accounts for selection in splits
  const { data: bankAccounts = [] } = useQuery<BankAccountOption[]>({
    queryKey: ['finance', 'bank-accounts'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: BankAccountOption[] } | BankAccountOption[]>('/finance/bank-accounts');
        return Array.isArray(res.data) ? res.data : (res.data as { data?: BankAccountOption[] })?.data ?? [];
      } catch {
        return [];
      }
    },
  });

  const { data: payments = [], isLoading, isFetching, refetch } = useQuery<Payment[]>({
    queryKey: ['sales', 'payments'],
    queryFn: async () => {
      const res = await api.get<Payment[]>('/sales/payments');
      return res.data ?? [];
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseFloat(amount) || 0;
      const activeSplits: PaymentSplitRow[] = isMultiPayMode
        ? splits
        : [
            {
              id: '1',
              method,
              amount: numAmount,
              ...(referenceNumber ? { transaction_ref: referenceNumber } : {}),
              ...(notes ? { notes } : {}),
            },
          ];

      const splitSum = activeSplits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const primaryMethod = activeSplits.length > 1 ? 'split' : (activeSplits[0]?.method || method);

      await api.post('/sales/payments', {
        direction,
        method: primaryMethod,
        amount: (isMultiPayMode ? splitSum : numAmount).toFixed(4),
        payment_date: paymentDate,
        ...(referenceNumber ? { reference_number: referenceNumber } : {}),
        ...(notes ? { notes } : {}),
        splits: activeSplits.map((s) => ({
          method: s.method,
          amount: s.amount.toFixed(4),
          ...(s.bank_account_id ? { bank_account_id: s.bank_account_id } : {}),
          ...(s.mobile_provider ? { mobile_provider: s.mobile_provider } : {}),
          ...(s.mobile_number ? { mobile_number: s.mobile_number } : {}),
          ...(s.transaction_ref ? { transaction_ref: s.transaction_ref } : {}),
          ...(s.cheque_number ? { cheque_number: s.cheque_number } : {}),
          ...(s.cheque_date ? { cheque_date: s.cheque_date } : {}),
          ...(s.card_last4 ? { card_last4: s.card_last4 } : {}),
          ...(s.notes ? { notes: s.notes } : {}),
        })),
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully.');
      setShowCreateModal(false);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setIsMultiPayMode(false);
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    },
  });

  const handlePrintPayment = async (p: Payment) => {
    setPrintPayment(p);
    try {
      const res = await api.get<Payment>(`/sales/payments/${p.id}`);
      if (res.data) setPrintPayment(res.data);
    } catch {
      // Keep cached payment
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    recordPaymentMutation.mutate();
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.reference_number?.toLowerCase().includes(search.toLowerCase());

    const matchesDirection = directionFilter === 'all' || p.direction === directionFilter;

    return matchesSearch && matchesDirection;
  });

  const isAllSelected = filteredPayments.length > 0 && selectedIds.size === filteredPayments.length;
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
      setSelectedIds(new Set(filteredPayments.map((p) => p.id)));
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

  const deletePaymentMutation = useMutation({
    mutationFn: async ({ id, ids }: { id?: number; ids?: number[] }) => {
      if (ids && ids.length > 0) {
        let count = 0;
        for (const paymentId of ids) {
          await api.delete(`/sales/payments/${paymentId}`);
          count++;
        }
        return count;
      } else if (id) {
        await api.delete(`/sales/payments/${id}`);
        return 1;
      }
      return 0;
    },
    onSuccess: (count) => {
      toast.success(`Moved ${count} payment(s) to Data Bin`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payment');
    },
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by payment #, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 sm:h-9 w-full sm:w-64 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Directions' },
              { value: 'in', label: 'Inflow (Customer Receipts)', colorDot: 'bg-emerald-500' },
              { value: 'out', label: 'Outflow (Vendor/Refunds)', colorDot: 'bg-rose-500' },
            ]}
            value={directionFilter}
            onChange={(val) => setDirectionFilter(val)}
            size="sm"
            aria-label="Filter payments by direction"
          />

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex min-h-[44px] sm:min-h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex min-h-[44px] sm:min-h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-medium text-primary-fg hover:opacity-90 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Bulk Action Ribbon */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} payment(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  isBulk: true,
                  title: `${selectedIds.size} selected payment(s)`,
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

      {/* Responsive Payments Table */}
      <ResponsiveDataTable<Payment>
        data={filteredPayments}
        isLoading={isLoading}
        keyExtractor={(p) => p.id}
        emptyMessage="No payments recorded."
        emptyIcon={DollarSign}
        selectedIds={selectedIds}
        onSelectRow={(id) => toggleSelect(Number(id))}
        onSelectAll={toggleSelectAll}
        mobileCardBreakpoint="sm"
        mobileActions={(p) => [
          {
            id: 'print',
            label: 'Print Money Receipt',
            icon: Printer,
            onClick: () => handlePrintPayment(p),
          },
          ...(canDelete ? [{
            id: 'delete',
            label: 'Move to Data Bin',
            icon: Trash2,
            variant: 'danger' as const,
            onClick: () =>
              setDeleteConfirm({
                id: p.id,
                title: `payment ${p.payment_number}`,
              }),
          }] : []),
        ]}
        columns={[
          {
            id: 'payment_number',
            header: 'Payment #',
            isPrimary: true,
            cell: (p) => (
              <span className="font-mono font-medium text-default">{p.payment_number}</span>
            ),
          },
          {
            id: 'date',
            header: 'Date',
            priority: 'medium',
            cell: (p) => <span className="text-muted">{p.payment_date}</span>,
          },
          {
            id: 'type',
            header: 'Type',
            cell: (p) =>
              p.direction === 'in' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="h-3.5 w-3.5" /> Inflow
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Outflow
                </span>
              ),
          },
          {
            id: 'method',
            header: 'Method',
            priority: 'low',
            cell: (p) =>
              p.method === 'split' ? (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[10px] tracking-wide border border-primary/20"
                  title={p.splits?.map((s) => `${s.method}: ${s.amount}`).join(', ')}
                >
                  <Split className="h-3 w-3" /> Multi-Split {p.splits?.length ? `(${p.splits.length})` : ''}
                </span>
              ) : (
                <span className="uppercase font-mono text-[11px] text-muted">{p.method.replace('_', ' ')}</span>
              ),
          },
          {
            id: 'customer',
            header: 'Customer / Entity',
            cell: (p) => (
              <span className="text-default font-medium">
                {p.customer_name ?? 'Counter Customer / Direct'}
              </span>
            ),
          },
          {
            id: 'reference',
            header: 'Reference',
            priority: 'low',
            cell: (p) => <span className="font-mono text-muted text-[11px]">{p.reference_number || '—'}</span>,
          },
          {
            id: 'amount',
            header: 'Amount',
            cell: (p) => (
              <span className="font-mono font-bold text-default">{formatCurrency(p.amount)}</span>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            isStatus: true,
            cell: (p) => (
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {p.status}
              </span>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            isAction: true,
            align: 'right',
            cell: (p) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePrintPayment(p)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-default text-muted hover:text-default hover:bg-surface text-xs transition-colors cursor-pointer"
                  title="Print Money Receipt"
                >
                  <Printer className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        id: p.id,
                        title: `payment ${p.payment_number}`,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-colors cursor-pointer"
                    title="Move payment to Data Bin"
                  >
                    <Trash2 className="size-3" />
                    <span className="hidden sm:inline">Bin</span>
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Record Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">Record Payment / Receipt</h3>
                <p className="text-xs text-muted mt-0.5">Collect customer receivables or disburse vendor settlement</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-sunken hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleRecordPayment}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-default mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                  >
                    <option value="in">Customer Inflow (Receipt)</option>
                    <option value="out">Vendor/Refund Outflow</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-default mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-default">Total Amount ({currencyCode})</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMultiPayMode;
                      setIsMultiPayMode(next);
                      if (next && splits.length > 0 && splits[0]) {
                        const curAmt = parseFloat(amount) || 0;
                        setSplits([{ id: `split-${Date.now()}`, method, amount: curAmt }]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      isMultiPayMode
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-surface-sunken text-muted border-default hover:text-default'
                    }`}
                  >
                    <Split className="h-3 w-3" />
                    <span>{isMultiPayMode ? 'Multi-Split Enabled' : 'Split Tender'}</span>
                  </button>
                </div>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 5000.00"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAmount(val);
                    if (isMultiPayMode && splits.length === 1 && splits[0]) {
                      setSplits([{ ...splits[0], amount: parseFloat(val) || 0 }]);
                    }
                  }}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                />
              </div>

              {/* Method selection (Single Mode vs Multi-Split Editor) */}
              {!isMultiPayMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-default mb-1">Primary Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                    >
                      <option value="cash">Cash Tender</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="card">POS Card</option>
                      <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                      <option value="cheque">Cheque</option>
                      <option value="credit_adjustment">Credit Adjustment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-default mb-1">
                      Transaction / Cheque Reference #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRX-9823412 or Cheque #0012"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <PaymentSplitEditor
                    totalAmount={parseFloat(amount) || 0}
                    currencySymbol={currencyCode}
                    bankAccounts={bankAccounts}
                    splits={splits}
                    onChange={(newSplits, valid) => {
                      setSplits(newSplits);
                      setIsSplitValid(valid);
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-default mb-1">Notes & Memo</label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remark or customer reference..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-default px-3.5 py-2 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending || (isMultiPayMode && !isSplitValid)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Payment Receipt Modal */}
      {printPayment && (
        <PrintPreviewModal
          isOpen={Boolean(printPayment)}
          onClose={() => setPrintPayment(null)}
          title={`Money Receipt: ${printPayment.payment_number}`}
          documentNumber={printPayment.payment_number}
          documentType="Official Money Receipt Voucher"
          pageClass="print-page-a4"
        >
          <PaymentReceiptDocument payment={printPayment} businessConfig={businessConfig} />
        </PrintPreviewModal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.isBulk) {
            deletePaymentMutation.mutate({ ids: Array.from(selectedIds) });
          } else if (deleteConfirm?.id) {
            deletePaymentMutation.mutate({ id: deleteConfirm.id });
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
