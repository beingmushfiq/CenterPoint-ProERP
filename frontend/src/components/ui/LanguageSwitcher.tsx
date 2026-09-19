import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import { changeLocale, type AppLocale } from '../../lib/i18n';
import { cn } from '../../lib/utils';

interface LanguageSwitcherProps {
  variant?: 'header' | 'footer' | 'dropdown';
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
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

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-default transition-token-colors focus-visible:ring-focus cursor-pointer text-xs font-semibold"
        aria-label={`Current language: ${currentLocale === 'bn' ? 'বাংলা' : 'English'}. Click to change.`}
        aria-expanded={isOpen}
      >
        <Languages className="size-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline font-mono tracking-wider uppercase text-[11px]">
          {currentLocale === 'bn' ? 'বাংলা' : 'EN'}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-default bg-surface-raised p-1.5 shadow-xl z-50 animate-fade-in text-xs"
          role="menu"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
            Select Language / ভাষা
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSelect('en')}
            className={cn(
              'w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors cursor-pointer text-left',
              currentLocale === 'en'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-default hover:bg-surface-sunken'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🇬🇧</span>
              <span>English</span>
            </div>
            {currentLocale === 'en' && <Check className="size-3.5 text-primary" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSelect('bn')}
            className={cn(
              'w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors cursor-pointer text-left',
              currentLocale === 'bn'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-default hover:bg-surface-sunken'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🇧🇩</span>
              <span>বাংলা (Bengali)</span>
            </div>
            {currentLocale === 'bn' && <Check className="size-3.5 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
