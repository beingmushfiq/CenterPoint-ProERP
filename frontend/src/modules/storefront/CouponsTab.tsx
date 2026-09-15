import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Plus,
  Zap,
  Copy,
  Check,
  Edit2,
  Trash2,
  Search,
  Percent,
  Coins,
  Truck,
  Sparkles,
  RefreshCw,
  Clock,
  X,
  Tag,
  ShoppingBag,
  FileUp,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useCurrency } from '../../hooks/useCurrency';
import { notify } from '../../components/ui/Toast';
import { UniversalImportModal } from '../../components/import/UniversalImportModal';
import { couponImportSchema } from './schemas/couponImportSchema';
import type { Coupon, CouponStats } from '../../types/api/coupons';

interface CouponFormData {
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string;
  usage_limit_total: string;
  usage_limit_per_customer: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

interface BatchFormData {
  prefix: string;
  count: number;
  name: string;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string;
  usage_limit_total: string;
  usage_limit_per_customer: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const DEFAULT_COUPON_FORM: CouponFormData = {
  code: '',
  name: '',
  discount_type: 'percentage',
  discount_value: '10',
  min_order_amount: '',
  max_discount_amount: '',
  usage_limit_total: '',
  usage_limit_per_customer: '1',
  starts_at: '',
  ends_at: '',
  is_active: true,
};

const DEFAULT_BATCH_FORM: BatchFormData = {
  prefix: 'PROMO',
  count: 10,
  name: 'Campaign Promo Voucher',
  discount_type: 'fixed',
  discount_value: '200',
  min_order_amount: '1000',
  max_discount_amount: '',
  usage_limit_total: '1',
  usage_limit_per_customer: '1',
  starts_at: '',
  ends_at: '',
  is_active: true,
};

export const CouponsTab: React.FC = () => {
  const { currencySymbol } = useCurrency();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats>({
    total_coupons: 0,
    active_coupons: 0,
    total_redemptions: 0,
    expired_coupons: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(DEFAULT_COUPON_FORM);
  const [batchData, setBatchData] = useState<BatchFormData>(DEFAULT_BATCH_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [generatedBatchResults, setGeneratedBatchResults] = useState<Coupon[] | null>(null);

  const fetchCoupons = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('discount_type', typeFilter);

      const res = await api.get<{ data: Coupon[]; meta?: { stats?: CouponStats } }>(
        `/sales/coupons?${params.toString()}`
      ).catch(() =>
        api.get<{ data: Coupon[]; meta?: { stats?: CouponStats } }>(
          `/storefront/coupons?${params.toString()}`
        )
      );

      const payload = res.data;
      if (Array.isArray(payload)) {
        setCoupons(payload);
      } else if (payload && typeof payload === 'object' && 'data' in payload) {
        setCoupons(payload.data || []);
        if (payload.meta?.stats) {
          setStats(payload.meta.stats);
        }
      }
    } catch {
      notify.error('Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (typeFilter !== 'all') params.set('discount_type', typeFilter);

        const res = await api.get<{ data: Coupon[]; meta?: { stats?: CouponStats } }>(
          `/sales/coupons?${params.toString()}`
        ).catch(() =>
          api.get<{ data: Coupon[]; meta?: { stats?: CouponStats } }>(
            `/storefront/coupons?${params.toString()}`
          )
        );

        if (ignore) return;
        const payload = res.data;
        if (Array.isArray(payload)) {
          setCoupons(payload);
        } else if (payload && typeof payload === 'object' && 'data' in payload) {
          setCoupons(payload.data || []);
          if (payload.meta?.stats) {
            setStats(payload.meta.stats);
          }
        }
      } catch {
        if (!ignore) notify.error('Failed to load coupons.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [search, statusFilter, typeFilter]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    notify.success(`Copied code "${code}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Quick Random Code Generator
  const generateRandomCode = (prefix = 'SAVE') => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      ...DEFAULT_COUPON_FORM,
      code: generateRandomCode('PROMO'),
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    api.get<any>(`/sales/coupons/${coupon.id}`).catch(() => api.get<any>(`/storefront/coupons/${coupon.id}`)).then((res) => {
      const live = (res?.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res?.data;
      if (live) setEditingCoupon((prev) => prev ? { ...prev, ...live } : live);
    }).catch(() => {});
    setFormData({
      code: coupon.code,
      name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || '',
      max_discount_amount: coupon.max_discount_amount || '',
      usage_limit_total: coupon.usage_limit_total ? String(coupon.usage_limit_total) : '',
      usage_limit_per_customer: coupon.usage_limit_per_customer ? String(coupon.usage_limit_per_customer) : '1',
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 10) : '',
      ends_at: coupon.ends_at ? coupon.ends_at.slice(0, 10) : '',
      is_active: coupon.is_active,
    });
    setShowCreateModal(true);
  };

  // Toggle active status
  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await api.post(`/sales/coupons/${coupon.id}/toggle-status`).catch(() =>
        api.post(`/storefront/coupons/${coupon.id}/toggle-status`)
      );
      notify.success(`Coupon ${coupon.code} is now ${coupon.is_active ? 'Disabled' : 'Active'}.`);
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
    } catch {
      notify.error('Failed to update status.');
    }
  };

  // Delete coupon
  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) return;
    try {
      await api.delete(`/sales/coupons/${coupon.id}`).catch(() =>
        api.delete(`/storefront/coupons/${coupon.id}`)
      );
      notify.success(`Coupon "${coupon.code}" deleted.`);
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    } catch {
      notify.error('Failed to delete coupon.');
    }
  };

  // Submit Single Coupon (Create / Update)
  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        discount_value: parseFloat(formData.discount_value) || 0,
        min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : null,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        usage_limit_total: formData.usage_limit_total ? parseInt(formData.usage_limit_total, 10) : null,
        usage_limit_per_customer: formData.usage_limit_per_customer ? parseInt(formData.usage_limit_per_customer, 10) : 1,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
      };

