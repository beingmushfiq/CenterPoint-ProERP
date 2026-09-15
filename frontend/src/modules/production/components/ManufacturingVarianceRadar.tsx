import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';

interface VarianceBatch {
  id: number;
  batch_number: string;
  status: string;
  planned_quantity: number;
  product_name: string;
  product_sku: string;
  standard_cost: number;
}

interface WaterfallStep {
  name: string;
  amount: number;
  delta: number;
  type: 'base' | 'favorable' | 'unfavorable' | 'total';
  description: string;
}

interface CostVector {
  vector: string;
  standard: number;
  actual: number;
  variance: number;
  variance_pct: number;
  status: string;
  benchmark: string;
}

interface RadarData {
  batches: VarianceBatch[];
  active_batch: VarianceBatch | null;
  summary: {
    standard_budget: number;
    actual_landed_cost: number;
    net_variance: number;
    variance_percentage: number;
    status: 'favorable' | 'unfavorable';
    standard_unit_cost: number;
    actual_unit_cost: number;
    planned_quantity: number;
  } | null;
  waterfall: WaterfallStep[];
  cost_vectors: CostVector[];
}

export const ManufacturingVarianceRadar: React.FC = () => {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  const fetchRadarData = useCallback(async (batchId?: number | null) => {
    try {
      setLoading(true);
      const res = batchId
        ? await api.get<RadarData>(`/production/variance-radar?batch_id=${batchId}`)
        : await api.get<RadarData>('/production/variance-radar');
      if (res.data) {
        setData(res.data);
        if (!selectedBatchId && res.data.active_batch?.id) {
          setSelectedBatchId(res.data.active_batch.id);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    void fetchRadarData(selectedBatchId);
  }, [selectedBatchId, fetchRadarData]);

  const summary = data?.summary;
  const isFavorable = (summary?.net_variance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Cockpit Banner */}
      <div className="bg-surface border border-default rounded-(--card-radius) p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                <Sparkles className="size-3" /> ABC Costing Radar
              </span>
              <span className="text-3xs text-muted font-medium">Standard vs Actual Cost Decomposition</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-default flex items-center gap-2">
              Manufacturing Cost Variance Radar
            </h2>
            <p className="text-muted text-xs sm:text-sm max-w-2xl mt-1 leading-relaxed">
              Real-time absorption of component prices, scrap losses, worker line hours, and machine kilowatt-hour overhead into landed SKU manufacturing costs.
            </p>
          </div>

          {/* Batch Selector Dropdown */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-3xs font-semibold text-muted uppercase">Active Production Batch</span>
              <select
                value={selectedBatchId ?? ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="mt-1 px-3 py-1.5 rounded-xl border border-default bg-surface-sunken text-xs font-semibold text-default focus:outline-hidden focus:border-primary cursor-pointer"
              >
                {data?.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} — {b.product_name} ({b.planned_quantity} units)
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchRadarData(selectedBatchId)}
              disabled={loading}
              className="mt-4 cursor-pointer"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Top Summary Metrics */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-default/70">
            <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
              <div className="text-2xs text-muted font-medium">Standard BOM Budget</div>
              <div className="text-lg font-bold text-default mt-0.5">
                ৳{summary.standard_budget.toLocaleString()}
              </div>
              <div className="text-3xs text-muted mt-0.5">
                Target: ৳{summary.standard_unit_cost}/unit
              </div>
            </div>

            <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
              <div className="text-2xs text-muted font-medium">Actual Landed Cost</div>
              <div className="text-lg font-bold text-default mt-0.5">
                ৳{summary.actual_landed_cost.toLocaleString()}
              </div>
              <div className="text-3xs text-muted mt-0.5">
                Realized: ৳{summary.actual_unit_cost}/unit
              </div>
            </div>

            <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
              <div className="text-2xs text-muted font-medium">Net Cost Variance</div>
              <div
                className={cn(
                  'text-lg font-bold mt-0.5 flex items-center gap-1',
                  isFavorable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {isFavorable ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                <span>৳{Math.abs(summary.net_variance).toLocaleString()}</span>
              </div>
              <div className="text-3xs text-muted mt-0.5">
                {summary.variance_percentage > 0 ? `+${summary.variance_percentage}%` : `${summary.variance_percentage}%`} vs budget
              </div>
            </div>

            <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
              <div className="text-2xs text-muted font-medium">Absorption Status</div>
              <div
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mt-1.5 uppercase',
                  isFavorable
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                )}
              >
                {isFavorable ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                <span>{isFavorable ? 'FAVORABLE (SAVED)' : 'UNFAVORABLE (OVERRUN)'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Waterfall Breakdown */}
      <div className="bg-surface border border-default rounded-(--card-radius) p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-default/70 mb-5">
          <div>
            <h3 className="text-sm font-bold text-default flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Standard-to-Actual Cost Waterfall Analysis
            </h3>
            <p className="text-2xs text-muted mt-0.5">
              Trace how material fluctuations, shopfloor scrap, and worker speed shifted standard margins.
            </p>
          </div>
          <span className="text-3xs font-mono text-muted bg-surface-sunken px-2 py-1 rounded border border-default">
            Currency: BDT (৳)
          </span>
        </div>

        <div className="space-y-3">
          {data?.waterfall.map((step, idx) => {
            const isBase = step.type === 'base';
            const isTotal = step.type === 'total';
            const isPositive = step.delta >= 0;

            return (
              <div
                key={idx}
                className={cn(
                  'p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                  isBase || isTotal
                    ? 'bg-surface-sunken border-default font-semibold'
                    : isPositive
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'size-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0',
                      isBase || isTotal
                        ? 'bg-surface text-default border border-default'
                        : isPositive
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-default">{step.name}</div>
                    <div className="text-2xs text-muted mt-0.5">{step.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                  {!isBase && !isTotal && (
                    <span
                      className={cn(
                        'text-xs font-mono font-bold px-2 py-0.5 rounded',
                        isPositive
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                      )}
                    >
                      {isPositive ? `+৳${step.delta.toLocaleString()}` : `-৳${Math.abs(step.delta).toLocaleString()}`}
                    </span>
                  )}
                  <div className="text-right font-mono text-xs font-bold text-default min-w-28">
                    ৳{step.amount.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Vector Cost Decomposition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data?.cost_vectors.map((vec, idx) => {
          const isVecFav = vec.variance >= 0;
          return (
            <div
              key={idx}
              className="bg-surface border border-default rounded-(--card-radius) p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-default/60">
                <span className="text-xs font-bold text-default">{vec.vector}</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-3xs font-bold uppercase',
                    isVecFav
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  )}
                >
                  {vec.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Standard Budget:</span>
                  <span className="font-mono text-default">৳{vec.standard.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Actual Incurred:</span>
                  <span className="font-mono text-default">৳{vec.actual.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-default/50 font-semibold">
                  <span>Variance Delta:</span>
                  <span
                    className={cn(
                      'font-mono',
                      isVecFav ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {isVecFav ? `+৳${vec.variance.toLocaleString()}` : `-৳${Math.abs(vec.variance).toLocaleString()}`} ({vec.variance_pct}%)
                  </span>
                </div>
              </div>

              <div className="text-3xs text-muted/80 bg-surface-sunken px-2 py-1 rounded border border-default/40">
                {vec.benchmark}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
