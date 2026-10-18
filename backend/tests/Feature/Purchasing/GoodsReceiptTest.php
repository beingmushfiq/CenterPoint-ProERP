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
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Purchasing\Actions\CreatePurchaseOrderAction;
use App\Modules\Purchasing\Models\PurchaseOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class GoodsReceiptTest extends TestCase
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
            'name' => 'GRN Factory',
            'slug' => 'grn-factory',
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
            'name' => 'Receiving Clerk',
            'email' => 'receiving@slicemart.test',
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
            'sku' => 'SALT-001',
            'name' => 'Iodized Salt',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-ING',
            'name' => 'Ingredients Warehouse',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->supplier = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'SUP-SALT',
            'name' => 'Pure Salt Industries',
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
                    'quantity' => '100.0000',
                    'unit_id' => $this->unit->id,
                    'unit_price' => '1.2000',
                ],
            ],
        ]);

        $this->assignOnly(
            'purchasing.receipt.view',
            'purchasing.receipt.create'
        );
    }

    public function test_receive_goods_receipt_creates_stock_movement_and_updates_po(): void
    {
        $poItem = $this->po->items->first();
        $this->assertNotNull($poItem);

        $response = $this->postJson('/api/v1/purchasing/receipts', [
            'purchase_order_id' => $this->po->id,
            'party_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'receipt_date' => now()->toDateString(),
            'supplier_document_number' => 'CHALLAN-8821',
            'items' => [
                [
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $this->product->id,
                    'received_quantity' => '100.0000',
                    'accepted_quantity' => '95.0000',
                    'rejected_quantity' => '5.0000',
                    'unit_id' => $this->unit->id,
                    'unit_cost' => '1.2000',
                    'batch_code' => 'SALT-LOT-01',
                ],
            ],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'completed');

        // Check stock balance has 95 accepted units
        $balance = StockBalance::where('tenant_id', 1)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $this->product->id)
            ->where('batch_code', 'SALT-LOT-01')
            ->first();

        $this->assertNotNull($balance);
        $this->assertEquals('95.0000', $balance->quantity);

        // Check PO item received quantity updated
        $this->po->refresh();
        $this->assertEquals('95.0000', $this->po->items->first()?->received_quantity);
        $this->assertEquals('partially_received', $this->po->status);
    }

    public function test_can_perform_qc_sign_off_and_complete_using_uuid(): void
    {
        $poItem = $this->po->items->first();
        $this->assertNotNull($poItem);

        // 1. Create a goods receipt note
        $createRes = $this->postJson('/api/v1/purchasing/receipts', [
            'purchase_order_id' => $this->po->id,
            'party_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'receipt_date' => now()->toDateString(),
            'supplier_document_number' => 'CHALLAN-QC-001',
            'items' => [
                [
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $this->product->id,
                    'received_quantity' => '50.0000',
                    'unit_id' => $this->unit->id,
                    'unit_cost' => '1.2000',
                    'batch_code' => 'QC-BATCH-01',
                ],
            ],
        ], $this->headers());

        $createRes->assertStatus(201);
        $grnUuid = (string) $createRes->json('data.uuid');
        $this->assertNotEmpty($grnUuid);
        $itemId = $createRes->json('data.items.0.id');

        // 2. Perform QC sign-off using GRN UUID
        $qcRes = $this->postJson("/api/v1/purchasing/goods-receipts/{$grnUuid}/qc", [
            'status' => 'qc_passed',
            'notes' => 'Passed full sensory and physical inspection',
            'items' => [
                [
                    'id' => $itemId,
                    'accepted_quantity' => '48.0000',
                    'rejected_quantity' => '2.0000',
                    'batch_code' => 'QC-BATCH-01-PASS',
                    'expiry_date' => '2027-12-31',
                ],
            ],
        ], $this->headers());

        $qcRes->assertStatus(200)
            ->assertJsonPath('data.status', 'qc_passed')
            ->assertJsonPath('data.uuid', $grnUuid)
            ->assertJsonPath('data.items.0.accepted_quantity', '48.0000')
            ->assertJsonPath('data.items.0.rejected_quantity', '2.0000')
            ->assertJsonPath('data.items.0.batch_code', 'QC-BATCH-01-PASS');

        // 3. Mark complete using GRN UUID
        $completeRes = $this->postJson("/api/v1/purchasing/goods-receipts/{$grnUuid}/complete", [], $this->headers());
        $completeRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.uuid', $grnUuid);
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
            'name' => 'Receipt Role',
            'slug' => 'rcpt-'.Str::random(6),
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
