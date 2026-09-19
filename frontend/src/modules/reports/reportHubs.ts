// ═══════════════════════════════════════════════════════════════════════════
// REPORTING HUBS ARCHITECTURE (Phase 5 & 11 Consolidation)
// Consolidates 84 individual report codes into 20 cohesive multi-view hubs.
// Every legacy report code is preserved as an active sub-view tab.
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportHubView {
  code: string;
  labelEn: string;
  labelBn: string;
}

export interface ReportHub {
  id: string;
  module: string;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  iconName: string;
  badgeTone: string;
  defaultCode: string;
  views: ReportHubView[];
}

export const REPORT_HUBS: ReportHub[] = [
  // ── 1. Production & Manufacturing ────────────────────────────────────────
  {
    id: 'hub_production_yield',
    module: 'production',
    titleEn: 'Manufacturing Output & Yield',
    titleBn: 'উৎপাদন ও ফলন পর্যবেক্ষণ',
    descEn: 'Overall production yield, output breakdowns by line, factory, product and shift.',
    descBn: 'সার্বিক উৎপাদন ফলন, লাইন, কারখানা, পণ্য ও শিফটভিত্তিক উৎপাদন বিশ্লেষণ।',
    iconName: 'Factory',
    badgeTone: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300',
    defaultCode: 'production_yield',
    views: [
      { code: 'production_yield', labelEn: 'Yield Analysis', labelBn: 'ফলন বিশ্লেষণ' },
      { code: 'daily_production', labelEn: 'Daily Output', labelBn: 'দৈনিক উৎপাদন' },
      { code: 'monthly_production', labelEn: 'Monthly Trend', labelBn: 'মাসিক ধারা' },
      { code: 'product_wise_production', labelEn: 'By Product', labelBn: 'পণ্যভিত্তিক' },
      { code: 'line_wise_production', labelEn: 'By Line', labelBn: 'লাইনভিত্তিক' },
      { code: 'factory_wise_production', labelEn: 'By Factory', labelBn: 'কারখানাভিত্তিক' },
      { code: 'shift_wise_production', labelEn: 'By Shift', labelBn: 'শিফটভিত্তিক' },
    ],
  },
  {
    id: 'hub_production_efficiency',
    module: 'production',
    titleEn: 'Efficiency, Target & Scrap',
    titleBn: 'দক্ষতা, লক্ষ্যমাত্রা ও অপচয়',
    descEn: 'Operational machine run-rates, target achievements, scrap ratios and mass balance.',
    descBn: 'মেশিন পরিচালনা দক্ষতা, লক্ষ্যমাত্রা অর্জন, স্ক্র্যাপ অপচয় ও ইনপুট-আউটপুট অনুপাত।',
    iconName: 'Zap',
    badgeTone: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300',
    defaultCode: 'production_efficiency',
    views: [
      { code: 'production_efficiency', labelEn: 'Efficiency %', labelBn: 'দক্ষতা %' },
      { code: 'production_target_vs_achievement', labelEn: 'Target vs Actual', labelBn: 'লক্ষ্য বনাম বাস্তব' },
      { code: 'production_wastage_scrap', labelEn: 'Scrap & Wastage', labelBn: 'স্ক্র্যাপ ও অপচয়' },
      { code: 'total_input_output', labelEn: 'Input vs Output', labelBn: 'ইনপুট বনাম আউটপুট' },
    ],
  },
  {
    id: 'hub_production_workers',
    module: 'production',
    titleEn: 'Floor Workforce Output',
    titleBn: 'শ্রমিক উৎপাদন ও পিস-রেট',
    descEn: 'Individual worker output and piece-rate wage accruals across assembly lines.',
    descBn: 'অ্যাসেম্বলি লাইনে কর্মরত শ্রমিকদের ব্যক্তিগত উৎপাদন ও পিস-রেট মজুরি হিসাব।',
    iconName: 'Users',
    badgeTone: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300',
    defaultCode: 'worker_production',
    views: [
      { code: 'worker_production', labelEn: 'Worker Output', labelBn: 'শ্রমিক উৎপাদন' },
      { code: 'worker_piece_rate_summary', labelEn: 'Piece-Rate Summary', labelBn: 'পিস-রেট বিবরণী' },
    ],
  },

  // ── 2. Inventory & Warehouse ─────────────────────────────────────────────
  {
    id: 'hub_inventory_stock',
    module: 'inventory',
    titleEn: 'Stock Intelligence & Balances',
    titleBn: 'মজুদ বিশ্লেষণ ও ব্যালেন্স',
    descEn: 'On-hand physical stock across raw materials, finished goods, warehouses and low stock alerts.',
    descBn: 'কাঁচামাল, প্রস্তুত পণ্য, বিভিন্ন গুদামের মোট মজুদ ও জরুরি রিঅর্ডার সতর্কতা।',
    iconName: 'Boxes',
    badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300',
    defaultCode: 'current_stock',
    views: [
      { code: 'current_stock', labelEn: 'Current Balances', labelBn: 'বর্তমান মজুদ' },
      { code: 'finished_goods_stock', labelEn: 'Finished Goods', labelBn: 'তৈরি পণ্য' },
      { code: 'raw_material_stock', labelEn: 'Raw Materials', labelBn: 'কাঁচামাল' },
      { code: 'warehouse_stock', labelEn: 'Warehouse Split', labelBn: 'গুদামভিত্তিক' },
      { code: 'low_stock', labelEn: 'Low Stock Alert', labelBn: 'কম মজুদের সতর্কতা' },
      { code: 'out_of_stock', labelEn: 'Stockouts', labelBn: 'মজুদশূন্য তালিকা' },
      { code: 'damaged_stock', labelEn: 'Damaged / Quarantine', labelBn: 'ত্রুটিপূর্ণ ও পৃথকীকৃত' },
    ],
  },
  {
    id: 'hub_inventory_movements',
    module: 'inventory',
    titleEn: 'Stock Movement & Ledger',
    titleBn: 'মজুদ চলাচল ও স্টক লেজার',
    descEn: 'Perpetual inventory transaction ledger, inward/outward flow, and inter-branch transfers.',
    descBn: 'ধারাবাহিক স্টক খতিয়ান, ইনওয়ার্ড-আউটওয়ার্ড প্রবাহ ও গুদাম স্থানান্তর চালান।',
    iconName: 'Layers',
    badgeTone: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300',
    defaultCode: 'stock_ledger',
    views: [
      { code: 'stock_ledger', labelEn: 'Stock Ledger', labelBn: 'স্টক লেজার' },
      { code: 'stock_movement', labelEn: 'Material Flow', labelBn: 'মজুদ স্থানান্তর' },
      { code: 'warehouse_transfer', labelEn: 'Warehouse Transfers', labelBn: 'গুদাম বদল চালান' },
    ],
  },
  {
    id: 'hub_inventory_valuation',
    module: 'inventory',
    titleEn: 'Inventory Valuation',
    titleBn: 'মজুদ পণ্যের আর্থিক মূল্যায়ন',
    descEn: 'FIFO & weighted cost valuation of capital tied up in warehouse balances.',
    descBn: 'গুদামে মজুত সম্পদের আর্থিক মূল্য ও গড় ক্রয়মূল্য নির্ধারণ।',
    iconName: 'Coins',
    badgeTone: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300',
    defaultCode: 'stock_valuation',
    views: [
      { code: 'stock_valuation', labelEn: 'Valuation by SKU', labelBn: 'পণ্যভিত্তিক মূল্যায়ন' },
    ],
  },

  // ── 3. Purchase & Procurement ────────────────────────────────────────────
  {
    id: 'hub_procurement_pos',
    module: 'purchasing',
    titleEn: 'Purchase Orders & Inwarding',
    titleBn: 'ক্রয়াদেশ ও মালামাল গ্রহণ',
    descEn: 'PO status, itemized procurement details, product purchases and return debit notes.',
    descBn: 'ক্রয়াদেশ স্ট্যাটাস, পণ্যভিত্তিক সংগ্রহের তালিকা ও ক্রয় ফেরত ডেবিট নোট।',
    iconName: 'ShoppingBag',
    badgeTone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300',
    defaultCode: 'purchase_summary',
    views: [
      { code: 'purchase_summary', labelEn: 'PO Summary', labelBn: 'ক্রয় সংক্ষেপ' },
      { code: 'purchase_details', labelEn: 'Itemized Details', labelBn: 'বিস্তারিত ক্রয়' },
      { code: 'product_purchase', labelEn: 'By Product', labelBn: 'পণ্যভিত্তিক ক্রয়' },
      { code: 'purchase_return', labelEn: 'Purchase Returns', labelBn: 'ক্রয় ফেরত' },
    ],
  },
  {
    id: 'hub_procurement_suppliers',
    module: 'purchasing',
    titleEn: 'Supplier Accounts & AP Aging',
    titleBn: 'সরবরাহকারী হিসাব ও প্রদেয় বিল',
    descEn: 'Supplier purchase volumes, outstanding balances, accounts payable aging and payment logs.',
    descBn: 'সরবরাহকারী ক্রয় ভলিউম, বকেয়া দেনা, প্রদেয় বিলের মেয়াদ ও পরিশোধের ইতিহাস।',
    iconName: 'Building2',
    badgeTone: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300',
    defaultCode: 'supplier_purchase',
    views: [
      { code: 'supplier_purchase', labelEn: 'Purchases by Vendor', labelBn: 'ভেন্ডরভিত্তিক ক্রয়' },
      { code: 'supplier_due', labelEn: 'Outstanding Due', labelBn: 'বকেয়া দেনা' },
      { code: 'supplier_ap_aging', labelEn: 'AP Aging (30/60/90+)', labelBn: 'প্রদেয় বয়স বিশ্লেষণ' },
      { code: 'supplier_payment_history', labelEn: 'Payment History', labelBn: 'পরিশোধের ইতিহাস' },
    ],
  },

  // ── 4. Sales & POS Counters ──────────────────────────────────────────────
  {
    id: 'hub_sales_omnichannel',
    module: 'sales',
    titleEn: 'Omnichannel Sales & Registers',
    titleBn: 'বিক্রয় ও কাউন্টার ক্যাশ রেজিস্টার',
    descEn: 'Daily/monthly revenue, B2B wholesale, B2C retail, physical POS registers and customer sales.',
    descBn: 'দৈনিক ও মাসিক আয়, পাইকারি বিক্রয়, খুচরা দোকান, পিওএস রেজিস্টার ও গ্রাহক বিশ্লেষণ।',
    iconName: 'Receipt',
    badgeTone: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300',
    defaultCode: 'sales_performance',
    views: [
      { code: 'sales_performance', labelEn: 'Overview', labelBn: 'সার্বিক চিত্র' },
      { code: 'daily_sales', labelEn: 'Daily Revenue', labelBn: 'দৈনিক বিক্রয়' },
      { code: 'monthly_sales', labelEn: 'Monthly Trend', labelBn: 'মাসিক বিক্রয়' },
      { code: 'pos_counter_sales', labelEn: 'POS Registers', labelBn: 'পিওএস কাউন্টার' },
      { code: 'b2b_sales', labelEn: 'B2B Wholesale', labelBn: 'বি২বি পাইকারি' },
      { code: 'b2c_sales', labelEn: 'B2C Retail', labelBn: 'বি২সি খুচরা' },
      { code: 'sales_by_product', labelEn: 'By Product', labelBn: 'পণ্যভিত্তিক বিক্রয়' },
      { code: 'sales_by_customer', labelEn: 'By Customer', labelBn: 'গ্রাহকভিত্তিক' },
      { code: 'payment_method_summary', labelEn: 'Payment Tenders', labelBn: 'পেমেন্ট মাধ্যম' },
      { code: 'sales_return', labelEn: 'Sales Returns', labelBn: 'বিক্রয় ফেরত' },
    ],
  },

  // ── 5. Profitability & Margins ───────────────────────────────────────────
  {
    id: 'hub_profitability',
    module: 'profit',
    titleEn: 'Profitability & Contribution Margin',
    titleBn: 'লাভজনকতা ও মার্জিন বিশ্লেষণ',
    descEn: 'Gross margins by product SKU, invoice margin contributions, and daily/monthly net profit.',
    descBn: 'পণ্যভিত্তিক মোট লাভ মার্জিন, ইনভয়েস লাভ ও দৈনিক-মাসিক নিট ব্যবসায়িক মুনাফা।',
    iconName: 'TrendingUp',
    badgeTone: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300',
    defaultCode: 'product_profit',
    views: [
      { code: 'product_profit', labelEn: 'By Product SKU', labelBn: 'পণ্যভিত্তিক মুনাফা' },
      { code: 'invoice_profit', labelEn: 'By Invoice', labelBn: 'চালানভিত্তিক মুনাফা' },
      { code: 'daily_profit', labelEn: 'Daily Profit', labelBn: 'দৈনিক মুনাফা' },
      { code: 'monthly_profit', labelEn: 'Monthly Profit', labelBn: 'মাসিক মুনাফা' },
    ],
  },

  // ── 6. CRM & Customer Leads ──────────────────────────────────────────────
  {
    id: 'hub_crm_pipeline',
    module: 'crm',
    titleEn: 'Commercial Lead Pipeline',
    titleBn: 'সিআরএম লিড পাইপলাইন ও রূপান্তর',
    descEn: 'Lead conversion funnel, acquisition sources, won/lost opportunities, and audit verification.',
    descBn: 'লিড রূপান্তর ফানেল, চ্যানেলের কার্যকারিতা, সফল ও ব্যর্থ চুক্তি এবং অডিট নিরীক্ষা।',
    iconName: 'Users',
    badgeTone: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300',
    defaultCode: 'lead_summary',
    views: [
      { code: 'lead_summary', labelEn: 'Pipeline Funnel', labelBn: 'লিড ওভারভিউ' },
      { code: 'lead_status_distribution', labelEn: 'Status Split', labelBn: 'স্ট্যাটাস বণ্টন' },
      { code: 'conversion_rate_source', labelEn: 'Conversion Rate', labelBn: 'রূপান্তর হার' },
      { code: 'converted_leads', labelEn: 'Converted Deals', labelBn: 'সফল গ্রাহক' },
      { code: 'lost_leads_analysis', labelEn: 'Lost Deals', labelBn: 'ব্যর্থ লিড' },
      { code: 'salesman_leads', labelEn: 'By Sales Rep', labelBn: 'প্রতিনিধিভিত্তিক' },
      { code: 'fake_leads_audit', labelEn: 'Lead Integrity Audit', labelBn: 'লিড সত্যতা অডিট' },
    ],
  },

  // ── 7. Sales Force Performance ───────────────────────────────────────────
  {
    id: 'hub_sales_force',
    module: 'salesmen',
    titleEn: 'Sales Force Quotas & Incentives',
    titleBn: 'সেলস টিম লক্ষ্যমাত্রা ও ইনসেন্টিভ',
    descEn: 'Sales rep leaderboard, quota completion, remaining targets, and tiered commission payouts.',
    descBn: 'বিক্রয়কর্মীদের লিডারবোর্ড, কোটা অর্জন %, বাকি টার্গেট ও অর্জিত প্রণোদনা কমিশন।',
    iconName: 'Target',
    badgeTone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300',
    defaultCode: 'salesman_leaderboard',
    views: [
      { code: 'salesman_leaderboard', labelEn: 'Leaderboard', labelBn: 'লিডারবোর্ড' },
      { code: 'sales_by_salesman', labelEn: 'Revenue by Rep', labelBn: 'প্রতিনিধির বিক্রয়' },
      { code: 'salesman_quota_achievement', labelEn: 'Quota % Achieved', labelBn: 'কোটা অর্জন %' },
      { code: 'salesman_remaining_target', labelEn: 'Remaining Target', labelBn: 'বাকি লক্ষ্যমাত্রা' },
      { code: 'salesman_profit_contribution', labelEn: 'Profit Contributed', labelBn: 'অর্জিত মুনাফা' },
      { code: 'salesman_incentive_accrual', labelEn: 'Incentive Accrual', labelBn: 'প্রণোদনা হিসাব' },
      { code: 'sales_commission_payout', labelEn: 'Commission Payouts', labelBn: 'কমিশন প্রদান' },
    ],
  },

  // ── 8. Delivery & Logistics ──────────────────────────────────────────────
  {
    id: 'hub_delivery_parcels',
    module: 'delivery',
    titleEn: 'Fulfillment & Parcel Dispatch',
    titleBn: 'অর্ডার ডেলিভারি ও পার্সেল প্রেরণ',
    descEn: 'Dispatched, delivered, pending transit, returned to origin (RTO) and cancelled parcels.',
    descBn: 'সম্পন্ন ডেলিভারি, ট্রানজিটে থাকা পার্সেল, রিটার্ন (RTO) ও বাতিলকৃত চালান।',
    iconName: 'Truck',
    badgeTone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300',
    defaultCode: 'delivered_orders',
    views: [
      { code: 'delivered_orders', labelEn: 'Delivered Orders', labelBn: 'সফল ডেলিভারি' },
      { code: 'pending_deliveries', labelEn: 'Pending / In Transit', labelBn: 'অপেক্ষমাণ ও ট্রানজিট' },
      { code: 'returned_orders', labelEn: 'Returns (RTO)', labelBn: 'রিটার্ন পার্সেল' },
      { code: 'cancelled_deliveries', labelEn: 'Cancelled Dispatches', labelBn: 'বাতিলকৃত অর্ডার' },
    ],
  },
  {
    id: 'hub_delivery_couriers',
    module: 'delivery',
    titleEn: 'Courier SLA & COD Reconciliation',
    titleBn: 'কুরিয়ার পারফরম্যান্স ও সিওডি সমাধান',
    descEn: 'Delivery speed metrics across Pathao, Steadfast, and Paperfly, with COD remittance tracking.',
    descBn: 'পাঠাও, স্টিডফাস্ট ও অন্যান্য কুরিয়ারের ডেলিভারি সময় এবং সিওডি ক্যাশ কালেকশন মেলানো।',
    iconName: 'Clock',
    badgeTone: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300',
    defaultCode: 'courier_performance',
    views: [
      { code: 'courier_performance', labelEn: 'Courier Performance', labelBn: 'কুরিয়ার পারফরম্যান্স' },
      { code: 'cod_reconciliation', labelEn: 'COD Reconciliation', labelBn: 'সিওডি সমাধান' },
      { code: 'delivery_sla_history', labelEn: 'SLA History', labelBn: 'এসএলএ ইতিহাস' },
    ],
  },

  // ── 9. HR & Workforce ────────────────────────────────────────────────────
  {
    id: 'hub_hr_workforce',
    module: 'hr',
    titleEn: 'Staff Directory & Attendance',
    titleBn: 'কর্মচারী বিবরণী ও বায়োমেট্রিক উপস্থিতি',
    descEn: 'Employee profiles, designation rosters, and daily biometric attendance logs.',
    descBn: 'কর্মচারী ডিরেক্টরি, পদবি তালিকা এবং বায়োমেট্রিক উপস্থিতির দৈনিক রেকর্ড।',
    iconName: 'UserCheck',
    badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300',
    defaultCode: 'daily_attendance',
    views: [
      { code: 'daily_attendance', labelEn: 'Daily Attendance', labelBn: 'দৈনিক উপস্থিতি' },
      { code: 'employee_directory', labelEn: 'Employee Directory', labelBn: 'কর্মচারী তালিকা' },
    ],
  },
  {
    id: 'hub_hr_payroll',
    module: 'hr',
    titleEn: 'Payroll & Disbursed Wages',
    titleBn: 'বেতন বিবরণী ও নিট বিতরণ',
    descEn: 'Monthly salary disbursements, deductions, overtime wages, and net payroll.',
    descBn: 'মাসিক বেতন বিতরণ, কর্তন, ওভারটাইম মজুরি ও নিট পে-রোল হিসাব।',
    iconName: 'Coins',
    badgeTone: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300',
    defaultCode: 'payroll_summary',
    views: [
      { code: 'payroll_summary', labelEn: 'Payroll Summary', labelBn: 'পে-রোল বিবরণী' },
    ],
  },

  // ── 10. Finance & Accounts ───────────────────────────────────────────────
  {
    id: 'hub_finance_ledger',
    module: 'finance',
    titleEn: 'General Ledger & Financial Statements',
    titleBn: 'সাধারণ খতিয়ান ও আর্থিক বিবরণী',
    descEn: 'General ledger summaries, cash/bank books, P&L statements, operating costs, and customer AR.',
    descBn: 'সাধারণ খতিয়ান সংক্ষেপ, ক্যাশ ও ব্যাংক বুক, লাভ-ক্ষতি বিবরণী, পরিচালন ব্যয় ও বকেয়া পাওনা।',
    iconName: 'DollarSign',
    badgeTone: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300',
    defaultCode: 'gl_summary',
    views: [
      { code: 'gl_summary', labelEn: 'GL Summary', labelBn: 'জিএল খতিয়ান' },
      { code: 'cash_bank_ledger', labelEn: 'Cash & Bank Books', labelBn: 'ক্যাশ ও ব্যাংক বুক' },
      { code: 'income_statement', labelEn: 'Income Statement (P&L)', labelBn: 'লাভ-ক্ষতি বিবরণী' },
      { code: 'operating_expenses', labelEn: 'Operating Expenses', labelBn: 'পরিচালন ব্যয়' },
      { code: 'customer_ar_aging', labelEn: 'Customer AR Aging', labelBn: 'গ্রাহক বকেয়া বয়স' },
    ],
  },

  // ── 11. Fixed Asset Management ───────────────────────────────────────────
  {
    id: 'hub_assets_register',
    module: 'assets',
    titleEn: 'Fixed Assets, Net Book Value & Logs',
    titleBn: 'স্থায়ী সম্পদ রেজিস্টার ও অবচয়',
    descEn: 'Fixed asset registers, net book value (NBV) depreciation, custodian assignments, and repairs.',
    descBn: 'স্থায়ী সম্পদ তালিকা, নিট বুক ভ্যালু (NBV), কর্মচারীদের অর্পিত সম্পদ ও মেরামত লগ।',
    iconName: 'Cpu',
    badgeTone: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
    defaultCode: 'fixed_asset_register',
    views: [
      { code: 'fixed_asset_register', labelEn: 'Asset Register', labelBn: 'সম্পদ রেজিস্টার' },
      { code: 'asset_valuation_nbv', labelEn: 'Net Book Value (NBV)', labelBn: 'নিট বুক ভ্যালু' },
      { code: 'assigned_assets', labelEn: 'Assigned Assets', labelBn: 'অর্পিত সম্পদ' },
      { code: 'asset_maintenance_log', labelEn: 'Maintenance Logs', labelBn: 'মেরামত লগ' },
      { code: 'asset_disposal_history', labelEn: 'Disposal & Scrap', labelBn: 'বাতিল ও নিষ্পত্তি' },
    ],
  },

  // ── 12. Quality Control & Assurance ──────────────────────────────────────
  {
    id: 'hub_qc_assurance',
    module: 'qc',
    titleEn: 'Quality Gate & Inspection Analytics',
    titleBn: 'কোয়ালিটি গেট ও পরিদর্শন নিরীক্ষা',
    descEn: 'Pass/fail inspection ratios, defect classification taxonomy, and compliance audit trails.',
    descBn: 'পরিদর্শন পাস/ফেল অনুপাত, ত্রুটির শ্রেণিবিন্যাস এবং কারখানা ব্যাচ অডিট ট্রেইল।',
    iconName: 'ShieldCheck',
    badgeTone: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300',
    defaultCode: 'qc_inspection_ratio',
    views: [
      { code: 'qc_inspection_ratio', labelEn: 'Pass/Fail Ratio', labelBn: 'পাস-ফেল অনুপাত' },
      { code: 'defect_categorization', labelEn: 'Defect Categories', labelBn: 'ত্রুটির ধরন' },
      { code: 'compliance_audit_trail', labelEn: 'Audit Trail', labelBn: 'অডিট ট্রেইল' },
    ],
  },
];

/**
 * Finds the parent Hub for any given legacy or granular report code.
 */
export function findHubForReportCode(code: string): ReportHub | undefined {
  return REPORT_HUBS.find((h) => h.views.some((v) => v.code === code));
}
