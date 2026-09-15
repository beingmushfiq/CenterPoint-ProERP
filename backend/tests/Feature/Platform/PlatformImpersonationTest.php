<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Auth\JwtService;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PlatformImpersonationTest extends TestCase
{
    use RefreshDatabase;

    private string $superAdminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $platformAdmin = User::withoutTenantScope()->where('email', 'admin@devcenterpoint.com')->firstOrFail();
        $jwtService = app(JwtService::class);

        $this->superAdminToken = $jwtService->issueToken(
            userId: $platformAdmin->id,
            tenantId: null,
            tokenVersion: $platformAdmin->token_version,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $platformAdmin->email, 'is_platform_user' => true]
        );
    }

    public function test_super_admin_can_impersonate_active_tenant(): void
    {
        $tenant = Tenant::firstOrFail();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->superAdminToken}",
        ])->postJson("/api/v1/platform/tenants/{$tenant->id}/impersonate");

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'token',
                'token_type',
                'expires_in',
                'tenant' => ['id', 'name', 'slug'],
                'user' => ['id', 'name', 'email'],
                'impersonator' => ['id', 'name', 'email'],
            ],
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'impersonated',
        ]);
    }

    public function test_cannot_impersonate_suspended_tenant(): void
    {
        $tenant = Tenant::firstOrFail();
        $tenant->update(['status' => 'suspended']);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->superAdminToken}",
        ])->postJson("/api/v1/platform/tenants/{$tenant->id}/impersonate");

        $response->assertStatus(422);
    }

    public function test_can_impersonate_tenant_without_existing_user(): void
    {
        $template = Tenant::firstOrFail();
        $attributes = $template->toArray();
        unset($attributes['id'], $attributes['created_at'], $attributes['updated_at']);
        $attributes['uuid'] = (string) \Illuminate\Support\Str::uuid();
        $attributes['name'] = 'Empty Tenant Co';
        $attributes['slug'] = 'emptytenant';
        $attributes['status'] = 'active';

        $newTenant = Tenant::create($attributes);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->superAdminToken}",
        ])->postJson("/api/v1/platform/tenants/{$newTenant->id}/impersonate");

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('users', [
            'tenant_id' => $newTenant->id,
            'status' => 'active',
        ]);
    }
}
