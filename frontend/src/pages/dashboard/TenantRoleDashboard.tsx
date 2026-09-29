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
import { DashboardKpiCard, type DashboardKpiTheme, type DashboardKpiDelta } from './components/DashboardKpiCard';
import { TodayAlertsStrip } from './components/TodayAlertsStrip';
import { EnterpriseSystemNavigator } from './components/EnterpriseSystemNavigator';
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

import type { DashboardMetricsData } from '../../types/api/dashboard';

// ── Elevated KPI Card (Command Bar) ────────────────────────────

interface ElevatedKpiCardProps {
  label: string;
  value: string;
  sub: string;
  delta?: DashboardKpiDelta | undefined;
  sparkline?: number[] | undefined;
  badge?: {
    text: string;
    variant?: 'positive' | 'warning' | 'negative' | 'neutral' | 'info' | undefined;
  } | undefined;
  icon: React.ReactNode;
  theme?: DashboardKpiTheme | undefined;
  iconBg?: string | undefined;
  to?: string | undefined;
}

const ElevatedKpiCard: React.FC<ElevatedKpiCardProps> = ({
  label,
  value,
  sub,
  delta,
  sparkline,
  badge,
  icon,
  theme = 'blue',
  to,
}) => {
  return (
    <DashboardKpiCard
      label={label}
      value={value}
      sub={sub}
      delta={delta}
      sparkline={sparkline}
      badge={badge}
      icon={icon}
      theme={theme}
      to={to}
    />
  );
};

// ── Palette Mappings ──────────────────────────────────────────

const QUICK_ACTION_THEMES: Record<
  string,
  {
    card: string;
    icon: string;
    text: string;
    topLine: string;
    shortcut: string;
  }
