<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Inventory\Models\StockBalance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StockTransferTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Warehouse $warehouseFrom;

    private Warehouse $warehouseTo;

    private Product $product;

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
            'name' => 'Transfer Factory',
            'slug' => 'transfer-factory',
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
            'name' => 'Transfer Supervisor',
            'email' => 'transfer@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'count',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'ITEM-001',
            'name' => 'Packaged Slices',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouseFrom = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-ORIGIN',
            'name' => 'Plant A Warehouse',
            'type' => 'finished',
            'is_active' => true,
        ]);

        $this->warehouseTo = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-DEST',
            'name' => 'Distribution Hub B',
            'type' => 'finished',
            'is_active' => true,
        ]);

        // Stock initial 200 units in warehouseFrom
        /** @var RecordStockMovementAction $action */
        $action = app(RecordStockMovementAction::class);
        $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouseFrom->id,
            'movement_type' => 'production_output',
            'direction' => 'in',
            'quantity' => '200.0000',
            'unit_id' => $this->unit->id,
            'unit_cost' => '10.0000',
        ]);

        $this->assignOnly(
            'inventory.transfer.view',
            'inventory.transfer.create',
            'inventory.transfer.approve'
        );
    }

    public function test_create_dispatch_and_receive_transfer_lifecycle(): void
    {
        // 1. Create Draft Transfer of 50 units
        $createRes = $this->postJson('/api/v1/inventory/transfers', [
            'from_warehouse_id' => $this->warehouseFrom->id,
            'to_warehouse_id' => $this->warehouseTo->id,
            'transfer_date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'sent_quantity' => '50.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $transferId = $createRes->json('data.id');
        $itemId = $createRes->json('data.items.0.id');
        $this->assertIsInt($transferId);
        $this->assertIsInt($itemId);

        // 2. Dispatch Transfer (status -> in_transit, creates out movement from warehouseFrom)
        $dispatchRes = $this->postJson("/api/v1/inventory/transfers/{$transferId}/dispatch", [], $this->headers());
        $dispatchRes->assertStatus(200)
            ->assertJsonPath('data.status', 'in_transit');

        $balFrom = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouseFrom->id)
            ->where('product_id', $this->product->id)
            ->first();
        $this->assertEquals('150.0000', $balFrom?->quantity);

        // 3. Receive Transfer (status -> received, creates in movement at warehouseTo)
        $receiveRes = $this->postJson("/api/v1/inventory/transfers/{$transferId}/receive", [
            'items' => [
                [
                    'item_id' => $itemId,
                    'received_quantity' => '48.0000',
                    'damaged_quantity' => '2.0000',
                ],
            ],
        ], $this->headers());

        $receiveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'received');

        $balToAvailable = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouseTo->id)
            ->where('product_id', $this->product->id)
            ->where('stock_state', 'available')
            ->first();
        $this->assertEquals('48.0000', $balToAvailable?->quantity);

        $balToDamaged = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouseTo->id)
            ->where('product_id', $this->product->id)
            ->where('stock_state', 'damaged')
            ->first();
        $this->assertEquals('2.0000', $balToDamaged?->quantity);
    }

    public function test_sto_receiving_with_discrepancy_logging_and_partial_status(): void
    {
        // Create STO of 60 units
        $createRes = $this->postJson('/api/v1/inventory/transfers', [
            'from_warehouse_id' => $this->warehouseFrom->id,
            'to_warehouse_id' => $this->warehouseTo->id,
            'transfer_date' => now()->toDateString(),
            'notes' => 'Central Hub batch dispatch',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'sent_quantity' => '60.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $transferId = $createRes->json('data.id');
        $itemId = $createRes->json('data.items.0.id');

        // Dispatch STO -> in_transit
        $this->postJson("/api/v1/inventory/transfers/{$transferId}/dispatch", [], $this->headers())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_transit');

        // Destination receives with discrepancy: 50 received, 5 damaged, 5 shortage (60 sent)
        $receiveRes = $this->postJson("/api/v1/inventory/transfers/{$transferId}/receive", [
            'items' => [
                [
                    'item_id' => $itemId,
                    'received_quantity' => '50.0000',
                    'damaged_quantity' => '5.0000',
                ],
            ],
            'notes' => 'Driver reported box rupture during transit on Highway 4.',
        ], $this->headers());

        $receiveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'partially_received')
            ->assertJsonPath('data.items.0.received_quantity', '50.0000')
            ->assertJsonPath('data.items.0.damaged_quantity', '5.0000');

        $notes = $receiveRes->json('data.notes');
        $this->assertStringContainsString('Driver reported box rupture', $notes);
        $this->assertStringContainsString('Goods Receipt Discrepancy Log', $notes);
        $this->assertStringContainsString('Shortage=5.0000', $notes);
        $this->assertStringContainsString('Damaged=5.0000', $notes);

        // Verify available stock at destination = 50
        $avail = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouseTo->id)
            ->where('product_id', $this->product->id)
            ->where('stock_state', 'available')
            ->first();
        $this->assertEquals('50.0000', $avail?->quantity);

        // Verify damaged stock at destination = 5
        $dmg = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouseTo->id)
            ->where('product_id', $this->product->id)
            ->where('stock_state', 'damaged')
            ->first();
        $this->assertEquals('5.0000', $dmg?->quantity);
    }

    public function test_sto_dispatch_and_receive_via_uuid_routes(): void
    {
        $createRes = $this->postJson('/api/v1/inventory/transfers', [
            'from_warehouse_id' => $this->warehouseFrom->uuid,
            'to_warehouse_id' => $this->warehouseTo->uuid,
            'transfer_date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->uuid,
                    'sent_quantity' => '20.0000',
                    'unit_id' => $this->unit->uuid,
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $transferUuid = $createRes->json('data.uuid');
        $itemUuid = $createRes->json('data.items.0.uuid');
        $this->assertNotNull($transferUuid);

        // Dispatch via UUID
        $this->postJson("/api/v1/inventory/transfers/{$transferUuid}/dispatch", [], $this->headers())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_transit');

        // Receive via UUID with item UUID
        $this->postJson("/api/v1/inventory/transfers/{$transferUuid}/receive", [
            'items' => [
                [
                    'item_id' => $itemUuid,
                    'received_quantity' => '20.0000',
                    'damaged_quantity' => '0.0000',
                ],
            ],
        ], $this->headers())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'received');
    }

    public function test_sto_quick_receive_defaults_to_all_sent_quantity(): void
    {
        $createRes = $this->postJson('/api/v1/inventory/transfers', [
            'from_warehouse_id' => $this->warehouseFrom->id,
            'to_warehouse_id' => $this->warehouseTo->id,
            'transfer_date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'sent_quantity' => '15.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $transferId = $createRes->json('data.id');

        $this->postJson("/api/v1/inventory/transfers/{$transferId}/dispatch", [], $this->headers())
            ->assertStatus(200);

        // 1-click receive with empty body
        $this->postJson("/api/v1/inventory/transfers/{$transferId}/receive", [], $this->headers())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'received')
            ->assertJsonPath('data.items.0.received_quantity', '15.0000')
            ->assertJsonPath('data.items.0.damaged_quantity', '0.0000');
    }

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
            'name' => 'Transfer Role',
            'slug' => 'trans-'.Str::random(6),
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
