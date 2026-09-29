import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Clock,
  UserCheck,
  Briefcase,
  Calendar,
  Receipt,
  UserPlus,
  Activity,
  Inbox,
} from 'lucide-react';
import { useCurrency } from '../../../lib/format/currency';
import { api } from '../../../lib/api/client';
import { cn } from '../../../lib/utils';
import type { DashboardMetricsData } from '../../../types/api/dashboard';
import { DashboardKpiCard, type DashboardKpiTheme } from './DashboardKpiCard';

interface WorkerItem {
  initials: string;
  name: string;
  output: string;
  rate: number;
  badge: string;
  color: string;
  department?: string;
  shift?: string;
}

interface WorkforceDashboardViewProps {
  onOpenWorker?: (worker: WorkerItem) => void;
  workers?: WorkerItem[];
}

const DEPT_COLORS = ['bg-indigo-500', 'bg-amber-500', 'bg-cyan-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500'];
const EMPTY_WORKERS: WorkerItem[] = [];

interface AttendanceRecord {
  id: string | number;
  employee?: { name: string };
  check_in_time?: string;
  check_out_time?: string;
  status?: string;
  date?: string;
}

export const WorkforceDashboardView: React.FC<WorkforceDashboardViewProps> = ({ onOpenWorker, workers: propWorkers = EMPTY_WORKERS }) => {
  const { formatCurrency } = useCurrency();

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

  const safePropWorkers = useMemo(() => Array.isArray(propWorkers) ? propWorkers : EMPTY_WORKERS, [propWorkers]);
  const metricsWorkers = metrics?.active_workers;
  const safeMetricsWorkers = useMemo(() => Array.isArray(metricsWorkers) ? metricsWorkers : EMPTY_WORKERS, [metricsWorkers]);

  const workers: WorkerItem[] = useMemo(() => {
    return safePropWorkers.length > 0 ? safePropWorkers : safeMetricsWorkers;
  }, [safePropWorkers, safeMetricsWorkers]);

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['hr', 'recent-attendance'],
    queryFn: async () => {
      try {
        const res = await api.get<AttendanceRecord[] | { data: AttendanceRecord[] }>('/hr/attendance?per_page=8');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const { data: leaveRequests = [] } = useQuery<Array<{ id: string | number; employee?: { name: string }; leave_type?: string; status?: string; start_date?: string; end_date?: string }>>({
    queryKey: ['hr', 'pending-leave'],
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: string | number; employee?: { name: string }; leave_type?: string; status?: string; start_date?: string; end_date?: string }> | { data: Array<{ id: string | number; employee?: { name: string }; leave_type?: string; status?: string; start_date?: string; end_date?: string }> }>('/hr/leaves?status=PENDING&per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
  });

  const departmentDistribution = useMemo(() => {
    if (!Array.isArray(workers) || workers.length === 0) return [
      { name: 'Production Floor', count: 0, percent: 0 },
      { name: 'Warehouse & Store', count: 0, percent: 0 },
      { name: 'Quality Control', count: 0, percent: 0 },
      { name: 'Commercial & POS', count: 0, percent: 0 },
    ];
    const deptMap: Record<string, number> = {};
    workers.forEach((w) => {
      const dept = w?.department || 'General';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / workers.length) * 100),
    }));
  }, [workers]);

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
      label: 'Active Workers',
      value: `${workers.length}`,
      sub: 'On factory floor',
      badge: { text: 'On Duty', variant: 'positive' },
      icon: <Users className="size-4" />,
      theme: 'blue',
      to: '/workforce',
    },
    {
      label: 'Clocked In Today',
      value: `${attendance.filter((a) => a.check_in_time).length}`,
      sub: 'Attendance log',
      badge: { text: 'Active Log', variant: 'positive' },
      icon: <UserCheck className="size-4" />,
      theme: 'emerald',
      to: '/workforce',
    },
    {
      label: 'Pending Leave',
      value: `${leaveRequests.length}`,
      sub: 'Awaiting approval',
      badge: leaveRequests.length > 0 ? { text: 'Action Req.', variant: 'warning' } : { text: 'Clear', variant: 'neutral' },
      icon: <Calendar className="size-4" />,
      theme: 'amber',
      to: '/workforce',
    },
    {
      label: 'Payroll Due',
      value: formatCurrency(0),
      sub: 'Monthly payroll cycle',
      badge: { text: 'Current', variant: 'info' },
      icon: <Receipt className="size-4" />,
      theme: 'purple',
      to: '/workforce',
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance feed — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's attendance */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
              <div>
                <h3 className="text-sm font-bold text-default">Today's Attendance Log</h3>
                <p className="text-[11px] text-muted">Clock-in / clock-out tracking</p>
              </div>
              <Link to="/hr?tab=attendance" className="flex items-center gap-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-all">
                <Clock className="size-3" /> Full Log
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken text-[10px] uppercase font-bold text-muted border-b border-default">
                  <tr>
                    <th className="px-4 py-2.5">Employee</th>
                    <th className="px-4 py-2.5">Check In</th>
                    <th className="px-4 py-2.5">Check Out</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {attendance.length > 0 ? (
                    attendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-surface-sunken/50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-default">{rec.employee?.name || 'Unknown Employee'}</td>
                        <td className="px-4 py-2.5 font-mono text-muted">{rec.check_in_time || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-muted">{rec.check_out_time || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            rec.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                            rec.status === 'LATE' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                            rec.status === 'ABSENT' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            'bg-surface-sunken text-muted border-default'
                          )}>
                            {rec.status || 'RECORDED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="py-10 text-center text-muted">
                      <Inbox className="mx-auto size-8 text-muted/40 mb-2" />
                      No attendance records for today.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active worker performance */}
          {workers.length > 0 && (
            <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-default">
                <div>
                  <h3 className="text-sm font-bold text-default">Active Worker Performance</h3>
                  <p className="text-[11px] text-muted">Live output tracking on production floor</p>
                </div>
                <Activity className="size-4 text-muted" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {workers.map((worker) => (
                  <button
                    key={worker.name}
                    type="button"
                    onClick={() => onOpenWorker?.(worker)}
                    className="flex items-center gap-3 rounded-xl border border-default bg-surface-sunken p-3 hover:border-primary/30 hover:bg-surface transition-all text-left cursor-pointer group"
                  >
                    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm text-white', worker.color || 'bg-indigo-500')}>
                      {worker.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-default truncate">{worker.name}</span>
                        <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 border shrink-0',
                          worker.badge === 'TOP' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                          worker.badge === 'MED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        )}>
                          {worker.badge}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted">{worker.output}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="flex-1 h-1 rounded-full bg-surface overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(worker.rate, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-muted shrink-0">{worker.rate}%</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — dept distribution + leave */}
        <div className="flex flex-col gap-4">
          {/* Department distribution */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-default">Department Headcount</h3>
              <p className="text-[11px] text-muted">{workers.length} total active workers</p>
            </div>
            <div className="space-y-3">
              {departmentDistribution.map((dept, i) => (
                <div key={dept.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-default font-medium truncate max-w-35">{dept.name}</span>
                    <span className="font-mono font-bold text-default shrink-0 ml-2">{dept.count} workers</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', DEPT_COLORS[i % DEPT_COLORS.length])} style={{ width: `${dept.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending leaves */}
          <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-default">
              <h3 className="text-sm font-bold text-default">Leave Requests</h3>
              <Link to="/hr?tab=leaves" className="text-[11px] text-primary font-semibold hover:underline">Manage</Link>
            </div>
            <div className="divide-y divide-default">
              {leaveRequests.length > 0 ? (
                leaveRequests.map((lr) => (
                  <div key={lr.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-default truncate">{lr.employee?.name || 'Employee'}</div>
                      <div className="text-[10px] text-muted">{lr.leave_type || 'Leave'} · {lr.start_date}</div>
                    </div>
                    <span className="text-[10px] font-bold rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 shrink-0">
                      {lr.status || 'PENDING'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-muted text-xs">No pending leave requests.</div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2">
            <Link to="/hr?tab=payroll" className="flex flex-col items-center gap-1.5 rounded-xl border border-default bg-surface p-3 hover:bg-surface-sunken hover:border-primary/30 transition-all text-center">
              <Briefcase className="size-4 text-purple-500" />
              <span className="text-[11px] font-semibold text-muted group-hover:text-default">Payroll</span>
            </Link>
            <Link to="/hr?action=new-employee" className="flex flex-col items-center gap-1.5 rounded-xl border border-default bg-surface p-3 hover:bg-surface-sunken hover:border-primary/30 transition-all text-center">
              <UserPlus className="size-4 text-blue-500" />
              <span className="text-[11px] font-semibold text-muted group-hover:text-default">Add Staff</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
