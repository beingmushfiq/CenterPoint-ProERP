import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Search,
  Filter,
  RefreshCw,
  TrendingDown,
  Warehouse as WarehouseIcon,
  ShoppingCart,
  ChevronDown,
  SlidersHorizontal,
  History,
  ArrowRightLeft,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { KPICard } from '../../../components/ui/KPICard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface StockThresholdItem {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string;
  unit_code: string;
  warehouse_id: number;
  warehouse_name: string;
  current_stock: number;
  min_stock_alert: number;
  reorder_quantity: number;
  max_stock_level: number;
  is_low_stock: boolean;
  deficit: number;
}

interface ThresholdResponse {
  data: StockThresholdItem[];
  summary: {
    total_monitored: number;
    low_stock_count: number;
  };
}

export const StockThresholdsSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'healthy'>('all');

  // Edit Modal State
  const [selectedItem, setSelectedItem] = useState<StockThresholdItem | null>(null);
  const [editMinAlert, setEditMinAlert] = useState<string>('10');
  const [editReorderQty, setEditReorderQty] = useState<string>('50');
  const [editMaxLevel, setEditMaxLevel] = useState<string>('500');
  const [openActionMenuKey, setOpenActionMenuKey] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<ThresholdResponse>({
    queryKey: ['inventory', 'thresholds'],
    queryFn: async () => {
      void api.get('/inventory/thresholds/alerts').catch(() => {});
      const res = await api.get<ThresholdResponse>('/inventory/thresholds');
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      product_id: number;
      warehouse_id: number;
      min_stock_alert: number;
      reorder_quantity: number;
      max_stock_level: number;
    }) => {
      await api.post('/inventory/thresholds', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'thresholds'] });
      setSelectedItem(null);
    },
  });

  const handleOpenEdit = (item: StockThresholdItem) => {
    setSelectedItem(item);
    setEditMinAlert(item.min_stock_alert.toString());
    setEditReorderQty(item.reorder_quantity.toString());
    setEditMaxLevel(item.max_stock_level.toString());
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    saveMutation.mutate({
      product_id: selectedItem.product_id,
      warehouse_id: selectedItem.warehouse_id,
      min_stock_alert: parseFloat(editMinAlert) || 0,
      reorder_quantity: parseFloat(editReorderQty) || 0,
      max_stock_level: parseFloat(editMaxLevel) || 0,
    });
  };

  const items = data?.data ?? [];
  const lowCount = data?.summary?.low_stock_count ?? 0;
  const totalCount = data?.summary?.total_monitored ?? items.length;
  const healthyCount = Math.max(0, totalCount - lowCount);

  // Extract unique warehouses
  const warehouses = Array.from(new Set(items.map((i) => i.warehouse_name)));

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = warehouseFilter === 'all' || item.warehouse_name === warehouseFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'low' && item.is_low_stock) ||
      (statusFilter === 'healthy' && !item.is_low_stock);

    return matchesSearch && matchesWarehouse && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Monitored SKUs"
          value={totalCount}
          icon={<WarehouseIcon className="h-5 w-5 text-primary" />}
        />
        <KPICard
          label="Low Stock Alerts"
          value={lowCount}
          alert={lowCount > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
        />
        <KPICard
          label="Optimal Buffers"
          value={healthyCount}
          alert="success"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
        <KPICard
          label="Replenishment Priority"
          value={lowCount > 0 ? `${lowCount} Lines` : 'Normal'}
          alert={lowCount > 0 ? 'warning' : 'success'}
          icon={<TrendingDown className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* Low Stock Warning Banner */}
      {lowCount > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-default">
                {lowCount} Product(s) Below Minimum Stock Alert Threshold
              </h4>
              <p className="text-[11px] text-muted">
                Immediate purchase requisition or production dispatch is recommended to prevent stockouts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/purchasing?tab=orders"
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <ShoppingCart className="size-3.5" />
              <span>Reorder in Purchasing</span>
            </Link>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setStatusFilter('low')}
              className="shrink-0 text-xs"
            >
              Filter Critical Items
            </Button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface rounded-2xl p-4 border border-default shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search product by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-default bg-surface-sunken text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" />
            <span>Warehouse:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="rounded-xl border border-default bg-surface-sunken px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'low' | 'healthy')}
              className="rounded-xl border border-default bg-surface-sunken px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="low">Low Stock Only</option>
              <option value="healthy">Healthy Only</option>
            </select>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default cursor-pointer transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Thresholds Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken/70 uppercase text-[11px] font-semibold tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Warehouse</th>
                <th className="px-5 py-3.5 text-right">Available Stock</th>
                <th className="px-5 py-3.5 text-right">Min Alert Level</th>
                <th className="px-5 py-3.5 text-right">Reorder Qty</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    Loading stock threshold data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No matching inventory threshold records found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const itemKey = `${item.product_id}_${item.warehouse_id}`;
                  return (
                    <tr
                      key={itemKey}
                      className={`hover:bg-surface-sunken/40 transition-colors ${
                        item.is_low_stock ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-medium">
                        <div className="text-default font-semibold">{item.product_name}</div>
                        <div className="text-[10px] font-mono text-muted">{item.sku}</div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{item.category_name}</td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[10px] font-semibold text-muted border border-default">
                          {item.warehouse_name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        <span
                          className={
                            item.is_low_stock
                              ? 'text-rose-600 font-extrabold'
                              : 'text-default'
                          }
                        >
                          {item.current_stock.toFixed(2)} {item.unit_code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted">
                        {item.min_stock_alert.toFixed(2)} {item.unit_code}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-primary">
                        {item.reorder_quantity.toFixed(2)} {item.unit_code}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {item.is_low_stock ? (
                          <Badge tone="danger-subtle">
                            Low Stock (-{item.deficit.toFixed(1)})
                          </Badge>
                        ) : (
                          <Badge tone="success-subtle">
                            Healthy
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenEdit(item)}
                            className="text-xs h-7 gap-1"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            Configure
                          </Button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenuKey === itemKey) {
                                setOpenActionMenuKey(null);
                                setActionMenuAnchor(null);
                              } else {
                                setOpenActionMenuKey(itemKey);
                                setActionMenuAnchor(e.currentTarget);
                              }
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                              openActionMenuKey === itemKey
                                ? 'bg-primary text-primary-fg border-primary shadow-xs'
                                : 'bg-surface hover:bg-surface-sunken border-default text-default'
                            )}
                          >
                            <span>Actions</span>
                            <ChevronDown className="size-3 text-muted" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {openActionMenuKey && (() => {
            const item = filteredItems.find(
              (x) => `${x.product_id}_${x.warehouse_id}` === openActionMenuKey
            );
            if (!item) return null;
            return (
              <ActionMenuPortal
                isOpen={Boolean(openActionMenuKey && actionMenuAnchor)}
                anchorEl={actionMenuAnchor}
                onClose={() => {
                  setOpenActionMenuKey(null);
                  setActionMenuAnchor(null);
                }}
                width="13rem"
              >
                <div className="p-1 space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuKey(null);
                      setActionMenuAnchor(null);
                      handleOpenEdit(item);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="size-3.5 text-muted" />
                    <span>Configure Alert Levels</span>
                  </button>

                  <Link
                    to={`/purchasing?tab=orders&product=${encodeURIComponent(item.product_name)}&sku=${encodeURIComponent(item.sku)}&qty=${item.reorder_quantity}`}
                    onClick={() => {
                      setOpenActionMenuKey(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-primary hover:bg-primary/10 transition-colors cursor-pointer font-medium"
                  >
                    <ShoppingCart className="size-3.5 text-primary" />
                    <span>Reorder in Purchasing</span>
                  </Link>

                  <Link
                    to="/inventory?tab=transfers"
                    onClick={() => {
                      setOpenActionMenuKey(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="size-3.5 text-muted" />
                    <span>Transfer from Other Hub</span>
                  </Link>

                  <Link
                    to="/inventory?tab=ledger"
                    onClick={() => {
                      setOpenActionMenuKey(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <History className="size-3.5 text-muted" />
                    <span>View Stock Ledger</span>
                  </Link>
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* Edit Threshold Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">Configure Stock Threshold</h3>
                <p className="text-xs text-muted mt-0.5">
                  {selectedItem.product_name} • {selectedItem.warehouse_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-muted hover:text-default cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveThreshold} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">
                  Minimum Stock Alert Threshold ({selectedItem.unit_code})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editMinAlert}
                  onChange={(e) => setEditMinAlert(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-sm text-default font-mono focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-muted mt-1">
                  Alert triggers when available warehouse stock falls below this level.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">
                  Suggested Reorder Quantity ({selectedItem.unit_code})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editReorderQty}
                  onChange={(e) => setEditReorderQty(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-sm text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">
                  Maximum Stock Level ({selectedItem.unit_code})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editMaxLevel}
                  onChange={(e) => setEditMaxLevel(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-sm text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
