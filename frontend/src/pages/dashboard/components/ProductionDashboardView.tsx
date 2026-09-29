import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  ShoppingCart,
  Eye,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  ShieldCheck,
  Package,
  FileText,
  Radio,
  Calendar,
  Sparkles,
  Factory,
  Layers,
  ClipboardList,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import type { OrderPOItem } from './DashboardModals';
import type { DashboardMetricsData, DashboardInvoiceItem } from '../../../types/api/dashboard';
import type { DashboardInvoice } from './SalesDashboardView';
import type { QcItem } from './QcDashboardView';
import { DashboardKpiCard } from './DashboardKpiCard';

export interface ProductionOrderDashboardItem {
  id: string;
  product: string;
  code: string;
  target: number;
  produced: number;
  progress: number;
  status: string;
}

export interface WorkerLeaderboardItem {
  initials: string;
  name: string;
  output: string;
  rate: number;
  badge: string;
  color: string;
}

interface ProductionDashboardViewProps {
  attentionItems?: OrderPOItem[];
  onOpenOrderPO?: (item: OrderPOItem) => void;
  onOpenReviewStock?: (item: OrderPOItem) => void;
  onOpenInvoice?: (invoice: DashboardInvoice) => void;
  onOpenQC?: (item: QcItem) => void;
  onOpenWorker?: (worker: WorkerLeaderboardItem) => void;
  onOpenOrder?: (order: ProductionOrderDashboardItem) => void;
  onOpenCustomDate?: () => void;
  customRangeLabel?: string | null;
}

