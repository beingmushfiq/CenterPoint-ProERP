<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ReasonCode;
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

final class SalesReturnTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Party $customer;

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
            'name' => 'Returns Officer',
            'email' => 'returns@slicemart.test',
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
            'type' => 'unit',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'CAKE-RET-01',
            'name' => 'Pound Cake Loaf',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-RET',
            'name' => 'Returns Warehouse Hub',
            'type' => 'finished',
            'is_active' => true,
        ]);

        $this->customer = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'CUST-RET-01',
            'name' => 'Super Shop Returnee',
            'type' => 'customer',
        ]);

        $this->reasonCode = ReasonCode::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'RC-DAMAGE',
            'name' => 'Packaging Damaged During Transit',
            'context' => 'sales_return',
            'is_active' => true,
        ]);

        $this->assignOnly(
            'sales.return.view',
            'sales.return.create',
            'sales.return.approve'
        );
    }

    public function test_create_sales_return_with_credit_note(): void
    {
        $res = $this->postJson('/api/v1/sales/returns', [
            'return_date' => now()->toDateString(),
            'warehouse_id' => $this->warehouse->id,
            'party_id' => $this->customer->id,
            'reason_code_id' => $this->reasonCode->id,
            'restock' => true,
            'refund_method' => 'credit_note',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '4.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '150.0000',
                    'condition' => 'good',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.total_amount', '600.0000')
            ->assertJsonPath('data.refund_method', 'credit_note');

        $this->assertNotNull($res->json('data.credit_note_number'));

        $this->assertDatabaseHas('sales_returns', [
            'tenant_id' => 1,
            'warehouse_id' => $this->warehouse->id,
            'party_id' => $this->customer->id,
            'total_amount' => '600.0000',
            'status' => 'draft',
        ]);
    }

    public function test_approve_sales_return_restocks_inventory(): void
    {
        $createRes = $this->postJson('/api/v1/sales/returns', [
            'return_date' => now()->toDateString(),
            'warehouse_id' => $this->warehouse->id,
            'party_id' => $this->customer->id,
            'reason_code_id' => $this->reasonCode->id,
            'restock' => true,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '3.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '150.0000',
                    'condition' => 'good',
                ],
            ],
        ], $this->headers());

        $returnId = $createRes->json('data.id');

        $approveRes = $this->postJson("/api/v1/sales/returns/{$returnId}/approve", [], $this->headers());

        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('sales_returns', [
            'id' => $returnId,
            'status' => 'approved',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => 1,
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'sales_return',
            'direction' => 'in',
            'quantity' => '3.0000',
            'reference_type' => 'sales_return',
            'reference_id' => $returnId,
        ]);
    }

    public function test_list_sales_returns(): void
    {
        $this->postJson('/api/v1/sales/returns', [
            'return_date' => now()->toDateString(),
            'warehouse_id' => $this->warehouse->id,
            'reason_code_id' => $this->reasonCode->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '1.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '100.0000',
                ],
            ],
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/returns', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'return_number', 'status', 'total_amount']],
                'links' => ['first', 'last'],
                'meta' => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
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
            'name' => 'Return Role',
            'slug' => 'retrole-'.Str::random(6),
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
