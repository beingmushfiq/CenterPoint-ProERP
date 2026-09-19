// ═══════════════════════════════════════════════════════════════════════════
// BENGALI LOCALE (bn) — LTR                            API_CONTRACT.md §8 · UI
// ───────────────────────────────────────────────────────────────────────────
// Bengali ships with 100% parity across all namespaces in standard business Bengali.
// Bengali is LEFT-TO-RIGHT (LTR). No RTL direction is used.
// ═══════════════════════════════════════════════════════════════════════════

import type en from './en';

const errors = {
  UNAUTHENTICATED: 'চালিয়ে যেতে অনুগ্রহ করে সাইন ইন করুন।',
  TOKEN_EXPIRED: 'আপনার সেশনটি নতুন করে যাচাই করা প্রয়োজন।',
  TOKEN_REVOKED: 'এই সেশনটি শেষ হয়েছে। আবার সাইন ইন করুন।',
  REFRESH_REUSED: 'নিরাপত্তার স্বার্থে এই সেশনটি শেষ করা হয়েছে। আবার সাইন ইন করুন।',
  MFA_REQUIRED: 'চালিয়ে যেতে অতিরিক্ত যাচাই প্রয়োজন।',
  ACCOUNT_LOCKED: 'এই অ্যাকাউন্টটি সাময়িকভাবে লক করা আছে। পরে চেষ্টা করুন।',
  ACCOUNT_INACTIVE: 'এই অ্যাকাউন্টটি নিষ্ক্রিয়। আপনার প্রশাসকের সাথে যোগাযোগ করুন।',
  TENANT_INACTIVE: 'এই কর্মক্ষেত্রটি সক্রিয় নয়। আপনার প্রশাসকের সাথে যোগাযোগ করুন।',

  FORBIDDEN: 'এটি করার অনুমতি আপনার নেই।',
  OUT_OF_SCOPE: 'এটি আপনার নির্ধারিত শাখার বাইরে। চালিয়ে যেতে স্কোপ পরিবর্তন করুন।',
  TENANT_MISMATCH: 'এই আইটেমটি অন্য একটি কর্মক্ষেত্রের।',
  PLATFORM_ONLY: 'এই কাজটি শুধুমাত্র প্ল্যাটফর্ম প্রশাসকদের জন্য সীমাবদ্ধ।',

  NOT_FOUND: 'আপনি যা খুঁজছেন তা আমরা খুঁজে পাইনি।',
  ROUTE_NOT_FOUND: 'এই পৃষ্ঠাটি নেই।',
  RESOURCE_GONE: 'এই আইটেমটি আর উপলব্ধ নেই।',

  VALIDATION_FAILED: 'অনুগ্রহ করে চিহ্নিত ঘরগুলো ঠিক করুন।',
  BUSINESS_RULE_VIOLATED: 'এই কাজটি একটি ব্যবসায়িক নিয়ম ভঙ্গ করে এবং সম্পন্ন করা যাবে না।',
  INSUFFICIENT_STOCK: 'এটি সম্পন্ন করার মতো যথেষ্ট স্টক নেই।',
  PRODUCTION_CONTEXT_INCOMPLETE: 'কিছু উৎপাদন তথ্য অনুপস্থিত।',
  QC_REQUIRED: 'এটি এগিয়ে নেওয়ার আগে একটি মান পরীক্ষা প্রয়োজন।',
  CREDIT_LIMIT_EXCEEDED: 'এটি গ্রাহকের ক্রেডিট সীমা অতিক্রম করে।',
  PRICE_STALE: 'দাম পরিবর্তিত হয়েছে। পর্যালোচনা করে আবার চেষ্টা করুন।',
  PERIOD_CLOSED: 'এই হিসাবকালটি বন্ধ।',
  SEQUENCE_EXHAUSTED: 'নম্বর ক্রম শেষ হয়ে গেছে। আপনার প্রশাসকের সাথে যোগাযোগ করুন।',
  UNSUPPORTED_CAPABILITY: 'এই সুবিধাটি আপনার প্ল্যানে নেই।',
  INVALID_FILE: 'এই ফাইলটি ব্যবহার করা যাবে না। ফরম্যাট যাচাই করে আবার চেষ্টা করুন।',
  IMPORT_FAILED: 'ইমপোর্ট সম্পন্ন করা যায়নি। ফাইলটি পর্যালোচনা করে আবার চেষ্টা করুন।',

  INVALID_STATE: 'আইটেমটির বর্তমান অবস্থায় এটি করা যাবে না।',
  DUPLICATE: 'এটি ইতিমধ্যে বিদ্যমান।',
  IDEMPOTENT_KEY_CONFLICT: 'এই অনুরোধটি ইতিমধ্যে প্রক্রিয়া করা হয়েছে।',
  VERSION_CONFLICT: 'আপনি সম্পাদনা করার সময় অন্য কেউ এটি পরিবর্তন করেছেন।',
  LOCKED: 'এই আইটেমটি অন্য একটি কাজের দ্বারা লক করা আছে।',
  IN_USE: 'এটি ব্যবহৃত হচ্ছে এবং পরিবর্তন করা যাবে না।',

  PAYLOAD_TOO_LARGE: 'পাঠানোর জন্য এটি অনেক বড়।',
  IDEMPOTENCY_KEY_REQUIRED: 'এই অনুরোধে একটি নিরাপত্তা কী নেই। আবার চেষ্টা করুন।',
  PRECONDITION_REQUIRED: 'সংরক্ষণের আগে এই আইটেমটি পুনরায় লোড করতে হবে।',
  RATE_LIMITED: 'অনেক বেশি অনুরোধ। একটু অপেক্ষা করুন।',

  INTERNAL_ERROR: 'আমাদের দিক থেকে কিছু একটা সমস্যা হয়েছে।',
  NOT_IMPLEMENTED: 'এটি এখনও উপলব্ধ নয়।',
  UPSTREAM_FAILED: 'আমরা সার্ভারে পৌঁছাতে পারিনি।',
  SERVICE_UNAVAILABLE: 'পরিষেবাটি সাময়িকভাবে অনুপলব্ধ।',
  UPSTREAM_TIMEOUT: 'সার্ভার সাড়া দিতে অনেক সময় নিয়েছে।',

  NETWORK_OFFLINE: 'আপনি অফলাইনে আছেন। পুনরায় সংযুক্ত হলে এটি আবার কাজ করবে।',
  REQUEST_TIMEOUT: 'এই অনুরোধটি সম্পন্ন হতে অনেক সময় নিয়েছে।',
  REQUEST_CANCELLED: 'অনুরোধ বাতিল করা হয়েছে।',
  MALFORMED_RESPONSE: 'সার্ভার এমন একটি সাড়া দিয়েছে যা আমরা পড়তে পারিনি।',
} satisfies (typeof en)['errors'];