      if (editingCoupon) {
        await api.put(`/sales/coupons/${editingCoupon.id}`, payload).catch(() =>
          api.put(`/storefront/coupons/${editingCoupon.id}`, payload)
        );
        notify.success(`Coupon "${payload.code}" updated successfully!`);
      } else {
        await api.post('/sales/coupons', payload).catch(() =>
          api.post('/storefront/coupons', payload)
        );
        notify.success(`Coupon "${payload.code}" created and live!`);
      }
      setShowCreateModal(false);
      fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving coupon';
      notify.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Batch Generator
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...batchData,
        prefix: batchData.prefix.toUpperCase().trim(),
        count: Number(batchData.count),
        discount_value: parseFloat(batchData.discount_value) || 0,
        min_order_amount: batchData.min_order_amount ? parseFloat(batchData.min_order_amount) : null,
        max_discount_amount: batchData.max_discount_amount ? parseFloat(batchData.max_discount_amount) : null,
        usage_limit_total: batchData.usage_limit_total ? parseInt(batchData.usage_limit_total, 10) : 1,
        usage_limit_per_customer: batchData.usage_limit_per_customer ? parseInt(batchData.usage_limit_per_customer, 10) : 1,
        starts_at: batchData.starts_at || null,
        ends_at: batchData.ends_at || null,
      };

