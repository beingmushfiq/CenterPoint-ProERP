import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Undo2,
  Search,
  SlidersHorizontal,
  X,
  Compass,
  ArrowRight,
  Zap,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { SuppliersSection } from './sections/SuppliersSection';
import { PurchaseOrdersSection } from './sections/PurchaseOrdersSection';
import { GoodsReceiptsSection } from './sections/GoodsReceiptsSection';
import { PurchaseRequisitionsSection } from './sections/PurchaseRequisitionsSection';
import { PurchaseBillsSection } from './sections/PurchaseBillsSection';
import { PurchaseReturnsSection } from './sections/PurchaseReturnsSection';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import type { PurchaseOrder } from '../../types/api/purchasing';
import { FastPoModal } from './modals/FastPoModal';
import { FastGrnModal } from './modals/FastGrnModal';
import { FastBillModal } from './modals/FastBillModal';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export type PurchasingTab = 'suppliers' | 'requisitions' | 'orders' | 'receipts' | 'bills' | 'returns';
export type PurchasingCategory = 'sourcing' | 'fulfillment';

export interface PurchasingTabConfig extends WorkspaceTabConfig<PurchasingCategory, PurchasingTab> {
  step?: number;
  highlights?: string[];
}

const VALID_TABS: readonly PurchasingTab[] = ['suppliers', 'requisitions', 'orders', 'receipts', 'bills', 'returns'];

