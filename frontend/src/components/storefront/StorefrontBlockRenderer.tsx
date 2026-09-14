import React from 'react';
import type { PageBlock } from '../../modules/storefront/StorefrontPageBuilderWorkspace';
import type { StorefrontProduct } from '../../types/api/storefront';
import type { ProductCardStyle } from '../../lib/storefront/storefrontDesignSystem';
import { HeroSliderBlock } from './blocks/HeroSliderBlock';
import { ProductGridBlock } from './blocks/ProductGridBlock';
import { TrendingCategoriesBlock } from './blocks/TrendingCategoriesBlock';
import { ValuePropsBlock } from './blocks/ValuePropsBlock';
import { PromoSplitBlock } from './blocks/PromoSplitBlock';
import { FaqAccordionBlock } from './blocks/FaqAccordionBlock';
import { NewsletterVipBlock } from './blocks/NewsletterVipBlock';
import { QualityJourneyBlock } from './blocks/QualityJourneyBlock';
import DOMPurify from 'dompurify';

interface StorefrontBlockRendererProps {
  block: PageBlock;
  products: StorefrontProduct[];
  categories: { id: number; name: string }[];
  currency: string;
  subdomain: string;
  defaultCardStyle?: ProductCardStyle | undefined;
  whatsappNumber?: string | undefined;
  onAddToCart: (product: StorefrontProduct) => void;
  onOrderNow?: ((product: StorefrontProduct) => void) | undefined;
  onQuickView?: ((product: StorefrontProduct) => void) | undefined;
}

export const StorefrontBlockRenderer: React.FC<StorefrontBlockRendererProps> = ({
  block,
  products,
  categories,
  currency,
  subdomain,
  defaultCardStyle = 'commerce',
  whatsappNumber,
  onAddToCart,
  onOrderNow,
  onQuickView,
}) => {
  switch (block.type) {
    case 'hero_banner':
    case 'hero_slider' as string:
      return <HeroSliderBlock block={block} subdomain={subdomain} />;

    case 'featured_products':
      return (
        <ProductGridBlock
          block={block}
          products={products}
          categories={categories}
          currency={currency}
          subdomain={subdomain}
          defaultCardStyle={defaultCardStyle}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onOrderNow={onOrderNow}
          onQuickView={onQuickView}
        />
      );

    case 'trending_categories' as string:
      return (
        <TrendingCategoriesBlock
          block={block}
          categories={categories}
          subdomain={subdomain}
        />
      );

    case 'value_props':
      return <ValuePropsBlock block={block} />;

    case 'promo_split_banner':
      return <PromoSplitBlock block={block} subdomain={subdomain} />;

    case 'quality_journey':
      return <QualityJourneyBlock block={block} />;

    case 'faq':
      return <FaqAccordionBlock block={block} />;

    case 'newsletter_vip':
      return <NewsletterVipBlock block={block} />;

    case 'rich_text':
      return (
        <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-6 sm:p-10 shadow-xs max-w-4xl mx-auto space-y-4">
          {block.title && (
            <h2
              style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
              className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {block.title}
            </h2>
          )}
          {block.content && (
            <div className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-3 whitespace-pre-line">
              {block.content}
            </div>
          )}
        </section>
      );

    case 'custom_html_css': {
      const sanitizedHtml = DOMPurify.sanitize(block.html || '', {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel', 'class', 'style', 'id'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onmouseenter', 'onmouseleave'],
      });

      // Defensive sanitization of user-supplied custom CSS
      const sanitizedCss = (block.css || '')
        .replace(/@import[^;]*;/gi, '')
        .replace(/behavior:[^;]*;/gi, '')
        .replace(/expression\([^)]*\)/gi, '')
        .replace(/javascript:/gi, '');

      return (
        <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 bg-white dark:bg-zinc-900 overflow-hidden">
          {sanitizedCss && <style>{sanitizedCss}</style>}
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizedHtml,
            }}
          />
        </section>
      );
    }

    default:
      return null;
  }
};
