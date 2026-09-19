import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { changeLocale, type AppLocale } from '../../lib/i18n';
import { cn } from '../../lib/utils';

interface LanguageSwitcherProps {
  variant?: 'header' | 'footer' | 'dropdown' | 'storefront';
  className?: string;
  isDark?: boolean;
}

export function LanguageSwitcher({
  variant = 'header',
  className,
  isDark = false,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLocale = (i18n.language?.slice(0, 2) === 'bn' ? 'bn' : 'en') as AppLocale;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = async (locale: AppLocale) => {
    if (locale !== currentLocale) {
      await changeLocale(locale);
    }
    setIsOpen(false);
  };

  // Button styles depending on variant
  const buttonClasses = (() => {
    if (variant === 'storefront') {
      return isDark
        ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
        : 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700';
    }
    if (variant === 'footer') {
      return 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-zinc-800';
    }
    return 'text-muted hover:bg-surface-sunken hover:text-default border-transparent hover:border-default/30';
  })();

  const isUpward = variant === 'footer';

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center select-none', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
          variant === 'storefront' ? 'h-8.5 px-2.5 sm:px-3' : 'px-2.5 py-1.5',
          buttonClasses
        )}
        aria-label={`Current language: ${currentLocale === 'bn' ? 'বাংলা' : 'English'}. Click to change.`}
        aria-expanded={isOpen}
      >
        <Languages className="size-3.5 sm:size-4 shrink-0 opacity-80" aria-hidden="true" />
        <span className="font-semibold tracking-wide text-xs">
          {currentLocale === 'bn' ? 'বাংলা' : 'EN'}
        </span>
        <ChevronDown
          className={cn(
            'size-3 shrink-0 opacity-60 transition-transform duration-200',
            isOpen && (isUpward ? '-rotate-180' : 'rotate-180')
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 w-48 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1.5 shadow-2xl z-100 animate-in fade-in-50 zoom-in-95 text-xs select-none',
            isUpward ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'
          )}
          role="menu"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 mb-1">
            Language / ভাষা
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSelect('en')}
            className={cn(
              'w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors cursor-pointer text-left font-medium',
              currentLocale === 'en'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900'
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">🇬🇧</span>
              <div className="flex flex-col">
                <span className="leading-tight">English</span>
                <span className="text-[10px] opacity-60 font-normal">Default</span>
              </div>
            </div>
            {currentLocale === 'en' && <Check className="size-4 text-emerald-600 dark:text-emerald-400" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSelect('bn')}
            className={cn(
              'w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors cursor-pointer text-left font-medium',
              currentLocale === 'bn'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900'
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">🇧🇩</span>
              <div className="flex flex-col">
                <span className="leading-tight">বাংলা</span>
                <span className="text-[10px] opacity-60 font-normal">Bengali</span>
              </div>
            </div>
            {currentLocale === 'bn' && <Check className="size-4 text-emerald-600 dark:text-emerald-400" />}
          </button>
        </div>
      )}
    </div>
  );
}
