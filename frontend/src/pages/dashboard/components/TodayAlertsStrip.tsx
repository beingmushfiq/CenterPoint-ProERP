import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { DashboardAlertItem } from '../../../types/api/dashboard';

interface TodayAlertsStripProps {
  alerts?: DashboardAlertItem[] | undefined;
  className?: string | undefined;
}

const SEVERITY_STYLES = {
  critical: {
    container: 'border-rose-500/30 bg-gradient-to-r from-rose-500/[0.12] via-surface to-rose-500/[0.04] text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40',
    icon: <AlertOctagon className="size-4 text-rose-500 shrink-0" />,
    button: 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs shadow-rose-600/30',
  },
  warning: {
    container: 'border-amber-500/30 bg-gradient-to-r from-amber-500/[0.12] via-surface to-amber-500/[0.04] text-amber-800 dark:text-amber-200',
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
    icon: <AlertTriangle className="size-4 text-amber-500 shrink-0" />,
    button: 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs shadow-amber-600/30',
  },
  info: {
    container: 'border-blue-500/30 bg-gradient-to-r from-blue-500/[0.12] via-surface to-blue-500/[0.04] text-blue-800 dark:text-blue-200',
    badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40',
    icon: <Clock className="size-4 text-blue-500 shrink-0" />,
    button: 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/30',
  },
};

export const TodayAlertsStrip: React.FC<TodayAlertsStripProps> = ({ alerts = [], className }) => {
  const [dismissedTypes, setDismissedTypes] = useState<Record<string, boolean>>(() => {
    try {
      const stored = sessionStorage.getItem('erp_dismissed_alerts_today');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const activeAlerts = alerts.filter((a) => !dismissedTypes[a.type]);

  const handleDismiss = (type: string) => {
    setDismissedTypes((prev) => {
      const next = { ...prev, [type]: true };
      try {
        sessionStorage.setItem('erp_dismissed_alerts_today', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (activeAlerts.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] via-surface to-emerald-500/[0.02] shadow-2xs transition-all',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-default">
              All Operational Systems Nominal
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted">
              · 0 operational bottlenecks detected across factory, inventory, and finance
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Guard
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-default uppercase tracking-wider">
          <Sparkles className="size-3.5 text-amber-500" />
          <span>Operational Focus Required ({activeAlerts.length})</span>
        </div>
        {Object.keys(dismissedTypes).length > 0 && (
          <button
            type="button"
            onClick={() => {
              setDismissedTypes({});
              try {
                sessionStorage.removeItem('erp_dismissed_alerts_today');
              } catch {
                /* ignore */
              }
            }}
            className="text-[10px] font-semibold text-muted hover:text-default underline cursor-pointer"
          >
            Reset dismissed alerts
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {activeAlerts.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity as keyof typeof SEVERITY_STYLES] || SEVERITY_STYLES.warning;
          return (
            <div
              key={alert.type}
              className={cn(
                'group relative flex items-center justify-between gap-3 p-3 rounded-2xl border shadow-2xs transition-all duration-200 hover:-translate-y-0.5 overflow-hidden',
                style.container
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5">{style.icon}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-default truncate">{alert.title}</span>
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 py-px rounded-full text-[9px] font-extrabold uppercase tracking-wider border leading-none',
                        style.badge
                      )}
                    >
                      {alert.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">{alert.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={alert.link}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer',
                    style.button
                  )}
                >
                  <span>{alert.action_label}</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => handleDismiss(alert.type)}
                  className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  title="Dismiss for today"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
