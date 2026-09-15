import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformFeatureFlag, PlatformTenant } from '../../types/api/platform';
import { ResponsiveDataTable } from '../../components/ui/ResponsiveDataTable';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { Button } from '../../components/ui/Button';
import {
  Flag,
  Search,
  RotateCcw,
  Plus,
  Building2,
  CheckCircle2,
  XCircle,
  Package,
  Layers,
  Trash2,
} from 'lucide-react';

interface ModuleRegistryItem {
  key: string;
  name: string;
  description: string;
  category: string;
  version: string;
  is_core: boolean;
  default_enabled: boolean;
  permissions: string[];
}

export const PlatformFeatureFlagsWorkspace: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'flags' | 'registry'>('flags');
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'global' | 'tenant'>('global');
  const [targetTenantId, setTargetTenantId] = useState<number | ''>('');
  const [rolloutPercentage, setRolloutPercentage] = useState<number>(100);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  // Fetch Tenants for scope assignment
  const { data: tenants = [] } = useQuery<PlatformTenant[]>({
    queryKey: ['platform', 'tenants', 'simple-list'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PlatformTenant[] } | PlatformTenant[]>('/platform/tenants?per_page=100');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Feature Flags
  const { data: flags = [], isLoading: flagsLoading, isFetching: flagsFetching, refetch: refetchFlags } = useQuery<PlatformFeatureFlag[]>({
    queryKey: ['platform', 'feature-flags', tenantFilter, search],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (tenantFilter !== 'all') params['tenant_id'] = tenantFilter;
      if (search) params['search'] = search;
      const res = await api.get<{ data: PlatformFeatureFlag[] } | PlatformFeatureFlag[]>('/platform/feature-flags', { params });
      if (Array.isArray(res.data)) return res.data;
      if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [];
    },
  });

  // Fetch Module Registry
  const { data: moduleRegistry = [], isLoading: registryLoading } = useQuery<ModuleRegistryItem[]>({
    queryKey: ['platform', 'module-registry'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: ModuleRegistryItem[] } | ModuleRegistryItem[]>('/platform/module-registry');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Toggle Flag Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await api.patch(`/platform/feature-flags/${id}`, { enabled });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Feature flag state toggled');
      queryClient.invalidateQueries({ queryKey: ['platform', 'feature-flags'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to toggle flag';
      toast.error(msg);
    },
  });

  // Delete Flag Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/platform/feature-flags/${id}`);
    },
    onSuccess: () => {
      toast.success('Feature flag deleted');
      queryClient.invalidateQueries({ queryKey: ['platform', 'feature-flags'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete feature flag';
      toast.error(msg);
    },
  });

  // Create Flag Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      key: string;
      description: string;
      tenant_id?: number;
      rollout_percentage?: number;
      enabled: boolean;
    }) => {
      const res = await api.post('/platform/feature-flags', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Feature flag defined successfully');
      setShowCreateModal(false);
      setKey('');
      setDescription('');
      setTargetTenantId('');
      setRolloutPercentage(100);
      setIsEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['platform', 'feature-flags'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create feature flag';
      toast.error(msg);
    },
  });

  const handleCreateFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) {
      toast.error('Flag key is required');
      return;
    }
    if (scope === 'tenant' && !targetTenantId) {
      toast.error('Target tenant required for tenant-scoped flag');
      return;
    }

    const payload: {
      key: string;
      description: string;
      tenant_id?: number;
      rollout_percentage: number;
      enabled: boolean;
    } = {
      key,
      description: description || `Feature flag ${key}`,
      rollout_percentage: rolloutPercentage,
      enabled: isEnabled,
    };
    if (scope === 'tenant' && targetTenantId) {
      payload.tenant_id = Number(targetTenantId);
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">Feature Flags & Module Registry</h1>
          <p className="text-xs text-muted mt-1 font-mono">
            Granular feature gating, staged rollouts, and enterprise application module catalog.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetchFlags()}
            disabled={flagsFetching}
            className="flex items-center gap-1.5 font-mono text-xs cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken"
          >
            <RotateCcw className={`size-3.5 ${flagsFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {activeTab === 'flags' && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              <Plus className="size-4" />
              <span>New Feature Flag</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-sunken p-1 rounded-xl border border-default max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab('flags')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
            activeTab === 'flags'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Flag className="size-3.5" />
          <span>Active Feature Flags</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
            activeTab === 'registry'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Package className="size-3.5" />
          <span>Module Registry</span>
        </button>
      </div>

      {activeTab === 'flags' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-surface border border-default flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search flags by key or description..."
                className="w-full bg-surface-sunken border border-default rounded-xl pl-9 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-amber-500 font-mono"
              />
            </div>

            <div className="w-52">
              <SelectDropdown
                value={tenantFilter}
                onChange={(val) => setTenantFilter(val)}
                options={[
                  { value: 'all', label: 'All Scopes & Tenants' },
                  ...tenants.map((t) => ({ value: String(t.id), label: t.name })),
                ]}
              />
            </div>
          </div>

          {/* Feature Flags Table */}
          <ResponsiveDataTable<PlatformFeatureFlag>
            data={flags}
            isLoading={flagsLoading}
            emptyMessage="No feature flags defined."
            keyExtractor={(flag) => flag.id}
            columns={[
              {
                key: 'key',
                header: 'Flag Key',
                priority: 'high',
                render: (flag) => <span className="font-bold text-default font-mono">{flag.key}</span>,
              },
              {
                key: 'scope',
                header: 'Scope',
                priority: 'high',
                render: (flag) => (
                  !flag.tenant_id ? (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-bold uppercase">
                      Global
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1 w-fit">
                      <Building2 className="size-2.5 shrink-0" />
                      <span>{flag.tenant?.name ?? `Tenant #${flag.tenant_id}`}</span>
                    </span>
                  )
                ),
              },
              {
                key: 'rollout',
                header: 'Rollout %',
                priority: 'medium',
                render: (flag) => (
                  <span className="font-bold text-default font-mono">
                    {flag.rollout_percentage != null ? `${flag.rollout_percentage}%` : '100%'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'State',
                priority: 'high',
                render: (flag) => (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      flag.enabled
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {flag.enabled ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
                    <span>{flag.enabled ? 'Enabled' : 'Disabled'}</span>
                  </span>
                ),
              },
              {
                key: 'description',
                header: 'Description',
                priority: 'low',
                render: (flag) => (
                  <span className="text-muted text-[11px] max-w-xs truncate block font-sans">
                    {flag.description || '—'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Toggle Action',
                priority: 'high',
                align: 'right',
                render: (flag) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        toggleMutation.mutate({
                          id: flag.id,
                          enabled: !flag.enabled,
                        })
                      }
                      disabled={toggleMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                        flag.enabled
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {flag.enabled ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete feature flag '${flag.key}'?`)) {
                          deleteMutation.mutate(flag.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      title="Delete Feature Flag"
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
            mobileCardRenderer={(flag) => ({
              title: flag.key,
              subtitle: !flag.tenant_id ? 'Global Scope' : (flag.tenant?.name ?? `Tenant #${flag.tenant_id}`),
              badge: (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    flag.enabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {flag.enabled ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
                  <span>{flag.enabled ? 'Active' : 'Off'}</span>
                </span>
              ),
              metrics: [
                {
                  label: 'Rollout',
                  value: `${flag.rollout_percentage != null ? flag.rollout_percentage : 100}%`,
                },
                {
                  label: 'Scope',
                  value: !flag.tenant_id ? 'Global' : 'Tenant',
                },
              ],
              details: flag.description ? (
                <p className="text-xs text-muted font-sans leading-relaxed pt-1">{flag.description}</p>
              ) : undefined,
              actions: (
                <button
                  type="button"
                  onClick={() =>
                    toggleMutation.mutate({
                      id: flag.id,
                      enabled: !flag.enabled,
                    })
                  }
                  disabled={toggleMutation.isPending}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors text-center ${
                    flag.enabled
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {flag.enabled ? 'Deactivate Feature' : 'Activate Feature'}
                </button>
              ),
            })}
          />
        </div>
      )}

      {activeTab === 'registry' && (
        <div className="rounded-2xl bg-surface border border-default shadow-xl overflow-hidden">
          <div className="p-4 border-b border-default bg-surface-sunken">
            <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
              Core Platform Enterprise Modules
            </h2>
            <p className="text-muted text-xs mt-0.5">
              Self-contained domain engines registered with the DevCenterPoint platform core.
            </p>
          </div>

          {registryLoading ? (
            <div className="p-12 text-center text-muted font-mono text-xs">
              Loading module catalog...
            </div>
          ) : moduleRegistry.length > 0 ? (
            <div className="divide-y divide-default font-mono text-xs">
              {moduleRegistry.map((mod) => (
                <div key={mod.key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-surface-sunken/60">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-default font-sans text-sm">{mod.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-default text-muted text-[10px]">
                        {mod.key}
                      </span>
                      {mod.is_core ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          CORE SYSTEM
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
                          COMMERCIAL ADDON
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-xs font-sans leading-relaxed">{mod.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted pt-1">
                      <span>Category: <strong className="text-default uppercase">{mod.category}</strong></span>
                      <span>Version: <strong className="text-default">{mod.version}</strong></span>
                      <span>Permissions: <strong className="text-default">{mod.permissions?.length ?? 0} defined</strong></span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                    <span className="px-2.5 py-1 rounded-full bg-surface-sunken border border-default text-muted text-[10px] font-bold flex items-center gap-1">
                      <Layers className="size-3 text-amber-500" />
                      <span>Ready</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted font-mono text-xs">
              No platform modules discovered in registry.
            </div>
          )}
        </div>
      )}

      {/* Create Flag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-muted/40 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="text-lg font-bold text-default font-sans">New Feature Flag</h2>
            <p className="text-muted mt-1">
              Configure flag identifier, target scope, and phased percentage rollout.
            </p>

            <form onSubmit={handleCreateFlag} className="mt-4 space-y-3">
              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Flag Key * (e.g. beta_ai_forecast)</label>
                <input
                  type="text"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  placeholder="module_key_or_feature"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain feature purpose..."
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-default mb-1 font-sans font-semibold">Scope</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'global' | 'tenant')}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="global">Global (Platform)</option>
                    <option value="tenant">Tenant Specific</option>
                  </select>
                </div>

                <div>
                  <label className="block text-default mb-1 font-sans font-semibold">Rollout % (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={rolloutPercentage}
                    onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {scope === 'tenant' && (
                <div>
                  <label className="block text-default mb-1 font-sans font-semibold">Target Tenant *</label>
                  <select
                    value={targetTenantId}
                    onChange={(e) => setTargetTenantId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="">Select a tenant...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isEnabledCheckbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded-sm border-default bg-surface-sunken text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isEnabledCheckbox" className="text-default cursor-pointer">
                  Activate flag immediately upon creation
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default cursor-pointer font-semibold text-center transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !key}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 text-center transition-colors shadow-xs"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformFeatureFlagsWorkspace;
