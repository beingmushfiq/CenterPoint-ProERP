<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WarehouseBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

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
            'name' => 'SliceMart Logistics',
            'slug' => 'slicemart-logistics',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Warehouse Manager',
            'email' => 'whmanager@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );
    }

    public function test_can_bulk_import_warehouses_and_auto_seed_locations(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'WH-DHAKA-MAIN',
                    'name' => 'Dhaka Central Hub',
                    'type' => 'finished_goods',
                    'address' => 'Tejgaon Industrial Area, Dhaka',
                    'locations' => 'Rack-A1, Rack-A2, Bin-101',
                    'allows_negative_stock' => false,
                    'is_default' => true,
                    'is_active' => true,
                ],
                [
                    'code' => 'WH-CTG-PORT',
                    'name' => 'Chittagong Port Depot',
                    'type' => 'raw_materials',
                    'address' => 'Agrabad C/A, Chittagong',
                    'locations' => 'Yard-1, Yard-2',
                    'allows_negative_stock' => false,
                    'is_default' => false,
                    'is_active' => true,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/warehouses/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'total' => 2,
            'imported' => 2,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $this->assertDatabaseHas('warehouses', [
            'tenant_id' => $this->tenant->id,
            'code' => 'WH-DHAKA-MAIN',
            'name' => 'Dhaka Central Hub',
            'type' => 'finished_goods',
            'is_default' => 1,
        ]);

        $wh = Warehouse::where('code', 'WH-DHAKA-MAIN')->firstOrFail();

        $this->assertDatabaseHas('warehouse_locations', [
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => $wh->id,
            'name' => 'Rack-A1',
        ]);
        $this->assertDatabaseHas('warehouse_locations', [
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => $wh->id,
            'name' => 'Bin-101',
        ]);
    }

    public function test_can_upsert_existing_warehouse(): void
    {
        Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-OLD',
            'name' => 'Old Storage Name',
            'type' => 'general',
            'address' => 'Old Address',
            'allows_negative_stock' => false,
            'is_default' => false,
            'is_active' => false,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'WH-OLD',
                    'name' => 'Modern Cold Storage',
                    'type' => 'finished_goods',
                    'address' => 'New High-Tech Zone',
                    'allows_negative_stock' => false,
                    'is_default' => true,
                    'is_active' => true,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/warehouses/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'imported' => 0,
            'updated' => 1,
            'skipped' => 0,
        ]);

        $this->assertDatabaseHas('warehouses', [
            'code' => 'WH-OLD',
            'name' => 'Modern Cold Storage',
            'type' => 'finished_goods',
            'address' => 'New High-Tech Zone',
            'is_default' => 1,
            'is_active' => 1,
        ]);
    }

    private function authHeaders(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
            'Accept' => 'application/json',
        ];
    }
}
