import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Store,
  PlusCircle,
  Menu,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';

interface MobileBottomNavProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenQuickAdd?: () => void;
  unreadCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  onOpenQuickAdd,
}) => {
  const { t } = useTranslation(['navigation', 'common']);
  const location = useLocation();
  const isModuleEnabled = useTenantCapabilityStore((s) => s.isModuleEnabled);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const isPosEnabled =
    isModuleEnabled('pos') && hasPermission(['pos.terminal.view', 'pos.sale.create', '*']);

  const isDashboardActive =
    location.pathname === '/dashboard' || location.pathname === '/';
  const isPosActive = location.pathname.startsWith('/pos');

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-default bg-surface/95 backdrop-blur-md pb-safe select-none shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)] transition-token-colors"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-15 items-center px-1 max-w-lg mx-auto">
        {/* 1. Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-colors cursor-pointer group active:scale-95',
              isActive || isDashboardActive
                ? 'text-primary font-bold'
                : 'text-muted hover:text-default'
            )
          }
        >
          <div
            className={cn(
              'flex items-center justify-center size-7 rounded-xl transition-all',
              isDashboardActive ? 'bg-primary/15 text-primary scale-105' : 'group-hover:bg-surface-sunken'
            )}
          >
            <LayoutDashboard className="size-4" />
          </div>
          <span className="truncate mt-0.5 max-w-16">
            {t('navigation.dashboard', 'Overview')}
          </span>
        </NavLink>

        {/* 2. Point of Sale (POS) */}
        {isPosEnabled ? (
          <NavLink
            to="/pos"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-colors cursor-pointer group active:scale-95',
                isActive || isPosActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-muted hover:text-default'
              )
            }
          >
            <div
              className={cn(
                'flex items-center justify-center size-7 rounded-xl transition-all',
                isPosActive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 scale-105'
                  : 'group-hover:bg-surface-sunken'
              )}
            >
              <Store className="size-4" />
            </div>
            <span className="truncate mt-0.5 max-w-16">POS</span>
          </NavLink>
        ) : (
          <NavLink
            to="/production"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-colors cursor-pointer group active:scale-95',
                isActive ? 'text-primary font-bold' : 'text-muted hover:text-default'
              )
            }
          >
            <div className="flex items-center justify-center size-7 rounded-xl transition-all group-hover:bg-surface-sunken">
              <Layers className="size-4" />
            </div>
            <span className="truncate mt-0.5 max-w-16">
              {t('navigation.production', 'Factory')}
            </span>
          </NavLink>
        )}

        {/* 3. Center Quick Add Action */}
        <div className="flex items-center justify-center h-full">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="flex flex-col items-center justify-center size-10 -mt-2 rounded-2xl bg-linear-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 active:scale-90 transition-all cursor-pointer"
            title={t('navigation.quickAdd', 'Quick Action')}
            aria-label="Quick Create Action"
          >
            <PlusCircle className="size-5" />
          </button>
        </div>

        {/* 4. Inventory / Stock Hub */}
        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-colors cursor-pointer group active:scale-95',
              isActive
                ? 'text-primary font-bold'
                : 'text-muted hover:text-default'
            )
          }
        >
          <div
            className={cn(
              'flex items-center justify-center size-7 rounded-xl transition-all',
              location.pathname.startsWith('/inventory')
                ? 'bg-primary/15 text-primary scale-105'
                : 'group-hover:bg-surface-sunken'
            )}
          >
            <Layers className="size-4" />
          </div>
          <span className="truncate mt-0.5 max-w-16">
            {t('navigation.stock', 'Stock')}
          </span>
        </NavLink>

        {/* 5. Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(
            'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-colors cursor-pointer group active:scale-95',
            isSidebarOpen ? 'text-primary font-bold' : 'text-muted hover:text-default'
          )}
          aria-label="Open Full Navigation Menu"
          aria-expanded={isSidebarOpen}
        >
          <div
            className={cn(
              'flex items-center justify-center size-7 rounded-xl transition-all',
              isSidebarOpen ? 'bg-primary/15 text-primary scale-105' : 'group-hover:bg-surface-sunken'
            )}
          >
            <Menu className="size-4" />
          </div>
          <span className="truncate mt-0.5 max-w-16">
            {t('navigation.menu', 'Menu')}
          </span>
        </button>
      </div>
    </nav>
  );
};
