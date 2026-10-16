<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services\Seo;

use App\Models\Category;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\Tenant;

class StructuredDataBuilder
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService = new SeoMetadataService
    ) {}

    /**
     * Build Organization / LocalBusiness JSON-LD schema.
     */
    public function buildOrganizationSchema(Tenant $tenant, ?Storefront $storefront = null): array
    {
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $brand = $settings->brand_name ?: ($storefront?->name ?: $tenant->name);
        $legalName = $settings->legal_name ?: $brand;

        $type = in_array($settings->business_type, ['LocalBusiness', 'Store', 'Organization'], true) ? $settings->business_type : 'Organization';

        $socialProfiles = is_array($settings->social_profiles) ? array_values(array_filter($settings->social_profiles)) : [];

        $schema = [
            '@context' => 'https://schema.org',
            '@type' => $type,
            '@id' => $baseUrl.'#organization',
            'name' => $brand,
            'legalName' => $legalName,
            'url' => $baseUrl,
            'logo' => $settings->logo_url ?: ($storefront?->logo_attachment_id ? $baseUrl.'/api/v1/attachments/'.$storefront->logo_attachment_id : null),
            'telephone' => $settings->telephone ?: ($storefront?->whatsapp_number ? '+'.$storefront->whatsapp_number : null),
            'email' => $settings->email,
        ];

        if ($socialProfiles) {
            $schema['sameAs'] = $socialProfiles;
        }

        if ($settings->street_address || $settings->address_locality) {
            $schema['address'] = [
                '@type' => 'PostalAddress',
                'streetAddress' => $settings->street_address,
                'addressLocality' => $settings->address_locality,
                'addressRegion' => $settings->address_region,
                'postalCode' => $settings->postal_code,
                'addressCountry' => $settings->address_country ?: 'BD',
            ];
        }

        if ($settings->geo_latitude && $settings->geo_longitude) {
            $schema['geo'] = [
                '@type' => 'GeoCoordinates',
                'latitude' => (float) $settings->geo_latitude,
                'longitude' => (float) $settings->geo_longitude,
            ];
        }

        if ($settings->opening_hours && is_array($settings->opening_hours)) {
            $schema['openingHoursSpecification'] = $settings->opening_hours;
        }

        if ($settings->price_range) {
            $schema['priceRange'] = $settings->price_range;
        }

        return array_filter($schema, fn ($val) => $val !== null && $val !== '');
    }

    /**
     * Build WebSite schema with Sitelinks SearchAction.
     */
    public function buildWebSiteSchema(Tenant $tenant, ?Storefront $storefront = null): array
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);
        $brand = $settings->brand_name ?: ($storefront?->name ?: $tenant->name);

        return [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            '@id' => $baseUrl.'#website',
            'url' => $baseUrl,
            'name' => $brand,
            'description' => $settings->default_meta_description,
            'publisher' => [
                '@id' => $baseUrl.'#organization',
            ],
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => [
                    '@type' => 'EntryPoint',
                    'urlTemplate' => $baseUrl.'/products?q={search_term_string}',
                ],
                'query-input' => 'required name=search_term_string',
            ],
        ];
    }

    /**
     * Build BreadcrumbList schema.
     * Items format: [['name' => 'Home', 'url' => '/'], ['name' => 'Category', 'url' => '/collections/cat'], ...]
     */
    public function buildBreadcrumbSchema(array $items, Tenant $tenant, ?Storefront $storefront = null): array
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);

        $list = [];
        $position = 1;
        foreach ($items as $item) {
            $url = str_starts_with($item['url'], 'http') ? $item['url'] : rtrim($baseUrl, '/').'/'.ltrim($item['url'], '/');
            $list[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $item['name'],
                'item' => $url,
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $list,
        ];
    }

    /**
     * Build Product & Offer JSON-LD schema from actual product data.
     */
    public function buildProductSchema(Product $product, Tenant $tenant, ?Storefront $storefront = null): array
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);
        $brandName = $settings->brand_name ?: ($storefront?->name ?: $tenant->name);
        $productUrl = $this->seoMetadataService->buildCanonicalUrl($baseUrl, '/products/'.($product->online_slug ?: $product->sku));

        $images = [];
        if ($product->relationLoaded('images') && $product->images->isNotEmpty()) {
            foreach ($product->images as $img) {
                $images[] = $img->url ?? $img->path;
            }
        }
        if (empty($images) && $settings->default_og_image) {
            $images[] = $settings->default_og_image;
        }

        $currency = $storefront?->currency ?: 'USD';
        $price = (float) $product->default_sale_price;

        $isStockAvailable = ($product->is_stock_tracked)
            ? (bool) ($product->stockBalances?->sum('quantity_on_hand') > 0 || ! $product->is_stock_tracked)
            : true;

        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            '@id' => $productUrl.'#product',
            'name' => $product->name,
            'description' => $this->seoMetadataService->formatDescription($product->description, null, 250),
            'sku' => $product->sku,
            'mpn' => $product->sku,
            'url' => $productUrl,
            'brand' => [
                '@type' => 'Brand',
                'name' => $product->brand?->name ?: $brandName,
            ],
            'offers' => [
                '@type' => 'Offer',
                'url' => $productUrl,
                'priceCurrency' => $currency,
                'price' => number_format($price, 2, '.', ''),
                'priceValidUntil' => date('Y-12-31', strtotime('+1 year')),
                'itemCondition' => 'https://schema.org/NewCondition',
                'availability' => $isStockAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                'seller' => [
                    '@type' => 'Organization',
                    'name' => $brandName,
                ],
            ],
        ];

        if (! empty($images)) {
            $schema['image'] = $images;
        }

        if ($product->barcode) {
            $schema['gtin'] = $product->barcode;
        }

        if ($product->category) {
            $schema['category'] = $product->category->name;
        }

        return $schema;
    }

    /**
     * Build ItemList schema for catalog / category page.
     */
    public function buildItemListSchema(iterable $products, string $listName, Tenant $tenant, ?Storefront $storefront = null): array
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $elements = [];
        $position = 1;

        foreach ($products as $p) {
            $productUrl = $this->seoMetadataService->buildCanonicalUrl($baseUrl, '/products/'.($p->online_slug ?: $p->sku));
            $elements[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'url' => $productUrl,
                'name' => $p->name,
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'ItemList',
            'name' => $listName,
            'itemListElement' => $elements,
        ];
    }

    /**
     * Build FAQPage schema.
     * Items format: [['question' => '...', 'answer' => '...'], ...]
     */
    public function buildFaqPageSchema(array $faqs): array
    {
        $mainEntity = [];
        foreach ($faqs as $faq) {
            if (! empty($faq['question']) && ! empty($faq['answer'])) {
                $mainEntity[] = [
                    '@type' => 'Question',
                    'name' => trim((string) $faq['question']),
                    'acceptedAnswer' => [
                        '@type' => 'Answer',
                        'text' => trim((string) $faq['answer']),
                    ],
                ];
            }
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $mainEntity,
        ];
    }
}
