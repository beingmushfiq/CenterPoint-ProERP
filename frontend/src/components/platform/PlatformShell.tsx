import React, { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PlatformSidebar } from './PlatformSidebar';
import { PlatformHeader } from './PlatformHeader';
import { OfflineBanner } from '../layout/OfflineBanner';
import { SeoHead } from '../seo/SeoHead';
import { RouteLoadingFallback } from '../routing/RouteLoadingFallback';

export const PlatformShell: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const [prevPath, setPrevPath] = useState(location.pathname);

  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-base text-default flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-white relative">
      <SeoHead
        title="DevCenterPoint Superadmin Control Plane"
        description="Master Platform Superadmin System"
        noIndex={true}
        brandName="DevCenterPoint Master Engine"
      />
      <OfflineBanner />
      <div className="flex-1 flex min-w-0 h-screen overflow-hidden">
        {/* Platform Sidebar */}
        <PlatformSidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Control Plane Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <PlatformHeader
            onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          />
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto bg-base transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<RouteLoadingFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
