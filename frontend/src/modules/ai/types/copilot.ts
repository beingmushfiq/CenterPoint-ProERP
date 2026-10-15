// ═══════════════════════════════════════════════════════════════════════════
// AI COPILOT & WEBANK FINANCING ENGINE TYPES
// Standardized types for SliceMartFMS FinTechathon 2026 Topic E
// ═══════════════════════════════════════════════════════════════════════════

export type PermissionTier = 0 | 1 | 2 | 3;

export interface ToolCallExecution {
  tool: string;
  arguments: Record<string, unknown>;
  permission_tier: PermissionTier;
  result?: Record<string, unknown>;
  error?: string;
}

export interface PendingAction {
  action_id: string;
  tool: string;
  description: string;
  arguments: Record<string, unknown>;
  permission_tier: 2;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  expires_at?: string;
}

export interface AgentMessage {
  id?: number;
  uuid: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCallExecution[] | null;
  pending_action?: PendingAction | null;
  tokens_used?: number;
  model?: string;
  created_at: string;
}

export interface ConversationSummary {
  id: number;
  uuid: string;
  title: string;
  last_message_at: string;
  messages_count?: number;
  created_at: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Financial Data Cards
// ───────────────────────────────────────────────────────────────────────────

export interface CashPositionData {
  total_liquid_cash: number;
  bank_balance: number;
  cash_on_hand: number;
  accounts_breakdown: Array<{
    id: number;
    code: string;
    name: string;
    type: string;
    balance: number;
  }>;
  daily_burn_rate: number;
  runway_days: number;
  health_status: 'healthy' | 'moderate' | 'critical';
  as_of_date: string;
}

export interface OverdueInvoiceItem {
  id: number;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  due_date: string;
  days_overdue: number;
  aging_bucket: '1-30' | '31-60' | '61-90' | '90+';
}

export interface OverdueInvoicesData {
  total_overdue: number;
  total_invoices_count: number;
  aging_summary: {
    '1-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  invoices: OverdueInvoiceItem[];
}

export interface PLSummaryData {
  period_start: string;
  period_end: string;
  total_revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  operating_expenses: number;
  net_operating_income: number;
  net_margin_pct: number;
  expense_breakdown: Array<{
    category: string;
    amount: number;
    pct_of_total: number;
  }>;
}

export interface CashFlowRiskData {
  horizon_days: number;
  starting_cash: number;
  projected_inflows: number;
  projected_outflows: number;
  projected_net_cash_flow: number;
  ending_cash: number;
  liquidity_shortfall: boolean;
  days_until_deficit: number | null;
  shortfall_amount: number;
  risk_level: 'low' | 'moderate' | 'severe' | 'critical';
  recommended_actions: string[];
}

export interface FinancingProduct {
  product_id: string;
  product_name: string;
  institution: string;
  interest_rate_pct: number;
  repayment_terms: string;
  eligible_amount: number;
  eligibility_score: number; // 0 to 100
  qualification_status: 'pre_approved' | 'eligible' | 'conditionally_eligible' | 'not_eligible';
  required_collateral: string;
  application_turnaround: string;
  benefits: string[];
}

export interface FinancingMatchData {
  assessment_uuid?: string;
  cash_deficit_amount: number;
  recommended_financing: number;
  credit_score_indicator: number;
  matched_products: FinancingProduct[];
  evaluation_summary: string;
}

export interface InventoryValuationData {
  total_valuation: number;
  item_count: number;
  high_value_items: Array<{
    id: number;
    sku: string;
    name: string;
    quantity: number;
    unit_cost: number;
    total_value: number;
  }>;
  slow_moving_valuation: number;
  estimated_holding_cost_monthly: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Alerts & Compliance Logs
// ───────────────────────────────────────────────────────────────────────────

export interface CashFlowAlertItem {
  id: number;
  uuid: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  projected_shortfall: string | number;
  days_until_shortfall: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledged_at?: string | null;
  acknowledged_by_user?: {
    id: number;
    name: string;
    email: string;
  } | null;
  created_at: string;
}

export interface AgentAuditLogItem {
  id: number;
  uuid: string;
  tool_name: string;
  permission_tier: PermissionTier;
  input_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  executed: boolean;
  blocked_reason?: string | null;
  duration_ms: number;
  ip_address?: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
  created_at: string;
}

export interface FinancingAssessmentRecord {
  id: number;
  uuid: string;
  requested_amount: string | number;
  projected_runway_days: number;
  burn_rate: string | number;
  revenue_run_rate: string | number;
  collateral_value: string | number;
  recommended_products: FinancingProduct[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
}
