import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, setAccessToken } from '../../lib/api/client';
import type { PlatformTenant, PlatformPlan, PlatformPayment } from '../../types/api/platform';
import { PlatformPulseLoader } from '../../components/platform/PlatformPulseLoader';
import { Button } from '../../components/ui/Button';
import {
  Building2,
  CreditCard,
  Users,
  ArrowLeft,
  ExternalLink,
  Zap,
  ShieldAlert,
  Cpu,
  Key,
  Trash2,
  Sliders,
  Save,
  Lock,
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface TenantDetailPayload {
  tenant: PlatformTenant & {
    modules?: Array<{
      id: number;
      module_key: string;
      enabled: boolean;
      plan_allowed: boolean;
    }>;
    custom_limits?: Record<string, number | string>;
  };
  users: Array<{
    id: number;
    uuid: string;
    name: string;
    email: string;
    status: string;
    last_login_at?: string;
  }>;
  subscriptions: Array<{
    id: number;
    uuid: string;
    plan_id: number;
    plan?: { name: string };
    status: string;
    amount: number;
    starts_at: string;
    ends_at?: string;
  }>;
  usage_counters: Array<{
    metric: string;
    period: string;
    value: number;
  }>;
  recent_audit: Array<{
    id: number;
    action: string;
    actor_name: string;
    created_at: string;
    details?: Record<string, unknown>;
  }>;
}

const AVAILABLE_MODULES = [
  { key: 'pos', label: 'POS Terminal Engine', icon: ShoppingCart },
  { key: 'production', label: 'Production Batches & Routing', icon: Cpu },
  { key: 'qc', label: 'Quality Control & Rework', icon: ShieldAlert },
  { key: 'storefront', label: 'B2C E-Commerce Storefront', icon: Package },
  { key: 'multi_branch', label: 'Multi-Branch Scope', icon: Building2 },
  { key: 'accounting', label: 'Financials & Invoicing', icon: DollarSign },
];

export const TenantDetailWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'users' | 'usage' | 'authority'>('overview');

  // Action Modals
  const [modalType, setModalType] = useState<'status' | 'extend' | 'plan' | 'delete' | 'payment' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [extendMode, setExtendMode] = useState<'days' | 'date' | 'grace'>('days');
  const [extendDays, setExtendDays] = useState(30);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState(7);
  const [newPlanId, setNewPlanId] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Payment Recording State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('BDT');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Authority Overrides State
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, { enabled: boolean; plan_allowed: boolean }>>({});
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({
    max_users: 10,
    max_warehouses: 2,
    max_monthly_orders: 1000,
    max_products: 500,
  });
  const [ownerNewPassword, setOwnerNewPassword] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  const {
    data: detailData,
    isLoading: tenantLoading,
    error: queryError,
    refetch,
  } = useQuery<TenantDetailPayload | null>({
    queryKey: ['platform', 'tenant', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<{ data: TenantDetailPayload } | TenantDetailPayload>(`/platform/tenants/${id}`);
      const res = response.data;
      if ('data' in res && res.data && 'tenant' in res.data) {
        return res.data;
      } else if ('tenant' in res) {
        return res as TenantDetailPayload;
      } else {
        // Flatten fallback
        return {
          tenant: res as unknown as PlatformTenant,
          users: [],
          subscriptions: [],
          usage_counters: [],
          recent_audit: [],
        };
      }
    },
    enabled: Boolean(id),
    retry: 1,
  });

  const tenant = detailData?.tenant;
  const users = detailData?.users ?? [];
  const subscriptions = detailData?.subscriptions ?? [];

  const { data: plans = [] } = useQuery<PlatformPlan[]>({
    queryKey: ['platform', 'plans'],
    queryFn: async () => {
      try {
        const res = await api.get<PlatformPlan[]>('/platform/plans');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && Array.isArray((res.data as { data?: PlatformPlan[] }).data)) {
          return (res.data as { data: PlatformPlan[] }).data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery<PlatformPayment[]>({
    queryKey: ['platform', 'tenant', id, 'payments'],
    queryFn: async () => {
      if (!id) return [];
      try {
        const res = await api.get<{ data: PlatformPayment[] } | PlatformPayment[]>(`/platform/tenants/${id}/payments`);
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(id),
  });

  // Sync loaded modules & limits to state
  useEffect(() => {
    if (!tenant) return;
    const timer = setTimeout(() => {
      if (tenant.plan_id) setNewPlanId(tenant.plan_id);

      // Populate module overrides from tenant.modules
      const currentModules: Record<string, { enabled: boolean; plan_allowed: boolean }> = {};
      AVAILABLE_MODULES.forEach((m) => {
        const existing = tenant.modules?.find((mod) => mod.module_key === m.key);
        currentModules[m.key] = {
          enabled: existing ? existing.enabled : true,
          plan_allowed: existing ? existing.plan_allowed : true,
        };
      });
      setModuleOverrides(currentModules);

      // Populate custom limits
      if (tenant.custom_limits) {
        setCustomLimits({
          max_users: Number(tenant.custom_limits['max_users'] ?? 10),
          max_warehouses: Number(tenant.custom_limits['max_warehouses'] ?? 2),
          max_monthly_orders: Number(tenant.custom_limits['max_monthly_orders'] ?? 1000),
          max_products: Number(tenant.custom_limits['max_products'] ?? 500),
        });
      } else if (tenant.plan?.limits) {
        setCustomLimits({
          max_users: Number(tenant.plan.limits['max_users'] ?? 10),
          max_warehouses: Number(tenant.plan.limits['max_warehouses'] ?? 2),
          max_monthly_orders: Number(tenant.plan.limits['max_monthly_orders'] ?? 1000),
          max_products: Number(tenant.plan.limits['max_products'] ?? 500),
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [tenant]);

  const handleUpdateStatus = async (newStatus: 'active' | 'suspended') => {
    if (!tenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/platform/tenants/${tenant.id}/status`, {
        status: newStatus,
        reason: actionReason || (newStatus === 'suspended' ? 'Administrative suspension' : 'Reactivation approved'),
      });
      setModalType(null);
      setActionReason('');
      toast.success(`Tenant status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async (action: 'extend' | 'change_plan' | 'set_expiry' | 'set_grace_period') => {
    if (!tenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const payload: Record<string, unknown> = { action };
      if (action === 'extend') {
        payload['days'] = extendDays;
      } else if (action === 'set_expiry') {
        if (!customExpiryDate) throw new Error('Please select an expiry date');
        payload['ends_at'] = customExpiryDate;
      } else if (action === 'set_grace_period') {
        payload['grace_period_days'] = gracePeriodDays;
      } else if (action === 'change_plan') {
        payload['plan_id'] = newPlanId;
      }

      await api.post(`/platform/tenants/${tenant.id}/manage-subscription`, payload);
      setModalType(null);
      const msg = action === 'extend'
        ? `Subscription extended by ${extendDays} days`
        : action === 'set_expiry'
        ? `Subscription expiration set to ${customExpiryDate}`
        : action === 'set_grace_period'
        ? `Grace period set to ${gracePeriodDays} days`
        : 'Subscription plan updated';
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Subscription update failed';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openExtendModal = () => {
    setActionError(null);
    if (tenant?.subscription_ends_at) {
      setCustomExpiryDate(tenant.subscription_ends_at.substring(0, 10));
    } else if (tenant?.trial_ends_at) {
      setCustomExpiryDate(tenant.trial_ends_at.substring(0, 10));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setCustomExpiryDate(d.toISOString().substring(0, 10));
    }
    setGracePeriodDays(tenant?.grace_period_days ?? 7);
    setModalType('extend');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/platform/tenants/${tenant.id}/payments`, {
        amount: Number(paymentAmount),
        currency_code: paymentCurrency,
        payment_method: paymentMethod,
        transaction_reference: paymentRef || null,
        notes: paymentNotes || null,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'paid',
      });
      setModalType(null);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      toast.success('Subscription payment recorded successfully');
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!tenant) return;
    if (!confirm(`Launch diagnostic super-admin session for "${tenant.name}"?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post<{
        token: string;
        tenant: { id: number; name: string; slug: string };
        user: { id: number; name: string; email: string };
        impersonator: { id: number; name: string; email: string };
      }>(`/platform/tenants/${tenant.id}/impersonate`);

      const payload = res.data;
      const token = payload?.token;
      const targetTenant = payload?.tenant;
      const targetUser = payload?.user;
      const impersonator = payload?.impersonator;

      if (token) {
        setAccessToken(token);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('impersonation_token', token);
        }
      }
      localStorage.setItem('is_impersonating', 'true');
      localStorage.setItem('impersonated_tenant_name', targetTenant?.name ?? tenant.name);
      localStorage.setItem('impersonated_tenant_id', String(targetTenant?.id ?? tenant.id));
      localStorage.setItem('impersonator_email', impersonator?.email ?? '');
      if (targetUser) {
        localStorage.setItem('auth_user', JSON.stringify(targetUser));
      }
      if (targetTenant) {
        localStorage.setItem('auth_tenant', JSON.stringify(targetTenant));
      }

      toast.success(`Entering ${tenant.name}...`);
      window.location.assign('/catalogue');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impersonation failed';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveModuleOverrides = async () => {
    if (!tenant) return;
    setOverrideSaving(true);
    try {
      await api.post(`/platform/tenants/${tenant.id}/override-capabilities`, {
        modules: moduleOverrides,
      });
      toast.success('Module capability overrides applied to tenant.');
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save module overrides.';
      toast.error(msg);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleSaveQuotaOverrides = async () => {
    if (!tenant) return;
    setOverrideSaving(true);
    try {
      await api.post(`/platform/tenants/${tenant.id}/override-quotas`, {
        custom_limits: customLimits,
      });
      toast.success('Custom resource quotas saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save quotas.';
      toast.error(msg);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleResetOwnerPassword = async () => {
    if (!tenant || !ownerNewPassword) return;
    if (ownerNewPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    setOverrideSaving(true);
    try {
      const res = await api.post<{ data: { message: string } }>(`/platform/tenants/${tenant.id}/reset-password`, {
        password: ownerNewPassword,
      });
      toast.success(res.data?.data?.message || 'Owner password successfully overridden.');
      setOwnerNewPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      toast.error(msg);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenant) return;
    if (deleteConfirmation !== tenant.slug) {
      setActionError(`Please type "${tenant.slug}" to confirm deletion.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(`/platform/tenants/${tenant.id}`);
      toast.success(`Tenant ${tenant.name} purged from active fleet.`);
      navigate('/platform/tenants');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (tenantLoading && !tenant) {
    return (
      <div className="py-24">
        <PlatformPulseLoader
          label="Decrypting & Syncing Tenant Isolation State..."
          sublabel="Verifying tenant cryptographic credentials and license bounds"
        />
      </div>
    );
  }

  if (queryError) {
    const errorMsg = queryError instanceof Error ? queryError.message : 'Failed to load tenant record';
    return (
      <div className="p-12 text-center text-xs font-mono space-y-4 max-w-md mx-auto">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
          <p className="font-semibold mb-1 text-rose-200">Unable to load tenant #{id}</p>
          <p className="text-rose-400">{errorMsg}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Retry Query
          </Button>
          <Link
            to="/platform/tenants"
            className="text-xs text-amber-400 hover:text-amber-300 underline font-mono"
          >
            ← Return to Tenant Directory
          </Link>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-12 text-center text-muted text-xs font-mono space-y-3">
        <p>Tenant #{id} not found in master platform registry.</p>
        <Link
          to="/platform/tenants"
          className="text-xs text-amber-500 hover:underline font-mono inline-block"
        >
          ← Return to Tenant Directory
        </Link>
      </div>
    );
  }

  type DetailTabKey = 'overview' | 'billing' | 'users' | 'usage' | 'authority';
  const tabs: Array<{ key: DetailTabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'authority', label: 'Master Authority Overrides', icon: ShieldAlert },
    { key: 'billing', label: 'Billing & Subscriptions', icon: CreditCard },
    { key: 'users', label: 'Scoped Users', icon: Users },
    { key: 'usage', label: 'Usage & Quotas', icon: Sliders },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Back button */}
      <Link
        to="/platform/tenants"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-default transition-colors font-mono"
      >
        <ArrowLeft className="size-4" />
        <span>Back to Tenant Directory</span>
      </Link>

      {/* Header Profile Banner */}
      <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-surface-sunken border border-default flex items-center justify-center text-amber-500 font-bold shadow-inner">
            <Building2 className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-default">{tenant.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
                {tenant.plan?.name ?? 'Standard Plan'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  tenant.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : tenant.status === 'trial'
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                    : tenant.status === 'past_due'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                {tenant.effective_status ?? tenant.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted font-mono">
              <span>{tenant.slug}.devcenterpoint.com</span>
              <a
                href={`https://${tenant.slug}.devcenterpoint.com`}
                target="_blank"
                rel="noreferrer"
                className="text-subtle hover:text-amber-500 transition-colors"
                title="Launch Subdomain"
              >
                <ExternalLink className="size-3.5" />
              </a>
              <span>•</span>
              <span>Provisioned: {new Date(tenant.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <button
            onClick={handleImpersonate}
            disabled={actionLoading}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            <Zap className="size-4" />
            <span>Impersonate Tenant</span>
          </button>

          <button
            onClick={() => {
              setActionError(null);
              setModalType('plan');
            }}
            className="px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface text-default border border-default transition-all cursor-pointer"
          >
            Change Plan Tier
          </button>

          <button
            onClick={() => {
              setActionError(null);
              setModalType('status');
            }}
            className={`px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              tenant.status === 'active'
                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}
          >
            {tenant.status === 'active' ? 'Suspend Access' : 'Reactivate Access'}
          </button>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-default pb-2 overflow-x-auto font-mono text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                  : 'text-muted hover:text-default hover:bg-surface-sunken'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Master Authority Overrides */}
      {activeTab === 'authority' && (
        <div className="space-y-6 font-mono text-xs">
          {/* Module Capabilities Overrides */}
          <div className="p-6 rounded-2xl bg-surface border border-amber-500/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider">
                    Tenant Module Capability Overrides
                  </h2>
                </div>
                <p className="text-muted text-[11px] mt-0.5">
                  Super-Admin privilege: Bypass subscription plan tier limits and force-enable or revoke modules for this tenant.
                </p>
              </div>

              <button
                onClick={handleSaveModuleOverrides}
                disabled={overrideSaving}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="size-3.5" />
                <span>{overrideSaving ? 'Saving...' : 'Save Module Overrides'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AVAILABLE_MODULES.map((m) => {
                const Icon = m.icon;
                const state = moduleOverrides[m.key] || { enabled: true, plan_allowed: true };
                const isEnabled = state.enabled && state.plan_allowed;

                return (
                  <div
                    key={m.key}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isEnabled
                        ? 'bg-surface-sunken border-emerald-500/40 text-default'
                        : 'bg-surface-sunken/60 border-default text-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-surface text-muted'}`}>
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="font-sans font-semibold text-xs text-default">{m.label}</div>
                        <div className="text-[10px] text-muted">{m.key}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setModuleOverrides({
                          ...moduleOverrides,
                          [m.key]: {
                            enabled: !isEnabled,
                            plan_allowed: !isEnabled,
                          },
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        isEnabled
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                          : 'bg-surface hover:bg-surface-raised text-muted border border-default'
                      }`}
                    >
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quota Limits Overrides */}
          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-cyan-500" />
                  <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider">
                    Custom Resource Quota Overrides
                  </h2>
                </div>
                <p className="text-muted text-[11px] mt-0.5">
                  Assign bespoke high quotas or relaxed thresholds independent of standard subscription tier specs.
                </p>
              </div>

              <button
                onClick={handleSaveQuotaOverrides}
                disabled={overrideSaving}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="size-3.5" />
                <span>{overrideSaving ? 'Saving...' : 'Save Quota Overrides'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-muted mb-1">Max Users</label>
                <input
                  type="number"
                  min="1"
                  value={customLimits.max_users}
                  onChange={(e) => setCustomLimits({ ...customLimits, max_users: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Max Warehouses</label>
                <input
                  type="number"
                  min="1"
                  value={customLimits.max_warehouses}
                  onChange={(e) => setCustomLimits({ ...customLimits, max_warehouses: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Monthly Orders Limit</label>
                <input
                  type="number"
                  min="10"
                  value={customLimits.max_monthly_orders}
                  onChange={(e) => setCustomLimits({ ...customLimits, max_monthly_orders: parseInt(e.target.value) || 10 })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Max Products</label>
                <input
                  type="number"
                  min="10"
                  value={customLimits.max_products}
                  onChange={(e) => setCustomLimits({ ...customLimits, max_products: parseInt(e.target.value) || 10 })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Owner Password Override */}
          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Key className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider">
                Emergency Owner Password Reset
              </h2>
            </div>
            <p className="text-muted text-[11px] mb-4">
              Directly override and assign a new password for the primary administrator account of this tenant.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                <input
                  type="password"
                  value={ownerNewPassword}
                  onChange={(e) => setOwnerNewPassword(e.target.value)}
                  placeholder="Enter new 8+ character password"
                  className="w-full bg-surface-sunken border border-default rounded-xl pl-9 pr-3 py-2 text-default focus:outline-hidden focus:border-amber-500 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleResetOwnerPassword}
                disabled={overrideSaving || ownerNewPassword.length < 8}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold transition-all cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Force Reset Password
              </button>
            </div>
          </div>

          {/* Danger Zone: Tenant Deletion */}
          <div className="p-6 rounded-2xl bg-surface border border-rose-500/30 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1 font-bold">
              <AlertTriangle className="size-4" />
              <span className="font-sans uppercase tracking-wider text-sm">Danger Zone: Deprovision Tenant</span>
            </div>
            <p className="text-muted text-[11px] mb-4">
              Soft-delete this tenant, revoke all associated active authentication tokens, and detach domain bindings.
            </p>

            <button
              onClick={() => {
                setActionError(null);
                setDeleteConfirmation('');
                setModalType('delete');
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
            >
              Deprovision & Delete Tenant
            </button>
          </div>
        </div>
      )}

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-default uppercase tracking-wider font-sans">
              Tenancy Identifiers
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Database ID:</span>
                <span className="text-default font-bold">#{tenant.id}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">UUID:</span>
                <span className="text-default font-mono text-[11px]">{tenant.uuid}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Subdomain:</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">{tenant.slug}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Custom Domain:</span>
                <span className="text-default">{tenant.domain || 'None configured'}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Currency / Locale:</span>
                <span className="text-default">{tenant.currency_code} ({tenant.timezone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Provisioned At:</span>
                <span className="text-default">{new Date(tenant.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-default uppercase tracking-wider font-sans">
              Tenant Settings & Metadata
            </h2>
            <pre className="p-4 rounded-xl bg-surface-sunken border border-default text-[11px] text-default overflow-x-auto max-h-72">
              {JSON.stringify(tenant.settings || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Tab: Billing & Subscriptions */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
                  Active Subscription & Validity
                </h2>
                <p className="text-muted text-[11px] font-mono mt-0.5">
                  Platform tier governance, validity expiration window, and grace period controls.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openExtendModal}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Calendar className="size-3.5" />
                  <span>Manage Validity / Term</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block mb-1">Plan Tier</span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">{tenant.plan?.name ?? 'Starter'}</span>
                <span className="text-muted block mt-1">
                  BDT {tenant.plan?.price ?? 0} / {tenant.plan?.billing_period ?? 'month'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block mb-1">Lifecycle Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
                    tenant.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : tenant.status === 'trial'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                      : tenant.status === 'past_due'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    {tenant.effective_status ?? tenant.status}
                  </span>
                </div>
                <span className="text-muted block mt-1.5 text-[11px]">
                  {tenant.is_in_grace_period ? 'Operating within grace period' : 'Normal operating state'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block mb-1">Subscription Expiration</span>
                <span className="text-base font-bold text-default">
                  {tenant.subscription_ends_at
                    ? new Date(tenant.subscription_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : tenant.trial_ends_at
                    ? `Trial: ${new Date(tenant.trial_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                    : 'Permanent / Unlimited'}
                </span>
                <span className="text-muted block mt-1 text-[11px]">
                  {tenant.days_remaining !== null && tenant.days_remaining !== undefined
                    ? tenant.days_remaining > 7
                      ? `${tenant.days_remaining} days remaining`
                      : tenant.days_remaining > 0
                      ? `⚠️ Expiring in ${tenant.days_remaining} days`
                      : tenant.days_remaining === 0
                      ? '⚠️ Expiring today'
                      : `Expired ${tenant.days_overdue ?? 0} days ago`
                    : 'Active validity window'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-sunken border border-default">
                <span className="text-muted block mb-1">Grace Period Window</span>
                <span className="text-base font-bold text-default">
                  {tenant.grace_period_days ?? 7} Days
                </span>
                <span className="text-muted block mt-1 text-[11px]">
                  {tenant.grace_period_ends_at
                    ? `Ends ${new Date(tenant.grace_period_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : 'Post-expiry access buffer'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
            <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono mb-4">
              Subscription Transition History
            </h2>
            {subscriptions && subscriptions.length > 0 ? (
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-default text-muted uppercase text-[10px]">
                  <tr>
                    <th className="pb-3">Sub ID</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Starts At</th>
                    <th className="pb-3">Expires At</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-sunken">
                      <td className="py-3 text-muted">#{sub.id}</td>
                      <td className="py-3 text-default font-bold">{sub.plan?.name ?? 'Tier'}</td>
                      <td className="py-3 text-muted">{new Date(sub.starts_at).toLocaleDateString()}</td>
                      <td className="py-3 text-muted">
                        {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString() : 'Permanent'}
                      </td>
                      <td className="py-3 text-emerald-600 dark:text-emerald-400 uppercase font-bold">{sub.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-6 text-center text-muted text-xs font-mono">
                No past subscription transitions recorded.
              </div>
            )}
          </div>

          {/* SaaS Payments Ledger */}
          <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono">
                  SaaS Payments Ledger
                </h2>
                <p className="text-muted text-[11px] font-mono mt-0.5">
                  Direct billing receipts and transactions recorded for this tenant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setPaymentAmount(tenant.plan?.price ? String(tenant.plan.price) : '0');
                  setPaymentCurrency(tenant.currency_code || 'BDT');
                  setModalType('payment');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <CreditCard className="size-3.5" />
                <span>+ Record Payment</span>
              </button>
            </div>

            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-default text-muted uppercase text-[10px]">
                    <tr>
                      <th className="pb-3">Invoice Ref</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Method</th>
                      <th className="pb-3">Txn Ref</th>
                      <th className="pb-3">Payment Date</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-sunken">
                        <td className="py-3 text-default font-bold">{p.invoice_reference}</td>
                        <td className="py-3 text-amber-600 dark:text-amber-400 font-bold">
                          {p.currency_code === 'BDT' ? '৳' : p.currency_code + ' '}
                          {Number(p.amount).toLocaleString()}
                        </td>
                        <td className="py-3 text-default capitalize">{p.payment_method.replace('_', ' ')}</td>
                        <td className="py-3 text-muted text-[11px]">{p.transaction_reference || '—'}</td>
                        <td className="py-3 text-muted">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : p.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-muted text-xs font-mono">
                No billing payments recorded for this tenant yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Scoped Users */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
          <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono mb-4">
            Users Enrolled in Tenant #{tenant.id}
          </h2>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-default text-muted uppercase text-[10px]">
                  <tr>
                    <th className="pb-3">User ID</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-sunken">
                      <td className="py-3 text-muted">#{u.id}</td>
                      <td className="py-3 text-default font-bold">{u.name}</td>
                      <td className="py-3 text-default">{u.email}</td>
                      <td className="py-3 text-emerald-600 dark:text-emerald-400 uppercase font-bold">{u.status}</td>
                      <td className="py-3 text-muted">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted text-xs font-mono">
              No users loaded for this tenant.
            </div>
          )}
        </div>
      )}

      {/* Tab: Usage & Quotas */}
      {activeTab === 'usage' && (
        <div className="p-6 rounded-2xl bg-surface border border-default shadow-xl">
          <h2 className="text-sm font-bold text-default uppercase tracking-wider font-mono mb-4">
            Current Resource Usage & Plan Quotas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-muted block mb-1">Monthly Orders Processed</span>
              <span className="text-xl font-bold text-default">0</span>
              <span className="text-[10px] text-muted block mt-1">
                Limit: {customLimits.max_monthly_orders ?? tenant.plan?.limits?.['max_monthly_orders'] ?? 'Unlimited'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-muted block mb-1">Active User Accounts</span>
              <span className="text-xl font-bold text-default">{users.length}</span>
              <span className="text-[10px] text-muted block mt-1">
                Limit: {customLimits.max_users ?? tenant.plan?.limits?.['max_users'] ?? 'Unlimited'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-muted block mb-1">Warehouses Scope</span>
              <span className="text-xl font-bold text-default">1</span>
              <span className="text-[10px] text-muted block mt-1">
                Limit: {customLimits.max_warehouses ?? tenant.plan?.limits?.['max_warehouses'] ?? '2'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Extend / Term Adjustment Modal */}
      {modalType === 'extend' && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs text-default">
            <h2 className="text-lg font-bold text-default font-sans">Subscription Term Management</h2>
            <p className="text-xs text-muted mt-1">
              Adjust validity and expiry controls for <strong className="text-default">{tenant.name}</strong>.
            </p>

            {/* Mode selection tabs */}
            <div className="flex bg-surface-sunken p-1 rounded-xl border border-default mt-4 text-xs font-sans">
              <button
                type="button"
                onClick={() => setExtendMode('days')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  extendMode === 'days'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                + Days
              </button>
              <button
                type="button"
                onClick={() => setExtendMode('date')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  extendMode === 'date'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Exact Expiry
              </button>
              <button
                type="button"
                onClick={() => setExtendMode('grace')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  extendMode === 'grace'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Grace Period
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            {extendMode === 'days' && (
              <div className="mt-4">
                <label className="block text-xs text-muted mb-1 font-semibold">Additional Validity (Days):</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 30)}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-3 text-xs text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>
            )}

            {extendMode === 'date' && (
              <div className="mt-4">
                <label className="block text-xs text-muted mb-1 font-semibold">Set Absolute Expiration Date:</label>
                <input
                  type="date"
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-3 text-xs text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>
            )}

            {extendMode === 'grace' && (
              <div className="mt-4">
                <label className="block text-xs text-muted mb-1 font-semibold">Grace Period Days Post-Expiry:</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(parseInt(e.target.value) || 0)}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-3 text-xs text-default focus:outline-hidden focus:border-amber-500"
                />
                <p className="text-[11px] text-muted mt-1">
                  Tenant retains full read/write access during grace period before suspension.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (extendMode === 'days') handleManageSubscription('extend');
                  else if (extendMode === 'date') handleManageSubscription('set_expiry');
                  else if (extendMode === 'grace') handleManageSubscription('set_grace_period');
                }}
                disabled={actionLoading || (extendMode === 'date' && !customExpiryDate)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Apply Term Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record SaaS Payment Modal */}
      {modalType === 'payment' && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs text-default">
            <h2 className="text-lg font-bold text-default font-sans">Record SaaS Payment</h2>
            <p className="text-muted mt-1">
              Add subscription transaction record for <strong className="text-default">{tenant.name}</strong>.
            </p>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                {actionError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1">Amount:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">Currency:</label>
                  <select
                    value={paymentCurrency}
                    onChange={(e) => setPaymentCurrency(e.target.value)}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted mb-1">Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                >
                  <option value="bank_transfer">Bank Transfer (EFT/NPSB)</option>
                  <option value="bkash">bKash Merchant</option>
                  <option value="nagad">Nagad Direct</option>
                  <option value="stripe">Stripe / Credit Card</option>
                  <option value="cash">Cash / Direct Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-muted mb-1">Txn / Bank Ref ID:</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. TRX-98234812"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Notes / Invoice Memo:</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional billing note..."
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !paymentAmount}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {modalType === 'plan' && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-default">
            <h2 className="text-lg font-bold text-default font-sans">Switch SaaS Plan Tier</h2>
            <p className="text-xs text-muted mt-1">
              Target Tenant: <strong className="text-default">{tenant.name}</strong>
            </p>

            <div className="mt-4 space-y-2">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setNewPlanId(p.id)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-left ${
                    newPlanId === p.id
                      ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                      : 'bg-surface-sunken border-default text-default hover:bg-surface'
                  }`}
                >
                  <span>{p.name}</span>
                  <span>${p.price}/{p.billing_period}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleManageSubscription('change_plan')}
                disabled={actionLoading || !newPlanId}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Apply Plan Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {modalType === 'status' && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-default">
            <h2 className="text-lg font-bold text-default font-sans">
              {tenant.status === 'active' ? 'Suspend Tenant Access' : 'Reactivate Tenant'}
            </h2>
            <p className="text-xs text-muted mt-1">
              Target: <strong className="text-default">{tenant.name}</strong>
            </p>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs text-muted mb-1">Reason for state change:</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Logged in platform audit trail..."
                className="w-full bg-surface-sunken border border-default rounded-xl p-3 text-xs text-default focus:outline-hidden focus:border-amber-500"
                rows={3}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
              >
                Cancel
              </button>
              {tenant.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('suspended')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('active')}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Reactivating...' : 'Confirm Reactivation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal */}
      {modalType === 'delete' && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs text-default">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base font-sans">
              <Trash2 className="size-5" />
              <span>Deprovision Tenant</span>
            </div>
            <p className="text-muted mt-2 leading-relaxed">
              This will deprovision and soft-delete <strong className="text-default">{tenant.name}</strong>.
            </p>

            <div className="my-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300">
              Please type <strong className="select-all font-bold">{tenant.slug}</strong> to confirm.
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500 text-rose-600 dark:text-rose-300">
                {actionError}
              </div>
            )}

            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={tenant.slug}
              className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-rose-500"
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalType(null);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTenant}
                disabled={actionLoading || deleteConfirmation !== tenant.slug}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-40"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Deprovision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDetailWorkspace;
