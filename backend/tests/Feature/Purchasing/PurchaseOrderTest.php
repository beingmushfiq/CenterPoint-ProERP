<?php

declare(strict_types=1);

namespace Tests\Feature\Purchasing;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Purchasing\Models\PurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PurchaseOrderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Party $supplier;
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
            'name' => 'PO Factory',
            'slug' => 'po-factory',
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
            'name' => 'Procurement Officer',
            'email' => 'buyer@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'BAG',
            'name' => 'Bag (50kg)',
            'type' => 'unit',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'FLOUR-50KG',
            'name' => 'Bulk Flour 50kg',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-MILL',
            'name' => 'Central Mill Silo',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->supplier = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'SUP-AGRO',
            'name' => 'Agro Grain Ltd',
            'type' => 'vendor',
        ]);

        $this->assignOnly(
            'purchasing.order.view',
            'purchasing.order.create',
            'purchasing.order.approve'
        );
    }

    public function test_create_and_approve_purchase_order(): void
    {
        $createRes = $this->postJson('/api/v1/purchasing/orders', [
            'party_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => now()->toDateString(),
            'expected_delivery_date' => now()->addDays(7)->toDateString(),
            'currency_code' => 'BDT',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '100.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '45.0000',
                    'discount_amount' => '0.0000',
                    'tax_rate' => '0.0000',
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.grand_total', '4500.0000');

        $poId = $createRes->json('data.id');
        $this->assertIsInt($poId);

        $approveRes = $this->postJson("/api/v1/purchasing/orders/{$poId}/approve", [], $this->headers());

        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'status' => 'approved',
        ]);
    }

    public function test_purchase_order_does_not_double_count_line_item_discount(): void
    {
        // 1 item of qty 100 @ 45 = 4500 subtotal.
        // Line discount: flat 500 (or 500 discount_amount).
        // Order discount: 0 (or absent order_discount_value with discount_amount: 500).
        // Grand total MUST be 4000.0000 and total discount MUST be exactly 500.0000.
        $res = $this->postJson('/api/v1/purchasing/orders', [
            'party_id'             => $this->supplier->id,
            'warehouse_id'         => $this->warehouse->id,
            'order_date'           => '2026-08-25',
            'order_discount_type'  => 'flat',
            'order_discount_value' => '0.0000',
            'discount_amount'      => '500.0000',
            'currency_code'        => 'BDT',
            'items'                => [
                [
                    'product_id'          => $this->product->id,
                    'quantity'            => '100.0000',
                    'unit_id'             => $this->unit->id,
                    'unit_price'          => '45.0000',
                    'discount_type'       => 'flat',
                    'discount_value'      => '500.0000',
                    'discount_amount'     => '500.0000',
                    'tax_rate'            => '0.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.subtotal_amount', '4500.0000')
            ->assertJsonPath('data.discount_amount', '500.0000')
            ->assertJsonPath('data.grand_total', '4000.0000');

        $this->assertDatabaseHas('purchase_orders', [
            'id'              => $res->json('data.id'),
            'subtotal'        => '4500.0000',
            'discount_amount' => '500.0000',
            'total_amount'    => '4000.0000',
        ]);
    }

    public function test_create_purchase_order_with_multiple_items_and_uuid_references(): void
    {
        $secondProduct = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'RAW-SUGAR-01',
            'name' => 'Refined Cane Sugar',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
            'is_purchased' => true,
            'is_stock_tracked' => true,
        ]);

        $res = $this->postJson('/api/v1/purchasing/orders', [
            'party_id' => $this->supplier->uuid,
            'warehouse_id' => $this->warehouse->uuid,
            'order_date' => now()->toDateString(),
            'order_discount_type' => 'percentage',
            'order_discount_value' => '10.0000',
            'items' => [
                [
                    'product_id' => $this->product->uuid,
                    'quantity' => '10.0000',
                    'unit_price' => '100.0000',
                    'discount_type' => 'percentage',
                    'discount_value' => '5.0000',
                ],
                [
                    'product_id' => $secondProduct->uuid,
                    'quantity' => '5.0000',
                    'unit_price' => '200.0000',
                    'discount_type' => 'flat',
                    'discount_value' => '50.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201);
        $poId = $res->json('data.id');
        $this->assertIsInt($poId);

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $poId,
            'tenant_id' => 1,
            'party_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
        ]);

        $this->assertDatabaseHas('purchase_order_items', [
            'purchase_order_id' => $poId,
            'product_id' => $this->product->id,
            'unit_id' => $this->unit->id,
        ]);

        $this->assertDatabaseHas('purchase_order_items', [
            'purchase_order_id' => $poId,
            'product_id' => $secondProduct->id,
            'unit_id' => $this->unit->id,
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
            'name' => 'Buyer Role',
            'slug' => 'po-'.Str::random(6),
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
