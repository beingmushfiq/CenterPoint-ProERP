import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api/client';
import type { PlatformPlan } from '../../types/api/platform';
import {
  Building2,
  CreditCard,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { getStorefrontExternalUrl } from '../../lib/storefront/storefrontUrl';

export const TenantRegistrationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    currency_code: 'BDT',
    timezone: 'Asia/Dhaka',
    plan_id: 0,
    is_trial: true,
    trial_days: 14,
    owner_name: '',
    owner_email: '',
    password: '',
    phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedData, setProvisionedData] = useState<{
    tenant: { id: number; name: string; slug: string };
    owner: { name: string; email: string };
  } | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get<PlatformPlan[]>('/platform/plans');
        setPlans(res.data);
        if (res.data.length > 0) {
          const defaultPlan = res.data.find((p) => p.code === 'STARTER') || res.data[0];
          if (defaultPlan) {
            setFormData((prev) => ({ ...prev, plan_id: defaultPlan.id }));
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
    }));
  };

  const handleProvision = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug,
        plan_id: formData.plan_id,
        owner_name: formData.owner_name,
        owner_email: formData.owner_email,
        password: formData.password,
        currency_code: formData.currency_code,
        timezone: formData.timezone,
        is_trial: formData.is_trial,
        trial_days: formData.trial_days,
      };
      if (formData.domain) payload['domain'] = formData.domain;

      const response = await api.post<{
        tenant: { id: number; name: string; slug: string };
        owner: { name: string; email: string };
      }>('/platform/tenants', payload);

      const unwrapped = response.data;
      setProvisionedData(unwrapped);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Provisioning failed. Check slug uniqueness and form data.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-default tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" />
          <span>Tenant Provisioning Wizard</span>
        </h1>
        <p className="text-xs text-muted mt-1 font-mono">
          Atomically bootstrap isolated tenant infrastructure, root company, main branch, admin role, and initial subscription.
        </p>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        {[
          { num: 1, label: 'Organization Profile', icon: Building2 },
          { num: 2, label: 'Subscription Tier', icon: CreditCard },
          { num: 3, label: 'Tenant Administrator', icon: UserCheck },
          { num: 4, label: 'Provisioning Done', icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              className={`p-2.5 sm:p-3.5 rounded-xl border flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold shadow-xs'
                  : isDone
                  ? 'bg-surface border-emerald-500/40 text-emerald-500 font-semibold'
                  : 'bg-surface-raised/60 border-default text-muted'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : isDone
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-surface-sunken text-muted border border-default'
                }`}
              >
                {isDone ? '✓' : <Icon className="w-3.5 h-3.5" />}
              </div>
              <div className="truncate">
                <span className="text-[11px] block truncate">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
          <strong>Provisioning Error:</strong> {error}
        </div>
      )}

      {/* Step Contents */}
      <div className="bg-surface border border-default rounded-2xl p-6 sm:p-8 shadow-2xl">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">1. Organization Details & Routing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs">
              <div className="sm:col-span-2">
                <label className="block text-default font-semibold mb-1">
                  Business / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Solutions Ltd."
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">
                  Subdomain Identifier (Slug) *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="apex-solutions"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    className="w-full bg-surface-sunken border border-default rounded-l-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  />
                  <span className="bg-surface-raised border border-l-0 border-default rounded-r-xl px-3 py-2.5 text-muted text-xs">
                    .devcenterpoint.com
                  </span>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  Must be unique and lower-kebab-case.
                </p>
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">
                  Custom Domain (Optional)
                </label>
                <input
                  type="text"
                  placeholder="portal.apexsolutions.com"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">Default Currency Code</label>
                <SelectDropdown
                  options={[
                    { value: 'BDT', label: 'BDT (৳ - Bangladeshi Taka)' },
                    { value: 'USD', label: 'USD ($ - US Dollar)' },
                    { value: 'EUR', label: 'EUR (€ - Euro)' },
                    { value: 'GBP', label: 'GBP (£ - British Pound)' },
                  ]}
                  value={formData.currency_code}
                  onChange={(val) => setFormData({ ...formData, currency_code: val })}
                  size="md"
                  buttonClassName="w-full bg-surface-sunken border-default text-default"
                  aria-label="Default currency code"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">Default Timezone</label>
                <SelectDropdown
                  options={[
                    { value: 'Asia/Dhaka', label: 'Asia/Dhaka (GMT+6)' },
                    { value: 'UTC', label: 'UTC (Universal)' },
                    { value: 'America/New_York', label: 'America/New_York (EST)' },
                    { value: 'Europe/London', label: 'Europe/London (GMT)' },
                  ]}
                  value={formData.timezone}
                  onChange={(val) => setFormData({ ...formData, timezone: val })}
                  size="md"
                  buttonClassName="w-full bg-surface-sunken border-default text-default"
                  aria-label="Default timezone"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={!formData.name || !formData.slug}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 font-mono cursor-pointer"
              >
                <span>Continue to Subscription</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">2. Select Subscription Tier & Trial Period</h2>

            {loadingPlans ? (
              <div className="py-8 text-center text-muted text-xs font-mono">
                Loading available plan tiers...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((p) => {
                  const isSelected = formData.plan_id === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setFormData({ ...formData, plan_id: p.id })}
                      className={`w-full text-left p-5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                          : 'bg-surface-sunken/60 border-default hover:border-default/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-default text-base">{p.name}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-raised text-amber-500 font-bold border border-default">
                          BDT {p.price}/{p.billing_period}
                        </span>
                      </div>
                      <p className="text-xs text-muted mb-4">{p.description || 'Full SaaS industrial feature set'}</p>
                      <div className="text-[11px] font-mono space-y-1 text-default">
                        <div>• Max Users: {p.limits?.max_users ?? 'Unlimited'}</div>
                        <div>• Max Factories: {p.limits?.max_factories ?? 'Unlimited'}</div>
                        <div>• Max Warehouses: {p.limits?.max_warehouses ?? 'Unlimited'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-4 rounded-xl bg-surface-sunken/60 border border-default flex items-center justify-between font-mono text-xs">
              <div>
                <span className="font-bold text-default block">Start as Free Trial</span>
                <span className="text-muted text-[11px]">Give this tenant 14 days full access before payment</span>
              </div>
              <input
                type="checkbox"
                checked={formData.is_trial}
                onChange={(e) => setFormData({ ...formData, is_trial: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="pt-4 flex justify-between font-mono text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-surface text-default border border-default flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>Continue to Administrator</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">3. Primary Tenant Owner Account</h2>
            <p className="text-xs text-muted font-mono">
              This account will be created inside the tenant scope with the primary Administrator role and full permissions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs">
              <div>
                <label className="block text-default font-semibold mb-1">Owner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Syed Manzur Elahi"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">Owner Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="manzur@apexfootwear.com"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">Temporary Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  placeholder="+880 1711 000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-6 flex justify-between font-mono text-xs">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-surface text-default border border-default flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={submitting || !formData.owner_name || !formData.owner_email || !formData.password}
                onClick={handleProvision}
                className="px-8 py-3 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Provision Tenant Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && provisionedData && (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-default">
              Tenant Successfully Provisioned!
            </h2>
            <p className="text-xs font-mono text-muted max-w-md mx-auto">
              Isolated workspace created with all transactional defaults, sequences, reason codes, and tenant owner role.
            </p>

            <div className="p-6 rounded-2xl bg-surface-sunken border border-default text-left font-mono text-xs space-y-3 max-w-lg mx-auto">
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Tenant Name:</span>
                <span className="text-default font-bold">{provisionedData?.tenant?.name || 'Provisioned Tenant'}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Subdomain:</span>
                <span className="text-amber-500">{provisionedData?.tenant?.slug || 'workspace'}.devcenterpoint.com</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Storefront URL:</span>
                <a
                  href={getStorefrontExternalUrl(provisionedData?.tenant?.slug || '')}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-500 hover:underline flex items-center gap-1 font-semibold"
                >
                  /store/{provisionedData?.tenant?.slug}
                </a>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Storefront Pages:</span>
                <span className="text-emerald-500 font-medium">9 CMS Pages Provisioned (Live)</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">Warehouses:</span>
                <span className="text-default">Central (WH-MAIN), FG (WH-FG), QC (WH-QC)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tenant ID:</span>
                <span className="text-default">#{provisionedData?.tenant?.id ?? '—'}</span>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-center gap-4 font-mono text-xs">
              <a
                href={getStorefrontExternalUrl(provisionedData?.tenant?.slug || '')}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-lg shadow-emerald-600/20"
              >
                Visit Storefront
              </a>
              <button
                onClick={() => navigate('/platform/tenants')}
                className="px-6 py-2.5 rounded-xl bg-surface-raised hover:bg-surface text-default border border-default transition-colors cursor-pointer"
              >
                Go to Tenant Directory
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setFormData({
                    name: '',
                    slug: '',
                    domain: '',
                    currency_code: 'BDT',
                    timezone: 'Asia/Dhaka',
                    plan_id: plans[0]?.id ?? 0,
                    is_trial: true,
                    trial_days: 14,
                    owner_name: '',
                    owner_email: '',
                    password: '',
                    phone: '',
                  });
                  setProvisionedData(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer"
              >
                Provision Another Tenant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TenantRegistrationWizard;
