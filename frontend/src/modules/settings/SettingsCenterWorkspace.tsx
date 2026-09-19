// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS CENTER WORKSPACE — Enterprise Governance & Configuration Cockpit
// ───────────────────────────────────────────────────────────────────────────
// Fully token-compliant architecture (UI_SYSTEM.md §2, §10.2).
// - Master Command Hub with Live Diagnostics & Quick Shortcuts
// - Unified Governance Taxonomy (Roles, Security Audit, SEO, Profile)
// - Global Instant Omni-Search with Keyword Breadcrumbs ('/' or Ctrl+K)
// - Dedicated Purpose-Built Input Widgets via SettingFieldDispatcher:
//   * Multi-Channel Interactive Chips (JSON arrays, notification channels, payment methods)
//   * Dual Range Sliders with Numeric Steppers (% tolerances, yields, rates)
//   * Formatted Currency Inputs with Instant Quick-Presets (+1k, +5k, +10k)
//   * Duration & Lead-Time Stepper Controls (Days, Minutes, Months)
//   * Visual Segmented Radio Cards (12h/24h, Portrait/Landscape, FIFO/AVCO, PDF/Excel)
//   * Brand Asset Uploader with Live Preview Thumbnails
//   * Document Prefix Inputs with Real-Time Mock Serials
//   * Encrypted Credential Vault Cards with Visibility Toggle & Copy
//   * Enterprise Operation Toggle Cards with Status Pills
// - Keyboard Shortcuts: '/' or Ctrl+K for Search, Ctrl+S for Save
// - Floating Unsaved Changes Pill with Precise Delta Counter
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Settings,
  Building2,
  Factory,
  Package,
  ShoppingCart,
  BadgePercent,
  Monitor,
  ShoppingBag,
  Globe,
  Truck,
  PlugZap,
  CheckSquare,
  Users,
  Cpu,
  Landmark,
  Bell,
  ShieldCheck,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  Activity,
  Check,
  AlertTriangle,
  CircleCheckBig,
  Boxes,
  Search,
  User,
  Zap,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import { enterFast } from '../../lib/motion/tokens';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Input, FormGroup } from '../../components/ui/FormElements';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { notify } from '../../components/ui/Toast';
import { DocumentsSection } from './documents/DocumentsSection';
import { ModuleManagerSection } from './sections/ModuleManagerSection';
import { ProductionStagesSection } from './sections/ProductionStagesSection';
import { CustomFieldsManagerSection } from './sections/CustomFieldsManagerSection';
import { TerminologySection } from './sections/TerminologySection';
import { RolesManagementWorkspace } from '../../pages/settings/RolesManagementWorkspace';
import { ActivityLogWorkspace } from '../../pages/settings/ActivityLogWorkspace';
import { DataBinWorkspace } from '../../pages/settings/DataBinWorkspace';
import { ProfileSettingsWorkspace } from '../../pages/settings/ProfileSettingsWorkspace';
import { SeoDiscoverabilityWorkspace } from '../../pages/settings/SeoDiscoverabilityWorkspace';
import { WorkflowAutomationWorkspace } from './WorkflowAutomationWorkspace';
import { SettingsOverviewHub } from './components/SettingsOverviewHub';
import { SettingsOmniSearch } from './components/SettingsOmniSearch';
import { SettingFieldDispatcher } from './components/SettingFieldDispatcher';
import { SettingsPreviewDispatcher } from './components/SettingsPreviewDispatcher';
import { SETTINGS_SUBGROUPS, type SubgroupDefinition } from './config/settingsSubgroups';
import { SEGMENTED_OPTIONS } from './config/segmentedOptions';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { useTranslation } from 'react-i18next';
import type {
  SettingsSchemaDictionary,
  SettingItem,
  ConnectionTestResult,
} from '../../types/api/settings';
import type { TenantDomainRecord } from '../../types/api/domains';

const GROUP_ICONS: Record<string, React.ElementType> = {
  overview: Sparkles,
  general: Building2,
  roles: ShieldCheck,
  audit_logs: Activity,
  profile: User,
  seo: Globe,
  workflows: Zap,
  modules: Boxes,
  terminology: FileSpreadsheet,
  production_stages: Factory,
  custom_fields: Sparkles,
  documents: FileSpreadsheet,
  production: Factory,
  inventory: Package,
  purchase: ShoppingCart,
  sales: BadgePercent,
  pos: Monitor,
  ecommerce: ShoppingBag,
  custom_domains: Globe,
  delivery: Truck,
  integrations: PlugZap,
  qc: CheckSquare,
  hr_payroll: Users,
  assets: Cpu,
  finance: Landmark,
  notifications: Bell,
  security: ShieldCheck,
  reports: FileSpreadsheet,
  bin: Trash2,
};

