import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Code,
  ChevronLeft,
  Eye,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Layout,
  Plus,
  Save,
  Store,
  Trash2,
  Sparkles,
  ShoppingBag,
  Award,
  ListOrdered,
  Zap,
  Mail,
  RotateCcw,
  Truck,
  ShieldCheck,
  Flame,
  MessageCircle,
  Pencil,
  ExternalLink,
  Lock,
  X,
  Copy,
  Laptop,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Power,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { notify } from '../../components/ui/Toast';
import { StorefrontThemeToggle } from '../../components/storefront/StorefrontThemeToggle';
import { useAuthStore } from '../../lib/auth/authStore';
import { StorefrontBlockRenderer } from '../../components/storefront/StorefrontBlockRenderer';
import type { StorefrontProduct } from '../../types/api/storefront';
import { getStorefrontExternalUrl } from '../../lib/storefront/storefrontUrl';

export type BlockType =
  | 'hero_banner'
  | 'value_props'
  | 'trending_categories'
  | 'featured_products'
  | 'quality_journey'
  | 'promo_split_banner'
  | 'faq'
  | 'newsletter_vip'
  | 'rich_text'
  | 'custom_html_css';

export interface PageBlock {
  id: string;
  type: BlockType;
  title?: string;
  subtitle?: string;
  badge?: string;
  content?: string;
  html?: string;
  css?: string;
  faqs?: { q: string; a: string }[];
  faqItems?: { q: string; a: string }[];
  cta_text?: string;
  cta_url?: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondary_cta_text?: string;
  secondary_cta_url?: string;
  // Value Props
  items?: { icon?: string; title: string; desc: string }[];
  // Featured Products Catalog
  category_id?: number | null;
  limit?: number;
  show_search?: boolean;
  show_categories?: boolean;
  // Quality Journey
  steps?: { step: string; title: string; desc: string }[];
  // Newsletter
  button_text?: string;
  // Hero Multi-Image Slider
  slides?: {
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
  }[];
  autoplay?: boolean;
  duration?: number;
  [key: string]: unknown;
}

export interface CmsPage {
  id: number;
  title: string;
  slug: string;
  page_type: string;
  meta_title?: string;
  meta_description?: string;
  status: 'draft' | 'published';
  blocks: PageBlock[];
}

