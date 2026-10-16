import { describe, it, expect } from 'vitest';
import {
  diagnoseEntry,
  buildDiagnosisSummary,
  severityScore,
  severityMeta,
  getTopSeverity,
} from './troubleshootEngine';
import type { LogEntry } from '../observability/logger';

describe('troubleshootEngine', () => {
  const createMockEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: 'entry-1',
    timestamp: '2026-10-16T10:00:00.000Z',
    level: 'error',
    source: 'api',
    message: 'Error occurred',
    code: 'INSUFFICIENT_STOCK',
    status: 400,
    route: '/inventory',
    correlationId: 'ERR-TEST01',
    ...overrides,
  });

  describe('diagnoseEntry', () => {
    it('maps INSUFFICIENT_STOCK correctly with actionable steps', () => {
      const entry = createMockEntry({ code: 'INSUFFICIENT_STOCK' });
      const diagnosis = diagnoseEntry(entry);

      expect(diagnosis.code).toBe('INSUFFICIENT_STOCK');
      expect(diagnosis.title).toContain('Not enough stock');
      expect(diagnosis.severity).toBe('medium');
      expect(diagnosis.selfResolvable).toBe(true);
      expect(diagnosis.steps.length).toBeGreaterThan(0);
      expect(diagnosis.referenceId).toBe('ERR-TEST01');
    });

    it('maps UNAUTHENTICATED correctly with high severity', () => {
      const entry = createMockEntry({ code: 'UNAUTHENTICATED', status: 401 });
      const diagnosis = diagnoseEntry(entry);

      expect(diagnosis.code).toBe('UNAUTHENTICATED');
      expect(diagnosis.title).toContain('not signed in');
      expect(diagnosis.severity).toBe('high');
      expect(diagnosis.selfResolvable).toBe(true);
    });

    it('maps FORBIDDEN correctly', () => {
      const entry = createMockEntry({ code: 'FORBIDDEN', status: 403 });
      const diagnosis = diagnoseEntry(entry);

      expect(diagnosis.code).toBe('FORBIDDEN');
      expect(diagnosis.title).toContain('permission');
      expect(diagnosis.severity).toBe('medium');
    });

    it('maps NETWORK_OFFLINE correctly with selfResolvable true', () => {
      const entry = createMockEntry({ code: 'NETWORK_OFFLINE', status: 0 });
      const diagnosis = diagnoseEntry(entry);

      expect(diagnosis.code).toBe('NETWORK_OFFLINE');
      expect(diagnosis.title).toContain('offline');
      expect(diagnosis.severity).toBe('high');
      expect(diagnosis.selfResolvable).toBe(true);
    });

    it('handles unknown codes gracefully with generic fallback and referenceId preserved', () => {
      const entry = createMockEntry({
        code: undefined,
        message: 'Something unexpected in rendering',
        source: 'boundary',
        correlationId: 'ERR-UNKNOWN-99',
      });
      const diagnosis = diagnoseEntry(entry);

      expect(diagnosis.title).toBeDefined();
      expect(diagnosis.reason).toBeDefined();
      expect(diagnosis.steps.length).toBeGreaterThan(0);
      expect(diagnosis.referenceId).toBe('ERR-UNKNOWN-99');
    });
  });

  describe('buildDiagnosisSummary', () => {
    it('returns empty and hasErrors false when logs are empty', () => {
      const summary = buildDiagnosisSummary([]);
      expect(summary.hasErrors).toBe(false);
      expect(summary.diagnoses).toHaveLength(0);
      expect(summary.errorCount).toBe(0);
      expect(summary.criticalCount).toBe(0);
      expect(summary.topSeverity).toBeNull();
    });

    it('ignores info and debug log entries', () => {
      const entries: LogEntry[] = [
        {
          id: '1',
          timestamp: '2026-10-16T10:00:00.000Z',
          level: 'info',
          source: 'boot',
          message: 'System booted',
        },
      ];
      const summary = buildDiagnosisSummary(entries);
      expect(summary.hasErrors).toBe(false);
      expect(summary.errorCount).toBe(0);
    });

    it('ranks diagnoses by severity and counts critical/high issues', () => {
      const entries: LogEntry[] = [
        createMockEntry({ id: '1', code: 'INSUFFICIENT_STOCK', level: 'error' }), // medium
        createMockEntry({ id: '2', code: 'SERVICE_UNAVAILABLE', level: 'error' }), // critical
        createMockEntry({ id: '3', code: 'UNAUTHENTICATED', level: 'error' }), // high
      ];

      const summary = buildDiagnosisSummary(entries);
      expect(summary.hasErrors).toBe(true);
      expect(summary.errorCount).toBe(3);
      expect(summary.criticalCount).toBe(2); // critical (SERVICE_UNAVAILABLE) + high (UNAUTHENTICATED)
      expect(summary.topSeverity).toBe('critical');
      // The first diagnosis in the list must be the highest severity
      expect(summary.diagnoses[0]?.severity).toBe('critical');
    });
  });

  describe('severity scoring and metadata', () => {
    it('scores critical higher than low', () => {
      expect(severityScore('critical')).toBeGreaterThan(severityScore('high'));
      expect(severityScore('high')).toBeGreaterThan(severityScore('medium'));
      expect(severityScore('medium')).toBeGreaterThan(severityScore('low'));
      expect(severityScore('low')).toBeGreaterThan(severityScore('info'));
    });

    it('provides valid CSS classes and labels for every severity', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
      for (const s of severities) {
        const meta = severityMeta(s);
        expect(meta.label).toBeTruthy();
        expect(meta.badgeCls).toBeTruthy();
        expect(meta.iconCls).toBeTruthy();
      }
    });

    it('getTopSeverity correctly resolves null or highest severity', () => {
      expect(getTopSeverity([])).toBeNull();
      const mockDiag1 = diagnoseEntry(createMockEntry({ code: 'INSUFFICIENT_STOCK' })); // medium
      const mockDiag2 = diagnoseEntry(createMockEntry({ code: 'SERVICE_UNAVAILABLE' })); // critical
      expect(getTopSeverity([mockDiag1, mockDiag2])).toBe('critical');
    });
  });
});
