import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformErrorLogItem } from '../../types/api/platform';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { Button } from '../../components/ui/Button';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../components/ui/ResponsiveDataTable';
import {
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Copy,
  Check,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
} from 'lucide-react';

interface ErrorListResponse {
  data: PlatformErrorLogItem[];
  meta: {
    pagination: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
    stats: {
      total: number;
      open: number;
      investigating: number;
      resolved: number;
      critical: number;
    };
  };
}

export const PlatformErrorMonitoringWorkspace: React.FC = () => {
  const { t } = useTranslation(['platform', 'common']);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(25);

  // Detail Modal State
  const [selectedError, setSelectedError] = useState<PlatformErrorLogItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<ErrorListResponse>({
    queryKey: ['platform', 'errors', statusFilter, severityFilter, search, page, perPage],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (search) params['search'] = search;
      if (statusFilter !== 'all') params['status'] = statusFilter;
      if (severityFilter !== 'all') params['severity'] = severityFilter;

      const res = await api.get<ErrorListResponse>('/platform/errors', { params });
      return res.data;
    },
  });

  const errors = data?.data ?? [];
  const pagination = data?.meta?.pagination;
  const stats = data?.meta?.stats;

  // Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note?: string }) => {
      return await api.patch(`/platform/errors/${id}`, {
        status,
        resolution_note: note,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Error marked as ${variables.status}.`);
      queryClient.invalidateQueries({ queryKey: ['platform', 'errors'] });
      if (selectedError && selectedError.id === variables.id) {
        setSelectedError((prev) => (prev ? { ...prev, status: variables.status as 'open' | 'investigating' | 'resolved' | 'ignored', resolution_note: variables.note ?? prev.resolution_note ?? null } : null));
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update error status';
      toast.error(msg);
    },
  });

  // Telemetry Ingest Mutation
  const ingestTestErrorMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/platform/errors/ingest', {
        error_type: 'FrontendDiagnosticSignal',
        message: 'Telemetry health probe triggered from Platform Error Console',
        severity: 'info',
        module: 'OpsCenter',
        route: window.location.pathname,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Telemetry probe ingested into platform error stream');
      queryClient.invalidateQueries({ queryKey: ['platform', 'errors'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to ingest telemetry event';
      toast.error(msg);
    },
  });

  const handleOpenDetails = (err: PlatformErrorLogItem) => {
    setSelectedError(err);
    setResolutionNote(err.resolution_note || '');
    void api.get<{ data: PlatformErrorLogItem }>(`/platform/errors/${err.id}`).then((res) => {
      if (res.data?.data) {
        setSelectedError(res.data.data);
      }
    }).catch(() => {});
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard.');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const columns: ResponsiveColumn<PlatformErrorLogItem>[] = [
    {
      id: 'signature',
      header: t('errorMonitoring.columns.error'),
      isPrimary: true,
      priority: 'high',
      cell: (err) => (
        <div className="min-w-0 max-w-xs">
          <div className="font-mono text-xs font-semibold text-default truncate" title={err.error_type}>
            {err.error_type}
          </div>
          <div className="text-[11px] text-muted truncate mt-0.5" title={err.message}>
            {err.message}
          </div>
          {err.route && (
            <div className="text-[10px] text-muted font-mono truncate mt-0.5 opacity-80">
              {err.route}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'severity_status',
      header: t('errorMonitoring.columns.severity'),
      isStatus: true,
      priority: 'high',
      cell: (err) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono border ${
              err.severity === 'critical'
                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                : err.severity === 'error'
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}
          >
            {err.severity}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium font-mono ${
              err.status === 'open'
                ? 'bg-rose-500/10 text-rose-500'
                : err.status === 'investigating'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            {err.status}
          </span>
        </div>
      ),
    },
    {
      id: 'tenant',
      header: t('errorMonitoring.columns.tenant'),
      priority: 'medium',
      cell: (err) => (
        <div className="text-muted">
          {err.tenant ? (
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="size-3.5 text-muted shrink-0" />
              <span className="text-default font-medium truncate">{err.tenant.name}</span>
            </div>
          ) : (
            <span className="text-muted font-mono text-[11px]">{t('errorMonitoring.globalPlatform')}</span>
          )}
        </div>
      ),
    },
    {
      id: 'occurrences',
      header: t('errorMonitoring.columns.occurrences'),
      priority: 'high',
      cell: (err) => (
        <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[11px] font-bold text-default font-mono">
          {err.occurrence_count}×
        </span>
      ),
    },
    {
      id: 'last_seen',
      header: t('errorMonitoring.columns.lastSeen'),
      priority: 'low',
      cell: (err) => (
        <div className="text-muted text-[11px] font-mono">
          <div>{new Date(err.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div>{new Date(err.last_seen_at).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('errorMonitoring.columns.actions'),
      isAction: true,
      priority: 'high',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (err) => (
        <button
          onClick={() => handleOpenDetails(err)}
          className="px-3 py-1.5 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-xs font-medium text-default inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Eye className="size-3.5" />
          <span>{t('errorMonitoring.inspect')}</span>
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              {t('errorMonitoring.badge')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            {t('errorMonitoring.title')}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed font-mono">
            {t('errorMonitoring.description')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ingestTestErrorMutation.mutate()}
            disabled={ingestTestErrorMutation.isPending}
            className="flex items-center gap-1.5 font-mono cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken"
            title={t('errorMonitoring.simulateIngest')}
          >
            <span>{t('errorMonitoring.simulateIngest')}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 font-mono cursor-pointer"
            title={t('errorMonitoring.syncStream')}
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('errorMonitoring.syncStream')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
            <Flame className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-default">{stats?.critical ?? 0}</div>
            <div className="text-[11px] text-muted">{t('errorMonitoring.stats.criticalTraces')}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-default">{stats?.open ?? 0}</div>
            <div className="text-[11px] text-muted">{t('errorMonitoring.stats.openTriage')}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
            <Clock className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-default">{stats?.investigating ?? 0}</div>
            <div className="text-[11px] text-muted">{t('errorMonitoring.stats.investigating')}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats?.resolved ?? 0}</div>
            <div className="text-[11px] text-muted">{t('errorMonitoring.stats.resolved')}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-surface border border-default shadow-md flex flex-wrap gap-3 items-center justify-between font-mono text-xs">
        <div className="relative flex-1 min-w-48 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('errorMonitoring.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-hidden focus:border-amber-500 transition-all text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SelectDropdown
            icon={Filter}
            options={[
              { value: 'all', label: t('errorMonitoring.status.all') },
              { value: 'open', label: t('errorMonitoring.status.open'), colorDot: 'bg-rose-500' },
              { value: 'investigating', label: t('errorMonitoring.status.investigating'), colorDot: 'bg-amber-500' },
              { value: 'resolved', label: t('errorMonitoring.status.resolved'), colorDot: 'bg-emerald-500' },
              { value: 'ignored', label: t('errorMonitoring.status.ignored'), colorDot: 'bg-slate-500' },
            ]}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            size="sm"
          />

          <SelectDropdown
            options={[
              { value: 'all', label: t('errorMonitoring.severity.all') },
              { value: 'critical', label: t('errorMonitoring.severity.critical') },
              { value: 'error', label: t('errorMonitoring.severity.error') },
              { value: 'warning', label: t('errorMonitoring.severity.warning') },
              { value: 'info', label: t('errorMonitoring.severity.info') },
            ]}
            value={severityFilter}
            onChange={(val) => {
              setSeverityFilter(val);
              setPage(1);
            }}
            size="sm"
          />
        </div>
      </div>

      {/* Errors Responsive Data Table */}
      <div className="space-y-3">
        <ResponsiveDataTable
          data={errors}
          columns={columns}
          keyExtractor={(err) => err.id}
          loading={isLoading}
          emptyMessage={t('errorMonitoring.emptyMessage')}
          emptyIcon={CheckCircle2}
        />

        {/* Pagination Bar */}
        {pagination && pagination.total_pages > 1 && (
          <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-muted">
            <div>
              {pagination.page} / {pagination.total_pages} ({pagination.total})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || isFetching}
                className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed border border-default text-default flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>{t('common.prev', 'Prev')}</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={pagination.page >= pagination.total_pages || isFetching}
                className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed border border-default text-default flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{t('common.next', 'Next')}</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect & Triage Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="sm:hidden w-12 h-1.5 rounded-full bg-surface-sunken mx-auto mb-3" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-default pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {selectedError.severity}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    Trace #{selectedError.id}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-default font-mono mt-1">
                  {selectedError.error_type}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-mono">
                  {selectedError.occurrence_count} {t('errorMonitoring.columns.occurrences')}
                </span>
              </div>
            </div>

            {/* Error Message */}
            <div className="p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-[11px] font-bold text-muted block mb-1 uppercase font-mono">
                {t('errorMonitoring.modal.errorMessage')}
              </span>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-mono select-all">
                {selectedError.message}
              </p>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.fingerprint')}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-[11px] text-default truncate max-w-35">
                    {selectedError.fingerprint}
                  </span>
                  <button
                    onClick={() => handleCopy('fp', selectedError.fingerprint)}
                    className="text-muted hover:text-default"
                  >
                    {copiedKey === 'fp' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.tenantScope')}</span>
                <span className="font-semibold text-default block mt-1">
                  {selectedError.tenant ? selectedError.tenant.name : t('errorMonitoring.globalPlatform')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.routeModule')}</span>
                <span className="font-mono text-[11px] text-default block mt-1 truncate">
                  {selectedError.route || selectedError.module || 'System Backend'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.firstSeen')}</span>
                <span className="font-mono text-[11px] text-default block mt-1">
                  {new Date(selectedError.first_seen_at).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.lastSeen')}</span>
                <span className="font-mono text-[11px] text-default block mt-1">
                  {new Date(selectedError.last_seen_at).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block text-[10px] font-mono uppercase">{t('errorMonitoring.modal.environmentIp')}</span>
                <span className="font-mono text-[11px] text-default block mt-1">
                  {selectedError.environment} ({selectedError.ip || 'Local'})
                </span>
              </div>
            </div>

            {/* Stack Trace */}
            {selectedError.stack_trace && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-default font-mono">
                    {t('errorMonitoring.modal.stackTrace')}
                  </span>
                  <button
                    onClick={() => handleCopy('st', selectedError.stack_trace || '')}
                    className="text-xs text-muted hover:text-default flex items-center gap-1 font-mono"
                  >
                    {copiedKey === 'st' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{t('errorMonitoring.modal.copyTrace')}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-surface-sunken text-default font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto border border-default select-all">
                  {selectedError.stack_trace}
                </pre>
              </div>
            )}

            {/* Triage & Status Management */}
            <div className="p-4 rounded-xl bg-surface-sunken border border-default space-y-3">
              <span className="text-xs font-bold text-default font-mono uppercase">
                {t('errorMonitoring.modal.triageAction')}
              </span>
              <textarea
                rows={2}
                placeholder={t('errorMonitoring.modal.resolutionPlaceholder')}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-surface border border-default text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-primary"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ id: selectedError.id, status: 'investigating', note: resolutionNote })}
                  disabled={updateStatusMutation.isPending}
                >
                  {t('errorMonitoring.modal.markInvestigating')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ id: selectedError.id, status: 'resolved', note: resolutionNote })}
                  disabled={updateStatusMutation.isPending}
                >
                  {t('errorMonitoring.modal.markResolved')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ id: selectedError.id, status: 'ignored', note: resolutionNote })}
                  disabled={updateStatusMutation.isPending}
                >
                  {t('errorMonitoring.modal.markIgnored')}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-default">
              <Button variant="secondary" size="sm" onClick={() => setSelectedError(null)}>
                {t('errorMonitoring.modal.closeDiagnostic')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformErrorMonitoringWorkspace;
