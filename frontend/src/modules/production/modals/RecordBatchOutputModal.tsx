import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { api } from '../../../lib/api/client';
import type { Warehouse } from '../../../types/api/catalog';
import type { ProductionBatch } from '../../../types/api/production';
import { isApiError } from '../../../lib/api/errors';

interface RecordBatchOutputModalProps {
  open: boolean;
  onClose: () => void;
  batch?: ProductionBatch | null;
  onSuccess?: () => void;
}

export function RecordBatchOutputModal({
  open,
  onClose,
  batch,
  onSuccess,
}: RecordBatchOutputModalProps) {
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [goodQty, setGoodQty] = useState<string>('');
  const [rejectedQty, setRejectedQty] = useState<string>('0');
  const [unitCost, setUnitCost] = useState<string>('15.00');
  const [markAsCompleted, setMarkAsCompleted] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batches query if none was pre-selected
  const { data: batchesData } = useQuery({
    queryKey: ['production', 'batches', 'in_progress'],
    queryFn: ({ signal }) =>
      api.get<ProductionBatch[]>('/production/batches', {
        signal,
        params: { status: 'in_progress' },
      }),
    enabled: open && !batch,
  });

  const { data: warehousesData, isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['catalogue', 'warehouses', 'options'],
    queryFn: ({ signal }) => api.get<Warehouse[]>('/warehouses', { signal }),
    enabled: open,
  });

  const inProgressBatches = useMemo(() => batchesData?.data ?? [], [batchesData?.data]);
  const warehouses = useMemo(() => warehousesData?.data ?? [], [warehousesData?.data]);

  const activeBatchId = batch ? String(batch.id) : (selectedBatchId || (inProgressBatches[0] ? String(inProgressBatches[0].id) : ''));
  const currentBatch = batch || inProgressBatches.find((b) => String(b.id) === activeBatchId);
  const plannedQty = currentBatch ? parseFloat(currentBatch.planned_quantity || currentBatch.target_quantity || '100') : 100;
  const effectiveGoodQty = goodQty !== '' ? goodQty : (currentBatch ? String(plannedQty) : '');
  const effectiveWarehouseId = warehouseId || (warehouses[0] ? String(warehouses[0].id) : '');

  const outputMutation = useMutation({
    mutationFn: async () => {
      if (!activeBatchId) throw new Error('Please select an active production batch.');
      if (!effectiveWarehouseId) throw new Error('Please select destination warehouse.');
      if (!effectiveGoodQty || parseFloat(effectiveGoodQty) < 0) {
        throw new Error('Please enter a valid finished quantity.');
      }

      const productId = currentBatch?.product_id || (currentBatch as unknown as { product?: { id?: string; uuid?: string } })?.product?.uuid || (currentBatch as unknown as { product?: { id?: string } })?.product?.id;
      const unitId = currentBatch?.output_unit_id || (currentBatch as unknown as { output_unit?: { id?: string; uuid?: string } })?.output_unit?.uuid || (currentBatch as unknown as { output_unit?: { id?: string } })?.output_unit?.id;

      const payload = {
        product_id: productId ? String(productId) : undefined,
        target_warehouse_id: effectiveWarehouseId,
        output_type: 'primary',
        quantity: effectiveGoodQty,
        unit_id: unitId ? String(unitId) : undefined,
        batch_code: currentBatch?.batch_number,
        qc_required: true,
      };

      await api.post(`/production/batches/${activeBatchId}/outputs`, payload);

      if (markAsCompleted) {
        try {
          await api.post(`/production/batches/${activeBatchId}/complete`);
        } catch {
          // If already completed or not allowed, ignore
        }
      }
    },
    onSuccess: async () => {
      toast.success(`Finished output recorded: ${effectiveGoodQty} units!`, {
        description: 'Inventory updated and routed for Quality Control verification.',
      });
      await queryClient.invalidateQueries({ queryKey: ['production', 'batches'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      if (isApiError(err)) {
        setErrorMsg(err.message || 'Failed to record finished output.');
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An error occurred while saving output.');
      }
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Finished Output & QC Route"
      subtitle="Enter the count of finished goods produced by the factory floor and route them into warehouse storage."
      size="lg"
    >
      <div className="space-y-5">
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Completed Production Count
            </p>
            <p className="text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
              Recording finished output updates live warehouse counts and makes these items immediately eligible for inspection in the Quality Control module.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-danger-subtle border border-danger/20 flex items-center gap-2 text-xs text-danger">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Batch Selector if not prefilled */}
          {!batch ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-default flex items-center gap-1">
                Active Production Batch <span className="text-danger">*</span>
              </label>
              <SelectDropdown
                value={activeBatchId}
                onChange={setSelectedBatchId}
                options={inProgressBatches.map((b) => ({
                  value: String(b.id),
                  label: `${b.batch_number} - ${b.product_name || 'Manufacturing Run'} (${b.status})`,
                }))}
                placeholder="Choose active batch..."
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-surface-sunken border border-default md:col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Active Batch</span>
                <p className="text-sm font-bold text-default">{batch.batch_number}</p>
                <p className="text-xs text-muted">{batch.product_name || 'Product Production'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Target Qty</span>
                <p className="text-sm font-mono font-bold text-primary">{batch.planned_quantity || batch.target_quantity} units</p>
              </div>
            </div>
          )}

          {/* Good Units */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-default flex items-center gap-1">
              Good / Passed Units Produced <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={effectiveGoodQty}
              onChange={(e) => setGoodQty(e.target.value)}
              placeholder="e.g. 98"
              className="w-full h-10 px-3 rounded-xl border border-default bg-surface text-sm font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Damaged / Scrap Units */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-default flex items-center gap-1">
              Scrapped / Defective Units
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={rejectedQty}
              onChange={(e) => setRejectedQty(e.target.value)}
              placeholder="e.g. 2"
              className="w-full h-10 px-3 rounded-xl border border-default bg-surface text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Destination Warehouse */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-default flex items-center gap-1">
              Destination Finished Goods Warehouse <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <SelectDropdown
                value={effectiveWarehouseId}
                onChange={setWarehouseId}
                options={warehouses.map((w) => ({
                  value: String(w.id),
                  label: `${w.name} (${w.code || 'Primary'})`,
                }))}
                placeholder={isLoadingWarehouses ? 'Loading warehouses...' : 'Select warehouse...'}
              />
            </div>
          </div>

          {/* Est Unit Cost */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-default flex items-center gap-1">
              Unit Cost Valuation (BDT)
            </label>
            <input
              type="number"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-default bg-surface text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Mark Completed Checkbox */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-sunken border border-default cursor-pointer">
          <input
            type="checkbox"
            checked={markAsCompleted}
            onChange={(e) => setMarkAsCompleted(e.target.checked)}
            className="size-4 rounded border-default text-primary focus:ring-primary/20"
          />
          <div className="text-xs">
            <span className="font-semibold text-default flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Mark Batch Complete & Make Available for QC Inspection
            </span>
            <span className="text-muted block text-[11px]">
              Closes production run and alerts Quality Control to begin sample inspection.
            </span>
          </div>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-default">
          <Button variant="secondary" onClick={onClose} disabled={outputMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => outputMutation.mutate()}
            disabled={outputMutation.isPending || !goodQty || (!batch && !selectedBatchId)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Sparkles className="size-4" />
            <span>{outputMutation.isPending ? 'Saving Output...' : 'Record Finished Output'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
