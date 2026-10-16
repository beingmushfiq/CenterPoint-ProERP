// ═══════════════════════════════════════════════════════════════════════════
// TROUBLESHOOT WORKSPACE — Full diagnostic report page
// ───────────────────────────────────────────────────────────────────────────
// Route: /settings/troubleshoot
// Access: All authenticated tenant users (all roles)
//
// This workspace provides:
//   · Full session error log with diagnosis cards
//   · Severity filters and search
//   · System environment summary (browser, online status, session info)
//   · "Ask Brain" integration for complex errors
//   · "Report to Support" with auto-populated form
//   · Export diagnostic snapshot as text
//   · Clear log action
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Flame,
  ShieldAlert,
  Wrench,
  Brain,
  ClipboardList,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowRight,
  Wifi,
  WifiOff,
  Monitor,
  Globe,
  Clock,
  Shield,
  Activity,
  X,
} from 'lucide-react';
import { getLogs, subscribeToLogs, clearLogs } from '../../lib/observability/logger';
import type { LogEntry } from '../../lib/observability/logger';
import {
  buildDiagnosisSummary,
  severityMeta,
} from '../../lib/troubleshoot/troubleshootEngine';
import type { TroubleshootDiagnosis, TroubleshootSeverity } from '../../lib/troubleshoot/troubleshootEngine';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../lib/auth/authStore';

// ── Subscribe hook ────────────────────────────────────────────────────────────

function useLogs(): readonly LogEntry[] {
  return useSyncExternalStore(subscribeToLogs, getLogs);
}

// ── Severity Icon ─────────────────────────────────────────────────────────────

function SeverityIcon({ severity, className }: { severity: TroubleshootSeverity; className?: string }) {
  const meta = severityMeta(severity);
  switch (severity) {
    case 'critical': return <Flame className={cn('size-4 shrink-0', meta.iconCls, className)} />;
    case 'high': return <ShieldAlert className={cn('size-4 shrink-0', meta.iconCls, className)} />;
    case 'medium': return <AlertTriangle className={cn('size-4 shrink-0', meta.iconCls, className)} />;
    case 'low': return <Info className={cn('size-4 shrink-0', meta.iconCls, className)} />;
    default: return <CheckCircle2 className={cn('size-4 shrink-0', meta.iconCls, className)} />;
  }
}

// ── Expanded Diagnosis Detail Panel ───────────────────────────────────────────

