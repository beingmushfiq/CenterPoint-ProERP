import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ClipboardCheck,
  Scale,
  Search,
  SlidersHorizontal,
  X,
  Warehouse,
  Compass,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { StockLedgerSection } from './sections/StockLedgerSection';
import { StockTransfersSection } from './sections/StockTransfersSection';
import { StockAdjustmentsSection } from './sections/StockAdjustmentsSection';
import { StockCountsSection } from './sections/StockCountsSection';
import { StockThresholdsSection } from './sections/StockThresholdsSection';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { StockTransferModal } from './modals/StockTransferModal';
import { StockAdjustmentModal } from './modals/StockAdjustmentModal';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export type InventoryTab = 'ledger' | 'transfers' | 'adjustments' | 'counts' | 'thresholds';
export type InventoryCategory = 'visibility' | 'operations';

export interface InventoryTabConfig extends WorkspaceTabConfig<InventoryCategory, InventoryTab> {
  step: number;
  highlights: string[];
}

const VALID_TABS: readonly InventoryTab[] = ['ledger', 'transfers', 'adjustments', 'counts', 'thresholds'];

export default function InventoryWorkspace() {
  const { t } = useTranslation(['inventory', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<InventoryTab>('ledger', VALID_TABS);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  const categories: WorkspaceCategoryConfig<InventoryCategory, InventoryTab>[] = useMemo(() => [
    {
      id: 'visibility',
      label: t('inventory.catVisibilityLabel', 'Stock Balances & Valuation'),
      tagline: t('inventory.catVisibilityTagline', 'Real-time stock valuation, inventory ledger & reorder alerts'),
      shortcut: '1',
      icon: Boxes,
      tabs: ['ledger', 'thresholds'],
      defaultTab: 'ledger',
      theme: WORKSPACE_THEMES.emerald,
    },
    {
      id: 'operations',
      label: t('inventory.catOperationsLabel', 'Warehouse Operations & Flow'),
      tagline: t('inventory.catOperationsTagline', 'Inter-branch stock movements, scrap damage adjustments & physical audits'),
      shortcut: '2',
      icon: Warehouse,
      tabs: ['transfers', 'adjustments', 'counts'],
      defaultTab: 'transfers',
      theme: WORKSPACE_THEMES.cyan,
    },
  ], [t]);

  const tabs: InventoryTabConfig[] = useMemo(() => [
    {
      id: 'ledger',
      step: 1,
      label: t('inventory.tabLedgerLabel'),
      shortLabel: t('inventory.tabLedgerShort'),
      category: 'visibility',
      badge: t('inventory.tabLedgerBadge'),
      icon: Boxes,
      description: t('inventory.tabLedgerDesc'),
      highlights: ['Multi-Warehouse Balances', 'Lot & Expiry Tracking', 'Complete Movement History'],
    },
    {
      id: 'thresholds',
      step: 2,
      label: t('inventory.tabThresholdsLabel'),
      shortLabel: t('inventory.tabThresholdsShort'),
      category: 'visibility',
      badge: t('inventory.tabThresholdsBadge'),
      icon: AlertTriangle,
      description: t('inventory.tabThresholdsDesc'),
      highlights: ['Minimum Level Alerts', 'Low Stock Warnings', 'Suggested Reorder Amounts'],
    },
    {
      id: 'transfers',
      step: 3,
      label: t('inventory.tabTransfersLabel'),
      shortLabel: t('inventory.tabTransfersShort'),
      category: 'operations',
      badge: t('inventory.tabTransfersBadge'),
      icon: ArrowRightLeft,
      description: t('inventory.tabTransfersDesc'),
      highlights: ['Warehouse-to-Warehouse', 'Track In-Transit Goods', 'Arrival Verification'],
    },
    {
      id: 'adjustments',
      step: 4,
      label: t('inventory.tabAdjustmentsLabel'),
      shortLabel: t('inventory.tabAdjustmentsShort'),
      category: 'operations',
      badge: t('inventory.tabAdjustmentsBadge'),
      icon: Scale,
      description: t('inventory.tabAdjustmentsDesc'),
      highlights: ['Broken / Expired Items', 'Audit Reason Records', 'Manager Approval Gate'],
    },
    {
      id: 'counts',
      step: 5,
      label: t('inventory.tabCountsLabel'),
      shortLabel: t('inventory.tabCountsShort'),
      category: 'operations',
      badge: t('inventory.tabCountsBadge'),
      icon: ClipboardCheck,
      description: t('inventory.tabCountsDesc'),
      highlights: ['Freeze Snapshot Audits', 'Blind Counting Sheets', 'Automated Variance Reconciliation'],
    },
  ], [t]);

  // Quick Action Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

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
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20 shrink-0">
              {t('inventory.headerBadge')}
            </span>
            <span className="text-muted/50 text-xs shrink-0">/</span>
            <span className="text-[11px] font-semibold text-default truncate">
              {t('inventory.stageOfFive', { step: currentTab.step, label: currentTab.label })}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-default flex items-center gap-2 sm:gap-3 truncate">
            <span>{currentTab.label}</span>
            {currentTab.badge && (
              <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-sunken text-muted border border-default shrink-0">
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
            title="Open Inventory Architecture & Operations Guide"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('inventory.exploreCapabilities')}</span>
          </button>

          {/* Quick Jump Dropdown Popover */}
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
              title="Jump directly to any of the 5 inventory views"
            >
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>{t('inventory.allViews')}</span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface rounded-2xl border border-default shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('inventory.searchViews')}
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

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {categories.map((cat) => {
                    const catTabs = filteredTabs.filter((t) => t.category === cat.id);
                    if (catTabs.length === 0) return null;

                    return (
                      <div key={cat.id} className="pt-1.5 first:pt-0">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                          <span>{cat.label}</span>
                          <span className="font-mono text-[9px]">{catTabs.length}</span>
                        </div>
                        <div className="space-y-0.5">
                          {catTabs.map((tab) => {
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
                        </div>
                      </div>
                    );
                  })}

                  {filteredTabs.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted">
                      {t('inventory.noViewsFound', { query: searchQuery })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Universal Quick-Action Ribbon */}
      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x">
        <div className="flex items-center sm:justify-center gap-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-surface border border-default shadow-xs w-max min-w-full sm:min-w-0 sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ledger');
              const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
              searchInput?.focus();
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-fg shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Search className="size-3.5 sm:size-4" />
            <span>{t('inventory.quickStockCheck')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowRightLeft className="size-3.5 sm:size-4" />
            <span>{t('inventory.moveStock')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAdjustmentModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <AlertTriangle className="size-3.5 sm:size-4" />
            <span>{t('inventory.reportDamaged')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('counts')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-surface-sunken hover:bg-surface border border-default text-default transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ClipboardCheck className="size-3.5 sm:size-4 text-emerald-500" />
            <span>{t('inventory.startPhysicalCount')}</span>
          </button>
        </div>
      </div>

      {/* 2-Tier Universal Navigation Hub */}
      <WorkspaceNavigationHub<InventoryCategory, InventoryTab>
        categories={categories}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Tab Content Section */}
      <div className="pt-1">
        {activeTab === 'ledger' && <StockLedgerSection />}
        {activeTab === 'thresholds' && <StockThresholdsSection />}
        {activeTab === 'transfers' && <StockTransfersSection />}
        {activeTab === 'adjustments' && <StockAdjustmentsSection />}
        {activeTab === 'counts' && <StockCountsSection />}
      </div>

      {/* Modal: Explore Capabilities & Architecture Guide */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('inventory.guideModalTitle')}
        size="xl"
      >
        <div className="space-y-6">
          <div className="rounded-xl bg-primary-subtle/50 border border-primary/20 p-4">
            <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
              <Boxes className="size-4" />
              {t('inventory.guideModalHeader')}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {t('inventory.guideModalIntro')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="rounded-xl border border-default bg-surface p-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <TabIcon className="size-4" />
                        </div>
                        <h5 className="text-xs font-bold text-default">{tab.label}</h5>
                      </div>
                      {tab.badge && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-sunken text-muted border border-default">
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted leading-relaxed mb-3">{tab.description}</p>
                    <div className="space-y-1 mb-4">
                      {tab.highlights.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-default/80">
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={activeTab === tab.id ? 'primary' : 'secondary'}
                    className="w-full text-xs justify-between cursor-pointer"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsGuideOpen(false);
                    }}
                  >
                    <span>{activeTab === tab.id ? t('inventory.currentView') : t('inventory.switchTo', { label: tab.shortLabel })}</span>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-surface-sunken p-4 border border-default flex items-center justify-between">
            <div className="text-xs text-muted">
              {t('inventory.guideShortcut')}
            </div>
          </div>
        </div>
      </Modal>

      {/* Action Modals */}
      <StockTransferModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={() => {
          setActiveTab('transfers');
        }}
      />

      <StockAdjustmentModal
        open={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        onSuccess={() => {
          setActiveTab('adjustments');
        }}
      />
    </div>
  );
}
