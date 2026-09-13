import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Store, MessageCircle, Truck, Sparkles, ShieldCheck, Menu, X, ExternalLink } from 'lucide-react';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';
import type { StorefrontConfig } from '../../types/api/storefront';

import { StorefrontThemeToggle } from './StorefrontThemeToggle';

interface StorefrontHeaderProps {
  config: StorefrontConfig | null;
  subdomain: string;
}

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({ config, subdomain }) => {
  const { cart, openDrawer } = useStorefrontCartStore();
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

  interface NavMenuItem {
    label: string;
    url: string;
    is_external?: boolean;
  }

  const customMenuItems = theme?.menu_items && theme.menu_items.length > 0 ? theme.menu_items : null;

  const defaultMenuItems: NavMenuItem[] = [
    { label: 'Hardware Catalog', url: `/store/${subdomain}/products`, is_external: false },
    { label: 'Manifesto', url: `/store/${subdomain}/pages/about-us`, is_external: false },
    { label: 'Custom Lab', url: `/store/${subdomain}/pages/custom-lab`, is_external: false },
    { label: 'Warranty & Care', url: `/store/${subdomain}/pages/warranty-support`, is_external: false },
    { label: 'Track Parcel', url: `/store/${subdomain}/track`, is_external: false },
  ];

  const menuItems: NavMenuItem[] = customMenuItems || defaultMenuItems;

  const whatsappNumber = config?.whatsapp_number?.replace(/[^0-9]/g, '') || '';
  const whatsappMsg = encodeURIComponent(
    config?.whatsapp_default_message ||
      `Hello ${config?.name ?? 'Store'}, I would like to inquire about placing an order.`
  );

  const formatMenuUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith(`/store/${subdomain}`)) return url;
    if (url.startsWith('/')) return `/store/${subdomain}${url}`;
    return `/store/${subdomain}/${url}`;
  };

  return (
    <header className="sticky top-0 z-40 w-full transition-all">
      {/* Top Announcement Ticker Bar */}
      {announcementEnabled && (
        <div
          style={{
            backgroundColor: announcementBg || undefined,
            color: announcementTextColor || undefined,
          }}
          className={`text-[11px] py-1.5 px-4 border-b border-black/10 dark:border-white/10 font-medium select-none shadow-xs transition-colors ${
            !announcementBg ? 'bg-zinc-900 dark:bg-zinc-950 text-zinc-100' : ''
          }`}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] opacity-95">
                {announcementText}
              </span>
            </div>

            <div className="flex items-center gap-4 text-[10px] sm:text-[11px] opacity-90">
              <div className="flex items-center gap-1">
                <Truck className="size-3" />
                <span>Tracked Dispatch</span>
              </div>
              <span className="opacity-40 hidden sm:inline">•</span>
              <div className="hidden sm:flex items-center gap-1">
                <ShieldCheck className="size-3" />
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
        className={`border-b border-slate-200/90 dark:border-zinc-800/80 backdrop-blur-xl transition-colors shadow-xs ${
          !navbarBg ? 'bg-white/95 dark:bg-zinc-950/85' : ''
        }`}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: navbarTextColor || undefined }}
              className="md:hidden p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link
              to={`/store/${subdomain}`}
              className="group flex items-center gap-3 transition-transform active:scale-98 cursor-pointer"
            >
              <div
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="flex size-11 items-center justify-center rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/20 transition-all"
              >
                <Store className="size-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: navbarTextColor || undefined }}
                    className={`font-extrabold tracking-tight text-base sm:text-lg transition-colors ${
                      !navbarTextColor ? 'text-slate-900 dark:text-white' : ''
                    }`}
                  >
                    {config?.name ?? 'Official Store'}
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.15))',
                      borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))',
                      color: 'var(--store-primary, #10b981)',
                    }}
                    className="rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider"
                  >
                    Official Store
                  </span>
                </div>
                <div
                  style={{ color: navbarTextColor ? `${navbarTextColor}aa` : undefined }}
                  className="text-[11px] opacity-75 flex items-center gap-1"
                >
                  <Sparkles className="size-3 text-amber-500 dark:text-amber-400 inline" />
                  <span>Direct Sourcing & Fulfillment</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold">
            {menuItems.map((item, idx) => {
              const isExternal = Boolean(item.is_external || item.url.startsWith('http'));
              const finalUrl = isExternal ? item.url : formatMenuUrl(item.url);

              if (isExternal) {
                return (
                  <a
                    key={`${item.label}-${idx}`}
                    href={finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: navbarTextColor || undefined }}
                    className={`flex items-center gap-1 transition-colors py-1 hover:opacity-80 ${
                      !navbarTextColor ? 'text-slate-700 dark:text-zinc-300' : ''
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
                  className={`transition-colors py-1 hover:opacity-80 ${
                    !navbarTextColor ? 'text-slate-700 dark:text-zinc-300' : ''
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct WhatsApp Ordering */}
            {config?.whatsapp_ordering_enabled !== false && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                  borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                  color: 'var(--store-primary, #10b981)',
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer hover:opacity-90"
                title="Order directly via WhatsApp"
              >
                <MessageCircle className="size-3.5 fill-current/20" />
                <span>WhatsApp Order</span>
              </a>
            )}

            {/* Customer Account */}
            <Link
              to={`/store/${subdomain}/account`}
              style={{ color: navbarTextColor || undefined }}
              className={`hidden lg:inline-block text-xs font-semibold px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 transition-all ${
                !navbarTextColor ? 'text-slate-700 dark:text-zinc-300' : ''
              }`}
            >
              Account
            </Link>

            {/* Theme Toggler (Light / Dark with circular ripple transition) */}
            <StorefrontThemeToggle />

            {/* Cart Trigger with Total Preview (Powered by Primary Accent Color) */}
            <button
              type="button"
              onClick={openDrawer}
              style={{
                backgroundColor: 'var(--store-primary, #10b981)',
                color: 'var(--store-primary-fg, #ffffff)',
              }}
              className="group relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 border border-black/10 dark:border-white/10"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="size-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Cart</span>
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  color: '#ffffff',
                }}
                className="flex size-5 items-center justify-center rounded-full px-1 text-[10px] font-bold font-mono"
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
            className={`md:hidden border-t border-slate-200 dark:border-zinc-800 backdrop-blur-xl px-4 py-4 space-y-3 shadow-lg transition-all animate-in slide-in-from-top-2 ${
              !navbarBg ? 'bg-white/95 dark:bg-zinc-950/95' : ''
            }`}
          >
            <nav className="flex flex-col gap-2">
              {menuItems.map((item, idx) => {
                const isExternal = Boolean(item.is_external || item.url.startsWith('http'));
                const finalUrl = isExternal ? item.url : formatMenuUrl(item.url);

                if (isExternal) {
                  return (
                    <a
                      key={`${item.label}-${idx}`}
                      href={finalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{ color: navbarTextColor || undefined }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                        !navbarTextColor ? 'text-slate-700 dark:text-zinc-200' : ''
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                      !navbarTextColor ? 'text-slate-700 dark:text-zinc-200' : ''
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex flex-col gap-2">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                  borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                  color: 'var(--store-primary, #10b981)',
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border"
              >
                <MessageCircle className="size-4" />
                <span>Chat on WhatsApp</span>
              </a>
              <Link
                to={`/store/${subdomain}/account`}
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: navbarTextColor ? `${navbarTextColor}aa` : undefined }}
                className="text-center py-2 text-xs font-semibold hover:opacity-100"
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

