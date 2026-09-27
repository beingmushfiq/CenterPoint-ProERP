import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  History,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  FileText,
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  Edit3,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../lib/api/client';

export interface AuditRecord {
  id: number;
  action: string;
  auditable_type: string;
  auditable_id: number | string;
  user_id?: number | null | undefined;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null | undefined;
  old_values?: Record<string, unknown> | null | undefined;
  new_values?: Record<string, unknown> | null | undefined;
  before?: Record<string, unknown> | null | undefined;
  after?: Record<string, unknown> | null | undefined;
  ip_address?: string | null | undefined;
  created_at: string;
}

export interface AuditTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: number | string | undefined;
  entityTitle?: string | undefined;
  entityCode?: string | undefined;
}

function formatDiffValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export const AuditTimelineDrawer: React.FC<AuditTimelineDrawerProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  entityCode,
}) => {
  const titleId = useId();
  const subtitleId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [expandedDiffs, setExpandedDiffs] = useState<Record<number, boolean>>({});

  // Focus management: save previous focus & auto-focus drawer panel
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        drawerRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to close & Tab / Shift+Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const container = drawerRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<AuditRecord[]>({
    queryKey: ['audit-logs', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const res = await api.get<AuditRecord[] | { success?: boolean; data: AuditRecord[] }>(
        `/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}`
      );
      const raw = res.data as unknown;
      if (Array.isArray(raw)) {
        return raw as AuditRecord[];
      }
      if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as { data: unknown }).data)) {
        return (raw as { data: AuditRecord[] }).data;
      }
      return [];
    },
    enabled: isOpen && !!entityId,
    staleTime: 30000,
  });

  const toggleDiff = (id: number) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllDiffs = () => {
    const next: Record<number, boolean> = {};
    for (const log of logs) {
      next[log.id] = true;
    }
    setExpandedDiffs(next);
  };

  const collapseAllDiffs = () => {
    setExpandedDiffs({});
  };

  const getActionTone = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('store') || act.includes('open')) {
      return {
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500 ring-emerald-500/20',
        icon: Plus,
      };
    }
    if (act.includes('delete') || act.includes('destroy') || act.includes('void')) {
      return {
        badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500 ring-rose-500/20',
        icon: Trash2,
      };
    }
    if (act.includes('approve') || act.includes('post') || act.includes('pay')) {
      return {
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        dot: 'bg-purple-500 ring-purple-500/20',
        icon: ShieldCheck,
      };
    }
    if (act.includes('status') || act.includes('cancel')) {
      return {
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500 ring-amber-500/20',
        icon: SlidersHorizontal,
      };
    }
    return {
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      dot: 'bg-blue-500 ring-blue-500/20',
      icon: Edit3,
    };
  };

  const filteredLogs = useMemo(() => {
    if (!searchFilter.trim()) return logs;
    const q = searchFilter.toLowerCase().trim();
    return logs.filter((record) => {
      const matchAction = record.action.toLowerCase().includes(q);
      const matchUser = record.user?.name.toLowerCase().includes(q) || record.user?.email.toLowerCase().includes(q);
      const oldVals = record.old_values || record.before || {};
      const newVals = record.new_values || record.after || {};
      const matchKeys = [...Object.keys(oldVals), ...Object.keys(newVals)].some((k) => k.toLowerCase().includes(q));
      return matchAction || matchUser || matchKeys;
    });
  }, [logs, searchFilter]);

  const hasAnyDiffs = useMemo(() => {
    return logs.some((l) => {
      const oldVals = l.old_values || l.before || {};
      const newVals = l.new_values || l.after || {};
      return Object.keys(oldVals).length > 0 || Object.keys(newVals).length > 0;
    });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Accessible Backdrop Button */}
      <button
        type="button"
        aria-label="Close audit panel backdrop"
        onClick={onClose}
        tabIndex={-1}
        className="fixed inset-0 w-full h-full bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 border-none cursor-default"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-md bg-surface border-l border-default shadow-2xl flex flex-col focus:outline-none transition-transform duration-200"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-default bg-surface-sunken/40">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <History className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 id={titleId} className="text-sm font-bold text-default">
                      Audit Trail
                    </h2>
                    <span className="rounded-md border border-default bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted">
                      {entityType}
                    </span>
                  </div>
                  <p id={subtitleId} className="text-xs text-muted truncate max-w-65">
                    {entityTitle || `#${entityId}`}
                    {entityCode ? ` · ${entityCode}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  aria-label="Refresh audit history"
                  className="flex size-8 items-center justify-center rounded-lg border border-default text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer"
                  title="Refresh logs"
                >
                  <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close audit panel"
                  className="flex size-8 items-center justify-center rounded-lg border border-default text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer"
                  title="Close panel (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Sub-header Controls: Search & Expand Toggle */}
            {logs.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter events, actors, or fields..."
                    className="w-full rounded-lg border border-default bg-surface py-1 pl-7 pr-2.5 text-[11px] text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                {hasAnyDiffs && (
                  <div className="flex items-center rounded-lg border border-default bg-surface p-0.5 shrink-0 text-[10px]">
                    <button
                      type="button"
                      onClick={expandAllDiffs}
                      className="px-2 py-0.5 rounded text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer font-medium"
                    >
                      Expand
                    </button>
                    <span className="text-default/30">|</span>
                    <button
                      type="button"
                      onClick={collapseAllDiffs}
                      className="px-2 py-0.5 rounded text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer font-medium"
                    >
                      Collapse
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="size-7 rounded-full bg-surface-sunken" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-sunken rounded w-1/3" />
                      <div className="h-3 bg-surface-sunken rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-500/20 bg-rose-500/5 my-8">
                <AlertCircle className="size-8 text-rose-500 mb-2" />
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  Failed to load audit history
                </p>
                <p className="text-[11px] text-muted mb-4 max-w-xs">
                  {error instanceof Error ? error.message : 'Network error'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-lg border border-default bg-surface px-3 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center my-12">
                <div className="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-muted mb-3">
                  <FileText className="size-6" />
                </div>
                <h3 className="text-xs font-bold text-default mb-1">
                  No Audit History Found
                </h3>
                <p className="text-[11px] text-muted max-w-xs leading-relaxed">
                  No lifecycle updates or state modifications have been recorded for this {entityType.toLowerCase()} yet.
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center my-8">
                <p className="text-xs font-medium text-muted">No audit events match &quot;{searchFilter}&quot;.</p>
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="mt-2 text-xs text-primary hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-default">
                {filteredLogs.map((record) => {
                  const isExpanded = !!expandedDiffs[record.id];
                  const tone = getActionTone(record.action);
                  const Icon = tone.icon;
                  const oldVals = record.old_values || record.before || {};
                  const newVals = record.new_values || record.after || {};
                  const hasDiff = Object.keys(oldVals).length > 0 || Object.keys(newVals).length > 0;
                  const diffKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));

                  const actorName = record.user?.name || (record.user_id ? `User #${record.user_id}` : 'System Automated');
                  const actorInitials = actorName
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={record.id} className="relative group">
                      {/* Timeline dot with tone */}
                      <div
                        className={`absolute -left-6 top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-surface ${tone.dot} ring-2`}
                      />

                      <div className="rounded-xl border border-default bg-surface p-3.5 shadow-2xs hover:border-default/80 transition-all">
                        {/* Event title & badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.badge}`}
                          >
                            <Icon className="size-2.5" />
                            <span>{record.action.replace(/[._]/g, ' ')}</span>
                          </span>

                          <div className="flex items-center gap-1 text-[10px] text-muted">
                            <Clock className="size-3" />
                            <span>
                              {new Date(record.created_at).toLocaleString(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Actor info */}
                        <div className="flex items-center gap-2 text-xs text-default mb-2">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-bold text-muted border border-default">
                            {actorInitials || <User className="size-3" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs truncate">
                              {actorName}
                            </div>
                            {record.user?.email && (
                              <div className="text-[10px] text-muted truncate">
                                {record.user.email}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Attribute changes diff */}
                        {hasDiff && (
                          <div className="mt-2 pt-2 border-t border-default/50">
                            <button
                              type="button"
                              onClick={() => toggleDiff(record.id)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              <span>{diffKeys.length} attribute change(s)</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 rounded-lg border border-default bg-surface-sunken/60 p-2.5 text-[10px] font-mono">
                                {diffKeys.map((key) => {
                                  const oldV = formatDiffValue(oldVals[key]);
                                  const newV = formatDiffValue(newVals[key]);
                                  return (
                                    <div key={key} className="flex flex-col gap-0.5 border-b border-default/30 pb-1.5 last:border-0 last:pb-0">
                                      <span className="font-semibold text-default break-all">{key}:</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="line-through text-rose-500/80 break-all">
                                          {oldV}
                                        </span>
                                        <span className="text-muted">→</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 break-all">
                                          {newV}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 border-t border-default bg-surface-sunken/30 text-[10px] text-muted flex items-center justify-between">
            <span>Immutable audit ledger</span>
            <span>Recorded via TenantContext</span>
          </div>
        </div>
      </div>
    </div>
  );
};

