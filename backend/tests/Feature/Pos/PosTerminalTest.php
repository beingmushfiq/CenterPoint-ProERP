<?php

declare(strict_types=1);

namespace Tests\Feature\Pos;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PosTerminalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private int $branchId;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'limits' => json_encode(['max_users' => 100]),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'SliceMart BD',
            'slug' => 'slicemart-bd',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Store Manager',
            'email' => 'manager@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'SliceMart Retail',
            'legal_name' => 'SliceMart Retail Ltd.',
            'tax_identifier' => 'BIN-POS-01',
            'registration_number' => 'REG-POS-01',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branchId = (int) DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'company_id' => $companyId,
            'code' => 'BR-DHK-01',
            'name' => 'Dhaka Main Store',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assignOnly(
            'pos.terminal.view',
            'pos.terminal.create'
        );
    }

    public function test_create_pos_terminal(): void
    {
        $res = $this->postJson('/api/v1/pos/terminals', [
            'code' => 'POS-01',
            'name' => 'Main Counter Register 1',
            'branch_id' => $this->branchId,
            'is_active' => true,
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.code', 'POS-01')
            ->assertJsonPath('data.name', 'Main Counter Register 1')
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('pos_terminals', [
            'tenant_id' => 1,
            'code' => 'POS-01',
            'branch_id' => $this->branchId,
        ]);
    }

    public function test_list_pos_terminals(): void
    {
        PosTerminal::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'REG-1',
            'name' => 'Register One',
            'branch_id' => $this->branchId,
            'is_active' => true,
        ]);

        $res = $this->getJson('/api/v1/pos/terminals', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'code', 'name', 'is_active']],
                'links' => ['first', 'last'],
                'meta' => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_show_pos_terminal(): void
    {
        $term = PosTerminal::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'REG-2',
            'name' => 'Register Two',
            'branch_id' => $this->branchId,
            'is_active' => true,
        ]);

        $res = $this->getJson("/api/v1/pos/terminals/{$term->id}", $this->headers());

        $res->assertStatus(200)
            ->assertJsonPath('data.id', $term->id)
            ->assertJsonPath('data.code', 'REG-2');
    }

    public function test_cross_tenant_isolation_protects_terminals(): void
    {
        $term = PosTerminal::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'REG-ISOLATED',
            'name' => 'Tenant 1 Terminal',
            'branch_id' => $this->branchId,
            'is_active' => true,
        ]);

        $tenant2 = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Other Chain',
            'slug' => 'other-chain',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($tenant2->toArray());

        $user2 = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'Other Manager',
            'email' => 'otherman@test.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role2 = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'Other Role',
            'slug' => 'other-'.Str::random(6),
            'is_system' => false,
        ]);

        $permission = Permission::firstOrCreate(
            ['name' => 'pos.terminal.view'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'pos',
                'resource' => 'terminal',
                'action' => 'view',
            ]
        );
        $role2->permissions()->attach($permission);
        $user2->roles()->attach($role2);

        $jwt2 = app(JwtService::class)->issueToken(
            userId: $user2->id,
            tenantId: 2,
            tokenVersion: 1
        );

        $res = $this->getJson("/api/v1/pos/terminals/{$term->id}", [
            'Authorization' => 'Bearer '.$jwt2,
            'X-Tenant' => $tenant2->slug,
            'Accept' => 'application/json',
        ]);

        $res->assertStatus(404);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, string>
     */
    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->jwt,
            'X-Tenant' => $this->tenant->slug,
            'Accept' => 'application/json',
        ];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Pos Admin',
            'slug' => 'posadmin-'.Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid' => (string) Str::uuid(),
                    'module' => $module,
                    'resource' => $resource,
                    'action' => $action,
                ]
            );
            $role->permissions()->attach($permission);
        }

        $this->user->roles()->detach();
        $this->user->roles()->attach($role);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );
    }
}
