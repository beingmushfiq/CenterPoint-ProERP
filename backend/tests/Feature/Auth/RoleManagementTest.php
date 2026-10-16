<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Core\Auth\JwtService;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private JwtService $jwtService;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Plan',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'is_active' => true,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);

        $this->tenant = Tenant::query()->create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'SliceMart Corp',
            'slug' => 'slicemart-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->user = User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Role Tester',
            'email' => 'tester@slicemart.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->jwtService = app(JwtService::class);
    }

    public function test_get_roles_without_permission_returns_403(): void
    {
        $jwt = $this->issueJwt();

        $response = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->getJson('/api/v1/roles');

        $response->assertStatus(403);
        $response->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_get_roles_with_permission_returns_200(): void
    {
        $this->assignPermissions('core.role.view');
        $jwt = $this->issueJwt();

        $response = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->getJson('/api/v1/roles');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data']);
    }

    public function test_store_role_with_invalid_permission_ids_returns_422(): void
    {
        $this->assignPermissions('core.role.create');
        $jwt = $this->issueJwt();

        // Create a permission with a rogue name not in PermissionCatalogue::ALL_PERMISSIONS
        $roguePerm = Permission::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'rogue.hack.access',
            'module' => 'rogue',
            'resource' => 'hack',
            'action' => 'access',
            'description' => 'Invalid rogue permission',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->postJson('/api/v1/roles', [
                'name' => 'Rogue Role',
                'description' => 'Should fail validation',
                'permission_ids' => [$roguePerm->id],
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertNotEmpty($response->json('error.fields.permission_ids'));
    }

    public function test_can_create_update_and_delete_role_with_granular_permissions(): void
    {
        $this->assignPermissions('core.role.view', 'core.role.create', 'core.role.update', 'core.role.delete');
        $jwt = $this->issueJwt();

        $validPerm = Permission::query()->firstOrCreate(
            ['name' => 'catalog.product.view'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'catalog',
                'resource' => 'product',
                'action' => 'view',
            ]
        );

        // 1. Create Role
        $createRes = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->postJson('/api/v1/roles', [
                'name' => 'Inventory Assistant',
                'description' => 'Can view products',
                'permission_ids' => [$validPerm->id],
            ]);

        $createRes->assertStatus(201);
        $roleId = $createRes->json('data.id');
        $this->assertNotNull($roleId);

        // 2. Update Role
        $updateRes = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->putJson("/api/v1/roles/{$roleId}", [
                'name' => 'Senior Inventory Assistant',
                'permission_ids' => [$validPerm->id],
            ]);

        $updateRes->assertStatus(200);
        $this->assertEquals('Senior Inventory Assistant', $updateRes->json('data.name'));

        // 3. Delete Role (soft delete)
        $deleteRes = $this->withHeader('Authorization', 'Bearer '.$jwt)
            ->deleteJson("/api/v1/roles/{$roleId}");

        $deleteRes->assertStatus(200);
        $this->assertSoftDeleted('roles', ['id' => $roleId]);
    }

    private function issueJwt(): string
    {
        return $this->jwtService->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: $this->user->token_version
        );
    }

    private function assignPermissions(string ...$permissionNames): void
    {
        $role = Role::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Tester Role '.Str::random(5),
            'slug' => 'tester-role-'.Str::lower(Str::random(5)),
            'is_system' => false,
        ]);

        foreach ($permissionNames as $name) {
            $parts = explode('.', $name);
            $perm = Permission::query()->firstOrCreate(
                ['name' => $name],
                [
                    'uuid' => (string) Str::uuid(),
                    'module' => $parts[0] ?? 'core',
                    'resource' => $parts[1] ?? 'general',
                    'action' => $parts[2] ?? 'view',
                    'description' => "Permission {$name}",
                ]
            );
            $role->permissions()->attach($perm->id);
        }

        $this->user->roles()->attach($role->id);
    }
}
