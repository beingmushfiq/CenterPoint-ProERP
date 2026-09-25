export interface CatalogTimestamped {
  created_at: string | null;
  updated_at: string | null;
}

export interface Category extends CatalogTimestamped {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  path: string | null;
  is_active: boolean;
  parent?: Category | null;
  children?: Category[] | null;
}

export interface Brand extends CatalogTimestamped {
  id: string;
  code: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
}

export interface ProductImage {
  id: number;
  product_id?: number;
  variant_id?: number | null;
  path: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
  alt_key?: string | null;
}

export interface Product extends CatalogTimestamped {
  id: string;
  product_id?: number;
  unit_id?: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  type: string;
  category_id: string | null;
  category_name?: string | null;
  category?: { id: string; name: string; code?: string } | null;
  brand_id: string | null;
  brand_name?: string | null;
  base_unit_id: string;
  base_unit?: { id?: string | number; code?: string; name?: string; symbol?: string } | null;
  unit?: { id?: string | number; code?: string; name?: string; symbol?: string } | null;
  purchase_unit_id: string | null;
  sales_unit_id: string | null;
  is_produced: boolean;
  is_purchased: boolean;
  is_sold: boolean;
  is_stock_tracked: boolean;
  stock_quantity?: number | null;
  has_variants: boolean;
  tracking_mode: string;
  opening_stock?: string | number | null;
  shelf_life_days?: number | null;
  reorder_level: string | null;
  reorder_quantity: string | null;
  standard_cost: string;
  default_sale_price: string;
  tax_profile_id: string | null;
  weight: string | null;
  dimensions: Record<string, unknown> | null;
  is_online: boolean;
  online_slug: string | null;
  online_meta: Record<string, unknown> | null;
  image_url?: string | null;
  images?: ProductImage[];
  status: string;
}

export interface WarehouseLocation extends CatalogTimestamped {
  id: string;
  warehouse_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  parent?: WarehouseLocation | null;
}

export interface Warehouse extends CatalogTimestamped {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  company_id: string | null;
  branch_id: string | null;
  factory_id: string | null;
  is_default: boolean;
  allows_negative_stock: boolean;
  is_active: boolean;
  locations?: WarehouseLocation[] | null;
}
