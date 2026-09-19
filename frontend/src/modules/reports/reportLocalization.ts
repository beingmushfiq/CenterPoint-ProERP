// ═══════════════════════════════════════════════════════════════════════════
// REPORT LOCALIZATION SUITE (English & Bengali)
// Enterprise bilingual translations for all 84 reporting definitions,
// modules, categories, filter presets, and UI telemetry.
// ═══════════════════════════════════════════════════════════════════════════

export interface LocalizedMeta {
  name: string;
  description: string;
}

export const MODULE_TRANSLATIONS: Record<string, { en: { name: string; shortName: string; desc: string }; bn: { name: string; shortName: string; desc: string } }> = {
  all: {
    en: { name: 'All Modules', shortName: 'All', desc: 'Comprehensive enterprise reporting across all operations.' },
    bn: { name: 'সকল মডিউল', shortName: 'সকল', desc: 'সকল ব্যবসায়িক কার্যক্রমের সার্বিক প্রতিবেদন।' },
  },
  production: {
    en: { name: 'Production & Manufacturing', shortName: 'Production', desc: 'Output yield, batch run-rates, scrap ratios, and worker piece rates.' },
    bn: { name: 'উৎপাদন ও কারখানা', shortName: 'উৎপাদন', desc: 'ব্যাচ আউটপুট, ফলন দক্ষতা, স্ক্র্যাপ অনুপাত ও পিস-রেট মজুরি।' },
  },
  inventory: {
    en: { name: 'Inventory & Warehouse', shortName: 'Inventory', desc: 'Stock valuation, ledger movements, safety stock alerts, and transfers.' },
    bn: { name: 'মজুদ ও গুদাম', shortName: 'মজুদ', desc: 'স্টক মূল্যায়ন, খতিয়ান স্থানান্তর ও জরুরি মজুদ সতর্কতা।' },
  },
  purchasing: {
    en: { name: 'Purchase & Procurement', shortName: 'Purchasing', desc: 'PO status, supplier lead times, GRN inspection, and accounts payable.' },
    bn: { name: 'ক্রয় ও সংগ্রহ', shortName: 'ক্রয়', desc: 'পিও স্ট্যাটাস, সরবরাহকারী চালান, জিআরএন ও প্রদেয় বিল।' },
  },
  sales: {
    en: { name: 'Sales & POS Counters', shortName: 'Sales & POS', desc: 'Omnichannel revenue, counter shifts, split tenders, and sales returns.' },
    bn: { name: 'বিক্রয় ও পিওএস', shortName: 'বিক্রয় ও পিওএস', desc: 'ওমনিচ্যানেল রাজস্ব, পিওএস কাউন্টার শিফট ও বিক্রয় ফেরত।' },
  },
  profit: {
    en: { name: 'Profitability & Margins', shortName: 'Profitability', desc: 'Gross margin by SKU, invoice profitability, and net contribution.' },
    bn: { name: 'লাভজনকতা ও মার্জিন', shortName: 'মুনাফা', desc: 'পণ্যভিত্তিক মোট মার্জিন, চালান মুনাফা ও নিট ব্যবসায়িক অবদান।' },
  },
  crm: {
    en: { name: 'CRM & Commercial Leads', shortName: 'CRM', desc: 'Pipeline funnel, fake lead verification audits, and conversion rates.' },
    bn: { name: 'সিআরএম ও লিড', shortName: 'সিআরএম', desc: 'লিড পাইপলাইন, ভুয়া লিড যাচাই ও বিক্রয় রূপান্তর হার।' },
  },
  salesmen: {
    en: { name: 'Salesman Targets & Quotas', shortName: 'Salesmen', desc: 'Monthly quota tracking, achievement %, profit generated, and tiered incentives.' },
    bn: { name: 'বিক্রয়কর্মী ও লক্ষ্যমাত্রা', shortName: 'বিক্রয়কর্মী', desc: 'মাসিক সেলস কোটা, লক্ষ্য অর্জন %, অর্জিত মুনাফা ও প্রণোদনা।' },
  },
  delivery: {
    en: { name: 'Delivery & Logistics', shortName: 'Delivery', desc: 'Courier fulfillment (Pathao/Steadfast), RTO returns, and COD settlement.' },
    bn: { name: 'ডেলিভারি ও কুরিয়ার', shortName: 'ডেলিভারি', desc: 'কুরিয়ার পার্সেল ট্র্যাকিং (পাঠাও/স্টিডফাস্ট), রিটার্ন ও সিওডি সমন্বয়।' },
  },
  hr: {
    en: { name: 'HR & Workforce Payroll', shortName: 'HR & Payroll', desc: 'Attendance, piece-rate wages, overtime units, and disbursed net payroll.' },
    bn: { name: 'এইচআর ও পেরোল', shortName: 'এইচআর ও পেরোল', desc: 'বায়োমেট্রিক উপস্থিতি, পিস-রেট মজুরি, ওভারটাইম ও নিট বেতন।' },
  },
  finance: {
    en: { name: 'Finance & Accounts Ledger', shortName: 'Finance', desc: 'Trial balance, profit & loss, operating expenses, and AR/AP aging.' },
    bn: { name: 'অর্থ ও হিসাব', shortName: 'অর্থ ও হিসাব', desc: 'সাধারণ খতিয়ান, রেওয়ামিল, লাভ-ক্ষতি ও ব্যয় বিবরণী।' },
  },
  assets: {
    en: { name: 'Fixed Asset Management', shortName: 'Assets', desc: 'Asset register, net book value (NBV), maintenance logs, and depreciation.' },
    bn: { name: 'স্থায়ী সম্পদ ব্যবস্থাপনা', shortName: 'স্থায়ী সম্পদ', desc: 'সম্পদ রেজিস্টার, নিট বুক ভ্যালু (NBV), মেরামত লগ ও অবচয়।' },
  },
  qc: {
    en: { name: 'QC & Audit Compliance', shortName: 'QC & Audit', desc: 'AQL 2.5 inspection pass/fail rates, defect tags, and regulatory audit logs.' },
    bn: { name: 'মান নিয়ন্ত্রণ ও অডিট', shortName: 'মান নিয়ন্ত্রণ', desc: 'কিউসি পরিদর্শন পাস/ফেল হার, ত্রুটি কোড ও নিয়ন্ত্রক অডিট।' },
  },
};

