import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformPlan } from '../../types/api/platform';
import { PlatformPulseLoader } from '../../components/platform/PlatformPulseLoader';
import { SelectDropdown } from '../../components/ui/Dropdown';
import {
  Sparkles,
  Check,
  X,
  Users,
  Building2,
  ShoppingCart,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Package,
  Layers,
  Cpu,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

const MODULE_OPTIONS = [
  { key: 'pos', labelKey: 'pos', defaultLabel: 'POS Terminal Engine', icon: ShoppingCart },
  { key: 'production', labelKey: 'production', defaultLabel: 'Production Batches & Routing', icon: Cpu },
  { key: 'qc', labelKey: 'qc', defaultLabel: 'Quality Control & Rework', icon: ShieldAlert },
  { key: 'storefront', labelKey: 'storefront', defaultLabel: 'B2C E-Commerce Storefront', icon: Package },
  { key: 'multi_branch', labelKey: 'multi_branch', defaultLabel: 'Multi-Branch Scope', icon: Building2 },
  { key: 'accounting', labelKey: 'accounting', defaultLabel: 'Financials & Invoicing', icon: DollarSign },
];

export const PlanManagerWorkspace: React.FC = () => {
  const { t } = useTranslation(['platform', 'common']);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    price: 99,
    billing_period: 'monthly',
    max_users: 10,
    max_warehouses: 2,
    max_monthly_orders: 1000,
    max_products: 500,
    features: {
      pos: true,
      production: true,
      qc: true,
      storefront: true,
      multi_branch: false,
      accounting: true,
    } as Record<string, boolean>,
    is_active: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: plans = [], isLoading, isFetching, refetch } = useQuery<PlatformPlan[]>({
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

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      code: '',
      price: 99,
      billing_period: 'monthly',
      max_users: 10,
      max_warehouses: 2,
      max_monthly_orders: 1000,
      max_products: 500,
      features: {
        pos: true,
        production: true,
        qc: true,
        storefront: true,
        multi_branch: false,
        accounting: true,
      },
      is_active: true,
    });
    setFormError(null);
    setIsCreating(true);
  };

  const openEditModal = (plan: PlatformPlan) => {
    setEditingPlan(plan);
    const limits = plan.limits || {};
    const features = plan.features || {};

    setFormData({
      name: plan.name,
      code: plan.code,
      price: plan.price,
      billing_period: plan.billing_period,
      max_users: (limits['max_users'] as number) ?? 10,
      max_warehouses: (limits['max_warehouses'] as number) ?? 2,
      max_monthly_orders: (limits['max_monthly_orders'] as number) ?? 1000,
      max_products: (limits['max_products'] as number) ?? 500,
      features: {
        pos: Boolean(features['pos'] ?? true),
        production: Boolean(features['production'] ?? true),
        qc: Boolean(features['qc'] ?? true),
        storefront: Boolean(features['storefront'] ?? true),
        multi_branch: Boolean(features['multi_branch'] ?? false),
        accounting: Boolean(features['accounting'] ?? true),
      },
      is_active: plan.is_active ?? true,
    });
    setFormError(null);
    setIsCreating(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      name: formData.name,
      code: formData.code.toLowerCase(),
      price: Number(formData.price),
      billing_period: formData.billing_period,
      limits: {
        max_users: Number(formData.max_users),
        max_warehouses: Number(formData.max_warehouses),
        max_monthly_orders: Number(formData.max_monthly_orders),
        max_products: Number(formData.max_products),
      },
      features: formData.features,
      is_active: formData.is_active,
    };

    try {
      if (editingPlan) {
        await api.patch(`/platform/plans/${editingPlan.id}`, payload);
        toast.success(t('platform.planManager.toast.updated', { name: formData.name }));
      } else {
        await api.post('/platform/plans', payload);
        toast.success(t('platform.planManager.toast.created', { name: formData.name }));
      }
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
      setIsCreating(false);
      setEditingPlan(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('platform.planManager.toast.saveFailed');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePlan = async (plan: PlatformPlan) => {
    if ((plan.tenants_count ?? 0) > 0) {
      toast.error(t('platform.planManager.toast.cannotDelete', { name: plan.name, count: plan.tenants_count }));
      return;
    }
    if (!confirm(t('platform.planManager.toast.confirmDelete', { name: plan.name }))) return;

    setDeletingPlanId(plan.id);
    try {
      await api.delete(`/platform/plans/${plan.id}`);
      toast.success(t('platform.planManager.toast.deleted', { name: plan.name }));
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('platform.planManager.toast.deleteFailed');
      toast.error(msg);
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {t('platform.planManager.badge')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-2.5">
            <Sparkles className="size-6 text-amber-500" />
            <span>{t('platform.planManager.title')}</span>
          </h1>
          <p className="text-xs text-muted mt-1 font-mono max-w-2xl">
            {t('platform.planManager.description')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 text-muted hover:text-default hover:bg-surface-raised rounded-xl border border-default transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title={t('platform.planManager.refreshTooltip')}
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin text-amber-500' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all font-mono cursor-pointer"
          >
            <Plus className="size-4" />
            <span>{t('platform.planManager.createPlan')}</span>
          </button>
        </div>
      </div>

      {/* Plan Grid */}
      {isLoading ? (
        <div className="py-20">
          <PlatformPulseLoader
            label={t('platform.planManager.loading')}
            sublabel={t('platform.planManager.loadingSub')}
          />
        </div>
      ) : plans.length === 0 ? (
        <div className="py-20 text-center font-mono">
          <Layers className="size-10 text-subtle mx-auto mb-3" />
          <div className="text-sm font-bold text-default font-sans">{t('platform.planManager.emptyTitle')}</div>
          <p className="text-xs text-muted mt-1">{t('platform.planManager.emptyDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {plans.map((plan, index) => {
              const features = (plan.features as Record<string, boolean>) || {};
              const limits = (plan.limits as Record<string, number | string>) || {};

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className="p-6 rounded-2xl bg-surface border border-default shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/40 transition-all"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-500 via-amber-400 to-cyan-500" />

                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-surface-raised text-amber-500 border border-default">
                        {plan.code.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        {plan.is_active === false && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-mono font-bold border border-rose-500/20">
                            {t('platform.planManager.inactiveBadge')}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-muted bg-surface-raised px-2 py-0.5 rounded-full border border-default">
                          {t('platform.planManager.tenantsCount', { count: plan.tenants_count ?? 0 })}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-default font-sans">{plan.name}</h3>

                    {/* Pricing */}
                    <div className="my-4 flex items-baseline gap-1.5 font-mono">
                      <span className="text-3xl font-extrabold text-default">
                        {t('platform.planManager.bdt')} {plan.price}
                      </span>
                      <span className="text-xs text-muted">
                        {t('platform.planManager.perPeriod', { period: plan.billing_period })}
                      </span>
                    </div>

                    {/* Quota Limits */}
                    <div className="space-y-2 border-t border-default/60 pt-4 font-mono text-xs text-default">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted">
                          <Users className="size-3.5 text-amber-500" />
                          <span>{t('platform.planManager.maxUsers')}</span>
                        </span>
                        <strong className="text-default">{limits['max_users'] ?? t('platform.planManager.unlimited')}</strong>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted">
                          <Building2 className="size-3.5 text-amber-500" />
                          <span>{t('platform.planManager.warehouses')}</span>
                        </span>
                        <strong className="text-default">{limits['max_warehouses'] ?? t('platform.planManager.unlimited')}</strong>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted">
                          <ShoppingCart className="size-3.5 text-amber-500" />
                          <span>{t('platform.planManager.monthlyOrders')}</span>
                        </span>
                        <strong className="text-default">{limits['max_monthly_orders'] ?? t('platform.planManager.unlimited')}</strong>
                      </div>
                    </div>

                    {/* Dynamic Modules Matrix */}
                    <div className="mt-4 pt-4 border-t border-default/60 space-y-2 font-mono text-xs">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted block mb-1">
                        {t('platform.planManager.moduleEntitlements')}
                      </span>
                      {MODULE_OPTIONS.map((m) => {
                        const isEnabled = features[m.key] ?? false;
                        const Icon = m.icon;
                        const label = t(`platform.planManager.modules.${m.labelKey}` as unknown as 'platform.planManager.modules.pos', m.defaultLabel);
                        return (
                          <div
                            key={m.key}
                            className={`flex items-center justify-between py-0.5 ${
                              isEnabled ? 'text-default' : 'text-subtle'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon className={`size-3.5 ${isEnabled ? 'text-emerald-500' : 'text-subtle'}`} />
                              <span className={isEnabled ? '' : 'line-through opacity-60'}>{label}</span>
                            </span>
                            {isEnabled ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <X className="size-3.5 text-subtle" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Action Controls */}
                  <div className="mt-6 pt-4 border-t border-default flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEditModal(plan)}
                      className="flex-1 py-2 rounded-xl bg-surface-raised hover:bg-surface text-default text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans shadow-xs border border-default"
                    >
                      <Edit2 className="size-3.5 text-amber-500" />
                      <span>{t('platform.planManager.editPackage')}</span>
                    </button>

                    <button
                      onClick={() => handleDeletePlan(plan)}
                      disabled={deletingPlanId === plan.id || (plan.tenants_count ?? 0) > 0}
                      className="p-2 rounded-xl text-subtle hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={
                        (plan.tenants_count ?? 0) > 0
                          ? t('platform.planManager.cannotDeleteWithTenants')
                          : t('platform.planManager.deletePlan')
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface border border-default rounded-2xl p-6 max-w-lg w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-default font-sans">
              {editingPlan
                ? t('platform.planManager.modal.editTitle', { name: editingPlan.name })
                : t('platform.planManager.modal.createTitle')}
            </h2>
            <p className="text-xs text-muted mt-1 font-mono">
              {t('platform.planManager.modal.subtitle')}
            </p>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-default mb-1 font-semibold">{t('platform.planManager.modal.planName')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('platform.planManager.modal.planNamePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-default mb-1 font-semibold">{t('platform.planManager.modal.planCode')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('platform.planManager.modal.planCodePlaceholder')}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-default mb-1 font-semibold">{t('platform.planManager.modal.price')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-default mb-1">{t('platform.planManager.modal.billingFrequency')}</label>
                  <SelectDropdown
                    options={[
                      { value: 'monthly', label: t('platform.planManager.modal.monthly') },
                      { value: 'yearly', label: t('platform.planManager.modal.yearly') },
                    ]}
                    value={formData.billing_period}
                    onChange={(val) => setFormData({ ...formData, billing_period: val })}
                    size="md"
                    buttonClassName="w-full bg-surface-sunken border-default text-default font-mono"
                    aria-label={t('platform.planManager.modal.billingFrequency')}
                  />
                </div>

                <div>
                  <label className="block text-default mb-1">{t('platform.planManager.modal.maxUsers')}</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-default mb-1">{t('platform.planManager.modal.maxWarehouses')}</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_warehouses}
                    onChange={(e) => setFormData({ ...formData, max_warehouses: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-default mb-1">{t('platform.planManager.modal.maxMonthlyOrders')}</label>
                  <input
                    type="number"
                    min="10"
                    value={formData.max_monthly_orders}
                    onChange={(e) => setFormData({ ...formData, max_monthly_orders: parseInt(e.target.value) || 10 })}
                    className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Module Inclusion Toggles */}
              <div className="pt-3 border-t border-default">
                <span className="block text-default mb-2 font-semibold">{t('platform.planManager.modal.includedModules')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_OPTIONS.map((m) => {
                    const checked = Boolean(formData.features[m.key]);
                    const label = t(`platform.planManager.modules.${m.labelKey}` as unknown as 'platform.planManager.modules.pos', m.defaultLabel);
                    return (
                      <label
                        key={m.key}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          checked
                            ? 'bg-amber-500/10 border-amber-500/40 text-default'
                            : 'bg-surface-sunken border-default text-subtle'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              features: {
                                ...formData.features,
                                [m.key]: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-default text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-[11px] font-sans font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-default flex items-center justify-between">
                <label className="flex items-center gap-2 text-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-default text-amber-500 focus:ring-amber-500"
                  />
                  <span>{t('platform.planManager.modal.activeTier')}</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingPlan(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface text-default border border-default transition-colors cursor-pointer"
                  >
                    {t('platform.planManager.modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    {formSubmitting
                      ? t('platform.planManager.modal.saving')
                      : editingPlan
                      ? t('platform.planManager.modal.updatePlan')
                      : t('platform.planManager.modal.publishPlan')}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PlanManagerWorkspace;
