import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingFallback } from '../routing/RouteLoadingFallback';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { OfflineBanner } from './OfflineBanner';
import { SeoHead } from '../seo/SeoHead';
import { cn } from '../../lib/utils';
import { useTenantBranding } from '../../lib/theme/useTenantBranding';
import { useAuthStore } from '../../lib/auth/authStore';
import { InteractiveTutorialModal } from '../../modules/tutorial/InteractiveTutorialModal';

export function AppShell() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { companyName } = useTenantBranding();
  const tenantName = useAuthStore((s) => s.tenant?.name);
  const brandName = companyName || tenantName || 'Enterprise ERP';

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
        title={brandName}
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

          <main className="flex-1 p-(--page-padding-mobile) sm:p-(--page-padding) overflow-x-hidden min-w-0 w-full max-w-full">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
