<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\StorefrontProduct;
use App\Models\Tenant;
use App\Modules\Ecommerce\Services\Seo\SeoMetadataService;
use App\Modules\Ecommerce\Services\Seo\StructuredDataBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StorefrontCatalogController extends Controller
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService = new SeoMetadataService(),
        protected StructuredDataBuilder $structuredDataBuilder = new StructuredDataBuilder()
    ) {}

    /**
     * Get storefront configuration, branding, and organization structured data.
     */
    public function config(Request $request): JsonResponse
    {
        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');
        $tenantId = $storefront?->tenant_id ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : null);
        $tenant = $tenantId ? Tenant::find($tenantId) : Tenant::first();

        // Dynamically resolve statutory legal entity name and operating brand name
        $resolvedLegalName = null;
        $resolvedCompanyName = null;
        if ($tenant) {
            $legalSetting = \App\Models\Setting::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('group', 'general')
                ->where('key', 'company_legal_name')
                ->first();
            $brandSetting = \App\Models\Setting::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('group', 'general')
                ->where('key', 'company_name')
                ->first();

            $resolvedLegalName = $legalSetting?->getTypedValue();
            if (empty($resolvedLegalName) && is_array($tenant->branding)) {
                $resolvedLegalName = $tenant->branding['company_legal_name'] ?? null;
            }
            if (empty($resolvedLegalName)) {
                $company = \App\Models\Company::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('is_default', true)
                    ->first()
                    ?? \App\Models\Company::withoutTenantScope()->where('tenant_id', $tenant->id)->first();
                $resolvedLegalName = $company?->legal_name ?? $company?->name ?? $tenant->name;
            }

            $resolvedCompanyName = $brandSetting?->getTypedValue();
            if (empty($resolvedCompanyName) && is_array($tenant->branding)) {
                $resolvedCompanyName = $tenant->branding['company_name'] ?? null;
            }
            if (empty($resolvedCompanyName)) {
                $resolvedCompanyName = $tenant->name;
            }
        }

        // Keep storefront name synchronized with the brand or legal identity
        $storefrontName = $storefront->name;
        if (empty($storefrontName) || preg_match('/\b(Online Store|Direct Storefront)\b/i', $storefrontName)) {
            $effectiveBrand = $resolvedCompanyName ?: ($resolvedLegalName ?: 'Official Store');
            $syncedName = $effectiveBrand . ' Online Store';
            if ($storefrontName !== $syncedName) {
                $storefrontName = $syncedName;
                if ($storefront->name !== $syncedName) {
                    $storefront->name = $syncedName;
                    $storefront->save();
                }
            }
        }

        $theme = $storefront->theme ?? [
            'primary_color' => '#10b981',
            'accent_color' => '#065f46',
            'hero_title' => 'Direct from the Factory',
            'hero_subtitle' => 'Premium products manufactured to perfection',
        ];
        if ($resolvedLegalName) {
            $theme['legal_name'] = $resolvedLegalName;
        }
        if ($resolvedCompanyName) {
            $theme['brand_name'] = $resolvedCompanyName;
        }

        $seoSettings = $tenant ? $this->seoMetadataService->getTenantSeoSettings($tenant->id) : null;
        $orgSchema = $tenant ? $this->structuredDataBuilder->buildOrganizationSchema($tenant, $storefront) : null;
        $websiteSchema = $tenant ? $this->structuredDataBuilder->buildWebSiteSchema($tenant, $storefront) : null;

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $storefront->id,
                'uuid' => $storefront->uuid,
                'name' => $storefrontName,
                'legal_name' => $resolvedLegalName,
                'company_name' => $resolvedCompanyName,
                'code' => $storefront->code,
                'domain' => $storefront->domain,
                'subdomain' => $storefront->subdomain,
                'currency' => $storefront->currency,
                'locale' => $storefront->locale,
                'theme' => $theme,
                'meta_title' => $storefront->meta_title ?? $storefrontName,
                'meta_description' => $storefront->meta_description,
                'guest_checkout_enabled' => $storefront->guest_checkout_enabled,
                'cod_enabled' => $storefront->cod_enabled,
                'online_payment_enabled' => $storefront->online_payment_enabled,
                'whatsapp_number' => $storefront->whatsapp_number,
                'whatsapp_ordering_enabled' => $storefront->whatsapp_ordering_enabled ?? true,
                'whatsapp_default_message' => $storefront->whatsapp_default_message,
                'min_order_amount' => $storefront->min_order_amount,
                'status' => $storefront->status,
                'seo' => [
                    'settings' => $seoSettings,
                    'organization_schema' => $orgSchema,
                    'website_schema' => $websiteSchema,
                ],
            ],
        ]);
    }

    /**
     * List products available in the storefront catalog.
     */
    public function products(Request $request): JsonResponse
    {
        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');

        $query = Product::query()
            ->where('status', 'active')
            ->where('type', '!=', 'raw_material');

        if ($storefront) {
            $query->where(function ($q) use ($storefront): void {
                $q->whereExists(function ($ex) use ($storefront): void {
                    $ex->select(\Illuminate\Support\Facades\DB::raw(1))
                        ->from('storefront_products')
                        ->whereColumn('storefront_products.product_id', 'products.id')
                        ->where('storefront_products.storefront_id', $storefront->id)
                        ->where('storefront_products.is_available', true);
                })->orWhere(function ($fallback) use ($storefront): void {
                    $fallback->whereNotExists(function ($nex) use ($storefront): void {
                        $nex->select(\Illuminate\Support\Facades\DB::raw(1))
                            ->from('storefront_products')
                            ->whereColumn('storefront_products.product_id', 'products.id')
                            ->where('storefront_products.storefront_id', $storefront->id);
                    })->where(function ($online): void {
                        $online->where('is_online', true)
                            ->orWhere(function ($f): void {
                                $f->whereNull('is_online')->where('type', 'finished');
                            });
                    });
                });
            });
        }

        $query->with(['category:id,name,code', 'brand:id,name,code', 'baseUnit:id,name,code', 'variants', 'images']);

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->query('category_id'));
        }

        if ($request->filled('q')) {
            $searchTerm = trim((string) $request->query('q'));
            $query->where(function ($q) use ($searchTerm): void {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('sku', 'like', "%{$searchTerm}%")
                    ->orWhere('description', 'like', "%{$searchTerm}%");
            });
        }

        $perPage = min(50, max(1, (int) ($request->query('per_page') ?? 20)));
        $products = $query->paginate($perPage);

        $sfProducts = $storefront
            ? StorefrontProduct::where('storefront_id', $storefront->id)
                ->whereIn('product_id', $products->pluck('id'))
                ->get()
                ->keyBy('product_id')
            : collect();

        $items = $products->getCollection()->map(function ($product) use ($sfProducts) {
            $sfProd = $sfProducts->get($product->id);
            $array = $product->toArray();
            if ($sfProd) {
                if (! empty($sfProd->display_name_override)) {
                    $array['name'] = $sfProd->display_name_override;
                }
                if (! empty($sfProd->price_override)) {
                    $array['default_sale_price'] = (string) $sfProd->price_override;
                }
                if (! empty($sfProd->compare_at_price)) {
                    $array['compare_at_price'] = (string) $sfProd->compare_at_price;
                }
                $array['is_featured'] = (bool) $sfProd->is_featured;
            }
            return $array;
        });

        return response()->json([
            'success' => true,
            'data' => $items->values()->all(),
            'meta' => [
                'pagination' => [
                    'total' => $products->total(),
                    'per_page' => $products->perPage(),
                    'current_page' => $products->currentPage(),
                    'last_page' => $products->lastPage(),
                ],
            ],
        ]);
    }

    /**
     * Get a single product by ID or SKU with full SEO & Schema.
     */
    public function product(Request $request, string $idOrSku): JsonResponse
    {
        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');
        $tenantId = $storefront?->tenant_id ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : null);
        $tenant = $tenantId ? Tenant::find($tenantId) : Tenant::first();

        $product = Product::query()
            ->where('status', 'active')
            ->where(function ($q) use ($idOrSku): void {
                if (is_numeric($idOrSku)) {
                    $q->where('id', $idOrSku);
                } else {
                    $q->where('sku', $idOrSku)->orWhere('online_slug', $idOrSku);
                }
            })
            ->with(['category', 'brand', 'baseUnit', 'variants', 'images'])
            ->first();

        if (! $product) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PRODUCT_NOT_FOUND',
                    'message' => 'Product not found in this catalog.',
                ],
            ], 404);
        }

        $seoMeta = $tenant ? $this->seoMetadataService->generateProductMetadata($product, $tenant, $storefront) : [];
        $productSchema = $tenant ? $this->structuredDataBuilder->buildProductSchema($product, $tenant, $storefront) : [];

        $breadcrumbs = [
            ['name' => 'Home', 'url' => '/'],
            ['name' => 'All Products', 'url' => '/products'],
        ];
        if ($product->category) {
            $catSlug = $product->category->slug ?? strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $product->category->name));
            $breadcrumbs[] = ['name' => $product->category->name, 'url' => '/collections/' . $catSlug];
        }
        $breadcrumbs[] = ['name' => $product->name, 'url' => '/products/' . ($product->online_slug ?: $product->sku)];

        $breadcrumbSchema = $tenant ? $this->structuredDataBuilder->buildBreadcrumbSchema($breadcrumbs, $tenant, $storefront) : [];

        $sfProd = $storefront
            ? StorefrontProduct::where('storefront_id', $storefront->id)
                ->where('product_id', $product->id)
                ->first()
            : null;

        $responseData = $product->toArray();
        if ($sfProd) {
            if (! empty($sfProd->display_name_override)) {
                $responseData['name'] = $sfProd->display_name_override;
            }
            if (! empty($sfProd->price_override)) {
                $responseData['default_sale_price'] = (string) $sfProd->price_override;
            }
            if (! empty($sfProd->compare_at_price)) {
                $responseData['compare_at_price'] = (string) $sfProd->compare_at_price;
            }
            $responseData['is_featured'] = (bool) $sfProd->is_featured;
        }

        $responseData['seo'] = $seoMeta;
        $responseData['schema'] = [
            'product' => $productSchema,
            'breadcrumbs' => $breadcrumbSchema,
        ];
        $responseData['breadcrumb_items'] = $breadcrumbs;

        return response()->json([
            'success' => true,
            'data' => $responseData,
        ]);
    }

    /**
     * List categories available in storefront.
     */
    public function categories(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'parent_id']);

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }
}

