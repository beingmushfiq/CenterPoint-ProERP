import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw, Search, Printer, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { PaymentReceiptDocument } from '../../../components/print/documents/PaymentReceiptDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';

export function PaymentsSection() {
  const queryClient = useQueryClient();
  const { currencyCode, formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [printPayment, setPrintPayment] = useState<Payment | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Payment form state
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'mobile_banking' | 'credit_adjustment';
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const { data: payments = [], isLoading, isFetching, refetch } = useQuery<Payment[]>({
    queryKey: ['sales', 'payments'],
    queryFn: async () => {
      const res = await api.get<Payment[]>('/sales/payments');
      return res.data ?? [];
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      await api.post('/sales/payments', {
        direction,
        method,
        amount,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully.');
      setShowCreateModal(false);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by payment #, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
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
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-medium text-primary-fg hover:opacity-90 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Record Payment
        </button>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Payment #</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5">Customer / Entity</th>
                <th className="px-4 py-3.5">Reference</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-5 animate-spin text-primary" />
                      <span>Loading payments & receipts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DollarSign className="size-8 text-muted/50" />
                      <span className="font-medium">No payments recorded.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-medium text-default">{p.payment_number}</td>
                    <td className="px-4 py-3.5 text-muted">{p.payment_date}</td>
                    <td className="px-4 py-3.5">
                      {p.direction === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <ArrowDownLeft className="h-3.5 w-3.5" /> Inflow
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          <ArrowUpRight className="h-3.5 w-3.5" /> Outflow
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 uppercase font-mono text-[11px] text-muted">
                      {p.method.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3.5 text-default font-medium">
                      {p.customer_name ?? 'Counter Customer / Direct'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted text-[11px]">
                      {p.reference_number || '-'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-default">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handlePrintPayment(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-default text-muted hover:text-default hover:bg-surface text-xs transition-colors cursor-pointer"
                        title="Print Money Receipt"
                      >
                        <Printer className="size-3.5 text-primary" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Record Payment / Receipt</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-sunken hover:text-default"
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
                  <label className="block text-xs font-medium text-default mb-1">Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">POS Card</option>
                    <option value="mobile_banking">Mobile Banking (bKash/Nagad)</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1">Amount ({currencyCode})</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 5000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                />
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

              <div>
                <label className="block text-xs font-medium text-default mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional memo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-default px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
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
    </div>
  );
}
