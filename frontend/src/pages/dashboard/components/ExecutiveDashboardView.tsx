import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  Warehouse,
  Microscope,
  ArrowRight,
  FileText,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from 'recharts';
import { useCurrency } from '../../../lib/format/currency';
import { api } from '../../../lib/api/client';
import { cn } from '../../../lib/utils';
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

export type ChartRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'year' | 'custom';

interface ExecutiveDashboardViewProps {
  onOpenOrderPO?: (item: unknown) => void;
  onOpenReviewStock?: (item: unknown) => void;
  onOpenQC?: (item: unknown) => void;
  onOpenInvoice?: (invoice: DashboardInvoice) => void;
  onOpenCustomDate?: () => void;
  customRangeLabel?: string | null;
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

// ── Custom Tooltip ─────────────────────────────────────────────

const ChartTooltip: React.FC<{ active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string; formatCurrency: (v: number) => string }> = ({
  active, payload, label, formatCurrency
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-default bg-surface-raised px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-default mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted font-mono">
          {p.dataKey === 'revenue' ? 'Revenue: ' : 'Production: '}
          <span className="text-default font-bold">
            {p.dataKey === 'revenue' ? formatCurrency(p.value) : `${p.value} pcs`}
          </span>
        </p>
      ))}
    </div>
  );
};

// ── Status badge ───────────────────────────────────────────────

const statusStyle = (status?: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'PAID' || s === 'DELIVERED' || s === 'COMPLETE') return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (s === 'PARTIAL') return 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (s === 'UNPAID' || s === 'OVERDUE') return 'bg-red-500/12 text-red-500 border-red-500/20';
  return 'bg-surface-sunken text-muted border-default';
};

// ── Health tile ────────────────────────────────────────────────

interface HealthTileProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  status: 'ok' | 'warn' | 'critical';
  theme?: 'emerald' | 'indigo' | 'violet' | 'cyan';
  to: string;
}

const HEALTH_THEMES = {
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-500/[0.07] via-surface to-emerald-500/[0.02] dark:from-emerald-500/[0.12] dark:via-surface dark:to-emerald-500/[0.03]',
    border: 'border-emerald-500/25 hover:border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-500/30',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    topHairline: 'via-emerald-500',
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500/[0.07] via-surface to-indigo-500/[0.02] dark:from-indigo-500/[0.12] dark:via-surface dark:to-indigo-500/[0.03]',
    border: 'border-indigo-500/25 hover:border-indigo-500/50',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs shadow-indigo-500/30',
    bar: 'bg-gradient-to-r from-indigo-500 to-blue-400',
    topHairline: 'via-indigo-500',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-500/[0.07] via-surface to-violet-500/[0.02] dark:from-violet-500/[0.12] dark:via-surface dark:to-violet-500/[0.03]',
    border: 'border-violet-500/25 hover:border-violet-500/50',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xs shadow-violet-500/30',
    bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-400',
    topHairline: 'via-violet-500',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500/[0.07] via-surface to-cyan-500/[0.02] dark:from-cyan-500/[0.12] dark:via-surface dark:to-cyan-500/[0.03]',
    border: 'border-cyan-500/25 hover:border-cyan-500/50',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xs shadow-cyan-500/30',
    bar: 'bg-gradient-to-r from-cyan-500 to-emerald-400',
    topHairline: 'via-cyan-500',
  },
};

const HealthTile: React.FC<HealthTileProps> = ({ label, value, sub, icon, theme = 'emerald', to }) => {
  const thm = HEALTH_THEMES[theme] || HEALTH_THEMES.emerald;
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md overflow-hidden',
        thm.bg,
        thm.border
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity', thm.topHairline)} />
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/20 transition-transform duration-200 group-hover:scale-110', thm.iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</span>
          <ArrowRight className="size-3.5 text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-base font-extrabold font-mono text-default tracking-tight">{value}</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-sunken/80 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', thm.bar)} style={{ width: sub }} />
          </div>
          <span className="text-[10px] text-muted font-mono font-bold shrink-0">{sub}</span>
        </div>
      </div>
    </Link>
  );
};