      const res = await api.post<{ data: Coupon[]; message: string }>('/sales/coupons/generate-batch', payload).catch(() =>
        api.post<{ data: Coupon[]; message: string }>('/storefront/coupons/generate-batch', payload)
      );
      notify.success(res.data?.message || 'Batch coupons generated successfully!');
      setGeneratedBatchResults(res.data?.data || []);
      fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate batch coupons';
      notify.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-2xl border border-default shadow-xs">
        <div>
          <h2 className="text-base font-bold text-default flex items-center gap-2">
            <Ticket className="size-5 text-emerald-500" />
            <span>Storefront Coupons & Discount Codes</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Manage promotional codes, campaign discounts, and auto-generate bulk customer vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all cursor-pointer shadow-2xs"
          >
            <FileUp className="size-3.5 text-primary" />
            <span>Import Coupons</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGeneratedBatchResults(null);
              setBatchData(DEFAULT_BATCH_FORM);
              setShowBatchModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-all cursor-pointer shadow-2xs"
          >
            <Zap className="size-3.5 text-violet-500" />
            <span>⚡ Generate Batch</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Coupon</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl border border-default p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="size-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Ticket className="size-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted">Active Promo Codes</span>
            <div className="text-xl font-black text-default mt-0.5">{stats.active_coupons}</div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready for checkout</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-default p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="size-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <ShoppingBag className="size-5 text-blue-500" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted">Total Redemptions</span>
            <div className="text-xl font-black text-default mt-0.5">{stats.total_redemptions}</div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Customer cart applications</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-default p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="size-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Tag className="size-5 text-violet-500" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted">Total Campaigns</span>
            <div className="text-xl font-black text-default mt-0.5">{stats.total_coupons}</div>
            <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Configured vouchers</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-default p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="size-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Clock className="size-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted">Expired / Depleted</span>
            <div className="text-xl font-black text-default mt-0.5">{stats.expired_coupons}</div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Archived promos</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-sunken p-3 rounded-2xl border border-default">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-3.5 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Search code or campaign name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-default bg-surface text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="all">All Discount Types</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ({currencySymbol})</option>
            <option value="free_shipping">Free Shipping</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Disabled</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => fetchCoupons(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-default bg-surface text-muted hover:text-default transition-all cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Coupons List ── */}
      <div className="bg-surface rounded-2xl border border-default overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-primary" />
            <span>Loading coupons & vouchers...</span>
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Ticket className="size-6" />
            </div>
            <h4 className="text-sm font-bold text-default">No Coupons Found</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Create your first promotional discount voucher or generate a batch of campaign codes for your shoppers.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer shadow-sm"
              >
                + Create Promo Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedBatchResults(null);
                  setBatchData(DEFAULT_BATCH_FORM);
                  setShowBatchModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-default bg-surface text-default hover:bg-surface-sunken transition-all cursor-pointer"
              >
                ⚡ Generate Batch
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken border-b border-default text-[11px] font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Code & Campaign</th>
                  <th className="px-4 py-3">Discount Value</th>
                  <th className="px-4 py-3">Usage & Limits</th>
                  <th className="px-4 py-3">Spend Rules</th>
                  <th className="px-4 py-3">Validity Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default/60">
                {coupons.map((coupon) => {
                  const isExpired = coupon.ends_at && new Date(coupon.ends_at) < new Date();
                  return (
                    <tr key={coupon.id} className="hover:bg-surface-sunken/40 transition-colors">
                      {/* Code & Campaign Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            title="Click to copy code"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer group"
                          >
                            <span>{coupon.code}</span>
                            {copiedCode === coupon.code ? (
                              <Check className="size-3 text-emerald-600" />
                            ) : (
                              <Copy className="size-3 opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                        <div className="font-semibold text-default text-xs mt-1">{coupon.name}</div>
                      </td>

                      {/* Discount Value */}
                      <td className="px-4 py-3.5">
                        {coupon.discount_type === 'percentage' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                            <Percent className="size-3" />
                            {parseFloat(coupon.discount_value)}% OFF
                          </span>
                        )}
                        {coupon.discount_type === 'fixed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                            <Coins className="size-3" />
                            {currencySymbol}{parseFloat(coupon.discount_value).toLocaleString()} OFF
                          </span>
                        )}
                        {coupon.discount_type === 'free_shipping' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                            <Truck className="size-3" />
                            Free Shipping
                          </span>
                        )}
                      </td>

                      {/* Usage & Limits */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-default">
                              {coupon.used_count} redeemed
                            </span>
                            <span className="text-muted font-mono text-[10px]">
                              {coupon.usage_limit_total ? `limit ${coupon.usage_limit_total}` : 'unlimited'}
                            </span>
                          </div>
                          {coupon.usage_limit_total && (
                            <div className="w-28 h-1.5 rounded-full bg-surface-sunken overflow-hidden border border-default">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (coupon.used_count / coupon.usage_limit_total) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Spend Rules */}
                      <td className="px-4 py-3.5 text-[11px] text-muted space-y-0.5">
                        {coupon.min_order_amount && parseFloat(coupon.min_order_amount) > 0 ? (
                          <div>Min spend: <span className="font-semibold text-default">{currencySymbol}{parseFloat(coupon.min_order_amount).toLocaleString()}</span></div>
                        ) : (
                          <div>No min spend</div>
                        )}
                        {coupon.max_discount_amount && parseFloat(coupon.max_discount_amount) > 0 && (
                          <div>Max cap: <span className="font-semibold text-default">{currencySymbol}{parseFloat(coupon.max_discount_amount).toLocaleString()}</span></div>
                        )}
                      </td>

                      {/* Validity Period */}
                      <td className="px-4 py-3.5 text-[11px]">
                        {coupon.ends_at ? (
                          <div>
                            <span className={isExpired ? 'text-red-500 font-semibold' : 'text-default'}>
                              {coupon.ends_at.slice(0, 10)}
                            </span>
                            {isExpired && (
                              <span className="block text-[9px] text-red-500 font-bold uppercase">Expired</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">No expiration</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(coupon)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border cursor-pointer transition-all ${
                            coupon.is_active && !isExpired
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-muted/15 text-muted border-default hover:bg-muted/25'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              coupon.is_active && !isExpired ? 'bg-emerald-500' : 'bg-muted'
                            }`}
                          />
                          <span>{coupon.is_active && !isExpired ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(coupon)}
                            className="size-7 rounded-lg flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon)}
                            className="size-7 rounded-lg flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Create / Edit Single Coupon ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-surface border border-default rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between p-5 border-b border-default sticky top-0 bg-surface z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Ticket className="size-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-default">
                    {editingCoupon ? 'Edit Promotional Coupon' : 'Create Promotional Coupon'}
                  </h3>
                  <p className="text-[11px] text-muted">Voucher will be immediately redeemable on the online storefront</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="size-7 rounded-lg flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSingle} className="p-5 space-y-4">
              {/* Promo Code with Auto-Gen button */}
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">Coupon Code (Promo Code)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. SUMMER20, FESTIVE500"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40 tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, code: generateRandomCode('PROMO') })}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="size-3 text-amber-500" />
                    <span>Auto-Code</span>
                  </button>
                </div>
              </div>

              {/* Campaign / Promotion Name */}
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">Campaign / Voucher Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Mega Sale 20% Off"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discount_type: e.target.value as 'percentage' | 'fixed' | 'free_shipping',
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ({currencySymbol})</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Discount Value {formData.discount_type === 'percentage' ? '(%)' : `(${currencySymbol})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={formData.discount_type === 'free_shipping'}
                    value={formData.discount_type === 'free_shipping' ? '0' : formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Spend Rules: Min Order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Min Order Spend ({currencySymbol}) <span className="font-normal text-[10px]">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1000"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Max Discount Cap ({currencySymbol}) <span className="font-normal text-[10px]">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Usage Limits: Total & Per Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Total Usage Limit <span className="font-normal text-[10px]">(blank = unlimited)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={formData.usage_limit_total}
                    onChange={(e) => setFormData({ ...formData, usage_limit_total: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Limit Per Customer
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usage_limit_per_customer}
                    onChange={(e) => setFormData({ ...formData, usage_limit_per_customer: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Validity Dates: Starts & Ends */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-default text-primary focus:ring-primary/40"
                  />
                  <span>Active & available for shopper cart redemption</span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCoupon ? 'Save Changes' : 'Generate Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Batch Promo Generator ── */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-surface border border-default rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between p-5 border-b border-default sticky top-0 bg-surface z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                  <Zap className="size-4 text-violet-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-default">Generate Batch Promo Vouchers</h3>
                  <p className="text-[11px] text-muted">Instantly batch-mint unique single-use or multi-use discount codes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="size-7 rounded-lg flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {generatedBatchResults ? (
              <div className="p-5 space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <Check className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-default">
                      {generatedBatchResults.length} Vouchers Generated Successfully!
                    </h4>
                    <p className="text-[10px] text-muted">Ready to share via SMS, email campaigns, or print cards</p>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 border border-default rounded-xl p-3 bg-surface-sunken">
                  {generatedBatchResults.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-surface p-2 rounded-lg border border-default"
                    >
                      <div>
                        <span className="font-mono font-bold text-xs text-default">{c.code}</span>
                        <span className="text-[10px] text-muted ml-2">({c.name})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(c.code)}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                      >
                        {copiedCode === c.code ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const all = generatedBatchResults.map((c) => c.code).join('\n');
                      navigator.clipboard.writeText(all);
                      notify.success(`Copied all ${generatedBatchResults.length} codes!`);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition-all cursor-pointer"
                  >
                    Copy All Codes (CSV/List)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-fg hover:opacity-90 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitBatch} className="p-5 space-y-4">
                {/* Prefix & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Code Prefix</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VIP, FLASH, AUTUMN"
                      value={batchData.prefix}
                      onChange={(e) => setBatchData({ ...batchData, prefix: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Number of Codes</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={batchData.count}
                      onChange={(e) => setBatchData({ ...batchData, count: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Campaign Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Campaign Base Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Customer Reward"
                    value={batchData.name}
                    onChange={(e) => setBatchData({ ...batchData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>

                {/* Type & Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Discount Type</label>
                    <select
                      value={batchData.discount_type}
                      onChange={(e) =>
                        setBatchData({
                          ...batchData,
                          discount_type: e.target.value as 'percentage' | 'fixed' | 'free_shipping',
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="fixed">Fixed Voucher ({currencySymbol})</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Discount Value {batchData.discount_type === 'percentage' ? '(%)' : `(${currencySymbol})`}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={batchData.discount_value}
                      onChange={(e) => setBatchData({ ...batchData, discount_value: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Min Order & Total Uses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Min Order Spend ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1000"
                      value={batchData.min_order_amount}
                      onChange={(e) => setBatchData({ ...batchData, min_order_amount: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Uses Per Code <span className="font-normal text-[10px]">(1 = single use)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={batchData.usage_limit_total}
                      onChange={(e) => setBatchData({ ...batchData, usage_limit_total: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={batchData.ends_at}
                    onChange={(e) => setBatchData({ ...batchData, ends_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-default">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-muted hover:text-default transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all shadow-md shadow-violet-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Zap className="size-3.5" />
                    <span>{submitting ? 'Generating...' : `Generate ${batchData.count} Promo Codes`}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <UniversalImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        config={couponImportSchema}
        onSuccess={() => {
          fetchCoupons(true);
        }}
      />
    </div>
  );
};
