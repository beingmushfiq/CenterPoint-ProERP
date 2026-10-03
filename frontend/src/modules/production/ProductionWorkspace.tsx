import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Factory,
  Users,
  Compass,
  Zap,
  Workflow,
  BookOpen,
  Boxes,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { ProductionPlansSection } from './sections/ProductionPlansSection';
import { ProductionBatchesSection } from './sections/ProductionBatchesSection';
import { WorkerProductionSection } from './sections/WorkerProductionSection';
import { ManufacturingVarianceRadar } from './components/ManufacturingVarianceRadar';
import { LaunchBatchModal } from './modals/LaunchBatchModal';
import { RecordBatchOutputModal } from './modals/RecordBatchOutputModal';

import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export type ProductionCategory = 'planning' | 'execution';
export type ProductionTab = 'plans' | 'batches' | 'worker-entries' | 'variance-radar';

export interface ProductionTabConfig extends WorkspaceTabConfig<ProductionCategory, ProductionTab> {
  step: number;
}

const VALID_TABS: readonly ProductionTab[] = ['plans', 'batches', 'worker-entries', 'variance-radar'];

export default function ProductionWorkspace() {
  const { t } = useTranslation(['production', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<ProductionTab>('plans', VALID_TABS);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);

  const categories: WorkspaceCategoryConfig<ProductionCategory, ProductionTab>[] = useMemo(
    () => [
      {
        id: 'planning',
        label: t('production.pillar1Title', { defaultValue: 'Planning & Batches' }),
        tagline: t('production.pillar1Desc', { defaultValue: 'Work orders, batch schedules & bill of materials' }),
        shortcut: '1',
        icon: Workflow,
        tabs: ['plans', 'batches'],
        defaultTab: 'plans',
        theme: WORKSPACE_THEMES.indigo,
      },
      {
        id: 'execution',
        label: t('production.pillar2Title', { defaultValue: 'Floor Operations & Costing' }),
        tagline: t('production.pillar2Desc', { defaultValue: 'Worker shifts, hourly wages, output & cost variance' }),
        shortcut: '2',
        icon: Users,
        tabs: ['worker-entries', 'variance-radar'],
        defaultTab: 'worker-entries',
        theme: WORKSPACE_THEMES.amber,
      },
    ],
    [t]
  );

  const tabs: ProductionTabConfig[] = useMemo(
    () => [
      {
        id: 'plans',
        step: 1,
        label: t('production.tabPlansLabel'),
        shortLabel: t('production.tabPlansLabel'),
        category: 'planning',
        icon: ClipboardList,
        description: t('production.tabPlansDesc'),
      },
      {
        id: 'batches',
        step: 2,
        label: t('production.tabBatchesLabel'),
        shortLabel: t('production.tabBatchesLabel'),
        category: 'planning',
        icon: Factory,
        description: t('production.tabBatchesDesc'),
      },
      {
        id: 'worker-entries',
        step: 3,
        label: t('production.tabWorkerEntriesLabel'),
        shortLabel: t('production.tabWorkerEntriesLabel'),
        category: 'execution',
        icon: Users,
        description: t('production.tabWorkerEntriesDesc'),
      },
      {
        id: 'variance-radar',
        step: 4,
        label: t('production.tabVarianceRadarLabel'),
        shortLabel: 'Cost Variance',
        category: 'execution',
        icon: TrendingUp,
        description: t('production.tabVarianceRadarDesc'),
      },
    ],
    [t]
  );

  // Global hotkeys (1, 2, 3, 4) to quickly jump between primary manufacturing stages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === '1') {
        setActiveTab('plans');
      } else if (e.key === '2') {
        setActiveTab('batches');
      } else if (e.key === '3') {
        setActiveTab('worker-entries');
      } else if (e.key === '4') {
        setActiveTab('variance-radar');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[1]!;


  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto py-1 sm:py-2">
      {/* Workspace Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-4 sm:pb-5 w-full min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <Factory className="size-3 text-primary" />
              {t('production.manufacturingLifecycle')}
            </span>
            <span className="text-[10px] font-mono font-bold text-muted bg-surface-sunken px-2 py-0.5 rounded-md border border-default">
              {t('production.stageOfFour', { step: currentTab.step })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            {currentTab.label}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {currentTab.description}
          </p>
        </div>

        {/* Quick Action Utilities */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Cross-Module Breadcrumb Links */}
          <Link
            to="/catalogue?tab=bom"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs hover:border-primary/50 transition-colors"
            title="View and edit product formulas & bills of materials"
          >
            <BookOpen className="size-3.5 text-primary" />
            <span className="hidden lg:inline">{t('production.recipesBomLink')}</span>
            <span className="lg:hidden">{t('production.recipesShort')}</span>
          </Link>

          <Link
            to="/inventory"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs hover:border-primary/50 transition-colors"
            title="Check live raw material stock in warehouse"
          >
            <Boxes className="size-3.5 text-primary" />
            <span className="hidden lg:inline">{t('production.warehouseStockLink')}</span>
            <span className="lg:hidden">{t('production.stockShort')}</span>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-default"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('production.exploreCapabilities')}</span>
          </Button>

        </div>
      </div>

      {/* Universal 2-Tier Navigation Hub */}
      <WorkspaceNavigationHub<ProductionCategory, ProductionTab>
        categories={categories}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Quick Action Trigger Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-default">
            <Zap className="size-3.5 text-amber-500 fill-amber-500" />
            <span>{t('production.quickActionsTitle')}</span>
          </div>
          <p className="text-[11px] text-muted">
            {t('production.quickActionsDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsLaunchModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <Factory className="size-3.5" />
            <span>{t('production.startNewBatch')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOutputModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700/90 hover:bg-emerald-800 text-white shadow-xs transition-all cursor-pointer"
          >
            <CheckCircle2 className="size-3.5" />
            <span>{t('production.recordFinishedOutput')}</span>
          </button>
        </div>
      </div>

      {/* Active Section Content */}
      <div className="pt-1">
        {activeTab === 'plans' && <ProductionPlansSection />}
        {activeTab === 'batches' && <ProductionBatchesSection />}
        {activeTab === 'worker-entries' && <WorkerProductionSection />}
        {activeTab === 'variance-radar' && <ManufacturingVarianceRadar />}
      </div>

      {/* Explore Capabilities Modal Guide */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('production.guideModalTitle')}
      >
        <div className="space-y-4 text-xs text-default py-1">
          <p className="text-muted leading-relaxed">
            {t('production.guideModalIntro')}
          </p>

          <div className="space-y-3 pt-2">
            {/* Step 1 */}
            <div className="p-3 rounded-xl border border-default bg-surface-sunken space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-default">
                  <ClipboardList className="size-4 text-primary" />
                  <span>{t('production.guideStep1Title')}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-default text-muted">
                  Tab: plans
                </span>
              </div>
              <p className="text-muted">
                {t('production.guideStep1Desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl border border-default bg-surface-sunken space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-default">
                  <Factory className="size-4 text-primary" />
                  <span>{t('production.guideStep2Title')}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-default text-muted">
                  Tab: batches [1]
                </span>
              </div>
              <p className="text-muted">
                {t('production.guideStep2Desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl border border-default bg-surface-sunken space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-default">
                  <Users className="size-4 text-primary" />
                  <span>{t('production.guideStep3Title')}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-default text-muted">
                  Tab: worker-entries [2]
                </span>
              </div>
              <p className="text-muted">
                {t('production.guideStep3Desc')}
              </p>
            </div>

          </div>

          <div className="pt-2 flex justify-between items-center border-t border-default">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <Zap className="size-3.5 text-primary" />
              <span>{t('production.guideHotkeys')}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsGuideOpen(false)}>
              {t('production.gotIt')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Action Modals */}
      <LaunchBatchModal
        open={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        onSuccess={() => setActiveTab('batches')}
      />

      <RecordBatchOutputModal
        open={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        onSuccess={() => setActiveTab('batches')}
      />
    </div>
  );
}
