import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Kanban,
  Boxes,
  ClipboardList,
  Warehouse,
  Truck,
  Factory,
  Microscope,
  Coins,
  DollarSign,
  Building2,
  Users,
  Clock,
  Receipt,
  FileSpreadsheet,
  Shield,
  ShieldCheck,
  Settings,
  Layers,
  Filter,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../../lib/capabilities/tenantCapabilityStore';
import { cn } from '../../../lib/utils';
import { getStorefrontExternalUrl } from '../../../lib/storefront/storefrontUrl';

export type SubsystemDomain =
  'all' | 'commercial' | 'supply' | 'manufacturing' | 'finance' | 'workforce' | 'governance';

interface SubsystemItem {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  domain: SubsystemDomain;
  moduleKey?: string;
  permission?: string | string[];
  pulseMetric?: {
    value: string;
    label: string;
    tone?: 'default' | 'success' | 'warning' | 'info';
  };
  quickActions: Array<{
    label: string;
    to: string;
    icon?: React.ComponentType<{ className?: string }>;
    permission?: string | string[];
    isExternal?: boolean;
  }>;
}

interface DomainSection {
  id: SubsystemDomain;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DOMAIN_SECTIONS: DomainSection[] = [
  {
    id: 'commercial',
    title: 'Commercial & Omnichannel Demand',
    subtitle: 'Sales orders, retail POS cashiers, B2B invoicing, CRM leads & e-commerce',
    icon: ShoppingBag,
  },
  {
    id: 'supply',
    title: 'Supply Chain, SCM & Inventory',
    subtitle: 'Master product catalogue, vendor POs, warehouse stock ledgers & delivery couriers',
    icon: Warehouse,
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing & Quality Assurance',
    subtitle: 'Production routing, batch schedules, worker piece rates & ISO-9001 QC gates',
    icon: Factory,
  },
  {
    id: 'finance',
    title: 'Finance, Treasury & Assets',
    subtitle: 'Accounts general ledger, customer receivables, daily collection & machinery assets',
    icon: Coins,
  },
  {
    id: 'workforce',
    title: 'Workforce & Human Capital',
    subtitle: 'Employee roster, biometric shift attendance, worker efficiency & monthly payroll',
    icon: Users,
  },
  {
    id: 'governance',
    title: 'Governance, Intelligence & Security',
    subtitle: 'RMS BI reports, enterprise RBAC roles, live audit trails & platform settings',
    icon: Shield,
  },
];

const SUBSYSTEM_ITEMS: SubsystemItem[] = [
  // ── Commercial & Demand ──────────────────────────────────────
  {
    id: 'sales-orders',
    title: 'Sales & Invoices',
    description: 'B2B commercial orders, challans, packing slips & payment tracking',
    to: '/sales',
    icon: ShoppingBag,
    domain: 'commercial',
    moduleKey: 'sales',
    permission: ['sales.order.view', 'sales.invoice.view'],
    pulseMetric: { value: '14 Active', label: 'Commercial Orders', tone: 'info' },
    quickActions: [
      { label: 'New Order', to: '/sales?action=new', icon: Plus, permission: 'sales.order.create' },
      { label: 'Invoices', to: '/sales?tab=invoices', permission: 'sales.invoice.view' },
      { label: 'Customers', to: '/sales?tab=customers', permission: 'sales.order.view' },
    ],
  },
  {
    id: 'pos-cashier',
    title: 'Point of Sale (POS)',
    description: 'Fast barcode cashier checkout, cash drawer management & instant receipt printing',
    to: '/pos',
    icon: ShoppingCart,
    domain: 'commercial',
    moduleKey: 'pos',
    permission: ['pos.terminal.view', 'pos.session.view', 'pos.sale.create'],
    pulseMetric: { value: 'Active', label: 'Register #01', tone: 'success' },
    quickActions: [
      { label: 'Open POS Register', to: '/pos', icon: ShoppingCart },
      { label: 'Session History', to: '/pos?tab=history', permission: 'pos.session.view' },
    ],
  },
  {
    id: 'crm-leads',
    title: 'Customer Leads & CRM',
    description: 'Customer pipeline, lead qualification, monthly sales quotas & team commissions',
    to: '/sales?tab=leads',
    icon: Kanban,
    domain: 'commercial',
    moduleKey: 'crm',
    permission: ['sales.lead.view', 'crm.lead.view', 'sales.order.view'],
    pulseMetric: { value: '28 Leads', label: 'In Negotiation', tone: 'default' },
    quickActions: [
      { label: 'Sales Targets', to: '/sales?tab=targets', permission: 'sales.target.view' },
      { label: 'Salesmen Roster', to: '/sales?tab=salesmen', permission: 'hr.employee.view' },
    ],
  },
  {
    id: 'storefront-cms',
    title: 'Storefront CMS & Web Store',
    description: 'Public headless e-commerce store, product banners, collections & web orders',
    to: '/storefront',
    icon: Store,
    domain: 'commercial',
    moduleKey: 'ecommerce',
    permission: ['ecommerce.storefront.view', 'ecommerce.storefront.manage'],
    pulseMetric: { value: 'Online', label: 'Public Web Store', tone: 'success' },
    quickActions: [
      {
        label: 'View Live Store',
        to: '__STOREFRONT_EXTERNAL_URL__', // resolved dynamically in the component
        icon: Globe,
        isExternal: true,
      },
      {
        label: 'Visual Page Builder',
        to: '/storefront/builder',
        permission: 'ecommerce.storefront.manage',
      },
      { label: 'Store Settings', to: '/storefront', permission: 'ecommerce.storefront.manage' },
    ],
  },

  // ── Supply Chain & Inventory ─────────────────────────────────
  {
    id: 'master-catalogue',
    title: 'Product Catalog & Recipes',
    description:
      'Product definitions, variants, raw materials, SKUs, and product recipes (BOM)',
    to: '/catalogue',
    icon: Boxes,
    domain: 'supply',
    moduleKey: 'inventory',
    permission: ['catalog.product.view', 'catalog.category.view', 'catalog.bom.view'],
    pulseMetric: { value: '148 SKUs', label: 'Finished & Raw', tone: 'default' },
    quickActions: [
      {
        label: 'Add Product',
        to: '/catalogue?action=new',
        icon: Plus,
        permission: 'catalog.product.create',
      },
      { label: 'Product Recipes (BOM)', to: '/catalogue?tab=bom', permission: 'catalog.bom.view' },
      { label: 'Categories', to: '/catalogue?tab=categories', permission: 'catalog.category.view' },
    ],
  },
  {
    id: 'inventory-stock',
    title: 'Warehouse & Live Stock',
    description:
      'Multi-warehouse bin levels, internal transfers, low-stock alerts & stock reconciliation',
    to: '/inventory',
    icon: Warehouse,
    domain: 'supply',
    moduleKey: 'inventory',
    permission: ['inventory.stock.view', 'inventory.warehouse.view', 'inventory.movement.view'],
    pulseMetric: { value: '3 Warnings', label: 'Reorder Needed', tone: 'warning' },
    quickActions: [
      {
        label: 'Transfer Stock',
        to: '/inventory?action=transfer',
        icon: Plus,
        permission: 'inventory.transfer.create',
      },
      {
        label: 'Stock Movements',
        to: '/inventory?tab=movements',
        permission: 'inventory.movement.view',
      },
      {
        label: 'Stock Audit Count',
        to: '/inventory?tab=count',
        permission: 'inventory.count.view',
      },
    ],
  },
  {
    id: 'procurement-po',
    title: 'Purchasing & Sourcing',
    description: 'Purchase requisitions, supplier Purchase Orders, goods receipt logs & bill audits',
    to: '/purchasing',
    icon: ClipboardList,
    domain: 'supply',
    moduleKey: 'purchasing',
    permission: ['purchasing.order.view', 'purchasing.requisition.view', 'purchasing.grn.view'],
    pulseMetric: { value: '3 Incoming', label: 'Receipts Expected', tone: 'info' },
    quickActions: [
      {
        label: 'Create PO',
        to: '/purchasing?action=new',
        icon: Plus,
        permission: 'purchasing.order.create',
      },
      {
        label: 'Goods Receipts',
        to: '/purchasing?tab=grn',
        permission: 'purchasing.grn.view',
      },
      {
        label: 'Requisitions',
        to: '/purchasing?tab=requisitions',
        permission: 'purchasing.requisition.view',
      },
    ],
  },
  {
    id: 'logistics-courier',
    title: 'Delivery & Couriers',
    description:
      'Courier integrations (Steadfast, RedX, Pathao), driver delivery runsheets & cash collections',
    to: '/logistics',
    icon: Truck,
    domain: 'supply',
    moduleKey: 'delivery',
    permission: ['logistics.delivery_order.view', 'logistics.run_sheet.view'],
    pulseMetric: { value: '18 Dispatches', label: 'In Transit', tone: 'info' },
    quickActions: [
      {
        label: 'Run Sheets',
        to: '/logistics?tab=run-sheets',
        permission: 'logistics.run_sheet.view',
      },
      { label: 'COD Reconciliation', to: '/logistics?tab=cod', permission: 'logistics.cod.view' },
    ],
  },

  // ── Manufacturing & Quality ──────────────────────────────────
  {
    id: 'factory-production',
    title: 'Production Chain & Scheduling',
    description:
      'Work orders, batch execution, daily line planning, material routing & worker logs',
    to: '/production',
    icon: Factory,
    domain: 'manufacturing',
    moduleKey: 'production',
    permission: ['production.batch.view', 'production.plan.view', 'production.worker_entry.view'],
    pulseMetric: { value: '96% Target', label: 'Floor Run Yield', tone: 'success' },
    quickActions: [
      {
        label: 'Schedule Batch',
        to: '/production?action=new',
        icon: Plus,
        permission: 'production.batch.create',
      },
      {
        label: 'Active Batches',
        to: '/production?tab=batches',
        permission: 'production.batch.view',
      },
      {
        label: 'Shift Roster',
        to: '/production?tab=workers',
        permission: 'production.worker_entry.view',
      },
    ],
  },
  {
    id: 'quality-control',
    title: 'Quality Control (QC Gate)',
    description:
      'Mandatory in-line and post-assembly quality audits, parameter thresholds & defect quarantine',
    to: '/qc',
    icon: Microscope,
    domain: 'manufacturing',
    moduleKey: 'qc',
    permission: ['qc.inspection.view', 'qc.parameter.view', 'qc.wastage.view'],
    pulseMetric: { value: '97.5% Pass', label: 'ISO Standard', tone: 'success' },
    quickActions: [
      {
        label: 'Audit Batch',
        to: '/qc?action=inspect',
        icon: Plus,
        permission: 'qc.inspection.create',
      },
      { label: 'Defect & Wastage', to: '/qc?tab=wastage', permission: 'qc.wastage.view' },
      { label: 'QC Specs', to: '/qc?tab=parameters', permission: 'qc.parameter.view' },
    ],
  },
  // ── Finance & Treasury ───────────────────────────────────────
  {
    id: 'finance-gl',
    title: 'Finance & Chart of Accounts',
    description:
      'General ledger journals, cash accounts, operating expense vouchers & bank reconciliations',
    to: '/finance',
    icon: Coins,
    domain: 'finance',
    moduleKey: 'finance',
    permission: ['finance.account.view', 'finance.journal.view', 'finance.expense.view'],
    pulseMetric: { value: '৳ 75,250', label: "Today's Revenue", tone: 'success' },
    quickActions: [
      {
        label: 'Record Voucher',
        to: '/finance?action=new-journal',
        icon: Plus,
        permission: 'finance.journal.create',
      },
      { label: 'Expense Ledger', to: '/finance?tab=expenses', permission: 'finance.expense.view' },
      {
        label: 'Chart of Accounts',
        to: '/finance?tab=accounts',
        permission: 'finance.account.view',
      },
    ],
  },
  {
    id: 'finance-dues',
    title: 'Due & Collections Ledger',
    description:
      'Customer credit limits, aged receivables breakdown, collection reminders & receipts',
    to: '/finance?tab=due-collection',
    icon: DollarSign,
    domain: 'finance',
    moduleKey: 'finance',
    permission: ['finance.account.view', 'finance.due.view'],
    pulseMetric: { value: '৳ 245,000', label: 'Receivables Due', tone: 'warning' },
    quickActions: [
      { label: 'Aging Report', to: '/finance?tab=due-collection&view=aging' },
      { label: 'Record Payment', to: '/finance?action=receive-payment', icon: Plus },
    ],
  },
  {
    id: 'asset-management',
    title: 'Asset Management',
    description:
      'Capital equipment register, plant machinery health, preventive maintenance work orders & monthly depreciation',
    to: '/assets',
    icon: Building2,
    domain: 'finance',
    moduleKey: 'assets',
    permission: ['assets.asset.view', 'assets.maintenance.view'],
    pulseMetric: { value: '100% Up', label: 'Plant Equipment', tone: 'success' },
    quickActions: [
      {
        label: 'Register Asset',
        to: '/assets?action=new',
        icon: Plus,
        permission: 'assets.asset.create',
      },
      {
        label: 'Log Service Order',
        to: '/assets?tab=maintenance&action=log-service',
        icon: Plus,
        permission: 'assets.maintenance.create',
      },
      { label: 'Work Orders', to: '/assets?tab=maintenance' },
      { label: 'Depreciation Book', to: '/assets?tab=depreciation' },
    ],
  },

  // ── Workforce & Human Capital ────────────────────────────────
  {
    id: 'workforce-roster',
    title: 'Workforce & Employees',
    description:
      'Staff directory, designations, production operator profiles & skill qualifications',
    to: '/hr?tab=employees',
    icon: Users,
    domain: 'workforce',
    moduleKey: 'hr',
    permission: ['hr.employee.view'],
    pulseMetric: { value: '32 Staff', label: 'Active Personnel', tone: 'default' },
    quickActions: [
      {
        label: 'Add Employee',
        to: '/hr?action=new-employee',
        icon: Plus,
        permission: 'hr.employee.create',
      },
      { label: 'Departments', to: '/hr?tab=departments', permission: 'hr.employee.view' },
    ],
  },
  {
    id: 'workforce-shifts',
    title: 'Attendance & Shifts',
    description: 'Daily clock-in verification, shift assignments, biometric sync & leave approvals',
    to: '/hr?tab=attendance',
    icon: Clock,
    domain: 'workforce',
    moduleKey: 'hr',
    permission: ['hr.attendance.view'],
    pulseMetric: { value: '24 Clocked In', label: 'Morning Shift', tone: 'success' },
    quickActions: [
      {
        label: 'Record Attendance',
        to: '/hr?action=record-attendance',
        icon: Plus,
        permission: 'hr.attendance.create',
      },
      { label: 'Shift Roster', to: '/hr?tab=shifts' },
    ],
  },
  {
    id: 'workforce-payroll',
    title: 'Piece-Rate & Monthly Payroll',
    description:
      'Piece-rate calculation for factory operators, salary disbursements & digital payslips',
    to: '/hr?tab=payroll',
    icon: Receipt,
    domain: 'workforce',
    moduleKey: 'hr',
    permission: ['hr.payroll.view', 'hr.payslip.view'],
    pulseMetric: { value: 'Current', label: 'Payroll Cycle', tone: 'info' },
    quickActions: [
      {
        label: 'Worker Performance',
        to: '/hr?tab=performance',
        permission: 'production.worker_entry.view',
      },
      {
        label: 'Generate Payslips',
        to: '/hr?action=generate-payslips',
        icon: Plus,
        permission: 'hr.payroll.create',
      },
    ],
  },

  // ── Governance, Intelligence & Settings ──────────────────────
  {
    id: 'reports-rms',
    title: 'Business Reports & Analytics',
    description:
      'Multi-dimensional business analytics, production yield reports, financial P&L and exportable sheets',
    to: '/reports',
    icon: FileSpreadsheet,
    domain: 'governance',
    moduleKey: 'reports',
    permission: ['reports.report.view', 'reports.dashboard.view', 'reports.analytics.view'],
    pulseMetric: { value: 'Live Reports', label: 'Executive Analytics', tone: 'info' },
    quickActions: [
      { label: 'Production Report', to: '/reports?category=production' },
      { label: 'Sales Reports', to: '/reports?category=sales' },
      { label: 'Financial Summary', to: '/reports?category=finance' },
    ],
  },
  {
    id: 'rbac-roles',
    title: 'Staff Roles & Permissions',
    description: 'Custom staff roles, user access levels, feature permissions & security policies',
    to: '/settings/roles',
    icon: Shield,
    domain: 'governance',
    permission: ['core.role.view', 'core.role.manage'],
    pulseMetric: { value: 'Secure', label: 'Staff Roles Scoped', tone: 'success' },
    quickActions: [
      {
        label: 'New Custom Role',
        to: '/settings/roles?action=new',
        icon: Plus,
        permission: 'core.role.manage',
      },
      { label: 'Permission Catalog', to: '/settings/roles?tab=permissions' },
    ],
  },
  {
    id: 'audit-logs',
    title: 'Audit Trail & Change History',
    description:
      'Audit log of all user actions, record change history & staff sign-in security trail',
    to: '/activity-logs',
    icon: ShieldCheck,
    domain: 'governance',
    permission: ['core.audit_log.view'],
    pulseMetric: { value: 'Real-time', label: 'Security Stream', tone: 'info' },
    quickActions: [
      { label: 'Sign-in Logs', to: '/activity-logs?filter=auth' },
      { label: 'Data Changes', to: '/activity-logs?filter=mutation' },
    ],
  },
  {
    id: 'settings-center',
    title: 'Tenant Settings & Branding',
    description: 'Company profiles, currency, branch management, document layout templates & SEO',
    to: '/settings',
    icon: Settings,
    domain: 'governance',
    permission: ['core.setting.view', 'core.setting.manage'],
    pulseMetric: { value: 'Configured', label: 'Enterprise Ready', tone: 'default' },
    quickActions: [
      { label: 'Company Profile', to: '/settings/company', permission: 'core.setting.manage' },
      { label: 'SEO Config', to: '/settings/seo', permission: 'core.setting.manage' },
    ],
  },
];

export const EnterpriseSystemNavigator: React.FC = () => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isModuleEnabled = useTenantCapabilityStore((state) => state.isModuleEnabled);
  const tenantSubdomain = useAuthStore((state) => state.tenant?.subdomain || state.tenant?.slug || 'store');

