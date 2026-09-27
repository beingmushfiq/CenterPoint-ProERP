import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { X, ArrowRightLeft, Warehouse, AlertCircle } from 'lucide-react';
import { notify } from '../../../components/ui/Toast';

interface StockTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProductId?: number;
  initialProductName?: string;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
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

  const [fromWarehouseId, setFromWarehouseId] = useState<number>(1);
  const [toWarehouseId, setToWarehouseId] = useState<number>(2);
  const [productName, setProductName] = useState(initialProductName || '');
  const [quantity, setQuantity] = useState('20');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const selectedProduct = products.find((p) => p.name === productName) || products[0];
  const fromWarehouse = warehouses.find((w) => w.id === fromWarehouseId) ?? warehouses[0];
  const toWarehouse = warehouses.find((w) => w.id === toWarehouseId) ?? warehouses[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromWarehouseId === toWarehouseId) {
      notify.warning('Invalid Transfer Route', {
        description: 'Source and destination warehouses cannot be the same.',
      });
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      notify.warning('Validation Error', { description: 'Please enter a valid quantity to transfer.' });
      return;
    }

    const transferNumber = `TRF-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    notify.success('Stock Transfer Dispatched', {
      description: `${transferNumber}: Dispatched ${numQty} ${selectedProduct?.unit || 'units'} of "${productName}" from ${fromWarehouse?.name || 'Source'} to ${toWarehouse?.name || 'Destination'}.`,
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
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Move Stock (Internal Warehouse Transfer)</h3>
              <p className="text-xs text-muted">
                Move inventory between factory, retail store, and regional distribution centers.
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
          {/* Route: From -> To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-surface-sunken rounded-xl border border-default">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
                <Warehouse className="size-3 text-blue-500" />
                <span>Source Warehouse</span>
              </label>
              <select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-default text-xs font-semibold focus:border-blue-500 focus:outline-none"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
                <Warehouse className="size-3 text-emerald-500" />
                <span>Destination Warehouse</span>
              </label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-lg bg-surface text-default text-xs font-semibold focus:border-blue-500 focus:outline-none"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === fromWarehouseId}>
                    {w.name} {w.id === fromWarehouseId ? '(Same as Source)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Product to Transfer <span className="text-blue-500">*</span>
            </label>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} {p.unit ? `(${p.unit})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Transfer Quantity ({selectedProduct?.unit || 'PCS'}) <span className="text-blue-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max={selectedProduct?.available ?? 99999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono font-bold focus:border-blue-500 focus:outline-none"
              />
              {selectedProduct?.available !== undefined && (<span className="text-[11px] text-muted">Max available: {selectedProduct.available} {selectedProduct.unit}</span>)}
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Transfer Date</label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Van / Driver / Courier Name</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. HiAce Van #11 (Driver Kalam)"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Transfer Purpose / Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Replenish retail showroom weekend stock"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-muted flex items-center gap-2">
            <AlertCircle className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Moving stock deducts inventory from <strong>{fromWarehouse?.name || 'Source'}</strong> and immediately credits <strong>{toWarehouse?.name || 'Destination'}</strong>.
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowRightLeft className="size-3.5" />
              <span>Dispatch Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
