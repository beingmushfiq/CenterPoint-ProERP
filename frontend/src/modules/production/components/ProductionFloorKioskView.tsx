import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
  TrendingUp,
  CheckCircle2,
  Activity,
  Layers,
  X,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import type { ProductionBatch } from '../../../types/api/production';

interface ProductionFloorKioskViewProps {
  onExit: () => void;
}

export const ProductionFloorKioskView: React.FC<ProductionFloorKioskViewProps> = ({ onExit }) => {
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(10);
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'scheduled'>('all');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));

  // Ticking live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Esc key listener to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not permitted or cancelled
    }
  };

  // Live query with auto-refresh
  const { data: batches = [], isFetching, refetch } = useQuery<ProductionBatch[]>({
    queryKey: ['production', 'batches', 'kiosk'],
    queryFn: async ({ signal }) => {
      const res = await api.get<ProductionBatch[]>('/production/batches', {
        signal,
        params: { per_page: 50 },
      });
      if (Array.isArray(res.data)) return res.data;
      if (res.data && Array.isArray((res.data as { data?: ProductionBatch[] }).data)) {
        return (res.data as { data: ProductionBatch[] }).data;
      }
      return [];
    },
    refetchInterval: refreshIntervalSec > 0 ? refreshIntervalSec * 1000 : false,
  });

  // Filter batches
  const filteredBatches = useMemo(() => {
    if (filterStatus === 'all') {
      return batches.filter((b) => b.status === 'in_progress' || b.status === 'scheduled');
    }
    return batches.filter((b) => b.status === filterStatus);
  }, [batches, filterStatus]);

  // KPI Calculations
  const stats = useMemo(() => {
    const active = batches.filter((b) => b.status === 'in_progress');
    const scheduled = batches.filter((b) => b.status === 'scheduled');
    const totalTarget = active.reduce((sum, b) => sum + (parseFloat(b.target_quantity) || 0), 0);
    const totalActual = active.reduce((sum, b) => sum + (parseFloat(b.actual_quantity) || 0), 0);

    const yields = active
      .map((b) => parseFloat(b.actual_yield_pct ?? b.yield_percentage ?? '0'))
      .filter((y) => y > 0);
    const avgYield = yields.length > 0 ? yields.reduce((a, b) => a + b, 0) / yields.length : 0;

    return {
      activeCount: active.length,
      scheduledCount: scheduled.length,
      totalTarget: Math.round(totalTarget),
      totalActual: Math.round(totalActual),
      avgYield: avgYield.toFixed(1),
    };
  }, [batches]);

  return (
    <div
      role="region"
      aria-label="Production Floor Kiosk Display"
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none"
    >
      {/* Top Header Bar */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Factory className="size-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black tracking-wide uppercase text-white truncate">
                Factory Floor Operational Kiosk
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-slate-400 tracking-wider truncate">
              Real-Time Shop Floor Intelligence
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Ticking Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
            <Clock className="size-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs sm:text-sm font-bold tracking-widest">
              {currentTime.toLocaleTimeString()}
            </span>
          </div>

          {/* Auto-Refresh Select */}
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <span className="text-slate-400 pl-1.5 pr-1 font-semibold hidden sm:flex items-center gap-1">
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
              Poll:
            </span>
            {[
              { val: 10, label: '10s' },
              { val: 30, label: '30s' },
              { val: 60, label: '60s' },
              { val: 0, label: 'Off' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setRefreshIntervalSec(opt.val)}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all touch-target ${
                  refreshIntervalSec === opt.val
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => refetch()}
            title="Manual refresh"
            className="p-2 min-h-9.5 min-w-9.5 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition touch-target"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-2 min-h-9.5 min-w-9.5 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition touch-target"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>

          {/* Exit Kiosk Button */}
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-9.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition touch-target"
          >
            <X className="size-4" />
            Exit (Esc)
          </button>
        </div>
      </header>

      {/* KPI Highlight Strip - Industrial High Contrast Numbers */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 pb-2">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Batches</span>
            <Activity className="size-5 text-emerald-400" />
          </div>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
            {stats.activeCount}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {stats.scheduledCount} additional scheduled
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Target Units</span>
            <Layers className="size-5 text-sky-400" />
          </div>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-sky-400">
            {stats.totalTarget.toLocaleString()}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">Required batch output</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Completed Units</span>
            <CheckCircle2 className="size-5 text-emerald-400" />
          </div>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-emerald-400">
            {stats.totalActual.toLocaleString()}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {stats.totalTarget > 0
              ? `${Math.round((stats.totalActual / stats.totalTarget) * 100)}% of target met`
              : 'No active production'}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Floor Yield</span>
            <TrendingUp className="size-5 text-amber-400" />
          </div>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-amber-400">
            {parseFloat(stats.avgYield) > 0 ? `${stats.avgYield}%` : '—'}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">Target standard: 98%+</p>
        </div>
      </section>

      {/* Filter Tabs Sub-Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All Floor Batches' },
            { key: 'in_progress', label: 'In Progress Only' },
            { key: 'scheduled', label: 'Scheduled Ahead' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key as typeof filterStatus)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition whitespace-nowrap touch-target ${
                filterStatus === tab.key
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-slate-400 shrink-0">
          Showing {filteredBatches.length} batches
        </span>
      </div>

      {/* Main Kiosk Grid */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 pt-2">
        {filteredBatches.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Factory className="size-16 stroke-1 text-slate-600 mb-3" />
            <p className="text-lg font-bold">No active batches on the floor</p>
            <p className="text-xs text-slate-400 mt-1">
              Start or schedule batches in the main Production workspace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => {
              const target = parseFloat(batch.target_quantity) || 1;
              const actual = parseFloat(batch.actual_quantity) || 0;
              const progressPct = Math.min(Math.round((actual / target) * 100), 100);
              const yieldPct = parseFloat(batch.actual_yield_pct ?? batch.yield_percentage ?? '0');

              return (
                <article
                  key={batch.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Batch Number & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-base font-extrabold text-white px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 tracking-wider">
                        {batch.batch_number}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          batch.status === 'in_progress'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {batch.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Product Name & SKU */}
                    <h2 className="text-lg font-bold text-white line-clamp-1">
                      {batch.product_name ?? 'Manufactured Item'}
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      SKU: {batch.product_sku ?? '—'}
                      {batch.bom_name ? ` • BOM: ${batch.bom_name}` : ''}
                    </p>

                    {/* Progress Bar & Quantities */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                        <span className="text-slate-400">
                          {actual.toLocaleString()} / {target.toLocaleString()} Units
                        </span>
                        <span className="text-emerald-400">{progressPct}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                        <div
                          className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom Metrics Bar */}
                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Yield:</span>
                      <span
                        className={`font-bold ${
                          yieldPct >= 95
                            ? 'text-emerald-400'
                            : yieldPct >= 80
                              ? 'text-amber-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {yieldPct > 0 ? `${yieldPct}%` : 'Pending'}
                      </span>
                    </div>

                    {batch.scheduled_end && (
                      <span className="text-slate-400 text-[11px]">
                        Target: {new Date(batch.scheduled_end).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
