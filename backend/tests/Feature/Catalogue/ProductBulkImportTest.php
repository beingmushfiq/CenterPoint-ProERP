<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

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
            'name' => 'SliceMart Retail',
            'slug' => 'slicemart-retail',
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
            'name' => 'Store Manager',
            'email' => 'manager@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = \App\Models\Role::create([
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

        Unit::create([
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
    }

    public function test_can_bulk_import_products_and_auto_create_category_and_brand(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'sku' => 'TSHIRT-BLK-M',
                    'name' => 'Black Cotton T-Shirt M',
                    'type' => 'finished',
                    'category' => 'Apparel',
                    'brand' => 'SliceFit',
                    'unit' => 'PCS',
                    'standard_cost' => '250.00',
                    'default_sale_price' => '450.00',
                    'barcode' => '8901234567890',
                ],
                [
                    'sku' => 'JEANS-SLM-32',
                    'name' => 'Slim Fit Denim Jeans 32',
                    'type' => 'finished',
                    'category' => 'Denim',
                    'brand' => 'SliceFit',
                    'unit' => 'PCS',
                    'standard_cost' => '650.00',
                    'default_sale_price' => '1200.00',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/products/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 2,
                'skipped' => 0,
                'failed' => 0,
            ]);

        $this->assertDatabaseHas('products', [
            'tenant_id' => $this->tenant->id,
            'sku' => 'TSHIRT-BLK-M',
            'name' => 'Black Cotton T-Shirt M',
        ]);

        $this->assertDatabaseHas('categories', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Apparel',
        ]);

        $this->assertDatabaseHas('brands', [
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceFit',
        ]);
    }

    public function test_skips_existing_products_in_skip_mode(): void
    {
        $unit = Unit::first();

        Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'EXISTING-01',
            'name' => 'Original Name',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'standard_cost' => '100.00',
            'default_sale_price' => '200.00',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'sku' => 'EXISTING-01',
                    'name' => 'Updated Name Attempt',
                    'default_sale_price' => '300.00',
                ],
                [
                    'sku' => 'NEW-SKU-99',
                    'name' => 'New Awesome Product',
                    'default_sale_price' => '150.00',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/products/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 1,
                'skipped' => 1,
                'failed' => 0,
            ]);
    }

    public function test_updates_existing_products_in_upsert_mode(): void
    {
        $unit = Unit::first();

        $prod = Product::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'UPSERT-01',
            'name' => 'Old Product Name',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'standard_cost' => '100.00',
            'default_sale_price' => '200.00',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'sku' => 'UPSERT-01',
                    'name' => 'New Upgraded Product Name',
                    'default_sale_price' => '299.00',
                    'standard_cost' => '120.00',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/products/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 1,
                'imported' => 0,
                'updated' => 1,
                'skipped' => 0,
                'failed' => 0,
            ]);

        $prod->refresh();
        $this->assertEquals('New Upgraded Product Name', $prod->name);
        $this->assertEquals(299.00, (float) $prod->default_sale_price);
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
