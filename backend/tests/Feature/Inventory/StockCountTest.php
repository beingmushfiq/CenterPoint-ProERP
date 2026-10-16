<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ReasonCode;
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

final class StockCountTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Warehouse $warehouse;

    private Product $product;

    private Unit $unit;

    private ReasonCode $reasonCode;

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
            'name' => 'Count Factory',
            'slug' => 'count-factory',
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
            'name' => 'Count Lead',
            'email' => 'count@slicemart.test',
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
            'sku' => 'YEAST-001',
            'name' => 'Dry Yeast',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-COLD',
            'name' => 'Cold Storage 1',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->reasonCode = ReasonCode::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'COUNT-VAR',
            'name' => 'Physical Count Discrepancy',
            'context' => 'inventory_adjustment',
            'is_active' => true,
        ]);

        // Current system stock = 50 KG
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
            'unit_cost' => '4.0000',
        ]);

        $this->assignOnly(
            'inventory.count.view',
            'inventory.count.create',
            'inventory.count.approve'
        );
    }

    public function test_create_stock_count_and_reconcile(): void
    {
        // 1. Create Stock Count session snapshotting current inventory
        $createRes = $this->postJson('/api/v1/inventory/counts', [
            'warehouse_id' => $this->warehouse->id,
            'count_date' => now()->toDateString(),
            'count_type' => 'full',
            'notes' => 'Month-end full physical count',
        ], $this->headers());

        $createRes->assertStatus(201);
        $countId = $createRes->json('data.id');
        $itemId = $createRes->json('data.items.0.id');
        $this->assertIsInt($countId);
        $this->assertIsInt($itemId);

        $this->assertEquals('50.0000', $createRes->json('data.items.0.snapshot_quantity'));

        // 2. Reconcile with actual physical counted 47 KG (variance: -3)
        $reconcileRes = $this->postJson("/api/v1/inventory/counts/{$countId}/reconcile", [
            'items' => [
                [
                    'item_id' => $itemId,
                    'counted_quantity' => '47.0000',
                    'reason_code_id' => $this->reasonCode->id,
                ],
            ],
        ], $this->headers());

        $reconcileRes->assertStatus(200)
            ->assertJsonPath('data.status', 'reconciled');

        // 3. Verify stock balance was adjusted to 47
        $balance = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->first();

        $this->assertNotNull($balance);
        $this->assertEquals('47.0000', $balance->quantity);
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
            'name' => 'Count Role',
            'slug' => 'count-'.Str::random(6),
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
