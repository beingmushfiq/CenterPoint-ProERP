<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller as BaseController;
use App\Models\Tenant;
use App\Modules\Ecommerce\Services\Seo\IndexNowNotificationService;
use App\Modules\Ecommerce\Services\Seo\SeoHealthAuditService;
use App\Modules\Ecommerce\Services\Seo\SeoMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantSeoSettingsController extends BaseController
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService,
        protected SeoHealthAuditService $seoHealthAuditService,
        protected IndexNowNotificationService $indexNowService
    ) {}

    /**
     * Get SEO settings for the authenticated tenant.
     */
    public function show(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenantId);

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update SEO settings.
     */
    public function update(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenantId);

        $validated = $request->validate([
            'meta_title_template' => 'nullable|string|max:255',
            'product_title_template' => 'nullable|string|max:255',
            'category_title_template' => 'nullable|string|max:255',
            'default_meta_title' => 'nullable|string|max:255',
            'default_meta_description' => 'nullable|string|max:500',
            'default_og_image' => 'nullable|string|max:512',
            'twitter_card_type' => 'nullable|string|max:32',
            'twitter_handle' => 'nullable|string|max:64',
            'indexing_enabled' => 'nullable|boolean',
            'allow_ai_search_crawlers' => 'nullable|boolean',
            'allow_ai_training_crawlers' => 'nullable|boolean',
            'custom_robots_txt_append' => 'nullable|string|max:2000',
            'sitemap_enabled' => 'nullable|boolean',
            'sitemap_include_images' => 'nullable|boolean',
            'business_type' => 'nullable|string|max:64',
            'legal_name' => 'nullable|string|max:255',
            'brand_name' => 'nullable|string|max:255',
            'logo_url' => 'nullable|string|max:512',
            'telephone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:128',
            'street_address' => 'nullable|string|max:255',
            'address_locality' => 'nullable|string|max:128',
            'address_region' => 'nullable|string|max:128',
            'postal_code' => 'nullable|string|max:32',
            'address_country' => 'nullable|string|max:32',
            'geo_latitude' => 'nullable|numeric',
            'geo_longitude' => 'nullable|numeric',
            'opening_hours' => 'nullable|array',
            'price_range' => 'nullable|string|max:16',
            'social_profiles' => 'nullable|array',
            'google_site_verification' => 'nullable|string|max:255',
            'bing_site_verification' => 'nullable|string|max:255',
            'google_analytics_id' => 'nullable|string|max:64',
            'google_tag_manager_id' => 'nullable|string|max:64',
            'indexnow_api_key' => 'nullable|string|max:128',
            'default_locale' => 'nullable|string|max:16',
            'supported_locales' => 'nullable|array',
        ]);

        $settings->fill($validated);
        $settings->updated_by = auth()->id();
        $settings->save();

        return response()->json([
            'success' => true,
            'message' => 'SEO and Discoverability settings saved successfully.',
            'data' => $settings->fresh(),
        ]);
    }

    /**
     * Run Discoverability Audit Checklist & Score.
     */
    public function audit(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $tenant = Tenant::findOrFail($tenantId);

        $results = $this->seoHealthAuditService->runAudit($tenant);

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }

    /**
     * Ping IndexNow API with URLs.
     */
    public function pingIndexNow(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $tenant = Tenant::findOrFail($tenantId);

        $request->validate([
            'urls' => 'required|array',
            'urls.*' => 'required|string|url',
        ]);

        $result = $this->indexNowService->submitUrls($tenant, $request->input('urls'));

        return response()->json($result);
    }

    protected function getTenantId(Request $request): int
    {
        if (TenantContext::isBound()) {
            return TenantContext::current()->tenantId();
        }

        return (int) ($request->attributes->get('tenant_id') ?? auth()->user()?->tenant_id ?? 1);
    }
}
