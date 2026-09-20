import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  X,
  ShoppingCart,
  FileText,
  Download,
  Sparkles,
  Users,
  LayoutDashboard,
  Warehouse,
  Microscope,
  ShoppingBag,
  Factory,
  Coins,
  DollarSign,
  Clock,
  Plus,
  Compass,
  RefreshCw,
  Truck,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  OrderPOModal,
  StockReviewModal,
  QCAuditModal,
  InvoiceQuickViewModal,
  CustomDateRangeModal,
  WorkerDetailModal,
  ProductionOrderDetailModal,
  FinancialDueModal,
  type OrderPOItem,
  type DueCustomerItem,
} from './components/DashboardModals';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { promptPWAInstall, isPWAInstallable } from '../../registerSW';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantBranding, sanitizeTenantBusinessName } from '../../lib/theme/useTenantBranding';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import { getStorefrontExternalUrl } from '../../lib/storefront/storefrontUrl';
import { OnboardingStartupModal } from '../../modules/platform/OnboardingStartupModal';
import { OnboardingProgressCard } from '../../modules/platform/OnboardingProgressCard';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { SalesDashboardView } from './components/SalesDashboardView';
import { InventoryDashboardView } from './components/InventoryDashboardView';
import { QcDashboardView, type QcItem } from './components/QcDashboardView';
import { FinanceDashboardView } from './components/FinanceDashboardView';
import { WorkforceDashboardView } from './components/WorkforceDashboardView';
import { ProductionDashboardView } from './components/ProductionDashboardView';
import { PurchasingDashboardView } from './components/PurchasingDashboardView';
import { LogisticsDashboardView } from './components/LogisticsDashboardView';
import { EnterpriseSystemNavigator } from './components/EnterpriseSystemNavigator';

// ── Types & Datasets ──────────────────────────────────────────

export type DashboardRoleView =
  | 'executive'
  | 'production'
  | 'inventory'
  | 'qc'
  | 'sales'
  | 'finance'
  | 'workforce'
  | 'purchasing'
  | 'logistics';

interface DashboardTrendItem {
  day?: string;
  time: string;
  date?: string;
  revenue: number;
  production?: number;
  produced: number;
  qcPassed: number;
  target: number;
}

interface DashboardMetricsData {
  commercial: {
    today_revenue: number;
    month_revenue: number;
    active_orders: number;
    today_orders_count?: number;
    total_receivable_due: number;
  };
  production: {
    today_output: number;
    target_output: number;
    achievement_rate: number;
    active_batches: number;
    total_batches?: number;
  };
  inventory: {
    total_valuation: number;
    low_stock_count: number;
  };
  quality: {
    qc_pass_rate: number;
    pending_inspections: number;
    total_inspections?: number;
  };
  trends?: {
    weekly: DashboardTrendItem[];
    today: DashboardTrendItem[];
    monthly: DashboardTrendItem[];
  };
  recent_batches?: Array<{
    id: string;
    product: string;
    code: string;
    target: number;
    produced: number;
    progress: number;
    status: string;
  }>;
  recent_qc?: Array<{
    id: string;
    orderNo: string;
    product: string;
    qty: number;
    status: string;
    failed?: number;
    rework?: number;
  }>;
  active_workers?: Array<{
    initials: string;
    name: string;
    output: string;
    rate: number;
    badge: string;
    color: string;
  }>;
  attention_items?: OrderPOItem[];
}


