import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ShieldCheck,
  PlusCircle,
  FileEdit,
  Trash2,
  ShoppingBag,
  Truck,
  Package,
  Factory,
  Users,
  Landmark,
  Receipt,
  Building2,
  PackageCheck,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  Layers,
  CalendarRange,
  FolderTree,
  CheckSquare,
  AlertTriangle,
  UserCheck,
  Shield,
  DollarSign,
  Coins,
  Wallet,
  Globe,
  Cpu,
  Sliders,
  X,
  Activity,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { notify } from '../../components/ui/Toast';
import { VersionDiffModal, type AuditLogEntry } from '../../components/audit/VersionDiffModal';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../components/ui/ResponsiveDataTable';
import { type ActionSheetItem } from '../../components/motion/MotionActionSheet';

interface PaginationMeta {
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

type DomainKey =
  | 'all'
  | 'commercial'
  | 'supply'
  | 'inventory'
  | 'manufacturing'
  | 'workforce'
  | 'finance'
  | 'system';

const DOMAIN_ENTITIES: Record<DomainKey, string[]> = {
  all: [],
  commercial: ['SalesOrder', 'Customer', 'Invoice', 'Estimate', 'Lead'],
  supply: ['PurchaseOrder', 'Supplier', 'PurchaseReceipt'],
  inventory: ['Product', 'Warehouse', 'StockMovement', 'StockAdjustment'],
  manufacturing: [
    'ProductionBatch',
    'ProductionPlan',
    'BillOfMaterials',
    'QcInspection',
    'QcParameter',
    'WastageRecord',
  ],
  workforce: ['User', 'Role', 'Staff', 'Department', 'Attendance', 'Payroll'],
  finance: ['JournalEntry', 'Asset', 'PaymentReceipt', 'Account'],
  system: ['StorefrontPage', 'Tenant', 'TenantDomain', 'SystemSetting', 'WorkflowRule'],
};

export const ActivityLogWorkspace: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    current_page: 1,
    per_page: 25,
    last_page: 1,
  });
  const [loading, setLoading] = useState(true);

  // Navigation Hub States
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>('all');
  const [activeTab, setActiveTab] = useState<string>('all__all');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Selected Log for Visual Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    let ignore = false;

    const params: Record<string, string | number> = {
      page,
      per_page: 25,
    };

    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (selectedAction !== 'all') params.action = selectedAction;
    if (selectedType !== 'all') params.auditable_type = selectedType;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    api
      .get<AuditLogEntry[]>('/audit-logs', { params })
      .then((res) => {
        if (!ignore) {
          const rawData = res.data as unknown;
          const items: AuditLogEntry[] = Array.isArray(rawData)
            ? (rawData as AuditLogEntry[])
            : rawData &&
                typeof rawData === 'object' &&
                'data' in rawData &&
                Array.isArray((rawData as { data: unknown }).data)
              ? (rawData as { data: AuditLogEntry[] }).data
              : [];
          setLogs(items);

          const resMeta = res.meta as Record<string, unknown> | undefined;
          const dataMeta =
            rawData && typeof rawData === 'object' && 'meta' in rawData
              ? (rawData as { meta: Record<string, unknown> }).meta
              : undefined;
          const pagination = resMeta?.total !== undefined ? resMeta : dataMeta;

          if (pagination) {
            setMeta({
              total: Number(pagination.total ?? items.length),
              current_page: Number(pagination.current_page ?? page),
              per_page: Number(pagination.per_page ?? 25),
              last_page: Number(pagination.last_page ?? 1),
            });
          } else {
            setMeta({
              total: items.length,
              current_page: page,
              per_page: 25,
              last_page: 1,
            });
          }
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch activity logs.';
          notify.error(msg);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, searchQuery, selectedAction, selectedType, startDate, endDate, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const handleResetFilter = () => {
    setLoading(true);
    setSearchQuery('');
    setSelectedDomain('all');
    setActiveTab('all__all');
    setSelectedAction('all');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setDatePreset('all');
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const handleDatePreset = (preset: 'all' | 'today' | '7days' | '30days') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0] ?? '';
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0] ?? '');
      setEndDate(now.toISOString().split('T')[0] ?? '');
    } else if (preset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0] ?? '');
      setEndDate(now.toISOString().split('T')[0] ?? '');
    }
    setPage(1);
  };

  // Metrics from current dataset
  const updatesCount = useMemo(
    () => logs.filter((l) => l.action.toLowerCase().includes('update') || l.action.toLowerCase().includes('edit')).length,
    [logs]
  );
  const createsCount = useMemo(
    () => logs.filter((l) => l.action.toLowerCase().includes('create') || l.action.toLowerCase().includes('store')).length,
    [logs]
  );
  const approvesCount = useMemo(
    () => logs.filter((l) => l.action.toLowerCase().includes('approve') || l.action.toLowerCase().includes('verify')).length,
    [logs]
  );
  const deletesCount = useMemo(
    () => logs.filter((l) => l.action.toLowerCase().includes('delete') || l.action.toLowerCase().includes('void') || l.action.toLowerCase().includes('destroy')).length,
    [logs]
  );

  // 2-Tier Navigation Categories
  const categoriesConfig: WorkspaceCategoryConfig<DomainKey, string>[] = useMemo(() => [
    {
      id: 'all',
      label: 'All Activity',
      tagline: 'Complete system timeline with visual version diffs and accountability tracking',
      icon: History,
      theme: WORKSPACE_THEMES.indigo,
      defaultTab: 'all__all',
      tabs: ['all__all', 'all__create', 'all__update', 'all__approve', 'all__delete'],
      badge: meta.total > 0 ? String(meta.total) : undefined,
    },
    {
      id: 'commercial',
      label: 'Sales & Orders',
      tagline: 'Customer orders, invoices, quotes, and client relationship updates',
      icon: ShoppingBag,
      theme: WORKSPACE_THEMES.emerald,
      defaultTab: 'commercial__all',
      tabs: ['commercial__all', 'commercial__SalesOrder', 'commercial__Customer', 'commercial__Invoice'],
    },
    {
      id: 'supply',
      label: 'Purchases & Vendors',
      tagline: 'Supplier orders, vendor master records, and goods delivery receipts',
      icon: Truck,
      theme: WORKSPACE_THEMES.purple,
      defaultTab: 'supply__all',
      tabs: ['supply__all', 'supply__PurchaseOrder', 'supply__Supplier', 'supply__PurchaseReceipt'],
    },
    {
      id: 'inventory',
      label: 'Stock & Products',
      tagline: 'Catalogue items, storage warehouses, and internal stock movements',
      icon: Package,
      theme: WORKSPACE_THEMES.cyan,
      defaultTab: 'inventory__all',
      tabs: ['inventory__all', 'inventory__Product', 'inventory__Warehouse', 'inventory__StockMovement'],
    },
    {
      id: 'manufacturing',
      label: 'Factory & Quality',
      tagline: 'Production batches, bills of materials (BOM), QC checks, and scrap logs',
      icon: Factory,
      theme: WORKSPACE_THEMES.amber,
      defaultTab: 'manufacturing__all',
      tabs: [
        'manufacturing__all',
        'manufacturing__ProductionBatch',
        'manufacturing__ProductionPlan',
        'manufacturing__BillOfMaterials',
        'manufacturing__QcInspection',
        'manufacturing__WastageRecord',
      ],
    },
    {
      id: 'workforce',
      label: 'Staff & HR',
      tagline: 'Operator accounts, security roles, system permissions, and logins',
      icon: Users,
      theme: WORKSPACE_THEMES.teal,
      defaultTab: 'workforce__all',
      tabs: ['workforce__all', 'workforce__User', 'workforce__Role'],
    },
    {
      id: 'finance',
      label: 'Finance & Assets',
      tagline: 'Ledger journal entries, payments, capital assets, and accounts',
      icon: Landmark,
      theme: WORKSPACE_THEMES.rose,
      defaultTab: 'finance__all',
      tabs: ['finance__all', 'finance__JournalEntry', 'finance__Asset', 'finance__PaymentReceipt'],
    },
    {
      id: 'system',
      label: 'System & Web',
      tagline: 'Storefront pages, multi-tenant configs, automation rules, and system settings',
      icon: ShieldCheck,
      theme: WORKSPACE_THEMES.indigo,
      defaultTab: 'system__all',
      tabs: ['system__all', 'system__StorefrontPage', 'system__Tenant', 'system__TenantDomain', 'system__SystemSetting'],
    },
  ], [meta.total]);

  // 2-Tier Navigation Tabs
  const tabsConfig: WorkspaceTabConfig<DomainKey, string>[] = useMemo(() => [
    // All Domain Tabs
    { id: 'all__all', label: 'All Recorded Actions', shortLabel: 'All Actions', category: 'all', icon: History, count: meta.total },
    { id: 'all__create', label: 'New Record Creates', shortLabel: 'Creates', category: 'all', icon: Sparkles, count: createsCount },
    { id: 'all__update', label: 'Field Edits & Diffs', shortLabel: 'Edits', category: 'all', icon: FileEdit, count: updatesCount },
    { id: 'all__approve', label: 'Approvals & Status', shortLabel: 'Approvals', category: 'all', icon: CheckCircle2, count: approvesCount },
    { id: 'all__delete', label: 'Deletions & Voids', shortLabel: 'Deletions', category: 'all', icon: Trash2, count: deletesCount },

    // Commercial & Sales
    { id: 'commercial__all', label: 'All Sales Activities', shortLabel: 'All Sales', category: 'commercial', icon: ShoppingBag },
    { id: 'commercial__SalesOrder', label: 'Sales Orders', shortLabel: 'Orders', category: 'commercial', icon: Receipt },
    { id: 'commercial__Customer', label: 'Customer Accounts', shortLabel: 'Customers', category: 'commercial', icon: Users },
    { id: 'commercial__Invoice', label: 'Invoices', shortLabel: 'Invoices', category: 'commercial', icon: Receipt },

    // Purchases & Supply
    { id: 'supply__all', label: 'All Supply Activities', shortLabel: 'All Supply', category: 'supply', icon: Truck },
    { id: 'supply__PurchaseOrder', label: 'Purchase Orders', shortLabel: 'Purchase Orders', category: 'supply', icon: Building2 },
    { id: 'supply__Supplier', label: 'Vendors & Suppliers', shortLabel: 'Suppliers', category: 'supply', icon: Building2 },
    { id: 'supply__PurchaseReceipt', label: 'Goods Receipts', shortLabel: 'Receipts', category: 'supply', icon: PackageCheck },

    // Stock & Inventory
    { id: 'inventory__all', label: 'All Stock Activities', shortLabel: 'All Inventory', category: 'inventory', icon: Package },
    { id: 'inventory__Product', label: 'Products & SKUs', shortLabel: 'Products', category: 'inventory', icon: Boxes },
    { id: 'inventory__Warehouse', label: 'Warehouses & Zones', shortLabel: 'Warehouses', category: 'inventory', icon: Warehouse },
    { id: 'inventory__StockMovement', label: 'Stock Movements', shortLabel: 'Stock Transfers', category: 'inventory', icon: ArrowLeftRight },

    // Manufacturing & QC
    { id: 'manufacturing__all', label: 'All Factory & QC Logs', shortLabel: 'All Factory', category: 'manufacturing', icon: Factory },
    { id: 'manufacturing__ProductionBatch', label: 'Production Batches', shortLabel: 'Batches', category: 'manufacturing', icon: Layers },
    { id: 'manufacturing__ProductionPlan', label: 'Production Plans', shortLabel: 'Plans', category: 'manufacturing', icon: CalendarRange },
    { id: 'manufacturing__BillOfMaterials', label: 'Bills of Materials', shortLabel: 'BOMs', category: 'manufacturing', icon: FolderTree },
    { id: 'manufacturing__QcInspection', label: 'QC Inspections', shortLabel: 'QC Tests', category: 'manufacturing', icon: CheckSquare },
    { id: 'manufacturing__WastageRecord', label: 'Scrap & Wastage', shortLabel: 'Wastage', category: 'manufacturing', icon: AlertTriangle },

    // Workforce & HR
    { id: 'workforce__all', label: 'All Workforce Logs', shortLabel: 'All Staff', category: 'workforce', icon: Users },
    { id: 'workforce__User', label: 'User Accounts', shortLabel: 'Users', category: 'workforce', icon: UserCheck },
    { id: 'workforce__Role', label: 'Roles & Access', shortLabel: 'Roles', category: 'workforce', icon: Shield },

    // Finance & Assets
    { id: 'finance__all', label: 'All Finance Logs', shortLabel: 'All Finance', category: 'finance', icon: Landmark },
    { id: 'finance__JournalEntry', label: 'Journal Entries', shortLabel: 'Journals', category: 'finance', icon: DollarSign },
    { id: 'finance__Asset', label: 'Fixed Assets', shortLabel: 'Assets', category: 'finance', icon: Coins },
    { id: 'finance__PaymentReceipt', label: 'Payment Receipts', shortLabel: 'Payments', category: 'finance', icon: Wallet },

    // System & Web
    { id: 'system__all', label: 'All System Settings', shortLabel: 'All System', category: 'system', icon: ShieldCheck },
    { id: 'system__StorefrontPage', label: 'Storefront Pages', shortLabel: 'Storefront', category: 'system', icon: Globe },
    { id: 'system__Tenant', label: 'Tenant Master', shortLabel: 'Tenant', category: 'system', icon: Cpu },
    { id: 'system__TenantDomain', label: 'Tenant Domains', shortLabel: 'Domains', category: 'system', icon: Globe },
    { id: 'system__SystemSetting', label: 'System Settings', shortLabel: 'Settings', category: 'system', icon: Sliders },
  ], [meta.total, createsCount, updatesCount, approvesCount, deletesCount]);

  const handleSelectTab = (tabId: string) => {
    const [domainPart, itemPart] = tabId.split('__') as [DomainKey, string];
    setSelectedDomain(domainPart);
    setActiveTab(tabId);
    setPage(1);

    if (domainPart === 'all') {
      setSelectedType('all');
      if (itemPart === 'all') setSelectedAction('all');
      else if (itemPart === 'create') setSelectedAction('create');
      else if (itemPart === 'update') setSelectedAction('update');
      else if (itemPart === 'approve') setSelectedAction('approve');
      else if (itemPart === 'delete') setSelectedAction('delete');
    } else {
      setSelectedAction('all');
      if (itemPart === 'all') {
        setSelectedType('all');
      } else {
        setSelectedType(itemPart);
      }
    }
  };

  // Client-side domain scoping when selectedType === 'all' under a domain
  const displayedLogs = useMemo(() => {
    if (selectedDomain === 'all' || selectedType !== 'all') {
      return logs;
    }
    const domainEntities = DOMAIN_ENTITIES[selectedDomain] || [];
    if (domainEntities.length === 0) return logs;

    return logs.filter((log) => {
      const clean = (log.auditable_type || '').split('\\').pop() || '';
      return domainEntities.some(
        (entity) => clean.includes(entity) || (log.auditable_type || '').includes(entity)
      );
    });
  }, [logs, selectedDomain, selectedType]);

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('store') || act.includes('insert')) {
      return {
        label: 'CREATED',
        icon: PlusCircle,
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    }
    if (act.includes('update') || act.includes('edit')) {
      return {
        label: 'UPDATED',
        icon: FileEdit,
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    }
    if (act.includes('delete') || act.includes('destroy') || act.includes('void')) {
      return {
        label: 'DELETED',
        icon: Trash2,
        className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
    }
    if (act.includes('approve') || act.includes('verify')) {
      return {
        label: 'APPROVED',
        icon: CheckCircle2,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    }
    if (act.includes('impersonate')) {
      return {
        label: 'IMPERSONATED',
        icon: Shield,
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      };
    }
    return {
      label: action.toUpperCase(),
      icon: Activity,
      className: 'bg-surface-sunken text-muted border-default',
    };
  };

  const getEntityMeta = (auditableType?: string | null) => {
    const clean = auditableType ? auditableType.split('\\').pop() || auditableType : 'System Record';
    switch (clean) {
      case 'SalesOrder':
        return { icon: Receipt, label: 'Sales Order', color: 'text-emerald-600 dark:text-emerald-400' };
      case 'Customer':
        return { icon: Users, label: 'Customer', color: 'text-emerald-600 dark:text-emerald-400' };
      case 'Invoice':
        return { icon: Receipt, label: 'Invoice', color: 'text-emerald-600 dark:text-emerald-400' };
      case 'PurchaseOrder':
        return { icon: Building2, label: 'Purchase Order', color: 'text-purple-600 dark:text-purple-400' };
      case 'Supplier':
        return { icon: Building2, label: 'Supplier', color: 'text-purple-600 dark:text-purple-400' };
      case 'PurchaseReceipt':
        return { icon: PackageCheck, label: 'Goods Receipt', color: 'text-purple-600 dark:text-purple-400' };
      case 'Product':
        return { icon: Boxes, label: 'Product Item', color: 'text-cyan-600 dark:text-cyan-400' };
      case 'Warehouse':
        return { icon: Warehouse, label: 'Warehouse', color: 'text-cyan-600 dark:text-cyan-400' };
      case 'StockMovement':
        return { icon: ArrowLeftRight, label: 'Stock Movement', color: 'text-cyan-600 dark:text-cyan-400' };
      case 'ProductionBatch':
        return { icon: Layers, label: 'Production Batch', color: 'text-amber-600 dark:text-amber-400' };
      case 'ProductionPlan':
        return { icon: CalendarRange, label: 'Production Plan', color: 'text-amber-600 dark:text-amber-400' };
      case 'BillOfMaterials':
        return { icon: FolderTree, label: 'Bill of Materials', color: 'text-amber-600 dark:text-amber-400' };
      case 'QcInspection':
        return { icon: CheckSquare, label: 'QC Inspection', color: 'text-teal-600 dark:text-teal-400' };
      case 'QcParameter':
        return { icon: CheckSquare, label: 'QC Parameter', color: 'text-teal-600 dark:text-teal-400' };
      case 'WastageRecord':
        return { icon: AlertTriangle, label: 'Wastage Record', color: 'text-amber-600 dark:text-amber-400' };
      case 'User':
        return { icon: UserCheck, label: 'User Account', color: 'text-teal-600 dark:text-teal-400' };
      case 'Role':
        return { icon: Shield, label: 'Role & RBAC', color: 'text-teal-600 dark:text-teal-400' };
      case 'JournalEntry':
        return { icon: DollarSign, label: 'Journal Entry', color: 'text-rose-600 dark:text-rose-400' };
      case 'Asset':
        return { icon: Coins, label: 'Fixed Asset', color: 'text-rose-600 dark:text-rose-400' };
      case 'PaymentReceipt':
        return { icon: Wallet, label: 'Payment Receipt', color: 'text-rose-600 dark:text-rose-400' };
      case 'StorefrontPage':
        return { icon: Globe, label: 'Storefront Page', color: 'text-indigo-600 dark:text-indigo-400' };
      case 'Tenant':
        return { icon: Cpu, label: 'Tenant Master', color: 'text-indigo-600 dark:text-indigo-400' };
      case 'TenantDomain':
        return { icon: Globe, label: 'Tenant Domain', color: 'text-indigo-600 dark:text-indigo-400' };
      case 'SystemSetting':
        return { icon: Sliders, label: 'System Setting', color: 'text-indigo-600 dark:text-indigo-400' };
      default:
        return { icon: Activity, label: clean, color: 'text-muted' };
    }
  };

  const activeCategoryConfig =
    categoriesConfig.find((c) => c.id === selectedDomain) || categoriesConfig[0]!;
  const ActiveCategoryIcon = activeCategoryConfig.icon;
  const currentTabConfig = tabsConfig.find((t) => t.id === activeTab);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAction !== 'all' ||
    selectedType !== 'all' ||
    selectedDomain !== 'all' ||
    startDate !== '' ||
    endDate !== '';

  const handleInspectLog = (log: AuditLogEntry) => {
    setSelectedLog(log);
    void api
      .get<AuditLogEntry>(`/audit-logs/${log.id}`)
      .then((res) => {
        if (res.data) setSelectedLog(res.data);
      })
      .catch(() => {});
  };

  const logColumns: ResponsiveColumn<AuditLogEntry>[] = [
    {
      id: 'entity',
      header: (
        <span className="flex items-center gap-1.5">
          <Layers className="size-3 text-muted" />
          Entity Model
        </span>
      ),
      isPrimary: true,
      priority: 'high',
      accessor: (log) => {
        const entityClean = log.auditable_type
          ? log.auditable_type.split('\\').pop() || log.auditable_type
          : 'System Record';
        const entityMeta = getEntityMeta(log.auditable_type);
        const EntityIcon = entityMeta.icon;
        return (
          <div className="flex items-center gap-1.5 font-medium text-xs text-default">
            <div className={`p-1 rounded-md bg-surface-sunken border border-default ${entityMeta.color}`}>
              <EntityIcon className="size-3.5" />
            </div>
            <span className="font-semibold">{entityClean}</span>
            {log.auditable_id && (
              <span className="text-primary font-mono text-[11px] font-semibold">
                #{log.auditable_id}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'action',
      header: (
        <span className="flex items-center gap-1.5">
          <Activity className="size-3 text-muted" />
          Action
        </span>
      ),
      isStatus: true,
      priority: 'high',
      accessor: (log) => {
        const actionMeta = getActionBadge(log.action);
        const ActionIcon = actionMeta.icon;
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${actionMeta.className}`}
          >
            <ActionIcon className="size-3" />
            <span>{actionMeta.label}</span>
          </span>
        );
      },
    },
    {
      id: 'operator',
      header: (
        <span className="flex items-center gap-1.5">
          <Users className="size-3 text-muted" />
          Operator / Actor
        </span>
      ),
      priority: 'medium',
      accessor: (log) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20 shrink-0">
            {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <span className="font-semibold text-default block text-xs">
              {log.user?.name || (log.user_id ? `User #${log.user_id}` : 'System Administrator')}
            </span>
            {log.user?.email && (
              <span className="text-[10px] text-muted block font-mono">
                {log.user.email}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'timestamp',
      header: (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3 text-muted" />
          Timestamp
        </span>
      ),
      priority: 'medium',
      accessor: (log) => (
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <Clock className="size-3 text-muted shrink-0" />
          <span>{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</span>
        </div>
      ),
    },
    {
      id: 'changes',
      header: (
        <span className="flex items-center gap-1.5">
          <FileEdit className="size-3 text-muted" />
          Field Changes
        </span>
      ),
      priority: 'low',
      accessor: (log) => {
        const act = log.action.toLowerCase();
        const effectiveChanged =
          log.changed_fields && log.changed_fields.length > 0
            ? log.changed_fields
            : log.before && log.after
              ? Object.keys({ ...log.before, ...log.after }).filter(
                  (k) =>
                    JSON.stringify(log.before?.[k]) !==
                    JSON.stringify(log.after?.[k])
                )
              : [];

        if (
          act.includes('create') ||
          act.includes('store') ||
          act.includes('insert')
        ) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              <Sparkles className="size-3" />
              Initial Record Created
            </span>
          );
        }

        if (act.includes('approve') || act.includes('verify')) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
              <CheckCircle2 className="size-3" />
              Status Authorized / Approved
            </span>
          );
        }

        if (
          act.includes('delete') ||
          act.includes('destroy') ||
          act.includes('void')
        ) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
              <Trash2 className="size-3" />
              Record Removed / Voided
            </span>
          );
        }

        if (effectiveChanged.length > 0) {
          return (
            <div className="flex items-center gap-1.5 flex-wrap max-w-md">
              {effectiveChanged.slice(0, 3).map((f) => {
                const beforeVal = log.before?.[f];
                const afterVal = log.after?.[f];
                const hasBoth = beforeVal !== undefined || afterVal !== undefined;
                const humanField = f
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());

                const formatBrief = (val: unknown): string => {
                  if (val === null || val === undefined) return 'none';
                  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                  if (typeof val === 'number') {
                    if (
                      f.includes('price') ||
                      f.includes('amount') ||
                      f.includes('cost') ||
                      f.includes('total')
                    ) {
                      return `৳ ${val.toLocaleString('en-US')}`;
                    }
                    return val.toLocaleString('en-US');
                  }
                  if (typeof val === 'object')
                    return Array.isArray(val) ? `[${val.length}]` : '{...}';
                  const str = String(val);
                  return str.length > 14 ? `${str.slice(0, 12)}...` : str;
                };

                return (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/25"
                    title={`${f}: ${JSON.stringify(beforeVal)} → ${JSON.stringify(afterVal)}`}
                  >
                    <span className="font-semibold text-default">
                      {humanField}:
                    </span>
                    {hasBoth ? (
                      <>
                        <span className="line-through opacity-75 text-rose-600 dark:text-rose-400">
                          {formatBrief(beforeVal)}
                        </span>
                        <span className="text-muted">→</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatBrief(afterVal)}
                        </span>
                      </>
                    ) : (
                      <span>modified</span>
                    )}
                  </span>
                );
              })}
              {effectiveChanged.length > 3 && (
                <span className="text-[10px] text-muted font-mono bg-surface-sunken px-1.5 py-0.5 rounded border border-default">
                  +{effectiveChanged.length - 3} more
                </span>
              )}
            </div>
          );
        }

        return <span className="text-[11px] text-muted italic">No state changes</span>;
      },
    },
    {
      id: 'actions',
      header: (
        <span className="flex items-center gap-1.5 justify-end">
          <Eye className="size-3 text-muted" />
          Version Inspection
        </span>
      ),
      priority: 'high',
      isAction: true,
      align: 'right',
      accessor: (log) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleInspectLog(log)}
          className="text-[11px] h-7 px-2.5 shadow-2xs hover:border-primary/40 touch-target"
        >
          <Eye className="size-3 mr-1 text-primary" />
          <span>View Version Diff</span>
        </Button>
      ),
    },
  ];

  const getMobileActions = (log: AuditLogEntry): ActionSheetItem[] => [
    {
      label: 'View Version Diff',
      icon: Eye,
      onClick: () => handleInspectLog(log),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Workspace Header Surface */}
      <div className="bg-surface border border-default rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldCheck className="size-3" />
                Tamper-Proof Audit Vault
              </span>
              <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
                System & Intelligence
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-medium text-muted flex items-center gap-1">
                <ActiveCategoryIcon className="size-3 text-muted" />
                {activeCategoryConfig.label}
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-semibold text-default">
                {currentTabConfig?.shortLabel || currentTabConfig?.label || 'All Actions'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
              <div className="size-10 rounded-xl bg-linear-to-br from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                <History className="size-5" />
              </div>
              <span>Activity Log & Version Audit Trail</span>
            </h1>
            <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
              Complete historical timeline of all records created, updated, and deleted across SliceMart ERP.
              Inspect exact <strong>before-and-after visual field diffs</strong> and author tracking with full compliance.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Events */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-indigo-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Total Logged Events
            </span>
            <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <History className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">
            {meta.total.toLocaleString()}
          </div>
          <span className="text-[11px] text-muted block">Recorded in system</span>
        </div>

        {/* Card 2: New Record Creates */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              New Records Created
            </span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <PlusCircle className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {createsCount}
          </div>
          <span className="text-[11px] text-muted block">Newly added entries</span>
        </div>

        {/* Card 3: Edit / Update Diffs */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Field Edits & Changes
            </span>
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <FileEdit className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {updatesCount}
          </div>
          <span className="text-[11px] text-muted block">Record mutations with diffs</span>
        </div>

        {/* Card 4: Approvals & Status */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-blue-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Approvals & Status
            </span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {approvesCount}
          </div>
          <span className="text-[11px] text-muted block">Authorized & approved</span>
        </div>

        {/* Card 5: Deletes / Voids */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-rose-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Deletions & Voids
            </span>
            <div className="size-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <Trash2 className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {deletesCount}
          </div>
          <span className="text-[11px] text-muted block">Removed or voided items</span>
        </div>
      </div>

      {/* Standard 2-Tier Workspace Navigation Hub */}
      <WorkspaceNavigationHub
        categories={categoriesConfig}
        tabs={tabsConfig}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        taglineRightContent={
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Showing</span>
            <strong className="text-default font-mono">{displayedLogs.length}</strong>
            <span>of {meta.total} records</span>
          </div>
        }
      />

      {/* Search & Date Filter Bar */}
      <form
        onSubmit={handleApplyFilter}
        className="rounded-2xl border border-default bg-surface p-4 space-y-3 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by action, user, entity, or correlation ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-8 py-2 text-xs text-default placeholder-muted focus:border-primary focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 rounded-full bg-surface-sunken hover:bg-surface text-muted hover:text-default flex items-center justify-center transition-colors"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted mr-1 hidden sm:inline">Timeframe:</span>
            <button
              type="button"
              onClick={() => handleDatePreset('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                datePreset === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('today')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                datePreset === 'today'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('7days')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                datePreset === '7days'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('30days')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                datePreset === '30days'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Specific Dropdowns and Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action Type Dropdown */}
            <div className="w-36">
              <SelectDropdown
                options={[
                  { value: 'all', label: 'All Actions' },
                  { value: 'create', label: 'CREATE', colorDot: 'bg-emerald-500' },
                  { value: 'update', label: 'UPDATE', colorDot: 'bg-amber-500' },
                  { value: 'approve', label: 'APPROVE', colorDot: 'bg-blue-500' },
                  { value: 'delete', label: 'DELETE', colorDot: 'bg-rose-500' },
                ]}
                value={selectedAction}
                onChange={(val) => {
                  setSelectedAction(val);
                  setPage(1);
                }}
                size="sm"
                buttonClassName="w-full text-xs"
                aria-label="Filter logs by action"
              />
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-1 bg-surface-sunken border border-default rounded-xl px-2 py-1">
              <Calendar className="size-3 text-muted shrink-0" />
              <input
                type="date"
                title="Start date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="bg-transparent text-xs text-default focus:outline-none w-28"
              />
              <span className="text-muted text-[10px]">to</span>
              <input
                type="date"
                title="End date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="bg-transparent text-xs text-default focus:outline-none w-28"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" className="text-xs h-8 px-3">
              <Filter className="size-3 mr-1" />
              <span>Filter</span>
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilter}
                className="text-xs h-8 px-2.5 text-muted hover:text-default"
                title="Reset all filters"
              >
                <RotateCcw className="size-3 mr-1" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-2 border-t border-default/60 flex-wrap text-xs">
            <span className="text-muted text-[11px] font-medium">Active Filters:</span>
            {selectedDomain !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <ActiveCategoryIcon className="size-3" />
                {activeCategoryConfig.label}
              </span>
            )}
            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Type: {selectedType}
              </span>
            )}
            {selectedAction !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Action: {selectedAction.toUpperCase()}
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] text-default border border-default">
                Query: &quot;{searchQuery}&quot;
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] text-default border border-default font-mono">
                {startDate || 'Any'} → {endDate || 'Now'}
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilter}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline ml-1 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </form>

      {/* Activity Table */}
      <div className="space-y-3">
        <ResponsiveDataTable<AuditLogEntry>
          data={displayedLogs}
          columns={logColumns}
          keyExtractor={(log) => log.id}
          loading={loading}
          emptyMessage="No recorded events match your current search, domain, or timeframe filters."
          emptyIcon={History}
          mobileActions={getMobileActions}
        />

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-default bg-surface-sunken text-xs">
          <span className="text-muted">
            Showing Page <strong className="text-default">{meta.current_page}</strong> of{' '}
            <strong className="text-default">{meta.last_page}</strong> ({meta.total} total items)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
              className="text-xs h-7 px-2.5"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              <span>Previous</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
              className="text-xs h-7 px-2.5"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Version Diff Modal */}
      {selectedLog && (
        <VersionDiffModal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          log={selectedLog}
        />
      )}
    </div>
  );
};
