/**
 * SliceMart FMS - CRM & Commercial Pipeline Module TypeScript Contracts
 * Standardized across Lead Acquisition, Pipeline Stages, Activities, and Conversions
 */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'fake';

export type LeadSource =
  | 'storefront'
  | 'walk_in'
  | 'phone'
  | 'field_visit'
  | 'referral'
  | 'cold_outreach'
  | 'event'
  | 'social_media'
  | 'website'
  | 'online'
  | 'other';

export interface LeadActivity {
  id: number;
  uuid: string;
  subject_type?: string;
  subject_id?: number;
  type: 'call' | 'visit' | 'email' | 'sms' | 'note' | 'task';
  title: string;
  description?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  outcome?: string | null;
  assigned_to?: number | null;
  assigned_user_name?: string | null;
  created_at: string;
}

export interface LeadOrderLink {
  id: number;
  order_number: string;
  total_amount: string;
  status: string;
  payment_status: string;
  created_at?: string;
}

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
  lost_reason_id?: number | null;
  lost_reason_name?: string | null;
  is_fake?: boolean;
  validation_notes?: string | null;
  validated_by?: number | null;
  validator_name?: string | null;
  validated_at?: string | null;
  converted_party_id?: number | null;
  converted_party_name?: string | null;
  converted_at?: string | null;
  activities?: LeadActivity[];
  orders?: LeadOrderLink[];
  created_at: string;
  updated_at?: string;
}

export interface LostReasonOption {
  id: string;
  label: string;
  description?: string;
}

export const LOST_REASON_OPTIONS: LostReasonOption[] = [
  { id: 'price_too_high', label: 'Price Too High / Budget Issue', description: 'Offer exceeded customer budget limits' },
  { id: 'competitor_chosen', label: 'Competitor Chosen', description: 'Competitor provided better pricing or terms' },
  { id: 'budget_cancelled', label: 'Project / Budget Cancelled', description: 'Customer cancelled commercial initiative' },
  { id: 'product_unfit', label: 'Product Specification Unfit', description: 'Specifications or packaging did not match requirements' },
  { id: 'lead_time_too_long', label: 'Lead Time / Delivery Too Long', description: 'Production or delivery schedule too slow' },
  { id: 'no_response', label: 'Unresponsive / Ghosted', description: 'Repeated follow-ups received no reply' },
  { id: 'fraud_invalid', label: 'Fraudulent / Fake Inquiry', description: 'Invalid contact details or false commercial intent' },
  { id: 'other', label: 'Other Commercial Reason', description: 'Miscellaneous custom reason specified in notes' },
];