export default function PurchasingWorkspace() {
  const { t } = useTranslation(['purchasing', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<PurchasingTab>('requisitions', VALID_TABS);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  // Quick-Action Modals State
  const [showFastPoModal, setShowFastPoModal] = useState(false);
  const [showFastGrnModal, setShowFastGrnModal] = useState(false);
  const [showFastBillModal, setShowFastBillModal] = useState(false);
  const [selectedPoForAction, setSelectedPoForAction] = useState<PurchaseOrder | null>(null);

  // Low-Stock Threshold Alerts
  const { data: stockAlerts = [] } = useQuery<Array<{ product_id: number; product_name?: string; sku?: string; current_stock: number; min_stock_alert: number }>>({
    queryKey: ['inventory', 'thresholds', 'alerts'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Array<{ product_id: number; product_name?: string; sku?: string; current_stock: number; min_stock_alert: number }> }>('/inventory/thresholds/alerts');
        return res.data?.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const categories: WorkspaceCategoryConfig<PurchasingCategory, PurchasingTab>[] = useMemo(() => [
    {
      id: 'sourcing',
      label: t('purchasing.catSourcingLabel', 'Procurement & Sourcing'),
      tagline: t(
        'purchasing.catSourcingDesc',
        'Vendor directory, internal requisitions & supplier purchase orders'
      ),
      shortcut: '1',
      icon: ShoppingCart,
      tabs: ['suppliers', 'requisitions', 'orders'],
      defaultTab: 'orders',
      theme: WORKSPACE_THEMES.indigo,
    },
    {
      id: 'fulfillment',
      label: t('purchasing.catFulfillmentLabel', 'Receipts & Vendor Bills'),
      tagline: t(
        'purchasing.catFulfillmentDesc',
        'Warehouse gate inwarding, 3-way matching bills & debit notes'
      ),
      shortcut: '2',
      icon: PackageCheck,
      tabs: ['receipts', 'bills', 'returns'],
      defaultTab: 'receipts',
      theme: WORKSPACE_THEMES.emerald,
    },
  ], [t]);

  const tabs: PurchasingTabConfig[] = useMemo(() => [
    {
      id: 'suppliers',
      category: 'sourcing',
      label: 'Suppliers & Vendors',
      shortLabel: 'Suppliers',
      icon: Building2,
      description: 'Vendor master directory, payment terms, tax IDs, and credit agreements',
      highlights: ['Vendor Profiles', 'Payment Terms', 'Commercial Directory'],
    },
    {
      id: 'requisitions',
      category: 'sourcing',
      label: t('purchasing.tabRequisitionsLabel'),
      shortLabel: t('purchasing.tabRequisitionsShort'),
      step: 1,
      icon: FileSpreadsheet,
      description: t('purchasing.tabRequisitionsDesc'),
      highlights: ['Department Requests', 'Budget Check', 'Approval Sign-off'],
    },
    {
      id: 'orders',
      category: 'sourcing',
      label: t('purchasing.tabOrdersLabel'),
      shortLabel: t('purchasing.tabOrdersShort'),
      step: 2,
      icon: ShoppingCart,
      description: t('purchasing.tabOrdersDesc'),
      highlights: ['Supplier Contracts', 'Agreed Pricing', 'Printable PO Slips'],
    },
    {
      id: 'receipts',
      category: 'fulfillment',
      label: t('purchasing.tabReceiptsLabel'),
      shortLabel: t('purchasing.tabReceiptsShort'),
      step: 3,
      icon: PackageCheck,
      description: t('purchasing.tabReceiptsDesc'),
      highlights: ['Gate Inwarding', 'Quantity Verification', 'Instant Stock Addition'],
    },
    {
      id: 'bills',
      category: 'fulfillment',
      label: t('purchasing.tabBillsLabel'),
      shortLabel: t('purchasing.tabBillsShort'),
      step: 4,
      icon: Receipt,
      description: t('purchasing.tabBillsDesc'),
      highlights: ['Due Date Tracking', 'Tax Validation', 'Payment Settlement'],
    },
    {
      id: 'returns',
      category: 'fulfillment',
      label: t('purchasing.tabReturnsLabel'),
      shortLabel: t('purchasing.tabReturnsShort'),
      step: 5,
      badge: t('purchasing.tabReturnsBadge'),
      icon: Undo2,
      description: t('purchasing.tabReturnsDesc'),
      highlights: ['Supplier Debit Notes', 'Damaged Item Return', 'Stock Balance Update'],
    },
  ], [t]);

  const handleReceivePo = (order: PurchaseOrder) => {
    setSelectedPoForAction(order);
    setShowFastGrnModal(true);
  };

  const handleCreateBill = (order: PurchaseOrder) => {
    setSelectedPoForAction(order);
    setShowFastBillModal(true);
  };

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickJumpRef.current && !quickJumpRef.current.contains(event.target as Node)) {
        setQuickJumpOpen(false);
      }
    }
    if (quickJumpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [quickJumpOpen]);

  const filteredTabs = searchQuery.trim()
    ? tabs.filter(
        (t) =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.shortLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : tabs;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto py-1 sm:py-2">
      {/* Workspace Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-4 sm:pb-5 w-full min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20">
              {t('purchasing.headerBadge')}
            </span>
            <span className="text-muted/50 text-xs">/</span>
            <span className="text-[11px] font-semibold text-default">
              {t('purchasing.stageOfFive', { step: currentTab.step, label: currentTab.label })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
            <span>{currentTab.label}</span>
            {currentTab.badge && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-sunken text-muted border border-default">
                {currentTab.badge}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {currentTab.description}
          </p>
        </div>

        {/* Quick External Actions & Guides */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-primary/30 bg-primary-subtle hover:bg-primary/10 text-primary transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Open Procurement Capabilities and P2P Workflow Guide"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('purchasing.exploreCapabilities')}</span>
          </button>

          {/* Quick Jump Dropdown */}
          <div className="relative shrink-0" ref={quickJumpRef}>
            <button
              type="button"
              onClick={() => {
                setQuickJumpOpen(!quickJumpOpen);
                setSearchQuery('');
              }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer',
                quickJumpOpen && 'border-primary/40 bg-surface-sunken'
              )}
              title="Jump directly to any of the 5 purchasing views"
            >
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>{t('purchasing.allViews')}</span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface rounded-2xl border border-default shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('purchasing.searchViews')}
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-sunken rounded-lg border border-default focus:border-primary focus:outline-none text-default"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-default"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-0.5 pr-1">
                  {filteredTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isTabActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setQuickJumpOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition cursor-pointer ${
                          isTabActive
                            ? 'bg-primary text-primary-fg font-semibold'
                            : 'hover:bg-surface-sunken text-default'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <TabIcon
                            className={`size-3.5 shrink-0 ${
                              isTabActive ? 'text-primary-fg' : 'text-muted'
                            }`}
                          />
                          <span className="truncate">{tab.label}</span>
                        </div>
                        {tab.step && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                              isTabActive
                                ? 'bg-primary-fg/20 text-primary-fg'
                                : 'bg-surface-sunken text-muted'
                            }`}
                          >
                            {t('purchasing.stepLabel', { step: tab.step })}
                          </span>
                        )}
                        {tab.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                              isTabActive
                                ? 'bg-primary-fg/20 text-primary-fg'
                                : 'bg-surface-sunken text-muted'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {filteredTabs.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted">
                      {t('purchasing.noViewsFound', { query: searchQuery })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Universal Quick-Action Ribbon */}
      <div className="flex items-center justify-center gap-2.5 p-2 rounded-2xl bg-surface border border-default shadow-xs flex-wrap">
        <button
          type="button"
          onClick={() => setShowFastPoModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-fg shadow-xs transition cursor-pointer"
        >
          <ShoppingCart className="size-4" />
          <span>{t('purchasing.orderMaterials')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedPoForAction(null);
            setShowFastGrnModal(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
        >
          <PackageCheck className="size-4" />
          <span>{t('purchasing.inwardDelivery')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedPoForAction(null);
            setShowFastBillModal(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
        >
          <Receipt className="size-4" />
          <span>{t('purchasing.enterSupplierBill')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-sunken hover:bg-surface border border-default text-default transition cursor-pointer"
        >
          <Undo2 className="size-4 text-amber-500" />
          <span>{t('purchasing.returnDefective')}</span>
        </button>
      </div>

      {/* Low-Stock Alert Replenishment Banner */}
      {stockAlerts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight flex items-center gap-2">
                <span>Low Stock Replenishment Alert</span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-mono font-bold">
                  {stockAlerts.length} SKU(s) Critical
                </span>
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {stockAlerts.slice(0, 3).map((a) => a.product_name || a.sku).join(', ')}
                {stockAlerts.length > 3 ? ` and ${stockAlerts.length - 3} more items below minimum reorder buffer` : ' breached minimum reorder buffer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('requisitions')}
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-surface text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            >
              Create Requisition
            </button>
            <button
              type="button"
              onClick={() => setShowFastPoModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
            >
              <ShoppingCart className="size-3" />
              <span>Create PO Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Tier Universal Navigation Hub */}
      <WorkspaceNavigationHub<PurchasingCategory, PurchasingTab>
        categories={categories}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Capabilities & P2P Guide Modal */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('purchasing.guideModalTitle')}
        size="xl"
      >
        <div className="space-y-5 p-1 text-default">
          <p className="text-xs text-muted leading-relaxed">
            {t('purchasing.guideModalIntro')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto pr-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isCurrent = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  className={cn(
                    'p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between',
                    isCurrent
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-default bg-surface hover:bg-surface-sunken'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-surface-sunken border border-default flex items-center justify-center text-primary">
                          <Icon className="size-4" />
                        </div>
                        <h4 className="text-xs font-bold text-default">
                          {tab.step ? `${t('purchasing.stepLabel', { step: tab.step })}: ${tab.label}` : tab.label}
                        </h4>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded-full border border-primary/20">
                          {t('purchasing.currentTabBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed mb-2.5">
                      {tab.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tab.highlights?.map((h, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-surface-sunken text-muted border border-default/50"
                        >
                          ✓ {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-full flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsGuideOpen(false);
                    }}
                  >
                    <span>{isCurrent ? t('purchasing.viewingNow') : t('purchasing.openTab', { label: tab.label })}</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-default bg-surface-sunken p-3.5 space-y-1.5 text-xs">
            <h5 className="font-bold text-default flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              {t('purchasing.guideShortcutsTitle')}
            </h5>
            <ul className="text-[11px] text-muted space-y-1 list-disc list-inside">
              <li>{t('purchasing.shortcut1')}</li>
              <li>{t('purchasing.shortcut2')}</li>
              <li>{t('purchasing.shortcut3')}</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Tab Content */}
      <div className="pt-1">
        {activeTab === 'suppliers' && <SuppliersSection />}
        {activeTab === 'requisitions' && <PurchaseRequisitionsSection />}
        {activeTab === 'orders' && (
          <PurchaseOrdersSection
            onReceivePo={handleReceivePo}
            onCreateBill={handleCreateBill}
          />
        )}
        {activeTab === 'receipts' && <GoodsReceiptsSection />}
        {activeTab === 'bills' && <PurchaseBillsSection />}
        {activeTab === 'returns' && <PurchaseReturnsSection />}
      </div>

      {/* Fast Action Modals */}
      <FastPoModal
        open={showFastPoModal}
        onClose={() => setShowFastPoModal(false)}
        onSuccess={() => {
          setActiveTab('orders');
        }}
      />

      <FastGrnModal
        open={showFastGrnModal}
        onClose={() => {
          setShowFastGrnModal(false);
          setSelectedPoForAction(null);
        }}
        initialPo={selectedPoForAction}
        onSuccess={() => {
          setActiveTab('receipts');
        }}
      />

      <FastBillModal
        open={showFastBillModal}
        onClose={() => {
          setShowFastBillModal(false);
          setSelectedPoForAction(null);
        }}
        initialPo={selectedPoForAction}
        onSuccess={() => {
          setActiveTab('bills');
        }}
      />
    </div>
  );
}
