import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Download,
  Filter,
  Bookmark,
  Clock,
  Calendar,
  Layers,
  Printer,
  Search,
  Factory,
  Boxes,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Users,
  Target,
  Truck,
  UserCheck,
  DollarSign,
  Cpu,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  Building2,
  Coins,
  ChevronRight,
  Star,
  History,
  BarChart3,
  SlidersHorizontal,
  Compass,
  Check,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { PrintPreviewModal } from '../../components/print/PrintPreviewModal';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { ReportPrintDocument } from '../../components/print/reports/ReportPrintDocument';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import type {
  ReportDefinition,
  ReportDataResponse,
  ReportSavedView,
  ExportFormat,
} from '../../types/api/reports';
import { useCurrency } from '../../hooks/useCurrency';
import {
  ALL_REPORT_DEFINITIONS,
  getReportFallbackData,
} from './reportCatalogue';
import {
  DOMAIN_HUBS,
  findDomainForReportCode,
  type DomainHub,
} from './reportHubs';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/utils';
import { api, getAccessToken } from '../../lib/api/client';
import * as XLSX from 'xlsx';
import { notify } from '../../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import {
  getLocalizedReportName,
  getLocalizedReportDesc,
} from './reportLocalization';

const ReportChartAnalytics = React.lazy(() =>
  import('./components/ReportChartAnalytics').then((m) => ({ default: m.ReportChartAnalytics }))
);

const REPORT_ALIAS_MAP: Record<string, string> = {
  worker_piece_rate_summary: 'worker_production',
  salesman_profitability: 'salesman_profit_contribution',
  daily_sales: 'sales_performance',
  b2c_sales: 'product_sales',
  salesman_leaderboard: 'salesman_sales',
  delivery_sla_history: 'courier_performance',
  converted_leads: 'lead_summary',
  lost_leads_analysis: 'lead_status_distribution',
  // Canonical consolidations
  production_summary: 'production_output',
  best_selling: 'best_selling_products',
  top_selling_products: 'best_selling_products',
  fast_moving_products: 'best_selling_products',
  expiry_aging: 'batch_expiry_aging',
  expired_stock: 'batch_expiry_aging',
  batch_expiry: 'batch_expiry_aging',
  slow_moving: 'slow_moving_stock',
  dead_stock: 'slow_moving_stock',
  non_moving_stock: 'slow_moving_stock',
  supplier_performance: 'supplier_scorecard',
  vendor_performance: 'supplier_scorecard',
  supplier_lead_time: 'supplier_scorecard',
  supplier_otif: 'supplier_scorecard',
  delivery_management: 'delivery_master',
  dispatch_queue: 'delivery_master',
};

export type ReportDomainId =
  | 'operations'
  | 'commercial'
  | 'procurement'
  | 'finance'
  | 'people'
  | 'assets'
  | 'compliance';

const REPORT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  production_output: Factory,
  daily_production: Factory,
  monthly_production: Factory,
  production_yield: Factory,
  batch_expiry_aging: Clock,
  slow_moving_stock: AlertTriangle,
  stock_valuation: Coins,
  current_stock: Boxes,
  low_stock: AlertTriangle,
  stock_ledger: Layers,
  sales_performance: Receipt,
  best_selling_products: Sparkles,
  pos_counter_sales: Receipt,
  b2b_sales: Building2,
  product_profit: TrendingUp,
  lead_summary: Users,
  salesman_quota_achievement: Target,
  purchase_summary: ShoppingBag,
  purchase_details: FileText,
  supplier_scorecard: Award,
  supplier_due: DollarSign,
  delivery_master: Truck,
  courier_performance: Zap,
  cod_reconciliation: Coins,
  income_statement: TrendingUp,
  gl_summary: Layers,
  customer_ar_aging: Clock,
  supplier_ap_aging: DollarSign,
  operating_expenses: Receipt,
  cash_bank_ledger: Building2,
  payroll_summary: DollarSign,
  daily_attendance: UserCheck,
  worker_production: Factory,
  sales_commission_payout: Target,
  employee_directory: Users,
  fixed_asset_register: Cpu,
  asset_valuation_nbv: Coins,
  asset_maintenance_log: Clock,
  assigned_assets: Layers,
  asset_disposal_history: AlertTriangle,
  qc_inspection_ratio: ShieldCheck,
  defect_categorization: AlertTriangle,
  compliance_audit_trail: FileText,
};

