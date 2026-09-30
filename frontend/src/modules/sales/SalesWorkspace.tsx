import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Receipt,
  ShoppingCart,
  Truck,
  Undo2,
  Users,
  Target,
  Award,
  UserCheck,
  TrendingUp,
  Search,
  Store,
  Layers,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  Zap,
  Check,
  ArrowLeftRight,
  Tag,
} from 'lucide-react';
import { SalesOrdersSection } from './sections/SalesOrdersSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { DeliveriesSection } from './sections/DeliveriesSection';
import { PaymentsSection } from './sections/PaymentsSection';
import { SalesReturnsSection } from './sections/SalesReturnsSection';
import { ExchangesSection } from './sections/ExchangesSection';
import { LeadsSection } from './sections/LeadsSection';
import { CustomersSection } from './sections/CustomersSection';
import { SalesmenProfilesSection } from './sections/SalesmenProfilesSection';
import { SalesmanTargetsSection } from './sections/SalesmanTargetsSection';
import { IncentivesSection } from './sections/IncentivesSection';
import { SalesmanDashboardSection } from './sections/SalesmanDashboardSection';
import { PriceListsSection } from './sections/PriceListsSection';

import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

export type SalesTab =
  | 'orders'
  | 'invoices'
  | 'deliveries'
  | 'payments'
  | 'returns'
  | 'exchanges'
  | 'customers'
  | 'leads'
  | 'pricelists'
  | 'salesmen'
  | 'targets'
  | 'incentives'
  | 'dashboard';

const VALID_TABS: readonly SalesTab[] = [
  'orders',
  'invoices',
  'deliveries',
  'payments',
  'returns',
  'exchanges',
  'customers',
  'leads',
  'pricelists',
  'salesmen',
  'targets',
  'incentives',
  'dashboard',
];

export type SalesCategory = 'operations' | 'crm' | 'performance';

interface TabConfig {
  id: SalesTab;
  label: string;
  shortLabel: string;
  category: SalesCategory;
  icon: typeof ShoppingCart;
  description: string;
  highlights: string[];
  badge?: string;
  step?: number;
}

interface CategoryConfig {
  id: SalesCategory;
  label: string;
  tagline: string;
  icon: typeof Layers;
  tabs: SalesTab[];
  defaultTab: SalesTab;
  shortcut: string;
  badge: string;
}

const CATEGORY_THEMES: Record<
  SalesCategory,
  {
    activePill: string;
    activeIcon: string;
    activeBadge: string;
    inactiveText: string;
    inactiveHover: string;
    inactiveIcon: string;
    inactiveBadge: string;
    accentDot: string;
    subTabActive: string;
    subTabActiveIcon: string;
    subTabActiveBadge: string;
  }
