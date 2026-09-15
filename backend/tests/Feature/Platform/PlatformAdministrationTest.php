<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Auth\JwtService;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformAdministrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function getPlatformToken(): string
    {
        $platformAdmin = User::withoutTenantScope()->where('email', 'admin@devcenterpoint.com')->firstOrFail();
        $jwtService = app(JwtService::class);

        return $jwtService->issueToken(
            userId: $platformAdmin->id,
            tenantId: null,
            tokenVersion: $platformAdmin->token_version,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $platformAdmin->email, 'is_platform_user' => true]
        );
    }

    public function test_platform_login_authenticates_super_admin_and_returns_platform_token(): void
    {
        $response = $this->postJson('/api/v1/platform/auth/login', [
            'email' => 'admin@devcenterpoint.com',
            'password' => 'PlatformAdmin123!',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'access_token',
                'token_type',
                'user' => ['id', 'email', 'is_platform_user'],
            ],
        ]);
        $this->assertTrue($response->json('data.user.is_platform_user'));
    }

    public function test_tenant_user_cannot_login_via_platform_auth_endpoint(): void
    {
        $response = $this->postJson('/api/v1/platform/auth/login', [
            'email' => 'admin@slicemart.test',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
    }

    public function test_tenant_user_cannot_access_platform_endpoints(): void
    {
        $tenantUser = User::where('email', 'admin@slicemart.test')->firstOrFail();
        $jwtService = app(JwtService::class);
        $tenantToken = $jwtService->issueToken(
            userId: $tenantUser->id,
            tenantId: 1,
            tokenVersion: $tenantUser->token_version,
            permVersion: '1'
        );

        $response = $this->withToken($tenantToken)->getJson('/api/v1/platform/dashboard/kpis');

        $response->assertStatus(403);
        $response->assertJsonPath('error.code', 'PLATFORM_ONLY');
    }

    public function test_platform_admin_can_view_kpis(): void
    {
        $token = $this->getPlatformToken();
        $response = $this->withToken($token)->getJson('/api/v1/platform/dashboard/kpis');

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'kpis' => [
                    'total_tenants',
                    'active_tenants',
                    'trial_tenants',
                    'suspended_tenants',
                    'estimated_mrr',
                    'total_users',
                ],
                'plans',
                'recent_activity',
                'system_health',
            ],
        ]);
    }

    public function test_platform_admin_can_provision_new_tenant(): void
    {
        $token = $this->getPlatformToken();
        $proPlan = Plan::where('code', 'PROFESSIONAL')->firstOrFail();

        $response = $this->withToken($token)->postJson('/api/v1/platform/tenants', [
            'name' => 'Apex Footwear Ltd.',
            'slug' => 'apex-footwear',
            'plan_id' => $proPlan->id,
            'owner_name' => 'Syed Manzur',
            'owner_email' => 'manzur@apexfootwear.com',
            'password' => 'ApexSecurePass123!',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'is_trial' => false,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.tenant.slug', 'apex-footwear');
        $response->assertJsonPath('data.owner.email', 'manzur@apexfootwear.com');

        $this->assertDatabaseHas('tenants', ['slug' => 'apex-footwear']);
        $this->assertDatabaseHas('users', ['email' => 'manzur@apexfootwear.com']);

        $tenantId = $response->json('data.tenant.id');
        $this->assertDatabaseHas('warehouses', ['tenant_id' => $tenantId, 'code' => 'WH-MAIN']);
        $this->assertDatabaseHas('warehouses', ['tenant_id' => $tenantId, 'code' => 'WH-FG']);
        $this->assertDatabaseHas('warehouses', ['tenant_id' => $tenantId, 'code' => 'WH-QC']);
        $this->assertDatabaseHas('storefronts', ['tenant_id' => $tenantId, 'subdomain' => 'apex-footwear']);
        $this->assertDatabaseHas('storefront_pages', ['tenant_id' => $tenantId, 'slug' => 'home']);
        $this->assertDatabaseHas('storefront_pages', ['tenant_id' => $tenantId, 'slug' => 'privacy-policy']);
        $this->assertDatabaseHas('tenant_domains', ['tenant_id' => $tenantId, 'domain' => 'apex-footwear.devcenterpoint.com']);
    }

    public function test_cannot_provision_tenant_with_reserved_subdomain(): void
    {
        $token = $this->getPlatformToken();
        $starterPlan = Plan::where('code', 'STARTER')->firstOrFail();

        $response = $this->withToken($token)->postJson('/api/v1/platform/tenants', [
            'name' => 'Admin Business',
            'slug' => 'admin',
            'plan_id' => $starterPlan->id,
            'owner_name' => 'John Doe',
            'owner_email' => 'john@admin.com',
            'password' => 'Secret12345!',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_platform_admin_can_suspend_and_reactivate_tenant(): void
    {
        $token = $this->getPlatformToken();
        $tenant = Tenant::where('slug', 'demoerp')->orWhere('slug', 'slicemart')->firstOrFail();

        // Suspend
        $response = $this->withToken($token)->postJson("/api/v1/platform/tenants/{$tenant->id}/status", [
            'status' => 'suspended',
            'reason' => 'Non-payment of subscription fee',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'suspended');
        $this->assertEquals('suspended', $tenant->fresh()->status);

        // Reactivate
        $reactivateResponse = $this->withToken($token)->postJson("/api/v1/platform/tenants/{$tenant->id}/status", [
            'status' => 'active',
            'reason' => 'Payment received via bank transfer',
        ]);

        $reactivateResponse->assertStatus(200);
        $reactivateResponse->assertJsonPath('data.status', 'active');
        $this->assertEquals('active', $tenant->fresh()->status);
    }

    public function test_platform_admin_can_extend_subscription(): void
    {
        $token = $this->getPlatformToken();
        $tenant = Tenant::where('slug', 'demoerp')->orWhere('slug', 'slicemart')->firstOrFail();

        $response = $this->withToken($token)->postJson("/api/v1/platform/tenants/{$tenant->id}/manage-subscription", [
            'action' => 'extend',
            'days' => 60,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'active');
    }

    public function test_platform_admin_can_manage_plans(): void
    {
        $token = $this->getPlatformToken();

        $listResponse = $this->withToken($token)->getJson('/api/v1/platform/plans');
        $listResponse->assertStatus(200);
        $listResponse->assertJsonPath('success', true);

        $createResponse = $this->withToken($token)->postJson('/api/v1/platform/plans', [
            'name' => 'Custom Industrial Enterprise',
            'code' => 'CUSTOM_IND',
            'price' => 50000.00,
            'billing_period' => 'monthly',
            'limits' => ['max_users' => 500, 'max_factories' => 10],
            'features' => ['all' => true],
        ]);

        $createResponse->assertStatus(201);
        $createResponse->assertJsonPath('data.code', 'custom_ind');
    }

    public function test_platform_admin_can_view_system_audit_logs(): void
    {
        $token = $this->getPlatformToken();
        $response = $this->withToken($token)->getJson('/api/v1/platform/audit-logs');

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure(['data', 'meta' => ['pagination']]);
    }
}