export const TenantRoleDashboard: React.FC = () => {
  // ── Auth & Role Resolution ───────────────────────────────────
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { companyName, logoUrl } = useTenantBranding();
  const queryClient = useQueryClient();

  const erpInstallName = useMemo(() => {
    const brandingRecord = tenant?.branding as Record<string, unknown> | undefined;
    const brandingName = typeof brandingRecord?.['name'] === 'string' ? brandingRecord['name'] : undefined;
    const raw = companyName || brandingName || tenant?.name || 'Operations Platform';
    const cleanBase = sanitizeTenantBusinessName(raw, 'Operations Platform').replace(/\s+ERP$/i, '').trim();
    return `${cleanBase} ERP`;
  }, [companyName, tenant]);
  const { t } = useTranslation(['dashboard', 'common', 'navigation']);

  const storeSlug = tenant?.subdomain || tenant?.slug || 'store';

  const [isLiveTelemetry, setIsLiveTelemetry] = useState(true);

  const {
    data: metrics,
    refetch: refetchMetrics,
    isFetching: isRefreshingMetrics,
  } = useQuery({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>(
          '/dashboard/metrics'
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('commercial' in raw) return raw as DashboardMetricsData;
          if (
            'data' in raw &&
            raw.data &&
            typeof raw.data === 'object' &&
            'commercial' in raw.data
          ) {
            return raw.data as DashboardMetricsData;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    refetchInterval: isLiveTelemetry ? 5000 : 30000,
    staleTime: 4000,
  });

  const roleName = user?.role || (user?.is_platform_admin ? 'Super Administrator' : '');

  const canAccessExecutive = Boolean(
    user?.is_platform_admin ||
    hasPermission('*') ||
    (hasPermission('core.setting.view') &&
      hasPermission('sales.order.view') &&
      hasPermission('production.batch.view'))
  );
  const canAccessProduction = hasPermission([
    'production.batch.view',
    'production.plan.view',
    'production.worker_entry.view',
  ]);
  const canAccessInventory = hasPermission([
    'inventory.stock.view',
    'inventory.warehouse.view',
    'inventory.movement.view',
  ]);
  const canAccessQC = hasPermission(['qc.inspection.view', 'qc.parameter.view', 'qc.wastage.view']);
  const canAccessSales = hasPermission([
    'sales.order.view',
    'pos.terminal.view',
    'pos.sale.create',
    'sales.invoice.view',
  ]);
  const canAccessFinance = hasPermission([
    'finance.account.view',
    'finance.journal.view',
    'finance.expense.view',
    'sales.invoice.view',
  ]);
  const canAccessWorkforce = hasPermission([
    'hr.employee.view',
    'hr.attendance.view',
    'hr.payroll.view',
    'production.worker_entry.view',
  ]);
  const canAccessPurchasing = hasPermission([
    'purchasing.order.view',
    'purchasing.requisition.view',
    'purchasing.grn.view',
  ]);
  const canAccessLogistics = hasPermission([
    'logistics.shipment.view',
    'logistics.run_sheet.view',
    'logistics.delivery_order.view',
  ]);

  const initialView: DashboardRoleView = useMemo(() => {
    const slug = roleName.toLowerCase();
    if (slug.includes('finance') || slug.includes('account')) return 'finance';
    if (slug.includes('hr') || slug.includes('workforce') || slug.includes('payroll'))
      return 'workforce';
    if (slug.includes('purchase') || slug.includes('procurement')) return 'purchasing';
    if (slug.includes('delivery') || slug.includes('logistics') || slug.includes('dispatch'))
      return 'logistics';
    if (slug.includes('sales') || slug.includes('commercial') || slug.includes('pos'))
      return 'sales';
    if (slug.includes('store') || slug.includes('warehouse') || slug.includes('inventory'))
      return 'inventory';
    if (slug.includes('qc') || slug.includes('quality')) return 'qc';
    if (slug.includes('production') || slug.includes('factory')) return 'production';
    if (canAccessExecutive) return 'executive';
    if (canAccessProduction) return 'production';
    if (canAccessQC) return 'qc';
    if (canAccessInventory) return 'inventory';
    if (canAccessSales) return 'sales';
    if (canAccessFinance) return 'finance';
    if (canAccessWorkforce) return 'workforce';
    if (canAccessPurchasing) return 'purchasing';
    if (canAccessLogistics) return 'logistics';
    return 'executive';
  }, [
    roleName,
    canAccessExecutive,
    canAccessProduction,
    canAccessQC,
    canAccessInventory,
    canAccessSales,
    canAccessFinance,
    canAccessWorkforce,
    canAccessPurchasing,
    canAccessLogistics,
  ]);

  const availableViews = useMemo(() => {
    const views: Array<{
      id: DashboardRoleView;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [];
    if (canAccessExecutive) {
      views.push({ id: 'executive', label: t('perspectives.executive', { defaultValue: 'Executive Overview' }), icon: LayoutDashboard });
    }
    if (canAccessProduction) {
      views.push({ id: 'production', label: t('perspectives.production', { defaultValue: 'Factory Production' }), icon: Factory });
    }
    if (canAccessInventory) {
      views.push({ id: 'inventory', label: t('perspectives.inventory', { defaultValue: 'Stock & Warehouse' }), icon: Warehouse });
    }
    if (canAccessQC) {
      views.push({ id: 'qc', label: t('perspectives.qc', { defaultValue: 'Quality Control' }), icon: Microscope });
    }
    if (canAccessSales) {
      views.push({ id: 'sales', label: t('perspectives.sales', { defaultValue: 'Sales & POS' }), icon: ShoppingBag });
    }
    if (canAccessFinance) {
      views.push({ id: 'finance', label: t('perspectives.finance', { defaultValue: 'Finance & Accounts' }), icon: Coins });
    }
    if (canAccessWorkforce) {
      views.push({ id: 'workforce', label: t('perspectives.workforce', { defaultValue: 'Floor Workforce' }), icon: Users });
    }
    if (canAccessPurchasing) {
      views.push({ id: 'purchasing', label: t('perspectives.purchasing', { defaultValue: 'Supply Purchasing' }), icon: ShoppingCart });
    }
    if (canAccessLogistics) {
      views.push({ id: 'logistics', label: t('perspectives.logistics', { defaultValue: 'Delivery Logistics' }), icon: Truck });
    }
    return views;
  }, [
    t,
    canAccessExecutive,
    canAccessProduction,
    canAccessInventory,
    canAccessQC,
    canAccessSales,
    canAccessFinance,
    canAccessWorkforce,
    canAccessPurchasing,
    canAccessLogistics,
  ]);

  const [userSelectedView, setUserSelectedView] = useState<DashboardRoleView | null>(() => {
    try {
      const saved = localStorage.getItem('tenant_dashboard_role_perspective');
      return (saved as DashboardRoleView) || null;
    } catch {
      return null;
    }
  });

  const activeView: DashboardRoleView = useMemo(() => {
    if (userSelectedView && availableViews.some((v) => v.id === userSelectedView)) {
      return userSelectedView;
    }
    return initialView;
  }, [userSelectedView, availableViews, initialView]);

  const setActiveView = (view: DashboardRoleView) => {
    setUserSelectedView(view);
    try {
      localStorage.setItem('tenant_dashboard_role_perspective', view);
    } catch {
      // Ignore localStorage errors
    }
  };

  // ── State variables ──────────────────────────────────────────

  // Helper to check whether PWA prompt is allowed to show
  const isPwaEligible = (): boolean => {
    if (
      typeof window === 'undefined' ||
      typeof localStorage === 'undefined' ||
      typeof localStorage.getItem !== 'function'
    )
      return false;
    const isInstalled =
      localStorage.getItem('erp_pwa_installed') === 'true' ||
      localStorage.getItem('pwa_installed') === 'true' ||
      localStorage.getItem('slicemart_pwa_installed') === 'true';
    const isDismissed =
      localStorage.getItem('erp_pwa_dismissed') === 'true' ||
      localStorage.getItem('pwa_dismissed') === 'true' ||
      localStorage.getItem('slicemart_pwa_dismissed') === 'true';
    const isStandalone =
      (typeof window.matchMedia === 'function' && Boolean(window.matchMedia('(display-mode: standalone)')?.matches)) ||
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true;

    return !isInstalled && !isDismissed && !isStandalone;
  };

  // Only show if eligible AND native browser install prompt is operational
  const [showPwaPrompt, setShowPwaPrompt] = useState(() => {
    return isPwaEligible() && isPWAInstallable();
  });

  React.useEffect(() => {
    const handleInstallAvailable = () => {
      if (isPwaEligible()) {
        setShowPwaPrompt(true);
      }
    };

    const handleBeforeInstall = () => {
      if (isPwaEligible()) {
        setShowPwaPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      localStorage.setItem('erp_pwa_installed', 'true');
      localStorage.setItem('erp_pwa_dismissed', 'true');
      localStorage.setItem('pwa_installed', 'true');
      localStorage.setItem('pwa_dismissed', 'true');
      setShowPwaPrompt(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    try {
      const accepted = await promptPWAInstall();
      if (accepted) {
        toast.success(`${companyName || 'Enterprise Cloud'} Installed`, {
          description: 'Application successfully added to your home screen.',
        });
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    } finally {
      localStorage.setItem('erp_pwa_installed', 'true');
      localStorage.setItem('erp_pwa_dismissed', 'true');
      localStorage.setItem('pwa_installed', 'true');
      localStorage.setItem('pwa_dismissed', 'true');
      setShowPwaPrompt(false);
    }
  };

  const handleDismissPwa = () => {
    localStorage.setItem('erp_pwa_dismissed', 'true');
    localStorage.setItem('pwa_dismissed', 'true');
    setShowPwaPrompt(false);
  };

  // Modals state
  const [orderPoItem, setOrderPoItem] = useState<OrderPOItem | null>(null);
  const [reviewStockItem, setReviewStockItem] = useState<OrderPOItem | null>(null);
  const [selectedQCItem, setSelectedQCItem] = useState<QcItem | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    id: string;
    customer: string;
    type: 'B2B' | 'B2C';
    amount: string;
    status: string;
    payment: string;
  } | null>(null);
  const [selectedDueItem, setSelectedDueItem] = useState<DueCustomerItem | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<{
    initials: string;
    name: string;
    output: string;
    rate: number;
    badge: string;
    color: string;
  } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{
    id: string;
    product: string;
    target: number;
    produced: number;
    progress: number;
    status: string;
  } | null>(null);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customRangeLabel, setCustomRangeLabel] = useState<string | null>(null);





  const { data: rawLowStock = [] } = useQuery<
    Array<{
      id: string | number;
      name: string;
      sku: string;
      warehouse?: { name: string };
      current_stock?: number;
      min_stock_alert?: number;
      unit?: string;
    }>
  >({
    queryKey: ['inventory', 'low-stock-attention'],
    queryFn: async () => {
      try {
        const res = await api.get<
          | Array<{
              id: string | number;
              name: string;
              sku: string;
              warehouse?: { name: string };
              current_stock?: number;
              min_stock_alert?: number;
              unit?: string;
            }>
          | {
              data: Array<{
                id: string | number;
                name: string;
                sku: string;
                warehouse?: { name: string };
                current_stock?: number;
                min_stock_alert?: number;
                unit?: string;
              }>;
            }
        >('/inventory/stock?low_stock=true&per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
  });

  const attentionItems: OrderPOItem[] = useMemo(() => {
    if (rawLowStock.length > 0) {
      return rawLowStock.map((item) => ({
        id: String(item.id),
        name: item.name,
        sku: item.sku,
        warehouse: item.warehouse?.name || 'Main Facility',
        currentStock: item.current_stock ?? 0,
        minThreshold: item.min_stock_alert ?? 0,
        unit: item.unit || 'pcs',
        suggestedQty: Math.max((item.min_stock_alert ?? 0) - (item.current_stock ?? 0), 10),
      }));
    }
    if (metrics?.attention_items && metrics.attention_items.length > 0) {
      return metrics.attention_items;
    }
    return [];
  }, [rawLowStock, metrics?.attention_items]);

  // QC Items - dynamic from live operational metrics
  const qcList: Array<{
    id: string;
    orderNo: string;
    product: string;
    qty: number;
    status: string;
    failed?: number;
    rework?: number;
  }> = useMemo(() => {
    return metrics?.recent_qc || [];
  }, [metrics?.recent_qc]);

  // Workers - dynamic from live operational metrics
  const workers: Array<{
    initials: string;
    name: string;
    output: string;
    rate: number;
    badge: string;
    color: string;
  }> = useMemo(() => {
    return metrics?.active_workers || [];
  }, [metrics?.active_workers]);

  return (
    <div className="space-y-5 pb-16 max-w-[1600px] mx-auto transition-token-colors">
      <OnboardingStartupModal />
      <OnboardingProgressCard />
      {/* ─────────────────────────────────────────────────────────────
          0. DYNAMIC ROLE PERSPECTIVE SELECTOR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-default p-2.5 rounded-2xl shadow-2xs space-y-2.5">
        {/* Top Control Bar: Role Identifier & Telemetry Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 pl-1">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-default truncate">
                {user?.role ??
                  (user?.is_platform_admin ? t('controls.superAdmin') : t('controls.operationsMember'))}
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-surface-sunken text-muted border border-default">
                {t('controls.perspective')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getStorefrontExternalUrl(storeSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:text-primary hover:border-primary/40 hover:bg-surface-sunken transition-all shadow-2xs group cursor-pointer"
              title="Open public customer storefront in a new tab"
            >
              <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">{t('controls.viewWebsiteStorefront')}</span>
              <span className="sm:hidden">{t('controls.storefront')}</span>
              <ExternalLink className="size-3 text-muted group-hover:text-primary transition-colors" />
            </a>

            <button
              type="button"
              onClick={() => {
                const next = !isLiveTelemetry;
                setIsLiveTelemetry(next);
                toast.info(next ? (t('controls.liveSyncActive', 'Live telemetry active (auto-updating)')) : t('controls.liveSyncPaused', 'Live telemetry paused'));
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                isLiveTelemetry
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-default bg-surface-sunken text-muted hover:text-default'
              )}
              title="Toggle live telemetry auto-refresh"
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  isLiveTelemetry ? 'bg-emerald-500 animate-pulse' : 'bg-muted'
                )}
              />
              <span className="inline">
                {isLiveTelemetry ? t('controls.liveSync') : t('controls.syncPaused')}
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await Promise.all([
                  refetchMetrics(),
                  queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] }),
                  queryClient.invalidateQueries({ queryKey: ['sales'] }),
                  queryClient.invalidateQueries({ queryKey: ['inventory'] }),
                ]);
                toast.success(t('controls.metricsRefreshed', 'Dashboard metrics refreshed'));
              }}
              disabled={isRefreshingMetrics}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer disabled:opacity-50"
              title="Refresh dashboard metrics"
            >
              <RefreshCw
                className={cn('size-3.5', isRefreshingMetrics && 'animate-spin text-primary')}
              />
              <span className="inline">{t('controls.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Perspective Switcher Track */}
        {availableViews.length > 1 && (
          <div className="pt-1.5 border-t border-default/60">
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-default bg-surface-sunken p-1 scrollbar-none max-w-full touch-pan-x snap-x scroll-smooth">
              {availableViews.map((v) => {
                const Icon = v.icon;
                const isActive = activeView === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveView(v.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start shrink-0',
                      isActive
                        ? 'bg-surface text-default shadow-xs border border-default font-bold'
                        : 'text-muted hover:text-default hover:bg-surface/50'
                    )}
                  >
                    <Icon className={cn('size-3.5', isActive ? 'text-primary' : 'text-muted')} />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          0.1 UNIVERSAL QUICK-ACTION WORKFLOW LAUNCHER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mt-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted shrink-0 flex items-center gap-1.5 pl-1">
          <Compass className="size-3.5 text-primary" />
          <span>{t('controls.quickActions')}</span>
        </span>
        <a
          href={getStorefrontExternalUrl(storeSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs group"
          title="Open customer storefront in a new tab"
        >
          <Globe className="size-3 text-emerald-500 group-hover:scale-110 transition-transform" />
          <span>{t('controls.viewWebsite')}</span>
          <ExternalLink className="size-2.5 text-muted group-hover:text-default transition-colors" />
        </a>
        {hasPermission(['sales.order.view', 'sales.order.create']) && (
          <Link
            to="/sales?action=new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Plus className="size-3 text-primary" />
            <span>{t('actions.salesOrder')}</span>
          </Link>
        )}
        {hasPermission(['pos.terminal.view', 'pos.sale.create']) && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <ShoppingCart className="size-3 text-blue-500" />
            <span>{t('actions.posRegister')}</span>
          </Link>
        )}
        {hasPermission(['production.batch.view', 'production.plan.view']) && (
          <Link
            to="/production?action=new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Factory className="size-3 text-indigo-500" />
            <span>{t('actions.batchPlan')}</span>
          </Link>
        )}
        {hasPermission(['inventory.stock.view', 'inventory.movement.view']) && (
          <Link
            to="/inventory?action=transfer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Warehouse className="size-3 text-amber-500" />
            <span>{t('actions.transferStock')}</span>
          </Link>
        )}
        {hasPermission(['purchasing.order.view', 'purchasing.requisition.view']) && (
          <Link
            to="/purchasing?action=new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <FileText className="size-3 text-amber-600" />
            <span>{t('actions.purchasePo')}</span>
          </Link>
        )}
        {hasPermission(['qc.inspection.view']) && (
          <Link
            to="/qc"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Microscope className="size-3 text-cyan-500" />
            <span>{t('actions.qcAudit')}</span>
          </Link>
        )}
        {hasPermission(['finance.account.view']) && (
          <Link
            to="/finance?tab=due-collection"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <DollarSign className="size-3 text-emerald-500" />
            <span>{t('actions.dueCollection')}</span>
          </Link>
        )}
        {hasPermission(['hr.attendance.view']) && (
          <Link
            to="/hr?tab=attendance"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Clock className="size-3 text-teal-500" />
            <span>{t('actions.attendance')}</span>
          </Link>
        )}
        {hasPermission(['reports.report.view', 'reports.dashboard.view']) && (
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:border-primary/40 hover:bg-surface-sunken transition-all shrink-0 shadow-2xs"
          >
            <Sparkles className="size-3 text-purple-500" />
            <span>{t('actions.rmsBi')}</span>
          </Link>
        )}
      </div>

            {/* ─────────────────────────────────────────────────────────────
          DYNAMIC ROLE VIEWS
      ───────────────────────────────────────────────────────────── */}
      {activeView === 'executive' && (
        <ExecutiveDashboardView
          onOpenInvoice={setSelectedInvoice}
          trends={metrics?.trends?.weekly}
        />
      )}

      {activeView === 'sales' && (
        <SalesDashboardView
          onOpenInvoice={setSelectedInvoice}
        />
      )}

      {activeView === 'inventory' && (
        <InventoryDashboardView
          attentionItems={attentionItems}
          onOpenOrderPO={setOrderPoItem}
          onOpenReviewStock={setReviewStockItem}
        />
      )}

      {activeView === 'qc' && (
        <QcDashboardView
          qcList={qcList}
          onOpenQC={setSelectedQCItem}
        />
      )}

      {activeView === 'finance' && (
        <FinanceDashboardView
          onOpenDueItem={setSelectedDueItem}
          onOpenInvoice={setSelectedInvoice}
        />
      )}

      {activeView === 'workforce' && (
        <WorkforceDashboardView
          onOpenWorker={setSelectedWorker}
          workers={workers}
        />
      )}

      {activeView === 'purchasing' && <PurchasingDashboardView />}

      {activeView === 'logistics' && <LogisticsDashboardView />}

      {activeView === 'production' && (
        <ProductionDashboardView
          attentionItems={attentionItems}
          onOpenOrderPO={setOrderPoItem}
          onOpenReviewStock={setReviewStockItem}
          onOpenInvoice={setSelectedInvoice}
          onOpenQC={setSelectedQCItem}
          onOpenWorker={setSelectedWorker}
          onOpenOrder={setSelectedOrder}
          onOpenCustomDate={() => setIsCustomDateOpen(true)}
          customRangeLabel={customRangeLabel}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. ENTERPRISE SUBSYSTEM COCKPIT & NAVIGATOR
      ───────────────────────────────────────────────────────────── */}
      <EnterpriseSystemNavigator />

      {/* ─────────────────────────────────────────────────────────────
          7. FLOATING PWA INSTALL PROMPT (CONDITIONAL & THEMED)
      ───────────────────────────────────────────────────────────── */}
      {showPwaPrompt && (
        <aside
          aria-label="PWA Installation Prompt"
          className="fixed bottom-5 right-5 z-40 w-80 sm:w-88 rounded-2xl border border-default bg-surface-raised p-4 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-token-colors animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 overflow-hidden shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName || 'Enterprise Cloud'}
                    className="size-5 object-contain"
                  />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-default truncate">
                  {t('pwa.installTitle', { name: erpInstallName, defaultValue: `Install ${erpInstallName}` })}
                </h4>
                <span className="text-[10px] text-muted">{t('pwa.platformPwa', { defaultValue: 'Business Operations Platform PWA' })}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissPwa}
              className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              aria-label="Dismiss prompt"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            {t('pwa.description', { defaultValue: 'Install the operational dashboard on your desktop or mobile device for direct offline caching and faster business operations.' })}
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstallPwa}
              leftIcon={<Download className="size-3.5" />}
            >
              {t('pwa.installApp', { defaultValue: 'Install App' })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissPwa}
              className="text-muted hover:text-default"
            >
              {t('pwa.maybeLater', { defaultValue: 'Maybe Later' })}
            </Button>
          </div>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. INTERACTIVE DRILL-DOWN MODALS
      ───────────────────────────────────────────────────────────── */}
      <OrderPOModal
        isOpen={Boolean(orderPoItem)}
        onClose={() => setOrderPoItem(null)}
        item={orderPoItem}
      />

      <StockReviewModal
        isOpen={Boolean(reviewStockItem)}
        onClose={() => setReviewStockItem(null)}
        item={reviewStockItem}
      />

      <QCAuditModal
        isOpen={Boolean(selectedQCItem)}
        onClose={() => setSelectedQCItem(null)}
        qcItem={selectedQCItem}
        onInspectDone={() => {
          // Closed and processed
        }}
      />

      <InvoiceQuickViewModal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
      />

      <FinancialDueModal
        isOpen={Boolean(selectedDueItem)}
        onClose={() => setSelectedDueItem(null)}
        dueItem={selectedDueItem}
      />

      <WorkerDetailModal
        isOpen={Boolean(selectedWorker)}
        onClose={() => setSelectedWorker(null)}
        worker={selectedWorker}
      />

      <ProductionOrderDetailModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
      />

      <CustomDateRangeModal
        isOpen={isCustomDateOpen}
        onClose={() => setIsCustomDateOpen(false)}
        onApply={(start, end) => {
          setCustomRangeLabel(`${start.slice(5)} - ${end.slice(5)}`);
        }}
      />
    </div>
  );
};
