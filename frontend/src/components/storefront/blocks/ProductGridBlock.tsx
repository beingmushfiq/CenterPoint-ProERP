import React, { useState } from 'react';
import { Search, Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';
import type { StorefrontProduct } from '../../../types/api/storefront';
import type { ProductCardStyle } from '../../../lib/storefront/storefrontDesignSystem';
import { ProductCard } from '../cards/ProductCard';

interface ProductGridBlockProps {
  block: PageBlock;
  products: StorefrontProduct[];
  categories: { id: number; name: string }[];
  currency: string;
  subdomain: string;
  defaultCardStyle?: ProductCardStyle | undefined;
  onAddToCart: (product: StorefrontProduct) => void;
  onQuickView?: ((product: StorefrontProduct) => void) | undefined;
}

export const ProductGridBlock: React.FC<ProductGridBlockProps> = ({
  block,
  products,
  categories,
  currency,
  subdomain,
  defaultCardStyle = 'commerce',
  onAddToCart,
  onQuickView,
}) => {
  const settings = (block.settings as Record<string, unknown>) || {};
  const [activeCategory, setActiveCategory] = useState<number | null>(block.category_id || null);
  const [searchTerm, setSearchTerm] = useState('');

  const cardStyle = (settings['card_style'] as ProductCardStyle) || defaultCardStyle;
  const showSearch = block.show_search !== false;
  const showCategories = block.show_categories !== false;
  const limit = block.limit || 12;

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (activeCategory && p.category?.id !== activeCategory) {
      return false;
    }
    if (searchTerm.trim().length >= 2) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchCat = p.category?.name.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchCat) return false;
    }
    return true;
  });

  const displayedProducts = filteredProducts.slice(0, limit);

  return (
    <section id="catalog" className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {block.title && (
            <h2
              style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
              className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {block.title}
            </h2>
          )}
          {block.subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
              {block.subtitle}
            </p>
          )}
        </div>

        <Link
          to={`/store/${subdomain}/products`}
          className="inline-flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>View All Products</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Filter Ribbon & Category Pills */}
      {(showCategories || showSearch) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2 border-y border-zinc-100 dark:border-zinc-800/80">
          {/* Category Chips */}
          {showCategories && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                style={
                  activeCategory === null
                    ? {
                        backgroundColor: 'var(--store-primary, #10b981)',
                        color: 'var(--store-primary-fg, #ffffff)',
                      }
                    : undefined
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === null
                    ? 'shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                All Items
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  style={
                    activeCategory === cat.id
                      ? {
                          backgroundColor: 'var(--store-primary, #10b981)',
                          color: 'var(--store-primary-fg, #ffffff)',
                        }
                      : undefined
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Quick Search */}
          {showSearch && (
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search collection..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all shadow-2xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Grid Canvas */}
      {displayedProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              cardStyle={cardStyle}
              currency={currency}
              subdomain={subdomain}
              onAddToCart={onAddToCart}
              onQuickView={onQuickView}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
          <Tag className="size-8 text-zinc-400 mb-2" />
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No matching products found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Try adjusting your search query or selecting a different category filter above.
          </p>
          {(searchTerm || activeCategory !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActiveCategory(null);
              }}
              className="mt-3 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </section>
  );
};
