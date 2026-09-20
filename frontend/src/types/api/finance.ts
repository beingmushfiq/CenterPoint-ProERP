export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface ChartOfAccount {
  id: number;
  uuid: string;
  account_code: string;
  name: string;
  account_type: AccountType;
  account_subtype?: string | undefined;
  normal_balance: NormalBalance;
  parent_id?: number | undefined;
  is_active: boolean;
  is_system?: boolean | undefined;
  current_balance?: string | undefined;
  created_at?: string | undefined;
}

export interface JournalLine {
  id?: number | undefined;
  journal_entry_id?: number | undefined;
  account_id: number;
  account?: ChartOfAccount | undefined;
  debit_amount: string | number;
  credit_amount: string | number;
  branch_id?: number | undefined;
  cost_center_code?: string | undefined;
  party_id?: number | undefined;
  narration?: string | undefined;
  sort_order?: number | undefined;
}

export type JournalEntryStatus = 'draft' | 'posted' | 'voided';
export type JournalEntryType = 'manual' | 'system' | 'closing' | 'adjustment';

export interface JournalEntry {
  id: number;
  uuid: string;
  entry_number: string;
  entry_date: string;
  entry_type: JournalEntryType;
  source_module: string;
  reference_type?: string | undefined;
  reference_id?: number | undefined;
  narration?: string | undefined;
  total_debit: string;
  total_credit: string;
  status: JournalEntryStatus;
  posted_by?: number | undefined;
  posted_at?: string | undefined;
  lines?: JournalLine[] | undefined;
  created_at?: string | undefined;
}

export interface BankAccount {
  id: number;
  uuid: string;
  company_id: number;
  branch_id?: number | undefined;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch_name?: string | undefined;
  routing_number?: string | undefined;
  swift_code?: string | undefined;
  currency_code: string;
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
  created_at?: string | undefined;
}

export interface ExpenseCategory {
  id: number;
  uuid: string;
  code: string;
  name: string;
  description?: string | undefined;
  chart_of_account_id?: number | undefined;
  is_active: boolean;
  created_at?: string | undefined;
}

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled';

export interface Expense {
  id: number;
  uuid: string;
  company_id: number;
  branch_id?: number | undefined;
  expense_category_id: number;
  category?: ExpenseCategory | undefined;
  expense_date: string;
  amount: string;
  tax_amount?: string | undefined;
  payment_method: string;
  bank_account_id?: number | undefined;
  payee_name?: string | undefined;
  description?: string | undefined;
  status: ExpenseStatus;
  journal_entry_id?: number | undefined;
  created_at?: string | undefined;
}

export interface ProductCost {
  id: number;
  uuid: string;
  product_id: number;
  product?: { id: number; name: string; sku?: string } | undefined;
  variant_id?: number | undefined;
  warehouse_id?: number | undefined;
  costing_method: string;
  material_cost: string;
  labour_cost: string;
  overhead_cost: string;
  total_cost: string;
  standard_cost: string;
  effective_from: string;
  source: string;
  source_reference_type?: string | undefined;
  source_reference_id?: number | undefined;
  calculated_at?: string | undefined;
  created_at?: string | undefined;
}
