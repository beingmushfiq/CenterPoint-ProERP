import {
  Boxes,
  Building2,
  ClipboardList,
  Coins,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  Microscope,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  Zap,
  Ticket,
  FileText,
  Receipt,
  Undo2,
  TrendingUp,
  ArrowLeftRight,
  Tag,
  Target,
  Award,
  Scale,
  Ruler,
  ClipboardCheck,
  AlertTriangle,
  PackageCheck,
  Wrench,
  Clock,
  TrendingDown,
  Cpu,
  Landmark,
  BookOpen,
  Calculator,
  Wallet,
  DollarSign,
  CalendarCheck,
  Palette,
  Globe,
  Banknote,
  Bell,
  Sparkles,
  Layers,
  Compass,
  Upload,
  Plus,
} from 'lucide-react';

export interface DynamicNavItem {
  id: string;
  moduleKey?: string;
  labelKey?: string;
  defaultLabel: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission?: string | string[];
  badge?: string;
  badgeTone?: 'primary' | 'success' | 'amber' | 'neutral';
  hiddenInSidebar?: boolean;
  children?: DynamicNavItem[];
  group?: string;
  label?: string;
}

export interface DynamicNavSection {
  id: string;
  title: string;
  items: DynamicNavItem[];
}

export interface NavOrderConfig {
  sections?: string[];
  items?: Record<string, string[]>;
}

/**
 * Canonical platform navigation registry ordered according to standard enterprise
 * industrial workflow:
 * 1. Overview & Monitoring (Dashboard & BI)
 * 2. CRM & Sales Force (Demand Generation — Leads, Salesmen, Targets, Incentives)
 * 3. Sales & Commercials (Omnichannel B2B/Retail Orders, POS & Web Storefront)
 * 4. Inventory & Supply (Master Catalogue, Procurement POs, Stock Ledgers & Logistics)
 * 5. Production & Quality (Factory Batch Routing & Mandatory QC Gate)
 * 6. Finance & Accounts (General Ledger, Due & Collections, Assets & Maintenance)
 * 7. Workforce & HR (Employees, Attendance, Piece-Rate Performance & Payroll)
 * 8. Intelligence & System (RBAC, Audit Logs & Settings Center)
 */
