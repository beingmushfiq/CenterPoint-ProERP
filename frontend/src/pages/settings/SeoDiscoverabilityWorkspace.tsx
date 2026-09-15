import React, { useState, useEffect } from 'react';
import {
  Globe,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Send,
  Sliders,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Save,
  Radio,
  FileCode,
  ArrowRight,
  Check,
  RotateCcw,
  ChevronLeft,
  Copy,
  Eye,
  Download,
  X,
  Power,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { SerpPreviewCard } from '../../components/seo/SerpPreviewCard';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { notify } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';

interface SeoSettingsState {
  default_title_template: string;
  default_meta_description: string;
  meta_keywords: string;
  canonical_base_url: string;
  allow_ai_crawlers: boolean;
  business_type: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  telephone: string;
  email: string;
  opening_hours: string;
  robots_txt_custom: string;
  indexnow_api_key: string;
  indexnow_key_location: string;
  sitemap_ping_enabled: boolean;
  last_indexnow_ping_at: string | null;
}

interface RedirectItem {
  id: number;
  source_path: string;
  target_path: string;
  status_code: number;
  is_active: boolean;
  hits_count: number;
  last_hit_at: string | null;
}

interface NotFoundLogItem {
  id: number;
  path: string;
  ip_address: string;
  referrer: string | null;
  hits_count: number;
  resolved: boolean;
  created_at: string;
}

interface AuditCheck {
  key?: string;
  name?: string;
  title?: string;
  category?: string;
  passed: boolean;
  importance?: string;
  message?: string;
  details?: string;
  weight?: number;
}

interface SeoAuditResult {
  score: number;
  grade?: string;
  summary?: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    online_products_count: number;
  };
  checks?: AuditCheck[];
  checklist?: AuditCheck[];
}

type SeoTab = 'metadata' | 'nap' | 'redirects' | '404s' | 'indexnow' | 'audit';

interface SeoDiscoverabilityWorkspaceProps {
  onBackToHub?: () => void;
}

