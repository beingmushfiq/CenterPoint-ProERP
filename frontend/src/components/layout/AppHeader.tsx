import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  LayoutDashboard,
  Bell,
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  Zap,
  User,
  Plus,
  Factory,
  ShoppingCart,
  Microscope,
  Store,
  FileText,
  Boxes,
  Truck,
  ClipboardList,
  PackagePlus,
  PlusCircle,
  X,
  CornerDownLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Brain,
  Compass,
} from 'lucide-react';
import { SliceMartBrainModal } from './SliceMartBrainModal';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTutorialStore } from '../../modules/tutorial/tutorialStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { PLATFORM_NAV_DEFINITIONS } from '../../lib/capabilities/navRegistry';
import { cn } from '../../lib/utils';
import type { NotificationItem } from '../../types/api/notifications';
import { toggleThemeWithTransition } from '../../lib/theme/themeTransition';
import { api } from '../../lib/api/client';

interface AppHeaderProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ── Search Item Definition & Registry ────────────────────────
interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  subtitle?: string | undefined;
  code?: string | undefined;
  badge?: string | undefined;
  url: string;
  icon: typeof LayoutDashboard;
}

export function AppHeader({
  onToggleSidebar,
  isSidebarCollapsed,
  onToggleCollapse,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, branches, activeBranch, switchBranch, logout } = useAuthStore();
  const { t, i18n } = useTranslation(['navigation', 'common']);
  
  // Menus and dialog states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const openTutorial = useTutorialStore((s) => s.openTutorial);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isModuleEnabled = useTenantCapabilityStore((s) => s.isModuleEnabled);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const getTerm = useTenantCapabilityStore((s) => s.getTerm);

  const dynamicSearchRegistry = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];
    for (const section of PLATFORM_NAV_DEFINITIONS) {
      for (const navItem of section.items) {
        if (navItem.moduleKey && !isModuleEnabled(navItem.moduleKey)) continue;
        if (navItem.permission && !hasPermission(navItem.permission)) continue;
        const title = navItem.labelKey ? getTerm(navItem.labelKey, navItem.defaultLabel) : navItem.defaultLabel;
        items.push({
          id: `nav-${navItem.id}`,
          title,
          category: 'Navigation',
          subtitle: `${section.title} module`,
          code: navItem.id.toUpperCase(),
          badge: navItem.badge,
          url: navItem.to,
          icon: navItem.icon,
        });
      }
    }
    return items;
  }, [isModuleEnabled, hasPermission, getTerm]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  // Global Keyboard Shortcuts for Omnisearch and Brain Agent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === 'j')) {
        e.preventDefault();
        setIsBrainOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global hotkey: Ctrl+K or Cmd+K to trigger search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsMobileSearchOpen(false);
        setIsQuickAddOpen(false);
        setIsBranchMenuOpen(false);
        setIsUserMenuOpen(false);
        setIsNotifMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside search container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notification loader
  useEffect(() => {
    let ignore = false;
    api.get<{ data: NotificationItem[] } | NotificationItem[]>('/notifications')
      .then((res) => {
        if (!ignore) {
          const raw = res.data as unknown;
          const list = Array.isArray(raw)
            ? (raw as NotificationItem[])
            : (((raw as Record<string, unknown>)?.data as NotificationItem[]) ?? []);
          if (list.length > 0) {
            setNotifications(list);
          }
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  // Filtered search results
  const filteredResults = dynamicSearchRegistry.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      (item.code && item.code.toLowerCase().includes(query)) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
      (item.badge && item.badge.toLowerCase().includes(query))
    );
  }).slice(0, 8);

  const handleSelectResult = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setSearchQuery('');
    navigate(item.url);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredResults[selectedIndex];
      if (selected) {
        handleSelectResult(selected);
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const toggleTheme = (e?: React.MouseEvent) => {
    toggleThemeWithTransition(theme, e, (next) => {
      setTheme(next);
    });
  };

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
    api.post('/notifications/read-all').catch(() => {});
  };

  const markSingleRead = (id: number) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    api.post(`/notifications/${id}/read`).catch(() => {});
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    markSingleRead(notif.id);
    setIsNotifMenuOpen(false);
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-amber-500 shrink-0" aria-hidden="true" />;
      default:
        return <Info className="size-4 text-blue-500 shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-default bg-surface/95 px-3 sm:px-6 backdrop-blur-md transition-token-colors">
      {/* Left side: Hamburger + Search + Mobile Search Trigger */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {/* Mobile Navigation Drawer Trigger (< lg) */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-default transition-token-colors lg:hidden focus-visible:ring-focus cursor-pointer shrink-0"
          aria-label="Toggle Navigation"
        >
          <Menu className="size-5" />
        </button>

        {/* Desktop Collapse/Expand Sidebar Trigger (>= lg) */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-default transition-token-colors focus-visible:ring-focus cursor-pointer shrink-0"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="size-5 text-muted hover:text-primary transition-colors" />
            ) : (
              <PanelLeftClose className="size-5 text-muted hover:text-primary transition-colors" />
            )}
          </button>
        )}

        {/* Mobile / Tablet Search Button (< xl) */}
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen(true)}
          className="xl:hidden flex items-center justify-center p-2 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors"
          title={t('navigation.searchPlaceholder', 'Search products, orders, batches... (Ctrl+K)')}
        >
          <Search className="size-4.5" />
        </button>

        {/* Desktop Global Omnisearch (>= xl) */}
        <div ref={searchContainerRef} className="relative hidden xl:flex items-center flex-1 max-w-md">
          <Search className="absolute left-3 size-3.5 text-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('navigation.searchPlaceholder', 'Search products, orders, batches... (Ctrl+K)')}
            className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-28 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary transition-all"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted hover:text-default cursor-pointer p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 select-none">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              OPERATIONAL
            </span>
          </div>

          {/* Omnisearch Interactive Dropdown */}
          {isSearchOpen && (
            <div className="absolute top-full left-0 mt-2 w-full min-w-85 max-w-lg rounded-2xl border border-default bg-surface-raised p-2 shadow-2xl z-50 animate-in fade-in duration-150">
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default/60">
                <span>{searchQuery ? 'Matching Operational Records' : 'Quick Jump & Navigation'}</span>
                <span className="text-[9px] font-mono lowercase">esc to close</span>
              </div>

              <div className="max-h-80 overflow-y-auto mt-1 space-y-0.5">
                {filteredResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    No matching records found for "{searchQuery}"
                  </div>
                ) : (
                  filteredResults.map((item, index) => {
                    const Icon = item.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'w-full text-left flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-default hover:bg-surface-sunken'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn(
                            'flex size-6 items-center justify-center rounded-lg text-muted',
                            isSelected ? 'bg-primary/20 text-primary' : 'bg-surface-sunken'
                          )}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-default text-xs font-semibold">{item.title}</p>
                            {item.subtitle && (
                              <p className="truncate text-[10px] text-muted">{item.subtitle}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {item.badge && (
                            <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[9px] font-bold text-muted border border-default">
                              {item.badge}
                            </span>
                          )}
                          <CornerDownLeft className={cn('size-3 text-muted', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="px-3 py-1.5 mt-1 border-t border-default/60 flex items-center justify-between text-[10px] text-muted">
                <span>Navigate with <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-default text-[9px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-default text-[9px] font-mono">↓</kbd></span>
                <span>Press <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-default text-[9px] font-mono">Enter</kbd> to jump</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side: POS Button + Branch + Quick Add + Notifications + Theme toggle + User profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* ── Interactive Tutorial & System Tour Direct Action Button ──── */}
        <button
          type="button"
          onClick={() => openTutorial()}
          className="hidden 2xl:flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-xs transition-colors cursor-pointer shrink-0"
          title="Interactive Beginner Tutorial & System Tour"
        >
          <Compass className="size-3.5" />
          <span>{t('navigation.systemTour', 'System Tour')}</span>
        </button>

        {/* ── POS (Point of Sale) Register Direct Action Button ──── */}
        <Link
          to="/pos"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer shrink-0"
          title="Open Point of Sale Counter Terminal"
        >
          <Store className="size-3.5" />
          <span className="hidden xl:inline">{t('navigation.posTerminal', 'POS Terminal')}</span>
          <span className="xl:hidden">{t('navigation.items.pos', 'POS')}</span>
        </Link>

        {/* Branch Selector Dropdown */}
        {branches && branches.length > 0 && (
          <div className="relative hidden xl:block">
            <button
              type="button"
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-default bg-surface-raised px-3 py-1.5 text-xs text-default hover:bg-surface-sunken transition-token-colors focus-visible:ring-focus shadow-xs cursor-pointer"
            >
              <Building2 className="size-3.5 text-primary" aria-hidden="true" />
              <span className="font-medium">{activeBranch?.name ?? 'Head Office'}</span>
              <ChevronDown className="size-3 text-muted" aria-hidden="true" />
            </button>

            {isBranchMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl border border-default bg-surface-raised p-1.5 shadow-xl z-50 animate-fade-in">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {t('navigation.operatingBranch', 'Operating Branch')}
                </div>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      void switchBranch(b.id);
                      setIsBranchMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-token-colors focus-visible:ring-focus',
                      activeBranch?.id === b.id
                        ? 'bg-primary-subtle text-primary font-semibold'
                        : 'text-default hover:bg-surface-sunken'
                    )}
                  >
                    <span>{b.name}</span>
                    {b.is_head_office && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                        HQ
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Comprehensive + Quick Add Dropdown ────────────────── */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-2.5 xl:px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            title={t('navigation.quickAdd', 'Quick Add')}
          >
            <Plus className="size-3.5" />
            <span className="hidden xl:inline">{t('navigation.quickAdd', 'Quick Add')}</span>
            <ChevronDown className="size-3 hidden xl:inline" />
          </button>

          {isQuickAddOpen && (
            <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-64 max-w-[calc(100vw-1rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-default bg-surface-raised p-1.5 shadow-2xl z-50 animate-in fade-in duration-150">
              {/* Manufacturing Group */}
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {i18n.language === 'bn' ? 'উৎপাদন ও মান নিয়ন্ত্রণ' : 'Manufacturing & Quality'}
              </div>
              <Link
                to="/production"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Factory className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'প্রোডাকশন ব্যাচ' : 'Production Batch'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'লাইন রান শিডিউল' : 'Schedule line run'}</span>
                </div>
              </Link>
              <Link
                to="/production"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <ClipboardList className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'ম্যানুফ্যাকচারিং অর্ডার' : 'Manufacturing Order'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'বিওএম কাজের আদেশ' : 'BOM work order'}</span>
                </div>
              </Link>
              <Link
                to="/qc"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                  <Microscope className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'কিউসি অডিট পরিদর্শন' : 'QC Audit Inspection'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'ত্রুটি ও অপচয় যাচাই' : 'Defect & scrap review'}</span>
                </div>
              </Link>

              {/* Procurement & Stock Group */}
              <div className="mt-1 pt-1 border-t border-default/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {i18n.language === 'bn' ? 'ক্রয় ও ইনভেন্টরি' : 'Procurement & Inventory'}
              </div>
              <Link
                to="/purchasing"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <ShoppingCart className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'ক্রয় আদেশ (PO)' : 'Purchase Order (PO)'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'সরবরাহকারী রিকুইজিশন' : 'Vendor requisition'}</span>
                </div>
              </Link>
              <Link
                to="/inventory"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                  <PackagePlus className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'পণ্য গ্রহণ' : 'Receive Stock'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'ইনওয়ার্ড চালান' : 'Goods inward docket'}</span>
                </div>
              </Link>
              <Link
                to="/inventory"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Boxes className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'স্টক সমন্বয়' : 'Stock Adjustment'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'বিন গণনা ব্যবধান' : 'Bin count variance'}</span>
                </div>
              </Link>

              {/* Sales & Retail Group */}
              <div className="mt-1 pt-1 border-t border-default/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {i18n.language === 'bn' ? 'বিক্রয় ও স্টোরফ্রন্ট' : 'Sales & Storefront'}
              </div>
              <Link
                to="/sales"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileText className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'বিক্রয় চালান' : 'Sales Invoice'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'বি২বি চালানপত্র' : 'B2B invoice bill'}</span>
                </div>
              </Link>
              <Link
                to="/catalogue"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                  <PlusCircle className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'ক্যাটালগ পণ্য' : 'Catalogue Product'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'নতুন এসকেইউ এন্ট্রি' : 'New SKU entry'}</span>
                </div>
              </Link>
              <Link
                to="/logistics"
                onClick={() => setIsQuickAddOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-default hover:bg-surface-sunken transition-colors"
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                  <Truck className="size-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">{i18n.language === 'bn' ? 'ডেলিভারি প্রেরণ' : 'Dispatch Delivery'}</span>
                  <span className="text-[10px] text-muted">{i18n.language === 'bn' ? 'যানবাহন ও কুরিয়ার দায়িত্ব' : 'Vehicle assignment'}</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Notifications Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
            className="relative rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-default transition-token-colors focus-visible:ring-focus cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-red-500"></span>
              </span>
            )}
          </button>

          {isNotifMenuOpen && (
            <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1rem)] rounded-2xl border border-default bg-surface-raised shadow-2xl z-50 overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between border-b border-default px-4 py-3 bg-surface-sunken/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-default">{i18n.language === 'bn' ? 'ফ্যাক্টরি টেলিমেট্রি ও সতর্কতা' : 'Factory Telemetry & Alerts'}</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold">
                      {unreadCount} {i18n.language === 'bn' ? 'টি নতুন' : 'new'}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 focus-visible:ring-focus cursor-pointer"
                  >
                    <Check className="size-3" />
                    {i18n.language === 'bn' ? 'সব পঠিত চিহ্নিত করুন' : 'Mark read'}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-default">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted">
                    {i18n.language === 'bn' ? 'কোনো সক্রিয় নোটিফিকেশন নেই' : 'No active notifications'}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'w-full p-3.5 text-left transition-token-colors cursor-pointer hover:bg-surface-sunken focus-visible:ring-focus outline-none',
                        !notif.read_at ? 'bg-primary-subtle/30' : 'opacity-70'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{getSeverityIcon(notif.severity)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-default">{notif.title_key}</p>
                          <p className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.body_key}
                          </p>
                          <span className="text-[10px] text-muted mt-1 block font-mono">
                            {new Date(notif.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Agentic Operations AI Brain */}
        <button
          type="button"
          onClick={() => setIsBrainOpen(true)}
          className="hidden xl:flex items-center gap-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 px-2.5 py-1 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
          title="Operations AI Brain — 100% Local Agentic AI (Ctrl+Space)"
        >
          <Brain className="size-3.5 group-hover:scale-110 transition-transform" />
          <span>Brain</span>
          <span className="size-1.5 rounded-full bg-purple-500 animate-pulse" />
        </button>

        {/* Data Bin & Recovery Vault Quick Link */}
        <Link
          to="/settings/bin"
          className="hidden 2xl:flex rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-red-500 transition-token-colors focus-visible:ring-focus relative group cursor-pointer"
          title="Data Bin & Recovery Vault"
        >
          <Trash2 className="size-4" />
        </Link>

        {/* Language Switcher (EN / বাংলা) */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-default transition-token-colors focus-visible:ring-focus cursor-pointer"
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-sunken transition-token-colors focus-visible:ring-focus border border-transparent hover:border-default cursor-pointer"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-default font-bold text-xs border border-default shadow-xs">
              {user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'MR'}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold text-default leading-tight">{user?.name ?? 'System User'}</div>
              <div className="text-[10px] text-muted truncate max-w-30">
                {user?.role ?? (user?.is_platform_admin ? 'Platform Administrator' : 'Operations Member')}
              </div>
            </div>
            <ChevronDown className="hidden size-3 text-muted sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-default bg-surface-raised p-1.5 shadow-2xl z-50 animate-fade-in">
              <div className="border-b border-default px-3 py-2.5">
                <p className="text-xs font-bold text-default">{user?.name ?? 'Operations User'}</p>
                <p className="text-[11px] text-muted truncate">{user?.email ?? 'operations@company.com'}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Zap className="size-2.5" />
                  <span>Factory Operator</span>
                </div>
              </div>

              <div className="mt-1 space-y-0.5">
                {/* Mobile-only shortcuts */}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsBrainOpen(true);
                  }}
                  className="sm:hidden flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-token-colors cursor-pointer"
                >
                  <Brain className="size-3.5" />
                  <span>Operations AI Brain</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    openTutorial();
                  }}
                  className="sm:hidden flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-token-colors cursor-pointer"
                >
                  <Compass className="size-3.5" />
                  <span>{t('navigation.systemTour', 'Interactive System Tour')}</span>
                </button>

                <Link
                  to="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-default hover:bg-surface-sunken transition-token-colors focus-visible:ring-focus"
                >
                  <User className="size-3.5 text-primary" />
                  <span>{i18n.language === 'bn' ? 'প্রোফাইল ও অ্যাকাউন্ট' : 'Profile & Account'}</span>
                </Link>

                <Link
                  to="/settings/bin"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-default hover:bg-surface-sunken transition-token-colors focus-visible:ring-focus"
                >
                  <Trash2 className="size-3.5 text-red-500" />
                  <span>{t('navigation.items.bin', 'Data Bin & Recovery')}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-500/10 transition-token-colors focus-visible:ring-focus cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>{t('common:action.signOut', 'Sign out')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Search Modal Overlay (< md) ────────────────── */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex flex-col items-center animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface-raised border border-default rounded-2xl p-3 shadow-2xl space-y-3 mt-4">
            <div className="flex items-center gap-2 border-b border-default pb-2.5">
              <Search className="size-4 text-muted shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('navigation.searchPlaceholder', 'Search products, orders, batches...')}
                className="w-full bg-transparent text-sm text-default placeholder:text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-1 text-muted hover:text-default"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredResults.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-sunken cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-surface-sunken flex items-center justify-center text-muted">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-default">{item.title}</p>
                        <p className="text-[10px] text-muted">{item.subtitle}</p>
                      </div>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-sunken border border-default text-muted">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SliceMart Brain Agent Modal */}
      <SliceMartBrainModal open={isBrainOpen} onClose={() => setIsBrainOpen(false)} />
    </header>
  );
}
