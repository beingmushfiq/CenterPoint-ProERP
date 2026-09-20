<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Models\Setting;
use App\Models\Storefront;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class DualPwaManifestTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Storefront $storefront;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->tenant = Tenant::firstOrFail();

        $company = \App\Models\Company::first();
        $branch = \App\Models\Branch::first();
        $warehouse = \App\Models\Warehouse::first();
        $this->storefront = Storefront::updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'subdomain' => 'slicemart'],
            [
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'code' => 'SF-TEST',
                'name' => 'Slice Mart',
                'company_id' => $company?->id ?? 1,
                'default_branch_id' => $branch?->id ?? 1,
                'default_warehouse_id' => $warehouse?->id ?? 1,
                'currency' => 'BDT',
                'locale' => 'en',
                'status' => 'live',
                'theme' => [
                    'primary_color' => '#10b981',
                    'background_color' => '#ffffff',
                    'logo_url' => 'https://example.com/store-logo.png',
                ],
            ]
        );

        // Configure company name and logo in Settings
        Setting::withoutTenantScope()->updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'group' => 'general', 'key' => 'company_legal_name'],
            ['scope' => 'tenant', 'scope_id' => null, 'value' => 'Slice Mart Industries Ltd.', 'value_type' => 'string']
        );

        Setting::withoutTenantScope()->updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'group' => 'general', 'key' => 'brand_logo_url'],
            ['scope' => 'tenant', 'scope_id' => null, 'value' => 'https://example.com/erp-logo.png', 'value_type' => 'string']
        );
    }

    public function test_erp_pwa_manifest_returns_compliant_w3c_payload(): void
    {
        $response = $this->get('/api/v1/pwa/erp-manifest.json');

        $response->assertOk();
        $this->assertStringContainsString('application/manifest+json', (string) $response->headers->get('Content-Type'));

        $data = $response->json();
        $this->assertSame('/erp', $data['id']);
        $this->assertStringContainsString('Slice Mart Industries Ltd. ERP', $data['name']);
        $this->assertStringContainsString('ERP', $data['short_name']);
        $this->assertStringContainsString('/dashboard', $data['start_url']);
        $this->assertSame('/', $data['scope']);
        $this->assertSame('standalone', $data['display']);
        $this->assertSame('#0F172A', $data['theme_color']);
        $this->assertNotEmpty($data['icons']);
        $this->assertNotEmpty($data['shortcuts']);
    }

    public function test_storefront_pwa_manifest_returns_compliant_w3c_payload(): void
    {
        $response = $this->get('/api/v1/pwa/storefront-manifest.json?subdomain=slicemart');

        $response->assertOk();
        $this->assertStringContainsString('application/manifest+json', (string) $response->headers->get('Content-Type'));

        $data = $response->json();
        $this->assertSame('/storefront', $data['id']);
        $this->assertStringContainsString('Slice Mart Store', $data['name']);
        $this->assertStringContainsString('Store', $data['short_name']);
        $this->assertStringContainsString('mode=pwa', $data['start_url']);
        $this->assertSame('standalone', $data['display']);
        $this->assertSame('#10b981', $data['theme_color']);
        $this->assertNotEmpty($data['icons']);
        $this->assertNotEmpty($data['shortcuts']);
    }

    public function test_pwa_icon_endpoint_generates_valid_adaptive_svg(): void
    {
        $erpIcon = $this->get('/api/v1/pwa/icon/erp?size=192');
        $erpIcon->assertOk();
        $this->assertStringContainsString('image/svg+xml', (string) $erpIcon->headers->get('Content-Type'));
        $this->assertStringContainsString('<svg', $erpIcon->getContent());

        $storeIcon = $this->get('/api/v1/pwa/icon/storefront?size=512&maskable=1');
        $storeIcon->assertOk();
        $this->assertStringContainsString('image/svg+xml', (string) $storeIcon->headers->get('Content-Type'));
        $this->assertStringContainsString('<svg', $storeIcon->getContent());
    }

    public function test_web_routes_serve_correct_manifests(): void
    {
        $erpRes = $this->get('/manifest-erp.json');
        $erpRes->assertOk();
        $this->assertSame('/erp', $erpRes->json('id'));

        $storeRes = $this->get('/manifest-store.json?subdomain=slicemart');
        $storeRes->assertOk();
        $this->assertSame('/storefront', $storeRes->json('id'));
    }
}