export const StorefrontPageBuilderWorkspace: React.FC = () => {
  const tenant = useAuthStore((s) => s.tenant);
  const storeSlug = tenant?.slug || 'store';
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedPage, setSelectedPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [history, setHistory] = useState<PageBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [previewProducts, setPreviewProducts] = useState<StorefrontProduct[]>([]);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [pageToDelete, setPageToDelete] = useState<CmsPage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pageToEdit, setPageToEdit] = useState<CmsPage | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    slug: string;
    status: 'draft' | 'published';
    meta_title: string;
    meta_description: string;
  }>({
    title: '',
    slug: '',
    status: 'published',
    meta_title: '',
    meta_description: '',
  });

  const handleTogglePageStatus = async (page: CmsPage) => {
    const nextStatus = page.status === 'published' ? 'draft' : 'published';
    setTogglingId(page.id);
    // Optimistic update
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, status: nextStatus } : p)));
    if (selectedPage?.id === page.id) {
      setSelectedPage((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }
    try {
      await api.put(`/storefront/cms/pages/${page.id}`, { status: nextStatus });
      notify.success(
        nextStatus === 'published'
          ? `"${page.title}" is now Active (published live)`
          : `"${page.title}" is now Inactive (draft)`
      );
    } catch (err: unknown) {
      // Revert on failure
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, status: page.status } : p)));
      if (selectedPage?.id === page.id) {
        setSelectedPage((prev) => (prev ? { ...prev, status: page.status } : null));
      }
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      notify.error('Failed to change page status', { description: msg });
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenEditPageModal = (page: CmsPage) => {
    setPageToEdit(page);
    setEditForm({
      title: page.title,
      slug: page.slug,
      status: page.status,
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
    });
    setSelectedPage(page);
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageToEdit) return;
    setSavingEdit(true);
    try {
      const res = await api.put<CmsPage>(`/storefront/cms/pages/${pageToEdit.id}`, {
        title: editForm.title,
        slug: editForm.slug,
        status: editForm.status,
        meta_title: editForm.meta_title,
        meta_description: editForm.meta_description,
      });
      const updated = res.data;
      setPages((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      if (selectedPage?.id === updated.id) {
        setSelectedPage((prev) => (prev ? { ...prev, ...updated } : null));
      }
      notify.success(`Page "${updated.title}" updated successfully`);
      setPageToEdit(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update page';
      notify.error('Failed to update page', { description: msg });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeletePage = async () => {
    if (!pageToDelete) return;
    if (pageToDelete.slug === 'home') {
      notify.error('The storefront homepage cannot be deleted');
      setPageToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/storefront/cms/pages/${pageToDelete.id}`);
      const remaining = pages.filter((p) => p.id !== pageToDelete.id);
      setPages(remaining);
      if (selectedPage?.id === pageToDelete.id) {
        const home = remaining.find((p) => p.slug === 'home') ?? remaining[0] ?? null;
        setSelectedPage(home);
      }
      notify.success(`Page "${pageToDelete.title}" deleted successfully`);
      setPageToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete page';
      notify.error('Failed to delete page', { description: msg });
    } finally {
      setDeleting(false);
    }
  };

  const loadPagesAndCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, catsRes, prodsRes] = await Promise.allSettled([
        api.get<CmsPage[]>('/storefront/cms/pages'),
        api.get<{ data: { id: number; name: string }[] }>('/storefront/categories'),
        api.get<{ data: StorefrontProduct[] }>('/storefront/products'),
      ]);

      if (pagesRes.status === 'fulfilled') {
        const list = pagesRes.value.data ?? [];
        setPages(list);
        setSelectedPage((prev) => {
          if (!prev) {
            // Default to homepage if present, or first page
            const home = list.find((p) => p.slug === 'home');
            return home ?? list[0] ?? null;
          }
          return list.find((p) => p.id === prev.id) ?? list[0] ?? null;
        });
      }

      if (catsRes.status === 'fulfilled') {
        const rawCats = catsRes.value.data as unknown;
        const catList = Array.isArray(rawCats)
          ? (rawCats as { id: number; name: string }[])
          : (((rawCats as Record<string, unknown>)?.data as { id: number; name: string }[]) ?? []);
        setCategories(catList);
      }

      if (prodsRes.status === 'fulfilled') {
        const rawProds = prodsRes.value.data as unknown;
        const prodList = Array.isArray(rawProds)
          ? (rawProds as StorefrontProduct[])
          : (((rawProds as Record<string, unknown>)?.data as StorefrontProduct[]) ?? []);
        setPreviewProducts(prodList);
      }
    } catch (err) {
      console.error('Failed to fetch pages or categories', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void loadPagesAndCategories();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadPagesAndCategories]);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await api.post<CmsPage[]>('/storefront/cms/pages/seed-defaults');
      const list = res.data ?? [];
      setPages(list);
      const home = list.find((p) => p.slug === 'home') ?? list[0] ?? null;
      setSelectedPage(home);
      notify.success('Default storefront pages restored', {
        description: 'Homepage and standard factory landing pages are now seeded.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to seed default pages';
      notify.error('Failed to reset defaults', { description: msg });
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateNewPage = async (templateType: string) => {
    let title = 'New Custom Page';
    let slug = 'page-' + Math.random().toString(36).substring(2, 7);
    let blocks: PageBlock[] = [];

    if (templateType === 'home') {
      title = 'Storefront Homepage';
      slug = 'home';
      blocks = [
        {
          id: 'b_hero',
          type: 'hero_banner',
          badge: 'Flagship Release • 2026 Studio Edition',
          title: 'Monolithic Precision. Zero Acoustic Distortion.',
          subtitle: 'Explore professional-grade audio monitoring, reference displays, and CNC-machined mechanical hardware built from solid aerospace billet aluminum.',
          cta_text: 'Configure Flagship',
          cta_url: '#catalog',
          secondary_cta_text: 'The Hardware Manifesto',
          secondary_cta_url: '/pages/about-us',
          settings: {
            slides: [
              {
                id: 'sld_1',
                badge: 'Flagship Release • 2026 Studio Edition',
                title: 'Monolithic Precision. Zero Acoustic Distortion.',
                subtitle: 'Explore professional-grade audio monitoring, reference displays, and CNC-machined mechanical hardware built from solid aerospace billet aluminum.',
                cta_text: 'Configure Flagship',
                cta_url: '#catalog',
                secondary_cta_text: 'The Hardware Manifesto',
                secondary_cta_url: '/pages/about-us',
                desktop_image: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=1800&q=85',
                text_align: 'left',
                overlay_opacity: 40,
              },
              {
                id: 'sld_2',
                badge: 'Precision Workspace • Ultra-Wide OLED',
                title: 'Reference Color Purity. 240Hz Fluidity.',
                subtitle: 'True 10-bit color reproduction with 99.8% DCI-P3 gamut, factory delta-E < 0.8 calibration, and an integrated Thunderbolt 4 unibody dock.',
                cta_text: 'View Reference Display',
                cta_url: '#catalog',
                secondary_cta_text: 'Custom Lab',
                secondary_cta_url: '/pages/custom-lab',
                desktop_image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1800&q=85',
                text_align: 'left',
                overlay_opacity: 45,
              },
              {
                id: 'sld_3',
                badge: 'Tactile Engineering • Hot-Swap Billet 75%',
                title: 'Acoustic Poron Gasket. 6-Layer ENIG Gold.',
                subtitle: 'Machined brass counter-weight, pre-lubed POM stabilizers, and open-source QMK/VIA firmware for complete keystroke authority.',
                cta_text: 'Explore Mechanical',
                cta_url: '#catalog',
                secondary_cta_text: 'Warranty Support',
                secondary_cta_url: '/pages/warranty-support',
                desktop_image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1800&q=85',
                text_align: 'left',
                overlay_opacity: 50,
              },
            ],
            autoplay: true,
            duration: 6000,
          },
        },
        {
          id: 'b_props',
          type: 'value_props',
          title: 'The Hardware Integrity Standard',
          subtitle: 'Engineered for durability, open serviceability, and lasting performance',
          items: [
            { icon: 'shield', title: 'Aerospace Billet 6061-T6', desc: '5-axis CNC machined monolithic unibodies providing structural rigidity and thermal dissipation.' },
            { icon: 'award', title: 'Zero Harmonic Distortion', desc: 'Anechoically tuned acoustic chambers with beryllium drivers delivering flat reference frequency curves.' },
            { icon: 'tool', title: 'Modular Hot-Swap Architecture', desc: 'Zero proprietary glues. Torx-fastened enclosures designed for effortless self-servicing and upgrades.' },
            { icon: 'truck', title: '2-Year Advance Replacement', desc: 'Immediate express cross-shipment before you even return defective units with prepaid return labels.' },
          ],
        },
        {
          id: 'b_categories',
          type: 'trending_categories' as BlockType,
          title: 'Engineered Disciplines',
          subtitle: 'Select a hardware category to inspect specifications and bench test results',
        },
        {
          id: 'b_products',
          type: 'featured_products',
          title: 'Flagship Hardware Catalog',
          subtitle: 'Explore production-run instruments available for immediate cleanroom dispatch.',
          limit: 12,
          show_search: true,
          show_categories: true,
        },
        {
          id: 'b_promo',
          type: 'promo_split_banner',
          badge: 'Founders Edition',
          title: 'Chrono-Amp Titanium Reference Preamp',
          subtitle: 'A limited run of 500 numbered units milled from solid Grade 5 titanium billet with dual ESS Sabre 9038PRO DAC chips and discreet Class-A output.',
          cta_text: 'Reserve Serial Number',
          cta_url: '/pages/custom-lab',
        },
        {
          id: 'b_quality',
          type: 'quality_journey',
          title: 'The 5-Stage Precision Manufacturing Lifecycle',
          subtitle: 'How every unit transforms from raw metallurgical billet to certified acoustic instrument',
          steps: [
            { step: '01', title: 'Monolithic 5-Axis Milling', desc: 'Ingot of 6061-T6 aluminum carved continuously over 4.5 hours with diamond tooling to ±0.01mm tolerance.' },
            { step: '02', title: 'Dual PVD Anodizing', desc: 'Micro-arc electrochemical oxidation followed by physical vapor deposition for indestructible surface hardness.' },
            { step: '03', title: 'SMT Cleanroom Solder', desc: 'High-frequency surface mount soldering under Class 1000 laminar flow using lead-free silver alloy solder.' },
            { step: '04', title: 'Anechoic Chamber Sweep', desc: 'Every driver is measured across a 10Hz to 48kHz acoustic sweep to ensure tight ±0.5dB stereo matching.' },
            { step: '05', title: 'Nitrogen Sealed Dispatch', desc: 'Laser serialized, bagged in nitrogen-purged static barrier foil, and protected by tamper-evident forensic tape.' },
          ],
        },
        {
          id: 'b_spec_visualizer',
          type: 'custom_html_css',
          html: '<div style="background: radial-gradient(circle at 50% 0%, #18181b 0%, #09090b 100%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; padding: 2.5rem; color: #fff; font-family: ui-monospace, monospace;"><div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:1rem;"><div><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;">Real-Time Telemetry Sandbox</span><h3 style="font-size:1.3rem; font-weight:700; margin:0.25rem 0; font-family:sans-serif;">Acoustic Frequency Response & Bit-Perfect Bench</h3></div><span style="font-size:0.75rem; color:#10b981; background:rgba(16,185,129,0.1); padding:0.25rem 0.75rem; border-radius:9999px; border:1px solid rgba(16,185,129,0.2);">Hi-Res Certified 384kHz / 32-Bit</span></div><div style="margin:2rem 0 1rem 0; padding:1.5rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:1rem; text-align:center;"><svg viewBox="0 0 700 140" style="width:100%; max-height:140px; display:block;"><path d="M 0 70 Q 150 68, 250 66 T 450 65 T 600 68 T 700 70" fill="none" stroke="#10b981" stroke-width="3" /><path d="M 0 70 Q 150 68, 250 66 T 450 65 T 600 68 T 700 70 L 700 140 L 0 140 Z" fill="rgba(16,185,129,0.08)" /><line x1="0" y1="70" x2="700" y2="70" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4" /><text x="20" y="30" fill="#71717a" font-size="12">10 Hz</text><text x="330" y="30" fill="#10b981" font-size="12">1 kHz (0.0 dB Ref)</text><text x="630" y="30" fill="#71717a" font-size="12">48 kHz</text></svg></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1.5rem;"><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">THD+N RATIO</div><div style="font-size:1.1rem; font-weight:700; color:#10b981; margin-top:0.25rem;">0.00018%</div><div style="font-size:0.7rem; color:#a1a1aa;">@ 1kHz, 32Ω Load</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">DYNAMIC RANGE</div><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">132.4 dB</div><div style="font-size:0.7rem; color:#a1a1aa;">A-Weighted</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">CHANNEL CROSSTALK</div><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">-128 dB</div><div style="font-size:0.7rem; color:#a1a1aa;">Isolated Ground</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">OUTPUT IMPEDANCE</div><div style="font-size:1.1rem; font-weight:700; color:#10b981; margin-top:0.25rem;">0.12 Ω</div><div style="font-size:0.7rem; color:#a1a1aa;">Near-Zero Damping</div></div></div></div>',
          css: '.spec-box { width: 100%; box-sizing: border-box; }',
        },
        {
          id: 'b_faq',
          type: 'faq',
          title: 'Frequently Asked Questions & Technical Specifications',
          subtitle: 'Everything you need to know about codecs, firmware, advance warranty, and cleanroom delivery.',
          faqs: [
            { q: 'What audio codecs and sampling rates are supported?', a: 'Our DAC and acoustic systems provide bit-perfect hardware decoding for LDAC, aptX HD, aptX Lossless, AAC, and native DSD512 up to 384kHz / 32-bit.' },
            { q: 'Can I remap keys and create macros without installing software?', a: 'Yes! All mechanical hardware runs open-source QMK/VIA firmware. You can customize keymaps, layers, and lighting through any WebHID-compatible browser with zero background bloat.' },
            { q: 'How does the 2-Year Precision Care Advance Replacement work?', a: 'If any hardware defect occurs, we cross-ship a fresh, bench-calibrated replacement via express courier before you even pack the return. Return shipping is 100% covered.' },
            { q: 'How are items packaged for transit?', a: 'Each unit is vacuum-sealed in nitrogen-purged static barrier foil, surrounded by high-density custom molded bamboo-sugarcane armor, and tagged with an external 25G shock indicator.' },
          ],
        },
        {
          id: 'b_vip',
          type: 'newsletter_vip',
          title: 'The Frequency • Private R&D Dispatch',
          subtitle: 'Join 14,000+ sound designers, engineers, and creators. Receive early firmware builds, limited CNC batch drop alerts, and CAD schematics.',
          button_text: 'Join Private R&D',
        },
      ];
    } else if (templateType === 'about') {
      title = 'About Us';
      slug = 'about-us';
      blocks = [
        {
          id: 'b1',
          type: 'hero_banner',
          badge: 'The Hardware Manifesto',
          title: 'Engineered for Permanence. Built Without Compromise.',
          subtitle: 'We reject disposable tech and planned obsolescence. Every enclosure is CNC-milled from solid aerospace-grade aluminum, designed for full repairability, and calibrated to zero-harmonic acoustic standards.',
          cta_text: 'Explore Custom Lab',
          cta_url: '/pages/custom-lab',
          secondary_cta_text: 'Flagship Products',
          secondary_cta_url: '/products',
          settings: {
            slides: [
              {
                id: 'sld_abt_1',
                badge: 'The Hardware Manifesto',
                title: 'Engineered for Permanence. Built Without Compromise.',
                subtitle: 'We reject disposable tech and planned obsolescence. Every enclosure is CNC-milled from solid aerospace-grade aluminum, designed for full repairability, and calibrated to zero-harmonic acoustic standards.',
                cta_text: 'Explore Custom Lab',
                cta_url: '/pages/custom-lab',
                secondary_cta_text: 'Flagship Products',
                secondary_cta_url: '/products',
                desktop_image: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=1800&q=85',
                overlay_opacity: 45,
              },
            ],
            autoplay: false,
          },
        },
        {
          id: 'b2',
          type: 'rich_text',
          title: 'The Architectural Manifesto: Tactile Integrity',
          content: 'Our hardware exists at the intersection of raw material purity and cutting-edge signal engineering.\n\nUnlike consumer electronics sealed with toxic glues and designed to fail after two fiscal quarters, our chassis are fastened with precision Torx screws. Internal boards use standardized ribbon interconnects. Drivers are isolated on silicone dampening rings to eliminate sympathetic chassis resonances.\n\nWhen you hold our hardware, you feel the mass of monolithic metal, the unmistakable tactile feedback of rotary optical encoders, and the quiet confidence of hardware built to outlive its owner.',
        },
        {
          id: 'b3',
          type: 'quality_journey',
          title: 'The Monolithic Lifecycle: From Raw Ingot to Calibrated Instrument',
          subtitle: 'Every unit passes through 5 stages of microscopic verification before dispatch',
          steps: [
            { step: '01', title: '6061-T6 Billet Milling', desc: 'Solid monolithic aerospace blocks carved over 4.5 hours with 5-axis CNC cutters down to ±0.01mm tolerance.' },
            { step: '02', title: 'Dual-Stage PVD Anodizing', desc: 'Electrochemical oxide conversion followed by physical vapor deposition for unmatched surface hardness.' },
            { step: '03', title: 'SMT Cleanroom Solder', desc: 'Lead-free silver alloy solder runs on 6-layer ENIG gold-plated PCBs under Class 1000 laminar flow.' },
            { step: '04', title: 'Anechoic Sweep Calibration', desc: 'Individual microphone and driver frequency response matching inside our soundproof acoustic chamber.' },
            { step: '05', title: 'Thermal & Voltage Burn-In', desc: '48 hours of continuous 60°C thermal cycling and peak power load before final serialization.' },
          ],
        },
        {
          id: 'b4',
          type: 'value_props',
          title: 'Engineering Pillars',
          subtitle: 'Uncompromising standards embedded into every millimeter',
          items: [
            { icon: 'shield', title: '10-Year Part Guarantee', desc: 'Replacement switches, drivers, and chassis panels stocked for a full decade.' },
            { icon: 'tool', title: 'Open-Source QMK/VIA', desc: 'Uncompromised firmware flexibility with zero background bloatware or cloud requirements.' },
            { icon: 'award', title: 'Beryllium Acoustic Drivers', desc: 'Ultra-stiff, ultra-light diaphragm geometry delivering distortion-free frequency response up to 48kHz.' },
            { icon: 'recycle', title: '100% Recycled Alloys', desc: 'Sustainable precision: scrap CNC chips are remelted and forged into next-generation chassis.' },
          ],
        },
        {
          id: 'b5',
          type: 'custom_html_css',
          html: '<div style="background: radial-gradient(circle at 50% 0%, #18181b 0%, #09090b 100%); color: #fff; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); font-family: ui-monospace, monospace;"><div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:1rem;"><div><span style="font-size:0.65rem; font-weight:700; color:#10b981; text-transform:uppercase; letter-spacing:0.1em;">Interactive Architecture Explorer</span><h3 style="font-size:1.25rem; font-weight:700; margin:0; color:#fff; font-family:sans-serif;">Precision Chassis Tolerances & Layering</h3></div><span style="font-size:0.75rem; color:#10b981; background:rgba(16,185,129,0.1); padding:0.25rem 0.75rem; border-radius:9999px; border:1px solid rgba(16,185,129,0.2);">ISO 9001:2015 Verified</span></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1.5rem;"><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 01 • Faceplate</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">±0.008 mm</div><div style="font-size:0.7rem; color:#71717a;">CNC Billet 6061-T6 Aluminum with Bead-Blasted 120-Grit Micro Texture.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 02 • Acoustic Gasket</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">2.8 mm Poron®</div><div style="font-size:0.7rem; color:#71717a;">High-density closed-cell microcellular polyurethane absorbing 98.4% of harmonic bounce.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 03 • Mainboard</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">6-Layer ENIG Gold</div><div style="font-size:0.7rem; color:#71717a;">2oz copper power planes with Kailh hot-swap sockets rated for 50,000+ actuations.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 04 • Weighted Base</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">1,480 Grams</div><div style="font-size:0.7rem; color:#71717a;">Machined solid brass counter-weight with flush-mounted PVD silicone isolation feet.</div></div></div></div>',
        },
        {
          id: 'b6',
          type: 'newsletter_vip',
          title: 'Join the Private Hardware Lab',
          subtitle: 'Receive restricted engineering schematics, early prototype dispatches, and private batch drop notifications.',
          button_text: 'Request Lab Access',
        },
      ];
    } else if (templateType === 'warranty') {
      title = 'Warranty & Rapid Replacement';
      slug = 'warranty-support';
      blocks = [
        {
          id: 'b1',
          type: 'hero_banner',
          badge: 'Advance Hardware Protection',
          title: '2-Year Precision Care & Rapid Replacement',
          subtitle: 'We stand behind every solder joint and machining tolerance. If hardware malfunctions, we cross-ship a replacement before you even pack the return.',
          cta_text: 'Check Serial Warranty',
          cta_url: '#lookup',
          secondary_cta_text: 'Read RMA Protocol',
          secondary_cta_url: '#protocol',
        },
        {
          id: 'b2',
          type: 'value_props',
          title: 'The Concierge Warranty Standard',
          subtitle: 'Zero downtime and no bureaucratic friction',
          items: [
            { icon: 'truck', title: '24-Hour Cross-Shipment', desc: 'Replacement units are dispatched on express air transit prior to receiving defective items.' },
            { icon: 'shield', title: 'Hardware Concierge', desc: 'Direct access to senior firmware and acoustic engineers, not outsourced call centers.' },
            { icon: 'award', title: 'Zero Deductible', desc: 'Zero hidden repair fees, zero deductibles, and prepaid courier return labels included.' },
            { icon: 'tool', title: 'Right-to-Repair Friendly', desc: 'Opening the chassis does not void your warranty. Self-repair guides and parts are freely provided.' },
          ],
        },
        {
          id: 'b3',
          type: 'custom_html_css',
          html: '<div id="lookup" style="background:#09090b; border:1px solid rgba(255,255,255,0.12); border-radius:1.5rem; padding:2rem; color:#fff; font-family:ui-monospace, monospace;"><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase;">Factory Diagnostic & Telemetry Lookup</span><h3 style="font-size:1.25rem; font-weight:700; margin:0.25rem 0 0.5rem 0; font-family:sans-serif;">Verify Your Serial Number</h3><p style="font-size:0.75rem; color:#a1a1aa; margin:0;">Enter the 10-digit laser-etched serial from the backplate of your chassis to view warranty status and calibration logs.</p><div style="display:flex; gap:0.75rem; margin-top:1rem; flex-wrap:wrap;"><input type="text" value="SN-X9-9842-PRO" readonly style="flex:1; min-width:240px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:0.75rem; padding:0.75rem 1rem; color:#fff; font-size:0.85rem;" /><button onclick="alert(\'Telemetry Verified: Serial SN-X9-9842-PRO is Active under 2-Year Precision Care through December 2028.\')" style="background:#10b981; color:#000; font-weight:700; border:none; border-radius:0.75rem; padding:0.75rem 1.5rem; cursor:pointer; font-size:0.85rem;">Check Telemetry</button></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1.5rem;"><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">DEVICE STATUS</div><div style="font-size:0.95rem; font-weight:700; color:#10b981; margin-top:0.25rem;">ACTIVE COVERAGE</div><div style="font-size:0.7rem; color:#a1a1aa;">Valid through 2028</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">MANUFACTURING BATCH</div><div style="font-size:0.95rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">BILLET LOT #049</div><div style="font-size:0.7rem; color:#a1a1aa;">CNC Precision Mill A-3</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">CALIBRATION THD+N</div><div style="font-size:0.95rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">0.00018%</div><div style="font-size:0.7rem; color:#a1a1aa;">Passed Chamber Sweep</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">RAPID RMA STATUS</div><div style="font-size:0.95rem; font-weight:700; color:#10b981; margin-top:0.25rem;">ELIGIBLE (24h)</div><div style="font-size:0.7rem; color:#a1a1aa;">Air Cross-Ship Available</div></div></div></div>',
        },
        {
          id: 'b4',
          type: 'faq',
          title: 'Precision Care & RMA Questions',
          subtitle: 'Clear, transparent answers on coverage, cross-shipments, and firmware recovery',
          faqs: [
            { q: 'What is covered under the 2-Year Precision Care Warranty?', a: 'Everything from internal DAC circuitry, display panel backlights, switch socket fatigue, rotary encoders, and mechanical chassis integrity is covered 100% against defects.' },
            { q: 'How does the 24-Hour Cross-Shipment process work?', a: 'Once our engineering desk verifies your telemetry log, a fresh calibrated replacement is dispatched via express courier with a prepaid return carton for your existing unit.' },
            { q: 'Does modding my keyboard switches or opening the chassis void the warranty?', a: 'No! We encourage user servicing and modding. As long as internal traces are not intentionally damaged, opening your device or swapping components maintains full warranty coverage.' },
            { q: 'How do I download firmware updates and factory calibrations?', a: 'Firmware packages are cryptographically signed and available directly through our web configurator with zero desktop software required.' },
          ],
        },
        {
          id: 'b5',
          type: 'rich_text',
          title: 'The Advance Replacement Protocol',
          content: '1. Diagnostic Telemetry: Check your device serial number above or send an error report to our engineering desk.\n2. Cross-Ship Dispatch: A verified replacement unit is packed in our cleanroom and dispatched via express courier within 24 hours.\n3. Doorstep Handshake: Hand the return unit to the courier in the provided shock-proof return carton. Zero waiting, zero downtime.',
        },
      ];
    } else if (templateType === 'shipping') {
      title = 'Armored Shipping & Logistics';
      slug = 'shipping-fulfillment';
      blocks = [
        {
          id: 'b1',
          type: 'hero_banner',
          badge: 'Armored Global Logistics',
          title: 'Delivered with Surgical Precision',
          subtitle: 'Every instrument is sealed in moisture-barrier foil with calibrated shock sensors and routed via direct air-freight corridors.',
          cta_text: 'Track Active Parcel',
          cta_url: '/track',
          secondary_cta_text: 'Packaging Specs',
          secondary_cta_url: '#specs',
        },
        {
          id: 'b2',
          type: 'value_props',
          title: 'Armored Transit Pillars',
          subtitle: 'Packaging engineered like an aircraft flight recorder',
          items: [
            { icon: 'box', title: 'Impact-Monitored Cartons', desc: 'Integrated 25G shock-indicator labels ensure your instrument suffered zero transit drops.' },
            { icon: 'shield', title: 'Vacuum Nitrogen Packaging', desc: 'Optical components and delicate switches sealed in nitrogen-purged ESD anti-static pouches.' },
            { icon: 'truck', title: 'Direct Air Priority', desc: 'International shipments bypass regional sorting hubs and fly direct to metropolitan hubs.' },
            { icon: 'award', title: 'Tamper-Proof Hologram', desc: 'Void-indicating forensic tape on all carton seams guarantees virgin factory unboxing.' },
          ],
        },
        {
          id: 'b3',
          type: 'quality_journey',
          title: 'The Armored Fulfillment Journey',
          subtitle: 'From cleanroom nitrogen sealing to your desktop setup',
          steps: [
            { step: '01', title: 'ESD Nitrogen Sealing', desc: 'Unit is wiped with isopropyl, grounded, and vacuum-sealed with desiccant in nitrogen-purged foil.' },
            { step: '02', title: 'Custom Molded Pulp Core', desc: 'Encased in high-density recycled fiber armor engineered to absorb 50G drop impacts.' },
            { step: '03', title: 'Shock Sensor Application', desc: 'A tamper-evident 25G g-force impact indicator is affixed to the carton exterior.' },
            { step: '04', title: 'Armored Courier Handover', desc: 'Direct handover to priority air couriers with climate-controlled hold compartments.' },
            { step: '05', title: 'White-Glove Doorstep Delivery', desc: 'Verified signature delivery with courier inspection check before acceptance.' },
          ],
        },
        {
          id: 'b4',
          type: 'faq',
          title: 'Shipping & Delivery Specifications',
          subtitle: 'Everything about dispatch cutoffs, transit times, and packaging seals',
          faqs: [
            { q: 'What is the shock sensor on my carton?', a: 'Every package carries a calibrated 25G impact indicator. If the indicator has turned red upon arrival, document it with the courier and our team will dispatch a replacement immediately.' },
            { q: 'How quickly are orders fulfilled?', a: 'In-stock hardware orders placed before 3:00 PM EST are sealed and dispatched the same day. Custom anodized orders dispatch within 3–5 business days.' },
            { q: 'Do you ship internationally?', a: 'Yes, we ship to over 85 countries with all customs duties, VAT, and brokerage fees calculated and prepaid at checkout.' },
          ],
        },
        {
          id: 'b5',
          type: 'rich_text',
          title: 'Carton Architecture & Environmental Standards',
          content: 'All packaging materials are 100% plastic-free, utilizing high-density bamboo and sugarcane molded pulp cores engineered to withstand extreme hydrostatic pressures and temperature swings from -20°C to 55°C. Every order is fully insured with door-to-door courier tracking.',
        },
      ];
    } else if (templateType === 'custom-lab') {
      title = 'Custom Hardware Lab';
      slug = 'custom-lab';
      blocks = [
        {
          id: 'b1',
          type: 'hero_banner',
          badge: 'Bespoke Studio Hardware',
          title: 'The Custom Hardware Lab',
          subtitle: 'Commission one-of-a-kind CNC anodized finishes, laser vector serialization, and custom-tuned acoustic drivers for your production studio or executive desk.',
          cta_text: 'Open Finish Configurator',
          cta_url: '#configurator',
          secondary_cta_text: 'Explore Catalog',
          secondary_cta_url: '/products',
        },
        {
          id: 'b2',
          type: 'value_props',
          title: 'Bespoke Capabilities',
          subtitle: 'Industrial customization crafted for discerning creators',
          items: [
            { icon: 'tool', title: 'Pantone Billet Anodizing', desc: 'Type III hardcoat electrochemical anodizing tailored to your studio interior palette.' },
            { icon: 'award', title: 'Fiber Laser Vector Etching', desc: 'Sub-micron laser engraving for personalized callsigns, serial numbers, and studio branding.' },
            { icon: 'sliders', title: 'Bespoke Rotary Encoders', desc: 'Choose from knurled brass, fluted titanium, or matte ceramic haptic dials.' },
            { icon: 'code', title: 'Custom Firmware Profiles', desc: 'Factory-flashed QMK keymaps, macro banks, and customized OLED boot animations.' },
          ],
        },
        {
          id: 'b3',
          type: 'custom_html_css',
          html: '<div id="configurator" style="background:#09090b; border:1px solid rgba(255,255,255,0.12); border-radius:1.5rem; padding:2.5rem; color:#fff; font-family:ui-monospace, monospace;"><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase;">Live Anodizing Studio</span><h3 style="font-size:1.3rem; font-weight:700; margin:0.25rem 0; font-family:sans-serif;">Select Monolithic Metal Alloy & Finish</h3><p style="font-size:0.8rem; color:#a1a1aa; margin:0;">Interactive 5-Axis billet rendering with real-time electrolytic pigment visualization.</p><div style="display:flex; gap:0.75rem; margin-top:1rem; flex-wrap:wrap;"><div style="width:36px; height:36px; border-radius:50%; background:#27272a; border:2px solid #10b981; cursor:pointer;" title="Space Titanium (Standard)" onclick="alert(\'Selected Space Titanium (Hardcoat Grade 5)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#09090b; border:2px solid #52525b; cursor:pointer;" title="Deep Obsidian" onclick="alert(\'Selected Deep Obsidian (Dual PVD Black)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#e4e4e7; border:2px solid #52525b; cursor:pointer;" title="Raw Satin Billet" onclick="alert(\'Selected Raw Satin Billet (Clear Anodized)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#d97706; border:2px solid #52525b; cursor:pointer;" title="Cyber Amber" onclick="alert(\'Selected Cyber Amber (Electrolytic Bronze)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#047857; border:2px solid #52525b; cursor:pointer;" title="Nordic Forest" onclick="alert(\'Selected Nordic Forest (Deep Alpine Green)\')"></div></div><div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:2rem; text-align:center; margin-top:1.5rem;"><svg width="220" height="110" viewBox="0 0 220 110" style="margin:0 auto; display:block;"><rect x="10" y="15" width="200" height="80" rx="14" fill="#27272a" stroke="#10b981" stroke-width="2" /><circle cx="180" cy="55" r="18" fill="#18181b" stroke="#71717a" stroke-width="2" /><circle cx="180" cy="55" r="8" fill="#10b981" /><rect x="30" y="35" width="115" height="12" rx="4" fill="#3f3f46" /><rect x="30" y="55" width="85" height="12" rx="4" fill="#3f3f46" /></svg><div style="font-size:0.85rem; font-weight:700; color:#f4f4f5; margin-top:1rem;">Flagship Studio Workstation Chassis • Space Titanium</div><div style="font-size:0.7rem; color:#10b981; margin-top:0.25rem;">Includes Laser-Etched Studio Serial & Flight Case</div></div><div style="display:flex; justify-content:space-around; margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem; font-size:0.75rem; flex-wrap:wrap; gap:0.5rem;"><div><span style="color:#71717a;">ALLOY:</span> <b>6061-T6 Billet</b></div><div><span style="color:#71717a;">TOLERANCE:</span> <b>±0.005 mm</b></div><div><span style="color:#71717a;">LEAD TIME:</span> <b>14 Days</b></div><div><span style="color:#71717a;">SERIAL:</span> <b>1-of-1 Numbered</b></div></div></div>',
        },
        {
          id: 'b4',
          type: 'quality_journey',
          title: 'The Bespoke Commission Roadmap',
          subtitle: 'How we turn your design vision into an heirloom electronic instrument',
          steps: [
            { step: '01', title: 'Aesthetic Consultation', desc: 'Collaborate with our industrial designers to define color codes, dial weights, and engraving vectors.' },
            { step: '02', title: 'CAD Blueprint Approval', desc: 'Review high-precision 3D digital renders and mechanical cross-sections before milling.' },
            { step: '03', title: 'Dedicated CNC Run', desc: 'Single-unit machine tool paths carved with diamond-tipped bits for flawless surface finish.' },
            { step: '04', title: 'Hand Polishing & Anodizing', desc: 'Submerged in custom dye electrolyte baths with micron-level layer thickness verification.' },
            { step: '05', title: 'Serial Certification', desc: 'Individually numbered (e.g. 01/01) and delivered in a custom hardwood flight case.' },
          ],
        },
        {
          id: 'b5',
          type: 'faq',
          title: 'Custom Commission FAQ',
          subtitle: 'Answers on minimum quantities, CAD files, and lead times',
          faqs: [
            { q: 'What is the lead time for bespoke studio hardware?', a: 'Standard custom commissions require 2 to 3 weeks for CAD preparation, dedicated CNC machining, anodizing, and final calibration.' },
            { q: 'Can you engrave custom studio logos or vector art?', a: 'Yes! We accept SVG and DXF vector files for high-resolution fiber laser engraving on the backplate or rotary dial face.' },
            { q: 'Is there a minimum order quantity for custom hardware?', a: 'No. Our lab produces single bespoke 1-of-1 commissions as well as complete multi-workstation deployments for commercial studios.' },
          ],
        },
        {
          id: 'b6',
          type: 'newsletter_vip',
          title: 'Bespoke Commission Queue',
          subtitle: 'Our custom milling runs are limited to 25 units per month. Register your interest to secure an upcoming build slot.',
          button_text: 'Join Commission Waitlist',
        },
      ];
    } else if (templateType === 'faq') {
      title = 'Help & FAQ';
      slug = 'faq';
      blocks = [
        {
          id: 'b1',
          type: 'faq',
          title: 'Frequently Asked Questions & Technical Specifications',
          subtitle: 'Everything you need to know about codecs, firmware, advance warranty, and cleanroom delivery.',
          faqs: [
            {
              q: 'What audio codecs and sampling rates are supported?',
              a: 'Our DAC and acoustic systems provide bit-perfect hardware decoding for LDAC, aptX HD, aptX Lossless, AAC, and native DSD512 up to 384kHz / 32-bit.',
            },
            {
              q: 'Can I remap keys and create macros without installing software?',
              a: 'Yes! All mechanical hardware runs open-source QMK/VIA firmware. You can customize keymaps, layers, and lighting through any WebHID-compatible browser with zero background bloat.',
            },
            {
              q: 'How does the 2-Year Precision Care Advance Replacement work?',
              a: 'If any hardware defect occurs, we cross-ship a fresh, bench-calibrated replacement via express courier before you even pack the return. Return shipping is 100% covered.',
            },
          ],
        },
      ];
    } else if (templateType === 'policy') {
      title = 'Return & Warranty Policy';
      slug = 'return-policy';
      blocks = [
        {
          id: 'b1',
          type: 'rich_text',
          title: '2-Year Precision Care & Replacement Guarantee',
          content: 'If your product arrives damaged, defective, or does not match specifications, contact our customer support team for prompt inspection and 24-hour advance doorstep resolution.',
        },
        {
          id: 'b2',
          type: 'rich_text',
          title: 'Manufacturer Warranty Coverage',
          content: 'All items purchased through our official storefront are backed by our standard warranty. We guarantee authentic parts, dedicated technical support, and responsive customer service.',
        },
      ];
    }

    try {
      const res = await api.post<CmsPage>('/storefront/cms/pages', {
        title,
        slug,
        page_type: templateType,
        status: 'published',
        blocks,
      });

      const newPage = res.data;
      setPages([...pages, newPage]);
      setSelectedPage(newPage);
      notify.success(`Created page "${title}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create page';
      notify.error('Failed to create page', { description: msg });
    }
  };

  const handleSavePage = async (publishStatus?: 'draft' | 'published') => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      const statusToSave = publishStatus ?? selectedPage.status;
      const res = await api.put<CmsPage>(`/storefront/cms/pages/${selectedPage.id}`, {
        title: selectedPage.title,
        slug: selectedPage.slug,
        meta_title: selectedPage.meta_title,
        meta_description: selectedPage.meta_description,
        status: statusToSave,
        blocks: selectedPage.blocks,
      });

      const updated = res.data;
      setSelectedPage(updated);
      setPages(pages.map((p) => (p.id === updated.id ? updated : p)));
      notify.success(`Page "${updated.title}" saved`, {
        description: `Status updated to ${statusToSave}. Changes are live on the storefront.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save page';
      notify.error('Failed to save page', { description: msg });
    } finally {
      setSaving(false);
    }
  };
  const commitBlocksUpdate = (newBlocks: PageBlock[]) => {
    if (!selectedPage) return;
    const currentBlocks = selectedPage.blocks || [];
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentBlocks)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelectedPage({ ...selectedPage, blocks: newBlocks });
  };

  const handleUndo = () => {
    if (!selectedPage || historyIndex < 0) return;
    const prevBlocks = history[historyIndex];
    if (!prevBlocks) return;
    setHistoryIndex(historyIndex - 1);
    setSelectedPage({ ...selectedPage, blocks: prevBlocks });
    notify.info('Undo applied');
  };

  const handleRedo = () => {
    if (!selectedPage || historyIndex >= history.length - 1) return;
    const nextBlocks = history[historyIndex + 1];
    if (!nextBlocks) return;
    setHistoryIndex(historyIndex + 1);
    setSelectedPage({ ...selectedPage, blocks: nextBlocks });
    notify.info('Redo applied');
  };

  const handleDuplicateBlock = (index: number) => {
    if (!selectedPage) return;
    const blocks = [...(selectedPage.blocks || [])];
    const sourceBlock = blocks[index];
    if (!sourceBlock) return;
    const clonedBlock: PageBlock = JSON.parse(JSON.stringify(sourceBlock));
    clonedBlock.id = 'block_' + Math.random().toString(36).substring(2, 9);
    clonedBlock.title = `${sourceBlock.title || 'Section'} (Copy)`;
    blocks.splice(index + 1, 0, clonedBlock);
    commitBlocksUpdate(blocks);
    notify.success(`Duplicated "${sourceBlock.title || sourceBlock.type}"`);
  };

  const handleAddBlock = (type: BlockType | 'trending_categories') => {
    if (!selectedPage) return;
    const newBlock: PageBlock = {
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      type: type as BlockType,
      title:
        type === 'hero_banner'
          ? 'Designed for Excellence, Crafted for Longevity'
          : type === 'featured_products'
          ? 'Featured Collections'
          : type === 'trending_categories'
          ? 'Trending Categories'
          : type === 'value_props'
          ? 'The Quality Standard'
          : type === 'quality_journey'
          ? 'Craftsmanship & Quality Journey'
          : type === 'promo_split_banner'
          ? 'Precision Quality & Direct Value'
          : type === 'newsletter_vip'
          ? 'Stay Connected'
          : type === 'faq'
          ? 'Frequently Asked Questions'
          : 'Custom Content Section',
      ...(type === 'hero_banner'
        ? {
            badge: 'Official Store • Direct Fulfillment',
            subtitle: 'Explore curated collections built to the highest commercial standards with direct-to-consumer value.',
            cta_text: 'Explore Catalog',
            cta_url: '#catalog',
            secondary_cta_text: 'About Us',
            secondary_cta_url: '/pages/about-us',
          }
        : {}),
      ...(type === 'value_props'
        ? {
            items: [
              { icon: 'shield', title: 'Direct Authenticity', desc: 'Manufactured and sourced directly with rigorous inspection.' },
              { icon: 'truck', title: 'Reliable Dispatch', desc: 'Carefully packaged and shipped directly with full order tracking.' },
              { icon: 'award', title: 'Official Guarantee', desc: 'Every order backed by comprehensive customer support and warranty.' },
              { icon: 'message', title: 'Customer Concierge', desc: 'Fast assistance for retail orders, corporate quotes, and support.' },
            ],
          }
        : {}),
      ...(type === 'featured_products'
        ? {
            subtitle: 'Select items below to add directly to your cart.',
            limit: 8,
            show_search: true,
            show_categories: true,
          }
        : {}),
      ...(type === 'trending_categories'
        ? {
            subtitle: 'Browse our specialized departments and product collections',
          }
        : {}),
      ...(type === 'quality_journey'
        ? {
            subtitle: 'Our verified standards and inspection protocol.',
            steps: [
              { step: '01 / SOURCING', title: 'Raw Materials', desc: 'Carefully selected, verified and certified materials.' },
              { step: '02 / ENGINEERING', title: 'Precision Fabrication', desc: 'Constructed according to international safety and quality standards.' },
              { step: '03 / QUALITY CONTROL', title: 'Stress & Thermal Testing', desc: 'Tested in multi-stage quality assurance cycles.' },
              { step: '04 / LOGISTICS', title: 'Factory Direct Dispatch', desc: 'Sealed, serialized, and safely shipped with warranty certificate.' },
            ],
          }
        : {}),
      ...(type === 'promo_split_banner'
        ? {
            badge: 'Direct Value',
            subtitle: 'Engineered for exceptional durability and day-to-day dependability.',
            cta_text: 'View Deals',
            cta_url: '#catalog',
          }
        : {}),
      ...(type === 'newsletter_vip'
        ? {
            subtitle: 'Subscribe for release notes, corporate catalog updates, and exclusive seasonal offerings.',
            button_text: 'Subscribe Now',
          }
        : {}),
      ...(type === 'rich_text' ? { content: 'Enter formatted editorial content here...' } : {}),
      ...(type === 'custom_html_css'
        ? {
            html: '<div class="promo-box"><h3>Special Offering</h3><p>Enjoy seasonal perks on all orders today.</p></div>',
            css: '.promo-box { background: #18181b; color: #fafafa; padding: 24px; border-radius: 12px; text-align: center; }',
          }
        : {}),
      ...(type === 'faq' ? { faqs: [{ q: 'Sample Question?', a: 'Sample Answer text.' }] } : {}),
    };

    commitBlocksUpdate([...(selectedPage.blocks || []), newBlock]);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!selectedPage) return;
    const blocks = [...(selectedPage.blocks || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;

    const current = blocks[index];
    const target = blocks[targetIdx];
    if (!current || !target) return;

    blocks[index] = target;
    blocks[targetIdx] = current;

    commitBlocksUpdate(blocks);
  };

  const handleDeleteBlock = (index: number) => {
    if (!selectedPage) return;
    const blocks = selectedPage.blocks.filter((_, i) => i !== index);
    commitBlocksUpdate(blocks);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const hasHomePage = pages.some((p) => p.slug === 'home');

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a
              href="/storefront"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-default transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to Storefront CMS</span>
            </a>
          </div>
          <h1 className="text-xl font-bold text-default flex items-center gap-2">
            <Layout className="h-5 w-5 text-emerald-500" />
            <span>Storefront Page & Section Builder</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Visually customize, reorder, and publish your Homepage, catalog displays, hero banners, and marketing sections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Light/Dark Mode Theme Toggler */}
          <StorefrontThemeToggle />

          {/* Reset / Seed Defaults button */}
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedDefaults}
            title="Reset or restore standard factory preset pages"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-default hover:border-emerald-500/50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 text-muted ${seeding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{seeding ? 'Resetting...' : 'Restore Defaults'}</span>
          </button>

          {/* Undo / Redo History */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={historyIndex < 0}
              onClick={handleUndo}
              title="Undo recent block change"
              className="inline-flex items-center justify-center rounded-xl border border-default bg-surface p-2 text-xs font-semibold text-muted hover:text-default disabled:opacity-30 cursor-pointer shadow-2xs transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              title="Redo block change"
              className="inline-flex items-center justify-center rounded-xl border border-default bg-surface p-2 text-xs font-semibold text-muted hover:text-default disabled:opacity-30 cursor-pointer shadow-2xs transition-colors"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <a
            href="/storefront"
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-2xs"
          >
            <Store className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Settings</span>
          </a>

          <button
            type="button"
            onClick={() => setPreviewMode(previewMode === 'edit' ? 'preview' : 'edit')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:text-primary transition-all cursor-pointer shadow-2xs"
          >
            <Eye className="h-3.5 w-3.5 text-emerald-500" />
            <span>{previewMode === 'edit' ? 'Live Preview' : 'Back to Editor'}</span>
          </button>

          <button
            type="button"
            disabled={saving || !selectedPage}
            onClick={() => handleSavePage('published')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Publish Live'}</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar: Pages Directory & New Templates */}
        <div className="space-y-4 rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Pages & Routes</h3>
            <span className="text-[11px] text-muted font-mono">({pages.length})</span>
          </div>

          <div className="space-y-2">
            {pages.map((p) => {
              const isHome = p.slug === 'home';
              const isSelected = selectedPage?.id === p.id;
              const isPublished = p.status === 'published';
              const isToggling = togglingId === p.id;

              return (
                <div
                  key={p.id}
                  className={`group rounded-xl p-2.5 transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs'
                      : 'bg-surface-sunken/40 border-default hover:bg-surface-sunken/80 hover:border-default/80'
                  }`}
                >
                  {/* Top: Title, Icon, Status Pill (Clickable to select) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPage(p);
                      setPreviewMode('edit');
                    }}
                    className="w-full text-left bg-transparent p-0 border-0 flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isHome ? (
                          <Store className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="size-3.5 text-muted shrink-0" />
                        )}
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-default'
                          }`}
                        >
                          {p.title}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted truncate mt-0.5">
                        {isHome ? '/ (Storefront Home)' : `/pages/${p.slug}`}
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase shrink-0 transition-colors ${
                        isPublished
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      {isHome
                        ? isPublished
                          ? 'LIVE HOME'
                          : 'DRAFT HOME'
                        : isPublished
                        ? 'PUBLISHED'
                        : 'INACTIVE'}
                    </span>
                  </button>

                  {/* Actions Ribbon */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-default/50">
                    {/* Active / Inactive Toggle Button */}
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleTogglePageStatus(p);
                      }}
                      title={isPublished ? 'Click to set Inactive (Draft)' : 'Click to set Active (Publish Live)'}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                        isPublished
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                          : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20'
                      }`}
                    >
                      <Power className={`size-2.5 ${isToggling ? 'animate-spin' : ''}`} />
                      <span>{isToggling ? 'Updating...' : isPublished ? 'Active' : 'Inactive'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* View Live Storefront Page */}
                      <a
                        href={isHome ? getStorefrontExternalUrl(storeSlug) : getStorefrontExternalUrl(storeSlug, `/pages/${p.slug}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View live storefront page in new tab"
                        className="inline-flex items-center justify-center p-1 rounded-md text-muted hover:text-default hover:bg-surface border border-transparent hover:border-default transition-colors cursor-pointer"
                      >
                        <ExternalLink className="size-3" />
                      </a>

                      {/* Edit Page Settings */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditPageModal(p);
                        }}
                        title="Edit page title, slug, and SEO settings"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-muted hover:text-default hover:bg-surface border border-transparent hover:border-default transition-colors cursor-pointer"
                      >
                        <Pencil className="size-2.5 text-primary" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Page */}
                      {isHome ? (
                        <span
                          title="Storefront homepage is protected and cannot be deleted"
                          className="inline-flex items-center justify-center p-1 text-muted/30 cursor-not-allowed"
                        >
                          <Lock className="size-3" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPageToDelete(p);
                          }}
                          title="Delete this page"
                          className="inline-flex items-center justify-center p-1 rounded-md text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3 text-rose-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Create Templates */}
          <div className="border-t border-default pt-4 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              Add Storefront Page
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {!hasHomePage && (
                <button
                  type="button"
                  onClick={() => handleCreateNewPage('home')}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  <Store className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Initialize Homepage</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCreateNewPage('about')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>About Us / Manifesto</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('warranty')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>2-Year Warranty & RMA</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('shipping')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Truck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Armored Shipping Protocol</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('custom-lab')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Custom Hardware Lab</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('faq')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Help / FAQ Page</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('policy')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Return Policy</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('custom')}
                className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken px-2.5 py-2 text-left text-[11px] font-medium text-default hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-muted" />
                <span>Blank Custom Page</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Canvas: Block Reordering & Editor */}
        {selectedPage && previewMode === 'edit' && (
          <div className="space-y-6 lg:col-span-3">
            {/* Page Metadata Card & SEO SERP Preview */}
            <div className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-default gap-3">
                <div className="flex items-center gap-2">
                  {selectedPage.slug === 'home' ? (
                    <Store className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div>
                    <h2 className="text-sm font-bold text-default">{selectedPage.title}</h2>
                    <span className="text-[11px] font-mono text-muted">
                      {selectedPage.slug === 'home' ? '/ (Storefront Home)' : `/pages/${selectedPage.slug}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Toggle Button */}
                  <button
                    type="button"
                    disabled={togglingId === selectedPage.id}
                    onClick={() => void handleTogglePageStatus(selectedPage)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedPage.status === 'published'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                    }`}
                  >
                    <Power className={`size-3 ${togglingId === selectedPage.id ? 'animate-spin' : ''}`} />
                    <span>
                      {togglingId === selectedPage.id
                        ? 'Updating...'
                        : selectedPage.status === 'published'
                        ? 'Status: Active'
                        : 'Status: Inactive'}
                    </span>
                  </button>

                  {/* View Live */}
                  <a
                    href={selectedPage.slug === 'home' ? getStorefrontExternalUrl(storeSlug) : getStorefrontExternalUrl(storeSlug, `/pages/${selectedPage.slug}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default transition-colors"
                  >
                    <ExternalLink className="size-3" />
                    <span className="hidden sm:inline">View Live</span>
                  </a>

                  {/* Delete (non-home only) */}
                  {selectedPage.slug !== 'home' && (
                    <button
                      type="button"
                      onClick={() => setPageToDelete(selectedPage)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={selectedPage.title}
                    onChange={(e) => setSelectedPage({ ...selectedPage, title: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
                    URL Slug
                  </label>
                  <div className="flex items-center rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs">
                    <span className="text-muted">{selectedPage.slug === 'home' ? '/' : '/pages/'}</span>
                    <input
                      type="text"
                      value={selectedPage.slug}
                      readOnly={selectedPage.slug === 'home'}
                      onChange={(e) => setSelectedPage({ ...selectedPage, slug: e.target.value })}
                      className="flex-1 bg-transparent text-default focus:outline-none pl-1 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SEO Meta Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-default">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
                    SEO Meta Title (Browser & Search Snippet)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Next-Gen Modern Appliances"
                    value={selectedPage.meta_title || ''}
                    onChange={(e) => setSelectedPage({ ...selectedPage, meta_title: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
                    SEO Meta Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief 150-160 character summary for search engines..."
                    value={selectedPage.meta_description || ''}
                    onChange={(e) => setSelectedPage({ ...selectedPage, meta_description: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Google Search Live SERP Snippet Preview */}
              <div className="p-4 rounded-xl bg-surface-sunken border border-default space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-muted">Google Search Snippet Preview</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">Live SERP</span>
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-sans truncate">
                  https://store.yourdomain.com › {selectedPage.slug === 'home' ? '' : `pages › `}<span className="font-mono">{selectedPage.slug === 'home' ? '' : selectedPage.slug || 'untitled'}</span>
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  {selectedPage.meta_title || selectedPage.title || 'Page Title — Storefront'}
                </div>
                <div className="text-xs text-muted line-clamp-2">
                  {selectedPage.meta_description ||
                    'Discover authentic collections, commercial-grade products, and direct fulfillment from our verified catalog.'}
                </div>
              </div>
            </div>

            {/* Block Palette Bar */}
            <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-default flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Add E-Commerce Section Block:</span>
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddBlock('hero_banner')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Hero Banner</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('value_props')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <Award className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Value Props</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('trending_categories')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Trending Categories</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('featured_products')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Products Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('quality_journey')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <ListOrdered className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Quality Journey</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('promo_split_banner')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Promo Banner</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('faq')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>FAQ Accordion</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('newsletter_vip')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>VIP Newsletter</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('rich_text')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-muted" />
                  <span>Rich Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('custom_html_css')}
                  className="flex items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-default hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer"
                >
                  <Code className="h-3.5 w-3.5 text-muted" />
                  <span>Sandboxed Code</span>
                </button>
              </div>
            </div>

            {/* Block Stack Canvas */}
            <div className="space-y-4">
              {(selectedPage.blocks || []).map((block, idx) => (
                <div
                  key={block.id || idx}
                  className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-4"
                >
                  {/* Block Header & Reorder Controls */}
                  <div className="flex items-center justify-between border-b border-default pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-sunken border border-default font-mono text-[11px] text-muted font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-default capitalize flex items-center gap-1.5">
                        {block.type === 'hero_banner' && <ImageIcon className="size-3.5 text-emerald-500" />}
                        {block.type === 'value_props' && <Award className="size-3.5 text-purple-500" />}
                        {block.type === 'featured_products' && <ShoppingBag className="size-3.5 text-emerald-500" />}
                        {block.type === 'quality_journey' && <ListOrdered className="size-3.5 text-blue-500" />}
                        {block.type === 'promo_split_banner' && <Zap className="size-3.5 text-amber-500" />}
                        {block.type === 'faq' && <HelpCircle className="size-3.5 text-teal-500" />}
                        {block.type === 'newsletter_vip' && <Mail className="size-3.5 text-rose-500" />}
                        {block.type === 'rich_text' && <FileText className="size-3.5 text-muted" />}
                        {block.type === 'custom_html_css' && <Code className="size-3.5 text-muted" />}
                        <span>{block.type.replace(/_/g, ' ')}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveBlock(idx, 'up')}
                        className="rounded-xl border border-default bg-surface-sunken p-1.5 text-muted hover:text-default disabled:opacity-30 cursor-pointer transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === (selectedPage.blocks || []).length - 1}
                        onClick={() => handleMoveBlock(idx, 'down')}
                        className="rounded-xl border border-default bg-surface-sunken p-1.5 text-muted hover:text-default disabled:opacity-30 cursor-pointer transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateBlock(idx)}
                        className="rounded-xl border border-default bg-surface-sunken p-1.5 text-muted hover:text-default cursor-pointer transition-colors"
                        title="Duplicate Section Block"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(idx)}
                        className="rounded-xl border border-default bg-surface-sunken p-1.5 text-muted hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer ml-1 transition-colors"
                        title="Delete Block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* HERO BANNER & MULTI-IMAGE SLIDER EDIT */}
                  {block.type === 'hero_banner' && (
                    <div className="space-y-4">
                      {/* Global Slider Settings Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-default bg-surface-sunken">
                        <div className="flex items-center gap-4 text-xs font-semibold text-default">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={block.autoplay !== false}
                              onChange={(e) => {
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, autoplay: e.target.checked };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="rounded border-default text-primary focus:ring-0"
                            />
                            <span>Autoplay Slider</span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <span className="text-muted text-[11px]">Interval:</span>
                            <select
                              value={block.duration || 6000}
                              onChange={(e) => {
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, duration: Number(e.target.value) };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
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
                          onClick={() => {
                            const currentSlides = (block.slides && block.slides.length > 0)
                              ? [...block.slides]
                              : [
                                  {
                                    id: 'slide_1',
                                    badge: block.badge || 'Official Store • Direct Fulfillment',
                                    title: block.title || 'Designed for Excellence, Crafted for Longevity',
                                    subtitle: block.subtitle || 'Explore curated collections built to the highest commercial standards.',
                                    cta_text: block.cta_text || 'Explore Catalog',
                                    cta_url: block.cta_url || '#catalog',
                                    secondary_cta_text: block.secondary_cta_text || 'About Us',
                                    secondary_cta_url: block.secondary_cta_url || '/pages/about-us',
                                    desktop_image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
                                    text_align: 'left' as const,
                                    overlay_opacity: 60,
                                  },
                                ];

                            currentSlides.push({
                              id: `slide_${Date.now()}`,
                              badge: 'New Collection • Verified Quality',
                              title: 'Elevate Your Everyday Standards',
                              subtitle: 'Engineered with sustainable materials, precise finishing, and direct fulfillment.',
                              cta_text: 'Shop New Arrivals',
                              cta_url: '#catalog',
                              secondary_cta_text: 'View Story',
                              secondary_cta_url: '/pages/about-us',
                              desktop_image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1600&auto=format&fit=crop',
                              text_align: 'left' as const,
                              overlay_opacity: 60,
                            });

                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, slides: currentSlides };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>Add Slide</span>
                        </button>
                      </div>

                      {/* Slides Cards List */}
                      {(() => {
                        const slidesList = (block.slides && block.slides.length > 0)
                          ? block.slides
                          : [
                              {
                                id: 'slide_1',
                                badge: block.badge || 'Official Store • Direct Fulfillment',
                                title: block.title || 'Designed for Excellence, Crafted for Longevity',
                                subtitle: block.subtitle || 'Explore curated collections built to the highest commercial standards with direct-to-consumer value and official warranty.',
                                cta_text: block.cta_text || 'Explore Catalog',
                                cta_url: block.cta_url || '#catalog',
                                secondary_cta_text: block.secondary_cta_text || 'About Us',
                                secondary_cta_url: block.secondary_cta_url || '/pages/about-us',
                                desktop_image: (block.desktop_image as string) || (block.image_url as string) || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
                                mobile_image: '',
                                text_align: 'left' as const,
                                overlay_opacity: 60,
                              },
                              {
                                id: 'slide_2',
                                badge: 'New Season • Premium Craftsmanship',
                                title: 'Engineered for Performance & Elevated Living',
                                subtitle: 'Discover our latest release of meticulously finished products, created with sustainable materials and verified quality controls.',
                                cta_text: 'Discover New Releases',
                                cta_url: '#catalog',
                                secondary_cta_text: 'View Specs',
                                secondary_cta_url: '/products',
                                desktop_image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1600&auto=format&fit=crop',
                                mobile_image: '',
                                text_align: 'left' as const,
                                overlay_opacity: 65,
                              },
                            ];

                        return (
                          <div className="space-y-3">
                            {slidesList.map((slide, sIdx) => (
                              <div
                                key={slide.id || sIdx}
                                className="p-4 rounded-xl border border-default bg-surface-sunken/60 space-y-3 relative group/slide"
                              >
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
                                    <select
                                      value={slide.text_align || 'left'}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, text_align: e.target.value as 'left' | 'center' | 'right' };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="text-[10px] rounded-lg border border-default bg-surface px-1.5 py-0.5 text-muted"
                                      title="Text Alignment"
                                    >
                                      <option value="left">Left</option>
                                      <option value="center">Center</option>
                                      <option value="right">Right</option>
                                    </select>

                                    {/* Move Slide */}
                                    <button
                                      type="button"
                                      disabled={sIdx === 0}
                                      onClick={() => {
                                        const updated = [...slidesList];
                                        const temp = updated[sIdx - 1];
                                        if (temp && updated[sIdx]) {
                                          updated[sIdx - 1] = updated[sIdx]!;
                                          updated[sIdx] = temp;
                                          const blocks = [...selectedPage.blocks];
                                          blocks[idx] = { ...block, slides: updated };
                                          setSelectedPage({ ...selectedPage, blocks });
                                        }
                                      }}
                                      className="p-1 rounded text-muted hover:text-default disabled:opacity-20 cursor-pointer"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={sIdx === slidesList.length - 1}
                                      onClick={() => {
                                        const updated = [...slidesList];
                                        const temp = updated[sIdx + 1];
                                        if (temp && updated[sIdx]) {
                                          updated[sIdx + 1] = updated[sIdx]!;
                                          updated[sIdx] = temp;
                                          const blocks = [...selectedPage.blocks];
                                          blocks[idx] = { ...block, slides: updated };
                                          setSelectedPage({ ...selectedPage, blocks });
                                        }
                                      }}
                                      className="p-1 rounded text-muted hover:text-default disabled:opacity-20 cursor-pointer"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="size-3" />
                                    </button>

                                    {/* Delete Slide */}
                                    {slidesList.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = slidesList.filter((_, i) => i !== sIdx);
                                          const blocks = [...selectedPage.blocks];
                                          blocks[idx] = { ...block, slides: updated };
                                          setSelectedPage({ ...selectedPage, blocks });
                                        }}
                                        className="p-1 rounded text-muted hover:text-rose-500 cursor-pointer ml-1"
                                        title="Delete Slide"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Slide Content Form */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[9px] uppercase font-bold text-muted block mb-1">Badge Tag</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Official Store • Direct Fulfillment"
                                      value={slide.badge || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, badge: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] uppercase font-bold text-muted block mb-1">Headline</label>
                                    <input
                                      type="text"
                                      placeholder="Headline..."
                                      value={slide.title || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, title: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none font-bold"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] uppercase font-bold text-muted block mb-1">Subtitle</label>
                                  <textarea
                                    rows={2}
                                    placeholder="Supporting subtitle..."
                                    value={slide.subtitle || ''}
                                    onChange={(e) => {
                                      const updated = [...slidesList];
                                      updated[sIdx] = { ...slide, subtitle: e.target.value };
                                      const blocks = [...selectedPage.blocks];
                                      blocks[idx] = { ...block, slides: updated };
                                      setSelectedPage({ ...selectedPage, blocks });
                                    }}
                                    className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                                  />
                                </div>

                                {/* Slide Image & Darkening Overlay */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="sm:col-span-2">
                                    <label className="text-[9px] uppercase font-bold text-muted block mb-1">Desktop Image URL</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="https://images.unsplash.com/..."
                                        value={slide.desktop_image || ''}
                                        onChange={(e) => {
                                          const updated = [...slidesList];
                                          updated[sIdx] = { ...slide, desktop_image: e.target.value };
                                          const blocks = [...selectedPage.blocks];
                                          blocks[idx] = { ...block, slides: updated };
                                          setSelectedPage({ ...selectedPage, blocks });
                                        }}
                                        className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                                      />
                                      {slide.desktop_image && (
                                        <div className="size-8 rounded-lg overflow-hidden border border-default shrink-0 bg-black">
                                          <img src={slide.desktop_image} alt="preview" className="size-full object-cover" />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[9px] uppercase font-bold text-muted">Darkening Overlay</label>
                                      <span className="text-[10px] font-mono text-muted">{slide.overlay_opacity ?? 60}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={10}
                                      max={90}
                                      step={5}
                                      value={slide.overlay_opacity ?? 60}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, overlay_opacity: Number(e.target.value) };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-full accent-primary"
                                    />
                                  </div>
                                </div>

                                {/* CTAs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Primary CTA Text"
                                      value={slide.cta_text || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, cta_text: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-1/2 rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default"
                                    />
                                    <input
                                      type="text"
                                      placeholder="URL (e.g. #catalog)"
                                      value={slide.cta_url || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, cta_url: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-1/2 rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Secondary CTA Text"
                                      value={slide.secondary_cta_text || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, secondary_cta_text: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-1/2 rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default"
                                    />
                                    <input
                                      type="text"
                                      placeholder="URL (e.g. /pages/about)"
                                      value={slide.secondary_cta_url || ''}
                                      onChange={(e) => {
                                        const updated = [...slidesList];
                                        updated[sIdx] = { ...slide, secondary_cta_url: e.target.value };
                                        const blocks = [...selectedPage.blocks];
                                        blocks[idx] = { ...block, slides: updated };
                                        setSelectedPage({ ...selectedPage, blocks });
                                      }}
                                      className="w-1/2 rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* VALUE PROPS EDIT */}
                  {block.type === 'value_props' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-bold text-muted">Value Proposition Pillars</label>
                        <button
                          type="button"
                          onClick={() => {
                            const items = [...(block.items || [])];
                            items.push({ icon: 'flame', title: 'New Highlight', desc: 'Detail benefit description...' });
                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, items };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="size-3" />
                          <span>Add Pillar Card</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(block.items || []).map((item, pIdx) => (
                          <div key={pIdx} className="p-3 rounded-xl border border-default bg-surface-sunken space-y-2 relative">
                            <div className="flex items-center justify-between">
                              <select
                                value={item.icon || 'flame'}
                                onChange={(e) => {
                                  const items = [...(block.items || [])];
                                  items[pIdx] = { ...item, icon: e.target.value };
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, items };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="text-[11px] rounded-lg border border-default bg-surface px-2 py-1 text-default font-mono"
                              >
                                <option value="flame">Flame (Factory)</option>
                                <option value="truck">Truck (Delivery)</option>
                                <option value="shield">Shield (Quality)</option>
                                <option value="message">Message (WhatsApp)</option>
                                <option value="award">Award (Certified)</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  const items = (block.items || []).filter((_, i) => i !== pIdx);
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, items };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="text-muted hover:text-rose-500 cursor-pointer p-1"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.title}
                              placeholder="Title..."
                              onChange={(e) => {
                                const items = [...(block.items || [])];
                                items[pIdx] = { ...item, title: e.target.value };
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, items };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="w-full text-xs font-bold text-default bg-transparent border-b border-default pb-1 focus:outline-none"
                            />
                            <textarea
                              rows={2}
                              value={item.desc}
                              placeholder="Description..."
                              onChange={(e) => {
                                const items = [...(block.items || [])];
                                items[pIdx] = { ...item, desc: e.target.value };
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, items };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="w-full text-[11px] text-muted bg-transparent focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FEATURED PRODUCTS CATALOG EDIT */}
                  {block.type === 'featured_products' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Catalog Section Heading</label>
                          <input
                            type="text"
                            value={block.title || ''}
                            placeholder="e.g. Browse Available Products"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, title: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Catalog Subtitle</label>
                          <input
                            type="text"
                            value={block.subtitle || ''}
                            placeholder="e.g. Select items below to add directly to your cart."
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, subtitle: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Category Filter</label>
                          <select
                            value={block.category_id || ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, category_id: val };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:outline-none"
                          >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Items To Display</label>
                          <input
                            type="number"
                            min={2}
                            max={48}
                            value={block.limit || 8}
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, limit: parseInt(e.target.value) || 8 };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-4 pt-5">
                          <label className="flex items-center gap-1.5 text-xs text-default cursor-pointer">
                            <input
                              type="checkbox"
                              checked={block.show_search !== false}
                              onChange={(e) => {
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, show_search: e.target.checked };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="rounded accent-emerald-500"
                            />
                            <span>Live Search Bar</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-default cursor-pointer">
                            <input
                              type="checkbox"
                              checked={block.show_categories !== false}
                              onChange={(e) => {
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, show_categories: e.target.checked };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="rounded accent-emerald-500"
                            />
                            <span>Category Pills</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QUALITY JOURNEY EDIT */}
                  {block.type === 'quality_journey' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Section Heading</label>
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, title: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Subtitle</label>
                          <input
                            type="text"
                            value={block.subtitle || ''}
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, subtitle: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold text-muted">Steps List</label>
                          <button
                            type="button"
                            onClick={() => {
                              const steps = [...(block.steps || [])];
                              const num = steps.length + 1;
                              steps.push({
                                step: `0${num} / STEP`,
                                title: 'Inspection Stage',
                                desc: 'Details of this stage...',
                              });
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, steps };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="size-3" />
                            <span>Add Step</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {(block.steps || []).map((st, sIdx) => (
                            <div key={sIdx} className="p-3 rounded-xl border border-default bg-surface-sunken space-y-1.5 relative">
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  value={st.step}
                                  placeholder="01 / SOURCING"
                                  onChange={(e) => {
                                    const steps = [...(block.steps || [])];
                                    steps[sIdx] = { ...st, step: e.target.value };
                                    const blocks = [...selectedPage.blocks];
                                    blocks[idx] = { ...block, steps };
                                    setSelectedPage({ ...selectedPage, blocks });
                                  }}
                                  className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const steps = (block.steps || []).filter((_, i) => i !== sIdx);
                                    const blocks = [...selectedPage.blocks];
                                    blocks[idx] = { ...block, steps };
                                    setSelectedPage({ ...selectedPage, blocks });
                                  }}
                                  className="text-muted hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={st.title}
                                placeholder="Step Title"
                                onChange={(e) => {
                                  const steps = [...(block.steps || [])];
                                  steps[sIdx] = { ...st, title: e.target.value };
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, steps };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="w-full text-xs font-bold text-default bg-transparent focus:outline-none"
                              />
                              <textarea
                                rows={2}
                                value={st.desc}
                                placeholder="Description"
                                onChange={(e) => {
                                  const steps = [...(block.steps || [])];
                                  steps[sIdx] = { ...st, desc: e.target.value };
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, steps };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="w-full text-[11px] text-muted bg-transparent focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROMO SPLIT BANNER EDIT */}
                  {block.type === 'promo_split_banner' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Headline</label>
                          <input
                            type="text"
                            value={block.title || ''}
                            placeholder="e.g. Precision Engineering & Thermal Innovation"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, title: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Subtitle</label>
                          <input
                            type="text"
                            value={block.subtitle || ''}
                            placeholder="e.g. High efficiency heating elements direct from factory."
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, subtitle: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Button CTA Text</label>
                          <input
                            type="text"
                            value={block.cta_text || ''}
                            placeholder="e.g. Explore Catalog"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, cta_text: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs text-default"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Button CTA URL</label>
                          <input
                            type="text"
                            value={block.cta_url || ''}
                            placeholder="e.g. #catalog or /store/products"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, cta_url: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs text-default font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FAQ EDIT */}
                  {block.type === 'faq' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          placeholder="FAQ Section Title..."
                          value={block.title || ''}
                          onChange={(e) => {
                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, title: e.target.value };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="w-1/2 rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs text-default font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const faqs = [...(block.faqs || [])];
                            faqs.push({ q: 'New Question?', a: 'Answer description...' });
                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, faqs };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="size-3" />
                          <span>Add FAQ Item</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(block.faqs || []).map((faq, fIdx) => (
                          <div key={fIdx} className="space-y-1.5 rounded-xl border border-default bg-surface-sunken p-3">
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                placeholder="Question..."
                                value={faq.q}
                                onChange={(e) => {
                                  const newFaqs = (block.faqs || []).map((f, i) =>
                                    i === fIdx ? { ...f, q: e.target.value } : f
                                  );
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, faqs: newFaqs };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="w-full bg-transparent text-xs font-bold text-default focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newFaqs = (block.faqs || []).filter((_, i) => i !== fIdx);
                                  const blocks = [...selectedPage.blocks];
                                  blocks[idx] = { ...block, faqs: newFaqs };
                                  setSelectedPage({ ...selectedPage, blocks });
                                }}
                                className="text-muted hover:text-rose-500 cursor-pointer p-1"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              placeholder="Answer description..."
                              value={faq.a}
                              onChange={(e) => {
                                const newFaqs = (block.faqs || []).map((f, i) =>
                                  i === fIdx ? { ...f, a: e.target.value } : f
                                );
                                const blocks = [...selectedPage.blocks];
                                blocks[idx] = { ...block, faqs: newFaqs };
                                setSelectedPage({ ...selectedPage, blocks });
                              }}
                              className="w-full bg-transparent text-xs text-muted focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VIP NEWSLETTER EDIT */}
                  {block.type === 'newsletter_vip' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Club Title</label>
                          <input
                            type="text"
                            value={block.title || ''}
                            placeholder="e.g. Join the VIP Member Club"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, title: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Perk Subtitle</label>
                          <input
                            type="text"
                            value={block.subtitle || ''}
                            placeholder="Get alerts and discounts..."
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, subtitle: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">Button Text</label>
                          <input
                            type="text"
                            value={block.button_text || ''}
                            placeholder="Subscribe"
                            onChange={(e) => {
                              const blocks = [...selectedPage.blocks];
                              blocks[idx] = { ...block, button_text: e.target.value };
                              setSelectedPage({ ...selectedPage, blocks });
                            }}
                            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RICH TEXT EDIT */}
                  {block.type === 'rich_text' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Section Heading..."
                        value={block.title || ''}
                        onChange={(e) => {
                          const blocks = [...selectedPage.blocks];
                          blocks[idx] = { ...block, title: e.target.value };
                          setSelectedPage({ ...selectedPage, blocks });
                        }}
                        className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                      />
                      <textarea
                        rows={4}
                        placeholder="Body content text..."
                        value={block.content || ''}
                        onChange={(e) => {
                          const blocks = [...selectedPage.blocks];
                          blocks[idx] = { ...block, content: e.target.value };
                          setSelectedPage({ ...selectedPage, blocks });
                        }}
                        className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none font-sans"
                      />
                    </div>
                  )}

                  {/* CUSTOM HTML / CSS EDIT */}
                  {block.type === 'custom_html_css' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-mono text-muted block mb-1">
                          Custom HTML (Rendered in Secure Sandbox)
                        </label>
                        <textarea
                          rows={4}
                          value={block.html || ''}
                          onChange={(e) => {
                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, html: e.target.value };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-muted block mb-1">
                          Custom CSS Styles
                        </label>
                        <textarea
                          rows={4}
                          value={block.css || ''}
                          onChange={(e) => {
                            const blocks = [...selectedPage.blocks];
                            blocks[idx] = { ...block, css: e.target.value };
                            setSelectedPage({ ...selectedPage, blocks });
                          }}
                          className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Preview Pane */}
        {selectedPage && previewMode === 'preview' && (
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-3xl border border-default bg-surface p-6 sm:p-10 shadow-2xl space-y-8">
              <div className="border-b border-default pb-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {selectedPage.slug === 'home' ? '/ (Storefront Homepage)' : `/pages/${selectedPage.slug}`}
                  </span>
                  <h1 className="text-2xl font-bold text-default mt-1">{selectedPage.title}</h1>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  Interactive Preview
                </span>
              </div>

              {(selectedPage.blocks || []).map((block, idx) => (
                <div key={idx} className="space-y-4">
                  {/* Hero Preview */}
                  {block.type === 'hero_banner' && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-linear-to-br from-emerald-950/20 via-surface-sunken to-surface p-8 text-center space-y-3 shadow-md">
                      {block.badge && (
                        <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                          {block.badge}
                        </span>
                      )}
                      <h2 className="text-xl font-extrabold text-default sm:text-3xl">{block.title}</h2>
                      <p className="text-xs text-muted max-w-xl mx-auto leading-relaxed">{block.subtitle}</p>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        {block.cta_text && (
                          <span className="px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md">
                            {block.cta_text}
                          </span>
                        )}
                        {block.secondary_cta_text && (
                          <span className="px-4 py-2.5 rounded-xl border border-default bg-surface text-default font-semibold text-xs">
                            {block.secondary_cta_text}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Value Props Preview */}
                  {block.type === 'value_props' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(block.items || []).map((it, i) => (
                        <div key={i} className="p-4 rounded-xl border border-default bg-surface-sunken space-y-1">
                          <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                            {it.icon === 'truck' ? <Truck className="size-4" /> : it.icon === 'shield' ? <ShieldCheck className="size-4" /> : it.icon === 'message' ? <MessageCircle className="size-4" /> : <Flame className="size-4" />}
                          </div>
                          <h4 className="text-xs font-bold text-default">{it.title}</h4>
                          <p className="text-[11px] text-muted">{it.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Featured Products Preview */}
                  {block.type === 'featured_products' && (
                    <div className="rounded-2xl border border-default bg-surface-sunken p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-default pb-3">
                        <div>
                          <h3 className="text-base font-bold text-default">{block.title || 'Browse Products'}</h3>
                          <p className="text-xs text-muted">{block.subtitle || 'Available items in stock'}</p>
                        </div>
                        <span className="text-xs text-emerald-600 font-semibold font-mono">
                          Limit: {block.limit || 8} items
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: Math.min(4, block.limit || 4) }).map((_, i) => (
                          <div key={i} className="p-3 rounded-xl border border-default bg-surface space-y-2 text-center">
                            <div className="h-20 rounded-lg bg-surface-sunken flex items-center justify-center text-muted">
                              <ShoppingBag className="size-6 text-muted" />
                            </div>
                            <div className="h-3 w-3/4 mx-auto rounded bg-surface-sunken" />
                            <div className="h-2 w-1/2 mx-auto rounded bg-emerald-500/20" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quality Journey Preview */}
                  {block.type === 'quality_journey' && (
                    <div className="rounded-2xl border border-default bg-surface-sunken p-6 space-y-4">
                      <div className="text-center">
                        <h3 className="text-base font-bold text-default">{block.title || 'Quality Journey'}</h3>
                        <p className="text-xs text-muted">{block.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {(block.steps || []).map((st, i) => (
                          <div key={i} className="p-3 rounded-xl border border-default bg-surface space-y-1">
                            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{st.step}</span>
                            <h5 className="text-xs font-bold text-default">{st.title}</h5>
                            <p className="text-[10px] text-muted">{st.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Promo Banner Preview */}
                  {block.type === 'promo_split_banner' && (
                    <div className="rounded-2xl border border-default bg-surface-sunken p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-default">{block.title}</h4>
                        <p className="text-xs text-muted max-w-md">{block.subtitle}</p>
                      </div>
                      {block.cta_text && (
                        <span className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-xs whitespace-nowrap">
                          {block.cta_text}
                        </span>
                      )}
                    </div>
                  )}

                  {/* FAQ Preview */}
                  {block.type === 'faq' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-default">{block.title || 'FAQ'}</h3>
                      <div className="space-y-2">
                        {(block.faqs || []).map((faq, fIdx) => (
                          <div key={fIdx} className="rounded-xl border border-default bg-surface-sunken p-4">
                            <h4 className="text-xs font-bold text-default">{faq.q}</h4>
                            <p className="text-xs text-muted mt-1">{faq.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VIP Newsletter Preview */}
                  {block.type === 'newsletter_vip' && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
                      <h4 className="text-base font-bold text-default">{block.title || 'VIP Club'}</h4>
                      <p className="text-xs text-muted max-w-sm mx-auto">{block.subtitle}</p>
                      <div className="flex items-center justify-center gap-2 pt-2 max-w-xs mx-auto">
                        <input
                          type="text"
                          disabled
                          placeholder="your email or phone..."
                          className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-xs text-muted"
                        />
                        <button type="button" disabled className="px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold">
                          {block.button_text || 'Join'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rich Text Preview */}
                  {block.type === 'rich_text' && (
                    <div className="prose max-w-none space-y-2">
                      {block.title && <h3 className="text-base font-bold text-default">{block.title}</h3>}
                      <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                        {block.content}
                      </p>
                    </div>
                  )}

                  {/* Sandboxed Code Preview */}
                  {block.type === 'custom_html_css' && (
                    <div className="overflow-hidden rounded-2xl border border-default bg-surface">
                      <iframe
                        title="Sandboxed Block Preview"
                        sandbox="allow-scripts"
                        srcDoc={`
                          <html>
                            <head><style>${block.css || ''}</style></head>
                            <body style="margin: 0; font-family: sans-serif;">${block.html || ''}</body>
                          </html>
                        `}
                        className="w-full h-40 border-0"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center Canvas: Live Multi-Device Viewport Preview */}
        {selectedPage && previewMode === 'preview' && (
          <div className="space-y-4 lg:col-span-3">
            {/* Viewport Control Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-default bg-surface shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-default">Device Preview:</span>
                <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-default">
                  <button
                    type="button"
                    onClick={() => setViewport('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      viewport === 'desktop'
                        ? 'bg-surface text-default shadow-xs border border-default'
                        : 'text-muted hover:text-default'
                    }`}
                  >
                    <Laptop className="size-3.5" />
                    <span>Desktop (100%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewport('tablet')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      viewport === 'tablet'
                        ? 'bg-surface text-default shadow-xs border border-default'
                        : 'text-muted hover:text-default'
                    }`}
                  >
                    <Tablet className="size-3.5" />
                    <span>Tablet (768px)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewport('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      viewport === 'mobile'
                        ? 'bg-surface text-default shadow-xs border border-default'
                        : 'text-muted hover:text-default'
                    }`}
                  >
                    <Smartphone className="size-3.5" />
                    <span>Mobile (390px)</span>
                  </button>
                </div>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {selectedPage.title} • {selectedPage.blocks?.length || 0} Sections
              </span>
            </div>

            {/* Live Rendered Canvas Frame */}
            <div className="p-4 rounded-2xl border border-default bg-surface-sunken overflow-hidden flex justify-center min-h-120">
              <div
                className={`w-full transition-all duration-300 bg-surface rounded-2xl border border-default shadow-xl overflow-hidden ${
                  viewport === 'desktop'
                    ? 'max-w-full'
                    : viewport === 'tablet'
                    ? 'max-w-3xl'
                    : 'max-w-97.5 border-4 border-default/80'
                }`}
              >
                {selectedPage.blocks && selectedPage.blocks.length > 0 ? (
                  selectedPage.blocks.map((block) => (
                    <StorefrontBlockRenderer
                      key={block.id}
                      block={block}
                      products={previewProducts}
                      categories={categories}
                      currency="USD"
                      subdomain={storeSlug}
                      onAddToCart={(prod) => notify.info(`[Preview] Added ${prod.name} to cart`)}
                    />
                  ))
                ) : (
                  <div className="p-12 text-center text-muted text-xs">
                    No section blocks in this page yet. Add blocks from the editor palette.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State when No Page is Selected */}
        {!selectedPage && (
          <div className="lg:col-span-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-default bg-surface p-12 text-center min-h-110 shadow-2xs">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-inner">
              <Layout className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-default">Storefront Dynamic Page Builder</h3>
            <p className="text-xs text-muted max-w-md mt-1 mb-6">
              Create and manage dynamic CMS pages, hero sliders, FAQs, warranty policies, and promotional blocks synced directly with your live customer storefront.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              <button
                type="button"
                onClick={() => handleCreateNewPage('home')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-center cursor-pointer group"
              >
                <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Storefront Homepage</span>
                <span className="text-[10px] text-muted">Complete e-commerce home</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('about')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-default bg-surface-sunken hover:border-emerald-500/50 hover:bg-surface transition-all text-center cursor-pointer group"
              >
                <Sparkles className="h-5 w-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-default">About Us Page</span>
                <span className="text-[10px] text-muted">Factory heritage & story</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPage('faq')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-default bg-surface-sunken hover:border-emerald-500/50 hover:bg-surface transition-all text-center cursor-pointer group"
              >
                <HelpCircle className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-default">Help & FAQ</span>
                <span className="text-[10px] text-muted">Common customer questions</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {pageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="size-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-default">Delete Page</h3>
                <p className="text-xs text-muted">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-sunken border border-default text-xs space-y-1.5">
              <div className="flex justify-between text-muted">
                <span>Page Title:</span>
                <span className="font-semibold text-default">{pageToDelete.title}</span>
              </div>
              <div className="flex justify-between text-muted font-mono">
                <span>Route Slug:</span>
                <span className="text-default">/{pageToDelete.slug}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Blocks:</span>
                <span className="text-default">{(pageToDelete.blocks || []).length} content blocks</span>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to permanently delete this page? The page will immediately be removed from your storefront routing and sitemaps.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPageToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-default bg-surface text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDeletePage()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Page Properties Modal */}
      {pageToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-default">Edit Page Properties</h3>
              </div>
              <button
                type="button"
                onClick={() => setPageToEdit(null)}
                className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Page Title</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">URL Slug</label>
                <div className="flex items-center rounded-xl border border-default bg-surface-sunken px-3 py-2">
                  <span className="text-muted font-mono">{pageToEdit.slug === 'home' ? '/' : '/pages/'}</span>
                  <input
                    type="text"
                    required
                    readOnly={pageToEdit.slug === 'home'}
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="flex-1 bg-transparent text-default focus:outline-none pl-1 font-mono read-only:text-muted"
                  />
                  {pageToEdit.slug === 'home' && (
                    <span className="text-[10px] text-muted font-sans flex items-center gap-1">
                      <Lock className="size-3 text-muted" /> Fixed Home
                    </span>
                  )}
                </div>
              </div>

              {/* Status / Visibility */}
              <div className="space-y-1.5">
                <label className="font-semibold text-default block">Page Visibility / Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, status: 'published' })}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      editForm.status === 'published'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
                        : 'bg-surface-sunken border-default text-muted hover:text-default'
                    }`}
                  >
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Active (Published)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, status: 'draft' })}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      editForm.status === 'draft'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-2xs font-bold'
                        : 'bg-surface-sunken border-default text-muted hover:text-default'
                    }`}
                  >
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span>Inactive (Draft)</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">SEO Meta Title</label>
                <input
                  type="text"
                  placeholder="e.g. Next-Gen Modern Appliances"
                  value={editForm.meta_title}
                  onChange={(e) => setEditForm({ ...editForm, meta_title: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-default block">SEO Meta Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary for search engine snippet..."
                  value={editForm.meta_description}
                  onChange={(e) => setEditForm({ ...editForm, meta_description: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setPageToEdit(null)}
                  className="px-3.5 py-2 rounded-xl border border-default bg-surface text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  <span>{savingEdit ? 'Saving...' : 'Save Properties'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
