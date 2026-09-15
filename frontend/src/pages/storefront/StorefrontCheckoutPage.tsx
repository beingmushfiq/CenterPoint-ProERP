import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Lock, ShoppingBag, Truck } from 'lucide-react';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import type { StorefrontConfig, StorefrontOrderConfirmation } from '../../types/api/storefront';
import { trackStorefrontInitiateCheckout, trackStorefrontPurchase } from '../../lib/storefront/storefrontTracking';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

export const StorefrontCheckoutPage: React.FC = () => {
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { cart, sessionToken, clearCart } = useStorefrontCartStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    delivery_address: '',
    city: '',
    payment_method: 'cod' as 'cod' | 'online' | 'bkash' | 'nagad',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = config.currency ?? 'BDT';
  const items = cart?.items ?? [];
  const cartTotal = cart?.total_amount ? parseFloat(cart.total_amount) : 0;

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
        <h2 className="text-base font-bold text-zinc-200">Your Cart is Empty</h2>
        <p className="text-xs text-zinc-500 mt-1">Please add some items to your cart before checking out.</p>
        <Link
          to={getStorefrontUrl(subdomain)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Catalog</span>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.phone || !form.delivery_address) {
      setError('Please fill in all required fields (Name, Phone, Delivery Address).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
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

      clearCart();
      navigate(getStorefrontUrl(subdomain, '/order-confirmed'), {
        state: { order: orderData },
      });
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
          <span>Continue Shopping</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">Secure Checkout</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400">Direct factory fulfillment to your doorstep.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Customer & Delivery Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Contact & Delivery Form Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Delivery Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000 or local number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                Delivery Address *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Street address, building, suite, or delivery instructions..."
                value={form.delivery_address}
                onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                City / Region
              </label>
              <input
                type="text"
                placeholder="e.g. City, State or Postal Area"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Payment Option</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
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
                  onChange={() => setForm({ ...form, payment_method: 'cod' })}
                  className="hidden"
                />
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Cash on Delivery (COD)</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">Pay cash upon parcel arrival</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                  form.payment_method === 'online'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="online"
                  checked={form.payment_method === 'online'}
                  onChange={() => setForm({ ...form, payment_method: 'online' })}
                  className="hidden"
                />
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Online Gateway</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500">bKash / Nagad / Cards</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              Order Summary
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
                <span>Subtotal</span>
                <span>{currency} {parseFloat(cart?.subtotal ?? '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Delivery Charge</span>
                <span>Free (Direct)</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>Total Amount</span>
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
                <span>Placing Order...</span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Confirm & Place Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
