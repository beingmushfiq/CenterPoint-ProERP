import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

interface PromoSplitBlockProps {
  block: PageBlock;
  subdomain: string;
}

export const PromoSplitBlock: React.FC<PromoSplitBlockProps> = ({ block, subdomain }) => {
  const title = block.title || 'Precision Quality & Direct Value';
  const subtitle =
    block.subtitle ||
    'Built for discerning customers who value authentic craftsmanship, verified materials, and reliable service.';
  const ctaText = block.cta_text || 'Explore Full Catalog';
  const ctaUrl = block.cta_url || `/store/${subdomain}/products`;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-8 sm:p-14 text-white shadow-xl">
      <div className="relative z-10 max-w-2xl space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="size-3.5 text-amber-400" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-200">
            Featured Collection
          </span>
        </div>

        <h2
          style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
          className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight"
        >
          {title}
        </h2>

        <p className="text-sm text-zinc-300 leading-relaxed max-w-xl">
          {subtitle}
        </p>

        <div className="pt-2">
          <a
            href={ctaUrl}
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer hover:opacity-90"
          >
            <span>{ctaText}</span>
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      <div className="absolute -right-12 -bottom-12 size-96 rounded-full bg-radial from-white/10 to-transparent blur-2xl pointer-events-none" />
    </section>
  );
};
