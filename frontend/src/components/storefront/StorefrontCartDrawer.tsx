import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import type { StorefrontConfig } from '../../types/api/storefront';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface StorefrontCartDrawerProps {
  config: StorefrontConfig | null;
  subdomain: string;
}

export const StorefrontCartDrawer: React.FC<StorefrontCartDrawerProps> = ({ config, subdomain }) => {
  const { cart, isDrawerOpen, closeDrawer, updateQuantity, removeItem } =
    useStorefrontCartStore();
  const navigate = useNavigate();

  if (!isDrawerOpen) return null;

  const items = cart?.items ?? [];
  const currency = config?.currency ?? 'USD';

  const handleCheckoutClick = () => {
    closeDrawer();
    navigate(getStorefrontUrl(subdomain, '/checkout'));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close cart drawer"
        className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-xs transition-opacity cursor-default border-none"
        onClick={closeDrawer}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeDrawer();
        }}
      />

      <div className="fixed inset-y-0 right-0 flex w-full max-w-full sm:max-w-md pl-4 sm:pl-10">
        <div className="w-full max-w-full border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-2xl flex flex-col justify-between text-slate-800 dark:text-zinc-100 transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Your Cart</h2>
              <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-slate-700 dark:text-zinc-300 font-medium">
                {cart?.item_count ?? 0}
              </span>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-slate-400 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          {items.length > 0 && (
            <div className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 my-2 shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                <span className="text-slate-600 dark:text-zinc-400">Free Express Delivery:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {parseFloat(cart?.total_amount ?? '0') >= 1000
                    ? '🎉 Free Shipping Unlocked!'
                    : `${currency} ${Math.max(0, 1000 - parseFloat(cart?.total_amount ?? '0')).toFixed(0)} away`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (parseFloat(cart?.total_amount ?? '0') / 1000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-2 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 mb-3 shadow-inner">
                  <ShoppingBag className="size-8" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-200">Your cart is empty</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 max-w-xs leading-relaxed">
                  Explore our verified product catalog and add your favorites to get started.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/50 p-3.5 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-200 truncate">
                      {item.product_name}
                    </h4>
                    <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {currency} {parseFloat(item.unit_price).toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, Math.max(0, parseInt(item.quantity) - 1))
                        }
                        className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Decrease"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-slate-900 dark:text-white font-mono">
                        {parseInt(item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, parseInt(item.quantity) + 1)}
                        className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Increase"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Action */}
          {items.length > 0 && (
            <div className="border-t border-slate-200 dark:border-zinc-800/80 pt-4 space-y-3">
              {/* Coupon Input */}
              <div className="flex items-center gap-2">
                {cart?.coupon_code ? (
                  <div className="flex flex-1 items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <span>Coupon Applied: <strong className="font-mono">{cart.coupon_code}</strong></span>
                    <button
                      type="button"
                      onClick={() => useStorefrontCartStore.getState().removeCoupon()}
                      className="text-slate-400 hover:text-rose-500 font-bold ml-2"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const input = (e.currentTarget.elements.namedItem('coupon') as HTMLInputElement);
                      if (input && input.value.trim()) {
                        await useStorefrontCartStore.getState().applyCoupon(input.value.trim());
                        input.value = '';
                      }
                    }}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <input
                      type="text"
                      name="coupon"
                      placeholder="Coupon code (e.g. SAVE20)"
                      className="flex-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 uppercase placeholder:normal-case placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
              </div>

              <div className="space-y-1.5 border-t border-slate-200 dark:border-zinc-800/50 pt-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-200">
                    {currency} {parseFloat(cart?.subtotal ?? '0').toFixed(2)}
                  </span>
                </div>
                {parseFloat(cart?.discount_amount ?? '0') > 0 && (
                  <div
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="flex items-center justify-between"
                  >
                    <span>Discount ({cart?.coupon_code})</span>
                    <span>- {currency} {parseFloat(cart?.discount_amount ?? '0').toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-zinc-100 pt-1 border-t border-slate-200 dark:border-zinc-800/60">
                  <span>Total</span>
                  <span
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="font-mono font-extrabold"
                  >
                    {currency} {parseFloat(cart?.total_amount ?? '0').toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCheckoutClick}
                  style={{
                    backgroundColor: 'var(--store-primary, #10b981)',
                    color: 'var(--store-primary-fg, #ffffff)',
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-lg transition-all cursor-pointer active:scale-98 hover:opacity-90"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const sessionToken = useStorefrontCartStore.getState().sessionToken;
                    try {
                      const res = await (await import('../../lib/api/client')).api.post<{
                        data: { whatsapp_url: string };
                      }>(
                        '/storefront/whatsapp/order-link',
                        {
                          cart_token: sessionToken,
                        },
                        {
                          headers: {
                            'X-Storefront-Subdomain': subdomain,
                          },
                        }
                      );
                      const whatsappPayload = res.data as unknown;
                      const whatsappUrl =
                        (whatsappPayload as { whatsapp_url?: string })?.whatsapp_url ??
                        (whatsappPayload as { data?: { whatsapp_url?: string } })?.data?.whatsapp_url;
                      if (whatsappUrl) {
                        window.open(whatsappUrl, '_blank');
                      }
                    } catch {
                      window.open('https://wa.me/8801700000000', '_blank');
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                    borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))',
                    color: 'var(--store-primary, #10b981)',
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer hover:opacity-90"
                >
                  <span>💬 Order Cart via WhatsApp</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
