import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  Warehouse,
  Microscope,
  ArrowRight,
  FileText,
  ShoppingCart,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Clock,
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

const statusStyle = (status: string) => {
  const s = status.toUpperCase();
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
  to: string;
}

const HealthTile: React.FC<HealthTileProps> = ({ label, value, sub, icon, status, to }) => {
  const bar = { ok: 'bg-emerald-500', warn: 'bg-amber-500', critical: 'bg-red-500' }[status];
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-default bg-surface hover:bg-surface-sunken p-3 transition-all hover:border-primary/30"
    >
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', {
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20': status === 'ok',
        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20': status === 'warn',
        'bg-red-500/10 text-red-500 border-red-500/20': status === 'critical',
      })}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</span>
          <ArrowRight className="size-3 text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-sm font-extrabold font-mono text-default">{value}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-surface-sunken overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: sub }} />
          </div>
          <span className="text-[10px] text-muted font-mono shrink-0">{sub}</span>
        </div>
      </div>
    </Link>
  );
};

// ── Main View ─────────────────────────────────────────────────

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({ onOpenInvoice, trends }) => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('weekly');

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

  const chartData = React.useMemo(() => {
    const raw = trends && trends.length > 0
      ? trends
      : metrics?.trends?.weekly && metrics.trends.weekly.length > 0
        ? (metrics.trends.weekly as TrendDataPoint[])
        : null;
    if (!raw) return REVENUE_DATA;
    return raw.map((d: TrendDataPoint) => ({
      day: d.day || d.time || 'Day',
      revenue: Number(d.revenue) || 0,
      production: Number(d.production ?? d.produced ?? 0),
    }));
  }, [trends, metrics?.trends?.weekly]);

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
      to: '/sales',
    },
    {
      label: 'Factory Production',
      value: metrics ? `${metrics.production.achievement_rate}%` : '—',
      sub: `${Math.min(metrics?.production.achievement_rate ?? 0, 100)}%`,
      icon: <Factory className="size-4" />,
      status: !metrics ? 'ok' : metrics.production.achievement_rate >= 80 ? 'ok' : metrics.production.achievement_rate >= 60 ? 'warn' : 'critical',
      to: '/production',
    },
    {
      label: 'Stock & Warehouse',
      value: metrics ? `${metrics.inventory.low_stock_count} alerts` : '—',
      sub: metrics?.inventory.low_stock_count === 0 ? '100%' : `${Math.max(0, 100 - (metrics?.inventory.low_stock_count ?? 0) * 5)}%`,
      icon: <Warehouse className="size-4" />,
      status: !metrics ? 'ok' : metrics.inventory.low_stock_count === 0 ? 'ok' : metrics.inventory.low_stock_count < 5 ? 'warn' : 'critical',
      to: '/inventory',
    },
    {
      label: 'Quality Control',
      value: metrics ? `${metrics.quality.qc_pass_rate}%` : '—',
      sub: `${metrics?.quality.qc_pass_rate ?? 0}%`,
      icon: <Microscope className="size-4" />,
      status: !metrics ? 'ok' : metrics.quality.qc_pass_rate >= 90 ? 'ok' : metrics.quality.qc_pass_rate >= 75 ? 'warn' : 'critical',
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-default">Revenue Trend</h3>
              <p className="text-[11px] text-muted mt-0.5">
                {currencySymbol} weekly performance · auto-refreshing
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-default bg-surface-sunken p-1">
              <button
                type="button"
                onClick={() => setChartPeriod('weekly')}
                className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all', chartPeriod === 'weekly' ? 'bg-surface text-default shadow-xs' : 'text-muted hover:text-default')}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('monthly')}
                className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all', chartPeriod === 'monthly' ? 'bg-surface text-default shadow-xs' : 'text-muted hover:text-default')}
              >
                Month
              </button>
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

      {/* CTA row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          to="/reports"
          className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all shadow-2xs"
        >
          <FileText className="size-3.5 text-muted" />
          <span>BI & Reports</span>
        </Link>
        <Link
          to="/pos"
          className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 transition-all"
        >
          <ShoppingCart className="size-3.5" />
          <span>Launch POS Terminal</span>
        </Link>
      </div>
    </div>
  );
};
