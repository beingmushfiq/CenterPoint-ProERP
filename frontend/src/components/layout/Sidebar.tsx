import { useState, useMemo, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
  X,
  Download,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { buildDynamicNavSections } from '../../lib/capabilities/navRegistry';
import { useTenantBranding, isStaleEngineName } from '../../lib/theme/useTenantBranding';
import { getAppVersion } from '../../lib/config/appVersion';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const tenant = useAuthStore((state) => state.tenant);
  const isModuleEnabled = useTenantCapabilityStore((state) => state.isModuleEnabled);
  const getTerm = useTenantCapabilityStore((state) => state.getTerm);
  const navOrder = useTenantCapabilityStore((state) => state.manifest?.nav_order);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  // Collapsed sections accordion memory (persisted in localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('erp_sidebar_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch (_err) {
      void _err;
      return {};
    }
  });

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionTitle]: !prev[sectionTitle] };
      try {
        localStorage.setItem('erp_sidebar_collapsed_sections', JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };

  const workspaceSubtitle = useMemo(() => {
    if (!user?.role) return i18n.language === 'bn' ? 'অপারেশনস কর্মক্ষেত্র' : 'Operations Workspace';
    if (user.role.includes('Super Administrator') || user.is_platform_admin) {
      return i18n.language === 'bn' ? 'এক্সিকিউটিভ কমান্ড' : 'Executive Command';
    }
    if (user.role.includes('Production')) {
      return i18n.language === 'bn' ? 'উৎপাদন কর্মক্ষেত্র' : 'Production Workspace';
    }
    if (user.role.includes('QC') || user.role.includes('Quality')) {
      return i18n.language === 'bn' ? 'গুণমান ও পরিদর্শন' : 'Quality & Assurance';
    }
    if (user.role.includes('Store') || user.role.includes('Warehouse')) {
      return i18n.language === 'bn' ? 'গুদাম ও লজিস্টিকস' : 'Warehouse & Logistics';
    }
    if (user.role.includes('Sales') || user.role.includes('Commercial')) {
      return i18n.language === 'bn' ? 'বাণিজ্যিক ও খুচরা' : 'Commercial & Retail';
    }
    return `${user.role} ${i18n.language === 'bn' ? 'কর্মক্ষেত্র' : 'Workspace'}`;
  }, [user, i18n.language]);

  const isItemActive = (to: string, isActive: boolean) => {
    // 1. If 'to' specifies exact query parameters (e.g., '/sales?tab=leads')
    if (to.includes('?')) {
      const [toPath, toQuery] = to.split('?');
      if (toPath && toQuery && location.pathname === toPath && location.search.includes(toQuery)) {
        return true;
      }
      return false;
    }

    // 2. Special case for '/sales': if URL has 'tab=leads', CRM Leads is the active nav item
    if (to === '/sales') {
      if (location.pathname === '/sales' && location.search.includes('tab=leads')) {
        return false;
      }
      return location.pathname === '/sales' || location.pathname.startsWith('/sales/');
    }

    // 2b. Special case for '/storefront': if URL has 'tab=coupons', Coupons is the active nav item
    if (to === '/storefront') {
      if (location.pathname === '/storefront' && location.search.includes('tab=coupons')) {
        return false;
      }
      return location.pathname === '/storefront' || location.pathname.startsWith('/storefront/');
    }

    // 3. Special case for '/settings': if URL is '/settings/roles', Roles is the active nav item
    if (to === '/settings') {
      if (location.pathname.startsWith('/settings/roles')) {
        return false;
      }
      return location.pathname === '/settings' || location.pathname.startsWith('/settings/');
    }

    // 4. Aliases for HR module
    if (to === '/hr') {
      return (
        location.pathname === '/hr' ||
        location.pathname.startsWith('/hr/') ||
        location.pathname.startsWith('/workforce') ||
        location.pathname.startsWith('/employees') ||
        location.pathname.startsWith('/attendance') ||
        location.pathname.startsWith('/payroll')
      );
    }

    // 5. Aliases for Finance module
    if (to === '/finance') {
      return (
        location.pathname === '/finance' ||
        location.pathname.startsWith('/finance/') ||
        location.pathname.startsWith('/accounting')
      );
    }

    // 6. Aliases for Delivery / Logistics module
    if (to === '/logistics') {
      return (
        location.pathname === '/logistics' ||
        location.pathname.startsWith('/logistics/') ||
        location.pathname.startsWith('/delivery')
      );
    }

    // 7. Standard matching: check pathname match regardless of search/tab parameters
    const [toPath] = to.split('?');
    if (location.pathname === toPath || location.pathname.startsWith(`${toPath}/`)) {
      return true;
    }

    return isActive;
  };

  const navSections = useMemo(
    () => buildDynamicNavSections(isModuleEnabled, hasPermission, getTerm, navOrder),
    [isModuleEnabled, hasPermission, getTerm, navOrder]
  );

  const { companyName } = useTenantBranding();
  const brandingRecord = tenant?.branding as Record<string, unknown> | undefined;
  const brandingName = typeof brandingRecord?.['name'] === 'string' ? brandingRecord['name'] : undefined;
  const tenantName = brandingName || tenant?.name;
  const tenantDisplayName: string = useMemo(() => {
    if (companyName && !isStaleEngineName(companyName)) {
      return companyName;
    }
    if (tenantName && !isStaleEngineName(tenantName)) {
      return tenantName;
    }
    return 'Operations Platform';
  }, [companyName, tenantName]);

  const erpInstallTitle = useMemo((): string => {
    const base = tenantDisplayName.replace(/\s+ERP$/i, '').trim();
    return `${base} ERP`;
  }, [tenantDisplayName]);
  // Close on Escape key when mobile sidebar is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const appVersion = getAppVersion();
  const statusLabel = tenant?.status === 'active'
    ? t('common:status.active', 'Active')
    : (tenant?.status ? tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1) : (i18n.language === 'bn' ? 'এন্টারপ্রাইজ' : 'Enterprise'));
  const editionLabel = i18n.language === 'bn' ? 'সংস্করণ' : 'Edition';
  const tenantTier = `${statusLabel} ${editionLabel}`;
  const tenantShortBadge = 'ERP';

  return (
    <>
      {/* Mobile backdrop with frosted blur */}
      {isOpen && (
        <div
          className="fixed inset-0 z-(--z-overlay) bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Adaptive Luxury Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-(--z-modal) lg:z-30 flex flex-col border-r border-(--nav-border) bg-(--nav-bg) text-default transition-all duration-300 ease-in-out lg:translate-x-0 select-none shadow-xl dark:shadow-black/80',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'lg:w-20 w-[min(18rem,calc(100vw-3rem))] sm:w-64' : 'w-[min(18rem,calc(100vw-3rem))] sm:w-64'
        )}
      >
        {/* Subtle Ambient Radial Lighting for Dark Mode */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-indigo-500/5 via-emerald-500/2 to-transparent dark:from-indigo-500/10 dark:via-emerald-500/4"
          aria-hidden="true"
        />

        {/* Brand Monogram & Identity Header */}
        <div
          className={cn(
            'relative flex h-16 items-center border-b border-(--nav-border) px-3.5 shrink-0 bg-(--nav-bg)/95 backdrop-blur-md transition-all',
            isCollapsed ? 'lg:justify-center justify-between' : 'justify-between'
          )}
        >
          <Link
            to="/dashboard"
            onClick={() => {
              if (window.innerWidth < 1024) {
                onClose();
              }
            }}
            className="group flex items-center gap-3 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl transition-all cursor-pointer select-none"
            title="Go to Dashboard"
            aria-label={`${tenantDisplayName} - Go to Dashboard`}
          >
            {/* Custom Multi-Stop Geometric Emblem */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 via-indigo-600 to-indigo-800 p-0.5 shadow-md shadow-indigo-500/20 ring-1 ring-black/5 dark:ring-white/20 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-white dark:bg-[#090d16]/90 backdrop-blur-xs">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white dark:ring-[#070a10]" />
              </span>
            </div>

            {/* Tenant details (hidden when collapsed on desktop) */}
            <div className={cn('min-w-0', isCollapsed && 'lg:hidden')}>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-default text-sm truncate font-sans group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tenantDisplayName}
                </span>
                <span className="inline-flex items-center rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 tracking-wider uppercase font-mono">
                  {tenantShortBadge}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-medium text-muted truncate flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  {workspaceSubtitle}
                </span>
              </div>
            </div>
          </Link>

          {/* Mobile close button (< lg) */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Command & Workspace Search */}
        {!isCollapsed ? (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="relative flex items-center w-full rounded-lg bg-(--nav-bg-deep) border border-(--nav-border) px-2.5 py-1.5 text-xs text-muted hover:border-primary/40 transition-colors group">
              <Search className="size-3.5 text-muted group-hover:text-primary transition-colors mr-2 shrink-0" />
              <input
                type="text"
                placeholder={t('common:action.search') + '...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-default placeholder:text-muted outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-muted bg-surface rounded border border-(--nav-border) ml-auto shrink-0">
                ⌘K
              </kbd>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center gap-1.5 pt-2.5 pb-1 shrink-0 px-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-(--nav-hover-bg) transition-colors cursor-pointer"
              title="Search navigation (click to expand)"
            >
              <Search className="size-4" />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-default scrollbar-track-transparent',
            isCollapsed ? 'lg:px-2 px-3 space-y-4' : 'px-3 space-y-4'
          )}
          aria-label="Main Navigation"
        >
          {navSections.map((section) => {
            const visibleItems = section.items
              .filter((item) => !item.permission || hasPermission(item.permission))
              .filter((item) =>
                searchQuery
                  ? item.label.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              );

            if (visibleItems.length === 0) return null;

            const isSectionCollapsed = !!collapsedSections[section.title] && !searchQuery;
            const hasActiveChild = section.items.some((item) =>
              isItemActive(item.to, location.pathname === item.to.split('?')[0])
            );

            return (
              <div key={section.title} className="space-y-0.5">
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full px-2.5 py-1.5 text-[10px] font-bold tracking-[0.14em] text-(--nav-section-fg) uppercase flex items-center justify-between group hover:text-default rounded-md transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="size-1 rounded-full bg-primary/60" />
                      <span className="truncate">{t(`sections.${section.id}` as unknown as string, { defaultValue: section.title })}</span>
                      {hasActiveChild && isSectionCollapsed && (
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" title="Active module inside" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        {visibleItems.length}
                      </span>
                      {isSectionCollapsed ? (
                        <ChevronRight className="size-3 text-muted/60" />
                      ) : (
                        <ChevronDown className="size-3 text-muted/60" />
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="hidden lg:block my-2 border-t border-(--nav-border)/50" />
                )}

                {/* Section Items (hidden if accordion is collapsed and not in icon-rail mode) */}
                {(!isSectionCollapsed || isCollapsed) && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const itemTransKey = `items.${item.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}` as const;
                      const itemLabel = t(itemTransKey as unknown as string, { defaultValue: item.label });
                      return (
                        <NavLink
                          key={item.id}
                          to={item.to}
                          onClick={onClose}
                          title={isCollapsed ? itemLabel : undefined}
                          className={({ isActive }) => {
                            const active = isItemActive(item.to, isActive);
                            return cn(
                              'group relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary outline-none h-9.5',
                              isCollapsed
                                ? 'lg:justify-center justify-between px-3'
                                : 'justify-between px-3',
                              active
                                ? 'font-semibold text-primary dark:text-white bg-(--nav-active-bg) border-l-2 border-(--nav-active-marker) shadow-xs'
                                : 'text-muted hover:text-default hover:bg-(--nav-hover-bg) border-l-2 border-transparent'
                            );
                          }}
                        >
                          {({ isActive }) => {
                            const active = isItemActive(item.to, isActive);
                            return (
                              <>
                                <div
                                  className={cn(
                                    'flex items-center gap-2.5 min-w-0',
                                    isCollapsed && 'lg:justify-center'
                                  )}
                                >
                                  <Icon
                                    className={cn(
                                      'size-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                                      active
                                        ? 'text-primary dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                                        : 'text-muted group-hover:text-default'
                                    )}
                                    aria-hidden="true"
                                  />
                                  <span
                                    className={cn(
                                      'truncate tracking-normal',
                                      isCollapsed && 'lg:hidden'
                                    )}
                                  >
                                    {itemLabel}
                                  </span>
                                </div>

                                {item.badge && (
                                  <span
                                    className={cn(
                                      'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 shadow-xs',
                                      isCollapsed && 'lg:hidden',
                                      item.badgeTone === 'success'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                        : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                    )}
                                  >
                                    {t(`badges.${item.badge.toLowerCase()}` as unknown as string, { defaultValue: item.badge })}
                                  </span>
                                )}
                              </>
                            );
                          }}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PWA Install Button for ERP */}
        {isInstallable && !isInstalled && (
          <div className="px-2 py-1.5 border-t border-(--nav-border) bg-(--nav-bg-deep)/30 shrink-0">
            <button
              type="button"
              onClick={() => promptInstall()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/25 text-xs font-medium transition cursor-pointer',
                isCollapsed && 'px-1.5'
              )}
              title={i18n.language === 'bn' ? `${erpInstallTitle} অ্যাপ ইনস্টল করুন` : `Install ${erpInstallTitle}`}
            >
              <Download className="size-3.5 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">
                  {i18n.language === 'bn' ? `${erpInstallTitle} ইনস্টল` : `Install ${erpInstallTitle}`}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Desktop & Mobile Sidebar Bottom Footer with Version, Status & DevCenterPoint Branding */}
        <div className="flex flex-col border-t border-(--nav-border) px-3 py-2 bg-(--nav-bg-deep)/50 shrink-0 gap-1">
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted/80">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-[11px]">{tenantTier}</span>
                </div>
                <span className="text-[9px] font-mono text-muted/60 uppercase">{appVersion}</span>
              </div>
              <div className="text-[10px] text-muted/70 flex items-center justify-between pt-0.5 border-t border-(--nav-border)/40">
                <span className="truncate">{i18n.language === 'bn' ? 'প্রকৌশল:' : 'Engineered by:'}</span>
                <a
                  href="https://devcenterpoint.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline transition-colors shrink-0"
                >
                  DevCenterPoint
                </a>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-center py-0.5">
              <a
                href="https://devcenterpoint.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Engineered by DevCenterPoint (https://devcenterpoint.com)"
                className="text-[9px] font-mono font-bold text-muted/60 hover:text-primary transition-colors"
              >
                DCP
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}


