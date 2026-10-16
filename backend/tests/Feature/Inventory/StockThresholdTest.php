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
use App\Modules\Inventory\Models\StockBalance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StockThresholdTest extends TestCase
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
            'type' => 'raw_material',
            'status' => 'active',
            'is_stock_tracked' => true,
            'reorder_level' => '25.0000',
            'reorder_quantity' => '100.0000',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-MAIN',
            'name' => 'Central Materials Warehouse',
            'type' => 'raw_material',
            'is_active' => true,
        ]);

        $this->assignOnly(
            'inventory.stock.view',
            'inventory.threshold.view',
            'inventory.threshold.update'
        );
    }

    public function test_thresholds_index_returns_monitored_products_and_balances(): void
    {
        // Seed an available stock balance
        StockBalance::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'stock_state' => 'available',
            'quantity' => '15.0000',
            'average_cost' => '50.0000',
            'total_value' => '750.0000',
        ]);

        $response = $this->withHeaders($this->headers())->getJson('/api/v1/inventory/thresholds');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'product_id',
                        'product_name',
                        'sku',
                        'category_name',
                        'unit_code',
                        'warehouse_id',
                        'warehouse_name',
                        'current_stock',
                        'min_stock_alert',
                        'reorder_quantity',
                        'max_stock_level',
                        'is_low_stock',
                        'deficit',
                    ],
                ],
                'summary' => [
                    'total_monitored',
                    'low_stock_count',
                ],
            ]);

        $items = $response->json('data');
        $this->assertCount(1, $items);
        $this->assertSame($this->product->id, $items[0]['product_id']);
        $this->assertSame(15.0, (float) $items[0]['current_stock']);
        // Since stock (15) < min_stock_alert (25 from product reorder_level), it should be marked low stock
        $this->assertTrue($items[0]['is_low_stock']);
        $this->assertSame(10.0, (float) $items[0]['deficit']);
        $this->assertSame(1, $response->json('summary.total_monitored'));
        $this->assertSame(1, $response->json('summary.low_stock_count'));
    }

    public function test_can_save_custom_threshold(): void
    {
        $payload = [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'min_stock_alert' => 50,
            'reorder_quantity' => 200,
            'max_stock_level' => 1000,
        ];

        $response = $this->withHeaders($this->headers())->postJson('/api/v1/inventory/thresholds', $payload);

        $response->assertOk();

        $this->assertDatabaseHas('product_warehouse_min_stocks', [
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'min_stock_alert' => '50.0000',
            'reorder_quantity' => '200.0000',
        ]);
    }

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
