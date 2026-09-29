import React, { useState } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pin,
  Search,
  Package,
  Sparkles,
} from 'lucide-react';
import type { PageBlock } from '../../StorefrontPageBuilderWorkspace';
import type { StorefrontProduct } from '../../../../types/api/storefront';

interface FeaturedProductsEditorProps {
  block: PageBlock;
  categories: { id: number; name: string }[];
  products: StorefrontProduct[];
  onChange: (updatedBlock: PageBlock) => void;
}

export const FeaturedProductsEditor: React.FC<FeaturedProductsEditorProps> = ({
  block,
  categories,
  products,
  onChange,
}) => {
  const [productSearch, setProductSearch] = useState('');

  // Selected or custom ordered product IDs
  const customOrder: number[] = Array.isArray(block.product_order)
    ? (block.product_order as number[])
    : Array.isArray(block.featured_product_ids)
      ? (block.featured_product_ids as number[])
      : [];

  // Sort available products based on custom order, or category filter
  const filteredProducts = products.filter((p) => {
    if (block.category_id && p.category?.id !== block.category_id) {
      return false;
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Display items taking customOrder into account first
  const orderedProducts = [...filteredProducts].sort((a, b) => {
    const idxA = customOrder.indexOf(a.id);
    const idxB = customOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const displayLimit = block.limit || 8;
  const visibleProducts = orderedProducts.slice(0, displayLimit);

  const handleMoveProduct = (productId: number, direction: 'up' | 'down') => {
    // Current visible sequence of IDs
    const currentIds = visibleProducts.map((p) => p.id);
    const index = currentIds.indexOf(productId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;

    const nextIds = [...currentIds];
    const currentId = nextIds[index];
    const targetId = nextIds[targetIndex];
    if (currentId === undefined || targetId === undefined) return;
    nextIds[index] = targetId;
    nextIds[targetIndex] = currentId;

    onChange({
      ...block,
      product_order: nextIds,
      featured_product_ids: nextIds,
    });
  };

  const handlePinToTop = (productId: number) => {
    const currentIds = visibleProducts.map((p) => p.id).filter((id) => id !== productId);
    const nextIds = [productId, ...currentIds];
    onChange({
      ...block,
      product_order: nextIds,
      featured_product_ids: nextIds,
    });
  };

  const handleResetOrder = () => {
    const nextBlock = { ...block };
    delete nextBlock.product_order;
    delete nextBlock.featured_product_ids;
    onChange(nextBlock);
  };

  return (
    <div className="space-y-4">
      {/* Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
            Catalog Section Heading
          </label>
          <input
            type="text"
            value={block.title || ''}
            placeholder="e.g. Browse Available Products"
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none font-bold"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
            Catalog Subtitle
          </label>
          <input
            type="text"
            value={block.subtitle || ''}
            placeholder="e.g. Select items below to add directly to your cart."
            onChange={(e) => onChange({ ...block, subtitle: e.target.value })}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
            Category Filter
          </label>
          <select
            value={block.category_id || ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onChange({ ...block, category_id: val });
            }}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
            Display Limit (Cards)
          </label>
          <input
            type="number"
            min={2}
            max={48}
            value={block.limit || 8}
            onChange={(e) => onChange({ ...block, limit: parseInt(e.target.value) || 8 })}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-4 pt-5">
          <label className="flex items-center gap-1.5 text-xs text-default cursor-pointer">
            <input
              type="checkbox"
              checked={block.show_search !== false}
              onChange={(e) => onChange({ ...block, show_search: e.target.checked })}
              className="rounded border-default text-primary focus:ring-0 cursor-pointer"
            />
            <span>Search Bar</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-default cursor-pointer">
            <input
              type="checkbox"
              checked={block.show_categories !== false}
              onChange={(e) => onChange({ ...block, show_categories: e.target.checked })}
              className="rounded border-default text-primary focus:ring-0 cursor-pointer"
            />
            <span>Category Pills</span>
          </label>
        </div>
      </div>

      {/* Visual Product Display Order & Drag Handle Reorder Controls */}
      <div className="pt-2 border-t border-default space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-500" />
            <span className="text-xs font-bold text-default">
              Visual Display Order & Sequence
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {visibleProducts.length} Items Displayed
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter catalog..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-7 pr-2.5 py-1 text-xs rounded-lg border border-default bg-surface text-default focus:outline-none w-36 sm:w-48"
              />
            </div>
            {customOrder.length > 0 && (
              <button
                type="button"
                onClick={handleResetOrder}
                className="text-[10px] text-muted hover:text-default underline cursor-pointer"
                title="Reset to default sorting"
              >
                Reset Order
              </button>
            )}
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-default bg-surface-sunken text-center text-xs text-muted">
            <Package className="size-6 mx-auto mb-1 text-muted opacity-40" />
            <span>No published products match the selected category or filter.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {visibleProducts.map((p, pIdx) => {
              const thumb = p.image_url || p.images?.[0]?.url;
              const isFirst = pIdx === 0;
              const isLast = pIdx === visibleProducts.length - 1;

              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between p-3 rounded-xl border border-default bg-surface hover:border-primary/60 transition-all shadow-2xs group relative"
                >
                  <div className="space-y-2">
                    {/* Position Index & Controls */}
                    <div className="flex items-center justify-between border-b border-default pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex size-5 items-center justify-center rounded-md bg-surface-sunken border border-default text-[10px] font-mono font-bold text-muted">
                          {pIdx + 1}
                        </span>
                        <span title="Drag handle">
                          <GripVertical className="size-3.5 text-muted opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePinToTop(p.id)}
                          className="p-1 rounded text-muted hover:text-emerald-500 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                          title="Pin to Top (#1 position)"
                        >
                          <Pin className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveProduct(p.id, 'up')}
                          className="p-1 rounded text-muted hover:text-default disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move Earlier in Grid"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveProduct(p.id, 'down')}
                          className="p-1 rounded text-muted hover:text-default disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move Later in Grid"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Product Preview */}
                    <div className="flex items-center gap-2.5">
                      <div className="size-10 rounded-lg border border-default bg-surface-sunken overflow-hidden shrink-0 flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="size-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="size-4 text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-default truncate">{p.name}</div>
                        <div className="text-[10px] text-muted font-mono truncate">{p.sku}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-default/50 mt-2 text-[10px]">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {p.default_sale_price} BDT
                    </span>
                    {p.category && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-sunken text-muted truncate max-w-24">
                        {p.category.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