const GROUP_LABELS: Record<string, string> = {
  overview: 'Command Overview',
  general: 'General Profile & Prefixes',
  roles: 'Roles & Staff Permissions',
  audit_logs: 'Security Audit Trail',
  profile: 'Workstation & Profile',
  seo: 'SEO & Discoverability',
  workflows: 'Flow Automation',
  custom_domains: 'Custom Domains & SSL',
  modules: 'ERP Modules & Navigation Order',
  terminology: 'Vocabulary & Terminology',
  production_stages: 'Production Stages',
  custom_fields: 'Custom Attributes & Fields',
  documents: 'Document Templates',
  production: 'Production & Manufacturing',
  inventory: 'Stock & Warehousing',
  purchase: 'Procurement & Purchases',
  sales: 'Sales & Commercial',
  pos: 'Point of Sale (POS)',
  ecommerce: 'E-Commerce Storefront',
  delivery: 'Delivery & Couriers',
  integrations: 'API & Payment Gateways',
  qc: 'Quality Control (QC)',
  hr_payroll: 'HR & Payroll Governance',
  assets: 'Assets & Maintenance',
  finance: 'Tax & Fiscal Periods',
  notifications: 'Multi-Channel Alerts',
  security: 'Session & Auth Hardening',
  reports: 'Reports & Export Defaults',
  bin: 'Data Bin & Recovery Vault',
};

