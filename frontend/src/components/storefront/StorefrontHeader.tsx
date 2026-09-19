import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Store,
  MessageCircle,
  Truck,
  Sparkles,
  Menu,
  X,
  ExternalLink,
  Smartphone,
  Heart,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import { useStorefrontWishlistStore } from '../../lib/storefront/storefrontWishlistStore';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { getContrastColor } from '../../lib/storefront/themeSync';
import { getStorefrontUrl, normalizeStorefrontPath } from '../../lib/storefront/storefrontUrl';
import type { StorefrontConfig } from '../../types/api/storefront';

import { StorefrontThemeToggle } from './StorefrontThemeToggle';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

interface StorefrontHeaderProps {
  config: StorefrontConfig | null;
  subdomain: string;
}

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({ config, subdomain }) => {
  const location = useLocation();
  const { cart, openDrawer } = useStorefrontCartStore();
  const { items: wishlistItems, openWishlist } = useStorefrontWishlistStore();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const itemCount = cart?.item_count ?? 0;
  const cartTotal = cart?.total_amount ? parseFloat(cart.total_amount) : 0;
  const currency = config?.currency ?? 'BDT';

  const theme = config?.theme;
  const announcementEnabled = theme?.announcement_enabled !== false;
  const announcementText = theme?.announcement_text || 'Official Storefront • Verified Authentic Products & Direct Fulfillment';
  const announcementBg = theme?.announcement_bg;
  const announcementTextColor = theme?.announcement_text_color;

  const navbarBg = theme?.navbar_bg;
  const navbarTextColor = theme?.navbar_text_color;

  // Determine if navbar is dark based on text color or background contrast
  const isDarkNavbar =
    navbarTextColor === '#ffffff' ||
    (navbarBg ? getContrastColor(navbarBg) === '#ffffff' : false);

  interface NavMenuItem {
    label: string;
    url: string;
    is_external?: boolean;
  }

  const customMenuItems = theme?.menu_items && theme.menu_items.length > 0 ? theme.menu_items : null;

  const defaultMenuItems: NavMenuItem[] = [
    { label: 'Hardware Catalog', url: getStorefrontUrl(subdomain, '/products'), is_external: false },
    { label: 'Manifesto', url: getStorefrontUrl(subdomain, '/pages/about-us'), is_external: false },
    { label: 'Custom Lab', url: getStorefrontUrl(subdomain, '/pages/custom-lab'), is_external: false },
    { label: 'Warranty & Care', url: getStorefrontUrl(subdomain, '/pages/warranty-support'), is_external: false },
    { label: 'Track Parcel', url: getStorefrontUrl(subdomain, '/track'), is_external: false },
  ];

  const menuItems: NavMenuItem[] = customMenuItems || defaultMenuItems;

  const whatsappNumber = config?.whatsapp_number?.replace(/[^0-9]/g, '') || '';
  const whatsappMsg = encodeURIComponent(
    config?.whatsapp_default_message ||
      `Hello ${config?.name ?? 'Store'}, I would like to inquire about placing an order.`
  );

  const formatMenuUrl = (url: string) => {
    // Normalises any URL: strips /store/:subdomain prefixes, resolves aliases,
    // and returns a clean storefront-relative path (or absolute external URL).
    return normalizeStorefrontPath(subdomain, url);
  };

  const isLinkActive = (targetUrl: string) => {
    const current = location.pathname;
    const homeUrl = getStorefrontUrl(subdomain);
    if (targetUrl === homeUrl || targetUrl === `${homeUrl}/`) {
      return current === homeUrl || current === `${homeUrl}/` || current === '/';
    }
    return current === targetUrl || current.startsWith(`${targetUrl}/`);
  };

  const storeName = config?.name ?? 'Official Store';
  const hasStoreInName = /store|storefront/i.test(storeName);

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden transition-all">
      {/* Top Announcement Ticker Bar */}
      {announcementEnabled && (
        <div
          style={{
            backgroundColor: announcementBg || undefined,
            color: announcementTextColor || undefined,
          }}
          className={`text-[11px] py-2 px-3 sm:px-4 border-b border-black/10 dark:border-white/10 font-medium select-none shadow-xs transition-colors overflow-hidden w-full max-w-full ${
            !announcementBg ? 'bg-zinc-900 dark:bg-zinc-950 text-zinc-100' : ''
          }`}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 overflow-hidden w-full">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="flex size-1.5 shrink-0 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] sm:text-[11px] opacity-95 font-medium truncate">
                {announcementText}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[10px] sm:text-[11px] opacity-90 shrink-0">
              <div className="flex items-center gap-1.5">
                <Truck className="size-3.5 opacity-90" />
                <span className="hidden sm:inline">Tracked Dispatch</span>
              </div>
              <span className="opacity-40 hidden sm:inline">•</span>
              <div className="hidden sm:flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 opacity-90" />
                <span>Verified Authenticity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Glassmorphic Navigation Bar */}
      <div
        style={{
          backgroundColor: navbarBg || undefined,
          color: navbarTextColor || undefined,
        }}
        className={`border-b transition-colors shadow-xs w-full max-w-full overflow-hidden ${
          isDarkNavbar ? 'border-white/10' : 'border-slate-200/90 dark:border-zinc-800/80'
        } ${!navbarBg ? 'bg-white/95 dark:bg-zinc-950/85 backdrop-blur-xl' : 'backdrop-blur-xl'}`}
      >
        <div className="mx-auto flex h-16 sm:h-17 max-w-7xl items-center justify-between px-2.5 sm:px-6 lg:px-8 gap-1.5 sm:gap-2 w-full overflow-hidden">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-1 sm:gap-2.5 min-w-0 flex-1">
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: navbarTextColor || undefined }}
              className={`md:hidden p-1.5 rounded-xl transition-colors shrink-0 ${
                isDarkNavbar ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-slate-900 dark:text-white'
              }`}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link
              to={getStorefrontUrl(subdomain)}
              className="group flex items-center gap-1.5 sm:gap-2.5 transition-transform active:scale-98 cursor-pointer min-w-0"
            >
              <div
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="flex size-8.5 sm:size-10 items-center justify-center rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/20 transition-all shrink-0 group-hover:scale-105"
              >
                <Store className="size-4.5 sm:size-5.5 stroke-[2.2]" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    style={{ color: navbarTextColor || undefined }}
                    className={`font-bold tracking-tight text-xs sm:text-base leading-tight transition-colors truncate max-w-30 sm:max-w-65 md:max-w-85 ${
                      !navbarTextColor ? 'text-slate-900 dark:text-white' : ''
                    }`}
                  >
                    {storeName}
                  </span>
                  {!hasStoreInName && (
                    <span
                      title="Official Verified Store"
                      className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0"
                    >
                      Official
                    </span>
                  )}
                </div>
                <div
                  style={{ color: navbarTextColor ? `${navbarTextColor}99` : undefined }}
                  className={`text-[11px] font-medium flex items-center gap-1 mt-0.5 ${
                    !navbarTextColor ? 'text-slate-500 dark:text-zinc-400' : ''
                  }`}
                >
                  <Sparkles className="size-3 text-amber-400 shrink-0 inline" />
                  <span className="hidden sm:inline truncate">Direct Sourcing & Fulfillment</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center justify-center gap-1 lg:gap-1.5 flex-1 px-4 max-w-xl">
            {menuItems.map((item, idx) => {
              const isExternal = Boolean(item.is_external || item.url.startsWith('http'));
              const finalUrl = isExternal ? item.url : formatMenuUrl(item.url);
              const active = !isExternal && isLinkActive(finalUrl);

              if (isExternal) {
                return (
                  <a
                    key={`${item.label}-${idx}`}
                    href={finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: navbarTextColor || undefined }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isDarkNavbar
                        ? 'text-white/75 hover:text-white hover:bg-white/10'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                );
              }

              return (
                <Link
                  key={`${item.label}-${idx}`}
                  to={finalUrl}
                  style={{ color: navbarTextColor || undefined }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all relative ${
                    active
                      ? isDarkNavbar
                        ? 'font-semibold text-white bg-white/12 shadow-2xs'
                        : 'font-semibold text-slate-900 bg-slate-100/90 shadow-2xs'
                      : isDarkNavbar
                      ? 'font-medium text-white/75 hover:text-white hover:bg-white/10'
                      : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      style={{ backgroundColor: 'var(--store-primary, #10b981)' }}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-0.5 rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Direct WhatsApp Ordering Pill */}
            {config?.whatsapp_ordering_enabled !== false && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 hover:border-[#25D366]/50 transition-all shadow-2xs shrink-0 cursor-pointer"
                title="Order directly via WhatsApp"
              >
                <MessageCircle className="size-3.5 fill-current/20" />
                <span>WhatsApp Order</span>
              </a>
            )}

            {/* Customer Account */}
            <Link
              to={getStorefrontUrl(subdomain, '/account')}
              style={{ color: navbarTextColor || undefined }}
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
                isDarkNavbar
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Customer Account"
            >
              <User className="size-3.5 opacity-80" />
              <span className="hidden lg:inline">Account</span>
            </Link>

            {/* Install Store PWA Button */}
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={() => promptInstall()}
                style={{ color: navbarTextColor || undefined }}
                className={`hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isDarkNavbar
                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Install Store App to your device"
              >
                <Smartphone className="size-3.5 opacity-80" />
                <span>App</span>
              </button>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggler (Adapts cleanly to dark or light navbar) */}
            <StorefrontThemeToggle isDarkNavbar={isDarkNavbar} />

            {/* Wishlist Trigger */}
            <button
              type="button"
              onClick={openWishlist}
              style={{ color: navbarTextColor || undefined }}
              className={`relative flex items-center justify-center rounded-xl p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isDarkNavbar
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="View Saved Wishlist"
              aria-label="View Saved Wishlist"
            >
              <Heart className={`size-4 transition-colors ${wishlistItems.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="hidden lg:inline">Wishlist</span>
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:top-auto sm:right-auto flex size-4 sm:size-4.5 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold font-mono">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            {/* Cart Trigger with Total Preview (Powered by Primary Accent Color) */}
            <button
              type="button"
              onClick={openDrawer}
              style={{
                backgroundColor: 'var(--store-primary, #10b981)',
                color: 'var(--store-primary-fg, #ffffff)',
              }}
              className="group relative flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all cursor-pointer active:scale-95 border border-black/10 dark:border-white/10 shrink-0"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="size-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Cart</span>
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  color: '#ffffff',
                }}
                className="flex size-4.5 sm:size-5 items-center justify-center rounded-full px-1 text-[10px] font-bold font-mono"
              >
                {itemCount}
              </span>
              {itemCount > 0 && (
                <span className="hidden md:inline text-[11px] font-mono font-bold ml-0.5 opacity-90">
                  {currency} {cartTotal.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Menu */}
        {mobileMenuOpen && (
          <div
            style={{
              backgroundColor: navbarBg || undefined,
              color: navbarTextColor || undefined,
            }}
            className={`md:hidden border-t px-4 py-4 space-y-3 shadow-xl transition-all animate-in slide-in-from-top-2 ${
              isDarkNavbar
                ? 'border-white/10'
                : 'border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl'
            }`}
          >
            <nav className="flex flex-col gap-1">
              {menuItems.map((item, idx) => {
                const isExternal = Boolean(item.is_external || item.url.startsWith('http'));
                const finalUrl = isExternal ? item.url : formatMenuUrl(item.url);
                const active = !isExternal && isLinkActive(finalUrl);

                if (isExternal) {
                  return (
                    <a
                      key={`${item.label}-${idx}`}
                      href={finalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{ color: navbarTextColor || undefined }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkNavbar
                          ? 'text-white/85 hover:bg-white/10 hover:text-white'
                          : 'text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ExternalLink className="size-3.5 opacity-50" />
                    </a>
                  );
                }

                return (
                  <Link
                    key={`${item.label}-${idx}`}
                    to={finalUrl}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ color: navbarTextColor || undefined }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? isDarkNavbar
                          ? 'font-semibold text-white bg-white/15'
                          : 'font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                        : isDarkNavbar
                        ? 'font-medium text-white/80 hover:bg-white/10 hover:text-white'
                        : 'font-medium text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <span
                        style={{ backgroundColor: 'var(--store-primary, #10b981)' }}
                        className="size-1.5 rounded-full"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className={`pt-3 border-t flex flex-col gap-2 ${isDarkNavbar ? 'border-white/10' : 'border-black/10 dark:border-white/10'}`}>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold">
                <span className={isDarkNavbar ? 'text-white/70' : 'text-muted'}>Language / ভাষা:</span>
                <LanguageSwitcher />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openWishlist();
                }}
                style={{ color: navbarTextColor || undefined }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  isDarkNavbar
                    ? 'text-white/85 hover:bg-white/10'
                    : 'text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Heart className={`size-4 ${wishlistItems.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>My Wishlist</span>
                </div>
                {wishlistItems.length > 0 && (
                  <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-xs font-bold font-mono">
                    {wishlistItems.length}
                  </span>
                )}
              </button>

              {config?.whatsapp_ordering_enabled !== false && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  <span>Chat on WhatsApp</span>
                </a>
              )}

              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    promptInstall();
                  }}
                  style={{
                    backgroundColor: 'var(--store-primary, #10b981)',
                    color: 'var(--store-primary-fg, #ffffff)',
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs shadow-sm cursor-pointer"
                >
                  <Smartphone className="size-4" />
                  <span>Install {config?.name || 'Store'} App</span>
                </button>
              )}

              <Link
                to={getStorefrontUrl(subdomain, '/account')}
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: navbarTextColor ? `${navbarTextColor}aa` : undefined }}
                className={`text-center py-2 text-xs font-semibold ${
                  !navbarTextColor ? 'text-slate-600 dark:text-zinc-400' : ''
                } hover:opacity-100`}
              >
                Manage My Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

