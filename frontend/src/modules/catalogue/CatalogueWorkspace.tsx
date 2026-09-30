import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  FileCode,
  Package,
  Ruler,
  Tag,
  Users,
  Warehouse,
  Layers,
  Sparkles,
  Compass,
  ArrowRight,
  Zap,
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

import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

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

export interface CatalogueTabConfig extends WorkspaceTabConfig<CatalogueCategory, CatalogueTab> {
  highlights?: string[];
}

export default function CatalogueWorkspace() {
  const { t } = useTranslation(['catalogue', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<CatalogueTab>('products', VALID_TABS);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const categories: WorkspaceCategoryConfig<CatalogueCategory, CatalogueTab>[] = useMemo(() => [
    {
      id: 'products',
      label: t('catalogue.catProductsLabel'),
      tagline: t('catalogue.catProductsSub'),
      defaultTab: 'products',
      shortcut: '1',
      icon: Package,
      tabs: ['products', 'categories', 'brands', 'units'],
      theme: WORKSPACE_THEMES.indigo,
      badge: '4 Capabilities',
    },
    {
      id: 'engineering',
      label: t('catalogue.catEngineeringLabel'),
      tagline: t('catalogue.catEngineeringSub'),
      defaultTab: 'bom',
      shortcut: '2',
      icon: FileCode,
      tabs: ['bom'],
      theme: WORKSPACE_THEMES.purple,
      badge: '1 Capability',
    },
    {
      id: 'directories',
      label: t('catalogue.catDirectoriesLabel'),
      tagline: t('catalogue.catDirectoriesSub'),
      defaultTab: 'warehouses',
      shortcut: '3',
      icon: Warehouse,
      tabs: ['warehouses', 'parties'],
      theme: WORKSPACE_THEMES.teal,
      badge: '2 Directories',
    },
  ], [t]);

  const tabs: CatalogueTabConfig[] = useMemo(() => [
    {
      id: 'products',
      label: t('catalogue.tabProductsLabel'),
      shortLabel: t('catalogue.tabProductsLabel'),
      category: 'products',
      icon: Package,
      badge: 'Directory',
      description: t('catalogue.tabProductsDesc'),
      highlights: ['Multi-type catalog items', 'Barcode label printing', 'Storefront visibility & pricing'],
    },
    {
      id: 'categories',
      label: t('catalogue.tabCategoriesLabel'),
      shortLabel: t('catalogue.tabCategoriesLabel'),
      category: 'products',
      icon: Tag,
      badge: 'Taxonomy',
      description: t('catalogue.tabCategoriesDesc'),
      highlights: ['Multi-level subcategories', 'Category codes', 'Online storefront navigation'],
    },
    {
      id: 'brands',
      label: t('catalogue.tabBrandsLabel'),
      shortLabel: t('catalogue.tabBrandsLabel'),
      category: 'products',
      icon: Boxes,
      badge: 'Brands',
      description: t('catalogue.tabBrandsDesc'),
      highlights: ['Brand portfolio registry', 'Manufacturer logos', 'Trademark management'],
    },
    {
      id: 'units',
      label: t('catalogue.tabUnitsLabel'),
      shortLabel: t('catalogue.tabUnitsLabel'),
      category: 'products',
      icon: Ruler,
      badge: 'UoM',
      description: t('catalogue.tabUnitsDesc'),
      highlights: ['Piece, weight, volume', 'Box-to-piece conversions', 'Decimal precision'],
    },
    {
      id: 'bom',
      label: t('catalogue.tabBomLabel'),
      shortLabel: 'Recipes / BOM',
      category: 'engineering',
      icon: FileCode,
      badge: 'Formulas',
      description: t('catalogue.tabBomDesc'),
      highlights: ['Ingredient quantities', 'Expected wastage allowance', 'Production step sequence'],
    },
    {
      id: 'warehouses',
      label: t('catalogue.tabWarehousesLabel'),
      shortLabel: t('catalogue.tabWarehousesLabel'),
      category: 'directories',
      icon: Warehouse,
      badge: 'Storage',
      description: t('catalogue.tabWarehousesDesc'),
      highlights: ['Multiple storage buildings', 'Room & shelf zones', 'Stock transfer hubs'],
    },
    {
      id: 'parties',
      label: t('catalogue.tabPartiesLabel'),
      shortLabel: t('catalogue.tabPartiesLabel'),
      category: 'directories',
      icon: Users,
      badge: 'Contacts',
      description: t('catalogue.tabPartiesDesc'),
      highlights: ['Suppliers & buyers', 'Tax IDs & payment terms', 'Billing & shipping addresses'],
    },
  ], [t]);

  // Derive active category from current active tab
  const currentTabConfig = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;

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

      {/* Universal 2-Tier Navigation Hub */}
      <WorkspaceNavigationHub<CatalogueCategory, CatalogueTab>
        categories={categories}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

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

