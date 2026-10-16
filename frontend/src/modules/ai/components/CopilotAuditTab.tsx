import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  Code,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { copilotApi, type PaginatedResult } from '../api/copilotApi';
import type { AgentAuditLogItem, PermissionTier } from '../types/copilot';
import { notify } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';

export const CopilotAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AgentAuditLogItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    last_page: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('');

  // Dropdown & Modal state adhering to ERP Standards
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [inspectingLog, setInspectingLog] = useState<AgentAuditLogItem | null>(null);

  // Click-outside listener for action menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadLogs = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const params: { permission_tier?: number; tool_name?: string; page: number; per_page: number } = {
        page,
        per_page: pagination.per_page,
      };
      if (tierFilter !== 'all') {
        params.permission_tier = Number(tierFilter);
      }
      if (toolFilter.trim()) {
        params.tool_name = toolFilter.trim();
      }

      const result: PaginatedResult<AgentAuditLogItem> = await copilotApi.getAuditLogs(params);

      setLogs(result.data || []);
      setPagination({
        page: result.current_page || 1,
        per_page: result.per_page || 25,
        total: result.total || 0,
        last_page: result.last_page || 1,
      });
    } catch {
      notify.error('Failed to load compliance audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.per_page, tierFilter, toolFilter]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        loadLogs(1);
      }
    });
    return () => {
      active = false;
    };
  }, [loadLogs]);

  const getTierBadge = (tier: PermissionTier) => {
    switch (tier) {
      case 2:
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 1:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 0:
      default:
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters & Refresh Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4.5 text-primary" />
          <div>
            <h3 className="text-xs font-bold text-default">AI Copilot Security & Audit Trail</h3>
            <p className="text-[10px] text-muted">
              Tamper-evident log of all tool calls, permissions, parameters and latencies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tool filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by tool..."
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl bg-surface-sunken border border-default text-default focus:border-primary focus:outline-none w-36"
            />
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-default text-xs">
            {(['all', '0', '1', '2'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${
                  tierFilter === t
                    ? 'bg-surface text-default shadow-2xs font-semibold'
                    : 'text-muted hover:text-default'
                }`}
              >
                {t === 'all' ? 'All Tiers' : `Tier ${t}`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadLogs(pagination.page)}
            className="p-1.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition"
            title="Refresh logs"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Audit Log Table adhering to ERP Table & Action Standards */}
      <div className="bg-surface rounded-2xl shadow-2xs border border-default/70 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-default/30">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="bg-surface-sunken/80 border-b border-default text-muted uppercase text-[10px] font-semibold">
              <tr>
                <th className="w-28 px-2.5 py-2.5 whitespace-nowrap">Timestamp</th>
                <th className="w-44 px-2.5 py-2.5 whitespace-nowrap">Tool / Function</th>
                <th className="w-20 px-2 py-2.5 text-center whitespace-nowrap">Tier</th>
                <th className="w-24 px-2 py-2.5 text-center whitespace-nowrap">Status</th>
                <th className="w-20 px-2 py-2.5 text-right whitespace-nowrap">Latency</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Operator</th>
                <th className="w-36 px-2 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-default/40">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-muted">
                    <RefreshCw className="size-4 animate-spin text-primary inline-block mr-2" />
                    <span>Loading audit trail...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-muted">
                    No compliance audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-surface-sunken/40 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="w-28 px-2.5 py-2.5 text-[11px] font-mono text-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Tool */}
                    <td className="w-44 px-2.5 py-2.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-primary">{log.tool_name}</span>
                    </td>

                    {/* Permission Tier */}
                    <td className="w-20 px-2 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getTierBadge(
                          log.permission_tier
                        )}`}
                      >
                        Tier {log.permission_tier}
                      </span>
                    </td>

                    {/* Executed Status */}
                    <td className="w-24 px-2 py-2.5 text-center whitespace-nowrap">
                      {log.executed ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-2.5" />
                          <span>Executed</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          title={log.blocked_reason || 'Blocked'}
                        >
                          <XCircle className="size-2.5" />
                          <span>Blocked</span>
                        </span>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="w-20 px-2 py-2.5 text-right font-mono text-[11px] text-muted whitespace-nowrap">
                      {log.duration_ms}ms
                    </td>

                    {/* Operator */}
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      <span className="text-default font-medium">
                        {log.user?.name || 'System Auto'}
                      </span>
                    </td>

                    {/* Actions Column (Standard: Only Two Symmetrical Interactive Buttons Per Row) */}
                    <td className="w-36 px-2 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 relative">
                        {/* 1. Primary Direct Action Button */}
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1"
                          title="Inspect raw tool input and execution output"
                        >
                          <Eye className="size-3 text-muted" />
                          <span>Inspect</span>
                        </button>

                        {/* 2. Prominent Actions Dropdown Button (Never a naked 3-dot icon!) */}
                        <div className="relative inline-block text-left" data-action-menu>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(
                                openActionMenuId === log.id ? null : log.id
                              );
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                              openActionMenuId === log.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-default bg-surface hover:bg-surface-sunken text-default'
                            }`}
                            title={`More options for ${log.tool_name}`}
                            aria-label={`More options for ${log.tool_name}`}
                          >
                            <span>Actions</span>
                            <ChevronDown className="size-3 text-muted" />
                          </button>

                          {/* Dropdown Menu */}
                          {openActionMenuId === log.id && (
                            <div className="absolute right-0 z-50 mt-1.5 w-48 rounded-xl bg-surface border border-default p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setInspectingLog(log);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Code className="size-3.5 text-primary shrink-0" />
                                <span>View Raw JSON</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.last_page > 1 && (
          <div className="px-4 py-3 border-t border-default flex items-center justify-between text-xs text-muted">
            <div>
              Showing page {pagination.page} of {pagination.last_page} ({pagination.total} entries)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadLogs(pagination.page - 1)}
                className="px-2.5 py-1 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-50 transition cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.last_page}
                onClick={() => loadLogs(pagination.page + 1)}
                className="px-2.5 py-1 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-50 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Raw Payload Inspector Modal */}
      {inspectingLog && (
        <Modal
          open={Boolean(inspectingLog)}
          onClose={() => setInspectingLog(null)}
          title={`Audit Record: ${inspectingLog.tool_name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-surface-sunken border border-default">
              <div>
                <span className="text-[10px] uppercase text-muted font-semibold">Tier</span>
                <div className="font-bold text-default mt-0.5">
                  Tier {inspectingLog.permission_tier}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted font-semibold">Status</span>
                <div className="font-bold text-default mt-0.5">
                  {inspectingLog.executed ? 'Executed' : 'Blocked'}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted font-semibold">Latency</span>
                <div className="font-mono font-bold text-default mt-0.5">
                  {inspectingLog.duration_ms} ms
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted font-semibold">IP Address</span>
                <div className="font-mono text-default mt-0.5">
                  {inspectingLog.ip_address || '127.0.0.1'}
                </div>
              </div>
            </div>

            {inspectingLog.blocked_reason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                <span className="font-bold">Blocked Reason: </span>
                {inspectingLog.blocked_reason}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted uppercase">Input Payload:</span>
              <pre className="p-3 rounded-xl bg-surface-sunken border border-default text-[11px] font-mono text-default overflow-x-auto max-h-48">
                {JSON.stringify(inspectingLog.input_payload, null, 2)}
              </pre>
            </div>

            {inspectingLog.output_payload && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted uppercase">Output Result:</span>
                <pre className="p-3 rounded-xl bg-surface-sunken border border-default text-[11px] font-mono text-default overflow-x-auto max-h-48">
                  {JSON.stringify(inspectingLog.output_payload, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-default">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 text-xs font-semibold bg-surface border border-default hover:bg-surface-sunken text-default rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
