// ═══════════════════════════════════════════════════════════════════════════
// ENGLISH LOCALE (en)                                   API_CONTRACT.md §8 · UI
// ───────────────────────────────────────────────────────────────────────────
// Resources live as typed modules, not `.json`, for compile-checked type safety.
// ═══════════════════════════════════════════════════════════════════════════

import type { ErrorCode } from '../../api/errors';

const errors = {
  /* 401 — the session, not the request */
  UNAUTHENTICATED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session needs refreshing.',
  TOKEN_REVOKED: 'This session was ended. Please sign in again.',
  REFRESH_REUSED: 'For your security, this session was ended. Please sign in again.',
  MFA_REQUIRED: 'Additional verification is required to continue.',
  ACCOUNT_LOCKED: 'This account is temporarily locked. Try again later.',
  ACCOUNT_INACTIVE: 'This account is inactive. Contact your administrator.',
  TENANT_INACTIVE: 'This workspace is not active. Contact your administrator.',

  /* 403 — the record exists, you may not act on it */
  FORBIDDEN: 'You don’t have permission to do this.',
  OUT_OF_SCOPE: 'This is outside your assigned branches. Switch scope to continue.',
  TENANT_MISMATCH: 'This item belongs to a different workspace.',
  PLATFORM_ONLY: 'This action is limited to platform administrators.',

  /* 404 / 410 — absence */
  NOT_FOUND: 'We couldn’t find what you were looking for.',
  ROUTE_NOT_FOUND: 'This page doesn’t exist.',
  RESOURCE_GONE: 'This item is no longer available.',

  /* 422 — understood and refused */
  VALIDATION_FAILED: 'Please correct the highlighted fields.',
  BUSINESS_RULE_VIOLATED: 'This action breaks a business rule and can’t be completed.',
  INSUFFICIENT_STOCK: 'There isn’t enough stock to complete this.',
  PRODUCTION_CONTEXT_INCOMPLETE: 'Some production details are missing.',
  QC_REQUIRED: 'A quality check is required before this can proceed.',
  CREDIT_LIMIT_EXCEEDED: 'This exceeds the customer’s credit limit.',
  PRICE_STALE: 'The price has changed. Review it and try again.',
  PERIOD_CLOSED: 'This accounting period is closed.',
  SEQUENCE_EXHAUSTED: 'The number sequence is exhausted. Contact your administrator.',
  UNSUPPORTED_CAPABILITY: 'This feature isn’t available on your plan.',
  INVALID_FILE: 'This file can’t be used. Check the format and try again.',
  IMPORT_FAILED: 'The import couldn’t be completed. Review the file and try again.',

  /* 409 — conflict */
  INVALID_STATE: 'This can’t be done in the item’s current state.',
  DUPLICATE: 'This already exists.',
  IDEMPOTENT_KEY_CONFLICT: 'This request was already processed.',
  VERSION_CONFLICT: 'Someone else changed this while you were editing.',
  LOCKED: 'This item is locked by another action.',
  IN_USE: 'This is in use and can’t be changed.',

  /* 413 / 428 / 429 — protocol preconditions */
  PAYLOAD_TOO_LARGE: 'This is too large to send.',
  IDEMPOTENCY_KEY_REQUIRED: 'This request is missing a safety key. Try again.',
  PRECONDITION_REQUIRED: 'This item must be reloaded before saving.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',

  /* 5xx — server */
  INTERNAL_ERROR: 'Something went wrong on our side.',
  NOT_IMPLEMENTED: 'This isn’t available yet.',
  UPSTREAM_FAILED: 'We couldn’t reach the server.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  UPSTREAM_TIMEOUT: 'The server took too long to respond.',

  /* client pseudo-codes synthesised by the transport (§8.9) */
  NETWORK_OFFLINE: 'You’re offline. This will work again once you reconnect.',
  REQUEST_TIMEOUT: 'This request took too long to complete.',
  REQUEST_CANCELLED: 'Request cancelled.',
  MALFORMED_RESPONSE: 'The server returned a response we couldn’t read.',
} satisfies Record<ErrorCode, string>;

