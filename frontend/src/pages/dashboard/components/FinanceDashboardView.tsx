import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Building2,
  Receipt,
  CreditCard,
  Eye,
  PieChart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from 'recharts';
import { cn } from '../../../lib/utils';
import type { DashboardInvoice } from './SalesDashboardView';
import type { DueCustomerItem } from './DashboardModals';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import type { DashboardMetricsData, DashboardInvoiceItem } from '../../../types/api/dashboard';

interface FinanceDashboardViewProps {
  onOpenDueItem?: (item: DueCustomerItem) => void;
  onOpenInvoice?: (invoice: DashboardInvoice) => void;
}

const CASH_FLOW_DATA = [{ month: 'Current', inflow: 0, outflow: 0 }];

const ageBadge = (days: number) => {
  if (days > 20) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (days > 10) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
};

export const FinanceDashboardView: React.FC<FinanceDashboardViewProps> = ({ onOpenDueItem, onOpenInvoice }) => {
  const { formatCurrency, currencySymbol } = useCurrency();

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
    queryKey: ['sales', 'unpaid-invoices-finance'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardInvoiceItem[] | { data: DashboardInvoiceItem[] }>('/sales/invoices?per_page=10');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const dueAccounts: DueCustomerItem[] = useMemo(() =>
    rawInvoices
      .filter((inv) => inv.payment_status !== 'PAID')
      .map((inv) => ({
        id: String(inv.id),
        customer: inv.customer?.name || 'Commercial Client',
        phone: inv.customer?.phone || 'N/A',
        dueAmount: formatCurrency(Number(inv.total_amount) || 0),
        invoicesCount: 1,
        oldestInvoiceDays: 1,
        lastPaymentDate: inv.invoice_date || 'Pending',
      })),
    [rawInvoices, formatCurrency]);

  const expenseBreakdown = [
    { category: 'Raw Materials', amount: formatCurrency(0), percent: 0, color: 'bg-blue-500' },
    { category: 'Labor & Operations', amount: formatCurrency(0), percent: 0, color: 'bg-emerald-500' },
    { category: 'Machinery & Utilities', amount: formatCurrency(0), percent: 0, color: 'bg-amber-500' },
    { category: 'Logistics & Shipping', amount: formatCurrency(0), percent: 0, color: 'bg-purple-500' },
  ];

  const kpis = [
    { label: 'Receivables Due', value: metrics ? formatCurrency(metrics.commercial.total_receivable_due) : '—', sub: 'Active accounts', icon: <DollarSign className="size-4" />, color: 'text-amber-500', accent: true },
    { label: 'Today Collections', value: metrics ? formatCurrency(metrics.commercial.today_revenue) : '—', sub: 'Realtime ledger', icon: <TrendingUp className="size-4" />, color: 'text-emerald-500', accent: false },
    { label: 'Monthly Revenue', value: metrics ? formatCurrency(metrics.commercial.month_revenue) : '—', sub: 'Current month', icon: <Receipt className="size-4" />, color: 'text-blue-500', accent: false },
    { label: 'Supplier Payables', value: formatCurrency(0), sub: 'Vendor invoices', icon: <CreditCard className="size-4" />, color: 'text-purple-500', accent: false },
    { label: 'Liquid Cash & Bank', value: formatCurrency(0), sub: 'Cash & bank balance', icon: <Coins className="size-4" />, color: 'text-teal-500', accent: false },
    { label: 'Capital Assets', value: formatCurrency(0), sub: 'Asset registry', icon: <Building2 className="size-4" />, color: 'text-indigo-500', accent: false },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn(
            'rounded-2xl border bg-surface p-4 shadow-sm hover:border-primary/30 transition-all flex flex-col gap-2',
            kpi.accent ? 'border-l-4 border-l-amber-500 border-r border-t border-b border-default' : 'border-default'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted truncate">{kpi.label}</span>
              <span className={cn('shrink-0', kpi.color)}>{kpi.icon}</span>
            </div>
            <div className="font-extrabold font-mono text-xl text-default leading-none">{kpi.value}</div>
            <div className={cn('text-[10px] font-medium', kpi.accent ? 'text-amber-600 dark:text-amber-400' : 'text-muted')}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + Expense breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash flow chart — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <div>
              <h3 className="text-sm font-bold text-default">Enterprise Cash Flow Trend</h3>
              <p className="text-[11px] text-muted">Revenue inflow vs operating expense outflow</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-emerald-500" /> Inflow ({currencySymbol})</span>
              <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-red-400" /> Outflow ({currencySymbol})</span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CASH_FLOW_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finCashInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finCashOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', borderRadius: '12px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#finCashInflow)" dot={false} />
                <Area type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" fillOpacity={1} fill="url(#finCashOutflow)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense breakdown — 1/3 */}
        <div className="rounded-2xl border border-default bg-surface p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <h3 className="text-sm font-bold text-default">Expense Allocation</h3>
            <PieChart className="size-4 text-muted" />
          </div>
          <div className="space-y-4 flex-1">
            {expenseBreakdown.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-default font-medium truncate">{item.category}</span>
                  <span className="font-mono font-bold text-default shrink-0 ml-2">{item.amount}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Link to="/finance?tab=expenses" className="flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2 border-t border-default">
            Full Expense Ledger <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Aged Receivables */}
      <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
          <div>
            <h3 className="text-sm font-bold text-default">Aged Receivables</h3>
            <p className="text-[11px] text-muted">Commercial credit and invoice delinquency tracking</p>
          </div>
          <Link to="/finance?tab=due-collection" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Due Ledger <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Aging buckets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          {[
            { label: 'Current (0–30 Days)', value: formatCurrency(metrics?.commercial?.aging_breakdown?.current ?? 0), sub: 'Low delinquency', color: 'border-l-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
            { label: '31–60 Days', value: formatCurrency(metrics?.commercial?.aging_breakdown?.overdue_60 ?? 0), sub: 'Follow-up advisory', color: 'border-l-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
            { label: '61–90 Days', value: formatCurrency(metrics?.commercial?.aging_breakdown?.overdue_90 ?? 0), sub: 'Credit notice sent', color: 'border-l-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
            { label: '90+ Days (Critical)', value: formatCurrency(metrics?.commercial?.aging_breakdown?.overdue_90 ?? 0), sub: 'High risk / restrict', color: 'border-l-red-500', textColor: 'text-red-500' },
          ].map((bucket) => (
            <div key={bucket.label} className={cn('rounded-xl border border-default border-l-4 bg-surface-sunken/40 p-3', bucket.color)}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">{bucket.label}</span>
              <div className="mt-1 text-lg font-bold font-mono text-default">{bucket.value}</div>
              <span className={cn('text-[10px] font-semibold', bucket.textColor)}>{bucket.sub}</span>
            </div>
          ))}
        </div>

        {/* Due accounts table */}
        <div className="overflow-x-auto border-t border-default">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
              <tr>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Invoices</th>
                <th className="px-4 py-2.5">Age</th>
                <th className="px-4 py-2.5">Due Amount</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {dueAccounts.length > 0 ? (
                dueAccounts.map((due) => (
                  <tr key={due.id} className="hover:bg-surface-sunken/60 cursor-pointer transition-colors" onClick={() => onOpenDueItem?.(due)}>
                    <td className="px-4 py-2.5 font-semibold text-default">{due.customer}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{due.phone}</td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onOpenInvoice?.({ id: `INV-${due.id}`, customer: due.customer, type: 'B2B', amount: due.dueAmount, status: 'CONFIRMED', payment: 'UNPAID' }); }} className="text-primary hover:underline font-semibold">
                        {due.invoicesCount} Invoices
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', ageBadge(due.oldestInvoiceDays))}>
                        {due.oldestInvoiceDays}d overdue
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-amber-500">{due.dueAmount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDueItem?.(due); }} className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-surface-sunken transition-colors">
                        <Eye className="size-3" /> Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="py-8 text-center text-muted">No pending customer dues recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
