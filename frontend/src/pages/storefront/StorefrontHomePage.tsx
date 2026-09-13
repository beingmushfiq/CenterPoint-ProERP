import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { notify } from '../../components/ui/Toast';
import type { StorefrontConfig, StorefrontProduct } from '../../types/api/storefront';
import type { PageBlock } from '../../modules/storefront/StorefrontPageBuilderWorkspace';
import { StorefrontBlockRenderer } from '../../components/storefront/StorefrontBlockRenderer';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

interface CmsPageResponse {
  data?: {
    slug?: string;
    title?: string;
    blocks?: PageBlock[];
  };
}

export const StorefrontHomePage: React.FC = () => {
  const { config, subdomain } = useOutletContext<OutletContextType>();
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [cmsBlocks, setCmsBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const { addItem } = useStorefrontCartStore();

  useEffect(() => {
    const fetchCatalogAndCms = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes, cmsRes] = await Promise.allSettled([
          api.get<{ data: StorefrontProduct[] }>('/storefront/products', {
            headers: { 'X-Storefront-Subdomain': subdomain },
          }),
          api.get<{ data: { id: number; name: string }[] }>('/storefront/categories', {
            headers: { 'X-Storefront-Subdomain': subdomain },
          }),
          api.get<CmsPageResponse>('/storefront/pages/home', {
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
          const catList = Array.isArray(rawCats)
            ? (rawCats as { id: number; name: string }[])
            : (((rawCats as Record<string, unknown>)?.data as { id: number; name: string }[]) ?? []);
          setCategories(catList);
        }
        if (cmsRes.status === 'fulfilled') {
          const rawCms = cmsRes.value.data as unknown;
          const blocks =
            (rawCms as { blocks?: PageBlock[] })?.blocks ??
            (rawCms as { data?: { blocks?: PageBlock[] } })?.data?.blocks ??
            [];
          if (blocks.length > 0) {
            setCmsBlocks(blocks);
          }
        }
      } catch (err) {
        console.error('Failed to load storefront catalog', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogAndCms();
  }, [subdomain]);

  const currency = config?.currency ?? 'BDT';
  const heroTitle = config?.theme?.hero_title || 'Designed for Excellence, Crafted for Longevity';
  const heroSubtitle =
    config?.theme?.hero_subtitle ||
    'Explore curated collections built to the highest commercial standards with direct-to-consumer value.';

  // Default fallback blocks if no custom CMS blocks are published for 'home'
  const effectiveBlocks: PageBlock[] =
    cmsBlocks.length > 0
      ? cmsBlocks
      : [
          {
            id: 'b_hero',
            type: 'hero_banner',
            autoplay: true,
            duration: 6000,
            slides: [
              {
                id: 'slide_1',
                badge: 'Official Store • Direct Fulfillment',
                title: heroTitle,
                subtitle: heroSubtitle,
                cta_text: 'Explore Catalog',
                cta_url: '#catalog',
                secondary_cta_text: 'About Us',
                secondary_cta_url: `/store/${subdomain}/pages/about-us`,
                desktop_image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
                text_align: 'left',
                overlay_opacity: 60,
              },
              {
                id: 'slide_2',
                badge: 'New Season • Premium Releases',
                title: 'Engineered for Performance & Elevated Living',
                subtitle: 'Discover our latest release of meticulously finished products, created with verified materials and benchmark durability.',
                cta_text: 'Discover New Releases',
                cta_url: `/store/${subdomain}/products`,
                secondary_cta_text: 'View Catalog',
                secondary_cta_url: `/store/${subdomain}/products`,
                desktop_image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1600&auto=format&fit=crop',
                text_align: 'left',
                overlay_opacity: 65,
              },
              {
                id: 'slide_3',
                badge: 'Commercial Grade • Verified Reliability',
                title: 'Authentic Quality, Direct From Source',
                subtitle: 'Transparent production, certified batch integrity, and dedicated support for individual and enterprise clients alike.',
                cta_text: 'Shop Collection',
                cta_url: `/store/${subdomain}/products`,
                secondary_cta_text: 'Contact Support',
                secondary_cta_url: `/store/${subdomain}/pages/contact`,
                desktop_image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=1600&auto=format&fit=crop',
                text_align: 'left',
                overlay_opacity: 60,
              },
            ],
          },
          {
            id: 'b_props',
            type: 'value_props',
            title: 'The Quality Standard',
            subtitle: 'Our commitments to authentic quality, reliability, and service',
            items: [
              { icon: 'shield', title: 'Direct Authenticity', desc: 'Manufactured and sourced directly with rigorous inspection and zero middleman markups.' },
              { icon: 'truck', title: 'Reliable Dispatch', desc: 'Carefully packaged, quality checked, and shipped with live real-time milestone tracking.' },
              { icon: 'award', title: 'Official Guarantee', desc: 'Every order backed by comprehensive customer support and standard warranty.' },
              { icon: 'message', title: 'Customer Concierge', desc: 'Instant assistance for orders, bulk wholesale inquiries, and after-sales support.' },
            ],
          },
          {
            id: 'b_categories',
            type: 'trending_categories',
            title: 'Trending Categories',
            subtitle: 'Browse our specialized departments and product collections',
          },
          {
            id: 'b_products',
            type: 'featured_products',
            title: 'Featured Collections',
            subtitle: 'Explore our most popular and newly released items ready for immediate dispatch.',
            limit: 12,
            show_search: true,
            show_categories: true,
          },
          {
            id: 'b_promo',
            type: 'promo_split_banner',
            title: 'Precision Quality & Direct Value',
            subtitle: 'Built for discerning customers who value authentic craftsmanship, verified materials, and reliable long-term service.',
            cta_text: 'Explore Full Catalog',
            cta_url: '#catalog',
          },
          {
            id: 'b_faq',
            type: 'faq',
            title: 'Frequently Asked Questions',
            subtitle: 'Quick answers to common questions about ordering, delivery, and policies.',
            faqs: [
              { q: 'How are orders fulfilled and dispatched?', a: 'All orders are processed through our central fulfillment line and dispatched with verifiable parcel tracking.' },
              { q: 'What payment methods do you accept?', a: 'We accept multiple secure payment options, including Cash on Delivery (where eligible), bank transfer, and online payments.' },
              { q: 'Do you support wholesale or commercial inquiries?', a: 'Yes! We support commercial, institutional, and bulk B2B orders with tiered volume pricing.' },
              { q: 'How can I track my shipment?', a: 'Visit the Track Order page at any time and enter your order tracking number or mobile number.' },
            ],
          },
          {
            id: 'b_vip',
            type: 'newsletter_vip',
            title: `Stay Connected with ${config?.name ?? 'Our Brand'}`,
            subtitle: 'Receive timely updates on new releases, seasonal promotions, and insider updates.',
            button_text: 'Subscribe',
          },
        ];

  if (loading && products.length === 0 && cmsBlocks.length === 0) {
    return (
      <div className="space-y-12 py-8 animate-pulse">
        <div className="h-96 rounded-3xl bg-zinc-100 dark:bg-zinc-900" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 py-4">
      {effectiveBlocks.map((block, idx) => (
        <StorefrontBlockRenderer
          key={block.id || `blk-${idx}`}
          block={block}
          products={products}
          categories={categories}
          currency={currency}
          subdomain={subdomain}
          defaultCardStyle={config?.theme?.card_style || 'commerce'}
          onAddToCart={(product) => {
            addItem(product.id, 1);
            notify.success(`Added ${product.name} to cart`);
          }}
        />
      ))}
    </div>
  );
};
