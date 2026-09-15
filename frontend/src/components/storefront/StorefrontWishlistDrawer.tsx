import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2, X, ArrowRight, Zap } from 'lucide-react';
import { useStorefrontWishlistStore } from '../../lib/storefront/storefrontWishlistStore';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { notify } from '../ui/Toast';
import type { StorefrontConfig } from '../../types/api/storefront';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface StorefrontWishlistDrawerProps {
  config: StorefrontConfig | null;
  subdomain: string;
}

export const StorefrontWishlistDrawer: React.FC<StorefrontWishlistDrawerProps> = ({ config, subdomain }) => {
  const { items, isWishlistOpen, closeWishlist, removeItem, clearWishlist } = useStorefrontWishlistStore();
  const { addItem, openDrawer } = useStorefrontCartStore();
  const navigate = useNavigate();

  if (!isWishlistOpen) return null;

  const currency = config?.currency ?? 'BDT';

  const handleAddToCart = async (item: typeof items[0]) => {
    try {
      await addItem(item.id, 1);
      notify.success(`Added ${item.name} to cart`);
    } catch {
      notify.error('Failed to add item to cart');
    }
  };

  const handleOrderNow = async (item: typeof items[0]) => {
    try {
      await addItem(item.id, 1);
      closeWishlist();
      navigate(getStorefrontUrl(subdomain, '/checkout'));
    } catch {
      notify.error('Failed to proceed to checkout');
    }
  };

  const handleMoveAllToCart = async () => {
    try {
      for (const item of items) {
        await addItem(item.id, 1);
      }
      notify.success(`Added ${items.length} items to cart`);
      closeWishlist();
      openDrawer();
    } catch {
      notify.error('Failed to add all items to cart');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close wishlist drawer"
        className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-xs transition-opacity cursor-default border-none"
        onClick={closeWishlist}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeWishlist();
        }}
      />

      <div className="fixed inset-y-0 right-0 flex w-full max-w-full sm:max-w-md pl-4 sm:pl-10">
        <div className="w-full max-w-full border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-2xl flex flex-col justify-between text-slate-800 dark:text-zinc-100 transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <Heart className="size-5 fill-rose-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Saved Wishlist</h2>
              <span className="rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-xs font-bold font-mono">
                {items.length}
              </span>
            </div>
            <button
              type="button"
              onClick={closeWishlist}
              className="rounded-lg p-1.5 text-slate-400 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Wishlist Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-400 mb-3 shadow-inner">
                  <Heart className="size-8" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-200">Your wishlist is empty</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                  Save your favorite items by tapping the heart icon on any product to easily find and order them later.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    closeWishlist();
                    navigate(getStorefrontUrl(subdomain, '/products'));
                  }}
                  style={{
                    backgroundColor: 'var(--store-primary, #10b981)',
                    color: 'var(--store-primary-fg, #ffffff)',
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer hover:opacity-90 transition-all"
                >
                  <span>Explore Products</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/50 p-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image_url || '/assets/placeholder-product.svg'}
                      alt={item.name}
                      className="size-16 rounded-lg object-cover bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      {item.category_name && (
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                          {item.category_name}
                        </span>
                      )}
                      <Link
                        to={getStorefrontUrl(subdomain, `/products/${item.slug}`)}
                        onClick={closeWishlist}
                        className="text-xs font-bold text-slate-900 dark:text-zinc-100 hover:underline line-clamp-1 block"
                      >
                        {item.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {currency} {parseFloat(item.price).toLocaleString()}
                        </span>
                        {item.compare_at_price && parseFloat(item.compare_at_price) > parseFloat(item.price) && (
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            {currency} {parseFloat(item.compare_at_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                      title="Remove from Wishlist"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {/* Actions per wishlisted item */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700/80 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="size-3" />
                      <span>Add to Cart</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOrderNow(item)}
                      style={{
                        backgroundColor: 'var(--store-primary, #10b981)',
                        color: 'var(--store-primary-fg, #ffffff)',
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer"
                    >
                      <Zap className="size-3 fill-current" />
                      <span>Order Now</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer actions */}
          {items.length > 0 && (
            <div className="border-t border-slate-200 dark:border-zinc-800/80 pt-4 space-y-2.5">
              <button
                type="button"
                onClick={handleMoveAllToCart}
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-extrabold shadow-md transition-all cursor-pointer hover:opacity-95 active:scale-98"
              >
                <ShoppingBag className="size-4" />
                <span>Move All to Cart ({items.length} items)</span>
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={clearWishlist}
                  className="text-xs text-rose-500 hover:underline cursor-pointer py-1"
                >
                  Clear Wishlist
                </button>
                <button
                  type="button"
                  onClick={closeWishlist}
                  className="text-xs text-slate-500 dark:text-zinc-400 hover:underline cursor-pointer py-1"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
