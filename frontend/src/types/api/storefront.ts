export interface StorefrontConfig {
  id: number;
  uuid: string;
  name: string;
  code: string;
  domain: string | null;
  subdomain: string;
  currency: string;
  locale: string;
  theme: {
    primary_color: string;
    accent_color: string;
    hero_title: string;
    hero_subtitle: string;
    hero_image?: string | null;
    preset_id?: 'editorial' | 'modern_retail' | 'industrial' | 'luxury' | 'minimal' | 'bold_commerce' | 'lifestyle' | 'corporate';
    font_family_heading?: string;
    font_family_body?: string;
    heading_weight?: string;
    border_radius?: string;
    card_style?: 'minimal' | 'editorial' | 'commerce' | 'compact' | 'horizontal' | 'b2b';
    background_color?: string;
    surface_color?: string;
    text_color?: string;
    text_muted_color?: string;
    border_color?: string;
    navbar_bg?: string;
    navbar_text_color?: string;
    announcement_enabled?: boolean;
    announcement_text?: string;
    announcement_bg?: string;
    announcement_text_color?: string;
    footer_bg?: string;
    footer_text_color?: string;
    footer_columns?: Array<{
      title: string;
      links: Array<{ label: string; url: string }>;
    }>;
    footer_description?: string;
    footer_show_whatsapp?: boolean;
    footer_whatsapp_label?: string;
    footer_show_payments?: boolean;
    footer_payment_methods?: string[];
    footer_contact_title?: string;
    footer_address?: string;
    footer_phone?: string;
    footer_email?: string;
    footer_copyright?: string;
    menu_items?: Array<{
      label: string;
      url: string;
      is_external?: boolean;
    }>;
    social_links?: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      youtube?: string;
      whatsapp?: string;
    };
    meta_pixel_id?: string;
    google_analytics_id?: string;
  };
  meta_title: string;
  meta_description: string | null;
  guest_checkout_enabled: boolean;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  whatsapp_number?: string | null;
  whatsapp_ordering_enabled?: boolean;
  whatsapp_default_message?: string | null;
  min_order_amount: string | null;
  status: 'draft' | 'live' | 'maintenance' | 'suspended';
}

export interface StorefrontProductVariant {
  id: number;
  sku: string;
  name: string;
  price: string;
  stock_quantity?: string;
  attributes?: Record<string, string>;
}

export interface StorefrontProduct {
  id: number;
  sku: string;
  name: string;
  online_slug?: string | null;
  description: string | null;
  type: string;
  default_sale_price: string;
  compare_at_price?: string | null;
  is_featured?: boolean;
  image_url?: string | null;
  images?: { id?: number; url?: string; path?: string; is_primary?: boolean; sort_order?: number }[];
  category?: {
    id: number;
    name: string;
    code: string;
    slug?: string;
  };
  brand?: {
    id: number;
    name: string;
    code: string;
  };
  base_unit?: {
    id: number;
    name: string;
    code: string;
  };
  variants?: StorefrontProductVariant[];
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
  };
  schema?: {
    product?: Record<string, unknown>;
  };
  breadcrumb_items?: { name: string; url: string }[];
}

export interface StorefrontCartItem {
  id: number;
  uuid: string;
  product_id: number;
  variant_id: number | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  line_discount: string;
  tax_amount: string;
  line_total: string;
  product?: StorefrontProduct;
  variant?: StorefrontProductVariant;
}

export interface StorefrontCart {
  id: number;
  uuid: string;
  session_token: string;
  item_count: number;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  coupon_code: string | null;
  status: string;
  items: StorefrontCartItem[];
}

export interface StorefrontCheckoutPayload {
  customer_name: string;
  phone: string;
  email?: string;
  delivery_address: string;
  city?: string;
  payment_method: 'cod' | 'online' | 'bkash' | 'nagad';
  notes?: string;
}

export interface StorefrontOrderConfirmation {
  order_number: string;
  order_uuid: string;
  total_amount: string;
  currency: string;
  payment_method: string;
  status: string;
  tracking_token: string;
}
