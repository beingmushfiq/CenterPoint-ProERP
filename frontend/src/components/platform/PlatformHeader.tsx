import React, { useState, useEffect } from 'react';
import { usePlatformAuthStore } from '../../lib/auth/platformAuthStore';
import { ShieldCheck, LogOut, Terminal, Sun, Moon, Menu } from 'lucide-react';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

interface PlatformHeaderProps {
  onToggleSidebar?: () => void;
}

export const PlatformHeader: React.FC<PlatformHeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = usePlatformAuthStore();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('ui.theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('ui.theme', 'light');
    }
  };

  return (
    <header className="h-16 border-b border-default bg-surface/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl border border-default bg-surface-sunken hover:bg-surface text-default transition-all shadow-2xs cursor-pointer"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="size-4" />
        </button>

        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-mono font-bold shadow-2xs">
          <Terminal className="size-3.5" />
          <span>CONTROL PLANE</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted font-mono">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-default">PRODUCTION CLUSTER</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-default bg-surface-sunken hover:bg-surface text-muted hover:text-default transition-all shadow-2xs cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-default" />}
        </button>

        {/* Global Language Switcher */}
        <LanguageSwitcher />

        {/* Super Admin Pill */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-surface-sunken rounded-xl border border-default text-xs text-default shadow-2xs">
          <ShieldCheck className="size-4 text-amber-500" />
          <div className="flex flex-col">
            <span className="font-bold text-default leading-tight">{user?.name ?? 'Admin User'}</span>
            <span className="text-[10px] text-muted font-mono leading-tight">{user?.email ?? 'admin@devcenterpoint.com'}</span>
          </div>
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-mono uppercase font-bold tracking-wider border border-amber-500/30">
            Super Admin
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all shadow-2xs cursor-pointer"
          title="Sign out of Platform Control Plane"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
