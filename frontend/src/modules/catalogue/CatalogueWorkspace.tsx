import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  FileCode,
  Package,
  Ruler,
  Tag,
  Users,
  Warehouse,
  ChevronDown,
  Search,
  Check,
  Layers,
  Sparkles,
  Compass,
  ArrowRight,
  Zap,
  Plus,
} from 'lucide-react';
import { ProductsSection } from './sections/ProductsSection';
import { UnitsSection } from './sections/UnitsSection';
import { CategoriesSection } from './sections/CategoriesSection';
import { BrandsSection } from './sections/BrandsSection';
import { BillOfMaterialsSection } from './sections/BillOfMaterialsSection';
import { WarehousesSection } from './sections/WarehousesSection';
import { PartiesSection } from './sections/PartiesSection';

import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { cn } from '../../lib/utils';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export type CatalogueTab =
  | 'products'
  | 'units'
  | 'categories'
  | 'brands'
  | 'bom'
  | 'warehouses'
  | 'parties';

export type CatalogueCategory = 'products' | 'engineering' | 'directories';

const VALID_TABS: readonly CatalogueTab[] = [
  'products',
  'units',
  'categories',
  'brands',
  'bom',
  'warehouses',
  'parties',
];

interface TabConfig {
  id: CatalogueTab;
  label: string;
  category: CatalogueCategory;
  icon: typeof Package;
  badge?: string;
  description: string;
  highlights: string[];
}

interface CategoryConfig {
  id: CatalogueCategory;
  label: string;
  subtitle: string;
  defaultTab: CatalogueTab;
  badge: string;
  icon: typeof Package;
  shortcut: string;
}

