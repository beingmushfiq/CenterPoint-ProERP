import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  CreditCard,
  Receipt,
  History,
  Layers,
  Sparkles,
  ShieldAlert,
  Flag,
  Megaphone,
  LifeBuoy,
  Users,
  Settings,
  X,
} from 'lucide-react';

interface NavGroup {
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Master Governance',
    items: [
      { to: '/platform', label: 'Overview & KPIs', icon: LayoutDashboard, end: true },
      { to: '/platform/tenants', label: 'Tenant Directory', icon: Building2, end: false },
      { to: '/platform/tenants/new', label: 'Provision Tenant', icon: UserPlus, end: true },
    ],
  },
  {
    label: 'Billing & Tiers',
    items: [
      { to: '/platform/plans', label: 'Subscription Plans', icon: CreditCard, end: false },
      { to: '/platform/payments', label: 'SaaS Payments', icon: Receipt, end: false },
    ],
  },
  {
    label: 'Platform Control',
    items: [
      { to: '/platform/feature-flags', label: 'Flags & Modules', icon: Flag, end: false },
      { to: '/platform/announcements', label: 'Announcements', icon: Megaphone, end: false },
      { to: '/platform/support', label: 'Support Tickets', icon: LifeBuoy, end: false },
    ],
  },
  {
    label: 'Observability',
    items: [
      { to: '/platform/audit-logs', label: 'Platform Audit Trail', icon: History, end: false },
      { to: '/platform/errors', label: 'Error Monitoring', icon: ShieldAlert, end: false },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/platform/admins', label: 'Platform Admins', icon: Users, end: false },
      { to: '/platform/settings', label: 'Platform Settings', icon: Settings, end: false },
    ],
  },
];

interface PlatformSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const PlatformSidebar: React.FC<PlatformSidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const location = useLocation();

  const isItemActive = (to: string, end?: boolean) => {
    if (end) {
      return location.pathname === to;
    }
    if (to === '/platform/tenants') {
      return (
        location.pathname === '/platform/tenants' ||
        (location.pathname.startsWith('/platform/tenants/') && location.pathname !== '/platform/tenants/new')
      );
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const renderContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full relative font-sans">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-amber-500/8 via-amber-500/2 to-transparent dark:from-amber-500/12 dark:via-amber-500/3"
        aria-hidden="true"
      />

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Brand Header */}
        <div className="sticky top-0 z-10 h-16 px-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white/95 dark:bg-[#070a12]/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-9 rounded-xl bg-linear-to-br from-amber-500 via-amber-600 to-amber-700 p-0.5 shadow-md shadow-amber-500/20 ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center shrink-0">
              <div className="size-full rounded-lg bg-white dark:bg-[#0a0f1d] flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Layers className="size-4 stroke-[2.5]" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex size-2">
                <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-amber-500 ring-2 ring-white dark:ring-[#070a12]" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-sm truncate font-sans">
                  Platform SaaS
                </span>
                <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30 tracking-wider uppercase font-mono">
                  Super
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Root Control Plane
                </span>
              </div>
            </div>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Grouped Navigation List */}
        <nav className="p-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5 select-none">
                <span className="size-1 rounded-full bg-amber-500/60" />
                <span>{group.label}</span>
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.to, item.end);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (isMobile && onCloseMobile) {
                        onCloseMobile();
                      }
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 shadow-xs ring-1 ring-amber-500/10'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`size-4 shrink-0 transition-colors ${
                          active
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {active && (
                      <span className="size-1.5 rounded-full bg-amber-500 shrink-0 shadow-xs shadow-amber-500/50" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5 bg-slate-50/80 dark:bg-black/30 backdrop-blur-xs shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-amber-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Platform Core v2.0</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
            Ready
          </span>
        </div>
        <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[10px]">
          <span className="text-slate-400 dark:text-slate-500">Engineered by</span>
          <a
            href="https://devcenterpoint.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 dark:text-amber-400 hover:underline font-bold transition-colors"
          >
            DevCenterPoint
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Hidden on < lg) */}
      <aside className="hidden lg:flex w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#070a12]/95 text-default flex-col justify-between shrink-0 h-screen sticky top-0 select-none shadow-sm dark:shadow-2xl">
        {renderContent(false)}
      </aside>

      {/* Mobile Off-Canvas Drawer (Visible on < lg when open) */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
              aria-label="Close Backdrop"
            />

            {/* Sliding Drawer */}
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#070a12] border-r border-slate-200 dark:border-slate-800/80 text-default flex flex-col justify-between z-50 shadow-2xl overflow-hidden select-none"
            >
              {renderContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
