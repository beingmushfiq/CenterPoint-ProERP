import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Store,
  ArrowRight,
  Eye,
  Inbox,
  Package,
  DollarSign,
  BarChart2,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import { cn } from '../../../lib/utils';
import type { DashboardMetricsData, DashboardInvoiceItem } from '../../../types/api/dashboard';
import { DashboardKpiCard, type DashboardKpiTheme } from './DashboardKpiCard';

interface FastProductItem {
  id: string | number;
  name: string;
  sku: string;
  sale_price: number | string;
}

export interface DashboardInvoice {
  id: string;
  customer: string;
  type: 'B2B' | 'B2C';
  amount: string;
  status: string;
  payment: string;
  date?: string;
}

interface SalesDashboardViewProps {
  onOpenInvoice?: (invoice: DashboardInvoice) => void;
}

const paymentBadge = (payment?: string) => {
  const p = (payment || '').toUpperCase();
  if (p === 'PAID') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (p === 'PARTIAL') return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-red-500 bg-red-500/10 border-red-500/20';
};

export const SalesDashboardView: React.FC<SalesDashboardViewProps> = ({ onOpenInvoice }) => {
  const { formatCurrency } = useCurrency();
  const [salesFilter, setSalesFilter] = useState<'all' | 'DELIVERED' | 'CONFIRMED'>('all');

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

  const { data: rawInvoices = [] } = useQuery<DashboardInvoiceItem[]>({
    queryKey: ['sales', 'dashboard-invoices-list'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardInvoiceItem[] | { data: DashboardInvoiceItem[] }>('/sales/invoices?per_page=10');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const { data: rawProducts = [] } = useQuery<FastProductItem[]>({
    queryKey: ['catalogue', 'fast-moving-products'],
    queryFn: async () => {
      try {
        const res = await api.get<FastProductItem[] | { data: FastProductItem[] }>('/products?per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const invoices: DashboardInvoice[] = useMemo(() =>
    rawInvoices.map((inv) => ({
      id: inv.invoice_number,
      customer: inv.customer?.name || 'Commercial Customer',
      type: 'B2B' as const,
      amount: formatCurrency(Number(inv.total_amount) || 0),
      status: inv.status,
      payment: inv.payment_status || 'UNPAID',
      date: inv.invoice_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Recent'),
    })), [rawInvoices, formatCurrency]);

  const filteredInvoices = useMemo(() =>
    salesFilter === 'all' ? invoices : invoices.filter((inv) => inv.status === salesFilter),
    [salesFilter, invoices]);

  // KPI summary stats
  const kpis: Array<{
    label: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
    theme: DashboardKpiTheme;
    to?: string | undefined;
  }> = [
    {
      label: "Today's Sales",
      value: metrics ? formatCurrency(metrics.commercial.today_revenue) : '—',
      sub: `Month: ${metrics ? formatCurrency(metrics.commercial.month_revenue) : '—'}`,
      icon: <TrendingUp className="size-4" />,
      theme: 'emerald',
      to: '/sales/invoices',
    },
    {
      label: 'Active Orders',
      value: `${metrics?.commercial.active_orders ?? 0}`,
      sub: 'Fulfillment queue',
      icon: <ShoppingBag className="size-4" />,
      theme: 'blue',
      to: '/sales/orders',
    },
    {
      label: 'Receivables Due',
      value: metrics ? formatCurrency(metrics.commercial.total_receivable_due) : '—',
      sub: 'Outstanding balance',
      icon: <DollarSign className="size-4" />,
      theme: 'amber',
      to: '/finance?tab=receivables',
    },
    {
      label: 'Storefront',
      value: '0 Orders',
      sub: 'Ecom sync online',
      icon: <Store className="size-4" />,
      theme: 'teal',
      to: '/storefront',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* KPI strip — 4 tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <DashboardKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            icon={kpi.icon}
            theme={kpi.theme}
            to={kpi.to}
          />
        ))}
      </div>

      {/* Main content: invoices + products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Invoices — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Recent Invoices & Receivables</h3>
              <p className="text-[11px] text-muted">Track payment status and clearance</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-default bg-surface-sunken p-1 shrink-0">
              {(['all', 'DELIVERED', 'CONFIRMED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSalesFilter(f)}
                  className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                    salesFilter === f ? 'bg-surface text-default shadow-xs' : 'text-muted hover:text-default')}
                >
                  {f === 'all' ? 'All' : f[0] + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-default">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-default truncate">{inv.customer}</span>
                      <span className="rounded border border-default bg-surface-sunken px-1.5 py-px text-[9px] font-mono font-bold text-muted">{inv.type}</span>
                    </div>
                    <div className="text-[10px] text-muted font-mono mt-0.5">{inv.id} · {inv.date}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-extrabold font-mono text-default">{inv.amount}</div>
                      <span className={cn('text-[9px] font-bold uppercase rounded border px-1.5 py-px', paymentBadge(inv.payment))}>
                        {inv.payment}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice?.(inv)}
                      className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1 text-[11px] font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer shadow-2xs"
                    >
                      <Eye className="size-3 text-muted" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-muted text-xs flex flex-col items-center gap-2">
                <Inbox className="size-8 text-muted/40" />
                <p>No invoices match this filter.</p>
                <Link to="/sales" className="text-primary font-semibold hover:underline">Create Invoice</Link>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/sales?action=new" className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-emerald-500 hover:to-teal-500 transition-all">
                <Plus className="size-3" /> New Order
              </Link>
              <Link to="/pos" className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken transition-all">
                <ShoppingCart className="size-3 text-blue-500" /> POS Terminal
              </Link>
            </div>
            <Link to="/sales" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              All Sales <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Products SKU column — 1/3 */}
        <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Catalogue SKUs</h3>
              <p className="text-[11px] text-muted">Active product master</p>
            </div>
            <BarChart2 className="size-4 text-muted" />
          </div>

          <div className="divide-y divide-default">
            {rawProducts.length > 0 ? (
              rawProducts.map((p) => (
                <div key={p.id || p.sku} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-default truncate">{p.name}</div>
                    <div className="text-[10px] text-muted font-mono">{p.sku}</div>
                  </div>
                  <div className="text-xs font-bold font-mono text-default shrink-0">
                    {formatCurrency(Number(p.sale_price) || 0)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-muted text-xs flex flex-col items-center gap-2">
                <Package className="size-8 text-muted/40" />
                <p>No catalogue items recorded.</p>
                <Link to="/catalogue" className="text-primary font-semibold hover:underline">Manage Catalogue</Link>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-default">
            <Link to="/catalogue" className="flex items-center justify-between text-xs font-semibold text-primary hover:underline">
              View Catalogue <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
