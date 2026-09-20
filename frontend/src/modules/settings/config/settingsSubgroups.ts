import type React from 'react';
import {
  Building2,
  Sparkles,
  Globe,
  FileSpreadsheet,
  PlugZap,
  Bell,
  Activity,
  Truck,
  ShoppingBag,
  Factory,
  CheckSquare,
  Package,
  ShieldCheck,
  ShoppingCart,
  BadgePercent,
  Monitor,
  Lock,
  Users,
  Landmark,
  Cpu,
} from 'lucide-react';

export type SettingPreviewType =
  | 'identity'
  | 'facilities_contacts'
  | 'branding'
  | 'currency'
  | 'prefixes'
  | 'payment_gateways'
  | 'messaging'
  | 'courier_apis'
  | 'delivery'
  | 'storefront'
  | 'production'
  | 'inventory'
  | 'procurement'
  | 'commercial'
  | 'pos_receipt'
  | 'qc_standards'
  | 'payroll'
  | 'finance'
  | 'security'
  | 'reports';

export interface SubgroupDefinition {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  keys: string[];
  previewType?: SettingPreviewType;
  testTrigger?: 'payment' | 'steadfast' | 'pathao' | 'redx';
}

export const SETTINGS_SUBGROUPS: Record<string, SubgroupDefinition[]> = {
  general: [
    {
      id: 'identity',
      title: 'Company Identity & Legal Registration',
      description: 'Official corporate registration numbers, legal entity name, and statutory regulatory licenses.',
      icon: Building2,
      previewType: 'identity',
      keys: [
        'company_name',
        'company_legal_name',
        'trade_license_no',
        'tax_identification_number',
        'rjsc_registration_no',
        'factory_license_no',
        'bin_branch_code',
      ],
    },
    {
      id: 'facilities_contacts',
      title: 'Corporate Headquarters, Plant & Direct Lines',
      description: 'Official registered address, physical manufacturing facility, 24/7 operations hotline, and support email.',
      icon: Factory,
      previewType: 'facilities_contacts',
      keys: [
        'registered_address',
        'factory_address',
        'hotline_phone',
        'support_email',
      ],
    },
    {
      id: 'branding',
      title: 'Brand Assets & Storefront Identity',
      description: 'Corporate logo and browser favicon URLs used across invoices, print documents, and web storefront.',
      icon: Sparkles,
      previewType: 'branding',
      keys: ['brand_logo_url', 'brand_favicon_url'],
    },
    {
      id: 'localization',
      title: 'Localization, Currency & Fiscal Calendar',
      description: 'Base accounting currency, rounding precision, display formats, and financial year lock policies.',
      icon: Globe,
      previewType: 'currency',
      keys: [
        'currency_code',
        'currency_symbol',
        'decimal_places',
        'thousand_separator',
        'date_format',
        'time_format',
        'system_timezone',
        'system_language',
        'fiscal_year_start_month',
        'lock_closed_financial_periods',
      ],
    },
    {
      id: 'prefixes',
      title: 'Document Numbering Sequences',
      description: 'Automated serial prefixes for commercial invoices, orders, delivery challans, and production batches.',
      icon: FileSpreadsheet,
      previewType: 'prefixes',
      keys: [
        'invoice_prefix',
        'purchase_order_prefix',
        'batch_prefix',
        'challan_prefix',
        'quotation_prefix',
        'receipt_prefix',
      ],
    },
  ],

  integrations: [
    {
      id: 'mfs',
      title: 'Mobile Financial Services & Payment Gateways',
      description: 'API credentials and sandbox modes for bKash, Nagad, and SSLCommerz direct payment collection.',
      icon: PlugZap,
      previewType: 'payment_gateways',
      testTrigger: 'payment',
      keys: [
        'bkash_merchant_app_key',
        'bkash_merchant_secret',
        'bkash_sandbox',
        'nagad_merchant_id',
        'nagad_public_key',
        'sslcommerz_store_id',
        'sslcommerz_store_password',
      ],
    },
    {
      id: 'messaging',
      title: 'SMS Gateways & WhatsApp Cloud Messaging',
      description: 'Transactional SMS notification gateways (Greenweb, Twilio) and official Meta WhatsApp Cloud API.',
      icon: Bell,
      previewType: 'messaging',
      keys: [
        'sms_provider',
        'sms_api_key',
        'sms_sender_id',
        'whatsapp_cloud_api_token',
        'whatsapp_phone_number_id',
      ],
    },
    {
      id: 'analytics',
      title: 'Marketing Tracking & Pixel Telemetry',
      description: 'Google Tag Manager and Meta Pixel IDs for omni-channel storefront conversion tracking.',
      icon: Activity,
      keys: ['google_tag_manager_id', 'meta_pixel_id'],
    },
  ],

  delivery: [
    {
      id: 'policy',
      title: 'Logistics Dispatch Policy & Cash on Delivery',
      description: 'Automated consignment creation rules and default carrier selection for shipping orders.',
      icon: Truck,
      previewType: 'delivery',
      keys: [
        'default_courier_provider',
        'auto_book_courier_on_order_approval',
        'cod_charge_percentage',
      ],
    },
    {
      id: 'steadfast',
      title: 'Steadfast Courier Logistics API',
      description: 'API credentials for nationwide door-to-door parcel delivery with COD collection across Bangladesh.',
      icon: Truck,
      testTrigger: 'steadfast',
      keys: ['steadfast_api_key', 'steadfast_secret_key', 'steadfast_sandbox'],
    },
    {
      id: 'pathao',
      title: 'Pathao Courier & Parcel API',
      description: 'OAuth Client credentials and webhook endpoints for Pathao logistics network.',
      icon: Truck,
      testTrigger: 'pathao',
      keys: ['pathao_client_id', 'pathao_client_secret', 'pathao_sandbox'],
    },
    {
      id: 'redx',
      title: 'REDX Express Logistics API',
      description: 'Access token and environment configuration for REDX Express fulfillment.',
      icon: Truck,
      testTrigger: 'redx',
      keys: ['redx_api_token', 'redx_sandbox'],
    },
  ],

  ecommerce: [
    {
      id: 'storefront_policy',
      title: 'Storefront Availability & Checkout Rules',
      description: 'Public visibility, guest checkout permission, payment modes, and basket minimums.',
      icon: ShoppingBag,
      previewType: 'storefront',
      keys: [
        'storefront_enabled',
        'guest_checkout_allowed',
        'cod_enabled',
        'online_payment_enabled',
        'min_order_amount',
        'free_shipping_threshold',
      ],
    },
    {
      id: 'delivery_sla',
      title: 'Fulfillment Timelines & Delivery SLA',
      description: 'Estimated customer shipping expectations displayed across product cards and checkout.',
      icon: Truck,
      keys: [
        'estimated_delivery_days_inside_city',
        'estimated_delivery_days_outside_city',
      ],
    },
    {
      id: 'channels',
      title: 'WhatsApp Commerce & Catalog Presentation',
      description: '1-tap WhatsApp quick order flows, risk scoring, pagination density, and customer review moderation.',
      icon: Sparkles,
      keys: [
        'whatsapp_ordering_enabled',
        'whatsapp_business_number',
        'order_fraud_check_active',
        'catalog_items_per_page',
        'show_stock_quantity_on_storefront',
        'require_review_moderation',
      ],
    },
  ],

  production: [
    {
      id: 'routing',
      title: 'Work Order & Batch Scheduling Policy',
      description: 'Industrial batch sequence policies, material allocation logic, and BOM release triggers.',
      icon: Factory,
      previewType: 'production',
      keys: [
        'scheduling_mode',
        'material_allocation_policy',
        'auto_issue_materials_on_batch_release',
      ],
    },
    {
      id: 'quality_waste',
      title: 'Yield Targets & Scrap Tolerances',
      description: 'Maximum allowable scrap tolerance, yield targets, piece-rate signoffs, and maintenance locks.',
      icon: CheckSquare,
      keys: [
        'scrap_wastage_tolerance_percent',
        'min_batch_yield_threshold_percent',
        'worker_piece_rate_verification_required',
        'enforce_machine_maintenance_lock',
      ],
    },
  ],

  inventory: [
    {
      id: 'valuation',
      title: 'Inventory Valuation & Reorder Points',
      description: 'Cost accounting method (FIFO/AVCO), safety stock alert thresholds, and negative dispatch rules.',
      icon: Package,
      previewType: 'inventory',
      keys: [
        'valuation_method',
        'low_stock_threshold_default',
        'allow_negative_stock',
        'batch_expiry_alert_lead_days',
      ],
    },
    {
      id: 'governance',
      title: 'Stock Movements & Quarantine Routing',
      description: 'Inter-warehouse transfer dispatch controls and automatic quarantine bin routing for failed inspections.',
      icon: ShieldCheck,
      keys: [
        'require_transfer_dispatch_approval',
        'auto_quarantine_failed_qc_stock',
      ],
    },
  ],

  purchase: [
    {
      id: 'po_rules',
      title: 'Purchase Order Approval & Replenishment',
      description: 'Executive PO signature thresholds, automated low-stock reorder generation, and 3-way matching.',
      icon: ShoppingCart,
      previewType: 'procurement',
      keys: [
        'po_approval_threshold_amount',
        'auto_generate_po_on_reorder_level',
        'supplier_lead_time_buffer_days',
        'po_expiration_days',
        'enforce_three_way_matching',
      ],
    },
  ],

  sales: [
    {
      id: 'commercial',
      title: 'Commercial Terms & Credit Limits',
      description: 'Payment terms, discount caps, overdue grace periods, and credit limit breach actions.',
      icon: BadgePercent,
      previewType: 'commercial',
      keys: [
        'default_payment_terms',
        'credit_limit_action',
        'max_commercial_discount_percent',
        'invoice_overdue_grace_days',
      ],
    },
    {
      id: 'automation',
      title: 'Fulfillment & Returns Governance',
      description: 'Automatic delivery generation upon invoice posting and required inspection for sales returns.',
      icon: Truck,
      keys: [
        'auto_generate_delivery_on_invoice',
        'require_qc_inspection_on_sales_return',
      ],
    },
  ],

  pos: [
    {
      id: 'counter',
      title: 'Counter Register & Payment Methods',
      description: 'Walk-in customer labelling, allowed payment modes, cash drawer variance limits, and barcode settings.',
      icon: Monitor,
      keys: [
        'default_walk_in_customer',
        'allowed_payment_methods',
        'prompt_opening_float_cash',
        'max_cash_drawer_variance_alert',
        'barcode_scanner_auto_increment',
      ],
    },
    {
      id: 'receipt',
      title: 'Thermal Receipt Printing & Notes',
      description: 'Thermal receipt paper width (80mm/58mm), header greetings, and exchange policy footers.',
      icon: FileSpreadsheet,
      previewType: 'pos_receipt',
      keys: [
        'receipt_printer_template',
        'receipt_header_note',
        'receipt_footer_note',
      ],
    },
    {
      id: 'security',
      title: 'Cashier Guardrails & Supervisor Overrides',
      description: 'Manager PIN requirements for item-level discounts, receipt voids, and receiptless returns.',
      icon: Lock,
      keys: [
        'require_manager_pin_for_discount',
        'require_manager_pin_for_void',
        'allow_pos_returns_without_receipt',
      ],
    },
  ],

  qc: [
    {
      id: 'standards',
      title: 'Inspection Tolerances & Sampling Standard',
      description: 'AQL sampling standard, batch sampling rates, critical defect rules, and rework signoff policies.',
      icon: CheckSquare,
      previewType: 'qc_standards',
      keys: [
        'sampling_aql_standard',
        'sampling_percentage',
        'auto_reject_on_critical_defect',
        'require_dual_signoff_for_rework',
        'quarantine_hold_period_days',
      ],
    },
  ],

  hr_payroll: [
    {
      id: 'work_rules',
      title: 'Working Hours & Shift Attendance',
      description: 'Standard working schedule, daily hours, overtime multiplier, and attendance grace windows.',
      icon: Users,
      previewType: 'payroll',
      keys: [
        'standard_working_days_per_week',
        'daily_standard_work_hours',
        'overtime_rate_multiplier',
        'shift_attendance_grace_period_mins',
        'employee_probation_period_months',
      ],
    },
    {
      id: 'compensation',
      title: 'Payroll Disbursement & Deductions',
      description: 'Target salary payout date and standard provident fund deduction percentages.',
      icon: Landmark,
      keys: [
        'monthly_salary_disbursement_day',
        'provident_fund_employee_deduction_percent',
      ],
    },
  ],

  assets: [
    {
      id: 'depreciation',
      title: 'Asset Depreciation & Maintenance Locking',
      description: 'Cost recovery method, authorized roles for asset scrap/disposal, and preventive maintenance locks.',
      icon: Cpu,
      keys: [
        'default_depreciation_method',
        'asset_capitalization_threshold_amount',
        'preventive_maintenance_alert_cycle_days',
        'asset_disposal_auth_role',
      ],
    },
  ],

  finance: [
    {
      id: 'general_ledger',
      title: 'Taxation & Fiscal Period Governance',
      description: 'Default VAT/tax percentages, auto-journal voucher postings, historical depreciation lock, and rounding accounts.',
      icon: Landmark,
      previewType: 'finance',
      keys: [
        'default_vat_rate_percent',
        'auto_post_gl_vouchers',
        'allow_unbalanced_manual_journals',
        'lock_historical_depreciation',
        'rounding_expense_account_code',
      ],
    },
  ],

  notifications: [
    {
      id: 'dispatch',
      title: 'System Alerts & Multi-Channel Triggers',
      description: 'Multi-channel routing (In-App, Email, SMS, WhatsApp) across stock, quality, logistics, and quiet hours.',
      icon: Bell,
      keys: [
        'notify_on_low_stock_channels',
        'notify_on_high_fraud_risk_order',
        'notify_on_qc_batch_failure',
        'notify_customer_on_courier_dispatch',
        'notify_on_production_shortage',
        'enable_promotional_sms_quiet_hours',
      ],
    },
  ],

  security: [
    {
      id: 'policy',
      title: 'Session Inactivity & Access Hardening',
      description: 'Idle timeout windows, admin 2FA enforcement, lockout thresholds, password complexity, and maintenance mode.',
      icon: ShieldCheck,
      previewType: 'security',
      keys: [
        'session_timeout_minutes',
        'password_min_length',
        'password_require_special_char',
        'max_login_failed_attempts',
        'lockout_duration_minutes',
        'enforce_2fa_for_admins',
        'audit_log_retention_days',
        'maintenance_mode_active',
      ],
    },
  ],

  reports: [
    {
      id: 'defaults',
      title: 'Report Layouts & Automated Exports',
      description: 'Default document export format (PDF/Excel), page sizes, orientations, letterhead banner, and timestamp footer.',
      icon: FileSpreadsheet,
      previewType: 'reports',
      keys: [
        'default_export_format',
        'default_paper_size',
        'default_report_orientation',
        'print_company_header_on_export',
        'include_generated_timestamp_footer',
      ],
    },
  ],
};
