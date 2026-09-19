import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  Microscope,
  Sliders,
  RotateCcw,
  Compass,
  Zap,
  SlidersHorizontal,
  Search,
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Boxes,
} from 'lucide-react';
import { QcInspectionsSection } from './sections/QcInspectionsSection';
import { QcParametersSection } from './sections/QcParametersSection';
import { WastageRecordsSection } from './sections/WastageRecordsSection';
import { ReworkSection } from './sections/ReworkSection';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

export type QcTab = 'inspections' | 'parameters' | 'wastage' | 'rework';
export type QcCategory = 'verification' | 'disposition';

const VALID_TABS: readonly QcTab[] = ['inspections', 'parameters', 'rework', 'wastage'];

interface CategoryConfig {
  id: QcCategory;
  label: string;
  tagline: string;
  shortcut: string;
  icon: typeof Microscope;
  defaultTab: QcTab;
}

interface TabConfig {
  id: QcTab;
  step: number;
  label: string;
  shortLabel: string;
  category: QcCategory;
  badge?: string;
  icon: typeof Microscope;
  description: string;
  highlights: string[];
}

export default function QcWorkspace() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useWorkspaceTab<QcTab>('inspections', VALID_TABS);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        id: 'verification',
        label: t('qc.categories.verification.label'),
        tagline: t('qc.categories.verification.tagline'),
        shortcut: '1',
        icon: Microscope,
        defaultTab: 'inspections',
      },
      {
        id: 'disposition',
        label: t('qc.categories.disposition.label'),
        tagline: t('qc.categories.disposition.tagline'),
        shortcut: '2',
        icon: ShieldCheck,
        defaultTab: 'rework',
      },
    ],
    [t]
  );

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'inspections',
        step: 1,
        label: t('qc.tabs.inspections.label'),
        shortLabel: t('qc.tabs.inspections.shortLabel'),
        category: 'verification',
        badge: t('qc.tabs.inspections.badge'),
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
        badge: t('qc.tabs.parameters.badge'),
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
        badge: t('qc.tabs.rework.badge'),
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
        badge: t('qc.tabs.wastage.badge'),
        icon: AlertOctagon,
        description: t('qc.tabs.wastage.description'),
        highlights: (t('qc.tabs.wastage.highlights', { returnObjects: true }) as string[]) || [],
      },
    ],
    [t]
  );

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;
  const activeCategory = currentTab.category;

  // Global Keyboard Shortcuts (1..4 to directly switch stages)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        setActiveTab('inspections');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('parameters');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('rework');
      } else if (e.key === '4') {
        e.preventDefault();
        setActiveTab('wastage');
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
              title={t('qc.jumpTitle')}
            >
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>{t('qc.allViews')}</span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface rounded-2xl border border-default shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('qc.searchPlaceholder')}
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
                      {t('qc.noViewsFound', { query: searchQuery })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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

      {/* Primary 2 Command Pillars (with Embedded Direct Child Pills) */}
      <div
        role="tablist"
        aria-label="Quality Control Domains"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
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
                'group relative flex flex-col justify-between p-4.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer shadow-2xs',
                isCatActive
                  ? 'bg-surface border-primary shadow-md ring-2 ring-primary/10'
                  : 'bg-surface hover:bg-surface-sunken border-default hover:border-default/80'
              )}
            >
              {/* Pillar Top Header */}
              <div className="flex items-start gap-3.5 w-full">
                <div
                  className={cn(
                    'size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs',
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
                          'text-sm font-bold transition-colors truncate',
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
                      {t('qc.viewsCount', { count: childTabs.length })}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                    {cat.tagline}
                  </p>
                </div>
              </div>

              {/* In-Pillar Quick Navigation Grid */}
              <div className="mt-4 pt-3 border-t border-default/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left min-w-0',
                        isCurrent
                          ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                          : 'bg-surface-sunken text-default hover:text-default hover:bg-surface border border-default/60 hover:border-primary/40'
                      )}
                      title={t('qc.openStage', { label: subTab.label })}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <SubIcon className={cn('size-4 shrink-0', isCurrent ? 'text-primary-fg' : 'text-primary')} />
                        <span className="truncate">{subTab.label}</span>
                      </div>
                      <span
                        className={cn(
                          'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0',
                          isCurrent
                            ? 'bg-white/20 text-white font-bold'
                            : 'bg-surface text-muted border border-default/50'
                        )}
                      >
                        {t('qc.stagePill', { step: subTab.step })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Indicator Bar */}
              {isCatActive && (
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-primary rounded-t-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Master Grouped Navigation Ribbon: All 4 Stages Fully Visible */}
      <div className="rounded-xl border border-default/80 bg-surface-sunken/60 p-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 px-1 mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
            <SlidersHorizontal className="size-3 text-primary" />
            <span>{t('qc.stagesRibbonTitle')}</span>
          </div>
          <span className="text-[10px] text-muted font-mono">
            {t('qc.stagesRibbonSubtitle')}
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
                  <span
                    className={cn(
                      'text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-block',
                      isActive ? 'bg-primary/10 text-primary font-bold' : 'bg-surface-sunken text-muted'
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