function DiagnosisDetailPanel({
  diagnosis,
  onAskBrain,
  onReportToSupport,
}: {
  diagnosis: TroubleshootDiagnosis;
  onAskBrain: (d: TroubleshootDiagnosis) => void;
  onReportToSupport: (d: TroubleshootDiagnosis) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    if (!diagnosis.referenceId) return;
    navigator.clipboard.writeText(diagnosis.referenceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="mt-3 space-y-3 pt-3 border-t border-default/50">
      {/* Impact block */}
      <div className="p-3 rounded-xl bg-surface border border-default/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
          Business Impact
        </p>
        <p className="text-xs text-default leading-relaxed">{diagnosis.impact}</p>
      </div>

      {/* Fix steps */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Wrench className="size-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-default">Recommended Fix Steps</span>
        </div>
        <ol className="space-y-2">
          {diagnosis.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-default">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Navigation hint */}
      {diagnosis.navigationHint && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
          <ArrowRight className="size-3.5 shrink-0" />
          <span className="font-medium">Quick Navigation: {diagnosis.navigationHint}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono text-subtle">
        {diagnosis.referenceId && (
          <button
            type="button"
            onClick={handleCopyRef}
            className="flex items-center gap-1 hover:text-muted transition-colors cursor-pointer"
            title="Copy Reference ID"
          >
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            <span>REF: {diagnosis.referenceId}</span>
          </button>
        )}
        {diagnosis.route && <span>ROUTE: {diagnosis.route}</span>}
        <span>TIME: {new Date(diagnosis.capturedAt).toLocaleString()}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAskBrain(diagnosis)}
          leftIcon={<Brain className="size-3.5" />}
          className="text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 border"
        >
          Ask Brain to Diagnose
        </Button>
        {diagnosis.escalate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReportToSupport(diagnosis)}
            leftIcon={<ClipboardList className="size-3.5" />}
          >
            Report to Support
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Diagnosis Row ──────────────────────────────────────────────────────────────

function DiagnosisRow({
  diagnosis,
  expanded,
  onToggle,
  onAskBrain,
  onReportToSupport,
}: {
  diagnosis: TroubleshootDiagnosis;
  expanded: boolean;
  onToggle: () => void;
  onAskBrain: (d: TroubleshootDiagnosis) => void;
  onReportToSupport: (d: TroubleshootDiagnosis) => void;
}) {
  const meta = severityMeta(diagnosis.severity);

  return (
    <div
      className={cn(
        'rounded-2xl border border-l-[3px] transition-all duration-200',
        meta.borderCls,
        expanded ? 'border-default/70 bg-surface shadow-xs' : 'border-default/40 bg-surface hover:border-default/60'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 px-4 py-3.5 cursor-pointer rounded-2xl"
      >
        <div className={cn('flex size-8 items-center justify-center rounded-xl shrink-0 mt-0.5', meta.bgCls, 'border', meta.borderCls)}>
          <SeverityIcon severity={diagnosis.severity} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-default">{diagnosis.title}</span>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border', meta.badgeCls)}>
              {meta.label}
            </span>
            {diagnosis.escalate && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
                Escalate
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{diagnosis.reason}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-subtle font-mono">
            <span>{new Date(diagnosis.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {diagnosis.route && <span className="truncate max-w-48">{diagnosis.route}</span>}
          </div>
        </div>

        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="size-4 text-muted" />
          ) : (
            <ChevronRight className="size-4 text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <DiagnosisDetailPanel
            diagnosis={diagnosis}
            onAskBrain={onAskBrain}
            onReportToSupport={onReportToSupport}
          />
        </div>
      )}
    </div>
  );
}

// ── Environment Panel ──────────────────────────────────────────────────────────

function EnvironmentPanel() {
  const user = useAuthStore((s) => s.user);
  const isOnline = navigator.onLine;
  const ua = navigator.userAgent;
  const browserName = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';

  const items = [
    { icon: isOnline ? Wifi : WifiOff, label: 'Network', value: isOnline ? 'Online' : 'Offline', ok: isOnline },
    { icon: Monitor, label: 'Browser', value: browserName, ok: true },
    { icon: Globe, label: 'Platform', value: navigator.platform || 'Unknown', ok: true },
    { icon: Shield, label: 'Session', value: user ? `${user.name}` : 'Not authenticated', ok: Boolean(user) },
    { icon: Clock, label: 'Local Time', value: new Date().toLocaleString(), ok: true },
  ];

  return (
    <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-default">System Environment</h3>
      </div>
      <div className="space-y-2">
        {items.map(({ icon: Icon, label, value, ok }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={cn('size-3.5', ok ? 'text-muted' : 'text-danger')} />
              <span className="text-xs text-muted">{label}</span>
            </div>
            <span className={cn('text-xs font-medium font-mono truncate max-w-48', ok ? 'text-default' : 'text-danger')}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TROUBLESHOOT WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════

type SeverityFilter = 'all' | TroubleshootSeverity;

export function TroubleshootWorkspace() {
  const navigate = useNavigate();
  const rawLogs = useLogs();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const { diagnoses, hasErrors, topSeverity, errorCount, criticalCount } = useMemo(
    () => buildDiagnosisSummary(rawLogs),
    [rawLogs]
  );

  // Filter
  const filtered = useMemo(() => {
    let result = diagnoses;
    if (severityFilter !== 'all') {
      result = result.filter((d) => d.severity === severityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.reason.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          (d.route && d.route.toLowerCase().includes(q))
      );
    }
    return result;
  }, [diagnoses, severityFilter, search]);

  const handleAskBrain = useCallback((d: TroubleshootDiagnosis) => {
    const context = `I encountered an error: "${d.title}". Reason: "${d.reason}". Impact: "${d.impact}". Reference: ${d.referenceId ?? 'N/A'}. Please help me understand what happened and how to fix it.`;
    // Navigate to dashboard with Brain context via query param (picked up by SliceMartBrainModal)
    navigate(`/dashboard?brain=${encodeURIComponent(context)}`);
  }, [navigate]);

  const handleReportToSupport = useCallback((d: TroubleshootDiagnosis) => {
    const params = new URLSearchParams({
      prefill_title: `[${d.severity.toUpperCase()}] ${d.title}`,
      prefill_description: `Error: ${d.title}\nReason: ${d.reason}\nImpact: ${d.impact}\nReference: ${d.referenceId ?? 'N/A'}\nRoute: ${d.route ?? 'N/A'}\nTime: ${d.capturedAt}`,
      prefill_category: 'technical',
    });
    navigate(`/settings?tab=support&${params.toString()}`);
  }, [navigate]);

  const handleExport = () => {
    const lines = [
      `ProERP Diagnostic Snapshot — ${new Date().toISOString()}`,
      `Total Issues: ${errorCount}`,
      `Critical/High: ${criticalCount}`,
      '',
      ...diagnoses.map((d, i) => [
        `--- Issue #${i + 1} ---`,
        `Severity: ${d.severity.toUpperCase()}`,
        `Title: ${d.title}`,
        `Code: ${d.code}`,
        `Reason: ${d.reason}`,
        `Impact: ${d.impact}`,
        `Steps: ${d.steps.map((s, j) => `${j + 1}. ${s}`).join(' | ')}`,
        `Reference: ${d.referenceId ?? 'N/A'}`,
        `Route: ${d.route ?? 'N/A'}`,
        `Time: ${d.capturedAt}`,
      ].join('\n')),
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proerp-diagnostics-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    clearLogs();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  const topMeta = topSeverity ? severityMeta(topSeverity) : null;

  const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'info', label: 'Info' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex size-10 items-center justify-center rounded-2xl shrink-0',
              hasErrors
                ? 'bg-orange-500/15 border border-orange-500/30'
                : 'bg-success-subtle border border-success/30'
            )}>
              {hasErrors ? (
                <AlertTriangle className="size-5 text-orange-500" />
              ) : (
                <CheckCircle2 className="size-5 text-success" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-default tracking-tight">System Troubleshoot</h1>
              <p className="text-sm text-muted mt-0.5">
                {hasErrors
                  ? `${errorCount} issue${errorCount !== 1 ? 's' : ''} detected — ${criticalCount} requiring immediate attention`
                  : 'All systems operational — no issues detected this session'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              leftIcon={<Download className="size-3.5" />}
              disabled={!hasErrors}
            >
              Export Snapshot
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="size-3.5" />}
            >
              Reload App
            </Button>
            {hasErrors && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearLogs}
                leftIcon={cleared ? <Check className="size-3.5" /> : <Trash2 className="size-3.5" />}
              >
                {cleared ? 'Cleared' : 'Clear Log'}
              </Button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        {hasErrors && topSeverity && topMeta && (
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-2xl border',
            topMeta.bgCls,
            'border-default/50'
          )}>
            <div className={cn('flex size-9 items-center justify-center rounded-xl border', topMeta.borderCls, topMeta.bgCls)}>
              <SeverityIcon severity={topSeverity} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-default">
                {criticalCount > 0
                  ? `${criticalCount} critical or high-priority issue${criticalCount !== 1 ? 's' : ''} need your attention`
                  : 'Issues detected — follow the recommended steps below'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Expand each issue to see the reason, business impact, and step-by-step fix instructions.
              </p>
            </div>
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = filtered[0];
                  if (first) setExpandedId(first.referenceId ?? first.code + first.capturedAt);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-default text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0"
              >
                <span>View Top Issue</span>
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main issues list */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search issues..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-default bg-surface text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-default cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Severity pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {SEVERITY_FILTERS.map(({ value, label }) => {
                  const count = value === 'all'
                    ? diagnoses.length
                    : diagnoses.filter((d) => d.severity === value).length;
                  if (value !== 'all' && count === 0) return null;
                  const meta = value !== 'all' ? severityMeta(value as TroubleshootSeverity) : null;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSeverityFilter(value)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer',
                        severityFilter === value
                          ? value === 'all'
                            ? 'bg-primary text-primary-fg border-primary'
                            : cn(meta!.badgeCls, 'opacity-100')
                          : 'bg-surface border-default text-muted hover:bg-surface-sunken'
                      )}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span className="ml-0.5 opacity-70">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Issues list */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                {hasErrors ? (
                  <div className="space-y-2">
                    <Filter className="size-8 text-muted mx-auto" />
                    <p className="text-sm font-semibold text-default">No issues match your filters</p>
                    <p className="text-xs text-muted">Try adjusting the severity filter or clearing the search.</p>
                    <button
                      type="button"
                      onClick={() => { setSeverityFilter('all'); setSearch(''); }}
                      className="mt-2 text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="size-14 rounded-3xl bg-success-subtle border border-success/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="size-7 text-success" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-default">No issues detected</p>
                      <p className="text-sm text-muted mt-1">Your system is running normally this session.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((d) => {
                  const id = d.referenceId ?? d.code + d.capturedAt;
                  return (
                    <DiagnosisRow
                      key={id}
                      diagnosis={d}
                      expanded={expandedId === id}
                      onToggle={() => setExpandedId((prev) => prev === id ? null : id)}
                      onAskBrain={handleAskBrain}
                      onReportToSupport={handleReportToSupport}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Environment */}
            <EnvironmentPanel />

            {/* Quick actions */}
            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs space-y-2">
              <h3 className="text-sm font-semibold text-default mb-3">Quick Actions</h3>
              <button
                type="button"
                onClick={() => navigate('/dashboard?brain=open')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer text-left"
              >
                <Brain className="size-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Ask Brain</p>
                  <p className="text-[10px] text-purple-500/80 dark:text-purple-400/60">AI-powered diagnosis assistance</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings?tab=support')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-sunken border border-default hover:bg-surface-raised transition-colors cursor-pointer text-left"
              >
                <ClipboardList className="size-4 shrink-0 text-muted" />
                <div>
                  <p className="text-xs font-semibold text-default">Submit Support Ticket</p>
                  <p className="text-[10px] text-muted">Report an issue to our team</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/audit-logs')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-sunken border border-default hover:bg-surface-raised transition-colors cursor-pointer text-left"
              >
                <Activity className="size-4 shrink-0 text-muted" />
                <div>
                  <p className="text-xs font-semibold text-default">Activity Audit Log</p>
                  <p className="text-[10px] text-muted">View all system activity history</p>
                </div>
              </button>
            </div>

            {/* Tips */}
            <div className="bg-info-subtle rounded-2xl border border-info/20 p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Info className="size-4 text-info shrink-0" />
                <p className="text-xs font-semibold text-default">What is Troubleshoot?</p>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                This page shows all errors and warnings captured during your current session. Issues are automatically analyzed and explained in plain language with step-by-step fix instructions.
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Logs persist for 24 hours and are stored locally on your device — nothing is sent to the server unless you choose to report it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
