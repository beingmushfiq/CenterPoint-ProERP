import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { notify } from '../../../components/ui/Toast';

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProductName?: string;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialProductName = '',
}) => {
  const { data: warehouses = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['catalogue', 'warehouses'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/warehouses');
        return extractList<{ id: number; name: string }>(res);
      } catch {
        return [];
      }
    },
  });

  const { data: products = [] } = useQuery<Array<{ id: number; name: string; sku: string; unit?: string; available?: number }>>({
    queryKey: ['catalogue', 'products'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/products?per_page=100');
        return extractList<{ id: number; name: string; sku: string; unit?: string }>(res);
      } catch {
        return [];
      }
    },
  });

  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [productName, setProductName] = useState(initialProductName || '');
  const [adjustmentType, setAdjustmentType] = useState<'damaged' | 'lost' | 'found' | 'expired'>('damaged');
  const [quantity, setQuantity] = useState('5');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const selectedProduct = products.find((p) => p.name === productName) || products[0];
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      notify.warning('Validation Error', { description: 'Please enter a valid quantity.' });
      return;
    }

    const adjNumber = `ADJ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const actionText = adjustmentType === 'found' ? 'Stock Added' : 'Stock Written Off';

    notify.success(actionText, {
      description: `${adjNumber}: Adjusted ${numQty} ${(selectedProduct?.unit || 'PCS')} of "${productName}" (${adjustmentType}) at ${(selectedWarehouse?.name || 'Warehouse')}.`,
    });

    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-default rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Report Damaged or Lost Items</h3>
              <p className="text-xs text-muted">
                Record shrinkage, breakage, expired items, or physical count adjustments.
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
                Warehouse Location <span className="text-rose-500">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-rose-500 focus:outline-none"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Reason / Adjustment Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as 'damaged' | 'lost' | 'found' | 'expired')}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-rose-500 focus:outline-none font-medium"
              >
                <option value="damaged">💥 Damaged / Broken during Handling</option>
                <option value="lost">🔍 Missing / Theft / Shrinkage</option>
                <option value="expired">⌛ Expired / Deteriorated Material</option>
                <option value="found">📦 Found Extra / Cycle Count Gain</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Product Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-rose-500 focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} {p.unit ? `(${p.unit})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Quantity to Adjust ({(selectedProduct?.unit || 'PCS')}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono font-bold focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">Incident Details / Note</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Glass cracked during shelf restocking on 3rd floor"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-muted flex items-center gap-2">
            <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              {adjustmentType === 'found'
                ? `Will increase stock balance by ${quantity} ${(selectedProduct?.unit || 'PCS')} in ${(selectedWarehouse?.name || 'Warehouse')}.`
                : `Will deduct ${quantity} ${(selectedProduct?.unit || 'PCS')} from available stock in ${(selectedWarehouse?.name || 'Warehouse')} and record the loss.`}
            </span>
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="size-3.5" />
              <span>Confirm Stock Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
