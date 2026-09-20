import React, { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  Globe,
  Layout,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  ToggleLeft,
  ToggleRight,
  Truck,
  Menu,
  Megaphone,
  Plus,
  Trash2,
  ExternalLink,
  Ticket,
  Phone,
  MapPin,
  Mail,
  CreditCard,
  MessageCircle,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import type { StorefrontConfig } from '../../types/api/storefront';
import { getStorefrontExternalUrl } from '../../lib/storefront/storefrontUrl';
import { DomainSettingsTab } from './DomainSettingsTab';
import { CouponsTab } from './CouponsTab';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { useCurrency } from '../../hooks/useCurrency';
import { notify } from '../../components/ui/Toast';
import { broadcastThemeDraft } from '../../lib/storefront/themeSync';
import {
  STOREFRONT_THEME_PRESETS,
  type ThemePresetId,
  type ProductCardStyle,
} from '../../lib/storefront/storefrontDesignSystem';

interface PublishedProductItem {
  id: number;
  sku: string;
  name: string;
  category_name?: string;
  brand_name?: string;
  default_sale_price: string;
  is_published: boolean;
  is_featured: boolean;
  price_override?: string | null;
  display_order: number;
}

type StorefrontSettingTab = 'branding' | 'header' | 'footer' | 'products' | 'checkout' | 'coupons' | 'domains';

export const StorefrontSettingsWorkspace: React.FC = () => {
  const { currencyCode } = useCurrency();
  const [activeTab, setActiveTab] = useWorkspaceTab<StorefrontSettingTab>(
    'branding',
    ['branding', 'header', 'footer', 'products', 'checkout', 'coupons', 'domains'] as const
  );
  const [products, setProducts] = useState<PublishedProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverLegalName, setServerLegalName] = useState<string>('');
  const [seoMenuOpen, setSeoMenuOpen] = useState(false);
  const seoMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (seoMenuRef.current && !seoMenuRef.current.contains(event.target as Node)) {
        setSeoMenuOpen(false);
      }
    }
    if (seoMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [seoMenuOpen]);

  // Form State
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    currency: currencyCode,
    theme_preset: 'editorial' as ThemePresetId,
    card_style: 'editorial' as ProductCardStyle,
    logo_mode: 'inherit' as 'inherit' | 'custom',
    logo_url: '',
    primary_color: '#10b981',
    accent_color: '#14b8a6',
    hero_title: '',
    hero_subtitle: '',
    navbar_bg: '#0f172a',
    navbar_text_color: '#ffffff',
    announcement_enabled: false,
    announcement_text: '',
    announcement_bg: '#10b981',
    announcement_text_color: '#ffffff',
    menu_items: [
      { label: 'All Products', url: '/products', is_external: false },
      { label: 'Featured Collections', url: '/products', is_external: false },
    ],
    footer_bg: '#0f172a',
    footer_text_color: '#94a3b8',
    footer_columns: [
      {
        title: 'Explore',
        links: [
          { label: 'All Products', url: '/products' },
          { label: 'Featured Collections', url: '/products' },
        ],
      },
      {
        title: 'Customer Service',
        links: [
          { label: 'Order Tracking', url: '/orders' },
          { label: 'Contact Support', url: '/contact' },
        ],
      },
    ],
    footer_description: '',
    footer_show_whatsapp: true,
    footer_whatsapp_label: 'WhatsApp Live Chat',
    footer_show_payments: true,
    footer_payment_methods: ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'],
    footer_contact_title: 'Factory Support',
    footer_address: 'Central Industrial Zone, Dhaka',
    footer_phone: '+880 1700-000000',
    footer_email: '',
    footer_copyright: '',
    social_links: {
      facebook: '',
      instagram: '',
      linkedin: '',
      youtube: '',
      whatsapp: '',
    },
    meta_pixel_id: '',
    google_analytics_id: '',
    meta_title: '',
    meta_description: '',
    guest_checkout_enabled: true,
    cod_enabled: true,
    online_payment_enabled: true,
    whatsapp_number: '+8801700000000',
    whatsapp_ordering_enabled: true,
    min_order_amount: '',
    status: 'live' as 'draft' | 'live' | 'maintenance' | 'suspended',
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const erpBrandLogo = typeof window !== 'undefined' ? localStorage.getItem('brand_logo_url') : null;

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const res = await api.post<{ url: string; path: string }>('settings/upload-asset', formData);
      if (res?.data?.url) {
        setForm((prev) => ({
          ...prev,
          logo_mode: 'custom',
          logo_url: res.data.url,
        }));
        notify.success('Storefront logo uploaded successfully!');
      }
    } catch {
      // Fallback to FileReader data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        if (dataUri) {
          setForm((prev) => ({
            ...prev,
            logo_mode: 'custom',
            logo_url: dataUri,
          }));
        }
      };
      reader.readAsDataURL(file);
      notify.info('Logo loaded locally. Click Save Settings to persist.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  const addPaymentMethod = (method: string) => {
    const trimmed = method.trim();
    if (!trimmed || form.footer_payment_methods.includes(trimmed)) return;
    setForm((prev) => ({
      ...prev,
      footer_payment_methods: [...prev.footer_payment_methods, trimmed],
    }));
    setNewPaymentMethod('');
  };

  const removePaymentMethod = (methodToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      footer_payment_methods: prev.footer_payment_methods.filter((m) => m !== methodToRemove),
    }));
  };

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([
      api.get<{ data: StorefrontConfig }>('/storefront/settings'),
      api.get<{ data: PublishedProductItem[] }>('/storefront/cms-products'),
    ])
      .then(([settingsRes, prodRes]) => {
        if (!ignore) {
          if (settingsRes.status === 'fulfilled') {
            const settingsPayload = settingsRes.value.data as unknown as Record<string, unknown>;
            const conf = (settingsPayload.data ?? settingsPayload) as StorefrontConfig;

            const resolvedLegal =
              conf.legal_name ||
              (conf.theme as Record<string, unknown>)?.legal_name as string ||
              '';
            setServerLegalName(resolvedLegal);

            setForm({
              name: conf.name ?? '',
              subdomain: conf.subdomain ?? '',
              currency: conf.currency ?? currencyCode,
              theme_preset: ((conf.theme as Record<string, unknown>)?.theme_preset as ThemePresetId) || 'editorial',
              card_style: ((conf.theme as Record<string, unknown>)?.card_style as ProductCardStyle) || 'editorial',
              logo_mode: ((conf.theme as Record<string, unknown>)?.logo_mode as 'inherit' | 'custom') || 'inherit',
              logo_url: ((conf.theme as Record<string, unknown>)?.logo_url as string) || '',
              primary_color: conf.theme?.primary_color ?? '#10b981',
              accent_color: conf.theme?.accent_color ?? '#14b8a6',
              hero_title: conf.theme?.hero_title ?? 'Designed for Excellence, Crafted for Longevity',
              hero_subtitle:
                conf.theme?.hero_subtitle ?? 'Explore curated collections built to the highest commercial standards with direct-to-consumer value.',
              navbar_bg: conf.theme?.navbar_bg ?? '#0f172a',
              navbar_text_color: conf.theme?.navbar_text_color ?? '#ffffff',
              announcement_enabled: conf.theme?.announcement_enabled ?? false,
              announcement_text:
                conf.theme?.announcement_text ?? 'Complimentary shipping on qualifying orders • Direct warranty protection',
              announcement_bg: conf.theme?.announcement_bg ?? '#10b981',
              announcement_text_color: conf.theme?.announcement_text_color ?? '#ffffff',
              menu_items:
                conf.theme?.menu_items && conf.theme.menu_items.length > 0
                  ? conf.theme.menu_items.map((m) => ({
                      label: m.label,
                      url: m.url,
                      is_external: Boolean(m.is_external),
                    }))
                  : [
                      { label: 'Home', url: '/', is_external: false },
                      { label: 'All Products', url: '/products', is_external: false },
                    ],
              footer_bg: conf.theme?.footer_bg ?? '#0f172a',
              footer_text_color: conf.theme?.footer_text_color ?? '#94a3b8',
              footer_columns:
                conf.theme?.footer_columns && conf.theme.footer_columns.length > 0
                  ? conf.theme.footer_columns
                  : [
                      {
                        title: 'Catalogue',
                        links: [
                          { label: 'All Products', url: '/products' },
                          { label: 'New Arrivals', url: '/products' },
                        ],
                      },
                      {
                        title: 'Company',
                        links: [
                          { label: 'About Us', url: '/products' },
                          { label: 'Contact Us', url: '/products' },
                        ],
                      },
                    ],
              footer_description:
                conf.theme?.footer_description ??
                conf.meta_description ??
                'Direct manufacturer of premium infrared cookers, induction plates, and heavy-duty gas stoves with nationwide warranty.',
              footer_show_whatsapp: conf.theme?.footer_show_whatsapp ?? true,
              footer_whatsapp_label: conf.theme?.footer_whatsapp_label ?? 'WhatsApp Live Chat',
              footer_show_payments: conf.theme?.footer_show_payments ?? true,
              footer_payment_methods:
                conf.theme?.footer_payment_methods && conf.theme.footer_payment_methods.length > 0
                  ? conf.theme.footer_payment_methods
                  : ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'],
              footer_contact_title: conf.theme?.footer_contact_title ?? 'Factory Support',
              footer_address: conf.theme?.footer_address ?? 'Central Industrial Zone, Dhaka',
              footer_phone: conf.theme?.footer_phone ?? conf.whatsapp_number ?? '+880 1700-000000',
              footer_email: conf.theme?.footer_email ?? `orders@${conf.subdomain || 'slicemart'}.devcenterpoint.com`,
              footer_copyright:
                conf.theme?.footer_copyright ??
                `© ${new Date().getFullYear()} ${conf.name || 'SliceMart Direct Storefront'}. Powered by DevCenterPoint Factory Platform.`,
              social_links: {
                facebook: conf.theme?.social_links?.facebook ?? '',
                instagram: conf.theme?.social_links?.instagram ?? '',
                linkedin: conf.theme?.social_links?.linkedin ?? '',
                youtube: conf.theme?.social_links?.youtube ?? '',
                whatsapp: conf.theme?.social_links?.whatsapp ?? '',
              },
              meta_pixel_id: conf.theme?.meta_pixel_id ?? '',
              google_analytics_id: conf.theme?.google_analytics_id ?? '',
              meta_title: conf.meta_title ?? '',
              meta_description: conf.meta_description ?? '',
              guest_checkout_enabled: conf.guest_checkout_enabled ?? true,
              cod_enabled: conf.cod_enabled ?? true,
              online_payment_enabled: conf.online_payment_enabled ?? true,
              whatsapp_number: conf.whatsapp_number ?? '+8801700000000',
              whatsapp_ordering_enabled: conf.whatsapp_ordering_enabled ?? true,
              min_order_amount: conf.min_order_amount ? String(conf.min_order_amount) : '',
              status: conf.status ?? 'live',
            });
          }

          if (prodRes.status === 'fulfilled') {
            const prodPayload = prodRes.value.data as unknown;
            const prodList = Array.isArray(prodPayload)
              ? (prodPayload as PublishedProductItem[])
              : (((prodPayload as Record<string, unknown>)?.data as PublishedProductItem[]) ?? []);
            setProducts(prodList);
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load storefront settings', err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [currencyCode]);

  // Real-time live synchronization with open storefront tabs & previews
  useEffect(() => {
    if (!form.subdomain || loading) return;

    broadcastThemeDraft(form.subdomain, {
      primary_color: form.primary_color,
      accent_color: form.accent_color,
      logo_mode: form.logo_mode,
      logo_url: form.logo_url,
      hero_title: form.hero_title,
      hero_subtitle: form.hero_subtitle,
      navbar_bg: form.navbar_bg,
      navbar_text_color: form.navbar_text_color,
      announcement_enabled: form.announcement_enabled,
      announcement_text: form.announcement_text,
      announcement_bg: form.announcement_bg,
      announcement_text_color: form.announcement_text_color,
      menu_items: form.menu_items,
      footer_bg: form.footer_bg,
      footer_text_color: form.footer_text_color,
      footer_columns: form.footer_columns,
      footer_description: form.footer_description,
      footer_show_whatsapp: form.footer_show_whatsapp,
      footer_whatsapp_label: form.footer_whatsapp_label,
      footer_show_payments: form.footer_show_payments,
      footer_payment_methods: form.footer_payment_methods,
      footer_contact_title: form.footer_contact_title,
      footer_address: form.footer_address,
      footer_phone: form.footer_phone,
      footer_email: form.footer_email,
      footer_copyright: form.footer_copyright,
      social_links: form.social_links,
    });
  }, [
    form.subdomain,
    form.primary_color,
    form.accent_color,
    form.logo_mode,
    form.logo_url,
    form.hero_title,
    form.hero_subtitle,
    form.navbar_bg,
    form.navbar_text_color,
    form.announcement_enabled,
    form.announcement_text,
    form.announcement_bg,
    form.announcement_text_color,
    form.menu_items,
    form.footer_bg,
    form.footer_text_color,
    form.footer_columns,
    form.footer_description,
    form.footer_show_whatsapp,
    form.footer_whatsapp_label,
    form.footer_show_payments,
    form.footer_payment_methods,
    form.footer_contact_title,
    form.footer_address,
    form.footer_phone,
    form.footer_email,
    form.footer_copyright,
    form.social_links,
    loading,
  ]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const themePayload = {
        theme_preset: form.theme_preset,
        card_style: form.card_style,
        logo_mode: form.logo_mode,
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        hero_title: form.hero_title,
        hero_subtitle: form.hero_subtitle,
        navbar_bg: form.navbar_bg,
        navbar_text_color: form.navbar_text_color,
        announcement_enabled: form.announcement_enabled,
        announcement_text: form.announcement_text,
        announcement_bg: form.announcement_bg,
        announcement_text_color: form.announcement_text_color,
        menu_items: form.menu_items,
        footer_bg: form.footer_bg,
        footer_text_color: form.footer_text_color,
        footer_columns: form.footer_columns,
        footer_description: form.footer_description,
        footer_show_whatsapp: form.footer_show_whatsapp,
        footer_whatsapp_label: form.footer_whatsapp_label,
        footer_show_payments: form.footer_show_payments,
        footer_payment_methods: form.footer_payment_methods,
        footer_contact_title: form.footer_contact_title,
        footer_address: form.footer_address,
        footer_phone: form.footer_phone,
        footer_email: form.footer_email,
        footer_copyright: form.footer_copyright,
        social_links: form.social_links,
        meta_pixel_id: form.meta_pixel_id,
        google_analytics_id: form.google_analytics_id,
      };

      await api.put('/storefront/settings', {
        name: form.name,
        subdomain: form.subdomain,
        currency: form.currency,
        theme: themePayload,
        meta_title: form.meta_title,
        meta_description: form.meta_description,
        guest_checkout_enabled: form.guest_checkout_enabled,
        cod_enabled: form.cod_enabled,
        online_payment_enabled: form.online_payment_enabled,
        whatsapp_number: form.whatsapp_number,
        whatsapp_ordering_enabled: form.whatsapp_ordering_enabled,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        status: form.status,
      });

      // Sync local storage for instantaneous PWA Manifest & Header updates
      if (form.logo_mode === 'custom' && form.logo_url) {
        localStorage.setItem('storefront_logo_url', form.logo_url);
      } else {
        localStorage.removeItem('storefront_logo_url');
      }
      if (form.name) {
        localStorage.setItem('storefront_name', form.name);
      }

      // Broadcast saved state to all open windows/tabs
      broadcastThemeDraft(form.subdomain, themePayload, 'SAVED');

      notify.success('Storefront configuration saved and synchronized!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      notify.error('Failed to save settings', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProduct = async (product: PublishedProductItem) => {
    const newStatus = !product.is_published;
    try {
      await api.post('/storefront/cms-products/toggle-publish', {
        product_id: product.id,
        is_published: newStatus,
        is_featured: product.is_featured,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_published: newStatus } : p))
      );
      notify.success(
        newStatus
          ? `Published "${product.name}" to storefront.`
          : `Unpublished "${product.name}".`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update publication status';
      notify.error('Failed to update publication status', { description: msg });
    }
  };

  const handleBulkPublishFinished = async () => {
    setSyncing(true);
    try {
      await api.post('/storefront/cms-products/bulk-publish-finished');
      notify.success('All finished products synced and published to storefront!');
      const res = await api.get<{ data: PublishedProductItem[] }>('/storefront/cms-products');
      const prodPayload = res.data as unknown;
      const prodList = Array.isArray(prodPayload)
        ? (prodPayload as PublishedProductItem[])
        : (((prodPayload as Record<string, unknown>)?.data as PublishedProductItem[]) ?? []);
      setProducts(prodList);
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed to sync finished products');
    } finally {
      setSyncing(false);
    }
  };

  // Menu Item Helpers
  const addMenuItem = () => {
    setForm((prev) => ({
      ...prev,
      menu_items: [...prev.menu_items, { label: 'New Link', url: '/products', is_external: false }],
    }));
  };

  const removeMenuItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      menu_items: prev.menu_items.filter((_, i) => i !== index),
    }));
  };

  const updateMenuItem = (index: number, field: 'label' | 'url' | 'is_external', value: unknown) => {
    setForm((prev) => {
      const copy = [...prev.menu_items];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = {
        label: item.label,
        url: item.url,
        is_external: item.is_external,
        [field]: value,
      };
      return { ...prev, menu_items: copy };
    });
  };

  // Footer Column Helpers
  const addFooterColumn = () => {
    setForm((prev) => ({
      ...prev,
      footer_columns: [
        ...prev.footer_columns,
        { title: 'New Column', links: [{ label: 'Link 1', url: '/products' }] },
      ],
    }));
  };

  const removeFooterColumn = (colIdx: number) => {
    setForm((prev) => ({
      ...prev,
      footer_columns: prev.footer_columns.filter((_, i) => i !== colIdx),
    }));
  };

  const updateFooterColumnTitle = (colIdx: number, title: string) => {
    setForm((prev) => {
      const copy = [...prev.footer_columns];
      const col = copy[colIdx];
      if (!col) return prev;
      copy[colIdx] = { title, links: col.links };
      return { ...prev, footer_columns: copy };
    });
  };

  const addFooterLink = (colIdx: number) => {
    setForm((prev) => {
      const copy = [...prev.footer_columns];
      const col = copy[colIdx];
      if (!col) return prev;
      copy[colIdx] = {
        title: col.title,
        links: [...col.links, { label: 'New Link', url: '/products' }],
      };
      return { ...prev, footer_columns: copy };
    });
  };

  const removeFooterLink = (colIdx: number, linkIdx: number) => {
    setForm((prev) => {
      const copy = [...prev.footer_columns];
      const col = copy[colIdx];
      if (!col) return prev;
      copy[colIdx] = {
        title: col.title,
        links: col.links.filter((_, i) => i !== linkIdx),
      };
      return { ...prev, footer_columns: copy };
    });
  };

  const updateFooterLink = (
    colIdx: number,
    linkIdx: number,
    field: 'label' | 'url',
    value: string
  ) => {
    setForm((prev) => {
      const copy = [...prev.footer_columns];
      const col = copy[colIdx];
      if (!col) return prev;
      const link = col.links[linkIdx];
      if (!link) return prev;
      const linksCopy = [...col.links];
      linksCopy[linkIdx] = { ...link, [field]: value };
      copy[colIdx] = { title: col.title, links: linksCopy };
      return { ...prev, footer_columns: copy };
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

      {/* Header & Quick Links */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
        <div>
          <h1 className="text-xl font-bold text-default">Storefront CMS & Customizer</h1>
          <p className="text-xs text-muted mt-1">
            Manage your branded online customer storefront, theme styling, and published products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/storefront/builder"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-xs"
          >
            <Layout className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Page & Block Builder</span>
          </a>

          <div ref={seoMenuRef} className="relative inline-block select-none">
            <button
              type="button"
              onClick={() => setSeoMenuOpen((prev) => !prev)}
              aria-expanded={seoMenuOpen}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 ${
                seoMenuOpen
                  ? 'border-emerald-500 bg-surface-sunken text-emerald-600 dark:text-emerald-400'
                  : 'border-default bg-surface text-default hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span>SEO & Feeds</span>
              <ChevronDown
                className={`size-3 text-muted transition-transform duration-200 ${
                  seoMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seoMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-default bg-surface p-1.5 shadow-xl z-50 text-xs animate-in fade-in-50 zoom-in-95"
                role="menu"
              >
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/sitemap.xml`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/sitemap.xml').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>Sitemap Index (.xml)</span>
                </a>
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/sitemap-categories.xml`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/sitemap-categories.xml').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>Category Sitemap</span>
                </a>
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/sitemap-products.xml`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/sitemap-products.xml').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>Product Sitemap</span>
                </a>
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/sitemap-pages.xml`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/sitemap-pages.xml').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>Pages Sitemap</span>
                </a>
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/robots.txt`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/robots.txt').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>Robots Rules (.txt)</span>
                </a>
                <a
                  href={`${getStorefrontExternalUrl(form.subdomain as string)}/manifest.json`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setSeoMenuOpen(false);
                    void api.get('/storefront/manifest.json').catch(() => {});
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-default transition-colors"
                >
                  <ExternalLink className="size-3.5 text-muted" />
                  <span>PWA Manifest</span>
                </a>
                <a
                  href="/settings/seo"
                  onClick={() => setSeoMenuOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-sunken text-emerald-600 font-medium transition-colors border-t border-default mt-1"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>SEO Workspace &rarr;</span>
                </a>
              </div>
            )}
          </div>

          <a
            href={getStorefrontExternalUrl(form.subdomain as string)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-xs"
          >
            <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Open Live Storefront</span>
          </a>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex overflow-x-auto p-1.5 bg-surface-sunken rounded-2xl border border-default shadow-2xs">
        <div className="flex gap-1.5 min-w-full sm:min-w-0">
          {[
            { id: 'branding', label: 'Branding & Hero Theme', icon: Palette },
            { id: 'header', label: 'Header & Navigation', icon: Menu },
            { id: 'footer', label: 'Footer & Marketing', icon: Megaphone },
            { id: 'products', label: `Product Catalogue Visibility (${products.filter((p) => p.is_published).length}/${products.length})`, icon: Tag },
            { id: 'checkout', label: 'Checkout & Payment Rules', icon: Truck },
            { id: 'coupons', label: 'Coupons & Promo Codes', icon: Ticket },
            { id: 'domains', label: 'Custom Domains & DNS', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs border border-primary'
                    : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary-fg' : 'text-muted'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Customization Form & Theme Presets */}
          <div className="lg:col-span-7 space-y-6">
            {/* Curated Theme Preset Engine */}
            <div className="rounded-2xl border border-default bg-surface p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-default flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <span>Curated Commercial Theme Presets</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Select a world-class, industry-neutral design direction tailored to your brand identity.
                  </p>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  8 Presets
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {(Object.entries(STOREFRONT_THEME_PRESETS) as [ThemePresetId, (typeof STOREFRONT_THEME_PRESETS)[ThemePresetId]][]).map(([key, preset]) => {
                  const isSelected = form.theme_preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          theme_preset: key,
                          primary_color: preset.colors.primary,
                          accent_color: preset.colors.accent,
                          navbar_bg: preset.colors.surface,
                          navbar_text_color: preset.colors.text,
                          footer_bg: preset.colors.surfaceSunken,
                          footer_text_color: preset.colors.textMuted,
                          card_style: preset.cardStyle,
                        }));
                        notify.success(`Switched to "${preset.name}" preset`, {
                          description: `Typography (${preset.typography.headingFont.split(',')[0]?.replace(/['"]/g, '') || 'System'}) and color tokens loaded.`,
                        });
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                          : 'border-default bg-surface-sunken hover:border-default/80 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-default">{preset.name}</span>
                            {isSelected && (
                              <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{preset.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-default/40 text-[10px] text-muted">
                        <span className="font-mono truncate">{preset.typography.headingFont.split(',')[0]?.replace(/['"]/g, '') || 'Sans'}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="size-3.5 rounded-full border border-black/10 shadow-2xs"
                            style={{ backgroundColor: preset.colors.primary }}
                            title={`Primary: ${preset.colors.primary}`}
                          />
                          <span
                            className="size-3.5 rounded-full border border-black/10 shadow-2xs"
                            style={{ backgroundColor: preset.colors.accent }}
                            title={`Accent: ${preset.colors.accent}`}
                          />
                          <span
                            className="size-3.5 rounded-full border border-black/10 shadow-2xs"
                            style={{ backgroundColor: preset.colors.surfaceSunken }}
                            title={`Surface: ${preset.colors.surfaceSunken}`}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Card Style Variant Picker */}
            <div className="rounded-2xl border border-default bg-surface p-6 space-y-4 shadow-xs">
              <div>
                <h2 className="text-sm font-bold text-default flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Default Product Card Display Style</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Choose how products are presented across storefront grids, category pages, and search.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'editorial', label: 'Editorial', desc: 'Serif titles, subtle borders, high-contrast badges' },
                  { id: 'minimal', label: 'Swiss Minimal', desc: 'Flush borders, mono labels, pure typography' },
                  { id: 'commerce', label: 'Modern Commerce', desc: 'Soft rounded corners, prominent quick actions' },
                  { id: 'compact', label: 'Compact Retail', desc: 'Dense grids, tight padding, quick multi-add' },
                  { id: 'horizontal', label: 'Horizontal List', desc: 'Wide row layout, detailed descriptions' },
                  { id: 'b2b', label: 'B2B Wholesale', desc: 'Bulk tier indicators, SKU tags, specs view' },
                ].map((style) => {
                  const isSelected = form.card_style === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, card_style: style.id as ProductCardStyle }))}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-default ring-1 ring-emerald-500/30'
                          : 'border-default bg-surface-sunken text-muted hover:text-default hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold capitalize">{style.label}</span>
                        {isSelected && <span className="size-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-[10px] text-muted line-clamp-2">{style.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Brand Colors & Titles Form */}
            <div className="rounded-2xl border border-default bg-surface p-6 space-y-4 shadow-xs">
              <h2 className="text-sm font-bold text-default flex items-center gap-2">
                <Layout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Storefront Brand Identity & Tokens</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                      Storefront Public Name
                    </label>
                    {serverLegalName && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted">Legal Entity:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {serverLegalName}
                        </span>
                        {form.name !== serverLegalName && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, name: serverLegalName }))}
                            className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
                            title="Set public name to match verified legal entity name"
                          >
                            <RefreshCw className="size-2.5" />
                            Sync with Legal Name
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                    placeholder={serverLegalName || 'Storefront Name'}
                  />
                  {serverLegalName && (
                    <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
                      <ShieldCheck className="size-3 text-emerald-500 inline shrink-0" />
                      Storefront header and footer automatically display and verify{' '}
                      <span className="font-semibold text-default">{serverLegalName}</span>.
                    </p>
                  )}
                </div>

                {/* Storefront Logo & PWA App Icon */}
                <div className="rounded-xl border border-default bg-surface-sunken p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-bold text-default uppercase tracking-wider block">
                        Storefront Brand Logo & PWA App Icon
                      </label>
                      <p className="text-[11px] text-muted mt-0.5">
                        Used in the Storefront header and as the install icon for{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">"{form.name || 'Tenant'} Store"</span> PWA.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      Dual PWA
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logo_mode: 'inherit' }))}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        form.logo_mode === 'inherit'
                          ? 'border-emerald-500 bg-emerald-500/10 text-default ring-1 ring-emerald-500/30'
                          : 'border-default bg-surface text-muted hover:text-default hover:bg-surface-sunken'
                      }`}
                    >
                      <Sparkles className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-default">Inherit ERP Brand Logo</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-semibold">
                            Default
                          </span>
                        </div>
                        <p className="text-[10px] text-muted mt-0.5">
                          Inherits company logo from ERP Settings &gt; General automatically.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logo_mode: 'custom' }))}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        form.logo_mode === 'custom'
                          ? 'border-emerald-500 bg-emerald-500/10 text-default ring-1 ring-emerald-500/30'
                          : 'border-default bg-surface text-muted hover:text-default hover:bg-surface-sunken'
                      }`}
                    >
                      <ImageIcon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-default">Custom Storefront Logo</span>
                        <p className="text-[10px] text-muted mt-0.5">
                          Upload a dedicated retail logo for consumer-facing storefront & PWA.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Logo Preview and File Input */}
                  {form.logo_mode === 'inherit' ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-default/60 bg-surface text-xs text-muted">
                      <div className="size-10 rounded-lg border border-default bg-surface-sunken flex items-center justify-center shrink-0 overflow-hidden p-1">
                        {erpBrandLogo ? (
                          <img src={erpBrandLogo} alt="ERP Brand Logo" className="h-full w-full object-contain" />
                        ) : (
                          <Store className="size-5 text-muted" />
                        )}
                      </div>
                      <div className="text-[11px] leading-tight flex-1">
                        <span className="font-semibold text-default">Current Organization Logo:</span>{' '}
                        {erpBrandLogo ? 'Inherited from ERP General Settings' : 'No ERP logo set (using default store icon)'}
                        <div className="text-[10px] text-muted/80 mt-0.5">
                          Updating your logo in ERP Settings &gt; General automatically rebrands both ERP and Storefront PWAs.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl border border-default bg-surface flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-2xs">
                          {form.logo_url ? (
                            <img src={form.logo_url} alt="Storefront Logo" className="h-full w-full object-contain" />
                          ) : (
                            <Store className="size-6 text-muted" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            value={form.logo_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                            placeholder="https://.../storefront-logo.png"
                            className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-default bg-surface text-[11px] font-medium text-default hover:bg-surface-sunken cursor-pointer transition">
                              <Upload className="size-3 text-muted" />
                              <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo File'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                className="hidden"
                                disabled={uploadingLogo}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleLogoUpload(file);
                                }}
                              />
                            </label>
                            {form.logo_url && (
                              <button
                                type="button"
                                onClick={() => setForm((prev) => ({ ...prev, logo_url: '' }))}
                                className="text-[10px] text-danger hover:underline cursor-pointer"
                              >
                                Clear Logo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      Primary Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                        className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-default">{form.primary_color}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      Store Currency Code
                    </label>
                    <input
                      type="text"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Hero Section Main Headline
                  </label>
                  <input
                    type="text"
                    value={form.hero_title}
                    onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Hero Section Subtitle / Copy
                  </label>
                  <textarea
                    rows={2}
                    value={form.hero_subtitle}
                    onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Mock Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>Dynamic Storefront Preview</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Preset: {STOREFRONT_THEME_PRESETS[form.theme_preset as ThemePresetId]?.name || form.theme_preset}
              </span>
            </div>

            <div className="overflow-hidden rounded-3xl border border-default bg-surface-sunken p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between border-b border-default pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-bold text-xs overflow-hidden"
                    style={{ backgroundColor: form.primary_color }}
                  >
                    {((form.logo_mode === 'custom' && form.logo_url) || erpBrandLogo) ? (
                      <img
                        src={(form.logo_mode === 'custom' && form.logo_url) ? form.logo_url : (erpBrandLogo || '')}
                        alt="Logo"
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-default">{form.name || 'Storefront'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Cart (0)</span>
                </div>
              </div>

              {/* Mock Banner */}
              <div
                className="rounded-2xl p-6 relative overflow-hidden bg-surface border border-default shadow-xs"
                style={{
                  borderLeftColor: form.primary_color,
                  borderLeftWidth: '4px',
                }}
              >
                <div className="relative z-10 space-y-2">
                  <div
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: `${form.primary_color}22`, color: form.primary_color }}
                  >
                    Official Store • Direct Fulfillment
                  </div>
                  <h3 className="text-lg font-bold text-default leading-tight">{form.hero_title}</h3>
                  <p className="text-xs text-muted line-clamp-2">{form.hero_subtitle}</p>
                </div>
              </div>

              {/* Mock Card Preview */}
              <div className="p-4 rounded-2xl bg-surface border border-default space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted uppercase font-bold tracking-wider">Sample Product Card</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-sunken border border-default capitalize text-muted">
                    {form.card_style}
                  </span>
                </div>
                <div className="h-32 rounded-xl bg-surface-sunken border border-dashed border-default flex flex-col items-center justify-center p-3 text-center">
                  <Tag className="size-6 text-muted/50 mb-1" />
                  <span className="text-xs font-semibold text-default">Product Card Display</span>
                  <span className="text-[10px] text-muted">Renders using active preset styling & radius</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Header & Navigation Customizer */}
      {activeTab === 'header' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Controls */}
          <div className="rounded-2xl border border-default bg-surface p-6 space-y-6 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-default flex items-center gap-2">
                <Menu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Header & Navigation Customizer</span>
              </h2>
              <p className="text-xs text-muted mt-1">
                Design your storefront's navigation bar, color palette, announcements, and custom menu links.
              </p>
            </div>

            {/* Navbar Colors */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-xs font-bold text-default block">Navbar Background & Styling</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Navbar Background
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.navbar_bg}
                      onChange={(e) => setForm({ ...form, navbar_bg: e.target.value })}
                      className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.navbar_bg}
                      onChange={(e) => setForm({ ...form, navbar_bg: e.target.value })}
                      className="w-24 rounded-lg border border-default bg-surface px-2.5 py-1 font-mono text-xs text-default uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {['#0f172a', '#000000', '#ffffff', '#064e3b', '#1e293b', '#1e1b4b'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm({ ...form, navbar_bg: hex })}
                        className="size-5 rounded-md border border-default cursor-pointer transition-transform hover:scale-110 shadow-2xs"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Navbar Text & Icons Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.navbar_text_color}
                      onChange={(e) => setForm({ ...form, navbar_text_color: e.target.value })}
                      className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.navbar_text_color}
                      onChange={(e) => setForm({ ...form, navbar_text_color: e.target.value })}
                      className="w-24 rounded-lg border border-default bg-surface px-2.5 py-1 font-mono text-xs text-default uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {['#ffffff', '#0f172a', '#94a3b8', '#f8fafc', '#10b981'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm({ ...form, navbar_text_color: hex })}
                        className="size-5 rounded-md border border-default cursor-pointer transition-transform hover:scale-110 shadow-2xs"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Announcement Top Bar */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-default block">Promotional Announcement Bar</span>
                  <span className="text-[11px] text-muted">A top ribbon highlighting free shipping, factory direct deals, or flash sales.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.announcement_enabled}
                    onChange={(e) => setForm({ ...form, announcement_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {form.announcement_enabled && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      Announcement Message
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 🎉 Free Worldwide Shipping on Orders Over $50 · Direct from the Factory"
                      value={form.announcement_text}
                      onChange={(e) => setForm({ ...form, announcement_text: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                        Ribbon Background
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.announcement_bg}
                          onChange={(e) => setForm({ ...form, announcement_bg: e.target.value })}
                          className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-xs text-default">{form.announcement_bg}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                        Ribbon Text Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.announcement_text_color}
                          onChange={(e) => setForm({ ...form, announcement_text_color: e.target.value })}
                          className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-xs text-default">{form.announcement_text_color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Header Navigation Menu Builder */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-default block">Header Navigation Links</span>
                  <span className="text-[11px] text-muted">Define custom links rendered across the top navigation menu.</span>
                </div>
                <button
                  type="button"
                  onClick={addMenuItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>Add Link</span>
                </button>
              </div>

              <div className="space-y-2">
                {form.menu_items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-default bg-surface"
                  >
                    <input
                      type="text"
                      placeholder="Label (e.g. Shop)"
                      value={item.label}
                      onChange={(e) => updateMenuItem(idx, 'label', e.target.value)}
                      className="w-1/3 rounded-lg border border-default bg-surface-sunken px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="URL (e.g. /products or /contact)"
                      value={item.url}
                      onChange={(e) => updateMenuItem(idx, 'url', e.target.value)}
                      className="flex-1 rounded-lg border border-default bg-surface-sunken px-2.5 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={item.is_external ?? false}
                        onChange={(e) => updateMenuItem(idx, 'is_external', e.target.checked)}
                        className="rounded border-default text-emerald-500 focus:ring-emerald-500"
                      />
                      <ExternalLink className="size-3" />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeMenuItem(idx)}
                      className="p-1 text-muted hover:text-rose-500 cursor-pointer transition-colors"
                      title="Remove link"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Header Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>Live Header & Navbar Preview</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Real-Time Canvas
              </span>
            </div>

            <div className="rounded-2xl border border-default bg-slate-900/5 dark:bg-slate-950 p-4 space-y-4 shadow-sm">
              <div className="rounded-xl overflow-hidden border border-default shadow-md">
                {/* Announcement Preview */}
                {form.announcement_enabled && (
                  <div
                    style={{
                      backgroundColor: form.announcement_bg,
                      color: form.announcement_text_color,
                    }}
                    className="py-2 px-4 text-center text-[11px] font-semibold tracking-wide transition-colors"
                  >
                    {form.announcement_text || 'Announcement Banner Preview'}
                  </div>
                )}

                {/* Navbar Preview */}
                <div
                  style={{
                    backgroundColor: form.navbar_bg,
                    color: form.navbar_text_color,
                  }}
                  className="px-5 py-3.5 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 font-black text-sm tracking-tight">
                      <div
                        className="size-7 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: form.primary_color, color: '#ffffff' }}
                      >
                        {form.name ? form.name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <span>{form.name || 'Storefront Brand'}</span>
                    </div>

                    <div className="hidden md:flex items-center gap-4 text-xs font-medium opacity-90">
                      {form.menu_items.map((m, i) => (
                        <span
                          key={i}
                          className="hover:opacity-100 cursor-pointer transition-opacity"
                        >
                          {m.label || 'Link'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block w-36 px-2.5 py-1 rounded-lg bg-white/10 text-[10px] opacity-70">
                      Search catalog...
                    </div>
                    <div
                      className="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                      style={{ backgroundColor: form.primary_color, color: '#ffffff' }}
                    >
                      <ShoppingBag className="size-3.5" />
                      <span>Cart (0)</span>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-100 dark:bg-slate-900/80 text-center space-y-2">
                  <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                    STOREFRONT BODY CONTENT
                  </div>
                  <h3 className="text-sm font-bold text-default">{form.hero_title || 'Hero Title'}</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">{form.hero_subtitle}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-default text-[11px] text-muted space-y-1">
                <span className="font-bold text-default block">💡 Customization Tip:</span>
                <p>
                  Any background color you choose here will directly apply to all customer-facing header bars, dropdown menus, and announcement ribbons on both mobile devices and desktop screens.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Footer & Marketing Customizer */}
      {activeTab === 'footer' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Controls */}
          <div className="rounded-2xl border border-default bg-surface p-6 space-y-6 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-default flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Footer & Digital Marketing</span>
              </h2>
              <p className="text-xs text-muted mt-1">
                Customize footer colors, column links, social channels, and ad tracking pixels.
              </p>
            </div>

            {/* Footer Colors */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-xs font-bold text-default block">Footer Color & Tone</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Footer Background
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.footer_bg}
                      onChange={(e) => setForm({ ...form, footer_bg: e.target.value })}
                      className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.footer_bg}
                      onChange={(e) => setForm({ ...form, footer_bg: e.target.value })}
                      className="w-24 rounded-lg border border-default bg-surface px-2.5 py-1 font-mono text-xs text-default uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {['#0f172a', '#090d16', '#18181b', '#022c22', '#1e1b4b', '#f8fafc'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm({ ...form, footer_bg: hex })}
                        className="size-5 rounded-md border border-default cursor-pointer transition-transform hover:scale-110 shadow-2xs"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Footer Text Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.footer_text_color}
                      onChange={(e) => setForm({ ...form, footer_text_color: e.target.value })}
                      className="h-8 w-12 rounded-lg border border-default bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.footer_text_color}
                      onChange={(e) => setForm({ ...form, footer_text_color: e.target.value })}
                      className="w-24 rounded-lg border border-default bg-surface px-2.5 py-1 font-mono text-xs text-default uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {['#94a3b8', '#cbd5e1', '#64748b', '#ffffff', '#0f172a'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm({ ...form, footer_text_color: hex })}
                        className="size-5 rounded-md border border-default cursor-pointer transition-transform hover:scale-110 shadow-2xs"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Bio & Outreach */}
            <div className="space-y-4 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-default">Brand Bio & WhatsApp Button</span>
              </div>
              <p className="text-[11px] text-muted">
                Customize the brand mission/tagline displayed beneath the store logo and configure the WhatsApp Live Chat action.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                  Footer Brand Description / Tagline
                </label>
                <textarea
                  rows={2}
                  placeholder="Direct manufacturer of premium infrared cookers, induction plates, and heavy-duty gas stoves with nationwide warranty."
                  value={form.footer_description}
                  onChange={(e) => setForm({ ...form, footer_description: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-default space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-default block">WhatsApp Live Chat Button</span>
                    <span className="text-[11px] text-muted">Show a direct WhatsApp chat button under the brand description.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, footer_show_whatsapp: !form.footer_show_whatsapp })}
                    className="text-default cursor-pointer"
                  >
                    {form.footer_show_whatsapp ? (
                      <ToggleRight className="size-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="size-6 text-muted" />
                    )}
                  </button>
                </div>

                {form.footer_show_whatsapp && (
                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      WhatsApp Button Label
                    </label>
                    <div className="relative">
                      <MessageCircle className="size-3.5 absolute left-3 top-2.5 text-emerald-500" />
                      <input
                        type="text"
                        placeholder="WhatsApp Live Chat"
                        value={form.footer_whatsapp_label}
                        onChange={(e) => setForm({ ...form, footer_whatsapp_label: e.target.value })}
                        className="w-full pl-8 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Factory Support Details */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-default">Support & Factory Contact Column</span>
              </div>
              <p className="text-[11px] text-muted">
                Set your customer support headline, physical factory/office address, support phone hotline, and support email.
              </p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Section Heading Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Factory Support, Customer Care, Corporate HQ"
                    value={form.footer_contact_title}
                    onChange={(e) => setForm({ ...form, footer_contact_title: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Physical / Factory Address
                  </label>
                  <div className="relative">
                    <MapPin className="size-3.5 absolute left-3 top-2.5 text-muted" />
                    <input
                      type="text"
                      placeholder="e.g. Central Industrial Zone, Dhaka"
                      value={form.footer_address}
                      onChange={(e) => setForm({ ...form, footer_address: e.target.value })}
                      className="w-full pl-8 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      Support Phone / Hotline
                    </label>
                    <div className="relative">
                      <Phone className="size-3.5 absolute left-3 top-2.5 text-muted" />
                      <input
                        type="text"
                        placeholder="e.g. +880 1700-000000"
                        value={form.footer_phone}
                        onChange={(e) => setForm({ ...form, footer_phone: e.target.value })}
                        className="w-full pl-8 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                      Support & Order Email
                    </label>
                    <div className="relative">
                      <Mail className="size-3.5 absolute left-3 top-2.5 text-muted" />
                      <input
                        type="email"
                        placeholder="orders@slicemart.devcenterpoint.com"
                        value={form.footer_email}
                        onChange={(e) => setForm({ ...form, footer_email: e.target.value })}
                        className="w-full pl-8 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Accepted Payments Configuration */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-default block">Accepted Payment Badges</span>
                    <span className="text-[11px] text-muted">Display badges for accepted payment gateways & payment methods.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, footer_show_payments: !form.footer_show_payments })}
                  className="text-default cursor-pointer"
                >
                  {form.footer_show_payments ? (
                    <ToggleRight className="size-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="size-6 text-muted" />
                  )}
                </button>
              </div>

              {form.footer_show_payments && (
                <div className="space-y-3 pt-2">
                  {/* Active Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 min-h-8 p-2.5 rounded-xl border border-default bg-surface">
                    {form.footer_payment_methods.map((method, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-default text-xs font-medium text-default shadow-2xs"
                      >
                        <span>{method}</span>
                        <button
                          type="button"
                          onClick={() => removePaymentMethod(method)}
                          className="text-muted hover:text-rose-500 ml-0.5 cursor-pointer"
                          title="Remove method"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                    {form.footer_payment_methods.length === 0 && (
                      <span className="text-xs text-muted italic">No payment methods added yet.</span>
                    )}
                  </div>

                  {/* Quick Add Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Quick Presets:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['bKash', 'Nagad', 'Rocket', 'Visa / Mastercard', 'Amex', 'Cash on Delivery', 'Bank Transfer'].map((preset) => {
                        const alreadyAdded = form.footer_payment_methods.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => addPaymentMethod(preset)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                              alreadyAdded
                                ? 'opacity-40 border-default bg-surface-sunken cursor-not-allowed'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            + {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Method Add Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add custom method (e.g. Upay, Citytouch)"
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPaymentMethod(newPaymentMethod);
                        }
                      }}
                      className="flex-1 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addPaymentMethod(newPaymentMethod)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Column Navigation */}
            <div className="space-y-4 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-default block">Footer Link Columns</span>
                  <span className="text-[11px] text-muted">Organize quick links, technical catalogs, and policies.</span>
                </div>
                <button
                  type="button"
                  onClick={addFooterColumn}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>Add Column</span>
                </button>
              </div>

              <div className="space-y-3">
                {form.footer_columns.map((col, colIdx) => (
                  <div key={colIdx} className="p-3.5 rounded-xl border border-default bg-surface space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={col.title}
                        placeholder="Column Title (e.g. Products)"
                        onChange={(e) => updateFooterColumnTitle(colIdx, e.target.value)}
                        className="flex-1 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-xs font-bold text-default focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => addFooterLink(colIdx)}
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="size-3" /> Add Link
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFooterColumn(colIdx)}
                        className="p-1 text-muted hover:text-rose-500 cursor-pointer"
                        title="Remove column"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                      {col.links.map((lnk, lnkIdx) => (
                        <div key={lnkIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Label"
                            value={lnk.label}
                            onChange={(e) => updateFooterLink(colIdx, lnkIdx, 'label', e.target.value)}
                            className="w-1/3 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs text-default"
                          />
                          <input
                            type="text"
                            placeholder="URL"
                            value={lnk.url}
                            onChange={(e) => updateFooterLink(colIdx, lnkIdx, 'url', e.target.value)}
                            className="flex-1 rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs text-default font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeFooterLink(colIdx, lnkIdx)}
                            className="p-1 text-muted hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Copyright & Platform Notice */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-default">Copyright & Platform Attribution</span>
              </div>
              <p className="text-[11px] text-muted">
                Customize the legal copyright line and platform attribution shown at the bottom right of the storefront footer.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                  Copyright & Attribution Notice
                </label>
                <input
                  type="text"
                  placeholder={`© ${new Date().getFullYear()} ${form.name || 'Storefront'}. Powered by DevCenterPoint Factory Platform.`}
                  value={form.footer_copyright}
                  onChange={(e) => setForm({ ...form, footer_copyright: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  Leave blank to automatically use the standard copyright line with your store name and the current year.
                </span>
              </div>
            </div>

            {/* Social Media & Direct Outreach */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-xs font-bold text-default block">Social Media & Direct Outreach</span>
              <p className="text-[11px] text-muted">Direct customers to your verified social media pages & community channels.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">WhatsApp Sourcing Link</label>
                  <input
                    type="text"
                    placeholder="https://wa.me/..."
                    value={form.social_links.whatsapp}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        social_links: { ...form.social_links, whatsapp: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">Facebook Page</label>
                  <input
                    type="text"
                    placeholder="https://facebook.com/..."
                    value={form.social_links.facebook}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        social_links: { ...form.social_links, facebook: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">Instagram Profile</label>
                  <input
                    type="text"
                    placeholder="https://instagram.com/..."
                    value={form.social_links.instagram}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        social_links: { ...form.social_links, instagram: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">LinkedIn Business Page</label>
                  <input
                    type="text"
                    placeholder="https://linkedin.com/company/..."
                    value={form.social_links.linkedin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        social_links: { ...form.social_links, linkedin: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-default"
                  />
                </div>
              </div>
            </div>

            {/* Digital Marketing & Ad Tracking */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-sunken border border-default">
              <span className="text-xs font-bold text-default block">Digital Marketing & Conversion Tracking</span>
              <p className="text-[11px] text-muted">
                Automatically fire PageView, ViewContent, AddToCart, and Purchase events to maximize ROI on ad campaigns.
              </p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Meta Pixel ID (Facebook Pixel)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789012345"
                    value={form.meta_pixel_id}
                    onChange={(e) => setForm({ ...form, meta_pixel_id: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface px-3.5 py-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-muted mt-0.5 block">
                    Found in Meta Events Manager. Tracks catalog views and retargets cart abandoners on Facebook/Instagram.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                    Google Analytics 4 Measurement ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. G-XXXXXXXXXX"
                    value={form.google_analytics_id}
                    onChange={(e) => setForm({ ...form, google_analytics_id: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface px-3.5 py-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-muted mt-0.5 block">
                    Found in Google Analytics Admin Data Streams. Tracks ecommerce funnel and conversion sources.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Footer Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>Live Footer Canvas Preview</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Real-Time Canvas
              </span>
            </div>

            <div className="rounded-2xl border border-default bg-slate-900/5 dark:bg-slate-950 p-4 space-y-4 shadow-sm">
              <div
                style={{
                  backgroundColor: form.footer_bg,
                  color: form.footer_text_color,
                }}
                className="rounded-xl overflow-hidden p-6 space-y-6 transition-colors shadow-md border border-white/5"
              >
                {/* Brand & Bio */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="size-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{ backgroundColor: form.primary_color, color: '#ffffff' }}
                    >
                      {form.name ? form.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{form.name || 'Storefront Brand'}</h4>
                      <p className="text-[11px] opacity-75 line-clamp-1 max-w-xs">{form.footer_description || 'Direct Factory Production & Sourcing'}</p>
                    </div>
                  </div>

                  {/* Social & WhatsApp Live Chat */}
                  <div className="flex flex-wrap items-center gap-2">
                    {form.footer_show_whatsapp && (
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 shadow-2xs">
                        <MessageCircle className="size-3" />
                        <span>{form.footer_whatsapp_label || 'WhatsApp Live Chat'}</span>
                      </div>
                    )}
                    {['FB', 'IG', 'IN', 'YT'].map((s) => (
                      <div
                        key={s}
                        className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/80"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Columns & Support */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
                  {form.footer_columns.map((col, i) => (
                    <div key={i} className="space-y-2">
                      <h5 className="font-bold text-white tracking-wider text-[11px] uppercase font-mono">
                        {col.title || 'Column'}
                      </h5>
                      <ul className="space-y-1 opacity-80 text-[11px]">
                        {col.links.map((lnk, j) => (
                          <li key={j} className="hover:opacity-100 cursor-pointer">
                            {lnk.label || 'Link'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Live Support Box */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-white tracking-wider text-[11px] uppercase font-mono">
                      {form.footer_contact_title || 'Factory Support'}
                    </h5>
                    <ul className="space-y-1.5 opacity-80 text-[11px]">
                      {form.footer_address && (
                        <li className="flex items-center gap-1.5">
                          <MapPin className="size-3 shrink-0 text-emerald-400" />
                          <span className="truncate">{form.footer_address}</span>
                        </li>
                      )}
                      {form.footer_phone && (
                        <li className="flex items-center gap-1.5">
                          <Phone className="size-3 shrink-0 text-emerald-400" />
                          <span>{form.footer_phone}</span>
                        </li>
                      )}
                      {form.footer_email && (
                        <li className="flex items-center gap-1.5">
                          <Mail className="size-3 shrink-0 text-emerald-400" />
                          <span className="truncate">{form.footer_email}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Bottom: Payments & Copyright */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px]">
                  {form.footer_show_payments && form.footer_payment_methods.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 opacity-80">
                      <span className="font-mono text-white/60">Payments:</span>
                      {form.footer_payment_methods.map((p, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="opacity-60 sm:ml-auto">
                    {form.footer_copyright || `© ${new Date().getFullYear()} ${form.name || 'Storefront'}. Powered by DevCenterPoint Factory Platform.`}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-default text-[11px] text-muted space-y-1">
                <span className="font-bold text-default block">💡 Marketing & Support Tip:</span>
                <p>
                  Every change made here updates your live storefront footer instantly. Customers can contact your factory directly via WhatsApp, phone, or physical visits, and verify your approved payment methods.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Products */}
      {activeTab === 'products' && (
        <div className="rounded-2xl border border-default bg-surface p-6 space-y-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-default">Catalog Product Publication</h2>
              <span className="text-xs text-muted">
                Toggle products on or off to make them available to public online shoppers.
              </span>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={handleBulkPublishFinished}
              className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-bold text-default hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span>{syncing ? 'Syncing...' : 'Sync & Publish All Finished Goods'}</span>
            </button>
          </div>

          <div className="divide-y divide-default overflow-hidden rounded-xl border border-default bg-surface">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 hover:bg-surface-sunken/60 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">{product.sku}</span>
                    <span className="text-xs font-bold text-default">{product.name}</span>
                    {product.category_name && (
                      <span className="rounded-md bg-surface-sunken border border-default px-2 py-0.5 text-[10px] text-muted">
                        {product.category_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                    {form.currency} {parseFloat(product.default_sale_price || '0').toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleToggleProduct(product)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      product.is_published
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600'
                        : 'bg-surface-sunken border border-default text-muted hover:border-emerald-500 hover:text-emerald-600'
                    }`}
                  >
                    {product.is_published ? (
                      <>
                        <ToggleRight className="h-4 w-4" />
                        <span>Live on Store</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" />
                        <span>Unpublished</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Checkout Rules */}
      {activeTab === 'checkout' && (
        <div className="max-w-2xl rounded-2xl border border-default bg-surface p-6 space-y-6 shadow-xs">
          <h2 className="text-sm font-bold text-default flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Checkout Policies & Gateways</span>
          </h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken p-4 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-default">Guest Checkout</div>
                <div className="text-[11px] text-muted">Allow shoppers to place orders without registration</div>
              </div>
              <input
                type="checkbox"
                checked={form.guest_checkout_enabled}
                onChange={(e) => setForm({ ...form, guest_checkout_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-default text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken p-4 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-default">Cash on Delivery (COD)</div>
                <div className="text-[11px] text-muted">Allow customers to pay cash when package is delivered</div>
              </div>
              <input
                type="checkbox"
                checked={form.cod_enabled}
                onChange={(e) => setForm({ ...form, cod_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-default text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken p-4 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-default">Online Payment Gateway</div>
                <div className="text-[11px] text-muted">Enable credit cards and mobile wallets (bKash / Nagad)</div>
              </div>
              <input
                type="checkbox"
                checked={form.online_payment_enabled}
                onChange={(e) => setForm({ ...form, online_payment_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-default text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken p-4 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-default">WhatsApp Instant Ordering</div>
                <div className="text-[11px] text-muted">Show 1-tap "Order via WhatsApp" button with cart snapshot on storefront</div>
              </div>
              <input
                type="checkbox"
                checked={form.whatsapp_ordering_enabled}
                onChange={(e) => setForm({ ...form, whatsapp_ordering_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-default text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                WhatsApp Business Phone Number
              </label>
              <input
                type="tel"
                placeholder="+8801700000000"
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                Minimum Order Amount ({form.currency})
              </label>
              <input
                type="number"
                placeholder="Optional (e.g. 100)"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'coupons' && (
        <div className="pt-2">
          <CouponsTab />
        </div>
      )}

      {activeTab === 'domains' && (
        <div className="pt-2">
          <DomainSettingsTab />
        </div>
      )}
    </div>
  );
};