> = {
  emerald: {
    card: 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.12] border-emerald-500/25 hover:border-emerald-500/50 hover:shadow-[0_10px_24px_-4px_rgba(16,185,129,0.22)]',
    icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xs shadow-emerald-500/35 border-emerald-400/30',
    text: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    topLine: 'via-emerald-500',
    shortcut: 'group-hover:border-emerald-500/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
  },
  blue: {
    card: 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08] dark:bg-blue-500/[0.06] dark:hover:bg-blue-500/[0.12] border-blue-500/25 hover:border-blue-500/50 hover:shadow-[0_10px_24px_-4px_rgba(59,130,246,0.22)]',
    icon: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xs shadow-blue-500/35 border-blue-400/30',
    text: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    topLine: 'via-blue-500',
    shortcut: 'group-hover:border-blue-500/40 group-hover:text-blue-600 dark:group-hover:text-blue-400',
  },
  teal: {
    card: 'bg-teal-500/[0.04] hover:bg-teal-500/[0.08] dark:bg-teal-500/[0.06] dark:hover:bg-teal-500/[0.12] border-teal-500/25 hover:border-teal-500/50 hover:shadow-[0_10px_24px_-4px_rgba(20,184,166,0.22)]',
    icon: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-xs shadow-teal-500/35 border-teal-400/30',
    text: 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
    topLine: 'via-teal-500',
    shortcut: 'group-hover:border-teal-500/40 group-hover:text-teal-600 dark:group-hover:text-teal-400',
  },
  indigo: {
    card: 'bg-indigo-500/[0.04] hover:bg-indigo-500/[0.08] dark:bg-indigo-500/[0.06] dark:hover:bg-indigo-500/[0.12] border-indigo-500/25 hover:border-indigo-500/50 hover:shadow-[0_10px_24px_-4px_rgba(99,102,241,0.22)]',
    icon: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs shadow-indigo-500/35 border-indigo-400/30',
    text: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
    topLine: 'via-indigo-500',
    shortcut: 'group-hover:border-indigo-500/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
  },
  amber: {
    card: 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12] border-amber-500/25 hover:border-amber-500/50 hover:shadow-[0_10px_24px_-4px_rgba(245,158,11,0.22)]',
    icon: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs shadow-amber-500/35 border-amber-400/30',
    text: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    topLine: 'via-amber-500',
    shortcut: 'group-hover:border-amber-500/40 group-hover:text-amber-600 dark:group-hover:text-amber-400',
  },
  orange: {
    card: 'bg-orange-500/[0.04] hover:bg-orange-500/[0.08] dark:bg-orange-500/[0.06] dark:hover:bg-orange-500/[0.12] border-orange-500/25 hover:border-orange-500/50 hover:shadow-[0_10px_24px_-4px_rgba(249,115,22,0.22)]',
    icon: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xs shadow-orange-500/35 border-orange-400/30',
    text: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
    topLine: 'via-orange-500',
    shortcut: 'group-hover:border-orange-500/40 group-hover:text-orange-600 dark:group-hover:text-orange-400',
  },
  cyan: {
    card: 'bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] dark:bg-cyan-500/[0.06] dark:hover:bg-cyan-500/[0.12] border-cyan-500/25 hover:border-cyan-500/50 hover:shadow-[0_10px_24px_-4px_rgba(6,182,212,0.22)]',
    icon: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xs shadow-cyan-500/35 border-cyan-400/30',
    text: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    topLine: 'via-cyan-500',
    shortcut: 'group-hover:border-cyan-500/40 group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
  },
  lime: {
    card: 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.12] border-emerald-500/25 hover:border-emerald-500/50 hover:shadow-[0_10px_24px_-4px_rgba(16,185,129,0.22)]',
    icon: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-500/35 border-emerald-400/30',
    text: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    topLine: 'via-emerald-500',
    shortcut: 'group-hover:border-emerald-500/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
  },
  rose: {
    card: 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08] dark:bg-rose-500/[0.06] dark:hover:bg-rose-500/[0.12] border-rose-500/25 hover:border-rose-500/50 hover:shadow-[0_10px_24px_-4px_rgba(244,63,94,0.22)]',
    icon: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-xs shadow-rose-500/35 border-rose-400/30',
    text: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    topLine: 'via-rose-500',
    shortcut: 'group-hover:border-rose-500/40 group-hover:text-rose-600 dark:group-hover:text-rose-400',
  },
  purple: {
    card: 'bg-purple-500/[0.04] hover:bg-purple-500/[0.08] dark:bg-purple-500/[0.06] dark:hover:bg-purple-500/[0.12] border-purple-500/25 hover:border-purple-500/50 hover:shadow-[0_10px_24px_-4px_rgba(168,85,247,0.22)]',
    icon: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs shadow-purple-500/35 border-purple-400/30',
    text: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    topLine: 'via-purple-500',
    shortcut: 'group-hover:border-purple-500/40 group-hover:text-purple-600 dark:group-hover:text-purple-400',
  },
};

const DEFAULT_ACTION_THEME = QUICK_ACTION_THEMES.blue!;

const VIEW_ICON_COLORS: Record<string, string> = {
  overview: 'text-primary',
  production: 'text-indigo-500',
  inventory: 'text-violet-500',
  quality: 'text-cyan-500',
  sales: 'text-blue-500',
  finance: 'text-emerald-500',
  workforce: 'text-rose-500',
  purchasing: 'text-orange-500',
  logistics: 'text-teal-500',
};

