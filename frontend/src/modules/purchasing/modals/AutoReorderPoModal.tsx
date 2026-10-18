import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ShoppingCart,
  AlertTriangle,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { notify } from '../../../components/ui/Toast';
import { useCurrency } from '../../../hooks/useCurrency';
import type { Party } from '../../../types/api/party';
import type { PurchaseOrder } from '../../../types/api/purchasing';

export interface LowStockAlertItem {
  product_id: number;
  product_name: string;
  sku: string;
  category_name?: string;
  unit_id: number;
  unit_code: string;
  unit_cost: number;
  warehouse_id: number;
  warehouse_name: string;
  current_stock: number;
  min_stock_alert: number;
  deficit: number;
  reorder_quantity: number;
  suggested_order_qty: number;
  estimated_order_cost: number;
}

interface AutoReorderPoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newPo: PurchaseOrder) => void;
  initialAlerts?: LowStockAlertItem[];
}

export const AutoReorderPoModal: React.FC<AutoReorderPoModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialAlerts = [],
}) => {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  // Fetch low-stock alert items if none provided
  const { data: fetchedAlerts = [], isLoading: alertsLoading } = useQuery<LowStockAlertItem[]>({
    queryKey: ['inventory', 'thresholds', 'alerts'],
    queryFn: async () => {
      const res = await api.get<{ data: LowStockAlertItem[] }>('/inventory/thresholds/alerts');
      return res.data?.data ?? [];
    },
    enabled: open && initialAlerts.length === 0,
  });

  const alertsPool = initialAlerts.length > 0 ? initialAlerts : fetchedAlerts;

  // Suppliers query
  const { data: suppliers = [] } = useQuery<Party[]>({
    queryKey: ['catalogue', 'parties', 'suppliers-list'],
    queryFn: async () => {
      try {
        const res = await api.get<Party[]>('/parties?is_supplier=true&per_page=100');
        return extractList<Party>(res);
      } catch {
        return [];
      }
    },
    enabled: open,
  });

  // Warehouses query
  const { data: warehouses = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['warehouses', 'options'],
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: number; name: string }>>('/warehouses/options');
        return res.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: open,
  });

  // Selection & custom quantity state: items are selected by default unless user deselects them
  const [deselectedProductIds, setDeselectedProductIds] = useState<Set<number>>(new Set());
  const [customQuantities, setCustomQuantities] = useState<Record<number, number>>({});
  const [userSelectedSupplierId, setUserSelectedSupplierId] = useState<number | null>(null);
  const [userSelectedWarehouseId, setUserSelectedWarehouseId] = useState<number | null>(null);

  const selectedSupplierId = userSelectedSupplierId ?? (suppliers[0]?.id ? Number(suppliers[0].id) : 0);
  const selectedWarehouseId = userSelectedWarehouseId ?? (warehouses[0]?.id ? Number(warehouses[0].id) : (alertsPool[0]?.warehouse_id || 1));

  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [orderNotes, setOrderNotes] = useState('Automated restocking order generated from safety stock threshold deficits.');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const toggleSelect = (productId: number) => {
    setDeselectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (deselectedProductIds.size === 0 && alertsPool.length > 0) {
      setDeselectedProductIds(new Set(alertsPool.map((a) => a.product_id)));
    } else {
      setDeselectedProductIds(new Set());
    }
  };

  const handleQtyChange = (productId: number, val: string) => {
    const num = Math.max(1, parseFloat(val) || 1);
    setCustomQuantities((prev) => ({ ...prev, [productId]: num }));
  };

  const getItemDefaultQty = (item: LowStockAlertItem) => {
    return item.suggested_order_qty || item.reorder_quantity || Math.max(1, item.deficit + 10);
  };

  // Calculate totals
  const selectedItems = alertsPool.filter((a) => !deselectedProductIds.has(a.product_id));
  const totalEstimatedCost = selectedItems.reduce((sum, item) => {
    const qty = customQuantities[item.product_id] ?? getItemDefaultQty(item);
    return sum + qty * item.unit_cost;
  }, 0);

  const handleCreateAutoOrder = async () => {
    if (selectedItems.length === 0) {
      notify.warning('No items selected', {
        description: 'Please select at least one low-stock item to generate the purchase order.',
      });
      return;
    }

    if (!selectedSupplierId) {
      notify.warning('Supplier required', {
        description: 'Please choose a vendor/supplier for this purchase order.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const poPayload = {
        party_id: selectedSupplierId,
        warehouse_id: selectedWarehouseId || 1,
        order_date: new Date().toISOString().slice(0, 10),
        expected_delivery_date: deliveryDate,
        status: 'draft' as const,
        notes: orderNotes,
        currency_code: 'BDT',
        exchange_rate: '1.0000',
        items: selectedItems.map((item) => {
          const qty = customQuantities[item.product_id] ?? getItemDefaultQty(item);
          const subtotal = (qty * item.unit_cost).toFixed(4);
          return {
            product_id: item.product_id,
            quantity: qty.toFixed(4),
            unit_id: item.unit_id || 1,
            unit_price: (item.unit_cost || 10).toFixed(4),
            discount_amount: '0.0000',
            tax_rate: '0.0000',
            tax_amount: '0.0000',
            subtotal_amount: subtotal,
            total_amount: subtotal,
          };
        }),
      };

      const res = await api.post<{ success: boolean; data: PurchaseOrder }>('/purchasing/orders', poPayload);
      const newPo = res.data?.data || (res.data as unknown as PurchaseOrder);

      // Invalidate queries so tables update automatically
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'thresholds', 'alerts'] });

      notify.success('Auto-Reorder PO Draft Created!', {
        description: `Draft Purchase Order #${newPo.po_number || 'PO-DRAFT'} generated with ${selectedItems.length} restock lines.`,
      });

      onSuccess(newPo);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create auto-reorder PO', err);
      notify.error('Order creation failed', {
        description: 'Unable to generate draft purchase order. Please verify vendor and item details.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-default rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-default flex items-center justify-between bg-surface-sunken/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-default">
                  Low-Stock Auto-Reorder & Restock Assistant
                </h2>
                <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {alertsPool.length} Below Threshold
                </span>
              </div>
              <p className="text-xs text-muted">
                Group low-stock safety deficits into an official supplier purchase order with calculated restock quantities.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-hover transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Supplier & Warehouse Settings Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-sunken/50 border border-default text-xs">
            <div>
              <label className="text-muted text-2xs font-semibold mb-1 flex items-center gap-1">
                <Building2 className="size-3 text-primary" /> Preferred Supplier / Vendor:
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setUserSelectedSupplierId(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface text-default text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                {suppliers.length === 0 && <option value="0">Loading suppliers...</option>}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted text-2xs font-semibold mb-1 flex items-center gap-1">
                <WarehouseIcon className="size-3 text-primary" /> Delivery Warehouse:
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setUserSelectedWarehouseId(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface text-default text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                {warehouses.length === 0 ? (
                  <option value="1">Central Warehouse (Default)</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-muted text-2xs font-semibold mb-1 flex items-center gap-1">
                <Calendar className="size-3 text-primary" /> Expected Delivery Date:
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface text-default text-xs font-medium focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Items Suggestion Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {deselectedProductIds.size === 0 && alertsPool.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-2xs text-muted">
                  ({selectedItems.length} of {alertsPool.length} selected for purchase order)
                </span>
              </div>
              <span className="text-2xs text-muted">
                Order quantities default to safety reorder level or deficit
              </span>
            </div>

            <div className="border border-default rounded-xl overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken/60 text-muted uppercase text-2xs font-bold border-b border-default">
                    <tr>
                      <th className="px-3.5 py-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={alertsPool.length > 0 && deselectedProductIds.size === 0}
                          onChange={toggleSelectAll}
                          className="rounded text-primary focus:ring-primary"
                        />
                      </th>
                      <th className="px-3.5 py-2.5">Product & SKU</th>
                      <th className="px-3.5 py-2.5">Warehouse</th>
                      <th className="px-3.5 py-2.5 text-right">Available</th>
                      <th className="px-3.5 py-2.5 text-right">Min Threshold</th>
                      <th className="px-3.5 py-2.5 text-right text-rose-500">Deficit</th>
                      <th className="px-3.5 py-2.5 text-right w-28">Suggested Order</th>
                      <th className="px-3.5 py-2.5 text-right">Unit Cost</th>
                      <th className="px-3.5 py-2.5 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {alertsPool.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted">
                          {alertsLoading
                            ? 'Scanning inventory stock thresholds...'
                            : 'All products are operating well above minimum safety stock thresholds! No reorders needed.'}
                        </td>
                      </tr>
                    ) : (
                      alertsPool.map((item) => {
                        const isSelected = !deselectedProductIds.has(item.product_id);
                        const qty = customQuantities[item.product_id] ?? getItemDefaultQty(item);
                        const lineEst = qty * item.unit_cost;

                        return (
                          <tr
                            key={`${item.product_id}_${item.warehouse_id}`}
                            className={`transition-colors ${
                              isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            <td className="px-3.5 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(item.product_id)}
                                className="rounded text-primary focus:ring-primary"
                              />
                            </td>
                            <td className="px-3.5 py-3">
                              <span className="font-semibold text-default block truncate max-w-xs">
                                {item.product_name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-2xs text-muted font-mono">{item.sku}</span>
                                {item.category_name && (
                                  <span className="text-2xs px-1.5 py-0.2 rounded bg-surface-sunken text-muted">
                                    {item.category_name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-muted text-2xs truncate max-w-30">
                              {item.warehouse_name}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-rose-500">
                              {item.current_stock.toFixed(0)} {item.unit_code}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-muted">
                              {item.min_stock_alert.toFixed(0)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-rose-600">
                              -{item.deficit.toFixed(0)}
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={qty}
                                disabled={!isSelected}
                                onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                                className="w-20 px-2 py-1 rounded-lg border border-default bg-surface text-right font-mono text-xs font-bold text-primary focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-muted">
                              {formatCurrency(item.unit_cost)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-semibold text-default">
                              {formatCurrency(lineEst)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-default block">Purchase Order Terms & Notes:</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-default bg-surface text-xs focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="p-4 rounded-xl border border-default bg-surface-sunken/50 space-y-2 text-xs">
              <span className="font-bold text-default block text-2xs uppercase tracking-wider">
                PO Generation Summary
              </span>
              <div className="flex justify-between items-center py-0.5 border-b border-default/50">
                <span className="text-muted">Selected Lines:</span>
                <span className="font-mono font-semibold text-default">
                  {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-default font-semibold">Total Estimated Value:</span>
                <span className="font-mono font-extrabold text-primary text-sm">
                  {formatCurrency(totalEstimatedCost)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-default bg-surface-sunken/40 flex items-center justify-between">
          <div className="text-xs text-muted flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" />
            <span>PO will be saved as a Draft for procurement review before supplier dispatch.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-default text-xs font-semibold text-muted hover:text-default hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreateAutoOrder}
              disabled={submitting || selectedItems.length === 0}
              className="px-5 py-2 rounded-xl bg-primary text-primary-fg hover:opacity-90 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShoppingCart className="size-4" />
              {submitting ? 'Generating PO Draft...' : `Generate Draft PO (${selectedItems.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
