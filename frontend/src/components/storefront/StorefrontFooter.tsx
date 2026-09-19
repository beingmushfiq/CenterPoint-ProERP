import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Clock, Store, MessageCircle, Phone, MapPin, Mail, ExternalLink } from 'lucide-react';
import { getContrastColor } from '../../lib/storefront/themeSync';
import type { StorefrontConfig } from '../../types/api/storefront';
import { getStorefrontUrl, normalizeStorefrontPath } from '../../lib/storefront/storefrontUrl';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

interface StorefrontFooterProps {
  config: StorefrontConfig | null;
}

export const StorefrontFooter: React.FC<StorefrontFooterProps> = ({ config }) => {
  const subdomain = config?.subdomain || 'store';
  const whatsappNumber = config?.whatsapp_number?.replace(/[^0-9]/g, '') || '8801700000000';

  const theme = config?.theme;
  const footerBg = theme?.footer_bg;
  const footerTextColor = theme?.footer_text_color;
  const socialLinks = theme?.social_links;
  const customColumns = theme?.footer_columns && theme.footer_columns.length > 0 ? theme.footer_columns : null;

  const isDarkFooter =
    footerTextColor === '#ffffff' ||
    (footerBg ? getContrastColor(footerBg) === '#ffffff' : false);

  const footerDescription =
    theme?.footer_description ||
    config?.meta_description ||
    'Precision engineering and authentic quality direct from manufacturer.';

  const showWhatsapp = theme?.footer_show_whatsapp !== false && config?.whatsapp_ordering_enabled !== false;
  const whatsappLabel = theme?.footer_whatsapp_label || 'WhatsApp Live Chat';

  const contactTitle = theme?.footer_contact_title || 'Factory Support';
  const address = theme?.footer_address ?? 'Central Industrial Zone, Dhaka';
  const phone = theme?.footer_phone ?? (config?.whatsapp_number || '+880 1700-000000');
  const email = theme?.footer_email ?? `orders@${subdomain}.devcenterpoint.com`;

  const showPayments = theme?.footer_show_payments !== false;
  const defaultPaymentMethods = ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'];
  const paymentMethods =
    theme?.footer_payment_methods && theme.footer_payment_methods.length > 0
      ? theme.footer_payment_methods
      : defaultPaymentMethods;

  const currentYear = new Date().getFullYear();
  const defaultCopyright = `© ${currentYear} ${config?.name ?? 'Official Store'}. Powered by DevCenterPoint Factory Platform.`;
  const copyright = theme?.footer_copyright || defaultCopyright;

  const storeName = config?.name ?? 'Official Store';
  const hasStoreInName = /store|storefront/i.test(storeName);

  const defaultColumns = [
    {
      id: 'quick-links',
      title: 'Store Navigation',
      links: [
        { label: 'Hardware Catalog', url: getStorefrontUrl(subdomain, '/products') },
        { label: 'Custom Hardware Lab', url: getStorefrontUrl(subdomain, '/pages/custom-lab') },
        { label: 'Track Shipment', url: getStorefrontUrl(subdomain, '/track') },
        { label: 'My Account', url: getStorefrontUrl(subdomain, '/account') },
      ],
    },
    {
      id: 'company-help',
      title: 'Engineering & Support',
      links: [
        { label: 'The Hardware Manifesto', url: getStorefrontUrl(subdomain, '/pages/about-us') },
        { label: '2-Year Precision Care', url: getStorefrontUrl(subdomain, '/pages/warranty-support') },
        { label: 'Armored Shipping Protocol', url: getStorefrontUrl(subdomain, '/pages/shipping-fulfillment') },
        { label: 'Technical & Codec FAQ', url: getStorefrontUrl(subdomain, '/pages/faq') },
        { label: 'Return Policy', url: getStorefrontUrl(subdomain, '/pages/return-policy') },
      ],
    },
  ];

  const columns = customColumns || defaultColumns;

  const formatFooterUrl = (url: string) => {
    // Normalises any URL: strips /store/:subdomain prefixes, resolves aliases,
    // and returns a clean storefront-relative path (or absolute external URL).
    return normalizeStorefrontPath(subdomain, url);
  };

  return (
    <footer
      style={{
        backgroundColor: footerBg || undefined,
        color: footerTextColor || undefined,
      }}
      className={`mt-20 border-t transition-colors w-full max-w-full overflow-x-hidden ${
        isDarkFooter ? 'border-white/10' : 'border-slate-200 dark:border-zinc-800/80'
      } ${!footerBg ? 'bg-white dark:bg-zinc-950/90 text-slate-600 dark:text-zinc-400' : ''}`}
    >
      {/* Top Value Proposition Grid */}
      <div className="border-b border-black/5 dark:border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-4 shadow-xs backdrop-blur-xs">
              <div
                style={{
                  backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                  borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                  color: 'var(--store-primary, #10b981)',
                }}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
              >
                <Truck className="size-5" />
              </div>
              <div>
                <h4
                  style={{ color: footerTextColor || undefined }}
                  className={`text-xs font-bold ${!footerTextColor ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  24-Hour Express Air Dispatch
                </h4>
                <p className="text-[11px] opacity-75">Direct cleanroom fulfillment with shock-monitored telemetry</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-4 shadow-xs backdrop-blur-xs">
              <div
                style={{
                  backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                  borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                  color: 'var(--store-primary, #10b981)',
                }}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
              >
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4
                  style={{ color: footerTextColor || undefined }}
                  className={`text-xs font-bold ${!footerTextColor ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  2-Year Precision Care
                </h4>
                <p className="text-[11px] opacity-75">Advance cross-shipment with zero deductibles and full repairability</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-4 shadow-xs backdrop-blur-xs">
              <div
                style={{
                  backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                  borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                  color: 'var(--store-primary, #10b981)',
                }}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
              >
                <Clock className="size-5" />
              </div>
              <div>
                <h4
                  style={{ color: footerTextColor || undefined }}
                  className={`text-xs font-bold ${!footerTextColor ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  Direct Engineering Concierge
                </h4>
                <p className="text-[11px] opacity-75">Direct access to acoustic and firmware hardware specialists</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-column Body */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: 'var(--store-primary, #10b981)',
                  color: 'var(--store-primary-fg, #ffffff)',
                }}
                className="flex size-10 items-center justify-center rounded-xl font-bold shadow-md"
              >
                <Store className="size-5 stroke-[2.5]" />
              </div>
              <div>
                <span
                  style={{ color: footerTextColor || undefined }}
                  className={`font-extrabold text-base ${!footerTextColor ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  {storeName}
                </span>
                {!hasStoreInName && (
                  <span
                    style={{
                      backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.15))',
                      borderColor: 'var(--store-primary-border, rgba(16,185,129,0.3))',
                      color: 'var(--store-primary, #10b981)',
                    }}
                    className="ml-2 rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider"
                  >
                    Official Store
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs opacity-80 leading-relaxed max-w-sm">
              {footerDescription}
            </p>

            {/* Direct Social Links & Outreach */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {showWhatsapp && (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                    borderColor: 'var(--store-primary-border, rgba(16,185,129,0.25))',
                    color: 'var(--store-primary, #10b981)',
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-90 transition-all shadow-2xs"
                >
                  <MessageCircle className="size-3.5" />
                  <span>{whatsappLabel}</span>
                </a>
              )}

              {socialLinks?.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all"
                  title="Follow us on Facebook"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              )}

              {socialLinks?.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/20 transition-all"
                  title="Follow us on Instagram"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              )}

              {socialLinks?.youtube && (
                <a
                  href={socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-all"
                  title="Watch our factory channel on YouTube"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              )}

              {socialLinks?.linkedin && (
                <a
                  href={socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-8 items-center justify-center rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-600/20 transition-all"
                  title="Connect on LinkedIn"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Dynamic Footer Columns */}
          {columns.map((col, cIdx) => (
            <div key={`${col.title}-${cIdx}`} className="space-y-3">
              <h4
                style={{ color: footerTextColor || undefined }}
                className={`text-xs font-bold uppercase tracking-wider font-mono ${
                  !footerTextColor ? 'text-slate-900 dark:text-zinc-200' : ''
                }`}
              >
                {col.title}
              </h4>
              <ul className="space-y-2 text-xs">
                {col.links.map((link, idx) => {
                  const isExternal = Boolean((link as { is_external?: boolean }).is_external || link.url.startsWith('http'));
                  const finalUrl = isExternal ? link.url : formatFooterUrl(link.url);

                  if (isExternal) {
                    return (
                      <li key={idx}>
                        <a
                          href={finalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: footerTextColor ? `${footerTextColor}cc` : undefined }}
                          className="inline-flex items-center gap-1 hover:opacity-100 transition-opacity opacity-80"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="size-2.5 opacity-50" />
                        </a>
                      </li>
                    );
                  }

                  return (
                    <li key={idx}>
                      <Link
                        to={finalUrl}
                        style={{ color: footerTextColor ? `${footerTextColor}cc` : undefined }}
                        className="inline-block hover:opacity-100 transition-opacity opacity-80"
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Factory Info / Contact Support */}
          <div className="space-y-3">
            <h4
              style={{ color: footerTextColor || undefined }}
              className={`text-xs font-bold uppercase tracking-wider font-mono ${
                !footerTextColor ? 'text-slate-900 dark:text-zinc-200' : ''
              }`}
            >
              {contactTitle}
            </h4>
            <ul className="space-y-2.5 text-xs opacity-80">
              {address && (
                <li className="flex items-center gap-2">
                  <MapPin
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="size-3.5 shrink-0"
                  />
                  <span>{address}</span>
                </li>
              )}
              {phone && (
                <li className="flex items-center gap-2">
                  <Phone
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="size-3.5 shrink-0"
                  />
                  <span>{phone}</span>
                </li>
              )}
              {email && (
                <li className="flex items-center gap-2">
                  <Mail
                    style={{ color: 'var(--store-primary, #10b981)' }}
                    className="size-3.5 shrink-0"
                  />
                  <span>{email}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Accepted Payment Badges & Copyright */}
        <div className="mt-12 pt-6 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          {showPayments && paymentMethods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono opacity-75">
              <span>Accepted Payments:</span>
              {paymentMethods.map((method, mIdx) => (
                <span
                  key={mIdx}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                >
                  {method}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 sm:ml-auto">
            <LanguageSwitcher />
            <div className="opacity-60 text-[11px]">
              {copyright}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

