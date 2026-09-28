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
use App\Modules\Purchasing\Actions\CreatePurchaseOrderAction;
use App\Modules\Purchasing\Models\PurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PurchaseBillTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Party $supplier;
    private Warehouse $warehouse;
    private Product $product;
    private Unit $unit;
    private PurchaseOrder $po;

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
            'name' => 'Bill Factory',
            'slug' => 'bill-factory',
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
            'name' => 'Accounts Payable Clerk',
            'email' => 'ap@slicemart.test',
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
            'sku' => 'PKG-BOX-01',
            'name' => 'Carton Packaging Boxes',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-PKG',
            'name' => 'Packaging Warehouse',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->supplier = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'SUP-PKG',
            'name' => 'Box Makers Co',
            'type' => 'vendor',
        ]);

        /** @var CreatePurchaseOrderAction $poAction */
        $poAction = app(CreatePurchaseOrderAction::class);
        $this->po = $poAction->execute([
            'tenant_id' => 1,
            'party_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '500.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '1.5000',
                ],
            ],
        ]);

        $this->assignOnly(
            'purchasing.bill.view',
            'purchasing.bill.create'
        );
    }

    public function test_create_purchase_bill_and_update_po_billed_quantity(): void
    {
        $poItem = $this->po->items->first();
        $this->assertNotNull($poItem);

        $response = $this->postJson('/api/v1/purchasing/bills', [
            'purchase_order_id' => $this->po->id,
            'party_id' => $this->supplier->id,
            'bill_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'supplier_invoice_number' => 'INV-2026-99',
            'items' => [
                [
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $this->product->id,
                    'quantity' => '500.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '1.5000',
                    'discount_amount' => '0.0000',
                    'tax_rate' => '0.0000',
                ],
            ],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('data.grand_total', '750.0000');

        $this->po->refresh();
        $this->assertEquals('500.0000', $this->po->items->first()?->billed_quantity);
    }

    public function test_pay_purchase_bill_with_split_payments(): void
    {
        $poItem = $this->po->items->first();
        $this->assertNotNull($poItem);

        $createRes = $this->postJson('/api/v1/purchasing/bills', [
            'purchase_order_id' => $this->po->id,
            'party_id' => $this->supplier->id,
            'bill_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'supplier_invoice_number' => 'INV-SPLIT-99',
            'items' => [
                [
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $this->product->id,
                    'quantity' => '200.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '1.5000',
                    'discount_amount' => '0.0000',
                    'tax_rate' => '0.0000',
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $billId = (int) $createRes->json('data.id');

        $payRes = $this->postJson("/api/v1/purchasing/bills/{$billId}/pay", [
            'amount' => '300.0000',
            'method' => 'split',
            'splits' => [
                [
                    'method' => 'cash',
                    'amount' => '100.0000',
                    'notes' => 'Petty cash payment',
                ],
                [
                    'method' => 'mobile_banking',
                    'amount' => '200.0000',
                    'mobile_provider' => 'Nagad',
                    'mobile_number' => '01800000000',
                    'transaction_ref' => 'NAGAD-PO-88',
                ],
            ],
        ], $this->headers());

        $payRes->assertStatus(200)
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('payment.direction', 'out')
            ->assertJsonPath('payment.method', 'split');

        $this->assertDatabaseHas('purchase_bills', [
            'id' => $billId,
            'status' => 'paid',
            'paid_amount' => '300.0000',
        ]);

        $this->assertDatabaseHas('payment_splits', [
            'tenant_id' => 1,
            'method' => 'mobile_banking',
            'mobile_provider' => 'Nagad',
            'transaction_ref' => 'NAGAD-PO-88',
            'amount' => '200.0000',
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
            'name' => 'Bill Role',
            'slug' => 'bill-'.Str::random(6),
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
