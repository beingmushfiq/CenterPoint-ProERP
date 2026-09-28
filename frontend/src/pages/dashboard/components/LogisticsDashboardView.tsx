import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Package,
  MapPin,
  Plus,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Inbox,
  Navigation,
  DollarSign,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import { cn } from '../../../lib/utils';
import { DashboardKpiCard, type DashboardKpiTheme } from './DashboardKpiCard';

interface ShipmentItem {
  id: string | number;
  tracking_code: string;
  courier: string;
  customer_name: string;
  city: string;
  cod_amount: number | string;
  status: string;
}

const shipmentBadge = (status?: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'DELIVERED') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (s === 'IN_TRANSIT' || s === 'IN TRANSIT' || s === 'DISPATCHED') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  if (s === 'FAILED' || s === 'RETURNED') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (s === 'PENDING' || s === 'BOOKED') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-surface-sunken text-muted border-default';
};

export const LogisticsDashboardView: React.FC = () => {
  const { formatCurrency } = useCurrency();

  const { data: shipments = [] } = useQuery<ShipmentItem[]>({
    queryKey: ['delivery', 'dashboard-shipments'],
    queryFn: async () => {
      try {
        const res = await api.get<ShipmentItem[] | { data: ShipmentItem[] }>('/delivery/shipments?per_page=10');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const stats = useMemo(() => {
    const totalCodPending = shipments.reduce((acc, s) => acc + (Number(s.cod_amount) || 0), 0);
    const inTransit = shipments.filter((s) => ['IN_TRANSIT', 'DISPATCHED', 'IN TRANSIT'].includes((s.status || '').toUpperCase())).length;
    const delivered = shipments.filter((s) => (s.status || '').toUpperCase() === 'DELIVERED').length;
    const failed = shipments.filter((s) => ['FAILED', 'RETURNED'].includes((s.status || '').toUpperCase())).length;
    return { totalCodPending, inTransit, delivered, failed };
  }, [shipments]);

  const deliveryRate = shipments.length > 0
    ? Math.round((stats.delivered / shipments.length) * 100)
    : 0;

  const kpis: Array<{
    label: string;
    value: string | number;
    sub: string;
    badge?: { text: string; variant?: 'positive' | 'warning' | 'negative' | 'neutral' | 'info' | undefined } | undefined;
    icon: React.ReactNode;
    theme: DashboardKpiTheme;
    to?: string | undefined;
  }> = [
    {
      label: 'COD Receivable',
      value: formatCurrency(stats.totalCodPending),
      sub: 'Cash on delivery queue',
      badge: stats.totalCodPending > 0 ? { text: 'To Collect', variant: 'warning' } : undefined,
      icon: <DollarSign className="size-4" />,
      theme: 'amber',
      to: '/delivery',
    },
    {
      label: 'In Transit',
      value: `${stats.inTransit}`,
      sub: 'Shipments on route',
      badge: { text: 'Active Route', variant: 'info' },
      icon: <Navigation className="size-4" />,
      theme: 'blue',
      to: '/delivery',
    },
    {
      label: 'Delivered Today',
      value: `${stats.delivered}`,
      sub: 'Successful deliveries',
      badge: { text: `${deliveryRate}% Rate`, variant: 'positive' },
      icon: <CheckCircle2 className="size-4" />,
      theme: 'emerald',
      to: '/delivery',
    },
    {
      label: 'Failed / Returns',
      value: `${stats.failed}`,
      sub: 'Returned shipments',
      badge: stats.failed > 0 ? { text: 'Attention', variant: 'negative' } : { text: 'Zero', variant: 'positive' },
      icon: <AlertTriangle className="size-4" />,
      theme: 'rose',
      to: '/delivery',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <DashboardKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            badge={kpi.badge}
            icon={kpi.icon}
            theme={kpi.theme}
            to={kpi.to}
          />
        ))}
      </div>

      {/* Main: shipments table + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shipments table — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Active Shipment Register</h3>
              <p className="text-[11px] text-muted">Courier dispatch, COD, and delivery tracking</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/delivery?action=new" className="flex items-center gap-1 rounded-lg bg-linear-to-r from-teal-600 to-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:from-teal-500 hover:to-emerald-500 transition-all">
                <Plus className="size-3" /> Book Shipment
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-4 py-2.5">Tracking</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Courier</th>
                  <th className="px-4 py-2.5">City</th>
                  <th className="px-4 py-2.5 text-right">COD</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {shipments.length > 0 ? (
                  shipments.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-sunken/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-default">{s.tracking_code}</td>
                      <td className="px-4 py-2.5 font-medium text-default truncate max-w-30">{s.customer_name}</td>
                      <td className="px-4 py-2.5 text-muted">{s.courier}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-muted">
                          <MapPin className="size-3 text-blue-500 shrink-0" />
                          {s.city}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-right text-default">{formatCurrency(Number(s.cod_amount) || 0)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', shipmentBadge(s.status))}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-10 text-center text-muted">
                    <Inbox className="mx-auto size-8 text-muted/40 mb-2" />
                    No shipments recorded. Book your first delivery.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delivery performance sidebar — 1/3 */}
        <div className="flex flex-col gap-4">
          {/* Delivery rate gauge */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-default">Delivery Performance</h3>
              <p className="text-[11px] text-muted">Success rate · {shipments.length} total shipments</p>
            </div>

            {/* SVG ring gauge */}
            <div className="flex items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <svg className="size-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-sunken" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={deliveryRate >= 80 ? '#10b981' : deliveryRate >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - deliveryRate / 100)}`}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('text-2xl font-black font-mono', deliveryRate >= 80 ? 'text-emerald-500' : deliveryRate >= 60 ? 'text-amber-500' : 'text-red-500')}>
                    {deliveryRate}%
                  </span>
                  <span className="text-[9px] font-bold text-muted uppercase tracking-wide">Success</span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 border-t border-default pt-3">
              {[
                { label: 'In Transit', count: stats.inTransit, color: 'bg-blue-500' },
                { label: 'Delivered', count: stats.delivered, color: 'bg-emerald-500' },
                { label: 'Failed/Return', count: stats.failed, color: 'bg-red-500' },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <div className={cn('size-2 rounded-full shrink-0', row.color)} />
                  <div className="flex-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{row.label}</span>
                    <span className="font-bold font-mono text-default">{row.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Run sheets */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-default">Dispatch Tools</h3>
            <div className="space-y-2">
              <Link to="/delivery/run-sheets" className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken px-3 py-2.5 hover:border-primary/30 hover:bg-surface transition-all">
                <span className="flex items-center gap-2 text-xs font-semibold text-default">
                  <Truck className="size-3.5 text-teal-500" /> Run Sheets
                </span>
                <ArrowRight className="size-3 text-muted" />
              </Link>
              <Link to="/delivery" className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken px-3 py-2.5 hover:border-primary/30 hover:bg-surface transition-all">
                <span className="flex items-center gap-2 text-xs font-semibold text-default">
                  <Package className="size-3.5 text-blue-500" /> All Shipments
                </span>
                <ArrowRight className="size-3 text-muted" />
              </Link>
              <Link to="/delivery?tab=cod-collection" className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken px-3 py-2.5 hover:border-primary/30 hover:bg-surface transition-all">
                <span className="flex items-center gap-2 text-xs font-semibold text-default">
                  <Coins className="size-3.5 text-amber-500" /> COD Collection
                </span>
                <ArrowRight className="size-3 text-muted" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
