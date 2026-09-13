import { create } from 'zustand';
import type { StorefrontProduct } from '../../types/api/storefront';

export interface WishlistItem {
  id: number;
  name: string;
  sku: string;
  price: string;
  compare_at_price?: string | null | undefined;
  image_url?: string | undefined;
  category_name?: string | undefined;
  slug?: string | undefined;
  added_at: string;
  originalProduct: StorefrontProduct;
}

interface StorefrontWishlistState {
  items: WishlistItem[];
  isWishlistOpen: boolean;
  subdomain: string;
  setSubdomain: (subdomain: string) => void;
  openWishlist: () => void;
  closeWishlist: () => void;
  toggleWishlist: (product: StorefrontProduct) => boolean; // returns true if added, false if removed
  isInWishlist: (productId: number) => boolean;
  removeItem: (productId: number) => void;
  clearWishlist: () => void;
}

function getStorageKey(subdomain: string): string {
  return `storefront_wishlist_${subdomain || 'default'}`;
}

function loadSavedWishlist(subdomain: string): WishlistItem[] {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(getStorageKey(subdomain));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function persistWishlist(subdomain: string, items: WishlistItem[]) {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(getStorageKey(subdomain), JSON.stringify(items));
    }
  } catch {
    // ignore quota/storage errors
  }
}

export const useStorefrontWishlistStore = create<StorefrontWishlistState>((set, get) => ({
  items: loadSavedWishlist('slicemart'),
  isWishlistOpen: false,
  subdomain: 'slicemart',

  setSubdomain: (subdomain: string) => {
    const currentSubdomain = get().subdomain;
    if (currentSubdomain !== subdomain) {
      const loaded = loadSavedWishlist(subdomain);
      set({ subdomain, items: loaded });
    }
  },

  openWishlist: () => set({ isWishlistOpen: true }),
  closeWishlist: () => set({ isWishlistOpen: false }),

  toggleWishlist: (product: StorefrontProduct) => {
    const { items, subdomain } = get();
    const exists = items.some((item) => item.id === product.id);

    if (exists) {
      const updated = items.filter((item) => item.id !== product.id);
      persistWishlist(subdomain, updated);
      set({ items: updated });
      return false;
    }

    const primaryImage =
      product.image_url ||
      product.images?.find((img) => img.is_primary)?.url ||
      product.images?.[0]?.url;

    const newItem: WishlistItem = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.default_sale_price || '0',
      compare_at_price: product.compare_at_price,
      image_url: primaryImage,
      category_name: product.category?.name,
      slug: product.online_slug || product.sku || String(product.id),
      added_at: new Date().toISOString(),
      originalProduct: product,
    };
    const updated = [newItem, ...items];
    persistWishlist(subdomain, updated);
    set({ items: updated });
    return true;
  },

  isInWishlist: (productId: number) => {
    return get().items.some((item) => item.id === productId);
  },

  removeItem: (productId: number) => {
    const { items, subdomain } = get();
    const updated = items.filter((item) => item.id !== productId);
    persistWishlist(subdomain, updated);
    set({ items: updated });
  },

  clearWishlist: () => {
    const { subdomain } = get();
    persistWishlist(subdomain, []);
    set({ items: [] });
  },
}));
