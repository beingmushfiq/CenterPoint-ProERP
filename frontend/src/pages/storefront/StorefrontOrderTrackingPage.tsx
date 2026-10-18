import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  AlertCircle,
  Truck,
  Package,
  Calendar,
  MessageCircle,
  Copy,
  Check,
  MapPin,
  Clock,
  Factory,
  ShieldCheck,
  Share2,
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
  delivery_type?: string;
  courier_reference?: string;
  estimated_delivery?: string;
  customer_name: string;
  customer_phone?: string;
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
  const [copied, setCopied] = useState(false);

  const fetchTrack = useCallback(async (targetOrder: string, targetPhone?: string) => {
    if (!targetOrder.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { order_number: targetOrder.trim() };
      if (targetPhone && targetPhone.trim()) params.phone = targetPhone.trim();

      const response = await api.get<{ data?: TrackedOrderDetails } | TrackedOrderDetails>(
        '/storefront/orders/track',
        {
          headers: {
            'X-Storefront-Subdomain': subdomain,
          },
          params,
        }
      );

      const data = 'data' in response.data && response.data.data ? response.data.data : (response.data as TrackedOrderDetails);
      setOrder(data);
      setSearchParams(params);
    } catch (err: unknown) {
      setOrder(null);
      const msg = err instanceof Error ? err.message : 'No order found with the provided details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [subdomain, setSearchParams]);

  // Auto-fetch if order_number was provided in URL query string
  useEffect(() => {
    const urlOrder = searchParams.get('order_number');
    if (urlOrder && !order) {
      void fetchTrack(urlOrder, searchParams.get('phone') || undefined);
    }
  }, [searchParams, order, fetchTrack]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Please enter your order number.');
      return;
    }
    void fetchTrack(orderNumber, phone);
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currency = order?.currency ?? config.currency ?? 'BDT';

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'placed':
        return Package;
      case 'confirmed':
        return Factory;
      case 'dispatched':
        return Truck;
      case 'delivered':
        return CheckCircle2;
      default:
        return Clock;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
          <Truck className="size-3.5" />
          <span>Live Dispatch & Production Telemetry</span>
        </div>
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
              {t('storefront.recipientPhone')} <span className="text-[10px] text-slate-400 lowercase">(optional verification)</span>
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
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 hover:opacity-90 touch-target"
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
          {/* Top Status & Estimate Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                Estimated Delivery
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="size-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {order.estimated_delivery || '2-3 Business Days'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>On-Track & Guaranteed</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                Courier / Method
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Truck className="size-4 text-sky-500 shrink-0" />
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {order.delivery_type || 'Standard Express Courier'}
                </span>
              </div>
              {order.courier_reference && (
                <div className="mt-2 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                  Waybill: <strong className="text-slate-800 dark:text-zinc-200">{order.courier_reference}</strong>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                  Payment Status
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                    {order.payment_status}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-400">Total:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {currency} {parseFloat(order.total_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Stepper Timeline Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="font-mono text-sm font-bold"
                  >
                    #{order.order_number}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copy Tracking Link"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="size-3 text-emerald-500" /> : <Share2 className="size-3" />}
                  </button>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {t('storefront.recipient')}: <strong>{order.customer_name}</strong> {order.customer_phone ? `(${order.customer_phone})` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                    color: 'var(--store-primary, #10b981)',
                  }}
                  className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                >
                  {order.status}
                </span>
              </div>
            </div>

            {/* Stepper Steps */}
            <div className="relative pl-7 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
              {order.timeline.map((step, idx) => {
                const IconComponent = getStageIcon(step.stage);
                return (
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
                      className={`absolute -left-7 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        step.completed
                          ? 'shadow-md ring-4 ring-emerald-500/10'
                          : step.current
                          ? 'border-2 border-emerald-500 bg-white dark:bg-zinc-950 text-emerald-600 animate-pulse'
                          : 'border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    <div className="grow">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-bold ${
                            step.completed
                              ? 'text-slate-900 dark:text-zinc-100'
                              : step.current
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-zinc-500'
                          }`}
                        >
                          {step.title}
                        </h4>
                        {step.current && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            Current Stage
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">{step.description}</p>
                      {step.timestamp && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-1 font-mono">
                          {new Date(step.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions at bottom of timeline */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <a
                href={`https://wa.me/${(config.whatsapp_number || '+8801700000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${config.name}, I am inquiring about the delivery timeline of my Order #${order.order_number}. Current status is: ${order.status}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <MessageCircle className="size-4" />
                <span>Inquire on WhatsApp about Order</span>
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Link Copied!' : 'Copy Direct Tracking Link'}</span>
              </button>
            </div>
          </div>

          {/* Delivery Destination & Line Items */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Delivery Destination */}
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                <MapPin className="size-4 text-emerald-500" />
                <span>Shipping Address</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-line leading-relaxed">
                {order.delivery_address || 'Address on file with merchant.'}
              </p>
            </div>

            {/* Line Items & Summary Card */}
            <div className="sm:col-span-2 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
                {t('storefront.orderItems')} ({order.items.length})
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 max-h-48 overflow-y-auto">
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

              <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-1.5 text-xs">
                {parseFloat(order.discount_amount || '0') > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Discount Applied:</span>
                    <span>-{currency} {parseFloat(order.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-zinc-100 pt-1 border-t border-slate-100 dark:border-zinc-800">
                  <span>{t('storefront.totalAmount')}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {currency} {parseFloat(order.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