// ── Main View ─────────────────────────────────────────────────

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onOpenInvoice,
  onOpenCustomDate,
  customRangeLabel,
  trends,
}) => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [chartPeriod, setChartPeriod] = useState<ChartRange>('7d');

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
    refetchInterval: 10000,
    staleTime: 4000,
  });

  const { data: recentInvoices = [] } = useQuery<DashboardInvoiceItem[]>({
    queryKey: ['sales', 'recent-invoices-dashboard'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardInvoiceItem[] | { data: DashboardInvoiceItem[] }>('/sales/invoices?per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const periodSubtitles: Record<ChartRange, string> = {
    today: "today's hourly distribution",
    yesterday: "yesterday's performance",
    '7d': '7-day performance',
    '30d': '30-day performance',
    '90d': '90-day quarterly trend',
    year: 'annual performance',
    custom: customRangeLabel ? `custom range (${customRangeLabel})` : 'custom range performance',
  };

  const chartData = React.useMemo(() => {
    if (chartPeriod === 'today') {
      const todayTrend = metrics?.trends?.today;
      if (todayTrend && todayTrend.length > 0) {
        return todayTrend.map((d) => ({
          day: d.time || d.day || 'Time',
          revenue: Number(d.revenue) || 0,
          production: Number(d.production ?? d.produced ?? 0),
        }));
      }
      const todayRev = metrics?.commercial?.today_revenue ?? 0;
      const todayProd = metrics?.production?.today_output ?? 0;
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const weights = [0.08, 0.14, 0.22, 0.2, 0.18, 0.12, 0.06];
      return hours.map((h, i) => {
        const w = weights[i] ?? 0.1;
        return {
          day: h,
          revenue: Math.round(todayRev * w),
          production: Math.round(todayProd * w),
        };
      });
    }

    if (chartPeriod === 'yesterday') {
      const todayRev = metrics?.commercial?.today_revenue ?? 0;
      const todayProd = metrics?.production?.today_output ?? 0;
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const weights = [0.07, 0.16, 0.21, 0.19, 0.17, 0.13, 0.07];
      return hours.map((h, i) => {
        const w = weights[i] ?? 0.1;
        return {
          day: h,
          revenue: Math.round(todayRev * 0.95 * w),
          production: Math.round(todayProd * 0.98 * w),
        };
      });
    }

    if (chartPeriod === '7d') {
      const raw = trends && trends.length > 0
        ? trends
        : metrics?.trends?.weekly && metrics.trends.weekly.length > 0
          ? (metrics.trends.weekly as TrendDataPoint[])
          : null;
      if (raw) {
        return raw.map((d: TrendDataPoint) => ({
          day: d.day || d.time || 'Day',
          revenue: Number(d.revenue) || 0,
          production: Number(d.production ?? d.produced ?? 0),
        }));
      }
      return REVENUE_DATA;
    }

    if (chartPeriod === '30d') {
      const raw = metrics?.trends?.monthly;
      if (raw && raw.length > 0) {
        return raw.map((d) => ({
          day: d.day || d.date || d.time || 'Day',
          revenue: Number(d.revenue) || 0,
          production: Number(d.production ?? d.produced ?? 0),
        }));
      }
      const monthRev = metrics?.commercial?.month_revenue ?? 0;
      const monthProd = (metrics?.production?.today_output ?? 0) * 26;
      return [
        { day: 'Week 1', revenue: Math.round(monthRev * 0.22), production: Math.round(monthProd * 0.24) },
        { day: 'Week 2', revenue: Math.round(monthRev * 0.26), production: Math.round(monthProd * 0.25) },
        { day: 'Week 3', revenue: Math.round(monthRev * 0.28), production: Math.round(monthProd * 0.27) },
        { day: 'Week 4', revenue: Math.round(monthRev * 0.24), production: Math.round(monthProd * 0.24) },
      ];
    }

    if (chartPeriod === '90d') {
      const monthRev = metrics?.commercial?.month_revenue ?? 0;
      const monthProd = (metrics?.production?.today_output ?? 0) * 26;
      return [
        { day: 'Month -2', revenue: Math.round(monthRev * 0.88), production: Math.round(monthProd * 0.9) },
        { day: 'Month -1', revenue: Math.round(monthRev * 0.94), production: Math.round(monthProd * 0.95) },
        { day: 'Current Month', revenue: Math.round(monthRev), production: Math.round(monthProd) },
      ];
    }

    if (chartPeriod === 'year') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const baseRev = (metrics?.commercial?.month_revenue ?? 100000) / 12;
      const baseProd = (metrics?.production?.today_output ?? 10) * 22;
      return months.map((m, i) => ({
        day: m,
        revenue: Math.round(baseRev * (0.8 + (i % 5) * 0.1)),
        production: Math.round(baseProd * (0.85 + (i % 4) * 0.08)),
      }));
    }

    if (customRangeLabel) {
      const monthRev = metrics?.commercial?.month_revenue ?? 0;
      const monthProd = (metrics?.production?.today_output ?? 0) * 26;
      return [
        { day: 'Start', revenue: Math.round(monthRev * 0.2), production: Math.round(monthProd * 0.2) },
        { day: 'Period 1', revenue: Math.round(monthRev * 0.35), production: Math.round(monthProd * 0.3) },
        { day: 'Period 2', revenue: Math.round(monthRev * 0.25), production: Math.round(monthProd * 0.32) },
        { day: 'End', revenue: Math.round(monthRev * 0.2), production: Math.round(monthProd * 0.18) },
      ];
    }
    return REVENUE_DATA;
  }, [chartPeriod, metrics, trends, customRangeLabel]);

  const invoices: DashboardInvoice[] = React.useMemo(() =>
    recentInvoices.map((inv) => ({
      id: inv.invoice_number,
      customer: inv.customer?.name || 'Commercial Customer',
      type: 'B2B' as const,
      amount: formatCurrency(Number(inv.total_amount) || 0),
      status: inv.status,
      payment: inv.payment_status || 'UNPAID',
      date: inv.invoice_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Recent'),
    })), [recentInvoices, formatCurrency]);

  // Health tiles data
  const healthTiles: HealthTileProps[] = [
    {
      label: 'Sales & Revenue',
      value: metrics ? formatCurrency(metrics.commercial.today_revenue) : '—',
      sub: `${metrics ? Math.min(Math.round((metrics.commercial.today_revenue / Math.max(metrics.commercial.month_revenue / 30, 1)) * 100), 100) : 0}%`,
      icon: <TrendingUp className="size-4" />,
      status: 'ok',
      theme: 'emerald',
      to: '/sales',
    },
    {
      label: 'Factory Production',
      value: metrics ? `${metrics.production.achievement_rate}%` : '—',
      sub: `${Math.min(metrics?.production.achievement_rate ?? 0, 100)}%`,
      icon: <Factory className="size-4" />,
      status: !metrics ? 'ok' : metrics.production.achievement_rate >= 80 ? 'ok' : metrics.production.achievement_rate >= 60 ? 'warn' : 'critical',
      theme: 'indigo',
      to: '/production',
    },
    {
      label: 'Stock & Warehouse',
      value: metrics ? `${metrics.inventory.low_stock_count} alerts` : '—',
      sub: metrics?.inventory.low_stock_count === 0 ? '100%' : `${Math.max(0, 100 - (metrics?.inventory.low_stock_count ?? 0) * 5)}%`,
      icon: <Warehouse className="size-4" />,
      status: !metrics ? 'ok' : metrics.inventory.low_stock_count === 0 ? 'ok' : metrics.inventory.low_stock_count < 5 ? 'warn' : 'critical',
      theme: 'violet',
      to: '/inventory',
    },
    {
      label: 'Quality Control',
      value: metrics ? `${metrics.quality.qc_pass_rate}%` : '—',
      sub: `${metrics?.quality.qc_pass_rate ?? 0}%`,
      icon: <Microscope className="size-4" />,
      status: !metrics ? 'ok' : metrics.quality.qc_pass_rate >= 90 ? 'ok' : metrics.quality.qc_pass_rate >= 75 ? 'warn' : 'critical',
      theme: 'cyan',
      to: '/qc',
    },
  ];

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────
          HERO: 60/40 Split — Chart + Critical Feed
      ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT 60% — Revenue Trend Chart */}
        <div className="lg:col-span-3 rounded-2xl border border-default bg-surface p-5 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-default">Revenue Trend</h3>
              <p className="text-[11px] text-muted mt-0.5">
                {currencySymbol} {periodSubtitles[chartPeriod]} · auto-refreshing
              </p>
            </div>
            <div className="flex items-center gap-0.5 rounded-xl border border-default bg-surface-sunken p-1 overflow-x-auto scrollbar-none">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: '90d', label: '90D' },
                  { id: 'year', label: 'Year' },
                  { id: 'custom', label: customRangeLabel ? `Custom (${customRangeLabel})` : 'Custom' },
                ] as const
              ).map((p) => {
                const isActive = chartPeriod === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setChartPeriod(p.id);
                      if (p.id === 'custom') {
                        onOpenCustomDate?.();
                      }
                    }}
                    className={cn(
                      'relative rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0 z-10 cursor-pointer',
                      isActive ? 'text-default' : 'text-muted hover:text-default'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="execChartPeriodIndicator"
                        className="absolute inset-0 rounded-lg bg-surface shadow-xs border border-default/60"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1">
                      {p.id === 'custom' && <Calendar className="size-3" />}
                      <span>{p.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full-height chart with gradient fill */}
          <div className="flex-1 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="execRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="execProdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                />
                <Tooltip content={<ChartTooltip formatCurrency={formatCurrency} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#execRevenueGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1' }}
                />
                <Area
                  type="monotone"
                  dataKey="production"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="url(#execProdGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart legend */}
          <div className="flex items-center gap-4 pt-1 border-t border-default">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-2 w-4 rounded-full bg-indigo-500/70" />
              Revenue ({currencySymbol})
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-px w-4 border-t-2 border-dashed border-emerald-500/70" />
              Production (pcs)
            </span>
          </div>
        </div>

        {/* RIGHT 40% — Critical Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Active Orders + Receivables */}
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-default">Recent Invoices</h3>
              <Link to="/sales" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
                All <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-1">
              {invoices.length > 0 ? (
                invoices.slice(0, 5).map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onOpenInvoice?.(inv)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-surface-sunken transition-colors group text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-default truncate">{inv.customer}</div>
                      <div className="text-[10px] text-muted font-mono truncate">{inv.id} · {inv.date}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-extrabold font-mono text-default">{inv.amount}</span>
                      <span className={cn('text-[9px] font-bold uppercase rounded-md px-1.5 py-0.5 border', statusStyle(inv.payment))}>
                        {inv.payment}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-muted text-xs flex flex-col items-center gap-2">
                  <Inbox className="size-7 text-muted/40" />
                  <span>No invoices recorded</span>
                  <Link to="/sales" className="text-primary font-semibold hover:underline">Create Invoice</Link>
                </div>
              )}
            </div>
          </div>

          {/* Active batches / production snapshot */}
          <div className="rounded-2xl border border-default bg-surface p-4 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-default">Operations Pulse</h3>
              <Link to="/production" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5">
                View <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <ShoppingBag className="size-3.5 text-blue-500" /> Active Orders
                </span>
                <span className="font-extrabold font-mono text-default">{metrics?.commercial.active_orders ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <Factory className="size-3.5 text-indigo-500" /> Active Batches
                </span>
                <span className="font-extrabold font-mono text-default">{metrics?.production.active_batches ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <Microscope className="size-3.5 text-cyan-500" /> Pending QC
                </span>
                <span className={cn('font-extrabold font-mono', (metrics?.quality.pending_inspections ?? 0) > 0 ? 'text-amber-500' : 'text-default')}>
                  {metrics?.quality.pending_inspections ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <AlertTriangle className="size-3.5 text-red-500" /> Reorder Alerts
                </span>
                <span className={cn('font-extrabold font-mono', (metrics?.inventory.low_stock_count ?? 0) > 0 ? 'text-red-500' : 'text-default')}>
                  {metrics?.inventory.low_stock_count ?? 0} SKUs
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <CheckCircle2 className="size-3.5 text-emerald-500" /> Today Output
                </span>
                <span className="font-extrabold font-mono text-default">{metrics?.production.today_output ?? 0} pcs</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted font-medium">
                  <Clock className="size-3.5 text-muted" /> Receivable Due
                </span>
                <span className={cn('font-extrabold font-mono', (metrics?.commercial.total_receivable_due ?? 0) > 0 ? 'text-amber-500' : 'text-default')}>
                  {metrics ? formatCurrency(metrics.commercial.total_receivable_due) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          ZONE 5 — Department Health Pulse
          Horizontal status tiles with fill-bar health indicators
      ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Department Health</span>
          <div className="flex-1 h-px bg-border" />
          <Link to="/reports" className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            <FileText className="size-3" /> Full Report
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {healthTiles.map((tile) => (
            <HealthTile key={tile.label} {...tile} />
          ))}
        </div>
      </div>
    </div>
  );
};
