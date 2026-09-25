import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderItem } from '../../../types/api/purchasing';
import type { Product } from '../../../types/api/catalog';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { useCurrency } from '../../../hooks/useCurrency';
import { notify } from '../../../components/ui/Toast';

interface FastPoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newOrder: PurchaseOrder) => void;
  initialSupplierName?: string;
  initialItems?: Array<{ name: string; sku: string; quantity: number; unitPrice: number }>;
}

const SAMPLE_SUPPLIERS = [
  { id: 1, name: 'Bengal Glass & Ceramic Ltd.', defaultWarehouse: 'Tejgaon Central Electronic Components & Parts Warehouse' },
  { id: 2, name: 'Aarong Fabric Mills Ltd.', defaultWarehouse: 'Tejgaon Central Raw Materials Warehouse' },
  { id: 3, name: 'Dhaka Packaging Solutions Ltd.', defaultWarehouse: 'Tejgaon Finished Goods Dispatch Center' },
  { id: 4, name: 'Sonargaon Steel & Wire Industries', defaultWarehouse: 'Tejgaon Central Raw Materials Warehouse' },
];

const SAMPLE_WAREHOUSES = [
  { id: 1, name: 'Tejgaon Central Raw Materials Warehouse' },
  { id: 2, name: 'Tejgaon Finished Goods Dispatch Center' },
  { id: 3, name: 'Gulshan Retail Floor Stock' },
];

