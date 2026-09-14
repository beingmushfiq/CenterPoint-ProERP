import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { toggleThemeWithTransition } from '../../lib/theme/themeTransition';

interface StorefrontThemeToggleProps {
  className?: string;
  isDarkNavbar?: boolean;
}

export const StorefrontThemeToggle: React.FC<StorefrontThemeToggleProps> = ({
  className = '',
  isDarkNavbar = false,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ui.theme') || localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  const handleToggle = (e: React.MouseEvent) => {
    toggleThemeWithTransition(theme, e, (next) => {
      setTheme(next);
    });
  };

  const defaultStyles = isDarkNavbar
    ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
    : 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400/50';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center justify-center size-8.5 rounded-xl border shadow-xs transition-all cursor-pointer active:scale-95 ${defaultStyles} ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="size-4 text-amber-400 animate-spin-slow" />
      ) : (
        <Moon className="size-4 text-inherit" />
      )}
    </button>
  );
};
