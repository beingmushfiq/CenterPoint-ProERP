import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  CheckCircle2,
  Trash2,
  Search,
  X,
  Printer,
  Plus,
  Minus,
} from 'lucide-react';
import type { PosSession } from '../../../types/api/pos';
import type { Product } from '../../../types/api/catalog';
import type { Invoice, InvoiceItem } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { notify } from '../../../components/ui/Toast';
import { useCurrency } from '../../../hooks/useCurrency';

export interface PosReturnModalProps {
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
  onReturnCompleted?: (returnNumber: string) => void;
}

export interface ReturnItemState {
  id: string;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  unit_id: number;
  condition: 'good' | 'damaged';
  restock: boolean;
}

const REASON_OPTIONS = [
  { id: 1, label: 'Customer Preference / Changed Mind' },
  { id: 2, label: 'Defective / Faulty Item' },
  { id: 3, label: 'Wrong Item / Size Delivered' },
  { id: 4, label: 'Transit / Packaging Damage' },
  { id: 5, label: 'Product Quality Dissatisfaction' },
];

export function PosReturnModal({
  isOpen,
  onClose,
  session,
  products,
  initialInvoiceId,
  initialInvoiceNumber,
  initialOrderItems,
  onReturnCompleted,
}: PosReturnModalProps) {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [returnSearch, setReturnSearch] = useState('');
  const [reasonCodeId, setReasonCodeId] = useState<number>(1);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_note' | 'bank'>('cash');
  const [globalRestock, setGlobalRestock] = useState(true);
  const [notes, setNotes] = useState('');
  const [invoiceRef, setInvoiceRef] = useState(initialInvoiceNumber || '');
  const [invoiceId, setInvoiceId] = useState<number | null>(initialInvoiceId || null);
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completedReturn, setCompletedReturn] = useState<{
    returnNumber: string;
    creditNoteNumber?: string | null | undefined;
    totalAmount: number;
    refundMethod: string;
    itemCount: number;
  } | null>(null);

  // Return items state initialized from initialOrderItems if provided
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

  // Calculate return subtotal
  const returnSubtotal = useMemo(() => {
    return returnItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  }, [returnItems]);

  const restockItemCount = useMemo(() => {
    return returnItems.filter((it) => it.restock && it.condition === 'good').length;
  }, [returnItems]);

  // Autocomplete products for adding return items
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
          description: `Loaded ${loadedItems.length} item(s) from invoice #${match.invoice_number}.`,
        });
      } else {
        notify.info('Invoice Found', { description: `Invoice #${match.invoice_number} has no item details.` });
      }
    } catch (err) {
      console.error('Failed to lookup invoice', err);
      notify.error('Invoice Search Failed', { description: 'Unable to query sales invoice.' });
    } finally {
      setSearchingInvoice(false);
    }
  };

  const handleUpdateItem = (id: string, patch: Partial<ReturnItemState>) => {
    setReturnItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setReturnItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleProcessReturn = async (autoApprove: boolean) => {
    if (returnItems.length === 0) {
      notify.error('No Return Items', { description: 'Please add at least one product being returned by customer.' });
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        return_date: new Date().toISOString().slice(0, 10),
        warehouse_id: session.warehouse_id || 1,
        reason_code_id: reasonCodeId,
        invoice_id: invoiceId || undefined,
        refund_method: refundMethod,
        restock: globalRestock,
        notes: notes ? `[POS ${session.terminal_name ?? 'Counter'}] ${notes}` : `[POS ${session.terminal_name ?? 'Station'}]`,
        items: returnItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity.toFixed(4),
          unit_id: item.unit_id || 1,
          unit_price: item.unit_price.toFixed(4),
          condition: item.condition,
        })),
      };

      const res = await api.post<{ data: { id: number; return_number: string; credit_note_number?: string; total_amount?: string } }>(
        '/sales/returns',
        payload
      );
      const createdReturn = res.data?.data ?? (res.data as unknown as { id: number; return_number: string; credit_note_number?: string; total_amount?: string });

      if (autoApprove && createdReturn.id) {
        try {
          await api.post(`/sales/returns/${createdReturn.id}/approve`);
          notify.success('Return Approved & Refunded', {
            description: `Return #${createdReturn.return_number} processed. Stock restocked and refund recorded.`,
          });
        } catch {
          notify.info('Return Saved as Draft', {
            description: `Return #${createdReturn.return_number} saved. Approval pending in Sales workspace.`,
          });
        }
      } else {
        notify.success('Return Created', {
          description: `Draft Return #${createdReturn.return_number} recorded.`,
        });
      }

      setCompletedReturn({
        returnNumber: createdReturn.return_number,
        creditNoteNumber: createdReturn.credit_note_number ?? null,
        totalAmount: returnSubtotal,
        refundMethod,
        itemCount: returnItems.length,
      });

      queryClient.invalidateQueries({ queryKey: ['sales', 'returns'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['pos', 'sessions'] });

      if (onReturnCompleted) {
        onReturnCompleted(createdReturn.return_number);
      }
    } catch (err: unknown) {
      console.error('POS Return Failed', err);
      const apiErr = err as { message?: string; response?: { data?: { message?: string } } };
      notify.error('Return Failed', {
        description: apiErr.response?.data?.message || apiErr.message || 'Unable to submit sales return.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReturnReceipt = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-default bg-surface shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default px-6 py-4 bg-surface-sunken">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-default">POS Sales Return & Refund</h2>
                <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold border border-rose-500/20">
                  Refund Counter
                </span>
              </div>
              <p className="text-xs text-muted">
                Terminal: <span className="font-semibold text-default">{session.terminal_name ?? 'POS Counter'}</span> •
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
        {completedReturn ? (
          /* Completion State */
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-default">Return & Refund Processed</h3>
              <p className="text-sm font-mono text-rose-600 dark:text-rose-400 font-semibold mt-1">
                Return Ref: #{completedReturn.returnNumber}
              </p>
              {completedReturn.creditNoteNumber && (
                <p className="text-xs font-mono text-muted mt-0.5">
                  Credit Note: <span className="font-semibold text-default">{completedReturn.creditNoteNumber}</span>
                </p>
              )}
              <p className="text-xs text-muted max-w-md mx-auto mt-2">
                The customer return has been registered under POS session{' '}
                <span className="font-semibold text-default">{session.session_number}</span>. Stock items have been
                restocked to warehouse.
              </p>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-4 max-w-sm w-full text-xs font-mono space-y-2">
              <div className="flex justify-between text-muted">
                <span>Items Returned:</span>
                <span className="text-default font-semibold">{completedReturn.itemCount} item(s)</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Refund Method:</span>
                <span className="text-default font-semibold uppercase">{completedReturn.refundMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-t border-default/60 pt-2 font-bold text-sm">
                <span>Total Refund Paid:</span>
                <span className="text-rose-600 dark:text-rose-400">
                  {formatCurrency(completedReturn.totalAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintReturnReceipt}
                className="px-4 py-2 rounded-xl border border-default bg-surface text-default text-xs font-semibold hover:bg-surface-sunken transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="h-4 w-4 text-muted" />
                Print Return Memo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
              >
                Back to Register
              </button>
            </div>
          </div>
        ) : (
          /* Return Form */
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
                <label className="block font-semibold text-muted mb-1">Return Reason</label>
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
                  placeholder="e.g. Customer return with receipt"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Return Items Panel */}
            <div className="rounded-xl border border-default bg-surface p-4 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-default pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    {returnItems.length}
                  </span>
                  <h3 className="font-bold text-sm text-default">Returned Items</h3>
                  <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded">
                    Refund List
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-default">
                  Subtotal: {formatCurrency(returnSubtotal)}
                </span>
              </div>

              {/* Search to add products */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Scan barcode or search return product by name or SKU..."
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
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-sunken border-b border-default/50 last:border-0 cursor-pointer text-xs"
                      >
                        <div className="truncate mr-2">
                          <p className="font-semibold text-default truncate">{p.name}</p>
                          <p className="text-[10px] text-muted font-mono">{p.sku}</p>
                        </div>
                        <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">
                          {formatCurrency(parseFloat(p.default_sale_price || p.standard_cost || '100'))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List */}
              {returnItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-default p-8 text-center text-muted text-xs">
                  <RotateCcw className="h-8 w-8 mx-auto mb-2 text-muted/40" />
                  <p className="font-medium text-default">No return items added yet</p>
                  <p className="text-[11px] mt-0.5">
                    Load an invoice above or search products by name, SKU or barcode to add items being returned.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {returnItems.map((item) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border border-default bg-surface-sunken p-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-default truncate">{item.product_name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted font-mono mt-0.5">
                            <span>SKU: {item.sku}</span>
                            <span>• Unit: {formatCurrency(item.unit_price)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          {/* Qty Stepper */}
                          <div className="flex items-center rounded-lg border border-default bg-surface">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })
                              }
                              className="px-2 py-1 text-muted hover:text-default cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                              }
                              className="w-10 text-center font-bold text-xs bg-transparent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { quantity: item.quantity + 1 })}
                              className="px-2 py-1 text-muted hover:text-default cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Unit Price */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted">Price:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleUpdateItem(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="w-16 rounded border border-default bg-surface px-1.5 py-0.5 text-right font-mono text-xs focus:border-primary focus:outline-none"
                            />
                          </div>

                          {/* Condition Selector */}
                          <select
                            value={item.condition}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                condition: e.target.value as 'good' | 'damaged',
                                restock: e.target.value === 'good',
                              })
                            }
                            className="rounded border border-default bg-surface px-2 py-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <option value="good">Good (Restock)</option>
                            <option value="damaged">Damaged (Write-off)</option>
                          </select>

                          {/* Line Total */}
                          <div className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 min-w-17.5">
                            {formatCurrency(lineTotal)}
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-muted hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Refund Settlement Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Refund Method */}
              <div className="rounded-xl border border-default bg-surface p-3.5 space-y-2">
                <label className="block text-xs font-bold text-default">Refund Method / Tender</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('cash')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                      refundMethod === 'cash'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                        : 'border-default bg-surface-sunken text-muted hover:text-default'
                    }`}
                  >
                    Cash Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('credit_note')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                      refundMethod === 'credit_note'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                        : 'border-default bg-surface-sunken text-muted hover:text-default'
                    }`}
                  >
                    Credit Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('bank')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                      refundMethod === 'bank'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                        : 'border-default bg-surface-sunken text-muted hover:text-default'
                    }`}
                  >
                    Bank / MFS
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  {refundMethod === 'cash' && 'Cash will be refunded immediately from current till drawer.'}
                  {refundMethod === 'credit_note' && 'A Store Credit Note voucher will be generated for the customer.'}
                  {refundMethod === 'bank' && 'Refund recorded via electronic transfer / card reversal.'}
                </p>
              </div>

              {/* Summary / Inventory Details */}
              <div className="rounded-xl border border-default bg-surface p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span>Return Item Count:</span>
                    <span className="font-semibold text-default">{returnItems.length} items</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span>Inventory Restockable:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {restockItemCount} items (Good condition)
                    </span>
                  </div>
                </div>

                <div className="border-t border-default pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-default">Total Refund Payable:</span>
                  <span className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    {formatCurrency(returnSubtotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!completedReturn && (
          <div className="flex items-center justify-between border-t border-default px-6 py-3.5 bg-surface-sunken">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalRestock}
                  onChange={(e) => setGlobalRestock(e.target.checked)}
                  className="rounded border-default text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Restock Good Items to Warehouse
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="px-4 py-2 rounded-xl border border-default bg-surface text-xs font-semibold text-default hover:bg-surface-sunken cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleProcessReturn(false)}
                disabled={processing || returnItems.length === 0}
                className="px-4 py-2 rounded-xl border border-default bg-surface text-xs font-semibold text-default hover:bg-surface-sunken disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
              >
                Save Draft Return
              </button>

              <button
                type="button"
                onClick={() => handleProcessReturn(true)}
                disabled={processing || returnItems.length === 0}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {processing ? 'Processing...' : `Refund ${formatCurrency(returnSubtotal)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