function generatePoNumber(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PO-${ym}-${rand}`;
}

export const FastPoModal: React.FC<FastPoModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialSupplierName = '',
  initialItems = [],
}) => {
  const { formatCurrency } = useCurrency();

  const [supplierName, setSupplierName] = useState(initialSupplierName || SAMPLE_SUPPLIERS[0]?.name || '');
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  const { data: purchasableProducts = [] } = useQuery<Product[]>({
    queryKey: ['catalogue', 'products', 'purchasable'],
    queryFn: async () => {
      try {
        const res = await api.get<Product[]>('/products?per_page=100');
        return extractList<Product>(res).filter((p) => p.is_purchased !== false);
      } catch {
        return [];
      }
    },
  });

  const [items, setItems] = useState<Array<{ product_id?: number | string; name: string; sku: string; qty: string; price: string; unit: string }>>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        name: item.name,
        sku: item.sku,
        qty: String(item.quantity),
        price: String(item.unitPrice),
        unit: 'PCS',
      }));
    }
    return [{ product_id: 1, name: 'Microcrystalline Ceramic Glass Panel', sku: 'RAW-CERAMIC-PANEL', qty: '100', price: '450', unit: 'PCS' }];
  });

  const addItemRow = () => {
    setItems((prev) => [...prev, { name: '', sku: `ITEM-${String(prev.length + 1).padStart(3, '0')}`, qty: '10', price: '100', unit: 'PCS' }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, patch: Partial<{ product_id?: number | string; name: string; sku: string; qty: string; price: string; unit: string }>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index]!, ...patch };
      return copy;
    });
  };

  const subtotal = items.reduce((acc, item) => {
    const q = parseFloat(item.qty) || 0;
    const p = parseFloat(item.price) || 0;
    return acc + q * p;
  }, 0);

  const estimatedTax = subtotal * 0.05;
  const grandTotal = subtotal + estimatedTax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      notify.warning('Validation Error', { description: 'Please specify a supplier for this purchase order.' });
      return;
    }

    const poNumber = generatePoNumber();
    const selectedWh = SAMPLE_WAREHOUSES.find((w) => w.id === warehouseId) ?? SAMPLE_WAREHOUSES[0]!;
    const baseId = new Date().getTime();

    const poItems: PurchaseOrderItem[] = items.map((item, idx) => {
      const q = parseFloat(item.qty) || 1;
      const p = parseFloat(item.price) || 0;
      const tot = q * p;
      return {
        id: baseId + idx,
        uuid: `poi-${baseId}-${idx}`,
        purchase_order_id: baseId,
        product_id: item.product_id ? Number(item.product_id) : (100 + idx),
        product_name: item.name || 'Purchased Item',
        product_sku: item.sku || `ITEM-${idx + 1}`,
        quantity: q.toFixed(2),
        received_quantity: '0.00',
        billed_quantity: '0.00',
        unit_id: 1,
        unit_code: item.unit || 'PCS',
        unit_price: p.toFixed(2),
        discount_amount: '0.00',
        tax_rate: '5.00',
        tax_amount: (tot * 0.05).toFixed(2),
        subtotal_amount: tot.toFixed(2),
        total_amount: (tot * 1.05).toFixed(2),
      };
    });

    const newPo: PurchaseOrder = {
      id: baseId,
      uuid: `po-${baseId}`,
      po_number: poNumber,
      party_id: 1,
      supplier_name: supplierName,
      warehouse_id: selectedWh.id,
      warehouse_name: selectedWh.name,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery_date: expectedDate,
      currency_code: 'BDT',
      exchange_rate: '1.0000',
      subtotal_amount: subtotal.toFixed(2),
      discount_amount: '0.00',
      tax_amount: estimatedTax.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      received_value: '0.00',
      billed_value: '0.00',
      status: 'approved',
      notes: notes || 'Standard procurement contract.',
      items: poItems,
      created_at: new Date().toISOString(),
    };

    onSuccess(newPo);
    notify.success('Purchase Order Approved', {
      description: `${poNumber} created for ${supplierName} (${formatCurrency(grandTotal)}). Ready for inward goods delivery.`,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-default rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Order Materials (New Purchase Order)</h3>
              <p className="text-xs text-muted">
                Official contract with agreed pricing. Once approved, receive delivery at warehouse in 1 click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-default p-1 rounded-lg transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Supplier / Vendor <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                list="suppliers-list"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Bengal Glass, Aarong Mills"
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              />
              <datalist id="suppliers-list">
                {SAMPLE_SUPPLIERS.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Receiving Warehouse <span className="text-primary">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              >
                {SAMPLE_WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Terms or Delivery Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Net 30 payment upon quality check approval"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Items to Order ({items.length})
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2.5 rounded-xl bg-surface-sunken border border-default items-center text-xs"
                >
                  <div className="col-span-5 space-y-1">
                    {purchasableProducts.length > 0 && (
                      <select
                        value={
                          purchasableProducts.find(
                            (p) =>
                              (item.product_id && (p.product_id === Number(item.product_id) || p.id === String(item.product_id))) ||
                              p.sku === item.sku
                          )?.sku || ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const prod = purchasableProducts.find((p) => p.sku === val);
                          if (prod) {
                            const unitCode = prod.base_unit?.code || prod.unit?.code || 'PCS';
                            updateItem(idx, {
                              product_id: prod.product_id || prod.id,
                              name: prod.name,
                              sku: prod.sku,
                              unit: unitCode,
                              price: parseFloat(prod.standard_cost || '0') > 0 ? String(parseFloat(prod.standard_cost)) : item.price,
                            });
                          }
                        }}
                        className="w-full px-2 py-1 border border-default rounded-lg bg-surface text-default text-[11px] focus:border-primary focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Item ({purchasableProducts.length}) --</option>
                        <optgroup label="Finished Goods">
                          {purchasableProducts
                            .filter((p) => p.type === 'finished')
                            .map((p) => (
                              <option key={p.id} value={p.sku}>
                                [FG] {p.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Raw Materials & Components">
                          {purchasableProducts
                            .filter((p) => p.type !== 'finished')
                            .map((p) => (
                              <option key={p.id} value={p.sku}>
                                [{p.type?.replace('_', ' ') || 'RM'}] {p.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    )}
                    <input
                      type="text"
                      placeholder="Item name / Material description"
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      required
                      className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default focus:border-primary focus:outline-none text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Qty"
                        step="1"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, { qty: e.target.value })}
                        required
                        className="w-full px-2 py-1.5 border border-default rounded-lg bg-surface text-default text-right font-mono focus:border-primary focus:outline-none text-xs"
                      />
                      <span className="text-[10px] text-muted font-bold">{item.unit}</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="Unit Price"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(idx, { price: e.target.value })}
                      required
                      className="w-full px-2 py-1.5 border border-default rounded-lg bg-surface text-default text-right font-mono focus:border-primary focus:outline-none text-xs"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      className="text-muted hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="size-3.5 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-3.5 rounded-xl bg-surface-sunken border border-default flex items-center justify-between text-xs">
            <span className="text-muted">
              Subtotal: <span className="font-mono font-semibold text-default">{formatCurrency(subtotal)}</span> + 5% VAT:{' '}
              <span className="font-mono text-muted">{formatCurrency(estimatedTax)}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-default">Total Commitment:</span>
              <span className="text-sm font-bold font-mono text-primary">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-default text-muted hover:text-default transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-fg shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <ShoppingCart className="size-3.5" />
              <span>Approve & Place Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
