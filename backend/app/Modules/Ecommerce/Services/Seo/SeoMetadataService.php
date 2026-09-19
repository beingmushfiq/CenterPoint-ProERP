<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services\Seo;

use App\Models\Product;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\TenantSeoSetting;

class SeoMetadataService
{
    /**
     * Get or create tenant SEO settings with sensible defaults.
     */
    public function getTenantSeoSettings(int $tenantId): TenantSeoSetting
    {
        $setting = TenantSeoSetting::withoutTenantScope()->where('tenant_id', $tenantId)->first();
        if (! $setting) {
            $storefront = Storefront::withoutTenantScope()->where('tenant_id', $tenantId)->first();
            $tenant = Tenant::find($tenantId);

            $setting = TenantSeoSetting::create([
                'tenant_id' => $tenantId,
                'storefront_id' => $storefront?->id,
                'meta_title_template' => '{title} | {brand}',
                'product_title_template' => '{product_name} | {brand}',
                'category_title_template' => 'Buy {category_name} Online | {brand}',
                'default_meta_title' => $storefront?->name ?? $tenant?->name ?? config('app.name', 'ProERP'),
                'default_meta_description' => $storefront?->meta_description ?? 'Official multi-channel factory and online e-commerce storefront.',
                'business_type' => 'Organization',
                'brand_name' => $storefront?->name ?? $tenant?->name ?? config('app.name', 'ProERP'),
                'legal_name' => $tenant?->name ?? (config('app.name', 'ProERP').' Ltd.'),
                'indexing_enabled' => true,
                'allow_ai_search_crawlers' => true,
                'allow_ai_training_crawlers' => true,
                'sitemap_enabled' => true,
                'sitemap_include_images' => true,
            ]);
        }

        return $setting;
    }

    /**
     * Resolve the absolute base URL for a tenant storefront (preferring verified custom domain).
     */
    public function resolveBaseUrl(Tenant $tenant, ?Storefront $storefront = null): string
    {
        $settings = TenantSeoSetting::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->first();

        if (! empty($settings?->canonical_base_url)) {
            return rtrim($settings->canonical_base_url, '/');
        }

        $subdomain = $storefront?->subdomain ?? $tenant->subdomain ?? 'store';

        $customDomain = TenantDomain::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('verification_status', 'verified')
            ->where('is_primary', true)
            ->first();

        $isDevEnvironment = app()->environment('local', 'testing');
        $requestHost = request()->getHost();
        $isLocalRequest = in_array($requestHost, ['localhost', '127.0.0.1'], true)
            || str_contains((string) request()->header('X-Forwarded-Host', ''), 'localhost')
            || str_contains((string) request()->header('Origin', ''), 'localhost')
            || str_contains((string) request()->header('Referer', ''), 'localhost');

        if ($customDomain) {
            $domain = strtolower($customDomain->domain);
            $isMockPlatformDomain = str_ends_with($domain, '.devcenterpoint.com') || $domain === 'devcenterpoint.com';

            if (! $isMockPlatformDomain || (! $isDevEnvironment && ! $isLocalRequest)) {
                return 'https://' . $domain;
            }
        }

        // In local development or local request, resolve to reachable local URL
        if ($isLocalRequest || $isDevEnvironment) {
            $frontendPort = 5173;
            $origin = request()->header('Origin') ?: request()->header('Referer');
            if ($origin) {
                $parsedOrigin = parse_url($origin);
                if (! empty($parsedOrigin['port'])) {
                    $frontendPort = (int) $parsedOrigin['port'];
                }
            }

            return "http://localhost:{$frontendPort}/store/{$subdomain}";
        }

        $appUrl = config('app.url', 'https://devcenterpoint.com');
        $parsed = parse_url($appUrl);
        $scheme = $parsed['scheme'] ?? 'https';
        $host = $parsed['host'] ?? 'devcenterpoint.com';
        $port = isset($parsed['port']) && ! in_array($parsed['port'], [80, 443]) ? ':' . $parsed['port'] : '';

        return "{$scheme}://{$subdomain}.{$host}{$port}";
    }

    /**
     * Build normalized canonical URL without noisy query parameters.
     */
    public function buildCanonicalUrl(string $baseUrl, string $path): string
    {
        $cleanPath = '/' . ltrim(trim($path), '/');
        if ($cleanPath === '/') {
            $cleanPath = '';
        }

        return rtrim($baseUrl, '/') . $cleanPath;
    }

