/**
 * SliceMart FMS - Sales & Invoicing Module TypeScript Contract
 * Aligned with Backend API Resources & Database Schemas
 */

export type SalesOrderChannel = 'counter' | 'dealer' | 'phone' | 'field' | 'online';

export type SalesOrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'allocated'
  | 'picking'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type SalesOrderPaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'pending' | 'failed';

export type InvoiceStatus = 'draft' | 'posted' | 'paid' | 'partially_paid' | 'void';

export type DeliveryOrderStatus =
  'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

export type SalesReturnStatus = 'draft' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface SalesOrderItem {
  id: number;
  uuid: string;
  product_id: number;
  product_name?: string;
  variant_id?: number | null;
  description?: string | null;
  quantity: string;
  unit_id: number;
  unit_price: string;
  discount_percentage?: string;
  discount_amount?: string;
  tax_profile_id?: number | null;
  tax_amount?: string;
  line_total: string;
  delivered_quantity?: string;
  returned_quantity?: string;
  batch_code?: string | null;
  sort_order?: number;
}

export interface SalesOrder {
  id: number;
  uuid: string;
  order_number: string;
  channel: SalesOrderChannel;
  party_id?: number | null;
  lead_id?: number | null;
  salesman_id?: number | null;
  lead?: {
    id: number;
    lead_number?: string;
    stage?: LeadStatus;
    is_fake?: boolean;
    validated_at?: string | null;
    validated_by?: number | null;
  } | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  order_date: string;
  required_date?: string | null;
  currency_code: string;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  round_off: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  delivery_type: string;
  status: SalesOrderStatus;
  payment_status: SalesOrderPaymentStatus;
  notes?: string | null;
  shipping_address?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
  items?: SalesOrderItem[];
}

export interface InvoiceItem {
  id: number;
  uuid: string;
  invoice_id: number;
  product_id?: number | null;
  product_name?: string;
  description?: string | null;
  quantity: string;
  unit_id?: number | null;
  unit_price: string;
  discount_amount: string;
  tax_profile_id?: number | null;
  tax_amount: string;
  line_total: string;
  sort_order?: number;
}

export interface Invoice {
  id: number;
  uuid: string;
  invoice_number: string;
  sales_order_id?: number | null;
  sales_order_number?: string | null;
  party_id?: number | null;
  customer_name?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  payment_terms?: string | null;
  invoice_date: string;
  due_date?: string | null;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  round_off: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  status: InvoiceStatus;
  void_reason?: string | null;
  printed_count: number;
  posted_at?: string | null;
  created_at?: string;
  items?: InvoiceItem[];
  exchanges_count?: number;
  has_exchanges?: boolean;
}

export interface DeliveryOrderItem {
  id: number;
  uuid: string;
  delivery_order_id: number;
  product_id: number;
  product_name?: string;
  variant_id?: number | null;
  batch_code?: string | null;
  quantity: string;
  delivered_quantity: string;
  returned_quantity: string;
  unit_id: number;
}

export interface DeliveryOrder {
  id: number;
  uuid: string;
  delivery_number: string;
  sales_order_id: number;
  sales_order_number?: string | null;
  invoice_id?: number | null;
  party_id?: number | null;
  warehouse_id: number;
  warehouse_name?: string | null;
  recipient_name: string;
  recipient_phone: string;
  delivery_type: string;
  scheduled_date?: string | null;
  status: DeliveryOrderStatus;
  cod_amount: string;
  cod_collected_amount: string;
  cod_status: string;
  delivery_charge: string;
  package_count: number;
  special_instructions?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  items?: DeliveryOrderItem[];
}

export interface PaymentAllocation {
  id: number;
  uuid: string;
  payment_id: number;
  allocatable_type: string;
  allocatable_id: number;
  amount: string;
}

export interface Payment {
  id: number;
  uuid: string;
  payment_number: string;
  direction: 'in' | 'out';
  party_id?: number | null;
  customer_name?: string | null;
  company_id?: number | null;
  branch_id?: number | null;
  payment_date: string;
  method: string;
  bank_account_id?: number | null;
  reference_number?: string | null;
  amount: string;
  allocated_amount: string;
  unallocated_amount: string;
  currency_code: string;
  status: string;
  notes?: string | null;
  posted_at?: string | null;
  created_at?: string;
  allocations?: PaymentAllocation[];
}

export interface SalesReturnItem {
  id: number;
  uuid: string;
  product_id: number;
  product_name?: string;
  variant_id?: number | null;
  quantity: string;
  unit_id: number;
  unit_price: string;
  line_total: string;
  condition: string;
  batch_code?: string | null;
}