export const SeoDiscoverabilityWorkspace: React.FC<SeoDiscoverabilityWorkspaceProps> = ({
  onBackToHub,
}) => {
  const [activeTab, setActiveTab] = useWorkspaceTab<SeoTab>(
    'metadata',
    ['metadata', 'nap', 'redirects', '404s', 'indexnow', 'audit'] as const,
    'seo_tab'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<SeoSettingsState>({
    default_title_template: '{title} | {brand}',
    default_meta_description: 'Direct factory commercial storefront with verified quality and instant order fulfillment.',
    meta_keywords: 'factory wholesale, direct manufacturing, online shopping',
    canonical_base_url: '',
    allow_ai_crawlers: true,
    business_type: 'LocalBusiness',
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'BD',
    latitude: '',
    longitude: '',
    telephone: '',
    email: '',
    opening_hours: 'Mo-Sa 09:00-18:00',
    robots_txt_custom: '',
    indexnow_api_key: '',
    indexnow_key_location: '',
    sitemap_ping_enabled: true,
    last_indexnow_ping_at: null,
  });

  // Redirects & 404 States
  const [redirects, setRedirects] = useState<RedirectItem[]>([]);
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newStatusCode, setNewStatusCode] = useState<number>(301);
  const [creatingRedirect, setCreatingRedirect] = useState(false);

  const [notFoundLogs, setNotFoundLogs] = useState<NotFoundLogItem[]>([]);
  const [auditResult, setAuditResult] = useState<SeoAuditResult | null>(null);

  // IndexNow Broadcast URL list
  const [pingUrls, setPingUrls] = useState('');
  const [pinging, setPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  // XML Inspector Modal State
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    path: string;
    content: string;
    loading: boolean;
  }>({
    isOpen: false,
    title: '',
    path: '',
    content: '',
    loading: false,
  });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [sitemapStatuses, setSitemapStatuses] = useState<Record<string, 'live' | 'checking' | 'error'>>({});

  useEffect(() => {
    if (activeTab !== 'indexnow') return;

    const paths = ['/sitemap.xml', '/sitemap-products.xml', '/sitemap-categories.xml', '/sitemap-pages.xml', '/robots.txt'];

    const run = async () => {
      const checking: Record<string, 'live' | 'checking' | 'error'> = {};
      for (const p of paths) {
        checking[p] = 'checking';
      }
      setSitemapStatuses({ ...checking });

      const newStatuses: Record<string, 'live' | 'checking' | 'error'> = { ...checking };
      await Promise.all(
        paths.map(async (p) => {
          try {
            const res = await fetch(p);
            newStatuses[p] = res.ok ? 'live' : 'error';
          } catch {
            newStatuses[p] = 'error';
          }
        })
      );
      setSitemapStatuses({ ...newStatuses });
    };

    void run();
  }, [activeTab]);

  const handleInspectXml = async (title: string, path: string) => {
    setPreviewModal({
      isOpen: true,
      title,
      path,
      content: '',
      loading: true,
    });
    try {
      const res = await fetch(path);
      const text = await res.text();
      setPreviewModal((prev) => ({
        ...prev,
        content: text,
        loading: false,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch content';
      setPreviewModal((prev) => ({
        ...prev,
        content: `Error loading content: ${msg}`,
        loading: false,
      }));
    }
  };

  const handleCopyUrl = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    void navigator.clipboard.writeText(fullUrl);
    setCopiedPath(path);
    notify.success(`Copied ${path} link to clipboard`);
    setTimeout(() => setCopiedPath(null), 2500);
  };

  const handleDownloadXml = (_title: string, path: string, content: string) => {
    const blob = new Blob([content], { type: path.endsWith('.txt') ? 'text/plain' : 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.replace(/^\//, '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success(`Downloaded ${path}`);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, redirectsRes, notFoundRes, auditRes] = await Promise.allSettled([
        api.get<{ data: SeoSettingsState }>('/storefront/seo/settings'),
        api.get<{ data: RedirectItem[] }>('/storefront/redirects'),
        api.get<{ data: NotFoundLogItem[] }>('/storefront/redirects/404-logs'),
        api.get<{ data: SeoAuditResult }>('/storefront/seo/audit'),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.data.data) {
        setSettings((prev) => ({ ...prev, ...settingsRes.value.data.data }));
      }
      if (redirectsRes.status === 'fulfilled') {
        setRedirects(redirectsRes.value.data.data || []);
      }
      if (notFoundRes.status === 'fulfilled') {
        setNotFoundLogs(notFoundRes.value.data.data || []);
      }
      if (auditRes.status === 'fulfilled') {
        setAuditResult(auditRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to load SEO data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void fetchAllData();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/storefront/seo/settings', settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      notify.success('SEO settings saved successfully');
      // Refresh audit
      const auditRes = await api.get<{ data: SeoAuditResult }>('/storefront/seo/audit');
      setAuditResult(auditRes.data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save SEO settings';
      notify.error('Failed to save SEO settings', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource || !newTarget) return;
    setCreatingRedirect(true);
    try {
      const res = await api.post<{ data: RedirectItem }>('/storefront/redirects', {
        source_path: newSource,
        target_path: newTarget,
        status_code: newStatusCode,
        is_active: true,
      });
      setRedirects([res.data.data, ...redirects]);
      setNewSource('');
      setNewTarget('');
      notify.success('Redirect rule created');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create redirect';
      notify.error('Failed to create redirect', { description: msg });
    } finally {
      setCreatingRedirect(false);
    }
  };

  const handleToggleRedirectActive = async (redirect: RedirectItem) => {
    try {
      const res = await api.put<{ data: RedirectItem }>(`/storefront/redirects/${redirect.id}`, {
        source_path: redirect.source_path,
        target_path: redirect.target_path,
        status_code: redirect.status_code,
        is_active: !redirect.is_active,
      });
      setRedirects(redirects.map((r) => (r.id === redirect.id ? res.data.data : r)));
      notify.success('Redirect rule updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update redirect';
      notify.error('Failed to update redirect', { description: msg });
    }
  };

  const handleDeleteRedirect = async (id: number) => {
    if (!confirm('Are you sure you want to delete this redirect?')) return;
    try {
      await api.delete(`/storefront/redirects/${id}`);
      setRedirects(redirects.filter((r) => r.id !== id));
      notify.info('Redirect rule deleted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete redirect';
      notify.error('Failed to delete redirect', { description: msg });
    }
  };

  const handleFixNotFound = async (log: NotFoundLogItem) => {
    const target = prompt(`Enter target URL for ${log.path}:`, '/');
    if (!target) return;
    try {
      await api.post(`/storefront/redirects/404-logs/${log.id}/resolve`, {
        target_path: target,
        status_code: 301,
      });
      fetchAllData();
      notify.success('404 URL resolved with 301 redirect');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve 404 log';
      notify.error('Failed to resolve 404 log', { description: msg });
    }
  };

  const handleIndexNowPing = async () => {
    const urlList = pingUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urlList.length === 0) {
      notify.warning('Please enter at least one full URL to broadcast (e.g. https://yourdomain.com/products/item-1).');
      return;
    }

    setPinging(true);
    setPingStatus(null);
    try {
      const res = await api.post<{ message: string; submitted_urls: string[] }>('/storefront/seo/indexnow/ping', {
        urls: urlList,
      });

      setPingStatus(`Successfully submitted ${res.data.submitted_urls.length} URLs to IndexNow search engine nodes.`);
      notify.success(`Broadcasted ${res.data.submitted_urls.length} URLs to IndexNow`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setPingStatus(`IndexNow ping failed: ${msg}`);
      notify.error('IndexNow ping failed', { description: msg });
    } finally {
      setPinging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-semibold text-muted">Loading Discoverability Architecture...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-default bg-surface p-5 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-linear-to-br from-teal-600 to-primary text-white font-bold shadow-md ring-4 ring-primary/15 shrink-0">
              <Compass className="size-6 sm:size-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-default tracking-tight">
                  SEO, AI Search & Discoverability Engine
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-primary border border-primary/20">
                  <Sparkles className="size-3" />
                  SEO / GEO / AEO Platform
                </span>
              </div>
              <p className="text-xs text-muted max-w-2xl leading-relaxed">
                Enterprise search discoverability control plane. Manage structured data, local entity graphs,
                AI crawler access, 301 redirects, and IndexNow instant publishing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onBackToHub && (
              <Button variant="secondary" size="sm" onClick={onBackToHub}>
                <ChevronLeft className="size-3.5 mr-1" />
                Back to Hub
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className="text-left rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs hover:border-primary/40 hover:bg-surface-sunken/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
              Health Score
            </span>
            <ShieldCheck className="size-3 text-muted group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {auditResult ? `${auditResult.score}%` : '—'}
          </div>
          <span className="text-[11px] text-muted block">Audited search readiness</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('nap')}
          className="text-left rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs hover:border-primary/40 hover:bg-surface-sunken/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
              Schema Entity
            </span>
            <Globe className="size-3 text-muted group-hover:text-primary transition-colors" />
          </div>
          <div className="text-base font-extrabold text-default truncate mt-1">
            {settings.business_type}
          </div>
          <span className="text-[11px] text-muted block">JSON-LD structured NAP</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('redirects')}
          className="text-left rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs hover:border-primary/40 hover:bg-surface-sunken/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
              URL Redirects
            </span>
            <ArrowRight className="size-3 text-muted group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">
            {redirects.length}
          </div>
          <span className="text-[11px] text-muted block">Active 301 / 302 rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('404s')}
          className="text-left rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs hover:border-primary/40 hover:bg-surface-sunken/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
              404 Error Log
            </span>
            <AlertTriangle className="size-3 text-muted group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">
            {notFoundLogs.length}
          </div>
          <span className="text-[11px] text-muted block">Missing link traces</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('metadata')}
          className="text-left rounded-2xl border border-default bg-surface p-4 space-y-1 shadow-2xs hover:border-primary/40 hover:bg-surface-sunken/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-primary transition-colors">
              AI Crawlers
            </span>
            <Compass className="size-3 text-muted group-hover:text-primary transition-colors" />
          </div>
          <div className="text-base font-extrabold text-primary truncate mt-1">
            {settings.allow_ai_crawlers ? 'Active' : 'Blocked'}
          </div>
          <span className="text-[11px] text-muted block">AEO generative discovery</span>
        </button>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-default pb-3">
        {([
          { id: 'metadata', label: 'Meta & Canonical', icon: Sliders },
          { id: 'nap', label: 'Local Business & Entity (NAP)', icon: Globe },
          { id: 'redirects', label: `URL Redirects (${redirects.length})`, icon: ArrowRight },
          { id: '404s', label: `404 Error Log (${notFoundLogs.length})`, icon: AlertTriangle },
          { id: 'indexnow', label: 'IndexNow & Sitemaps', icon: Radio },
          { id: 'audit', label: 'Discoverability Audit', icon: ShieldCheck },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-fg shadow-xs font-bold'
                  : 'bg-surface border border-default text-muted hover:text-default hover:bg-surface-sunken'
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Meta & Canonical */}
      {activeTab === 'metadata' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5 rounded-2xl border border-default bg-surface p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-default">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sliders className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold text-default">
                    Global Metadata & Template Defaults
                  </h3>
                </div>
                <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default px-2 py-0.5 rounded-md select-none">
                  Core SEO Directives
                </span>
              </div>

              <div className="space-y-4">
                {/* Field 1: Title Pattern Template */}
                <div className="group rounded-xl border border-default bg-surface p-4 transition-all duration-200 hover:border-default hover:shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="field-title-template"
                      className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer"
                    >
                      <Sliders className="size-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
                      <span>Default Title Pattern Template</span>
                    </label>
                    <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default/60 px-2 py-0.5 rounded-md select-none shrink-0">
                      SERP Title
                    </span>
                  </div>

                  <input
                    id="field-title-template"
                    type="text"
                    value={settings.default_title_template}
                    onChange={(e) => setSettings({ ...settings, default_title_template: e.target.value })}
                    placeholder="{title} | {brand}"
                    className="w-full rounded-lg border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-mono font-medium text-default placeholder:text-muted/50 transition-all focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />

                  <div className="flex items-center gap-1.5 text-[11px] text-muted flex-wrap">
                    <span>Click variable to append:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!settings.default_title_template.includes('{title}')) {
                          setSettings({
                            ...settings,
                            default_title_template: `${settings.default_title_template} {title}`.trim(),
                          });
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-3xs font-mono font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {'{title}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!settings.default_title_template.includes('{brand}')) {
                          setSettings({
                            ...settings,
                            default_title_template: `${settings.default_title_template} | {brand}`.trim(),
                          });
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-3xs font-mono font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {'{brand}'}
                    </button>
                  </div>
                </div>

                {/* Field 2: Meta Description */}
                <div className="group rounded-xl border border-default bg-surface p-4 transition-all duration-200 hover:border-default hover:shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="field-meta-desc"
                      className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer"
                    >
                      <Globe className="size-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
                      <span>Storefront Fallback Meta Description</span>
                    </label>
                    <span
                      className={cn(
                        'text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border select-none shrink-0',
                        settings.default_meta_description?.length >= 120 &&
                          settings.default_meta_description?.length <= 160
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-muted bg-surface-sunken border-default/60'
                      )}
                    >
                      {settings.default_meta_description?.length || 0} / 160 chars
                    </span>
                  </div>

                  <textarea
                    id="field-meta-desc"
                    rows={3}
                    value={settings.default_meta_description}
                    onChange={(e) => setSettings({ ...settings, default_meta_description: e.target.value })}
                    placeholder="Describe your factory and direct catalog value proposition..."
                    className="w-full rounded-lg border border-default bg-surface-sunken/40 p-2.5 text-xs font-medium text-default placeholder:text-muted/50 transition-all focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 resize-none leading-relaxed"
                  />

                  <p className="text-[11px] text-muted leading-relaxed">
                    Optimal length is between 120 and 160 characters. Displayed on Google, Bing, and AI search results when specific product description is absent.
                  </p>
                </div>

                {/* Field 3: Canonical Base URL */}
                <div className="group rounded-xl border border-default bg-surface p-4 transition-all duration-200 hover:border-default hover:shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="field-canonical-url"
                      className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer"
                    >
                      <Globe className="size-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
                      <span>Canonical Domain Override (Optional)</span>
                    </label>
                    <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default/60 px-2 py-0.5 rounded-md select-none shrink-0">
                      Canonical Link
                    </span>
                  </div>

                  <input
                    id="field-canonical-url"
                    type="text"
                    value={settings.canonical_base_url}
                    onChange={(e) => setSettings({ ...settings, canonical_base_url: e.target.value })}
                    placeholder="https://yourcustomdomain.com"
                    className="w-full rounded-lg border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-mono font-medium text-default placeholder:text-muted/50 transition-all focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />

                  <p className="text-[11px] text-muted leading-relaxed">
                    If configured with a custom domain, leave blank to auto-detect verified primary domain.
                  </p>
                </div>

                {/* Field 4: AI Search Engines & Crawler Indexing */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.allow_ai_crawlers}
                  onClick={() => setSettings({ ...settings, allow_ai_crawlers: !settings.allow_ai_crawlers })}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4',
                    settings.allow_ai_crawlers
                      ? 'border-primary/40 bg-primary/5 hover:border-primary/60'
                      : 'border-default bg-surface hover:border-default hover:bg-surface-sunken/30'
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Compass className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-default">
                        AI Search Engines & Crawler Indexing
                      </span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Allow GPTBot, PerplexityBot, ClaudeBot and CCBot to discover and cite your product specifications in AI answer engines.
                    </p>
                  </div>

                  <div
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out',
                      settings.allow_ai_crawlers ? 'bg-primary' : 'bg-surface-sunken border border-default'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none flex size-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out items-center justify-center',
                        settings.allow_ai_crawlers ? 'translate-x-6' : 'translate-x-1'
                      )}
                    >
                      {settings.allow_ai_crawlers && <Check className="size-2.5 text-primary" />}
                    </span>
                  </div>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={saving}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Meta Configuration
                </Button>
                {saveSuccess && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    <span>Settings Saved Successfully</span>
                  </span>
                )}
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <SerpPreviewCard
                title={settings.default_title_template
                  .replace('{title}', 'Homepage Direct Factory')
                  .replace('{brand}', 'Slice Mart')}
                description={settings.default_meta_description}
                urlPath="/"
              />
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: NAP & Entity */}
      {activeTab === 'nap' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Globe className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-default">
                  Local Business (NAP) & Physical Facility Entity Data
                </h3>
              </div>
              <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default px-2 py-0.5 rounded-md select-none">
                Schema.org JSON-LD
              </span>
            </div>

            <p className="text-xs text-muted">
              This entity schema grounds search engines and AI agents with precise corporate and factory location facts.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-default block">
                  Schema Business Type
                </label>
                <SelectDropdown
                  options={[
                    { value: 'LocalBusiness', label: 'LocalBusiness (General)' },
                    { value: 'WholesaleStore', label: 'WholesaleStore' },
                    { value: 'Store', label: 'Store' },
                    { value: 'Organization', label: 'Organization' },
                    { value: 'Manufacturer', label: 'Manufacturer' },
                  ]}
                  value={settings.business_type}
                  onChange={(val) => setSettings({ ...settings, business_type: val })}
                  size="md"
                  buttonClassName="w-full"
                  aria-label="Schema business type"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Street Address</label>
                <input
                  type="text"
                  value={settings.street_address}
                  onChange={(e) => setSettings({ ...settings, street_address: e.target.value })}
                  placeholder="Plot 42, Industrial Zone"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">City / Division</label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                  placeholder="Dhaka"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">State / Region</label>
                <input
                  type="text"
                  value={settings.state}
                  onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                  placeholder="Dhaka"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Postal Code</label>
                <input
                  type="text"
                  value={settings.postal_code}
                  onChange={(e) => setSettings({ ...settings, postal_code: e.target.value })}
                  placeholder="1212"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-mono font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Country Code</label>
                <input
                  type="text"
                  value={settings.country}
                  onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                  placeholder="BD"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-mono font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Official Telephone</label>
                <input
                  type="text"
                  value={settings.telephone}
                  onChange={(e) => setSettings({ ...settings, telephone: e.target.value })}
                  placeholder="+8801700000000"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-mono font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Contact Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="support@yourdomain.com"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Opening Hours (ISO format)</label>
                <input
                  type="text"
                  value={settings.opening_hours}
                  onChange={(e) => setSettings({ ...settings, opening_hours: e.target.value })}
                  placeholder="Mo-Sa 09:00-18:00"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 text-xs font-medium text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={saving}
              >
                <Save className="size-3.5 mr-1.5" />
                Save Entity Information
              </Button>
              {saveSuccess && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>Entity Data Updated</span>
                </span>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: URL Redirects */}
      {activeTab === 'redirects' && (
        <div className="space-y-6">
          {/* Create Redirect Card */}
          <form
            onSubmit={handleCreateRedirect}
            className="rounded-2xl border border-default bg-surface p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-default">
              <Plus className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-default">
                Add Permanent (301) / Temporary (302) URL Redirect
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-4 space-y-1">
                <label className="font-semibold text-default block">Source Path (Old URL)</label>
                <input
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="/old-product-slug"
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 font-mono text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="font-semibold text-default block">Target Path (New URL)</label>
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="/products/new-canonical-slug"
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 px-3 py-2 font-mono text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-default block">Status Code</label>
                <SelectDropdown
                  options={[
                    { value: 301, label: '301 Permanent' },
                    { value: 302, label: '302 Temporary' },
                  ]}
                  value={newStatusCode}
                  onChange={(val) => setNewStatusCode(Number(val))}
                  size="md"
                  buttonClassName="w-full font-mono"
                  aria-label="Redirect status code"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={creatingRedirect}
                  className="w-full justify-center"
                >
                  <Plus className="size-3.5 mr-1" />
                  <span>Add Rule</span>
                </Button>
              </div>
            </div>
          </form>

          {/* Existing Redirects Table */}
          <div className="rounded-2xl border border-default bg-surface overflow-hidden shadow-xs">
            <div className="p-4 border-b border-default flex items-center justify-between">
              <h3 className="text-xs font-bold text-default uppercase tracking-wider">
                Configured URL Redirects ({redirects.length})
              </h3>
            </div>

            {redirects.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No custom URL redirects created yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-default bg-surface-sunken text-muted">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Source Path</th>
                      <th className="py-3 px-4 font-semibold">Target Path</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Hits Count</th>
                      <th className="py-3 px-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {redirects.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-sunken/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-default">
                          {r.source_path}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {r.target_path}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-sunken border border-default text-default">
                            {r.status_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted">{r.hits_count}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleRedirectActive(r)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer mr-1 ${
                              r.is_active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-muted hover:bg-surface-sunken'
                            }`}
                            title={r.is_active ? 'Deactivate redirect' : 'Activate redirect'}
                            aria-label={`Toggle redirect ${r.source_path}`}
                          >
                            <Power className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRedirect(r.id)}
                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                            title="Delete redirect"
                            aria-label={`Delete redirect ${r.source_path}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: 404 Logs */}
      {activeTab === '404s' && (
        <div className="rounded-2xl border border-default bg-surface overflow-hidden shadow-xs">
          <div className="p-4 border-b border-default">
            <h3 className="text-xs font-bold text-default uppercase tracking-wider">
              Unresolved 404 Page Not Found Logs ({notFoundLogs.length})
            </h3>
            <p className="text-[11px] text-muted mt-0.5">
              Instantly convert broken links into 301 redirects to preserve link equity and search crawler authority.
            </p>
          </div>

          {notFoundLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No recent 404 not found errors logged. Storefront links are healthy!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-default bg-surface-sunken text-muted">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Missing Path</th>
                    <th className="py-3 px-4 font-semibold">Hits Count</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Auto-Fix Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {notFoundLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-danger">{log.path}</td>
                      <td className="py-3 px-4 font-mono text-muted">{log.hits_count}</td>
                      <td className="py-3 px-4">
                        {log.resolved ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Resolved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Broken Link
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!log.resolved && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleFixNotFound(log)}
                          >
                            <ArrowRight className="size-3 mr-1" />
                            <span>Create 301 Redirect</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: IndexNow & Sitemaps */}
      {activeTab === 'indexnow' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* IndexNow Ping */}
          <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-default">
              <Radio className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-default">
                IndexNow Instant Search Engine Publishing
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Instantly notify Microsoft Bing, Yandex, Seznam, and participating AI search engines whenever you add new products or update catalog content.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-default block">
                  Specific URLs to Broadcast (One per line, optional)
                </label>
                <textarea
                  rows={4}
                  value={pingUrls}
                  onChange={(e) => setPingUrls(e.target.value)}
                  placeholder="https://yourdomain.com/products/item-123&#10;https://yourdomain.com/products/item-456"
                  className="w-full rounded-xl border border-default bg-surface-sunken/40 p-3 font-mono text-default focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleIndexNowPing}
                loading={pinging}
              >
                <Send className="size-3.5 mr-1.5" />
                <span>Broadcast to IndexNow Network</span>
              </Button>

              {pingStatus && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default text-xs font-medium text-default">
                  {pingStatus}
                </div>
              )}
            </div>
          </div>

          {/* Sitemaps Direct Links */}
          <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-default">
              <FileCode className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-default">
                Automated XML Sitemaps
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Standard XML sitemaps partitioned for optimal crawl performance with Google Search Console and Bing Webmaster Tools.
            </p>

            <div className="space-y-2 text-xs">
              {[
                { title: 'Master Sitemap Index', path: '/sitemap.xml', desc: 'Auto-aggregates all category and product sub-sitemaps' },
                { title: 'Products Sitemap', path: '/sitemap-products.xml', desc: 'Complete catalog of active online SKUs with images' },
                { title: 'Categories Sitemap', path: '/sitemap-categories.xml', desc: 'All public collections and departments' },
                { title: 'CMS Pages Sitemap', path: '/sitemap-pages.xml', desc: 'Custom storefront and legal pages' },
                { title: 'Robots.txt Directive', path: '/robots.txt', desc: 'Dynamic crawler whitelist & sitemap link' },
              ].map((s, idx) => {
                const status = sitemapStatuses[s.path] || 'checking';
                return (
                  <div key={idx} className="grid grid-cols-[1fr_auto] items-center gap-4 px-3.5 py-2.5 rounded-xl bg-surface-sunken/50 border border-default hover:border-default/70 transition-colors">
                    {/* Left: info */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-default truncate">{s.title}</span>
                        {status === 'live' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                        {status === 'checking' && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20 shrink-0">
                            Checking…
                          </span>
                        )}
                        {status === 'error' && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                            Error
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] text-primary/70 shrink-0">{s.path}</span>
                        <span className="text-muted/40 shrink-0">·</span>
                        <span className="text-[10px] text-muted truncate">{s.desc}</span>
                      </div>
                    </div>

                    {/* Right: actions — always in one row */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(s.path)}
                        title="Copy URL"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-default hover:bg-surface border border-transparent hover:border-default transition-all cursor-pointer"
                      >
                        {copiedPath === s.path ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        <span>{copiedPath === s.path ? 'Copied' : 'Copy URL'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInspectXml(s.title, s.path)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-default bg-surface-sunken hover:bg-surface-raised border border-default transition-all cursor-pointer"
                      >
                        <Eye className="size-3" />
                        <span>Inspect</span>
                      </button>

                      <a
                        href={s.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-primary bg-primary/8 hover:bg-primary/15 border border-primary/15 transition-all shrink-0"
                      >
                        <span>View Raw</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Audit */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-default flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-default flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span>Live Discoverability Audit Report</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    {auditResult && (
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Score: {auditResult.score}/100 {auditResult.grade ? `(${auditResult.grade})` : ''}
                      </span>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await api.get<{ data: SeoAuditResult }>('/storefront/seo/audit');
                          setAuditResult(res.data.data);
                          notify.success('Audit report updated');
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : 'Failed to refresh audit';
                          notify.error('Failed to run audit', { description: msg });
                        }
                      }}
                    >
                      <RotateCcw className="size-3 mr-1" />
                      <span>Re-run Audit</span>
                    </Button>
                  </div>
                </div>

                {(!auditResult || ((auditResult.checklist?.length ?? 0) === 0 && (auditResult.checks?.length ?? 0) === 0)) ? (
                  <div className="p-8 text-center text-xs text-muted">
                    No audit records loaded yet. Click "Re-run Audit" above to run an instant analysis.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(auditResult.checklist || auditResult.checks || []).map((check: AuditCheck, idx: number) => {
                      const title = check.title || check.name || 'Discoverability Directive';
                      const details = check.details || check.message || '';
                      return (
                        <div
                          key={check.key || idx}
                          className="p-3.5 rounded-xl bg-surface-sunken/50 border border-default flex items-start gap-3 text-xs"
                        >
                          {check.passed ? (
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-default">{title}</span>
                              {check.category && (
                                <span className="text-[10px] text-muted bg-surface border border-default px-1.5 py-0.5 rounded font-medium">
                                  {check.category}
                                </span>
                              )}
                              {check.importance && (
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider',
                                    check.importance === 'high'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      : 'bg-surface border border-default text-muted'
                                  )}
                                >
                                  {check.importance}
                                </span>
                              )}
                            </div>
                            {details && <p className="text-[11px] text-muted leading-relaxed">{details}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-default bg-surface p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-default">
                  Discoverability Best Practices
                </h4>
                <ul className="space-y-2 text-xs text-muted list-disc list-inside leading-relaxed">
                  <li>Configure NAP street address and telephone to trigger rich local map packs.</li>
                  <li>Ensure all product images include descriptive alt attributes.</li>
                  <li>Keep title lengths under 60 characters to prevent SERP truncation.</li>
                  <li>Broadcast new products to IndexNow immediately upon publishing.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XML / Text Inspector Modal */}
      {previewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-default bg-surface-sunken/30 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCode className="size-4 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-default">{previewModal.title}</h3>
                  <span className="text-[11px] font-mono text-muted">{window.location.origin}{previewModal.path}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(previewModal.content);
                    notify.success('Copied content to clipboard');
                  }}
                  disabled={previewModal.loading}
                >
                  <Copy className="size-3 mr-1" />
                  <span>Copy</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadXml(previewModal.title, previewModal.path, previewModal.content)}
                  disabled={previewModal.loading}
                >
                  <Download className="size-3 mr-1" />
                  <span>Download</span>
                </Button>
                <a
                  href={previewModal.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold"
                >
                  <span>Open Tab</span>
                  <ExternalLink className="size-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken cursor-pointer transition-colors ml-2"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed selection:bg-emerald-800 selection:text-white min-h-64">
              {previewModal.loading ? (
                <div className="flex h-48 items-center justify-center text-muted">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-all">{previewModal.content}</pre>
              )}
            </div>

            <div className="p-3 border-t border-default bg-surface-sunken/40 flex items-center justify-between text-[11px] text-muted">
              <span>Path: {previewModal.path}</span>
              <span>Characters: {previewModal.content.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