    /**
     * Format a title according to tenant template.
     */
    public function formatTitle(string $template, array $replacements, string $brand): string
    {
        $replacements['{brand}'] = $brand;
        $title = strtr($template, $replacements);
        return trim($title);
    }

    /**
     * Sanitize and truncate a meta description.
     */
    public function formatDescription(?string $text, ?string $fallback = null, int $maxLength = 160): string
    {
        $raw = $text ?: $fallback ?: '';
        $clean = strip_tags($raw);
        $clean = (string) preg_replace('/\s+/', ' ', $clean);
        $clean = trim($clean);

        if (mb_strlen($clean) <= $maxLength) {
            return $clean;
        }

        return mb_substr($clean, 0, $maxLength - 3) . '...';
    }

    /**
     * Generate metadata payload for a Product page.
     */
    public function generateProductMetadata(Product $product, Tenant $tenant, ?Storefront $storefront = null): array
    {
        $settings = $this->getTenantSeoSettings($tenant->id);
        $brand = $settings->brand_name ?: ($storefront?->name ?: $tenant->name);
        $baseUrl = $this->resolveBaseUrl($tenant, $storefront);

        $onlineMeta = is_array($product->online_meta) ? $product->online_meta : [];
        $customTitle = $onlineMeta['seo_title'] ?? null;
        $customDesc = $onlineMeta['seo_description'] ?? null;
        $customOgImage = $onlineMeta['og_image'] ?? null;

        $title = $customTitle ?: $this->formatTitle($settings->product_title_template, ['{product_name}' => $product->name], $brand);
        $description = $this->formatDescription($customDesc, $product->description, 160);
        $canonical = $this->buildCanonicalUrl($baseUrl, '/products/' . ($product->online_slug ?: $product->sku));

        $imageUrl = $customOgImage;
        if (! $imageUrl && $product->relationLoaded('images') && $product->images->isNotEmpty()) {
            $primaryImg = $product->images->firstWhere('is_primary', true) ?: $product->images->first();
            $imageUrl = $primaryImg?->url ?? $primaryImg?->path;
        }
        if (! $imageUrl) {
            $imageUrl = $settings->default_og_image;
        }

        return [
            'title' => $title,
            'description' => $description,
            'canonical' => $canonical,
            'robots' => ($settings->indexing_enabled && $product->is_online) ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow',
            'og' => [
                'title' => $title,
                'description' => $description,
                'url' => $canonical,
                'type' => 'product',
                'image' => $imageUrl,
                'site_name' => $brand,
            ],
            'twitter' => [
                'card' => $settings->twitter_card_type ?: 'summary_large_image',
                'title' => $title,
                'description' => $description,
                'image' => $imageUrl,
                'site' => $settings->twitter_handle,
            ],
        ];
    }

    /**
     * Generate metadata payload for a CMS Page.
     */
    public function generatePageMetadata(StorefrontPage $page, Tenant $tenant, ?Storefront $storefront = null): array
    {
        $settings = $this->getTenantSeoSettings($tenant->id);
        $brand = $settings->brand_name ?: ($storefront?->name ?: $tenant->name);
        $baseUrl = $this->resolveBaseUrl($tenant, $storefront);

        $title = $page->meta_title ?: $this->formatTitle($settings->meta_title_template, ['{title}' => $page->title], $brand);
        $description = $this->formatDescription($page->meta_description, $settings->default_meta_description, 160);
        $canonical = $this->buildCanonicalUrl($baseUrl, '/pages/' . $page->slug);

        return [
            'title' => $title,
            'description' => $description,
            'canonical' => $canonical,
            'robots' => ($settings->indexing_enabled && $page->status === 'published') ? 'index, follow' : 'noindex, follow',
            'og' => [
                'title' => $title,
                'description' => $description,
                'url' => $canonical,
                'type' => 'website',
                'image' => $settings->default_og_image,
                'site_name' => $brand,
            ],
            'twitter' => [
                'card' => $settings->twitter_card_type ?: 'summary_large_image',
                'title' => $title,
                'description' => $description,
                'image' => $settings->default_og_image,
                'site' => $settings->twitter_handle,
            ],
        ];
    }
}