export const ReportsWorkspace: React.FC = () => {
  const { i18n } = useTranslation(['reports', 'common']);
  const isBn = i18n.language === 'bn';
  const { formatCurrency } = useCurrency();
  const { config: businessConfig } = useBusinessConfig();

  // Active Report Code
  const [selectedReportCode, setSelectedReportCode] = useState<string>('production_output');

  // Definitions state (backend or fallback catalogue)
  const [definitions, setDefinitions] = useState<ReportDefinition[]>(ALL_REPORT_DEFINITIONS);

  // Quick Jump Popover state
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpSearch, setQuickJumpSearch] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  // Capabilities & Analytics Guide Modal state
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Close Quick Jump popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickJumpRef.current && !quickJumpRef.current.contains(e.target as Node)) {
        setQuickJumpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Pinned Reports (localStorage sync)
  const [pinnedReports, setPinnedReports] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('reports.pinned');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['sales_performance', 'stock_valuation', 'production_output', 'best_selling_products'];
  });

  const togglePinReport = (code: string) => {
    const canonical = REPORT_ALIAS_MAP[code] || code;
    setPinnedReports((prev) => {
      const next = prev.includes(canonical) ? prev.filter((c) => c !== canonical) : [...prev, canonical];
      try {
        localStorage.setItem('reports.pinned', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Recently Viewed Reports (localStorage sync)
  const [recentReports, setRecentReports] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('reports.recent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['production_output'];
  });

  const recordRecentReport = useCallback((canonical: string) => {
    setRecentReports((prev) => {
      const filtered = prev.filter((c) => c !== canonical);
      const next = [canonical, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('reports.recent', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const changeSelectedReport = useCallback(
    (code: string) => {
      const canonical = REPORT_ALIAS_MAP[code] || code;
      setSelectedReportCode(canonical);
      recordRecentReport(canonical);
    },
    [recordRecentReport]
  );

  // Analytics Chart Show/Hide Toggle
  const [showChartAnalytics, setShowChartAnalytics] = useState<boolean>(true);

  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] ?? '';
  });
  const [datePreset, setDatePreset] = useState<string>('this_month');

  // Report runtime state
  const [reportResult, setReportResult] = useState<ReportDataResponse | null>(() =>
    getReportFallbackData('production_output')
  );
  const [loading, setLoading] = useState<boolean>(false);

  // Modals state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const [savedViews, setSavedViews] = useState<ReportSavedView[]>([
    {
      id: 1,
      uuid: 'view-1',
      report_definition_id: 1,
      name: 'Default Live View',
      filters: {},
      columns: [],
      is_default: true,
      created_at: '2026-08-28T10:00:00Z',
    },
    {
      id: 2,
      uuid: 'view-2',
      report_definition_id: 1,
      name: 'Executive Summary View',
      filters: {},
      columns: [],
      is_default: false,
      created_at: '2026-08-28T10:00:00Z',
    },
  ]);
  const [selectedView, setSelectedView] = useState<string>('Default Live View');
  const [saveViewModalOpen, setSaveViewModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  // Try fetching definitions from backend on mount
  useEffect(() => {
    let isMounted = true;
    api
      .get<ReportDefinition[]>('/reports/definitions')
      .then((res: unknown) => {
        if (!isMounted) return;
        const resp = res as { data?: ReportDefinition[] | { data?: ReportDefinition[] } };
        const list = Array.isArray(resp.data)
          ? resp.data
          : Array.isArray((resp.data as { data?: ReportDefinition[] })?.data)
          ? (resp.data as { data?: ReportDefinition[] }).data
          : null;
        if (list && list.length > 0) {
          setDefinitions(list);
        }
      })
      .catch(() => {
        // Fallback already pre-set to ALL_REPORT_DEFINITIONS
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Active Definition
  const activeDef = useMemo(() => {
    return (
      definitions.find((d) => d.code === selectedReportCode) ||
      ALL_REPORT_DEFINITIONS.find((d) => d.code === selectedReportCode) ||
      definitions[0]
    );
  }, [definitions, selectedReportCode]);

  // Active Hub & Domain
  const activeDomain = useMemo<DomainHub>(() => {
    return findDomainForReportCode(selectedReportCode) ?? (DOMAIN_HUBS[0] as DomainHub);
  }, [selectedReportCode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSPACE NAVIGATION HUB CONFIGURATION (Exact 2-Tier Standard ERP Design)
  // ═══════════════════════════════════════════════════════════════════════════

  const categories: WorkspaceCategoryConfig<ReportDomainId, string>[] = useMemo(() => [
    {
      id: 'operations',
      label: isBn ? 'অপারেশনস ও কারখানা' : 'Operations & Inventory',
      tagline: isBn ? 'উৎপাদন আউটপুট, ব্যাচ এক্সপায়ারি, স্লো-মুভিং ও স্টক ভ্যালুয়েশন' : 'Manufacturing output, batch expiry aging, slow-moving stock & inventory ledger',
      shortcut: '1',
      icon: Boxes,
      tabs: [
        'production_output',
        'batch_expiry_aging',
        'slow_moving_stock',
        'stock_valuation',
        'current_stock',
        'low_stock',
        'stock_ledger',
      ],
      defaultTab: 'production_output',
      theme: WORKSPACE_THEMES.indigo,
      badge: '7',
    },
    {
      id: 'commercial',
      label: isBn ? 'বাণিজ্যিক ও বিক্রয়' : 'Commercial & Sales',
      tagline: isBn ? 'চ্যানেল রাজস্ব, সর্বাধিক বিক্রিত পণ্য, পিওএস ও সেলস ফানেল' : 'Omnichannel sales, best-selling SKUs, POS counters & leads pipeline',
      shortcut: '2',
      icon: Receipt,
      tabs: [
        'sales_performance',
        'best_selling_products',
        'pos_counter_sales',
        'b2b_sales',
        'product_profit',
        'lead_summary',
        'salesman_quota_achievement',
      ],
      defaultTab: 'sales_performance',
      theme: WORKSPACE_THEMES.purple,
      badge: '7',
    },
    {
      id: 'procurement',
      label: isBn ? 'ক্রয় ও সরবরাহকারী' : 'Procurement & Delivery',
      tagline: isBn ? 'ক্রয়াদেশ, সরবরাহকারী ওটিআইএফ স্কোরকার্ড, পার্সেল ও ডেলিভারি' : 'Purchase orders, supplier OTIF scorecard, parcel dispatch & delivery SLA',
      shortcut: '3',
      icon: ShoppingBag,
      tabs: [
        'purchase_summary',
        'purchase_details',
        'supplier_scorecard',
        'supplier_due',
        'delivery_master',
        'courier_performance',
        'cod_reconciliation',
      ],
      defaultTab: 'purchase_summary',
      theme: WORKSPACE_THEMES.amber,
      badge: '7',
    },
    {
      id: 'finance',
      label: isBn ? 'অর্থ ও হিসাব' : 'Finance & Ledgers',
      tagline: isBn ? 'লাভ-ক্ষতি বিবরণী, সাধারণ খতিয়ান, বকেয়া বিল ও পরিচালন ব্যয়' : 'P&L income statement, general ledger, AR/AP aging & operating expenditures',
      shortcut: '4',
      icon: DollarSign,
      tabs: [
        'income_statement',
        'gl_summary',
        'customer_ar_aging',
        'supplier_ap_aging',
        'operating_expenses',
        'cash_bank_ledger',
      ],
      defaultTab: 'income_statement',
      theme: WORKSPACE_THEMES.emerald,
      badge: '6',
    },
    {
      id: 'people',
      label: isBn ? 'জনবল ও বেতন' : 'Workforce & HR',
      tagline: isBn ? 'কর্মচারী উপস্থিতি, মজুরি, সেলস কমিশন ও বেতন বণ্টন' : 'Staff attendance, piece-rate wages, salesman commission & payroll payouts',
      shortcut: '5',
      icon: UserCheck,
      tabs: [
        'payroll_summary',
        'daily_attendance',
        'worker_production',
        'sales_commission_payout',
        'employee_directory',
      ],
      defaultTab: 'payroll_summary',
      theme: WORKSPACE_THEMES.rose,
      badge: '5',
    },
    {
      id: 'assets',
      label: isBn ? 'স্থায়ী সম্পদ' : 'Fixed Assets',
      tagline: isBn ? 'সরঞ্জাম রেজিস্টার, অবচয় ও বুক ভ্যালু, অর্পিত সম্পদ ও মেরামত' : 'Equipment register, NBV depreciation, maintenance logs & asset write-offs',
      shortcut: '6',
      icon: Cpu,
      tabs: [
        'fixed_asset_register',
        'asset_valuation_nbv',
        'asset_maintenance_log',
        'assigned_assets',
        'asset_disposal_history',
      ],
      defaultTab: 'fixed_asset_register',
      theme: WORKSPACE_THEMES.teal,
      badge: '5',
    },
    {
      id: 'compliance',
      label: isBn ? 'কোয়ালিটি ও অডিট' : 'Quality & Audit',
      tagline: isBn ? 'মান নিয়ন্ত্রণ পরিদর্শন, ত্রুটি বিশ্লেষণ ও সিস্টেম অডিট ট্রেইল' : 'QC AQL inspection pass ratios, defect categories & immutable audit trails',
      shortcut: '7',
      icon: ShieldCheck,
      tabs: [
        'qc_inspection_ratio',
        'defect_categorization',
        'compliance_audit_trail',
      ],
      defaultTab: 'qc_inspection_ratio',
      theme: WORKSPACE_THEMES.cyan,
      badge: '3',
    },
  ], [isBn]);

  // Tab configurations matching canonical reports
  const tabs: WorkspaceTabConfig<ReportDomainId, string>[] = useMemo(() => {
    const list: WorkspaceTabConfig<ReportDomainId, string>[] = [];

    for (const cat of categories) {
      for (const tabCode of cat.tabs) {
        const def = definitions.find((d) => d.code === tabCode) || ALL_REPORT_DEFINITIONS.find((d) => d.code === tabCode);
        const IconComponent = REPORT_ICON_MAP[tabCode] || cat.icon || FileText;
        const localizedName = def ? getLocalizedReportName(def.code, def.name, isBn) : tabCode;
        const localizedDesc = def ? getLocalizedReportDesc(def.code, def.description ?? '', isBn) : '';
        const tierBadge = def?.tier === 'live' ? (isBn ? 'লাইভ' : 'Live') : def?.tier === 'daily' ? (isBn ? 'দৈনিক' : 'Daily') : (isBn ? 'ঘণ্টা' : 'Hourly');

        list.push({
          id: tabCode,
          label: localizedName,
          shortLabel: localizedName.split(' ')[0] ?? localizedName,
          category: cat.id,
          badge: tierBadge,
          icon: IconComponent,
          description: localizedDesc,
        });
      }
    }
    return list;
  }, [categories, definitions, isBn]);

  // Helper to safely unwrap any report API response structure
  const unwrapReportData = useCallback(
    (raw: unknown, code: string): ReportDataResponse => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        if ('columns' in obj && obj.columns && 'data' in obj && Array.isArray(obj.data)) {
          return obj as unknown as ReportDataResponse;
        }
        if (
          'data' in obj &&
          typeof obj.data === 'object' &&
          obj.data !== null &&
          'columns' in obj.data &&
          'data' in obj.data &&
          Array.isArray((obj.data as Record<string, unknown>).data)
        ) {
          return obj.data as unknown as ReportDataResponse;
        }
      }
      if (Array.isArray(raw)) {
        const fallback = getReportFallbackData(code, activeDef);
        const columns = fallback.columns;
        return {
          ...fallback,
          columns,
          data: raw as ReportDataResponse['data'],
          pagination: {
            ...fallback.pagination,
            total: raw.length,
          },
        };
      }
      return getReportFallbackData(code, activeDef);
    },
    [activeDef]
  );

  // Fetch report data
  const fetchReportData = useCallback(
    async (code: string) => {
      setLoading(true);
      try {
        const res = await api.get<ReportDataResponse | { data: ReportDataResponse }>(`/reports/${code}/data`, {
          params: {
            start_date: startDate,
            end_date: endDate,
          },
        });
        setReportResult(unwrapReportData(res.data, code));
      } catch (err) {
        console.error('[ReportsWorkspace] Failed to fetch report data for code:', code, err);
        setReportResult(getReportFallbackData(code, activeDef));
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, activeDef, unwrapReportData]
  );

  useEffect(() => {
    let isSubscribed = true;
    const load = async () => {
      try {
        const res = await api.get<ReportDataResponse | { data: ReportDataResponse }>(`/reports/${selectedReportCode}/data`, {
          params: { start_date: startDate, end_date: endDate },
        });
        if (isSubscribed) {
          setReportResult(unwrapReportData(res.data, selectedReportCode));
        }
        api.get(`/reports/${selectedReportCode}/schema`).catch(() => {});
        api.get<{ data: ReportSavedView[] } | ReportSavedView[]>(`/reports/${selectedReportCode}/views`).then((vRes) => {
          if (!isSubscribed) return;
          const views = (vRes.data && typeof vRes.data === 'object' && 'data' in vRes.data)
            ? (vRes.data as { data: ReportSavedView[] }).data
            : (vRes.data as ReportSavedView[]);
          if (Array.isArray(views) && views.length > 0) {
            setSavedViews(views);
          }
        }).catch(() => {});
      } catch (err) {
        console.error('[ReportsWorkspace] Error loading selected report:', selectedReportCode, err);
        if (isSubscribed) {
          setReportResult(getReportFallbackData(selectedReportCode, activeDef));
        }
      }
    };

    load();
    return () => {
      isSubscribed = false;
    };
  }, [selectedReportCode, startDate, endDate, activeDef, unwrapReportData]);

  const handlePresetChange = (presetId: string) => {
    setDatePreset(presetId);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetId === 'today') {
      start = now;
      end = now;
    } else if (presetId === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      end = new Date();
    } else if (presetId === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else if (presetId === 'last_30_days') {
      start = new Date();
      start.setDate(start.getDate() - 30);
      end = new Date();
    }

    setStartDate(start.toISOString().split('T')[0] ?? '');
    setEndDate(end.toISOString().split('T')[0] ?? '');
  };

  const handleSaveCustomView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim() || !activeDef) return;
    setSavingView(true);
    try {
      const res = await api.post<{ data: ReportSavedView } | ReportSavedView>(`/reports/${activeDef.code}/views`, {
        name: newViewName.trim(),
        filters: {
          start_date: startDate,
          end_date: endDate,
          preset: datePreset,
        },
        columns: Object.keys(reportResult?.columns || {}),
        is_default: false,
      });
      const created = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as { data: ReportSavedView }).data
        : (res.data as ReportSavedView);
      if (created) {
        setSavedViews((prev) => [...prev, created]);
        setSelectedView(created.name);
        notify.success('View preset saved successfully');
        setSaveViewModalOpen(false);
        setNewViewName('');
      }
    } catch {
      notify.error('Failed to save view preset');
    } finally {
      setSavingView(false);
    }
  };

  const exportClientSpreadsheet = (fmt: ExportFormat) => {
    if (!reportResult || !activeDef) return;
    const filenameBase = `${activeDef.code}_${new Date().toISOString().split('T')[0]}`;
    const worksheet = XLSX.utils.json_to_sheet(reportResult.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ReportData');

    if (fmt === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenameBase}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
    }

    setExportStatus(`Export completed! ${reportResult.data.length} rows downloaded as ${fmt.toUpperCase()}.`);
    notify.success(`Report exported to ${fmt.toUpperCase()} successfully.`);
  };

  const handleExportSubmit = async () => {
    if (!reportResult || !activeDef) return;
    setExportStatus('Generating report export...');
    const filenameBase = `${activeDef.code}_${new Date().toISOString().split('T')[0]}`;

    try {
      type ReportExportPayload = {
        download_url?: string;
        uuid?: string;
        row_count?: number;
        file_size_bytes?: number;
      };

      const resp = await api.post<{ data: ReportExportPayload } | ReportExportPayload>(`/reports/${activeDef.code}/export`, {
        format: exportFormat,
        filters: {
          date_from: startDate,
          date_to: endDate,
        },
      });

      const expData = (resp.data && typeof resp.data === 'object' && 'data' in resp.data)
        ? (resp.data as { data: ReportExportPayload }).data
        : (resp.data as ReportExportPayload | undefined);

      if (expData?.download_url || expData?.uuid) {
        if (expData.uuid) {
          api.get(`/reports/exports/${expData.uuid}`).catch(() => {});
          api.get(`/reports/exports/${expData.uuid}/download`).catch(() => {});
        }
        const relUrl = expData.download_url || `/reports/exports/${expData.uuid}/download`;
        const token = getAccessToken();
        const downloadUrl = `/api/v1${relUrl}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

        try {
          const res = await fetch(downloadUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error(`Download HTTP error ${res.status}`);
          const blobData = await res.blob();

          if (exportFormat === 'xlsx') {
            const csvText = await blobData.text();
            const wb = XLSX.read(csvText, { type: 'string' });
            XLSX.writeFile(wb, `${filenameBase}.xlsx`);
          } else {
            const url = URL.createObjectURL(blobData);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filenameBase}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }

          setExportStatus(
            `Export completed! ${expData.row_count || reportResult.data.length} rows (${Math.max(1, Math.round((expData.file_size_bytes || 2048) / 1024))} KB) downloaded as ${exportFormat.toUpperCase()}.`
          );
          notify.success(`Export ready: ${expData.row_count || reportResult.data.length} rows downloaded.`);
          return;
        } catch {
          exportClientSpreadsheet(exportFormat);
          return;
        }
      }
    } catch {
      // Graceful local fallback if network or endpoint fails
    }

    try {
      exportClientSpreadsheet(exportFormat);
    } catch {
      setExportStatus('Export failed. Please try again.');
      notify.error('Failed to export report.');
    }
  };

  const renderBadge = (val: unknown) => {
    const s = String(val).toLowerCase();
    let tone = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

    if (['completed', 'posted', 'paid', 'delivered', 'valid', 'passed', 'in_stock', 'operational', 'active'].includes(s)) {
      tone = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else if (['in_progress', 'partially_paid', 'in_transit', 'open', 'qualified', 'pending'].includes(s)) {
      tone = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    } else if (['fake', 'lost', 'failed', 'damaged', 'overdue', 'cancelled', 'expired', 'critical'].includes(s)) {
      tone = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    } else if (['pos', 'storefront', 'b2b', 'pathao', 'steadfast'].includes(s)) {
      tone = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider ${tone}`}>
        {String(val)}
      </span>
    );
  };

  // Filtered reports for Quick Jump popover
  const filteredQuickJumpReports = useMemo(() => {
    if (!quickJumpSearch.trim()) return definitions;
    const q = quickJumpSearch.toLowerCase();
    return definitions.filter((d) => {
      const enName = d.name.toLowerCase();
      const bnName = getLocalizedReportName(d.code, d.name, true).toLowerCase();
      return enName.includes(q) || bnName.includes(q) || d.code.toLowerCase().includes(q);
    });
  }, [definitions, quickJumpSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Page Header with Title & ERP Quick Actions Toolbar ───────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <FileText className="size-6" />
            </div>
            {isBn ? 'ব্যবসা প্রতিবেদন ও অ্যানালিটিক্স' : 'Business Reports & Analytics'}
          </h1>
          <p className="text-xs text-muted mt-1">
            {isBn
              ? 'এন্টারপ্রাইজ অপারেশনাল টেলিমেট্রি, অডিট লগ ও ব্যবসায়িক বুদ্ধিমত্তা'
              : 'Enterprise operational telemetry, audit logs & business intelligence'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Jump Search Popover */}
          <div className="relative shrink-0" ref={quickJumpRef}>
            <button
              type="button"
              onClick={() => {
                setQuickJumpOpen(!quickJumpOpen);
                setQuickJumpSearch('');
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer',
                quickJumpOpen && 'border-primary/40 bg-surface-sunken ring-2 ring-primary/20'
              )}
              title={isBn ? 'সকল প্রতিবেদন খুঁজুন' : 'Search all reports'}
            >
              <SlidersHorizontal className="size-3.5 text-muted" />
              <span>{isBn ? 'সকল প্রতিবেদন' : 'All Reports'}</span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-88 rounded-2xl bg-surface border border-default shadow-2xl z-50 p-2.5 text-default animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder={isBn ? 'প্রতিবেদন খুঁজুন…' : 'Search reports by name or SKU...'}
                    value={quickJumpSearch}
                    onChange={(e) => setQuickJumpSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-sunken border border-default rounded-xl outline-hidden focus:border-primary text-default placeholder:text-muted"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {categories.map((cat) => {
                    const catReports = filteredQuickJumpReports.filter((r) => cat.tabs.includes(r.code));
                    if (catReports.length === 0) return null;
                    return (
                      <div key={cat.id} className="pt-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted font-mono flex items-center justify-between">
                          <span>{cat.label}</span>
                          <span className="text-[9px] bg-surface-sunken px-1.5 py-0.5 rounded border border-default font-normal">
                            {catReports.length}
                          </span>
                        </div>
                        {catReports.map((r) => {
                          const Icon = REPORT_ICON_MAP[r.code] || cat.icon || FileText;
                          const isCurrent = selectedReportCode === r.code;
                          return (
                            <button
                              key={r.code}
                              type="button"
                              onClick={() => {
                                changeSelectedReport(r.code);
                                setQuickJumpOpen(false);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left',
                                isCurrent
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-default hover:bg-surface-sunken'
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="size-3.5 shrink-0 text-muted" />
                                <span className="truncate">{getLocalizedReportName(r.code, r.name, isBn)}</span>
                              </div>
                              {isCurrent && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {filteredQuickJumpReports.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted">
                      {isBn ? 'কোনো প্রতিবেদন পাওয়া যায়নি' : 'No matching reports found'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Capabilities Guide Modal Button */}
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={isBn ? 'বিশ্লেষণ নির্দেশিকা' : 'Analytics Capabilities Guide'}
          >
            <Compass className="size-3.5 text-muted" />
            <span>{isBn ? 'নির্দেশিকা' : 'Guide'}</span>
          </button>

          {/* Print Report Button */}
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
            title={isBn ? 'মুদ্রণ পূর্বরূপ' : 'Print Report'}
          >
            <Printer className="size-3.5 text-muted" />
            <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
          </button>

          {/* Export Dataset Button */}
          <button
            type="button"
            onClick={() => {
              setExportStatus(null);
              setExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white transition-all shadow-2xs cursor-pointer"
            title={isBn ? 'ডাটা এক্সপোর্ট করুন' : 'Export Dataset'}
          >
            <Download className="size-3.5" />
            <span>{isBn ? 'এক্সপোর্ট' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Pinned & Favorites Quick-Bar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-2.5 rounded-2xl border border-default shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
            <Star className="size-3.5 fill-amber-500 text-amber-500" />
            <span>{isBn ? 'পিনকৃত:' : 'Pinned:'}</span>
          </div>
          {pinnedReports.length === 0 ? (
            <span className="text-[11px] text-muted italic">
              {isBn ? 'কোনো প্রতিবেদন পিন করা নেই' : 'No pinned reports yet'}
            </span>
          ) : (
            pinnedReports.map((pCode) => {
              const pDef = definitions.find((d) => d.code === pCode) || ALL_REPORT_DEFINITIONS.find((d) => d.code === pCode);
              const isCurrent = selectedReportCode === pCode;
              return (
                <div
                  key={pCode}
                  className={cn(
                    'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
                    isCurrent
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'bg-surface-sunken text-default border border-default hover:border-primary/40'
                  )}
                >
                  <button type="button" onClick={() => changeSelectedReport(pCode)} className="cursor-pointer">
                    {pDef ? getLocalizedReportName(pDef.code, pDef.name, isBn) : pCode}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinReport(pCode);
                    }}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-rose-500 cursor-pointer"
                    title="Unpin"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {recentReports.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-muted font-medium text-[10.5px] whitespace-nowrap">
              <History className="size-3.5" />
              <span>{isBn ? 'সাম্প্রতিক:' : 'Recent:'}</span>
            </div>
            {recentReports.slice(0, 5).map((rCode) => {
              const rDef = definitions.find((d) => d.code === rCode) || ALL_REPORT_DEFINITIONS.find((d) => d.code === rCode);
              const isCurrent = selectedReportCode === rCode;
              if (!rDef) return null;
              return (
                <button
                  key={rCode}
                  type="button"
                  onClick={() => changeSelectedReport(rCode)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap cursor-pointer',
                    isCurrent
                      ? 'font-bold text-primary underline decoration-2'
                      : 'text-muted hover:text-default'
                  )}
                >
                  {getLocalizedReportName(rDef.code, rDef.name, isBn)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Universal 2-Tier Navigation Hub (Exact ERP Standard) ───────── */}
      <WorkspaceNavigationHub<ReportDomainId, string>
        categories={categories}
        tabs={tabs}
        activeTab={selectedReportCode}
        onSelectTab={changeSelectedReport}
      />

      {/* ── 4. Main Full-Width Content Canvas ─────────────────────────────── */}
      <div id="report-telemetry-section" className="space-y-4">
        {/* Breadcrumb & Actions Bar */}
        <div className="bg-surface rounded-2xl border border-default shadow-xs px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap min-w-0">
            <span className="font-semibold text-default truncate">
              {isBn ? activeDomain.titleBn : activeDomain.titleEn}
            </span>
            <ChevronRight className="size-3.5 text-muted/60 shrink-0" />
            <span className="font-bold text-primary truncate">
              {getLocalizedReportName(activeDef?.code || '', activeDef?.name ?? '', isBn)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Pin Toggle */}
            <button
              type="button"
              onClick={() => togglePinReport(selectedReportCode)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                pinnedReports.includes(selectedReportCode)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold'
                  : 'bg-surface border-default text-muted hover:text-default hover:bg-surface-sunken'
              )}
            >
              <Star className={cn('size-3.5', pinnedReports.includes(selectedReportCode) ? 'fill-amber-500 text-amber-500' : 'text-muted')} />
              <span>{pinnedReports.includes(selectedReportCode) ? (isBn ? 'পিনকৃত' : 'Pinned') : (isBn ? 'পিন করুন' : 'Pin')}</span>
            </button>

            {/* Hide/Show Chart Toggle */}
            <button
              type="button"
              onClick={() => setShowChartAnalytics((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                showChartAnalytics
                  ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                  : 'bg-surface border-default text-muted hover:text-default hover:bg-surface-sunken'
              )}
            >
              <BarChart3 className="size-3.5" />
              <span>{showChartAnalytics ? (isBn ? 'চার্ট লুকান' : 'Hide Chart') : (isBn ? 'চার্ট দেখুন' : 'Show Chart')}</span>
            </button>

            {/* Freshness Status Pill */}
            {reportResult && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-sunken border border-default text-[11px] text-muted">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                  {reportResult.meta.freshness.tier === 'live' ? (isBn ? 'লাইভ' : 'LIVE') : reportResult.meta.freshness.tier}
                </span>
                <span className="text-muted/60">·</span>
                <span>{new Date(reportResult.meta.freshness.as_of).toLocaleTimeString(isBn ? 'bn-BD' : 'en-US')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Date Filters & Views Toolbar */}
        <div className="bg-surface rounded-2xl border border-default shadow-xs px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Presets */}
            <div className="flex items-center gap-0.5 bg-surface-sunken p-1 rounded-xl text-xs border border-default">
              {[
                { id: 'today', label: isBn ? 'আজ' : 'Today' },
                { id: 'this_week', label: isBn ? 'এই সপ্তাহ' : 'This Week' },
                { id: 'this_month', label: isBn ? 'এই মাস' : 'This Month' },
                { id: 'last_30_days', label: isBn ? '৩০ দিন' : '30 Days' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap',
                    datePreset === p.id
                      ? 'bg-surface text-primary font-bold shadow-xs border border-default'
                      : 'text-muted hover:text-default'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-muted shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="text-xs border border-default bg-surface rounded-xl px-2.5 py-1.5 text-default focus:outline-none focus:border-primary shadow-2xs"
              />
              <span className="text-xs text-muted">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="text-xs border border-default bg-surface rounded-xl px-2.5 py-1.5 text-default focus:outline-none focus:border-primary shadow-2xs"
              />
            </div>

            {/* Saved Views Dropdown */}
            <div className="flex items-center gap-2">
              <SelectDropdown
                icon={Bookmark}
                options={savedViews.map((v) => ({ value: v.name, label: v.name }))}
                value={selectedView}
                onChange={(val) => {
                  setSelectedView(val);
                  const matched = savedViews.find((v) => v.name === val);
                  if (matched?.filters) {
                    if (typeof matched.filters.start_date === 'string') setStartDate(matched.filters.start_date);
                    if (typeof matched.filters.end_date === 'string') setEndDate(matched.filters.end_date);
                    if (typeof matched.filters.preset === 'string') setDatePreset(matched.filters.preset);
                  }
                }}
                size="sm"
                aria-label="Select saved report view"
              />
              <button
                type="button"
                onClick={() => setSaveViewModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-default hover:bg-surface-sunken text-xs font-semibold rounded-xl transition-colors cursor-pointer text-default shadow-2xs"
              >
                <Bookmark className="size-3.5 text-primary" />
                <span>{isBn ? 'সংরক্ষণ' : 'Save View'}</span>
              </button>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => fetchReportData(selectedReportCode)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ml-auto"
            >
              <Filter className="size-3.5" />
              <span>{loading ? (isBn ? 'প্রসেস হচ্ছে…' : 'Executing...') : (isBn ? 'ফিল্টার প্রয়োগ' : 'Apply')}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Summary Metric KPI Cards */}
        {reportResult?.summary && Object.keys(reportResult.summary).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {Object.entries(reportResult.summary).map(([key, value]) => {
              const formattedKey = key.replace(/_/g, ' ');
              const isMoney =
                key.includes('bdt') ||
                key.includes('valuation') ||
                key.includes('amount') ||
                key.includes('revenue') ||
                key.includes('profit') ||
                key.includes('cost') ||
                key.includes('incentive') ||
                key.includes('cod') ||
                key.includes('debit') ||
                key.includes('credit') ||
                key.includes('spend') ||
                key.includes('value');
              const numVal = parseFloat(String(value).replace(/,/g, ''));
              const displayVal = isMoney && !isNaN(numVal) ? formatCurrency(numVal) : String(value);

              return (
                <div key={key} className="bg-surface p-3.5 rounded-2xl border border-default shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="size-3 text-primary shrink-0" />
                    <span className="truncate">{formattedKey}</span>
                  </span>
                  <p className="text-base sm:text-lg font-bold text-default mt-1.5 tracking-tight truncate">{displayVal}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Analytics Chart Panel */}
        {showChartAnalytics && (
          <React.Suspense
            fallback={
              <div className="h-64 flex items-center justify-center bg-surface rounded-2xl border border-default text-muted text-xs">
                {isBn ? 'চার্ট লোড হচ্ছে…' : 'Loading chart analytics...'}
              </div>
            }
          >
            <ReportChartAnalytics
              reportResult={reportResult}
              reportDefinition={activeDef}
              currencySymbol="৳"
              isBn={isBn}
            />
          </React.Suspense>
        )}

        {/* Data Table */}
        <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-default">
                {getLocalizedReportName(activeDef?.code || '', activeDef?.name ?? 'Report Data', isBn)}
              </h2>
            </div>
            <span className="text-xs text-muted">
              {isBn ? 'মোট সারি:' : 'Showing'} <strong className="text-default font-semibold">{reportResult?.data?.length ?? 0}</strong> {isBn ? 'টি' : 'of'}{' '}
              {reportResult?.pagination?.total ?? reportResult?.data?.length ?? 0} {isBn ? 'রেকর্ড' : 'rows'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-sunken text-muted font-bold uppercase tracking-wider border-b border-default">
                <tr>
                  {Object.entries(reportResult?.columns || {}).map(([key, col]) => (
                    <th key={key} className="px-4 py-2.5 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {loading ? (
                  <tr>
                    <td colSpan={Math.max(1, Object.keys(reportResult?.columns || {}).length)} className="py-12 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>{isBn ? 'প্রতিবেদন প্রস্তুত হচ্ছে…' : 'Generating report dataset...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : !reportResult?.data || reportResult.data.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, Object.keys(reportResult?.columns || {}).length)} className="py-12 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="size-8 text-muted/40" />
                        <span className="font-semibold text-default">{isBn ? 'কোনো রেকর্ড পাওয়া যায়নি' : 'No Data Records Found'}</span>
                        <span className="text-[11px] text-muted max-w-sm">
                          {isBn ? 'নির্বাচিত ফিল্টার বা তারিখ সীমার মধ্যে কোনো তথ্য বিদ্যমান নেই।' : 'No operational records match the current filter criteria or date range.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportResult.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-sunken transition-colors">
                      {Object.entries(reportResult.columns).map(([colKey, colDef]) => {
                        const val = row[colKey];
                        let rendered: React.ReactNode = String(val ?? '-');

                        if (colDef.type === 'currency' && typeof val === 'number') {
                          rendered = <span className="font-mono font-medium text-default">{formatCurrency(val)}</span>;
                        } else if (colDef.type === 'badge' && val !== null && val !== undefined) {
                          rendered = renderBadge(val);
                        } else if (colDef.type === 'date' && typeof val === 'string' && val.length >= 10) {
                          rendered = <span className="text-muted font-mono">{val.substring(0, 10)}</span>;
                        } else if (colDef.type === 'number' && typeof val === 'number') {
                          rendered = <span className="font-mono text-default">{val.toLocaleString()}</span>;
                        }

                        return (
                          <td key={colKey} className="px-4 py-2.5 whitespace-nowrap text-default">
                            {rendered}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {reportResult?.pagination && (
            <div className="px-4 py-3 border-t border-default flex items-center justify-between text-xs text-muted">
              <span>
                {isBn ? 'পৃষ্ঠা' : 'Page'}{' '}
                <strong className="text-default font-semibold">{reportResult.pagination.current_page}</strong>{' '}
                {isBn ? 'এর মধ্যে' : 'of'}{' '}
                <strong className="text-default font-semibold">{reportResult.pagination.last_page}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={reportResult.pagination.current_page <= 1}
                  className="px-2.5 py-1 border border-default rounded-lg hover:bg-surface-sunken disabled:opacity-40 cursor-pointer"
                >
                  {isBn ? 'পূর্ববর্তী' : 'Prev'}
                </button>
                <button
                  disabled={reportResult.pagination.current_page >= reportResult.pagination.last_page}
                  className="px-2.5 py-1 border border-default rounded-lg hover:bg-surface-sunken disabled:opacity-40 cursor-pointer"
                >
                  {isBn ? 'পরবর্তী' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Capabilities & Analytics Guide Modal ───────────────────────── */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={isBn ? 'প্রতিবেদন ও বিশ্লেষণ ডিরেক্টরি' : 'Reports & Analytics Capabilities Guide'}
        size="xl"
      >
        <div className="space-y-5 p-1 text-default">
          <p className="text-xs text-muted leading-relaxed">
            {isBn
              ? 'SliceMart এন্টারপ্রাইজ রিপোর্টিং ইঞ্জিন বিভিন্ন অপারেশনাল ডোমেনে সুনির্দিষ্ট ও নির্ভরযোগ্য সিদ্ধান্ত গ্রহণের জন্য তৈরি। নিচের যেকোনো প্রতিবেদন সরাসরি দেখতে নির্বাচন করুন।'
              : 'The SliceMart Enterprise Reporting engine provides operational telemetry and decision-ready intelligence across 7 core business domains. Click any report below to jump straight to its live dataset.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto pr-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isCurrent = selectedReportCode === tab.id;
              const parentCat = categories.find((c) => c.id === tab.category);

              return (
                <div
                  key={tab.id}
                  className={cn(
                    'p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between',
                    isCurrent
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-default bg-surface hover:bg-surface-sunken'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-surface-sunken border border-default flex items-center justify-center text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-default">{tab.label}</h4>
                          <span className="text-[10px] text-muted font-mono">{tab.id}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {tab.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted mt-1 leading-relaxed">{tab.description}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-default flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {parentCat?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        changeSelectedReport(tab.id);
                        setIsGuideOpen(false);
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                        isCurrent
                          ? 'bg-primary text-white'
                          : 'bg-surface-sunken text-default hover:bg-primary hover:text-white border border-default'
                      )}
                    >
                      {isCurrent ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'প্রতিবেদন দেখুন' : 'Open Report')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ── 6. Print Preview Modal ────────────────────────────────────────── */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`${activeDef ? getLocalizedReportName(activeDef.code, activeDef.name, isBn) : 'Report'} (${startDate} - ${endDate})`}
      >
        <ReportPrintDocument
          businessConfig={businessConfig}
          reportTitle={activeDef ? getLocalizedReportName(activeDef.code, activeDef.name, isBn) : 'Business Report'}
          periodText={`Domain: ${activeDomain.titleEn} | Range: ${startDate} to ${endDate}`}
          columns={Object.entries(reportResult?.columns || {}).map(([key, col]) => ({
            key,
            label: col.label,
            type: (col.type === 'currency'
              ? 'currency'
              : col.type === 'date'
              ? 'date'
              : col.type === 'badge'
              ? 'badge'
              : col.type === 'number'
              ? 'numeric'
              : 'text') as 'text' | 'numeric' | 'currency' | 'date' | 'badge' | 'percentage',
          }))}
          data={reportResult?.data || []}
          summaryCards={
            reportResult?.summary
              ? Object.entries(reportResult.summary).map(([k, v]) => ({
                  label: k.replace(/_/g, ' '),
                  value: String(v),
                }))
              : undefined
          }
        />
      </PrintPreviewModal>

      {/* ── 7. Export Dataset Modal ───────────────────────────────────────── */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="bg-surface rounded-2xl border border-default shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <h3 className="font-bold text-sm text-default flex items-center gap-2">
                <Download className="size-4 text-primary" />
                <span>{isBn ? 'প্রতিবেদন এক্সপোর্ট করুন' : 'Export Report Dataset'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1.5">{isBn ? 'ফরম্যাট' : 'Format'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['xlsx', 'csv'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={cn(
                        'py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center',
                        exportFormat === fmt
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                          : 'border-default bg-surface hover:bg-surface-sunken text-default'
                      )}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {exportStatus && (
                <div className="p-3 bg-surface-sunken rounded-xl border border-default text-xs text-default">
                  {exportStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-3.5 py-1.5 border border-default rounded-xl text-xs font-semibold hover:bg-surface-sunken text-default cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExportSubmit}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {isBn ? 'ডাউনলোড' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. Save Custom View Modal ─────────────────────────────────────── */}
      {saveViewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <form onSubmit={handleSaveCustomView} className="bg-surface rounded-2xl border border-default shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <h3 className="font-bold text-sm text-default flex items-center gap-2">
                <Bookmark className="size-4 text-primary" />
                <span>{isBn ? 'ভিউ প্রিসেট সংরক্ষণ' : 'Save Custom View'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSaveViewModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1">
                {isBn ? 'ভিউ এর নাম' : 'View Preset Name'}
              </label>
              <input
                type="text"
                placeholder={isBn ? 'যেমন: মাসিক অডিট ভিউ' : 'e.g., Monthly Executive Review'}
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 text-xs bg-surface border border-default rounded-xl outline-hidden focus:border-primary text-default placeholder:text-muted"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setSaveViewModalOpen(false)}
                className="px-3.5 py-1.5 border border-default rounded-xl text-xs font-semibold hover:bg-surface-sunken text-default cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={savingView || !newViewName.trim()}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingView ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving...') : (isBn ? 'সংরক্ষণ করুন' : 'Save Preset')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReportsWorkspace;
