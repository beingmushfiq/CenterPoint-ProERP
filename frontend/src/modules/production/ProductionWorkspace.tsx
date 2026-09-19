import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Factory,
  Users,
  Monitor,
  Compass,
  Zap,
  SlidersHorizontal,
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
import { ProductionFloorKioskView } from './components/ProductionFloorKioskView';
import { LaunchBatchModal } from './modals/LaunchBatchModal';
import { RecordBatchOutputModal } from './modals/RecordBatchOutputModal';

import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

export type ProductionTab = 'plans' | 'batches' | 'worker-entries' | 'variance-radar';

interface TabConfig {
  id: ProductionTab;
  step: number;
  label: string;
  badge?: string;
  icon: typeof Factory;
  description: string;
  pillar: 1 | 2;
}

const VALID_TABS: readonly ProductionTab[] = ['plans', 'batches', 'worker-entries', 'variance-radar'];

export default function ProductionWorkspace() {
  const { t } = useTranslation(['production', 'common']);
  const [activeTab, setActiveTab] = useWorkspaceTab<ProductionTab>('plans', VALID_TABS);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);

  const tabs: TabConfig[] = useMemo(() => [
    {
      id: 'plans',
      step: 1,
      label: t('production.tabPlansLabel'),
      badge: t('production.stepLabel', { step: 1 }),
      icon: ClipboardList,
      description: t('production.tabPlansDesc'),
      pillar: 1,
    },
    {
      id: 'batches',
      step: 2,
      label: t('production.tabBatchesLabel'),
      badge: t('production.stepLabel', { step: 2 }),
      icon: Factory,
      description: t('production.tabBatchesDesc'),
      pillar: 1,
    },
    {
      id: 'worker-entries',
      step: 3,
      label: t('production.tabWorkerEntriesLabel'),
      badge: t('production.stepLabel', { step: 3 }),
      icon: Users,
      description: t('production.tabWorkerEntriesDesc'),
      pillar: 2,
    },
    {
      id: 'variance-radar',
      step: 4,
      label: t('production.tabVarianceRadarLabel'),
      badge: 'ABC',
      icon: TrendingUp,
      description: t('production.tabVarianceRadarDesc'),
      pillar: 2,
    },
  ], [t]);

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

  if (isKioskOpen) {
    return <ProductionFloorKioskView onExit={() => setIsKioskOpen(false)} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header with Transparent Navigation Deck */}
      <div className="flex flex-col gap-4 border-b border-default pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

            {/* Kiosk Mode Launcher */}
            <button
              type="button"
              onClick={() => setIsKioskOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-raised hover:bg-surface text-default border border-default shadow-2xs hover:border-primary/50 transition-all cursor-pointer"
              title="Launch full-screen high-contrast display for wall-mounted TVs on the shop floor"
            >
              <Monitor className="size-4 text-primary" />
              <span>{t('production.floorKioskMode')}</span>
            </button>
          </div>
        </div>

        {/* 2 Transparent Command Pillars with Embedded Direct Child Pills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Pillar 1: Production Scheduling & Execution */}
          <div
            className={cn(
              'rounded-2xl p-3.5 border transition-all duration-200 bg-surface',
              currentTab.pillar === 1
                ? 'border-primary/40 shadow-xs ring-1 ring-primary/20'
                : 'border-default/70 hover:border-default shadow-2xs'
            )}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-default/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-xl border shrink-0',
                    currentTab.pillar === 1
                      ? 'bg-primary-subtle text-primary border-primary/30'
                      : 'bg-surface-sunken text-muted border-default'
                  )}
                >
                  <Workflow className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-default truncate">
                      {t('production.pillar1Title')}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-sunken text-muted border border-default shrink-0">
                      {t('production.pillar1Badge')}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted truncate block">
                    {t('production.pillar1Desc')}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Embedded Child Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left min-w-0',
                  activeTab === 'plans'
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                    : 'bg-surface-sunken text-default hover:text-default hover:bg-surface border border-default/60 hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <ClipboardList className="size-4 shrink-0" />
                  <span className="truncate">{t('production.tabPlansLabel')}</span>
                </div>
                <span className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0',
                  activeTab === 'plans' ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default/50'
                )}>
                  {t('production.stepLabel', { step: 1 })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('batches')}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left min-w-0',
                  activeTab === 'batches'
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                    : 'bg-surface-sunken text-default hover:text-default hover:bg-surface border border-default/60 hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Factory className="size-4 shrink-0" />
                  <span className="truncate">{t('production.tabBatchesLabel')}</span>
                </div>
                <span className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0',
                  activeTab === 'batches' ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default/50'
                )}>
                  {t('production.stepLabel', { step: 2 })}
                </span>
              </button>
            </div>
          </div>

          {/* Pillar 2: Floor Operations & Labor Wages */}
          <div
            className={cn(
              'rounded-2xl p-3.5 border transition-all duration-200 bg-surface',
              currentTab.pillar === 2
                ? 'border-primary/40 shadow-xs ring-1 ring-primary/20'
                : 'border-default/70 hover:border-default shadow-2xs'
            )}
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-default/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-xl border shrink-0',
                    currentTab.pillar === 2
                      ? 'bg-primary-subtle text-primary border-primary/30'
                      : 'bg-surface-sunken text-muted border-default'
                  )}
                >
                  <Users className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-default truncate">
                      {t('production.pillar2Title')}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-sunken text-muted border border-default shrink-0">
                      {t('production.pillar2Badge')}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted truncate block">
                    {t('production.pillar2Desc')}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Embedded Child Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('worker-entries')}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left min-w-0',
                  activeTab === 'worker-entries'
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                    : 'bg-surface-sunken text-default hover:text-default hover:bg-surface border border-default/60 hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Users className="size-4 shrink-0" />
                  <span className="truncate">{t('production.tabWorkerEntriesLabel')}</span>
                </div>
                <span className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0',
                  activeTab === 'worker-entries' ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default/50'
                )}>
                  {t('production.stepLabel', { step: 3 })}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('variance-radar')}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left min-w-0',
                  activeTab === 'variance-radar'
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                    : 'bg-surface-sunken text-default hover:text-default hover:bg-surface border border-default/60 hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <TrendingUp className="size-4 shrink-0" />
                  <span className="truncate">{t('production.tabVarianceRadarLabel')}</span>
                </div>
                <span className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0',
                  activeTab === 'variance-radar' ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default/50'
                )}>
                  {t('production.stepLabel', { step: 4 })}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Universal Manufacturing Quick-Action Ribbon */}
        <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
              >
                <ClipboardList className="size-3.5 text-primary" />
                <span>{t('production.planProduction')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('worker-entries')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
              >
                <Users className="size-3.5 text-primary" />
                <span>{t('production.logWorkerWages')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('variance-radar')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-2xs transition-all cursor-pointer"
              >
                <TrendingUp className="size-3.5" />
                <span>{t('production.costVarianceRadar')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Master Grouped Navigation Ribbon: All 4 Stages Fully Visible */}
        <div className="rounded-xl border border-default/80 bg-surface-sunken/60 p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 px-1 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
              <SlidersHorizontal className="size-3 text-primary" />
              <span>{t('production.stagesRibbon')}</span>
            </div>
            <span className="text-[10px] text-muted font-mono">
              {t('production.stagesAvailable')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer min-w-0 text-left',
                    isActive
                      ? 'bg-surface text-default font-semibold shadow-xs border border-primary/50 ring-1 ring-primary/20'
                      : 'bg-surface/70 text-muted hover:text-default hover:bg-surface border border-default/50'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center size-5 rounded-full text-[10px] font-mono font-bold shrink-0',
                        isActive
                          ? 'bg-primary text-primary-fg'
                          : 'bg-surface-sunken text-muted border border-default'
                      )}
                    >
                      {tab.step}
                    </span>
                    <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted')} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className={cn(
                      'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-block',
                      isActive ? 'bg-primary/10 text-primary font-bold' : 'bg-surface-sunken text-muted'
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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

            {/* Kiosk Mode */}
            <div className="p-3 rounded-xl border border-primary/30 bg-primary-subtle/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Monitor className="size-4 text-primary" />
                  <span>{t('production.guideKioskTitle')}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-primary/20 text-primary">
                  {t('production.guideKioskBadge')}
                </span>
              </div>
              <p className="text-muted">
                {t('production.guideKioskDesc')}
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
