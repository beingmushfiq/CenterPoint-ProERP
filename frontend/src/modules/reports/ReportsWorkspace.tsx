import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Filter,
  Bookmark,
  Clock,
  CheckCircle,
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
  LayoutGrid,
  ListOrdered,
  Zap,
  Building2,
  Coins,
} from 'lucide-react';
import { PrintPreviewModal } from '../../components/print/PrintPreviewModal';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { ReportPrintDocument } from '../../components/print/reports/ReportPrintDocument';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import type {
  ReportDefinition,
  ReportCategory,
  ReportDataResponse,
  ReportSavedView,
  ExportFormat,
} from '../../types/api/reports';
import { useCurrency } from '../../hooks/useCurrency';
import {
  REPORT_MODULES,
  ALL_REPORT_DEFINITIONS,
  getReportFallbackData,
} from './reportCatalogue';
import { REPORT_HUBS } from './reportHubs';
import { api, getAccessToken } from '../../lib/api/client';
import * as XLSX from 'xlsx';
import { notify } from '../../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import {
  getLocalizedReportName,
  getLocalizedReportDesc,
  getLocalizedModuleName,
  getLocalizedModuleShortName,
  getLocalizedCategoryLabel,
  getLocalizedPresetLabel,
} from './reportLocalization';

const MODULE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  all: Layers,
  production: Factory,
  inventory: Boxes,
  purchasing: ShoppingBag,
  sales: Receipt,
  pos: Receipt,
  profit: TrendingUp,
  crm: Users,
  salesmen: Target,
  delivery: Truck,
  hr: UserCheck,
  finance: DollarSign,
  assets: Cpu,
  qc: ShieldCheck,
  Zap: Zap,
  Coins: Coins,
  Building2: Building2,
  Clock: Clock,
  Factory: Factory,
  Boxes: Boxes,
  ShoppingBag: ShoppingBag,
  Receipt: Receipt,
  TrendingUp: TrendingUp,
  Users: Users,
  Target: Target,
  Truck: Truck,
  UserCheck: UserCheck,
  DollarSign: DollarSign,
  ShieldCheck: ShieldCheck,
  Layers: Layers,
};

