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
  RefreshCw,
  Truck,
  Globe,
  ExternalLink,
  TrendingUp,
  Activity,
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
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { SalesDashboardView } from './components/SalesDashboardView';
import { InventoryDashboardView } from './components/InventoryDashboardView';
import { QcDashboardView, type QcItem } from './components/QcDashboardView';
import { FinanceDashboardView } from './components/FinanceDashboardView';
import { WorkforceDashboardView } from './components/WorkforceDashboardView';
import { ProductionDashboardView } from './components/ProductionDashboardView';
import { PurchasingDashboardView } from './components/PurchasingDashboardView';
import { LogisticsDashboardView } from './components/LogisticsDashboardView';
import { useCurrency } from '../../lib/format/currency';

// ── Types ──────────────────────────────────────────────────────

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
    aging_breakdown?: {
      current?: number;
      overdue_60?: number;
      overdue_90?: number;
    };
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
    pending_counts?: number;
    pending_adjustments?: number;
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

// ── Elevated KPI Card (Command Bar) ────────────────────────────

interface ElevatedKpiCardProps {
  label: string;
  value: string;
  sub: string;
  badge?: {
    text: string;
    variant: 'positive' | 'warning' | 'negative' | 'neutral' | 'info';
  } | undefined;
  icon: React.ReactNode;
  iconBg: string;
  to?: string | undefined;
}

