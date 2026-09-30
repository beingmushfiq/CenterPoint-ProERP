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
      },
      {
        id: 'qc',
        moduleKey: 'qc',
        defaultLabel: 'Quality Control (QC)',
        to: '/qc',
        icon: Microscope,
        permission: ['qc.inspection.view', 'qc.parameter.view', 'qc.wastage.view'],
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
      },
      {
        id: 'assets',
        moduleKey: 'assets',
        defaultLabel: 'Asset Management',
        to: '/assets',
        icon: Building2,
        permission: ['assets.asset.view', 'assets.maintenance.view'],
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
