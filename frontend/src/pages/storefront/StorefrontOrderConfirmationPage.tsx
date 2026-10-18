import React, { useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ArrowRight, MessageCircle, Copy, Check, MapPin } from 'lucide-react';
import type { StorefrontConfig, StorefrontOrderConfirmation } from '../../types/api/storefront';
import { useCurrency } from '../../hooks/useCurrency';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';
import { api } from '../../lib/api/client';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

export const StorefrontOrderConfirmationPage: React.FC = () => {
  const { t } = useTranslation(['storefront', 'common']);
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { formatCurrency, currencyCode } = useCurrency();
  const location = useLocation();
  const order = (location.state as { order?: StorefrontOrderConfirmation })?.order;

  const currency = order?.currency ?? config.currency ?? currencyCode;

  const [copied, setCopied] = useState(false);
  const [waLoading, setWaLoading] = useState(false);

  const handleCopyReceipt = () => {
    if (!order) return;
    const text = `Order #${order.order_number} confirmed at ${config.name}. Total: ${currency} ${parseFloat(order.total_amount).toFixed(2)}. Status: ${order.status.toUpperCase()}.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareOfficialReceipt = async () => {
    if (!order) return;
    setWaLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { whatsapp_url: string } }>(
        '/storefront/whatsapp/order-link',
        { order_number: order.order_number },
        { headers: { 'X-Storefront-Subdomain': subdomain } }
      );
      if (res.data?.data?.whatsapp_url) {
        window.open(res.data.data.whatsapp_url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Fallback direct URL
      const waNum = (config.whatsapp_number || '+8801700000000').replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(
        `Hello ${config.name}, here is my Order #${order.order_number} for ${formatCurrency(order.total_amount)}. Please confirm receipt and delivery schedule.`
      );
      window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
    } finally {
      setWaLoading(false);
    }
  };

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
            {t('storefront.orderConfirmedTitle')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            {t('storefront.orderConfirmedMsg', { name: config.name })}
          </p>
        </div>

        {order && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 p-5 text-left space-y-3">
            <div className="flex justify-between items-center text-xs border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
              <span className="text-slate-500 dark:text-zinc-500">{t('storefront.orderNumber')}</span>
              <div className="flex items-center gap-2">
                <span
                  style={{ color: 'var(--store-primary, #10b981)' }}
                  className="font-mono font-bold"
                >
                  {order.order_number}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  title="Copy Order Summary"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
              <span className="text-slate-500 dark:text-zinc-500">{t('storefront.totalAmount')}</span>
              <span className="font-bold text-slate-900 dark:text-zinc-100">
                {currency} {parseFloat(order.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-zinc-500">{t('storefront.paymentStatus')}</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {order.payment_method.toUpperCase()} ({t('storefront.pendingOnDelivery')})
              </span>
            </div>
          </div>
        )}

        <div className="pt-2 space-y-2.5">
          {order && (
            <>
              <button
                type="button"
                onClick={handleShareOfficialReceipt}
                disabled={waLoading}
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white py-3 text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 touch-target active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{waLoading ? 'Generating WhatsApp Receipt...' : 'Share Receipt via WhatsApp'}</span>
              </button>

              <Link
                to={getStorefrontUrl(subdomain, `/track?order_number=${order.order_number}`)}
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80 py-2.5 text-xs font-bold transition-all shadow-xs"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                <span>Track Live Order Status</span>
              </Link>
            </>
          )}

          <Link
            to={getStorefrontUrl(subdomain)}
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl py-3 text-xs font-bold shadow-lg transition-all cursor-pointer hover:opacity-90"
          >
            <span>{t('storefront.continueShopping')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

