<?php

declare(strict_types=1);

namespace Tests\Feature\Core;

use App\Models\Tenant;
use App\Models\TenantDomain;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class DynamicCorsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        Cache::flush();
    }

    public function test_allows_configured_devcenterpoint_origin(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'https://tenant.devcenterpoint.com',
        ])->getJson('/api/up');

        $response->assertHeader('Access-Control-Allow-Origin', 'https://tenant.devcenterpoint.com');
    }

    public function test_blocks_unverified_custom_domain(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'https://unverified-store.com',
        ])->getJson('/api/up');

        $this->assertFalse($response->headers->has('Access-Control-Allow-Origin'));
    }

    public function test_allows_verified_tenant_custom_domain(): void
    {
        $tenant = Tenant::firstOrFail();

        TenantDomain::create([
            'tenant_id' => $tenant->id,
            'domain' => 'mystore.custombrand.com',
            'type' => 'custom_alias',
            'verification_status' => 'verified',
            'verified_at' => now(),
        ]);

        $response = $this->withHeaders([
            'Origin' => 'https://mystore.custombrand.com',
        ])->getJson('/api/up');

        $response->assertHeader('Access-Control-Allow-Origin', 'https://mystore.custombrand.com');
        $response->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_handles_preflight_for_verified_tenant_custom_domain(): void
    {
        $tenant = Tenant::firstOrFail();

        TenantDomain::create([
            'tenant_id' => $tenant->id,
            'domain' => 'checkout.brandshoes.com',
            'type' => 'custom_primary',
            'verification_status' => 'verified',
            'verified_at' => now(),
        ]);

        $response = $this->call('OPTIONS', '/api/v1/storefront/config', [], [], [], [
            'HTTP_ORIGIN' => 'https://checkout.brandshoes.com',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'X-Storefront-Domain,Accept',
        ]);

        $response->assertStatus(204);
        $response->assertHeader('Access-Control-Allow-Origin', 'https://checkout.brandshoes.com');
        $response->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
