import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  ShoppingBag,
  Truck,
  Smartphone,
  ShieldCheck,
  Sparkles,
  User,
  RotateCcw,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { useAuthStore } from '../../lib/auth/authStore';
import type { StorefrontConfig, StorefrontOrderConfirmation } from '../../types/api/storefront';
import { trackStorefrontInitiateCheckout, trackStorefrontPurchase } from '../../lib/storefront/storefrontTracking';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

export type PaymentOption = 'cod' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'online';

interface StoredCustomerProfile {
  customer_name: string;
  phone: string;
  email: string;
  delivery_address: string;
  city: string;
}

const STORAGE_CUSTOMER_KEY = 'storefront_customer_profile';

export const StorefrontCheckoutPage: React.FC = () => {
  const { t } = useTranslation(['storefront', 'common']);
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { cart, sessionToken, clearCart } = useStorefrontCartStore();
  const authUser = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // Mode: Guest vs Authenticated / Saved Customer
  const [checkoutMode, setCheckoutMode] = useState<'guest' | 'account'>('guest');
  const [savedProfile] = useState<StoredCustomerProfile | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_CUSTOMER_KEY);
        if (raw) {
          return JSON.parse(raw) as StoredCustomerProfile;
        }
      }
    } catch {
      // Storage restricted
    }
    return null;
  });

  const [form, setForm] = useState(() => {
    let initialProfile: StoredCustomerProfile | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_CUSTOMER_KEY);
        if (raw) {
          initialProfile = JSON.parse(raw) as StoredCustomerProfile;
        }
      }
    } catch {
      // Storage restricted
    }

    return {
      customer_name: initialProfile?.customer_name || '',
      phone: initialProfile?.phone || '',
      email: initialProfile?.email || '',
      delivery_address: initialProfile?.delivery_address || '',
      city: initialProfile?.city || '',
      payment_method: 'cod' as PaymentOption,
      transaction_id: '',
      notes: '',
    };
  });

  const mockCard = {
    number: '4242 •••• •••• 4242',
    exp: '12/28',
    cvv: '998',
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = config.currency ?? 'BDT';
  const items = cart?.items ?? [];
  const cartTotal = cart?.total_amount ? parseFloat(cart.total_amount) : 0;

  const handleSelectMode = (mode: 'guest' | 'account') => {
    setCheckoutMode(mode);
    if (mode === 'account' && authUser) {
      setForm((prev) => ({
        ...prev,
        customer_name: prev.customer_name || authUser.name || '',
        email: prev.email || authUser.email || '',
      }));
    }
  };

  // Track InitiateCheckout when checkout loads with items
  useEffect(() => {
    if (items.length > 0 && cartTotal > 0) {
      trackStorefrontInitiateCheckout(cartTotal, currency, items.length);
    }
  }, [items.length, cartTotal, currency]);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center max-w-lg mx-auto">
        <ShoppingBag className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-zinc-200">{t('storefront.cartEmptyTitle')}</h2>
        <p className="text-xs text-zinc-500 mt-1">{t('storefront.cartEmptyDesc')}</p>
        <Link
          to={getStorefrontUrl(subdomain)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('storefront.returnToCatalog')}</span>
        </Link>
      </div>
    );
  }

  const handleApplySavedProfile = () => {
    if (!savedProfile) return;
    setForm((prev) => ({
      ...prev,
      customer_name: savedProfile.customer_name,
      phone: savedProfile.phone,
      email: savedProfile.email,
      delivery_address: savedProfile.delivery_address,
      city: savedProfile.city,
    }));
  };

  const handleGenerateMockTxnId = (gateway: 'bkash' | 'nagad' | 'rocket' | 'card') => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const mockMap = {
      bkash: `BK-${randomHex}`,
      nagad: `NG-${randomHex}`,
      rocket: `RK-${randomHex}`,
      card: `AUTH-${randomHex}`,
    };
    setForm((prev) => ({ ...prev, transaction_id: mockMap[gateway] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.phone || !form.delivery_address) {
      setError('Please fill in all required fields (Name, Phone, Delivery Address).');
      return;
    }

    if (form.payment_method !== 'cod' && !form.transaction_id.trim()) {
      setError(`Please provide your ${form.payment_method.toUpperCase()} Transaction ID or click 'Simulate & Fill Demo TxnID' to proceed.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Save profile for future visits
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(
            STORAGE_CUSTOMER_KEY,
            JSON.stringify({
              customer_name: form.customer_name,
              phone: form.phone,
              email: form.email,
              delivery_address: form.delivery_address,
              city: form.city,
            })
          );
        }
      } catch {
        // Storage restricted
      }

      const response = await api.post<StorefrontOrderConfirmation | { data: StorefrontOrderConfirmation }>(
        '/storefront/checkout',
        {
          ...form,
          cart_token: sessionToken,
        },
        {
          headers: {
            'X-Storefront-Subdomain': subdomain,
            'X-Cart-Session': sessionToken,
          },
        }
      );

      const orderData =
        'data' in response.data && response.data.data
          ? response.data.data
          : (response.data as StorefrontOrderConfirmation);

      // Track purchase conversion for Meta Pixel & Google Analytics
      const orderTotal = parseFloat(String(orderData.total_amount || cartTotal || '0'));
      trackStorefrontPurchase({
        id: orderData.order_number,
        total: orderTotal,
        currency,
      });

      navigate(getStorefrontUrl(subdomain, '/order-confirmed'), {
        state: { order: orderData, transaction_id: form.transaction_id },
      });
      clearCart();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Checkout could not be completed. Please verify your details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          to={getStorefrontUrl(subdomain)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('storefront.continueShopping')}</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('storefront.secureCheckout')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{t('storefront.factoryFulfillment')}</p>
          </div>

          {/* Guest vs Account Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 text-xs">
            <button
              type="button"
              onClick={() => handleSelectMode('guest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                checkoutMode === 'guest'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Guest Checkout</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('account')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                checkoutMode === 'account'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="size-3 text-emerald-500" />
              <span>Customer Account</span>
            </button>
          </div>
        </div>
      </div>

      {savedProfile && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-700 dark:text-zinc-300">
              Saved profile detected for <strong>{savedProfile.customer_name}</strong> ({savedProfile.phone})
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplySavedProfile}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors cursor-pointer text-[11px]"
          >
            Auto-Fill Saved Info
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} data-testid="checkout-form" className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Customer & Delivery Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Contact & Delivery Form Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{t('storefront.deliveryInfo')}</h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                {checkoutMode === 'guest' ? 'Guest Mode' : 'Account Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  {t('storefront.fullName')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none touch-target"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  {t('storefront.phoneRequired')} *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+880 1700 000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none touch-target"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                {t('storefront.emailOptional')}
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none touch-target"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                {t('storefront.deliveryAddress')} *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Street address, building, suite, or delivery instructions..."
                value={form.delivery_address}
                onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                {t('storefront.cityRegion')}
              </label>
              <input
                type="text"
                placeholder="e.g. Dhaka, Chittagong or Region"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none touch-target"
              />
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{t('storefront.paymentOption')}</h2>
              </div>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <ShieldCheck className="size-3 text-emerald-500" />
                SSL & TLS Verified
              </span>
            </div>

            {/* Payment Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* COD */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  form.payment_method === 'cod'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="cod"
                  checked={form.payment_method === 'cod'}
                  onChange={() => setForm({ ...form, payment_method: 'cod', transaction_id: '' })}
                  className="hidden"
                />
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">{t('storefront.codTitle')}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">{t('storefront.codDesc')}</div>
                </div>
              </label>

              {/* bKash */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  form.payment_method === 'bkash'
                    ? 'border-[#E2136E] bg-[#E2136E]/10 text-[#E2136E] ring-1 ring-[#E2136E]'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="bkash"
                  checked={form.payment_method === 'bkash'}
                  onChange={() => setForm({ ...form, payment_method: 'bkash' })}
                  className="hidden"
                />
                <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-[#E2136E]" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>bKash Payment</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#E2136E]/20 text-[#E2136E] font-mono">Instant MFS</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Pay via personal or merchant bKash wallet</div>
                </div>
              </label>

              {/* Nagad */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  form.payment_method === 'nagad'
                    ? 'border-[#F7941D] bg-[#F7941D]/10 text-[#F7941D] ring-1 ring-[#F7941D]'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="nagad"
                  checked={form.payment_method === 'nagad'}
                  onChange={() => setForm({ ...form, payment_method: 'nagad' })}
                  className="hidden"
                />
                <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-[#F7941D]" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Nagad Digital Pay</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#F7941D]/20 text-[#F7941D] font-mono">MFS</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Post Office digital wallet gateway</div>
                </div>
              </label>

              {/* Rocket */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  form.payment_method === 'rocket'
                    ? 'border-[#8C3494] bg-[#8C3494]/10 text-[#8C3494] ring-1 ring-[#8C3494]'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="rocket"
                  checked={form.payment_method === 'rocket'}
                  onChange={() => setForm({ ...form, payment_method: 'rocket' })}
                  className="hidden"
                />
                <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-[#8C3494]" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>DBBL Rocket</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#8C3494]/20 text-[#8C3494] font-mono">DBBL</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Dutch-Bangla Bank mobile banking</div>
                </div>
              </label>

              {/* Credit / Debit Card */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all sm:col-span-2 ${
                  form.payment_method === 'card'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="card"
                  checked={form.payment_method === 'card'}
                  onChange={() => setForm({ ...form, payment_method: 'card' })}
                  className="hidden"
                />
                <CreditCard className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span>Credit / Debit Card</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono">
                      Visa / Mastercard / Amex
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                    Encrypted online transaction with instant 3D-Secure simulation
                  </div>
                </div>
              </label>
            </div>

            {/* Interactive Payment Gateway Placeholder Simulation Box */}
            {form.payment_method !== 'cod' && (
              <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                      {form.payment_method} Gateway Simulator
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                      Test Sandbox
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateMockTxnId(
                        form.payment_method as 'bkash' | 'nagad' | 'rocket' | 'card'
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    <span>Generate Demo TxnID</span>
                  </button>
                </div>

                {/* Gateway Specific Instructions */}
                {form.payment_method === 'bkash' && (
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                    <p>1. Open bKash App or dial *247#</p>
                    <p>
                      2. Choose <strong>Make Payment</strong> to Merchant Wallet: <code className="text-[#E2136E] font-bold">01700-112233</code>
                    </p>
                    <p>
                      3. Enter Amount: <strong>{currency} {parseFloat(cart?.total_amount ?? '0').toFixed(2)}</strong> and Reference: <code className="font-mono">{subdomain}</code>
                    </p>
                    <p>4. Enter your PIN and paste the TrxID below to verify order.</p>
                  </div>
                )}

                {form.payment_method === 'nagad' && (
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                    <p>1. Open Nagad App or dial *167#</p>
                    <p>
                      2. Select <strong>Merchant Pay</strong> to: <code className="text-[#F7941D] font-bold">01800-445566</code>
                    </p>
                    <p>
                      3. Enter Exact Amount: <strong>{currency} {parseFloat(cart?.total_amount ?? '0').toFixed(2)}</strong>
                    </p>
                    <p>4. Confirm payment and submit the transaction code below.</p>
                  </div>
                )}

                {form.payment_method === 'rocket' && (
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                    <p>1. Dial *322# or launch DBBL Rocket App</p>
                    <p>
                      2. Select <strong>Merchant Payment</strong> to Biller ID: <code className="text-[#8C3494] font-bold">2981</code>
                    </p>
                    <p>3. Submit the resulting TxnID for immediate order conversion.</p>
                  </div>
                )}

                {form.payment_method === 'card' && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs space-y-1">
                      <div className="text-[10px] text-muted flex justify-between">
                        <span>SIMULATED CARD TEST TERMINAL</span>
                        <span className="text-emerald-500 font-bold">EMV 3DS2</span>
                      </div>
                      <div className="text-slate-800 dark:text-zinc-200 font-bold tracking-widest">{mockCard.number}</div>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                        <span>EXP: {mockCard.exp}</span>
                        <span>CVV: {mockCard.cvv}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction ID Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-zinc-300">
                      Transaction ID / Auth Reference *
                    </label>
                    {form.transaction_id.trim().length >= 6 && (
                      <span data-testid="txn-verified-badge" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3" />
                        Txn Verified
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BKH87FA491 or click 'Generate Demo TxnID' above"
                    value={form.transaction_id}
                    onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white uppercase placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              {t('storefront.orderSummary')}
            </h2>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 max-h-56 overflow-y-auto space-y-2">
              {items.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex justify-between text-xs">
                  <div className="pr-2">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.product_name}</span>
                    <span className="text-slate-500 dark:text-zinc-500 block text-[11px]">Qty: {parseInt(item.quantity)}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-zinc-300">
                    {currency} {parseFloat(item.line_total).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-zinc-800/80 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>{t('storefront.subtotal')}</span>
                <span>{currency} {parseFloat(cart?.subtotal ?? '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>{t('storefront.deliveryCharge')}</span>
                <span>{t('storefront.freeDirect')}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>{t('storefront.totalAmount')}</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {currency} {parseFloat(cart?.total_amount ?? '0').toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer disabled:opacity-50 touch-target active:scale-95"
            >
              {loading ? (
                <span>{t('storefront.placingOrderText')}</span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>{t('storefront.confirmPlaceOrder')}</span>
                </>
              )}
            </button>

            <div className="text-center text-[10px] text-muted space-y-1 pt-1">
              <p className="flex items-center justify-center gap-1">
                <ShieldCheck className="size-3 text-emerald-500" />
                <span>256-bit Bank Grade Encrypted Checkout</span>
              </p>
              <p>Direct factory warranty & guaranteed fulfillment</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
