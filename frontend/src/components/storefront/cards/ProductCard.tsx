import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Eye, Heart, Star, Check } from 'lucide-react';
import type { StorefrontProduct } from '../../../types/api/storefront';
import type { ProductCardStyle } from '../../../lib/storefront/storefrontDesignSystem';

export interface ProductCardProps {
  product: StorefrontProduct;
  cardStyle?: ProductCardStyle | undefined;
  currency: string;
  subdomain: string;
  onAddToCart: (product: StorefrontProduct) => void;
  onQuickView?: ((product: StorefrontProduct) => void) | undefined;
  showRating?: boolean | undefined;
  showBadge?: boolean | undefined;
  showQuickView?: boolean | undefined;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cardStyle = 'commerce',
  currency,
  subdomain,
  onAddToCart,
  onQuickView,
  showRating = true,
  showBadge = true,
  showQuickView = true,
}) => {
  const [addedAnim, setAddedAnim] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  const priceNum = parseFloat(product.default_sale_price) || 0;
  const compareNum = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const hasDiscount = compareNum !== null && compareNum > priceNum;
  const discountPercent = hasDiscount && compareNum ? Math.round(((compareNum - priceNum) / compareNum) * 100) : null;

  const productUrl = `/store/${subdomain}/products/${product.online_slug || product.sku || product.id}`;

  const primaryImage = product.image_url || product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url;
  const secondaryImage = product.images?.[1]?.url || primaryImage;
  const hasSecondary = Boolean(secondaryImage && secondaryImage !== primaryImage);

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(product);
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1200);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlisted(!wishlisted);
  };

  // 1. MINIMAL CARD (Clean, maximum whitespace, understated typography)
  if (cardStyle === 'minimal') {
    return (
      <div className="group relative flex flex-col transition-all duration-300">
        <Link to={productUrl} className="relative block aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <img
            src={primaryImage || '/assets/placeholder-product.svg'}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover object-center transition-all duration-500 group-hover:scale-105 ${hasSecondary ? 'group-hover:opacity-0' : ''}`}
          />
          {hasSecondary && (
            <img
              src={secondaryImage}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:scale-105"
            />
          )}

          {showBadge && discountPercent && (
            <span className="absolute top-2.5 left-2.5 bg-black text-white dark:bg-white dark:text-black text-[10px] font-mono px-2 py-0.5 tracking-wider uppercase">
              -{discountPercent}%
            </span>
          )}

          <div className="absolute inset-x-2 bottom-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleAddClick}
              className="flex-1 bg-white/95 dark:bg-zinc-900/95 text-black dark:text-white py-2 text-xs font-medium backdrop-blur-xs transition-colors hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black shadow-xs cursor-pointer"
            >
              {addedAnim ? 'Added' : 'Add to Bag'}
            </button>
            {showQuickView && (
              <button
                type="button"
                onClick={handleQuickViewClick}
                className="bg-white/95 dark:bg-zinc-900/95 p-2 text-black dark:text-white backdrop-blur-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                aria-label="Quick View"
              >
                <Eye className="size-4" />
              </button>
            )}
          </div>
        </Link>

        <div className="pt-3 space-y-1">
          <Link to={productUrl} className="block text-xs text-zinc-900 dark:text-zinc-100 font-medium hover:underline line-clamp-1">
            {product.name}
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
              {currency} {priceNum.toLocaleString()}
            </span>
            {hasDiscount && compareNum && (
              <span className="text-zinc-400 line-through text-[11px]">
                {currency} {compareNum.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. EDITORIAL CARD (High fashion / luxury, tall aspect ratio, serif elegance)
  if (cardStyle === 'editorial') {
    return (
      <div className="group relative flex flex-col bg-transparent transition-all duration-300">
        <Link to={productUrl} className="relative block aspect-3/4 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <img
            src={primaryImage || '/assets/placeholder-product.svg'}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-103 ${hasSecondary ? 'group-hover:opacity-0' : ''}`}
          />
          {hasSecondary && (
            <img
              src={secondaryImage}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-opacity duration-700 group-hover:opacity-100 group-hover:scale-103"
            />
          )}

          <button
            type="button"
            onClick={handleWishlistClick}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-zinc-800 dark:text-zinc-200 transition-colors hover:text-rose-600 cursor-pointer"
            aria-label="Wishlist"
          >
            <Heart className={`size-3.5 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          {showBadge && product.category && (
            <span className="absolute top-3 left-3 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 bg-white/90 dark:bg-black/90 text-zinc-900 dark:text-zinc-100 border border-black/10 dark:border-white/10">
              {product.category.name}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddClick}
              className="text-xs font-medium text-white tracking-wider uppercase hover:underline cursor-pointer flex items-center gap-1.5"
            >
              {addedAnim ? <Check className="size-3.5 text-emerald-400" /> : <ShoppingBag className="size-3.5" />}
              <span>{addedAnim ? 'Added' : 'Purchase'}</span>
            </button>

            {showQuickView && (
              <button
                type="button"
                onClick={handleQuickViewClick}
                className="text-white/80 hover:text-white p-1 transition-colors cursor-pointer"
                aria-label="Quick View"
              >
                <Eye className="size-4" />
              </button>
            )}
          </div>
        </Link>

        <div className="pt-3 space-y-1 text-center">
          <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
            {product.category?.name || 'Exclusive'}
          </div>
          <Link to={productUrl} className="block font-serif text-sm text-zinc-900 dark:text-zinc-100 italic hover:text-zinc-600 line-clamp-1">
            {product.name}
          </Link>
          <div className="flex items-center justify-center gap-2 text-xs font-mono">
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
              {currency} {priceNum.toLocaleString()}
            </span>
            {hasDiscount && compareNum && (
              <span className="text-zinc-400 line-through text-[11px]">
                {currency} {compareNum.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. B2B / INDUSTRIAL CARD (Structured spec callout, SKU visibility, bulk order button)
  if (cardStyle === 'b2b') {
    return (
      <div className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-3 shadow-xs hover:border-blue-500/50 transition-all duration-200">
        <Link to={productUrl} className="relative block aspect-4/3 overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-950/80">
          <img
            src={primaryImage || '/assets/placeholder-product.svg'}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 left-2 text-[9px] font-mono px-2 py-0.5 rounded-sm bg-blue-600 text-white font-bold tracking-wider uppercase">
            SKU: {product.sku}
          </span>
        </Link>

        <div className="pt-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>{product.category?.name || 'General Catalog'}</span>
              <span className="text-emerald-500 font-medium">In Stock</span>
            </div>
            <Link to={productUrl} className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 line-clamp-1 mt-0.5">
              {product.name}
            </Link>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-mono">Unit Price</div>
              <div className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {currency} {priceNum.toLocaleString()}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddClick}
              style={{
                backgroundColor: 'var(--store-primary, #2563eb)',
                color: 'var(--store-primary-fg, #ffffff)',
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer hover:opacity-90"
            >
              {addedAnim ? <Check className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
              <span>{addedAnim ? 'Added' : 'Order'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. COMMERCE CARD (Default balanced retail card: Rating stars, crisp tags, quick view overlay, tactile add to cart)
  return (
    <div className="group relative flex flex-col rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3 shadow-xs hover:shadow-lg transition-all duration-300">
      <Link to={productUrl} className="relative block aspect-square overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-950">
        <img
          src={primaryImage || '/assets/placeholder-product.svg'}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-104 ${hasSecondary ? 'group-hover:opacity-0' : ''}`}
        />
        {hasSecondary && (
          <img
            src={secondaryImage}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:scale-104"
          />
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {showBadge && discountPercent && (
            <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide shadow-xs">
              -{discountPercent}%
            </span>
          )}
          {product.is_featured && (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] font-bold font-mono tracking-wide shadow-xs uppercase">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-600 dark:text-zinc-300 hover:text-rose-600 transition-colors shadow-xs z-10 cursor-pointer"
          aria-label="Save to wishlist"
        >
          <Heart className={`size-3.5 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Quick View Button */}
        {showQuickView && (
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md backdrop-blur-md opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <Eye className="size-3.5" />
            <span>Quick View</span>
          </button>
        )}
      </Link>

      {/* Info Section */}
      <div className="pt-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          {product.category && (
            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {product.category.name}
            </p>
          )}
          <Link
            to={productUrl}
            className="block text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:underline line-clamp-1"
          >
            {product.name}
          </Link>

          {showRating && (
            <div className="flex items-center gap-1 text-amber-500 text-xs">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-[11px] text-zinc-700 dark:text-zinc-300">4.9</span>
              <span className="text-[10px] text-zinc-400">(24)</span>
            </div>
          )}
        </div>

        {/* Price & Add to Cart */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                {currency} {priceNum.toLocaleString()}
              </span>
              {hasDiscount && compareNum && (
                <span className="text-xs text-zinc-400 line-through">
                  {currency} {compareNum.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddClick}
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-transform active:scale-95 cursor-pointer hover:opacity-95"
            aria-label={`Add ${product.name} to cart`}
          >
            {addedAnim ? <Check className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
            <span className="hidden sm:inline">{addedAnim ? 'Added' : 'Add'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
