<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Category;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\TenantNotFoundLog;
use App\Models\TenantRedirect;
use App\Models\TenantSeoSetting;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontSeoAndDiscoverabilityTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected User $tenantUser;
    protected string $tenantToken;
    protected Storefront $storefront;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::firstOrFail();
        TenantContext::bind($this->tenant->toArray());

        $this->tenantUser = User::withoutTenantScope()->where('email', 'admin@slicemart.test')->firstOrFail();

        $jwtService = app(JwtService::class);
        $this->tenantToken = $jwtService->issueToken(
            userId: $this->tenantUser->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: []
        );

        $this->storefront = Storefront::where('tenant_id', $this->tenant->id)->firstOrFail();
    }

    public function test_sitemap_index_returns_valid_xml(): void
    {
        $response = $this->get('/sitemap.xml', [
            'X-Storefront-Subdomain' => $this->tenant->slug,
        ]);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/xml; charset=utf-8');
        $this->assertStringContainsString('<sitemapindex', $response->getContent());
        $this->assertStringContainsString('sitemap-products.xml', $response->getContent());
        $this->assertStringContainsString('sitemap-categories.xml', $response->getContent());
        $this->assertStringContainsString('sitemap-pages.xml', $response->getContent());
    }

    public function test_products_sitemap_lists_published_products(): void
    {
        $unit = Unit::first();

        $product = Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'PROD-SEO-99',
            'name' => 'High Grade Gas Stove Deluxe',
            'description' => 'Cast iron double burner stove with auto ignition.',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'standard_cost' => 1000,
            'default_sale_price' => 1500,
            'is_online' => 1,
            'online_slug' => 'high-grade-gas-stove-deluxe',
            'status' => 'active',
        ]);

        $response = $this->get('/sitemap-products.xml', [
            'X-Storefront-Subdomain' => $this->tenant->slug,
        ]);

        $response->assertStatus(200);
        $this->assertStringContainsString('<urlset', $response->getContent());
        $this->assertStringContainsString('/products/high-grade-gas-stove-deluxe', $response->getContent());
    }

    public function test_robots_txt_returns_proper_directives_and_sitemap(): void
    {
        $response = $this->get('/robots.txt', [
            'X-Storefront-Subdomain' => $this->tenant->slug,
        ]);

        $response->assertStatus(200);
        $content = $response->getContent();
        $this->assertStringContainsString('User-agent:', $content);
    }

    public function test_tenant_can_get_and_update_seo_settings(): void
    {
        $getRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->getJson('/api/v1/storefront/seo/settings');
        $getRes->assertStatus(200);
        $getRes->assertJsonPath('success', true);

        $updateRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->putJson('/api/v1/storefront/seo/settings', [
            'brand_name' => 'Slice Mart Global',
            'meta_title_template' => '{title} - Slice Mart Official',
            'street_address' => 'Plot 42, Tejgaon Industrial Area',
            'address_locality' => 'Dhaka',
            'telephone' => '+8801700000000',
            'social_profiles' => [
                'facebook' => 'https://facebook.com/slicemart',
                'youtube' => 'https://youtube.com/@slicemart',
            ],
            'google_site_verification' => 'google1234567890',
        ]);

        $updateRes->assertStatus(200);
        $updateRes->assertJsonPath('data.brand_name', 'Slice Mart Global');
        $updateRes->assertJsonPath('data.street_address', 'Plot 42, Tejgaon Industrial Area');
    }

    public function test_seo_audit_returns_quality_score_and_checklist(): void
    {
        $auditRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->getJson('/api/v1/storefront/seo/audit');
        $auditRes->assertStatus(200);
        $auditRes->assertJsonStructure([
            'success',
            'data' => [
                'score',
                'grade',
                'summary' => [
                    'total_checks',
                    'passed_checks',
                    'failed_checks',
                ],
                'checklist',
            ],
        ]);
    }

    public function test_tenant_redirect_management_and_404_resolution(): void
    {
        // 1. Create 301 redirect
        $createRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson('/api/v1/storefront/redirects', [
            'source_path' => '/old-gas-burner-path',
            'target_path' => '/products',
            'status_code' => 301,
            'notes' => 'Old marketing campaign link',
        ]);

        $createRes->assertStatus(201);
        $this->assertDatabaseHas('tenant_redirects', [
            'tenant_id' => $this->tenant->id,
            'source_path' => '/old-gas-burner-path',
            'target_path' => '/products',
        ]);

        // 2. Log 404 and resolve it
        $log = TenantNotFoundLog::create([
            'tenant_id' => $this->tenant->id,
            'path' => '/vintage-stove-2024',
            'referrer' => 'https://google.com',
            'hit_count' => 12,
        ]);

        $resolveRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson("/api/v1/storefront/redirects/404-logs/{$log->id}/resolve", [
            'target_path' => '/products',
            'status_code' => 301,
        ]);

        $resolveRes->assertStatus(200);
        $this->assertTrue($log->fresh()->is_resolved);
        $this->assertDatabaseHas('tenant_redirects', [
            'tenant_id' => $this->tenant->id,
            'source_path' => '/vintage-stove-2024',
            'target_path' => '/products',
        ]);
    }
}
