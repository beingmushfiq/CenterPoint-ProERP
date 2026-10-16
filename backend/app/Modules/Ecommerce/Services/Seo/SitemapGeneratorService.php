<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services\Seo;

use App\Models\Category;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Models\Tenant;
use Illuminate\Support\Carbon;

class SitemapGeneratorService
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService = new SeoMetadataService
    ) {}

    /**
     * Generate XML Sitemap Index linking to segmented sub-sitemaps.
     */
    public function generateSitemapIndex(Tenant $tenant, ?Storefront $storefront = null): string
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $lastmod = Carbon::now()->toAtomString();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        // Sub-sitemaps
        $subSitemaps = [
            $baseUrl.'/sitemap-pages.xml',
            $baseUrl.'/sitemap-products.xml',
            $baseUrl.'/sitemap-categories.xml',
        ];

        foreach ($subSitemaps as $mapUrl) {
            $xml .= "  <sitemap>\n";
            $xml .= "    <loc>{$mapUrl}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "  </sitemap>\n";
        }

        $xml .= '</sitemapindex>';

        return $xml;
    }

    /**
     * Generate XML Products Sitemap.
     */
    public function generateProductsSitemap(Tenant $tenant, ?Storefront $storefront = null): string
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);

        $products = Product::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('is_online', 1)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->with(['images'])
            ->get();

        $changefreq = $settings->sitemap_changefreq_products ?: 'daily';

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'."\n";

        foreach ($products as $product) {
            $slug = $product->online_slug ?: $product->sku;
            $loc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/products/'.$slug), ENT_XML1);
            $lastmod = ($product->updated_at ?: Carbon::now())->toAtomString();

            $xml .= "  <url>\n";
            $xml .= "    <loc>{$loc}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>{$changefreq}</changefreq>\n";
            $xml .= "    <priority>0.8</priority>\n";

            if ($settings->sitemap_include_images && $product->images && $product->images->isNotEmpty()) {
                foreach ($product->images as $img) {
                    $imgUrl = htmlspecialchars($img->url ?? $img->path ?? '', ENT_XML1);
                    if ($imgUrl) {
                        $title = htmlspecialchars($product->name, ENT_XML1);
                        $xml .= "    <image:image>\n";
                        $xml .= "      <image:loc>{$imgUrl}</image:loc>\n";
                        $xml .= "      <image:title>{$title}</image:title>\n";
                        $xml .= "    </image:image>\n";
                    }
                }
            }

            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return $xml;
    }

    /**
     * Generate XML Categories & Collections Sitemap.
     */
    public function generateCategoriesSitemap(Tenant $tenant, ?Storefront $storefront = null): string
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);

        $categories = Category::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', 1)
            ->whereNull('deleted_at')
            ->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        // Main All Products Catalog root
        $catalogLoc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/products'), ENT_XML1);
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$catalogLoc}</loc>\n";
        $xml .= '    <lastmod>'.Carbon::now()->toAtomString()."</lastmod>\n";
        $xml .= "    <changefreq>daily</changefreq>\n";
        $xml .= "    <priority>0.9</priority>\n";
        $xml .= "  </url>\n";

        foreach ($categories as $cat) {
            $slug = $cat->slug ?: strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $cat->name));
            $loc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/collections/'.$slug), ENT_XML1);
            $lastmod = ($cat->updated_at ?: Carbon::now())->toAtomString();

            $xml .= "  <url>\n";
            $xml .= "    <loc>{$loc}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.7</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return $xml;
    }

    /**
     * Generate XML CMS Pages Sitemap.
     */
    public function generatePagesSitemap(Tenant $tenant, ?Storefront $storefront = null): string
    {
        $baseUrl = $this->seoMetadataService->resolveBaseUrl($tenant, $storefront);
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);

        $pages = StorefrontPage::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->get();

        $changefreq = $settings->sitemap_changefreq_pages ?: 'weekly';

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        // Homepage
        $homeLoc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/'), ENT_XML1);
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$homeLoc}</loc>\n";
        $xml .= '    <lastmod>'.Carbon::now()->toAtomString()."</lastmod>\n";
        $xml .= "    <changefreq>daily</changefreq>\n";
        $xml .= "    <priority>1.0</priority>\n";
        $xml .= "  </url>\n";

        // Default dynamic pages if not explicitly in table
        $standardPages = [
            'about-us' => '0.7',
            'faq' => '0.8',
            'privacy-policy' => '0.5',
            'terms' => '0.5',
            'contact' => '0.7',
        ];

        $seenSlugs = [];
        foreach ($pages as $page) {
            $seenSlugs[$page->slug] = true;
            $loc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/pages/'.$page->slug), ENT_XML1);
            $lastmod = ($page->updated_at ?: Carbon::now())->toAtomString();

            $xml .= "  <url>\n";
            $xml .= "    <loc>{$loc}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>{$changefreq}</changefreq>\n";
            $xml .= "    <priority>0.6</priority>\n";
            $xml .= "  </url>\n";
        }

        foreach ($standardPages as $slug => $prio) {
            if (! isset($seenSlugs[$slug])) {
                $loc = htmlspecialchars($this->seoMetadataService->buildCanonicalUrl($baseUrl, '/pages/'.$slug), ENT_XML1);
                $xml .= "  <url>\n";
                $xml .= "    <loc>{$loc}</loc>\n";
                $xml .= '    <lastmod>'.Carbon::now()->toAtomString()."</lastmod>\n";
                $xml .= "    <changefreq>monthly</changefreq>\n";
                $xml .= "    <priority>{$prio}</priority>\n";
                $xml .= "  </url>\n";
            }
        }

        $xml .= '</urlset>';

        return $xml;
    }
}
