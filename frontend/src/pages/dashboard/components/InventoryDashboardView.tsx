import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Warehouse,
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Boxes,
  Tag,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  Inbox,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import { cn } from '../../../lib/utils';
import type { DashboardMetricsData } from '../../../types/api/dashboard';
import type { OrderPOItem } from './DashboardModals';

interface InventoryDashboardViewProps {
  attentionItems?: OrderPOItem[];
  onOpenOrderPO?: (item: OrderPOItem) => void;
  onOpenReviewStock?: (item: OrderPOItem) => void;
}

interface MovementItem {
  id: string | number;
  movement_number?: string;
  reference_code?: string;
  movement_type?: string;
  type?: string;
  quantity: number;
  created_at?: string;
  moved_at?: string;
  product_name?: string;
  product_sku?: string;
  item?: { name?: string; sku?: string };
}

interface CategoryItem {
  id: string | number;
  name: string;
  total_items?: number;
  total_value?: number;
}

const movementAccent = (type?: string) => {
  const t = (type || '').toUpperCase();
  if (t === 'RECEIPT' || t === 'PRODUCTION' || t === 'PURCHASE' || t === 'OPENING_BALANCE') {
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
  }
  if (t === 'TRANSFER') return 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
  return 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
};

export const InventoryDashboardView: React.FC<InventoryDashboardViewProps> = ({
  attentionItems = [],
  onOpenOrderPO,
  onOpenReviewStock,
}) => {
  const { formatCurrency } = useCurrency();

  const { data: metrics } = useQuery<DashboardMetricsData | null>({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>('/dashboard/metrics');
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('commercial' in raw) return raw as DashboardMetricsData;
          if ('data' in raw && raw.data && typeof raw.data === 'object' && 'commercial' in raw.data) return raw.data as DashboardMetricsData;
        }
        return null;
      } catch { return null; }
    },
  });

  const { data: recentMovements = [] } = useQuery<MovementItem[]>({
    queryKey: ['inventory', 'recent-movements'],
    queryFn: async () => {
      try {
        const res = await api.get<MovementItem[] | { data: MovementItem[] }>('/inventory/movements?per_page=8');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const { data: categories = [] } = useQuery<CategoryItem[]>({
    queryKey: ['inventory', 'categories-summary'],
    queryFn: async () => {
      try {
        const res = await api.get<CategoryItem[] | { data: CategoryItem[] }>('/inventory/categories?per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const kpis = [
    { label: 'Total Valuation', value: metrics ? formatCurrency(metrics.inventory.total_valuation) : '—', sub: 'Warehouse asset value', icon: <Warehouse className="size-4" />, color: 'text-blue-500' },
    { label: 'Reorder Alerts', value: `${metrics?.inventory.low_stock_count ?? 0}`, sub: 'SKUs below threshold', icon: <AlertTriangle className="size-4" />, color: 'text-red-500', accent: (metrics?.inventory.low_stock_count ?? 0) > 0 },
    { label: 'Pending Counts', value: `${metrics?.inventory.pending_counts ?? 0}`, sub: 'Cycle count queue', icon: <RefreshCw className="size-4" />, color: 'text-amber-500' },
    { label: 'Pending Adjustments', value: `${metrics?.inventory.pending_adjustments ?? 0}`, sub: 'Awaiting approval', icon: <Package className="size-4" />, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn(
            'rounded-2xl border bg-surface p-4 shadow-sm hover:border-primary/30 transition-all flex flex-col gap-2',
            kpi.accent ? 'border-l-4 border-l-red-500 border-r border-t border-b border-default' : 'border-default'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted truncate">{kpi.label}</span>
              <span className={cn('shrink-0', kpi.color)}>{kpi.icon}</span>
            </div>
            <div className="font-extrabold font-mono text-xl text-default leading-none">{kpi.value}</div>
            <div className={cn('text-[10px] font-medium', kpi.accent ? 'text-red-500' : 'text-muted')}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid: movements + reorder + categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock Movements — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Recent Stock Movements</h3>
              <p className="text-[11px] text-muted">Live material flow — receipts, transfers, consumption</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/inventory?action=transfer" className="flex items-center gap-1 rounded-lg bg-linear-to-r from-indigo-600 to-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-blue-500 transition-all">
                <Plus className="size-3" /> Transfer
              </Link>
              <Link to="/inventory" className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-all">
                <Boxes className="size-3" /> All Stock
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {recentMovements.length > 0 ? (
                  recentMovements.map((mv) => {
                    const movType = mv.type || mv.movement_type || 'movement';
                    const refCode = mv.movement_number || mv.reference_code || `MOV-${mv.id}`;
                    const itemName = mv.item?.name || mv.product_name || 'Stock Item';
                    const itemSku = mv.item?.sku || mv.product_sku || '—';
                    const movDate = mv.created_at || mv.moved_at;

                    return (
                      <tr key={mv.id} className="hover:bg-surface-sunken/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-default">{itemName}</div>
                          <div className="font-mono text-[10px] text-muted">{itemSku}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted">{refCode}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', movementAccent(movType))}>
                            {movType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-right text-default">{mv.quantity}</td>
                        <td className="px-4 py-2.5 text-muted text-[10px]">
                          {movDate ? new Date(movDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={5} className="py-10 text-center text-muted">
                    <Inbox className="mx-auto size-8 text-muted/40 mb-2" />
                    No stock movements recorded.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column — categories + reorder */}
        <div className="flex flex-col gap-4">
          {/* Categories */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-default">
              <h3 className="text-sm font-bold text-default">Inventory Categories</h3>
              <Tag className="size-4 text-muted" />
            </div>
            <div className="divide-y divide-default">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium text-default truncate">{cat.name}</span>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-xs font-bold font-mono text-default">{cat.total_items ?? 0} SKUs</div>
                      {cat.total_value ? <div className="text-[10px] text-muted">{formatCurrency(cat.total_value)}</div> : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-muted text-xs">No categories defined.</div>
              )}
            </div>
          </div>

          {/* Reorder suggestions */}
          {attentionItems.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-red-500/20">
                <div>
                  <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" /> Reorder Needed
                  </h3>
                  <p className="text-[11px] text-muted">{attentionItems.length} SKUs below safe threshold</p>
                </div>
              </div>
              <div className="divide-y divide-red-500/10">
                {attentionItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-red-500/5 transition-colors">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-default truncate">{item.name}</div>
                      <div className="text-[10px] text-muted font-mono">{item.sku} · {item.warehouse}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="h-1 w-16 rounded-full bg-surface-sunken overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min((item.currentStock / Math.max(item.minThreshold, 1)) * 100, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-red-500 font-mono font-semibold">{item.currentStock}/{item.minThreshold}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenReviewStock && (
                        <button
                          type="button"
                          onClick={() => onOpenReviewStock(item)}
                          className="rounded-lg border border-red-500/30 bg-surface px-2 py-1 text-[11px] font-medium text-muted hover:text-default hover:bg-surface-elevated shrink-0 cursor-pointer transition-colors"
                        >
                          Review
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenOrderPO?.(item)}
                        className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 shrink-0 cursor-pointer transition-colors"
                      >
                        <ShoppingCart className="size-3" /> Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link to="/inventory" className="flex items-center justify-between rounded-xl border border-default bg-surface px-4 py-2.5 text-xs font-semibold text-default hover:bg-surface-sunken transition-all shadow-sm">
            <span className="flex items-center gap-1.5 text-muted"><TrendingDown className="size-3.5 text-indigo-500" /> Full Stock Register</span>
            <ArrowRight className="size-3 text-muted" />
          </Link>
        </div>
      </div>
    </div>
  );
};