const common = {
  appName: 'Slice Mart',
  tagline: 'Factory, inventory & business management',

  action: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    retry: 'Try again',
    signIn: 'Sign in',
    signOut: 'Sign out',
    search: 'Search',
    export: 'Export',
    filter: 'Filter',
    columns: 'Columns',
    view: 'View',
    details: 'Details',
    all: 'All',
    clear: 'Clear',
    refresh: 'Refresh',
    print: 'Print',
    download: 'Download',
  },

  status: {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    in_progress: 'In Progress',
    draft: 'Draft',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partially_paid: 'Partially Paid',
  },

  state: {
    loading: 'Loading…',
    empty: 'Nothing here yet.',
    error: 'Something went wrong.',
  },

  nav: {
    dashboard: 'Dashboard',
    settings: 'Settings',
  },

  theme: {
    label: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },

  language: {
    label: 'Language',
    en: 'English',
    bn: 'বাংলা',
  },

  density: {
    label: 'Density',
    compact: 'Compact',
    comfortable: 'Comfortable',
  },

  table: {
    showing: 'Showing',
    to: 'to',
    of: 'of',
    results: 'results',
    page: 'Page',
    noData: 'No records found',
  },

  /* §7 — the id support searches on. Always shown, never hidden. */
  reference: 'Reference',
};

const auth = {
  signInTitle: 'Sign in',
  signInSubtitle: 'Welcome back. Enter your details to continue.',

  emailLabel: 'Email',
  emailPlaceholder: 'you@company.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Your password',
  rememberDevice: 'Remember this device',

  signInButton: 'Sign in',
  signingIn: 'Signing in…',
  forgotPassword: 'Forgot password?',

  invalidCredentials: 'The email or password is incorrect.',

  selectTenantTitle: 'Choose a workspace',
  selectTenantSubtitle: 'Your account has access to more than one workspace.',
  continue: 'Continue',

  signedOut: 'You’ve been signed out.',
  sessionExpiredTitle: 'Session expired',
  sessionExpiredBody: 'Your session ended. Sign in again to continue where you left off.',

  validation: {
    emailRequired: 'Enter your email.',
    emailInvalid: 'Enter a valid email address.',
    passwordRequired: 'Enter your password.',
  },
};

const navigation = {
  sections: {
    overview: 'Overview & Monitoring',
    crm: 'CRM & Customer Pipeline',
    sales: 'Sales & Commercials',
    supply: 'Inventory & Supply',
    production: 'Production & Quality',
    finance: 'Finance & Accounts',
    hr: 'Team & Workforce',
    system: 'Intelligence & System',
  },
  items: {
    dashboard: 'Executive Dashboard',
    reports: 'Business Reports & Analytics',
    crmLeads: 'Customer Leads & CRM',
    sales: 'Sales & Invoices',
    pos: 'Point of Sale (POS)',
    ecommerce: 'Online Store CMS',
    coupons: 'Coupons & Promo Codes',
    catalogue: 'Product Catalog & Recipes',
    purchasing: 'Purchasing & Sourcing',
    inventory: 'Warehouse & Stock',
    delivery: 'Delivery & Couriers',
    production: 'Production Lines',
    qc: 'Quality Control (QC)',
    finance: 'Finance & Accounts',
    assets: 'Asset Management',
    hr: 'Team & Workforce',
    users: 'Staff & User Accounts',
    roles: 'Staff Roles & Permissions',
    audit: 'Audit Trail & Change History',
    bin: 'Data Bin & Recovery',
    workflows: 'Flow Automation',
    settings: 'System Settings',
  },
  badges: {
    fast: 'Fast',
    live: 'Live',
    promo: 'Promo',
  },
  systemTour: 'System Tour',
  collapseSidebar: 'Collapse sidebar',
  expandSidebar: 'Expand sidebar',
  operatingBranch: 'Operating Branch',
  quickAdd: 'Quick Action',
};

