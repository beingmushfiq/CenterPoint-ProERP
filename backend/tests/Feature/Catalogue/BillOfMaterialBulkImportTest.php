<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class BillOfMaterialBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Product $finishedProduct;

    private Product $rawMaterial1;

    private Product $rawMaterial2;

    private Unit $pcsUnit;

    private Unit $mtrUnit;

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
            'name' => 'SliceMart Factory',
            'slug' => 'slicemart-factory',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Plant Engineer',
            'email' => 'engineer@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $this->pcsUnit = Unit::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'piece',
            'precision' => 0,
            'is_base' => true,
            'is_active' => true,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $this->mtrUnit = Unit::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'MTR',
            'name' => 'Meters',
            'type' => 'length',
            'precision' => 2,
            'is_base' => true,
            'is_active' => true,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $this->finishedProduct = Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'TSHIRT-BLK-M',
            'name' => 'Black Cotton T-Shirt (M)',
            'type' => 'finished',
            'base_unit_id' => $this->pcsUnit->id,
            'is_stock_tracked' => 1,
            'is_sold' => 1,
            'is_purchased' => 0,
            'standard_cost' => 250,
            'default_sale_price' => 500,
            'status' => 'active',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $this->rawMaterial1 = Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'FABRIC-COTTON-BLK',
            'name' => '100% Combed Cotton Fabric Black',
            'type' => 'raw_material',
            'base_unit_id' => $this->mtrUnit->id,
            'is_stock_tracked' => 1,
            'is_sold' => 0,
            'is_purchased' => 1,
            'standard_cost' => 120,
            'default_sale_price' => 0,
            'status' => 'active',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $this->rawMaterial2 = Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'THREAD-BLK',
            'name' => 'Sewing Thread Spool Black',
            'type' => 'raw_material',
            'base_unit_id' => $this->pcsUnit->id,
            'is_stock_tracked' => 1,
            'is_sold' => 0,
            'is_purchased' => 1,
            'standard_cost' => 20,
            'default_sale_price' => 0,
            'status' => 'active',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);
    }

    public function test_can_bulk_import_bom_with_multiple_grouped_items(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'finished_sku' => 'TSHIRT-BLK-M',
                    'bom_name' => 'Standard Black T-Shirt Assembly',
                    'version' => 'v1.0',
                    'output_quantity' => 1,
                    'output_unit' => 'PCS',
                    'component_sku' => 'FABRIC-COTTON-BLK',
                    'component_quantity' => 1.35,
                    'component_unit' => 'MTR',
                    'scrap_percentage' => 3.0,
                    'status' => 'active',
                ],
                [
                    'finished_sku' => 'TSHIRT-BLK-M',
                    'bom_name' => 'Standard Black T-Shirt Assembly',
                    'version' => 'v1.0',
                    'output_quantity' => 1,
                    'output_unit' => 'PCS',
                    'component_sku' => 'THREAD-BLK',
                    'component_quantity' => 0.1,
                    'component_unit' => 'PCS',
                    'scrap_percentage' => 0,
                    'status' => 'active',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/bill-of-materials/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'total' => 1, // 1 unique recipe created with 2 line items
            'imported' => 1,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $this->assertDatabaseHas('bill_of_materials', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->finishedProduct->id,
            'version' => 'v1.0',
            'name' => 'Standard Black T-Shirt Assembly',
        ]);

        $bom = BillOfMaterial::where('product_id', $this->finishedProduct->id)->firstOrFail();
        $this->assertCount(2, $bom->items);

        $this->assertDatabaseHas('bill_of_material_items', [
            'tenant_id' => $this->tenant->id,
            'bill_of_material_id' => $bom->id,
            'product_id' => $this->rawMaterial1->id,
            'quantity' => '1.3500',
        ]);
        $this->assertDatabaseHas('bill_of_material_items', [
            'tenant_id' => $this->tenant->id,
            'bill_of_material_id' => $bom->id,
            'product_id' => $this->rawMaterial2->id,
            'quantity' => '0.1000',
        ]);
    }

    private function authHeaders(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
            'Accept' => 'application/json',
        ];
    }
}