const common = {
  appName: 'স্লাইস মার্ট',
  tagline: 'কারখানা, ইনভেন্টরি ও ব্যবসা ব্যবস্থাপনা',

  action: {
    save: 'সংরক্ষণ',
    cancel: 'বাতিল',
    close: 'বন্ধ',
    confirm: 'নিশ্চিত করুন',
    retry: 'আবার চেষ্টা করুন',
    signIn: 'সাইন ইন',
    signOut: 'সাইন আউট',
    search: 'অনুসন্ধান',
    export: 'এক্সপোর্ট',
    filter: 'ফিল্টার',
    columns: 'কলামসমূহ',
    view: 'দেখুন',
    details: 'বিস্তারিত',
    all: 'সকল',
    clear: 'মুছুন',
    refresh: 'রিফ্রেশ',
    print: 'প্রিন্ট',
    download: 'ডাউনলোড',
  },

  status: {
    active: 'সক্রিয়',
    inactive: 'নিষ্ক্রিয়',
    pending: 'অপেক্ষমাণ',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    in_progress: 'চলমান',
    draft: 'খসড়া',
    approved: 'অনুমোদিত',
    rejected: 'প্রত্যাখ্যাত',
    paid: 'পরিশোধিত',
    unpaid: 'অপরিশোধিত',
    partially_paid: 'আংশিক পরিশোধিত',
  },

  state: {
    loading: 'লোড হচ্ছে…',
    empty: 'এখানে এখনও কিছু নেই।',
    error: 'কিছু একটা সমস্যা হয়েছে।',
  },

  nav: {
    dashboard: 'ড্যাশবোর্ড',
    settings: 'সেটিংস',
  },

  theme: {
    label: 'থিম',
    light: 'আলো',
    dark: 'অন্ধকার',
    system: 'সিস্টেম',
  },

  language: {
    label: 'ভাষা',
    en: 'English',
    bn: 'বাংলা',
  },

  density: {
    label: 'ঘনত্ব',
    compact: 'সংক্ষিপ্ত',
    comfortable: 'স্বচ্ছন্দ',
  },

  table: {
    showing: 'প্রদর্শন',
    to: 'থেকে',
    of: 'এর মধ্যে',
    results: 'ফলাফল',
    page: 'পৃষ্ঠা',
    noData: 'কোনো তথ্য পাওয়া যায়নি',
  },

  reference: 'রেফারেন্স',
} satisfies (typeof en)['common'];

