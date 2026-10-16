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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Party $customer;

    private Product $product;

    private Unit $unit;

    private Warehouse $warehouse;

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
            'name' => 'Accountant',
            'email' => 'accounts@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'BOX',
            'name' => 'Box',
            'type' => 'unit',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'CAKE-BOX-12',
            'name' => 'Fruit Cake 12-Pack',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-FIN',
            'name' => 'Finished Goods Hub',
            'type' => 'finished',
            'is_active' => true,
        ]);

        $this->customer = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'CUST-002',
            'name' => 'Distributor Beta',
            'type' => 'customer',
        ]);

        $this->assignOnly(
            'sales.invoice.view',
            'sales.invoice.create',
            'sales.invoice.approve',
            'sales.invoice.void',
            'sales.order.view',
            'sales.order.create'
        );
    }

    public function test_create_invoice_returns_201_with_draft_status(): void
    {
        $res = $this->postJson('/api/v1/sales/invoices', [
            'invoice_date' => now()->toDateString(),
            'party_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '20.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '350.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.total_amount', '7000.0000')
            ->assertJsonPath('data.paid_amount', '0.0000');

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => 1,
            'party_id' => $this->customer->id,
            'status' => 'draft',
        ]);
    }

    public function test_approve_invoice_transitions_to_approved(): void
    {
        $createRes = $this->postJson('/api/v1/sales/invoices', [
            'invoice_date' => now()->toDateString(),
            'party_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '5.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '100.0000',
                ],
            ],
        ], $this->headers());

        $invoiceId = $createRes->json('data.id');

        $approveRes = $this->postJson("/api/v1/sales/invoices/{$invoiceId}/approve", [], $this->headers());

        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'posted');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => 'posted',
        ]);
    }

    public function test_void_invoice_with_reason(): void
    {
        $createRes = $this->postJson('/api/v1/sales/invoices', [
            'invoice_date' => now()->toDateString(),
            'party_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '2.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '100.0000',
                ],
            ],
        ], $this->headers());

        $invoiceId = $createRes->json('data.id');

        $voidRes = $this->postJson("/api/v1/sales/invoices/{$invoiceId}/void", [
            'void_reason' => 'Customer cancelled the agreement before delivery',
        ], $this->headers());

        $voidRes->assertStatus(200)
            ->assertJsonPath('data.status', 'void')
            ->assertJsonPath('data.void_reason', 'Customer cancelled the agreement before delivery');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => 'void',
            'void_reason' => 'Customer cancelled the agreement before delivery',
        ]);
    }

    public function test_list_invoices_returns_paginated_collection(): void
    {
        $this->postJson('/api/v1/sales/invoices', [
            'invoice_date' => now()->toDateString(),
            'party_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '1.0000',
                    'unit_price' => '100.0000',
                ],
            ],
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/invoices', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'invoice_number', 'status', 'total_amount']],
                'links' => ['first', 'last'],
                'meta' => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_cross_tenant_isolation_protects_invoices(): void
    {
        $createRes = $this->postJson('/api/v1/sales/invoices', [
            'invoice_date' => now()->toDateString(),
            'party_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '1.0000',
                    'unit_price' => '100.0000',
                ],
            ],
        ], $this->headers());
        $invoiceId = $createRes->json('data.id');

        // Create Tenant 2
        $tenant2 = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Competitor Corp',
            'slug' => 'competitor-corp',
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
            'name' => 'Competitor User',
            'email' => 'comp@test.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role2 = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'Comp Role',
            'slug' => 'comp-'.Str::random(6),
            'is_system' => false,
        ]);

        $permission = Permission::firstOrCreate(
            ['name' => 'sales.invoice.view'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'sales',
                'resource' => 'invoice',
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

        $res = $this->getJson("/api/v1/sales/invoices/{$invoiceId}", [
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
            'name' => 'Accounts Role',
            'slug' => 'accounts-'.Str::random(6),
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