> = {
  operations: {
    activePill:
      'bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30',
    inactiveIcon: 'text-indigo-600 dark:text-indigo-400',
    inactiveBadge:
      'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 font-semibold',
    accentDot: 'bg-indigo-500',
    subTabActive:
      'bg-linear-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-indigo-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
  crm: {
    activePill:
      'bg-linear-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30',
    inactiveIcon: 'text-purple-600 dark:text-purple-400',
    inactiveBadge:
      'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 font-semibold',
    accentDot: 'bg-purple-500',
    subTabActive:
      'bg-linear-to-r from-violet-600 to-purple-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-purple-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
  performance: {
    activePill:
      'bg-linear-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30',
    inactiveIcon: 'text-amber-600 dark:text-amber-400',
    inactiveBadge:
      'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 font-semibold',
    accentDot: 'bg-amber-500',
    subTabActive:
      'bg-linear-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-xs font-semibold ring-2 ring-orange-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
};

export default function SalesWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useWorkspaceTab<SalesTab>('orders', VALID_TABS);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<number | null>(null);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  // Redirect duplicate dashboard tab to canonical executive sales dashboard perspective
  useEffect(() => {
    if (activeTab === 'dashboard') {
      navigate('/dashboard?view=sales', { replace: true });
    }
  }, [activeTab, navigate]);

  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        id: 'operations',
        label: t('sales.categories.operations.label'),
        tagline: t('sales.categories.operations.tagline'),
        icon: Layers,
        tabs: ['orders', 'invoices', 'deliveries', 'payments', 'returns', 'exchanges'],
        defaultTab: 'orders',
        shortcut: '1',
        badge: t('sales.categories.operations.badge'),
      },
      {
        id: 'crm',
        label: t('sales.categories.crm.label'),
        tagline: t('sales.categories.crm.tagline'),
        icon: Users,
        tabs: ['leads', 'customers', 'pricelists'],
        defaultTab: 'leads',
        shortcut: '2',
        badge: t('sales.categories.crm.badge'),
      },
      {
        id: 'performance',
        label: t('sales.categories.performance.label'),
        tagline: t('sales.categories.performance.tagline'),
        icon: TrendingUp,
        tabs: ['salesmen', 'targets', 'incentives'],
        defaultTab: 'salesmen',
        shortcut: '3',
        badge: t('sales.categories.performance.badge'),
      },
    ],
    [t]
  );

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'orders',
        label: t('sales.tabs.orders.label'),
        shortLabel: t('sales.tabs.orders.shortLabel'),
        category: 'operations',
        step: 1,
        icon: ShoppingCart,
        description: t('sales.tabs.orders.description'),
        highlights: (t('sales.tabs.orders.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'invoices',
        label: t('sales.tabs.invoices.label'),
        shortLabel: t('sales.tabs.invoices.shortLabel'),
        category: 'operations',
        step: 2,
        icon: FileText,
        description: t('sales.tabs.invoices.description'),
        highlights: (t('sales.tabs.invoices.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'deliveries',
        label: t('sales.tabs.deliveries.label'),
        shortLabel: t('sales.tabs.deliveries.shortLabel'),
        category: 'operations',
        step: 3,
        icon: Truck,
        description: t('sales.tabs.deliveries.description'),
        highlights: (t('sales.tabs.deliveries.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'payments',
        label: t('sales.tabs.payments.label'),
        shortLabel: t('sales.tabs.payments.shortLabel'),
        category: 'operations',
        step: 4,
        icon: Receipt,
        description: t('sales.tabs.payments.description'),
        highlights: (t('sales.tabs.payments.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'returns',
        label: t('sales.tabs.returns.label'),
        shortLabel: t('sales.tabs.returns.shortLabel'),
        category: 'operations',
        badge: t('sales.tabs.returns.badge'),
        icon: Undo2,
        description: t('sales.tabs.returns.description'),
        highlights: (t('sales.tabs.returns.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'exchanges',
        label: t('sales.tabs.exchanges.label'),
        shortLabel: t('sales.tabs.exchanges.shortLabel'),
        category: 'operations',
        badge: t('sales.tabs.exchanges.badge'),
        icon: ArrowLeftRight,
        description: t('sales.tabs.exchanges.description'),
        highlights: (t('sales.tabs.exchanges.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'leads',
        label: t('sales.tabs.leads.label'),
        shortLabel: t('sales.tabs.leads.shortLabel'),
        category: 'crm',
        badge: t('sales.tabs.leads.badge'),
        icon: UserCheck,
        description: t('sales.tabs.leads.description'),
        highlights: (t('sales.tabs.leads.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'customers',
        label: t('sales.tabs.customers.label'),
        shortLabel: t('sales.tabs.customers.shortLabel'),
        category: 'crm',
        badge: t('sales.tabs.customers.badge'),
        icon: Users,
        description: t('sales.tabs.customers.description'),
        highlights: (t('sales.tabs.customers.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'pricelists',
        label: t('sales.tabs.pricelists.label'),
        shortLabel: t('sales.tabs.pricelists.shortLabel'),
        category: 'crm',
        badge: t('sales.tabs.pricelists.badge'),
        icon: Tag,
        description: t('sales.tabs.pricelists.description'),
        highlights: (t('sales.tabs.pricelists.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'salesmen',
        label: t('sales.tabs.salesmen.label'),
        shortLabel: t('sales.tabs.salesmen.shortLabel'),
        category: 'performance',
        badge: t('sales.tabs.salesmen.badge'),
        icon: UserCheck,
        description: t('sales.tabs.salesmen.description'),
        highlights: (t('sales.tabs.salesmen.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'targets',
        label: t('sales.tabs.targets.label'),
        shortLabel: t('sales.tabs.targets.shortLabel'),
        category: 'performance',
        badge: t('sales.tabs.targets.badge'),
        icon: Target,
        description: t('sales.tabs.targets.description'),
        highlights: (t('sales.tabs.targets.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'incentives',
        label: t('sales.tabs.incentives.label'),
        shortLabel: t('sales.tabs.incentives.shortLabel'),
        category: 'performance',
        badge: t('sales.tabs.incentives.badge'),
        icon: Award,
        description: t('sales.tabs.incentives.description'),
        highlights: (t('sales.tabs.incentives.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'dashboard',
        label: t('sales.tabs.dashboard.label'),
        shortLabel: t('sales.tabs.dashboard.shortLabel'),
        category: 'performance',
        badge: t('sales.tabs.dashboard.badge'),
        icon: TrendingUp,
        description: t('sales.tabs.dashboard.description'),
        highlights: (t('sales.tabs.dashboard.highlights', { returnObjects: true }) as string[]) || [],
      },
    ],
    [t]
  );

  // Derive active category from current active tab
  const activeCategory = categories.find((cat) => cat.tabs.includes(activeTab))?.id ?? 'operations';
  const activeCategoryConfig: CategoryConfig =
    categories.find((cat) => cat.id === activeCategory) ?? categories[0]!;
  const currentTab: TabConfig = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;
  const CategoryIcon = activeCategoryConfig.icon;
  const currentCategoryTheme = CATEGORY_THEMES[activeCategory];

  // Remember last visited tab per category for seamless back-and-forth switching
  const lastActivePerCategory = useRef<Record<SalesCategory, SalesTab>>({
    operations: 'orders',
    crm: 'leads',
    performance: 'salesmen',
  });

  useEffect(() => {
    const cat = categories.find((c) => c.tabs.includes(activeTab))?.id;
    if (cat) {
      lastActivePerCategory.current[cat] = activeTab;
    }
  }, [activeTab, categories]);

  // Close Quick Jump popover on click outside
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

  const handleSelectCategory = useCallback(
    (categoryId: SalesCategory) => {
      if (categoryId === activeCategory) return;
      const targetTab =
        lastActivePerCategory.current[categoryId] ??
        categories.find((cat) => cat.id === categoryId)?.defaultTab ??
        'orders';
      setActiveTab(targetTab);
    },
    [activeCategory, categories, setActiveTab]
  );

  // Global hotkeys (1, 2, 3) to switch category pillars when outside form inputs
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        handleSelectCategory('operations');
      } else if (e.key === '2') {
        e.preventDefault();
        handleSelectCategory('crm');
      } else if (e.key === '3') {
        e.preventDefault();
        handleSelectCategory('performance');
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSelectCategory]);

  const filteredTabs = searchQuery.trim()
    ? tabs.filter(
        (t) =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.shortLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header & Action Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-default pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {t('sales.workspaceTag')}
            </span>
            <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
              {t('sales.modulesCount')}
            </span>
            <span className="text-muted/40 text-xs">/</span>
            <span className="text-[11px] font-medium text-muted flex items-center gap-1">
              <CategoryIcon className="size-3 text-muted" />
              {activeCategoryConfig.label}
            </span>
            <span className="text-muted/40 text-xs">/</span>
            <span className="text-[11px] font-semibold text-default">
              {currentTab?.label}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
            <span>{currentTab?.label}</span>
            {currentTab?.badge && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {currentTab.badge}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {currentTab?.description}
          </p>
        </div>

        {/* Quick External Actions & Guides */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            to="/dashboard?view=sales"
            className="flex items-center gap-1.5 px-3 py-2 bg-linear-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl border border-indigo-500/30 shadow-2xs transition-all"
            title="Open Executive Sales Cockpit in Dashboard"
          >
            <TrendingUp className="size-3.5 text-indigo-500" />
            <span>Sales Cockpit</span>
          </Link>

          <Link
            to="/pos"
            className="flex items-center gap-1.5 px-3 py-2 bg-linear-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/30 shadow-2xs transition-all"
            title="Open Point of Sale Terminal"
          >
            <Store className="size-3.5 text-emerald-500" />
            <span>{t('sales.openPos')}</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={t('sales.exploreCapabilitiesTitle')}
          >
            <Compass className="size-3.5 text-muted" />
            <span>{t('sales.exploreCapabilities')}</span>
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
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer',
                quickJumpOpen && 'border-primary/40 bg-surface-sunken'
              )}
              title={t('sales.jumpTitle')}
            >
              <SlidersHorizontal className="size-3.5 text-muted" />
              <span>{t('sales.allViews')}</span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-surface border border-default shadow-2xl z-50 p-2 text-default animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder={t('sales.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-sunken border border-default rounded-xl outline-hidden focus:border-primary text-default placeholder:text-muted"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1">
                  {categories.map((cat) => {
                    const catTabs = filteredTabs.filter((t) => t.category === cat.id);
                    if (catTabs.length === 0) return null;
                    return (
                      <div key={cat.id} className="pt-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
                          {cat.label}
                        </div>
                        {catTabs.map((tb) => {
                          const Icon = tb.icon;
                          const isCurrent = activeTab === tb.id;
                          return (
                            <button
                              key={tb.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(tb.id);
                                setQuickJumpOpen(false);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left',
                                isCurrent
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-default hover:bg-surface-sunken'
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="size-3.5 shrink-0 text-muted" />
                                <span className="truncate">{tb.label}</span>
                              </div>
                              {isCurrent && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-Tier Enterprise Navigation Hub */}
      <div className="bg-surface rounded-2xl border border-default p-3 shadow-2xs space-y-3">
        {/* Tier 1: Domain Segmented Selector (Centered with Rich Category Theming) */}
        <div className="flex flex-col items-center justify-center gap-2 pb-3 border-b border-default/50">
          <div className="inline-flex items-center justify-center p-1.5 bg-surface-sunken/90 dark:bg-surface-sunken/60 rounded-2xl border border-default/60 shadow-inner gap-1.5 flex-wrap">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = activeCategory === cat.id;
              const catTabs = tabs.filter((tb) => tb.category === cat.id);
              const theme = CATEGORY_THEMES[cat.id];

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={cn(
                    'group relative flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none border',
                    isSelected
                      ? cn(theme.activePill, 'scale-[1.02]')
                      : cn(
                          'border-transparent bg-transparent',
                          theme.inactiveText,
                          theme.inactiveHover
                        )
                  )}
                  title={`${cat.label} — ${cat.tagline}`}
                >
                  <CatIcon
                    className={cn(
                      'size-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                      isSelected ? theme.activeIcon : theme.inactiveIcon
                    )}
                  />
                  <span className="tracking-tight">{cat.label}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors font-bold',
                      isSelected ? theme.activeBadge : theme.inactiveBadge
                    )}
                  >
                    {catTabs.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Centered Domain Context & Tagline */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted font-medium pt-0.5 animate-in fade-in duration-200">
            <span className={cn('size-2 rounded-full animate-pulse', currentCategoryTheme.accentDot)} />
            <span className="text-[11.5px] font-medium text-muted">
              {activeCategoryConfig.tagline}
            </span>
          </div>
        </div>

        {/* Tier 2: Focused Contextual Sub-Module Tabs (Centered, single row responsive) */}
        <div className="flex items-center justify-center pt-0.5">
          <div
            role="tablist"
            aria-label={`${activeCategoryConfig.label} Sub-Modules`}
            className="flex items-center justify-center gap-1.5 flex-wrap"
          >
            {tabs
              .filter((tb) => tb.category === activeCategory)
              .map((tab) => {
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
                      'group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer shrink-0 select-none border',
                      isActive
                        ? cn(currentCategoryTheme.subTabActive)
                        : 'border-default/50 bg-surface hover:bg-surface-sunken hover:border-default text-muted hover:text-default shadow-2xs'
                    )}
                    title={tab.description}
                  >
                    <Icon
                      className={cn(
                        'size-3.5 shrink-0 transition-transform group-hover:scale-110',
                        isActive ? currentCategoryTheme.subTabActiveIcon : 'text-muted group-hover:text-default'
                      )}
                    />
                    <span className="hidden 2xl:inline">{tab.label}</span>
                    <span className="2xl:hidden">{tab.shortLabel}</span>
                    {tab.badge && (
                      <span
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider',
                          isActive
                            ? currentCategoryTheme.subTabActiveBadge
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Capabilities & Commercial Guide Modal */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('sales.guide.modalTitle')}
        size="xl"
      >
        <div className="space-y-5 p-1 text-default">
          <p className="text-xs text-muted leading-relaxed">
            {t('sales.guide.heroDesc')}
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
                        <h4 className="text-xs font-bold text-default">{tab.label}</h4>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded-full border border-primary/20">
                          {t('sales.guide.currentTab')}
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
                    <span>{isCurrent ? t('sales.guide.viewingNow') : t('sales.guide.open', { label: tab.label })}</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-default bg-surface-sunken p-3.5 space-y-1.5 text-xs">
            <h5 className="font-bold text-default flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              {t('sales.guide.shortcutsTitle')}
            </h5>
            <ul className="text-[11px] text-muted space-y-1 list-disc list-inside">
              <li>{t('sales.guide.shortcut1')}</li>
              <li>{t('sales.guide.shortcut2')}</li>
              <li>{t('sales.guide.shortcut3')}</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Tab Content Canvas */}
      <div className="pt-1">
        {activeTab === 'orders' && (
          <SalesOrdersSection onNavigateToTab={(tab) => setActiveTab(tab as SalesTab)} />
        )}
        {activeTab === 'invoices' && (
          <InvoicesSection onNavigateToTab={(tab) => setActiveTab(tab as SalesTab)} />
        )}
        {activeTab === 'deliveries' && <DeliveriesSection />}
        {activeTab === 'payments' && <PaymentsSection />}
        {activeTab === 'returns' && <SalesReturnsSection />}
        {activeTab === 'exchanges' && <ExchangesSection />}
        {activeTab === 'customers' && <CustomersSection />}
        {activeTab === 'leads' && <LeadsSection />}
        {activeTab === 'pricelists' && <PriceListsSection />}
        {activeTab === 'salesmen' && (
          <SalesmenProfilesSection
            onSelectSalesmanForDashboard={(empId) => {
              setSelectedSalesmanId(empId);
              setActiveTab('dashboard');
            }}
          />
        )}
        {activeTab === 'targets' && <SalesmanTargetsSection />}
        {activeTab === 'incentives' && <IncentivesSection />}
        {activeTab === 'dashboard' && (
          <SalesmanDashboardSection initialSalesmanId={selectedSalesmanId} />
        )}
      </div>
    </div>
  );
}
