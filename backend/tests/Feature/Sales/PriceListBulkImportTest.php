<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Category;
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

class PriceListBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Product $product;

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
            'name' => 'SliceMart Master Org',
            'slug' => 'slicemart-master-org',
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
            'name' => 'Pricing Admin',
            'email' => 'admin@slicemart.com',
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
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        $unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
            'precision' => 0,
            'is_active' => true,
        ]);

        $category = Category::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'CAT-01',
            'name' => 'General',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'sku' => 'SKU-JAR-500',
            'name' => '500ml Plastic Jar',
            'unit_id' => $unit->id,
            'base_unit_id' => $unit->id,
            'category_id' => $category->id,
            'type' => 'finished_good',
            'is_active' => true,
        ]);
    }

    public function test_can_bulk_import_price_list_items_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'price_list_code' => 'WHOLESALE',
                    'product_sku' => 'SKU-JAR-500',
                    'unit_price' => 145.50,
                    'min_quantity' => 50,
                    'discount_percentage' => 5.0,
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/pricing/price-lists/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 1);

        $this->assertDatabaseHas('price_lists', [
            'tenant_id' => $this->tenant->id,
            'code' => 'WHOLESALE',
        ]);

        $this->assertDatabaseHas('price_list_items', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'unit_price' => '145.5000',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/pricing/price-lists/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 1);
    }

    public function test_can_bulk_import_price_list_items_in_upsert_mode(): void
    {
        // First create item
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'price_list_code' => 'RETAIL',
                    'product_sku' => 'SKU-JAR-500',
                    'unit_price' => 180.00,
                    'min_quantity' => 1,
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/pricing/price-lists/bulk-import', $initialPayload);

        // Upsert with new price
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'price_list_code' => 'RETAIL',
                    'product_sku' => 'SKU-JAR-500',
                    'unit_price' => 195.00,
                    'min_quantity' => 1,
                    'discount_percentage' => 2.5,
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/pricing/price-lists/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('price_list_items', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'unit_price' => '195.0000',
        ]);
    }
}
