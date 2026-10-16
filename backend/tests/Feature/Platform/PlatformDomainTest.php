<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Auth\JwtService;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformDomainTest extends TestCase
{
    use RefreshDatabase;

    private string $platformToken;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->tenant = Tenant::where('slug', 'slicemart')->firstOrFail();

        $platformAdmin = User::withoutTenantScope()->where('email', 'admin@devcenterpoint.com')->firstOrFail();
        $jwtService = app(JwtService::class);

        $this->platformToken = $jwtService->issueToken(
            userId: $platformAdmin->id,
            tenantId: null,
            tokenVersion: $platformAdmin->token_version,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $platformAdmin->email, 'is_platform_user' => true]
        );
    }

    public function test_platform_admin_can_list_all_tenant_domains(): void
    {
        // Add custom domain for tenant
        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'shop.slicemart.com',
            'type' => 'custom_alias',
            'verification_method' => 'dns_txt',
            'verification_token' => 'dcp-verify-test1234',
            'verification_status' => 'pending',
            'ssl_status' => 'pending',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->platformToken)
            ->getJson('/api/v1/platform/domains');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $this->assertNotEmpty($response->json('data'));
    }

    public function test_platform_admin_can_verify_and_update_domain_status(): void
    {
        $domain = TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'slicemart.tech',
            'type' => 'custom_primary',
            'verification_method' => 'dns_txt',
            'verification_token' => 'dcp-verify-test5678',
            'verification_status' => 'pending',
            'ssl_status' => 'pending',
        ]);

        // 1. Trigger verification
        $verifyRes = $this->withHeader('Authorization', 'Bearer '.$this->platformToken)
            ->postJson("/api/v1/platform/domains/{$domain->id}/verify");

        $verifyRes->assertOk();
        $verifyRes->assertJsonPath('data.verification_status', 'verified');
        $verifyRes->assertJsonPath('data.ssl_status', 'active');

        // 2. Suspend domain
        $statusRes = $this->withHeader('Authorization', 'Bearer '.$this->platformToken)
            ->patchJson("/api/v1/platform/domains/{$domain->id}/status", [
                'verification_status' => 'suspended',
            ]);

        $statusRes->assertOk();
        $statusRes->assertJsonPath('data.verification_status', 'suspended');
    }
}
