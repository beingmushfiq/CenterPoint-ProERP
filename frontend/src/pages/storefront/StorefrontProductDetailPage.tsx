import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Package, Plus, ShoppingBag, ShieldCheck, ChevronLeft, ChevronRight, Share2, Check, Heart, Zap } from 'lucide-react';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { useStorefrontWishlistStore } from '../../lib/storefront/storefrontWishlistStore';
import { notify } from '../../components/ui/Toast';
import { SeoHead } from '../../components/seo/SeoHead';
import { BreadcrumbNav } from '../../components/seo/BreadcrumbNav';
import type { StorefrontConfig, StorefrontProduct, StorefrontProductVariant } from '../../types/api/storefront';
import { useCurrency } from '../../hooks/useCurrency';
import { StorefrontRichDescription } from '../../components/storefront/StorefrontRichDescription';
import { stripHtml } from '../../lib/storefront/htmlUtils';
import { trackStorefrontAddToCart, trackStorefrontViewContent } from '../../lib/storefront/storefrontTracking';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

export const StorefrontProductDetailPage: React.FC = () => {
  const { idOrSku } = useParams<{ idOrSku: string }>();
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { formatCurrency } = useCurrency();
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<StorefrontProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const navigate = useNavigate();
  const { addItem, openDrawer } = useStorefrontCartStore();
  const { isInWishlist, toggleWishlist } = useStorefrontWishlistStore();
  const isWishlisted = product ? isInWishlist(product.id) : false;

  const handleWishlistToggle = () => {
    if (!product) return;
    const added = toggleWishlist(product);
    if (added) {
      notify.success(`Saved "${product.name}" to Wishlist`);
    } else {
      notify.info('Removed from Wishlist');
    }
  };

  const handleOrderNow = async () => {
    if (!product) return;
    try {
      await addItem(product.id, quantity, selectedVariant?.id);
      navigate(`/store/${subdomain}/checkout`);
    } catch {
      notify.error('Failed to proceed to checkout');
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!idOrSku) return;
      setLoading(true);
      try {
        const response = await api.get<{ data: StorefrontProduct }>(
          `/storefront/products/${idOrSku}`,
          {
            headers: { 'X-Storefront-Subdomain': subdomain },
          }
        );
        const rawProd = response.data as unknown;
        const prod =
          (rawProd as StorefrontProduct)?.sku !== undefined || (rawProd as StorefrontProduct)?.id !== undefined
            ? (rawProd as StorefrontProduct)
            : (((rawProd as Record<string, unknown>)?.data as StorefrontProduct) ?? null);
        setProduct(prod ?? null);
        if (prod?.variants && prod.variants.length > 0) {
          setSelectedVariant(prod.variants[0] ?? null);
        }

        // Track ViewContent for Digital Marketing Analytics (Meta Pixel + GA4)
        if (prod) {
          const itemPrice = prod.variants?.[0]?.price
            ? parseFloat(prod.variants[0].price)
            : parseFloat(prod.default_sale_price || '0');
          trackStorefrontViewContent({
            id: prod.id,
            name: prod.name,
            price: itemPrice,
            currency: config.currency ?? 'BDT',
            category: prod.category?.name,
          });
        }
      } catch (err) {
        console.error('Failed to load product', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [idOrSku, subdomain, config.currency]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
        <h2 className="text-base font-bold text-zinc-200">Product Not Found</h2>
        <p className="text-xs text-zinc-500 mt-1">The requested product could not be located.</p>
        <Link
          to={`/store/${subdomain}/products`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  const currency = config.currency ?? 'BDT';
  const price = selectedVariant
    ? parseFloat(selectedVariant.price).toFixed(2)
    : parseFloat(product.default_sale_price || '0').toFixed(2);

  const breadcrumbs = product.breadcrumb_items || [
    { name: 'Home', url: `/store/${subdomain}` },
    { name: 'All Products', url: `/store/${subdomain}/products` },
    ...(product.category ? [{ name: product.category.name, url: `/store/${subdomain}/collections/${product.category.slug || product.category.name.toLowerCase()}` }] : []),
    { name: product.name, url: `/store/${subdomain}/products/${product.online_slug || product.sku}` },
  ];

  // Resolve all images (images array with fallback to product.image_url)
  const productImages = (product.images && product.images.length > 0)
    ? product.images
    : (product.image_url ? [{ id: 'main', url: product.image_url, path: product.image_url, is_primary: true }] : []);

  const activeImage = productImages[activeImageIndex]?.url || productImages[0]?.url || product.image_url;
  const productSchema = product.schema?.product;

  const handleAddToCart = async () => {
    await addItem(product.id, quantity, selectedVariant?.id);
    trackStorefrontAddToCart({
      id: product.id,
      name: product.name,
      price: parseFloat(price),
      quantity,
      currency,
    });
    openDrawer();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined') {
      const text = encodeURIComponent(`Check out ${product.name} at ${config.name}: ${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };


  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 md:pb-6">
      <SeoHead
        title={product.seo?.title || product.name}
        description={product.seo?.description || stripHtml(product.description) || ''}
        canonical={product.seo?.canonical || undefined}
        ogType="product"
        ogImage={activeImage || config.theme?.hero_image || undefined}
        brandName={config.name}
        schema={productSchema}
      />

      {/* Semantic Breadcrumb Navigation */}
      <BreadcrumbNav items={breadcrumbs} className="py-2" />

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 items-start">
        {/* Left: Product Visual Multi-Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square rounded-3xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-xs group">
            {activeImage ? (
              <img
                src={activeImage}
                alt={`${product.name} photo ${activeImageIndex + 1}`}
                className="w-full h-full object-contain transition-all duration-300 group-hover:scale-105"
                loading="eager"
              />
            ) : (
              <>
                <Package className="h-28 w-28 text-slate-300 dark:text-emerald-500/40 mb-4" />
                <div className="text-center">
                  <span className="font-mono text-xs text-slate-500 dark:text-zinc-500">{product.sku}</span>
                  <div className="text-sm font-bold text-slate-800 dark:text-zinc-300 mt-1">{product.name}</div>
                </div>
              </>
            )}

            {/* In Stock Badge */}
            <div
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                borderColor: 'var(--store-primary-border, rgba(16,185,129,0.2))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="absolute top-4 right-4 rounded-full px-3 py-1 text-[11px] font-semibold border backdrop-blur-xs"
            >
              In Stock
            </div>

            {/* Gallery Navigation Arrows (if multiple photos) */}
            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : productImages.length - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 shadow-md backdrop-blur-xs transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                  aria-label="Previous product image"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev < productImages.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 shadow-md backdrop-blur-xs transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                  aria-label="Next product image"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Gallery Row */}
          {productImages.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {productImages.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  style={
                    activeImageIndex === idx
                      ? {
                          borderColor: 'var(--store-primary, #10b981)',
                          boxShadow: '0 0 0 2px var(--store-primary-subtle, rgba(16,185,129,0.3))',
                        }
                      : undefined
                  }
                  className={`relative size-16 shrink-0 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                    activeImageIndex === idx
                      ? 'shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url || (img as { path?: string }).path}
                    alt={`${product.name} thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {img.is_primary && (
                    <span
                      style={{
                        backgroundColor: 'var(--store-primary, #10b981)',
                        color: 'var(--store-primary-fg, #ffffff)',
                      }}
                      className="absolute bottom-0 inset-x-0 text-[8px] font-bold text-center py-0.5 uppercase"
                    >
                      Main
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Value Highlights Under Gallery */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer hover:opacity-90"
            >
              <Share2 className="size-3.5" />
              <span>Share on WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="size-3.5"
                  />
                  <span
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="font-semibold"
                  >
                    Copied
                  </span>
                </>
              ) : (
                <span>Copy Link</span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Details & Buying Flow */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-500">
              {product.category && (
                <span
                  style={{
                    backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                    borderColor: 'var(--store-primary-border, rgba(16,185,129,0.2))',
                    color: 'var(--store-primary, #10b981)',
                  }}
                  className="rounded-md border px-2 py-0.5 font-mono"
                >
                  {product.category.name}
                </span>
              )}
              {product.brand && <span className="text-slate-500 dark:text-zinc-400">· {product.brand.name}</span>}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {product.name}
              </h1>
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`p-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 shadow-2xs ${
                  isWishlisted
                    ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-rose-500'
                }`}
                title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                aria-label="Wishlist"
              >
                <Heart className={`size-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span
                style={{ color: 'var(--store-primary, #10b981)' }}
                className="text-3xl font-extrabold font-mono"
              >
                {currency} {price}
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">/ unit inclusive of taxes</span>
            </div>
          </div>

          <StorefrontRichDescription
            html={product.description}
            fallbackText="Manufactured under strict batch control and verified quality assurance directly in our central manufacturing facility."
            className="pt-1"
          />

          {/* Variants Selector */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800/80">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block font-mono">
                Select Option / Package Size
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: StorefrontProductVariant) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    style={
                      selectedVariant?.id === v.id
                        ? {
                            backgroundColor: 'var(--store-primary, #10b981)',
                            color: 'var(--store-primary-fg, #ffffff)',
                            borderColor: 'var(--store-primary, #10b981)',
                          }
                        : undefined
                    }
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      selectedVariant?.id === v.id
                        ? 'font-bold shadow-md'
                        : 'border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Authenticity & Quality Guarantee Callout */}
          <div
            style={{
              backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.06))',
              borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
            }}
            className="rounded-2xl border p-4 space-y-2"
          >
            <div
              style={{ color: 'var(--store-primary, #10b981)' }}
              className="flex items-center gap-2 text-xs font-bold"
            >
              <span
                style={{ backgroundColor: 'var(--store-primary, #10b981)' }}
                className="flex size-2 rounded-full animate-pulse"
              />
              <span>Authenticity & Quality Guarantee</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Every item is verified authentic, inspected to strict commercial standards, and packaged securely with full customer support and warranty protection.
            </p>
          </div>

          {/* Quantity and Add to Cart */}
          <div className="space-y-3.5 pt-4 border-t border-slate-200 dark:border-zinc-800/80">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-4">
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-1 shadow-xs min-h-12">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="rounded-lg p-2.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer touch-target"
                  title="Decrease Quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900 dark:text-white font-mono">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="rounded-lg p-2.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer touch-target"
                  title="Increase Quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {/* Order Now (Direct Checkout) */}
              <button
                type="button"
                onClick={handleOrderNow}
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="flex-1 min-h-12 flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-xs sm:text-sm font-extrabold shadow-lg transition-all cursor-pointer active:scale-98 hover:opacity-90 touch-target"
              >
                <Zap className="size-4 fill-current" />
                <span>Order Now ({currency} {(parseFloat(price) * quantity).toFixed(2)})</span>
              </button>

              {/* Add to Cart */}
              <button
                type="button"
                onClick={handleAddToCart}
                className="min-h-12 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-xs sm:text-sm font-bold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs transition-all cursor-pointer active:scale-98 hover:bg-slate-50 dark:hover:bg-zinc-800 touch-target"
                title="Add to Shopping Cart"
              >
                <ShoppingBag className="size-4 stroke-[2.5]" />
                <span className="hidden xs:inline sm:inline">Add to Cart</span>
              </button>
            </div>

            {/* Direct WhatsApp Ordering */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.post<{ data: { whatsapp_url: string } }>(
                    '/storefront/whatsapp/order-link',
                    {
                      product_id: product.id,
                      quantity,
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
                  // Fallback
                  const text = encodeURIComponent(
                    `Hello ${config?.name ?? 'Storefront'}, I would like to order ${quantity}x ${product.name} (${formatCurrency(
                      parseFloat(price) * quantity
                    )}).`
                  );
                  window.open(`https://wa.me/${config?.whatsapp_number?.replace(/[^0-9]/g, '') || '8801700000000'}?text=${text}`, '_blank');
                }
              }}
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition-all shadow-xs cursor-pointer hover:opacity-90"
            >
              <span>💬 Instant Order via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Add-to-Cart & WhatsApp Action Bar for High Ad Conversions */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 p-3 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {activeImage && (
            <img src={activeImage} alt={product.name} className="size-10 rounded-lg object-contain bg-slate-100 dark:bg-zinc-900 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{product.name}</div>
            <div
              style={{ color: 'var(--store-primary, #10b981)' }}
              className="text-xs font-extrabold font-mono"
            >
              {currency} {price}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddToCart}
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-md active:scale-95 cursor-pointer hover:opacity-90"
          >
            <ShoppingBag className="size-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const text = encodeURIComponent(`Hello ${config?.name ?? 'Storefront'}, I would like to order ${product.name}.`);
              window.open(`https://wa.me/${config?.whatsapp_number?.replace(/[^0-9]/g, '') || '8801700000000'}?text=${text}`, '_blank');
            }}
            className="flex items-center justify-center size-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-pointer"
            title="Order via WhatsApp"
          >
            💬
          </button>
        </div>
      </div>


      {/* AEO & GEO Structured Product Technical Specifications */}
      <section aria-labelledby="product-specifications-heading" className="pt-8 border-t border-slate-200 dark:border-zinc-800/80 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          <h2 id="product-specifications-heading" className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Technical Specifications & Certified Quality Data
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-300 uppercase tracking-wider">Manufacturing Details</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800/60">
                <dt className="text-slate-500 dark:text-zinc-500">Universal SKU</dt>
                <dd className="font-mono font-bold text-slate-800 dark:text-zinc-200">{product.sku}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800/60">
                <dt className="text-slate-500 dark:text-zinc-500">Brand Entity</dt>
                <dd className="font-medium text-slate-800 dark:text-zinc-200">{product.brand?.name || config.name}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800/60">
                <dt className="text-slate-500 dark:text-zinc-500">Category</dt>
                <dd className="font-medium text-slate-800 dark:text-zinc-200">{product.category?.name || 'General Wholesale'}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-slate-500 dark:text-zinc-500">Standard Unit</dt>
                <dd className="font-medium text-slate-800 dark:text-zinc-200">{product.base_unit?.name || 'Piece'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-300 uppercase tracking-wider">Assurance & Logistics</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800/60">
                <dt className="text-muted">Fulfillment Origin</dt>
                <dd className="font-medium text-emerald-600 dark:text-emerald-400">Verified Direct Sourcing</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-default">
                <dt className="text-muted">Quality Assurance</dt>
                <dd className="font-medium text-default">Multi-Point QA Inspection Passed</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-default">
                <dt className="text-muted">Packaging Standard</dt>
                <dd className="font-medium text-default">Reinforced Protective Dispatch</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted">Dispatch Standard</dt>
                <dd className="font-medium text-default">Direct Express Fulfillment</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
};
