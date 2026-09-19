import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Grid3X3,
  LayoutList,
  Package,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { SeoHead } from '../../components/seo/SeoHead';
import { BreadcrumbNav } from '../../components/seo/BreadcrumbNav';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { ProductCard } from '../../components/storefront/cards/ProductCard';
import type { StorefrontConfig, StorefrontProduct } from '../../types/api/storefront';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

interface CategoryItem {
  id: number;
  name: string;
  code?: string;
}

export const StorefrontCatalogPage: React.FC = () => {
  const { t } = useTranslation(['storefront', 'common']);
  const navigate = useNavigate();
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort State
  const initialCategory = searchParams.get('category')
    ? Number(searchParams.get('category'))
    : null;
  const [selectedCategory, setSelectedCategory] = useState<number | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>(
    (searchParams.get('sort') as 'featured' | 'price-asc' | 'price-desc' | 'name') || 'featured'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { addItem, openDrawer } = useStorefrontCartStore();

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          api.get<{ data: StorefrontProduct[] }>('/storefront/products', {
            headers: { 'X-Storefront-Subdomain': subdomain },
            params: {
              ...(selectedCategory ? { category_id: String(selectedCategory) } : {}),
              ...(searchQuery.trim().length >= 2 ? { q: searchQuery.trim() } : {}),
            },
          }),
          api.get<{ data: CategoryItem[] }>('/storefront/categories', {
            headers: { 'X-Storefront-Subdomain': subdomain },
          }),
        ]);

        if (prodRes.status === 'fulfilled') {
          const rawProds = prodRes.value.data as unknown;
          const prodList = Array.isArray(rawProds)
            ? (rawProds as StorefrontProduct[])
            : (((rawProds as Record<string, unknown>)?.data as StorefrontProduct[]) ?? []);
          setProducts(prodList);
        }
        if (catRes.status === 'fulfilled') {
          const rawCats = catRes.value.data as unknown;
          const cats = Array.isArray(rawCats)
            ? (rawCats as CategoryItem[])
            : (((rawCats as Record<string, unknown>)?.data as CategoryItem[]) ?? []);
          setCategories(cats);
          if (categorySlug && !selectedCategory) {
            const matched = cats.find(
              (c) =>
                c.code?.toLowerCase() === categorySlug.toLowerCase() ||
                c.name.toLowerCase().replace(/\s+/g, '-') === categorySlug.toLowerCase()
            );
            if (matched) setSelectedCategory(matched.id);
          }
        }
      } catch (err) {
        console.error('Failed to load catalog products', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [subdomain, selectedCategory, searchQuery, categorySlug]);

  // Sort products in-memory
  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price-asc') {
      return list.sort(
        (a, b) => parseFloat(a.default_sale_price || '0') - parseFloat(b.default_sale_price || '0')
      );
    }
    if (sortBy === 'price-desc') {
      return list.sort(
        (a, b) => parseFloat(b.default_sale_price || '0') - parseFloat(a.default_sale_price || '0')
      );
    }
    if (sortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [products, sortBy]);

  const handleCategorySelect = (catId: number | null) => {
    setSelectedCategory(catId);
    if (catId) {
      searchParams.set('category', String(catId));
    } else {
      searchParams.delete('category');
    }
    setSearchParams(searchParams);
  };

  const currency = config?.currency ?? 'BDT';

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);
  const pageTitle = activeCategoryObj
    ? `Buy ${activeCategoryObj.name} Online`
    : searchQuery
    ? `Search: "${searchQuery}"`
    : t('storefront.allProducts');

  const breadcrumbs = [
    { name: t('storefront.home'), url: getStorefrontUrl(subdomain) },
    { name: t('storefront.products'), url: getStorefrontUrl(subdomain, '/products') },
    ...(activeCategoryObj ? [{ name: activeCategoryObj.name, url: getStorefrontUrl(subdomain, `/collections/${activeCategoryObj.code || activeCategoryObj.name.toLowerCase()}`) }] : []),
  ];

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageTitle,
    itemListElement: sortedProducts.slice(0, 30).map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: p.name,
      url: `${window.location.origin}${getStorefrontUrl(subdomain, `/products/${(p as StorefrontProduct & { online_slug?: string }).online_slug || p.sku}`)}`,
    })),
  };

  return (
    <div className="space-y-8 py-2">
      <SeoHead
        title={pageTitle}
        description={`Explore our verified catalog for ${activeCategoryObj ? activeCategoryObj.name : 'premium retail and commercial collections'}. Direct fulfillment and official customer warranty.`}
        brandName={config?.name || 'Official Store'}
        schema={itemListSchema}
      />

      <BreadcrumbNav items={breadcrumbs} className="py-1" />

      {/* Top Editorial Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-default bg-surface p-6 sm:p-10 shadow-xs">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>{t('storefront.officialBadge')}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-default">
            {activeCategoryObj ? activeCategoryObj.name : searchQuery ? `Search: "${searchQuery}"` : t('storefront.allProducts')}
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            {activeCategoryObj
              ? `Browse authentic items in ${activeCategoryObj.name}, sourced and inspected directly to strict commercial specifications.`
              : t('storefront.allProductsSubtitle')}
          </p>
        </div>
      </div>

      {/* Category Pills & Filter Bar */}
      <div className="space-y-4">
        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => handleCategorySelect(null)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === null
                ? 'bg-primary text-primary-fg shadow-md shadow-primary/20 font-bold'
                : 'bg-surface border border-default text-muted hover:border-default/80 hover:text-default shadow-xs'
            }`}
          >
            <Tag className="size-3.5" />
            <span>{t('storefront.allCategories')} ({products.length})</span>
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-fg shadow-md shadow-primary/20 font-bold'
                    : 'bg-surface border border-default text-muted hover:border-default/80 hover:text-default shadow-xs'
                }`}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search input + View mode toggle + Sort dropdown */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-default bg-surface shadow-xs">
          {/* Left: Search input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted" />
            <input
              type="text"
              placeholder={t('storefront.searchCatalogPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim()) searchParams.set('q', val.trim());
                else searchParams.delete('q');
                setSearchParams(searchParams);
              }}
              className="w-full rounded-xl bg-surface-sunken border border-default pl-9 pr-8 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchParams.delete('q');
                  setSearchParams(searchParams);
                }}
                className="absolute right-2.5 top-2.5 text-muted hover:text-default cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Right: Sort & View Toggle */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted hidden md:inline font-medium">{t('storefront.sortByLabel')}</span>
              <SelectDropdown
                options={[
                  { value: 'featured', label: t('storefront.sortFeatured') },
                  { value: 'price-asc', label: t('storefront.sortPriceAsc') },
                  { value: 'price-desc', label: t('storefront.sortPriceDesc') },
                  { value: 'name', label: t('storefront.sortName') },
                ]}
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val as 'featured' | 'price-asc' | 'price-desc' | 'name');
                  searchParams.set('sort', val);
                  setSearchParams(searchParams);
                }}
                size="sm"
                aria-label="Sort catalog products"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl bg-surface-sunken border border-default p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface text-primary shadow-xs border border-default'
                    : 'text-muted hover:text-default'
                }`}
                title={t('storefront.gridView')}
              >
                <Grid3X3 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-surface text-primary shadow-xs border border-default'
                    : 'text-muted hover:text-default'
                }`}
                title={t('storefront.listView')}
              >
                <LayoutList className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Display */}
      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="rounded-3xl border border-default bg-surface p-12 text-center space-y-4 shadow-xs">
          <Package className="mx-auto size-12 text-muted" />
          <h3 className="text-base font-bold text-default">{t('storefront.noProducts')}</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {t('storefront.noProductsDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setSearchQuery('');
              setSearchParams({});
            }}
            className="rounded-xl bg-surface-sunken px-4 py-2 text-xs font-semibold text-default hover:bg-surface border border-default cursor-pointer"
          >
            {t('storefront.clearFilters')}
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              cardStyle={config?.theme?.card_style || 'commerce'}
              currency={currency}
              subdomain={subdomain}
              whatsappNumber={config?.whatsapp_number || undefined}
              onAddToCart={(p) => {
                void addItem(p.id, 1);
                openDrawer();
              }}
              onOrderNow={async (p) => {
                await addItem(p.id, 1);
                navigate(getStorefrontUrl(subdomain, '/checkout'));
              }}
            />
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-4">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              cardStyle="horizontal"
              currency={currency}
              subdomain={subdomain}
              whatsappNumber={config?.whatsapp_number || undefined}
              onAddToCart={(p) => {
                void addItem(p.id, 1);
                openDrawer();
              }}
              onOrderNow={async (p) => {
                await addItem(p.id, 1);
                navigate(getStorefrontUrl(subdomain, '/checkout'));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
