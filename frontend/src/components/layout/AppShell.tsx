import { useState, Suspense, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { RouteLoadingFallback } from '../routing/RouteLoadingFallback';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ImpersonationBanner } from './ImpersonationBanner';
import { OfflineBanner } from './OfflineBanner';
import { SeoHead } from '../seo/SeoHead';
import { cn } from '../../lib/utils';
import { useTenantBranding, isStaleEngineName } from '../../lib/theme/useTenantBranding';
import { useAuthStore } from '../../lib/auth/authStore';
import { InteractiveTutorialModal } from '../../modules/tutorial/InteractiveTutorialModal';

function getRouteTitle(pathname: string): string {
  if (pathname === '/dashboard' || pathname === '/') return 'Executive Operations';
  if (pathname.startsWith('/production')) return 'Factory Production';
  if (pathname.startsWith('/inventory') || pathname.startsWith('/warehouse') || pathname.startsWith('/stock')) return 'Warehouse & Stock';
  if (pathname.startsWith('/qc') || pathname.startsWith('/quality')) return 'Quality Control';
  if (pathname.startsWith('/pos')) return 'Point of Sale (POS)';
  if (pathname.startsWith('/sales') || pathname.startsWith('/invoices')) return 'Sales & Invoices';
  if (pathname.startsWith('/crm') || pathname.startsWith('/leads')) return 'Customer Leads & CRM';
  if (pathname.startsWith('/finance') || pathname.startsWith('/accounting')) return 'Finance & Accounts';
  if (pathname.startsWith('/hr') || pathname.startsWith('/workforce') || pathname.startsWith('/employees')) return 'Workforce & HR';
  if (pathname.startsWith('/procurement') || pathname.startsWith('/purchasing')) return 'Purchasing & Sourcing';
  if (pathname.startsWith('/logistics') || pathname.startsWith('/delivery')) return 'Delivery & Couriers';
  if (pathname.startsWith('/storefront')) return 'Online Store CMS';
  if (pathname.startsWith('/databin')) return 'Data Bin & Recovery Vault';
  if (pathname.startsWith('/settings')) return 'Settings & Governance';
  if (pathname.startsWith('/profile')) return 'User Profile';
  if (pathname.startsWith('/users')) return 'Users & Access';
  return '';
}

export function AppShell() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { companyName } = useTenantBranding();
  const tenantName = useAuthStore((s) => s.tenant?.name);
  const brandName =
    (companyName && !isStaleEngineName(companyName))
      ? companyName
      : (tenantName && !isStaleEngineName(tenantName)
        ? tenantName
        : 'Operations Platform');

  const pageTitle = useMemo(() => {
    const routeTitle = getRouteTitle(location.pathname);
    return routeTitle ? `${routeTitle} | ${brandName}` : `${brandName} — ERP Operations`;
  }, [location.pathname, brandName]);

  // Close mobile sidebar drawer upon navigation
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsMobileSidebarOpen(false);
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('erp_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('erp_sidebar_collapsed', String(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh bg-base text-default font-sans antialiased flex-col w-full max-w-full overflow-x-hidden">
      <SeoHead
        title={pageTitle}
        description="Private Tenant Enterprise Management Portal"
        noIndex={true}
        brandName={brandName}
      />
      <OfflineBanner />
      <ImpersonationBanner />
      <InteractiveTutorialModal />
      <div className="flex flex-1 min-h-0 w-full max-w-full overflow-x-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        {/* Main content wrapper with offset for desktop sidebar */}
        <div
          className={cn(
            'flex flex-1 flex-col min-w-0 w-full max-w-full overflow-x-hidden transition-[padding] duration-300 ease-in-out',
            isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          )}
        >
          <AppHeader
            onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />

          <main className="flex-1 p-(--page-padding-mobile) pb-20 sm:p-(--page-padding) sm:pb-24 lg:pb-(--page-padding) overflow-x-hidden min-w-0 w-full max-w-full">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {/* Mobile Persistent Bottom Navigation Bar (< lg) */}
      <MobileBottomNav
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isSidebarOpen={isMobileSidebarOpen}
      />
    </div>
  );
}