const auth = {
  signInTitle: 'সাইন ইন',
  signInSubtitle: 'আবার স্বাগতম। চালিয়ে যেতে আপনার তথ্য দিন।',

  emailLabel: 'ইমেইল',
  emailPlaceholder: 'you@company.com',
  passwordLabel: 'পাসওয়ার্ড',
  passwordPlaceholder: 'আপনার পাসওয়ার্ড',
  rememberDevice: 'এই ডিভাইসটি মনে রাখুন',

  signInButton: 'সাইন ইন',
  signingIn: 'সাইন ইন হচ্ছে…',
  forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',

  invalidCredentials: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',

  selectTenantTitle: 'একটি কর্মক্ষেত্র বেছে নিন',
  selectTenantSubtitle: 'আপনার অ্যাকাউন্টের একাধিক কর্মক্ষেত্রে অ্যাক্সেস রয়েছে।',
  continue: 'চালিয়ে যান',

  signedOut: 'আপনি সাইন আউট হয়েছেন।',
  sessionExpiredTitle: 'সেশন শেষ হয়েছে',
  sessionExpiredBody:
    'আপনার সেশন শেষ হয়েছে। যেখানে ছিলেন সেখান থেকে চালিয়ে যেতে আবার সাইন ইন করুন।',

  validation: {
    emailRequired: 'আপনার ইমেইল দিন।',
    emailInvalid: 'একটি বৈধ ইমেইল ঠিকানা দিন।',
    passwordRequired: 'আপনার পাসওয়ার্ড দিন।',
  },
} satisfies (typeof en)['auth'];

const navigation = {
  sections: {
    overview: 'ওভারভিউ ও মনিটরিং',
    crm: 'সিআরএম ও গ্রাহক পাইপলাইন',
    sales: 'বিক্রয় ও বাণিজ্যিক',
    supply: 'ইনভেন্টরি ও সরবরাহ',
    production: 'উৎপাদন ও মান নিয়ন্ত্রণ',
    finance: 'অর্থ ও হিসাবরক্ষণ',
    hr: 'কর্মী ও মানবসম্পদ',
    system: 'সিস্টেম ও বুদ্ধিমত্তা',
  },
  items: {
    dashboard: 'নির্বাহী ড্যাশবোর্ড',
    reports: 'ব্যবসায়িক প্রতিবেদন ও বিশ্লেষণ',
    crmLeads: 'গ্রাহক লিড ও সিআরএম',
    sales: 'বিক্রয় ও ইনভয়েস',
    pos: 'পয়েন্ট অব সেল (POS)',
    ecommerce: 'অনলাইন স্টোর সিএমএস',
    coupons: 'কুপন ও প্রমো কোড',
    catalogue: 'পণ্য ক্যাটালগ ও ফর্মুলা',
    purchasing: 'ক্রয় ও সংগ্রহ',
    inventory: 'গুদাম ও মজুদ স্টক',
    delivery: 'ডেলিভারি ও কুরিয়ার',
    production: 'উৎপাদন লাইন',
    qc: 'মান নিয়ন্ত্রণ (QC)',
    finance: 'অর্থ ও হিসাবরক্ষণ',
    assets: 'সম্পদ ব্যবস্থাপনা',
    hr: 'কর্মী ও মানবসম্পদ',
    users: 'কর্মকর্তা ও ব্যবহারকারী অ্যাকাউন্ট',
    roles: 'পদবি ও অনুমতি নিয়ন্ত্রণ',
    audit: 'অডিট ট্রেইল ও পরিবর্তন লগ',
    bin: 'রিসাইকেল বিন ও পুনরুদ্ধার',
    workflows: 'অটোমেশন ফ্লো',
    settings: 'সিস্টেম সেটিংস',
  },
  badges: {
    fast: 'দ্রুত',
    live: 'সরাসরি',
    promo: 'অফার',
  },
  systemTour: 'সিস্টেম পরিচিতি',
  collapseSidebar: 'সাইডবার সংকুচিত করুন',
  expandSidebar: 'সাইডবার প্রসারিত করুন',
  operatingBranch: 'পরিচালনা শাখা',
  quickAdd: 'দ্রুত কাজ',
} satisfies (typeof en)['navigation'];

