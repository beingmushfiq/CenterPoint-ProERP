import { useState, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Tag,
  QrCode,
  Eye,
  Edit2,
  Trash2,
  Boxes,
  Ruler,
  Layers,
  DollarSign,
  Barcode as BarcodeIcon,
  Package,
  ShieldCheck,
  Scale,
  FileCode,
  Sparkles,
  Compass,
  Copy,
  Download,
  Upload,
  AlertTriangle,
  Globe,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { productImportSchema } from '../schemas/productImportSchema';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { BarcodeGeneratorModal } from '../../../components/print/labels/BarcodeGeneratorModal';
import { DynamicCustomFields } from '../../../components/forms/DynamicCustomFields';
import {
  ProductDescriptionEditor,
  RenderHtmlContent,
} from '../components/ProductDescriptionEditor';
import {
  ProductImageGalleryUploader,
  type LocalQueuedImage,
} from '../components/ProductImageGalleryUploader';
import { SerpPreviewCard } from '../../../components/seo/SerpPreviewCard';
import { DiscoverabilityChecklist } from '../../../components/seo/DiscoverabilityChecklist';
import type { Product, Category, Brand, ProductImage } from '../../../types/api/catalog';
import type { Unit } from '../../../types/api/unit';
import { useCurrency } from '../../../hooks/useCurrency';

const EMPTY_PRODUCT_IMAGES: ProductImage[] = [];

interface ProductFormDraft {
  sku: string;
  name: string;
  type: string;
  base_unit_id: string;
  category_id?: string | null;
  brand_id?: string | null;
  standard_cost: string;
  default_sale_price: string;
  is_stock_tracked?: boolean;
  is_online?: boolean;
  status?: string;
  description?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  reorder_level?: string | null;
  reorder_quantity?: string | null;
  weight?: string | null;
  opening_stock?: string | null;
  warehouse_id?: string | null;
  tracking_mode?: string;
  online_slug?: string | null;
  online_meta?: {
    meta_title?: string;
    meta_description?: string;
    canonical_url?: string;
    [key: string]: unknown;
  } | null;
  custom_attributes?: Record<string, unknown> | null;
}

interface WarehouseOption {
  id: number | string;
  uuid?: string;
  name: string;
  code: string;
}

export function ProductsSection() {
  const { currencyCode, currencySymbol, formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [createQueuedImages, setCreateQueuedImages] = useState<LocalQueuedImage[]>([]);
  const [selectedLabelProducts, setSelectedLabelProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const indeterminateRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<
    'general' | 'pricing' | 'media' | 'seo' | 'custom'
  >('general');

  // Quick-Add Sub-Modal States
  const [isQuickUnitOpen, setIsQuickUnitOpen] = useState(false);
  const [isQuickCategoryOpen, setIsQuickCategoryOpen] = useState(false);
  const [isQuickBrandOpen, setIsQuickBrandOpen] = useState(false);

  const [quickUnitDraft, setQuickUnitDraft] = useState({
    code: '',
    name: '',
    type: 'piece',
    precision: 2,
    is_base: true,
    is_active: true,
  });

  const [quickCategoryDraft, setQuickCategoryDraft] = useState({
    code: '',
    name: '',
    parent_id: null as string | null,
    is_active: true,
  });

  const [quickBrandDraft, setQuickBrandDraft] = useState({
    code: '',
    name: '',
    logo_path: null as string | null,
    is_active: true,
  });

  const [draft, setDraft] = useState<ProductFormDraft>({
    sku: '',
    name: '',
    type: 'finished',
    base_unit_id: '',
    category_id: null,
    brand_id: null,
    standard_cost: '0.0000',
    default_sale_price: '0.0000',
    is_stock_tracked: true,
    is_online: true,
    status: 'active',
    description: '',
    barcode: '',
    image_url: '',
    reorder_level: '10',
    reorder_quantity: '50',
    weight: '1',
    opening_stock: '0',
    warehouse_id: '',
    tracking_mode: 'batch',
  });

  const queryClient = useQueryClient();

  // Fetch Products
  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', search, typeFilter],
    queryFn: ({ signal }) =>
      api.get<Product[]>('/products', {
        signal,
        params: {
          ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
          ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        },
      }),
  });

  useQuery({
    queryKey: ['catalogue', 'products', 'options'],
    queryFn: ({ signal }) => api.get<Product[]>('/products/options', { signal }),
  });

  // Fetch Units options
  const unitsQuery = useQuery({
    queryKey: ['catalogue', 'units', 'options'],
    queryFn: ({ signal }) => api.get<Unit[]>('/units', { signal }),
  });

  // Fetch Categories options
  const categoriesQuery = useQuery({
    queryKey: ['catalogue', 'categories', 'options'],
    queryFn: ({ signal }) => api.get<Category[]>('/categories', { signal }),
  });

  // Fetch Brands options
  const brandsQuery = useQuery({
    queryKey: ['catalogue', 'brands', 'options'],
    queryFn: ({ signal }) => api.get<Brand[]>('/brands', { signal }),
  });

  // Fetch Warehouses options
  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouses', 'options'],
    queryFn: ({ signal }) => api.get<WarehouseOption[]>('/warehouses', { signal }),
  });

  // ── Quick Add Mutations ──────────────────────────────────────────────────
  const quickAddUnitMutation = useMutation({
    mutationFn: (payload: typeof quickUnitDraft) => api.post<Unit>('/units', payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'units'] });
      const newUnit = response.data;
      if (newUnit?.id) {
        setDraft((prev) => ({ ...prev, base_unit_id: String(newUnit.id) }));
      }
      setIsQuickUnitOpen(false);
      setQuickUnitDraft({
        code: '',
        name: '',
        type: 'piece',
        precision: 2,
        is_base: true,
        is_active: true,
      });
      notify.success(`Unit "${quickUnitDraft.name}" created and selected!`);
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to create unit.';
      notify.error(msg);
    },
  });

  const quickAddCategoryMutation = useMutation({
    mutationFn: (payload: typeof quickCategoryDraft) => api.post<Category>('/categories', payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'categories'] });
      const newCat = response.data;
      if (newCat?.id) {
        setDraft((prev) => ({ ...prev, category_id: String(newCat.id) }));
      }
      setIsQuickCategoryOpen(false);
      setQuickCategoryDraft({ code: '', name: '', parent_id: null, is_active: true });
      notify.success(`Category "${quickCategoryDraft.name}" created and selected!`);
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to create category.';
      notify.error(msg);
    },
  });

  const quickAddBrandMutation = useMutation({
    mutationFn: (payload: typeof quickBrandDraft) => api.post<Brand>('/brands', payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'brands'] });
      const newBrand = response.data;
      if (newBrand?.id) {
        setDraft((prev) => ({ ...prev, brand_id: String(newBrand.id) }));
      }
      setIsQuickBrandOpen(false);
      setQuickBrandDraft({ code: '', name: '', logo_path: null, is_active: true });
      notify.success(`Brand "${quickBrandDraft.name}" created and selected!`);
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to create brand.';
      notify.error(msg);
    },
  });

  // ── Product CRUD Mutations ──────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: ProductFormDraft) => {
      const finalPayload = {
        ...payload,
        online_meta: {
          ...(payload.online_meta || {}),
          ...(payload.image_url ? { image_url: payload.image_url } : {}),
        },
        online_slug: payload.online_slug || null,
      };
      return api.post<Product>('/products', finalPayload);
    },
    onSuccess: async (response) => {
      const created = response.data;
      if (created?.id && createQueuedImages.length > 0) {
        for (const item of createQueuedImages) {
          try {
            if (item.file) {
              const fd = new FormData();
              fd.append('image', item.file);
              if (item.is_primary) fd.append('is_primary', '1');
              await api.post(`/products/${created.id}/images`, fd);
            } else if (item.url) {
              await api.post(`/products/${created.id}/images`, {
                url: item.url,
                is_primary: item.is_primary,
              });
            }
          } catch (e) {
            console.error('Failed uploading queued image', e);
          }
        }
      }
      setCreateQueuedImages([]);
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      setIsCreateOpen(false);
      resetDraft();
      setErrorMsg(null);
      notify.success('Product created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to create product.');
      } else {
        setErrorMsg('Error creating product.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductFormDraft> }) => {
      const finalPayload = {
        ...payload,
        online_meta: {
          ...(payload.online_meta || {}),
          ...(payload.image_url ? { image_url: payload.image_url } : {}),
        },
        online_slug: payload.online_slug || null,
      };
      return api.patch<Product>(`/products/${id}`, finalPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      setEditingProduct(null);
      setErrorMsg(null);
      notify.success('Product updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update product.');
      } else {
        setErrorMsg('Error updating product.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      setDeletingProduct(null);
      notify.success('Product deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete product.';
      notify.error(msg);
    },
  });

  const resetDraft = () => {
    setErrorMsg(null);
    setCreateQueuedImages([]);
    setDraft({
      sku: '',
      name: '',
      type: 'finished',
      base_unit_id: unitsQuery.data?.data?.[0]?.id ? String(unitsQuery.data.data[0].id) : '',
      category_id: null,
      brand_id: null,
      standard_cost: '0.0000',
      default_sale_price: '0.0000',
      is_stock_tracked: true,
      is_online: true,
      status: 'active',
      description: '',
      barcode: '',
      image_url: '',
      reorder_level: '10',
      reorder_quantity: '50',
      weight: '1',
      opening_stock: '0',
      warehouse_id: '',
      tracking_mode: 'batch',
      online_slug: '',
      online_meta: null,
    });
    setActiveFormTab('general');
  };

  const handleOpenEdit = (p: Product) => {
    setErrorMsg(null);
    setActiveFormTab('general');
    const onlineMeta = p.online_meta as {
      image_url?: string;
      meta_title?: string;
      meta_description?: string;
      canonical_url?: string;
    } | null;
    setDraft({
      sku: p.sku,
      name: p.name,
      type: p.type,
      base_unit_id: String(p.base_unit_id),
      category_id: p.category_id ? String(p.category_id) : null,
      brand_id: p.brand_id ? String(p.brand_id) : null,
      standard_cost: p.standard_cost,
      default_sale_price: p.default_sale_price,
      is_stock_tracked: p.is_stock_tracked,
      is_online: p.is_online,
      status: p.status,
      description: p.description || '',
      barcode: p.barcode || '',
      image_url: p.image_url || onlineMeta?.image_url || '',
      reorder_level: p.reorder_level || '10',
      reorder_quantity: p.reorder_quantity || '50',
      weight: p.weight || '1',
      opening_stock: '0',
      warehouse_id: '',
      tracking_mode: p.tracking_mode || 'batch',
      online_slug: p.online_slug || '',
      online_meta: onlineMeta || null,
    });
    setEditingProduct(p);
    const prodId = (p as { uuid?: string }).uuid || p.id;
    void api.get<Product>(`/products/${prodId}`).then((res) => {
      if (res.data) setEditingProduct(res.data);
    }).catch(() => {});
    void api.get(`/products/${prodId}/images`).catch(() => {});
  };

  const handleDuplicate = (p: Product) => {
    setErrorMsg(null);
    setActiveFormTab('general');
    const onlineMeta = p.online_meta as {
      image_url?: string;
      meta_title?: string;
      meta_description?: string;
      canonical_url?: string;
    } | null;
    setDraft({
      sku: `${p.sku}-COPY`,
      name: `${p.name} (Copy)`,
      type: p.type || 'finished',
      base_unit_id: String(p.base_unit_id || ''),
      category_id: p.category_id ? String(p.category_id) : null,
      brand_id: p.brand_id ? String(p.brand_id) : null,
      standard_cost: p.standard_cost || '0.0000',
      default_sale_price: p.default_sale_price || '0.0000',
      is_stock_tracked: p.is_stock_tracked ?? true,
      is_online: false,
      status: 'active',
      description: p.description || '',
      barcode: '',
      image_url: onlineMeta?.image_url || '',
      reorder_level: p.reorder_level || '10',
      reorder_quantity: p.reorder_quantity || '50',
      weight: p.weight || '1',
      opening_stock: '0',
      warehouse_id: '',
      tracking_mode: p.tracking_mode || 'batch',
      online_slug: '',
      online_meta: onlineMeta
        ? { ...onlineMeta, meta_title: `${onlineMeta.meta_title || p.name} (Copy)` }
        : null,
    });
    setEditingProduct(null);
    setIsCreateOpen(true);
    notify.info(`Duplicating "${p.name}". Review specifications, modify SKU, and save.`);
  };

  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data?.data]);
  const units = unitsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const brands = brandsQuery.data?.data ?? [];
  const warehouses: WarehouseOption[] = Array.isArray(warehousesQuery.data?.data)
    ? (warehousesQuery.data.data as WarehouseOption[])
    : Array.isArray(warehousesQuery.data)
      ? (warehousesQuery.data as WarehouseOption[])
      : [];

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    const list = unitsQuery.data?.data ?? [];
    list.forEach((u) => {
      map.set(String(u.id), u.code || u.name);
    });
    return map;
  }, [unitsQuery.data?.data]);

  // ── Multi-Row Selection & Bulk Operations ──────────────────────────────────
  const allSelected = useMemo(
    () => products.length > 0 && products.every((p) => selectedProductIds.has(p.id)),
    [products, selectedProductIds]
  );

  const isIndeterminate = useMemo(
    () => selectedProductIds.size > 0 && !allSelected,
    [selectedProductIds, allSelected]
  );

  useEffect(() => {
    if (indeterminateRef.current) {
      indeterminateRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelectProduct = (id: string | number) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.has(p.id)),
    [products, selectedProductIds]
  );

  const catalogStats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => (p.status || 'active') === 'active').length;
    const stockTracked = products.filter((p) => p.is_stock_tracked).length;
    const lowStock = products.filter((p) => {
      const qty = Number(p.stock_quantity ?? 0);
      const reorder = Number(p.reorder_level ?? 0);
      return reorder > 0 && qty <= reorder;
    }).length;
    const storefrontLive = products.filter((p) => p.is_online).length;
    return { total, active, inactive: total - active, stockTracked, lowStock, storefrontLive };
  }, [products]);

  // Esc key clears selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProductIds.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductIds.size]);

  // Bulk Handlers
  const handleBulkPrintBarcodes = () => {
    if (selectedProducts.length > 0) {
      setSelectedLabelProducts(selectedProducts);
    } else if (products.length > 0) {
      setSelectedLabelProducts(products.slice(0, 10));
    } else {
      notify.warning('No products available to print barcodes.');
    }
  };

  const handleBulkStatusChange = async (newStatus: 'active' | 'inactive') => {
    if (selectedProducts.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedProducts.map((p) =>
        api.patch(`/products/${p.id}`, { status: newStatus })
      );
      await Promise.allSettled(promises);
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      notify.success(`Updated status to ${newStatus} for ${selectedProducts.length} product(s).`);
      clearSelection();
    } catch {
      notify.error('Failed to update product statuses.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkExportCsv = () => {
    const itemsToExport = selectedProducts.length > 0 ? selectedProducts : products;
    if (itemsToExport.length === 0) {
      notify.warning('No products to export.');
      return;
    }

    const headers = ['SKU', 'Name', 'Type', 'Standard Cost', 'Sale Price', 'Stock Qty', 'Unit', 'Status', 'Barcode'];
    const rows = itemsToExport.map((p) => [
      `"${p.sku}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.type}"`,
      `"${p.standard_cost || '0.00'}"`,
      `"${p.default_sale_price || '0.00'}"`,
      `"${p.stock_quantity ?? '0'}"`,
      `"${unitMap.get(String(p.base_unit_id)) || 'PCS'}"`,
      `"${p.status || 'active'}"`,
      `"${p.barcode || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success(`Exported ${itemsToExport.length} products to CSV.`);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedProducts.map((p) => api.delete(`/products/${p.id}`));
      await Promise.allSettled(promises);
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      notify.success(`Successfully deleted ${selectedProducts.length} product(s).`);
      setIsBulkDeleting(false);
      clearSelection();
    } catch {
      notify.error('Failed to delete some products.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleToggleStorefrontPublish = async (product: Product, isPublished: boolean) => {
    try {
      await api.post('/storefront/products/toggle-publish', {
        product_id: product.id,
        is_published: isPublished,
      });
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      notify.success(
        isPublished
          ? `Published "${product.name}" to online storefront.`
          : `Removed "${product.name}" from online storefront.`
      );
    } catch {
      notify.error('Failed to update storefront publish status.');
    }
  };

  const handleBulkPublishToStorefront = async () => {
    if (selectedProducts.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const promises = selectedProducts.map((p) =>
        api.post('/storefront/products/toggle-publish', {
          product_id: p.id,
          is_published: true,
        })
      );
      await Promise.allSettled(promises);
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
      notify.success(`Published ${selectedProducts.length} product(s) to online storefront.`);
      clearSelection();
    } catch {
      notify.error('Failed to publish selected products to storefront.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Catalog Intelligence KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-default bg-surface shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Catalog SKUs</span>
            <Package className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-default">{catalogStats.total}</span>
            <span className="text-[10px] text-muted">({catalogStats.active} Active)</span>
          </div>
          <p className="text-[10px] text-muted">{catalogStats.inactive} drafts or inactive</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-default bg-surface shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Inventory Tracked</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-default">{catalogStats.stockTracked}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Real-time ledger</span>
          </div>
          <p className="text-[10px] text-muted">Automated stock movement tracking</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-default bg-surface shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reorder Watchlist</span>
            <AlertTriangle className={cn('size-4', catalogStats.lowStock > 0 ? 'text-amber-500' : 'text-muted')} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-xl font-black', catalogStats.lowStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-default')}>
              {catalogStats.lowStock}
            </span>
            <span className="text-[10px] text-muted">Items at/below min</span>
          </div>
          <p className="text-[10px] text-muted">Requires manufacturing or PO replenishment</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-default bg-surface shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Storefront Live</span>
            <Globe className="size-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-default">{catalogStats.storefrontLive}</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">E-Commerce</span>
          </div>
          <p className="text-[10px] text-muted">Published to public storefront catalog</p>
        </div>
      </div>

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by SKU, Name or Barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-xs"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Types', icon: Layers },
              { value: 'finished', label: 'Finished Goods', colorDot: 'bg-emerald-500' },
              { value: 'semi_finished', label: 'Semi-Finished', colorDot: 'bg-amber-500' },
              { value: 'raw_material', label: 'Raw Materials', colorDot: 'bg-blue-500' },
              { value: 'packaging', label: 'Packaging', colorDot: 'bg-purple-500' },
              { value: 'consumable', label: 'Consumables', colorDot: 'bg-cyan-500' },
            ]}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            size="sm"
            aria-label="Filter products by type"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={selectedProductIds.size > 0 ? 'primary' : 'secondary'}
            onClick={handleBulkPrintBarcodes}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <QrCode className="h-4 w-4 text-primary" />
            <span>
              Print Barcodes{selectedProductIds.size > 0 ? ` (${selectedProductIds.size})` : ''}
            </span>
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              resetDraft();
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>New Product</span>
          </Button>
        </div>
      </div>

      {/* Feature Discovery & In-Table Bulk Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-4 py-2.5 bg-surface-sunken border border-default rounded-2xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-default">
            {products.length} Products Listed
          </span>
          {selectedProductIds.size > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-primary text-primary-fg shadow-xs">
              <CheckCircle2 className="size-3" />
              {selectedProductIds.size} Selected
            </span>
          ) : (
            <span className="text-[11px] text-muted hidden md:inline">
              • Check row boxes to enable batch thermal barcode printing, status updates, or deletion
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedProductIds.size > 0 ? (
            <>
              <button
                type="button"
                onClick={clearSelection}
                className="px-2.5 py-1 text-[11px] font-medium text-muted hover:text-default rounded-lg border border-default bg-surface cursor-pointer"
              >
                Clear Selection (Esc)
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkStatusChange('active')}
                disabled={isBulkUpdating}
                className="text-[11px] py-1"
              >
                Set Active
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkStatusChange('inactive')}
                disabled={isBulkUpdating}
                className="text-[11px] py-1"
              >
                Set Inactive
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkExportCsv}
                className="flex items-center gap-1 text-[11px] py-1"
              >
                <Download className="size-3" />
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkPublishToStorefront}
                disabled={isBulkUpdating}
                className="flex items-center gap-1 text-[11px] py-1 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                title="Publish selected items to Online Storefront"
              >
                <Globe className="size-3" />
                Publish to Storefront
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-default rounded-lg border border-default bg-surface hover:bg-surface-sunken transition-colors cursor-pointer"
                title="Import products from Excel (.xlsx) or CSV"
              >
                <Upload className="size-3 text-primary" />
                <span>Import Products</span>
              </button>
              <button
                type="button"
                onClick={handleBulkExportCsv}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-default rounded-lg border border-default bg-surface hover:bg-surface-sunken transition-colors cursor-pointer"
                title="Export all visible products to CSV"
              >
                <Download className="size-3 text-muted" />
                <span>Export All CSV</span>
              </button>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-primary hover:text-primary-hover rounded-lg border border-primary/30 bg-primary-subtle transition-colors cursor-pointer"
              >
                <span>Select All Visible</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table Data */}
      <QueryBoundary
        status={productsQuery.status}
        error={productsQuery.error}
        data={productsQuery.data}
        isFetching={productsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200 border-collapse">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    ref={indeterminateRef}
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all products"
                    className="size-4 rounded-sm border-slate-300 dark:border-slate-700 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-colors"
                  />
                </th>
                <th className="py-3.5 pl-2 pr-3">Product SKU & Name</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3">Standard Cost</th>
                <th className="py-3.5 px-3">Sale Price</th>
                <th className="py-3.5 px-3">Stock / Qty</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="size-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        No products found
                      </p>
                      <p className="text-xs text-slate-400">
                        Click "New Product" above to create your first catalogue item.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const pMeta = p.online_meta as { image_url?: string } | null;
                  const thumb = p.image_url || pMeta?.image_url;
                  const isSelected = selectedProductIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'transition-colors group',
                        isSelected
                          ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      )}
                    >
                      <td className="py-3 pl-4 pr-2 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          aria-label={`Select product ${p.name}`}
                          className="size-4 rounded-sm border-slate-300 dark:border-slate-700 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-colors"
                        />
                      </td>
                      <td className="py-3 pl-2 pr-3">
                        <div className="flex items-center gap-3">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={p.name}
                              className="size-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-primary font-mono">{p.sku}</span>
                              {p.barcode && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  {p.barcode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 capitalize">
                          <Tag className="h-3 w-3 text-slate-400" />
                          {p.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {formatCurrency(p.standard_cost)}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(p.default_sale_price)}
                      </td>
                      <td className="py-3 px-3">
                        {p.is_stock_tracked ? (
                          (() => {
                            const qty = Number(p.stock_quantity ?? 0);
                            const reorderLevel = Number(p.reorder_level || 0);
                            const unitCode = unitMap.get(String(p.base_unit_id)) || 'PCS';
                            const isOutOfStock = qty <= 0;
                            const isLowStock = !isOutOfStock && qty <= reorderLevel;

                            return (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white text-xs">
                                  <span>
                                    {qty.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-[10px] font-normal uppercase text-slate-400">
                                    {unitCode}
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-semibold tracking-wide uppercase ${
                                      isOutOfStock
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        : isLowStock
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    }`}
                                  >
                                    <span
                                      className={`size-1.5 rounded-full ${
                                        isOutOfStock
                                          ? 'bg-rose-500'
                                          : isLowStock
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                      }`}
                                    />
                                    {isOutOfStock
                                      ? 'Out of Stock'
                                      : isLowStock
                                        ? 'Low Stock'
                                        : 'In Stock'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            Non-stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            p.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingProduct(p)}
                            className="inline-flex items-center justify-center size-7.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-2xs"
                            title="View Specs & Details"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(p)}
                            className="inline-flex items-center justify-center size-7.5 rounded-xl text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all cursor-pointer border border-transparent shadow-2xs"
                            title="Duplicate Product & Specs"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center justify-center size-7.5 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all cursor-pointer border border-transparent shadow-2xs"
                            title="Edit Product & Specs"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedLabelProducts([p])}
                            className="inline-flex items-center justify-center size-7.5 rounded-xl text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all cursor-pointer border border-transparent shadow-2xs"
                            title="Thermal Barcode Label"
                          >
                            <QrCode className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStorefrontPublish(p, !p.is_online)}
                            className={cn(
                              "inline-flex items-center justify-center size-7.5 rounded-xl transition-all cursor-pointer border shadow-2xs",
                              p.is_online
                                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20"
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 border-transparent hover:border-indigo-500/20"
                            )}
                            title={p.is_online ? "Published to Online Storefront (Click to unpublish)" : "Publish to Online Storefront"}
                          >
                            <Globe className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="inline-flex items-center justify-center size-7.5 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer border border-transparent shadow-2xs"
                            title="Delete Product"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </QueryBoundary>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE PRODUCT MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Product"
        subtitle="Register catalog items with units, pricing, media, specs and custom HTML notes"
        icon={<Package className="size-4.5" />}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(draft);
          }}
          className="space-y-5"
        >
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-rose-500" />
              {errorMsg}
            </div>
          )}

          {/* Form Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveFormTab('general')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFormTab === 'general'
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Package className="size-3.5" />
              <span>General & Units</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('pricing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFormTab === 'pricing'
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <DollarSign className="size-3.5" />
              <span>Pricing & Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('media')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFormTab === 'media'
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="size-3.5" />
              <span>Media & HTML Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('seo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFormTab === 'seo'
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Compass className="size-3.5" />
              <span>SEO & Discoverability</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('custom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFormTab === 'custom'
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>Custom Attributes</span>
            </button>
          </div>

          {/* TAB 1: General & Units */}
          {activeFormTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Code <span className="text-primary">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. FG-BRD-001"
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none uppercase font-mono shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Type <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                      aria-label="Product Type"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="finished">Finished Goods</option>
                      <option value="semi_finished">Semi-Finished / WIP</option>
                      <option value="raw_material">Raw Material</option>
                      <option value="packaging">Packaging Material</option>
                      <option value="consumable">Consumable</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Name <span className="text-primary">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Infrared Cooker 2200W (SM-IC220)"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                />
              </div>

              {/* Base Unit, Category, Brand with Quick-Add Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Base Unit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Base Unit <span className="text-primary">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickUnitOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      title="Quick Add Unit"
                    >
                      <Plus className="size-3" /> Quick Add
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      required
                      value={draft.base_unit_id}
                      onChange={(e) => setDraft({ ...draft, base_unit_id: e.target.value })}
                      aria-label="Base Unit"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="">Select Unit</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickCategoryOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      title="Quick Add Category"
                    >
                      <Plus className="size-3" /> Quick Add
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={draft.category_id ?? ''}
                      onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
                      aria-label="Category"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="">None (General)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Brand */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Brand
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickBrandOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      title="Quick Add Brand"
                    >
                      <Plus className="size-3" /> Quick Add
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={draft.brand_id ?? ''}
                      onChange={(e) => setDraft({ ...draft, brand_id: e.target.value || null })}
                      aria-label="Brand"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="">None (Unbranded)</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Tracking Mode */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lifecycle Status
                  </label>
                  <div className="relative">
                    <select
                      value={draft.status ?? 'active'}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                      aria-label="Lifecycle Status"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="active">Active (Production & Sales)</option>
                      <option value="draft">Draft / Planned</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tracking Mode
                  </label>
                  <div className="relative">
                    <select
                      value={draft.tracking_mode ?? 'batch'}
                      onChange={(e) => setDraft({ ...draft, tracking_mode: e.target.value })}
                      aria-label="Tracking Mode"
                      className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="none">Standard Quantity (No Lot)</option>
                      <option value="batch">Batch / Lot Tracking</option>
                      <option value="serial">Unique Serial Numbers</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Pricing & Inventory */}
          {activeFormTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Standard Cost ({currencySymbol} {currencyCode})
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                      {currencySymbol}
                    </span>
                    <input
                      type="text"
                      value={draft.standard_cost}
                      onChange={(e) => setDraft({ ...draft, standard_cost: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    BOM standard valuation cost
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Sale Price ({currencySymbol} {currencyCode})
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {currencySymbol}
                    </span>
                    <input
                      type="text"
                      value={draft.default_sale_price}
                      onChange={(e) => setDraft({ ...draft, default_sale_price: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-2 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Base retail & POS selling price
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reorder Level (Min Buffer)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10"
                    value={draft.reorder_level ?? ''}
                    onChange={(e) => setDraft({ ...draft, reorder_level: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Safety stock trigger threshold
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reorder Quantity (Lot Size)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50"
                    value={draft.reorder_quantity ?? ''}
                    onChange={(e) => setDraft({ ...draft, reorder_quantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Economic order lot size
                  </span>
                </div>
              </div>

              {/* Initial / Opening Stock */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <Package className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Initial Opening Stock</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Opening / Initial Stock (Qty)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="any"
                      value={draft.opening_stock ?? ''}
                      onChange={(e) => setDraft({ ...draft, opening_stock: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Initial on-hand stock balance
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Opening Warehouse
                    </label>
                    <select
                      value={draft.warehouse_id ?? ''}
                      onChange={(e) => setDraft({ ...draft, warehouse_id: e.target.value || null })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                    >
                      <option value="">Default Main Warehouse</option>
                      {warehouses.map((w: WarehouseOption) => (
                        <option key={w.uuid || w.id} value={w.uuid || w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Storage facility for opening inventory
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.is_stock_tracked ?? true}
                    onChange={(e) => setDraft({ ...draft, is_stock_tracked: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      Inventory Stock Tracking
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Keep warehouse ledger & balance audits
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.is_online ?? true}
                    onChange={(e) => setDraft({ ...draft, is_online: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      Publish to Storefront
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Expose on customer online portal & POS
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Media & HTML Notes */}
          {activeFormTab === 'media' && (
            <div className="space-y-4">
              {/* Product Multi-Image Gallery */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Product Image Gallery & Media
                </label>
                <ProductImageGalleryUploader
                  key="create-uploader"
                  queuedImages={createQueuedImages}
                  onQueuedImagesChange={setCreateQueuedImages}
                  primaryImageUrl={draft.image_url}
                  onPrimaryImageChange={(url) => setDraft((prev) => ({ ...prev, image_url: url }))}
                />
              </div>

              {/* Barcode & Physical Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Barcode / EAN-13 / GTIN
                  </label>
                  <div className="relative">
                    <BarcodeIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 890123456789"
                      value={draft.barcode ?? ''}
                      onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Weight (Kg)
                  </label>
                  <div className="relative">
                    <Scale className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 0.500"
                      value={draft.weight ?? ''}
                      onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Product Description & Production Notes with Custom HTML & CSS Support */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileCode className="size-3.5 text-primary" /> Product Description & Production
                    Notes (Custom HTML & CSS)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    HTML5 / CSS3 / Inline Styles
                  </span>
                </label>
                <ProductDescriptionEditor
                  value={draft.description ?? ''}
                  onChange={(val) => setDraft({ ...draft, description: val })}
                  placeholder="<h2>Product Overview</h2><p>Ingredients, allergen notices, packaging specs, custom styled tables...</p>"
                  rows={5}
                />
              </div>
            </div>
          )}

          {/* TAB: SEO & Discoverability */}
          {activeFormTab === 'seo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Custom URL Slug (Product Path)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                        /products/
                      </span>
                      <input
                        type="text"
                        placeholder={
                          draft.name
                            ? draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                            : 'product-slug'
                        }
                        value={draft.online_slug ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            online_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-24 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Clean, search-engine friendly slug. Defaults to product name or SKU if left
                      empty.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Custom SEO Meta Title
                    </label>
                    <input
                      type="text"
                      placeholder={
                        draft.name ? `${draft.name} | Slice Mart` : 'Page Title Override'
                      }
                      value={draft.online_meta?.meta_title ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          online_meta: {
                            ...(draft.online_meta || {}),
                            meta_title: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Custom SEO Meta Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder={
                        draft.description
                          ? draft.description.replace(/<[^>]*>?/gm, '').slice(0, 150)
                          : 'Concise product summary for Google & AI search engines...'
                      }
                      value={draft.online_meta?.meta_description ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          online_meta: {
                            ...(draft.online_meta || {}),
                            meta_description: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs leading-relaxed"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <SerpPreviewCard
                    title={
                      draft.online_meta?.meta_title ||
                      (draft.name ? `${draft.name} | Slice Mart` : 'Product Title')
                    }
                    description={
                      draft.online_meta?.meta_description ||
                      (draft.description
                        ? draft.description.replace(/<[^>]*>?/gm, '').slice(0, 150)
                        : 'Direct factory manufacturing and wholesale catalog.')
                    }
                    urlPath={`/products/${draft.online_slug || draft.sku.toLowerCase() || 'item-sku'}`}
                    imageUrl={draft.image_url || undefined}
                  />

                  <DiscoverabilityChecklist
                    title={draft.online_meta?.meta_title || draft.name || ''}
                    description={draft.online_meta?.meta_description || draft.description || ''}
                    slug={draft.online_slug || undefined}
                    hasImage={Boolean(draft.image_url)}
                    imageAlt={draft.name}
                    hasSchema={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Custom Attributes */}
          {activeFormTab === 'custom' && (
            <div className="py-2">
              <DynamicCustomFields
                module="catalogue"
                entity="product"
                values={draft.custom_attributes}
                onChange={(k, v) =>
                  setDraft((prev) => ({
                    ...prev,
                    custom_attributes: {
                      ...(prev.custom_attributes || {}),
                      [k]: v,
                    },
                  }))
                }
              />
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeFormTab === 'general' && 'Step 1 of 4 · Core Info'}
              {activeFormTab === 'pricing' && 'Step 2 of 4 · Cost & Stock'}
              {activeFormTab === 'media' && 'Step 3 of 4 · Visuals & HTML Notes'}
              {activeFormTab === 'custom' && 'Step 4 of 4 · Custom Attributes'}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending}
                className="shadow-md shadow-primary/20"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Product'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT PRODUCT MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {editingProduct && (
        <Modal
          open={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          title={`Edit Product: ${editingProduct.sku}`}
          subtitle={`Modify specifications for ${editingProduct.name}`}
          icon={<Edit2 className="size-4.5" />}
          size="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingProduct.id,
                payload: draft,
              });
            }}
            className="space-y-5"
          >
            {errorMsg && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                {errorMsg}
              </div>
            )}

            {/* Form Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveFormTab('general')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFormTab === 'general'
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Package className="size-3.5" />
                <span>General & Units</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('pricing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFormTab === 'pricing'
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <DollarSign className="size-3.5" />
                <span>Pricing & Inventory</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('media')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFormTab === 'media'
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileCode className="size-3.5" />
                <span>Media & HTML Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('seo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFormTab === 'seo'
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Compass className="size-3.5" />
                <span>SEO & Discoverability</span>
              </button>
            </div>

            {/* TAB 1: General & Units */}
            {activeFormTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SKU Code <span className="text-primary">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={draft.sku}
                      onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none uppercase font-mono shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Product Type <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={draft.type}
                        onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                        aria-label="Product Type"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="finished">Finished Goods</option>
                        <option value="semi_finished">Semi-Finished / WIP</option>
                        <option value="raw_material">Raw Material</option>
                        <option value="packaging">Packaging Material</option>
                        <option value="consumable">Consumable</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Name <span className="text-primary">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                  />
                </div>

                {/* Base Unit, Category, Brand with Quick-Add */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Base Unit */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Base Unit <span className="text-primary">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsQuickUnitOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3" /> Quick Add
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        required
                        value={draft.base_unit_id}
                        onChange={(e) => setDraft({ ...draft, base_unit_id: e.target.value })}
                        aria-label="Base Unit"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="">Select Unit</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Category
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsQuickCategoryOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3" /> Quick Add
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={draft.category_id ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, category_id: e.target.value || null })
                        }
                        aria-label="Category"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="">None (General)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Brand */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Brand
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsQuickBrandOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3" /> Quick Add
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={draft.brand_id ?? ''}
                        onChange={(e) => setDraft({ ...draft, brand_id: e.target.value || null })}
                        aria-label="Brand"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="">None (Unbranded)</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status & Tracking Mode */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Lifecycle Status
                    </label>
                    <div className="relative">
                      <select
                        value={draft.status ?? 'active'}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                        aria-label="Lifecycle Status"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="active">Active (Production & Sales)</option>
                        <option value="draft">Draft / Planned</option>
                        <option value="discontinued">Discontinued</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tracking Mode
                    </label>
                    <div className="relative">
                      <select
                        value={draft.tracking_mode ?? 'batch'}
                        onChange={(e) => setDraft({ ...draft, tracking_mode: e.target.value })}
                        aria-label="Tracking Mode"
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="none">Standard Quantity (No Lot)</option>
                        <option value="batch">Batch / Lot Tracking</option>
                        <option value="serial">Unique Serial Numbers</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Pricing & Inventory */}
            {activeFormTab === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Standard Cost ({currencySymbol} {currencyCode})
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        value={draft.standard_cost}
                        onChange={(e) => setDraft({ ...draft, standard_cost: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Sale Price ({currencySymbol} {currencyCode})
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        value={draft.default_sale_price}
                        onChange={(e) => setDraft({ ...draft, default_sale_price: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-3 py-2 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reorder Level (Min Buffer)
                    </label>
                    <input
                      type="text"
                      value={draft.reorder_level ?? ''}
                      onChange={(e) => setDraft({ ...draft, reorder_level: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Safety stock trigger threshold
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reorder Quantity (Lot Size)
                    </label>
                    <input
                      type="text"
                      value={draft.reorder_quantity ?? ''}
                      onChange={(e) => setDraft({ ...draft, reorder_quantity: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Economic order lot size
                    </span>
                  </div>
                </div>

                {/* Initial / Opening Stock */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    <Package className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Initial Opening Stock</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Opening / Initial Stock (Qty)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="any"
                        value={draft.opening_stock ?? ''}
                        onChange={(e) => setDraft({ ...draft, opening_stock: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Initial on-hand stock balance
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Opening Warehouse
                      </label>
                      <select
                        value={draft.warehouse_id ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, warehouse_id: e.target.value || null })
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                      >
                        <option value="">Default Main Warehouse</option>
                        {warehouses.map((w: WarehouseOption) => (
                          <option key={w.uuid || w.id} value={w.uuid || w.id}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Storage facility for opening inventory
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={draft.is_stock_tracked ?? true}
                      onChange={(e) => setDraft({ ...draft, is_stock_tracked: e.target.checked })}
                      className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                        Inventory Stock Tracking
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Keep warehouse ledger & balance audits
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={draft.is_online ?? true}
                      onChange={(e) => setDraft({ ...draft, is_online: e.target.checked })}
                      className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                        Publish to Storefront
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Expose on customer online portal & POS
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: Media & HTML Notes */}
            {activeFormTab === 'media' && (
              <div className="space-y-4">
                {/* Product Multi-Image Gallery */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Product Image Gallery & Media
                  </label>
                  <ProductImageGalleryUploader
                    key={editingProduct.id}
                    productUuid={editingProduct.id}
                    existingImages={editingProduct.images || EMPTY_PRODUCT_IMAGES}
                    primaryImageUrl={draft.image_url}
                    onPrimaryImageChange={(url) => setDraft((prev) => ({ ...prev, image_url: url }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Barcode / EAN-13 / GTIN
                    </label>
                    <div className="relative">
                      <BarcodeIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. 890123456789"
                        value={draft.barcode ?? ''}
                        onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unit Weight (Kg)
                    </label>
                    <div className="relative">
                      <Scale className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. 0.500"
                        value={draft.weight ?? ''}
                        onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Description & Production Notes with Custom HTML & CSS Support */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="size-3.5 text-primary" /> Product Description &
                      Production Notes (Custom HTML & CSS)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      HTML5 / CSS3 / Inline Styles
                    </span>
                  </label>
                  <ProductDescriptionEditor
                    value={draft.description ?? ''}
                    onChange={(val) => setDraft({ ...draft, description: val })}
                    placeholder="<h2>Product Overview</h2><p>Ingredients, allergen notices, packaging specs, custom styled tables...</p>"
                    rows={5}
                  />
                </div>
              </div>
            )}

            {/* TAB: SEO & Discoverability */}
            {activeFormTab === 'seo' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Custom URL Slug (Product Path)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                          /products/
                        </span>
                        <input
                          type="text"
                          placeholder={
                            draft.name
                              ? draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                              : 'product-slug'
                          }
                          value={draft.online_slug ?? ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              online_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-24 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Clean, search-engine friendly slug. Defaults to product name or SKU if left
                        empty.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Custom SEO Meta Title
                      </label>
                      <input
                        type="text"
                        placeholder={
                          draft.name ? `${draft.name} | Slice Mart` : 'Page Title Override'
                        }
                        value={draft.online_meta?.meta_title ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            online_meta: {
                              ...(draft.online_meta || {}),
                              meta_title: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Custom SEO Meta Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder={
                          draft.description
                            ? draft.description.replace(/<[^>]*>?/gm, '').slice(0, 150)
                            : 'Concise product summary for Google & AI search engines...'
                        }
                        value={draft.online_meta?.meta_description ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            online_meta: {
                              ...(draft.online_meta || {}),
                              meta_description: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SerpPreviewCard
                      title={
                        draft.online_meta?.meta_title ||
                        (draft.name ? `${draft.name} | Slice Mart` : 'Product Title')
                      }
                      description={
                        draft.online_meta?.meta_description ||
                        (draft.description
                          ? draft.description.replace(/<[^>]*>?/gm, '').slice(0, 150)
                          : 'Direct factory manufacturing and wholesale catalog.')
                      }
                      urlPath={`/products/${draft.online_slug || draft.sku.toLowerCase() || 'item-sku'}`}
                      imageUrl={draft.image_url || undefined}
                    />

                    <DiscoverabilityChecklist
                      title={draft.online_meta?.meta_title || draft.name || ''}
                      description={draft.online_meta?.meta_description || draft.description || ''}
                      slug={draft.online_slug || undefined}
                      hasImage={Boolean(draft.image_url)}
                      imageAlt={draft.name}
                      hasSchema={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeFormTab === 'general' && 'Step 1 of 3 · Core Info'}
                {activeFormTab === 'pricing' && 'Step 2 of 3 · Cost & Stock'}
                {activeFormTab === 'media' && 'Step 3 of 3 · Visuals & HTML Notes'}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="shadow-md shadow-primary/20"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update Product'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK ADD BASE UNIT MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={isQuickUnitOpen}
        onClose={() => setIsQuickUnitOpen(false)}
        title="Quick Add Unit of Measure"
        subtitle="Create a new unit and auto-select it for this product"
        icon={<Ruler className="size-4.5" />}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            quickAddUnitMutation.mutate(quickUnitDraft);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit Code <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. KG, LTR, BOX, PCS, PACK"
              value={quickUnitDraft.code}
              onChange={(e) =>
                setQuickUnitDraft({ ...quickUnitDraft, code: e.target.value.toUpperCase() })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white uppercase font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit Name <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Kilogram, Litre, Carton Box"
              value={quickUnitDraft.name}
              onChange={(e) => setQuickUnitDraft({ ...quickUnitDraft, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dimension Type
              </label>
              <div className="relative">
                <select
                  value={quickUnitDraft.type}
                  onChange={(e) => setQuickUnitDraft({ ...quickUnitDraft, type: e.target.value })}
                  aria-label="Dimension Type"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                >
                  <option value="piece">Piece / Discrete</option>
                  <option value="weight">Mass / Weight</option>
                  <option value="volume">Liquid / Volume</option>
                  <option value="length">Length / Linear</option>
                  <option value="area">Area / Surface</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Decimal Precision
              </label>
              <div className="relative">
                <select
                  value={quickUnitDraft.precision}
                  onChange={(e) =>
                    setQuickUnitDraft({ ...quickUnitDraft, precision: Number(e.target.value) })
                  }
                  aria-label="Decimal Precision"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
                >
                  <option value={0}>0 (Integers, e.g. 1, 2)</option>
                  <option value={2}>2 (e.g. 1.25)</option>
                  <option value={3}>3 (e.g. 0.375)</option>
                  <option value={4}>4 (Precision: 0.0001)</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsQuickUnitOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={quickAddUnitMutation.isPending}
              className="shadow-sm shadow-primary/20"
            >
              {quickAddUnitMutation.isPending ? 'Adding...' : 'Add Unit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK ADD CATEGORY MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={isQuickCategoryOpen}
        onClose={() => setIsQuickCategoryOpen(false)}
        title="Quick Add Category"
        subtitle="Create a new classification category and auto-select it"
        icon={<Layers className="size-4.5" />}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            quickAddCategoryMutation.mutate(quickCategoryDraft);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category Code <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. CAT-BRD, CAT-RAW"
              value={quickCategoryDraft.code}
              onChange={(e) =>
                setQuickCategoryDraft({ ...quickCategoryDraft, code: e.target.value.toUpperCase() })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white uppercase font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category Name <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Infrared Cookers, Gas Stoves, Electronic Components"
              value={quickCategoryDraft.name}
              onChange={(e) =>
                setQuickCategoryDraft({ ...quickCategoryDraft, name: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parent Category (Optional)
            </label>
            <div className="relative">
              <select
                value={quickCategoryDraft.parent_id ?? ''}
                onChange={(e) =>
                  setQuickCategoryDraft({
                    ...quickCategoryDraft,
                    parent_id: e.target.value || null,
                  })
                }
                aria-label="Parent Category (Optional)"
                className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs cursor-pointer font-medium"
              >
                <option value="">Top-Level Category (None)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsQuickCategoryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={quickAddCategoryMutation.isPending}
              className="shadow-sm shadow-primary/20"
            >
              {quickAddCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK ADD BRAND MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={isQuickBrandOpen}
        onClose={() => setIsQuickBrandOpen(false)}
        title="Quick Add Brand"
        subtitle="Register a new commercial or supplier brand and auto-select it"
        icon={<Boxes className="size-4.5" />}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            quickAddBrandMutation.mutate(quickBrandDraft);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Code <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. BRD-SLM, BRD-GLD"
              value={quickBrandDraft.code}
              onChange={(e) =>
                setQuickBrandDraft({ ...quickBrandDraft, code: e.target.value.toUpperCase() })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white uppercase font-mono focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Name <span className="text-primary">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Signature Series, Baker's Choice"
              value={quickBrandDraft.name}
              onChange={(e) => setQuickBrandDraft({ ...quickBrandDraft, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsQuickBrandOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={quickAddBrandMutation.isPending}
              className="shadow-sm shadow-primary/20"
            >
              {quickAddBrandMutation.isPending ? 'Adding...' : 'Add Brand'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW PRODUCT SPECIFICATIONS MODAL (With Rich Custom HTML/CSS Rendering)
          ═══════════════════════════════════════════════════════════════════════ */}
      {viewingProduct && (
        <Modal
          open={Boolean(viewingProduct)}
          onClose={() => setViewingProduct(null)}
          title={viewingProduct.name}
          subtitle={`SKU: ${viewingProduct.sku} · Complete Technical Specification`}
          icon={<Package className="size-4.5" />}
          size="lg"
        >
          <div className="space-y-5 text-xs">
            {/* Hero Card */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              {(() => {
                const meta = viewingProduct.online_meta as { image_url?: string } | null;
                const photo = viewingProduct.image_url || meta?.image_url;
                const gallery = viewingProduct.images || [];
                return (
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt={viewingProduct.name}
                        className="size-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-md"
                      />
                    ) : (
                      <div className="size-24 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-2xs">
                        <Package className="size-10 text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                    {gallery.length > 1 && (
                      <div className="flex items-center gap-1 max-w-30 overflow-x-auto py-1">
                        {gallery.map((img) => (
                          <img
                            key={img.id}
                            src={img.url}
                            alt=""
                            className="size-6 rounded-md object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="font-mono font-bold text-primary text-sm">
                    {viewingProduct.sku}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 capitalize">
                    {viewingProduct.type.replace('_', ' ')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      viewingProduct.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {viewingProduct.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {viewingProduct.name}
                </h3>
              </div>
            </div>

            {/* Live Stock & Inventory Availability */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Inventory & Stock Availability
                  </span>
                </div>
                {viewingProduct.is_stock_tracked ? (
                  (() => {
                    const qty = Number(viewingProduct.stock_quantity ?? 0);
                    const reorderLevel = Number(viewingProduct.reorder_level || 0);
                    const isOutOfStock = qty <= 0;
                    const isLowStock = !isOutOfStock && qty <= reorderLevel;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          isOutOfStock
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : isLowStock
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                        {isOutOfStock
                          ? 'Out of Stock'
                          : isLowStock
                            ? 'Low Stock Warning'
                            : 'In Stock'}
                      </span>
                    );
                  })()
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Non-stock / Untracked
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Live Available Stock
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5 block">
                    {viewingProduct.is_stock_tracked
                      ? `${Number(viewingProduct.stock_quantity ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unitMap.get(String(viewingProduct.base_unit_id)) || 'Units'}`
                      : 'Not Tracked'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Reorder Minimum
                  </span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-sm mt-0.5 block">
                    {viewingProduct.reorder_level || '10'}{' '}
                    {unitMap.get(String(viewingProduct.base_unit_id)) || 'Units'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Reorder Batch Lot
                  </span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-sm mt-0.5 block">
                    {viewingProduct.reorder_quantity || '50'}{' '}
                    {unitMap.get(String(viewingProduct.base_unit_id)) || 'Units'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Stock Tracking Mode
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-sm mt-0.5 block capitalize">
                    {viewingProduct.tracking_mode || 'Batch'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financials & Stock Ledger Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Standard Cost
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white text-sm mt-0.5 block">
                  {formatCurrency(viewingProduct.standard_cost)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Sale Price
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">
                  {formatCurrency(viewingProduct.default_sale_price)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Gross Margin
                </span>
                <span className="font-mono font-bold text-primary text-sm mt-0.5 block">
                  {(() => {
                    const cost = Number(viewingProduct.standard_cost) || 0;
                    const price = Number(viewingProduct.default_sale_price) || 0;
                    if (price <= 0) return '0.0%';
                    const margin = ((price - cost) / price) * 100;
                    return `${margin.toFixed(1)}%`;
                  })()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Tracking Mode
                </span>
                <span className="font-medium text-slate-900 dark:text-white text-xs mt-1 block capitalize">
                  {viewingProduct.tracking_mode || 'Batch'}
                </span>
              </div>
            </div>

            {/* Technical Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Barcode / EAN
                </span>
                <span className="font-mono text-slate-900 dark:text-white font-medium mt-0.5 block">
                  {viewingProduct.barcode || '—'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Reorder Buffer / Lot
                </span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">
                  Min: {viewingProduct.reorder_level || '10'} · Lot:{' '}
                  {viewingProduct.reorder_quantity || '50'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Unit Weight / Mass
                </span>
                <span className="font-medium text-slate-900 dark:text-white mt-0.5 block">
                  {viewingProduct.weight ? `${viewingProduct.weight} kg` : '—'}
                </span>
              </div>
            </div>

            {/* Rendered HTML & CSS Description */}
            {viewingProduct.description && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="size-3.5 text-primary" /> Product Specifications & Notes
                </span>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 max-h-75 overflow-y-auto">
                  <RenderHtmlContent html={viewingProduct.description} />
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Validated against central ERP catalog schema
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setViewingProduct(null);
                    handleOpenEdit(viewingProduct);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Edit2 className="size-3.5" /> Edit Specs
                </Button>
                <Button variant="primary" onClick={() => setViewingProduct(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DELETE PRODUCT CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {deletingProduct && (
        <Modal
          open={Boolean(deletingProduct)}
          onClose={() => setDeletingProduct(null)}
          title="Delete Product"
          subtitle="Confirm removal from active production & sales catalog"
          icon={<Trash2 className="size-4.5 text-rose-500" />}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
              Are you sure you want to delete product{' '}
              <strong className="text-primary font-mono">{deletingProduct.sku}</strong> (
              {deletingProduct.name})?
            </p>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
              ⚠️ Deleting this product is protected: any historical inventory transactions or
              production batches will retain ledger integrity.
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setDeletingProduct(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingProduct.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FLOATING DOCKED BULK ACTIONS TOOLBAR
          ═══════════════════════════════════════════════════════════════════════ */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-fg font-mono">
              {selectedProductIds.size}
            </span>
            <span className="text-xs font-semibold whitespace-nowrap">Selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 ml-1 cursor-pointer transition-colors"
              title="Clear selection (Esc)"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkPrintBarcodes}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 flex items-center gap-1.5"
            >
              <QrCode className="size-3.5 text-primary" />
              <span>Print Barcodes</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('active')}
              disabled={isBulkUpdating}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700 flex items-center gap-1.5"
            >
              <ShieldCheck className="size-3.5" />
              <span>Active</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('inactive')}
              disabled={isBulkUpdating}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700 flex items-center gap-1.5"
            >
              <span>Inactive</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkExportCsv}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 flex items-center gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={() => setIsBulkDeleting(true)}
              disabled={isBulkUpdating}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleting && (
        <Modal
          open={isBulkDeleting}
          onClose={() => setIsBulkDeleting(false)}
          title="Delete Selected Products"
          subtitle={`Confirm removal of ${selectedProducts.length} items from catalog`}
          icon={<Trash2 className="size-4.5 text-rose-500" />}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-bold">
                {selectedProducts.length}
              </strong>{' '}
              selected products?
            </p>
            <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-surface-sunken border border-default">
              {selectedProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-default truncate">{p.name}</span>
                  <span className="font-mono text-muted shrink-0 ml-2">{p.sku}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
              ⚠️ Deleting these products is protected: any historical inventory transactions or production batches retain full audit integrity.
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-default">
              <Button variant="secondary" onClick={() => setIsBulkDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? 'Deleting...' : `Confirm Delete (${selectedProducts.length})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Barcode / Thermal Label Generator Modal (Multi-Product & Batch Supported) */}
      {selectedLabelProducts.length > 0 && (
        <BarcodeGeneratorModal
          isOpen={selectedLabelProducts.length > 0}
          onClose={() => setSelectedLabelProducts([])}
          initialProducts={selectedLabelProducts.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode || p.sku,
            sale_price: p.default_sale_price || '0.00',
            currency: currencySymbol,
            unit_code: unitMap.get(String(p.base_unit_id)) || 'PCS',
            batch_code: 'BAT-2026',
            quantity: 4,
          }))}
        />
      )}
      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={productImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'products'] });
        }}
      />
    </div>
  );
}
