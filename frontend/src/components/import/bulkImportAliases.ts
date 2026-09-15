import { api } from '../../lib/api/client';

/**
 * Enterprise Route Registry for Bulk Import Aliases
 * Ensures all secondary backend aliases across modules are wired for batch imports.
 */
export async function executeImportAlias(endpoint: string, payload: any = {}) {
  switch (endpoint) {
    case 'boms':
      return api.post('/boms/bulk-import', payload);
    case 'finance_bank_accounts':
      return api.post('/finance/bank-accounts/bulk-import', payload);
    case 'finance_fixed_assets':
      return api.post('/finance/fixed-assets/bulk-import', payload);
    case 'finance_journal':
      return api.post('/finance/journal/bulk-import', payload);
    case 'finance_reconciliation':
      return api.post('/finance/reconciliation/bulk-import', payload);
    case 'hr_advances':
      return api.post('/hr/advances/bulk-import', payload);
    case 'hr_attendance':
      return api.post('/hr/attendance/bulk-import', payload);
    case 'inventory_balances':
      return api.post('/inventory/balances/bulk-import', payload);
    case 'pricing_bulk':
      return api.post('/pricing/bulk-import', payload);
    case 'production_piece_rate':
      return api.post('/production/piece-rate/bulk-import', payload);
    case 'sales_coupons':
      return api.post('/sales/coupons/bulk-import', payload);
    case 'sales_price_lists':
      return api.post('/sales/price-lists/bulk-import', payload);
    default:
      return null;
  }
}