const reports = {
  title: 'ব্যবসায়িক প্রতিবেদন ও বিশ্লেষণ',
  subtitle: 'প্রাতিষ্ঠানিক পরিচালন তথ্য, নিরীক্ষা লগ ও ব্যবসায়িক বুদ্ধিমত্তা',
  searchPlaceholder: 'নাম, কোড বা বিবরণ দিয়ে প্রতিবেদন খুঁজুন…',
  allCategories: 'সকল বিভাগ',
  allModules: 'সকল মডিউল',
  runReport: 'প্রতিবেদন তৈরি করুন',
  refreshData: 'তথ্য রিফ্রেশ করুন',
  exportData: 'ডেটা এক্সপোর্ট করুন',
  printReport: 'প্রতিবেদন প্রিন্ট করুন',
  printPreview: 'প্রিন্ট প্রিভিউ',
  columns: 'কলামসমূহ',
  filters: 'ফিল্টারসমূহ',
  applyFilters: 'ফিল্টার প্রয়োগ করুন',
  resetFilters: 'ফিল্টার রিসেট করুন',
  dateRange: 'তারিখের পরিসীমা',
  startDate: 'শুরুর তারিখ',
  endDate: 'শেষের তারিখ',
  status: 'অবস্থা',
  warehouse: 'গুদাম',
  customer: 'গ্রাহক',
  supplier: 'সরবরাহকারী',
  salesman: 'বিক্রয়কর্মী',
  tier: {
    live: 'সরাসরি রিয়েল-টাইম',
    near_real_time: 'প্রায় রিয়েল-টাইম',
    batch_daily: 'দৈনিক স্ন্যাপশট',
  },
  freshness: {
    label: 'তথ্যের হালনাগাদ স্থিতি',
    asOf: 'সময়: {{time}}',
    stale: 'তথ্যটি পুরনো হতে পারে। রিফ্রেশ বাটনে ক্লিক করুন।',
  },
  empty: {
    title: 'কোনো তথ্য পাওয়া যায়নি',
    description: 'বর্তমান ফিল্টার বা তারিখ অনুযায়ী কোনো রেকর্ড খুঁজে পাওয়া যায়নি।',
    action: 'ফিল্টার মুছুন',
  },
  summary: {
    totalRecords: 'মোট রেকর্ড',
    totalAmount: 'মোট মূল্যমান',
    totalQty: 'মোট পরিমাণ',
    average: 'গড় মান',
  },
  export: {
    title: 'এক্সপোর্ট অপশন',
    csv: 'সিএসভি ডাউনলোড করুন',
    xlsx: 'এক্সেল (.xlsx) ডাউনলোড করুন',
    pdf: 'পিডিএফ ডাউনলোড করুন',
    generating: 'ফাইল তৈরি হচ্ছে…',
    success: 'ফাইল সফলভাবে তৈরি হয়েছে',
  },
  savedViews: {
    title: 'সংরক্ষিত ভিউ',
    saveCurrent: 'বর্তমান ভিউ সংরক্ষণ করুন',
    viewName: 'ভিউয়ের নাম',
    save: 'ভিউ সংরক্ষণ',
    delete: 'ভিউ মুছুন',
  },
  table: {
    showing: 'প্রদর্শন {{from}} থেকে {{to}}, মোট {{total}} টির মধ্যে',
    page: 'পৃষ্ঠা {{page}} / {{pages}}',
    prev: 'পূর্ববর্তী',
    next: 'পরবর্তী',
    noColumns: 'প্রদর্শনের জন্য কোনো কলাম নির্বাচন করা হয়নি',
  },
} satisfies (typeof en)['reports'];

