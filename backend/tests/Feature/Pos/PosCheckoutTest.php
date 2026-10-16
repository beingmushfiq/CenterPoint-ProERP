<?php

declare(strict_types=1);

namespace Tests\Feature\Pos;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Pos\Models\PosSession;
use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PosCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private int $branchId;

    private Warehouse $warehouse;

    private PosTerminal $terminal;

    private PosSession $session;

    private Product $bread;

    private Product $milk;

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
            'name' => 'POS Operator',
            'email' => 'operator@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'SliceMart Retail',
            'legal_name' => 'SliceMart Retail Ltd.',
            'tax_identifier' => 'BIN-POS-03',
            'registration_number' => 'REG-POS-03',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branchId = (int) DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'company_id' => $companyId,
            'code' => 'BR-DHK-03',
            'name' => 'Dhanmondi Branch',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-DHAN',
            'name' => 'Dhanmondi Retail Stock',
            'type' => 'retail',
            'is_active' => true,
        ]);

        $this->terminal = PosTerminal::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'POS-DHAN-1',
            'name' => 'Dhanmondi POS 1',
            'branch_id' => $this->branchId,
            'default_warehouse_id' => $this->warehouse->id,
            'is_active' => true,
        ]);

        $this->session = PosSession::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'session_number' => 'POS-SESSION-001',
            'branch_id' => $this->branchId,
            'warehouse_id' => $this->warehouse->id,
            'terminal_id' => $this->terminal->id,
            'user_id' => $this->user->id,
            'opened_at' => now(),
            'opening_cash' => '1000.0000',
            'expected_cash' => '1000.0000',
            'card_total' => '0.0000',
            'mobile_total' => '0.0000',
            'credit_total' => '0.0000',
            'sales_count' => 0,
            'refund_total' => '0.0000',
            'status' => 'open',
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
        ]);

        $this->bread = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'BREAD-SLICED',
            'name' => 'Sliced Bread Loaf',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->milk = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'MILK-1L',
            'name' => 'Pasteurized Milk 1L',
            'type' => 'finished',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->assignOnly(
            'pos.checkout',
            'pos.session.view'
        );
    }

    public function test_pos_checkout_cash_transaction(): void
    {
        $res = $this->postJson('/api/v1/pos/checkout', [
            'pos_session_id' => $this->session->id,
            'customer_name' => 'Walk-in Customer',
            'customer_phone' => '+8801700000000',
            'discount_amount' => '10.0000',
            'items' => [
                [
                    'product_id' => $this->bread->id,
                    'quantity' => '2.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '60.0000',
                ],
                [
                    'product_id' => $this->milk->id,
                    'quantity' => '1.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '90.0000',
                ],
            ],
            // Subtotal = 2*60 + 90 = 210, discount = 10 -> GrandTotal = 200
            'payments' => [
                [
                    'method' => 'cash',
                    'amount' => '200.0000',
                    'change_given' => '0.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.order.total_amount', '200.0000')
            ->assertJsonPath('data.order.status', 'delivered')
            ->assertJsonPath('data.order.payment_status', 'paid')
            ->assertJsonPath('data.invoice.status', 'paid')
            ->assertJsonPath('data.session.sales_count', 1);

        $this->assertDatabaseHas('sales_orders', [
            'tenant_id' => 1,
            'pos_session_id' => $this->session->id,
            'total_amount' => '200.0000',
            'status' => 'delivered',
            'payment_status' => 'paid',
        ]);

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => 1,
            'total_amount' => '200.0000',
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('payments', [
            'tenant_id' => 1,
            'method' => 'cash',
            'amount' => '200.0000',
            'status' => 'posted',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => 1,
            'product_id' => $this->bread->id,
            'movement_type' => 'pos_sale',
            'direction' => 'out',
            'quantity' => '2.0000',
        ]);

        // Expected cash should increase by 200: 1000 + 200 = 1200
        $this->session->refresh();
        $this->assertSame('1200.0000', (string) $this->session->expected_cash);
        $this->assertSame(1, $this->session->sales_count);
    }

    public function test_pos_checkout_multi_tender_payment(): void
    {
        $res = $this->postJson('/api/v1/pos/checkout', [
            'pos_session_id' => $this->session->id,
            'items' => [
                [
                    'product_id' => $this->bread->id,
                    'quantity' => '5.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '100.0000',
                ],
            ],
            // Total = 500: Paid 200 cash, 300 card
            'payments' => [
                [
                    'method' => 'cash',
                    'amount' => '200.0000',
                    'change_given' => '0.0000',
                ],
                [
                    'method' => 'card',
                    'amount' => '300.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201);

        $this->session->refresh();
        $this->assertSame('1200.0000', (string) $this->session->expected_cash);
        $this->assertSame('300.0000', (string) $this->session->card_total);
    }

    public function test_pos_checkout_does_not_double_count_line_item_discount(): void
    {
        // 1 item of 100 with 10 flat discount and 0 order discount -> total discount MUST be exactly 10, grand total MUST be 90
        $res = $this->postJson('/api/v1/pos/checkout', [
            'pos_session_id' => $this->session->id,
            'order_discount_type' => 'flat',
            'order_discount_value' => '0.0000',
            'discount_amount' => '10.0000',
            'items' => [
                [
                    'product_id' => $this->bread->id,
                    'quantity' => '1.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '100.0000',
                    'discount_type' => 'flat',
                    'discount_value' => '10.0000',
                    'discount_amount' => '10.0000',
                    'discount_percentage' => '10.0000',
                ],
            ],
            'payments' => [
                [
                    'method' => 'cash',
                    'amount' => '90.0000',
                    'change_given' => '0.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.order.subtotal', '100.0000')
            ->assertJsonPath('data.order.discount_amount', '10.0000')
            ->assertJsonPath('data.order.total_amount', '90.0000')
            ->assertJsonPath('data.invoice.total_amount', '90.0000')
            ->assertJsonPath('data.invoice.discount_amount', '10.0000');

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => 1,
            'total_amount' => '90.0000',
            'discount_amount' => '10.0000',
            'paid_amount' => '90.0000',
        ]);

        $this->assertDatabaseHas('invoice_items', [
            'tenant_id' => 1,
            'discount_amount' => '10.0000',
            'line_total' => '90.0000',
        ]);
    }

    public function test_cannot_checkout_on_closed_session(): void
    {
        $this->session->status = 'closed';
        $this->session->save();

        $res = $this->postJson('/api/v1/pos/checkout', [
            'pos_session_id' => $this->session->id,
            'items' => [
                [
                    'product_id' => $this->bread->id,
                    'quantity' => '1.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '60.0000',
                ],
            ],
            'payments' => [
                [
                    'method' => 'cash',
                    'amount' => '60.0000',
                ],
            ],
        ], $this->headers());

        $this->assertTrue(in_array($res->status(), [400, 422, 500], true));
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
            'name' => 'Checkout Role',
            'slug' => 'checkrole-'.Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            $parts = explode('.', $name);
            $module = $parts[0];
            $resource = $parts[1] ?? 'general';
            $action = $parts[2] ?? $parts[1] ?? 'view';
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
