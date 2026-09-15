<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantDomainTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::where('slug', 'demoerp')->first() ?? Tenant::firstOrFail();
        $this->admin = User::where('email', 'admin@dcp.com')->first()
            ?? User::where('email', 'admin@slicemart.test')->firstOrFail();

        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => $this->admin->email,
            'password' => '12345678',
        ]);

        $this->token = $loginRes->json('data.access_token');
    }

    public function test_can_list_domains_and_auto_provisions_platform_subdomain(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->getJson('/api/v1/storefront/domains');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $this->assertNotEmpty($response->json('data'));
        $this->assertEquals('demoerp.devcenterpoint.com', $response->json('data.0.domain'));
        $this->assertEquals('platform_subdomain', $response->json('data.0.type'));
    }

    public function test_can_add_custom_domain_with_verification_instructions(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/storefront/domains', [
                'domain' => 'slicemart.tech',
                'type' => 'custom_alias',
            ]);

        $response->assertCreated();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.domain', 'slicemart.tech');
        $response->assertJsonPath('data.verification_status', 'pending');
        $this->assertNotNull($response->json('data.dns_records_expected.txt_record'));
        $this->assertNotNull($response->json('data.dns_records_expected.cname_record'));
    }

    public function test_cannot_add_invalid_or_reserved_domain(): void
    {
        // Reserved domain
        $res1 = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/storefront/domains', [
                'domain' => 'devcenterpoint.com',
            ]);
        $res1->assertStatus(422);

        // Invalid format
        $res2 = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/storefront/domains', [
                'domain' => 'invalid_domain_format!',
            ]);
        $res2->assertStatus(422);
    }

    public function test_can_verify_and_set_primary_domain(): void
    {
        // 1. Add domain
        $addRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/storefront/domains', [
                'domain' => 'slicemart.tech',
            ]);
        $domainId = $addRes->json('data.id');

        // 2. Verify domain
        $verifyRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson("/api/v1/storefront/domains/{$domainId}/verify");

        $verifyRes->assertOk();
        $verifyRes->assertJsonPath('data.verification_status', 'verified');
        $verifyRes->assertJsonPath('data.ssl_status', 'active');

        // 3. Set as primary
        $primaryRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson("/api/v1/storefront/domains/{$domainId}/set-primary");

        $primaryRes->assertOk();
        $primaryRes->assertJsonPath('data.is_primary', true);

        // 4. Verify storefront model synced domain
        $this->assertDatabaseHas('storefronts', [
            'tenant_id' => $this->tenant->id,
            'domain' => 'slicemart.tech',
        ]);
    }
}
