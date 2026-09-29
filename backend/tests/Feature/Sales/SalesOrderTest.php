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
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class SalesOrderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Party $customer;
    private Warehouse $warehouse;
    private Product $product;
    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id'             => 1,
            'uuid'           => (string) Str::uuid(),
            'code'           => 'ENTERPRISE',
            'name'           => 'Enterprise',
            'price'          => '10000.0000',
            'billing_period' => 'monthly',
            'limits'         => json_encode(['max_users' => 100]),
            'is_active'      => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $this->tenant = Tenant::create([
            'id'            => 1,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'SliceMart BD',
            'slug'          => 'slicemart-bd',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 1,
            'name'          => 'Sales Officer',
            'email'         => 'sales@slicemart.test',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $this->unit = Unit::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'PCS',
            'name'      => 'Pieces',
            'type'      => 'unit',
        ]);

        $this->product = Product::create([
            'uuid'         => (string) Str::uuid(),
            'tenant_id'    => 1,
            'sku'          => 'BREAD-STD',
            'name'         => 'Standard Bread Loaf',
            'type'         => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'WH-MAIN',
            'name'      => 'Main Dispatch Warehouse',
            'type'      => 'finished',
            'is_active' => true,
        ]);

        $this->customer = Party::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'CUST-001',
            'name'      => 'Retail Partner Alpha',
            'type'      => 'customer',
        ]);

        $this->assignOnly(
            'sales.order.view',
            'sales.order.create',
            'sales.order.approve',
        );
    }

    public function test_create_sales_order_returns_201_with_draft_status(): void
    {
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date'   => now()->toDateString(),
            'channel'      => 'counter',
            'party_id'     => $this->customer->id,
            'warehouse_id' => $this->warehouse->id,
            'items'        => [
                [
                    'product_id' => $this->product->id,
                    'quantity'   => '10.0000',
                    'unit_id'    => $this->unit->id,
                    'unit_price' => '120.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.channel', 'counter')
            ->assertJsonPath('data.total_amount', '1200.0000')
            ->assertJsonPath('data.due_amount', '1200.0000');

        $this->assertDatabaseHas('sales_orders', [
            'tenant_id' => 1,
            'status'    => 'draft',
            'channel'   => 'counter',
        ]);
    }

    public function test_create_sales_order_with_uuid_references_succeeds(): void
    {
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'channel'    => 'dealer',
            'party_id'   => $this->customer->uuid,
            'items'      => [
                [
                    'product_id' => $this->product->uuid,
                    'quantity'   => '3.0000',
                    'unit_price' => '150.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.total_amount', '450.0000');

        $this->assertDatabaseHas('sales_order_items', [
            'tenant_id'  => 1,
            'product_id' => $this->product->id,
            'unit_id'    => $this->product->base_unit_id,
        ]);
    }

    public function test_approve_sales_order_transitions_to_confirmed(): void
    {
        $createRes = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'channel'    => 'dealer',
            'party_id'   => $this->customer->id,
            'items'      => [
                [
                    'product_id' => $this->product->id,
                    'quantity'   => '5.0000',
                    'unit_id'    => $this->unit->id,
                    'unit_price' => '200.0000',
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $orderId = $createRes->json('data.id');
        $this->assertIsInt($orderId);

        $approveRes = $this->postJson("/api/v1/sales/orders/{$orderId}/approve", [], $this->headers());

        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'confirmed');

        $this->assertDatabaseHas('sales_orders', [
            'id'     => $orderId,
            'status' => 'confirmed',
        ]);
    }

    public function test_list_orders_returns_paginated_envelope(): void
    {
        // Create two orders
        $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '2.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '50.0000',
            ]],
        ], $this->headers());

        $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'channel'    => 'online',
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '50.0000',
            ]],
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/orders', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data'  => [['id', 'order_number', 'channel', 'status', 'total_amount']],
                'links' => ['first', 'last'],
                'meta'  => ['total', 'per_page'],
            ])
            ->assertJsonPath('meta.total', 2);
    }

    public function test_filter_by_channel_returns_only_matching_orders(): void
    {
        $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'channel'    => 'counter',
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '50.0000',
            ]],
        ], $this->headers());

        $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'channel'    => 'online',
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '50.0000',
            ]],
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/orders?channel=counter', $this->headers());

        $res->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.channel', 'counter');
    }

    public function test_show_returns_single_order_with_items(): void
    {
        $createRes = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '3.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '80.0000',
            ]],
        ], $this->headers());

        $orderId = $createRes->json('data.id');

        $res = $this->getJson("/api/v1/sales/orders/{$orderId}", $this->headers());

        $res->assertStatus(200)
            ->assertJsonPath('data.id', $orderId)
            ->assertJsonPath('data.total_amount', '240.0000')
            ->assertJsonStructure(['data' => ['items']]);
    }

    public function test_cross_tenant_isolation_rejects_other_tenant_orders(): void
    {
        // Create order for tenant 1
        $createRes = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '100.0000',
            ]],
        ], $this->headers());
        $orderId = $createRes->json('data.id');

        // Create tenant 2 and its own user
        $tenant2 = Tenant::create([
            'id'            => 2,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'Rival Corp',
            'slug'          => 'rival-corp',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($tenant2->toArray());

        $user2 = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 2,
            'name'          => 'Rival Sales',
            'email'         => 'rival@rival.test',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $role2 = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 2,
            'name'      => 'Rival Role',
            'slug'      => 'rival-'.Str::random(6),
            'is_system' => false,
        ]);

        $permission = Permission::firstOrCreate(
            ['name' => 'sales.order.view'],
            [
                'uuid'     => (string) Str::uuid(),
                'module'   => 'sales',
                'resource' => 'order',
                'action'   => 'view',
            ]
        );
        $role2->permissions()->attach($permission);
        $user2->roles()->attach($role2);

        $jwt2 = app(JwtService::class)->issueToken(
            userId: $user2->id,
            tenantId: 2,
            tokenVersion: 1
        );

        // Tenant 2 must not see Tenant 1's order
        $res = $this->getJson("/api/v1/sales/orders/{$orderId}", [
            'Authorization' => 'Bearer ' . $jwt2,
            'X-Tenant'      => $tenant2->slug,
            'Accept'        => 'application/json',
        ]);

        $res->assertStatus(404);
    }

    public function test_missing_items_returns_422_validation_error(): void
    {
        // User has sales.order.create so 403 won't fire before validation
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            // items intentionally missing
        ], $this->headers());

        $res->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['items'],
                ],
            ]);
    }

    public function test_unauthorized_without_permission_returns_403(): void
    {
        // Create a separate user with no permissions
        $noPermUser = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 1,
            'name'          => 'No Perms User',
            'email'         => 'noperms@slicemart.test',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $emptyRole = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'name'      => 'Empty Role',
            'slug'      => 'empty-' . Str::random(6),
            'is_system' => false,
        ]);
        $noPermUser->roles()->attach($emptyRole);

        $noPermJwt = app(JwtService::class)->issueToken(
            userId: $noPermUser->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'items'      => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '100.0000',
            ]],
        ], [
            'Authorization' => 'Bearer ' . $noPermJwt,
            'X-Tenant'      => $this->tenant->slug,
            'Accept'        => 'application/json',
        ]);

        $res->assertStatus(403);
    }


    public function test_line_totals_computed_correctly_with_discount(): void
    {
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date' => now()->toDateString(),
            'items'      => [
                [
                    'product_id'      => $this->product->id,
                    'quantity'        => '10.0000',
                    'unit_id'         => $this->unit->id,
                    'unit_price'      => '100.0000',
                    'discount_amount' => '50.0000',
                    'tax_amount'      => '30.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            // subtotal = 1000, tax = 30, discount = 50 → total = 980
            ->assertJsonPath('data.subtotal', '1000.0000')
            ->assertJsonPath('data.discount_amount', '50.0000')
            ->assertJsonPath('data.tax_amount', '30.0000')
            ->assertJsonPath('data.total_amount', '980.0000');
    }

    public function test_create_sales_order_automatically_creates_unverified_crm_lead(): void
    {
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date'     => now()->toDateString(),
            'channel'        => 'dealer',
            'party_id'       => $this->customer->id,
            'customer_name'  => 'Diamond Electronics',
            'customer_phone' => '+8801700112233',
            'notes'          => 'Urgent delivery required',
            'items'          => [
                [
                    'product_id' => $this->product->id,
                    'quantity'   => '5.0000',
                    'unit_id'    => $this->unit->id,
                    'unit_price' => '300.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201);
        $orderData = $res->json('data');
        $leadId = $orderData['lead_id'];

        $this->assertNotNull($leadId);
        $this->assertDatabaseHas('crm_leads', [
            'id'                  => $leadId,
            'tenant_id'           => 1,
            'name'                => 'Diamond Electronics',
            'phone'               => '+8801700112233',
            'source'              => 'referral', // dealer channel maps to referral
            'stage'               => 'proposal',
            'is_fake'             => false,
            'validated_at'        => null,
            'converted_party_id'  => $this->customer->id,
        ]);
    }

    public function test_approving_sales_order_verifies_linked_lead_as_sold(): void
    {
        $res = $this->postJson('/api/v1/sales/orders', [
            'order_date'     => now()->toDateString(),
            'channel'        => 'counter',
            'party_id'       => $this->customer->id,
            'customer_name'  => 'Apex Super Store',
            'customer_phone' => '+8801811223344',
            'items'          => [
                [
                    'product_id' => $this->product->id,
                    'quantity'   => '2.0000',
                    'unit_id'    => $this->unit->id,
                    'unit_price' => '500.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201);
        $orderId = $res->json('data.id');
        $leadId = $res->json('data.lead_id');

        // Confirm / approve order (sold!)
        $approveRes = $this->postJson("/api/v1/sales/orders/{$orderId}/approve", [], $this->headers());
        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'confirmed');

        // Verify lead has transitioned to won & validated_at set
        $this->assertDatabaseHas('crm_leads', [
            'id'           => $leadId,
            'stage'        => 'won',
            'is_fake'      => false,
            'validated_by' => $this->user->id,
        ]);

        $lead = CrmLead::find($leadId);
        $this->assertNotNull($lead->validated_at);
        $this->assertStringContainsString('Sale verified upon order', $lead->validation_notes);
    }

    public function test_manual_verify_sale_creates_party_and_confirms_lead_and_order(): void
    {
        // Create an order for a walk-in lead (no party_id initially)
        $createRes = $this->postJson('/api/v1/sales/orders', [
            'customer_name' => 'Walk-in Customer Test',
            'order_date'    => now()->toDateString(),
            'notes'         => 'Walk-in buyer',
            'items'         => [[
                'product_id' => $this->product->id,
                'quantity'   => '2.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '250.0000',
            ]],
        ], $this->headers());

        $createRes->assertStatus(201);
        $leadId = $createRes->json('data.lead_id');
        $orderId = $createRes->json('data.id');
        $this->assertNotNull($leadId);

        // Verify the sale via POST /api/v1/sales/leads/{id}/verify-sale
        $verifyRes = $this->postJson("/api/v1/sales/leads/{$leadId}/verify-sale", [
            'notes' => 'Verified counter cash sale.',
        ], $this->headers());

        $verifyRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('lead.stage', 'won');

        $lead = CrmLead::find($leadId);
        $this->assertNotNull($lead->validated_at);
        $this->assertNotNull($lead->converted_party_id);

        // Assert party was created with non-null uuid and code
        $party = Party::find($lead->converted_party_id);
        $this->assertNotNull($party);
        $this->assertNotNull($party->uuid);
        $this->assertNotNull($party->code);
        $this->assertEquals('Walk-in Customer Test', $party->name);

        // Assert associated draft order was confirmed
        $order = SalesOrder::find($orderId);
        $this->assertEquals('confirmed', $order->status);
    }

    public function test_changeable_order_status_and_payment_status(): void
    {
        $createRes = $this->postJson('/api/v1/sales/orders', [
            'customer_name' => 'Status Change Test',
            'order_date'    => now()->toDateString(),
            'items'         => [[
                'product_id' => $this->product->id,
                'quantity'   => '1.0000',
                'unit_id'    => $this->unit->id,
                'unit_price' => '100.0000',
            ]],
        ], $this->headers());

        $orderId = $createRes->json('data.id');

        // Test changing status directly to delivered
        $statusRes = $this->patchJson("/api/v1/sales/orders/{$orderId}/status", [
            'status' => 'delivered',
        ], $this->headers());

        $statusRes->assertStatus(200)
            ->assertJsonPath('data.status', 'delivered');

        // Test changing payment status to paid
        $payRes = $this->postJson("/api/v1/sales/orders/{$orderId}/payment", [
            'payment_status' => 'paid',
        ], $this->headers());

        $payRes->assertStatus(200)
            ->assertJsonPath('data.payment_status', 'paid');

        // Test changing payment status back to unpaid
        $unpaidRes = $this->postJson("/api/v1/sales/orders/{$orderId}/payment", [
            'payment_status' => 'unpaid',
        ], $this->headers());

        $unpaidRes->assertStatus(200)
            ->assertJsonPath('data.payment_status', 'unpaid');
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, string>
     */
    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->jwt,
            'X-Tenant'      => $this->tenant->slug,
            'Accept'        => 'application/json',
        ];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'name'      => 'Sales Role',
            'slug'      => 'sales-' . Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid'     => (string) Str::uuid(),
                    'module'   => $module,
                    'resource' => $resource,
                    'action'   => $action,
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
