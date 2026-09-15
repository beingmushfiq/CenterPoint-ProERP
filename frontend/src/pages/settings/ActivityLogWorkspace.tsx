import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { notify } from '../../components/ui/Toast';
import { VersionDiffModal, type AuditLogEntry } from '../../components/audit/VersionDiffModal';

interface PaginationMeta {
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export const ActivityLogWorkspace: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    current_page: 1,
    per_page: 25,
    last_page: 1,
  });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Selected Log for Visual Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    let ignore = false;

    const params: Record<string, string | number> = {
      page,
      per_page: 25,
    };

    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (selectedAction !== 'all') params.action = selectedAction;
    if (selectedType !== 'all') params.auditable_type = selectedType;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    api
      .get<AuditLogEntry[]>('/audit-logs', { params })
      .then((res) => {
        if (!ignore) {
          const rawData = res.data as unknown;
          const items: AuditLogEntry[] = Array.isArray(rawData)
            ? (rawData as AuditLogEntry[])
            : rawData &&
                typeof rawData === 'object' &&
                'data' in rawData &&
                Array.isArray((rawData as { data: unknown }).data)
              ? (rawData as { data: AuditLogEntry[] }).data
              : [];
          setLogs(items);

          const resMeta = res.meta as Record<string, unknown> | undefined;
          const dataMeta =
            rawData && typeof rawData === 'object' && 'meta' in rawData
              ? (rawData as { meta: Record<string, unknown> }).meta
              : undefined;
          const pagination = resMeta?.total !== undefined ? resMeta : dataMeta;

          if (pagination) {
            setMeta({
              total: Number(pagination.total ?? items.length),
              current_page: Number(pagination.current_page ?? page),
              per_page: Number(pagination.per_page ?? 25),
              last_page: Number(pagination.last_page ?? 1),
            });
          } else {
            setMeta({
              total: items.length,
              current_page: page,
              per_page: 25,
              last_page: 1,
            });
          }
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch activity logs.';
          notify.error(msg);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, searchQuery, selectedAction, selectedType, startDate, endDate, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const handleResetFilter = () => {
    setLoading(true);
    setSearchQuery('');
    setSelectedAction('all');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('store')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (act.includes('update') || act.includes('edit')) {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    if (act.includes('delete') || act.includes('destroy') || act.includes('void')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (act.includes('approve') || act.includes('verify')) {
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
    return 'bg-surface-sunken text-muted border-default';
  };

  // Metrics from current dataset
  const updatesCount = logs.filter((l) => l.action.toLowerCase().includes('update')).length;
  const createsCount = logs.filter((l) => l.action.toLowerCase().includes('create')).length;
  const approvesCount = logs.filter(
    (l) => l.action.toLowerCase().includes('approve') || l.action.toLowerCase().includes('verify')
  ).length;
  const deletesCount = logs.filter(
    (l) => l.action.toLowerCase().includes('delete') || l.action.toLowerCase().includes('void')
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-default bg-surface p-6 sm:p-7 shadow-xs">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-white font-bold shadow-lg ring-4 ring-emerald-500/20">
              <History className="size-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-default tracking-tight">
                  Activity Log & Version Audit Trail
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="size-3" />
                  Append-Only Immutability
                </span>
              </div>
              <p className="text-xs text-muted max-w-2xl leading-relaxed">
                Comprehensive historical timeline of all records created, updated, and deleted.
                Inspect exact
                <strong> Before vs. After field diffs</strong> and author tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
            Total Recorded Logs
          </span>
          <div className="text-2xl font-extrabold text-default font-mono">{meta.total}</div>
          <span className="text-[11px] text-muted">Historical activities</span>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            New Record Creates
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {createsCount}
          </div>
          <span className="text-[11px] text-muted">Initial creations in page</span>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Edit / Update Diffs
          </span>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {updatesCount}
          </div>
          <span className="text-[11px] text-muted">Field mutations in page</span>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Approvals & Status
          </span>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {approvesCount}
          </div>
          <span className="text-[11px] text-muted">Authorizations in page</span>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Deletes / Voids
          </span>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {deletesCount}
          </div>
          <span className="text-[11px] text-muted">Removed items in page</span>
        </div>
      </div>

      {/* Search & Filter Form */}
      <form
        onSubmit={handleApplyFilter}
        className="rounded-2xl border border-default bg-surface p-4 space-y-3 shadow-xs"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12">
          {/* Keyword Search */}
          <div className="relative sm:col-span-2 md:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search by action, user, entity, or correlation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3 py-1.5 text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Action Filter */}
          <div className="md:col-span-2">
            <SelectDropdown
              options={[
                { value: 'all', label: 'All Action Types' },
                { value: 'create', label: 'CREATE', colorDot: 'bg-emerald-500' },
                { value: 'update', label: 'UPDATE (Edit)', colorDot: 'bg-amber-500' },
                { value: 'approve', label: 'APPROVE', colorDot: 'bg-blue-500' },
                { value: 'delete', label: 'DELETE', colorDot: 'bg-rose-500' },
                { value: 'void', label: 'VOID', colorDot: 'bg-purple-500' },
              ]}
              value={selectedAction}
              onChange={(val) => {
                setSelectedAction(val);
                setPage(1);
              }}
              size="sm"
              buttonClassName="w-full"
              aria-label="Filter logs by action"
            />
          </div>

          {/* Entity Type Filter */}
          <div className="md:col-span-2">
            <SelectDropdown
              options={[
                { value: 'all', label: 'All Entity Models' },
                { value: 'Product', label: 'Product' },
                { value: 'BillOfMaterials', label: 'Bill of Materials' },
                { value: 'ProductionBatch', label: 'Production Batch' },
                { value: 'ProductionPlan', label: 'Production Plan' },
                { value: 'QcInspection', label: 'QC Inspection' },
                { value: 'WastageRecord', label: 'Wastage Record' },
                { value: 'SalesOrder', label: 'Sales Order' },
                { value: 'PurchaseOrder', label: 'Purchase Order' },
                { value: 'Role', label: 'Role / RBAC' },
                { value: 'Warehouse', label: 'Warehouse & Stock' },
              ]}
              value={selectedType}
              onChange={(val) => {
                setSelectedType(val);
                setPage(1);
              }}
              size="sm"
              buttonClassName="w-full"
              aria-label="Filter logs by entity"
            />
          </div>

          {/* Date Range Start */}
          <div className="md:col-span-2 relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted pointer-events-none" />
            <input
              type="date"
              title="Filter from start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-default bg-surface-sunken pl-7 pr-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
            />
          </div>

          {/* Filter / Reset Buttons */}
          <div className="md:col-span-2 flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" className="flex-1 text-xs">
              <Filter className="size-3 mr-1" />
              <span>Filter</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilter}
              className="text-xs"
            >
              Reset
            </Button>
          </div>
        </div>
      </form>

      {/* Activity Table */}
      <div className="rounded-2xl border border-default bg-surface overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <History className="size-10 text-muted mx-auto" />
            <h4 className="text-sm font-bold text-default">No Activity Logs Found</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              No mutations match your current search and filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-default bg-surface-sunken text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator / Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Model</th>
                  <th className="py-3 px-4">Changed Fields</th>
                  <th className="py-3 px-4 text-right">Version Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {logs.map((log) => {
                  const entityClean = log.auditable_type
                    ? log.auditable_type.split('\\').pop()
                    : 'System Record';

                  return (
                    <tr key={log.id} className="hover:bg-surface-sunken/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3 text-muted" />
                          <span>
                            {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                            {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <span className="font-semibold text-default block text-xs">
                              {log.user?.name ||
                                (log.user_id ? `User #${log.user_id}` : 'System Agent')}
                            </span>
                            {log.user?.email && (
                              <span className="text-[10px] text-muted block">{log.user.email}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity Model */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-default font-semibold">
                          <span>{entityClean}</span>
                          {log.auditable_id && (
                            <span className="text-primary ml-1">#{log.auditable_id}</span>
                          )}
                        </div>
                      </td>

                      {/* Changed Fields Badges */}
                      <td className="py-3 px-4">
                        {(() => {
                          const act = log.action.toLowerCase();
                          const effectiveChanged =
                            log.changed_fields && log.changed_fields.length > 0
                              ? log.changed_fields
                              : log.before && log.after
                                ? Object.keys({ ...log.before, ...log.after }).filter(
                                    (k) =>
                                      JSON.stringify(log.before?.[k]) !==
                                      JSON.stringify(log.after?.[k])
                                  )
                                : [];

                          if (
                            act.includes('create') ||
                            act.includes('store') ||
                            act.includes('insert')
                          ) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                                ✨ Initial Record Created
                              </span>
                            );
                          }

                          if (act.includes('approve') || act.includes('verify')) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                                ✓ Status Authorized / Approved
                              </span>
                            );
                          }

                          if (
                            act.includes('delete') ||
                            act.includes('destroy') ||
                            act.includes('void')
                          ) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
                                ✕ Record Removed / Voided
                              </span>
                            );
                          }

                          if (effectiveChanged.length > 0) {
                            return (
                              <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                {effectiveChanged.slice(0, 3).map((f) => (
                                  <span
                                    key={f}
                                    className="font-mono text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20"
                                  >
                                    {f}
                                  </span>
                                ))}
                                {effectiveChanged.length > 3 && (
                                  <span className="text-[10px] text-muted font-mono">
                                    +{effectiveChanged.length - 3} more
                                  </span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <span className="text-[11px] text-muted italic">No state changes</span>
                          );
                        })()}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            void api.get<AuditLogEntry>(`/audit-logs/${log.id}`).then((res) => {
                              if (res.data) setSelectedLog(res.data);
                            }).catch(() => {});
                          }}
                          className="text-[11px] h-7 px-2.5 shadow-2xs"
                        >
                          <Eye className="size-3 mr-1 text-primary" />
                          <span>View Version Diff</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-default bg-surface-sunken text-xs">
          <span className="text-muted">
            Showing Page <strong className="text-default">{meta.current_page}</strong> of{' '}
            <strong className="text-default">{meta.last_page}</strong> ({meta.total} total items)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
              className="text-xs h-7 px-2"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              <span>Previous</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
              className="text-xs h-7 px-2"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Version Diff Modal */}
      {selectedLog && (
        <VersionDiffModal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          log={selectedLog}
        />
      )}
    </div>
  );
};
