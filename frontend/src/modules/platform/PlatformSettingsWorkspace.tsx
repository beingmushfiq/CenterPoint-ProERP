import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
export type PlatformSettingsMap = Record<string, Record<string, unknown>>;
import { Button } from '../../components/ui/Button';
import {
  RotateCcw,
  Save,
  Globe,
  CreditCard,
  Shield,
  AlertTriangle,
  Server,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface PlatformSettingsFormProps {
  initialSettings?: PlatformSettingsMap | undefined;
  activeTab: 'general' | 'billing' | 'security' | 'maintenance';
  onSaveGeneral: (payload: { platform_name: string; support_email: string; default_currency: string; default_trial_days: number }) => void;
  onSaveBilling: (payload: { default_grace_period_days: number; invoice_prefix: string; tax_percentage: number }) => void;
  onSaveSecurity: (payload: { max_login_attempts: number; lockout_minutes: number; session_timeout_minutes: number; allow_super_impersonation: boolean }) => void;
  onSaveMaintenance: (payload: { enabled: boolean; message: string; whitelisted_ips: string[] }) => void;
  isSaving: boolean;
  isMaintenancePending: boolean;
}

const PlatformSettingsForm: React.FC<PlatformSettingsFormProps> = ({
  initialSettings,
  activeTab,
  onSaveGeneral,
  onSaveBilling,
  onSaveSecurity,
  onSaveMaintenance,
  isSaving,
  isMaintenancePending,
}) => {
  // Local Form State initialized directly from loaded server settings
  const [platformName, setPlatformName] = useState<string>(
    typeof initialSettings?.general?.['platform_name'] === 'string'
      ? initialSettings.general['platform_name']
      : 'DevCenterPoint Platform'
  );
  const [supportEmail, setSupportEmail] = useState<string>(
    typeof initialSettings?.general?.['support_email'] === 'string'
      ? initialSettings.general['support_email']
      : 'support@devcenterpoint.com'
  );
  const [defaultCurrency, setDefaultCurrency] = useState<string>(
    typeof initialSettings?.general?.['default_currency'] === 'string'
      ? initialSettings.general['default_currency']
      : 'BDT'
  );
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(
    typeof initialSettings?.general?.['default_trial_days'] === 'number'
      ? initialSettings.general['default_trial_days']
      : 14
  );

  const [defaultGracePeriodDays, setDefaultGracePeriodDays] = useState<number>(
    typeof initialSettings?.billing?.['default_grace_period_days'] === 'number'
      ? initialSettings.billing['default_grace_period_days']
      : 7
  );
  const [invoicePrefix, setInvoicePrefix] = useState<string>(
    typeof initialSettings?.billing?.['invoice_prefix'] === 'string'
      ? initialSettings.billing['invoice_prefix']
      : 'INV-SaaS-'
  );
  const [taxPercentage, setTaxPercentage] = useState<number>(
    typeof initialSettings?.billing?.['tax_percentage'] === 'number'
      ? initialSettings.billing['tax_percentage']
      : 0
  );

  const [maxLoginAttempts, setMaxLoginAttempts] = useState<number>(
    typeof initialSettings?.security?.['max_login_attempts'] === 'number'
      ? initialSettings.security['max_login_attempts']
      : 5
  );
  const [lockoutMinutes, setLockoutMinutes] = useState<number>(
    typeof initialSettings?.security?.['lockout_minutes'] === 'number'
      ? initialSettings.security['lockout_minutes']
      : 15
  );
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    typeof initialSettings?.security?.['session_timeout_minutes'] === 'number'
      ? initialSettings.security['session_timeout_minutes']
      : 120
  );
  const [impersonationAllowed, setImpersonationAllowed] = useState<boolean>(
    typeof initialSettings?.security?.['allow_super_impersonation'] === 'boolean'
      ? initialSettings.security['allow_super_impersonation']
      : true
  );

  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(
    typeof initialSettings?.maintenance?.['enabled'] === 'boolean'
      ? initialSettings.maintenance['enabled']
      : false
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    typeof initialSettings?.maintenance?.['message'] === 'string'
      ? initialSettings.maintenance['message']
      : 'Platform undergoing scheduled infrastructure upgrades.'
  );
  const [whitelistedIps, setWhitelistedIps] = useState<string>(
    Array.isArray(initialSettings?.maintenance?.['whitelisted_ips'])
      ? (initialSettings.maintenance['whitelisted_ips'] as string[]).join(', ')
      : ''
  );

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGeneral({
      platform_name: platformName,
      support_email: supportEmail,
      default_currency: defaultCurrency,
      default_trial_days: Number(defaultTrialDays),
    });
  };

  const handleBillingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBilling({
      default_grace_period_days: Number(defaultGracePeriodDays),
      invoice_prefix: invoicePrefix,
      tax_percentage: Number(taxPercentage),
    });
  };

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSecurity({
      max_login_attempts: Number(maxLoginAttempts),
      lockout_minutes: Number(lockoutMinutes),
      session_timeout_minutes: Number(sessionTimeoutMinutes),
      allow_super_impersonation: impersonationAllowed,
    });
  };

  const handleMaintenanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ips = whitelistedIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    onSaveMaintenance({
      enabled: maintenanceEnabled,
      message: maintenanceMessage,
      whitelisted_ips: ips,
    });
  };

  return (
    <div className="rounded-2xl bg-surface border border-default shadow-xl p-6 font-mono text-xs max-w-3xl">
      {/* General Tab */}
      {activeTab === 'general' && (
        <form onSubmit={handleGeneralSubmit} className="space-y-4">
          <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider mb-2">
            Universal Platform Defaults
          </h2>

          <div>
            <label className="block text-default mb-1">Platform Brand Name</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-default mb-1">Root Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-default mb-1">Default Base Currency</label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              >
                <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
              </select>
            </div>

            <div>
              <label className="block text-default mb-1">Default Free Trial (Days)</label>
              <input
                type="number"
                min="0"
                max="90"
                value={defaultTrialDays}
                onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save General Config'}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <form onSubmit={handleBillingSubmit} className="space-y-4">
          <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider mb-2">
            SaaS Billing & Subscription Policies
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-default mb-1">Default Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={defaultGracePeriodDays}
                onChange={(e) => setDefaultGracePeriodDays(Number(e.target.value))}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              />
              <p className="text-[10px] text-muted mt-1">
                Allowed grace period before tenant enters suspended status.
              </p>
            </div>

            <div>
              <label className="block text-default mb-1">Invoice Reference Prefix</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-default mb-1">Standard SaaS Tax / VAT Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(Number(e.target.value))}
              className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Billing Config'}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <form onSubmit={handleSecuritySubmit} className="space-y-4">
          <h2 className="text-sm font-bold text-default font-sans uppercase tracking-wider mb-2">
            Access Security & Session Throttling
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-default mb-1">Max Failed Login Attempts</label>
              <input
                type="number"
                min="1"
                max="20"
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-default mb-1">Account Lockout Duration (Mins)</label>
              <input
                type="number"
                min="1"
                max="1440"
                value={lockoutMinutes}
                onChange={(e) => setLockoutMinutes(Number(e.target.value))}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-default mb-1">Admin Session Idle Expiry (Mins)</label>
            <input
              type="number"
              min="15"
              max="1440"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-surface-sunken border border-default flex items-center gap-3 mt-3">
            <input
              type="checkbox"
              id="impersonateCheckbox"
              checked={impersonationAllowed}
              onChange={(e) => setImpersonationAllowed(e.target.checked)}
              className="rounded-sm border-default bg-surface text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="impersonateCheckbox" className="text-default cursor-pointer">
              Enable platform super-admin impersonation into tenant applications for diagnostics
            </label>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Security Policies'}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-rose-500 mb-1 font-bold">
            <AlertTriangle className="size-4" />
            <h2 className="text-sm uppercase tracking-wider font-sans">
              Platform-Wide Maintenance Lockout
            </h2>
          </div>
          <p className="text-muted text-[11px] mb-4">
            When active, non-whitelisted traffic will be intercepted with a 503 Maintenance response.
          </p>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="maintenanceToggle"
                checked={maintenanceEnabled}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="rounded-sm border-rose-500 bg-surface text-rose-500 focus:ring-rose-500"
              />
              <label htmlFor="maintenanceToggle" className="text-rose-600 dark:text-rose-300 font-bold cursor-pointer">
                ENABLE PLATFORM MAINTENANCE MODE
              </label>
            </div>

            <div>
              <label className="block text-default mb-1">Public Display Message</label>
              <input
                type="text"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-default mb-1">Whitelisted IP Addresses (comma separated)</label>
              <input
                type="text"
                value={whitelistedIps}
                onChange={(e) => setWhitelistedIps(e.target.value)}
                placeholder="127.0.0.1, 103.25.12.8"
                className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={isMaintenancePending}
              className={`font-bold cursor-pointer ${
                maintenanceEnabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <Save className="size-3.5" />
              <span>{isMaintenancePending ? 'Updating...' : 'Apply Maintenance Gateway'}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

interface TenantDomainItem {
  id: number;
  domain: string;
  tenant_id: number;
  verification_status: 'pending' | 'verified' | 'failed' | 'suspended';
  ssl_status: 'pending' | 'active' | 'failed' | 'not_required';
  tenant?: { name: string; slug: string };
  created_at: string;
}

const DomainsTabContent: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState<TenantDomainItem | null>(null);

  const { data: domains = [], isLoading, isFetching, refetch } = useQuery<TenantDomainItem[]>({
    queryKey: ['platform', 'domains'],
    queryFn: async () => {
      const res = await api.get<{ data: TenantDomainItem[] }>('/platform/domains');
      return res.data?.data ?? [];
    },
  });

  const handleInspect = async (domain: TenantDomainItem) => {
    setSelectedDomain(domain);
    try {
      const res = await api.get<{ data: TenantDomainItem }>(`/platform/domains/${domain.id}`);
      if (res.data?.data) {
        setSelectedDomain(res.data.data);
      }
    } catch {
      // Silently ignore background domain fetch failure and retain selected domain
    }
  };

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/platform/domains/${id}/verify`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Domain DNS verification check passed');
      queryClient.invalidateQueries({ queryKey: ['platform', 'domains'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Domain verification check failed';
      toast.error(msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.patch(`/platform/domains/${id}/status`, { verification_status: status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Domain routing status updated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'domains'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/platform/domains/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Custom domain released from tenant');
      queryClient.invalidateQueries({ queryKey: ['platform', 'domains'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to release domain';
      toast.error(msg);
    },
  });

  return (
    <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-default pb-3">
        <div>
          <h2 className="text-sm font-bold text-default font-sans">Multi-Tenant Custom Domains</h2>
          <p className="text-muted text-[11px]">Tenant custom domains, SSL certificates, and DNS CNAME resolution status.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 cursor-pointer font-mono text-xs border-default bg-surface text-default hover:bg-surface-sunken"
        >
          <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted">Loading custom domain registry...</div>
      ) : domains.length === 0 ? (
        <div className="p-8 text-center text-muted">No custom domains configured on platform.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-default text-[11px] text-muted uppercase">
                <th className="py-2.5 px-3">Domain</th>
                <th className="py-2.5 px-3">Tenant</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">SSL</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default/50">
              {domains.map((dom) => (
                <tr key={dom.id} className="hover:bg-surface-sunken/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-default">{dom.domain}</td>
                  <td className="py-2.5 px-3 text-muted">{dom.tenant?.name ?? `Tenant #${dom.tenant_id}`}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      dom.verification_status === 'verified'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {dom.verification_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-default text-muted text-[10px] uppercase">
                      {dom.ssl_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleInspect(dom)}
                        title="Inspect Domain"
                        className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface border border-default text-default cursor-pointer"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => verifyMutation.mutate(dom.id)}
                        disabled={verifyMutation.isPending}
                        title="Verify DNS"
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold cursor-pointer"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate({ id: dom.id, status: dom.verification_status === 'verified' ? 'suspended' : 'verified' })}
                        disabled={statusMutation.isPending}
                        title="Toggle Status"
                        className="px-2 py-1 rounded-lg bg-surface-sunken hover:bg-surface border border-default text-muted text-[10px] cursor-pointer"
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove custom domain ${dom.domain}?`)) {
                            deleteMutation.mutate(dom.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        title="Delete Domain"
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDomain && (
        <div className="p-3 bg-surface-sunken border border-default rounded-xl mt-3 flex items-center justify-between">
          <span>Viewing details for: <strong className="text-default">{selectedDomain.domain}</strong></span>
          <button type="button" onClick={() => setSelectedDomain(null)} className="text-muted hover:text-default">Close</button>
        </div>
      )}
    </div>
  );
};

interface QueueJobItem {
  id: number | string;
  queue?: string;
  job_name?: string;
  exception_summary?: string;
  failed_at?: string;
}

const JobsTabContent: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, isFetching, refetch } = useQuery<QueueJobItem[]>({
    queryKey: ['platform', 'jobs'],
    queryFn: async () => {
      const res = await api.get<{ data: QueueJobItem[] }>('/platform/jobs?status=failed');
      return res.data?.data ?? [];
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const res = await api.post(`/platform/jobs/${id}/retry`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Job queued for retry');
      queryClient.invalidateQueries({ queryKey: ['platform', 'jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to retry job';
      toast.error(msg);
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/platform/jobs/retry-all');
      return res.data;
    },
    onSuccess: () => {
      toast.success('All failed jobs dispatched for retry');
      queryClient.invalidateQueries({ queryKey: ['platform', 'jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to retry all jobs';
      toast.error(msg);
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const res = await api.delete(`/platform/jobs/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Job discarded from queue');
      queryClient.invalidateQueries({ queryKey: ['platform', 'jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to discard job';
      toast.error(msg);
    },
  });

  return (
    <div className="p-6 rounded-2xl bg-surface border border-default shadow-xs space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-default pb-3">
        <div>
          <h2 className="text-sm font-bold text-default font-sans">Background Queue & Worker Telemetry</h2>
          <p className="text-muted text-[11px]">Inspect failed async workers, dispatch retries, and purge poison-pill jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => retryAllMutation.mutate()}
            disabled={retryAllMutation.isPending || jobs.length === 0}
            className="flex items-center gap-1.5 cursor-pointer font-mono text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-none"
          >
            <RefreshCw className={`size-3.5 ${retryAllMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Retry All Failed</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 cursor-pointer font-mono text-xs border-default bg-surface text-default hover:bg-surface-sunken"
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted">Inspecting background queues...</div>
      ) : jobs.length === 0 ? (
        <div className="p-8 text-center text-muted flex flex-col items-center gap-2">
          <CheckCircle2 className="size-6 text-emerald-500" />
          <span>All background queue workers are operational. No failed jobs recorded.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-default text-[11px] text-muted uppercase">
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">Queue</th>
                <th className="py-2.5 px-3">Job Name</th>
                <th className="py-2.5 px-3">Exception Summary</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default/50">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-sunken/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-default">#{job.id}</td>
                  <td className="py-2.5 px-3 text-muted">{job.queue || 'default'}</td>
                  <td className="py-2.5 px-3 font-semibold text-default">{job.job_name || 'WorkerJob'}</td>
                  <td className="py-2.5 px-3 text-muted text-[11px] max-w-xs truncate">{job.exception_summary || 'Unknown failure'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => retryMutation.mutate(job.id)}
                        disabled={retryMutation.isPending}
                        title="Retry Job"
                        className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Discard job #${job.id}?`)) {
                            deleteJobMutation.mutate(job.id);
                          }
                        }}
                        disabled={deleteJobMutation.isPending}
                        title="Discard Job"
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const PlatformSettingsWorkspace: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'security' | 'maintenance' | 'domains' | 'jobs'>('general');

  // Fetch Settings
  const { data, isLoading, isFetching, refetch } = useQuery<PlatformSettingsMap>({
    queryKey: ['platform', 'settings'],
    queryFn: async () => {
      const res = await api.get<{ settings: PlatformSettingsMap }>('/platform/settings');
      return res.data.settings;
    },
  });

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async ({ group, settings }: { group: string; settings: Record<string, unknown> }) => {
      const res = await api.patch(`/platform/settings/${group}`, { settings });
      return res.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.group.toUpperCase()} settings saved successfully`);
      queryClient.invalidateQueries({ queryKey: ['platform', 'settings'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(msg);
    },
  });

  // Maintenance Mutation
  const maintenanceMutation = useMutation({
    mutationFn: async (payload: { enabled: boolean; message: string; whitelisted_ips: string[] }) => {
      const res = await api.post('/platform/settings/maintenance', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform maintenance state updated successfully');
      queryClient.invalidateQueries({ queryKey: ['platform', 'settings'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update maintenance state';
      toast.error(msg);
    },
  });

  const formKey = data ? JSON.stringify(data) : 'loading';

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">Platform Configuration & Controls</h1>
          <p className="text-xs text-muted mt-1 font-mono">
            Universal SaaS platform settings, billing defaults, security lockout policies, and maintenance gateways.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 font-mono text-xs cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken self-start"
        >
          <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Reload Config</span>
        </Button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex bg-surface-sunken p-1 rounded-xl border border-default max-w-lg">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'general'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Globe className="size-3.5" />
          <span>General</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'billing'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <CreditCard className="size-3.5" />
          <span>Billing & Tiers</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'security'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Shield className="size-3.5" />
          <span>Security</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'maintenance'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <AlertTriangle className="size-3.5" />
          <span>Maintenance</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('domains')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'domains'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Globe className="size-3.5" />
          <span>Domains</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'jobs'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-muted hover:text-default'
          }`}
        >
          <Server className="size-3.5" />
          <span>Queue Jobs</span>
        </button>
      </div>

      {activeTab === 'domains' ? (
        <DomainsTabContent />
      ) : activeTab === 'jobs' ? (
        <JobsTabContent />
      ) : isLoading ? (
        <div className="p-12 text-center text-muted font-mono text-xs">
          Loading platform configuration...
        </div>
      ) : (
        <PlatformSettingsForm
          key={formKey}
          initialSettings={data}
          activeTab={activeTab}
          isSaving={saveMutation.isPending}
          isMaintenancePending={maintenanceMutation.isPending}
          onSaveGeneral={(settings) => saveMutation.mutate({ group: 'general', settings })}
          onSaveBilling={(settings) => saveMutation.mutate({ group: 'billing', settings })}
          onSaveSecurity={(settings) => saveMutation.mutate({ group: 'security', settings })}
          onSaveMaintenance={(payload) => maintenanceMutation.mutate(payload)}
        />
      )}
    </div>
  );
};

export default PlatformSettingsWorkspace;
