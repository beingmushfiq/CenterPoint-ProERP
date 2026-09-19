import React, { useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { SeoHead } from '../../components/seo/SeoHead';
import type { StorefrontConfig } from '../../types/api/storefront';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

interface OrderTimelineStage {
  stage: string;
  title: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
  current: boolean;
}

interface TrackedOrderDetails {
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  delivery_address: string;
  customer_name: string;
  items: {
    id: number;
    product_name: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }[];
  timeline: OrderTimelineStage[];
}

export const StorefrontOrderTrackingPage: React.FC = () => {
  const { t } = useTranslation(['storefront', 'common']);
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orderNumber, setOrderNumber] = useState(searchParams.get('order_number') ?? '');
  const [phone, setPhone] = useState(searchParams.get('phone') ?? '');
  const [order, setOrder] = useState<TrackedOrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Please enter your order number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { order_number: orderNumber.trim() };
      if (phone.trim()) params.phone = phone.trim();

      const response = await api.get<TrackedOrderDetails>('/storefront/orders/track', {
        headers: {
          'X-Storefront-Subdomain': subdomain,
        },
        params,
      });

      setOrder(response.data);
      setSearchParams(params);
    } catch (err: unknown) {
      setOrder(null);
      const msg = err instanceof Error ? err.message : 'No order found with the provided details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const currency = order?.currency ?? config.currency ?? 'BDT';

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <SeoHead
        title="Track Order Status"
        description="Real-time live factory production batch and 3PL courier tracking"
        noIndex={true}
        brandName={config?.name ?? 'Slice Mart'}
      />

      {/* Back Button */}
      <Link
        to={getStorefrontUrl(subdomain, '/products')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t('storefront.backToCatalog')}</span>
      </Link>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {t('storefront.trackPageTitle')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          {t('storefront.trackPageSubtitle')}
        </p>
      </div>

      {/* Search Input Box */}
      <form
        onSubmit={handleTrack}
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              {t('storefront.orderRefNumber')}
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SO-ONL-2026..."
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              {t('storefront.recipientPhone')}
            </label>
            <input
              type="tel"
              placeholder="+8801..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: 'var(--store-primary, #10b981)',
            color: 'var(--store-primary-fg, #ffffff)',
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 hover:opacity-90"
        >
          {loading ? (
            <span>{t('storefront.locatingOrder')}</span>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>{t('storefront.trackOrderBtn')}</span>
            </>
          )}
        </button>
      </form>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* Timeline Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-4">
              <div>
                <span
                  style={{ color: 'var(--store-primary, #10b981)' }}
                  className="font-mono text-xs font-bold"
                >
                  {order.order_number}
                </span>
                <div className="text-xs text-slate-500 dark:text-zinc-400">{t('storefront.recipient')}: {order.customer_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                    color: 'var(--store-primary, #10b981)',
                  }}
                  className="rounded-full px-3 py-1 text-xs font-bold capitalize"
                >
                  {order.status}
                </span>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
              {order.timeline.map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div
                    style={
                      step.completed
                        ? {
                            backgroundColor: 'var(--store-primary, #10b981)',
                            color: 'var(--store-primary-fg, #ffffff)',
                          }
                        : undefined
                    }
                    className={`absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      step.completed
                        ? 'shadow-md'
                        : 'border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    {step.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>

                  <div>
                    <h4
                      className={`text-xs font-bold ${
                        step.completed ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">{step.description}</p>
                    {step.timestamp && (
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-1">
                        {new Date(step.timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Line Items & Summary Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
              {t('storefront.orderItems')} ({order.items.length})
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {order.items.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.product_name}</span>
                    <span className="text-slate-400 dark:text-zinc-500 block text-[11px]">Qty: {item.quantity}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-zinc-300">
                    {currency} {parseFloat(item.line_total).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 flex justify-between text-sm font-bold text-slate-900 dark:text-zinc-100">
              <span>{t('storefront.totalAmount')}</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {currency} {parseFloat(order.total_amount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
