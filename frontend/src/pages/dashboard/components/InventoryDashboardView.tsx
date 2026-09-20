import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Warehouse,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Eye,
  ArrowRight,
  ArrowRightLeft,
  ClipboardList,
  SlidersHorizontal,
} from 'lucide-react';
import type { OrderPOItem } from './DashboardModals';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import type { DashboardMetricsData } from '../../../types/api/dashboard';

interface InventoryDashboardViewProps {
  attentionItems: OrderPOItem[];
  onOpenOrderPO: (item: OrderPOItem) => void;
  onOpenReviewStock: (item: OrderPOItem) => void;
}

interface StockMovementItem {
  id: number | string;
  type: string;
  reference_type?: string;
  reference_number?: string;
  quantity: number;
  product?: { name: string; sku?: string };
  warehouse?: { name: string };
  created_at: string;
}

interface StockCountSummary {
  id: number | string;
  count_number: string;
  warehouse?: { name: string };
  type: string;
  status: string;
  created_at: string;
}

interface StockAdjustmentSummary {
  id: number | string;
  adjustment_number: string;
  warehouse?: { name: string };
  type: string;
  status: string;
  total_value_impact?: number;
  created_at: string;
}

export const InventoryDashboardView: React.FC<InventoryDashboardViewProps> = ({
  attentionItems,
  onOpenOrderPO,
  onOpenReviewStock,
}) => {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<'replenish' | 'movements' | 'counts' | 'adjustments'>(
    'replenish'
  );

  const { data: metrics } = useQuery<DashboardMetricsData | null>({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>(
          '/dashboard/metrics'
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('inventory' in raw) return raw as DashboardMetricsData;
          if (
            'data' in raw &&
            raw.data &&
            typeof raw.data === 'object' &&
            'inventory' in raw.data
          ) {
            return raw.data as DashboardMetricsData;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
  });

  // Fetch live stock movements
  const { data: stockMovements = [] } = useQuery<StockMovementItem[]>({
    queryKey: ['inventory', 'movements', 'dashboard'],
    queryFn: async () => {
      try {
        const res = await api.get<StockMovementItem[] | { data: StockMovementItem[] }>('/inventory/movements', {
          params: { per_page: 8 },
        });
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      } catch {
        return [];
      }
    },
  });

  // Fetch live stock counts / audits
  const { data: stockCounts = [] } = useQuery<StockCountSummary[]>({
    queryKey: ['inventory', 'counts', 'dashboard'],
    queryFn: async () => {
      try {
        const res = await api.get<StockCountSummary[] | { data: StockCountSummary[] }>('/inventory/counts', {
          params: { per_page: 5 },
        });
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      } catch {
        return [];
      }
    },
  });

  // Fetch live stock adjustments
  const { data: stockAdjustments = [] } = useQuery<StockAdjustmentSummary[]>({
    queryKey: ['inventory', 'adjustments', 'dashboard'],
    queryFn: async () => {
      try {
        const res = await api.get<StockAdjustmentSummary[] | { data: StockAdjustmentSummary[] }>('/inventory/adjustments', {
          params: { per_page: 5 },
        });
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      } catch {
        return [];
      }
    },
  });

  const pendingCountsCount = metrics?.inventory?.pending_counts ?? stockCounts.length;
  const pendingAdjustmentsCount = metrics?.inventory?.pending_adjustments ?? stockAdjustments.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & INVENTORY GREETING
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-default font-sans">
              Warehouse & Stock Inventory
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Real-time Ledger Connected
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Raw materials intake, warehouse storage, replenishment orders & cycle counts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/inventory?action=transfer"
            className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all shadow-2xs"
          >
            <ArrowRightLeft className="size-3.5 text-muted" />
            <span>Stock Transfer</span>
          </Link>
          <Link
            to="/purchasing?action=new"
            className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-amber-600 to-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-amber-500 hover:to-orange-500 transition-all"
          >
            <ShoppingCart className="size-3.5" />
            <span>Create PO</span>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CORE INVENTORY KPI CARDS (RESPONSIVE GRID 2/3/6)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Total SKUs */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              TOTAL SKUS
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Boxes className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {metrics?.inventory?.total_valuation ? 'Live Catalog' : '0 SKUs'}
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              Active Facility
            </span>
          </div>
        </div>

        {/* KPI 2: Stock Valuation */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              STOCK VALUATION
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Warehouse className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {formatCurrency(metrics?.inventory?.total_valuation ?? 0)}
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
              Live Stock Asset Value
            </span>
          </div>
        </div>

        {/* KPI 2: Out of Stock */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              OUT OF STOCK
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-red-500 truncate">
              {metrics?.inventory?.low_stock_count ?? 0} Items
            </div>
            <span className="text-[10px] font-semibold text-red-500 block truncate">
              Zero Stock Items
            </span>
          </div>
        </div>

        {/* KPI 3: Reorder Alerts */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              REORDER ALERTS
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Boxes className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-500 truncate">
              {attentionItems.length} SKUs
            </div>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block truncate">
              Below Safety Limit
            </span>
          </div>
        </div>

        {/* KPI 4: Pending Cycle Counts */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              CYCLE COUNTS
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
              <ClipboardList className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {pendingCountsCount} Audits
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              Warehouse Verification
            </span>
          </div>
        </div>

        {/* KPI 5: Pending Adjustments */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              ADJUSTMENTS
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <SlidersHorizontal className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {pendingAdjustmentsCount} Pending
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              Variance Approvals
            </span>
          </div>
        </div>

        {/* KPI 6: Inbound Transfers */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              TRANSFERS
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <ArrowRightLeft className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              Active Hubs
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              Multi-facility Sync
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. WORKSTATION TABS: REPLENISHMENT / MOVEMENTS / AUDITS
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-default">Inventory Management Operations</h3>
            <p className="text-[11px] text-muted">
              Live replenishment triggers, material movement ledger, and warehouse count sessions
            </p>
          </div>

          {/* Responsive Tab Bar */}
          <div className="flex items-center gap-1 rounded-xl bg-surface-sunken p-1 border border-default self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('replenish')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'replenish'
                  ? 'bg-surface text-default shadow-xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              Reorder Queue ({attentionItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'movements'
                  ? 'bg-surface text-default shadow-xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              Movement Ledger ({stockMovements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('counts')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'counts'
                  ? 'bg-surface text-default shadow-xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              Cycle Counts ({stockCounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('adjustments')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'adjustments'
                  ? 'bg-surface text-default shadow-xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              Adjustments ({stockAdjustments.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Replenishment Queue */}
        {activeTab === 'replenish' && (
          <div className="divide-y divide-default">
            {attentionItems.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                All inventory stock levels are within optimal thresholds. No immediate reorders needed.
              </div>
            ) : (
              attentionItems.map((item) => {
                const isOutOfStock = item.currentStock <= 0;
                return (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-default">{item.name}</span>
                        <span className="text-[10px] text-muted font-mono">({item.sku})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                        <span>
                          Warehouse: <strong className="text-default">{item.warehouse}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Stock:{' '}
                          <strong className={isOutOfStock ? 'text-red-500' : 'text-amber-500'}>
                            {item.currentStock} {item.unit}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>Min Threshold: {item.minThreshold}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => onOpenReviewStock(item)}
                        className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer shadow-2xs"
                      >
                        <Eye className="size-3 text-muted" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenOrderPO(item)}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        <ShoppingCart className="size-3" />
                        <span>Order PO</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Stock Movements Ledger */}
        {activeTab === 'movements' && (
          <div className="divide-y divide-default">
            {stockMovements.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                No recent stock movements or material transfers recorded.
              </div>
            ) : (
              stockMovements.map((move) => (
                <div
                  key={move.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-surface px-1.5 py-0.5 text-[9px] font-mono font-bold text-primary border border-default uppercase">
                        {move.type}
                      </span>
                      <span className="text-xs font-bold text-default">
                        {move.product?.name ?? 'Inventory Item'}
                      </span>
                      {move.product?.sku && (
                        <span className="text-[10px] text-muted font-mono">({move.product.sku})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted font-mono flex-wrap">
                      <span>Warehouse: {move.warehouse?.name ?? 'Facility'}</span>
                      {move.reference_number && (
                        <>
                          <span>•</span>
                          <span>Ref: {move.reference_number}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(move.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="shrink-0 self-start sm:self-auto font-mono text-xs font-bold">
                    <span className={move.quantity < 0 ? 'text-red-500' : 'text-emerald-500'}>
                      {move.quantity > 0 ? `+${move.quantity}` : move.quantity} pcs
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Cycle Counts */}
        {activeTab === 'counts' && (
          <div className="divide-y divide-default">
            {stockCounts.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                No active cycle counts or stock audit sessions.
              </div>
            ) : (
              stockCounts.map((count) => (
                <div
                  key={count.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-default">{count.count_number}</span>
                      <span className="text-xs text-muted truncate">
                        {count.warehouse?.name ?? 'Assigned Warehouse'}
                      </span>
                      <span className="rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {count.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted font-mono">
                      Type: <strong>{count.type}</strong> • Date: {new Date(count.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Link
                    to="/inventory?tab=counts"
                    className="shrink-0 self-start sm:self-auto rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:bg-surface-sunken transition-all"
                  >
                    Manage Audit
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Adjustments */}
        {activeTab === 'adjustments' && (
          <div className="divide-y divide-default">
            {stockAdjustments.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                No stock adjustments or discrepancy reviews pending.
              </div>
            ) : (
              stockAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-default">{adj.adjustment_number}</span>
                      <span className="text-xs text-muted truncate">
                        {adj.warehouse?.name ?? 'Facility'}
                      </span>
                      <span className="rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {adj.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted font-mono">
                      Type: <strong>{adj.type}</strong> • Date: {new Date(adj.created_at).toLocaleDateString()}
                      {adj.total_value_impact !== undefined && (
                        <span className="ml-2 text-primary font-bold">
                          Impact: {formatCurrency(adj.total_value_impact)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/inventory?tab=adjustments"
                    className="shrink-0 self-start sm:self-auto rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:bg-surface-sunken transition-all"
                  >
                    Review
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-default flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-muted">Centralized Multi-Warehouse Ledger</span>
          <Link
            to="/inventory"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Open Complete Inventory Workspace</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
