import { describe, it, expect } from 'vitest';
import { ALL_REPORT_DEFINITIONS } from './reportCatalogue';
import {
  REPORT_HUBS,
  DOMAIN_HUBS,
  findHubForReportCode,
  findDomainForReportCode,
  findDomainById,
} from './reportHubs';

describe('Phase 2 Reports Consolidation & Hub Architecture', () => {
  it('has exactly 76 active report definitions in the consolidated catalogue', () => {
    expect(ALL_REPORT_DEFINITIONS.length).toBe(76);
  });

  it('verifies all 8 duplicate/redundant reports are permanently removed from catalogue', () => {
    const retiredCodes = [
      'worker_piece_rate_summary',
      'salesman_profitability',
      'daily_sales',
      'b2c_sales',
      'salesman_leaderboard',
      'delivery_sla_history',
      'converted_leads',
      'lost_leads_analysis',
    ];

    const codes = ALL_REPORT_DEFINITIONS.map((r) => r.code);
    for (const retired of retiredCodes) {
      expect(codes).not.toContain(retired);
    }
  });

  it('verifies all 8 canonical reports exist and have enriched descriptions', () => {
    const canonicalMap: Record<string, string> = {
      worker_production: 'piece rates',
      sales_performance: 'daily revenue ledger',
      lead_summary: 'pipeline stages',
      courier_performance: 'SLA',
      product_sales: 'B2C/online storefront',
      salesman_sales: 'ranked leaderboard',
      lead_status_distribution: 'loss reason',
      salesman_profit_contribution: 'commissions',
    };

    for (const [code, descSnippet] of Object.entries(canonicalMap)) {
      const def = ALL_REPORT_DEFINITIONS.find((r) => r.code === code);
      expect(def, `Expected report ${code} to exist in catalogue`).toBeDefined();
      expect(def?.is_active).toBe(true);
      expect(def?.description?.toLowerCase()).toContain(descSnippet.toLowerCase());
    }
  });

  it('defines exactly 7 Domain Navigation Hubs covering all core operational pillars', () => {
    expect(DOMAIN_HUBS.length).toBe(7);
    const domainIds = DOMAIN_HUBS.map((d) => d.id);
    expect(domainIds).toEqual([
      'operations',
      'commercial',
      'procurement',
      'finance',
      'people',
      'assets',
      'compliance',
    ]);
  });

  it('verifies every view in REPORT_HUBS references an existing report in the catalogue', () => {
    const catCodes = new Set(ALL_REPORT_DEFINITIONS.map((r) => r.code));
    for (const hub of REPORT_HUBS) {
      for (const view of hub.views) {
        expect(catCodes.has(view.code), `Hub view code '${view.code}' must exist in catalogue`).toBe(true);
      }
    }
  });

  it('resolves parent Hub and Domain correctly for given canonical report codes', () => {
    const hub = findHubForReportCode('sales_performance');
    expect(hub).toBeDefined();
    expect(hub?.id).toBe('hub_sales_omnichannel');

    const domain = findDomainForReportCode('sales_performance');
    expect(domain).toBeDefined();
    expect(domain?.id).toBe('commercial');

    const operationsDomain = findDomainById('operations');
    expect(operationsDomain).toBeDefined();
    expect(operationsDomain?.modules).toContain('production');
    expect(operationsDomain?.modules).toContain('inventory');
  });
});
