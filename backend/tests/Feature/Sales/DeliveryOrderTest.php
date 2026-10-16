<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

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
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class DeliveryOrderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Party $customer;

    private Warehouse $warehouse;

    private Product $product;

    private Unit $unit;

    private SalesOrder $salesOrder;

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
            'name' => 'Logistics Officer',
            'email' => 'logistics@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'CTN',
            'name' => 'Carton',
            'type' => 'unit',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'BISCUIT-CTN-24',
            'name' => 'Butter Biscuits 24x Carton',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-LOG',
            'name' => 'Logistics Center',
            'type' => 'finished',
            'is_active' => true,
        ]);

        $this->customer = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'CUST-004',
            'name' => 'Supermarket Delta',
            'type' => 'customer',
        ]);

        $this->salesOrder = SalesOrder::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-202608-001',
            'party_id' => $this->customer->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => now()->toDateString(),
            'subtotal' => '12000.0000',
            'discount_amount' => '0.0000',
            'tax_amount' => '0.0000',
            'shipping_amount' => '0.0000',
            'round_off' => '0.0000',
            'total_amount' => '12000.0000',
            'paid_amount' => '0.0000',
            'due_amount' => '12000.0000',
            'status' => 'confirmed',
            'channel' => 'dealer',
        ]);

        $this->assignOnly(
            'sales.delivery.view',
            'sales.delivery.create',
            'sales.delivery.dispatch'
        );
    }

    public function test_create_delivery_order_returns_201(): void
    {
        $res = $this->postJson('/api/v1/sales/deliveries', [
            'sales_order_id' => $this->salesOrder->id,
            'warehouse_id' => $this->warehouse->id,
            'party_id' => $this->customer->id,
            'recipient_name' => 'Store Manager',
            'recipient_phone' => '+8801711000000',
            'delivery_type' => 'own_delivery',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '10.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.recipient_name', 'Store Manager');

        $this->assertDatabaseHas('delivery_orders', [
            'tenant_id' => 1,
            'sales_order_id' => $this->salesOrder->id,
            'status' => 'pending',
        ]);
    }

    public function test_dispatch_delivery_order_creates_stock_movement_and_updates_status(): void
    {
        $createRes = $this->postJson('/api/v1/sales/deliveries', [
            'sales_order_id' => $this->salesOrder->id,
            'warehouse_id' => $this->warehouse->id,
            'party_id' => $this->customer->id,
            'recipient_name' => 'Store Manager',
            'recipient_phone' => '+8801711000000',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '5.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $deliveryId = $createRes->json('data.id');

        $dispatchRes = $this->postJson("/api/v1/sales/deliveries/{$deliveryId}/dispatch", [], $this->headers());

        $dispatchRes->assertStatus(200)
            ->assertJsonPath('data.status', 'delivered');

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $deliveryId,
            'status' => 'delivered',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'sales_dispatch',
            'direction' => 'out',
            'quantity' => '5.0000',
            'reference_type' => 'delivery_order',
            'reference_id' => $deliveryId,
        ]);
    }

    public function test_list_deliveries_returns_paginated_envelope(): void
    {
        $this->postJson('/api/v1/sales/deliveries', [
            'sales_order_id' => $this->salesOrder->id,
            'warehouse_id' => $this->warehouse->id,
            'recipient_name' => 'Receiver One',
            'recipient_phone' => '+8801711000001',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '2.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/deliveries', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'delivery_number', 'status', 'recipient_name']],
                'links' => ['first', 'last'],
                'meta' => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_cross_tenant_isolation_protects_deliveries(): void
    {
        $createRes = $this->postJson('/api/v1/sales/deliveries', [
            'sales_order_id' => $this->salesOrder->id,
            'warehouse_id' => $this->warehouse->id,
            'recipient_name' => 'Receiver One',
            'recipient_phone' => '+8801711000001',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '1.0000',
                    'unit_id' => $this->unit->id,
                ],
            ],
        ], $this->headers());
        $deliveryId = $createRes->json('data.id');

        // Create Tenant 2
        $tenant2 = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Other Logistics',
            'slug' => 'other-logistics',
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
            'name' => 'Other Logistics User',
            'email' => 'otherlogistics@test.com',
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
            ['name' => 'sales.delivery.view'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'sales',
                'resource' => 'delivery',
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

        $res = $this->getJson("/api/v1/sales/deliveries/{$deliveryId}", [
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
            'name' => 'Delivery Role',
            'slug' => 'deliv-'.Str::random(6),
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
