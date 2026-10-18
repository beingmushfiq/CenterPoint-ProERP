<?php

declare(strict_types=1);

namespace Tests\Feature\Pos;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PosSessionTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private int $branchId;

    private Warehouse $warehouse;

    private PosTerminal $terminal;

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
            'name' => 'Cashier User',
            'email' => 'poscashier@slicemart.test',
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
            'tax_identifier' => 'BIN-POS-02',
            'registration_number' => 'REG-POS-02',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branchId = (int) DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'company_id' => $companyId,
            'code' => 'BR-DHK-02',
            'name' => 'Gulshan Outlet',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-GUL',
            'name' => 'Gulshan Retail Stock',
            'type' => 'retail',
            'is_active' => true,
        ]);

        $this->terminal = PosTerminal::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'POS-GUL-1',
            'name' => 'Gulshan Register 1',
            'branch_id' => $this->branchId,
            'default_warehouse_id' => $this->warehouse->id,
            'is_active' => true,
        ]);

        $this->assignOnly(
            'pos.session.view',
            'pos.session.open',
            'pos.session.close'
        );
    }

    public function test_open_pos_session_returns_201(): void
    {
        $res = $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '2000.0000',
            'notes' => 'Opening morning shift',
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.opening_cash', '2000.0000')
            ->assertJsonPath('data.expected_cash', '2000.0000');

        $this->assertDatabaseHas('pos_sessions', [
            'tenant_id' => 1,
            'terminal_id' => $this->terminal->id,
            'status' => 'open',
            'opening_cash' => '2000.0000',
        ]);
    }

    public function test_cannot_open_second_session_on_same_terminal(): void
    {
        // Open first session
        $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '1000.0000',
        ], $this->headers());

        // Attempt second open
        $res = $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '500.0000',
        ], $this->headers());

        // DomainException is thrown, mapped to 500/handled
        $this->assertTrue(in_array($res->status(), [400, 422, 500], true));
    }

    public function test_close_pos_session_calculates_cash_variance(): void
    {
        $openRes = $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '2000.0000',
        ], $this->headers());

        $sessionId = $openRes->json('data.id');

        $closeRes = $this->postJson("/api/v1/pos/sessions/{$sessionId}/close", [
            'counted_cash' => '2050.0000',
            'notes' => 'Closing evening shift with +50 surplus',
        ], $this->headers());

        $closeRes->assertStatus(200)
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.counted_cash', '2050.0000')
            ->assertJsonPath('data.cash_variance', '50.0000');

        $this->assertDatabaseHas('pos_sessions', [
            'id' => $sessionId,
            'status' => 'closed',
            'counted_cash' => '2050.0000',
            'cash_variance' => '50.0000',
        ]);
    }

    public function test_list_pos_sessions(): void
    {
        $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '1500.0000',
        ], $this->headers());

        $res = $this->getJson('/api/v1/pos/sessions', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'session_number', 'status', 'opening_cash']],
                'links' => ['first', 'last'],
                'meta' => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_show_and_close_pos_session_using_uuid(): void
    {
        $openRes = $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => $this->terminal->id,
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'opening_cash' => '1200.0000',
        ], $this->headers());

        $openRes->assertStatus(201);
        $uuid = (string) $openRes->json('data.uuid');
        $this->assertNotEmpty($uuid);

        // 1. Show by UUID
        $showRes = $this->getJson("/api/v1/pos/sessions/{$uuid}", $this->headers());
        $showRes->assertStatus(200)
            ->assertJsonPath('data.uuid', $uuid)
            ->assertJsonPath('data.opening_cash', '1200.0000');

        // 2. Close by UUID
        $closeRes = $this->postJson("/api/v1/pos/sessions/{$uuid}/close", [
            'counted_cash' => '1200.0000',
            'notes' => 'UUID shift close test',
        ], $this->headers());

        $closeRes->assertStatus(200)
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.uuid', $uuid);
    }

    public function test_open_pos_session_auto_provisions_or_resolves_when_terminal_missing(): void
    {
        // Delete pre-created terminals to simulate brand-new tenant onboarding
        $this->terminal->delete();

        $res = $this->postJson('/api/v1/pos/sessions', [
            'opening_cash' => '1500.0000',
            'notes' => 'Auto-provision shift test',
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.opening_cash', '1500.0000');

        $this->assertDatabaseHas('pos_terminals', [
            'tenant_id' => 1,
            'code' => 'TRM-01',
        ]);
    }

    public function test_open_pos_session_recovers_gracefully_with_invalid_ids(): void
    {
        $res = $this->postJson('/api/v1/pos/sessions', [
            'terminal_id' => 999999,
            'branch_id' => 999999,
            'warehouse_id' => 999999,
            'opening_cash' => '500.0000',
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.opening_cash', '500.0000');
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
            'name' => 'Session Admin',
            'slug' => 'sessadmin-'.Str::random(6),
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
