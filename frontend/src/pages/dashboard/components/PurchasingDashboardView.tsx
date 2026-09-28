import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  PackageCheck,
  Clock,
  TrendingUp,
  Plus,
  Boxes,
  ArrowRight,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import { cn } from '../../../lib/utils';

interface PurchaseOrderItem {
  id: string | number;
  po_number: string;
  supplier?: { name: string };
  total_amount: number | string;
  status: string;
  order_date: string;
  items_count?: number;
}

interface RequisitionItem {
  id: string | number;
  requisition_number: string;
  department?: string;
  status: string;
  required_date?: string;
}

const poStatusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'RECEIVED') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (s === 'DRAFT' || s === 'PENDING') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
};

const reqStatusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'APPROVED') return 'text-emerald-600 dark:text-emerald-400';
  if (s === 'PENDING') return 'text-amber-600 dark:text-amber-400';
  return 'text-muted';
};

export const PurchasingDashboardView: React.FC = () => {
  const { formatCurrency } = useCurrency();

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrderItem[]>({
    queryKey: ['purchasing', 'dashboard-orders'],
    queryFn: async () => {
      try {
        const res = await api.get<PurchaseOrderItem[] | { data: PurchaseOrderItem[] }>('/purchasing/orders?per_page=8');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const { data: requisitions = [] } = useQuery<RequisitionItem[]>({
    queryKey: ['purchasing', 'dashboard-requisitions'],
    queryFn: async () => {
      try {
        const res = await api.get<RequisitionItem[] | { data: RequisitionItem[] }>('/purchasing/requisitions?per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const stats = useMemo(() => {
    const totalValue = purchaseOrders.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);
    const pending = purchaseOrders.filter((po) => ['DRAFT', 'PENDING'].includes(po.status.toUpperCase())).length;
    const received = purchaseOrders.filter((po) => ['RECEIVED', 'COMPLETED'].includes(po.status.toUpperCase())).length;
    const pendingReqs = requisitions.filter((r) => r.status.toUpperCase() === 'PENDING').length;
    return { totalValue, pending, received, pendingReqs };
  }, [purchaseOrders, requisitions]);

  const kpis = [
    { label: 'Total PO Value', value: formatCurrency(stats.totalValue), sub: 'All purchase orders', icon: <DollarSign className="size-4" />, color: 'text-blue-500' },
    { label: 'Pending Approval', value: `${stats.pending}`, sub: 'POs awaiting', icon: <Clock className="size-4" />, color: stats.pending > 0 ? 'text-amber-500' : 'text-muted', accent: stats.pending > 0 },
    { label: 'Goods Received', value: `${stats.received}`, sub: 'GRN completed', icon: <PackageCheck className="size-4" />, color: 'text-emerald-500' },
    { label: 'Open Requisitions', value: `${stats.pendingReqs}`, sub: 'Pending approval', icon: <TrendingUp className="size-4" />, color: stats.pendingReqs > 0 ? 'text-purple-500' : 'text-muted' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
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

      {/* Main grid: POs + Requisitions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Purchase Orders — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Purchase Orders</h3>
              <p className="text-[11px] text-muted">Supplier procurement and receiving tracker</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/purchasing?action=new" className="flex items-center gap-1 rounded-lg bg-linear-to-r from-orange-600 to-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:from-orange-500 hover:to-amber-500 transition-all">
                <Plus className="size-3" /> New PO
              </Link>
              <Link to="/purchasing" className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-all">
                <Boxes className="size-3" /> All POs
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-4 py-2.5">PO Number</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5 text-right">Items</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-surface-sunken/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-default">{po.po_number}</td>
                      <td className="px-4 py-2.5 text-default font-medium truncate max-w-30">{po.supplier?.name || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-muted text-right">{po.items_count ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-default text-right">{formatCurrency(Number(po.total_amount) || 0)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', poStatusBadge(po.status))}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted text-[10px]">
                        {po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-10 text-center text-muted">
                    <Inbox className="mx-auto size-8 text-muted/40 mb-2" />
                    No purchase orders recorded.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Requisitions — 1/3 */}
        <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Material Requisitions</h3>
              <p className="text-[11px] text-muted">Internal procurement requests</p>
            </div>
            <Link to="/purchasing/requisitions?action=new" className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-surface-sunken transition-all">
              <Plus className="size-3" /> Request
            </Link>
          </div>
          <div className="flex-1 divide-y divide-default">
            {requisitions.length > 0 ? (
              requisitions.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-surface-sunken/50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-xs font-bold font-mono text-default">{req.requisition_number}</div>
                    <div className="text-[10px] text-muted">{req.department || 'General'}</div>
                    {req.required_date && (
                      <div className="text-[10px] text-muted">By: {new Date(req.required_date).toLocaleDateString()}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('text-[10px] font-bold', reqStatusBadge(req.status))}>{req.status}</span>
                    {req.status.toUpperCase() === 'APPROVED' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                    {req.status.toUpperCase() === 'PENDING' && <AlertTriangle className="size-3.5 text-amber-500" />}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted text-xs gap-2">
                <ShoppingCart className="size-8 text-muted/40" />
                No active requisitions.
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-default">
            <Link to="/purchasing" className="flex items-center justify-between text-xs font-semibold text-primary hover:underline">
              Purchasing Center <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
