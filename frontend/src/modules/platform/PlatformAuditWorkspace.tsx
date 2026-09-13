import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { PlatformAuditLog } from '../../types/api/platform';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../components/ui/ResponsiveDataTable';
import {
  Filter,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AuditResponsePayload {
  data: PlatformAuditLog[];
  meta: {
    pagination: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
  };
}

export const PlatformAuditWorkspace: React.FC = () => {
  const [selectedLog, setSelectedLog] = useState<PlatformAuditLog | null>(null);

  // Filters & Pagination
  const [entityType, setEntityType] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(25);

  const { data, isLoading, isFetching, refetch } = useQuery<AuditResponsePayload>({
    queryKey: ['platform', 'audit-logs', entityType, actionFilter, page, perPage],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (entityType !== 'all') params['entity_type'] = entityType;
      if (actionFilter !== 'all') params['action'] = actionFilter;

      const response = await api.get<AuditResponsePayload>('/platform/audit-logs', { params });
      return response.data;
    },
  });

  const logs = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  const columns: ResponsiveColumn<PlatformAuditLog>[] = [
    {
      id: 'action',
      header: 'Action',
      isPrimary: true,
      isStatus: true,
      priority: 'high',
      cell: (log) => (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] uppercase font-bold">
          {log.action}
        </span>
      ),
    },
    {
      id: 'entity',
      header: 'Auditable Entity',
      priority: 'high',
      cell: (log) => (
        <span className="text-default font-semibold">
          {log.auditable_type} #{log.auditable_id}
        </span>
      ),
    },
    {
      id: 'tenant',
      header: 'Tenant Scope',
      priority: 'medium',
      cell: (log) => (
        <span className="text-muted text-[11px]">
          {log.tenant ? `${log.tenant.name} (#${log.tenant.id})` : 'Global Platform'}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Super Admin Actor',
      priority: 'medium',
      cell: (log) => (
        <span className="text-default font-medium">
          {log.user?.name ?? 'System Master'}
        </span>
      ),
    },
    {
      id: 'timestamp',
      header: 'Timestamp',
      priority: 'low',
      cell: (log) => (
        <span className="text-muted text-[11px]">
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'inspection',
      header: 'Inspection',
      isAction: true,
      priority: 'high',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (log) => (
        <button
          onClick={() => setSelectedLog(log)}
          className="px-2.5 py-1 rounded-lg bg-surface-sunken hover:bg-surface border border-default text-default text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Eye className="w-3 h-3" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans text-default">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Security & Observability
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            Platform Immutable Audit Trail
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed font-mono">
            Cryptographically sealed timeline of all administrative mutations, tenant state modifications, and overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-surface-sunken border border-default hover:bg-surface text-default text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-surface border border-default shadow-md flex flex-wrap gap-3 items-center justify-between font-mono text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted" />
            <span className="text-default font-bold">Filters:</span>
          </div>
          <div className="w-40 max-w-full">
            <SelectDropdown
              value={entityType}
              onChange={(val) => {
                setEntityType(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Entity Types' },
                { value: 'Tenant', label: 'Tenant' },
                { value: 'Plan', label: 'Plan' },
                { value: 'User', label: 'User' },
                { value: 'FeatureFlag', label: 'Feature Flag' },
              ]}
            />
          </div>
          <div className="w-48 max-w-full">
            <SelectDropdown
              value={actionFilter}
              onChange={(val) => {
                setActionFilter(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Action Events' },
                { value: 'tenant.create', label: 'Tenant Created' },
                { value: 'tenant.update', label: 'Tenant Updated' },
                { value: 'tenant.status_change', label: 'Status Changed' },
                { value: 'tenant.delete', label: 'Tenant Deleted' },
                { value: 'tenant.impersonate', label: 'SuperAdmin Session' },
                { value: 'feature_flag.update', label: 'Feature Flag Changed' },
                { value: 'plan.update', label: 'Billing Tier Modified' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Table & Pagination */}
      <div className="space-y-3">
        <ResponsiveDataTable
          data={logs}
          columns={columns}
          keyExtractor={(log) => log.id}
          loading={isLoading}
          emptyMessage="No audit log records match the current filter"
        />

        {/* Pagination Bar */}
        {pagination && pagination.total_pages > 1 && (
          <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-muted">
            <div>
              Showing page <span className="text-default font-bold">{pagination.page}</span> of <span className="text-default font-bold">{pagination.total_pages}</span> ({pagination.total} total events)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || isFetching}
                className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface border border-default disabled:opacity-40 disabled:cursor-not-allowed text-default flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={pagination.page >= pagination.total_pages || isFetching}
                className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface border border-default disabled:opacity-40 disabled:cursor-not-allowed text-default flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden w-12 h-1.5 rounded-full bg-surface-sunken mx-auto mb-3" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-default pb-3 mb-4">
              <h2 className="text-base font-bold text-default font-sans">
                Audit Record #{selectedLog.id} Detail
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold uppercase text-[10px]">
                {selectedLog.action}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-[11px]">
              <div>
                <span className="text-muted block">Actor:</span>
                <span className="text-default font-semibold">{selectedLog.user?.name ?? 'System'} ({selectedLog.user?.email ?? 'N/A'})</span>
              </div>
              <div>
                <span className="text-muted block">IP Address:</span>
                <span className="text-default">{selectedLog.ip ?? '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-muted block">Entity:</span>
                <span className="text-default">{selectedLog.auditable_type} #{selectedLog.auditable_id}</span>
              </div>
              <div>
                <span className="text-muted block">Timestamp:</span>
                <span className="text-default">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
            </div>

            {selectedLog.before && (
              <div className="mb-4">
                <span className="text-muted block mb-1 font-bold">State Before Mutation:</span>
                <pre className="p-3 rounded-xl bg-surface-sunken border border-default text-[10px] text-rose-600 dark:text-rose-300 overflow-x-auto max-w-full">
                  {JSON.stringify(selectedLog.before, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.after && (
              <div className="mb-4">
                <span className="text-muted block mb-1 font-bold">State After Mutation:</span>
                <pre className="p-3 rounded-xl bg-surface-sunken border border-default text-[10px] text-emerald-600 dark:text-emerald-300 overflow-x-auto max-w-full">
                  {JSON.stringify(selectedLog.after, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default font-bold cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PlatformAuditWorkspace;
