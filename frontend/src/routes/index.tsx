import { lazy, Suspense } from 'react';
import { Navigate, createBrowserRouter, Outlet } from 'react-router-dom';
import { usePwaManifest } from '../hooks/usePwaManifest';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { RouteErrorBoundary } from '../components/routing/RouteErrorBoundary';
import { RouteLoadingFallback } from '../components/routing/RouteLoadingFallback';

// Auth & Shell Fallbacks
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const NotFoundPage = lazy(() =>
  import('../pages/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

// ERP Tenant Workspaces
const TenantRoleDashboard = lazy(() =>
  import('../pages/dashboard/TenantRoleDashboard').then((m) => ({ default: m.TenantRoleDashboard }))
);
const CatalogueWorkspace = lazy(() => import('../modules/catalogue/CatalogueWorkspace'));
const ProductionWorkspace = lazy(() => import('../modules/production/ProductionWorkspace'));
const QcWorkspace = lazy(() => import('../modules/qc/QcWorkspace'));
const InventoryWorkspace = lazy(() => import('../modules/inventory/InventoryWorkspace'));
const PurchasingWorkspace = lazy(() => import('../modules/purchasing/PurchasingWorkspace'));
const SalesWorkspace = lazy(() => import('../modules/sales/SalesWorkspace'));
const PosWorkspace = lazy(() => import('../modules/pos/PosWorkspace'));
const DeliveryWorkspace = lazy(() => import('../modules/delivery/DeliveryWorkspace'));
const FinanceWorkspace = lazy(() => import('../modules/finance/FinanceWorkspace'));
const AssetsWorkspace = lazy(() => import('../modules/assets/AssetsWorkspace'));
const HrWorkspace = lazy(() => import('../modules/hr/HrWorkspace'));
const ReportsWorkspace = lazy(() =>
  import('../modules/reports/ReportsWorkspace').then((m) => ({ default: m.ReportsWorkspace }))
);
const ActivityLogWorkspace = lazy(() =>
  import('../pages/settings/ActivityLogWorkspace').then((m) => ({
    default: m.ActivityLogWorkspace,
  }))
);
const UsersManagementWorkspace = lazy(() =>
  import('../pages/settings/UsersManagementWorkspace').then((m) => ({
    default: m.UsersManagementWorkspace,
  }))
);
const RolesManagementWorkspace = lazy(() =>
  import('../pages/settings/RolesManagementWorkspace').then((m) => ({
    default: m.RolesManagementWorkspace,
  }))
);
const SettingsCenterWorkspace = lazy(() =>
  import('../modules/settings/SettingsCenterWorkspace').then((m) => ({
    default: m.SettingsCenterWorkspace,
  }))
);
const ProfileSettingsWorkspace = lazy(() =>
  import('../pages/settings/ProfileSettingsWorkspace').then((m) => ({
    default: m.ProfileSettingsWorkspace,
  }))
);
const SeoDiscoverabilityWorkspace = lazy(() =>
  import('../pages/settings/SeoDiscoverabilityWorkspace').then((m) => ({
    default: m.SeoDiscoverabilityWorkspace,
  }))
);
const DataBinWorkspace = lazy(() =>
  import('../pages/settings/DataBinWorkspace').then((m) => ({
    default: m.DataBinWorkspace,
  }))
);
const WorkflowAutomationWorkspace = lazy(() =>
  import('../modules/settings/WorkflowAutomationWorkspace').then((m) => ({
    default: m.WorkflowAutomationWorkspace,
  }))
);
const OnboardingWizard = lazy(() =>
  import('../modules/platform/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
);
const InteractiveTutorialWorkspace = lazy(() =>
  import('../modules/tutorial/InteractiveTutorialWorkspace').then((m) => ({
    default: m.InteractiveTutorialWorkspace,
  }))
);

// Master SaaS Platform Admin imports
import { PlatformProtectedRoute } from '../components/platform/PlatformProtectedRoute';
import { PlatformShell } from '../components/platform/PlatformShell';
const PlatformLoginPage = lazy(() => import('../pages/platform/PlatformLoginPage'));
const PlatformDashboardWorkspace = lazy(
  () => import('../modules/platform/PlatformDashboardWorkspace')
);
const TenantDirectoryWorkspace = lazy(() => import('../modules/platform/TenantDirectoryWorkspace'));
const TenantRegistrationWizard = lazy(() => import('../modules/platform/TenantRegistrationWizard'));
const TenantDetailWorkspace = lazy(() => import('../modules/platform/TenantDetailWorkspace'));
const PlanManagerWorkspace = lazy(() => import('../modules/platform/PlanManagerWorkspace'));
const PlatformAuditWorkspace = lazy(() => import('../modules/platform/PlatformAuditWorkspace'));
const PlatformErrorMonitoringWorkspace = lazy(
  () => import('../modules/platform/PlatformErrorMonitoringWorkspace')
);
const PlatformPaymentsWorkspace = lazy(() => import('../modules/platform/PlatformPaymentsWorkspace'));
const PlatformFeatureFlagsWorkspace = lazy(() => import('../modules/platform/PlatformFeatureFlagsWorkspace'));
const PlatformAnnouncementsWorkspace = lazy(() => import('../modules/platform/PlatformAnnouncementsWorkspace'));
const PlatformSupportWorkspace = lazy(() => import('../modules/platform/PlatformSupportWorkspace'));
const PlatformAdminWorkspace = lazy(() => import('../modules/platform/PlatformAdminWorkspace'));
const PlatformSettingsWorkspace = lazy(() => import('../modules/platform/PlatformSettingsWorkspace'));

// Public Headless E-Commerce Storefront imports
import { StorefrontShell } from '../components/storefront/StorefrontShell';
import { StorefrontRedirect } from '../components/routing/StorefrontRedirect';
const StorefrontHomePage = lazy(() =>
  import('../pages/storefront/StorefrontHomePage').then((m) => ({ default: m.StorefrontHomePage }))
);
const StorefrontCatalogPage = lazy(() =>
  import('../pages/storefront/StorefrontCatalogPage').then((m) => ({
    default: m.StorefrontCatalogPage,
  }))
);
const StorefrontProductDetailPage = lazy(() =>
  import('../pages/storefront/StorefrontProductDetailPage').then((m) => ({
    default: m.StorefrontProductDetailPage,
  }))
);
const StorefrontCheckoutPage = lazy(() =>
  import('../pages/storefront/StorefrontCheckoutPage').then((m) => ({
    default: m.StorefrontCheckoutPage,
  }))
);
const StorefrontOrderConfirmationPage = lazy(() =>
  import('../pages/storefront/StorefrontOrderConfirmationPage').then((m) => ({
    default: m.StorefrontOrderConfirmationPage,
  }))
);
const StorefrontOrderTrackingPage = lazy(() =>
  import('../pages/storefront/StorefrontOrderTrackingPage').then((m) => ({
    default: m.StorefrontOrderTrackingPage,
  }))
);
const StorefrontDynamicPage = lazy(() =>
  import('../pages/storefront/StorefrontDynamicPage').then((m) => ({
    default: m.StorefrontDynamicPage,
  }))
);
const StorefrontAccountPage = lazy(() =>
  import('../pages/storefront/StorefrontAccountPage').then((m) => ({
    default: m.StorefrontAccountPage,
  }))
);
const StorefrontSettingsWorkspace = lazy(() =>
  import('../modules/storefront/StorefrontSettingsWorkspace').then((m) => ({
    default: m.StorefrontSettingsWorkspace,
  }))
);
const StorefrontPageBuilderWorkspace = lazy(() =>
  import('../modules/storefront/StorefrontPageBuilderWorkspace').then((m) => ({
    default: m.StorefrontPageBuilderWorkspace,
  }))
);

const storefrontRouteChildren = [
  {
    index: true,
    element: <StorefrontHomePage />,
  },
  {
    path: 'products',
    element: <StorefrontCatalogPage />,
  },
  {
    path: 'collections/:categorySlug',
    element: <StorefrontCatalogPage />,
  },
  {
    path: 'products/:idOrSku',
    element: <StorefrontProductDetailPage />,
  },
  {
    path: 'checkout',
    element: <StorefrontCheckoutPage />,
  },
  {
    path: 'order-confirmed',
    element: <StorefrontOrderConfirmationPage />,
  },
  {
    path: 'track',
    element: <StorefrontOrderTrackingPage />,
  },
  {
    path: 'account',
    element: <StorefrontAccountPage />,
  },
  {
    path: 'pages/:slug',
    element: <StorefrontDynamicPage />,
  },
];

const isMasterPlatformDomain = (() => {
  if (typeof window === 'undefined' || !window.location) return false;
  const rawHost = window.location.hostname;
  if (!rawHost) return false;
  const host = rawHost.toLowerCase().split(':')[0] ?? '';
  const masterDomain = (import.meta.env['VITE_MASTER_DOMAIN'] || 'proerp.devcenterpoint.com').toLowerCase();
  return host === masterDomain || host.startsWith('proerp.') || host.startsWith('platform.') || host.startsWith('admin.');
})();

const isStorefrontCustomDomain = (() => {
  if (typeof window === 'undefined' || !window.location) return false;
  const rawHost = window.location.hostname;
  if (!rawHost) return false;
  const host = rawHost.toLowerCase().split(':')[0] ?? '';
  if (!host || ['localhost', '127.0.0.1'].includes(host)) return false;

  const masterDomain = (import.meta.env['VITE_MASTER_DOMAIN'] || 'proerp.devcenterpoint.com').toLowerCase();
  const tenantBaseDomain = (import.meta.env['VITE_TENANT_BASE_DOMAIN'] || 'devcenterpoint.com').toLowerCase();

  // If host is the master domain or an admin/erp subdomain, it is not a public custom storefront
  if (
    host === masterDomain ||
    host.startsWith('proerp.') ||
    host.startsWith('platform.') ||
    host.startsWith('admin.') ||
    host.startsWith('app.') ||
    host.startsWith('erp.')
  ) {
    return false;
  }

  // Tenant subdomains on devcenterpoint.com (e.g. {slug}.devcenterpoint.com) are tenant ERPs
  if (host.endsWith('.' + tenantBaseDomain)) {
    return false;
  }

  // Any other external domain (e.g. custombrand.com) is treated as a verified custom storefront
  return true;
})();

function RootLayout() {
  usePwaManifest();
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // If accessing through master platform domain at root "/", redirect to /platform
  ...(isMasterPlatformDomain
    ? [
        {
          path: '/',
          element: <Navigate to="/platform" replace />,
        },
      ]
    : []),

  // If accessing through a verified custom storefront domain, serve the storefront at root "/"
  ...(isStorefrontCustomDomain
    ? [
        {
          path: '/',
          element: <StorefrontShell />,
          errorElement: <RouteErrorBoundary />,
          children: storefrontRouteChildren,
        },
      ]
    : []),

  // Public Headless Storefront Routes (subdomain-based)
  {
    path: '/store',
    element: <StorefrontRedirect />,
  },
  {
    path: '/store/:subdomain',
    element: <StorefrontShell />,
    errorElement: <RouteErrorBoundary />,
    children: storefrontRouteChildren,
  },

  // Master SaaS Admin Platform Routes
  {
    path: '/platform/login',
    element: (
      <Suspense fallback={<RouteLoadingFallback />}>
        <PlatformLoginPage />
      </Suspense>
    ),
  },
  {
    path: '/platform',
    element: <PlatformProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <PlatformShell />,
        children: [
          {
            index: true,
            element: <PlatformDashboardWorkspace />,
          },
          {
            path: 'tenants',
            element: <TenantDirectoryWorkspace />,
          },
          {
            path: 'tenants/new',
            element: <TenantRegistrationWizard />,
          },
          {
            path: 'tenants/:id',
            element: <TenantDetailWorkspace />,
          },
          {
            path: 'plans',
            element: <PlanManagerWorkspace />,
          },
          {
            path: 'payments',
            element: <PlatformPaymentsWorkspace />,
          },
          {
            path: 'feature-flags',
            element: <PlatformFeatureFlagsWorkspace />,
          },
          {
            path: 'announcements',
            element: <PlatformAnnouncementsWorkspace />,
          },
          {
            path: 'support',
            element: <PlatformSupportWorkspace />,
          },
          {
            path: 'audit-logs',
            element: <PlatformAuditWorkspace />,
          },
          {
            path: 'errors',
            element: <PlatformErrorMonitoringWorkspace />,
          },
          {
            path: 'admins',
            element: <PlatformAdminWorkspace />,
          },
          {
            path: 'settings',
            element: <PlatformSettingsWorkspace />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },

  // Tenant Application Routes (Slice Mart as Tenant #1)
  {
    path: '/login',
    element: (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <TenantRoleDashboard />,
          },
          {
            path: 'dashboard',
            element: <TenantRoleDashboard />,
          },
          {
            path: 'tutorial',
            element: <InteractiveTutorialWorkspace />,
          },
          {
            path: 'guide',
            element: <Navigate to="/tutorial" replace />,
          },
          {
            path: 'overview',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: 'catalogue',
            element: <CatalogueWorkspace />,
          },
          {
            path: 'production',
            element: <ProductionWorkspace />,
          },
          {
            path: 'qc',
            element: <QcWorkspace />,
          },
          {
            path: 'inventory',
            element: <InventoryWorkspace />,
          },
          {
            path: 'purchasing',
            element: <PurchasingWorkspace />,
          },
          {
            path: 'procurement',
            element: <Navigate to="/purchasing" replace />,
          },
          {
            path: 'sales',
            element: <SalesWorkspace />,
          },
          {
            path: 'pos',
            element: <PosWorkspace />,
          },
          {
            path: 'logistics',
            element: <DeliveryWorkspace />,
          },
          {
            path: 'delivery',
            element: <Navigate to="/logistics" replace />,
          },
          {
            path: 'finance',
            element: <FinanceWorkspace />,
          },
          {
            path: 'accounting',
            element: <Navigate to="/finance" replace />,
          },
          {
            path: 'assets',
            element: <AssetsWorkspace />,
          },
          {
            path: 'hr',
            element: <HrWorkspace />,
          },
          {
            path: 'workforce',
            element: <HrWorkspace />,
          },
          {
            path: 'payroll',
            element: <Navigate to="/hr?tab=payroll" replace />,
          },
          {
            path: 'employees',
            element: <Navigate to="/workforce?tab=employees" replace />,
          },
          {
            path: 'attendance',
            element: <Navigate to="/workforce?tab=attendance" replace />,
          },
          {
            path: 'reports',
            element: <ReportsWorkspace />,
          },
          {
            path: 'rms',
            element: <Navigate to="/reports" replace />,
          },
          {
            path: 'storefront',
            element: <StorefrontSettingsWorkspace />,
          },
          {
            path: 'storefront/builder',
            element: <StorefrontPageBuilderWorkspace />,
          },
          {
            path: 'audit-logs',
            element: <ActivityLogWorkspace />,
          },
          {
            path: 'activity-logs',
            element: <ActivityLogWorkspace />,
          },
          {
            path: 'audit',
            element: <Navigate to="/audit-logs" replace />,
          },
          {
            path: 'users',
            element: <UsersManagementWorkspace />,
          },
          {
            path: 'roles',
            element: <RolesManagementWorkspace />,
          },
          {
            path: 'settings',
            element: <SettingsCenterWorkspace />,
          },
          {
            path: 'settings/users',
            element: <UsersManagementWorkspace />,
          },
          {
            path: 'settings/roles',
            element: <RolesManagementWorkspace />,
          },
          {
            path: 'settings/audit-logs',
            element: <ActivityLogWorkspace />,
          },
          {
            path: 'settings/profile',
            element: <ProfileSettingsWorkspace />,
          },
          {
            path: 'settings/seo',
            element: <SeoDiscoverabilityWorkspace />,
          },
          {
            path: 'settings/bin',
            element: <DataBinWorkspace />,
          },
          {
            path: 'bin',
            element: <Navigate to="/settings/bin" replace />,
          },
          {
            path: 'settings/workflows',
            element: <WorkflowAutomationWorkspace />,
          },
          {
            path: 'workflows',
            element: <Navigate to="/settings/workflows" replace />,
          },
          {
            path: 'seo',
            element: <Navigate to="/settings/seo" replace />,
          },
          {
            path: 'onboarding',
            element: <OnboardingWizard />,
          },
          {
            path: 'settings/:group',
            element: <SettingsCenterWorkspace />,
          },
          {
            path: 'profile',
            element: <ProfileSettingsWorkspace />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<RouteLoadingFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
    ],
  },
]);
