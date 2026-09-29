import React from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import type { PageBlock } from '../../StorefrontPageBuilderWorkspace';

interface HeroBannerEditorProps {
  block: PageBlock;
  onChange: (updatedBlock: PageBlock) => void;
}

export const HeroBannerEditor: React.FC<HeroBannerEditorProps> = ({ block, onChange }) => {
  const slides = block.slides && block.slides.length > 0 ? block.slides : [
    {
      id: 'slide_1',
      badge: block.badge || 'Official Store • Direct Fulfillment',
      title: block.title || 'Designed for Excellence, Crafted for Longevity',
      subtitle: block.subtitle || 'Explore curated collections built to the highest commercial standards with direct-to-consumer value and official warranty.',
      cta_text: block.cta_text || 'Explore Catalog',
      cta_url: block.cta_url || '#catalog',
      secondary_cta_text: block.secondary_cta_text || 'About Us',
      secondary_cta_url: block.secondary_cta_url || '/pages/about-us',
      desktop_image:
        (block.desktop_image as string) ||
        (block.image_url as string) ||
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
      mobile_image: '',
      text_align: 'left' as const,
      overlay_opacity: 60,
    },
  ];

  const handleUpdateSlide = (index: number, updatedFields: Partial<(typeof slides)[0]>) => {
    const nextSlides = [...slides];
    nextSlides[index] = { ...nextSlides[index], ...updatedFields };
    onChange({ ...block, slides: nextSlides });
  };

  const handleAddSlide = () => {
    const nextSlides = [...slides];
    nextSlides.push({
      id: `slide_${Date.now()}`,
      badge: 'New Collection • Verified Quality',
      title: 'Elevate Your Everyday Standards',
      subtitle: 'Engineered with sustainable materials, precise finishing, and direct factory fulfillment.',
      cta_text: 'Shop New Arrivals',
      cta_url: '#catalog',
      secondary_cta_text: 'View Story',
      secondary_cta_url: '/pages/about-us',
      desktop_image:
        'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1600&auto=format&fit=crop',
      mobile_image: '',
      text_align: 'left' as const,
      overlay_opacity: 60,
    });
    onChange({ ...block, slides: nextSlides });
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const nextSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextSlides.length) return;
    const currentSlide = nextSlides[index];
    const targetSlide = nextSlides[targetIndex];
    if (!currentSlide || !targetSlide) return;
    nextSlides[index] = targetSlide;
    nextSlides[targetIndex] = currentSlide;
    onChange({ ...block, slides: nextSlides });
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter((_, i) => i !== index);
    onChange({ ...block, slides: nextSlides });
  };

  return (
    <div className="space-y-4">
      {/* Global Slider Settings Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-default bg-surface-sunken">
        <div className="flex items-center gap-4 text-xs font-semibold text-default">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={block.autoplay !== false}
              onChange={(e) => onChange({ ...block, autoplay: e.target.checked })}
              className="rounded border-default text-primary focus:ring-0 cursor-pointer"
            />
            <span>Autoplay Carousel</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-muted text-[11px]">Interval:</span>
            <select
              value={block.duration || 6000}
              onChange={(e) => onChange({ ...block, duration: Number(e.target.value) })}
              className="rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono cursor-pointer"
            >
              <option value={3000}>3s (Fast)</option>
              <option value={5000}>5s</option>
              <option value={6000}>6s (Default)</option>
              <option value={8000}>8s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddSlide}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Add Slide</span>
        </button>
      </div>

      {/* Slides Cards List */}
      <div className="space-y-3">
        {slides.map((slide, sIdx) => (
          <div
            key={slide.id || sIdx}
            className="p-4 rounded-xl border border-default bg-surface-sunken/60 space-y-3 relative group/slide"
          >
            {/* Slide Header */}
            <div className="flex items-center justify-between border-b border-default/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-surface border border-default text-[10px] font-mono font-bold text-muted">
                  {sIdx + 1}
                </span>
                <span className="text-xs font-bold text-default truncate max-w-50 sm:max-w-xs">
                  {slide.title || `Slide ${sIdx + 1}`}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Alignment Selector */}
                <div className="flex items-center border border-default rounded-lg bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateSlide(sIdx, { text_align: 'left' })}
                    className={`p-1 rounded cursor-pointer ${
                      slide.text_align === 'left' || !slide.text_align
                        ? 'bg-primary text-primary-fg'
                        : 'text-muted hover:text-default'
                    }`}
                    title="Align Left"
                  >
                    <AlignLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSlide(sIdx, { text_align: 'center' })}
                    className={`p-1 rounded cursor-pointer ${
                      slide.text_align === 'center'
                        ? 'bg-primary text-primary-fg'
                        : 'text-muted hover:text-default'
                    }`}
                    title="Align Center"
                  >
                    <AlignCenter className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSlide(sIdx, { text_align: 'right' })}
                    className={`p-1 rounded cursor-pointer ${
                      slide.text_align === 'right'
                        ? 'bg-primary text-primary-fg'
                        : 'text-muted hover:text-default'
                    }`}
                    title="Align Right"
                  >
                    <AlignRight className="size-3" />
                  </button>
                </div>

                {/* Move Slide */}
                <button
                  type="button"
                  disabled={sIdx === 0}
                  onClick={() => handleMoveSlide(sIdx, 'up')}
                  className="rounded-lg border border-default bg-surface p-1 text-muted hover:text-default disabled:opacity-30 cursor-pointer"
                  title="Move Slide Up"
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={sIdx === slides.length - 1}
                  onClick={() => handleMoveSlide(sIdx, 'down')}
                  className="rounded-lg border border-default bg-surface p-1 text-muted hover:text-default disabled:opacity-30 cursor-pointer"
                  title="Move Slide Down"
                >
                  <ArrowDown className="size-3" />
                </button>

                {/* Delete Slide */}
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(sIdx)}
                    className="rounded-lg border border-rose-500/20 bg-surface p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer ml-1"
                    title="Delete Slide"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Slide Content Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                  Pill Badge
                </label>
                <input
                  type="text"
                  value={slide.badge || ''}
                  placeholder="e.g. Verified Direct Fulfillment"
                  onChange={(e) => handleUpdateSlide(sIdx, { badge: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                  Overlay Opacity ({slide.overlay_opacity ?? 60}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={slide.overlay_opacity ?? 60}
                  onChange={(e) => handleUpdateSlide(sIdx, { overlay_opacity: Number(e.target.value) })}
                  className="w-full accent-primary cursor-pointer mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                Headline Title
              </label>
              <input
                type="text"
                value={slide.title || ''}
                placeholder="e.g. Next-Gen Precision Machinery"
                onChange={(e) => handleUpdateSlide(sIdx, { title: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default font-bold focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                Subtitle Description
              </label>
              <textarea
                rows={2}
                value={slide.subtitle || ''}
                placeholder="Brief narrative highlighting value proposition..."
                onChange={(e) => handleUpdateSlide(sIdx, { subtitle: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-default/50">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                  Primary Action Button
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Button Label (e.g. Explore Catalog)"
                    value={slide.cta_text || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { cta_text: e.target.value })}
                    className="flex-1 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs text-default"
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g. #catalog)"
                    value={slide.cta_url || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { cta_url: e.target.value })}
                    className="flex-1 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs text-default font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted block">
                  Secondary Action Button
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Button Label (e.g. About Us)"
                    value={slide.secondary_cta_text || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { secondary_cta_text: e.target.value })}
                    className="flex-1 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs text-default"
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g. /pages/about-us)"
                    value={slide.secondary_cta_url || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { secondary_cta_url: e.target.value })}
                    className="flex-1 rounded-xl border border-default bg-surface px-2.5 py-1 text-xs text-default font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Image URLs & Thumbnail Preview */}
            <div className="space-y-2 pt-1 border-t border-default/50">
              <label className="text-[10px] uppercase font-bold text-muted block">
                Slide Background Image
              </label>
              <div className="flex items-center gap-3">
                <div className="size-14 rounded-xl border border-default bg-surface overflow-hidden shrink-0">
                  {slide.desktop_image ? (
                    <img
                      src={slide.desktop_image}
                      alt={slide.title || 'Slide'}
                      className="size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=300';
                      }}
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center text-muted">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    placeholder="Desktop Image URL (1600x600 recommended)"
                    value={slide.desktop_image || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { desktop_image: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Mobile Image URL (optional portrait crop)"
                    value={slide.mobile_image || ''}
                    onChange={(e) => handleUpdateSlide(sIdx, { mobile_image: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