const ElevatedKpiCard: React.FC<ElevatedKpiCardProps> = ({
  label,
  value,
  sub,
  badge,
  icon,
  iconBg,
  to,
}) => {
  const content = (
    <div className="group relative flex flex-col justify-between rounded-xl border border-default bg-surface p-3.5 shadow-2xs hover:shadow-xs hover:border-primary/40 transition-all cursor-pointer overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted truncate">
          {label}
        </span>
        <div className={cn('flex size-7 items-center justify-center rounded-lg border shrink-0 transition-transform group-hover:scale-105', iconBg)}>
          {icon}
        </div>
      </div>

      <div className="my-0.5">
        <div className="text-xl font-extrabold font-mono text-default tracking-tight truncate">
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1 pt-1.5 border-t border-default/50 min-w-0">
        <span className="text-[10px] text-muted truncate">
          {sub}
        </span>
        {badge && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 border',
              badge.variant === 'positive' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
              badge.variant === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
              badge.variant === 'negative' && 'bg-red-500/10 text-red-500 border-red-500/20',
              badge.variant === 'info' && 'bg-blue-500/10 text-blue-500 border-blue-500/20',
              badge.variant === 'neutral' && 'bg-surface-sunken text-muted border-default'
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );

  return to ? <Link to={to} className="block min-w-0">{content}</Link> : content;
};

// ── Main Dashboard Component ───────────────────────────────────

export const TenantRoleDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { companyName, logoUrl } = useTenantBranding();
  const { formatCurrency } = useCurrency();
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
          if ('data' in raw && raw.data && typeof raw.data === 'object' && 'commercial' in raw.data) {
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

  // ── Permission Gates ─────────────────────────────────────────
  const canAccessExecutive = Boolean(
    user?.is_platform_admin ||
    hasPermission('*') ||
    (hasPermission('core.setting.view') && hasPermission('sales.order.view') && hasPermission('production.batch.view'))
  );
  const canAccessProduction = hasPermission(['production.batch.view', 'production.plan.view', 'production.worker_entry.view']);
  const canAccessInventory = hasPermission(['inventory.stock.view', 'inventory.warehouse.view', 'inventory.movement.view']);
  const canAccessQC = hasPermission(['qc.inspection.view', 'qc.parameter.view', 'qc.wastage.view']);
  const canAccessSales = hasPermission(['sales.order.view', 'pos.terminal.view', 'pos.sale.create', 'sales.invoice.view']);
  const canAccessFinance = hasPermission(['finance.account.view', 'finance.journal.view', 'finance.expense.view', 'sales.invoice.view']);
  const canAccessWorkforce = hasPermission(['hr.employee.view', 'hr.attendance.view', 'hr.payroll.view', 'production.worker_entry.view']);
  const canAccessPurchasing = hasPermission(['purchasing.order.view', 'purchasing.requisition.view', 'purchasing.grn.view']);
  const canAccessLogistics = hasPermission(['logistics.shipment.view', 'logistics.run_sheet.view', 'logistics.delivery_order.view']);

  const initialView: DashboardRoleView = useMemo(() => {
    const slug = roleName.toLowerCase();
    if (slug.includes('finance') || slug.includes('account')) return 'finance';
    if (slug.includes('hr') || slug.includes('workforce') || slug.includes('payroll')) return 'workforce';
    if (slug.includes('purchase') || slug.includes('procurement')) return 'purchasing';
    if (slug.includes('delivery') || slug.includes('logistics') || slug.includes('dispatch')) return 'logistics';
    if (slug.includes('sales') || slug.includes('commercial') || slug.includes('pos')) return 'sales';
    if (slug.includes('store') || slug.includes('warehouse') || slug.includes('inventory')) return 'inventory';
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
  }, [roleName, canAccessExecutive, canAccessProduction, canAccessQC, canAccessInventory, canAccessSales, canAccessFinance, canAccessWorkforce, canAccessPurchasing, canAccessLogistics]);

  const availableViews = useMemo(() => {
    const views: Array<{ id: DashboardRoleView; label: string; icon: React.ComponentType<{ className?: string }> }> = [];
    if (canAccessExecutive) views.push({ id: 'executive', label: 'Overview', icon: LayoutDashboard });
    if (canAccessProduction) views.push({ id: 'production', label: 'Production', icon: Factory });
    if (canAccessInventory) views.push({ id: 'inventory', label: 'Inventory', icon: Warehouse });
    if (canAccessQC) views.push({ id: 'qc', label: 'Quality', icon: Microscope });
    if (canAccessSales) views.push({ id: 'sales', label: 'Sales & POS', icon: ShoppingBag });
    if (canAccessFinance) views.push({ id: 'finance', label: 'Finance', icon: Coins });
    if (canAccessWorkforce) views.push({ id: 'workforce', label: 'Workforce', icon: Users });
    if (canAccessPurchasing) views.push({ id: 'purchasing', label: 'Purchasing', icon: ShoppingCart });
    if (canAccessLogistics) views.push({ id: 'logistics', label: 'Logistics', icon: Truck });
    return views;
  }, [canAccessExecutive, canAccessProduction, canAccessInventory, canAccessQC, canAccessSales, canAccessFinance, canAccessWorkforce, canAccessPurchasing, canAccessLogistics]);

  const [userSelectedView, setUserSelectedView] = useState<DashboardRoleView | null>(() => {
    try { return (localStorage.getItem('tenant_dashboard_role_perspective') as DashboardRoleView) || null; }
    catch { return null; }
  });

  const activeView: DashboardRoleView = useMemo(() => {
    if (userSelectedView && availableViews.some((v) => v.id === userSelectedView)) return userSelectedView;
    return initialView;
  }, [userSelectedView, availableViews, initialView]);

  const setActiveView = (view: DashboardRoleView) => {
    setUserSelectedView(view);
    try { localStorage.setItem('tenant_dashboard_role_perspective', view); } catch { /* ignore */ }
  };

  // ── PWA State ────────────────────────────────────────────────
  const isPwaEligible = (): boolean => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return false;
    const isInstalled = localStorage.getItem('erp_pwa_installed') === 'true' || localStorage.getItem('pwa_installed') === 'true';
    const isDismissed = localStorage.getItem('erp_pwa_dismissed') === 'true' || localStorage.getItem('pwa_dismissed') === 'true';
    const isStandalone = (typeof window.matchMedia === 'function' && Boolean(window.matchMedia('(display-mode: standalone)')?.matches)) || (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
    return !isInstalled && !isDismissed && !isStandalone;
  };

  const [showPwaPrompt, setShowPwaPrompt] = useState(() => isPwaEligible() && isPWAInstallable());

  React.useEffect(() => {
    const handleInstallAvailable = () => { if (isPwaEligible()) setShowPwaPrompt(true); };
    const handleAppInstalled = () => {
      localStorage.setItem('erp_pwa_installed', 'true');
      localStorage.setItem('pwa_installed', 'true');
      localStorage.setItem('erp_pwa_dismissed', 'true');
      localStorage.setItem('pwa_dismissed', 'true');
      setShowPwaPrompt(false);
    };
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    try {
      const accepted = await promptPWAInstall();
      if (accepted) toast.success(`${companyName || 'Enterprise Cloud'} Installed`, { description: 'Added to home screen.' });
    } catch (err) { console.warn('PWA install error:', err); }
    finally {
      ['erp_pwa_installed', 'pwa_installed', 'erp_pwa_dismissed', 'pwa_dismissed'].forEach(k => localStorage.setItem(k, 'true'));
      setShowPwaPrompt(false);
    }
  };

  const handleDismissPwa = () => {
    ['erp_pwa_dismissed', 'pwa_dismissed'].forEach(k => localStorage.setItem(k, 'true'));
    setShowPwaPrompt(false);
  };

  // ── Modal State ──────────────────────────────────────────────
  const [orderPoItem, setOrderPoItem] = useState<OrderPOItem | null>(null);
  const [reviewStockItem, setReviewStockItem] = useState<OrderPOItem | null>(null);
  const [selectedQCItem, setSelectedQCItem] = useState<QcItem | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<{ id: string; customer: string; type: 'B2B' | 'B2C'; amount: string; status: string; payment: string } | null>(null);
  const [selectedDueItem, setSelectedDueItem] = useState<DueCustomerItem | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<{ initials: string; name: string; output: string; rate: number; badge: string; color: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; product: string; target: number; produced: number; progress: number; status: string } | null>(null);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customRangeLabel, setCustomRangeLabel] = useState<string | null>(null);

  // ── Live data ────────────────────────────────────────────────
  const { data: rawLowStock = [] } = useQuery<Array<{ id: string | number; name: string; sku: string; warehouse?: { name: string }; current_stock?: number; min_stock_alert?: number; unit?: string }>>({
    queryKey: ['inventory', 'low-stock-attention'],
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: string | number; name: string; sku: string; warehouse?: { name: string }; current_stock?: number; min_stock_alert?: number; unit?: string }> | { data: Array<{ id: string | number; name: string; sku: string; warehouse?: { name: string }; current_stock?: number; min_stock_alert?: number; unit?: string }> }>('/inventory/stock?low_stock=true&per_page=5');
        const d = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
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
    if (metrics?.attention_items && metrics.attention_items.length > 0) return metrics.attention_items;
    return [];
  }, [rawLowStock, metrics?.attention_items]);

  const qcList = useMemo(() => metrics?.recent_qc || [], [metrics?.recent_qc]);
  const workers = useMemo(() => metrics?.active_workers || [], [metrics?.active_workers]);

  // ── Quick actions ────────────────────────────────────────────
  const quickActions = useMemo(() => {
    const actions: Array<{
      label: string;
      to: string;
      icon: React.ReactNode;
      color: string;
      shortcut?: string;
      category?: string;
    }> = [
      {
        label: 'Storefront',
        to: getStorefrontExternalUrl(storeSlug),
        icon: <Globe className="size-4.5" />,
        color: 'text-emerald-500',
        shortcut: '⌘1',
        category: 'Online Shop',
      },
    ];
    if (hasPermission(['sales.order.view', 'sales.order.create'])) {
      actions.push({
        label: 'New Order',
        to: '/sales?action=new',
        icon: <Plus className="size-4.5" />,
        color: 'text-primary',
        shortcut: '⌘N',
        category: 'Sales',
      });
    }
    if (hasPermission(['pos.terminal.view', 'pos.sale.create'])) {
      actions.push({
        label: 'POS Register',
        to: '/pos',
        icon: <ShoppingCart className="size-4.5" />,
        color: 'text-blue-500',
        shortcut: '⌘P',
        category: 'Checkout',
      });
    }
    if (hasPermission(['production.batch.view', 'production.plan.view'])) {
      actions.push({
        label: 'New Batch',
        to: '/production?action=new',
        icon: <Factory className="size-4.5" />,
        color: 'text-indigo-500',
        shortcut: '⌘B',
        category: 'Factory',
      });
    }
    if (hasPermission(['inventory.stock.view', 'inventory.movement.view'])) {
      actions.push({
        label: 'Transfer Stock',
        to: '/inventory?action=transfer',
        icon: <Warehouse className="size-4.5" />,
        color: 'text-amber-500',
        shortcut: '⌘T',
        category: 'Warehouse',
      });
    }
    if (hasPermission(['purchasing.order.view', 'purchasing.requisition.view'])) {
      actions.push({
        label: 'New PO',
        to: '/purchasing?action=new',
        icon: <FileText className="size-4.5" />,
        color: 'text-orange-500',
        shortcut: '⌘O',
        category: 'Sourcing',
      });
    }
    if (hasPermission(['qc.inspection.view'])) {
      actions.push({
        label: 'QC Audit',
        to: '/qc',
        icon: <Microscope className="size-4.5" />,
        color: 'text-cyan-500',
        shortcut: '⌘Q',
        category: 'Quality',
      });
    }
    if (hasPermission(['finance.account.view'])) {
      actions.push({
        label: 'Due Collection',
        to: '/finance?tab=due-collection',
        icon: <DollarSign className="size-4.5" />,
        color: 'text-emerald-500',
        shortcut: '⌘D',
        category: 'Finance',
      });
    }
    if (hasPermission(['hr.attendance.view'])) {
      actions.push({
        label: 'Attendance',
        to: '/hr?tab=attendance',
        icon: <Clock className="size-4.5" />,
        color: 'text-teal-500',
        shortcut: '⌘A',
        category: 'Workforce',
      });
    }
    if (hasPermission(['reports.report.view', 'reports.dashboard.view'])) {
      actions.push({
        label: 'BI Reports',
        to: '/reports',
        icon: <Sparkles className="size-4.5" />,
        color: 'text-purple-500',
        shortcut: '⌘R',
        category: 'Analytics',
      });
    }
    return actions;
  }, [hasPermission, storeSlug]);

  return (
    <div className="space-y-4 pb-16 max-w-[1600px] mx-auto">
      <OnboardingStartupModal />

      {/* ══════════════════════════════════════════════════════════
          ZONE 1 — OBSIDIAN COMMAND BAR
          Full-width mission control strip. Inline KPIs, no card chrome.
      ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-default bg-surface shadow-sm overflow-hidden">
        {/* Top row: identity + controls */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-default">
          {/* Left: role identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Activity className="size-3.5 text-primary" />
              </div>
              {isLiveTelemetry && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-1 ring-surface animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-default truncate">
                  {user?.role ?? (user?.is_platform_admin ? t('controls.superAdmin') : t('controls.operationsMember'))}
                </span>
                <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-surface-sunken text-muted border border-default leading-none">
                  {t('controls.perspective')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: telemetry controls & primary actions */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {hasPermission(['reports.report.view', 'reports.dashboard.view']) && (
              <Link
                to="/reports"
                className="flex items-center gap-1.5 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-default hover:border-default transition-all shadow-2xs group"
                title="Business Intelligence & Analytics"
              >
                <FileText className="size-3 text-muted group-hover:text-primary transition-colors" />
                <span className="hidden md:inline">BI & Reports</span>
              </Link>
            )}

            {hasPermission(['pos.terminal.view', 'pos.sale.create']) && (
              <Link
                to="/pos"
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 transition-all group"
                title="Launch Point of Sale Terminal"
              >
                <ShoppingCart className="size-3 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">POS Terminal</span>
              </Link>
            )}

            <a
              href={getStorefrontExternalUrl(storeSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-muted hover:text-default hover:border-default transition-all group"
              title="Open storefront"
            >
              <Globe className="size-3 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Storefront</span>
              <ExternalLink className="size-2.5 text-muted/60" />
            </a>

            <button
              type="button"
              onClick={() => {
                const next = !isLiveTelemetry;
                setIsLiveTelemetry(next);
                toast.info(next ? 'Live telemetry active' : 'Telemetry paused');
              }}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                isLiveTelemetry
                  ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400'
                  : 'border-default bg-surface-sunken text-muted hover:text-default'
              )}
            >
              <span className={cn('size-1.5 rounded-full', isLiveTelemetry ? 'bg-emerald-500 animate-pulse' : 'bg-muted')} />
              <span>{isLiveTelemetry ? 'Live' : 'Paused'}</span>
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
                toast.success('Dashboard refreshed');
              }}
              disabled={isRefreshingMetrics}
              className="flex items-center gap-1 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-muted hover:text-default transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn('size-3', isRefreshingMetrics && 'animate-spin text-primary')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Elevated KPI Cards Grid */}
        <div className="p-3 bg-surface-sunken/30 border-t border-default">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <ElevatedKpiCard
              label="Today Revenue"
              value={metrics ? formatCurrency(metrics.commercial.today_revenue) : '—'}
              sub={metrics ? `Month: ${formatCurrency(metrics.commercial.month_revenue)}` : 'Loading…'}
              badge={{ text: 'Live', variant: 'positive' }}
              icon={<DollarSign className="size-3.5" />}
              iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              to="/sales"
            />
            <ElevatedKpiCard
              label="Active Orders"
              value={metrics ? `${metrics.commercial.active_orders}` : '—'}
              sub="Fulfillment queue"
              badge={metrics && metrics.commercial.active_orders > 0 ? { text: `${metrics.commercial.active_orders} queued`, variant: 'info' } : { text: 'Optimal', variant: 'neutral' }}
              icon={<ShoppingBag className="size-3.5" />}
              iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              to="/sales"
            />
            <ElevatedKpiCard
              label="Receivables Due"
              value={metrics ? formatCurrency(metrics.commercial.total_receivable_due) : '—'}
              sub="Outstanding balance"
              badge={metrics && metrics.commercial.total_receivable_due > 0 ? { text: 'Pending', variant: 'warning' } : { text: 'Settled', variant: 'positive' }}
              icon={<Clock className="size-3.5" />}
              iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              to="/finance"
            />
            <ElevatedKpiCard
              label="Production Rate"
              value={metrics ? `${metrics.production.achievement_rate}%` : '—'}
              sub={metrics ? `${metrics.production.today_output} pcs today` : 'Loading…'}
              badge={metrics ? (metrics.production.achievement_rate >= 80 ? { text: 'On Target', variant: 'positive' } : { text: 'Below Target', variant: 'warning' }) : undefined}
              icon={<Factory className="size-3.5" />}
              iconBg="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
              to="/production"
            />
            <ElevatedKpiCard
              label="QC Pass Rate"
              value={metrics ? `${metrics.quality.qc_pass_rate}%` : '—'}
              sub={metrics ? `${metrics.quality.pending_inspections} pending` : 'Loading…'}
              badge={metrics ? (metrics.quality.qc_pass_rate >= 90 ? { text: 'Passed', variant: 'positive' } : { text: 'Review', variant: 'warning' }) : undefined}
              icon={<Microscope className="size-3.5" />}
              iconBg="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
              to="/qc"
            />
            <ElevatedKpiCard
              label="Stock Valuation"
              value={metrics ? formatCurrency(metrics.inventory.total_valuation) : '—'}
              sub={metrics && metrics.inventory.low_stock_count > 0 ? `${metrics.inventory.low_stock_count} alerts` : 'All levels healthy'}
              badge={metrics && metrics.inventory.low_stock_count > 0 ? { text: 'Reorder', variant: 'warning' } : { text: 'Healthy', variant: 'positive' }}
              icon={<Warehouse className="size-3.5" />}
              iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
              to="/inventory"
            />
          </div>
          {attentionItems.length > 0 && (
            <div className="mt-2.5 flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="flex size-2 rounded-full bg-amber-500 animate-ping" />
                <span>Attention: {attentionItems.length} items have low stock warnings</span>
              </div>
              <Link to="/inventory?low_stock=true" className="text-[11px] font-bold underline hover:text-amber-900 dark:hover:text-amber-100">
                Review Inventory
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE 2 — PRECISION PERSPECTIVE SELECTOR
          Segmented control with underline-active style. Not tabs.
      ═══════════════════════════════════════════════════════════ */}
      {availableViews.length > 1 && (
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none bg-surface border border-default rounded-2xl px-2 py-1.5">
          {availableViews.map((v, idx) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all rounded-xl whitespace-nowrap cursor-pointer shrink-0',
                  isActive
                    ? 'text-default bg-surface-sunken'
                    : 'text-muted hover:text-default hover:bg-surface-sunken/50'
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted')} />
                <span>{v.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ZONE 3 — ROLE VIEW CONTENT
      ═══════════════════════════════════════════════════════════ */}
      <div className="animate-in fade-in duration-200">
        {activeView === 'executive' && (
          <ExecutiveDashboardView
            onOpenInvoice={setSelectedInvoice}
            onOpenCustomDate={() => setIsCustomDateOpen(true)}
            customRangeLabel={customRangeLabel}
            trends={metrics?.trends?.weekly}
          />
        )}
        {activeView === 'sales' && <SalesDashboardView onOpenInvoice={setSelectedInvoice} />}
        {activeView === 'inventory' && (
          <InventoryDashboardView
            attentionItems={attentionItems}
            onOpenOrderPO={setOrderPoItem}
            onOpenReviewStock={setReviewStockItem}
          />
        )}
        {activeView === 'qc' && <QcDashboardView qcList={qcList} onOpenQC={setSelectedQCItem} />}
        {activeView === 'finance' && (
          <FinanceDashboardView onOpenDueItem={setSelectedDueItem} onOpenInvoice={setSelectedInvoice} />
        )}
        {activeView === 'workforce' && <WorkforceDashboardView onOpenWorker={setSelectedWorker} workers={workers} />}
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
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE 4 — QUICK ACTIONS GRID (CENTERED & MIDDLE ALIGNED)
      ═══════════════════════════════════════════════════════════ */}
      {quickActions.length > 0 && (
        <div className="w-full flex flex-col items-center justify-center my-6">
          <div className="w-full max-w-5xl rounded-2xl border border-default bg-surface p-6 shadow-sm flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider mb-2">
                <TrendingUp className="size-3.5" />
                <span>Operations Command Palette</span>
              </div>
              <h3 className="text-base font-bold text-default">Quick Actions & Shortcuts</h3>
              <p className="text-xs text-muted mt-0.5">Rapid operational workflows and shortcut launch tiles</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full justify-center">
              {quickActions.map((action) => {
                const isExternal = action.to.startsWith('http');
                const inner = (
                  <div className="group relative flex flex-col items-center justify-center p-4 rounded-xl border border-default bg-surface-sunken hover:bg-surface hover:border-primary/40 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer text-center h-full">
                    {action.shortcut && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface text-muted border border-default/70 group-hover:border-primary/40 group-hover:text-primary transition-colors">
                        {action.shortcut}
                      </span>
                    )}
                    <div className={cn('size-10 rounded-xl flex items-center justify-center mb-2.5 bg-surface border border-default group-hover:border-primary/30 group-hover:scale-110 transition-all shadow-2xs', action.color)}>
                      {action.icon}
                    </div>
                    <span className="text-xs font-bold text-default group-hover:text-primary transition-colors truncate w-full">
                      {action.label}
                    </span>
                    {action.category && (
                      <span className="text-[10px] text-muted font-medium mt-0.5">
                        {action.category}
                      </span>
                    )}
                  </div>
                );
                return isExternal ? (
                  <a key={action.label} href={action.to} target="_blank" rel="noopener noreferrer" className="block">
                    {inner}
                  </a>
                ) : (
                  <Link key={action.label} to={action.to} className="block">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PWA INSTALL PROMPT
      ═══════════════════════════════════════════════════════════ */}
      {showPwaPrompt && (
        <aside
          aria-label="PWA Installation Prompt"
          className="fixed bottom-5 right-5 z-40 w-80 rounded-2xl border border-default bg-surface-raised p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 overflow-hidden shrink-0">
                {logoUrl ? <img src={logoUrl} alt={companyName || 'ERP'} className="size-5 object-contain" /> : <Sparkles className="size-4" />}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-default truncate">Install {erpInstallName}</h4>
                <span className="text-[10px] text-muted">Business Operations PWA</span>
              </div>
            </div>
            <button type="button" onClick={handleDismissPwa} className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Install on your device for faster access and offline caching.
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleInstallPwa} leftIcon={<Download className="size-3.5" />}>
              Install App
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismissPwa} className="text-muted hover:text-default">
              Later
            </Button>
          </div>
        </aside>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════ */}
      <OrderPOModal isOpen={Boolean(orderPoItem)} onClose={() => setOrderPoItem(null)} item={orderPoItem} />
      <StockReviewModal isOpen={Boolean(reviewStockItem)} onClose={() => setReviewStockItem(null)} item={reviewStockItem} />
      <QCAuditModal isOpen={Boolean(selectedQCItem)} onClose={() => setSelectedQCItem(null)} qcItem={selectedQCItem} onInspectDone={() => {}} />
      <InvoiceQuickViewModal isOpen={Boolean(selectedInvoice)} onClose={() => setSelectedInvoice(null)} invoice={selectedInvoice} />
      <FinancialDueModal isOpen={Boolean(selectedDueItem)} onClose={() => setSelectedDueItem(null)} dueItem={selectedDueItem} />
      <WorkerDetailModal isOpen={Boolean(selectedWorker)} onClose={() => setSelectedWorker(null)} worker={selectedWorker} />
      <ProductionOrderDetailModal isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} order={selectedOrder} />
      <CustomDateRangeModal
        isOpen={isCustomDateOpen}
        onClose={() => setIsCustomDateOpen(false)}
        onApply={(start, end) => setCustomRangeLabel(`${start.slice(5)} - ${end.slice(5)}`)}
      />
    </div>
  );
};
