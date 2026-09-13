import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

interface TrendingCategoriesBlockProps {
  block: PageBlock;
  categories: { id: number; name: string }[];
  subdomain: string;
}

export const TrendingCategoriesBlock: React.FC<TrendingCategoriesBlockProps> = ({
  block,
  categories,
  subdomain,
}) => {
  const title = block.title || 'Trending Categories';
  const subtitle = block.subtitle || 'Explore our most popular departments and specialized product lines';

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2
            style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
            className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>

        <Link
          to={`/store/${subdomain}/products`}
          className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          <span>All Departments</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {categories.slice(0, 12).map((cat) => (
          <Link
            key={cat.id}
            to={`/store/${subdomain}/products?category_id=${cat.id}`}
            className="group relative flex flex-col items-center justify-center p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all duration-300 text-center"
          >
            <div
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.1))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="flex size-12 items-center justify-center rounded-2xl mb-3 group-hover:scale-110 transition-transform duration-300 shadow-2xs"
            >
              <Layers className="size-5" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-1">
              {cat.name}
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Explore Line</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
