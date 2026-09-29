import React, { useState } from 'react';
import {
  Search,
  Globe,
  Sparkles,
} from 'lucide-react';

interface SeoSocialPreviewSectionProps {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  title: string;
  ogImage?: string | undefined;
  onUpdate: (fields: {
    meta_title?: string;
    meta_description?: string;
    og_image?: string;
  }) => void;
  brandName?: string | undefined;
  domain?: string | undefined;
}

export type SocialPreviewTab = 'google' | 'facebook' | 'twitter' | 'whatsapp';

export const SeoSocialPreviewSection: React.FC<SeoSocialPreviewSectionProps> = ({
  metaTitle,
  metaDescription,
  slug,
  title,
  ogImage = '',
  onUpdate,
  brandName = 'SliceMart',
  domain = 'store.slicemart.com',
}) => {
  const [activeTab, setActiveTab] = useState<SocialPreviewTab>('google');

  const displayTitle = metaTitle || title || `${brandName} — Commercial Grade Direct`;
  const displayDescription =
    metaDescription ||
    'Discover authentic collections, commercial-grade products, verified quality specifications, and direct fulfillment from our factory catalog.';
  const displayImage =
    ogImage ||
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop';

  const canonicalUrl = `https://${domain}${slug === 'home' ? '' : `/pages/${slug}`}`;

  // Character lengths
  const titleLen = metaTitle.length;
  const descLen = metaDescription.length;

  return (
    <div className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default pb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-default">SEO Meta & Social OpenGraph Card</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-subtle text-primary font-mono font-bold">
            Search & Social Simulator
          </span>
        </div>
        <span className="text-[11px] text-muted hidden sm:inline">
          Real-time preview across search engines and social feeds
        </span>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Input Controls */}
        <div className="space-y-3.5">
          {/* Meta Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                SEO Meta Title
              </label>
              <span
                className={`text-[10px] font-mono font-semibold ${
                  titleLen === 0
                    ? 'text-muted'
                    : titleLen <= 60
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-500 font-bold'
                }`}
              >
                {titleLen}/60 chars {titleLen > 60 && '(truncated by Google)'}
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Premium Commercial Kitchenware | SliceMart"
              value={metaTitle}
              onChange={(e) => onUpdate({ meta_title: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Meta Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                SEO Meta Description
              </label>
              <span
                className={`text-[10px] font-mono font-semibold ${
                  descLen === 0
                    ? 'text-muted'
                    : descLen <= 160
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-500 font-bold'
                }`}
              >
                {descLen}/160 chars {descLen > 160 && '(truncated in SERP)'}
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Concise 150-160 character summary describing this page for search bots and social shares..."
              value={metaDescription}
              onChange={(e) => onUpdate({ meta_description: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* OpenGraph Image URL */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
              Social Share Image URL (og:image)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="https://images.unsplash.com/... or CDN image URL"
                value={ogImage}
                onChange={(e) => onUpdate({ og_image: e.target.value })}
                className="flex-1 rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    og_image:
                      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
                  })
                }
                className="px-2.5 py-2 rounded-xl border border-default bg-surface-sunken text-[11px] font-semibold text-muted hover:text-default hover:border-primary transition-all cursor-pointer whitespace-nowrap"
                title="Use default high-res sample image"
              >
                Preset
              </button>
            </div>
          </div>
        </div>

        {/* Right: Interactive Social Card Simulator */}
        <div className="flex flex-col rounded-2xl border border-default bg-surface-sunken p-4 space-y-3">
          {/* Simulator Tabs */}
          <div className="flex items-center justify-between border-b border-default pb-2">
            <span className="text-[10px] uppercase font-bold text-muted flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              <span>Live Social Card Simulator</span>
            </span>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-default">
              <button
                type="button"
                onClick={() => setActiveTab('google')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-primary text-primary-fg shadow-2xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('facebook')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'facebook'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Facebook
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('twitter')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'twitter'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Twitter / X
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* Simulator Body */}
          <div className="flex-1 flex flex-col justify-center">
            {/* 1. Google SERP Snippet */}
            {activeTab === 'google' && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 shadow-xs font-sans">
                <div className="flex items-center gap-2">
                  <div className="size-5 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-primary">
                    <Globe className="size-3 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {brandName}
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-500 font-mono truncate">
                      {canonicalUrl}
                    </div>
                  </div>
                </div>

                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer line-clamp-1">
                  {displayTitle}
                </div>

                <div className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {displayDescription}
                </div>
              </div>
            )}

            {/* 2. Facebook OpenGraph Card */}
            {activeTab === 'facebook' && (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
                <div className="relative aspect-16/9 w-full bg-slate-100 dark:bg-zinc-900 overflow-hidden">
                  <img
                    src={displayImage}
                    alt={displayTitle}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-white backdrop-blur-xs">
                    1200 × 630
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
                    {domain}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {displayTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-normal">
                    {displayDescription}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Twitter / X Large Summary Card */}
            {activeTab === 'twitter' && (
              <div className="overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 text-white p-3 space-y-2.5 shadow-md">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-emerald-400 border border-zinc-700">
                    {brandName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>{brandName}</span>
                      <span className="text-[10px] text-zinc-500 font-normal">
                        @{brandName.toLowerCase().replace(/\s+/g, '')} • Official
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Explore official updates, catalogs, and verified standards.
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  <div className="relative aspect-16/9 w-full bg-zinc-900">
                    <img
                      src={displayImage}
                      alt={displayTitle}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[9px] font-mono text-zinc-300">
                      {domain}
                    </div>
                  </div>
                  <div className="p-2.5 space-y-0.5">
                    <div className="text-xs font-bold text-zinc-100 line-clamp-1">
                      {displayTitle}
                    </div>
                    <div className="text-[11px] text-zinc-400 line-clamp-2">
                      {displayDescription}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. WhatsApp / iMessage Chat Bubble Preview */}
            {activeTab === 'whatsapp' && (
              <div className="p-3 rounded-2xl bg-[#EFEAE2] dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 space-y-2">
                <div className="max-w-xs ml-auto rounded-2xl rounded-tr-xs bg-[#D9FDD3] dark:bg-emerald-950/60 p-2.5 border border-emerald-300/40 dark:border-emerald-800/40 text-slate-900 dark:text-zinc-100 space-y-1.5 shadow-xs">
                  <div className="overflow-hidden rounded-xl bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/60">
                    <div className="relative aspect-16/9 w-full bg-zinc-900">
                      <img
                        src={displayImage}
                        alt={displayTitle}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop';
                        }}
                      />
                    </div>
                    <div className="p-2 space-y-0.5">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white line-clamp-1">
                        {displayTitle}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-2">
                        {displayDescription}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 pt-0.5">
                        {domain}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 underline break-all font-mono">
                    {canonicalUrl}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-zinc-400 text-right font-mono flex items-center justify-end gap-1">
                    <span>11:42 AM</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
