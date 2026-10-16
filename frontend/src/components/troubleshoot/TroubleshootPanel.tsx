// ═══════════════════════════════════════════════════════════════════════════
// TROUBLESHOOT PANEL — Floating diagnostic panel
// ───────────────────────────────────────────────────────────────────────────
// Triggered from the AppHeader persistent badge when errors exist.
// Shows a ranked list of current session diagnoses with plain-English
// explanations, fix steps, and a "View Full Report" link to the workspace.
//
// Design rules:
//   · Reads from logger.ts buffer only (frontend-only, no API needed).
//   · Never shows raw stack traces or error class names.
//   · Provides a "Report to Support" action that auto-fills the support form.
//   · Shows an "Ask Brain to Diagnose" button for complex/escalation-flagged issues.
//   · "View Full Report" navigates to /settings/troubleshoot.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Brain,
  ArrowRight,
  Wrench,
  ShieldAlert,
  Flame,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { getLogs, subscribeToLogs } from '../../lib/observability/logger';
import { buildDiagnosisSummary, severityMeta } from '../../lib/troubleshoot/troubleshootEngine';
import type { TroubleshootDiagnosis, TroubleshootSeverity } from '../../lib/troubleshoot/troubleshootEngine';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

// ── Subscribe hook ────────────────────────────────────────────────────────────

function useTroubleshootData() {
  const entries = useSyncExternalStore(subscribeToLogs, getLogs);
  return useMemo(() => buildDiagnosisSummary(entries), [entries]);
}

// ── Severity Icon ─────────────────────────────────────────────────────────────

function SeverityIcon({ severity, className }: { severity: TroubleshootSeverity; className?: string }) {
  const meta = severityMeta(severity);
  switch (severity) {
    case 'critical':
      return <Flame className={cn('size-4', meta.iconCls, className)} />;
    case 'high':
      return <ShieldAlert className={cn('size-4', meta.iconCls, className)} />;
    case 'medium':
      return <AlertTriangle className={cn('size-4', meta.iconCls, className)} />;
    case 'low':
      return <Info className={cn('size-4', meta.iconCls, className)} />;
    case 'info':
    default:
      return <CheckCircle2 className={cn('size-4', meta.iconCls, className)} />;
  }
}

// ── Single Diagnosis Card ─────────────────────────────────────────────────────

