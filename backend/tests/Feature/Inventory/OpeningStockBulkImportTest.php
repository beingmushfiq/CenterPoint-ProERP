<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class OpeningStockBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Product $product1;

    private Product $product2;

    private Warehouse $warehouse;

    private Unit $unit;

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
            'name' => 'SliceMart Inventory Test',
            'slug' => 'slicemart-inv',
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
            'name' => 'Inventory Manager',
            'email' => 'invmanager@slicemart.com',
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

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
            'precision' => 0,
            'is_base_unit' => true,
            'is_active' => true,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'WH-MAIN',
            'name' => 'Main Warehouse',
            'type' => 'general',
            'is_default' => true,
            'is_active' => true,
        ]);

        $this->product1 = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'sku' => 'SKU-ITEM-001',
            'name' => 'Test Product Alpha',
            'type' => 'standard',
            'base_unit_id' => $this->unit->id,
            'purchase_price' => '100.0000',
            'selling_price' => '150.0000',
            'is_active' => true,
        ]);

        $this->product2 = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'sku' => 'SKU-ITEM-002',
            'name' => 'Test Product Beta',
            'type' => 'standard',
            'base_unit_id' => $this->unit->id,
            'purchase_price' => '50.0000',
            'selling_price' => '80.0000',
            'is_active' => true,
        ]);
    }

    public function test_can_bulk_import_opening_stock_balances_and_movements(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'sku' => 'SKU-ITEM-001',
                    'warehouse_code' => 'WH-MAIN',
                    'location_code' => 'Bin-A1',
                    'batch_code' => 'BATCH-2026-01',
                    'quantity' => 100,
                    'unit_cost' => 45.5,
                    'expiry_date' => '2027-12-31',
                    'stock_state' => 'available',
                ],
                [
                    'sku' => 'SKU-ITEM-002',
                    'warehouse_code' => 'WH-MAIN',
                    'location_code' => 'Bin-A2',
                    'batch_code' => 'BATCH-2026-02',
                    'quantity' => 50,
                    'unit_cost' => 20.0,
                    'stock_state' => 'available',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/inventory/opening-stock/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'imported' => 2,
                    'updated' => 0,
                    'skipped' => 0,
                    'failed' => 0,
                ],
            ]);

        $this->assertDatabaseHas('warehouse_locations', [
            'tenant_id' => $this->tenant->id,
            'warehouse_id' => $this->warehouse->id,
            'code' => 'Bin-A1',
        ]);

        $this->assertDatabaseHas('stock_balances', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product1->id,
            'warehouse_id' => $this->warehouse->id,
            'batch_code' => 'BATCH-2026-01',
            'quantity' => '100.0000',
            'average_cost' => '45.5000',
            'total_value' => '4550.0000',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product1->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'opening_balance',
            'direction' => 'in',
            'quantity' => '100.0000',
        ]);
    }

    public function test_opening_stock_bulk_import_skip_and_upsert(): void
    {
        // First import initial balances
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'sku' => 'SKU-ITEM-001',
                    'warehouse_code' => 'WH-MAIN',
                    'quantity' => 50,
                    'unit_cost' => 30.0,
                ],
            ],
        ];

        $this->postJson('/api/v1/inventory/opening-stock/bulk-import', $initialPayload, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.imported', 1);

        // Second import with skip mode -> should skip
        $skipPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'sku' => 'SKU-ITEM-001',
                    'warehouse_code' => 'WH-MAIN',
                    'quantity' => 80,
                    'unit_cost' => 35.0,
                ],
            ],
        ];

        $this->postJson('/api/v1/inventory/opening-stock/bulk-import', $skipPayload, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.skipped', 1);

        // Balance should remain 50
        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $this->product1->id,
            'quantity' => '50.0000',
        ]);

        // Third import with upsert mode -> should update balance to 80
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'sku' => 'SKU-ITEM-001',
                    'warehouse_code' => 'WH-MAIN',
                    'quantity' => 80,
                    'unit_cost' => 35.0,
                ],
            ],
        ];

        $this->postJson('/api/v1/inventory/opening-stock/bulk-import', $upsertPayload, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.updated', 1);

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $this->product1->id,
            'quantity' => '80.0000',
            'average_cost' => '35.0000',
            'total_value' => '2800.0000',
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