  const [selectedDomain, setSelectedDomain] = useState<SubsystemDomain>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter items strictly by role permissions and module flags
  const permittedItems = useMemo(() => {
    return SUBSYSTEM_ITEMS.filter((item) => {
      if (item.moduleKey && !isModuleEnabled(item.moduleKey)) {
        return false;
      }
      if (item.permission && !hasPermission(item.permission)) {
        return false;
      }
      return true;
    });
  }, [hasPermission, isModuleEnabled]);

  // Filter items by domain and search query
  const filteredItems = useMemo(() => {
    let result = permittedItems;

    if (selectedDomain !== 'all') {
      result = result.filter((item) => item.domain === selectedDomain);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.quickActions.some((act) => act.label.toLowerCase().includes(q))
      );
    }

    return result;
  }, [permittedItems, selectedDomain, searchQuery]);

  // Group filtered items by domain
  const groupedSections = useMemo(() => {
    return DOMAIN_SECTIONS.map((section) => {
      const items = filteredItems.filter((item) => item.domain === section.id);
      return {
        ...section,
        items,
      };
    }).filter((section) => section.items.length > 0);
  }, [filteredItems]);

  const domainTabs = useMemo(() => {
    const tabs: Array<{ id: SubsystemDomain; label: string; count: number }> = [
      { id: 'all', label: 'All Subsystems', count: permittedItems.length },
      {
        id: 'commercial',
        label: 'Commercial',
        count: permittedItems.filter((i) => i.domain === 'commercial').length,
      },
      {
        id: 'supply',
        label: 'Supply Chain',
        count: permittedItems.filter((i) => i.domain === 'supply').length,
      },
      {
        id: 'manufacturing',
        label: 'Manufacturing',
        count: permittedItems.filter((i) => i.domain === 'manufacturing').length,
      },
      {
        id: 'finance',
        label: 'Finance & Accounts',
        count: permittedItems.filter((i) => i.domain === 'finance').length,
      },
      {
        id: 'workforce',
        label: 'Workforce & HR',
        count: permittedItems.filter((i) => i.domain === 'workforce').length,
      },
      {
        id: 'governance',
        label: 'Governance & BI',
        count: permittedItems.filter((i) => i.domain === 'governance').length,
      },
    ];
    return tabs.filter((tab) => tab.id === 'all' || tab.count > 0);
  }, [permittedItems]);

  return (
    <section className="rounded-2xl border border-default bg-surface shadow-xs overflow-hidden transition-all">
      {/* ─────────────────────────────────────────────────────────────
          1. COCKPIT HEADER WITH SEARCH & TOGGLE
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-default bg-surface-sunken/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-default font-sans">
                  Enterprise Subsystem Cockpit
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  {permittedItems.length} Permitted Modules
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Navigate any operational wing, workflow or ledger according to your role
                authorization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter subsystems or actions..."
                className="w-full rounded-xl border border-default bg-surface pl-8 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-default"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <span>{isExpanded ? 'Collapse' : 'Expand Matrix'}</span>
            </button>
          </div>
        </div>

        {/* Domain Filter Tabs */}
        {isExpanded && domainTabs.length > 2 && (
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-none pb-0.5">
            {domainTabs.map((tab) => {
              const isSelected = selectedDomain === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedDomain(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
                    isSelected
                      ? 'bg-default text-surface font-bold shadow-xs'
                      : 'text-muted hover:text-default hover:bg-surface-sunken'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-mono',
                      isSelected ? 'bg-surface/20 text-surface' : 'bg-surface-sunken text-muted'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MATRIX BODY (SECTIONS & MODULE CARDS)
      ───────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-6">
          {groupedSections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-default p-8 text-center">
              <Filter className="size-8 text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-default">No matching modules found</p>
              <p className="text-xs text-muted mt-1">
                Try searching for a different term or reset your category filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDomain('all');
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            groupedSections.map((section) => {
              const SectionIcon = section.icon;
              return (
                <div key={section.id} className="space-y-3">
                  {/* Wing Header */}
                  <div className="flex items-center justify-between border-b border-default/70 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-lg bg-surface-sunken text-muted border border-default">
                        <SectionIcon className="size-3.5" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-default">{section.title}</h4>
                      <span className="text-[11px] text-muted hidden sm:inline">
                        • {section.subtitle}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted">
                      {section.items.length} {section.items.length === 1 ? 'module' : 'modules'}
                    </span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="group relative rounded-xl border border-default bg-surface p-3.5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                        >
                          {/* Card Header & Link */}
                          <div>
                            <div className="flex items-start justify-between gap-2.5">
                              <Link
                                to={item.to}
                                className="flex items-center gap-2.5 group-hover:text-primary transition-colors min-w-0"
                              >
                                <div className="flex size-8 items-center justify-center rounded-lg bg-surface-sunken text-default group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0 border border-default/60">
                                  <ItemIcon className="size-4" />
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold text-default group-hover:text-primary transition-colors truncate">
                                    {item.title}
                                  </h5>
                                  <p className="text-[10px] text-muted line-clamp-1 mt-0.5">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>

                              {item.pulseMetric && (
                                <span
                                  className={cn(
                                    'inline-flex flex-col items-end rounded-md px-2 py-0.5 text-[9px] font-bold border shrink-0',
                                    item.pulseMetric.tone === 'success' &&
                                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                    item.pulseMetric.tone === 'warning' &&
                                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                    item.pulseMetric.tone === 'info' &&
                                      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                                    (!item.pulseMetric.tone ||
                                      item.pulseMetric.tone === 'default') &&
                                      'bg-surface-sunken text-default border-default'
                                  )}
                                >
                                  <span className="font-mono">{item.pulseMetric.value}</span>
                                  <span className="text-[8px] opacity-75 font-normal">
                                    {item.pulseMetric.label}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions Shortcuts */}
                          <div className="pt-2 border-t border-default/60 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              {item.quickActions
                                .filter(
                                  (action) => !action.permission || hasPermission(action.permission)
                                )
                                .map((action, idx) => {
                                  const ActionIcon = action.icon;
                                  const targetUrl = action.to === '__STOREFRONT_EXTERNAL_URL__'
                                    ? getStorefrontExternalUrl(tenantSubdomain)
                                    : action.to;
                                  return (
                                  action.isExternal ? (
                                    <a
                                      key={idx}
                                      href={targetUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-[10px] font-medium text-muted hover:text-default hover:bg-surface-sunken/80 transition-colors border border-default/50"
                                    >
                                      {ActionIcon && <ActionIcon className="size-2.5 text-emerald-500" />}
                                      <span>{action.label}</span>
                                      <ExternalLink className="size-2 text-muted" />
                                    </a>
                                  ) : (
                                    <Link
                                      key={idx}
                                      to={targetUrl}
                                      className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-[10px] font-medium text-muted hover:text-default hover:bg-surface-sunken/80 transition-colors border border-default/50"
                                    >
                                      {ActionIcon && <ActionIcon className="size-2.5" />}
                                      <span>{action.label}</span>
                                    </Link>
                                  )
                                  );
                                })}
                            </div>

                            <Link
                              to={item.to}
                              className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                              title={`Open ${item.title} Workspace`}
                            >
                              <span>Open</span>
                              <ArrowRight className="size-2.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
