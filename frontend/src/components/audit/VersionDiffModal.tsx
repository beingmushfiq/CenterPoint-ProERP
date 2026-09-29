import React, { useState } from 'react';
import {
  History,
  ArrowRight,
  User as UserIcon,
  Clock,
  Globe,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface AuditLogEntry {
  id: number;
  uuid: string;
  user_id?: number | null;
  action: string;
  auditable_type?: string | null;
  auditable_id?: number | string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changed_fields?: string[] | null;
  context?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  correlation_id?: string | null;
  created_at?: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

interface VersionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogEntry | null;
}

export const VersionDiffModal: React.FC<VersionDiffModalProps> = ({ isOpen, onClose, log }) => {
  const [viewMode, setViewMode] = useState<'diff' | 'raw'>('diff');

  if (!log) return null;

  const before = log.before || {};
  const after = log.after || {};

  // Collect all unique keys from both before and after
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  const changedFieldsList =
    log.changed_fields && log.changed_fields.length > 0
      ? log.changed_fields
      : allKeys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  };

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('store') || act.includes('insert')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (act.includes('update') || act.includes('edit') || act.includes('modify')) {
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Activity Version & Mutation Diff"
      size="xl"
    >
      <div className="space-y-6 max-h-[82vh] overflow-y-auto pr-1">
        {/* Header Metadata Summary Card */}
        <div className="rounded-2xl border border-default bg-surface-sunken p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider border ${getActionColor(
                  log.action
                )}`}
              >
                {log.action}
              </span>

              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-default">
                <span>{log.auditable_type?.split('\\').pop() || 'Entity'}</span>
                {log.auditable_id && (
                  <span className="text-primary">#{log.auditable_id}</span>
                )}
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-default bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('diff')}
                className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'diff' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-default'
                }`}
              >
                Visual Diff ({changedFieldsList.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'raw' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-default'
                }`}
              >
                Raw Snapshots (JSON)
              </button>
            </div>
          </div>

          {/* Actor & Telemetry Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-default/60">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted block">Operator</span>
              <div className="flex items-center gap-1.5 font-semibold text-default truncate">
                <UserIcon className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{log.user?.name || (log.user_id ? `User #${log.user_id}` : 'System Task')}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted block">Recorded At</span>
              <div className="flex items-center gap-1.5 font-mono text-default truncate">
                <Clock className="size-3.5 text-muted shrink-0" />
                <span>{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted block">IP Address</span>
              <div className="flex items-center gap-1.5 font-mono text-default truncate">
                <Globe className="size-3.5 text-muted shrink-0" />
                <span>{log.ip || '127.0.0.1'}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted block">Correlation ID</span>
              <div className="font-mono text-muted text-[11px] truncate" title={log.correlation_id || ''}>
                {log.correlation_id ? log.correlation_id.slice(0, 16) + '...' : 'Direct API'}
              </div>
            </div>
          </div>
        </div>

        {/* Diff View */}
        {viewMode === 'diff' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-default flex items-center gap-1.5">
                <History className="size-4 text-emerald-500" />
                <span>Field-Level Version Changes</span>
              </h4>
              <span className="text-xs text-muted font-mono">
                {changedFieldsList.length} of {allKeys.length} fields modified
              </span>
            </div>

            {changedFieldsList.length === 0 ? (
              <div className="rounded-xl border border-default bg-surface p-8 text-center space-y-2">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                <h5 className="text-sm font-bold text-default">No field values changed</h5>
                <p className="text-xs text-muted">
                  This activity recorded an authorization, status inspection, or non-mutating action.
                </p>
              </div>
            ) : (
              <>
                {/* Executive Change Summary Chips */}
                <div className="rounded-xl border border-default bg-surface-sunken/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                      Executive Change Summary
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {changedFieldsList.length} field mutation{changedFieldsList.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {changedFieldsList.map((key) => {
                      const valBefore = before[key];
                      const valAfter = after[key];
                      const humanName = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                      const formatPillVal = (v: unknown): string => {
                        if (v === null || v === undefined) return 'none';
                        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
                        if (typeof v === 'number') {
                          if (key.includes('price') || key.includes('amount') || key.includes('cost') || key.includes('total')) {
                            return `৳ ${v.toLocaleString('en-US')}`;
                          }
                          return v.toLocaleString('en-US');
                        }
                        if (typeof v === 'object') return Array.isArray(v) ? `[${v.length} items]` : '{...}';
                        const str = String(v);
                        return str.length > 20 ? `${str.slice(0, 18)}...` : str;
                      };

                      return (
                        <div
                          key={key}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-mono shadow-xs"
                        >
                          <span className="font-semibold text-default">{humanName}:</span>
                          <span className="line-through text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            {formatPillVal(valBefore)}
                          </span>
                          <ArrowRight className="size-3 text-muted shrink-0" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            {formatPillVal(valAfter)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-default bg-surface overflow-hidden divide-y divide-default">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-surface-sunken px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-default">
                  <div className="col-span-3">Field Key</div>
                  <div className="col-span-4">Previous State (Before)</div>
                  <div className="col-span-1 text-center"></div>
                  <div className="col-span-4">New State (After)</div>
                </div>

                {/* Diff Rows */}
                {changedFieldsList.map((key) => {
                  const valBefore = before[key];
                  const valAfter = after[key];
                  const isAdded = valBefore === undefined && valAfter !== undefined;
                  const isRemoved = valBefore !== undefined && valAfter === undefined;

                  return (
                    <div
                      key={key}
                      className="grid grid-cols-12 px-4 py-3 text-xs items-start gap-2 hover:bg-surface-sunken/30 transition-colors"
                    >
                      {/* Key */}
                      <div className="col-span-3">
                        <span className="font-mono font-bold text-default">{key}</span>
                        {isAdded && (
                          <span className="ml-1.5 inline-block rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            ADDED
                          </span>
                        )}
                        {isRemoved && (
                          <span className="ml-1.5 inline-block rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                            REMOVED
                          </span>
                        )}
                      </div>

                      {/* Before */}
                      <div className="col-span-4 font-mono text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 overflow-x-auto whitespace-pre-wrap break-all">
                        {formatValue(valBefore)}
                      </div>

                      {/* Arrow */}
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        <ArrowRight className="size-4 text-muted" />
                      </div>

                      {/* After */}
                      <div className="col-span-4 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 overflow-x-auto whitespace-pre-wrap break-all font-semibold">
                        {formatValue(valAfter)}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        ) : (
          /* Raw JSON Snapshots Comparison */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <FileCode className="size-3.5" />
                <span>Before Mutation Snapshot</span>
              </h5>
              <pre className="rounded-xl border border-default bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 max-h-96 overflow-auto leading-relaxed">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <FileCode className="size-3.5" />
                <span>After Mutation Snapshot</span>
              </h5>
              <pre className="rounded-xl border border-default bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 max-h-96 overflow-auto leading-relaxed">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-default">
          <Button variant="secondary" onClick={onClose} size="sm">
            Close Version Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
};
