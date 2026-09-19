<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Core\Auth\JwtService;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontPageBuilderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $tenantUser;
    private string $tenantToken;
    private Storefront $storefront;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->tenant = Tenant::firstOrFail();
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

    public function test_tenant_admin_can_create_and_list_cms_pages(): void
    {
        // 1. Create a page with blocks
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson('/api/v1/storefront/cms/pages', [
            'title' => 'About Our Factory',
            'slug' => 'about-us',
            'page_type' => 'content',
            'status' => 'published',
            'blocks' => [
                [
                    'type' => 'hero_banner',
                    'title' => 'Decades of Baking Excellence',
                    'subtitle' => 'Handcrafted bread and gourmet baked goods delivered fresh daily.',
                ],
                [
                    'type' => 'rich_text',
                    'content' => '<p>We operate 5 automated production lines in Dhaka...</p>',
                ],
            ],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.slug', 'about-us');
        $response->assertJsonPath('data.status', 'published');

        // 2. List pages
        $listResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->getJson('/api/v1/storefront/cms/pages');

        $listResponse->assertOk();
        $listResponse->assertJsonPath('success', true);
        $this->assertCount(1, $listResponse->json('data'));
    }

    public function test_tenant_admin_can_update_and_reorder_page_blocks(): void
    {
        $page = StorefrontPage::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $this->storefront->id,
            'title' => 'Frequently Asked Questions',
            'slug' => 'faq',
            'page_type' => 'faq',
            'status' => 'draft',
            'blocks' => [
                ['question' => 'How fresh is the bread?', 'answer' => 'Baked every morning at 4 AM.'],
            ],
        ]);

        $updateResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->putJson("/api/v1/storefront/cms/pages/{$page->id}", [
            'status' => 'published',
            'blocks' => [
                ['question' => 'How fresh is the bread?', 'answer' => 'Baked every morning at 4 AM.'],
                ['question' => 'What is the delivery radius?', 'answer' => 'All major metropolitan zones in Dhaka.'],
            ],
        ]);

        $updateResponse->assertOk();
        $updateResponse->assertJsonPath('data.status', 'published');
        $this->assertCount(2, $updateResponse->json('data.blocks'));
    }

    public function test_public_customer_can_fetch_published_page_by_slug(): void
    {
        // 1. Create published page
        StorefrontPage::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $this->storefront->id,
            'title' => 'Return & Refund Policy',
            'slug' => 'refund-policy',
            'page_type' => 'policy',
            'status' => 'published',
            'blocks' => [
                ['type' => 'rich_text', 'content' => '<p>Items may be returned within 24 hours of delivery.</p>'],
            ],
        ]);

        // 2. Public storefront request
        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/pages/refund-policy');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.title', 'Return & Refund Policy');
        $this->assertCount(1, $response->json('data.blocks'));
    }

    public function test_public_customer_cannot_view_draft_page(): void
    {
        // Draft page
        StorefrontPage::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $this->storefront->id,
            'title' => 'Secret Upcoming Promo',
            'slug' => 'secret-promo',
            'page_type' => 'custom',
            'status' => 'draft',
        ]);

        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/pages/secret-promo');

        $response->assertStatus(404);
    }

    public function test_default_seeding_includes_storefront_homepage_with_ecommerce_blocks(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson('/api/v1/storefront/cms/pages/seed-defaults');

        $response->assertOk();
        $response->assertJsonPath('success', true);

        // Check that home page is returned and has e-commerce blocks
        $pages = collect($response->json('data'));
        $homePage = $pages->firstWhere('slug', 'home');

        $this->assertNotNull($homePage);
        $this->assertEquals('Storefront Homepage', $homePage['title']);
        $this->assertEquals('home', $homePage['page_type']);
        $this->assertNotEmpty($homePage['blocks']);

        // Verify public customer can fetch home page
        $pubResponse = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/pages/home');

        $pubResponse->assertOk();
        $pubResponse->assertJsonPath('data.slug', 'home');
        $this->assertGreaterThanOrEqual(5, count($pubResponse->json('data.blocks')));
    }
}
