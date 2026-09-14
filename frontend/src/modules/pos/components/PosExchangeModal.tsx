import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CheckCircle2,
  Trash2,
  Search,
  AlertCircle,
  DollarSign,
  X,
  RefreshCw,
  Package,
  Layers,
} from 'lucide-react';
import type { PosSession } from '../../../types/api/pos';
import type { Product } from '../../../types/api/catalog';
import type { Invoice, InvoiceItem } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { notify } from '../../../components/ui/Toast';
import { useCurrency } from '../../../hooks/useCurrency';

export interface PosExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PosSession;
  products: Product[];
  initialInvoiceId?: number | null;
  initialInvoiceNumber?: string | null;
  initialOrderItems?: Array<{
    product_id: number;
    product_name?: string | undefined;
    quantity: number | string;
    unit_price: number | string;
  }>;
  onExchangeCompleted?: (exchangeNumber: string) => void;
}

interface ReturnItemState {
  id: string;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  unit_id: number;
  condition: 'good' | 'defective' | 'damaged';
  restock: boolean;
}

interface ReplacementItemState {
  id: string;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  unit_id: number;
}

const REASON_OPTIONS = [
  { id: 1, label: 'Customer Preference / Changed Mind' },
  { id: 2, label: 'Defective / Faulty Item' },
  { id: 3, label: 'Wrong Size / Fit Issue' },
  { id: 4, label: 'Transit / Packaging Damage' },
  { id: 5, label: 'Exchange for Higher Variant' },
];

