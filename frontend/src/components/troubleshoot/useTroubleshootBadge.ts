import { useMemo, useSyncExternalStore } from 'react';
import { getLogs, subscribeToLogs } from '../../lib/observability/logger';
import { buildDiagnosisSummary } from '../../lib/troubleshoot/troubleshootEngine';
import type { TroubleshootSeverity } from '../../lib/troubleshoot/troubleshootEngine';

export interface TroubleshootBadgeState {
  hasErrors: boolean;
  errorCount: number;
  criticalCount: number;
  topSeverity: TroubleshootSeverity | null;
}

/**
 * Hook used by AppHeader and top-level navigation to observe session diagnostic errors
 * and render appropriate status badges (healthy / warning / critical).
 */
export function useTroubleshootBadge(): TroubleshootBadgeState {
  const entries = useSyncExternalStore(subscribeToLogs, getLogs);
  return useMemo(() => {
    const { hasErrors, errorCount, criticalCount, topSeverity } = buildDiagnosisSummary(entries);
    return { hasErrors, errorCount, criticalCount, topSeverity };
  }, [entries]);
}
