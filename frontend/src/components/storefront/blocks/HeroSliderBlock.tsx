import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

export interface SlideData {
  id?: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  desktop_image?: string;
  mobile_image?: string;
  cta_text?: string;
  cta_url?: string;
  secondary_cta_text?: string;
  secondary_cta_url?: string;
  text_align?: 'left' | 'center' | 'right';
  overlay_opacity?: number;
}

interface HeroSliderBlockProps {
  block: PageBlock;
  subdomain: string;
}

export const HeroSliderBlock: React.FC<HeroSliderBlockProps> = ({ block, subdomain }) => {
  const settings = (block.settings as Record<string, unknown>) || {};
  const autoplay = Boolean(block.autoplay ?? settings.autoplay ?? true);
  const duration = Number(block.duration ?? settings.duration ?? 6000);

  const rawSlides =
    (block.slides as SlideData[]) ||
    (settings.slides as SlideData[]) ||
    [];

  const slides: SlideData[] =
    rawSlides.length > 0
      ? rawSlides
      : [
          {
            id: 'slide_1',
            badge: block.badge || 'Official Store • Direct Fulfillment',
            title: block.title || 'Designed for Excellence, Crafted for Longevity',
            subtitle:
              block.subtitle ||
              'Explore curated collections built to the highest commercial standards with direct-to-consumer value and official warranty.',
            cta_text: block.cta_text || block.primaryCtaText || 'Explore Catalog',
            cta_url: block.cta_url || '#catalog',
            secondary_cta_text: block.secondary_cta_text || 'About Us',
            secondary_cta_url: block.secondary_cta_url || `/store/${subdomain}/pages/about-us`,
            desktop_image:
              (block.desktop_image as string) ||
              (block.image_url as string) ||
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
            mobile_image:
              (block.mobile_image as string) ||
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop',
            text_align: 'left',
            overlay_opacity: 60,
          },
          {
            id: 'slide_2',
            badge: 'New Season • Premium Releases',
            title: 'Engineered for Performance & Elevated Living',
            subtitle:
              'Discover our latest release of meticulously finished products, created with verified materials and benchmark durability.',
            cta_text: 'Discover New Releases',
            cta_url: `/store/${subdomain}/products`,
            secondary_cta_text: 'View Catalog',
            secondary_cta_url: `/store/${subdomain}/products`,
            desktop_image:
              'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1600&auto=format&fit=crop',
            mobile_image:
              'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=800&auto=format&fit=crop',
            text_align: 'left',
            overlay_opacity: 65,
          },
          {
            id: 'slide_3',
            badge: 'Commercial Grade • Verified Reliability',
            title: 'Authentic Quality, Direct From Source',
            subtitle:
              'Transparent production, certified batch integrity, and dedicated support for individual and enterprise clients alike.',
            cta_text: 'Shop Collection',
            cta_url: `/store/${subdomain}/products`,
            secondary_cta_text: 'Contact Support',
            secondary_cta_url: `/store/${subdomain}/pages/contact`,
            desktop_image:
              'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=1600&auto=format&fit=crop',
            mobile_image:
              'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=800&auto=format&fit=crop',
            text_align: 'left',
            overlay_opacity: 60,
          },
        ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalSlides = slides.length;
  const sectionRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goToSlide = useCallback((idx: number) => {
    setCurrentIdx((idx + totalSlides) % totalSlides);
  }, [totalSlides]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIdx + 1);
  }, [currentIdx, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIdx - 1);
  }, [currentIdx, goToSlide]);

  // Pause-on-hover & focus DOM listeners
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const pause = () => setIsPaused(true);
    const resume = () => setIsPaused(false);
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', resume);
    return () => {
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('focusout', resume);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Autoplay Timer
  useEffect(() => {
    if (!autoplay || isPaused || totalSlides <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % totalSlides);
    }, duration);
    return () => clearInterval(timer);
  }, [autoplay, isPaused, totalSlides, duration]);

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) {
      nextSlide();
    } else if (diff < -50) {
      prevSlide();
    }
    touchStartX.current = null;
  };

  const activeSlide = slides[currentIdx] ?? slides[0];
  if (!activeSlide) return null;

  return (
    <section
      ref={sectionRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group/slider relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-white shadow-xl transition-all duration-500 outline-none select-none min-h-[440px] sm:min-h-[540px] lg:min-h-[600px] flex items-center"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Storefront Hero Multi-Image Slider"
    >
      {/* Background Slides with Crossfade and Cinematic Zoom */}
      {slides.map((slide, i) => {
        const isActive = i === currentIdx;
        const bgImg = slide.desktop_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop';
        return (
          <div
            key={slide.id || `slide-bg-${i}`}
            className={`absolute inset-0 z-0 transition-all duration-1000 ease-in-out ${
              isActive
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-105 pointer-events-none'
            }`}
            aria-hidden={!isActive}
          >
            <picture>
              {slide.mobile_image && (
                <source media="(max-width: 640px)" srcSet={slide.mobile_image} />
              )}
              <img
                src={bgImg}
                alt={slide.title || 'Store Hero Banner'}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-cover object-center"
              />
            </picture>

            {/* Custom Contrast Darkening Overlay per Slide */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/35 backdrop-blur-[0.5px]"
              style={{
                opacity: (slide.overlay_opacity ?? 60) / 100,
              }}
            />
          </div>
        );
      })}

      {/* Decorative Brand Accent Glow */}
      <div className="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--store-primary-rgb,16,185,129),0.18),transparent_65%)] pointer-events-none" />

      {/* Active Content Layer */}
      <div className="relative z-10 w-full mx-auto max-w-7xl px-6 py-16 sm:px-12 sm:py-24 lg:py-28">
        <div
          key={`content-${currentIdx}`}
          className={`flex flex-col max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 ${
            activeSlide.text_align === 'center'
              ? 'text-center mx-auto items-center'
              : activeSlide.text_align === 'right'
              ? 'text-right ml-auto items-end'
              : 'text-left items-start'
          }`}
        >
          {/* Badge */}
          {activeSlide.badge && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md shadow-xs">
              <Sparkles className="size-3 text-amber-300" />
              <span className="font-mono text-[11px] tracking-wider uppercase text-zinc-100">
                {activeSlide.badge}
              </span>
            </div>
          )}

          {/* Heading */}
          <h1
            style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
            className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-[1.12] drop-shadow-sm"
          >
            {activeSlide.title}
          </h1>

          {/* Subtitle */}
          {activeSlide.subtitle && (
            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed max-w-xl drop-shadow-2xs">
              {activeSlide.subtitle}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            {activeSlide.cta_text && (
              <a
                href={activeSlide.cta_url || '#catalog'}
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer active:scale-95 hover:opacity-95 hover:shadow-2xl"
              >
                <ShoppingBag className="size-4" />
                <span>{activeSlide.cta_text}</span>
              </a>
            )}

            {activeSlide.secondary_cta_text && (
              <a
                href={activeSlide.secondary_cta_url || `/store/${subdomain}/pages/about-us`}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-md"
              >
                <span>{activeSlide.secondary_cta_text}</span>
                <ArrowRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls (Visible when multi-slide) */}
      {totalSlides > 1 && (
        <>
          {/* Previous Arrow Button */}
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-10 sm:size-12 rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-105 active:scale-95"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="size-5 sm:size-6" />
          </button>

          {/* Next Arrow Button */}
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-10 sm:size-12 rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-105 active:scale-95"
            aria-label="Next Slide"
          >
            <ChevronRight className="size-5 sm:size-6" />
          </button>

          {/* Interactive Slide Pagination with Expanding Pills */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
            {slides.map((_, i) => (
              <button
                key={`dot-${i}`}
                type="button"
                onClick={() => goToSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === currentIdx
                    ? 'w-8 bg-white shadow-xs'
                    : 'w-2 bg-white/40 hover:bg-white/75'
                }`}
                aria-label={`Go to slide ${i + 1} of ${totalSlides}`}
              />
            ))}
          </div>

          {/* Subtle Autoplay Progress Bar at Top */}
          {autoplay && !isPaused && (
            <div className="absolute top-0 inset-x-0 h-1 bg-white/10 z-20 overflow-hidden">
              <div
                key={`progress-${currentIdx}`}
                className="h-full bg-white/70 animate-[progress_linear_forwards]"
                style={{
                  animationDuration: `${duration}ms`,
                  width: '100%',
                }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
};
