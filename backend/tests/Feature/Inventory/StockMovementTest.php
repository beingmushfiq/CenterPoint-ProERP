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
use App\Modules\Inventory\Models\StockMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Warehouse $warehouse;

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
            'name' => 'Stock Factory',
            'slug' => 'stock-factory',
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
            'name' => 'Storekeeper',
            'email' => 'storekeeper@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'KG',
            'name' => 'Kilogram',
            'type' => 'weight',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'SUGAR-001',
            'name' => 'Refined Cane Sugar',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-MAIN',
            'name' => 'Central Materials Warehouse',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->assignOnly(
            'inventory.movement.view',
            'inventory.stock.view'
        );
    }

    public function test_record_stock_movement_in_and_updates_balance(): void
    {
        /** @var RecordStockMovementAction $action */
        $action = app(RecordStockMovementAction::class);

        $movement = $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'purchase_receipt',
            'direction' => 'in',
            'quantity' => '100.0000',
            'unit_id' => $this->unit->id,
            'unit_cost' => '2.5000',
            'batch_code' => 'BATCH-2026-001',
            'created_by' => $this->user->id,
        ]);

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals('100.0000', $movement->quantity);
        $this->assertEquals('2.5000', $movement->unit_cost);
        $this->assertEquals('250.0000', $movement->total_cost);
        $this->assertEquals('100.0000', $movement->balance_after);

        $balance = StockBalance::where('tenant_id', 1)
            ->where('product_id', $this->product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('batch_code', 'BATCH-2026-001')
            ->first();

        $this->assertNotNull($balance);
        $this->assertEquals('100.0000', $balance->quantity);
        $this->assertEquals('2.5000', $balance->average_cost);
        $this->assertEquals('250.0000', $balance->total_value);
    }

    public function test_record_stock_movement_out_deducts_balance(): void
    {
        /** @var RecordStockMovementAction $action */
        $action = app(RecordStockMovementAction::class);

        // Receive 100
        $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'purchase_receipt',
            'direction' => 'in',
            'quantity' => '100.0000',
            'unit_id' => $this->unit->id,
            'unit_cost' => '2.5000',
            'batch_code' => 'BATCH-2026-001',
        ]);

        // Issue 40
        $outMovement = $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'production_input',
            'direction' => 'out',
            'quantity' => '40.0000',
            'unit_id' => $this->unit->id,
            'batch_code' => 'BATCH-2026-001',
        ]);

        $this->assertEquals('60.0000', $outMovement->balance_after);

        $balance = StockBalance::where('tenant_id', 1)
            ->where('product_id', $this->product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('batch_code', 'BATCH-2026-001')
            ->first();

        $this->assertNotNull($balance);
        $this->assertEquals('60.0000', $balance->quantity);
        $this->assertEquals('150.0000', $balance->total_value);
    }

    public function test_list_stock_movements_api(): void
    {
        /** @var RecordStockMovementAction $action */
        $action = app(RecordStockMovementAction::class);
        $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'purchase_receipt',
            'direction' => 'in',
            'quantity' => '50.0000',
            'unit_id' => $this->unit->id,
            'unit_cost' => '2.0000',
        ]);

        $response = $this->getJson('/api/v1/inventory/movements', $this->headers());

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'movement_number', 'product_id', 'warehouse_id', 'quantity', 'direction'],
                ],
            ]);
    }

    public function test_list_stock_balances_api(): void
    {
        /** @var RecordStockMovementAction $action */
        $action = app(RecordStockMovementAction::class);
        $action->execute([
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'purchase_receipt',
            'direction' => 'in',
            'quantity' => '75.0000',
            'unit_id' => $this->unit->id,
            'unit_cost' => '3.0000',
        ]);

        $response = $this->getJson('/api/v1/inventory/balances', $this->headers());

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'product_id', 'warehouse_id', 'quantity', 'average_cost', 'total_value'],
                ],
            ]);
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
            'name' => 'Stock Role',
            'slug' => 'stock-'.Str::random(6),
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
