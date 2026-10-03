// ═══════════════════════════════════════════════════════════════════════════
// ROUTE PRELOAD REGISTRY (Instant Workspace Switching)
// ───────────────────────────────────────────────────────────────────────────
// Maps route paths to dynamic chunk imports for instant navigation.
// When a user hovers over a link, focuses a navigation element, or rests on idle,
// the route chunk is preloaded into the browser module cache.
// ═══════════════════════════════════════════════════════════════════════════

type ModuleLoader = () => Promise<unknown>;

const preloadedModules = new Set<string>();

const routeLoaders: Record<string, { id: string; load: ModuleLoader }> = {
  '/dashboard': {
    id: 'dashboard',
    load: () => import('../pages/dashboard/TenantRoleDashboard'),
  },
  '/catalogue': {
    id: 'catalogue',
    load: () => import('../modules/catalogue/CatalogueWorkspace'),
  },
  '/production': {
    id: 'production',
    load: () => import('../modules/production/ProductionWorkspace'),
  },
  '/qc': {
    id: 'qc',
    load: () => import('../modules/qc/QcWorkspace'),
  },
  '/inventory': {
    id: 'inventory',
    load: () => import('../modules/inventory/InventoryWorkspace'),
  },
  '/purchasing': {
    id: 'purchasing',
    load: () => import('../modules/purchasing/PurchasingWorkspace'),
  },
  '/sales': {
    id: 'sales',
    load: () => import('../modules/sales/SalesWorkspace'),
  },
  '/crm': {
    id: 'crm',
    load: () => import('../modules/crm/CrmWorkspace'),
  },
  '/pos': {
    id: 'pos',
    load: () => import('../modules/pos/PosWorkspace'),
  },
  '/logistics': {
    id: 'delivery',
    load: () => import('../modules/delivery/DeliveryWorkspace'),
  },
  '/finance': {
    id: 'finance',
    load: () => import('../modules/finance/FinanceWorkspace'),
  },
  '/assets': {
    id: 'assets',
    load: () => import('../modules/assets/AssetsWorkspace'),
  },
  '/hr': {
    id: 'hr',
    load: () => import('../modules/hr/HrWorkspace'),
  },
  '/workforce': {
    id: 'hr',
    load: () => import('../modules/hr/HrWorkspace'),
  },
  '/reports': {
    id: 'reports',
    load: () => import('../modules/reports/ReportsWorkspace'),
  },
  '/storefront': {
    id: 'storefront-settings',
    load: () => import('../modules/storefront/StorefrontSettingsWorkspace'),
  },
  '/storefront/builder': {
    id: 'storefront-builder',
    load: () => import('../modules/storefront/StorefrontPageBuilderWorkspace'),
  },
  '/settings': {
    id: 'settings-center',
    load: () => import('../modules/settings/SettingsCenterWorkspace'),
  },
  '/settings/workflows': {
    id: 'workflows',
    load: () => import('../modules/settings/WorkflowAutomationWorkspace'),
  },
  '/settings/seo': {
    id: 'seo',
    load: () => import('../pages/settings/SeoDiscoverabilityWorkspace'),
  },
  '/settings/bin': {
    id: 'databin',
    load: () => import('../pages/settings/DataBinWorkspace'),
  },
  '/settings/users': {
    id: 'users',
    load: () => import('../pages/settings/UsersManagementWorkspace'),
  },
  '/users': {
    id: 'users',
    load: () => import('../pages/settings/UsersManagementWorkspace'),
  },
  '/settings/roles': {
    id: 'roles',
    load: () => import('../pages/settings/RolesManagementWorkspace'),
  },
  '/roles': {
    id: 'roles',
    load: () => import('../pages/settings/RolesManagementWorkspace'),
  },
  '/settings/audit-logs': {
    id: 'activity-log',
    load: () => import('../pages/settings/ActivityLogWorkspace'),
  },
  '/audit-logs': {
    id: 'activity-log',
    load: () => import('../pages/settings/ActivityLogWorkspace'),
  },
  '/activity-logs': {
    id: 'activity-log',
    load: () => import('../pages/settings/ActivityLogWorkspace'),
  },
  '/profile': {
    id: 'profile',
    load: () => import('../pages/settings/ProfileSettingsWorkspace'),
  },
  '/tutorial': {
    id: 'tutorial',
    load: () => import('../modules/tutorial/InteractiveTutorialWorkspace'),
  },
};

/**
 * Preload a target route's code chunk into browser memory.
 * Idempotent, safe to fire on mouseEnter, touchStart, or keyboard focus.
 */
export function preloadRoute(toPath: string): void {
  if (!toPath || typeof window === 'undefined') return;

  const pathPart = toPath.split('?')[0];
  if (!pathPart) return;
  const cleanPath = pathPart.split('#')[0];
  if (!cleanPath) return;

  const exactMatch = routeLoaders[cleanPath];

  if (exactMatch) {
    if (!preloadedModules.has(exactMatch.id)) {
      preloadedModules.add(exactMatch.id);
      exactMatch.load().catch(() => {
        preloadedModules.delete(exactMatch.id);
      });
    }
    return;
  }

  // Prefix match (e.g. /settings/something -> /settings loader)
  for (const [prefix, loader] of Object.entries(routeLoaders)) {
    if (cleanPath.startsWith(prefix) && prefix !== '/') {
      if (!preloadedModules.has(loader.id)) {
        preloadedModules.add(loader.id);
        loader.load().catch(() => {
          preloadedModules.delete(loader.id);
        });
      }
      return;
    }
  }
}

/**
 * Preload high-frequency core ERP workspace modules during browser idle time.
 */
export function preloadCoreRoutesOnIdle(): void {
  if (typeof window === 'undefined') return;

  const coreRoutes = ['/dashboard', '/inventory', '/production', '/sales', '/pos'];

  const scheduleIdle =
    'requestIdleCallback' in window
      ? (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
          .requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1200);

  scheduleIdle(
    () => {
      coreRoutes.forEach((route) => {
        preloadRoute(route);
      });
    },
    { timeout: 3000 }
  );
}
