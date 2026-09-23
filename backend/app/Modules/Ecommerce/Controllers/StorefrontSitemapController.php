<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Modules\Ecommerce\Services\Seo\SitemapGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StorefrontSitemapController extends Controller
{
    public function __construct(
        protected SitemapGeneratorService $sitemapGeneratorService
    ) {}

    /**
     * Resolve current tenant & storefront for sitemap requests.
     */
    protected function resolveTenantAndStorefront(Request $request): array
    {
        $tenantId = $request->attributes->get('tenant_id') ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : null);
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

        return [$tenant, $storefront];
    }

    /**
     * Render main Sitemap Index XML.
     */
    public function index(Request $request): Response
    {
        [$tenant, $storefront] = $this->resolveTenantAndStorefront($request);

        if (! $tenant) {
            return response('<error>Tenant not found</error>', 404, ['Content-Type' => 'application/xml']);
        }

        $xml = $this->sitemapGeneratorService->generateSitemapIndex($tenant, $storefront);

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Render Products XML Sitemap.
     */
    public function products(Request $request): Response
    {
        [$tenant, $storefront] = $this->resolveTenantAndStorefront($request);

        if (! $tenant) {
            return response('<error>Tenant not found</error>', 404, ['Content-Type' => 'application/xml']);
        }

        $xml = $this->sitemapGeneratorService->generateProductsSitemap($tenant, $storefront);

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Render Categories XML Sitemap.
     */
    public function categories(Request $request): Response
    {
        [$tenant, $storefront] = $this->resolveTenantAndStorefront($request);

        if (! $tenant) {
            return response('<error>Tenant not found</error>', 404, ['Content-Type' => 'application/xml']);
        }

        $xml = $this->sitemapGeneratorService->generateCategoriesSitemap($tenant, $storefront);

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Render CMS Pages XML Sitemap.
     */
    public function pages(Request $request): Response
    {
        [$tenant, $storefront] = $this->resolveTenantAndStorefront($request);

        if (! $tenant) {
            return response('<error>Tenant not found</error>', 404, ['Content-Type' => 'application/xml']);
        }

        $xml = $this->sitemapGeneratorService->generatePagesSitemap($tenant, $storefront);

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
