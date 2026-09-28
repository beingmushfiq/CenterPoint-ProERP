import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Microscope,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Plus,
  Inbox,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { cn } from '../../../lib/utils';
import type { DashboardMetricsData } from '../../../types/api/dashboard';

export interface QcItem {
  id: string;
  orderNo: string;
  product: string;
  qty: number;
  status: string;
  failed?: number;
  rework?: number;
}

interface QcDashboardViewProps {
  qcList?: QcItem[];
  onOpenQC?: (item: QcItem) => void;
}

const qcStatusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'PASSED' || s === 'APPROVED') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (s === 'REWORK') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (s === 'FAILED' || s === 'REJECTED') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
};

interface InspectionApiItem {
  id: string | number;
  batch_id?: string | number;
  inspection_number?: string;
  status: string;
  product?: { name: string };
  quantity?: number;
  reject_qty?: number;
  rework_qty?: number;
}

export const QcDashboardView: React.FC<QcDashboardViewProps> = ({ qcList = [], onOpenQC }) => {
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

  const { data: recentInspections = [] } = useQuery<InspectionApiItem[]>({
    queryKey: ['qc', 'dashboard-recent-inspections'],
    queryFn: async () => {
      try {
        const res = await api.get<InspectionApiItem[] | { data: InspectionApiItem[] }>('/qc/inspections?per_page=10');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const displayItems: QcItem[] = useMemo(() => {
    if (qcList.length > 0) return qcList;
    return recentInspections.map((insp) => ({
      id: String(insp.id),
      orderNo: insp.inspection_number || `INSP-${insp.batch_id || insp.id}`,
      product: insp.product?.name || 'Unknown Product',
      qty: insp.quantity ?? 0,
      status: insp.status,
      failed: insp.reject_qty ?? 0,
      rework: insp.rework_qty ?? 0,
    }));
  }, [qcList, recentInspections]);

  const passRate = metrics?.quality.qc_pass_rate ?? 0;
  const pendingCount = metrics?.quality.pending_inspections ?? 0;
  const totalInspections = metrics?.quality.total_inspections ?? displayItems.length;

  const passedCount = displayItems.filter((i) => ['PASSED', 'APPROVED'].includes(i.status.toUpperCase())).length;
  const failedCount = displayItems.filter((i) => ['FAILED', 'REJECTED'].includes(i.status.toUpperCase())).length;
  const reworkCount = displayItems.filter((i) => i.status.toUpperCase() === 'REWORK').length;

  const kpis = [
    { label: 'QC Pass Rate', value: `${passRate}%`, sub: 'Overall quality score', icon: <TrendingUp className="size-4" />, color: passRate >= 90 ? 'text-emerald-500' : passRate >= 75 ? 'text-amber-500' : 'text-red-500' },
    { label: 'Pending Inspections', value: `${pendingCount}`, sub: 'Awaiting QC audit', icon: <Clock className="size-4" />, color: pendingCount > 0 ? 'text-amber-500' : 'text-muted', accent: pendingCount > 0 },
    { label: 'Passed Today', value: `${passedCount}`, sub: 'Inspection batches', icon: <CheckCircle2 className="size-4" />, color: 'text-emerald-500' },
    { label: 'Failed / Rework', value: `${failedCount + reworkCount}`, sub: `${failedCount} rejected · ${reworkCount} rework`, icon: <AlertTriangle className="size-4" />, color: failedCount > 0 ? 'text-red-500' : 'text-amber-500' },
  ];

  // Pass rate donut-like rings using CSS
  const ringPct = Math.min(passRate, 100);

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
            <div className={cn('font-extrabold font-mono text-xl leading-none', kpi.color)}>{kpi.value}</div>
            <div className={cn('text-[10px] font-medium', kpi.accent ? 'text-amber-600 dark:text-amber-400' : 'text-muted')}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inspection table — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
            <div>
              <h3 className="text-sm font-bold text-default">Recent QC Inspections</h3>
              <p className="text-[11px] text-muted">Batch audit results and status</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/qc?action=new" className="flex items-center gap-1 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xs hover:from-cyan-500 hover:to-blue-500 transition-all">
                <Plus className="size-3" /> New Audit
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                <tr>
                  <th className="px-4 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Failed</th>
                  <th className="px-4 py-2.5 text-right">Rework</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {displayItems.length > 0 ? (
                  displayItems.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-sunken/50 transition-colors cursor-pointer" onClick={() => onOpenQC?.(item)}>
                      <td className="px-4 py-2.5 font-mono text-muted text-[10px]">{item.orderNo}</td>
                      <td className="px-4 py-2.5 font-semibold text-default">{item.product}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-default text-right">{item.qty}</td>
                      <td className="px-4 py-2.5 font-mono text-right">{item.failed ? <span className="text-red-500 font-bold">{item.failed}</span> : <span className="text-muted">0</span>}</td>
                      <td className="px-4 py-2.5 font-mono text-right">{item.rework ? <span className="text-amber-500 font-bold">{item.rework}</span> : <span className="text-muted">0</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', qcStatusBadge(item.status))}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenQC?.(item); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                        >
                          <Eye className="size-3" /> Audit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="py-10 text-center text-muted">
                    <Inbox className="mx-auto size-8 text-muted/40 mb-2" />
                    No inspection records. Start a new QC audit.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality radar — 1/3 */}
        <div className="rounded-2xl border border-default bg-surface shadow-sm p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-default">Quality Scorecard</h3>
            <p className="text-[11px] text-muted">Session performance summary</p>
          </div>

          {/* Pass rate ring (pure CSS) */}
          <div className="flex items-center justify-center">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="size-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-sunken" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={passRate >= 90 ? '#10b981' : passRate >= 75 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - ringPct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-3xl font-black font-mono', passRate >= 90 ? 'text-emerald-500' : passRate >= 75 ? 'text-amber-500' : 'text-red-500')}>{passRate}%</span>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Pass Rate</span>
              </div>
            </div>
          </div>

          {/* Breakdown rows */}
          <div className="space-y-2.5 pt-2 border-t border-default">
            {[
              { label: 'Passed', count: passedCount, color: 'bg-emerald-500', icon: <CheckCircle2 className="size-3.5 text-emerald-500" /> },
              { label: 'Rework', count: reworkCount, color: 'bg-amber-500', icon: <RefreshCw className="size-3.5 text-amber-500" /> },
              { label: 'Rejected', count: failedCount, color: 'bg-red-500', icon: <XCircle className="size-3.5 text-red-500" /> },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                {row.icon}
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-medium text-muted">{row.label}</span>
                    <span className="font-bold font-mono text-default">{row.count}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-surface-sunken overflow-hidden">
                    <div className={cn('h-full rounded-full', row.color)} style={{ width: `${totalInspections > 0 ? (row.count / totalInspections) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Link to="/qc" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Microscope className="size-3.5" /> Full QC Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