export const ProductionDashboardView: React.FC<ProductionDashboardViewProps> = ({
  attentionItems: propAttentionItems,
  onOpenOrderPO,
  onOpenReviewStock,
  onOpenInvoice,
  onOpenQC,
  onOpenWorker,
  onOpenOrder,
  onOpenCustomDate,
  customRangeLabel,
}) => {
  const { formatCurrency } = useCurrency();

  // Local View States
  const [isAlertBannerVisible, setIsAlertBannerVisible] = useState(true);
  const [isAlertBannerExpanded, setIsAlertBannerExpanded] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | '7days' | '30days' | 'custom'>('7days');
  const [isLiveTelemetry, setIsLiveTelemetry] = useState(true);
  const [orderFilter, setOrderFilter] = useState<'all' | 'QC PENDING' | 'COMPLETED' | 'READY'>('all');

  // Query Real Backend Metrics
  const { data: metrics } = useQuery<DashboardMetricsData | null>({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>(
          '/dashboard/metrics'
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('production' in raw) return raw as DashboardMetricsData;
          if ('data' in raw && raw.data && typeof raw.data === 'object' && 'production' in raw.data) {
            return raw.data as DashboardMetricsData;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    refetchInterval: isLiveTelemetry ? 8000 : false,
    staleTime: 4000,
  });

  // Stable metric sub-references (avoids React Compiler warnings from optional chaining in deps)
  const recentBatches = metrics?.recent_batches;
  const activeWorkersData = metrics?.active_workers;
  const attentionFromMetrics = metrics?.attention_items;
  const recentQc = metrics?.recent_qc;
  const trends = metrics?.trends;

  // Recent invoices for commercial overview
  const { data: rawInvoices = [] } = useQuery<DashboardInvoiceItem[]>({
    queryKey: ['sales', 'production-view-invoices'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardInvoiceItem[] | { data: DashboardInvoiceItem[] }>(
          '/sales/invoices?per_page=6'
        );
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
  });

  const formattedInvoices: DashboardInvoice[] = useMemo(() => {
    return rawInvoices.map((inv) => ({
      id: inv.invoice_number,
      customer: inv.customer?.name || 'Commercial Customer',
      type: 'B2B',
      amount: formatCurrency(Number(inv.total_amount) || 0),
      status: inv.status === 'completed' || inv.status === 'paid' ? 'DELIVERED' : 'CONFIRMED',
      payment: inv.payment_status?.toUpperCase() || 'PAID',
    }));
  }, [rawInvoices, formatCurrency]);

  const filteredInvoices = formattedInvoices;

  // Production Orders / Batches
  const activeOrders: ProductionOrderDashboardItem[] = useMemo(() => {
    if (recentBatches && recentBatches.length > 0) {
      return recentBatches.map((b) => ({
        id: b.id,
        product: b.product,
        code: b.code,
        target: b.target,
        produced: b.produced,
        progress: b.progress,
        status: b.status,
      }));
    }
    return [
      {
        id: 'PB-2026-001',
        product: 'Commercial Gas Stove Twin-Burner',
        code: 'STV-001',
        target: 100,
        produced: 82,
        progress: 82,
        status: 'QC PENDING',
      },
      {
        id: 'PB-2026-002',
        product: 'Induction Cooker Pro Series A1',
        code: 'CKR-IND-A1',
        target: 60,
        produced: 60,
        progress: 100,
        status: 'COMPLETED',
      },
      {
        id: 'PB-2026-003',
        product: 'Rice Cooker Deluxe Inner Pot Assembly',
        code: 'RC-DLX-04',
        target: 150,
        produced: 45,
        progress: 30,
        status: 'READY',
      },
    ];
  }, [recentBatches]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return activeOrders;
    return activeOrders.filter((ord) => ord.status === orderFilter);
  }, [orderFilter, activeOrders]);

  // Worker Leaderboard
  const workers: WorkerLeaderboardItem[] = useMemo(() => {
    if (Array.isArray(activeWorkersData) && activeWorkersData.length > 0) {
      return activeWorkersData;
    }
    return [
      {
        initials: 'AR',
        name: 'Md. Abdur Rahim',
        output: '340 pcs',
        rate: 98,
        badge: 'Top Welder',
        color: 'bg-emerald-500',
      },
      {
        initials: 'KH',
        name: 'Md. Karim Hossain',
        output: '310 pcs',
        rate: 94,
        badge: 'Lead Assembler',
        color: 'bg-blue-500',
      },
      {
        initials: 'MA',
        name: 'Meshkat Afrose',
        output: '285 pcs',
        rate: 89,
        badge: 'Soldering',
        color: 'bg-indigo-500',
      },
      {
        initials: 'RB',
        name: 'Rima Begum',
        output: '260 pcs',
        rate: 85,
        badge: 'Assembly',
        color: 'bg-amber-500',
      },
    ];
  }, [activeWorkersData]);

  // Attention Items
  const attentionItems: OrderPOItem[] = useMemo(() => {
    if (propAttentionItems && propAttentionItems.length > 0) return propAttentionItems;
    if (attentionFromMetrics && attentionFromMetrics.length > 0) {
      return attentionFromMetrics;
    }
    return [
      {
        id: 'MAT-001',
        name: 'Bi-metal Thermal Cutoff Switch (320°C)',
        sku: 'ELEC-SW-320',
        warehouse: 'Tejgaon Central Plant',
        currentStock: 0,
        minThreshold: 100,
        unit: 'pcs',
        suggestedQty: 250,
      },
      {
        id: 'MAT-002',
        name: 'Die-cast Brass Gas Burner Core (120mm)',
        sku: 'BRS-BNR-120',
        warehouse: 'Tejgaon Central Plant',
        currentStock: 12,
        minThreshold: 50,
        unit: 'pcs',
        suggestedQty: 100,
      },
      {
        id: 'MAT-003',
        name: 'Toughened Tempered Glass Panel 7mm',
        sku: 'GLS-TMP-007',
        warehouse: 'Tejgaon Central Plant',
        currentStock: 18,
        minThreshold: 60,
        unit: 'pcs',
        suggestedQty: 120,
      },
    ];
  }, [propAttentionItems, attentionFromMetrics]);

  // KPIs
  const currentKPIs = useMemo(() => {
    const target = metrics?.production?.target_output ?? 50;
    const produced = metrics?.production?.today_output ?? 0;
    const achievement = target > 0 ? Math.round((produced / target) * 100) : 0;
    const pendingOrders = metrics?.production?.active_batches ?? activeOrders.length;
    const qcPending = metrics?.quality?.pending_inspections ?? 0;
    const reworkQty = 0;

    return {
      target,
      produced,
      achievement,
      pendingOrders,
      qcPending,
      reworkQty,
    };
  }, [metrics, activeOrders.length]);

  // Trend Data
  const chartData = useMemo(() => {
    if (timeframe === 'today' && trends?.today) {
      return trends.today;
    }
    if (timeframe === '30days' && trends?.monthly) {
      return trends.monthly;
    }
    if (trends?.weekly && trends.weekly.length > 0) {
      return trends.weekly;
    }
    return [
      { time: 'Mon', produced: 42, qcPassed: 40, target: 50, revenue: 12000 },
      { time: 'Tue', produced: 58, qcPassed: 56, target: 50, revenue: 15400 },
      { time: 'Wed', produced: 49, qcPassed: 47, target: 50, revenue: 13900 },
      { time: 'Thu', produced: 65, qcPassed: 63, target: 50, revenue: 18200 },
      { time: 'Fri', produced: 72, qcPassed: 70, target: 50, revenue: 21000 },
      { time: 'Sat', produced: 60, qcPassed: 58, target: 50, revenue: 16800 },
      { time: 'Sun', produced: 35, qcPassed: 34, target: 50, revenue: 9500 },
    ];
  }, [timeframe, trends]);

  // QC Queue
  const qcList = useMemo(() => {
    if (recentQc && recentQc.length > 0) {
      return recentQc;
    }
    return [
      {
        id: 'QC-901',
        orderNo: 'PB-2026-001',
        product: 'Commercial Gas Stove Twin-Burner',
        qty: 82,
        status: 'PENDING',
        failed: 2,
        rework: 1,
      },
      {
        id: 'QC-902',
        orderNo: 'PB-2026-002',
        product: 'Induction Cooker Pro Series A1',
        qty: 60,
        status: 'PASSED',
        failed: 0,
        rework: 0,
      },
    ];
  }, [recentQc]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. OPERATIONAL ATTENTION REQUIRED (COLLAPSIBLE / RESPONSIVE)
      ───────────────────────────────────────────────────────────── */}
      {isAlertBannerVisible && (
        <div className="rounded-2xl border border-amber-500/30 bg-surface shadow-xs overflow-hidden transition-all duration-300">
          <div className="h-1 bg-linear-to-r from-red-500 via-amber-500 to-orange-400" />

          <div className="p-3.5 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="size-4" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold tracking-tight text-default uppercase">
                  OPERATIONAL ATTENTION REQUIRED
                </h2>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 px-2 py-0.5 text-[10px] font-bold">
                    {attentionItems.filter((i) => i.currentStock <= 0).length} Critical
                  </span>
                  <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold">
                    {attentionItems.filter((i) => i.currentStock > 0).length} Low Stock
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsAlertBannerExpanded(!isAlertBannerExpanded)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <span>{isAlertBannerExpanded ? 'Hide' : 'Show'}</span>
                  {isAlertBannerExpanded ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAlertBannerVisible(false)}
                  className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  title="Dismiss alert banner"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-muted mt-1">
              Key raw materials below threshold in central plant inventory
            </p>

            {isAlertBannerExpanded && (
              <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {attentionItems.map((item) => {
                    const isOutOfStock = item.currentStock <= 0;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all ${
                          isOutOfStock
                            ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                            : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                isOutOfStock ? 'text-red-500' : 'text-amber-500'
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  isOutOfStock ? 'bg-red-500' : 'bg-amber-500'
                                }`}
                              />
                              {isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK'}
                            </span>
                            <span className="text-[10px] text-muted font-mono truncate">
                              {item.warehouse}
                            </span>
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-default truncate">
                            {item.name}
                          </h3>
                          <p className="text-[11px] text-muted font-mono">
                            Current:{' '}
                            <strong className={isOutOfStock ? 'text-red-500' : 'text-amber-500'}>
                              {item.currentStock} {item.unit}
                            </strong>{' '}
                            (Min: {item.minThreshold})
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isOutOfStock ? (
                            <button
                              type="button"
                              onClick={() => onOpenOrderPO?.(item)}
                              className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
                            >
                              <ShoppingCart className="size-3.5" />
                              <span>Order PO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenReviewStock?.(item)}
                              className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                            >
                              <Eye className="size-3.5 text-muted" />
                              <span>Review</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-default text-[11px] text-muted">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary shrink-0" />
                    <span>Raw materials can be requisitioned directly via Purchasing.</span>
                  </div>
                  <Link
                    to="/inventory"
                    className="font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View Stock Ledger</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. KPI CARDS ROW (RESPONSIVE: 2 -> 3 -> 6 COLS)
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-default flex items-center gap-2">
              <Factory className="size-4 text-primary" />
              <span>Assembly & Floor Operations</span>
            </h2>
            <p className="text-xs text-muted">
              Live factory shift metrics, piece-rate productivity, and order fulfillment status
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary-subtle rounded-xl border border-primary/20 hover:border-primary/40 transition-colors"
            >
              <Layers className="size-3.5" />
              <span>Production Batches</span>
            </Link>
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors"
            >
              <ClipboardList className="size-3.5 text-muted" />
              <span>Floor Plans</span>
            </Link>
          </div>
        </div>

        {/* 6 Metric KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
          <DashboardKpiCard
            label="TODAY'S TARGET"
            value={currentKPIs.target}
            sub="Production quota"
            icon={<FileText className="size-4" />}
            theme="blue"
            to="/production"
          />
          <DashboardKpiCard
            label="PRODUCED"
            value={currentKPIs.produced}
            sub={`${currentKPIs.achievement}% of target`}
            badge={{
              text: `${currentKPIs.achievement}%`,
              variant: currentKPIs.achievement >= 90 ? 'positive' : 'warning',
            }}
            icon={<TrendingUp className="size-4" />}
            theme="emerald"
            to="/production"
          />
          <DashboardKpiCard
            label="ACTIVE BATCHES"
            value={currentKPIs.pendingOrders}
            sub="In-flight operations"
            icon={<Package className="size-4" />}
            theme="indigo"
            to="/production"
          />
          <DashboardKpiCard
            label="QC PENDING"
            value={currentKPIs.qcPending}
            sub="Inspection buffer"
            badge={currentKPIs.qcPending > 0 ? { text: 'Audit Queue', variant: 'warning' } : undefined}
            icon={<ShieldCheck className="size-4" />}
            theme="amber"
            to="/qc"
          />
          <DashboardKpiCard
            label="REWORK QUEUE"
            value={currentKPIs.reworkQty}
            sub="Defects for rerun"
            badge={currentKPIs.reworkQty > 0 ? { text: 'Attention', variant: 'negative' } : undefined}
            icon={<RotateCcw className="size-4" />}
            theme="rose"
            to="/qc"
          />
          <DashboardKpiCard
            label="YIELD RATE"
            value={currentKPIs.achievement > 0 ? `${currentKPIs.achievement}%` : '100%'}
            sub="Overall floor yield"
            badge={{ text: 'Optimal', variant: 'positive' }}
            icon={<TrendingUp className="size-4" />}
            theme="cyan"
            to="/production"
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. PRODUCTION TREND CHART & INVENTORY RADAR (ROW 1)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Trend Graph */}
        <div className="lg:col-span-8 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-default">Floor Throughput & Yield</h3>
                {isLiveTelemetry && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted">Target vs Produced vs Passed QC</p>
            </div>

            {/* Timeframe selector tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-default bg-surface-sunken p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setTimeframe('today')}
                  className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                    timeframe === 'today'
                      ? 'bg-default text-surface shadow-xs font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('7days')}
                  className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                    timeframe === '7days'
                      ? 'bg-default text-surface shadow-xs font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('30days')}
                  className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                    timeframe === '30days'
                      ? 'bg-default text-surface shadow-xs font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  onClick={onOpenCustomDate}
                  className={`rounded-md px-2.5 py-1 flex items-center gap-1 transition-all cursor-pointer ${
                    timeframe === 'custom'
                      ? 'bg-default text-surface shadow-xs font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  <Calendar className="size-3" />
                  <span>{customRangeLabel ?? 'Custom'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsLiveTelemetry(!isLiveTelemetry)}
                title="Toggle Real-Time Telemetry Stream"
                className={`rounded-lg p-1.5 border transition-colors cursor-pointer ${
                  isLiveTelemetry
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600'
                    : 'border-default bg-surface text-muted hover:text-default'
                }`}
              >
                <Radio className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Recharts Area/Line Chart with min-w-0 for flex safety */}
          <div className="h-64 sm:h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientProducedView" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const producedVal = Number(
                        payload.find((p) => p.dataKey === 'produced')?.value ?? 0
                      );
                      const qcVal = Number(
                        payload.find((p) => p.dataKey === 'qcPassed')?.value ?? 0
                      );
                      const targetVal = Number(
                        payload.find((p) => p.dataKey === 'target')?.value ?? 0
                      );
                      const yieldPct =
                        producedVal > 0 ? ((qcVal / producedVal) * 100).toFixed(1) : '100';

                      return (
                        <div className="rounded-xl border border-default bg-surface-raised p-3 shadow-xl text-xs space-y-1.5">
                          <p className="font-bold text-default">{label}</p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center justify-between gap-4 text-blue-500">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-blue-500" />
                                Produced:
                              </span>
                              <strong className="font-mono">{producedVal} pcs</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-emerald-500">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-emerald-500" />
                                QC Passed:
                              </span>
                              <strong className="font-mono">
                                {qcVal} pcs ({yieldPct}%)
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-slate-400" />
                                Target:
                              </span>
                              <strong className="font-mono">{targetVal} pcs</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="produced"
                  name="Produced"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fill="url(#gradientProducedView)"
                />
                <Line
                  type="monotone"
                  dataKey="qcPassed"
                  name="QC Passed"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 text-[11px] font-semibold text-muted pt-2 border-t border-default/60">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              Produced Output
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Passed Quality Inspection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-slate-400" />
              Plan Target
            </span>
          </div>
        </div>

        {/* Right Column (4 cols): Raw Material Stock & Warehouse Distribution */}
        <div className="lg:col-span-4 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-default">Warehouse Floor Stock</h3>
            <Link to="/inventory" className="text-xs font-semibold text-primary hover:underline">
              Full Ledger
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-default bg-surface-sunken p-3 space-y-1">
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
                {metrics?.inventory?.low_stock_count ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-muted">Stock Alerts</div>
              <div className="text-xs font-bold font-mono text-default truncate">
                {formatCurrency(metrics?.inventory?.total_valuation ?? 0)}
              </div>
              <div className="text-[9px] text-muted">Total Valuation</div>
            </div>

            <div className="rounded-xl border border-default bg-surface-sunken p-3 space-y-1">
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
                {attentionItems.length}
              </div>
              <div className="text-[10px] font-semibold text-muted">Attention Items</div>
              <div className="text-xs font-bold font-mono text-default">
                {attentionItems.filter((i) => i.currentStock <= 0).length} Stockouts
              </div>
              <div className="text-[9px] text-muted">Action Required</div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-default/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              WAREHOUSE CAPACITY ALLOCATION
            </span>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-default truncate">Raw Materials Staging</span>
                <span className="font-mono text-muted shrink-0">82%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: '82%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-default truncate">Assembly Line Buffer</span>
                <span className="font-mono text-muted shrink-0">64%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: '64%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-default truncate">Finished Goods Quarantine</span>
                <span className="font-mono text-muted shrink-0">48%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: '48%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. ACTIVE PRODUCTION BATCHES & QC QUEUE (ROW 2)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Active Batches Table (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-default pb-3">
            <div>
              <h3 className="text-sm font-bold text-default">Active Production Batches</h3>
              <p className="text-[11px] text-muted">Multi-stage factory work orders in progress</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-default bg-surface-sunken p-0.5 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setOrderFilter('all')}
                  className={`rounded-md px-2 py-0.5 transition-colors cursor-pointer ${
                    orderFilter === 'all'
                      ? 'bg-default text-surface font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter('QC PENDING')}
                  className={`rounded-md px-2 py-0.5 transition-colors cursor-pointer ${
                    orderFilter === 'QC PENDING'
                      ? 'bg-default text-surface font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  QC Pending
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter('READY')}
                  className={`rounded-md px-2 py-0.5 transition-colors cursor-pointer ${
                    orderFilter === 'READY'
                      ? 'bg-default text-surface font-bold'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  In Assembly
                </button>
              </div>

              <Link to="/production" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-default w-full">
            <table className="w-full text-left text-xs min-w-125">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-3.5 py-2.5">BATCH CODE</th>
                  <th className="px-3.5 py-2.5">PRODUCT</th>
                  <th className="px-3.5 py-2.5">TARGET</th>
                  <th className="px-3.5 py-2.5">OUTPUT</th>
                  <th className="px-3.5 py-2.5">PROGRESS</th>
                  <th className="px-3.5 py-2.5">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted text-xs">
                      No active production batches matching current filter
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => onOpenOrder?.(ord)}
                      className="hover:bg-surface-sunken/60 cursor-pointer transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-mono font-bold text-primary">{ord.id}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-default truncate max-w-44">
                          {ord.product}
                        </div>
                        <div className="text-[10px] text-muted font-mono">{ord.code}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold">{ord.target}</td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold">{ord.produced}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 rounded-full bg-surface-sunken overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${ord.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted">{ord.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ord.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : ord.status === 'QC PENDING'
                                ? 'bg-amber-500/15 text-amber-600'
                                : 'bg-blue-500/15 text-blue-600'
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Control Audits Queue (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <div>
              <h3 className="text-sm font-bold text-default">Quality Inspection Queue</h3>
              <p className="text-[11px] text-muted">AQL sampling and parameter testing</p>
            </div>
            <Link to="/qc" className="text-xs font-semibold text-primary hover:underline">
              QC Desk
            </Link>
          </div>

          <div className="space-y-2.5">
            {qcList.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">No pending QC inspections</div>
            ) : (
              qcList.map((qc) => (
                <button
                  type="button"
                  key={qc.id}
                  onClick={() => onOpenQC?.(qc)}
                  className="w-full text-left group rounded-xl border border-default bg-surface-sunken/30 hover:border-primary/40 hover:bg-surface-sunken p-3 transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-primary">{qc.id}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          qc.status === 'PASSED'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : qc.status === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-blue-500/15 text-blue-600'
                        }`}
                      >
                        <span className="size-1 rounded-full bg-current" />
                        {qc.status}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-default">{qc.qty} pcs</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-default truncate">{qc.product}</span>
                    <span className="text-[10px] text-muted font-mono">{qc.orderNo}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-default">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2 text-center">
              <div className="text-sm sm:text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                {metrics?.quality?.pending_inspections ?? 0}
              </div>
              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                PENDING
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2 text-center">
              <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {metrics?.quality?.qc_pass_rate ? `${Math.round(metrics.quality.qc_pass_rate)}%` : '100%'}
              </div>
              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                PASS RATE
              </div>
            </div>
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-2 text-center">
              <div className="text-sm sm:text-base font-extrabold font-mono text-orange-600 dark:text-orange-400">
                0
              </div>
              <div className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase">
                REWORK
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. FLOOR WORKERS LEADERBOARD & PIECE-RATE OUTPUT (ROW 3)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Workers Leaderboard (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <div>
              <h3 className="text-sm font-bold text-default">Floor Assembly Workers</h3>
              <p className="text-[11px] text-muted">Hourly output rate, shift logs & piece-rate metrics</p>
            </div>
            <Link to="/hr" className="text-xs font-semibold text-primary hover:underline">
              Workforce Roster
            </Link>
          </div>

          <div className="space-y-3">
            {workers.map((w) => (
              <button
                type="button"
                key={w.name}
                onClick={() => onOpenWorker?.(w)}
                className="w-full text-left group rounded-xl border border-default bg-surface-sunken/30 hover:border-primary/40 hover:bg-surface-sunken p-3 transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-full bg-surface-sunken font-bold text-xs text-default border border-default">
                      {w.initials}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-default group-hover:text-primary transition-colors">
                        {w.name}
                      </span>
                      <span className="block text-[10px] text-muted font-mono">{w.output}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-default">{w.rate}%</span>
                    <span className="block text-[9px] text-muted">{w.badge}</span>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                  <div className={`h-full rounded-full ${w.color}`} style={{ width: `${w.rate}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Commercial Sales Mini Table (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <div>
              <h3 className="text-sm font-bold text-default">Sales Orders Invoiced</h3>
              <p className="text-[11px] text-muted">Ready for dispatch to retail & wholesale</p>
            </div>
            <Link to="/sales" className="text-xs font-semibold text-primary hover:underline">
              Commercial Desk
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-default w-full">
            <table className="w-full text-left text-xs min-w-[320px]">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-3 py-2">INVOICE</th>
                  <th className="px-3 py-2">CUSTOMER</th>
                  <th className="px-3 py-2 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filteredInvoices.slice(0, 4).map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => onOpenInvoice?.(inv)}
                    className="hover:bg-surface-sunken/60 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 font-mono font-bold text-primary">{inv.id}</td>
                    <td className="px-3 py-2 font-medium text-default truncate max-w-28">
                      {inv.customer}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-default text-right">
                      {inv.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-default flex items-center justify-between text-[11px] text-muted">
            <span>Today's Total Invoiced</span>
            <span className="font-mono font-bold text-default">
              {formatCurrency(metrics?.commercial?.today_revenue ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
