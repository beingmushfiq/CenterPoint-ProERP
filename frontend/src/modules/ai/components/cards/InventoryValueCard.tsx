import React from 'react';
import { Package, Boxes, AlertCircle } from 'lucide-react';
import { useCurrency } from '../../../../hooks/useCurrency';
import type { InventoryValuationData } from '../../types/copilot';

interface InventoryValueCardProps {
  data: InventoryValuationData;
}

export const InventoryValueCard: React.FC<InventoryValueCardProps> = ({ data }) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-default/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
            <Boxes className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">Inventory Asset & Working Capital Valuation</h4>
            <p className="text-[11px] text-muted">
              {data.item_count} active inventory SKUs evaluated for collateralization
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-muted">Total Stock Value</div>
          <div className="text-base sm:text-lg font-mono font-extrabold text-primary">
            {formatCurrency(data.total_valuation)}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Total Valued SKUs</div>
          <div className="text-base font-mono font-extrabold text-default mt-0.5">
            {data.item_count} Items
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Slow-Moving Assets</div>
          <div className="text-base font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
            {formatCurrency(data.slow_moving_valuation)}
          </div>
          <div className="text-[10px] text-muted mt-0.5">Idle capital opportunity</div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default/70">
          <div className="text-[10px] uppercase font-semibold text-muted">Est. Monthly Holding Cost</div>
          <div className="text-base font-mono font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(data.estimated_holding_cost_monthly)}
          </div>
          <div className="text-[10px] text-muted mt-0.5">Storage & depreciation</div>
        </div>
      </div>

      {/* High Value Items Table */}
      {data.high_value_items && data.high_value_items.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Package className="size-3.5 text-muted" />
            <span>Top Collateralizable Inventory Assets</span>
          </div>
          <div className="divide-y divide-default/40 rounded-xl border border-default/60 overflow-hidden bg-surface">
            {data.high_value_items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-sunken/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{item.sku}</span>
                    <span className="text-default font-medium">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-muted font-mono">
                    Qty: {item.quantity} @ {formatCurrency(item.unit_cost)}
                  </div>
                </div>
                <div className="font-mono font-bold text-default">
                  {formatCurrency(item.total_value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.slow_moving_valuation > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>
            Inventory Financing Facility can unlock up to 60-70% of slow-moving asset value for immediate operating liquidity.
          </span>
        </div>
      )}
    </div>
  );
};
