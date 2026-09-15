import React from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import type { StorefrontConfig, StorefrontOrderConfirmation } from '../../types/api/storefront';
import { useCurrency } from '../../hooks/useCurrency';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

export const StorefrontOrderConfirmationPage: React.FC = () => {
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { formatCurrency, currencyCode } = useCurrency();
  const location = useLocation();
  const order = (location.state as { order?: StorefrontOrderConfirmation })?.order;

  const currency = order?.currency ?? config.currency ?? currencyCode;

  return (
    <div className="max-w-xl mx-auto py-8">
      <div
        style={{ borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))' }}
        className="rounded-3xl border bg-white dark:bg-zinc-900/60 p-8 sm:p-10 text-center shadow-xs space-y-6"
      >
        <div
          style={{
            backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
            color: 'var(--store-primary, #10b981)',
          }}
          className="flex h-20 w-20 items-center justify-center rounded-full mx-auto shadow-inner"
        >
          <CheckCircle className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Order Confirmed!
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            Thank you for ordering with {config.name}. Your order has been dispatched directly to our production queue.
          </p>
        </div>

        {order && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 p-5 text-left space-y-3">
            <div className="flex justify-between items-center text-xs border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
              <span className="text-slate-500 dark:text-zinc-500">Order Number</span>
              <span
                style={{ color: 'var(--store-primary, #10b981)' }}
                className="font-mono font-bold"
              >
                {order.order_number}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
              <span className="text-slate-500 dark:text-zinc-500">Total Amount</span>
              <span className="font-bold text-slate-900 dark:text-zinc-100">
                {currency} {parseFloat(order.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-zinc-500">Payment Status</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {order.payment_method.toUpperCase()} (Pending on Delivery)
              </span>
            </div>
          </div>
        )}

        <div className="pt-2 space-y-2">
          {order && (
            <a
              href={`https://wa.me/${(config.whatsapp_number || '+8801700000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `Hello ${config.name}, I have just placed order #${order.order_number} for ${formatCurrency(
                  order.total_amount
                )}. Please confirm receipt and delivery schedule.`
              )}`}
              target="_blank"
              rel="noreferrer"
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-xs font-bold hover:opacity-90 transition-all shadow-xs"
            >
              <span>💬 Chat on WhatsApp for Live Order Updates</span>
            </a>
          )}

          <Link
            to={getStorefrontUrl(subdomain)}
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl py-3 text-xs font-bold shadow-lg transition-all cursor-pointer hover:opacity-90"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
