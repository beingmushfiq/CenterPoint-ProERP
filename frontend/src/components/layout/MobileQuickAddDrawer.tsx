import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  PlusCircle,
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
} from 'lucide-react';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';

interface MobileQuickAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickActionItem {
  id: string;
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
  visible: boolean;
}

export const MobileQuickAddDrawer: React.FC<MobileQuickAddDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { i18n } = useTranslation(['navigation', 'common']);
  const navigate = useNavigate();
  const isModuleEnabled = useTenantCapabilityStore((s) => s.isModuleEnabled);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isBn = i18n.language === 'bn';

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

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  const commercialActions: QuickActionItem[] = [
    {
      id: 'pos',
      title: 'POS Terminal',
      titleBn: 'পয়েন্ট অব সেল (পিওএস)',
      subtitle: 'Launch cash register & barcode checkout',
      subtitleBn: 'ক্যাশ রেজিস্টার ও দ্রুত বিলিং',
      path: '/pos',
      icon: Store,
      badge: 'Live',
      badgeBn: 'লাইভ',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      visible: isModuleEnabled('pos') && hasPermission(['pos.terminal.view', 'pos.sale.create', '*']),
    },
    {
      id: 'sales-invoice',
      title: 'Sales Invoice',
      titleBn: 'বিক্রয় চালান (চালানপত্র)',
      subtitle: 'Draft new sales order or customer bill',
      subtitleBn: 'নতুন বিক্রয় চালান বা অর্ডার তৈরি',
      path: '/sales',
      icon: FileText,
      badge: 'Billing',
      badgeBn: 'বিলিং',
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
      visible: isModuleEnabled('sales') && hasPermission(['sales.create', 'sales.view', '*']),
    },
    {
      id: 'new-product',
      title: 'Catalogue Product',
      titleBn: 'নতুন পণ্য (এসকেইউ)',
      subtitle: 'Create new catalog item with pricing & media',
      subtitleBn: 'মূল্য ও ছবিসহ ক্যাটালগে নতুন পণ্য',
      path: '/catalogue',
      icon: PackagePlus,
      badge: 'Catalog',
      badgeBn: 'ক্যাটালগ',
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-500/10 dark:bg-purple-500/20',
      visible: isModuleEnabled('catalogue') && hasPermission(['catalogue.product.create', 'catalogue.view', '*']),
    },
    {
      id: 'crm-lead',
      title: 'Customer & Lead',
      titleBn: 'ক্রেতা ও লিড এন্ট্রি',
      subtitle: 'Register customer profile or sales opportunity',
      subtitleBn: 'নতুন ক্রেতার তথ্য ও যোগাযোগ',
      path: '/crm',
      icon: UserPlus,
      colorClass: 'text-sky-600 dark:text-sky-400',
      bgClass: 'bg-sky-500/10 dark:bg-sky-500/20',
      visible: isModuleEnabled('crm') && hasPermission(['crm.lead.create', 'crm.view', '*']),
    },
  ];

  const operationsActions: QuickActionItem[] = [
    {
      id: 'production-batch',
      title: 'Production Batch',
      titleBn: 'প্রোডাকশন ব্যাচ',
      subtitle: 'Start factory production run with BOM recipe',
      subtitleBn: 'কারখানা উৎপাদন আদেশ ও রেসিপি',
      path: '/production',
      icon: Factory,
      badge: 'Factory',
      badgeBn: 'ফ্যাক্টরি',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
      visible: isModuleEnabled('production') && hasPermission(['production.create', 'production.view', '*']),
    },
    {
      id: 'stock-receive',
      title: 'Receive Stock & Adjust',
      titleBn: 'পণ্য গ্রহণ ও স্টক সমন্বয়',
      subtitle: 'Inward goods receipt or warehouse bin count',
      subtitleBn: 'গুদামে পণ্য ইনওয়ার্ড ও স্টক আপডেট',
      path: '/inventory',
      icon: Boxes,
      colorClass: 'text-teal-600 dark:text-teal-400',
      bgClass: 'bg-teal-500/10 dark:bg-teal-500/20',
      visible: isModuleEnabled('inventory') && hasPermission(['inventory.adjust', 'inventory.view', '*']),
    },
    {
      id: 'purchase-po',
      title: 'Purchase Order (PO)',
      titleBn: 'ক্রয় আদেশ (পিও)',
      subtitle: 'Requisition raw materials from supplier',
      subtitleBn: 'কাঁচামাল ও সাপ্লায়ার ক্রয় চুক্তি',
      path: '/purchasing',
      icon: ShoppingCart,
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      visible: isModuleEnabled('purchasing') || isModuleEnabled('procurement'),
    },
    {
      id: 'dispatch-delivery',
      title: 'Dispatch & Delivery',
      titleBn: 'ডেলিভারি প্রেরণ চালান',
      subtitle: 'Assign couriers, riders, and shipping challan',
      subtitleBn: 'কুরিয়ার ও রাইডার চালান বরাদ্দ',
      path: '/logistics',
      icon: Truck,
      colorClass: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
      visible: isModuleEnabled('logistics') && hasPermission(['logistics.view', 'logistics.dispatch', '*']),
    },
  ];

  const administrativeActions: QuickActionItem[] = [
    {
      id: 'record-expense',
      title: 'Operational Expense',
      titleBn: 'খরচ রেকর্ড (টাকা আউট)',
      subtitle: 'Log utility bills, supplier payouts, or petty cash',
      subtitleBn: 'কার্যালয় ব্যয় ও হিসাব ভাউচার',
      path: '/finance',
      icon: Receipt,
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-500/10 dark:bg-rose-500/20',
      visible: isModuleEnabled('finance') && hasPermission(['finance.view', 'finance.create', '*']),
    },
    {
      id: 'qc-audit',
      title: 'Quality Inspection',
      titleBn: 'মান নিয়ন্ত্রণ পরিদর্শন',
      subtitle: 'Run QA audit inspection on finished items',
      subtitleBn: 'উৎপাদিত পণ্যের ত্রুটি যাচাই',
      path: '/qc',
      icon: ShieldCheck,
      colorClass: 'text-violet-600 dark:text-violet-400',
      bgClass: 'bg-violet-500/10 dark:bg-violet-500/20',
      visible: isModuleEnabled('qc') && hasPermission(['qc.view', 'qc.inspect', '*']),
    },
  ];

  const renderSection = (title: string, items: QuickActionItem[]) => {
    const visibleItems = items.filter((i) => i.visible);
    if (visibleItems.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">
          {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.path)}
                className="flex items-center justify-between p-3 rounded-2xl border border-default bg-surface hover:bg-surface-sunken active:scale-[0.98] transition-all text-left group cursor-pointer shadow-2xs"
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
                <ChevronRight className="size-4 text-muted/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Quick Actions Menu">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Sheet Panel */}
      <div className="relative w-full max-h-[85vh] bg-surface rounded-t-3xl border-t border-default shadow-2xl flex flex-col z-10 animate-in slide-in-from-bottom duration-200 overflow-hidden pb-safe">
        {/* Drag handle pill */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.2 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-default shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-linear-to-tr from-primary to-indigo-600 text-white shadow-xs">
              <PlusCircle className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-default leading-tight">
                {isBn ? 'দ্রুত কর্মপরিচালনা' : 'Quick Actions Hub'}
              </h2>
              <p className="text-[10px] text-muted">
                {isBn ? 'সরাসরি নতুন নথি বা কার্যপ্রক্রিয়া খুলুন' : 'Create documents & jump to key workflows'}
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

        {/* Actions Scroll Area */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-5rem)]">
          {renderSection(isBn ? 'বাণিজ্য ও খুচরা বিক্রয়' : 'Sales & Retail Operations', commercialActions)}
          {renderSection(isBn ? 'কারখানা ও ইনভেন্টরি' : 'Factory & Stock Fulfillment', operationsActions)}
          {renderSection(isBn ? 'হিসাব ও মান নিয়ন্ত্রণ' : 'Finance & Quality Compliance', administrativeActions)}
        </div>
      </div>
    </div>
  );
};
