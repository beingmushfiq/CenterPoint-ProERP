import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';

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

  // Dialogs
  const [restoreConfirmItem, setRestoreConfirmItem] = useState<DataBinItem | null>(null);
  const [purgeConfirmItem, setPurgeConfirmItem] = useState<DataBinItem | null>(null);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState<boolean>(false);

  // Fetch stats & records (pure asynchronous fetch)
  const loadBinData = useCallback(async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        api.get<{ total: number; types: BinTypeStat[]; domains?: Record<string, number> }>('/bin/stats'),
        api.get<DataBinItem[]>('/bin', {
          params: {
            domain: selectedDomain !== 'all' ? selectedDomain : undefined,
            type: selectedType !== 'all' ? selectedType : undefined,
            search: searchQuery.trim() || undefined,
            per_page: 50,
          },
        }),
      ]);

      if (statsRes?.data) {
        setTotalTrashed(statsRes.data.total ?? 0);
        setTypes(statsRes.data.types ?? []);
        if (statsRes.data.domains) {
          setBackendDomains(statsRes.data.domains);
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
      api.get<{ total: number; types: BinTypeStat[]; domains?: Record<string, number> }>('/bin/stats'),
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
        if (statsRes?.data) {
          setTotalTrashed(statsRes.data.total ?? 0);
          setTypes(statsRes.data.types ?? []);
          if (statsRes.data.domains) {
            setBackendDomains(statsRes.data.domains);
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

  const handleDomainSelect = (domain: DomainKey) => {
    setSelectedDomain(domain);
    setSelectedType('all');
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

  // Types filtered by active domain
  const visibleTypes = useMemo(() => {
    if (selectedDomain === 'all') return types;
    return types.filter((t) => (t.domain || 'system') === selectedDomain);
  }, [types, selectedDomain]);

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

  // Handle Permanent Delete (Force Delete)
  const handleForceDelete = async (item: DataBinItem) => {
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

  return (
    <div className="space-y-6">
      {/* Workspace Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <ShieldAlert className="size-3.5" />
              Zero Data-Loss Enterprise Vault
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <ArchiveRestore className="size-8 text-indigo-400 shrink-0" />
              Data Bin & Recovery Vault
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Complete retention and safety lifecycle. Records deleted anywhere across Sales, Purchasing,
              Inventory, Production, Finance, HR, or System settings are safely quarantined here. Restore with
              1-click or permanently purge.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="md"
              onClick={handleSyncVault}
              disabled={loading}
              leftIcon={<RefreshCw className={cn('size-4', loading && 'animate-spin')} />}
            >
              Sync Vault
            </Button>
            {totalTrashed > 0 && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setEmptyConfirmOpen(true)}
                disabled={loading}
                leftIcon={<Trash2 className="size-4" />}
              >
                Empty Bin
              </Button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 size-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -top-12 size-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Quarantined Items
            </span>
            <div className="size-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArchiveRestore className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalTrashed.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">records across all modules</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Category Scopes
            </span>
            <div className="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {types.filter((t) => t.count > 0).length} / {types.length || 52}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">entities with trash</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Rollback Integrity
            </span>
            <div className="size-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">100%</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Relational Cascades Safe</span>
          </div>
        </div>
      </div>

      {/* Operational Domain Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {(Object.keys(DOMAIN_CONFIG) as DomainKey[]).map((dKey) => {
            const domain = DOMAIN_CONFIG[dKey];
            const Icon = domain.icon;
            const count = domainCounts[dKey] ?? 0;
            const isSelected = selectedDomain === dKey;

            return (
              <button
                key={dKey}
                type="button"
                onClick={() => handleDomainSelect(dKey)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border',
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon className={cn('size-4 shrink-0', isSelected ? 'text-white' : domain.color)} />
                <span>{domain.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : count > 0
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls & Filter Pills */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code, order #, department, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 self-center">
            Showing <strong className="text-slate-800 dark:text-slate-200">{displayedItems.length}</strong> record
            {displayedItems.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Entity Type Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
              selectedType === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <span>All Types</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                selectedType === 'all'
                  ? 'bg-white/20 dark:bg-slate-900/20 text-current'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              )}
            >
              {domainCounts[selectedDomain] ?? totalTrashed}
            </span>
          </button>

          {visibleTypes.map((t) => {
            const isSelected = selectedType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelectedType(t.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : t.count > 0
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table / Empty State */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="size-8 text-indigo-500 animate-spin" />
            <p className="mt-3 text-sm text-slate-500 font-medium">Scanning enterprise recovery vault...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-20 px-6 text-center flex flex-col items-center justify-center">
            <div className="size-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              Recovery Vault is Pristine
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md">
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
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Item Identifier</th>
                  <th className="py-3 px-4">Context / Metadata</th>
                  <th className="py-3 px-4">Deleted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayedItems.map((item) => {
                  const style = TYPE_COLORS[item.type] || {
                    bg: 'bg-slate-100 dark:bg-slate-800',
                    text: 'text-slate-700 dark:text-slate-300',
                    border: 'border-slate-200 dark:border-slate-700',
                  };

                  const isActing = actionLoadingId === item.id;

                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
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
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{item.identifier}</span>
                          <span className="text-xs text-slate-400 font-mono">#{item.id}</span>
                        </div>
                      </td>

                      {/* Details / Context */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Boolean(item.details?.code) && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium">
                              #{String(item.details.code)}
                            </span>
                          )}
                          {Boolean(item.details?.status) && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                              status: {String(item.details.status)}
                            </span>
                          )}
                          {item.details?.amount !== undefined && item.details?.amount !== null && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                              ৳{Number(item.details.amount).toLocaleString()}
                            </span>
                          )}
                          {item.details?.quantity !== undefined && item.details?.quantity !== null && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                              qty: {Number(item.details.quantity).toLocaleString()}
                            </span>
                          )}
                          {Boolean(item.details?.department) && (
                            <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                              dept: {String(item.details.department)}
                            </span>
                          )}
                          {Boolean(item.details?.category) && (
                            <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                              cat: {String(item.details.category)}
                            </span>
                          )}
                          {Boolean(item.details?.reason) && (
                            <span
                              className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 italic max-w-xs truncate"
                              title={String(item.details?.reason)}
                            >
                              &quot;{String(item.details?.reason)}&quot;
                            </span>
                          )}
                          {Boolean(item.details?.date) && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {String(item.details?.date)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deleted Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        <span title={item.deleted_at}>{formatDeletedDate(item.deleted_at)}</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
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
          message={`WARNING: This action is permanent and irreversible. "${purgeConfirmItem.identifier}" and its relational sub-items will be completely erased from the database.`}
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
    </div>
  );
};
