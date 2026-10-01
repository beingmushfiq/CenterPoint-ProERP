import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  RefreshCw,
  CheckCircle2,
  Layers,
  ShieldAlert,
  ArchiveRestore,
  ShoppingBag,
  Truck,
  Package,
  Factory,
  Users,
  Landmark,
  ShieldCheck,
  X,
  ShoppingCart,
  FileText,
  ClipboardList,
  PackageCheck,
  Receipt,
  FolderTree,
  Bookmark,
  Warehouse,
  Ruler,
  ArrowLeftRight,
  Sliders,
  CheckSquare,
  Percent,
  Tag,
  DollarSign,
  CalendarRange,
  UserCheck,
  AlertTriangle,
  Building2,
  Briefcase,
  Clock,
  Calendar,
  Wallet,
  Coins,
  Cpu,
  Wrench,
  User,
  Globe,
  Printer,
  Target,
  TrendingUp,
  Monitor,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export interface DataBinItem {
  id: number | string;
  uuid?: string | null;
  type: string;
  type_label: string;
  domain?: string;
  identifier: string;
  details: {
    code?: string | null;
    amount?: number | null;
    status?: string | null;
    date?: string | null;
    quantity?: number | null;
    department?: string | null;
    category?: string | null;
    reason?: string | null;
    [key: string]: unknown;
  };
  deleted_at: string;
  created_at?: string;
}

export interface BinTypeStat {
  key: string;
  label: string;
  domain?: string;
  count: number;
}

export type DomainKey =
  | 'all'
  | 'commercial'
  | 'supply'
  | 'inventory'
  | 'manufacturing'
  | 'workforce'
  | 'finance'
  | 'system';

