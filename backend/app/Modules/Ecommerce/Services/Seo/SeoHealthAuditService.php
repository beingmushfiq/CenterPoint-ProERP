<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services\Seo;

use App\Models\Product;
use App\Models\Storefront;
use App\Models\Tenant;

class SeoHealthAuditService
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService = new SeoMetadataService
    ) {}

    /**
     * Audit tenant discoverability health and generate a quality score and checklist.
     */
    public function runAudit(Tenant $tenant, ?Storefront $storefront = null): array
    {
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);

        $checklist = [];
        $totalWeight = 0;
        $earnedScore = 0;

        // 1. General Meta & Brand Defaults
        $hasBrand = ! empty($settings->brand_name);
        $hasDefaultDesc = ! empty($settings->default_meta_description) && mb_strlen($settings->default_meta_description) >= 50;
        $hasOgImage = ! empty($settings->default_og_image);

        $checklist[] = [
            'key' => 'brand_identity',
            'category' => 'Site Identity',
            'title' => 'Brand & Entity Name Configured',
            'passed' => $hasBrand,
            'importance' => 'high',
            'details' => $hasBrand ? "Brand entity set to '{$settings->brand_name}'" : 'Brand name is missing in SEO Settings.',
            'weight' => 15,
        ];
        $totalWeight += 15;
        if ($hasBrand) {
            $earnedScore += 15;
        }

        $checklist[] = [
            'key' => 'default_description',
            'category' => 'Site Identity',
            'title' => 'Default Storefront Meta Description (50-160 chars)',
            'passed' => $hasDefaultDesc,
            'importance' => 'high',
            'details' => $hasDefaultDesc ? 'Comprehensive default meta description present.' : 'Add a descriptive fallback meta description (at least 50 characters).',
            'weight' => 15,
        ];
        $totalWeight += 15;
        if ($hasDefaultDesc) {
            $earnedScore += 15;
        }

        $checklist[] = [
            'key' => 'social_share_image',
            'category' => 'Social Discoverability',
            'title' => 'Default Open Graph / Social Sharing Image',
            'passed' => $hasOgImage,
            'importance' => 'medium',
            'details' => $hasOgImage ? 'Global social card image is active.' : 'Upload a default 1200x630 Open Graph banner for social sharing previews.',
            'weight' => 10,
        ];
        $totalWeight += 10;
        if ($hasOgImage) {
            $earnedScore += 10;
        }

        // 2. Structured Data & Local Business NAP
        $hasAddress = ! empty($settings->street_address) && ! empty($settings->address_locality);
        $hasPhone = ! empty($settings->telephone) || ! empty($storefront?->whatsapp_number);
        $hasGeo = ! empty($settings->geo_latitude) && ! empty($settings->geo_longitude);
        $hasSocial = is_array($settings->social_profiles) && count(array_filter($settings->social_profiles)) > 0;

        $checklist[] = [
            'key' => 'local_nap',
            'category' => 'Local & Entity SEO',
            'title' => 'Physical Address & Contact Telephone (NAP)',
            'passed' => $hasAddress && $hasPhone,
            'importance' => 'high',
            'details' => ($hasAddress && $hasPhone) ? 'Address and phone entity data fully specified.' : 'Specify street address, city, and official telephone number for LocalBusiness schema.',
            'weight' => 15,
        ];
        $totalWeight += 15;
        if ($hasAddress && $hasPhone) {
            $earnedScore += 15;
        }

        $checklist[] = [
            'key' => 'social_sameas',
            'category' => 'Entity Graph',
            'title' => 'Verified Social Profile Entity Links (sameAs)',
            'passed' => $hasSocial,
            'importance' => 'medium',
            'details' => $hasSocial ? 'Social profile entity links connected.' : 'Connect Facebook, Instagram, LinkedIn, or X profiles for knowledge graph disambiguation.',
            'weight' => 10,
        ];
        $totalWeight += 10;
        if ($hasSocial) {
            $earnedScore += 10;
        }

        // 3. Products SEO & Image Alts
        $onlineProducts = Product::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('is_online', 1)
            ->with(['images'])
            ->get();

        $productsCount = $onlineProducts->count();
        $productsWithDesc = $onlineProducts->filter(fn ($p) => ! empty($p->description) && mb_strlen($p->description) > 20)->count();
        $productsWithImages = $onlineProducts->filter(fn ($p) => $p->images && $p->images->isNotEmpty())->count();

        $productDescRatio = $productsCount > 0 ? ($productsWithDesc / $productsCount) : 1;
        $productImgRatio = $productsCount > 0 ? ($productsWithImages / $productsCount) : 1;

        $checklist[] = [
            'key' => 'product_descriptions',
            'category' => 'E-Commerce SEO',
            'title' => 'Online Products with Rich Descriptions',
            'passed' => $productDescRatio >= 0.8,
            'importance' => 'high',
            'details' => "{$productsWithDesc} of {$productsCount} online products have descriptive content (".round($productDescRatio * 100).'%).',
            'weight' => 15,
        ];
        $totalWeight += 15;
        if ($productDescRatio >= 0.8) {
            $earnedScore += 15;
        }

        $checklist[] = [
            'key' => 'product_images',
            'category' => 'Image SEO',
            'title' => 'Online Products with High-Resolution Photography',
            'passed' => $productImgRatio >= 0.8,
            'importance' => 'high',
            'details' => "{$productsWithImages} of {$productsCount} online products have attached photos (".round($productImgRatio * 100).'%).',
            'weight' => 10,
        ];
        $totalWeight += 10;
        if ($productImgRatio >= 0.8) {
            $earnedScore += 10;
        }

        // 4. Sitemaps & Search Verification
        $sitemapActive = (bool) $settings->sitemap_enabled;
        $hasVerification = ! empty($settings->google_site_verification) || ! empty($settings->bing_site_verification);

        $checklist[] = [
            'key' => 'sitemap_status',
            'category' => 'Crawlability',
            'title' => 'Dynamic XML Sitemaps Active',
            'passed' => $sitemapActive,
            'importance' => 'high',
            'details' => $sitemapActive ? 'XML sitemap generator is enabled.' : 'Enable XML sitemaps to assist search engine crawlers.',
            'weight' => 5,
        ];
        $totalWeight += 5;
        if ($sitemapActive) {
            $earnedScore += 5;
        }

        $checklist[] = [
            'key' => 'search_console',
            'category' => 'Search Console',
            'title' => 'Search Engine Webmaster Verification',
            'passed' => $hasVerification,
            'importance' => 'medium',
            'details' => $hasVerification ? 'Webmaster verification token configured.' : 'Add Google Search Console or Bing Webmaster verification code.',
            'weight' => 5,
        ];
        $totalWeight += 5;
        if ($hasVerification) {
            $earnedScore += 5;
        }

        $score = $totalWeight > 0 ? (int) round(($earnedScore / $totalWeight) * 100) : 100;

        return [
            'score' => $score,
            'grade' => $score >= 90 ? 'A+' : ($score >= 75 ? 'B+' : ($score >= 60 ? 'C' : 'Needs Work')),
            'summary' => [
                'total_checks' => count($checklist),
                'passed_checks' => count(array_filter($checklist, fn ($c) => $c['passed'])),
                'failed_checks' => count(array_filter($checklist, fn ($c) => ! $c['passed'])),
                'online_products_count' => $productsCount,
            ],
            'checklist' => $checklist,
        ];
    }
}
