/**
 * Multi-Tenant Storefront Design System & Presets
 * 
 * Provides 8 professionally designed presets across different commercial sectors
 * (fashion, luxury, industrial, tech, grocery, lifestyle, wholesale, corporate).
 * All presets map to responsive CSS custom properties without hardcoding client specifics.
 */

export type ThemePresetId =
  | 'editorial'
  | 'modern_retail'
  | 'industrial'
  | 'luxury'
  | 'minimal'
  | 'bold_commerce'
  | 'lifestyle'
  | 'corporate';

export type ThemePresetKey = ThemePresetId;

export type ProductCardStyle =
  | 'minimal'
  | 'editorial'
  | 'commerce'
  | 'compact'
  | 'horizontal'
  | 'b2b';

export type RadiusScale = 'none' | 'subtle' | 'rounded' | 'curved';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  border: string;
  badgeBg: string;
  badgeText: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  letterSpacing: string;
  lineHeightScale: string;
}

export interface StorefrontPresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  category: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  radius: RadiusScale;
  cardStyle: ProductCardStyle;
  headerStyle: 'standard' | 'minimal' | 'centered';
  announcementBg: string;
  announcementText: string;
}

export const STOREFRONT_THEME_PRESETS: Record<ThemePresetId, StorefrontPresetDefinition> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial & Haute Culture',
    description: 'Magazine-like layout with refined serif typography, crisp borders, and dramatic monochrome contrast.',
    category: 'Fashion, Luxury & Print',
    colors: {
      primary: '#18181b', // zinc-900
      secondary: '#71717a',
      accent: '#27272a',
      background: '#fafafa',
      surface: '#ffffff',
      surfaceSunken: '#f4f4f5',
      text: '#09090b',
      textMuted: '#71717a',
      border: '#e4e4e7',
      badgeBg: '#18181b',
      badgeText: '#fafafa',
    },
    typography: {
      headingFont: "'Playfair Display', Georgia, serif",
      bodyFont: "'Inter', -apple-system, sans-serif",
      headingWeight: '600',
      letterSpacing: '-0.02em',
      lineHeightScale: '1.2',
    },
    radius: 'none',
    cardStyle: 'editorial',
    headerStyle: 'centered',
    announcementBg: '#18181b',
    announcementText: '#fafafa',
  },

  modern_retail: {
    id: 'modern_retail',
    name: 'Modern DTC & Retail',
    description: 'Vibrant, high-converting digital storefront with clean geometry and contemporary emerald/teal accents.',
    category: 'General Commerce & Direct-to-Consumer',
    colors: {
      primary: '#0f766e', // teal-700
      secondary: '#0d9488',
      accent: '#059669',
      background: '#ffffff',
      surface: '#ffffff',
      surfaceSunken: '#f8fafc',
      text: '#0f172a',
      textMuted: '#64748b',
      border: '#e2e8f0',
      badgeBg: '#0f766e',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Plus Jakarta Sans', -apple-system, sans-serif",
      bodyFont: "'Inter', -apple-system, sans-serif",
      headingWeight: '700',
      letterSpacing: '-0.015em',
      lineHeightScale: '1.25',
    },
    radius: 'rounded',
    cardStyle: 'commerce',
    headerStyle: 'standard',
    announcementBg: '#0f766e',
    announcementText: '#ffffff',
  },

  industrial: {
    id: 'industrial',
    name: 'Industrial & Technical Supply',
    description: 'Engineered for manufacturers, B2B hardware, spare parts, and equipment with dense technical hierarchy.',
    category: 'Manufacturing, Hardware & Equipment',
    colors: {
      primary: '#2563eb', // blue-600
      secondary: '#475569',
      accent: '#f59e0b',
      background: '#090d16',
      surface: '#0f172a',
      surfaceSunken: '#0b1120',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      border: '#1e293b',
      badgeBg: '#1d4ed8',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Space Grotesk', -apple-system, sans-serif",
      bodyFont: "'Inter', monospace, sans-serif",
      headingWeight: '700',
      letterSpacing: '-0.02em',
      lineHeightScale: '1.2',
    },
    radius: 'subtle',
    cardStyle: 'b2b',
    headerStyle: 'standard',
    announcementBg: '#1e293b',
    announcementText: '#38bdf8',
  },

  luxury: {
    id: 'luxury',
    name: 'Luxury & Horology',
    description: 'Understated elegance, gold foil accents, dark obsidian canvases, and generous spatial breathing room.',
    category: 'Jewelry, Watches & High Craft',
    colors: {
      primary: '#d97706', // amber-600
      secondary: '#b45309',
      accent: '#f59e0b',
      background: '#09090b',
      surface: '#18181b',
      surfaceSunken: '#121215',
      text: '#f4f4f5',
      textMuted: '#a1a1aa',
      border: '#27272a',
      badgeBg: '#d97706',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Cormorant Garamond', Georgia, serif",
      bodyFont: "'Montserrat', -apple-system, sans-serif",
      headingWeight: '500',
      letterSpacing: '0.04em',
      lineHeightScale: '1.3',
    },
    radius: 'none',
    cardStyle: 'editorial',
    headerStyle: 'centered',
    announcementBg: '#18181b',
    announcementText: '#f59e0b',
  },

  minimal: {
    id: 'minimal',
    name: 'Nordic Minimalist',
    description: 'Form strictly follows function. Zero extraneous decoration, pure black & white, and organic serenity.',
    category: 'Home, Furniture & Design Objects',
    colors: {
      primary: '#171717', // neutral-900
      secondary: '#525252',
      accent: '#262626',
      background: '#fafafa',
      surface: '#ffffff',
      surfaceSunken: '#f5f5f5',
      text: '#171717',
      textMuted: '#737373',
      border: '#e5e5e5',
      badgeBg: '#171717',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Geist', 'Inter', -apple-system, sans-serif",
      bodyFont: "'Inter', -apple-system, sans-serif",
      headingWeight: '600',
      letterSpacing: '-0.03em',
      lineHeightScale: '1.25',
    },
    radius: 'subtle',
    cardStyle: 'minimal',
    headerStyle: 'minimal',
    announcementBg: '#171717',
    announcementText: '#ffffff',
  },

  bold_commerce: {
    id: 'bold_commerce',
    name: 'Bold Consumer Tech',
    description: 'High-energy layout with punchy typography, sharp contrast, dynamic badges, and fast conversion flows.',
    category: 'Electronics, Gaming & Audio',
    colors: {
      primary: '#6366f1', // indigo-500
      secondary: '#4f46e5',
      accent: '#ec4899',
      background: '#0a0a0f',
      surface: '#13131f',
      surfaceSunken: '#0d0d16',
      text: '#ffffff',
      textMuted: '#9ca3af',
      border: '#27273a',
      badgeBg: '#6366f1',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Syne', 'Plus Jakarta Sans', sans-serif",
      bodyFont: "'Inter', sans-serif",
      headingWeight: '800',
      letterSpacing: '-0.025em',
      lineHeightScale: '1.15',
    },
    radius: 'curved',
    cardStyle: 'commerce',
    headerStyle: 'standard',
    announcementBg: '#4f46e5',
    announcementText: '#ffffff',
  },

  lifestyle: {
    id: 'lifestyle',
    name: 'Lifestyle & Botanical',
    description: 'Warm earthen tones, soft rounded cards, approachable typography, and human-centric story blocks.',
    category: 'Beauty, Organic Food & Wellness',
    colors: {
      primary: '#ea580c', // orange-600
      secondary: '#c2410c',
      accent: '#16a34a',
      background: '#fcfbf9',
      surface: '#ffffff',
      surfaceSunken: '#f5f2eb',
      text: '#292524',
      textMuted: '#78716c',
      border: '#e7e5e4',
      badgeBg: '#ea580c',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Outfit', 'Plus Jakarta Sans', sans-serif",
      bodyFont: "'Inter', sans-serif",
      headingWeight: '600',
      letterSpacing: '-0.01em',
      lineHeightScale: '1.25',
    },
    radius: 'curved',
    cardStyle: 'commerce',
    headerStyle: 'standard',
    announcementBg: '#292524',
    announcementText: '#fed7aa',
  },

  corporate: {
    id: 'corporate',
    name: 'Corporate Brand & Enterprise',
    description: 'Established, credible, and stable corporate presentation suitable for institutional suppliers and trade.',
    category: 'Corporate, B2B & Wholesale',
    colors: {
      primary: '#1e3a8a', // blue-900
      secondary: '#1d4ed8',
      accent: '#0284c7',
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceSunken: '#f1f5f9',
      text: '#0f172a',
      textMuted: '#475569',
      border: '#cbd5e1',
      badgeBg: '#1e3a8a',
      badgeText: '#ffffff',
    },
    typography: {
      headingFont: "'Inter', -apple-system, sans-serif",
      bodyFont: "'Inter', -apple-system, sans-serif",
      headingWeight: '700',
      letterSpacing: '-0.02em',
      lineHeightScale: '1.25',
    },
    radius: 'subtle',
    cardStyle: 'b2b',
    headerStyle: 'standard',
    announcementBg: '#1e3a8a',
    announcementText: '#ffffff',
  },
};

/**
 * Returns pixel value for border radius scale.
 */
export function getRadiusValue(scale: RadiusScale): string {
  switch (scale) {
    case 'none':
      return '0px';
    case 'subtle':
      return '4px';
    case 'rounded':
      return '8px';
    case 'curved':
      return '14px';
    default:
      return '8px';
  }
}
