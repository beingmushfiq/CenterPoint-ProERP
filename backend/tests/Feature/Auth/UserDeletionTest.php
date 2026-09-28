<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Core\Auth\JwtService;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_tenant_admin_can_delete_user_in_same_tenant(): void
    {
        $tenant = Tenant::firstOrFail();

        // Admin user with core.user.delete permission
        $admin = User::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Admin Operator',
            'email' => 'admin.operator@tenant.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
        ]);
        $adminRole = Role::withoutTenantScope()->where('tenant_id', $tenant->id)->whereIn('slug', ['super_admin', 'admin'])->first();
        if (! $adminRole) {
            $adminRole = Role::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'name' => 'Super Administrator',
                'slug' => 'super_admin',
            ]);
        }
        $admin->roles()->sync([$adminRole->id => ['tenant_id' => $tenant->id]]);

        // Target user to delete
        $target = User::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Temporary Worker',
            'email' => 'temp.worker@tenant.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $token = $jwtService->issueToken(
            userId: $admin->id,
            tenantId: $tenant->id,
            tokenVersion: $admin->token_version ?? 1,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $admin->email]
        );

        $response = $this->withHeader('X-Tenant', $tenant->slug)
            ->withToken($token)
            ->deleteJson("/api/v1/users/{$target->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('message', "User 'Temporary Worker' has been deleted successfully.");

        // Assert soft deleted
        $this->assertSoftDeleted('users', ['id' => $target->id]);
    }

    public function test_user_cannot_delete_themselves(): void
    {
        $tenant = Tenant::firstOrFail();

        $admin = User::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Self Admin',
            'email' => 'self.admin@tenant.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
        ]);
        $adminRole = Role::withoutTenantScope()->where('tenant_id', $tenant->id)->whereIn('slug', ['super_admin', 'admin'])->first();
        if (! $adminRole) {
            $adminRole = Role::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'name' => 'Super Administrator',
                'slug' => 'super_admin',
            ]);
        }
        $admin->roles()->sync([$adminRole->id => ['tenant_id' => $tenant->id]]);

        $jwtService = app(JwtService::class);
        $token = $jwtService->issueToken(
            userId: $admin->id,
            tenantId: $tenant->id,
            tokenVersion: $admin->token_version ?? 1,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $admin->email]
        );

        $response = $this->withHeader('X-Tenant', $tenant->slug)
            ->withToken($token)
            ->deleteJson("/api/v1/users/{$admin->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('users', ['id' => $admin->id, 'deleted_at' => null]);
    }
}