function DiagnosisCard({
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
  const [copied, setCopied] = useState(false);
  const meta = severityMeta(diagnosis.severity);

  const handleCopyRef = () => {
    if (!diagnosis.referenceId) return;
    navigator.clipboard.writeText(diagnosis.referenceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const timeLabel = new Date(diagnosis.capturedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'rounded-xl border border-l-[3px] transition-all duration-200',
        meta.borderCls,
        meta.bgCls,
        expanded ? 'border-default/60' : 'border-default/40 hover:border-default/70'
      )}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-2.5 p-3 cursor-pointer rounded-xl"
      >
        <SeverityIcon severity={diagnosis.severity} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-default leading-tight">
              {diagnosis.title}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0',
                meta.badgeCls
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
            {diagnosis.reason}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-subtle font-mono">{timeLabel}</span>
            {diagnosis.route && (
              <span className="text-[10px] text-subtle truncate max-w-32">{diagnosis.route}</span>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn(
            'size-3.5 text-muted shrink-0 mt-1 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Impact */}
          <div className="p-2.5 rounded-lg bg-surface border border-default/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Impact</p>
            <p className="text-xs text-default leading-relaxed">{diagnosis.impact}</p>
          </div>

          {/* Fix steps */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="size-3 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Recommended Steps
              </span>
            </div>
            <ol className="space-y-1.5">
              {diagnosis.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-default">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Navigation hint */}
          {diagnosis.navigationHint && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary">
              <ArrowRight className="size-3" />
              <span className="font-medium">{diagnosis.navigationHint}</span>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Copy ref */}
            {diagnosis.referenceId && (
              <button
                type="button"
                onClick={handleCopyRef}
                className="flex items-center gap-1 text-[10px] font-mono text-muted hover:text-default transition-colors cursor-pointer"
                title="Copy Reference ID"
              >
                {copied ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{diagnosis.referenceId.slice(0, 16)}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              {diagnosis.escalate && (
                <button
                  type="button"
                  onClick={() => onReportToSupport(diagnosis)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-colors cursor-pointer"
                >
                  <ClipboardList className="size-3" />
                  <span>Report</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onAskBrain(diagnosis)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
              >
                <Brain className="size-3" />
                <span>Ask Brain</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TROUBLESHOOT PANEL — the floating panel shell
// ═══════════════════════════════════════════════════════════════════════════

interface TroubleshootPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenBrain?: (context: string) => void;
  /** If set, expands this errorId by default */
  highlightedErrorId?: string | undefined;
}

export function TroubleshootPanel({
  open,
  onClose,
  onOpenBrain,
  highlightedErrorId,
}: TroubleshootPanelProps) {
  const navigate = useNavigate();
  const { diagnoses, hasErrors, topSeverity, errorCount, criticalCount } = useTroubleshootData();
  const [expandedId, setExpandedId] = useState<string | null>(highlightedErrorId ?? null);

  const topMeta = topSeverity ? severityMeta(topSeverity) : null;

  const handleAskBrain = (d: TroubleshootDiagnosis) => {
    const context = `I encountered an error: "${d.title}". The reason is: "${d.reason}". Reference: ${d.referenceId ?? 'N/A'}. Please help me understand what happened and how to fix it.`;
    onOpenBrain?.(context);
    onClose();
  };

  const handleReportToSupport = (d: TroubleshootDiagnosis) => {
    const params = new URLSearchParams({
      prefill_title: `[${d.severity.toUpperCase()}] ${d.title}`,
      prefill_description: `Error: ${d.title}\nReason: ${d.reason}\nImpact: ${d.impact}\nReference: ${d.referenceId ?? 'N/A'}\nRoute: ${d.route ?? 'N/A'}\nTime: ${d.capturedAt}`,
      prefill_category: 'technical',
    });
    navigate(`/settings?tab=support&${params.toString()}`);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed top-16 right-2 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-96 max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl border border-default bg-surface shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200"
        role="dialog"
        aria-label="Troubleshoot Panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-xl',
                hasErrors
                  ? 'bg-orange-500/15 border border-orange-500/30'
                  : 'bg-success-subtle border border-success/30'
              )}
            >
              {hasErrors ? (
                <AlertTriangle className="size-4 text-orange-500" />
              ) : (
                <CheckCircle2 className="size-4 text-success" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-default">Troubleshoot</h2>
              <p className="text-[11px] text-muted">
                {hasErrors
                  ? `${errorCount} issue${errorCount !== 1 ? 's' : ''} detected this session`
                  : 'No issues detected this session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Summary bar */}
        {hasErrors && topSeverity && topMeta && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 border-b border-default text-xs',
              topMeta.bgCls
            )}
          >
            <SeverityIcon severity={topSeverity} />
            <span className="text-default font-medium flex-1">
              {criticalCount > 0
                ? `${criticalCount} critical or high-severity issue${criticalCount !== 1 ? 's' : ''} require attention`
                : 'Some issues detected — review the steps below'}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {!hasErrors ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <div className="size-12 rounded-2xl bg-success-subtle border border-success/20 flex items-center justify-center">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-default">All clear</p>
                <p className="text-xs text-muted mt-0.5">No errors or warnings detected in this session.</p>
              </div>
              <button
                type="button"
                onClick={() => { navigate('/settings/troubleshoot'); onClose(); }}
                className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <ClipboardList className="size-3.5" />
                View full diagnostic history
              </button>
            </div>
          ) : (
            diagnoses.map((d) => (
              <DiagnosisCard
                key={d.referenceId ?? d.code + d.capturedAt}
                diagnosis={d}
                expanded={expandedId === (d.referenceId ?? d.code + d.capturedAt)}
                onToggle={() =>
                  setExpandedId((prev) =>
                    prev === (d.referenceId ?? d.code + d.capturedAt)
                      ? null
                      : (d.referenceId ?? d.code + d.capturedAt)
                  )
                }
                onAskBrain={handleAskBrain}
                onReportToSupport={handleReportToSupport}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-default flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { navigate('/settings/troubleshoot'); onClose(); }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer transition-colors"
          >
            <ExternalLink className="size-3.5" />
            Full Diagnostic Report
          </button>
          <div className="flex items-center gap-1.5">
            {hasErrors && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer"
                title="Reload Page"
              >
                <RefreshCw className="size-3" />
                Reload
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helper: Badge visibility hook ──────────────────────────────────────────────
// Used by AppHeader to decide whether to show the pulsing badge.

export function useTroubleshootBadge(): {
  hasErrors: boolean;
  errorCount: number;
  criticalCount: number;
  topSeverity: TroubleshootSeverity | null;
} {
  const entries = useSyncExternalStore(subscribeToLogs, getLogs);
  return useMemo(() => {
    const { hasErrors, errorCount, criticalCount, topSeverity } = buildDiagnosisSummary(entries);
    return { hasErrors, errorCount, criticalCount, topSeverity };
  }, [entries]);
}