export const PLATFORM_NAV_DEFINITIONS: DynamicNavSection[] = [
  // ── 1. Overview & Monitoring ─────────────────────────────────────────────
  {
    id: 'overview',
    title: 'Overview & Monitoring',
    items: [
      {
        id: 'dashboard',
        defaultLabel: 'Executive Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'reports',
        moduleKey: 'reports',
        defaultLabel: 'Business Reports & Analytics',
        to: '/reports',
        icon: FileSpreadsheet,
        permission: [
          'reports.report.view',
          'reports.dashboard.view',
          'reports.analytics.view',
          'reports.definition.view',
        ],
      },
    ],
  },

  // ── 2. CRM & Sales Force ─────────────────────────────────────────────────
  {
    id: 'crm',
    title: 'CRM & Customer Pipeline',
    items: [
      {
        id: 'crm-leads',
        moduleKey: 'crm',
        defaultLabel: 'Customer Leads & CRM',
        to: '/crm',
        icon: UserCheck,
        permission: ['sales.lead.view', 'crm.lead.view', 'sales.order.view'],
        children: [
          // Cluster 1: Commercial Pipeline
          {
            id: 'crm-all',
            defaultLabel: 'All Leads Registry',
            to: '/crm?tab=all',
            icon: UserCheck,
            group: 'Commercial Pipeline',
          },
          {
            id: 'crm-my',
            defaultLabel: 'My Assigned Leads',
            to: '/crm?tab=my',
            icon: UserCheck,
            group: 'Commercial Pipeline',
          },

          // Cluster 2: Lead Governance & SLA
          {
            id: 'crm-stale',
            defaultLabel: 'Stale Leads Recovery',
            to: '/crm?tab=stale',
            icon: Clock,
            group: 'Lead Governance & SLA',
          },
          {
            id: 'crm-audit',
            defaultLabel: 'Fake Lead Audit Gate',
            to: '/crm?tab=audit',
            icon: ShieldCheck,
            group: 'Lead Governance & SLA',
          },

          // Cluster 3: Customer Accounts
          {
            id: 'crm-customers',
            defaultLabel: 'Customer Directory',
            to: '/sales?tab=customers',
            icon: Users,
            group: 'Customer Accounts',
          },
          {
            id: 'crm-pricelists',
            defaultLabel: 'Customer Price Lists',
            to: '/sales?tab=pricelists',
            icon: Tag,
            group: 'Customer Accounts',
          },

          // Cluster 4: Pipeline Settings & Modals
          {
            id: 'crm-stages-modal',
            defaultLabel: 'Lead Stages Modal',
            to: '/crm?modal=stages',
            icon: Layers,
            group: 'Pipeline Settings & Modals',
          },
          {
            id: 'crm-sources-modal',
            defaultLabel: 'Lead Sources Modal',
            to: '/crm?modal=sources',
            icon: Compass,
            group: 'Pipeline Settings & Modals',
          },
          {
            id: 'crm-import-modal',
            defaultLabel: 'Import Leads Data',
            to: '/crm?modal=import',
            icon: Upload,
            group: 'Pipeline Settings & Modals',
          },
          {
            id: 'crm-add-modal',
            defaultLabel: 'Add New Lead',
            to: '/crm?modal=add',
            icon: Plus,
            group: 'Pipeline Settings & Modals',
          },
        ],
      },
    ],
  },

  // ── 3. Sales & Commercials ───────────────────────────────────────────────
  {
    id: 'sales',
    title: 'Sales & Commercials',
    items: [
      {
        id: 'sales',
        moduleKey: 'sales',
        defaultLabel: 'Sales & Invoices',
        to: '/sales',
        icon: ShoppingBag,
        permission: [
          'sales.order.view',
          'sales.invoice.view',
          'sales.return.view',
        ],
        children: [
          // Cluster 1: Order to Cash / Commercial Operations
          {
            id: 'sales-orders',
            defaultLabel: 'Sales Orders',
            to: '/sales?tab=orders',
            icon: ShoppingCart,
            badgeTone: 'primary',
            group: 'Order to Cash',
          },
          {
            id: 'sales-invoices',
            defaultLabel: 'Invoices & Billing',
            to: '/sales?tab=invoices',
            icon: FileText,
            group: 'Order to Cash',
          },
          {
            id: 'sales-deliveries',
            defaultLabel: 'Deliveries & Dispatch',
            to: '/sales?tab=deliveries',
            icon: Truck,
            group: 'Order to Cash',
          },
          {
            id: 'sales-payments',
            defaultLabel: 'Payments & Receipts',
            to: '/sales?tab=payments',
            icon: Receipt,
            badgeTone: 'success',
            group: 'Order to Cash',
          },
          {
            id: 'sales-returns',
            defaultLabel: 'Customer Returns & Refunds',
            to: '/sales?tab=returns',
            icon: Undo2,
            group: 'Order to Cash',
          },
          {
            id: 'sales-exchanges',
            defaultLabel: 'Product Exchanges',
            to: '/sales?tab=exchanges',
            icon: ArrowLeftRight,
            group: 'Order to Cash',
          },

          // Cluster 2: Customer Leads & CRM
          {
            id: 'sales-leads',
            defaultLabel: 'Customer Leads',
            to: '/sales?tab=leads',
            icon: UserCheck,
            group: 'Customer Leads & CRM',
          },
          {
            id: 'sales-customers',
            defaultLabel: 'Customer Directory',
            to: '/sales?tab=customers',
            icon: Users,
            group: 'Customer Leads & CRM',
          },
          {
            id: 'sales-pricelists',
            defaultLabel: 'Customer Price Lists',
            to: '/sales?tab=pricelists',
            icon: Tag,
            group: 'Customer Leads & CRM',
          },

          // Cluster 3: Sales Team & Commissions
          {
            id: 'sales-salesmen',
            defaultLabel: 'Sales Representatives',
            to: '/sales?tab=salesmen',
            icon: UserCheck,
            group: 'Sales Team & Commissions',
          },
          {
            id: 'sales-targets',
            defaultLabel: 'Monthly Targets',
            to: '/sales?tab=targets',
            icon: Target,
            group: 'Sales Team & Commissions',
          },
          {
            id: 'sales-incentives',
            defaultLabel: 'Commissions & Bonuses',
            to: '/sales?tab=incentives',
            icon: Award,
            group: 'Sales Team & Commissions',
          },
          {
            id: 'sales-dashboard',
            defaultLabel: 'Rep Performance Dashboard',
            to: '/sales?tab=dashboard',
            icon: TrendingUp,
            group: 'Sales Team & Commissions',
          },
        ],
      },
      {
        id: 'pos',
        moduleKey: 'pos',
        defaultLabel: 'Point of Sale (POS)',
        to: '/pos',
        icon: ShoppingCart,
        permission: ['pos.terminal.view', 'pos.session.view', 'pos.sale.create'],
        badge: 'Fast',
        badgeTone: 'primary',
      },
      {
        id: 'ecommerce',
        moduleKey: 'ecommerce',
        defaultLabel: 'Online Store CMS',
        to: '/storefront',
        icon: Store,
        permission: ['ecommerce.storefront.view', 'ecommerce.storefront.manage'],
        badge: 'Live',
        badgeTone: 'success',
        children: [
          {
            id: 'store-branding',
            defaultLabel: 'Theme & Branding',
            to: '/storefront?tab=branding',
            icon: Palette,
            group: 'Store Appearance',
          },
          {
            id: 'store-header',
            defaultLabel: 'Header Navigation',
            to: '/storefront?tab=header',
            icon: LayoutDashboard,
            group: 'Store Appearance',
          },
          {
            id: 'store-footer',
            defaultLabel: 'Footer Policies',
            to: '/storefront?tab=footer',
            icon: FileText,
            group: 'Store Appearance',
          },
          {
            id: 'store-products',
            defaultLabel: 'Featured Products',
            to: '/storefront?tab=products',
            icon: ShoppingBag,
            group: 'Commerce & Conversion',
          },
          {
            id: 'store-checkout',
            defaultLabel: 'Checkout Rules',
            to: '/storefront?tab=checkout',
            icon: ShoppingCart,
            group: 'Commerce & Conversion',
          },
          {
            id: 'store-coupons',
            defaultLabel: 'Coupons & Promo Codes',
            to: '/storefront?tab=coupons',
            icon: Ticket,
            group: 'Commerce & Conversion',
          },
          {
            id: 'store-domains',
            defaultLabel: 'Custom Domains & SSL',
            to: '/storefront?tab=domains',
            icon: Globe,
            group: 'Commerce & Conversion',
          },
        ],
      },
      {
        id: 'coupons',
        moduleKey: 'ecommerce',
        defaultLabel: 'Coupons & Promo Codes',
        to: '/storefront?tab=coupons',
        icon: Ticket,
        permission: ['ecommerce.storefront.view', 'sales.order.view'],
        badge: 'Promo',
        badgeTone: 'primary',
        hiddenInSidebar: true,
      },
    ],
  },

  // ── 4. Inventory & Supply ────────────────────────────────────────────────
  {
    id: 'supply',
    title: 'Inventory & Supply',
    items: [
      {
        id: 'catalogue',
        moduleKey: 'inventory',
        labelKey: 'catalogue',
        defaultLabel: 'Product Catalog & Recipes',
        to: '/catalogue',
        icon: Boxes,
        permission: [
          'catalog.product.view',
          'catalog.unit.view',
          'catalog.category.view',
          'catalog.brand.view',
          'catalog.bom.view',
          'catalog.party.view',
          'inventory.warehouse.view',
        ],
        children: [
          {
            id: 'cat-products',
            defaultLabel: 'Product Directory',
            to: '/catalogue?tab=products',
            icon: Boxes,
            group: 'Master Catalog',
          },
          {
            id: 'cat-categories',
            defaultLabel: 'Categories',
            to: '/catalogue?tab=categories',
            icon: Tag,
            group: 'Master Catalog',
          },
          {
            id: 'cat-brands',
            defaultLabel: 'Brand Master',
            to: '/catalogue?tab=brands',
            icon: Award,
            group: 'Master Catalog',
          },
          {
            id: 'cat-units',
            defaultLabel: 'Units of Measure',
            to: '/catalogue?tab=units',
            icon: Ruler,
            group: 'Master Catalog',
          },
          {
            id: 'cat-boms',
            defaultLabel: 'Recipes & BOMs',
            to: '/catalogue?tab=bom',
            icon: Factory,
            group: 'Engineering & BOM',
          },
          {
            id: 'cat-warehouses',
            defaultLabel: 'Warehouses & Bins',
            to: '/catalogue?tab=warehouses',
            icon: Warehouse,
            group: 'Directories & Locations',
          },
          {
            id: 'cat-parties',
            defaultLabel: 'Parties & Contacts',
            to: '/catalogue?tab=parties',
            icon: Users,
            group: 'Directories & Locations',
          },
        ],
      },
      {
        id: 'purchasing',
        moduleKey: 'purchasing',
        defaultLabel: 'Purchasing & Sourcing',
        to: '/purchasing',
        icon: ClipboardList,
        permission: [
          'purchasing.order.view',
          'purchasing.requisition.view',
          'purchasing.grn.view',
          'purchasing.bill.view',
          'purchasing.return.view',
        ],
        children: [
          {
            id: 'pur-requisitions',
            defaultLabel: 'Purchase Requisitions',
            to: '/purchasing?tab=requisitions',
            icon: FileText,
            group: 'Procurement Requests',
          },
          {
            id: 'pur-orders',
            defaultLabel: 'Purchase Orders',
            to: '/purchasing?tab=orders',
            icon: ClipboardList,
            group: 'Procurement Requests',
          },
          {
            id: 'pur-grn',
            defaultLabel: 'Goods Receipt (GRN)',
            to: '/purchasing?tab=grn',
            icon: PackageCheck,
            group: 'Receipts & Vendor Bills',
          },
          {
            id: 'pur-bills',
            defaultLabel: 'Vendor Invoices & Bills',
            to: '/purchasing?tab=bills',
            icon: Receipt,
            group: 'Receipts & Vendor Bills',
          },
          {
            id: 'pur-returns',
            defaultLabel: 'Purchase Returns',
            to: '/purchasing?tab=returns',
            icon: Undo2,
            group: 'Receipts & Vendor Bills',
          },
        ],
      },
      {
        id: 'inventory',
        moduleKey: 'inventory',
        labelKey: 'warehouse',
        defaultLabel: 'Warehouse & Stock',
        to: '/inventory',
        icon: Warehouse,
        permission: [
          'inventory.stock.view',
          'inventory.warehouse.view',
          'inventory.movement.view',
          'inventory.transfer.view',
          'inventory.count.view',
        ],
        children: [
          {
            id: 'inv-ledger',
            defaultLabel: 'Stock Ledger & Balances',
            to: '/inventory?tab=ledger',
            icon: Warehouse,
            group: 'Stock Balances',
          },
          {
            id: 'inv-thresholds',
            defaultLabel: 'Reorder Thresholds',
            to: '/inventory?tab=thresholds',
            icon: AlertTriangle,
            group: 'Stock Balances',
          },
          {
            id: 'inv-transfers',
            defaultLabel: 'Warehouse Transfers',
            to: '/inventory?tab=transfers',
            icon: ArrowLeftRight,
            group: 'Warehouse Operations',
          },
          {
            id: 'inv-adjustments',
            defaultLabel: 'Stock Adjustments',
            to: '/inventory?tab=adjustments',
            icon: Scale,
            group: 'Warehouse Operations',
          },
          {
            id: 'inv-counts',
            defaultLabel: 'Physical Stock Count',
            to: '/inventory?tab=counts',
            icon: ClipboardCheck,
            group: 'Warehouse Operations',
          },
        ],
      },
      {
        id: 'delivery',
        moduleKey: 'delivery',
        defaultLabel: 'Delivery & Couriers',
        to: '/logistics',
        icon: Truck,
        permission: [
          'logistics.delivery_order.view',
          'logistics.run_sheet.view',
          'logistics.shipment.view',
          'logistics.cod.view',
        ],
        children: [
          {
            id: 'del-shipments',
            defaultLabel: 'Courier Shipments',
            to: '/logistics?tab=shipments',
            icon: Truck,
            group: 'Dispatch & Riders',
          },
          {
            id: 'del-runsheets',
            defaultLabel: 'Rider Run Sheets',
            to: '/logistics?tab=run_sheets',
            icon: FileText,
            group: 'Dispatch & Riders',
          },
          {
            id: 'del-providers',
            defaultLabel: '3PL Courier Gateways',
            to: '/logistics?tab=providers',
            icon: Building2,
            group: 'Gateways & COD',
          },
          {
            id: 'del-cod',
            defaultLabel: 'COD Settlements',
            to: '/logistics?tab=cod_reconciliation',
            icon: Banknote,
            group: 'Gateways & COD',
          },
        ],
      },
    ],
  },

  // ── 5. Production & Quality ──────────────────────────────────────────────
  {
    id: 'production',
    title: 'Production & Quality',
    items: [
      {
        id: 'production',
        moduleKey: 'production',
        labelKey: 'production',
        defaultLabel: 'Production Lines',
        to: '/production',
        icon: Factory,
        permission: ['production.batch.view', 'production.plan.view', 'production.worker_entry.view'],
        children: [
          {
            id: 'prod-plans',
            defaultLabel: 'Production Plans',
            to: '/production?tab=plans',
            icon: FileSpreadsheet,
            group: 'Planning & Batches',
          },
          {
            id: 'prod-batches',
            defaultLabel: 'Batch Work Orders',
            to: '/production?tab=batches',
            icon: Factory,
            group: 'Planning & Batches',
          },
          {
            id: 'prod-kiosk',
            defaultLabel: 'Shop Floor Kiosk',
            to: '/production?tab=kiosk',
            icon: LayoutDashboard,
            group: 'Shop Floor Execution',
          },
          {
            id: 'prod-timesheets',
            defaultLabel: 'Worker Run Sheets',
            to: '/production?tab=timesheets',
            icon: Users,
            group: 'Shop Floor Execution',
          },
        ],
      },
      {
        id: 'qc',
        moduleKey: 'qc',
        defaultLabel: 'Quality Control (QC)',
        to: '/qc',
        icon: Microscope,
        permission: ['qc.inspection.view', 'qc.parameter.view', 'qc.wastage.view'],
        children: [
          {
            id: 'qc-inspections',
            defaultLabel: 'Batch Inspections',
            to: '/qc?tab=inspections',
            icon: Microscope,
            group: 'Quality Inspections',
          },
          {
            id: 'qc-parameters',
            defaultLabel: 'Test Parameters',
            to: '/qc?tab=parameters',
            icon: Tag,
            group: 'Quality Inspections',
          },
          {
            id: 'qc-wastage',
            defaultLabel: 'Scrap & Defect Records',
            to: '/qc?tab=wastage',
            icon: AlertTriangle,
            group: 'Scrap & Loss Control',
          },
        ],
      },
    ],
  },

  // ── 6. Finance & Accounts ────────────────────────────────────────────────
  {
    id: 'finance',
    title: 'Finance & Accounts',
    items: [
      {
        id: 'finance',
        moduleKey: 'finance',
        defaultLabel: 'Finance & Accounts',
        to: '/finance',
        icon: Coins,
        permission: [
          'finance.account.view',
          'finance.journal.view',
          'finance.expense.view',
          'finance.bank.view',
          'finance.costing.view',
        ],
        children: [
          {
            id: 'fin-banking',
            defaultLabel: 'Bank & Cash Ledgers',
            to: '/finance?tab=banking',
            icon: Landmark,
            group: 'Daily Cash & Operations',
          },
          {
            id: 'fin-expenses',
            defaultLabel: 'Expense Categorization',
            to: '/finance?tab=expenses',
            icon: Receipt,
            group: 'Daily Cash & Operations',
          },
          {
            id: 'fin-due',
            defaultLabel: 'Customer Due Collections',
            to: '/finance?tab=due-collection',
            icon: Coins,
            group: 'Daily Cash & Operations',
          },
          {
            id: 'fin-statements',
            defaultLabel: 'Financial Statements (P&L)',
            to: '/finance?tab=statements',
            icon: TrendingUp,
            group: 'Reports & General Ledger',
          },
          {
            id: 'fin-journal',
            defaultLabel: 'Journal Entries (GL)',
            to: '/finance?tab=journal',
            icon: BookOpen,
            group: 'Reports & General Ledger',
          },
          {
            id: 'fin-coa',
            defaultLabel: 'Chart of Accounts (COA)',
            to: '/finance?tab=coa',
            icon: FileSpreadsheet,
            group: 'Reports & General Ledger',
          },
          {
            id: 'fin-costing',
            defaultLabel: 'Batch Costing Sheets',
            to: '/finance?tab=costing',
            icon: Calculator,
            group: 'Reports & General Ledger',
          },
        ],
      },
      {
        id: 'assets',
        moduleKey: 'assets',
        defaultLabel: 'Asset Management',
        to: '/assets',
        icon: Building2,
        permission: ['assets.asset.view', 'assets.maintenance.view'],
        children: [
          {
            id: 'ast-machinery',
            defaultLabel: 'Plant & Heavy Machinery',
            to: '/assets?tab=machinery',
            icon: Cpu,
            group: 'Machinery & Maintenance',
          },
          {
            id: 'ast-maintenance',
            defaultLabel: 'Maintenance Work Orders',
            to: '/assets?tab=maintenance',
            icon: Wrench,
            group: 'Machinery & Maintenance',
          },
          {
            id: 'ast-timeline',
            defaultLabel: 'Service History Timeline',
            to: '/assets?tab=timeline',
            icon: Clock,
            group: 'Machinery & Maintenance',
          },
          {
            id: 'ast-register',
            defaultLabel: 'Fixed Asset Register',
            to: '/assets?tab=assets',
            icon: Building2,
            group: 'Fixed Assets & Valuation',
          },
          {
            id: 'ast-depreciation',
            defaultLabel: 'Depreciation Schedules',
            to: '/assets?tab=depreciation',
            icon: TrendingDown,
            group: 'Fixed Assets & Valuation',
          },
          {
            id: 'ast-categories',
            defaultLabel: 'Asset Classifications',
            to: '/assets?tab=categories',
            icon: Tag,
            group: 'Fixed Assets & Valuation',
          },
        ],
      },
    ],
  },

  // ── 7. Workforce & HR ────────────────────────────────────────────────────
  {
    id: 'hr',
    title: 'Team & Workforce',
    items: [
      {
        id: 'hr',
        moduleKey: 'hr',
        defaultLabel: 'Team & Workforce',
        to: '/hr',
        icon: Users,
        permission: [
          'hr.employee.view',
          'hr.attendance.view',
          'hr.payroll.view',
          'production.worker_entry.view',
        ],
        children: [
          {
            id: 'hr-employees',
            defaultLabel: 'Employee Directory',
            to: '/hr?tab=employees',
            icon: Users,
            group: 'People & Staff',
          },
          {
            id: 'hr-attendance',
            defaultLabel: 'Daily Attendance',
            to: '/hr?tab=attendance',
            icon: Clock,
            group: 'People & Staff',
          },
          {
            id: 'hr-leaves',
            defaultLabel: 'Leave Requests',
            to: '/hr?tab=leaves',
            icon: CalendarCheck,
            group: 'People & Staff',
          },
          {
            id: 'hr-departments',
            defaultLabel: 'Departments & Designations',
            to: '/hr?tab=departments',
            icon: Building2,
            group: 'People & Staff',
          },
          {
            id: 'hr-payroll',
            defaultLabel: 'Payroll & Payslips',
            to: '/hr?tab=payroll',
            icon: Wallet,
            group: 'Payroll & Compensation',
          },
          {
            id: 'hr-salary',
            defaultLabel: 'Salary Structures',
            to: '/hr?tab=salary-structures',
            icon: FileSpreadsheet,
            group: 'Payroll & Compensation',
          },
          {
            id: 'hr-advances',
            defaultLabel: 'Salary Advances',
            to: '/hr?tab=advances',
            icon: DollarSign,
            group: 'Payroll & Compensation',
          },
          {
            id: 'hr-performance',
            defaultLabel: 'Worker Piece Rates',
            to: '/hr?tab=performance',
            icon: Award,
            group: 'Payroll & Compensation',
          },
        ],
      },
    ],
  },

  // ── 8. Intelligence & System ─────────────────────────────────────────────
  {
    id: 'system',
    title: 'Intelligence & System',
    items: [
      {
        id: 'users',
        defaultLabel: 'Staff & User Accounts',
        to: '/settings/users',
        icon: Users,
        permission: ['core.user.view', 'core.role.manage', 'core.role.view'],
      },
      {
        id: 'roles',
        defaultLabel: 'Staff Roles & Permissions',
        to: '/settings/roles',
        icon: Shield,
        permission: ['core.role.view', 'core.role.manage', 'core.permission.view'],
      },
      {
        id: 'audit',
        defaultLabel: 'Audit Trail & Change History',
        to: '/activity-logs',
        icon: ShieldCheck,
        permission: ['core.audit_log.view'],
      },
      {
        id: 'bin',
        defaultLabel: 'Data Bin & Recovery',
        to: '/settings/bin',
        icon: Trash2,
        permission: ['core.setting.view', 'core.setting.manage', 'core.audit_log.view'],
      },
      {
        id: 'workflows',
        defaultLabel: 'Flow Automation',
        to: '/settings/workflows',
        icon: Zap,
        permission: ['core.setting.view', 'core.setting.manage'],
      },
      {
        id: 'settings',
        defaultLabel: 'System Settings',
        to: '/settings',
        icon: Settings,
        permission: ['core.setting.view', 'core.setting.manage', 'core.setting.configure'],
        children: [
          // Cluster 1: Core Governance & Security
          {
            id: 'set-general',
            defaultLabel: 'General Configuration',
            to: '/settings?tab=general',
            icon: Settings,
            group: 'Core Governance',
          },
          {
            id: 'set-security',
            defaultLabel: 'Security & Access Control',
            to: '/settings?tab=security',
            icon: ShieldCheck,
            group: 'Core Governance',
          },
          {
            id: 'set-documents',
            defaultLabel: 'Document Templates',
            to: '/settings?tab=documents',
            icon: FileSpreadsheet,
            group: 'Core Governance',
          },

          // Cluster 2: Customization & Automation
          {
            id: 'set-modules',
            defaultLabel: 'ERP Modules Manager',
            to: '/settings?tab=modules',
            icon: Boxes,
            group: 'Customization & Automation',
          },
          {
            id: 'set-workflows',
            defaultLabel: 'Flow Automation',
            to: '/settings/workflows',
            icon: Zap,
            group: 'Customization & Automation',
          },
          {
            id: 'set-terminology',
            defaultLabel: 'Vocabulary & Terminology',
            to: '/settings?tab=terminology',
            icon: Tag,
            group: 'Customization & Automation',
          },
          {
            id: 'set-custom_fields',
            defaultLabel: 'Custom Attributes & Fields',
            to: '/settings?tab=custom_fields',
            icon: Sparkles,
            group: 'Customization & Automation',
          },

          // Cluster 3: Operational Services
          {
            id: 'set-finance',
            defaultLabel: 'Tax & Fiscal Periods',
            to: '/settings?tab=finance',
            icon: Landmark,
            group: 'Operational Services',
          },
          {
            id: 'set-integrations',
            defaultLabel: 'API & Payment Gateways',
            to: '/settings?tab=integrations',
            icon: Zap,
            group: 'Operational Services',
          },
          {
            id: 'set-notifications',
            defaultLabel: 'Alerts & Notifications',
            to: '/settings?tab=notifications',
            icon: Bell,
            group: 'Operational Services',
          },
        ],
      },
    ],
  },
];