const DOMAIN_CONFIG: Record<
  DomainKey,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  all: { label: 'All Domains', icon: Layers, color: 'text-indigo-600 dark:text-indigo-400' },
  commercial: { label: 'Commercial & Sales', icon: ShoppingBag, color: 'text-emerald-600 dark:text-emerald-400' },
  supply: { label: 'Procurement & Supply', icon: Truck, color: 'text-purple-600 dark:text-purple-400' },
  inventory: { label: 'Inventory & Catalogue', icon: Package, color: 'text-blue-600 dark:text-blue-400' },
  manufacturing: { label: 'Factory & QC', icon: Factory, color: 'text-amber-600 dark:text-amber-400' },
  workforce: { label: 'Workforce & HR', icon: Users, color: 'text-teal-600 dark:text-teal-400' },
  finance: { label: 'Finance & Assets', icon: Landmark, color: 'text-rose-600 dark:text-rose-400' },
  system: { label: 'System & CMS', icon: ShieldCheck, color: 'text-slate-600 dark:text-slate-400' },
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Commercial & Sales
  sales_orders: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700/60' },
  invoices: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700/60' },
  sales_returns: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700/60' },
  exchanges: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700/60' },
  delivery_orders: { bg: 'bg-green-500/10 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700/60' },
  crm_leads: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700/60' },
  salesman_targets: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700/60' },
  coupons: { bg: 'bg-pink-500/10 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700/60' },
  pos_terminals: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700/60' },

  // Procurement & Supply Chain
  purchase_orders: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700/60' },
  purchase_requisitions: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700/60' },
  goods_receipts: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700/60' },
  purchase_bills: { bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-300 dark:border-fuchsia-700/60' },
  purchase_returns: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700/60' },
  courier_providers: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-700/60' },

  // Inventory & Master Catalogue
  products: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700/60' },
  categories: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-700/60' },
  brands: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700/60' },
  parties: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700/60' },
  warehouses: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700/60' },
  units: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700/60' },
  stock_transfers: { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700/60' },
  stock_adjustments: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700/60' },
  stock_counts: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700/60' },
  tax_profiles: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700/60' },
  discount_rules: { bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700/60' },
  price_lists: { bg: 'bg-lime-500/10 dark:bg-lime-500/20', text: 'text-lime-700 dark:text-lime-300', border: 'border-lime-300 dark:border-lime-700/60' },

  // Factory & Quality Control
  production_plans: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700/60' },
  production_batches: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700/60' },
  worker_production_entries: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700/60' },
  qc_inspections: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700/60' },
  qc_parameters: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700/60' },
  qc_defects: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700/60' },
  wastage_records: { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700/60' },
  rework_orders: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700/60' },

  // Fixed Assets & Plant Maintenance
  assets: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700/60' },
  maintenance_orders: { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700/60' },

  // Workforce & HR
  employees: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-700/60' },
  departments: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-700/60' },
  designations: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-700/60' },
  shifts: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700/60' },
  leave_requests: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700/60' },
  payslips: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700/60' },
  payroll_advances: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700/60' },

  // Finance & Accounts
  expenses: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700/60' },
  bank_accounts: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700/60' },
  chart_of_accounts: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700/60' },

  // System, CMS & Master Settings
  users: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700/60' },
  roles: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700/60' },
  storefront_pages: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700/60' },
  print_profiles: { bg: 'bg-zinc-500/10 dark:bg-zinc-500/20', text: 'text-zinc-700 dark:text-zinc-300', border: 'border-zinc-300 dark:border-zinc-700/60' },
  paper_sizes: { bg: 'bg-stone-500/10 dark:bg-stone-500/20', text: 'text-stone-700 dark:text-stone-300', border: 'border-stone-300 dark:border-stone-700/60' },
};

const getTypeIcon = (key: string): React.ElementType => {
  const iconMap: Record<string, React.ElementType> = {
    sales_orders: ShoppingBag,
    invoices: FileText,
    sales_returns: RotateCcw,
    exchanges: ArrowLeftRight,
    delivery_orders: Truck,
    crm_leads: Target,
    salesman_targets: TrendingUp,
    coupons: Tag,
    pos_terminals: Monitor,
    purchase_orders: ShoppingCart,
    purchase_requisitions: ClipboardList,
    goods_receipts: PackageCheck,
    purchase_bills: Receipt,
    purchase_returns: RotateCcw,
    courier_providers: Truck,
    products: Package,
    categories: FolderTree,
    brands: Bookmark,
    parties: Users,
    warehouses: Warehouse,
    units: Ruler,
    stock_transfers: ArrowLeftRight,
    stock_adjustments: Sliders,
    stock_counts: CheckSquare,
    tax_profiles: Percent,
    discount_rules: Tag,
    price_lists: DollarSign,
    production_batches: Factory,
    production_plans: CalendarRange,
    worker_production_entries: UserCheck,
    qc_inspections: CheckSquare,
    qc_parameters: Sliders,
    qc_defects: AlertTriangle,
    wastage_records: Trash2,
    rework_orders: RotateCcw,
    employees: Users,
    departments: Building2,
    designations: Briefcase,
    shifts: Clock,
    leave_requests: Calendar,
    payslips: FileText,
    payroll_advances: Wallet,
    expenses: Receipt,
    bank_accounts: Landmark,
    chart_of_accounts: Coins,
    assets: Cpu,
    maintenance_orders: Wrench,
    users: User,
    roles: ShieldCheck,
    storefront_pages: Globe,
    print_profiles: Printer,
    paper_sizes: FileText,
  };
  return iconMap[key] || Package;
};

export interface StatsPayload {
  total?: number;
  counts?: Record<string, number>;
  domains?: Record<string, number>;
  types?: BinTypeStat[];
}

export const DataBinWorkspace: React.FC = () => {
  const [items, setItems] = useState<DataBinItem[]>([]);
  const [types, setTypes] = useState<BinTypeStat[]>([]);
  const [backendDomains, setBackendDomains] = useState<Record<string, number>>({});
  const [totalTrashed, setTotalTrashed] = useState<number>(0);
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Multi-selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkRestoring, setIsBulkRestoring] = useState<boolean>(false);
  const [isBulkPurging, setIsBulkPurging] = useState<boolean>(false);
  const [bulkRestoreConfirmOpen, setBulkRestoreConfirmOpen] = useState<boolean>(false);
  const [bulkPurgeConfirmOpen, setBulkPurgeConfirmOpen] = useState<boolean>(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [restoreConfirmItem, setRestoreConfirmItem] = useState<DataBinItem | null>(null);
  const [purgeConfirmItem, setPurgeConfirmItem] = useState<DataBinItem | null>(null);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState<boolean>(false);

  // 30-Second Safe Purge Countdown State & Timers
  const [pendingPurge, setPendingPurge] = useState<{
    item: DataBinItem;
    remainingSeconds: number;
  } | null>(null);
  const pendingPurgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPurgeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pendingPurgeTimerRef.current) clearTimeout(pendingPurgeTimerRef.current);
      if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);
    };
  }, []);

  // Fetch stats & records (pure asynchronous fetch)
  const loadBinData = useCallback(async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        api.get<StatsPayload | { data: StatsPayload }>('/bin/stats'),
        api.get<DataBinItem[]>('/bin', {
          params: {
            domain: selectedDomain !== 'all' ? selectedDomain : undefined,
            type: selectedType !== 'all' ? selectedType : undefined,
            search: searchQuery.trim() || undefined,
            per_page: 50,
          },
        }),
      ]);

      const rawStats = statsRes?.data;
      const statsPayload: StatsPayload | null =
        rawStats && typeof rawStats === 'object' && 'data' in rawStats && rawStats.data && typeof rawStats.data === 'object'
          ? (rawStats.data as StatsPayload)
          : rawStats && typeof rawStats === 'object'
          ? (rawStats as StatsPayload)
          : null;

      if (statsPayload) {
        setTotalTrashed(statsPayload.total ?? 0);
        setTypes(statsPayload.types ?? []);
        if (statsPayload.domains) {
          setBackendDomains(statsPayload.domains);
        }
      }

      const list = extractList<DataBinItem>(listRes);
      setItems(list);
    } catch (err: unknown) {
      console.error('Failed to load Data Bin', err);
      notify.error('Failed to connect to Data Bin vault.');
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, selectedType, searchQuery]);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      api.get<StatsPayload | { data: StatsPayload }>('/bin/stats'),
      api.get<DataBinItem[]>('/bin', {
        params: {
          domain: selectedDomain !== 'all' ? selectedDomain : undefined,
          type: selectedType !== 'all' ? selectedType : undefined,
          search: searchQuery.trim() || undefined,
          per_page: 50,
        },
      }),
    ])
      .then(([statsRes, listRes]) => {
        if (ignore) return;
        const rawStats = statsRes?.data;
        const statsPayload: StatsPayload | null =
          rawStats && typeof rawStats === 'object' && 'data' in rawStats && rawStats.data && typeof rawStats.data === 'object'
            ? (rawStats.data as StatsPayload)
            : rawStats && typeof rawStats === 'object'
            ? (rawStats as StatsPayload)
            : null;

        if (statsPayload) {
          setTotalTrashed(statsPayload.total ?? 0);
          setTypes(statsPayload.types ?? []);
          if (statsPayload.domains) {
            setBackendDomains(statsPayload.domains);
          }
        }
        const list = extractList<DataBinItem>(listRes);
        setItems(list);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error('Failed to load Data Bin', err);
        notify.error('Failed to connect to Data Bin vault.');
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDomain, selectedType, searchQuery]);

  const handleSyncVault = () => {
    setLoading(true);
    void loadBinData();
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedKeys(new Set());
  };

  // Domain Counts computation
  const domainCounts = useMemo(() => {
    const counts: Record<DomainKey, number> = {
      all: totalTrashed,
      commercial: backendDomains['commercial'] ?? 0,
      supply: backendDomains['supply'] ?? 0,
      inventory: backendDomains['inventory'] ?? 0,
      manufacturing: backendDomains['manufacturing'] ?? 0,
      workforce: backendDomains['workforce'] ?? 0,
      finance: backendDomains['finance'] ?? 0,
      system: backendDomains['system'] ?? 0,
    };

    if (!backendDomains || Object.keys(backendDomains).length === 0) {
      types.forEach((t) => {
        const d = (t.domain as DomainKey) || 'system';
        if (counts[d] !== undefined) {
          counts[d] += t.count;
        }
      });
    }
    return counts;
  }, [backendDomains, types, totalTrashed]);

  // Type counts mapping for rapid tab badge lookups
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    types.forEach((t) => {
      map[t.key] = t.count;
    });
    return map;
  }, [types]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WorkspaceNavigationHub Configuration (Exact 2-tier design matching all modules)
  // ─────────────────────────────────────────────────────────────────────────────
  const categoriesConfig: WorkspaceCategoryConfig<DomainKey, string>[] = useMemo(
    () => [
      {
        id: 'all',
        label: 'All Items',
        tagline: 'Central quarantine vault — recover any deleted record across your entire enterprise',
        icon: ArchiveRestore,
        defaultTab: 'all__all',
        shortcut: '1',
        badge: `${totalTrashed}`,
        theme: WORKSPACE_THEMES.indigo,
        tabs: ['all__all', ...types.filter((t) => t.count > 0).map((t) => `all__${t.key}`)],
      },
      {
        id: 'commercial',
        label: 'Sales & Orders',
        tagline: 'Recover deleted customer sales orders, invoices, returns, exchanges, and POS tickets',
        icon: ShoppingBag,
        defaultTab: 'commercial__all',
        shortcut: '2',
        badge: `${domainCounts.commercial}`,
        theme: WORKSPACE_THEMES.emerald,
        tabs: [
          'commercial__all',
          'commercial__sales_orders',
          'commercial__invoices',
          'commercial__sales_returns',
          'commercial__exchanges',
          'commercial__delivery_orders',
          'commercial__crm_leads',
          'commercial__salesman_targets',
          'commercial__coupons',
          'commercial__pos_terminals',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'commercial' &&
                ![
                  'sales_orders',
                  'invoices',
                  'sales_returns',
                  'exchanges',
                  'delivery_orders',
                  'crm_leads',
                  'salesman_targets',
                  'coupons',
                  'pos_terminals',
                ].includes(t.key)
            )
            .map((t) => `commercial__${t.key}`),
        ],
      },
      {
        id: 'supply',
        label: 'Purchases & Vendors',
        tagline: 'Recover deleted supplier purchase orders, requisitions, receiving slips, and bills',
        icon: Truck,
        defaultTab: 'supply__all',
        shortcut: '3',
        badge: `${domainCounts.supply}`,
        theme: WORKSPACE_THEMES.purple,
        tabs: [
          'supply__all',
          'supply__purchase_orders',
          'supply__purchase_requisitions',
          'supply__goods_receipts',
          'supply__purchase_bills',
          'supply__purchase_returns',
          'supply__courier_providers',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'supply' &&
                ![
                  'purchase_orders',
                  'purchase_requisitions',
                  'goods_receipts',
                  'purchase_bills',
                  'purchase_returns',
                  'courier_providers',
                ].includes(t.key)
            )
            .map((t) => `supply__${t.key}`),
        ],
      },
      {
        id: 'inventory',
        label: 'Stock & Products',
        tagline: 'Recover deleted catalogue products, stock adjustments, categories, and warehouses',
        icon: Package,
        defaultTab: 'inventory__all',
        shortcut: '4',
        badge: `${domainCounts.inventory}`,
        theme: WORKSPACE_THEMES.cyan,
        tabs: [
          'inventory__all',
          'inventory__products',
          'inventory__categories',
          'inventory__brands',
          'inventory__parties',
          'inventory__warehouses',
          'inventory__units',
          'inventory__stock_transfers',
          'inventory__stock_adjustments',
          'inventory__stock_counts',
          'inventory__tax_profiles',
          'inventory__discount_rules',
          'inventory__price_lists',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'inventory' &&
                ![
                  'products',
                  'categories',
                  'brands',
                  'parties',
                  'warehouses',
                  'units',
                  'stock_transfers',
                  'stock_adjustments',
                  'stock_counts',
                  'tax_profiles',
                  'discount_rules',
                  'price_lists',
                ].includes(t.key)
            )
            .map((t) => `inventory__${t.key}`),
        ],
      },
      {
        id: 'manufacturing',
        label: 'Factory & Quality',
        tagline: 'Recover deleted production batches, worker time tickets, and quality inspections',
        icon: Factory,
        defaultTab: 'manufacturing__all',
        shortcut: '5',
        badge: `${domainCounts.manufacturing}`,
        theme: WORKSPACE_THEMES.amber,
        tabs: [
          'manufacturing__all',
          'manufacturing__production_batches',
          'manufacturing__production_plans',
          'manufacturing__worker_production_entries',
          'manufacturing__qc_inspections',
          'manufacturing__qc_parameters',
          'manufacturing__qc_defects',
          'manufacturing__wastage_records',
          'manufacturing__rework_orders',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'manufacturing' &&
                ![
                  'production_batches',
                  'production_plans',
                  'worker_production_entries',
                  'qc_inspections',
                  'qc_parameters',
                  'qc_defects',
                  'wastage_records',
                  'rework_orders',
                ].includes(t.key)
            )
            .map((t) => `manufacturing__${t.key}`),
        ],
      },
      {
        id: 'workforce',
        label: 'Staff & HR',
        tagline: 'Recover deleted employee profiles, leave requests, work shifts, and payroll slips',
        icon: Users,
        defaultTab: 'workforce__all',
        shortcut: '6',
        badge: `${domainCounts.workforce}`,
        theme: WORKSPACE_THEMES.teal,
        tabs: [
          'workforce__all',
          'workforce__employees',
          'workforce__departments',
          'workforce__designations',
          'workforce__shifts',
          'workforce__leave_requests',
          'workforce__payslips',
          'workforce__payroll_advances',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'workforce' &&
                ![
                  'employees',
                  'departments',
                  'designations',
                  'shifts',
                  'leave_requests',
                  'payslips',
                  'payroll_advances',
                ].includes(t.key)
            )
            .map((t) => `workforce__${t.key}`),
        ],
      },
      {
        id: 'finance',
        label: 'Finance & Assets',
        tagline: 'Recover deleted expense claims, bank registers, equipment assets, and ledger entries',
        icon: Landmark,
        defaultTab: 'finance__all',
        shortcut: '7',
        badge: `${domainCounts.finance}`,
        theme: WORKSPACE_THEMES.rose,
        tabs: [
          'finance__all',
          'finance__expenses',
          'finance__bank_accounts',
          'finance__chart_of_accounts',
          'finance__assets',
          'finance__maintenance_orders',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'finance' &&
                ![
                  'expenses',
                  'bank_accounts',
                  'chart_of_accounts',
                  'assets',
                  'maintenance_orders',
                ].includes(t.key)
            )
            .map((t) => `finance__${t.key}`),
        ],
      },
      {
        id: 'system',
        label: 'System & Web',
        tagline: 'Recover deleted login accounts, staff roles, website pages, and print profiles',
        icon: ShieldCheck,
        defaultTab: 'system__all',
        shortcut: '8',
        badge: `${domainCounts.system}`,
        theme: WORKSPACE_THEMES.indigo,
        tabs: [
          'system__all',
          'system__users',
          'system__roles',
          'system__storefront_pages',
          'system__print_profiles',
          'system__paper_sizes',
          ...types
            .filter(
              (t) =>
                (t.domain || 'system') === 'system' &&
                ![
                  'users',
                  'roles',
                  'storefront_pages',
                  'print_profiles',
                  'paper_sizes',
                ].includes(t.key)
            )
            .map((t) => `system__${t.key}`),
        ],
      },
    ],
    [totalTrashed, domainCounts, types]
  );

  // WorkspaceNavigationHub Tabs Configuration
  const tabsConfig = useMemo<WorkspaceTabConfig<DomainKey, string>[]>(() => {
    const getCount = (key: string) => typeCounts[key] ?? 0;

    const allTabs: WorkspaceTabConfig<DomainKey, string>[] = [
      // ── Category: all ──
      {
        id: 'all__all',
        label: 'All Quarantined Records',
        shortLabel: 'All Records',
        category: 'all',
        icon: ArchiveRestore,
        count: totalTrashed,
        description: 'Complete view of all soft-deleted records across all operational departments',
      },
      ...types
        .filter((t) => t.count > 0)
        .map((t) => ({
          id: `all__${t.key}`,
          label: t.label,
          shortLabel: t.label,
          category: 'all' as DomainKey,
          icon: getTypeIcon(t.key),
          count: t.count,
          description: `Deleted ${t.label} records`,
        })),

      // ── Category: commercial ──
      {
        id: 'commercial__all',
        label: 'All Commercial & Sales',
        shortLabel: 'All Sales',
        category: 'commercial',
        icon: ShoppingBag,
        count: domainCounts.commercial,
        description: 'All deleted sales orders, invoices, returns, and customer interactions',
      },
      {
        id: 'commercial__sales_orders',
        label: 'Sales Orders',
        shortLabel: 'Orders',
        category: 'commercial',
        icon: ShoppingBag,
        count: getCount('sales_orders'),
        description: 'Customer sales orders and delivery commitments',
      },
      {
        id: 'commercial__invoices',
        label: 'Sales Invoices',
        shortLabel: 'Invoices',
        category: 'commercial',
        icon: FileText,
        count: getCount('invoices'),
        description: 'Customer billing invoices and receipts',
      },
      {
        id: 'commercial__sales_returns',
        label: 'Sales Returns',
        shortLabel: 'Returns',
        category: 'commercial',
        icon: RotateCcw,
        count: getCount('sales_returns'),
        description: 'Customer merchandise return authorizations',
      },
      {
        id: 'commercial__exchanges',
        label: 'Sales Exchanges',
        shortLabel: 'Exchanges',
        category: 'commercial',
        icon: ArrowLeftRight,
        count: getCount('exchanges'),
        description: 'Product exchange and replacement tickets',
      },
      {
        id: 'commercial__delivery_orders',
        label: 'Delivery Orders',
        shortLabel: 'Deliveries',
        category: 'commercial',
        icon: Truck,
        count: getCount('delivery_orders'),
        description: 'Courier dispatch manifests and delivery challans',
      },
      {
        id: 'commercial__crm_leads',
        label: 'CRM Leads',
        shortLabel: 'Leads',
        category: 'commercial',
        icon: Target,
        count: getCount('crm_leads'),
        description: 'Prospective leads and sales opportunities',
      },
      {
        id: 'commercial__salesman_targets',
        label: 'Sales Targets',
        shortLabel: 'Targets',
        category: 'commercial',
        icon: TrendingUp,
        count: getCount('salesman_targets'),
        description: 'Sales representative monthly quotas and performance benchmarks',
      },
      {
        id: 'commercial__coupons',
        label: 'Storefront Coupons',
        shortLabel: 'Coupons',
        category: 'commercial',
        icon: Tag,
        count: getCount('coupons'),
        description: 'Promotional discount voucher codes',
      },
      {
        id: 'commercial__pos_terminals',
        label: 'POS Terminals',
        shortLabel: 'POS Stations',
        category: 'commercial',
        icon: Monitor,
        count: getCount('pos_terminals'),
        description: 'Point of sale counter registers and cash drawers',
      },

      // ── Category: supply ──
      {
        id: 'supply__all',
        label: 'All Procurement & Supply',
        shortLabel: 'All Supply',
        category: 'supply',
        icon: Truck,
        count: domainCounts.supply,
        description: 'All supplier orders, purchase requisitions, and vendor documents',
      },
      {
        id: 'supply__purchase_orders',
        label: 'Purchase Orders',
        shortLabel: 'Purchase Orders',
        category: 'supply',
        icon: ShoppingCart,
        count: getCount('purchase_orders'),
        description: 'Approved vendor purchase orders',
      },
      {
        id: 'supply__purchase_requisitions',
        label: 'Purchase Requisitions',
        shortLabel: 'Requisitions',
        category: 'supply',
        icon: ClipboardList,
        count: getCount('purchase_requisitions'),
        description: 'Internal department material requests',
      },
      {
        id: 'supply__goods_receipts',
        label: 'Goods Receipts',
        shortLabel: 'Receipts (GRN)',
        category: 'supply',
        icon: PackageCheck,
        count: getCount('goods_receipts'),
        description: 'Warehouse gate receiving notes and inspection tickets',
      },
      {
        id: 'supply__purchase_bills',
        label: 'Vendor Bills',
        shortLabel: 'Bills',
        category: 'supply',
        icon: Receipt,
        count: getCount('purchase_bills'),
        description: 'Supplier invoices received for payment',
      },
      {
        id: 'supply__purchase_returns',
        label: 'Purchase Returns',
        shortLabel: 'Vendor Returns',
        category: 'supply',
        icon: RotateCcw,
        count: getCount('purchase_returns'),
        description: 'Rejections and vendor return debit notes',
      },
      {
        id: 'supply__courier_providers',
        label: 'Courier Providers',
        shortLabel: 'Couriers',
        category: 'supply',
        icon: Truck,
        count: getCount('courier_providers'),
        description: 'Third-party delivery partners and shipping fleet profiles',
      },

      // ── Category: inventory ──
      {
        id: 'inventory__all',
        label: 'All Stock & Products',
        shortLabel: 'All Stock',
        category: 'inventory',
        icon: Package,
        count: domainCounts.inventory,
        description: 'Catalogue products, warehouse balances, categories, and price lists',
      },
      {
        id: 'inventory__products',
        label: 'Products',
        shortLabel: 'Products',
        category: 'inventory',
        icon: Package,
        count: getCount('products'),
        description: 'Finished goods and raw materials catalogue items',
      },
      {
        id: 'inventory__categories',
        label: 'Product Categories',
        shortLabel: 'Categories',
        category: 'inventory',
        icon: FolderTree,
        count: getCount('categories'),
        description: 'Taxonomy folders and product departments',
      },
      {
        id: 'inventory__brands',
        label: 'Product Brands',
        shortLabel: 'Brands',
        category: 'inventory',
        icon: Bookmark,
        count: getCount('brands'),
        description: 'Manufacturer brands and product labels',
      },
      {
        id: 'inventory__parties',
        label: 'Customers & Vendors',
        shortLabel: 'Parties',
        category: 'inventory',
        icon: Users,
        count: getCount('parties'),
        description: 'Customer contact books and vendor directory entries',
      },
      {
        id: 'inventory__warehouses',
        label: 'Warehouses',
        shortLabel: 'Warehouses',
        category: 'inventory',
        icon: Warehouse,
        count: getCount('warehouses'),
        description: 'Physical warehouses, storage locations, and bins',
      },
      {
        id: 'inventory__units',
        label: 'Units of Measure',
        shortLabel: 'Units',
        category: 'inventory',
        icon: Ruler,
        count: getCount('units'),
        description: 'Standard unit conversions (kg, pcs, liters, etc.)',
      },
      {
        id: 'inventory__stock_transfers',
        label: 'Stock Transfers',
        shortLabel: 'Transfers',
        category: 'inventory',
        icon: ArrowLeftRight,
        count: getCount('stock_transfers'),
        description: 'Inter-warehouse stock movements',
      },
      {
        id: 'inventory__stock_adjustments',
        label: 'Stock Adjustments',
        shortLabel: 'Adjustments',
        category: 'inventory',
        icon: Sliders,
        count: getCount('stock_adjustments'),
        description: 'Inventory write-offs, shrinkage, and damage corrections',
      },
      {
        id: 'inventory__stock_counts',
        label: 'Stock Audits',
        shortLabel: 'Physical Counts',
        category: 'inventory',
        icon: CheckSquare,
        count: getCount('stock_counts'),
        description: 'Cycle count sheets and annual physical stocktake audits',
      },
      {
        id: 'inventory__tax_profiles',
        label: 'Tax Profiles',
        shortLabel: 'Taxes',
        category: 'inventory',
        icon: Percent,
        count: getCount('tax_profiles'),
        description: 'VAT, GST, and sales tax rules',
      },
      {
        id: 'inventory__discount_rules',
        label: 'Discount Rules',
        shortLabel: 'Discounts',
        category: 'inventory',
        icon: Tag,
        count: getCount('discount_rules'),
        description: 'Promotional rules and tier-based discounts',
      },
      {
        id: 'inventory__price_lists',
        label: 'Price Lists',
        shortLabel: 'Prices',
        category: 'inventory',
        icon: DollarSign,
        count: getCount('price_lists'),
        description: 'Wholesale, retail, and distributor price schedules',
      },

      // ── Category: manufacturing ──
      {
        id: 'manufacturing__all',
        label: 'All Factory & Quality',
        shortLabel: 'All Factory',
        category: 'manufacturing',
        icon: Factory,
        count: domainCounts.manufacturing,
        description: 'Production runs, schedules, worker tickets, and quality inspections',
      },
      {
        id: 'manufacturing__production_batches',
        label: 'Production Batches',
        shortLabel: 'Batches',
        category: 'manufacturing',
        icon: Factory,
        count: getCount('production_batches'),
        description: 'Factory production batch job cards',
      },
      {
        id: 'manufacturing__production_plans',
        label: 'Production Plans',
        shortLabel: 'Plans',
        category: 'manufacturing',
        icon: CalendarRange,
        count: getCount('production_plans'),
        description: 'Monthly and weekly production schedule targets',
      },
      {
        id: 'manufacturing__worker_production_entries',
        label: 'Worker Time Logs',
        shortLabel: 'Worker Logs',
        category: 'manufacturing',
        icon: UserCheck,
        count: getCount('worker_production_entries'),
        description: 'Shift production outputs logged by shopfloor workers',
      },
      {
        id: 'manufacturing__qc_inspections',
        label: 'QC Inspections',
        shortLabel: 'QC Checks',
        category: 'manufacturing',
        icon: CheckSquare,
        count: getCount('qc_inspections'),
        description: 'Quality pass/fail inspection reports',
      },
      {
        id: 'manufacturing__qc_parameters',
        label: 'QC Parameters',
        shortLabel: 'Parameters',
        category: 'manufacturing',
        icon: Sliders,
        count: getCount('qc_parameters'),
        description: 'Tolerance limits, test standards, and testing criteria',
      },
      {
        id: 'manufacturing__qc_defects',
        label: 'QC Defect Logs',
        shortLabel: 'Defects',
        category: 'manufacturing',
        icon: AlertTriangle,
        count: getCount('qc_defects'),
        description: 'Recorded product flaws and root cause audits',
      },
      {
        id: 'manufacturing__wastage_records',
        label: 'Wastage Records',
        shortLabel: 'Wastage',
        category: 'manufacturing',
        icon: Trash2,
        count: getCount('wastage_records'),
        description: 'Factory scrap and material loss entries',
      },
      {
        id: 'manufacturing__rework_orders',
        label: 'Rework Orders',
        shortLabel: 'Reworks',
        category: 'manufacturing',
        icon: RotateCcw,
        count: getCount('rework_orders'),
        description: 'Shopfloor rework and reprocessing tickets',
      },

      // ── Category: workforce ──
      {
        id: 'workforce__all',
        label: 'All Workforce & HR',
        shortLabel: 'All HR',
        category: 'workforce',
        icon: Users,
        count: domainCounts.workforce,
        description: 'Employee profiles, work shifts, leave requests, and payroll entries',
      },
      {
        id: 'workforce__employees',
        label: 'Staff Employees',
        shortLabel: 'Employees',
        category: 'workforce',
        icon: Users,
        count: getCount('employees'),
        description: 'Full-time, contract, and shopfloor worker records',
      },
      {
        id: 'workforce__departments',
        label: 'Departments',
        shortLabel: 'Departments',
        category: 'workforce',
        icon: Building2,
        count: getCount('departments'),
        description: 'Organizational divisions and cost centers',
      },
      {
        id: 'workforce__designations',
        label: 'Designations',
        shortLabel: 'Designations',
        category: 'workforce',
        icon: Briefcase,
        count: getCount('designations'),
        description: 'Job titles and organizational hierarchy positions',
      },
      {
        id: 'workforce__shifts',
        label: 'Work Shifts',
        shortLabel: 'Shifts',
        category: 'workforce',
        icon: Clock,
        count: getCount('shifts'),
        description: 'Working hour rosters and rotational shift patterns',
      },
      {
        id: 'workforce__leave_requests',
        label: 'Leave Requests',
        shortLabel: 'Leaves',
        category: 'workforce',
        icon: Calendar,
        count: getCount('leave_requests'),
        description: 'Paid, sick, and casual leave applications',
      },
      {
        id: 'workforce__payslips',
        label: 'Payroll Payslips',
        shortLabel: 'Payslips',
        category: 'workforce',
        icon: FileText,
        count: getCount('payslips'),
        description: 'Monthly employee salary disbursement records',
      },
      {
        id: 'workforce__payroll_advances',
        label: 'Salary Advances',
        shortLabel: 'Advances',
        category: 'workforce',
        icon: Wallet,
        count: getCount('payroll_advances'),
        description: 'Short-term staff cash advances and loan deductions',
      },

      // ── Category: finance ──
      {
        id: 'finance__all',
        label: 'All Finance & Assets',
        shortLabel: 'All Finance',
        category: 'finance',
        icon: Landmark,
        count: domainCounts.finance,
        description: 'Expense registers, bank ledgers, fixed assets, and depreciation',
      },
      {
        id: 'finance__expenses',
        label: 'Expense Entries',
        shortLabel: 'Expenses',
        category: 'finance',
        icon: Receipt,
        count: getCount('expenses'),
        description: 'Operational expenditure vouchers and petty cash slips',
      },
      {
        id: 'finance__bank_accounts',
        label: 'Bank Accounts',
        shortLabel: 'Bank Accounts',
        category: 'finance',
        icon: Landmark,
        count: getCount('bank_accounts'),
        description: 'Company bank accounts and liquidity deposit books',
      },
      {
        id: 'finance__chart_of_accounts',
        label: 'Chart of Accounts',
        shortLabel: 'COA',
        category: 'finance',
        icon: Coins,
        count: getCount('chart_of_accounts'),
        description: 'Accounting ledger heads and financial categories',
      },
      {
        id: 'finance__assets',
        label: 'Fixed Assets',
        shortLabel: 'Assets',
        category: 'finance',
        icon: Cpu,
        count: getCount('assets'),
        description: 'Machinery, vehicles, electronics, and factory equipment',
      },
      {
        id: 'finance__maintenance_orders',
        label: 'Maintenance Orders',
        shortLabel: 'Maintenance',
        category: 'finance',
        icon: Wrench,
        count: getCount('maintenance_orders'),
        description: 'Preventive service tickets and breakdown repairs',
      },

      // ── Category: system ──
      {
        id: 'system__all',
        label: 'All System & Web',
        shortLabel: 'All System',
        category: 'system',
        icon: ShieldCheck,
        count: domainCounts.system,
        description: 'User access accounts, security roles, CMS pages, and printer settings',
      },
      {
        id: 'system__users',
        label: 'Staff Users',
        shortLabel: 'Users',
        category: 'system',
        icon: User,
        count: getCount('users'),
        description: 'System login credentials and operator accounts',
      },
      {
        id: 'system__roles',
        label: 'Roles & Permissions',
        shortLabel: 'Roles',
        category: 'system',
        icon: ShieldCheck,
        count: getCount('roles'),
        description: 'Security groups and RBAC permission matrices',
      },
      {
        id: 'system__storefront_pages',
        label: 'Storefront Pages',
        shortLabel: 'Web Pages',
        category: 'system',
        icon: Globe,
        count: getCount('storefront_pages'),
        description: 'E-commerce policy pages, blogs, and marketing landing pages',
      },
      {
        id: 'system__print_profiles',
        label: 'Print Profiles',
        shortLabel: 'Printing',
        category: 'system',
        icon: Printer,
        count: getCount('print_profiles'),
        description: 'Thermal POS slips, barcode labels, and invoice formats',
      },
      {
        id: 'system__paper_sizes',
        label: 'Paper Sizes',
        shortLabel: 'Paper Sizes',
        category: 'system',
        icon: FileText,
        count: getCount('paper_sizes'),
        description: 'Custom receipt paper and label dimensions',
      },
    ];

    // Append any extra types dynamically returned from backend
    const knownKeys = new Set([
      'sales_orders',
      'invoices',
      'sales_returns',
      'exchanges',
      'delivery_orders',
      'crm_leads',
      'salesman_targets',
      'coupons',
      'pos_terminals',
      'purchase_orders',
      'purchase_requisitions',
      'goods_receipts',
      'purchase_bills',
      'purchase_returns',
      'courier_providers',
      'products',
      'categories',
      'brands',
      'parties',
      'warehouses',
      'units',
      'stock_transfers',
      'stock_adjustments',
      'stock_counts',
      'tax_profiles',
      'discount_rules',
      'price_lists',
      'production_batches',
      'production_plans',
      'worker_production_entries',
      'qc_inspections',
      'qc_parameters',
      'qc_defects',
      'wastage_records',
      'rework_orders',
      'employees',
      'departments',
      'designations',
      'shifts',
      'leave_requests',
      'payslips',
      'payroll_advances',
      'expenses',
      'bank_accounts',
      'chart_of_accounts',
      'assets',
      'maintenance_orders',
      'users',
      'roles',
      'storefront_pages',
      'print_profiles',
      'paper_sizes',
    ]);

    types.forEach((t) => {
      if (!knownKeys.has(t.key)) {
        const d = (t.domain as DomainKey) || 'system';
        allTabs.push({
          id: `${d}__${t.key}`,
          label: t.label,
          shortLabel: t.label,
          category: d,
          icon: getTypeIcon(t.key),
          count: t.count,
          description: `Deleted ${t.label} records`,
        });
      }
    });

    return allTabs;
  }, [totalTrashed, domainCounts, typeCounts, types]);

  // Derive active tab ID matching WorkspaceNavigationHub schema
  const resolvedActiveTab = useMemo(() => {
    const candidate = `${selectedDomain}__${selectedType}`;
    const exists = tabsConfig.some((t) => t.id === candidate);
    if (exists) return candidate;
    return `${selectedDomain}__all`;
  }, [selectedDomain, selectedType, tabsConfig]);

  const handleSelectTab = (tabId: string) => {
    const [domainPart, typePart] = tabId.split('__') as [DomainKey, string];
    setSelectedDomain(domainPart);
    setSelectedType(typePart);
    setSelectedKeys(new Set());
  };

  // Handle Restore
  const handleRestore = async (item: DataBinItem) => {
    setActionLoadingId(item.id);
    try {
      const res = await api.post<{ message?: string }>(`/bin/${item.type}/${item.id}/restore`, {});
      notify.success(res?.data?.message ?? `${item.type_label} restored successfully.`);
      setRestoreConfirmItem(null);
      await loadBinData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to restore item.';
      notify.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Initiate 30-Second Safe Purge Countdown
  const startSafePurgeCountdown = (item: DataBinItem) => {
    if (pendingPurgeTimerRef.current) clearTimeout(pendingPurgeTimerRef.current);
    if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);

    setPurgeConfirmItem(null);
    setPendingPurge({ item, remainingSeconds: 30 });
    notify.info(`Quarantined for permanent purge: "${item.identifier}". 30-second undo protection active.`);

    pendingPurgeIntervalRef.current = setInterval(() => {
      setPendingPurge((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);
          return null;
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    pendingPurgeTimerRef.current = setTimeout(async () => {
      if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);
      setPendingPurge(null);
      await executePermanentDelete(item);
    }, 30000);
  };

  // Undo / Cancel Purge
  const handleCancelSafePurge = () => {
    if (pendingPurgeTimerRef.current) clearTimeout(pendingPurgeTimerRef.current);
    if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);
    setPendingPurge(null);
    notify.info('Purge aborted. Record preserved in Data Bin.');
  };

  // Execute Immediate Purge (Directly or after timer expires)
  const executePermanentDelete = async (item: DataBinItem) => {
    if (pendingPurgeTimerRef.current) clearTimeout(pendingPurgeTimerRef.current);
    if (pendingPurgeIntervalRef.current) clearInterval(pendingPurgeIntervalRef.current);
    setPendingPurge(null);
    setActionLoadingId(item.id);
    try {
      const res = await api.delete<{ message?: string }>(`/bin/${item.type}/${item.id}/force-delete`);
      notify.success(res?.data?.message ?? `${item.type_label} permanently deleted.`);
      setPurgeConfirmItem(null);
      await loadBinData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to purge item.';
      notify.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Permanent Delete (Force Delete)
  const handleForceDelete = async (item: DataBinItem) => {
    await executePermanentDelete(item);
  };

  // Handle Empty Bin (type-scoped, domain-scoped, or full)
  const handleEmptyBin = async () => {
    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (selectedType !== 'all') {
        payload.type = selectedType;
      } else if (selectedDomain !== 'all') {
        payload.domain = selectedDomain;
      }

      const res = await api.post<{ message?: string }>('/bin/empty', payload);
      notify.success(res?.data?.message ?? 'Data Bin cleared successfully.');
      setEmptyConfirmOpen(false);
      await loadBinData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to empty Data Bin.';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Filtered in-memory search for snappy typing
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.identifier.toLowerCase().includes(q) ||
        item.type_label.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.details?.code && String(item.details.code).toLowerCase().includes(q)) ||
        (item.details?.status && String(item.details.status).toLowerCase().includes(q)) ||
        (item.details?.department && String(item.details.department).toLowerCase().includes(q)) ||
        (item.details?.category && String(item.details.category).toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Derived multi-selection properties
  const isAllSelected =
    displayedItems.length > 0 &&
    displayedItems.every((item) => selectedKeys.has(`${item.type}:${item.id}`));
  const isSomeSelected = selectedKeys.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedKeys.size > 0) {
        setSelectedKeys(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeys.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(displayedItems.map((item) => `${item.type}:${item.id}`)));
    }
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkRestore = async () => {
    if (selectedKeys.size === 0) return;
    setIsBulkRestoring(true);
    try {
      const itemsPayload = Array.from(selectedKeys).map((k) => {
        const [type, ...rest] = k.split(':');
        return { type, id: rest.join(':') };
      });
      const res = await api.post<{ message?: string; data?: { restored_count?: number } }>('/bin/bulk-restore', {
        items: itemsPayload,
      });
      const count = res?.data?.data?.restored_count ?? itemsPayload.length;
      notify.success(res?.data?.message ?? `${count} record(s) restored successfully.`);
      setSelectedKeys(new Set());
      setBulkRestoreConfirmOpen(false);
      await loadBinData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to bulk restore items.';
      notify.error(msg);
    } finally {
      setIsBulkRestoring(false);
    }
  };

  const handleBulkForceDelete = async () => {
    if (selectedKeys.size === 0) return;
    setIsBulkPurging(true);
    try {
      const itemsPayload = Array.from(selectedKeys).map((k) => {
        const [type, ...rest] = k.split(':');
        return { type, id: rest.join(':') };
      });
      const res = await api.post<{ message?: string; data?: { purged_count?: number } }>('/bin/bulk-force-delete', {
        items: itemsPayload,
      });
      const count = res?.data?.data?.purged_count ?? itemsPayload.length;
      notify.success(res?.data?.message ?? `${count} record(s) permanently purged.`);
      setSelectedKeys(new Set());
      setBulkPurgeConfirmOpen(false);
      await loadBinData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to bulk purge items.';
      notify.error(msg);
    } finally {
      setIsBulkPurging(false);
    }
  };

  const formatDeletedDate = (isoString?: string) => {
    if (!isoString) return 'Recently';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return (
      date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' ' +
      date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const activeCategoryConfig =
    categoriesConfig.find((c) => c.id === selectedDomain) || categoriesConfig[0]!;
  const ActiveCategoryIcon = activeCategoryConfig.icon;
  const currentTabConfig = tabsConfig.find((t) => t.id === resolvedActiveTab);

  return (
    <div className="space-y-6">
      {/* Workspace Header Surface */}
      <div className="bg-surface border border-default rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldAlert className="size-3" />
                Zero Data-Loss Enterprise Vault
              </span>
              <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
                Recovery Center
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-medium text-muted flex items-center gap-1">
                <ActiveCategoryIcon className="size-3 text-muted" />
                {activeCategoryConfig.label}
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-semibold text-default">
                {currentTabConfig?.shortLabel || currentTabConfig?.label || 'All Records'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
              <div className="size-10 rounded-xl bg-linear-to-br from-indigo-500/15 via-purple-500/15 to-emerald-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                <ArchiveRestore className="size-5" />
              </div>
              <span>Data Bin & Recovery Vault</span>
            </h1>
            <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
              Complete retention and safety lifecycle. Records deleted anywhere across Sales, Purchasing,
              Inventory, Production, Finance, HR, or System settings are safely quarantined here. Restore with
              1-click or permanently purge.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncVault}
              disabled={loading}
              leftIcon={<RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />}
            >
              Sync Vault
            </Button>
            {totalTrashed > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEmptyConfirmOpen(true)}
                disabled={loading}
                leftIcon={<Trash2 className="size-3.5" />}
              >
                Empty Bin
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-2xs transition-all hover:border-indigo-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Quarantined Items
            </span>
            <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <ArchiveRestore className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-default">
              {totalTrashed.toLocaleString()}
            </span>
            <span className="text-xs text-muted">records across all modules</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-2xs transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Active Category Scopes
            </span>
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Layers className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-default">
              {types.filter((t) => t.count > 0).length} / {types.length || 52}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">entities with trash</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-2xs transition-all hover:border-blue-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Rollback Integrity
            </span>
            <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-default">100%</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Relational Cascades Safe</span>
          </div>
        </div>
      </div>

      {/* 2-Tier Universal Navigation Hub */}
      <WorkspaceNavigationHub<DomainKey, string>
        categories={categoriesConfig}
        tabs={tabsConfig}
        activeTab={resolvedActiveTab}
        onSelectTab={handleSelectTab}
        taglineRightContent={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            Instant 1-Click Restore
          </span>
        }
      />

      {/* Search and Action Bar */}
      <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search by name, code, order #, department, status..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-default bg-surface-sunken text-sm text-default placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-default p-0.5 rounded-md cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted self-center flex-wrap">
            {selectedType !== 'all' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium">
                <span>Filtered: {types.find((t) => t.key === selectedType)?.label || selectedType}</span>
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className="hover:opacity-75 cursor-pointer ml-1"
                  title="Clear type filter"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <span>
              Showing <strong className="text-default">{displayedItems.length}</strong> record
              {displayedItems.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Selection Ribbon */}
      {selectedKeys.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-default shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white">
              {selectedKeys.size}
            </span>
            <span className="text-xs font-semibold text-default">
              record{selectedKeys.size === 1 ? '' : 's'} selected in vault
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isBulkRestoring || isBulkPurging}
              onClick={() => setBulkRestoreConfirmOpen(true)}
              leftIcon={<RotateCcw className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
            >
              Restore Selected ({selectedKeys.size})
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isBulkRestoring || isBulkPurging}
              onClick={() => setBulkPurgeConfirmOpen(true)}
              leftIcon={<Trash2 className="size-3.5" />}
            >
              Purge Selected ({selectedKeys.size})
            </Button>
            <button
              type="button"
              onClick={() => setSelectedKeys(new Set())}
              className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              title="Clear selection (Esc)"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table / Empty State */}
      <div className="bg-surface rounded-2xl border border-default overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="size-8 text-primary animate-spin" />
            <p className="mt-3 text-sm text-muted font-medium">Scanning enterprise recovery vault...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-20 px-6 text-center flex flex-col items-center justify-center">
            <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-default">
              Recovery Vault is Pristine
            </h3>
            <p className="mt-1 text-sm text-muted max-w-md">
              {searchQuery
                ? `No trashed items matched "${searchQuery}". Try a different search term or category.`
                : selectedType !== 'all'
                ? `No deleted items found under this entity type. Everything is active in the live workspace.`
                : selectedDomain !== 'all'
                ? `No deleted items found under "${DOMAIN_CONFIG[selectedDomain].label}". Everything is active in the live workspace.`
                : 'No deleted records found in the Data Bin. Any item deleted across the ERP will appear here for recovery.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-default bg-surface-sunken/60 text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-default text-primary focus:ring-primary size-4 cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Item Identifier</th>
                  <th className="py-3 px-4">Context / Metadata</th>
                  <th className="py-3 px-4">Deleted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default/60">
                {displayedItems.map((item) => {
                  const itemKey = `${item.type}:${item.id}`;
                  const isSelected = selectedKeys.has(itemKey);
                  const style = TYPE_COLORS[item.type] || {
                    bg: 'bg-surface-sunken',
                    text: 'text-default',
                    border: 'border-default',
                  };

                  const isActing = actionLoadingId === item.id;

                  return (
                    <tr
                      key={itemKey}
                      className={cn(
                        'hover:bg-surface-sunken/50 transition-colors group',
                        isSelected && 'bg-primary/5 dark:bg-primary/10'
                      )}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(itemKey)}
                          className="rounded border-default text-primary focus:ring-primary size-4 cursor-pointer"
                          aria-label={`Select ${item.identifier}`}
                        />
                      </td>
                      {/* Entity Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border',
                            style.bg,
                            style.text,
                            style.border
                          )}
                        >
                          {item.type_label}
                        </span>
                      </td>

                      {/* Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-default flex items-center gap-2">
                          <span>{item.identifier}</span>
                          <span className="text-xs text-muted font-mono">#{item.id}</span>
                        </div>
                      </td>

                      {/* Details / Context */}
                      <td className="py-3.5 px-4 text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Boolean(item.details?.code) && (
                            <span className="px-2 py-0.5 rounded bg-surface-sunken text-default font-mono font-medium border border-default/50">
                              #{String(item.details.code)}
                            </span>
                          )}
                          {Boolean(item.details?.status) && (
                            <span className="px-2 py-0.5 rounded bg-surface-sunken text-muted font-medium border border-default/50">
                              status: {String(item.details.status)}
                            </span>
                          )}
                          {item.details?.amount !== undefined && item.details?.amount !== null && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                              ৳{Number(item.details.amount).toLocaleString()}
                            </span>
                          )}
                          {item.details?.quantity !== undefined && item.details?.quantity !== null && (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                              qty: {Number(item.details.quantity).toLocaleString()}
                            </span>
                          )}
                          {Boolean(item.details?.department) && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              dept: {String(item.details.department)}
                            </span>
                          )}
                          {Boolean(item.details?.category) && (
                            <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              cat: {String(item.details.category)}
                            </span>
                          )}
                          {Boolean(item.details?.reason) && (
                            <span
                              className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 italic max-w-xs truncate"
                              title={String(item.details?.reason)}
                            >
                              &quot;{String(item.details?.reason)}&quot;
                            </span>
                          )}
                          {Boolean(item.details?.date) && (
                            <span className="px-2 py-0.5 rounded bg-surface-sunken text-muted font-mono text-[11px] border border-default/50">
                              {String(item.details?.date)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deleted Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted">
                        <span title={item.deleted_at}>{formatDeletedDate(item.deleted_at)}</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {pendingPurge?.item.id === item.id && pendingPurge?.item.type === item.type ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">
                              Purging in {pendingPurge.remainingSeconds}s
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleCancelSafePurge}
                              className="text-xs h-7 px-2"
                            >
                              Undo
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => executePermanentDelete(item)}
                              className="text-xs h-7 px-2"
                            >
                              Purge Now
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isActing}
                              onClick={() => setRestoreConfirmItem(item)}
                              leftIcon={<RotateCcw className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
                            >
                              Restore
                            </Button>

                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isActing}
                              onClick={() => setPurgeConfirmItem(item)}
                              leftIcon={<Trash2 className="size-3.5" />}
                            >
                              Purge
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Item Restore Confirmation Dialog */}
      {restoreConfirmItem && (
        <ConfirmDialog
          open={!!restoreConfirmItem}
          onClose={() => setRestoreConfirmItem(null)}
          onConfirm={() => void handleRestore(restoreConfirmItem)}
          title={`Restore ${restoreConfirmItem.type_label}`}
          message={`Are you sure you want to restore "${restoreConfirmItem.identifier}" back into active enterprise records? It will immediately reappear in its respective workspace along with all linked sub-items.`}
          confirmLabel="Restore Record"
          cancelLabel="Cancel"
          variant="primary"
        />
      )}

      {/* Single Item Purge Confirmation Dialog */}
      {purgeConfirmItem && (
        <ConfirmDialog
          open={!!purgeConfirmItem}
          onClose={() => setPurgeConfirmItem(null)}
          onConfirm={() => void handleForceDelete(purgeConfirmItem)}
          title={`Permanently Purge ${purgeConfirmItem.type_label}?`}
          message={
            <div className="space-y-3">
              <p>
                WARNING: This action is permanent and irreversible. &quot;{purgeConfirmItem.identifier}&quot; and its relational sub-items will be completely erased from the database.
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-300 block mb-1">
                  Want safety protection before irreversible deletion?
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    startSafePurgeCountdown(purgeConfirmItem);
                  }}
                  className="font-bold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldAlert className="size-3.5" />
                  <span>Start 30-second safe countdown with instant Undo</span>
                </button>
              </div>
            </div>
          }
          confirmLabel="Permanently Delete"
          cancelLabel="Cancel"
          variant="danger"
        />
      )}

      {/* Empty Entire Bin Confirmation Dialog */}
      {emptyConfirmOpen && (
        <ConfirmDialog
          open={emptyConfirmOpen}
          onClose={() => setEmptyConfirmOpen(false)}
          onConfirm={() => void handleEmptyBin()}
          title={
            selectedType !== 'all'
              ? `Empty ${types.find((t) => t.key === selectedType)?.label || selectedType} from Bin?`
              : selectedDomain !== 'all'
              ? `Empty All ${DOMAIN_CONFIG[selectedDomain]?.label || selectedDomain} Items?`
              : 'Empty Entire Recovery Vault?'
          }
          message={
            selectedType !== 'all'
              ? `CAUTION: You are about to permanently purge all deleted items of category "${types.find((t) => t.key === selectedType)?.label || selectedType}". This cannot be undone.`
              : selectedDomain !== 'all'
              ? `CAUTION: You are about to permanently purge all deleted items under "${DOMAIN_CONFIG[selectedDomain]?.label || selectedDomain}". This cannot be undone.`
              : `CAUTION: You are about to permanently purge ALL ${totalTrashed} deleted records across all ERP modules. This cannot be undone.`
          }
          confirmLabel="Yes, Empty Bin"
          cancelLabel="Cancel"
          variant="danger"
        />
      )}

      {/* Bulk Restore Confirmation Dialog */}
      {bulkRestoreConfirmOpen && (
        <ConfirmDialog
          open={bulkRestoreConfirmOpen}
          onClose={() => setBulkRestoreConfirmOpen(false)}
          onConfirm={() => void handleBulkRestore()}
          title={`Restore ${selectedKeys.size} Selected Record(s)`}
          message={`Are you sure you want to restore ${selectedKeys.size} selected records back into active enterprise records? They will immediately reappear in their respective workspaces along with all linked sub-items.`}
          confirmLabel={isBulkRestoring ? 'Restoring...' : `Restore Records (${selectedKeys.size})`}
          cancelLabel="Cancel"
          variant="primary"
        />
      )}

      {/* Bulk Purge Confirmation Dialog */}
      {bulkPurgeConfirmOpen && (
        <ConfirmDialog
          open={bulkPurgeConfirmOpen}
          onClose={() => setBulkPurgeConfirmOpen(false)}
          onConfirm={() => void handleBulkForceDelete()}
          title={`Permanently Purge ${selectedKeys.size} Selected Record(s)?`}
          message={`WARNING: This action is permanent and irreversible. All ${selectedKeys.size} selected records and their relational sub-items will be completely erased from the database.`}
          confirmLabel={isBulkPurging ? 'Purging...' : `Permanently Purge (${selectedKeys.size})`}
          cancelLabel="Cancel"
          variant="danger"
        />
      )}

      {/* 30-Second Safe Purge Countdown Floating Bar */}
      {pendingPurge && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-rise-in">
          <div className="rounded-2xl border border-rose-500/40 bg-zinc-950 text-white p-4 shadow-2xl backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <ShieldAlert className="size-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      Permanent Purge Initiated: {pendingPurge.item.identifier}
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                      {pendingPurge.remainingSeconds}s
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block truncate">
                    Record will be permanently erased when countdown expires.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelSafePurge}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 text-xs h-8 px-3"
                >
                  <RotateCcw className="size-3 mr-1" />
                  <span>Undo Purge</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => executePermanentDelete(pendingPurge.item)}
                  className="text-xs h-8 px-3"
                >
                  <span>Purge Now</span>
                </Button>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-linear-to-r from-amber-500 to-rose-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(pendingPurge.remainingSeconds / 30) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
