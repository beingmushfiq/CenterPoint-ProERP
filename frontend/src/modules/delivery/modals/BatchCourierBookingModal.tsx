import React, { useState } from 'react';
import type { CourierProvider } from '../../../types/api/delivery';
import type { DeliveryOrder } from '../../../types/api/sales';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  X,
  Truck,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface BatchCourierBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingDeliveries: DeliveryOrder[];
  selectedOrderIds: number[];
  providers: CourierProvider[];
  onBatchBook: (
    deliveryOrderIds: number[],
    providerId: number,
    pickupAddress?: string,
    specialInstructions?: string
  ) => Promise<void>;
}

export const BatchCourierBookingModal: React.FC<BatchCourierBookingModalProps> = ({
  isOpen,
  onClose,
  pendingDeliveries,
  selectedOrderIds,
  providers,
  onBatchBook,
}) => {
  const { formatCurrency } = useCurrency();

  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>(() => {
    if (selectedOrderIds && selectedOrderIds.length > 0) return selectedOrderIds;
    return pendingDeliveries.map((d) => d.id);
  });

  const selectedOrders = pendingDeliveries.filter((d) =>
    internalSelectedIds.includes(d.id)
  );

  const activeProviders = providers.filter((p) => p.is_active);
  const [selectedProviderId, setSelectedProviderId] = useState<number>(
    activeProviders[0]?.id || 1
  );
  const [pickupAddress, setPickupAddress] = useState(
    'Central Distribution Hub, Tejgaon Industrial Area, Dhaka'
  );
  const [specialInstructions, setSpecialInstructions] = useState(
    'Standard express dispatch - handle with care'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleOrder = (orderId: number) => {
    setInternalSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    setInternalSelectedIds(pendingDeliveries.map((d) => d.id));
  };

  const handleDeselectAll = () => {
    setInternalSelectedIds([]);
  };

  const currentProvider = activeProviders.find((p) => p.id === selectedProviderId) || activeProviders[0];
  const unitCharge = parseFloat(currentProvider?.default_charge || '60.00');
  const totalCharge = unitCharge * selectedOrders.length;
  const totalCod = selectedOrders.reduce(
    (sum, o) => sum + parseFloat(o.cod_amount || '0'),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrders.length === 0) {
      setError('No orders selected for courier booking.');
      return;
    }
    if (!selectedProviderId) {
      setError('Please select a courier partner.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onBatchBook(
        internalSelectedIds,
        selectedProviderId,
        pickupAddress,
        specialInstructions
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl border border-default bg-surface p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-default pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Truck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">
                Batch Courier Dispatch & Consignment Booking
              </h3>
              <p className="text-xs text-muted">
                Assign 3PL courier provider and generate automated consignment waybills.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Selected Orders Summary Banner */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-surface-sunken/50 border border-default text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted block">Selected Orders</span>
            <span className="text-base font-extrabold text-default font-mono">
              {selectedOrders.length} <span className="text-xs font-normal text-muted">shipments</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted block">Total COD Value</span>
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(totalCod)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted block">Est. Delivery Fee</span>
            <span className="text-base font-extrabold text-default font-mono">
              {formatCurrency(totalCharge)}
            </span>
          </div>
        </div>

        {/* Courier Provider Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-default uppercase tracking-wider block">
            Select 3PL Courier Provider
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeProviders.map((provider) => {
              const isSelected = selectedProviderId === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3',
                    isSelected
                      ? 'border-sky-500 bg-sky-500/5 ring-1 ring-sky-500'
                      : 'border-default bg-surface hover:bg-surface-sunken/40'
                  )}
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs',
                      isSelected
                        ? 'bg-sky-500 text-white'
                        : 'bg-surface-sunken text-muted border border-default'
                    )}
                  >
                    <Building2 className="size-4" />
                  </div>
                  <div className="grow">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-default">{provider.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-sunken border border-default text-muted font-bold">
                        {provider.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted mt-1">
                      <span>Rate: {formatCurrency(provider.default_charge)} / parcel</span>
                      {provider.capabilities?.cod_collection && (
                        <span className="text-emerald-600 font-medium">COD Enabled</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Orders Selection Queue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-default uppercase tracking-wider">
            <span>Orders in Dispatch Queue ({selectedOrders.length} of {pendingDeliveries.length})</span>
            <div className="flex items-center gap-2 font-normal text-[11px] normal-case">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-primary hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-muted">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-muted hover:text-default cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
          <div className="divide-y divide-default rounded-2xl border border-default bg-surface max-h-48 overflow-y-auto">
            {pendingDeliveries.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">
                No pending delivery orders available for dispatch.
              </div>
            ) : (
              pendingDeliveries.map((order) => {
                const isChecked = internalSelectedIds.includes(order.id);
                return (
                  <label
                    key={order.id}
                    className={cn(
                      'p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer select-none',
                      isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-sunken/50 opacity-70'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOrder(order.id)}
                        className="size-4 rounded border-default text-primary focus:ring-primary/20"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{order.delivery_number}</span>
                          <span className="font-medium text-default">{order.recipient_name}</span>
                        </div>
                        <div className="text-[11px] text-muted truncate max-w-xs sm:max-w-md">
                          {order.delivery_address || 'Customer destination'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                        {formatCurrency(order.cod_amount)}
                      </span>
                      <span className="text-[10px] text-muted uppercase font-semibold">COD</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Form Inputs: Pickup Hub & Special Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-muted block mb-1">
              Pickup Warehouse / Hub Address
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-default placeholder-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-muted block mb-1">
              Consignment Handling Note
            </label>
            <input
              type="text"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-default placeholder-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-default">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-default bg-surface text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedOrders.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <Truck className="size-4" />
            <span>
              {isSubmitting
                ? 'Dispatching Consignments...'
                : `Dispatch ${selectedOrders.length} Order${selectedOrders.length > 1 ? 's' : ''} to ${currentProvider?.name || 'Courier'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