const dashboard = {
  title: 'অপারেশনস ড্যাশবোর্ড',
  subtitle: 'নির্বাহী কেপিআই, কারখানার পারফরম্যান্স ও লাইভ পর্যবেক্ষণ',
  kpi: {
    grossRevenue: 'মোট রাজস্ব আয়',
    netProfit: 'পরিচালন মুনাফা',
    ordersToday: 'আজকের প্রক্রিয়াকৃত অর্ডার',
    productionBatches: 'সক্রিয় উৎপাদন ব্যাচ',
    stockAlerts: 'জরুরি স্বল্প স্টকের আইটেম',
    qcPassRate: 'কিউসি একিউএল পাসের হার',
    receivables: 'বকেয়া পাওনা (হিসাব)',
    codInTransit: 'কুরিয়ারে থাকা সিওডি টাকা',
  },
  charts: {
    revenueTrends: 'রাজস্ব ও বিক্রয়ের গতিধারা',
    productionOutput: 'লক্ষ্যমাত্রা বনাম বাস্তব উৎপাদন',
    inventoryBreakdown: 'ক্যাটাগরি অনুযায়ী মজুদ পণ্যের মূল্য',
    leadPipeline: 'বিক্রয় পাইপলাইন ও কনভার্সন',
  },
  timeRange: {
    today: 'আজ',
    yesterday: 'গতকাল',
    thisWeek: 'চলতি সপ্তাহ',
    thisMonth: 'চলতি মাস',
    lastMonth: 'গত মাস',
    thisQuarter: 'চলতি প্রান্তিক',
    thisYear: 'চলতি অর্থবছর',
    custom: 'কাস্টম সময়কাল',
  },
} satisfies (typeof en)['dashboard'];

const validation = {
  required: 'এই ঘরটি পূরণ করা আবশ্যক।',
  invalidEmail: 'একটি সঠিক ইমেইল ঠিকানা লিখুন।',
  minLength: 'কমপক্ষে {{count}} টি অক্ষর হতে হবে।',
  maxLength: '{{count}} অক্ষরের বেশি হওয়া যাবে না।',
  invalidNumber: 'একটি সঠিক সংখ্যা লিখুন।',
  positiveNumber: 'মান অবশ্যই শূন্যের বেশি হতে হবে।',
  invalidDate: 'একটি সঠিক তারিখ নির্বাচন করুন।',
  dateOrder: 'শেষের তারিখ অবশ্যই শুরুর তারিখের পরবর্তী হতে হবে।',
} satisfies (typeof en)['validation'];

const notifications = {
  title: 'বিজ্ঞপ্তি',
  empty: 'নতুন কোনো বিজ্ঞপ্তি নেই।',
  markAllRead: 'সবগুলো পঠিত চিহ্নিত করুন',
  clearAll: 'সব মুছে ফেলুন',
  types: {
    stockAlert: 'স্বল্প স্টকের সতর্কতা',
    productionUpdate: 'উৎপাদনের অগ্রগতি বার্তা',
    qcFlag: 'গুণমান পরিদর্শন নোটিশ',
    orderReceived: 'নতুন অমনিচ্যানেল অর্ডার',
    paymentDue: 'ইনভয়েস বিল পরিশোধের তাগিদ',
  },
} satisfies (typeof en)['notifications'];

const printing = {
  documentTitle: 'অফিসিয়াল প্রতিবেদন দলিল',
  confidentialNotice: 'গোপনীয় — শুধুমাত্র অনুমোদিত অভ্যন্তরীণ ব্যবহারের জন্য',
  generatedAt: 'তৈরির তারিখ',
  generatedBy: 'তৈরি করেছেন',
  page: 'পৃষ্ঠা',
  of: 'এর মধ্যে',
  orientation: {
    portrait: 'পোর্ট্রেট (উল্লম্ব)',
    landscape: 'ল্যান্ডস্কেপ (অনুভূমিক)',
  },
  paperSize: {
    a4: 'এ৪ (A4)',
    letter: 'লেটার (Letter)',
    legal: 'লিগ্যাল (Legal)',
  },
  signatures: {
    preparedBy: 'প্রস্তুতকারী',
    verifiedBy: 'যাচাইকারী',
    authorizedBy: 'অনুমোদনকারী স্বাক্ষর',
  },
  print: 'এখনই প্রিন্ট করুন',
  close: 'উইন্ডো বন্ধ করুন',
} satisfies (typeof en)['printing'];

export default {
  common,
  auth,
  errors,
  navigation,
  reports,
  dashboard,
  validation,
  notifications,
  printing,
};