export const ReportsWorkspace: React.FC = () => {
  const { t, i18n } = useTranslation(['reports', 'common']);
  const isBn = i18n.language === 'bn';
  const { formatCurrency } = useCurrency();
  const { config: businessConfig } = useBusinessConfig();

  // Selected Module & Category
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected active report
  const [selectedReportCode, setSelectedReportCode] = useState<string>('production_yield');

  // Display Mode: Consolidated Hubs (Phase 5 & 11) vs Full Directory (84 items)
  const [displayMode, setDisplayMode] = useState<'hubs' | 'directory'>('hubs');

  // Date filters & presets (dynamic current-month initialization)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [datePreset, setDatePreset] = useState<string>('this_month');

  // Definitions state (backend or fallback catalogue)
  const [definitions, setDefinitions] = useState<ReportDefinition[]>(ALL_REPORT_DEFINITIONS);

  // Report runtime state
  const [reportResult, setReportResult] = useState<ReportDataResponse | null>(() =>
    getReportFallbackData('production_yield')
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

  // Categories list
  const categories: Array<{ id: ReportCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All Reports' },
    { id: 'operational', label: 'Operational' },
    { id: 'financial', label: 'Financial' },
    { id: 'analytical', label: 'Analytical' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'executive', label: 'Executive' },
  ];

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

  const MODULE_ORDER = [
    'production',
    'inventory',
    'purchasing',
    'sales',
    'profit',
    'crm',
    'salesmen',
    'delivery',
    'hr',
    'finance',
    'assets',
    'qc',
  ];

  // Filtered definitions based on Module, Category, and Search Query
  const filteredDefinitions = useMemo(() => {
    return definitions
      .filter((def) => {
        // Module filter
        if (selectedModule !== 'all') {
          if (selectedModule === 'sales') {
            if (def.module !== 'sales' && def.module !== 'pos') {
              return false;
            }
          } else if (def.module !== selectedModule) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'all' && def.category !== selectedCategory) {
          return false;
        }

        // Text search (checks code, English name/desc, and Bengali name/desc)
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const bnName = getLocalizedReportName(def.code, '', true).toLowerCase();
          const bnDesc = getLocalizedReportDesc(def.code, '', true).toLowerCase();
          const matchName = def.name.toLowerCase().includes(q) || bnName.includes(q);
          const matchCode = def.code.toLowerCase().includes(q);
          const matchDesc = (def.description ?? '').toLowerCase().includes(q) || bnDesc.includes(q);
          const matchModule = def.module.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchDesc && !matchModule) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (selectedModule === 'all') {
          const aOrder = MODULE_ORDER.indexOf(a.module);
          const bOrder = MODULE_ORDER.indexOf(b.module);
          if (aOrder !== bOrder) {
            return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
          }
        }
        return a.name.localeCompare(b.name);
      });
  }, [definitions, selectedModule, selectedCategory, searchQuery, isBn]);

  // Filtered 20 Consolidated Hubs (Phase 5 & 11) based on Module and Search
  const filteredHubs = useMemo(() => {
    return REPORT_HUBS.filter((hub) => {
      if (selectedModule !== 'all') {
        if (selectedModule === 'sales') {
          if (hub.module !== 'sales' && hub.module !== 'pos') return false;
        } else if (hub.module !== selectedModule) {
          return false;
        }
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = hub.titleEn.toLowerCase().includes(q) || hub.titleBn.toLowerCase().includes(q);
        const matchDesc = hub.descEn.toLowerCase().includes(q) || hub.descBn.toLowerCase().includes(q);
        const matchView = hub.views.some(
          (v) =>
            v.code.toLowerCase().includes(q) ||
            v.labelEn.toLowerCase().includes(q) ||
            v.labelBn.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchDesc && !matchView) return false;
      }

      return true;
    });
  }, [selectedModule, searchQuery]);

  // Module counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: definitions.length };
    for (const def of definitions) {
      counts[def.module] = (counts[def.module] || 0) + 1;
      if (def.module === 'pos') {
        counts['sales'] = (counts['sales'] || 0) + 1;
      }
    }
    return counts;
  }, [definitions]);

  // Active definition
  const activeDef = useMemo(() => {
    return definitions.find((d) => d.code === selectedReportCode) || filteredDefinitions[0] || definitions[0];
  }, [definitions, selectedReportCode, filteredDefinitions]);

  // Active module metadata
  const activeModule = useMemo(() => {
    return REPORT_MODULES.find((m) => m.id === selectedModule) || REPORT_MODULES[0];
  }, [selectedModule]);

  // Module switcher handler
  const handleSelectModule = (modId: string) => {
    setSelectedModule(modId);
    setSelectedCategory('all');
    setSearchQuery('');
    const firstInMod = definitions.find((d) => {
      if (modId === 'all') return true;
      if (modId === 'sales') return d.module === 'sales' || d.module === 'pos';
      return d.module === modId;
    });
    if (firstInMod) {
      setSelectedReportCode(firstInMod.code);
    }
  };

  // Category switcher handler
  const handleSelectCategory = (catId: ReportCategory | 'all') => {
    setSelectedCategory(catId);
    const firstInCat = definitions.find((d) => {
      const matchMod =
        selectedModule === 'all' ||
        (selectedModule === 'sales'
          ? d.module === 'sales' || d.module === 'pos'
          : d.module === selectedModule);
      const matchCat = catId === 'all' || d.category === catId;
      return matchMod && matchCat;
    });
    if (firstInCat) {
      setSelectedReportCode(firstInCat.code);
    }
  };

  // Fetch or resolve report data
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
        const respData = res.data;
        if (respData && 'columns' in respData && respData.columns && respData.data) {
          setReportResult(respData as ReportDataResponse);
        } else if (respData && 'data' in respData && (respData as { data: ReportDataResponse }).data?.columns) {
          setReportResult((respData as { data: ReportDataResponse }).data);
        } else {
          setReportResult(getReportFallbackData(code, activeDef));
        }
      } catch {
        setReportResult(getReportFallbackData(code, activeDef));
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, activeDef]
  );

  useEffect(() => {
    let isSubscribed = true;
    const load = async () => {
      try {
        const res = await api.get<ReportDataResponse | { data: ReportDataResponse }>(`/reports/${selectedReportCode}/data`, {
          params: { start_date: startDate, end_date: endDate },
        });
        if (isSubscribed) {
          const respData = res.data;
          if (respData && 'columns' in respData && respData.columns && respData.data) {
            setReportResult(respData as ReportDataResponse);
          } else if (respData && 'data' in respData && (respData as { data: ReportDataResponse }).data?.columns) {
            setReportResult((respData as { data: ReportDataResponse }).data);
          } else {
            setReportResult(getReportFallbackData(selectedReportCode, activeDef));
          }
        }
        // Also load schema and saved views for this report definition
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
      } catch {
        if (isSubscribed) {
          setReportResult(getReportFallbackData(selectedReportCode, activeDef));
        }
      }
    };

    load();
    return () => {
      isSubscribed = false;
    };
  }, [selectedReportCode, startDate, endDate, activeDef]);

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
        columns: reportResult?.columns ? Object.keys(reportResult.columns) : [],
        is_default: false,
      });
      const created = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as { data: ReportSavedView }).data
        : (res.data as ReportSavedView);
      if (created?.name) {
        setSavedViews((prev) => [...prev, created]);
        setSelectedView(created.name);
      }
      notify.success(`Custom view '${newViewName}' saved successfully.`);
      setSaveViewModalOpen(false);
      setNewViewName('');
    } catch {
      notify.error('Failed to save view preset.');
    } finally {
      setSavingView(false);
    }
  };

  // Handle Preset Date Change
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date): string => {
      const iso = d.toISOString();
      const idx = iso.indexOf('T');
      return idx !== -1 ? iso.substring(0, idx) : iso;
    };

    if (preset === 'today') {
      const d = formatDate(today);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const d = formatDate(y);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'this_week') {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'last_30_days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    }
  };

  // Export handler supporting XLSX, CSV, and PDF
  const handleExport = async () => {
    if (!reportResult || !activeDef) return;

    if (exportFormat === 'pdf') {
      setExportModalOpen(false);
      setExportStatus(null);
      setIsPrintModalOpen(true);
      notify.success('Opening official PDF print preview...');
      return;
    }

    setExportStatus(`Generating ${exportFormat.toUpperCase()} export file...`);

    const brandPrefix = businessConfig?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'ERP';
    const filenameBase = `${brandPrefix}_${activeDef.code || 'report'}_${new Date().toISOString().split('T')[0]}`;

    // Direct spreadsheet generation helper via SheetJS (for instant and fallback downloads)
    const exportClientSpreadsheet = (fmt: 'xlsx' | 'csv' | 'json') => {
      if (fmt === 'json') {
        const jsonBlob = new Blob([JSON.stringify(reportResult.data, null, 2)], {
          type: 'application/json;charset=utf-8;',
        });
        const url = URL.createObjectURL(jsonBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameBase}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setExportStatus(`Export completed! ${reportResult.data.length} rows downloaded as JSON.`);
        notify.success('Report exported to JSON successfully.');
        return;
      }

      const colEntries = Object.entries(reportResult.columns);
      const rows = reportResult.data.map((row) => {
        const rowObj: Record<string, unknown> = {};
        colEntries.forEach(([key, colDef]) => {
          rowObj[colDef.label || key] = row[key] ?? '';
        });
        return rowObj;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, (activeDef.name || 'Report').slice(0, 31));

      if (fmt === 'csv') {
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
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

    try {
      // 1. Request server-side comprehensive batch query
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
          // If server file stream had an issue, smoothly fallback to client spreadsheet generator
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

  // Helper for rendering badges
  const renderBadge = (val: unknown) => {
    const s = String(val).toLowerCase();
    let tone = 'bg-slate-100 text-slate-700';

    if (['completed', 'posted', 'paid', 'delivered', 'valid', 'passed', 'in_stock', 'operational'].includes(s)) {
      tone = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else if (['in_progress', 'partially_paid', 'in_transit', 'open', 'qualified'].includes(s)) {
      tone = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    } else if (['fake', 'lost', 'failed', 'damaged', 'overdue', 'cancelled'].includes(s)) {
      tone = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    } else if (['pos', 'storefront', 'b2b', 'pathao', 'steadfast'].includes(s)) {
      tone = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${tone}`}>
        {String(val)}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
              <FileText className="w-6 h-6" />
            </div>
            {t('reports:title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('reports:subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {t('reports:printReport')}
          </button>
          <button
            onClick={() => {
              setExportStatus(null);
              setExportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {t('reports:exportData')}
          </button>
        </div>
      </div>

      {/* 12-Module Navigation Pills */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {REPORT_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.id] || Layers;
            const isSelected = selectedModule === mod.id;
            const count = moduleCounts[mod.id] || 0;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => handleSelectModule(mod.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{getLocalizedModuleShortName(mod.id, mod.shortName, isBn)}</span>
                {count > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills, Mode Toggle & Search Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: 20 Consolidated Hubs vs 84 Granular Directory */}
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDisplayMode('hubs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                displayMode === 'hubs'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isBn ? 'সমন্বিত হাব (২০)' : 'Consolidated Hubs (20)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('directory')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                displayMode === 'directory'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>{isBn ? 'সকল প্রতিবেদন (৮৪)' : 'Full Directory (84)'}</span>
            </button>
          </div>

          {/* Categories (Directory Mode only) */}
          {displayMode === 'directory' && (
            <div className="flex flex-wrap items-center gap-1.5 ml-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {getLocalizedCategoryLabel(cat.id, cat.label, isBn)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search report by keyword */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              displayMode === 'hubs'
                ? isBn ? 'হাব বা ভিউ খুঁজুন…' : 'Search hubs or views...'
                : isBn ? 'নাম বা কোড দিয়ে খুঁজুন…' : 'Search reports by name, code...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Report Selection Area (Hubs vs Directory) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            {displayMode === 'hubs' ? (
              isBn ? (
                <>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {getLocalizedModuleName(activeModule?.id || 'all', activeModule?.name || 'সকল মডিউল', true)}
                  </span>{' '}
                  মডিউলে <strong className="text-slate-800 dark:text-slate-200">{filteredHubs.length}</strong>টি সমন্বিত অ্যানালিটিক্স হাব
                </>
              ) : (
                <>
                  Showing <strong className="text-slate-800 dark:text-slate-200">{filteredHubs.length}</strong> consolidated hubs in{' '}
                  <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">{activeModule?.name || 'All Modules'}</span>
                </>
              )
            ) : isBn ? (
              <>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {getLocalizedModuleName(activeModule?.id || 'all', activeModule?.name || 'সকল মডিউল', true)}
                </span>{' '}
                বিভাগে <strong className="text-slate-800 dark:text-slate-200">{filteredDefinitions.length}</strong>টি প্রতিবেদন প্রদর্শিত হচ্ছে
              </>
            ) : (
              <>
                Showing <strong className="text-slate-800 dark:text-slate-200">{filteredDefinitions.length}</strong> reports in{' '}
                <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">{activeModule?.name || 'All Modules'}</span>
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400">
            {isBn ? 'প্রতিবেদন দেখতে যেকোনো ভিউ ট্যাবে ক্লিক করুন' : 'Click any sub-view tab to activate query telemetry'}
          </span>
        </div>

        {/* ── MODE 1: 20 Consolidated Hubs with Multi-View Tabs (Phase 5 & 11) ── */}
        {displayMode === 'hubs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 p-1">
            {filteredHubs.map((hub) => {
              const isCurrentCodeInHub = hub.views.some((v) => v.code === selectedReportCode);
              const HubIcon = MODULE_ICONS[hub.iconName] || MODULE_ICONS[hub.module] || Layers;
              return (
                <div
                  key={hub.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isCurrentCodeInHub
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-500/50'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                        <HubIcon className="w-3.5 h-3.5" />
                        {getLocalizedModuleShortName(hub.module, hub.module, isBn)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {hub.views.length} {isBn ? 'টি ভিউ' : 'Views'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {isBn ? hub.titleBn : hub.titleEn}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {isBn ? hub.descBn : hub.descEn}
                    </p>

                    {/* Sub-View Tabs */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {isBn ? 'ভিউ নির্বাচন করুন:' : 'Select Report View:'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {hub.views.map((v) => {
                          const isViewActive = v.code === selectedReportCode;
                          return (
                            <button
                              key={v.code}
                              type="button"
                              onClick={() => setSelectedReportCode(v.code)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                isViewActive
                                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {isViewActive && <CheckCircle className="w-3 h-3 text-white" />}
                              <span>{isBn ? v.labelBn : v.labelEn}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredHubs.length === 0 && (
              <div className="col-span-full py-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-500">
                  {isBn ? 'আপনার অনুসন্ধানের সাথে কোনো সমন্বিত হাব মেলেনি।' : 'No analytical hubs matched your search criteria.'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedModule('all');
                  }}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  {isBn ? 'ফিল্টার রিসেট করুন' : 'Clear search'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODE 2: Full 84 Reports Directory (Granular Browsing) ── */}
        {displayMode === 'directory' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-90 overflow-y-auto p-1">
            {filteredDefinitions.map((def) => {
              const isSelected = def.code === selectedReportCode;
              const ModIcon = MODULE_ICONS[def.module] || Layers;
              return (
                <button
                  type="button"
                  key={def.code}
                  onClick={() => setSelectedReportCode(def.code)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
                        <ModIcon className="w-3 h-3 text-indigo-500" />
                        {getLocalizedModuleShortName(def.module, def.module, isBn)}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                          def.tier === 'live'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {def.tier === 'live' ? (isBn ? 'লাইভ' : 'LIVE') : (isBn ? 'দৈনিক' : 'DAILY')}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {getLocalizedReportName(def.code, def.name, isBn)}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {getLocalizedReportDesc(def.code, def.description, isBn)}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-[10px]">{def.code}</span>
                    <span className="capitalize">{getLocalizedCategoryLabel(def.category, def.category, isBn)}</span>
                  </div>
                </button>
              );
            })}

            {filteredDefinitions.length === 0 && (
              <div className="col-span-full py-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-500">
                  {isBn ? 'আপনার অনুসন্ধানের সাথে কোনো প্রতিবেদন মেলেনি।' : 'No reports matched your search criteria.'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedModule('all');
                    setSelectedCategory('all');
                  }}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  {isBn ? 'সকল ফিল্টার রিসেট করুন' : 'Clear all filters'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              {[
                { id: 'today', label: isBn ? 'আজ' : 'Today' },
                { id: 'this_week', label: isBn ? 'চলতি সপ্তাহ' : 'This Week' },
                { id: 'this_month', label: isBn ? 'চলতি মাস' : 'This Month' },
                { id: 'last_30_days', label: isBn ? '৩০ দিন' : '30 Days' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400">{isBn ? 'হতে' : 'to'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
              <SelectDropdown
                icon={Bookmark}
                options={savedViews.map((v) => ({ value: v.name, label: v.name }))}
                value={selectedView}
                onChange={(val) => {
                  setSelectedView(val);
                  const matched = savedViews.find((v) => v.name === val);
                  if (matched && matched.filters) {
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                title="Save current filters as custom view preset"
              >
                <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isBn ? 'ভিউ সংরক্ষণ' : 'Save View'}</span>
              </button>
            </div>

            <button
              onClick={() => fetchReportData(selectedReportCode)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              {loading ? (isBn ? 'প্রসেস হচ্ছে…' : 'Executing...') : (isBn ? 'ফিল্টার প্রয়োগ' : 'Apply Filters')}
            </button>
          </div>

          {/* Freshness Badge */}
          {reportResult && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{isBn ? 'তাত্ক্ষণিকতা:' : 'Freshness:'}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                {reportResult.meta.freshness.tier === 'live' ? (isBn ? 'লাইভ' : 'LIVE') : reportResult.meta.freshness.tier}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>{isBn ? 'সময়:' : 'As of:'} {new Date(reportResult.meta.freshness.as_of).toLocaleTimeString(isBn ? 'bn-BD' : 'en-US')}</span>
            </div>
          )}
        </div>

        {/* Dynamic Summary Metric Cards */}
        {reportResult?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {Object.entries(reportResult.summary).map(([key, value]) => {
              const formattedKey = key.replace(/_/g, ' ');
              const isMoney = key.includes('bdt') || key.includes('valuation') || key.includes('amount') || key.includes('revenue') || key.includes('profit') || key.includes('cost') || key.includes('incentive') || key.includes('cod') || key.includes('debit') || key.includes('credit');
              const numVal = parseFloat(String(value).replace(/,/g, ''));
              const displayVal = isMoney && !isNaN(numVal) ? formatCurrency(numVal) : String(value);

              return (
                <div
                  key={key}
                  className="bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800"
                >
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    {formattedKey}
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{displayVal}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {getLocalizedReportName(activeDef?.code || '', activeDef?.name ?? 'Report Data', isBn)}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isBn ? (
              <>
                মোট {reportResult?.pagination.total || 0} টির মধ্যে{' '}
                <strong className="text-slate-800 dark:text-slate-200">{reportResult?.data.length || 0}</strong> টি রেকর্ড প্রদর্শিত হচ্ছে
              </>
            ) : (
              <>
                Showing <strong className="text-slate-800 dark:text-slate-200">{reportResult?.data.length || 0}</strong> of{' '}
                {reportResult?.pagination.total || 0} rows
              </>
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              <tr>
                {reportResult &&
                  Object.entries(reportResult.columns).map(([colKey, col]) => (
                    <th key={colKey} className="px-4 py-3 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportResult?.data.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  {Object.keys(reportResult.columns).map((colKey) => {
                    const val = row[colKey];
                    const colDef = reportResult.columns[colKey];

                    if (colDef?.type === 'badge') {
                      return (
                        <td key={colKey} className="px-4 py-3 whitespace-nowrap">
                          {renderBadge(val)}
                        </td>
                      );
                    }

                    if (colDef?.type === 'percentage') {
                      return (
                        <td key={colKey} className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {String(val)}
                        </td>
                      );
                    }

                    if (colDef?.type === 'currency') {
                      const num = parseFloat(String(val).replace(/,/g, '')) || 0;
                      return (
                        <td key={colKey} className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {formatCurrency(num)}
                        </td>
                      );
                    }

                    return (
                      <td key={colKey} className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {String(val ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {(!reportResult || reportResult.data.length === 0) && (
                <tr>
                  <td
                    colSpan={Object.keys(reportResult?.columns || {}).length || 1}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {t('reports:empty.title')}
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {t('reports:empty.description')}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Page 1 of {reportResult?.pagination.last_page || 1}</span>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled
              className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Async Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                {isBn ? 'প্রতিবেদন ডেটা এক্সপোর্ট' : 'Export Report Data'}
              </h3>
              <button
                onClick={() => {
                  setExportModalOpen(false);
                  setExportStatus(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn ? (
                <>
                  <strong>{getLocalizedReportName(activeDef?.code || '', activeDef?.name || '', true)}</strong> এক্সপোর্ট করা হচ্ছে। স্প্রেডশিট ডাউনলোড করতে বা পিডিএফ প্রিন্ট করতে ফরম্যাট নির্বাচন করুন।
                </>
              ) : (
                <>
                  Exporting <strong>{activeDef?.name}</strong>. Choose your preferred format to immediately download spreadsheets or open the PDF print document.
                </>
              )}
            </p>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isBn ? 'এক্সপোর্ট ফরম্যাট' : 'Export Format'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      setExportFormat(fmt);
                      setExportStatus(null);
                    }}
                    className={`py-2 text-xs font-semibold uppercase rounded-lg border text-center transition-all cursor-pointer ${
                      exportFormat === fmt
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {exportStatus && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{exportStatus}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setExportModalOpen(false);
                  setExportStatus(null);
                }}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {exportFormat === 'pdf'
                  ? (isBn ? 'পিডিএফ প্রিভিউ দেখুন' : 'Open PDF Preview')
                  : (isBn ? `${exportFormat.toUpperCase()} ডাউনলোড` : `Download ${exportFormat.toUpperCase()}`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Print Preview Modal */}
      {isPrintModalOpen && reportResult && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={`Print Report: ${activeDef?.name || 'Enterprise Ledger'}`}
          documentNumber={`RPT-${selectedReportCode.toUpperCase()}`}
          documentType="Official ERP Audit Report"
          pageClass={
            Object.keys(reportResult.columns).length > 5
              ? 'print-page-a4-landscape'
              : 'print-page-a4'
          }
        >
          <ReportPrintDocument
            reportTitle={activeDef?.name || 'Enterprise Analytical Report'}
            reportCode={selectedReportCode}
            moduleName={activeDef?.module || 'ERP Analytics'}
            businessConfig={businessConfig}
            periodText={`${startDate} to ${endDate} (${datePreset.replace(/_/g, ' ').toUpperCase()})`}
            filtersText={`Module: ${selectedModule.toUpperCase()} | Category: ${selectedCategory.toUpperCase()} | View: ${selectedView}`}
            columns={Object.entries(reportResult.columns).map(([k, col]) => {
              const mappedType =
                col.type === 'number'
                  ? ('numeric' as const)
                  : col.type === 'percentage'
                  ? ('percentage' as const)
                  : col.type === 'currency'
                  ? ('currency' as const)
                  : col.type === 'date'
                  ? ('date' as const)
                  : col.type === 'badge'
                  ? ('badge' as const)
                  : ('text' as const);
              return {
                key: k,
                label: col.label,
                type: mappedType,
                align:
                  mappedType === 'numeric' || mappedType === 'currency' || mappedType === 'percentage'
                    ? ('right' as const)
                    : ('left' as const),
              };
            })}
            data={reportResult.data}
            summaryCards={
              reportResult.summary
                ? Object.entries(reportResult.summary).map(([k, v]) => ({
                    label: k.replace(/_/g, ' '),
                    value: String(v),
                  }))
                : undefined
            }
            orientation={Object.keys(reportResult.columns).length > 5 ? 'landscape' : 'portrait'}
          />
        </PrintPreviewModal>
      )}

      {/* Save Custom View Modal */}
      {saveViewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-600" />
                {isBn ? 'কাস্টম ভিউ প্রিসেট সংরক্ষণ' : 'Save Custom Report View Preset'}
              </h3>
              <button
                type="button"
                onClick={() => setSaveViewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomView} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'প্রিসেট ভিউয়ের নাম *' : 'Preset View Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isBn ? 'যেমন: চলতি মাসের নির্বাহী ভিউ' : 'e.g. Month-to-Date Executive View'}
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  {isBn ? 'সংরক্ষিত ফিল্টার মান:' : 'Preset Settings Captured:'}
                </div>
                <div>• {isBn ? 'তারিখের পরিসীমা:' : 'Date Range:'} {startDate} {isBn ? 'হতে' : 'to'} {endDate}</div>
                <div>• {isBn ? 'কুইক প্রিসেট:' : 'Quick Preset:'} {getLocalizedPresetLabel(datePreset, datePreset, isBn)}</div>
                <div>• {isBn ? 'প্রতিবেদন:' : 'Report:'} {getLocalizedReportName(activeDef?.code || '', activeDef?.name || '', isBn)}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSaveViewModalOpen(false)}
                  disabled={savingView}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingView || !newViewName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingView ? (isBn ? 'সংরক্ষণ হচ্ছে…' : 'Saving...') : (isBn ? 'প্রিসেট সংরক্ষণ করুন' : 'Save Preset View')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
