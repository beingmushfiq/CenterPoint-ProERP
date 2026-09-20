import React from 'react';
import {
  PlugZap,
  ShieldCheck,
  Globe,
  ArrowRight,
  Sparkles,
  Truck,
  Factory,
  Users,
  FileSpreadsheet,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import type { SettingsSchemaDictionary } from '../../../types/api/settings';
import { useTenantBranding, sanitizeTenantBusinessName } from '../../../lib/theme/useTenantBranding';
import { useCurrency } from '../../../hooks/useCurrency';

interface SettingsOverviewHubProps {
  schema: SettingsSchemaDictionary;
  formValues: Record<string, unknown>;
  onSelectGroup: (groupKey: string) => void;
  onOpenOmniSearch: () => void;
}

export const SettingsOverviewHub: React.FC<SettingsOverviewHubProps> = ({
  formValues,
  onSelectGroup,
  onOpenOmniSearch,
}) => {
  const { companyName: tenantBrandName } = useTenantBranding();
  const { currencyCode: activeCurrency, currencySymbol: activeSymbol } = useCurrency();
  const rawCandidate = String(formValues['company_legal_name'] || formValues['company_name'] || '').trim();
  const companyName = sanitizeTenantBusinessName(
    rawCandidate || tenantBrandName,
    tenantBrandName || 'Enterprise Operations'
  );
  const currency = String(formValues['currency_code'] || activeCurrency || 'USD');
  const currencySymbol = String(formValues['currency_symbol'] || activeSymbol || '$');
  const timezone = String(formValues['system_timezone'] || 'Asia/Dhaka');
  const invoicePrefix = String(formValues['invoice_prefix'] || 'INV-');

  const bkashConfigured = Boolean(formValues['bkash_merchant_app_key']);
  const steadfastConfigured = Boolean(formValues['steadfast_api_key']);
  const storefrontLive = formValues['storefront_enabled'] !== false;

  const quickPills = [
    { label: 'Update Invoice / PO Prefixes', group: 'general', icon: FileSpreadsheet },
    { label: 'Configure Payment Gateways (bKash)', group: 'integrations', icon: PlugZap },
    { label: 'Courier Logistics & Dispatch (Steadfast)', group: 'delivery', icon: Truck },
    { label: 'Custom Storefront Domains & SSL', group: 'custom_domains', icon: Globe },
    { label: 'Staff Roles & Access Permissions', group: 'roles', icon: Users },
    { label: 'System Security Audit Trail', group: 'audit_logs', icon: ShieldCheck },
    { label: 'ERP Modules & Navigation Order', group: 'modules', icon: Sparkles },
    { label: 'Factory Production Stages', group: 'production_stages', icon: Factory },
    { label: 'Data Bin & Recovery Vault', group: 'bin', icon: Trash2 },
  ];

  const categoryGroups = [
    {
      name: 'Company & Governance',
      desc: 'Corporate identity, staff RBAC permissions, and immutable security audit logs.',
      items: [
        { key: 'general', title: 'General Profile & Prefixes', desc: 'Legal entity, currency, date formats, document serials' },
        { key: 'roles', title: 'Roles & Staff Permissions', desc: 'Manage RBAC permissions matrix and access control' },
        { key: 'audit_logs', title: 'Security Audit Trail', desc: 'Immutable activity log, delta diffs, and compliance' },
        { key: 'bin', title: 'Data Bin & Recovery Vault', desc: 'Inspect, restore, or permanently purge soft-deleted records across all ERP entities' },
        { key: 'profile', title: 'Workstation & Profile', desc: 'Personal preferences, branch context, and regional locale' },
      ],
    },
    {
      name: 'Architecture & Customization',
      desc: 'Dynamic ERP ecosystem, multi-stage factory routing, and custom document templates.',
      items: [
        { key: 'modules', title: 'ERP Modules & Navigation Order', desc: 'Customize sidebar sequence by workflow and toggle active modules' },
        { key: 'production_stages', title: 'Production Stages', desc: 'Work centers, operational routing, and checklists' },
        { key: 'terminology', title: 'Vocabulary & Terminology', desc: 'Custom labels for garments, food, or electronics' },
        { key: 'custom_fields', title: 'Custom Attributes & Fields', desc: 'Extend products, batches, and orders with custom metadata' },
        { key: 'documents', title: 'Document Templates', desc: 'A4 invoices, delivery challans, and thermal receipts' },
      ],
    },
    {
      name: 'Manufacturing & Stock Control',
      desc: 'Recipe issuance, scrap tolerances, inventory valuation, and equipment maintenance.',
      items: [
        { key: 'production', title: 'Production & Manufacturing', desc: 'Work order scheduling, BOM issue, scrap tolerance' },
        { key: 'inventory', title: 'Stock & Warehousing', desc: 'Valuation method (FIFO/AVCO), safety stock alerts' },
        { key: 'qc', title: 'Quality Control (QC)', desc: 'Inspection AQL standards, defect tolerances, rework rules' },
        { key: 'assets', title: 'Assets & Maintenance', desc: 'Depreciation models and preventive maintenance locking' },
      ],
    },
    {
      name: 'Procurement & Commercial Sales',
      desc: 'Purchase authorizations, credit risk caps, and counter cashier registers.',
      items: [
        { key: 'purchase', title: 'Procurement & Purchases', desc: 'PO approval thresholds, reorder points, 3-way matching' },
        { key: 'sales', title: 'Sales & Commercial', desc: 'Credit limits, payment terms, discount limits' },
        { key: 'pos', title: 'Point of Sale (POS)', desc: 'Register hardware, receipts, manager PIN overrides' },
      ],
    },
    {
      name: 'Storefront & Digital Channels',
      desc: 'Customer e-commerce catalog, domain routing, and organic search optimization.',
      items: [
        { key: 'ecommerce', title: 'E-Commerce Storefront', desc: 'Online checkout rules, basket minimums, WhatsApp orders' },
        { key: 'custom_domains', title: 'Custom Domains & DNS', desc: 'Custom brand domains, DNS challenges, and edge SSL' },
        { key: 'seo', title: 'SEO & Discoverability', desc: 'Rich Schema markup, Google IndexNow, and XML sitemaps' },
      ],
    },
    {
      name: 'Logistics & External Services',
      desc: 'Nationwide 3PL courier integrations, payment gateways, and payroll rules.',
      items: [
        { key: 'delivery', title: 'Delivery & Couriers', desc: 'Steadfast, Pathao, REDX auto-booking and COD rates' },
        { key: 'integrations', title: 'Payment Gateways & SMS', desc: 'bKash, Nagad, SSLCommerz, Greenweb, Twilio SMS' },
        { key: 'hr_payroll', title: 'HR & Payroll Governance', desc: 'Standard work week, overtime rate, salary paydays' },
        { key: 'notifications', title: 'Multi-Channel Alerts', desc: 'In-app, email, and SMS triggers for inventory & orders' },
      ],
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Overview Header */}
      <div className="rounded-2xl border border-default bg-surface p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="primary-subtle" icon={Sparkles}>
                Unified Command Center
              </Badge>
              <span className="text-2xs font-mono text-muted">• Tenant Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-default">
              Platform Configuration Hub
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              Configure system-wide accounting rules, production policies, API gateways, custom storefront domains, and staff permissions from one unified command cockpit.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="md"
              onClick={onOpenOmniSearch}
              className="font-medium"
            >
              <kbd className="mr-2 text-2xs font-mono px-1.5 py-0.5 bg-surface-sunken border border-default rounded text-muted">
                /
              </kbd>
              Instant Omni-Search
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onSelectGroup('general')}
            >
              Configure General
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Quick Diagnostic Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-default">
          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted block">Legal Entity</span>
            <span className="text-xs font-bold text-default truncate block">{companyName}</span>
            <span className="text-2xs text-muted font-mono">{timezone}</span>
          </div>

          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted block">Base Accounting</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-default">{currency} ({currencySymbol})</span>
              <Badge tone="primary-subtle">Active</Badge>
            </div>
            <span className="text-2xs text-muted font-mono">Prefix: {invoicePrefix}XXXX</span>
          </div>

          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted block">Connected Gateways</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-default">
                {bkashConfigured ? 'bKash Live' : 'MFS Sandbox'}
              </span>
              <span className="text-muted">•</span>
              <span className="text-xs text-muted">
                {steadfastConfigured ? 'Steadfast' : 'Logistics Pending'}
              </span>
            </div>
            <span className="text-2xs text-muted">3PL Couriers & MFS</span>
          </div>

          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted block">Storefront Channel</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-default">
                {storefrontLive ? 'Storefront Online' : 'Maintenance Mode'}
              </span>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-2xs text-muted">Web & WhatsApp Order</span>
          </div>
        </div>
      </div>

      {/* Convenience Quick-Jump Bookmarks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Frequently Configured Shortcuts
          </h2>
          <span className="text-2xs text-muted">One-click fast navigation</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {quickPills.map((pill) => {
            const Icon = pill.icon;
            return (
              <button
                key={pill.label}
                onClick={() => onSelectGroup(pill.group)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken hover:border-primary transition-all text-xs font-semibold text-default shadow-2xs group"
              >
                <Icon className="size-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span>{pill.label}</span>
                <ChevronRight className="size-3 text-muted group-hover:text-default group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Categorized Matrix of all Configuration Domains */}
      <div className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          All Governance & Operational Domains
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categoryGroups.map((cat) => (
            <div
              key={cat.name}
              className="p-5 rounded-2xl border border-default bg-surface shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-default">{cat.name}</h3>
                <p className="text-2xs text-muted leading-relaxed">{cat.desc}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-default/60">
                {cat.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => onSelectGroup(item.key)}
                    className="w-full text-left p-2.5 rounded-xl border border-default/40 bg-surface-sunken hover:bg-primary-subtle hover:border-primary/40 transition-colors flex items-center justify-between group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <span className="text-xs font-semibold text-default block truncate group-hover:text-primary">
                        {item.title}
                      </span>
                      <span className="text-2xs text-muted block truncate">
                        {item.desc}
                      </span>
                    </div>
                    <ArrowRight className="size-3.5 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DevCenterPoint Engineering & Platform Architecture Card */}
      <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-default">DevCenterPoint ProERP Platform Engine</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-muted">
                v2.0 Enterprise
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              High-throughput multi-tenant SaaS, manufacturing MRP, headless e-commerce storefronts & logistics automation.
            </p>
          </div>
        </div>

        <a
          href="https://devcenterpoint.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default hover:border-primary text-xs font-semibold text-default transition-colors shadow-2xs group cursor-pointer"
        >
          <span>devcenterpoint.com</span>
          <ChevronRight className="size-3.5 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </a>
      </div>
    </div>
  );
};