/**
 * Returns the canonical default navigation sequence structure.
 */
export function getDefaultNavOrder(): NavOrderConfig {
  return {
    sections: PLATFORM_NAV_DEFINITIONS.map((s) => s.id),
    items: PLATFORM_NAV_DEFINITIONS.reduce((acc, s) => {
      acc[s.id] = s.items.map((i) => i.id);
      return acc;
    }, {} as Record<string, string[]>),
  };
}

/**
 * Builds active navigation sections dynamically, honoring enabled module gates,
 * staff RBAC permissions, customized terminology, and custom section/item re-ordering.
 */
export function buildDynamicNavSections(
  isModuleEnabled: (key: string) => boolean,
  hasPermission: (perm: string | string[]) => boolean,
  getTerm: (key: string, fallback?: string) => string,
  customOrder?: NavOrderConfig | null
): Array<{ id: string; title: string; items: Array<DynamicNavItem & { label: string }> }> {
  // 1. Map canonical definitions into active resolved sections
  const mappedSections = PLATFORM_NAV_DEFINITIONS.map((section) => {
    let activeItems = section.items
      .filter((item) => {
        if (item.hiddenInSidebar) {
          return false;
        }
        if (item.moduleKey && !isModuleEnabled(item.moduleKey)) {
          return false;
        }
        if (item.permission && !hasPermission(item.permission)) {
          return false;
        }
        return true;
      })
      .map((item) => {
        let label = item.defaultLabel;
        if (item.labelKey) {
          label = getTerm(item.labelKey, item.defaultLabel);
        }
        return {
          ...item,
          label,
          ...(item.children
            ? {
                children: item.children.map((child) => ({
                  ...child,
                  label: child.defaultLabel,
                })),
              }
            : {}),
        };
      });

    // Reorder items within section if custom item order is configured
    const customItemOrder = customOrder?.items?.[section.id];
    if (customItemOrder && Array.isArray(customItemOrder) && customItemOrder.length > 0) {
      activeItems = [...activeItems].sort((a, b) => {
        const indexA = customItemOrder.indexOf(a.id);
        const indexB = customItemOrder.indexOf(b.id);
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });
    }

    return {
      id: section.id,
      title: section.title,
      items: activeItems,
    };
  }).filter((section) => section.items.length > 0);

  // 2. Reorder sections if custom section order is configured
  if (customOrder?.sections && Array.isArray(customOrder.sections) && customOrder.sections.length > 0) {
    const sectionOrder = customOrder.sections;
    return [...mappedSections].sort((a, b) => {
      const indexA = sectionOrder.indexOf(a.id);
      const indexB = sectionOrder.indexOf(b.id);
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });
  }

  return mappedSections;
}
