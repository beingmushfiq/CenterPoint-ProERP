import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Filter,
  Check,
  MessageSquare,
} from 'lucide-react';
import { copilotApi } from '../api/copilotApi';
import type { CashFlowAlertItem } from '../types/copilot';
import { useCurrency } from '../../../hooks/useCurrency';
import { notify } from '../../../components/ui/Toast';

interface CopilotAlertsTabProps {
  onOpenChatWithQuery?: (query: string) => void;
}

export const CopilotAlertsTab: React.FC<CopilotAlertsTabProps> = ({ onOpenChatWithQuery }) => {
  const { formatCurrency } = useCurrency();
  const [alerts, setAlerts] = useState<CashFlowAlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { severity?: string; status?: string } = {};
      if (severityFilter !== 'all') {
        params.severity = severityFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await copilotApi.getAlerts(params);
      setAlerts(data);
    } catch {
      notify.error('Failed to load cash flow alerts');
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (uuid: string) => {
    setAcknowledgingId(uuid);
    try {
      const updated = await copilotApi.acknowledgeAlert(uuid);
      setAlerts((prev) => prev.map((a) => (a.uuid === uuid ? updated : a)));
      notify.success('Alert marked as acknowledged.');
    } catch {
      notify.error('Failed to acknowledge alert');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-default shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted" />
          <span className="text-xs font-bold text-default">Filter Alerts</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-default text-xs">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-surface text-default shadow-2xs font-semibold'
                    : 'text-muted hover:text-default'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-default text-xs">
            {(['all', 'active', 'acknowledged'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-surface text-default shadow-2xs font-semibold'
                    : 'text-muted hover:text-default'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted space-y-2 bg-surface rounded-2xl border border-default">
          <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading operational cash flow alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted space-y-3 bg-surface rounded-2xl border border-default">
          <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
          <div className="font-semibold text-default">No Active Cash Flow Alerts Found</div>
          <p className="max-w-sm mx-auto">
            All liquidity stress test metrics and cash reserves are currently within healthy operational
            thresholds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isAcknowledged = alert.status === 'acknowledged';
            const shortfall = Number(alert.projected_shortfall || 0);

            return (
              <div
                key={alert.uuid}
                className={`p-4 sm:p-5 rounded-2xl bg-surface border transition-all space-y-3 shadow-2xs ${
                  isAcknowledged
                    ? 'border-default opacity-85'
                    : alert.severity === 'critical'
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-amber-500/40 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getSeverityBadge(
                          alert.severity
                        )}`}
                      >
                        <AlertTriangle className="size-3" />
                        <span>{alert.severity}</span>
                      </span>

                      <span className="text-[11px] font-mono text-muted uppercase">
                        {alert.alert_type}
                      </span>

                      {isAcknowledged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-sunken text-muted border border-default">
                          <Check className="size-3 text-emerald-600" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Active Unacknowledged
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-default">{alert.title}</h4>
                    <p className="text-xs text-muted max-w-2xl leading-relaxed">
                      {alert.description}
                    </p>
                  </div>

                  {shortfall > 0 && (
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[10px] uppercase font-semibold text-muted">
                        Projected Deficit
                      </div>
                      <div className="text-base font-mono font-extrabold text-rose-600 dark:text-rose-400">
                        {formatCurrency(shortfall)}
                      </div>
                      <div className="text-[11px] text-muted flex items-center sm:justify-end gap-1 mt-0.5">
                        <Clock className="size-3" />
                        <span>In {alert.days_until_shortfall} days</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Metadata & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-default/50 text-xs">
                  <div className="text-[11px] text-muted flex items-center gap-3 flex-wrap">
                    <span>Detected: {new Date(alert.created_at).toLocaleString()}</span>
                    {alert.acknowledged_at && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <User className="size-3" />
                        Acknowledged by{' '}
                        {alert.acknowledged_by_user?.name || 'Supervisor'} at{' '}
                        {new Date(alert.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenChatWithQuery && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenChatWithQuery(
                            `Analyze how to resolve the alert: "${alert.title}" with shortfall ${formatCurrency(
                              shortfall
                            )} in ${alert.days_until_shortfall} days.`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-medium transition cursor-pointer flex items-center gap-1"
                      >
                        <MessageSquare className="size-3 text-primary" />
                        <span>Discuss with AI</span>
                      </button>
                    )}

                    {!isAcknowledged && (
                      <button
                        type="button"
                        disabled={acknowledgingId === alert.uuid}
                        onClick={() => handleAcknowledge(alert.uuid)}
                        className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-xs"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {acknowledgingId === alert.uuid ? 'Saving...' : 'Acknowledge Alert'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