export const CATEGORY_TRANSLATIONS: Record<string, { en: string; bn: string }> = {
  all: { en: 'All Reports', bn: 'সকল প্রতিবেদন' },
  operational: { en: 'Operational', bn: 'অপারেশনাল' },
  financial: { en: 'Financial', bn: 'আর্থিক' },
  analytical: { en: 'Analytical', bn: 'বিশ্লেষণমূলক' },
  compliance: { en: 'Compliance', bn: 'কমপ্লায়েন্স' },
  executive: { en: 'Executive', bn: 'নির্বাহী' },
};

export const PRESET_TRANSLATIONS: Record<string, { en: string; bn: string }> = {
  today: { en: 'Today', bn: 'আজ' },
  yesterday: { en: 'Yesterday', bn: 'গতকাল' },
  this_week: { en: 'This Week', bn: 'চলতি সপ্তাহ' },
  this_month: { en: 'This Month', bn: 'চলতি মাস' },
  last_30_days: { en: '30 Days', bn: '৩০ দিন' },
  custom: { en: 'Custom', bn: 'কাস্টম' },
};

export const REPORT_BN_TRANSLATIONS: Record<string, LocalizedMeta> = {
  // ── PRODUCTION ──
  daily_production: {
    name: 'দৈনিক উৎপাদন প্রতিবেদন',
    description: 'লাইন ও শিফট অনুযায়ী পরিকল্পিত বনাম প্রকৃত উৎপাদনের দৈনিক হিসাব।',
  },
  monthly_production: {
    name: 'মাসিক উৎপাদন সারাংশ',
    description: 'মাসিক মোট উৎপাদন পরিমাণ, ধারণক্ষমতা ব্যবহারের হার (%) এবং সময়ানুবর্তিতা।',
  },
  production_target_vs_achievement: {
    name: 'উৎপাদন লক্ষ্য বনাম অর্জন',
    description: 'কারখানার নির্ধারিত লক্ষ্য ও বাস্তব উৎপাদিত পরিমাণের তুলনামূলক বৈচিত্র্য বিশ্লেষণ।',
  },
  production_yield: {
    name: 'উৎপাদন ফলন ও অপচয় বিশ্লেষণ',
    description: 'ব্যাচভিত্তিক ফলন দক্ষতা %, পরিকল্পিত বনাম প্রকৃত উৎপাদন এবং বাতিল পরিমাণের খতিয়ান।',
  },
  worker_production: {
    name: 'শ্রমিক পিস-রেট উৎপাদন লগ',
    description: 'অপারেটরদের ব্যক্তিগত উৎপাদন লগ, কাজের সময় এবং অর্জিত পিস-রেট মজুরি।',
  },
  line_wise_production: {
    name: 'লাইনভিত্তিক উৎপাদন ও সীমাবদ্ধতা',
    description: 'অ্যাসেম্বলি লাইনের দক্ষতা, ঘণ্টাপ্রতি উৎপাদনের হার (পিস/ঘণ্টা) এবং ডাউনটাইম।',
  },
  production_wastage_scrap: {
    name: 'উৎপাদন অপচয়, পুনর্ব্যবহার ও স্ক্র্যাপ',
    description: 'কাঁচামাল রূপান্তরের অপচয় ট্র্যাকিং, ত্রুটি কোড এবং স্ক্র্যাপের আর্থিক ক্ষতি।',
  },
  production_efficiency: {
    name: 'উৎপাদন লাইন কার্যকারিতা (OEE)',
    description: 'সামগ্রিক সরঞ্জাম কার্যকারিতা (OEE), রান-রেট গতি ও ডাউনটাইম ট্র্যাকিং।',
  },
  shift_wise_production: {
    name: 'শিফটভিত্তিক উৎপাদন পারফরম্যান্স',
    description: 'সকাল, বিকেল ও রাতের শিফটের মাঝে উৎপাদন তুলনা ও কর্মী বণ্টন।',
  },
  product_wise_production: {
    name: 'পণ্যভিত্তিক উৎপাদন বিশ্লেষণ',
    description: 'প্রতিটি নির্দিষ্ট এসকেইউ-এর উৎপাদন সময়, শ্রম ও সমাপ্ত পরিমাণের সারসংক্ষেপ।',
  },
  factory_wise_production: {
    name: 'কারখানাভিত্তিক সমন্বিত উৎপাদন',
    description: 'একাধিক উৎপাদন প্ল্যান্ট ও ইউনিটের মাঝে উৎপাদন ভলিউম তুলনা।',
  },
  total_input_output: {
    name: 'মোট ইনপুট বনাম আউটপুট বিশ্লেষণ',
    description: 'কাঁচামাল ইনপুট বনাম উৎপাদিত ফিনিশড গুডসের ভর ও রূপান্তর অনুপাত।',
  },

  // ── INVENTORY ──
  stock_valuation: {
    name: 'মজুদ পণ্যের মূল্যায়ন ও বার্ধক্য',
    description: 'ফিফো/চলতি গড়ের ভিত্তিতে বর্তমান স্টকের আর্থিক মূল্য এবং হোল্ডিং খরচ।',
  },
  current_stock: {
    name: 'বর্তমান মজুদের সারসংক্ষেপ',
    description: 'সকল সক্রিয় এসকেইউ-এর মোট মজুত, বর্তমান অবস্থান এবং সংরক্ষিত পরিমাণ।',
  },
  stock_ledger: {
    name: 'মজুদ পণ্য লেনদেন খতিয়ান',
    description: 'ক্রয়, বিক্রয়, স্থানান্তর ও সমন্বয়ের মাধ্যমে পণ্যের বিস্তারিত গতিবিধি।',
  },
  stock_movement: {
    name: 'স্টক মুভমেন্ট ও ভেলোসিটি (ইন/আউট)',
    description: 'গুদামে পণ্যের প্রবেশ ও প্রস্থানের গতিশীলতা এবং টার্নওভার রেট।',
  },
  low_stock: {
    name: 'স্বল্প মজুদের আগাম সতর্কতা',
    description: 'যেসব পণ্য সেফটি স্টক বা ন্যূনতম সীমার নিচে নেমে গেছে তাদের তালিকা।',
  },
  out_of_stock: {
    name: 'মজুদ শূন্য পণ্য ও প্রভাব বিশ্লেষণ',
    description: 'স্টকআউটের কারণে মিস হওয়া অর্ডারের পরিমাণ ও সম্ভাব্য রাজস্ব ক্ষতি।',
  },
  warehouse_stock: {
    name: 'গুদামভিত্তিক পণ্য বণ্টন',
    description: 'কেন্দ্রীয় গুদাম ও শাখা ডিপোগুলোর মাঝে স্টকের পরিমাণগত বিভাজন।',
  },
  warehouse_transfer: {
    name: 'গুদাম স্থানান্তর লগ',
    description: 'শাখা বা গুদামের মাঝে পণ্য চালানের স্থিতি ও গ্রহণ নিশ্চিতকরণ।',
  },
  raw_material_stock: {
    name: 'কাঁচামাল মজুদ ও মূল্যায়ন',
    description: 'উৎপাদনে ব্যবহৃত ফেব্রিক, আনুষঙ্গিক ও কাঁচামালের বর্তমান মজুত ও মূল্য।',
  },
  finished_goods_stock: {
    name: 'তৈরি পণ্যের মজুদ স্থিতি',
    description: 'বিক্রয়ের জন্য প্রস্তুত সমাপ্ত পণ্যের গুদামভিত্তিক রিয়েল-টাইম হিসাব।',
  },
  damaged_stock: {
    name: 'ক্ষতিগ্রস্ত ও বিনষ্ট পণ্য লগ',
    description: 'ক্ষতিগ্রস্ত, মেয়াদোত্তীর্ণ বা বিনষ্ট পণ্যের তালিকা ও সমন্বয় খতিয়ান।',
  },

  // ── PURCHASING ──
  purchase_summary: {
    name: 'ক্রয় সারাংশ ও চালান ট্র্যাকিং',
    description: 'সরবরাহকারী পিও অনুমোদন, ডেলিভারি স্থিতি এবং পণ্য গ্রহণ নোট (জিআরএন)।',
  },
  purchase_details: {
    name: 'আইটেমভিত্তিক ক্রয়ের বিস্তারিত',
    description: 'প্রতিটি ক্রয়ের বিস্তারিত এসকেইউ, একক দর, ভ্যাট এবং চালানের সারসংক্ষেপ।',
  },
  supplier_purchase: {
    name: 'সরবরাহকারীভিত্তিক ক্রয় বিশ্লেষণ',
    description: 'ভেন্ডরভিত্তিক ক্রয়ের পরিমাণ, মূল্যমান এবং লেনদেনের ফ্রিকোয়েন্সি।',
  },
  product_purchase: {
    name: 'কাঁচামাল ক্রয় মূল্য প্রবণতা',
    description: 'সময়ের সাথে সাথে কাঁচামালের বাজারমূল্য ওঠানামা ও মুদ্রাস্ফীতি ট্র্যাকিং।',
  },
  purchase_return: {
    name: 'ক্রয় ফেরত ও ডেবিট নোট',
    description: 'সরবরাহকারীকে ফেরত পাঠানো ত্রুটিযুক্ত কাঁচামাল ও ডেবিট নোট সমন্বয়।',
  },
  supplier_due: {
    name: 'সরবরাহকারী বকেয়া ও দেনা বিবরণী',
    description: 'সরবরাহকারীদের পরিশোধযোগ্য বকেয়া এবং পেমেন্টের সময়সীমা ট্র্যাকিং।',
  },
  supplier_payment_history: {
    name: 'সরবরাহকারী পেমেন্ট বিতরণ ইতিহাস',
    description: 'ব্যাংক স্থানান্তর, চেক ও ক্যাশের মাধ্যমে সম্পন্ন ক্রয় পরিশোধের তালিকা।',
  },

  // ── SALES & POS ──
  daily_sales: {
    name: 'দৈনিক বিক্রয় লগ',
    description: 'প্রতিদিনের সম্পন্ন বিক্রয়, ক্যাশ কালেকশন এবং চ্যানেল পারফরম্যান্স।',
  },
  monthly_sales: {
    name: 'মাসিক বিক্রয় ভেলোসিটি ও ট্রেন্ড',
    description: 'মাসভিত্তিক বিক্রয় প্রবৃদ্ধি, মৌসুমী চাহিদা এবং রাজস্ব প্রবণতা।',
  },
  product_sales: {
    name: 'পণ্যভিত্তিক বিক্রয় বিশ্লেষণ',
    description: 'সর্বোচ্চ বিক্রিত পণ্য, বিক্রয় ভলিউম এবং রাজস্ব অবদান।',
  },
  customer_sales: {
    name: 'গ্রাহকভিত্তিক বিক্রয় খতিয়ান',
    description: 'কর্পোরেট ক্লায়েন্ট ও নিয়মিত ক্রেতাদের মোট ক্রয় এবং অর্ডার ইতিহাস।',
  },
  salesman_sales: {
    name: 'বিক্রয়কর্মীভিত্তিক রাজস্ব বণ্টন',
    description: 'প্রতিটি সেলস রিপ্রেজেন্টেটিভের মাধ্যমে অর্জিত রাজস্ব ও ইনভয়েসের সংখ্যা।',
  },
  sales_performance: {
    name: 'চ্যানেলভিত্তিক বিক্রয় ও রাজস্ব',
    description: 'পাইকারি, রিটেল, কর্পোরেট ও অনলাইন স্টোরফ্রন্টের রাজস্ব তুলনামূলক খতিয়ান।',
  },
  b2b_sales: {
    name: 'বিটুবি পাইকারি বিক্রয় খতিয়ান',
    description: 'পাইকারি বা প্রাতিষ্ঠানিক অর্ডারের ভলিউম, বকেয়া চালান এবং শর্তাবলী।',
  },
  b2c_sales: {
    name: 'বিটুসি ও অনলাইন স্টোরফ্রন্ট বিক্রয়',
    description: 'অনলাইন ই-কমার্স গ্রাহক অর্ডার, ডিজিটাল পেমেন্ট ও ড্রপশিপিং হিসাব।',
  },
  pos_counter_sales: {
    name: 'পিওএস কাউন্টার বিক্রয় ও শিফট রসিদ',
    description: 'টার্মিনাল অনুযায়ী বিক্রয়, কাউন্টার ক্যাশ ক্লোজিং এবং পেমেন্ট মেথড বিভাজন।',
  },
  sales_return: {
    name: 'বিক্রয় ফেরত ও ক্রেডিট নোট',
    description: 'গ্রাহকের ফেরত দেওয়া পণ্য, ক্রেডিট নোট সমন্বয় এবং ফেরতের কারণ।',
  },

  // ── PROFITABILITY ──
  invoice_profit: {
    name: 'চালানভিত্তিক মোট মুনাফা',
    description: 'বিক্রয়মূল্য বনাম কস্ট অব গুডস সোল্ড (COGS) এর ভিত্তিতে চালানভিত্তিক নিট মার্জিন।',
  },
  product_profit: {
    name: 'পণ্যভিত্তিক মার্জিন ও মুনাফা %',
    description: 'প্রতিটি এসকেইউ-এর একক উৎপাদন খরচ, বিক্রয়মূল্য ও গ্রস মার্জিনের হার।',
  },
  salesman_profitability: {
    name: 'বিক্রয়কর্মীদের মুনাফা অবদান',
    description: 'ডিসকাউন্টের পর প্রতিটি বিক্রয়কর্মীর অর্জিত প্রকৃত গ্রস মুনাফা।',
  },
  daily_profit: {
    name: 'দৈনিক গ্রস প্রফিট খতিয়ান',
    description: 'প্রতিদিনের অর্জিত রাজস্ব থেকে প্রত্যক্ষ উপাদান ও মজুরি খরচ বাদ দিয়ে মুনাফা।',
  },
  monthly_profit: {
    name: 'মাসিক লাভ ও ক্ষতি সারাংশ',
    description: 'অপারেশনাল ব্যয় ও কর সমন্বয়ের পূর্বে অর্জিত মোট লাভজনকতা বিবরণী।',
  },

  // ── CRM & LEADS ──
  lead_summary: {
    name: 'সিআরএম লিড পাইপলাইন সারাংশ',
    description: 'লিড স্ট্যাটাস, সম্ভাব্য রাজস্ব মান এবং পাইপলাইন পর্যায় ট্র্যাকিং।',
  },
  salesman_leads: {
    name: 'বিক্রয়কর্মী লিড বণ্টন ও কাজের চাপ',
    description: 'কর্মীপ্রতি বরাদ্দকৃত লিড সংখ্যা, ফলো-আপ স্ট্যাটাস ও সাড়ার গতি।',
  },
  lead_status_distribution: {
    name: 'লিড স্ট্যাটাস ও পর্যায় বণ্টন',
    description: 'নতুন, কোয়ালিফাইড, প্রস্তাবিত ও নেগোশিয়েশন পর্যায়ের লিড বণ্টন পাইচার্ট।',
  },
  fake_leads_audit: {
    name: 'ভুয়া লিড যাচাই ও অডিট লগ',
    description: 'সিস্টেমে ইনপুটকৃত ভুয়া বা ডুপ্লিকেট লিডের সুরক্ষা অডিট ও ফ্ল্যাগিং।',
  },
  converted_leads: {
    name: 'সফল রূপান্তর ও ডিল ভ্যালু',
    description: 'বিক্রয়ে রূপান্তরিত লিডসমূহ, চুক্তি মূল্য এবং রূপান্তরের মোট সময়কাল।',
  },
  conversion_rate_source: {
    name: 'উৎস ও চ্যানেলভিত্তিক রূপান্তর হার',
    description: 'ওয়েবসাইট, ফোন কল, সোশ্যাল মিডিয়া বা সরাসরি লিডের বিক্রয় রূপান্তর হার।',
  },
  lost_leads_analysis: {
    name: 'হাতছাড়া লিড ও বাতিলের কারণ',
    description: 'ব্যর্থ হওয়া লিডসমূহ, প্রতিযোগীদের প্রভাব ও গ্রাহকের মূল অনাগ্রহের কারণ।',
  },

  // ── SALESMEN TARGETS ──
  salesman_quota_achievement: {
    name: 'বিক্রয়কর্মীদের কোটা অর্জন ট্র্যাকিং',
    description: 'মাসিক বিক্রয় লক্ষ্য বনাম প্রকৃত বিক্রয় এবং অর্জনের শতকরা হার।',
  },
  salesman_remaining_target: {
    name: 'বাকি লক্ষ্যমাত্রা ও পূর্বাভাস',
    description: 'মাসের বাকি দিনগুলিতে কোটা পূরণের জন্য প্রয়োজনীয় দৈনিক লক্ষ্য।',
  },
  salesman_profit_contribution: {
    name: 'বিক্রয়কর্মীদের নিট মুনাফা অবদান',
    description: 'ডিসকাউন্ট কাটার পর কোম্পানির কোষাগারে যোগ হওয়া প্রকৃত মুনাফা।',
  },
  salesman_incentive_accrual: {
    name: 'বিক্রয় প্রণোদনা ও কমিশন সঞ্চিতি',
    description: 'টার্গেট অর্জনের ওপর ভিত্তি করে অর্জিত কমিশন ও ইনসেনটিভের হিসাব।',
  },
  salesman_leaderboard: {
    name: 'শীর্ষ বিক্রয়কর্মী লিডারবোর্ড',
    description: 'সর্বোচ্চ রাজস্ব এবং কোটা পূরণের ভিত্তিতে বিক্রয়কর্মীদের র‍্যাংকিং।',
  },

  // ── DELIVERY & LOGISTICS ──
  pending_deliveries: {
    name: 'অপেক্ষমাণ ডেলিভারি ও পার্সেল চালান',
    description: 'প্যাকিং সম্পন্ন কিন্তু এখনও কুরিয়ার বা গ্রাহকের কাছে না পৌঁছানো অর্ডারের তালিকা।',
  },
  delivered_orders: {
    name: 'সফল ডেলিভারি ও রসিদ হিসেব',
    description: 'সফলভাবে পৌঁছে যাওয়া পার্সেল, গ্রাহকের স্বাক্ষর ও পেমেন্ট নিশ্চিতকরণ।',
  },
  returned_orders: {
    name: 'ফেরত পার্সেল (RTO) বিশ্লেষণ',
    description: 'গ্রাহক গ্রহণ না করা পার্সেল, ফেরত আসার কারণ ও অতিরিক্ত কুরিয়ার চার্জ।',
  },
  cancelled_deliveries: {
    name: 'বাতিলকৃত ডেলিভারি ও চালান',
    description: 'চালান তৈরির পর বাতিল হওয়া অর্ডার এবং গুদামে পণ্য ফেরত আসার স্থিতি।',
  },
  courier_performance: {
    name: 'কুরিয়ার পার্টনার এসএলএ ও বিশ্লেষণ',
    description: 'পাঠাও, স্টিডফাস্ট ইত্যাদি কুরিয়ারের সফল ডেলিভারির হার ও সময়কাল।',
  },
  cod_reconciliation: {
    name: 'সিওডি (ক্যাশ অন ডেলিভারি) সমন্বয়',
    description: 'কুরিয়ারের কাছ থেকে প্রাপ্ত নগদ টাকার সাথে অর্ডারের মূল্য সমন্বয়।',
  },
  delivery_sla_history: {
    name: 'ডেলিভারি এসএলএ ও ট্রানজিট সময়',
    description: 'অর্ডার প্যাকেজিং থেকে শুরু করে চূড়ান্ত ডেলিভারি পর্যন্ত অতিবাহিত মোট ঘণ্টা।',
  },

  // ── HR & PAYROLL ──
  employee_directory: {
    name: 'কর্মচারী ডিরেক্টরি ও বিভাগীয় বণ্টন',
    description: 'সকল সক্রিয় কর্মচারীদের পদবি, বিভাগ, যোগদান তারিখ ও যোগাযোগের তথ্য।',
  },
  daily_attendance: {
    name: 'দৈনিক ও মাসিক বায়োমেট্রিক উপস্থিতি',
    description: 'কর্মীদের ইন-টাইম, আউট-টাইম, বিলম্ব ও ছুটির বিস্তারিত লগ।',
  },
  worker_piece_rate_summary: {
    name: 'শ্রমিক পিস-রেট মজুরি সারাংশ',
    description: 'কারখানার কারিগরদের উৎপাদিত একক অনুযায়ী প্রদেয় মোট সাপ্তাহিক/মাসিক মজুরি।',
  },
  payroll_summary: {
    name: 'বিতরণকৃত পেরোল রেজিস্টার ও নিট পে',
    description: 'কর্মচারীদের মূল বেতন, বোনাস, কর্তন এবং বিতরণযোগ্য নিট বেতনের হিসাব।',
  },
  sales_commission_payout: {
    name: 'বিক্রয় কমিশন পরিশোধ বিবরণী',
    description: 'বিক্রয়কর্মীদের অনুমোদিত ও প্রদানকৃত মাসিক কমিশন ভাউচার।',
  },

  // ── FINANCE & ACCOUNTS ──
  gl_summary: {
    name: 'সাধারণ খতিয়ান ও ট্রায়াল ব্যালেন্স',
    description: 'হিসাবখাত অনুযায়ী মোট ডেবিট, ক্রেডিট এবং চলতি ব্যালেন্স।',
  },
  income_statement: {
    name: 'আয় ও লাভ/ক্ষতি বিবরণী (P&L)',
    description: 'মোট রাজস্ব, প্রত্যক্ষ উৎপাদন ব্যয়, পরিচালন ব্যয় এবং নিট লাভের খতিয়ান।',
  },
  operating_expenses: {
    name: 'পরিচালন ব্যয় ও অপেক্স বিশ্লেষণ',
    description: 'ভাড়া, ইউটিলিটি, রক্ষণাবেক্ষণ ও প্রশাসনিক ব্যয়ের বিস্তারিত বিবরণী।',
  },
  customer_ar_aging: {
    name: 'গ্রাহক বকেয়া বার্ধক্য বিশ্লেষণ (AR Aging)',
    description: '৩০, ৬০, ৯০ এবং ৯০+ দিনের বকেয়া প্রাপ্য টাকার বিস্তারিত তালিকা।',
  },
  supplier_ap_aging: {
    name: 'সরবরাহকারী প্রদেয় বার্ধক্য বিশ্লেষণ (AP Aging)',
    description: 'ভেন্ডরদের পরিশোধযোগ্য বকেয়ার মেয়াদ ও অগ্রাধিকার তালিকা।',
  },
  cash_bank_ledger: {
    name: 'নগদ ও ব্যাংক হিসাবের খতিয়ান',
    description: 'কোম্পানির সকল ব্যাংক অ্যাকাউন্ট, পেটি ক্যাশ ও মোবাইল ওয়ালেটের ব্যালেন্স।',
  },
  payment_method_summary: {
    name: 'পেমেন্ট মেথড টেন্ডার সারাংশ',
    description: 'ক্যাশ, পিওএস কার্ড, ব্যাংক ইএফটি, বিকাশ ও নগদ মারফত প্রাপ্ত টাকার সারসংক্ষেপ।',
  },

  // ── FIXED ASSETS ──
  fixed_asset_register: {
    name: 'স্থায়ী সম্পদ রেজিস্টার ও ইনভেন্টরি',
    description: 'যন্ত্রপাতি, যানবাহন ও আসবাবপত্রের ক্রয়মূল্য, অবচয় এবং বর্তমান মান।',
  },
  asset_valuation_nbv: {
    name: 'সম্পদ অবচয় ও নিট বুক ভ্যালু (NBV)',
    description: 'ক্রমপুঞ্জিত অবচয় এবং আর্থিক প্রতিবেদনে প্রদর্শিত সম্পদের বর্তমান নিট মূল্য।',
  },
  assigned_assets: {
    name: 'লাইন ও কর্মচারীভিত্তিক সম্পদ বরাদ্দ',
    description: 'নির্দিষ্ট প্রোডাকশন লাইন, ড্রাইভার ও সুপারভাইজারদের হস্তান্তরকৃত মেশিনারিজ।',
  },
  asset_maintenance_log: {
    name: 'যন্ত্রপাতি রক্ষণাবেক্ষণ ও মেরামত হিসেব',
    description: 'নিয়মিত সার্ভিসিং, ব্রেকডাউন মেরামত ও খুচরা যন্ত্রাংশ প্রতিস্থাপনের খরচ।',
  },
  asset_disposal_history: {
    name: 'সম্পদ নিষ্পত্তি, অপচয় ও রাইট-অফ হিসেব',
    description: 'বাতিলকৃত সরঞ্জাম, স্ক্র্যাপ বিক্রয় থেকে পুনরুদ্ধারকৃত মূল্য ও অবলোপন।',
  },

  // ── QC & AUDIT ──
  qc_inspection_ratio: {
    name: 'কিউসি পরিদর্শন পাস/ফেল অনুপাত',
    description: 'লট পরিদর্শনে গৃহীত ও প্রত্যাখ্যাত পণ্যের AQL ২.৫ শতকরা হার।',
  },
  defect_categorization: {
    name: 'ত্রুটি শ্রেণীকরণ (সংকটজনক/প্রধান/গৌণ)',
    description: 'সেলাই, ফেব্রিক, ফিনিশিং বা প্যাকেজিং ত্রুটির মূল কারণ বিশ্লেষণ।',
  },
  compliance_audit_trail: {
    name: 'কমপ্লায়েন্স ও নিরাপত্তা অডিট ট্রেইল',
    description: 'অপারেশনাল পরিবর্তন, মূল্য সংশোধন ও নীতি লঙ্ঘনের নিরাপত্তা লগ।',
  },
};

