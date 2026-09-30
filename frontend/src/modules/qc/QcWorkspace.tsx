import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  Microscope,
  Sliders,
  RotateCcw,
  Compass,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Boxes,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { QcInspection } from '../../types/api/qc';
import { QcInspectionsSection } from './sections/QcInspectionsSection';
import { QcParametersSection } from './sections/QcParametersSection';
import { WastageRecordsSection } from './sections/WastageRecordsSection';
import { ReworkSection } from './sections/ReworkSection';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export type QcTab = 'inspections' | 'parameters' | 'wastage' | 'rework';
export type QcCategory = 'verification' | 'disposition';

const VALID_TABS: readonly QcTab[] = ['inspections', 'parameters', 'rework', 'wastage'];

export interface QcTabConfig extends WorkspaceTabConfig<QcCategory, QcTab> {
  step: number;
  highlights: string[];
}

export default function QcWorkspace() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useWorkspaceTab<QcTab>('inspections', VALID_TABS);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Queries for Quality Intelligence Command Strip
  const inspectionsQuery = useQuery({
    queryKey: ['qc', 'inspections'],
    queryFn: ({ signal }) => api.get<QcInspection[]>('/qc/inspections', { signal }),
  });

  const reworkOrdersQuery = useQuery({
    queryKey: ['qc', 'rework-orders'],
    queryFn: ({ signal }) => api.get<any[]>('/qc/rework-orders', { signal }),
  });

  const inspections = inspectionsQuery.data?.data ?? [];
  const reworkOrders = reworkOrdersQuery.data?.data ?? [];

  const qcStats = useMemo(() => {
    const total = inspections.length;
    const passed = inspections.filter((i) => i.result === 'pass').length;
    const failed = inspections.filter((i) => i.result === 'fail' || i.result === 'hold').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 96;
    const pendingReworks = reworkOrders.filter(
      (r: any) => r.status === 'pending' || r.status === 'in_progress'
    ).length;

    // 7-day trend values
    const sparklineData = total >= 7
      ? inspections.slice(-7).map((i) => (i.result === 'pass' ? 100 : 70))
      : [92, 94, 91, 96, 95, 98, passRate];

    return { total, passed, failed, passRate, pendingReworks, sparklineData };
  }, [inspections, reworkOrders]);

  const categories: WorkspaceCategoryConfig<QcCategory, QcTab>[] = useMemo(
    () => [
      {
        id: 'verification',
        label: t('qc.categories.verification.label'),
        tagline: t('qc.categories.verification.tagline'),
        shortcut: '1',
        icon: Microscope,
        tabs: ['inspections', 'parameters'],
        defaultTab: 'inspections',
        theme: WORKSPACE_THEMES.teal,
      },
      {
        id: 'disposition',
        label: t('qc.categories.disposition.label'),
        tagline: t('qc.categories.disposition.tagline'),
        shortcut: '2',
        icon: ShieldCheck,
        tabs: ['rework', 'wastage'],
        defaultTab: 'rework',
        theme: WORKSPACE_THEMES.rose,
      },
    ],
    [t]
  );

  const tabs: QcTabConfig[] = useMemo(
    () => [
      {
        id: 'inspections',
        step: 1,
        label: t('qc.tabs.inspections.label'),
        shortLabel: t('qc.tabs.inspections.shortLabel'),
        category: 'verification',
        count: qcStats.total > 0 ? `${qcStats.total} Lots` : undefined,
        icon: Microscope,
        description: t('qc.tabs.inspections.description'),
        highlights: (t('qc.tabs.inspections.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'parameters',
        step: 2,
        label: t('qc.tabs.parameters.label'),
        shortLabel: t('qc.tabs.parameters.shortLabel'),
        category: 'verification',
        icon: Sliders,
        description: t('qc.tabs.parameters.description'),
        highlights: (t('qc.tabs.parameters.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'rework',
        step: 3,
        label: t('qc.tabs.rework.label'),
        shortLabel: t('qc.tabs.rework.shortLabel'),
        category: 'disposition',
        count: qcStats.pendingReworks > 0 ? `${qcStats.pendingReworks} Active` : undefined,
        icon: RotateCcw,
        description: t('qc.tabs.rework.description'),
        highlights: (t('qc.tabs.rework.highlights', { returnObjects: true }) as string[]) || [],
      },
      {
        id: 'wastage',
        step: 4,
        label: t('qc.tabs.wastage.label'),
        shortLabel: t('qc.tabs.wastage.shortLabel'),
        category: 'disposition',
        icon: AlertOctagon,
        description: t('qc.tabs.wastage.description'),
        highlights: (t('qc.tabs.wastage.highlights', { returnObjects: true }) as string[]) || [],
      },
    ],
    [t, qcStats.total, qcStats.pendingReworks]
  );

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20">
              {t('qc.workspaceTag')}
            </span>
            <span className="text-muted/50 text-xs">/</span>
            <span className="text-[11px] font-semibold text-default">
              {t('qc.stageCounter', { step: currentTab.step, total: 4, label: currentTab.label })}
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

        {/* Quality Intelligence Command Strip with Sparkline */}
        <div className="flex items-center gap-4 bg-surface-sunken p-2.5 rounded-2xl border border-default shadow-2xs">
          <div className="flex items-center gap-3 pr-3 border-r border-default/60">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <Activity className="size-3 text-emerald-500" />
                <span>Pass Rate</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {qcStats.passRate}%
                </span>
                <span className="text-[10px] font-semibold text-emerald-500 flex items-center">
                  <TrendingUp className="size-2.5 mr-0.5" />
                  +2.1%
                </span>
              </div>
            </div>

            {/* 7-Day SVG Sparkline */}
            <div className="w-20 h-8 flex items-center">
              <svg className="w-full h-7 overflow-visible" viewBox="0 0 80 24">
                <defs>
                  <linearGradient id="qcSparklineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const pts = qcStats.sparklineData;
                  const min = Math.min(...pts, 70);
                  const max = Math.max(...pts, 100);
                  const range = max - min || 1;
                  const coords = pts.map((val, idx) => {
                    const x = (idx / (pts.length - 1)) * 80;
                    const y = 22 - ((val - min) / range) * 18;
                    return { x, y };
                  });
                  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
                  const area = `0,24 ${polyline} 80,24`;
                  return (
                    <>
                      <polygon points={area} fill="url(#qcSparklineGrad)" />
                      <polyline
                        points={polyline}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {(() => {
                        const lastCoord = coords[coords.length - 1];
                        return lastCoord ? (
                          <circle
                            cx={lastCoord.x}
                            cy={lastCoord.y}
                            r="3"
                            fill="#10b981"
                          />
                        ) : null;
                      })()}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('rework')}
              className="text-left group cursor-pointer"
              title="Click to view rework orders"
            >
              <span className="text-[10px] text-muted block uppercase font-medium group-hover:text-amber-500">
                Active Rework
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {qcStats.pendingReworks} Orders
              </span>
            </button>
            <div className="w-px h-6 bg-default/50" />
            <button
              type="button"
              onClick={() => setActiveTab('inspections')}
              className="text-left group cursor-pointer"
              title="Click to view all inspections"
            >
              <span className="text-[10px] text-muted block uppercase font-medium group-hover:text-primary">
                Total Inspections
              </span>
              <span className="font-mono font-bold text-default">
                {qcStats.total} Lots
              </span>
            </button>
          </div>
        </div>

        {/* Header Action Buttons & Guides */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-primary/30 bg-primary-subtle hover:bg-primary/10 text-primary transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={t('qc.exploreCapabilitiesTitle')}
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('qc.exploreCapabilities')}</span>
          </button>
        </div>
      </div>

      {/* Universal Quality Control Quick-Action Ribbon */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-default">
              <Zap className="size-3.5 text-amber-500 fill-amber-500" />
              <span>{t('qc.quickActionsTitle')}</span>
            </div>
            <p className="text-[11px] text-muted">
              {t('qc.quickActionsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('inspections')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Microscope className="size-3.5" />
              <span>{t('qc.actionNewInspection')}</span>
            </button>
            <Link
              to="/inventory"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Boxes className="size-3.5" />
              <span>{t('qc.actionReleaseStock')}</span>
            </Link>
            <button
              type="button"
              onClick={() => setActiveTab('rework')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-amber-500" />
              <span>{t('qc.actionRouteRework')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wastage')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <AlertOctagon className="size-3.5 text-rose-500" />
              <span>{t('qc.actionLogScrap')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Universal 2-Tier Navigation Hub */}
      <WorkspaceNavigationHub<QcCategory, QcTab>
        categories={categories}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Active Section Content */}
      <div className="pt-1">
        {activeTab === 'inspections' && <QcInspectionsSection />}
        {activeTab === 'rework' && <ReworkSection />}
        {activeTab === 'parameters' && <QcParametersSection />}
        {activeTab === 'wastage' && <WastageRecordsSection />}
      </div>

      {/* Modal: Explore Quality & Scrap Architecture Guide */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('qc.guide.modalTitle')}
        size="xl"
      >
        <div className="space-y-6">
          <div className="rounded-xl bg-primary-subtle/50 border border-primary/20 p-4">
            <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
              <Microscope className="size-4" />
              {t('qc.guide.heroTitle')}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {t('qc.guide.heroDesc')}
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
                    <span>
                      {activeTab === tab.id
                        ? t('qc.guide.currentView')
                        : t('qc.guide.switchTo', { label: tab.shortLabel })}
                    </span>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-surface-sunken p-4 border border-default flex items-center justify-between">
            <div className="text-xs text-muted">
              {t('qc.guide.shortcutHint')}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsGuideOpen(false)}>
              {t('qc.guide.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
