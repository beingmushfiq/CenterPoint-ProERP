// ═══════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY — Production-Grade Hierarchical Recovery
// ───────────────────────────────────────────────────────────────────────────
// Layered boundaries for the application:
//   ① Global Boundary   — catches root application failures; full-screen recovery
//   ② Route Boundary    — catches route/page failure; shell survives
//   ③ Section Boundary  — catches module/tab failure; siblings survive
//   ④ Widget Boundary   — catches single chart/card failure; compact inline retry
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RotateCcw, Home, Copy, Check, ShieldAlert, Sparkles, TriangleAlert, ArrowLeft, Wrench } from 'lucide-react';
import { Button } from './ui/Button';
import { logBoundaryError } from '../lib/observability/logger';

export type ErrorBoundaryLevel = 'global' | 'route' | 'feature' | 'inline';

interface ErrorBoundaryProps {
  children: ReactNode;
  level?: ErrorBoundaryLevel;
  onReset?: () => void;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  referenceId: string;
  logEntryId: string;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    referenceId: '',
    logEntryId: '',
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const referenceId = 'ERR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return { hasError: true, error, referenceId, logEntryId: referenceId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const entry = logBoundaryError(error, {
      level: this.props.level ?? 'global',
      componentStack: `${errorInfo.componentStack ?? ''} [Ref: ${this.state.referenceId}]`,
      correlationId: this.state.referenceId,
    });
    this.setState({ errorInfo, logEntryId: entry.id });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });

    if (this.props.onReset) {
      this.props.onReset();
      return;
    }

    const level = this.props.level ?? 'global';
    if (level === 'route') {
      window.history.back();
    } else if (level === 'global') {
      window.location.href = '/';
    }
  };

  private handleViewTroubleshoot = (): void => {
    window.location.href = '/settings/troubleshoot';
  };

  private handleCopyDiagnostics = (): void => {
    const payload = JSON.stringify(
      {
        referenceId: this.state.referenceId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        level: this.props.level ?? 'global',
        online: navigator.onLine,
      },
      null,
      2
    );

    navigator.clipboard.writeText(payload).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(() => {});
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      const level = this.props.level ?? 'global';
      const { referenceId, copied } = this.state;

      // ── Level 4: Inline / Widget Fallback Tile ──────────────────────────────
      if (level === 'inline') {
        return (
          <div className="p-3 rounded-lg bg-danger-subtle border border-danger text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-danger">
              <span className="font-semibold">Something went wrong in this section.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              leftIcon={<RotateCcw className="size-3.5" />}
              className="text-danger hover:bg-danger-subtle/80 shrink-0"
            >
              Retry
            </Button>
          </div>
        );
      }

      // ── Level 3: Section / Feature Fallback Panel ───────────────────────────
      if (level === 'feature') {
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-danger-subtle border border-danger">
            <TriangleAlert className="size-4 text-danger shrink-0" />
            <span className="text-sm text-danger flex-1">
              This section couldn’t load. Your other data is safe.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              leftIcon={<RotateCcw className="size-3.5" />}
              className="text-danger hover:bg-danger-subtle/80"
            >
              Retry
            </Button>
          </div>
        );
      }

      // ── Level 2: Route Fallback (Keeps Navigation Shell Intact) ─────────────
      if (level === 'route') {
        return (
          <div className="min-h-[50vh] flex items-center justify-center p-4 bg-base text-default">
            <div className="w-full max-w-md bg-surface border border-default rounded-2xl p-6 text-center shadow-lg">
              <div className="size-10 rounded-xl bg-danger-subtle border border-danger flex items-center justify-center text-danger mx-auto mb-4">
                <ShieldAlert className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-default mb-2">
                This page hit an unexpected error
              </h2>
              <p className="text-sm text-muted mb-1">
                Nothing you entered was saved. Your other pages are unaffected.
              </p>
              <div className="flex flex-col items-center gap-3 mt-5">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={this.handleReset}
                    leftIcon={<ArrowLeft className="size-4" />}
                  >
                    Go back
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.reload()}
                    leftIcon={<RotateCcw className="size-4" />}
                  >
                    Reload
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleViewTroubleshoot}
                  leftIcon={<Wrench className="size-4 text-primary" />}
                  className="text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 w-full"
                >
                  View Error Details in Troubleshoot
                </Button>
              </div>
              <div className="mt-5 text-[11px] text-muted font-mono">
                Reference: <span className="font-semibold text-default">{referenceId}</span>
              </div>
            </div>
          </div>
        );
      }

      // ── Level 1: Global Catastrophic Fallback Screen ────────────────────────
      return (
        <div className="min-h-screen bg-base text-default flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
          <div className="relative w-full max-w-xl bg-surface border border-default rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="relative flex justify-center">
              <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative size-16 rounded-2xl bg-danger-subtle border border-danger flex items-center justify-center text-danger shadow-md">
                <Sparkles className="size-8" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                Session Recovery
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-default font-sans">
                Something went wrong
              </h1>
              <p className="text-xs sm:text-sm text-muted leading-relaxed font-sans">
                An unexpected error occurred. Nothing was saved and your data is safe. You can return to the dashboard or try reloading the page.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
                leftIcon={<RotateCcw className="size-4" />}
              >
                Reload Application
              </Button>
              <Button
                variant="secondary"
                onClick={this.handleReset}
                leftIcon={<Home className="size-4" />}
              >
                Return to Dashboard
              </Button>
              <Button
                variant="ghost"
                onClick={this.handleCopyDiagnostics}
                leftIcon={copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              >
                {copied ? 'Copied Reference' : 'Copy Reference'}
              </Button>
            </div>

            {/* Troubleshoot CTA — the key new addition */}
            <div className="mt-2">
              <Button
                variant="ghost"
                onClick={this.handleViewTroubleshoot}
                leftIcon={<Wrench className="size-4 text-primary" />}
                className="w-full text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10"
              >
                View Diagnosis &amp; Fix Steps in Troubleshoot
              </Button>
            </div>

            <div className="pt-4 border-t border-default flex flex-col items-center gap-1 text-[11px] text-muted font-mono">
              <div>Support Reference ID: <span className="font-bold text-default">{referenceId}</span></div>
              <div className="text-[10px] text-muted font-sans">Share this reference code with technical support if the issue persists.</div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function GlobalBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="global">{children}</ErrorBoundary>;
}

export function RouteBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="route">{children}</ErrorBoundary>;
}

export function SectionBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="feature">{children}</ErrorBoundary>;
}

export function WidgetBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="inline">{children}</ErrorBoundary>;
}