/**
 * Returns localized name for report definition.
 */
export function getLocalizedReportName(code: string, fallbackName?: string, isBn?: boolean): string {
  if (isBn && REPORT_BN_TRANSLATIONS[code]?.name) {
    return REPORT_BN_TRANSLATIONS[code].name;
  }
  return fallbackName || '';
}

/**
 * Returns localized description for report definition.
 */
export function getLocalizedReportDesc(code: string, fallbackDesc?: string, isBn?: boolean): string {
  if (isBn && REPORT_BN_TRANSLATIONS[code]?.description) {
    return REPORT_BN_TRANSLATIONS[code].description;
  }
  return fallbackDesc || '';
}

/**
 * Returns localized module name.
 */
export function getLocalizedModuleName(modId: string, fallback: string, isBn: boolean): string {
  const trans = MODULE_TRANSLATIONS[modId];
  if (!trans) return fallback;
  return isBn ? trans.bn.name : trans.en.name;
}

/**
 * Returns localized module short name.
 */
export function getLocalizedModuleShortName(modId: string, fallback: string, isBn: boolean): string {
  const trans = MODULE_TRANSLATIONS[modId];
  if (!trans) return fallback;
  return isBn ? trans.bn.shortName : trans.en.shortName;
}

/**
 * Returns localized category label.
 */
export function getLocalizedCategoryLabel(catId: string | undefined, fallback: string, isBn: boolean): string {
  if (!catId) return fallback || '';
  const trans = CATEGORY_TRANSLATIONS[catId];
  if (!trans) return fallback;
  return isBn ? trans.bn : trans.en;
}

/**
 * Returns localized preset label.
 */
export function getLocalizedPresetLabel(presetId: string | undefined, fallback: string, isBn: boolean): string {
  if (!presetId) return fallback || '';
  const trans = PRESET_TRANSLATIONS[presetId];
  if (!trans) return fallback;
  return isBn ? trans.bn : trans.en;
}
