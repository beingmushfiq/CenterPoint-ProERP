import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { PlatformDashboardData } from '../../types/api/platform';
import { ResponsiveDataTable } from '../../components/ui/ResponsiveDataTable';
import {
  Building2,
  Users,
  DollarSign,
  AlertTriangle,
  Server,
  Activity,
  UserPlus,
  CreditCard,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const PlatformDashboardWorkspace: React.FC = () => {
  const { data, isLoading, isFetching, refetch, error } = useQuery<PlatformDashboardData | null>({
    queryKey: ['platform', 'dashboard', 'kpis'],
    queryFn: async () => {
      const response = await api.get<PlatformDashboardData>('/platform/dashboard/kpis');
      return response.data;
    },
  });

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['platform', 'health'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: { status?: string; checks?: Record<string, { status?: string; latency_ms?: number }> } }>('/platform/health');
        return res.data?.data ?? null;
      } catch {
        return null;
      }
    },
  });

  void healthData;

  if (isLoading && !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 bg-surface-sunken rounded-2xl w-1/3 border border-default" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-surface rounded-2xl border border-default" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Master SaaS Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            Platform Engine Overview
          </h1>
          <p className="mt-1.5 text-xs text-muted max-w-2xl leading-relaxed">
            High-level SaaS tenancy health, MRR performance, cluster status, and platform audit telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              void refetch();
              void refetchHealth();
            }}
            disabled={isFetching}
            className="px-3.5 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-xs font-semibold text-default flex items-center gap-2 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/platform/tenants/new"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="size-4" />
            <span>Onboard Tenant</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error instanceof Error ? error.message : 'Failed to fetch platform metrics'}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Tenants */}
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total Tenants
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Building2 className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-default font-mono">
              {kpis?.total_tenants ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{kpis?.active_tenants ?? 0} Active</span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400">{kpis?.trial_tenants ?? 0} Trial</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400">{kpis?.suspended_tenants ?? 0} Suspended</span>
            </div>
          </div>
        </div>

        {/* Estimated MRR */}
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Estimated MRR
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <DollarSign className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-default font-mono">
              BDT {(kpis?.estimated_mrr ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Based on active tenant subscription tiers
            </p>
          </div>
        </div>

        {/* Expiring Subscriptions */}
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Expiring in 30d
            </span>
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <AlertTriangle className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-default font-mono">
              {kpis?.expiring_subscriptions_30d ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 font-mono">
              Tenants requiring renewal or extension
            </p>
          </div>
        </div>

        {/* Total Platform Users */}
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total Platform Users
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-default font-mono">
              {kpis?.total_users ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-muted font-mono">
              Across all isolated tenant workspaces
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Plan Breakdown & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Breakdown */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface border border-default shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
                Subscription Plan Distribution
              </h2>
            </div>
            <Link
              to="/platform/plans"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
            >
              Configure Plans →
            </Link>
          </div>

          <div className="space-y-4">
            {data?.plans?.map((plan) => {
              const total = kpis?.total_tenants || 1;
              const percentage = Math.round((plan.tenants_count / total) * 100);
              return (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl bg-surface-sunken border border-default flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-default text-sm">{plan.name}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-md bg-surface text-muted text-[10px] font-mono border border-default">
                        {plan.code}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-default font-mono">
                        {plan.tenants_count} Tenants
                      </span>
                      <span className="text-xs text-muted font-mono ml-2">(BDT {plan.price}/mo)</span>
                    </div>
                  </div>
                  <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-default/50">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Health */}
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Server className="size-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
                System Health & Nodes
              </h2>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-default flex items-center justify-between">
                <span className="text-muted">Database Engine</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                  {data?.system_health.database}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-default flex items-center justify-between">
                <span className="text-muted">Distributed Cache</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                  {data?.system_health.cache}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-default flex items-center justify-between">
                <span className="text-muted">Queue Processing</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                  {data?.system_health.queue}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-default flex items-center justify-between">
                <span className="text-muted">Cluster Status</span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="size-3.5" />
                  <span>OPERATIONAL</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-default text-[11px] text-muted font-mono">
            Telemetry Heartbeat: {data?.system_health.server_time ? new Date(data.system_health.server_time).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Recent Platform Activity */}
      <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-amber-500" />
            <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
              Live Platform Audit Stream
            </h2>
          </div>
          <Link
            to="/platform/audit-logs"
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
          >
            View Full Audit Trail →
          </Link>
        </div>

        <ResponsiveDataTable<PlatformDashboardData['recent_activity'][number]>
          data={data?.recent_activity ?? []}
          isLoading={isLoading}
          emptyMessage="No platform audit entries recorded yet."
          keyExtractor={(log) => log.id}
          columns={[
            {
              key: 'timestamp',
              header: 'Timestamp',
              priority: 'high',
              render: (log) => (
                <span className="text-muted font-mono text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              priority: 'high',
              render: (log) => (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold uppercase text-[9px] font-mono">
                  {log.action}
                </span>
              ),
            },
            {
              key: 'target',
              header: 'Target Entity',
              priority: 'medium',
              render: (log) => (
                <span className="text-default font-semibold font-mono">
                  {log.entity_type} #{log.entity_id}
                </span>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              priority: 'high',
              render: (log) => <span className="text-muted font-mono">{log.actor_name}</span>,
            },
            {
              key: 'details',
              header: 'Summary',
              priority: 'low',
              render: (log) => (
                <span className="text-muted truncate max-w-xs block font-mono text-[11px]">
                  {log.details ? JSON.stringify(log.details) : '—'}
                </span>
              ),
            },
          ]}
          mobileCardRenderer={(log) => ({
            title: (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold uppercase text-[9px] font-mono">
                  {log.action}
                </span>
                <span className="font-bold text-default text-xs font-mono">
                  {log.entity_type} #{log.entity_id}
                </span>
              </div>
            ),
            subtitle: `By ${log.actor_name}`,
            badge: (
              <span className="text-[10px] text-muted font-mono">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ),
            metrics: [
              { label: 'Date', value: new Date(log.created_at).toLocaleDateString() },
              { label: 'Entity', value: `${log.entity_type} #${log.entity_id}` },
            ],
            details: log.details ? (
              <div className="text-xs text-muted font-mono break-all pt-1 bg-surface-sunken p-2 rounded-lg border border-default">
                {JSON.stringify(log.details)}
              </div>
            ) : undefined,
          })}
        />
      </div>
    </div>
  );
};
export default PlatformDashboardWorkspace;