export default function CatalogueWorkspace() {
  const { t } = useTranslation(['catalogue', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<CatalogueTab>('products', VALID_TABS);
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categories: CategoryConfig[] = useMemo(() => [
    {
      id: 'products',
      label: t('catalogue.catProductsLabel'),
      subtitle: t('catalogue.catProductsSub'),
      defaultTab: 'products',
      badge: '4 Capabilities',
      icon: Package,
      shortcut: '1',
    },
    {
      id: 'engineering',
      label: t('catalogue.catEngineeringLabel'),
      subtitle: t('catalogue.catEngineeringSub'),
      defaultTab: 'bom',
      badge: '1 Capability',
      icon: FileCode,
      shortcut: '2',
    },
    {
      id: 'directories',
      label: t('catalogue.catDirectoriesLabel'),
      subtitle: t('catalogue.catDirectoriesSub'),
      defaultTab: 'warehouses',
      badge: '2 Capabilities',
      icon: Warehouse,
      shortcut: '3',
    },
  ], [t]);

  const tabs: TabConfig[] = useMemo(() => [
    {
      id: 'products',
      label: t('catalogue.tabProductsLabel'),
      category: 'products',
      icon: Package,
      description: t('catalogue.tabProductsDesc'),
      highlights: ['Multi-type catalog items', 'Barcode label printing', 'Storefront visibility & pricing'],
    },
    {
      id: 'categories',
      label: t('catalogue.tabCategoriesLabel'),
      category: 'products',
      icon: Tag,
      description: t('catalogue.tabCategoriesDesc'),
      highlights: ['Multi-level subcategories', 'Category codes', 'Online storefront navigation'],
    },
    {
      id: 'brands',
      label: t('catalogue.tabBrandsLabel'),
      category: 'products',
      icon: Boxes,
      description: t('catalogue.tabBrandsDesc'),
      highlights: ['Brand portfolio registry', 'Manufacturer logos', 'Trademark management'],
    },
    {
      id: 'units',
      label: t('catalogue.tabUnitsLabel'),
      category: 'products',
      icon: Ruler,
      description: t('catalogue.tabUnitsDesc'),
      highlights: ['Piece, weight, volume', 'Box-to-piece conversions', 'Decimal precision'],
    },
    {
      id: 'bom',
      label: t('catalogue.tabBomLabel'),
      category: 'engineering',
      icon: FileCode,
      badge: 'Recipes',
      description: t('catalogue.tabBomDesc'),
      highlights: ['Ingredient quantities', 'Expected wastage allowance', 'Production step sequence'],
    },
    {
      id: 'warehouses',
      label: t('catalogue.tabWarehousesLabel'),
      category: 'directories',
      icon: Warehouse,
      description: t('catalogue.tabWarehousesDesc'),
      highlights: ['Multiple storage buildings', 'Room & shelf zones', 'Stock transfer hubs'],
    },
    {
      id: 'parties',
      label: t('catalogue.tabPartiesLabel'),
      category: 'directories',
      icon: Users,
      badge: 'Directory',
      description: t('catalogue.tabPartiesDesc'),
      highlights: ['Suppliers & buyers', 'Tax IDs & payment terms', 'Billing & shipping addresses'],
    },
  ], [t]);

  // Derive active category from current active tab
  const currentTabConfig = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;
  const activeCategory = currentTabConfig.category;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsQuickJumpOpen(false);
      }
    }
    if (isQuickJumpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQuickJumpOpen]);

  const handleCategorySelect = useCallback((catId: CatalogueCategory) => {
    const targetCat = categories.find((c) => c.id === catId);
    if (targetCat) {
      const existingInCat = tabs.find((t) => t.category === catId);
      if (existingInCat) {
        setActiveTab(existingInCat.id);
      }
    }
  }, [categories, tabs, setActiveTab]);

  const filteredTabs = useMemo(() => {
    if (!searchFilter.trim()) return tabs;
    const q = searchFilter.toLowerCase();
    return tabs.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [tabs, searchFilter]);

  // Global hotkeys (1, 2, 3) to switch category pillars when not typing in an input
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
        handleCategorySelect('products');
      } else if (e.key === '2') {
        e.preventDefault();
        handleCategorySelect('engineering');
      } else if (e.key === '3') {
        e.preventDefault();
        handleCategorySelect('directories');
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleCategorySelect]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <Layers className="size-3 text-primary" />
              {t('catalogue.masterDataBadge')}
            </span>
            <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
              {t('catalogue.submodulesAvailable')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-2.5">
            {currentTabConfig.label}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {currentTabConfig.description}
          </p>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2">
          {/* Capabilities Guide Button */}
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-primary/30 bg-primary-subtle hover:bg-primary/10 text-primary transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Open Catalog Capabilities and System Guide"
          >
            <Compass className="size-3.5 text-primary" />
            <span className="hidden sm:inline">{t('catalogue.exploreCapabilities')}</span>
            <span className="sm:hidden">{t('catalogue.guideShort')}</span>
          </button>

          {/* All Views Quick Jump Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsQuickJumpOpen((prev) => !prev);
                setSearchFilter('');
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs hover:border-primary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="All Catalog Views Jump Menu"
              aria-expanded={isQuickJumpOpen}
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{t('catalogue.allViews')}</span>
              <ChevronDown className={cn('size-3.5 text-muted transition-transform', isQuickJumpOpen && 'rotate-180')} />
            </button>

            {isQuickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-surface border border-default shadow-2xl z-50 p-2 text-default animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder={t('catalogue.jumpPlaceholder')}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
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
                        {catTabs.map((t) => {
                          const Icon = t.icon;
                          const isCurrent = activeTab === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(t.id);
                                setIsQuickJumpOpen(false);
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
                                <span className="truncate">{t.label}</span>
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

      {/* Non-Technical Workflow Guide: What to configure first */}
      <div className="bg-surface rounded-2xl border border-default p-3 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-xs font-bold text-default flex items-center gap-1.5">
              <span>{t('catalogue.recommendedSetup')}</span>
              <span className="text-[10px] text-muted font-normal">{t('catalogue.setupStepHint')}</span>
            </div>
            <p className="text-[11px] text-muted">{t('catalogue.clickStepHint')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
              activeTab === 'units' ? 'bg-primary text-primary-fg' : 'bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default'
            )}
          >
            <span className="size-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">1</span>
            <span>{t('catalogue.tabUnitsLabel')}</span>
          </button>
          <ArrowRight className="size-3 text-muted/50 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
              activeTab === 'categories' ? 'bg-primary text-primary-fg' : 'bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default'
            )}
          >
            <span className="size-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">2</span>
            <span>{t('catalogue.tabCategoriesLabel')}</span>
          </button>
          <ArrowRight className="size-3 text-muted/50 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
              activeTab === 'products' ? 'bg-primary text-primary-fg' : 'bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default'
            )}
          >
            <span className="size-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">3</span>
            <span>{t('catalogue.tabProductsLabel')}</span>
          </button>
          <ArrowRight className="size-3 text-muted/50 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setActiveTab('bom')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
              activeTab === 'bom' ? 'bg-primary text-primary-fg' : 'bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default'
            )}
          >
            <span className="size-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">4</span>
            <span>{t('catalogue.tabBomLabel')}</span>
          </button>
        </div>
      </div>

      {/* Universal Catalogue & Master Data Quick-Action Ribbon */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-default">
              <Zap className="size-3.5 text-amber-500 fill-amber-500" />
              <span>{t('catalogue.quickActionsTitle')}</span>
            </div>
            <p className="text-[11px] text-muted">
              {t('catalogue.quickActionsDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{t('catalogue.addProductItem')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bom')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <FileCode className="size-3.5 text-primary" />
              <span>{t('catalogue.createRecipeBom')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <Tag className="size-3.5 text-blue-500" />
              <span>{t('catalogue.categoriesBrands')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('warehouses')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <Warehouse className="size-3.5 text-cyan-600" />
              <span>{t('catalogue.warehousesBins')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary 3 Command Pillars (with Visible Embedded Sub-Pills) */}
      <div
        role="tablist"
        aria-label="Catalogue Subsystems"
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {categories.map((cat) => {
          const isCategorySelected = activeCategory === cat.id;
          const Icon = cat.icon;
          const childTabs = tabs.filter((t) => t.category === cat.id);

          return (
            <div
              key={cat.id}
              role="tab"
              aria-selected={isCategorySelected}
              tabIndex={isCategorySelected ? 0 : -1}
              onClick={() => handleCategorySelect(cat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCategorySelect(cat.id);
                }
              }}
              className={cn(
                'group relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer shadow-2xs',
                isCategorySelected
                  ? 'bg-surface border-primary shadow-md ring-2 ring-primary/10'
                  : 'bg-surface hover:bg-surface-sunken border-default hover:border-default/80'
              )}
            >
              {/* Top Header of the Pillar */}
              <div className="flex items-start gap-3 w-full">
                <div
                  className={cn(
                    'size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs',
                    isCategorySelected
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'bg-surface-sunken border border-default text-muted group-hover:text-default'
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', isCategorySelected ? 'text-primary-fg' : 'text-muted group-hover:text-default')} />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'text-xs font-bold transition-colors truncate',
                          isCategorySelected ? 'text-default' : 'text-default/90 group-hover:text-default'
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
                        isCategorySelected
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-surface-sunken text-muted border-default'
                      )}
                    >
                      {cat.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted line-clamp-1">{cat.subtitle}</p>
                </div>
              </div>

              {/* Embedded Direct Child Tabs (Always Visible for Instant 1-Click Access) */}
              <div className="mt-3.5 pt-2.5 border-t border-default/60 flex flex-wrap gap-1.5 w-full">
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
                          ? 'bg-primary text-primary-fg font-semibold shadow-xs ring-1 ring-primary/30'
                          : 'bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default/60'
                      )}
                      title={subTab.description}
                    >
                      <SubIcon className={cn('size-3', isCurrent ? 'text-primary-fg' : 'text-muted')} />
                      <span>{subTab.label}</span>
                      {isCurrent && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Active Indicator Bar */}
              {isCategorySelected && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Unified Grouped Navigation Ribbon Bar (All 7 Sub-Modules Visible Simultaneously) */}
      <div className="bg-surface-sunken rounded-2xl border border-default p-2 shadow-2xs">
        <div className="flex items-center justify-between px-2 pb-1.5 mb-1 text-[11px] font-semibold text-muted border-b border-default/50">
          <div className="flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            <span>{t('catalogue.masterNavRibbon')}</span>
          </div>
          <span className="text-[10px] font-mono text-muted/70">
            {t('catalogue.activeRibbonLabel')} <strong className="text-default">{currentTabConfig.label}</strong>
          </span>
        </div>

        <nav
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="All 7 Catalog Sub-Modules"
        >
          {/* Group 1: Catalog */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('catalogue.groupCatalog')}
            </span>
            {tabs.filter((t) => t.category === 'products').map((tab) => {
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
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-default hidden sm:block" />

          {/* Group 2: Manufacturing */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('catalogue.groupManufacturing')}
            </span>
            {tabs.filter((t) => t.category === 'engineering').map((tab) => {
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
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider',
                        isActive ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-default hidden sm:block" />

          {/* Group 3: Directory & Facilities */}
          <div className="flex items-center gap-1.5 bg-surface/60 p-1 rounded-xl border border-default/40">
            <span className="text-[10px] font-mono uppercase font-bold text-muted px-2 py-0.5 select-none">
              {t('catalogue.groupDirectory')}
            </span>
            {tabs.filter((t) => t.category === 'directories').map((tab) => {
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
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider',
                        isActive ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Tab Section Content */}
      <div className="pt-1">
        {activeTab === 'products' && <ProductsSection />}
        {activeTab === 'units' && <UnitsSection />}
        {activeTab === 'categories' && <CategoriesSection />}
        {activeTab === 'brands' && <BrandsSection />}
        {activeTab === 'bom' && <BillOfMaterialsSection />}
        {activeTab === 'warehouses' && <WarehousesSection />}
        {activeTab === 'parties' && <PartiesSection />}
      </div>

      {/* Capabilities & System Guide Modal */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('catalogue.guideModalTitle')}
        size="xl"
      >
        <div className="space-y-5 p-1 text-default">
          <p className="text-xs text-muted leading-relaxed">
            {t('catalogue.guideModalIntro')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                          {t('catalogue.currentTabBadge')}
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
                    <span>{isCurrent ? t('catalogue.viewingNow') : t('catalogue.openTab', { label: tab.label })}</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-default bg-surface-sunken p-3.5 space-y-1.5 text-xs">
            <h5 className="font-bold text-default flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              {t('catalogue.shortcutsTitle')}
            </h5>
            <ul className="text-[11px] text-muted space-y-1 list-disc list-inside">
              <li>{t('catalogue.shortcut1')}</li>
              <li>{t('catalogue.shortcut2')}</li>
              <li>{t('catalogue.shortcut3')}</li>
              <li>{t('catalogue.shortcutEsc')}</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

