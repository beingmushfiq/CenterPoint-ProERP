import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['platform', 'common']);
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
      setError(err instanceof Error ? err.message : t('platform.tenantWizard.errorFallback'));
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
          <span>{t('platform.tenantWizard.title')}</span>
        </h1>
        <p className="text-xs text-muted mt-1 font-mono">
          {t('platform.tenantWizard.description')}
        </p>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        {[
          { num: 1, label: t('platform.tenantWizard.steps.step1'), icon: Building2 },
          { num: 2, label: t('platform.tenantWizard.steps.step2'), icon: CreditCard },
          { num: 3, label: t('platform.tenantWizard.steps.step3'), icon: UserCheck },
          { num: 4, label: t('platform.tenantWizard.steps.step4'), icon: CheckCircle2 },
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
          <strong>{t('platform.tenantWizard.errorPrefix')}</strong> {error}
        </div>
      )}

      {/* Step Contents */}
      <div className="bg-surface border border-default rounded-2xl p-6 sm:p-8 shadow-2xl">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">{t('platform.tenantWizard.step1.title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs">
              <div className="sm:col-span-2">
                <label className="block text-default font-semibold mb-1">
                  {t('platform.tenantWizard.step1.nameLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('platform.tenantWizard.step1.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">
                  {t('platform.tenantWizard.step1.slugLabel')}
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder={t('platform.tenantWizard.step1.slugPlaceholder')}
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
                  {t('platform.tenantWizard.step1.slugHelp')}
                </p>
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">
                  {t('platform.tenantWizard.step1.customDomainLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('platform.tenantWizard.step1.customDomainPlaceholder')}
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step1.currencyLabel')}</label>
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
                  aria-label={t('platform.tenantWizard.step1.currencyLabel')}
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step1.timezoneLabel')}</label>
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
                  aria-label={t('platform.tenantWizard.step1.timezoneLabel')}
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
                <span>{t('platform.tenantWizard.step1.nextBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">{t('platform.tenantWizard.step2.title')}</h2>

            {loadingPlans ? (
              <div className="py-8 text-center text-muted text-xs font-mono">
                {t('platform.tenantWizard.step2.loading')}
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
                          {t('platform.tenantWizard.step2.bdt')} {p.price}{t('platform.tenantWizard.step2.perPeriod', { period: p.billing_period })}
                        </span>
                      </div>
                      <p className="text-xs text-muted mb-4">{p.description || 'Full SaaS industrial feature set'}</p>
                      <div className="text-[11px] font-mono space-y-1 text-default">
                        <div>{t('platform.tenantWizard.step2.maxUsers', { count: p.limits?.max_users ?? t('platform.tenantWizard.step2.unlimited') })}</div>
                        <div>{t('platform.tenantWizard.step2.maxFactories', { count: p.limits?.max_factories ?? t('platform.tenantWizard.step2.unlimited') })}</div>
                        <div>{t('platform.tenantWizard.step2.maxWarehouses', { count: p.limits?.max_warehouses ?? t('platform.tenantWizard.step2.unlimited') })}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-4 rounded-xl bg-surface-sunken/60 border border-default flex items-center justify-between font-mono text-xs">
              <div>
                <span className="font-bold text-default block">{t('platform.tenantWizard.step2.freeTrialTitle')}</span>
                <span className="text-muted text-[11px]">{t('platform.tenantWizard.step2.freeTrialSubtitle')}</span>
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
                <span>{t('platform.tenantWizard.step2.backBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>{t('platform.tenantWizard.step2.nextBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-default">{t('platform.tenantWizard.step3.title')}</h2>
            <p className="text-xs text-muted font-mono">
              {t('platform.tenantWizard.step3.subtitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs">
              <div>
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step3.nameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('platform.tenantWizard.step3.namePlaceholder')}
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step3.emailLabel')}</label>
                <input
                  type="email"
                  required
                  placeholder={t('platform.tenantWizard.step3.emailPlaceholder')}
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="w-full bg-surface-sunken border border-default rounded-xl px-4 py-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step3.passwordLabel')}</label>
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
                <label className="block text-default font-semibold mb-1">{t('platform.tenantWizard.step3.phoneLabel')}</label>
                <input
                  type="tel"
                  placeholder={t('platform.tenantWizard.step3.phonePlaceholder')}
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
                <span>{t('platform.tenantWizard.step3.backBtn')}</span>
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
                    <span>{t('platform.tenantWizard.step3.provisionBtn')}</span>
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
              {t('platform.tenantWizard.step4.title')}
            </h2>
            <p className="text-xs font-mono text-muted max-w-md mx-auto">
              {t('platform.tenantWizard.step4.subtitle')}
            </p>

            <div className="p-6 rounded-2xl bg-surface-sunken border border-default text-left font-mono text-xs space-y-3 max-w-lg mx-auto">
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">{t('platform.tenantWizard.step4.tenantName')}</span>
                <span className="text-default font-bold">{provisionedData?.tenant?.name || 'Provisioned Tenant'}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">{t('platform.tenantWizard.step4.subdomain')}</span>
                <span className="text-amber-500">{provisionedData?.tenant?.slug || 'workspace'}.devcenterpoint.com</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">{t('platform.tenantWizard.step4.storefrontUrl')}</span>
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
                <span className="text-muted">{t('platform.tenantWizard.step4.storefrontPages')}</span>
                <span className="text-emerald-500 font-medium">{t('platform.tenantWizard.step4.storefrontPagesCount')}</span>
              </div>
              <div className="flex justify-between border-b border-default pb-2">
                <span className="text-muted">{t('platform.tenantWizard.step4.warehouses')}</span>
                <span className="text-default">{t('platform.tenantWizard.step4.warehousesList')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t('platform.tenantWizard.step4.tenantId')}</span>
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
                {t('platform.tenantWizard.step4.visitStorefront')}
              </a>
              <button
                onClick={() => navigate('/platform/tenants')}
                className="px-6 py-2.5 rounded-xl bg-surface-raised hover:bg-surface text-default border border-default transition-colors cursor-pointer"
              >
                {t('platform.tenantWizard.step4.tenantDirectory')}
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
                {t('platform.tenantWizard.step4.provisionAnother')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TenantRegistrationWizard;
