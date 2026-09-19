import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  Warehouse,
  Microscope,
  Cpu,
  ArrowRight,
  FileText,
  ShoppingCart,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useCurrency } from '../../../lib/format/currency';
import { api } from '../../../lib/api/client';
import type { DashboardMetricsData, DashboardInvoiceItem } from '../../../types/api/dashboard';
import type { DashboardInvoice } from './SalesDashboardView';

export interface TrendDataPoint {
  day?: string;
  time?: string;
  date?: string;
  revenue: number;
  production?: number;
  produced?: number;
  target?: number;
}

interface ExecutiveDashboardViewProps {
  onOpenOrderPO?: (item: unknown) => void;
  onOpenReviewStock?: (item: unknown) => void;
  onOpenQC?: (item: unknown) => void;
  onOpenInvoice?: (invoice: DashboardInvoice) => void;
  trends?: TrendDataPoint[] | undefined;
}

const REVENUE_DATA = [
  { day: 'Mon', revenue: 0, production: 0 },
  { day: 'Tue', revenue: 0, production: 0 },
  { day: 'Wed', revenue: 0, production: 0 },
  { day: 'Thu', revenue: 0, production: 0 },
  { day: 'Fri', revenue: 0, production: 0 },
  { day: 'Sat', revenue: 0, production: 0 },
  { day: 'Sun', revenue: 0, production: 0 },
];

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onOpenInvoice,
  trends,
}) => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const { t } = useTranslation(['dashboard', 'common']);

  const { data: metrics } = useQuery<DashboardMetricsData | null>({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>(
          '/dashboard/metrics'
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('commercial' in raw) return raw as DashboardMetricsData;
          if (
            'data' in raw &&
            raw.data &&
            typeof raw.data === 'object' &&
            'commercial' in raw.data
          ) {
            return raw.data as DashboardMetricsData;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    refetchInterval: 10000,
    staleTime: 4000,
  });

  const chartData = React.useMemo(() => {
    const raw =
      trends && trends.length > 0
        ? trends
        : metrics?.trends?.weekly && metrics.trends.weekly.length > 0
          ? (metrics.trends.weekly as TrendDataPoint[])
          : null;
    if (!raw) return REVENUE_DATA;
    return raw.map((d: TrendDataPoint) => ({
      day: d.day || d.time || 'Day',
      revenue: Number(d.revenue) || 0,
      production: Number(d.production ?? d.produced ?? 0),
      target: Number(d.target ?? 50),
    }));
  }, [trends, metrics?.trends?.weekly]);

  const { data: recentInvoices = [] } = useQuery<DashboardInvoiceItem[]>({
    queryKey: ['sales', 'recent-invoices-dashboard'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardInvoiceItem[] | { data: DashboardInvoiceItem[] }>(
          '/sales/invoices?per_page=4'
        );
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
  });
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & EXECUTIVE GREETING
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-default font-sans">
              {t('controls.operationsOverview')}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('controls.allSystemsOperational')}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            {t('controls.enterpriseSummary')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/reports"
            className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all shadow-2xs"
          >
            <FileText className="size-3.5 text-muted" />
            <span>{t('controls.rmsReports')}</span>
          </Link>
          <Link
            to="/pos"
            className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 transition-all"
          >
            <ShoppingCart className="size-3.5" />
            <span>{t('controls.posTerminal')}</span>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 6-KPI EXECUTIVE STRIP
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Total Revenue */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.todayRevenue')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? formatCurrency(metrics.commercial.today_revenue) : formatCurrency(0)}
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t('kpi.month')}:{' '}
              {metrics ? formatCurrency(metrics.commercial.month_revenue) : formatCurrency(0)}
            </span>
          </div>
        </div>

        {/* KPI 2: Active Orders */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.activeOrders')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? t('kpi.ordersCount', { count: metrics.commercial.active_orders }) : t('kpi.ordersCount', { count: 0 })}
            </div>
            <span className="text-[10px] font-semibold text-muted">
              {t('kpi.due')}:{' '}
              {metrics
                ? formatCurrency(metrics.commercial.total_receivable_due)
                : formatCurrency(0)}
            </span>
          </div>
        </div>

        {/* KPI 3: Factory Production */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.todayOutput')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Factory className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? t('kpi.pcsCount', { count: metrics.production.today_output }) : t('kpi.pcsCount', { count: 0 })}
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics
                ? t('kpi.targetAchieved', { percent: metrics.production.achievement_rate })
                : t('kpi.targetAchieved', { percent: 0 })}
            </span>
          </div>
        </div>

        {/* KPI 4: Inventory Valuation */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.stockValuation')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Warehouse className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? formatCurrency(metrics.inventory.total_valuation) : formatCurrency(0)}
            </div>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {metrics
                ? t('kpi.reorderWarnings', { count: metrics.inventory.low_stock_count })
                : t('kpi.reorderWarnings', { count: 0 })}
            </span>
          </div>
        </div>

        {/* KPI 5: QC Pass Rate */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.qcPassRateTitle')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Microscope className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? `${metrics.quality.qc_pass_rate}%` : '100%'}
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics ? t('kpi.pendingTests', { count: metrics.quality.pending_inspections }) : t('kpi.pendingTests', { count: 0 })}
            </span>
          </div>
        </div>

        {/* KPI 6: Line Capacity */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {t('kpi.facilityCapacity')}
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Cpu className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default">
              {metrics ? `${metrics.production.achievement_rate}%` : '0%'}
            </div>
            <span className="text-[10px] font-semibold text-muted">
              {metrics ? t('kpi.activeBatches', { count: metrics.production.active_batches }) : t('kpi.activeBatches', { count: 0 })}
            </span>
          </div>
        </div>
      </div>



      {/* ─────────────────────────────────────────────────────────────
          4. CROSS-DEPARTMENT OPERATIONAL HEALTH MATRIX
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commercial Department */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div>
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-blue-500" />
                <span className="text-xs font-bold text-default">{t('cards.commercialPos')}</span>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {metrics ? t('kpi.ordersCount', { count: metrics.commercial.active_orders }) : t('kpi.ordersCount', { count: 0 })}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.todayRevenue')}:</span>
                <strong className="text-default font-mono">
                  {metrics ? formatCurrency(metrics.commercial.today_revenue) : formatCurrency(0)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.invoicesPending')}:</span>
                <strong className="text-amber-500 font-mono">
                  {metrics
                    ? formatCurrency(metrics.commercial.total_receivable_due)
                    : formatCurrency(0)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.posRegister')}:</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {t('cards.terminalOnline')}
                </span>
              </div>
            </div>
          </div>
          <Link
            to="/sales"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default"
          >
            <span>Open Commercial Hub</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Factory Production */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div>
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <Factory className="size-4 text-indigo-500" />
                <span className="text-xs font-bold text-default">{t('cards.factoryFloor')}</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {metrics ? `${metrics.production.achievement_rate}% Output` : '0% Output'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.unitsProduced')}:</span>
                <strong className="text-default font-mono">
                  {metrics
                    ? `${metrics.production.today_output} / ${metrics.production.target_output || 0} pcs`
                    : '0 pcs'}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.activeBatches')}:</span>
                <strong className="text-default font-mono">
                  {metrics ? `${metrics.production.active_batches} ${t('cards.inProgress')}` : `0 ${t('cards.inProgress')}`}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.shiftStatus')}:</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {t('cards.activeShift')}
                </span>
              </div>
            </div>
          </div>
          <Link
            to="/production"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default"
          >
            <span>View Factory Floor</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Warehouse & Inventory */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div>
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <Warehouse className="size-4 text-amber-500" />
                <span className="text-xs font-bold text-default">{t('cards.warehouseStock')}</span>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {metrics ? t('cards.lowItems', { count: metrics.inventory.low_stock_count }) : t('cards.lowItems', { count: 0 })}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.valuation')}:</span>
                <strong className="text-default font-mono">
                  {metrics ? formatCurrency(metrics.inventory.total_valuation) : formatCurrency(0)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.stockStatus')}:</span>
                <strong className="text-default font-mono">
                  {metrics && metrics.inventory.low_stock_count > 0 ? t('kpi.reorderWarnings', { count: metrics.inventory.low_stock_count }) : t('cards.normal')}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t('cards.ledgerTracking')}:</span>
                <span className="text-blue-500 font-semibold">{t('cards.activeRealtime')}</span>
              </div>
            </div>
          </div>
          <Link
            to="/inventory"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default"
          >
            <span>Open Warehouse Ledger</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Quality Assurance */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all">
          <div>
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <Microscope className="size-4 text-cyan-500" />
                <span className="text-xs font-bold text-default">{t('cards.qualityAssurance')}</span>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                {metrics ? `${metrics.quality.qc_pass_rate}% Pass` : '100% Pass'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Compliance:</span>
                <strong className="text-default font-mono">ISO Standard</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Queue Pending:</span>
                <strong className="text-amber-500 font-mono">
                  {metrics ? `${metrics.quality.pending_inspections} Inspections` : '0 Pending'}
                </strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Audits:</span>
                <span className="text-muted font-semibold">Live Monitored</span>
              </div>
            </div>
          </div>
          <Link
            to="/qc"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default"
          >
            <span>Audit QA Queue</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. DUAL PERFORMANCE TRENDS & RECENT TRANSACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Revenue & Production Output Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-default">Commercial & Production Trends</h3>
              <p className="text-[11px] text-muted">
                Weekly revenue correlation with manufacturing output
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Revenue ({currencySymbol})
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Output (pcs)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="execRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="execProdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  opacity={0.07}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.6 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.6 }}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    String(name) === 'revenue'
                      ? formatCurrency(Number(value) || 0)
                      : `${String(value)} pcs`,
                    String(name) === 'revenue' ? 'Revenue' : 'Production Output',
                  ]}
                  contentStyle={{
                    backgroundColor: 'var(--surface-raised, #18181b)',
                    borderColor: 'var(--border-default, #27272a)',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#execRevenueGrad)"
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="production"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#execProdGrad)"
                  name="production"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent High-Priority Transactions */}
        <div className="rounded-2xl border border-default bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-default pb-2">
              <h3 className="text-sm font-bold text-default">Executive Activity</h3>
              <span className="text-[10px] text-muted uppercase font-semibold">Live Audit</span>
            </div>
            <div className="space-y-3">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() =>
                      onOpenInvoice?.({
                        id: inv.invoice_number,
                        customer: inv.customer?.name || 'Commercial Customer',
                        type: 'B2B',
                        amount: formatCurrency(Number(inv.total_amount) || 0),
                        status: inv.status,
                        payment: inv.payment_status || 'UNPAID',
                      })
                    }
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-xl hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0 mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-default truncate">
                        {inv.customer?.name || 'Direct Customer'}
                      </div>
                      <div className="text-[10px] text-muted">
                        Invoice {inv.invoice_number} •{' '}
                        {formatCurrency(Number(inv.total_amount) || 0)}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted uppercase">{inv.status}</span>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-muted text-xs flex flex-col items-center justify-center gap-2">
                  <Inbox className="size-8 text-muted/50" />
                  <p>No recent transactions recorded.</p>
                  <Link to="/sales" className="text-xs text-primary font-semibold hover:underline">
                    Create Commercial Order
                  </Link>
                </div>
              )}
            </div>
          </div>

          <Link
            to="/activity-logs"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default"
          >
            <span>View Full Audit Trail</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
