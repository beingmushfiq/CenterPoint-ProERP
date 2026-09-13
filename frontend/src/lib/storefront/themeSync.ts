import type { StorefrontConfig } from '../../types/api/storefront';
import { STOREFRONT_THEME_PRESETS, getRadiusValue, type ThemePresetId } from './storefrontDesignSystem';

export type StorefrontThemeConfig = NonNullable<StorefrontConfig['theme']>;

/**
 * Converts a hex color string (e.g. #ff0000 or #f00) to RGB triplet numbers.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num) || cleanHex.length !== 6) {
    return { r: 16, g: 185, b: 129 }; // Fallback emerald
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Calculates optimal text contrast color (#ffffff or #09090b) for a background hex.
 */
export function getContrastColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Standard ITU-R BT.601 perceptual luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#09090b' : '#ffffff';
}

/**
 * Darkens or lightens a hex color for interactive hover states.
 */
export function adjustColorShade(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 + percent / 100;
  const clamp = (val: number) => Math.min(255, Math.max(0, Math.round(val)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(clamp(r * factor))}${toHex(clamp(g * factor))}${toHex(clamp(b * factor))}`;
}

/**
 * Dynamically applies CSS variables to document root or storefront container.
 */
export function applyStorefrontThemeVariables(theme?: Partial<StorefrontThemeConfig> | null): void {
  if (typeof document === 'undefined') return;

  const presetId = (theme?.preset_id as ThemePresetId) || 'modern_retail';
  const preset = STOREFRONT_THEME_PRESETS[presetId] || STOREFRONT_THEME_PRESETS['modern_retail'];

  const primary = theme?.primary_color || preset.colors.primary || '#10b981';
  const accent = theme?.accent_color || preset.colors.accent || '#14b8a6';
  const navbarBg = theme?.navbar_bg || preset.colors.surface || '#0f172a';
  const navbarText = theme?.navbar_text_color || (preset.colors.surface === '#ffffff' ? '#0f172a' : '#ffffff');
  const footerBg = theme?.footer_bg || preset.colors.surfaceSunken || '#0f172a';
  const footerText = theme?.footer_text_color || preset.colors.textMuted || '#94a3b8';
  const announcementBg = theme?.announcement_bg || preset.announcementBg || '#10b981';
  const announcementText = theme?.announcement_text_color || preset.announcementText || '#ffffff';

  const fontHeading = theme?.font_family_heading || preset.typography.headingFont;
  const fontBody = theme?.font_family_body || preset.typography.bodyFont;
  const headingWeight = theme?.heading_weight || preset.typography.headingWeight;
  const radius = theme?.border_radius || getRadiusValue(preset.radius);

  const bg = theme?.background_color || preset.colors.background;
  const surface = theme?.surface_color || preset.colors.surface;
  const surfaceSunken = preset.colors.surfaceSunken;
  const textColor = theme?.text_color || preset.colors.text;
  const textMuted = theme?.text_muted_color || preset.colors.textMuted;
  const borderColor = theme?.border_color || preset.colors.border;

  const { r: pR, g: pG, b: pB } = hexToRgb(primary);
  const primaryFg = getContrastColor(primary);
  const primaryHover = adjustColorShade(primary, primaryFg === '#ffffff' ? -12 : 12);

  const root = document.documentElement;

  root.style.setProperty('--store-primary', primary);
  root.style.setProperty('--store-primary-rgb', `${pR}, ${pG}, ${pB}`);
  root.style.setProperty('--store-primary-fg', primaryFg);
  root.style.setProperty('--store-primary-hover', primaryHover);
  root.style.setProperty('--store-primary-subtle', `rgba(${pR}, ${pG}, ${pB}, 0.12)`);
  root.style.setProperty('--store-primary-border', `rgba(${pR}, ${pG}, ${pB}, 0.28)`);

  root.style.setProperty('--store-accent', accent);
  root.style.setProperty('--store-navbar-bg', navbarBg);
  root.style.setProperty('--store-navbar-text', navbarText);
  root.style.setProperty('--store-footer-bg', footerBg);
  root.style.setProperty('--store-footer-text', footerText);
  root.style.setProperty('--store-announcement-bg', announcementBg);
  root.style.setProperty('--store-announcement-text', announcementText);

  root.style.setProperty('--store-font-heading', fontHeading);
  root.style.setProperty('--store-font-body', fontBody);
  root.style.setProperty('--store-heading-weight', headingWeight);
  root.style.setProperty('--store-radius', radius);
  root.style.setProperty('--store-bg', bg);
  root.style.setProperty('--store-surface', surface);
  root.style.setProperty('--store-surface-sunken', surfaceSunken);
  root.style.setProperty('--store-text', textColor);
  root.style.setProperty('--store-text-muted', textMuted);
  root.style.setProperty('--store-border', borderColor);
}

const BROADCAST_CHANNEL_NAME = 'storefront_theme_sync_channel';
const STORAGE_PREFIX = 'storefront_theme_draft_';

export interface ThemeSyncMessage {
  type: 'DRAFT_UPDATE' | 'SAVED' | 'RESET';
  subdomain: string;
  theme?: Partial<StorefrontThemeConfig>;
  timestamp: number;
}

/**
 * Broadcasts live theme changes across tabs/windows in real time.
 */
export function broadcastThemeDraft(
  subdomain: string,
  theme: Partial<StorefrontThemeConfig>,
  type: 'DRAFT_UPDATE' | 'SAVED' = 'DRAFT_UPDATE'
): void {
  const payload: ThemeSyncMessage = {
    type,
    subdomain,
    theme,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel (instant in modern browsers)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch (err) {
    console.debug('BroadcastChannel unavailable:', err);
  }

  // 2. LocalStorage cross-tab storage event
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${subdomain}`, JSON.stringify(payload));
    }
  } catch (err) {
    console.debug('localStorage theme sync failed:', err);
  }
}

/**
 * Retrieves cached draft from localStorage if present.
 */
export function getStoredThemeDraft(subdomain: string): Partial<StorefrontThemeConfig> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${subdomain}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThemeSyncMessage;
    // Discard drafts older than 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`${STORAGE_PREFIX}${subdomain}`);
      return null;
    }
    return parsed.theme || null;
  } catch {
    return null;
  }
}

/**
 * Clears saved draft after persistent save or manual reset.
 */
export function clearStoredThemeDraft(subdomain: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${subdomain}`);
    }
  } catch {
    // Ignore error
  }
}

/**
 * Subscribes to real-time theme updates across browser tabs & windows.
 */
export function subscribeToThemeDraft(
  subdomain: string,
  onUpdate: (theme: Partial<StorefrontThemeConfig>, type: ThemeSyncMessage['type']) => void
): () => void {
  let channel: BroadcastChannel | null = null;

  // Handler for BroadcastChannel
  const handleBroadcast = (event: MessageEvent<ThemeSyncMessage>) => {
    const data = event.data;
    if (data && data.subdomain === subdomain && data.theme) {
      onUpdate(data.theme, data.type);
    }
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = handleBroadcast;
    }
  } catch (err) {
    console.debug('BroadcastChannel subscribe failed:', err);
  }

  // Handler for cross-tab localStorage changes
  const handleStorage = (event: StorageEvent) => {
    if (event.key === `${STORAGE_PREFIX}${subdomain}` && event.newValue) {
      try {
        const data = JSON.parse(event.newValue) as ThemeSyncMessage;
        if (data.theme) {
          onUpdate(data.theme, data.type);
        }
      } catch {
        // Ignore JSON error
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    if (channel) {
      channel.close();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}