export function PosExchangeModal({
  isOpen,
  onClose,
  session,
  products,
  initialInvoiceId,
  initialInvoiceNumber,
  initialOrderItems,
  onExchangeCompleted,
}: PosExchangeModalProps) {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  // Search states for comboboxes
  const [returnSearch, setReturnSearch] = useState('');
  const [replacementSearch, setReplacementSearch] = useState('');
  const [reasonCodeId, setReasonCodeId] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [invoiceRef, setInvoiceRef] = useState(initialInvoiceNumber || '');
  const [invoiceId, setInvoiceId] = useState<number | null>(initialInvoiceId || null);
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completedExchangeNumber, setCompletedExchangeNumber] = useState<string | null>(null);

  // Return items state initialized from initialOrderItems if available
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>(() => {
    if (initialOrderItems && initialOrderItems.length > 0) {
      return initialOrderItems.map((item, idx) => ({
        id: `init-${idx}`,
        product_id: item.product_id,
        product_name: item.product_name || `Product #${item.product_id}`,
        sku: `PRD-${item.product_id}`,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.unit_price) || 0,
        unit_id: 1,
        condition: 'good',
        restock: true,
      }));
    }
    return [];
  });

  // Replacement items state
  const [replacementItems, setReplacementItems] = useState<ReplacementItemState[]>([]);

  // Subtotal calculations
  const returnSubtotal = useMemo(() => {
    return returnItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  }, [returnItems]);

  const replacementSubtotal = useMemo(() => {
    return replacementItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  }, [replacementItems]);

  const differenceAmount = useMemo(() => {
    return replacementSubtotal - returnSubtotal;
  }, [returnSubtotal, replacementSubtotal]);

  // Settlement classification
  const settlementType = useMemo<'top_up' | 'refund' | 'none'>(() => {
    if (differenceAmount > 0.0001) return 'top_up';
    if (differenceAmount < -0.0001) return 'refund';
    return 'none';
  }, [differenceAmount]);

  // Filtered lists for product selection
  const filteredReturnProducts = useMemo(() => {
    if (!returnSearch.trim()) return [];
    const q = returnSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [products, returnSearch]);

  const filteredReplacementProducts = useMemo(() => {
    if (!replacementSearch.trim()) return [];
    const q = replacementSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [products, replacementSearch]);

  // Helpers to add items
  const handleAddReturnProduct = (product: Product) => {
    const price = parseFloat(product.default_sale_price || product.standard_cost || '100') || 100;
    const prodId = Number(product.product_id ?? product.id) || 1;
    setReturnItems((prev) => {
      const existing = prev.find((p) => p.product_id === prodId);
      if (existing) {
        return prev.map((p) => (p.product_id === prodId ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [
        ...prev,
        {
          id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: prodId,
          product_name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_price: price,
          unit_id: Number(product.unit_id ?? product.base_unit_id) || 1,
          condition: 'good',
          restock: true,
        },
      ];
    });
    setReturnSearch('');
  };

  const handleAddReplacementProduct = (product: Product) => {
    const price = parseFloat(product.default_sale_price || product.standard_cost || '100') || 100;
    const prodId = Number(product.product_id ?? product.id) || 1;
    setReplacementItems((prev) => {
      const existing = prev.find((p) => p.product_id === prodId);
      if (existing) {
        return prev.map((p) => (p.product_id === prodId ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [
        ...prev,
        {
          id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: prodId,
          product_name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_price: price,
          unit_id: Number(product.unit_id ?? product.base_unit_id) || 1,
        },
      ];
    });
    setReplacementSearch('');
  };

  const handleLookupInvoice = async () => {
    const rawSearch = invoiceRef.trim();
    if (!rawSearch) {
      notify.error('Invoice Number Required', { description: 'Please enter an invoice number to search.' });
      return;
    }
    setSearchingInvoice(true);
    try {
      // 1. First query with raw search term
      const res = await api.get<{ data: Invoice[] } | Invoice[]>(`/sales/invoices?q=${encodeURIComponent(rawSearch)}`);
      const rawData = res.data;
      let invoices: Invoice[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);

      // 2. If no result and input didn't start with POS-, try searching with POS- prefix or stripped prefix
      if (invoices.length === 0) {
        const altSearch = rawSearch.toUpperCase().startsWith('POS-')
          ? rawSearch.slice(4)
          : `POS-${rawSearch}`;
        const altRes = await api.get<{ data: Invoice[] } | Invoice[]>(`/sales/invoices?q=${encodeURIComponent(altSearch)}`);
        const altRaw = altRes.data;
        invoices = Array.isArray(altRaw) ? altRaw : (altRaw?.data ?? []);
      }

      // 3. Match logic: exact match, prefix-agnostic match, or closest match
      const sLower = rawSearch.toLowerCase();
      const sStripped = sLower.replace(/^pos-/, '');
      const match =
        invoices.find((inv: Invoice) => {
          const numLower = String(inv.invoice_number || '').toLowerCase();
          const numStripped = numLower.replace(/^pos-/, '');
          return (
            numLower === sLower ||
            numStripped === sStripped ||
            numLower.includes(sLower) ||
            numStripped.includes(sStripped) ||
            sLower.includes(numLower) ||
            sStripped.includes(numStripped)
          );
        }) || (invoices.length > 0 ? invoices[0] : null);

      if (!match) {
        notify.info('Invoice Not Found', { description: `No invoice matching "${rawSearch}" found.` });
        return;
      }

      setInvoiceId(match.id);
      setInvoiceRef(match.invoice_number);

      if (match.items && match.items.length > 0) {
        const loadedItems: ReturnItemState[] = match.items.map((it: InvoiceItem, idx: number) => {
          const prod = products.find((p) => Number(p.product_id ?? p.id) === Number(it.product_id));
          return {
            id: `inv-${match.id}-${idx}`,
            product_id: Number(it.product_id),
            product_name: it.product_name || prod?.name || `Product #${it.product_id}`,
            sku: prod?.sku || `PRD-${it.product_id}`,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            unit_id: Number(it.unit_id) || Number(prod?.unit_id ?? prod?.base_unit_id) || 1,
            condition: 'good',
            restock: true,
          };
        });
        setReturnItems(loadedItems);
        notify.success('Invoice Loaded', {
          description: `Loaded ${loadedItems.length} return item(s) from invoice #${match.invoice_number}.`,
        });
      } else {
        notify.info('Invoice Found', { description: `Invoice #${match.invoice_number} has no item details.` });
      }
    } catch (err) {
      console.error('Failed to lookup invoice for exchange', err);
      notify.error('Invoice Search Failed', { description: 'Unable to query sales invoice.' });
    } finally {
      setSearchingInvoice(false);
    }
  };

  const handleProcessExchange = async (autoApprove: boolean) => {
    if (returnItems.length === 0) {
      notify.error('Return items required', { description: 'Please add at least one item being returned by customer.' });
      return;
    }
    if (replacementItems.length === 0) {
      notify.error('Replacement items required', {
        description: 'Please add at least one item being given to customer in replacement.',
      });
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        exchange_date: new Date().toISOString().slice(0, 10),
        warehouse_id: session.warehouse_id || 1,
        reason_code_id: reasonCodeId,
        pos_session_id: session.id,
        original_invoice_id: invoiceId || initialInvoiceId || undefined,
        notes: notes ? `[POS ${session.terminal_name ?? 'Station'}] ${notes}` : `[POS ${session.terminal_name ?? 'Counter'}]`,
        return_items: returnItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity.toFixed(4),
          unit_id: item.unit_id,
          unit_price: item.unit_price.toFixed(4),
          condition: item.condition,
          restock: item.restock,
        })),
        replacement_items: replacementItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity.toFixed(4),
          unit_id: item.unit_id,
          unit_price: item.unit_price.toFixed(4),
        })),
      };

      const res = await api.post<{ data: { id: number; exchange_number: string } }>('/sales/exchanges', payload);
      const createdExchange = res.data?.data ?? (res.data as unknown as { id: number; exchange_number: string });

      if (autoApprove && createdExchange.id) {
        try {
          await api.post(`/sales/exchanges/${createdExchange.id}/approve`);
          notify.success('Exchange Processed & Approved', {
            description: `Exchange #${createdExchange.exchange_number} completed. Inventory restocked and released.`,
          });
        } catch {
          notify.info('Exchange Created as Draft', {
            description: `Exchange #${createdExchange.exchange_number} saved. Approval pending in Sales workspace.`,
          });
        }
      } else {
        notify.success('Exchange Created', {
          description: `Draft Exchange #${createdExchange.exchange_number} recorded.`,
        });
      }

      setCompletedExchangeNumber(createdExchange.exchange_number);
      queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
      if (onExchangeCompleted) {
        onExchangeCompleted(createdExchange.exchange_number);
      }
    } catch (err: unknown) {
      console.error('POS Exchange Failed', err);
      const apiErr = err as { message?: string; response?: { data?: { message?: string } } };
      notify.error('Exchange failed', {
        description: apiErr.response?.data?.message || apiErr.message || 'Unable to submit exchange record.',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-default bg-surface shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default px-6 py-4 bg-surface-sunken">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-default">POS Counter Exchange</h2>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                  Live Register
                </span>
              </div>
              <p className="text-xs text-muted">
                Terminal: <span className="font-semibold text-default">{session.terminal_name ?? 'POS Station'}</span> •
                Session: <span className="font-mono text-default">{session.session_number}</span>
                {session.warehouse_name && ` • Stock: ${session.warehouse_name}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        {completedExchangeNumber ? (
          /* Completion State */
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-default">Exchange Successfully Processed</h3>
              <p className="text-sm font-mono text-primary font-semibold mt-1">#{completedExchangeNumber}</p>
              <p className="text-xs text-muted max-w-md mx-auto mt-2">
                The product swap has been registered under active POS session{' '}
                <span className="font-semibold text-default">{session.session_number}</span>. Stock balances have been
                automatically updated.
              </p>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-4 max-w-sm w-full text-xs font-mono space-y-2">
              <div className="flex justify-between text-muted">
                <span>Returned Total:</span>
                <span className="text-default font-semibold">{formatCurrency(returnSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Replacement Total:</span>
                <span className="text-default font-semibold">{formatCurrency(replacementSubtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-default/60 pt-2 font-bold">
                <span>Net Settlement:</span>
                <span
                  className={
                    settlementType === 'top_up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : settlementType === 'refund'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-default'
                  }
                >
                  {settlementType === 'top_up' && `+${formatCurrency(differenceAmount)} (Collected)`}
                  {settlementType === 'refund' && `-${formatCurrency(Math.abs(differenceAmount))} (Refunded)`}
                  {settlementType === 'none' && 'Even Swap'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
              >
                Back to Register
              </button>
            </div>
          </div>
        ) : (
          /* Exchange Form */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Top Config Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border border-default bg-surface-sunken text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">Original Invoice (Lookup)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. POS-INV-20260908-..."
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupInvoice();
                      }
                    }}
                    className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-default text-xs font-mono focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLookupInvoice}
                    disabled={searchingInvoice || !invoiceRef.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                    title="Load items from this invoice"
                  >
                    {searchingInvoice ? '...' : 'Load'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Exchange Reason</label>
                <select
                  value={reasonCodeId}
                  onChange={(e) => setReasonCodeId(Number(e.target.value))}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none cursor-pointer"
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Counter Cashier Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Swapped for larger size, packaged sealed"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Dual Panel Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* LEFT: Items Returned by Customer */}
              <div className="rounded-xl border border-rose-500/20 bg-surface p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-default pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 font-bold text-xs">
                      1
                    </span>
                    <h3 className="font-bold text-sm text-default">Customer Return Items</h3>
                    <span className="text-[10px] bg-rose-500/10 text-rose-600 font-bold px-1.5 py-0.5 rounded">
                      Inbound
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-default">
                    Subtotal: {formatCurrency(returnSubtotal)}
                  </span>
                </div>

                {/* Return Item Search Combobox */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      placeholder="Search return product by name or SKU..."
                      value={returnSearch}
                      onChange={(e) => setReturnSearch(e.target.value)}
                      className="w-full rounded-lg border border-default bg-surface-sunken pl-8 pr-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>

                  {filteredReturnProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-default bg-surface shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {filteredReturnProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddReturnProduct(p)}
                          className="w-full px-3 py-2 text-left hover:bg-surface-sunken flex items-center justify-between text-xs cursor-pointer border-b border-default/40 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-default">{p.name}</p>
                            <p className="text-[10px] font-mono text-muted">{p.sku}</p>
                          </div>
                          <span className="font-mono font-bold text-default">
                            {formatCurrency(parseFloat(p.default_sale_price || '100'))}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Return Items List */}
                <div className="space-y-2 flex-1 min-h-35 max-h-60 overflow-y-auto pr-1">
                  {returnItems.length === 0 ? (
                    <div className="py-8 text-center text-muted flex flex-col items-center justify-center">
                      <Package className="h-7 w-7 text-muted/50 mb-1" />
                      <p className="text-xs">No return items added yet</p>
                      <p className="text-[10px] text-muted">Search product above to add customer's returned item.</p>
                    </div>
                  ) : (
                    returnItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-default bg-surface-sunken space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-default truncate">{item.product_name}</p>
                            <p className="text-[10px] font-mono text-muted">{item.sku}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReturnItems((prev) => prev.filter((p) => p.id !== item.id))}
                            className="text-muted hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-center pt-1 border-t border-default/40">
                          <div>
                            <label className="block text-[10px] text-muted font-semibold">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setReturnItems((prev) =>
                                  prev.map((p) => (p.id === item.id ? { ...p, quantity: val } : p))
                                );
                              }}
                              className="w-full rounded-md border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted font-semibold">Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setReturnItems((prev) =>
                                  prev.map((p) => (p.id === item.id ? { ...p, unit_price: val } : p))
                                );
                              }}
                              className="w-full rounded-md border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted font-semibold">Condition</label>
                            <select
                              value={item.condition}
                              onChange={(e) => {
                                const cond = e.target.value as 'good' | 'defective' | 'damaged';
                                setReturnItems((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id ? { ...p, condition: cond, restock: cond === 'good' } : p
                                  )
                                );
                              }}
                              className="w-full rounded-md border border-default bg-surface px-1.5 py-1 text-[11px] text-default"
                            >
                              <option value="good">Good (Restock)</option>
                              <option value="defective">Defective</option>
                              <option value="damaged">Damaged</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 text-muted">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.restock}
                              onChange={(e) =>
                                setReturnItems((prev) =>
                                  prev.map((p) => (p.id === item.id ? { ...p, restock: e.target.checked } : p))
                                )
                              }
                              className="rounded border-default text-primary focus:ring-0"
                            />
                            <span>Restock to inventory</span>
                          </label>
                          <span className="font-mono font-bold text-default">
                            Total: {formatCurrency(item.quantity * item.unit_price)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT: Items Taken as Replacement */}
              <div className="rounded-xl border border-emerald-500/20 bg-surface p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-default pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                      2
                    </span>
                    <h3 className="font-bold text-sm text-default">New Replacement Items</h3>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-1.5 py-0.5 rounded">
                      Outbound
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-default">
                    Subtotal: {formatCurrency(replacementSubtotal)}
                  </span>
                </div>

                {/* Replacement Item Search Combobox */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      placeholder="Search replacement product from catalog..."
                      value={replacementSearch}
                      onChange={(e) => setReplacementSearch(e.target.value)}
                      className="w-full rounded-lg border border-default bg-surface-sunken pl-8 pr-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>

                  {filteredReplacementProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-default bg-surface shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {filteredReplacementProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddReplacementProduct(p)}
                          className="w-full px-3 py-2 text-left hover:bg-surface-sunken flex items-center justify-between text-xs cursor-pointer border-b border-default/40 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-default">{p.name}</p>
                            <p className="text-[10px] font-mono text-muted">{p.sku}</p>
                          </div>
                          <span className="font-mono font-bold text-default">
                            {formatCurrency(parseFloat(p.default_sale_price || '100'))}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Replacement Items List */}
                <div className="space-y-2 flex-1 min-h-35 max-h-60 overflow-y-auto pr-1">
                  {replacementItems.length === 0 ? (
                    <div className="py-8 text-center text-muted flex flex-col items-center justify-center">
                      <Layers className="h-7 w-7 text-muted/50 mb-1" />
                      <p className="text-xs">No replacement items selected</p>
                      <p className="text-[10px] text-muted">
                        Search catalog above to select new items for the customer.
                      </p>
                    </div>
                  ) : (
                    replacementItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-default bg-surface-sunken space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-default truncate">{item.product_name}</p>
                            <p className="text-[10px] font-mono text-muted">{item.sku}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplacementItems((prev) => prev.filter((p) => p.id !== item.id))}
                            className="text-muted hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 items-center pt-1 border-t border-default/40">
                          <div>
                            <label className="block text-[10px] text-muted font-semibold">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setReplacementItems((prev) =>
                                  prev.map((p) => (p.id === item.id ? { ...p, quantity: val } : p))
                                );
                              }}
                              className="w-full rounded-md border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted font-semibold">Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setReplacementItems((prev) =>
                                  prev.map((p) => (p.id === item.id ? { ...p, unit_price: val } : p))
                                );
                              }}
                              className="w-full rounded-md border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end text-[11px] pt-1 text-muted">
                          <span className="font-mono font-bold text-default">
                            Total: {formatCurrency(item.quantity * item.unit_price)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Difference & Settlement Breakdown */}
            <div className="rounded-xl border border-default bg-surface-sunken p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono w-full md:w-auto">
                <div>
                  <span className="text-muted block text-[11px]">Return Subtotal</span>
                  <span className="text-default font-bold text-sm">{formatCurrency(returnSubtotal)}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Replacement Subtotal</span>
                  <span className="text-default font-bold text-sm">{formatCurrency(replacementSubtotal)}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Net Difference</span>
                  <span
                    className={`font-bold text-sm ${
                      settlementType === 'top_up'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : settlementType === 'refund'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-default'
                    }`}
                  >
                    {differenceAmount >= 0 ? '+' : ''}
                    {formatCurrency(differenceAmount)}
                  </span>
                </div>
              </div>

              <div className="w-full md:w-auto shrink-0">
                {settlementType === 'top_up' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <DollarSign className="h-4 w-4" />
                    <span>Customer Pays Top-Up: {formatCurrency(differenceAmount)}</span>
                  </div>
                )}
                {settlementType === 'refund' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    <AlertCircle className="h-4 w-4" />
                    <span>Refund to Customer: {formatCurrency(Math.abs(differenceAmount))}</span>
                  </div>
                )}
                {settlementType === 'none' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Even Swap (No payment required)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!completedExchangeNumber && (
          <div className="border-t border-default px-6 py-4 bg-surface-sunken flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-default border border-default rounded-xl hover:bg-surface transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={processing || returnItems.length === 0 || replacementItems.length === 0}
                onClick={() => handleProcessExchange(false)}
                className="px-4 py-2 text-xs font-semibold text-default border border-default rounded-xl hover:bg-surface transition-colors cursor-pointer disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={processing || returnItems.length === 0 || replacementItems.length === 0}
                onClick={() => handleProcessExchange(true)}
                className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {processing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Approve & Complete Exchange
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
