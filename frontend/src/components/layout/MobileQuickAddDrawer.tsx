import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  PlusCircle,
  Search,
  Store,
  FileText,
  PackagePlus,
  UserPlus,
  Factory,
  Boxes,
  ShoppingCart,
  Truck,
  Receipt,
  ShieldCheck,
  ChevronRight,
  Ticket,
  ShoppingBag,
  ClipboardList,
  Warehouse,
  Coins,
  Users,
  UserCheck,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';

interface MobileQuickAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuickCategory = 'all' | 'sales' | 'manufacturing' | 'inventory' | 'finance_hr';

interface QuickActionItem {
  id: string;
  category: 'sales' | 'manufacturing' | 'inventory' | 'finance_hr';
  title: string;
  titleBn?: string;
  subtitle: string;
  subtitleBn?: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  badgeBn?: string;
  colorClass: string;
  bgClass: string;
  moduleKey: string;
  permissions?: string[];
}

export const MobileQuickAddDrawer: React.FC<MobileQuickAddDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { i18n } = useTranslation(['navigation', 'common']);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isModuleEnabled = useTenantCapabilityStore((s) => s.isModuleEnabled);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [activeCategory, setActiveCategory] = useState<QuickCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Reset state on drawer close during render (avoids cascading render warning)
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setSearchQuery('');
      setActiveCategory('all');
    }
  }

  const isBn = i18n.language === 'bn';

  // Super Admin / Platform Admin check
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    if (user.is_platform_admin) return true;
    if (permissions?.has('*')) return true;
    const roleLower = user.role?.toLowerCase() || '';
    return roleLower.includes('super administrator') || roleLower.includes('admin') || roleLower.includes('owner');
  }, [user, permissions]);

  // Robust module capability checking
  const checkModule = useCallback((moduleKey: string) => {
    if (moduleKey === 'catalogue' || moduleKey === 'stock' || moduleKey === 'warehouse') {
      return isModuleEnabled('inventory');
    }
    if (moduleKey === 'logistics') {
      return isModuleEnabled('delivery') || isModuleEnabled('logistics');
    }
    if (moduleKey === 'procurement') {
      return isModuleEnabled('purchasing') || isModuleEnabled('procurement');
    }
    return isModuleEnabled(moduleKey);
  }, [isModuleEnabled]);

  const canAccess = useCallback((moduleKey: string, allowedPermissions?: string[]) => {
    // 1. If module is disabled in tenant subscription plan, hide it
    if (!checkModule(moduleKey)) return false;
    // 2. Administrators have access to all enabled modules
    if (isSuperAdmin) return true;
    // 3. Check explicit permission grants
    if (!allowedPermissions || allowedPermissions.length === 0) return true;
    return hasPermission([...allowedPermissions, `${moduleKey}.*`, '*']);
  }, [checkModule, isSuperAdmin, hasPermission]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allActions: QuickActionItem[] = useMemo(() => [
    // ── 1. Commercial & Sales ──────────────────────────────────────────
    {
      id: 'pos',
      category: 'sales',
      title: 'POS Terminal',
      titleBn: 'পয়েন্ট অব সেল (পিওএস)',
      subtitle: 'Launch cash register & barcode checkout',
      subtitleBn: 'ক্যাশ রেজিস্টার ও দ্রুত বিলিং',
      path: '/pos',
      icon: Store,
      badge: 'Live POS',
      badgeBn: 'লাইভ',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      moduleKey: 'pos',
      permissions: ['pos.terminal.view', 'pos.sale.create'],
    },
    {
      id: 'sales-invoice',
      category: 'sales',
      title: 'New Sales Invoice',
      titleBn: 'নতুন বিক্রয় চালান',
      subtitle: 'Draft B2B wholesale or retail customer invoice',
      subtitleBn: 'নতুন বিক্রয় চালান বা অর্ডার তৈরি',
      path: '/sales',
      icon: FileText,
      badge: 'Sales',
      badgeBn: 'বিক্রয়',
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
      moduleKey: 'sales',
      permissions: ['sales.order.view', 'sales.invoice.view'],
    },
    {
      id: 'crm-lead',
      category: 'sales',
      title: 'Customer & Lead Profile',
      titleBn: 'নতুন ক্রেতা ও লিড প্রোফাইল',
      subtitle: 'Register client contact, lead & CRM notes',
      subtitleBn: 'নতুন ক্রেতার তথ্য ও যোগাযোগ বিবরণী',
      path: '/sales?tab=leads',
      icon: UserPlus,
      badge: 'CRM',
      badgeBn: 'সিআরএম',
      colorClass: 'text-sky-600 dark:text-sky-400',
      bgClass: 'bg-sky-500/10 dark:bg-sky-500/20',
      moduleKey: 'crm',
      permissions: ['sales.lead.view', 'crm.lead.view'],
    },
    {
      id: 'new-product',
      category: 'sales',
      title: 'Catalogue Product (SKU)',
      titleBn: 'ক্যাটালগ পণ্য ও এসকেইউ',
      subtitle: 'Create new catalog item with pricing & photos',
      subtitleBn: 'মূল্য ও ছবিসহ ক্যাটালগে নতুন পণ্য যোগ',
      path: '/catalogue',
      icon: PackagePlus,
      badge: 'Catalog',
      badgeBn: 'ক্যাটালগ',
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-500/10 dark:bg-purple-500/20',
      moduleKey: 'inventory',
      permissions: ['catalog.product.view', 'catalog.item.view'],
    },
    {
      id: 'storefront-coupons',
      category: 'sales',
      title: 'Coupons & Promo Codes',
      titleBn: 'কুপন ও ডিসকাউন্ট কোড',
      subtitle: 'Configure promotional vouchers & discounts',
      subtitleBn: 'গ্রাহকদের জন্য বিশেষ ছাড় ও কুপন',
      path: '/storefront?tab=coupons',
      icon: Ticket,
      badge: 'Promo',
      badgeBn: 'ছাড়',
      colorClass: 'text-pink-600 dark:text-pink-400',
      bgClass: 'bg-pink-500/10 dark:bg-pink-500/20',
      moduleKey: 'ecommerce',
      permissions: ['ecommerce.storefront.view'],
    },
    {
      id: 'storefront-cms',
      category: 'sales',
      title: 'Online Storefront CMS',
      titleBn: 'অনলাইন স্টোর ও ই-কমার্স',
      subtitle: 'Manage storefront catalog, banners & layout',
      subtitleBn: 'ই-কমার্স ওয়েবসাইট ও পণ্য প্রদর্শন',
      path: '/storefront',
      icon: ShoppingBag,
      badge: 'Web Store',
      badgeBn: 'ওয়েবসাইট',
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      moduleKey: 'ecommerce',
      permissions: ['ecommerce.storefront.view'],
    },

    // ── 2. Factory & Manufacturing ─────────────────────────────────────
    {
      id: 'production-batch',
      category: 'manufacturing',
      title: 'New Production Batch',
      titleBn: 'নতুন প্রোডাকশন ব্যাচ',
      subtitle: 'Start factory production line run with BOM recipe',
      subtitleBn: 'কারখানা উৎপাদন আদেশ ও রেসিপি নির্ধারণ',
      path: '/production',
      icon: Factory,
      badge: 'Factory',
      badgeBn: 'ফ্যাক্টরি',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
      moduleKey: 'production',
      permissions: ['production.batch.view', 'production.plan.view'],
    },
    {
      id: 'bom-recipes',
      category: 'manufacturing',
      title: 'BOM Recipes & Formulation',
      titleBn: 'বিওএম রেসিপি ও ফর্মুলা',
      subtitle: 'Manage bill of materials & raw ingredient ratios',
      subtitleBn: 'উপাদান অনুপাত ও ম্যানুফ্যাকচারিং সূত্র',
      path: '/catalogue',
      icon: ClipboardList,
      badge: 'Recipe',
      badgeBn: 'রেসিপি',
      colorClass: 'text-cyan-600 dark:text-cyan-400',
      bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      moduleKey: 'inventory',
      permissions: ['catalog.bom.view', 'catalog.product.view'],
    },
    {
      id: 'qc-audit',
      category: 'manufacturing',
      title: 'QC Inspection & Audit',
      titleBn: 'কিউসি পরিদর্শন ও টেস্ট',
      subtitle: 'Execute QA quality check on finished goods',
      subtitleBn: 'পণ্যের গুণগত মান ও ত্রুটি যাচাই',
      path: '/qc',
      icon: ShieldCheck,
      badge: 'Quality',
      badgeBn: 'গুণমান',
      colorClass: 'text-violet-600 dark:text-violet-400',
      bgClass: 'bg-violet-500/10 dark:bg-violet-500/20',
      moduleKey: 'qc',
      permissions: ['qc.inspection.view', 'qc.parameter.view'],
    },
    {
      id: 'qc-wastage',
      category: 'manufacturing',
      title: 'Wastage & Scrap Log',
      titleBn: 'অপচয় ও স্ক্র্যাপ রেকর্ড',
      subtitle: 'Track production shrinkage, damaged packs & losses',
      subtitleBn: 'উৎপাদনে অপচয় ও ক্ষতি নিরূপণ',
      path: '/qc',
      icon: Trash2,
      badge: 'Scrap',
      badgeBn: 'অপচয়',
      colorClass: 'text-red-600 dark:text-red-400',
      bgClass: 'bg-red-500/10 dark:bg-red-500/20',
      moduleKey: 'qc',
      permissions: ['qc.wastage.view', 'qc.inspection.view'],
    },

    // ── 3. Inventory & Supply ──────────────────────────────────────────
    {
      id: 'purchase-po',
      category: 'inventory',
      title: 'Purchase Order (PO)',
      titleBn: 'ক্রয় আদেশ (পিও)',
      subtitle: 'Requisition raw materials from suppliers',
      subtitleBn: 'কাঁচামাল ও সাপ্লায়ার ক্রয় চুক্তি',
      path: '/purchasing',
      icon: ShoppingCart,
      badge: 'PO',
      badgeBn: 'পিও',
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      moduleKey: 'purchasing',
      permissions: ['purchasing.order.view', 'purchasing.requisition.view'],
    },
    {
      id: 'stock-receive',
      category: 'inventory',
      title: 'Receive Stock (GRN)',
      titleBn: 'পণ্য গ্রহণ (জিআরএন)',
      subtitle: 'Inward goods receipt docket at central warehouse',
      subtitleBn: 'গুদামে নতুন পণ্য ইনওয়ার্ড ও যাচাই',
      path: '/inventory',
      icon: Boxes,
      badge: 'Stock In',
      badgeBn: 'ইনওয়ার্ড',
      colorClass: 'text-teal-600 dark:text-teal-400',
      bgClass: 'bg-teal-500/10 dark:bg-teal-500/20',
      moduleKey: 'inventory',
      permissions: ['inventory.stock.view', 'inventory.movement.view'],
    },
    {
      id: 'stock-adjust',
      category: 'inventory',
      title: 'Stock Transfer & Adjust',
      titleBn: 'স্টক সমন্বয় ও ট্রান্সফার',
      subtitle: 'Inter-warehouse dispatch & bin count variance',
      subtitleBn: 'শাখা ট্রান্সফার ও গুদাম গণনা ব্যবধান',
      path: '/inventory',
      icon: Warehouse,
      badge: 'Stock',
      badgeBn: 'স্টক',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      moduleKey: 'inventory',
      permissions: ['inventory.transfer.view', 'inventory.adjustment.view'],
    },
    {
      id: 'dispatch-delivery',
      category: 'inventory',
      title: 'Dispatch & Delivery Challan',
      titleBn: 'ডেলিভারি চালান ও প্রেরণ',
      subtitle: 'Assign couriers, riders & vehicle run sheets',
      subtitleBn: 'কুরিয়ার ও রাইডার ডেলিভারি চালান',
      path: '/logistics',
      icon: Truck,
      badge: 'Logistics',
      badgeBn: 'ডেলিভারি',
      colorClass: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
      moduleKey: 'delivery',
      permissions: ['logistics.delivery_order.view', 'logistics.shipment.view'],
    },

    // ── 4. Finance & Workforce ─────────────────────────────────────────
    {
      id: 'record-expense',
      category: 'finance_hr',
      title: 'Operational Expense',
      titleBn: 'খরচ ভাউচার (টাকা আউট)',
      subtitle: 'Log utility bills, supplier payouts, or petty cash',
      subtitleBn: 'কার্যালয় ব্যয়, বিল ও হিসাব ভাউচার',
      path: '/finance',
      icon: Receipt,
      badge: 'Expense',
      badgeBn: 'ব্যয়',
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-500/10 dark:bg-rose-500/20',
      moduleKey: 'finance',
      permissions: ['finance.expense.view', 'finance.account.view'],
    },
    {
      id: 'money-in',
      category: 'finance_hr',
      title: 'Payment Receipt (Money In)',
      titleBn: 'জমা ও পেমেন্ট রিসিট',
      subtitle: 'Record customer payment collection or bank deposit',
      subtitleBn: 'গ্রাহকের পরিশোধ ও ব্যাংক জমা রসিদ',
      path: '/finance',
      icon: Coins,
      badge: 'Income',
      badgeBn: 'জমা',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      moduleKey: 'finance',
      permissions: ['finance.account.view', 'finance.transaction.view'],
    },
    {
      id: 'staff-attendance',
      category: 'finance_hr',
      title: 'Shift Attendance & Piece Rates',
      titleBn: 'উপস্থিতি ও কাজের শিফট',
      subtitle: 'Log factory worker clock-ins & daily piece rate output',
      subtitleBn: 'কর্মী হাজিরা ও দৈনিক আউটপুট হিসাব',
      path: '/hr',
      icon: UserCheck,
      badge: 'Shifts',
      badgeBn: 'হাজিরা',
      colorClass: 'text-lime-600 dark:text-lime-400',
      bgClass: 'bg-lime-500/10 dark:bg-lime-500/20',
      moduleKey: 'hr',
      permissions: ['hr.attendance.view', 'hr.employee.view'],
    },
    {
      id: 'new-staff',
      category: 'finance_hr',
      title: 'Add Staff / Worker Profile',
      titleBn: 'নতুন কর্মী ও স্টাফ এন্ট্রি',
      subtitle: 'Onboard new factory operator or admin personnel',
      subtitleBn: 'নতুন কর্মচারী ও ফ্যাক্টরি কর্মী তথ্য',
      path: '/hr',
      icon: Users,
      badge: 'HR',
      badgeBn: 'এইচআর',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
      moduleKey: 'hr',
      permissions: ['hr.employee.view'],
    },
    {
      id: 'business-reports',
      category: 'finance_hr',
      title: 'Reports & Analytics',
      titleBn: 'ব্যবসায়িক রিপোর্ট ও অডিট',
      subtitle: 'Generate P&L, sales analysis & production audit',
      subtitleBn: 'লাভ-ক্ষতি ও সার্বিক ব্যবসায়িক হিসাব',
      path: '/reports',
      icon: FileSpreadsheet,
      badge: 'Reports',
      badgeBn: 'রিপোর্ট',
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
      moduleKey: 'reports',
      permissions: ['reports.report.view'],
    },
  ], []);

  // Filter by permission/module
  const visibleActions = useMemo(() => {
    return allActions.filter((item) => canAccess(item.moduleKey, item.permissions));
  }, [allActions, canAccess]);

  // Filter by active category & search query
  const filteredActions = useMemo(() => {
    return visibleActions.filter((item) => {
      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title.toLowerCase().includes(q) || (item.titleBn && item.titleBn.toLowerCase().includes(q));
      const matchSubtitle = item.subtitle.toLowerCase().includes(q) || (item.subtitleBn && item.subtitleBn.toLowerCase().includes(q));
      const matchBadge = item.badge?.toLowerCase().includes(q) || (item.badgeBn && item.badgeBn.toLowerCase().includes(q));
      return Boolean(matchTitle || matchSubtitle || matchBadge);
    });
  }, [visibleActions, activeCategory, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  const categories: { id: QuickCategory; label: string; labelBn: string; count: number }[] = [
    { id: 'all', label: 'All Actions', labelBn: 'সবগুলো', count: visibleActions.length },
    { id: 'sales', label: 'Sales & Retail', labelBn: 'বিক্রয়', count: visibleActions.filter((i) => i.category === 'sales').length },
    { id: 'manufacturing', label: 'Factory & QC', labelBn: 'কারখানা', count: visibleActions.filter((i) => i.category === 'manufacturing').length },
    { id: 'inventory', label: 'Stock & Logistics', labelBn: 'গুদাম ও সাপ্লাই', count: visibleActions.filter((i) => i.category === 'inventory').length },
    { id: 'finance_hr', label: 'Finance & HR', labelBn: 'হিসাব ও কর্মী', count: visibleActions.filter((i) => i.category === 'finance_hr').length },
  ];

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Actions Hub"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Sheet Panel */}
      <div className="relative w-full max-h-[88vh] bg-surface rounded-t-3xl border-t border-default shadow-2xl flex flex-col z-10 animate-in slide-in-from-bottom duration-200 overflow-hidden pb-safe">
        {/* Drag handle pill */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.2 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-default shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8.5 items-center justify-center rounded-xl bg-linear-to-tr from-primary to-indigo-600 text-white shadow-xs">
              <PlusCircle className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-default leading-tight">
                  {isBn ? 'দ্রুত কর্মপরিচালনা হাব' : 'Quick Actions Hub'}
                </h2>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {visibleActions.length}
                </span>
              </div>
              <p className="text-[10px] text-muted">
                {isBn ? 'সরাসরি নতুন নথি বা কার্যপ্রক্রিয়া খুলুন' : 'Instant creation & key operations'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-default/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'চালান, রেসিপি, খরচ, ব্যাচ খুঁজুন...' : 'Search actions (e.g. invoice, recipe, expense, batch)...'}
              className="w-full rounded-xl border border-default bg-surface-sunken/60 pl-8.5 pr-8 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-default"
                aria-label="Clear Search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
            {categories.map((cat) => {
              if (cat.count === 0 && cat.id !== 'all') return null;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-fg shadow-2xs'
                      : 'bg-surface-sunken hover:bg-surface-sunken/80 text-muted hover:text-default'
                  }`}
                >
                  <span>{isBn ? cat.labelBn : cat.label}</span>
                  <span
                    className={`text-[9px] px-1 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-default/10 text-muted'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions Scroll Area */}
        <div className="p-3.5 space-y-2 overflow-y-auto max-h-[calc(88vh-9.5rem)]">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              <p className="font-semibold text-default">
                {isBn ? 'কোনো অ্যাকশন পাওয়া যায়নি' : 'No matching quick actions found'}
              </p>
              <p className="text-[11px] mt-1">
                {isBn ? 'অনুগ্রহ করে অন্য শব্দ দিয়ে চেষ্টা করুন' : 'Try searching with a different keyword'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.path)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-default bg-surface hover:bg-surface-sunken active:scale-[0.98] transition-all text-left group cursor-pointer shadow-2xs hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl shrink-0 ${item.bgClass} ${item.colorClass} shadow-2xs group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-default group-hover:text-primary transition-colors truncate">
                            {isBn && item.titleBn ? item.titleBn : item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase bg-primary-subtle text-primary border border-primary/20">
                              {isBn && item.badgeBn ? item.badgeBn : item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {isBn && item.subtitleBn ? item.subtitleBn : item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
