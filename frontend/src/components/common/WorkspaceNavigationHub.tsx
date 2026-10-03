import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface WorkspaceDomainTheme {
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

export const WORKSPACE_THEMES: Record<
  'indigo' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'rose' | 'teal',
  WorkspaceDomainTheme
> = {
  indigo: {
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
  purple: {
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
  amber: {
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
  emerald: {
    activePill:
      'bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-md shadow-emerald-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30',
    inactiveIcon: 'text-emerald-600 dark:text-emerald-400',
    inactiveBadge:
      'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 font-semibold',
    accentDot: 'bg-emerald-500',
    subTabActive:
      'bg-linear-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-emerald-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
  cyan: {
    activePill:
      'bg-linear-to-r from-cyan-600 via-sky-600 to-blue-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30',
    inactiveIcon: 'text-cyan-600 dark:text-cyan-400',
    inactiveBadge:
      'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/25 font-semibold',
    accentDot: 'bg-cyan-500',
    subTabActive:
      'bg-linear-to-r from-cyan-600 to-sky-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-cyan-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
  rose: {
    activePill:
      'bg-linear-to-r from-rose-600 via-pink-600 to-fuchsia-600 text-white shadow-md shadow-rose-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30',
    inactiveIcon: 'text-rose-600 dark:text-rose-400',
    inactiveBadge:
      'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/25 font-semibold',
    accentDot: 'bg-rose-500',
    subTabActive:
      'bg-linear-to-r from-rose-600 to-pink-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-rose-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
  teal: {
    activePill:
      'bg-linear-to-r from-teal-600 via-emerald-600 to-green-700 text-white shadow-md shadow-teal-500/25 ring-1 ring-white/20',
    activeIcon: 'text-white',
    activeBadge: 'bg-white/20 text-white border border-white/30',
    inactiveText: 'text-default',
    inactiveHover:
      'hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-500/10 hover:border-teal-500/30',
    inactiveIcon: 'text-teal-600 dark:text-teal-400',
    inactiveBadge:
      'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/25 font-semibold',
    accentDot: 'bg-teal-500',
    subTabActive:
      'bg-linear-to-r from-teal-600 to-emerald-600 text-white border-transparent shadow-xs font-semibold ring-2 ring-teal-500/30',
    subTabActiveIcon: 'text-white',
    subTabActiveBadge: 'bg-white/20 text-white border border-white/25',
  },
};

export interface WorkspaceCategoryConfig<TCategory extends string, TTab extends string> {
  id: TCategory;
  label: string;
  tagline: string;
  icon: React.ElementType;
  tabs: TTab[];
  defaultTab: TTab;
  shortcut?: string | undefined;
  badge?: string | undefined;
  theme: WorkspaceDomainTheme;
}

export interface WorkspaceTabConfig<TCategory extends string, TTab extends string> {
  id: TTab;
  step?: number | undefined;
  label: string;
  shortLabel: string;
  category: TCategory;
  icon: React.ElementType;
  description?: string | undefined;
  badge?: string | undefined;
  count?: number | string | undefined;
  highlights?: string[] | undefined;
}

export interface WorkspaceNavigationHubProps<TCategory extends string, TTab extends string> {
  categories: WorkspaceCategoryConfig<TCategory, TTab>[];
  tabs: WorkspaceTabConfig<TCategory, TTab>[];
  activeTab: TTab;
  onSelectTab: (tabId: TTab) => void;
  className?: string;
  taglineRightContent?: React.ReactNode;
}

export function WorkspaceNavigationHub<TCategory extends string, TTab extends string>({
  categories,
  tabs,
  activeTab,
  onSelectTab,
  className,
  taglineRightContent,
}: WorkspaceNavigationHubProps<TCategory, TTab>) {
  // Derive active category from current active tab
  const activeCategory =
    categories.find((cat) => cat.tabs.includes(activeTab))?.id ?? categories[0]!.id;
  const activeCategoryConfig =
    categories.find((cat) => cat.id === activeCategory) ?? categories[0]!;
  const currentCategoryTheme = activeCategoryConfig.theme;

  // Remember last visited tab per category for fluid switching
  const lastActivePerCategory = useRef<Record<string, TTab>>({});

  useEffect(() => {
    const cat = categories.find((c) => c.tabs.includes(activeTab))?.id;
    if (cat) {
      lastActivePerCategory.current[cat] = activeTab;
    }
  }, [activeTab, categories]);

  const handleSelectCategory = useCallback(
    (categoryId: TCategory) => {
      if (categoryId === activeCategory) return;
      const targetTab =
        lastActivePerCategory.current[categoryId] ??
        categories.find((cat) => cat.id === categoryId)?.defaultTab ??
        tabs[0]!.id;
      onSelectTab(targetTab);
    },
    [activeCategory, categories, onSelectTab, tabs]
  );

  // Keyboard shortcut listener (1, 2, 3...) when outside form inputs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      categories.forEach((cat, index) => {
        const key = cat.shortcut || String(index + 1);
        if (e.key === key) {
          e.preventDefault();
          handleSelectCategory(cat.id);
        }
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories, handleSelectCategory]);

  return (
    <div
      className={cn(
        'bg-surface rounded-2xl border border-default p-2.5 sm:p-3 shadow-2xs space-y-2.5 sm:space-y-3 w-full min-w-0 max-w-full overflow-hidden',
        className
      )}
    >
      {/* Tier 1: Domain Segmented Selector (Touch-friendly responsive track) */}
      <div className="flex flex-col items-center justify-center gap-2 pb-2.5 sm:pb-3 border-b border-default/50 w-full min-w-0">
        <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x flex items-center sm:justify-center">
          <div className="inline-flex items-center p-1 sm:p-1.5 bg-surface-sunken/90 dark:bg-surface-sunken/60 rounded-xl sm:rounded-2xl border border-default/60 shadow-inner gap-1 sm:gap-1.5 w-max min-w-full sm:min-w-0 sm:w-auto">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = activeCategory === cat.id;
              const catTabs = tabs.filter((tb) => tb.category === cat.id);
              const theme = cat.theme;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={cn(
                    'group relative flex items-center gap-1.5 sm:gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer select-none border shrink-0 whitespace-nowrap',
                    isSelected
                      ? cn(theme.activePill, 'scale-[1.02]')
                      : cn('border-transparent bg-transparent', theme.inactiveText, theme.inactiveHover)
                  )}
                  title={`${cat.label} — ${cat.tagline}`}
                >
                  <CatIcon
                    className={cn(
                      'size-3.5 sm:size-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                      isSelected ? theme.activeIcon : theme.inactiveIcon
                    )}
                  />
                  <span className="tracking-tight">{cat.label}</span>
                  <span
                    className={cn(
                      'text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full transition-colors font-bold shrink-0',
                      isSelected ? theme.activeBadge : theme.inactiveBadge
                    )}
                  >
                    <span className="sm:hidden">{cat.badge?.split(' ')[0] ?? catTabs.length}</span>
                    <span className="hidden sm:inline">{cat.badge ?? catTabs.length}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Centered Domain Context & Tagline */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs text-muted font-medium pt-0.5 animate-in fade-in duration-200 px-2 text-center w-full min-w-0">
          <span className={cn('size-1.5 sm:size-2 rounded-full animate-pulse shrink-0', currentCategoryTheme.accentDot)} />
          <span className="text-[10.5px] sm:text-[11.5px] font-medium text-muted truncate max-w-full">
            {activeCategoryConfig.tagline}
          </span>
          {taglineRightContent}
        </div>
      </div>

      {/* Tier 2: Focused Contextual Sub-Module Tabs (Touch-friendly responsive track) */}
      <div className="flex items-center justify-center pt-0.5 w-full min-w-0">
        <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x flex items-center sm:justify-center">
          <div
            role="tablist"
            aria-label={`${activeCategoryConfig.label} Sub-Modules`}
            className="inline-flex items-center p-1 bg-surface-sunken/60 dark:bg-surface-sunken/40 rounded-xl sm:rounded-2xl border border-default/60 shadow-2xs gap-1 sm:gap-1.5 w-max min-w-full sm:min-w-0 sm:w-auto"
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
                    onClick={() => onSelectTab(tab.id)}
                    className={cn(
                      'group flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all duration-150 cursor-pointer shrink-0 select-none border whitespace-nowrap',
                      isActive
                        ? cn(currentCategoryTheme.subTabActive)
                        : cn(
                            'border-default/50 bg-surface/90 text-muted shadow-2xs hover:shadow-xs',
                            currentCategoryTheme.inactiveHover
                          )
                    )}
                    title={tab.description}
                  >
                    <Icon
                      className={cn(
                        'size-3.5 shrink-0 transition-transform group-hover:scale-110',
                        isActive
                          ? currentCategoryTheme.subTabActiveIcon
                          : cn('text-muted transition-colors', currentCategoryTheme.inactiveIcon)
                      )}
                    />
                    <span className="hidden lg:inline">{tab.label}</span>
                    <span className="lg:hidden">{tab.shortLabel || tab.label}</span>
                    {tab.badge && (
                      <span
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider transition-colors hidden sm:inline-block',
                          isActive
                            ? currentCategoryTheme.subTabActiveBadge
                            : currentCategoryTheme.inactiveBadge
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {typeof tab.count === 'number' && (
                      <span
                        className={cn(
                          'text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold transition-colors shrink-0',
                          isActive
                            ? currentCategoryTheme.subTabActiveBadge
                            : currentCategoryTheme.inactiveBadge
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
