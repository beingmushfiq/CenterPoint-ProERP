import React from 'react';
import { NavLink } from 'react-router-dom';
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
      { to: '/platform/tenants', label: 'Tenant Directory', icon: Building2, end: true },
      { to: '/platform/tenants/new', label: 'Provision Tenant', icon: UserPlus, end: true },
    ],
  },
  {
    label: 'Billing & Tiers',
    items: [
      { to: '/platform/plans', label: 'Subscription Plans', icon: CreditCard, end: true },
      { to: '/platform/payments', label: 'SaaS Payments', icon: Receipt, end: true },
    ],
  },
  {
    label: 'Platform Control',
    items: [
      { to: '/platform/feature-flags', label: 'Flags & Modules', icon: Flag, end: true },
      { to: '/platform/announcements', label: 'Announcements', icon: Megaphone, end: true },
      { to: '/platform/support', label: 'Support Tickets', icon: LifeBuoy, end: true },
    ],
  },
  {
    label: 'Observability',
    items: [
      { to: '/platform/audit-logs', label: 'Platform Audit Trail', icon: History, end: true },
      { to: '/platform/errors', label: 'Error Monitoring', icon: ShieldAlert, end: true },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/platform/admins', label: 'Platform Admins', icon: Users, end: true },
      { to: '/platform/settings', label: 'Platform Settings', icon: Settings, end: true },
    ],
  },
];

interface PlatformSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const PlatformSidebar: React.FC<PlatformSidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const renderContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full relative">
      {/* Subtle Ambient Radial Lighting for Dark Mode */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-amber-500/4 via-amber-500/1 to-transparent dark:from-amber-500/10 dark:via-amber-500/3"
        aria-hidden="true"
      />

      <div className="flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-(--nav-border) flex items-center justify-between bg-(--nav-bg)/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 rounded-xl bg-linear-to-br from-amber-500 via-amber-600 to-amber-800 p-0.5 shadow-md shadow-amber-500/20 ring-1 ring-black/5 dark:ring-white/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-lg bg-white dark:bg-[#090d16]/90 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Layers className="w-4 h-4 stroke-[2.5] drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 ring-2 ring-white dark:ring-[#070a10]" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-default text-sm truncate font-sans">
                  Platform SaaS
                </span>
                <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300 border border-amber-500/30 tracking-wider uppercase font-mono">
                  Super
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-medium text-muted truncate flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  Root Control Plane
                </span>
              </div>
            </div>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-xl border border-(--nav-border) bg-surface-sunken hover:bg-surface text-muted hover:text-default cursor-pointer"
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
              <div className="px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-(--nav-section-fg) uppercase flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-amber-500/60" />
                <span>{group.label}</span>
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    onClick={() => {
                      if (isMobile && onCloseMobile) {
                        onCloseMobile();
                      }
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                          : 'text-muted hover:text-default hover:bg-(--nav-hover-bg)'
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-(--nav-border) text-[10px] text-muted space-y-1.5 bg-(--nav-bg-deep)">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted">
            <Sparkles className="size-3 text-amber-500" />
            <span>Platform Core v2.0</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted/60">Ready</span>
        </div>
        <div className="pt-1 border-t border-(--nav-border)/40 flex items-center justify-between text-[10px]">
          <span className="text-muted/70">Engineered by</span>
          <a
            href="https://devcenterpoint.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 font-semibold transition-colors"
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
      <aside className="hidden lg:flex w-64 border-r border-(--nav-border) bg-(--nav-bg) text-default flex-col justify-between shrink-0 h-screen sticky top-0 select-none shadow-xl dark:shadow-black/80">
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
              className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-(--nav-bg) border-r border-(--nav-border) text-default flex flex-col justify-between z-50 shadow-2xl overflow-hidden select-none"
            >
              {renderContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