export interface SalesReturn {
  id: number;
  uuid: string;
  return_number: string;
  invoice_id?: number | null;
  invoice_number?: string | null;
  sales_order_id?: number | null;
  party_id?: number | null;
  customer_name?: string | null;
  warehouse_id: number;
  warehouse_name?: string | null;
  return_date: string;
  reason_code_id: number;
  reason_code_name?: string | null;
  restock: boolean;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  refund_method: string;
  credit_note_number?: string | null;
  status: SalesReturnStatus;
  approved_at?: string | null;
  created_at?: string;
  items?: SalesReturnItem[];
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'fake';
export type LeadSource = 'website' | 'storefront' | 'referral' | 'cold_outreach' | 'event' | 'social_media' | 'walk_in' | 'phone' | 'field_visit' | 'other';

export interface Lead {
  id: number;
  uuid: string;
  lead_number?: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  stage?: LeadStatus;
  source: LeadSource;
  deal_value?: string;
  expected_value?: string;
  currency_code?: string;
  assigned_to?: string | number | null;
  assigned_user_name?: string | null;
  notes?: string | null;
  expected_close_date?: string | null;
  is_fake?: boolean;
  validation_notes?: string | null;
  validated_by?: number | null;
  validator_name?: string | null;
  validated_at?: string | null;
  converted_party_id?: number | null;
  converted_party_name?: string | null;
  converted_at?: string | null;
  converted_to_customer_id?: number | null;
  orders?: Array<{
    id: number;
    order_number: string;
    total_amount: string;
    status: string;
    payment_status: string;
  }>;
  created_at: string;
  updated_at?: string;
}

export interface SalesmanTarget {
  id: number;
  uuid: string;
  employee_id: number;
  employee_name?: string | null;
  employee_code?: string;
  period_month: string;
  target_name?: string;
  target_amount: string | number;
  achieved_amount: string | number;
  achievement_percentage: string | number;
  total_leads: number;
  valid_leads: number;
  fake_leads: number;
  converted_leads: number;
  conversion_rate: number;
  profit_generated: string | number;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SalesmanSummary {
  id: number;
  uuid: string;
  employee_code: string;
  name: string;
  email?: string;
  phone?: string;
  target_id?: number;
  period_month: string;
  target_amount: number;
  achieved_amount: number;
  achievement_pct: number;
  pending_target: number;
  total_leads: number;
  valid_leads: number;
  fake_leads: number;
  converted_leads: number;
  conversion_rate: number;
  profit_generated: number;
  estimated_incentive: number;
}

export interface IncentivePolicyRule {
  id?: number;
  min_pct: string | number;
  max_pct: string | number;
  incentive_type: 'percentage' | 'fixed';
  incentive_value: string | number;
}

export interface IncentivePolicy {
  id: number;
  uuid: string;
  name: string;
  code: string;
  description?: string | null;
  basis: 'total_revenue' | 'profit' | 'collection';
  min_achievement_pct: string | number;
  is_active: boolean;
  rules: IncentivePolicyRule[];
  created_at?: string;
}

export interface IncentiveCalculation {
  id: number;
  uuid: string;
  employee_id: number;
  employee_name?: string | null;
  employee_code?: string;
  salesman_target_id?: number | null;
  incentive_policy_id?: number | null;
  policy_name?: string | null;
  period_month: string;
  target_amount: string | number;
  achieved_amount: string | number;
  achievement_pct: string | number;
  calculated_amount: string | number;
  approved_amount: string | number;
  status: 'draft' | 'approved' | 'paid' | 'rejected';
  approved_by?: number | null;
  approver_name?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SalesmanDashboardData {
  salesman: {
    id: number;
    name: string;
    employee_code: string;
    email?: string;
    phone?: string;
  };
  period_month: string;
  kpis: {
    target_amount: number;
    achieved_amount: number;
    achievement_pct: number;
    remaining_target: number;
    total_leads: number;
    valid_leads: number;
    fake_leads: number;
    converted_leads: number;
    conversion_rate: number;
    profit_generated: number;
    estimated_incentive: number;
  };
  recent_orders: Array<{
    id: number;
    order_number: string;
    order_date: string;
    total_amount: string;
    status: string;
    payment_status: string;
  }>;
  recent_leads: Array<{
    id: number;
    lead_number: string;
    name: string;
    company_name?: string;
    stage: string;
    expected_value: string;
    is_fake: boolean;
  }>;
}

export interface CustomerCrm {
  id: number;
  uuid: string;
  name: string;
  type: 'retail' | 'wholesale' | 'dealer' | 'corporate';
  email?: string | null;
  phone: string;
  address?: string | null;
  city?: string | null;
  credit_limit: string;
  current_balance: string;
  loyalty_points: number;
  total_orders_count: number;
  lifetime_value: string;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
}