type SettingFieldValue = string | number | boolean | string[] | Record<string, unknown>;

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export const SettingsCenterWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [schema, setSchema] = useState<SettingsSchemaDictionary>({});

  const getGroupLabel = useCallback(
    (key: string): string => {
      const i18nKey = `settings.groupLabels.${key}`;
      return t(i18nKey as any, { defaultValue: GROUP_LABELS[key] || schema[key]?.title || key });
    },
    [t, schema]
  );

  const localizedCategories = useMemo(
    () => [
      {
        name: t('settings.categories.commandCenter'),
        groups: ['overview'],
      },
      {
        name: t('settings.categories.governance'),
        groups: ['general', 'roles', 'audit_logs', 'bin', 'profile'],
      },
      {
        name: t('settings.categories.customization'),
        groups: ['modules', 'workflows', 'terminology', 'production_stages', 'custom_fields', 'documents'],
      },
      {
        name: t('settings.categories.manufacturing'),
        groups: ['production', 'inventory', 'qc', 'assets'],
      },
      {
        name: t('settings.categories.commercial'),
        groups: ['purchase', 'sales', 'pos'],
      },
      {
        name: t('settings.categories.storefront'),
        groups: ['ecommerce', 'custom_domains', 'seo'],
      },
      {
        name: t('settings.categories.services'),
        groups: ['delivery', 'integrations', 'finance', 'hr_payroll', 'notifications', 'security', 'reports'],
      },
    ],
    [t]
  );

  const [activeGroup, setActiveGroup] = useWorkspaceTab<string>(
    'overview',
    [
      'overview',
      'general',
      'roles',
      'audit_logs',
      'bin',
      'profile',
      'workflows',
      'modules',
      'terminology',
      'production_stages',
      'custom_fields',
      'documents',
      'production',
      'inventory',
      'purchase',
      'sales',
      'pos',
      'ecommerce',
      'custom_domains',
      'seo',
      'delivery',
      'integrations',
      'qc',
      'hr_payroll',
      'assets',
      'finance',
      'notifications',
      'security',
      'reports',
    ] as const,
    'tab'
  );

  const [formValues, setFormValues] = useState<Record<string, SettingFieldValue>>({});
  const [initialValues, setInitialValues] = useState<Record<string, SettingFieldValue>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [omniSearchOpen, setOmniSearchOpen] = useState(false);

  // Inline error message for region
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dialog & Modal states
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteDomain, setConfirmDeleteDomain] = useState<{ id: number; domain: string } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testProvider, setTestProvider] = useState('steadfast');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Custom Domains State
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [addDomainModalOpen, setAddDomainModalOpen] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newDomainType, setNewDomainType] = useState<'custom_primary' | 'custom_alias'>('custom_alias');
  const [domainActionLoading, setDomainActionLoading] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    notify.info('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Load Schema Dictionary
  useEffect(() => {
    let isMounted = true;
    const loadSchema = async () => {
      try {
        const res = await api.get<any>('/settings/schema');
        if (isMounted && res.data) {
          const dict = (res.data && typeof res.data === 'object' && 'data' in res.data)
            ? (res.data as any).data
            : res.data;
          if (dict && typeof dict === 'object') {
            setSchema(dict as SettingsSchemaDictionary);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load settings schema', err);
      }
    };
    loadSchema();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      setDomainsLoading(true);
      setErrorMessage(null);
      const res = await api.get<TenantDomainRecord[]>('/storefront/domains');
      if (Array.isArray(res.data)) {
        setDomains(res.data);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to load custom domains'));
    } finally {
      setDomainsLoading(false);
      setLoading(false);
    }
  }, []);

  const loadGroupSettings = useCallback(async (group: string) => {
    if (
      [
        'overview',
        'modules',
        'terminology',
        'production_stages',
        'custom_fields',
        'documents',
        'roles',
        'audit_logs',
        'profile',
        'seo',
      ].includes(group)
    ) {
      setLoading(false);
      return;
    }

    if (group === 'custom_domains') {
      await loadDomains();
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.get<any>(`/settings/${group}`);
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (payload?.settings) {
        const fetched = payload.settings;

        const initial: Record<string, SettingFieldValue> = {};
        Object.entries(fetched).forEach(([k, v]) => {
          initial[k] = (v as SettingItem).value;
        });
        setFormValues(initial);
        setInitialValues(initial);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, [loadDomains]);

  useEffect(() => {
    let ignore = false;
    const executeLoad = async () => {
      if (ignore) return;
      await loadGroupSettings(activeGroup);
    };
    void executeLoad();
    return () => {
      ignore = true;
    };
  }, [activeGroup, loadGroupSettings]);

  // Compute Unsaved Changes
  const changedKeys = useMemo(() => {
    if (
      [
        'overview',
        'custom_domains',
        'modules',
        'terminology',
        'production_stages',
        'custom_fields',
        'documents',
        'roles',
        'audit_logs',
        'profile',
        'seo',
      ].includes(activeGroup)
    ) {
      return [];
    }
    return Object.keys(formValues).filter((key) => {
      return JSON.stringify(formValues[key]) !== JSON.stringify(initialValues[key]);
    });
  }, [formValues, initialValues, activeGroup]);

  const hasChanges = changedKeys.length > 0;

  // Save Settings Handler
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setErrorMessage(null);

      const payload: Record<string, SettingFieldValue> = {};
      changedKeys.forEach((key) => {
        const val = formValues[key];
        if (val !== undefined) {
          payload[key] = val;
        }
      });

      const res = await api.put<any>(
        `/settings/${activeGroup}`,
        { settings: payload }
      );
      const resPayload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (resPayload?.settings) {
        notify.success('Settings saved successfully');
        try {
          if (payload['brand_logo_url'] !== undefined) {
            localStorage.setItem('brand_logo_url', String(payload['brand_logo_url'] || ''));
          }
          if (payload['brand_favicon_url'] !== undefined) {
            localStorage.setItem('brand_favicon_url', String(payload['brand_favicon_url'] || ''));
          }
          if (payload['company_legal_name'] !== undefined) {
            localStorage.setItem('company_name', String(payload['company_legal_name'] || ''));
          }
        } catch (err) {
          void err;
        }
        const updated = resPayload.settings;

        const initial: Record<string, SettingFieldValue> = {};
        Object.entries(updated).forEach(([k, v]) => {
          initial[k] = (v as SettingItem).value;
        });
        setFormValues(initial);
        setInitialValues(initial);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  }, [activeGroup, changedKeys, formValues]);

  // Reset Group to Defaults
  const handleResetToDefault = async () => {
    try {
      setSaving(true);
      setErrorMessage(null);
      const res = await api.post<any>(
        `/settings/${activeGroup}/reset`
      );
      const resPayload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (resPayload?.settings) {
        notify.success('Settings reset to default values');
        const updated = resPayload.settings;

        const initial: Record<string, SettingFieldValue> = {};
        Object.entries(updated).forEach(([k, v]) => {
          initial[k] = (v as SettingItem).value;
        });
        setFormValues(initial);
        setInitialValues(initial);
        setConfirmResetOpen(false);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to reset settings'));
    } finally {
      setSaving(false);
    }
  };

  // Keyboard Shortcuts: '/' or Ctrl+K for Omni-Search, Ctrl+S for Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if ((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault();
        setOmniSearchOpen(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving, handleSave]);

  // Live Test Connection Handler
  const handleRunTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);

      const targetGroup = activeGroup === 'delivery' ? 'delivery' : 'integrations';
      const res = await api.post<ConnectionTestResult>(
        `/settings/${targetGroup}/test-connection`,
        {
          provider: testProvider,
          credentials: formValues,
        }
      );

      if (res.data) {
        setTestResult(res.data);
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        provider: testProvider,
        status: 'failed',
        message: extractErrorMessage(err, 'Connection test failed'),
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Custom Domain Handlers
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;

    try {
      setDomainActionLoading(-1);
      setErrorMessage(null);

      const res = await api.post<TenantDomainRecord>('/storefront/domains', {
        domain: newDomainInput.trim().toLowerCase(),
        type: newDomainType,
      });

      if (res.data) {
        notify.success('Domain registered. Please configure DNS records.');
        setAddDomainModalOpen(false);
        setNewDomainInput('');
        loadDomains();
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to add custom domain'));
    } finally {
      setDomainActionLoading(null);
    }
  };

  const handleVerifyDomain = async (id: number) => {
    try {
      setDomainActionLoading(id);
      setErrorMessage(null);

      const res = await api.post<TenantDomainRecord>(`/storefront/domains/${id}/verify`);

      if (res.data) {
        notify.success('Domain ownership verified successfully');
        loadDomains();
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'DNS verification record was not detected yet. Check propagation.'));
      loadDomains();
    } finally {
      setDomainActionLoading(null);
    }
  };

  const handleSetPrimaryDomain = async (id: number) => {
    try {
      setDomainActionLoading(id);
      setErrorMessage(null);

      const res = await api.post<TenantDomainRecord>(`/storefront/domains/${id}/set-primary`);

      if (res.data) {
        notify.success('Primary storefront domain updated');
        loadDomains();
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to set primary domain'));
    } finally {
      setDomainActionLoading(null);
    }
  };

  const handleDeleteDomain = async () => {
    if (!confirmDeleteDomain) return;

    try {
      setDomainActionLoading(confirmDeleteDomain.id);
      setErrorMessage(null);

      await api.delete(`/storefront/domains/${confirmDeleteDomain.id}`);
      notify.success('Custom domain removed successfully');
      setConfirmDeleteDomain(null);
      loadDomains();
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err, 'Failed to remove domain'));
    } finally {
      setDomainActionLoading(null);
    }
  };

  const handleSelectSearchResult = (groupKey: string, settingKey?: string, route?: string) => {
    if (route) {
      setActiveGroup(groupKey);
      return;
    }
    setActiveGroup(groupKey);

    if (settingKey) {
      setTimeout(() => {
        const el = document.getElementById(`setting-field-${settingKey}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2500);
        }
      }, 250);
    }
  };

  const activeGroupMeta = schema[activeGroup];
  const ActiveIcon = GROUP_ICONS[activeGroup] || Settings;
  const currentSubgroups = SETTINGS_SUBGROUPS[activeGroup] || [];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 bg-danger-subtle border border-danger rounded-(--card-radius) text-danger flex items-center justify-between text-sm shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden="true" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-danger hover:opacity-80 font-bold text-lg leading-none p-1 focus-visible:ring-focus rounded-md cursor-pointer"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header Command Surface */}
      <div className="bg-surface border border-default rounded-(--card-radius) p-5 sm:p-6 shadow-(--card-shadow)">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="primary-subtle" icon={Sparkles}>
                {t('settings.workspaceBadge')}
              </Badge>
              {activeGroup !== 'overview' && (
                <div className="flex items-center gap-1.5 text-2xs text-muted">
                  <span>/</span>
                  <button
                    onClick={() => setActiveGroup('overview')}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    {t('settings.overviewLink')}
                  </button>
                  <span>/</span>
                  <span className="text-default font-semibold">
                    {getGroupLabel(activeGroup)}
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-default flex items-center gap-2.5">
              <Settings className="size-6 text-primary" aria-hidden="true" />
              {t('settings.title')}
            </h1>
            <p className="text-muted text-xs sm:text-sm max-w-2xl leading-relaxed">
              {t('settings.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Omni-Search Launch Button */}
            <button
              onClick={() => setOmniSearchOpen(true)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-default bg-surface-sunken hover:border-primary/50 text-xs text-muted hover:text-default transition-all shadow-xs w-full sm:w-72 justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                <span>{t('settings.searchPlaceholder')}</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-mono text-muted bg-surface border border-default rounded">
                /
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Compact Domain Picker (< lg screens) */}
      <div className="lg:hidden bg-surface border border-default rounded-(--card-radius) p-3 shadow-xs mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {React.createElement(GROUP_ICONS[activeGroup] || Settings, {
              className: 'size-4 text-primary shrink-0',
            })}
            <span className="text-xs font-bold text-default truncate">
              {getGroupLabel(activeGroup)}
            </span>
            {hasChanges && (
              <span className="size-2 rounded-full bg-accent animate-pulse shrink-0" title="Unsaved changes" />
            )}
          </div>
          {activeGroup !== 'overview' && (
            <button
              type="button"
              onClick={() => {
                if (hasChanges) {
                  notify.info(t('settings.unsavedChangesWarning'));
                  return;
                }
                setActiveGroup('overview');
              }}
              className="px-2 py-1 text-2xs font-semibold rounded-lg bg-surface-sunken hover:bg-surface-raised border border-default text-muted hover:text-default transition-colors shrink-0"
            >
              {t('settings.overviewHubBtn')}
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={activeGroup}
            onChange={(e) => {
              const next = e.target.value;
              if (hasChanges) {
                notify.info(t('settings.unsavedChangesWarning'));
                return;
              }
              setActiveGroup(next);
            }}
            className="w-full appearance-none rounded-xl border border-default bg-surface-sunken/60 py-2 pl-3 pr-8 text-xs font-semibold text-default focus:border-primary focus:outline-none transition-colors"
          >
            {localizedCategories.map((cat) => (
              <optgroup key={cat.name} label={cat.name}>
                {cat.groups.map((groupKey) => (
                  <option key={groupKey} value={groupKey}>
                    {getGroupLabel(groupKey)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Layout: High-Polish Sidebar Navigation + Right Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Navigation Rail (Desktop) */}
        <div className="hidden lg:block lg:col-span-1 space-y-5 bg-surface border border-default rounded-(--card-radius) p-3.5 shadow-xs sticky top-20">
          {localizedCategories.map((cat) => (
            <div key={cat.name} className="space-y-1">
              <div className="px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                <span>{cat.name}</span>
                <span className="font-mono text-muted/60">{cat.groups.length}</span>
              </div>
              <div className="space-y-0.5">
                {cat.groups.map((groupKey) => {
                  const Icon = GROUP_ICONS[groupKey] || Settings;
                  const isActive = activeGroup === groupKey;
                  const label = getGroupLabel(groupKey);

                  return (
                    <button
                      key={groupKey}
                      onClick={() => {
                        if (hasChanges) {
                          notify.info(t('settings.unsavedChangesWarning'));
                          return;
                        }
                        setActiveGroup(groupKey);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all outline-none text-left cursor-pointer group',
                        isActive
                          ? 'bg-primary text-primary-fg shadow-xs font-bold'
                          : 'text-default hover:bg-surface-sunken hover:translate-x-0.5'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={cn(
                            'size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            isActive
                              ? 'bg-primary-fg/20 text-primary-fg'
                              : 'bg-surface-sunken border border-default text-muted group-hover:text-primary group-hover:border-primary/40'
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                        </div>
                        <span className="truncate text-xs">{label}</span>
                      </div>
                      {hasChanges && isActive && (
                        <span
                          className="size-2 rounded-full bg-accent animate-pulse shrink-0 ml-2"
                          aria-label="Unsaved changes"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-3 min-w-0">
          <AnimatePresence mode="wait">
            <m.div
              key={activeGroup}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={enterFast}
              className="space-y-6"
            >
              {/* Overview Hub Dashboard */}
              {activeGroup === 'overview' ? (
                <SettingsOverviewHub
                  schema={schema}
                  formValues={formValues}
                  onSelectGroup={(g) => setActiveGroup(g)}
                  onOpenOmniSearch={() => setOmniSearchOpen(true)}
                />
              ) : activeGroup === 'roles' ? (
                /* Roles & Permissions Workspace Embedded */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 space-y-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-default">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="size-5 text-primary" />
                      <div>
                        <h2 className="text-sm font-bold text-default">Staff Roles & Permissions</h2>
                        <p className="text-2xs text-muted">
                          Configure granular RBAC permissions matrix and staff access tiers.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setActiveGroup('overview')}>
                      Back to Hub
                    </Button>
                  </div>
                  <RolesManagementWorkspace />
                </div>
              ) : activeGroup === 'audit_logs' ? (
                /* Security Audit Log Workspace Embedded */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 space-y-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-default">
                    <div className="flex items-center gap-2.5">
                      <Activity className="size-5 text-primary" />
                      <div>
                        <h2 className="text-sm font-bold text-default">Security Audit Trail & Compliance</h2>
                        <p className="text-2xs text-muted">
                          Immutable audit ledger tracking delta changes and compliance records.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setActiveGroup('overview')}>
                      Back to Hub
                    </Button>
                  </div>
                  <ActivityLogWorkspace />
                </div>
              ) : activeGroup === 'bin' ? (
                /* Data Bin & Recovery Vault Workspace Embedded */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 space-y-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-default">
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="size-5 text-danger" />
                      <div>
                        <h2 className="text-sm font-bold text-default">Data Bin & Recovery Vault</h2>
                        <p className="text-2xs text-muted">
                          Safely inspect, restore, or permanently purge soft-deleted records across all ERP domains.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setActiveGroup('overview')}>
                      Back to Hub
                    </Button>
                  </div>
                  <DataBinWorkspace />
                </div>
              ) : activeGroup === 'profile' ? (
                /* Profile & Workstation Settings Embedded */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 space-y-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-default">
                    <div className="flex items-center gap-2.5">
                      <User className="size-5 text-primary" />
                      <div>
                        <h2 className="text-sm font-bold text-default">User Workstation & Regional Defaults</h2>
                        <p className="text-2xs text-muted">
                          Personal localization preferences and password security credentials.
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setActiveGroup('overview')}>
                      Back to Hub
                    </Button>
                  </div>
                  <ProfileSettingsWorkspace />
                </div>
              ) : activeGroup === 'seo' ? (
                /* SEO & Search Engine Discoverability Embedded */
                <div className="space-y-6">
                  <SeoDiscoverabilityWorkspace onBackToHub={() => setActiveGroup('overview')} />
                </div>
              ) : activeGroup === 'workflows' ? (
                /* Flow Workflow Automation Hub Embedded */
                <div className="space-y-6">
                  <WorkflowAutomationWorkspace />
                </div>
              ) : activeGroup === 'modules' ? (
                /* Dynamic Module Activation */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 shadow-xs">
                  <ModuleManagerSection />
                </div>
              ) : activeGroup === 'terminology' ? (
                /* Dynamic Vocabulary & Terminology */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 shadow-xs">
                  <TerminologySection />
                </div>
              ) : activeGroup === 'production_stages' ? (
                /* Dynamic Production Stages & Routing */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 shadow-xs">
                  <ProductionStagesSection />
                </div>
              ) : activeGroup === 'custom_fields' ? (
                /* Custom Attributes & Extended Metadata */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 shadow-xs">
                  <CustomFieldsManagerSection />
                </div>
              ) : activeGroup === 'documents' ? (
                /* Centralized Document Templates & Printing Infrastructure */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 shadow-xs">
                  <DocumentsSection />
                </div>
              ) : activeGroup === 'custom_domains' ? (
                /* Custom Domain Management Hub */
                <div className="bg-surface rounded-(--card-radius) border border-default p-6 space-y-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-default">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="size-5 text-primary" aria-hidden="true" />
                        <h2 className="text-md font-bold text-default">Custom Storefront Domains</h2>
                      </div>
                      <p className="text-xs text-muted">
                        Connect your brand domain to your e-commerce storefront with automated DNS verification and edge SSL termination.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={loadDomains}
                        disabled={domainsLoading}
                      >
                        <RefreshCw className={cn('size-3.5 mr-1.5', domainsLoading && 'animate-spin')} aria-hidden="true" />
                        Refresh
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setAddDomainModalOpen(true)}
                      >
                        <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
                        Add Custom Domain
                      </Button>
                    </div>
                  </div>

                  {/* Domains Table / List */}
                  {domainsLoading ? (
                    <div className="space-y-3 py-4">
                      <div className="skeleton-shimmer h-20 w-full rounded-xl" />
                      <div className="skeleton-shimmer h-20 w-full rounded-xl" />
                    </div>
                  ) : domains.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <Globe className="size-10 text-muted mx-auto" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-default">No Custom Domains Registered</h3>
                      <p className="text-xs text-muted max-w-sm mx-auto">
                        You are currently serving the default platform subdomain. Add your branded domain to initiate DNS ownership verification.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {domains.map((dom) => {
                        const isPrimary = dom.is_primary;
                        const isPlatform = dom.type === 'platform_subdomain';
                        const isVerified = dom.verification_status === 'verified';

                        return (
                          <div
                            key={dom.id}
                            className={cn(
                              'p-5 rounded-(--card-radius) border transition-token-colors',
                              isPrimary
                                ? 'border-primary bg-primary-subtle'
                                : 'border-default bg-surface hover:border-strong'
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="font-mono text-sm font-bold text-default">{dom.domain}</span>
                                  {isPrimary && (
                                    <Badge tone="primary-subtle">
                                      Primary Storefront
                                    </Badge>
                                  )}
                                  {isPlatform && (
                                    <Badge tone="surface-sunken">
                                      Platform Managed
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>Verification:</span>
                                    <StatusBadge
                                      status={
                                        dom.verification_status === 'verified'
                                          ? 'approved'
                                          : dom.verification_status === 'failed'
                                          ? 'failed'
                                          : 'pending'
                                      }
                                      label={dom.verification_status.toUpperCase()}
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span>SSL Status:</span>
                                    {dom.ssl_status === 'active' ? (
                                      <Badge tone="success-subtle" icon={CircleCheckBig}>
                                        SSL Active
                                      </Badge>
                                    ) : (
                                      <Badge tone="surface-sunken">SSL Inactive</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isVerified && !isPlatform && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleVerifyDomain(dom.id)}
                                    loading={domainActionLoading === dom.id}
                                  >
                                    <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" />
                                    Verify DNS
                                  </Button>
                                )}

                                {isVerified && !isPrimary && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleSetPrimaryDomain(dom.id)}
                                    loading={domainActionLoading === dom.id}
                                  >
                                    Set as Primary
                                  </Button>
                                )}

                                {!isPlatform && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setConfirmDeleteDomain({ id: dom.id, domain: dom.domain })
                                    }
                                    disabled={domainActionLoading === dom.id}
                                    aria-label={`Remove domain ${dom.domain}`}
                                  >
                                    <Trash2 className="size-4 text-danger" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* DNS Instructions Card for Unverified Domain */}
                            {!isVerified && !isPlatform && dom.dns_records_expected && (
                              <div className="mt-4 pt-4 border-t border-default bg-surface-sunken p-3.5 rounded-lg space-y-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-default">
                                  <Info className="size-4 text-primary" aria-hidden="true" />
                                  Required DNS Configuration Records
                                </div>
                                <p className="text-2xs text-muted">
                                  Add the following DNS records at your domain registrar (e.g. Cloudflare, Namecheap, GoDaddy):
                                </p>

                                <div className="space-y-2 font-mono text-xs">
                                  {dom.dns_records_expected.txt_record && (
                                    <div className="p-2.5 bg-surface border border-default rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="text-2xs font-bold text-primary uppercase">
                                          TXT Record (Ownership Challenge)
                                        </div>
                                        <div className="text-default break-all">
                                          <span className="text-muted">Host:</span> {dom.dns_records_expected.txt_record.host}
                                        </div>
                                        <div className="text-default break-all">
                                          <span className="text-muted">Value:</span> {dom.dns_records_expected.txt_record.value}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          copyToClipboard(
                                            dom.dns_records_expected?.txt_record?.value || '',
                                            `txt-${dom.id}`
                                          )
                                        }
                                        aria-label="Copy TXT Value"
                                      >
                                        {copiedKey === `txt-${dom.id}` ? (
                                          <Check className="size-3.5 text-success" />
                                        ) : (
                                          <Copy className="size-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  {dom.dns_records_expected.cname_record && (
                                    <div className="p-2.5 bg-surface border border-default rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="text-2xs font-bold text-primary uppercase">
                                          CNAME Record (Storefront Routing)
                                        </div>
                                        <div className="text-default break-all">
                                          <span className="text-muted">Host:</span> {dom.dns_records_expected.cname_record.host}
                                        </div>
                                        <div className="text-default break-all">
                                          <span className="text-muted">Target:</span> {dom.dns_records_expected.cname_record.value}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          copyToClipboard(
                                            dom.dns_records_expected?.cname_record?.value || '',
                                            `cname-${dom.id}`
                                          )
                                        }
                                        aria-label="Copy CNAME Target"
                                      >
                                        {copiedKey === `cname-${dom.id}` ? (
                                          <Check className="size-3.5 text-success" />
                                        ) : (
                                          <Copy className="size-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Domain Form View with Logical Sub-Group Cards & Dedicated Input Widgets */
                <div className="space-y-6">
                  {/* Domain Header Card */}
                  <div className="bg-surface rounded-2xl border border-default p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                          <ActiveIcon className="size-4" aria-hidden="true" />
                        </div>
                        <h2 className="text-md font-bold text-default">
                          {GROUP_LABELS[activeGroup] || activeGroupMeta?.title || activeGroup}
                        </h2>
                      </div>
                      <p className="text-xs text-muted max-w-xl">
                        {activeGroupMeta?.description || 'Configure parameters for this domain.'}
                      </p>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(activeGroup === 'delivery' || activeGroup === 'integrations') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTestProvider(activeGroup === 'delivery' ? 'steadfast' : 'bkash');
                            setTestResult(null);
                            setTestModalOpen(true);
                          }}
                        >
                          <Activity className="size-3.5 mr-1.5 text-primary" aria-hidden="true" />
                          Test Connection
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmResetOpen(true)}
                        disabled={saving}
                      >
                        <RotateCcw className="size-3.5 mr-1.5" aria-hidden="true" />
                        Reset Defaults
                      </Button>

                      {hasChanges && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSave}
                          loading={saving}
                        >
                          <Save className="size-3.5 mr-1.5" aria-hidden="true" />
                          Save Domain (Ctrl+S)
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Loading Skeleton */}
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="skeleton-shimmer h-36 rounded-2xl" />
                      ))}
                    </div>
                  ) : currentSubgroups.length > 0 ? (
                    /* Structured Subgroups Layout with Dedicated Input Widgets */
                    <div className="space-y-6">
                      {currentSubgroups.map((subgroup: SubgroupDefinition) => {
                        const SubIcon = subgroup.icon || Settings;

                        return (
                          <div
                            key={subgroup.id}
                            className="bg-surface rounded-2xl border border-default p-5 sm:p-6 shadow-xs space-y-4 hover:border-primary/20 transition-all"
                          >
                            {/* Subgroup Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-default">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <SubIcon className="size-3.5" />
                                  </div>
                                  <h3 className="text-sm font-bold text-default">{subgroup.title}</h3>
                                </div>
                                {subgroup.description && (
                                  <p className="text-2xs text-muted">{subgroup.description}</p>
                                )}
                              </div>

                              {subgroup.testTrigger && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setTestProvider(subgroup.testTrigger === 'payment' ? 'bkash' : subgroup.testTrigger || 'steadfast');
                                    setTestResult(null);
                                    setTestModalOpen(true);
                                  }}
                                >
                                  <Activity className="size-3 mr-1 text-primary" />
                                  Test API
                                </Button>
                              )}
                            </div>

                            {/* Live Simulator Previews */}
                            {subgroup.previewType && (
                              <SettingsPreviewDispatcher
                                previewType={subgroup.previewType}
                                formValues={formValues}
                              />
                            )}

                            {/* Form Fields Grid with Specialized Dispatcher */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {subgroup.keys.map((key) => {
                                const meta = activeGroupMeta?.settings[key];
                                if (!meta) return null;

                                const isWideField =
                                  SEGMENTED_OPTIONS[key] !== undefined ||
                                  meta.type === 'json' ||
                                  key.endsWith('_channels') ||
                                  key === 'allowed_payment_methods' ||
                                  key === 'brand_logo_url' ||
                                  key === 'brand_favicon_url' ||
                                  (key.endsWith('_url') && !key.includes('api')) ||
                                  key.includes('address') ||
                                  key.includes('note') ||
                                  key.includes('tagline') ||
                                  key.includes('message');

                                return (
                                  <div
                                    key={key}
                                    id={`setting-field-${key}`}
                                    className={cn(
                                      'transition-all',
                                      isWideField ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                    )}
                                  >
                                    <SettingFieldDispatcher
                                      settingKey={key}
                                      meta={meta}
                                      value={formValues[key]}
                                      onChange={(val) =>
                                        setFormValues((prev) => ({ ...prev, [key]: val as SettingFieldValue }))
                                      }
                                      currencySymbol={formValues['currency_symbol'] as string}
                                      currencyCode={formValues['currency_code'] as string}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Fallback Flat List for any domain without subgroups */
                    <div className="bg-surface rounded-2xl border border-default p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.keys(activeGroupMeta?.settings || {}).map((key) => {
                        const meta = activeGroupMeta?.settings[key];
                        if (!meta) return null;

                        const isWideField =
                          SEGMENTED_OPTIONS[key] !== undefined ||
                          meta.type === 'json' ||
                          key.endsWith('_channels') ||
                          key === 'allowed_payment_methods' ||
                          key === 'brand_logo_url' ||
                          key === 'brand_favicon_url' ||
                          (key.endsWith('_url') && !key.includes('api')) ||
                          key.includes('address') ||
                          key.includes('note') ||
                          key.includes('tagline') ||
                          key.includes('message');

                        return (
                          <div
                            key={key}
                            id={`setting-field-${key}`}
                            className={cn(
                              'transition-all',
                              isWideField ? 'col-span-1 md:col-span-2' : 'col-span-1'
                            )}
                          >
                            <SettingFieldDispatcher
                              settingKey={key}
                              meta={meta}
                              value={formValues[key]}
                              onChange={(val) =>
                                setFormValues((prev) => ({ ...prev, [key]: val as SettingFieldValue }))
                              }
                              currencySymbol={formValues['currency_symbol'] as string}
                              currencyCode={formValues['currency_code'] as string}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Unsaved Changes Bottom Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-raised text-default px-6 py-3.5 rounded-2xl shadow-overlay border border-default flex items-center gap-6 animate-rise-in backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold">
              You have <span className="text-primary font-bold">{changedKeys.length}</span> unsaved{' '}
              {changedKeys.length === 1 ? 'change' : 'changes'} in this domain.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormValues(initialValues);
                notify.info('All unsaved modifications discarded');
              }}
              disabled={saving}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
            >
              <Save className="size-3.5 mr-1.5" />
              Save Changes (Ctrl+S)
            </Button>
          </div>
        </div>
      )}

      {/* Global Omni-Search Modal */}
      <SettingsOmniSearch
        isOpen={omniSearchOpen}
        onClose={() => setOmniSearchOpen(false)}
        schema={schema}
        formValues={formValues}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Test Connection Modal */}
      <Modal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Live Connection Diagnostics"
      >
        <div className="space-y-4 text-xs">
          <p className="text-muted">
            Send an instant test ping to the API server using your active credentials to verify authentication and latency.
          </p>

          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
              Gateway Provider
            </label>
            <SelectDropdown
              options={[
                { value: 'steadfast', label: 'Steadfast Courier API' },
                { value: 'pathao', label: 'Pathao Courier & Parcel API' },
                { value: 'redx', label: 'REDX Express Logistics' },
                { value: 'bkash', label: 'bKash Tokenized Checkout' },
                { value: 'sslcommerz', label: 'SSLCommerz Payment Gateway' },
              ]}
              value={testProvider}
              onChange={(val) => setTestProvider(val)}
              size="md"
              buttonClassName="w-full"
            />
          </div>

          {testResult && (
            <div
              className={cn(
                'p-4 rounded-xl border space-y-1',
                testResult.success
                  ? 'bg-success-subtle border-success text-success'
                  : 'bg-danger-subtle border-danger text-danger'
              )}
            >
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? (
                  <Check className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                <span>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</span>
              </div>
              <p className="text-2xs opacity-90">{testResult.message}</p>
              {testResult.latency_ms !== undefined && (
                <span className="font-mono text-2xs block">
                  Response latency: {testResult.latency_ms}ms
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setTestModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunTestConnection}
              loading={testLoading}
            >
              Run Diagnostic Ping
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Group Confirmation Dialog */}
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetToDefault}
        title={`Reset ${GROUP_LABELS[activeGroup] || activeGroup} to Factory Defaults?`}
        message="All customized parameters in this domain will be restored to system defaults. This operation is permanent and recorded in the audit log."
        confirmLabel="Reset to Defaults"
        variant="danger"
        loading={saving}
      />

      {/* Add Domain Modal */}
      <Modal
        open={addDomainModalOpen}
        onClose={() => setAddDomainModalOpen(false)}
        title="Register Custom Storefront Domain"
      >
        <form onSubmit={handleAddDomain} className="space-y-4 text-xs">
          <p className="text-muted">
            Enter your custom domain or subdomain (e.g. <span className="font-mono text-default">shop.yourbrand.com</span>). You will be issued DNS TXT and CNAME verification records.
          </p>

          <FormGroup label="Domain Name" required>
            <Input
              type="text"
              placeholder="e.g. store.yourcompany.com"
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
              required
            />
          </FormGroup>

          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
              Domain Role
            </label>
            <SelectDropdown
              options={[
                { value: 'custom_alias', label: 'Domain Alias (Secondary Brand Routing)' },
                { value: 'custom_primary', label: 'Primary Domain (Canonical Storefront URL)' },
              ]}
              value={newDomainType}
              onChange={(val) => setNewDomainType(val as 'custom_primary' | 'custom_alias')}
              size="md"
              buttonClassName="w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setAddDomainModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={domainActionLoading === -1}>
              Generate DNS Verification
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Domain Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmDeleteDomain)}
        onClose={() => setConfirmDeleteDomain(null)}
        onConfirm={handleDeleteDomain}
        title={`Remove Domain "${confirmDeleteDomain?.domain}"?`}
        message="This domain will immediately cease resolving to your e-commerce storefront. Active SSL certificates for this host will be decommissioned."
        confirmLabel="Remove Domain"
        variant="danger"
        loading={domainActionLoading === confirmDeleteDomain?.id}
      />
    </div>
  );
};
