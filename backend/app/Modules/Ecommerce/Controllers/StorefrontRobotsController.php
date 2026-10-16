<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Modules\Ecommerce\Services\Seo\SeoMetadataService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StorefrontRobotsController extends Controller
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService
    ) {}

    /**
     * Generate dynamic robots.txt for tenant storefront.
     */
    public function __invoke(Request $request): Response
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storefront = $request->attributes->get('storefront');

        if (! $tenantId) {
            $subdomain = $request->header('X-Storefront-Subdomain')
                ?: $request->header('X-Tenant-Subdomain')
                ?: $request->query('subdomain');

            $storefront = Storefront::withoutTenantScope()
                ->where('subdomain', $subdomain)
                ->orWhere('domain', $subdomain)
                ->first();

            if (! $storefront) {
                $storefront = Storefront::withoutTenantScope()->first();
            }

            $tenantId = $storefront?->tenant_id ?? Tenant::first()?->id;
        }

        $tenant = Tenant::find($tenantId) ?? Tenant::first();

        $settings = $tenant ? $this->seoMetadataService->getTenantSeoSettings($tenant->id) : null;
        $indexingAllowed = $settings ? (bool) $settings->indexing_enabled : true;

        $lines = [];
        $isProduction = config('app.env') === 'production';
        if (! $isProduction) {
            $lines[] = '# Development Environment (APP_ENV='.config('app.env').')';
        }

        if (! $indexingAllowed) {
            $lines[] = '# Storefront Indexing Disabled in Tenant SEO Settings';
            $lines[] = 'User-agent: *';
            $lines[] = 'Disallow: /';
        } else {
            $baseUrl = $tenant ? $this->seoMetadataService->resolveBaseUrl($tenant, $storefront) : 'http://localhost:5173';

            $lines[] = '# Standard Search Engine Crawlers';
            $lines[] = 'User-agent: *';
            $lines[] = 'Allow: /';
            $lines[] = 'Allow: /products';
            $lines[] = 'Allow: /collections';
            $lines[] = 'Allow: /pages';
            $lines[] = 'Disallow: /cart';
            $lines[] = 'Disallow: /checkout';
            $lines[] = 'Disallow: /account';
            $lines[] = 'Disallow: /track';
            $lines[] = 'Disallow: /order-confirmed';
            $lines[] = 'Disallow: /api/';
            $lines[] = '';

            // AI Search Engines (GPTBot, PerplexityBot, ClaudeBot, Bingbot)
            if ($settings && ! $settings->allow_ai_search_crawlers) {
                $lines[] = '# Disallow AI Search Retrieval Crawlers';
                $lines[] = 'User-agent: GPTBot';
                $lines[] = 'User-agent: PerplexityBot';
                $lines[] = 'User-agent: ClaudeBot';
                $lines[] = 'User-agent: Applebot-Extended';
                $lines[] = 'Disallow: /';
                $lines[] = '';
            } else {
                $lines[] = '# AI Search Engine Retrieval Crawlers (Grounding & Search)';
                $lines[] = 'User-agent: GPTBot';
                $lines[] = 'User-agent: PerplexityBot';
                $lines[] = 'User-agent: ClaudeBot';
                $lines[] = 'Allow: /';
                $lines[] = 'Disallow: /cart';
                $lines[] = 'Disallow: /checkout';
                $lines[] = 'Disallow: /account';
                $lines[] = 'Disallow: /api/';
                $lines[] = '';
            }

            // AI Training Crawlers (CCBot, Google-Extended, Bytespider)
            if ($settings && ! $settings->allow_ai_training_crawlers) {
                $lines[] = '# Disallow AI Training & Scraping Crawlers';
                $lines[] = 'User-agent: CCBot';
                $lines[] = 'User-agent: Google-Extended';
                $lines[] = 'User-agent: Bytespider';
                $lines[] = 'Disallow: /';
                $lines[] = '';
            }

            if ($settings && ! empty($settings->custom_robots_txt_append)) {
                $lines[] = '# Custom Rules';
                $lines[] = trim($settings->custom_robots_txt_append);
                $lines[] = '';
            }

            $lines[] = '# XML Sitemaps';
            $lines[] = "Sitemap: {$baseUrl}/sitemap.xml";
        }

        $content = implode("\n", $lines)."\n";

        return response($content, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
