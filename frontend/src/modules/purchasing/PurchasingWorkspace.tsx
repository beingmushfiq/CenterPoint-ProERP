import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Undo2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
  Compass,
  ArrowRight,
  Zap,
} from 'lucide-react';
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

export type PurchasingTab = 'requisitions' | 'orders' | 'receipts' | 'bills' | 'returns';
export type PurchasingCategory = 'sourcing' | 'fulfillment' | 'returns';

const VALID_TABS: readonly PurchasingTab[] = ['requisitions', 'orders', 'receipts', 'bills', 'returns'];

interface TabConfig {
  id: PurchasingTab;
  category: PurchasingCategory;
  label: string;
  shortLabel: string;
  step?: number;
  badge?: string;
  icon: typeof ShoppingCart;
  description: string;
  highlights: string[];
}

interface CategoryConfig {
  id: PurchasingCategory;
  label: string;
  shortcut: string;
  icon: typeof ShoppingCart;
  description: string;
  defaultTab: PurchasingTab;
}

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

  const categories: CategoryConfig[] = useMemo(() => [
    {
      id: 'sourcing',
      label: t('purchasing.catSourcingLabel'),
      shortcut: '1',
      icon: ShoppingCart,
      description: t('purchasing.catSourcingDesc'),
      defaultTab: 'orders',
    },
    {
      id: 'fulfillment',
      label: t('purchasing.catFulfillmentLabel'),
      shortcut: '2',
      icon: PackageCheck,
      description: t('purchasing.catFulfillmentDesc'),
      defaultTab: 'receipts',
    },
    {
      id: 'returns',
      label: t('purchasing.catReturnsLabel'),
      shortcut: '3',
      icon: Undo2,
      description: t('purchasing.catReturnsDesc'),
      defaultTab: 'returns',
    },
  ], [t]);

  const tabs: TabConfig[] = useMemo(() => [
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
      category: 'returns',
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
  const activeCategory = currentTab.category;

  // Global Keyboard Shortcuts (1, 2, 3 to switch domain pillars)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when typing in form inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        setActiveTab('requisitions');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('orders');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('receipts');
      } else if (e.key === '4') {
        e.preventDefault();
        setActiveTab('bills');
      } else if (e.key === '5') {
        e.preventDefault();
        setActiveTab('returns');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

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
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
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
      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-surface border border-default shadow-xs flex-wrap">
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

      {/* 5-Stage Procurement Pipeline Execution Ribbon */}
      <div className="bg-surface rounded-2xl border border-default p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
              5
            </div>
            <div>
              <span className="text-xs font-bold text-default">{t('purchasing.p2pPipelineTitle')}</span>
              <span className="text-[11px] text-muted ml-2 hidden sm:inline">
                {t('purchasing.p2pPipelineDesc')}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium text-muted">
            {t('purchasing.pipelineStageSwitch', { step: currentTab.step })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0',
                  isTabActive
                    ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                    : 'bg-surface-sunken hover:bg-surface border-default text-muted hover:text-default'
                )}
              >
                <div
                  className={cn(
                    'size-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 transition-colors',
                    isTabActive
                      ? 'bg-primary text-primary-fg'
                      : 'bg-surface border border-default text-muted group-hover:text-default'
                  )}
                >
                  {tab.step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                    <TabIcon className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{tab.shortLabel}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary 3 Command Pillars (with Embedded Direct Child Pills) */}
      <div
        role="tablist"
        aria-label="Procurement Operational Domains"
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {categories.map((cat) => {
          const isCatActive = activeCategory === cat.id;
          const Icon = cat.icon;
          const childTabs = tabs.filter((t) => t.category === cat.id);

          return (
            <div
              key={cat.id}
              role="tab"
              aria-selected={isCatActive}
              tabIndex={isCatActive ? 0 : -1}
              onClick={() => setActiveTab(cat.defaultTab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(cat.defaultTab);
                }
              }}
              className={cn(
                'group relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer shadow-2xs',
                isCatActive
                  ? 'bg-surface border-primary shadow-md ring-2 ring-primary/10'
                  : 'bg-surface hover:bg-surface-sunken border-default hover:border-default/80'
              )}
            >
              {/* Pillar Top Header */}
              <div className="flex items-start gap-3 w-full">
                <div
                  className={cn(
                    'size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs',
                    isCatActive
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'bg-surface-sunken border border-default text-muted group-hover:text-default'
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', isCatActive ? 'text-primary-fg' : 'text-muted group-hover:text-default')} />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'text-xs font-bold transition-colors truncate',
                          isCatActive ? 'text-default' : 'text-default/90 group-hover:text-default'
                        )}
                      >
                        {cat.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted/70 font-semibold px-1 py-0.2 rounded bg-surface-sunken border border-default/50 select-none">
                        [{cat.shortcut}]
                      </span>
                    </div>

                    <span
                      className={cn(
                        'text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shrink-0',
                        isCatActive
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-surface-sunken text-muted border-default'
                      )}
                    >
                      {childTabs.length === 1 ? t('purchasing.viewCount') : t('purchasing.viewsCount', { count: childTabs.length })}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </div>

              {/* In-Pillar Quick Navigation Pills (100% Zero Concealed Views) */}
              <div className="mt-3.5 pt-3 border-t border-default/60 flex flex-wrap items-center gap-1.5">
                {childTabs.map((subTab) => {
                  const isCurrent = activeTab === subTab.id;
                  const SubIcon = subTab.icon;
                  return (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(subTab.id);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer',
                        isCurrent
                          ? 'bg-primary text-primary-fg font-semibold shadow-xs ring-1 ring-primary'
                          : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default/70'
                      )}
                      title={`Open ${subTab.label}`}
                    >
                      {subTab.step && (
                        <span className={cn('text-[9px] font-mono font-bold', isCurrent ? 'text-primary-fg' : 'text-primary')}>
                          {t('purchasing.stageLabel', { step: subTab.step })}
                        </span>
                      )}
                      <SubIcon className={cn('size-3', isCurrent ? 'text-primary-fg' : 'text-muted')} />
                      <span>{subTab.shortLabel}</span>
                      {isCurrent && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Active Indicator Bar */}
              {isCatActive && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Master Sequential Navigation Ribbon (All 5 Stages Visible Simultaneously) */}
      <div className="bg-surface-sunken rounded-2xl border border-default p-2 shadow-2xs">
        <div className="flex items-center justify-between px-2 pb-1.5 mb-1 text-[11px] font-semibold text-muted border-b border-default/50">
          <div className="flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            <span>{t('purchasing.p2pSequentialRibbon')}</span>
          </div>
          <span className="text-[10px] font-mono text-muted/70">
            {t('purchasing.activeRibbonLabel')} <strong className="text-default">{currentTab?.label}</strong>
          </span>
        </div>

        <nav
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="All 5 Procurement Stages"
        >
          {/* Cluster 1: Upstream Sourcing */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('purchasing.clusterSourcing')}
            </span>
            {tabs.filter((t) => t.category === 'sourcing').map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-muted hover:text-default hover:bg-surface border border-transparent'
                  )}
                >
                  {tab.step && (
                    <span className={cn('text-[10px] font-mono font-bold px-1 rounded', isActive ? 'bg-primary-fg/20 text-primary-fg' : 'bg-surface text-muted')}>
                      {tab.step}
                    </span>
                  )}
                  <Icon className={cn('size-3.5', isActive ? 'text-primary-fg' : 'text-muted')} />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <ChevronRight className="size-3.5 text-muted/40 shrink-0 hidden sm:block" />

          {/* Cluster 2: Inbound Gate & AP Settlement */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('purchasing.clusterSettlement')}
            </span>
            {tabs.filter((t) => t.category === 'fulfillment').map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-muted hover:text-default hover:bg-surface border border-transparent'
                  )}
                >
                  {tab.step && (
                    <span className={cn('text-[10px] font-mono font-bold px-1 rounded', isActive ? 'bg-primary-fg/20 text-primary-fg' : 'bg-surface text-muted')}>
                      {tab.step}
                    </span>
                  )}
                  <Icon className={cn('size-3.5', isActive ? 'text-primary-fg' : 'text-muted')} />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-default hidden sm:block" />

          {/* Cluster 3: Reversals & Debit Notes */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('purchasing.clusterClaims')}
            </span>
            {tabs.filter((t) => t.category === 'returns').map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-muted hover:text-default hover:bg-surface border border-transparent'
                  )}
                >
                  <Icon className={cn('size-3.5', isActive ? 'text-primary-fg' : 'text-muted')} />
                  <span>{tab.shortLabel}</span>
                  {tab.badge && (
                    <span className={cn('text-[9px] font-mono px-1 rounded', isActive ? 'bg-primary-fg/20 text-primary-fg' : 'bg-surface-sunken text-muted')}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

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
                      {tab.highlights.map((h, i) => (
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