const VIEW_ACTIVE_BG: Record<string, string> = {
  overview: 'bg-primary/10 text-primary border-primary/25',
  production: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  inventory: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
  quality: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
  sales: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  finance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  workforce: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  purchasing: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  logistics: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
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

  const metricsAttentionItems = metrics?.attention_items;
  const recentQc = metrics?.recent_qc;
  const activeWorkers = metrics?.active_workers;

  const attentionItems: OrderPOItem[] = useMemo(() => {
    if (rawLowStock.length > 0) {
      return rawLowStock
        .filter((item) => (item.min_stock_alert ?? 0) > 0 && (item.current_stock ?? 0) <= (item.min_stock_alert ?? 0))
        .map((item) => ({
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
    if (metricsAttentionItems && metricsAttentionItems.length > 0) {
      return metricsAttentionItems.filter(
        (item) => (item.minThreshold ?? 0) > 0 && (item.currentStock ?? 0) <= (item.minThreshold ?? 0)
      );
    }
    return [];
  }, [rawLowStock, metricsAttentionItems]);

  const qcList = useMemo(() => recentQc || [], [recentQc]);
  const workers = useMemo(() => activeWorkers || [], [activeWorkers]);

  // ── Quick actions ────────────────────────────────────────────
  const quickActions = useMemo(() => {
    const actions: Array<{
      label: string;
      to: string;
      icon: React.ReactNode;
      theme: string;
      color: string;
      shortcut?: string;
      category?: string;
    }> = [
      {
        label: 'Storefront',
        to: getStorefrontExternalUrl(storeSlug),
        icon: <Globe className="size-5" />,
        theme: 'emerald',
        color: 'text-emerald-500',
        shortcut: '⌘1',
        category: 'Online Shop',
      },
    ];
    if (hasPermission(['sales.order.view', 'sales.order.create'])) {
      actions.push({
        label: 'New Order',
        to: '/sales?action=new',
        icon: <Plus className="size-5" />,
        theme: 'blue',
        color: 'text-primary',
        shortcut: '⌘N',
        category: 'Sales',
      });
    }
    if (hasPermission(['pos.terminal.view', 'pos.sale.create'])) {
      actions.push({
        label: 'POS Register',
        to: '/pos',
        icon: <ShoppingCart className="size-5" />,
        theme: 'teal',
        color: 'text-teal-500',
        shortcut: '⌘P',
        category: 'Checkout',
      });
    }
    if (hasPermission(['production.batch.view', 'production.plan.view'])) {
      actions.push({
        label: 'New Batch',
        to: '/production?action=new',
        icon: <Factory className="size-5" />,
        theme: 'indigo',
        color: 'text-indigo-500',
        shortcut: '⌘B',
        category: 'Factory',
      });
    }
    if (hasPermission(['inventory.stock.view', 'inventory.movement.view'])) {
      actions.push({
        label: 'Transfer Stock',
        to: '/inventory?action=transfer',
        icon: <Warehouse className="size-5" />,
        theme: 'amber',
        color: 'text-amber-500',
        shortcut: '⌘T',
        category: 'Warehouse',
      });
    }
    if (hasPermission(['purchasing.order.view', 'purchasing.requisition.view'])) {
      actions.push({
        label: 'New PO',
        to: '/purchasing?action=new',
        icon: <FileText className="size-5" />,
        theme: 'orange',
        color: 'text-orange-500',
        shortcut: '⌘O',
        category: 'Sourcing',
      });
    }
    if (hasPermission(['qc.inspection.view'])) {
      actions.push({
        label: 'QC Audit',
        to: '/qc',
        icon: <Microscope className="size-5" />,
        theme: 'cyan',
        color: 'text-cyan-500',
        shortcut: '⌘Q',
        category: 'Quality',
      });
    }
    if (hasPermission(['finance.account.view'])) {
      actions.push({
        label: 'Due Collection',
        to: '/finance?tab=due-collection',
        icon: <DollarSign className="size-5" />,
        theme: 'lime',
        color: 'text-emerald-500',
        shortcut: '⌘D',
        category: 'Finance',
      });
    }
    if (hasPermission(['hr.attendance.view'])) {
      actions.push({
        label: 'Attendance',
        to: '/hr?tab=attendance',
        icon: <Clock className="size-5" />,
        theme: 'rose',
        color: 'text-rose-500',
        shortcut: '⌘A',
        category: 'Workforce',
      });
    }
    if (hasPermission(['reports.report.view', 'reports.dashboard.view'])) {
      actions.push({
        label: 'BI Reports',
        to: '/reports',
        icon: <Sparkles className="size-5" />,
        theme: 'purple',
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
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <ElevatedKpiCard
              label="Today Revenue"
              value={metrics ? formatCurrency(metrics.commercial.today_revenue) : '—'}
              sub={metrics ? `Month: ${formatCurrency(metrics.commercial.month_revenue)}` : 'Loading…'}
              delta={
                metrics?.commercial?.revenue_delta_percent !== undefined
                  ? { value: metrics.commercial.revenue_delta_percent, label: 'vs yesterday' }
                  : undefined
              }
              sparkline={metrics?.trends?.weekly?.map((d) => d.revenue) ?? []}
              badge={{ text: 'Live', variant: 'positive' }}
              icon={<DollarSign className="size-4" />}
              theme="emerald"
              to="/sales"
            />
            <ElevatedKpiCard
              label="Active Orders"
              value={metrics ? `${metrics.commercial.active_orders}` : '—'}
              sub="Fulfillment queue"
              delta={
                metrics?.commercial?.orders_delta_percent !== undefined
                  ? { value: metrics.commercial.orders_delta_percent, label: 'vs yesterday' }
                  : undefined
              }
              sparkline={metrics?.trends?.weekly?.map((d) => (d.revenue > 0 ? Math.max(1, Math.round(d.revenue / 2000)) : 0)) ?? []}
              badge={
                metrics && metrics.commercial.active_orders > 0
                  ? { text: `${metrics.commercial.active_orders} queued`, variant: 'info' }
                  : { text: 'Optimal', variant: 'neutral' }
              }
              icon={<ShoppingBag className="size-4" />}
              theme="blue"
              to="/sales"
            />
            <ElevatedKpiCard
              label="Receivables Due"
              value={metrics ? formatCurrency(metrics.commercial.total_receivable_due) : '—'}
              sub="Outstanding balance"
              delta={
                (metrics?.commercial?.overdue_invoices_count ?? 0) > 0
                  ? { value: metrics?.commercial?.overdue_invoices_count ?? 0, label: 'overdue', isPositiveGood: false }
                  : undefined
              }
              sparkline={metrics?.trends?.weekly?.map((d) => Math.round(d.revenue * 0.12)) ?? []}
              badge={
                metrics && metrics.commercial.total_receivable_due > 0
                  ? { text: 'Pending', variant: 'warning' }
                  : { text: 'Settled', variant: 'positive' }
              }
              icon={<Clock className="size-4" />}
              theme="amber"
              to="/finance"
            />
            <ElevatedKpiCard
              label="Production Rate"
              value={metrics ? `${metrics.production.achievement_rate}%` : '—'}
              sub={metrics ? `${metrics.production.today_output} pcs today` : 'Loading…'}
              delta={
                metrics?.production?.output_delta_percent !== undefined
                  ? { value: metrics.production.output_delta_percent, label: 'vs yesterday' }
                  : undefined
              }
              sparkline={metrics?.trends?.weekly?.map((d) => d.production ?? d.produced ?? 0) ?? []}
              badge={
                metrics
                  ? metrics.production.achievement_rate >= 80
                    ? { text: 'On Target', variant: 'positive' }
                    : { text: 'Below Target', variant: 'warning' }
                  : undefined
              }
              icon={<Factory className="size-4" />}
              theme="indigo"
              to="/production"
            />
            <ElevatedKpiCard
              label="QC Pass Rate"
              value={metrics ? `${metrics.quality.qc_pass_rate}%` : '—'}
              sub={metrics ? `${metrics.quality.pending_inspections} pending` : 'Loading…'}
              sparkline={metrics?.trends?.weekly?.map((d) => d.qcPassed ?? 0) ?? []}
              badge={
                metrics
                  ? metrics.quality.qc_pass_rate >= 90
                    ? { text: 'Passed', variant: 'positive' }
                    : { text: 'Review', variant: 'warning' }
                  : undefined
              }
              icon={<Microscope className="size-4" />}
              theme="cyan"
              to="/qc"
            />
            <ElevatedKpiCard
              label="Stock Valuation"
              value={metrics ? formatCurrency(metrics.inventory.total_valuation) : '—'}
              sub={
                metrics && metrics.inventory.low_stock_count > 0
                  ? `${metrics.inventory.low_stock_count} alerts`
                  : 'All levels healthy'
              }
              delta={
                (metrics?.inventory?.low_stock_count ?? 0) > 0
                  ? { value: metrics?.inventory?.low_stock_count ?? 0, label: 'alerts', isPositiveGood: false }
                  : undefined
              }
              sparkline={
                metrics?.trends?.weekly?.map((_, idx) =>
                  Math.round((metrics?.inventory?.total_valuation ?? 10000) * (0.96 + idx * 0.008))
                ) ?? []
              }
              badge={
                metrics && metrics.inventory.low_stock_count > 0
                  ? { text: 'Reorder', variant: 'warning' }
                  : { text: 'Healthy', variant: 'positive' }
              }
              icon={<Warehouse className="size-4" />}
              theme="violet"
              to="/inventory"
            />
          </div>

          {/* Today's Operational Alerts Strip */}
          <div className="mt-3">
            <TodayAlertsStrip alerts={metrics?.alerts} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ZONE 2 — PRECISION PERSPECTIVE SELECTOR
          Segmented control with underline-active style. Not tabs.
      ═══════════════════════════════════════════════════════════ */}
      {availableViews.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-surface border border-default rounded-2xl p-1.5 shadow-2xs">
          {availableViews.map((v, idx) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            const iconColor = VIEW_ICON_COLORS[v.id] || 'text-primary';
            const activeBg = VIEW_ACTIVE_BG[v.id] || 'bg-primary/10 text-primary border-primary/25';
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all rounded-xl whitespace-nowrap cursor-pointer shrink-0 border border-transparent',
                  isActive
                    ? cn('font-bold shadow-2xs', activeBg)
                    : 'text-muted hover:text-default hover:bg-surface-sunken/60'
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <Icon className={cn('size-3.5 shrink-0 transition-colors', isActive ? iconColor : 'text-muted')} />
                <span>{v.label}</span>
                {isActive && (
                  <span className={cn('size-1.5 rounded-full ml-0.5', iconColor.replace('text-', 'bg-'))} />
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
          <div className="w-full max-w-5xl rounded-3xl border border-default bg-surface/90 backdrop-blur-md p-6 shadow-sm flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-linear-to-r from-primary/15 via-indigo-500/15 to-purple-500/15 border border-primary/25 text-primary text-[11px] font-bold uppercase tracking-wider mb-2 shadow-2xs">
                <TrendingUp className="size-3.5 text-primary" />
                <span>Operations Command Palette</span>
              </div>
              <h3 className="text-lg font-extrabold text-default tracking-tight">Quick Actions & Shortcuts</h3>
              <p className="text-xs text-muted mt-0.5">Rapid operational workflows and shortcut launch tiles</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 w-full justify-center">
              {quickActions.map((action) => {
                const isExternal = action.to.startsWith('http');
                const thm = (action.theme && QUICK_ACTION_THEMES[action.theme]) ? QUICK_ACTION_THEMES[action.theme]! : DEFAULT_ACTION_THEME;
                const inner = (
                  <div
                    className={cn(
                      'group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-center h-full overflow-hidden hover:-translate-y-1',
                      thm.card
                    )}
                  >
                    {/* Glowing hairline top accent */}
                    <span
                      className={cn(
                        'absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity',
                        thm.topLine
                      )}
                    />

                    {action.shortcut && (
                      <span
                        className={cn(
                          'absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-surface/90 text-muted border border-default/70 shadow-2xs transition-colors',
                          thm.shortcut
                        )}
                      >
                        {action.shortcut}
                      </span>
                    )}
                    <div
                      className={cn(
                        'size-11 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-200 group-hover:scale-110',
                        thm.icon
                      )}
                    >
                      {action.icon}
                    </div>
                    <span className={cn('text-xs font-bold text-default transition-colors truncate w-full', thm.text)}>
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
          ENTERPRISE SUBSYSTEM COCKPIT (ALL MODULES & WINGS)
      ═══════════════════════════════════════════════════════════ */}
      <EnterpriseSystemNavigator />

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