const reports = {
  title: 'Business Reports & Analytics',
  subtitle: 'Enterprise operational telemetry, audit logs & business intelligence',
  searchPlaceholder: 'Search reports by name, code, or description…',
  allCategories: 'All Categories',
  allModules: 'All Modules',
  runReport: 'Generate Report',
  refreshData: 'Refresh Data',
  exportData: 'Export Dataset',
  printReport: 'Print Report',
  printPreview: 'Print Preview',
  columns: 'Columns',
  filters: 'Filters',
  applyFilters: 'Apply Filters',
  resetFilters: 'Reset Filters',
  dateRange: 'Date Range',
  startDate: 'Start Date',
  endDate: 'End Date',
  status: 'Status',
  warehouse: 'Warehouse',
  customer: 'Customer',
  supplier: 'Supplier',
  salesman: 'Salesman',
  tier: {
    live: 'Live Real-time',
    near_real_time: 'Near Real-time',
    batch_daily: 'Daily Snapshot',
  },
  freshness: {
    label: 'Data Freshness',
    asOf: 'As of {{time}}',
    stale: 'Data may be out of date. Click refresh.',
  },
  empty: {
    title: 'No Data Records Found',
    description: 'No operational records match the current filter criteria or date range.',
    action: 'Clear Filters',
  },
  summary: {
    totalRecords: 'Total Records',
    totalAmount: 'Total Valuation',
    totalQty: 'Total Quantity',
    average: 'Average',
  },
  export: {
    title: 'Export Options',
    csv: 'Download CSV',
    xlsx: 'Download Excel (.xlsx)',
    pdf: 'Download PDF',
    generating: 'Generating export file…',
    success: 'Export generated successfully',
  },
  savedViews: {
    title: 'Saved Views',
    saveCurrent: 'Save Current View',
    viewName: 'View Name',
    save: 'Save View',
    delete: 'Delete View',
  },
  table: {
    showing: 'Showing {{from}} to {{to}} of {{total}} results',
    page: 'Page {{page}} of {{pages}}',
    prev: 'Previous',
    next: 'Next',
    noColumns: 'No columns selected for display',
  },
};

const dashboard = {
  title: 'Operations Dashboard',
  subtitle: 'Executive KPIs, factory performance & real-time monitoring',
  kpi: {
    grossRevenue: 'Gross Revenue',
    netProfit: 'Operating Profit',
    ordersToday: 'Orders Processed Today',
    productionBatches: 'Active Production Batches',
    stockAlerts: 'Critical Low-Stock Items',
    qcPassRate: 'QC AQL Pass Rate',
    receivables: 'Accounts Receivable (Due)',
    codInTransit: 'COD Remittance in Transit',
  },
  charts: {
    revenueTrends: 'Revenue & Sales Trajectory',
    productionOutput: 'Factory Output vs Target',
    inventoryBreakdown: 'Stock Valuation by Category',
    leadPipeline: 'Sales Pipeline & Conversion',
  },
  timeRange: {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisQuarter: 'This Quarter',
    thisYear: 'This Fiscal Year',
    custom: 'Custom Range',
  },
};

const validation = {
  required: 'This field is required.',
  invalidEmail: 'Please enter a valid email address.',
  minLength: 'Must be at least {{count}} characters.',
  maxLength: 'Must not exceed {{count}} characters.',
  invalidNumber: 'Please enter a valid number.',
  positiveNumber: 'Value must be greater than zero.',
  invalidDate: 'Please enter a valid date.',
  dateOrder: 'End date must be after start date.',
};

const notifications = {
  title: 'Notifications',
  empty: 'No unread notifications.',
  markAllRead: 'Mark all as read',
  clearAll: 'Clear all',
  types: {
    stockAlert: 'Low Stock Alert',
    productionUpdate: 'Production Milestone',
    qcFlag: 'Quality Inspection Notice',
    orderReceived: 'New Omnichannel Order',
    paymentDue: 'Invoice Payment Due',
  },
};

const printing = {
  documentTitle: 'Official Report Document',
  confidentialNotice: 'CONFIDENTIAL — FOR INTERNAL AUTHORIZED USE ONLY',
  generatedAt: 'Generated on',
  generatedBy: 'Generated by',
  page: 'Page',
  of: 'of',
  orientation: {
    portrait: 'Portrait',
    landscape: 'Landscape',
  },
  paperSize: {
    a4: 'A4',
    letter: 'Letter',
    legal: 'Legal',
  },
  signatures: {
    preparedBy: 'Prepared By',
    verifiedBy: 'Verified By',
    authorizedBy: 'Authorized Signature',
  },
  print: 'Print Now',
  close: 'Close Window',
};

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
