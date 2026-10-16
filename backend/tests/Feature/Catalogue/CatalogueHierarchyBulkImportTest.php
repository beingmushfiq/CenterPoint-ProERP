<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CatalogueHierarchyBulkImportTest extends TestCase
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
            'name' => 'Catalogue Manager',
            'email' => 'catman@slicemart.com',
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
    }

    public function test_can_bulk_import_categories_with_parent_resolution(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'ELECTRONICS',
                    'name' => 'Electronics & Gadgets',
                    'parent' => null,
                    'is_active' => true,
                ],
                [
                    'code' => 'PHONES',
                    'name' => 'Mobile Phones',
                    'parent' => 'ELECTRONICS',
                    'is_active' => true,
                ],
                [
                    'code' => 'SMARTPHONES',
                    'name' => 'Flagship Smartphones',
                    'parent' => 'Mobile Phones', // By parent name
                    'is_active' => true,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/categories/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'total' => 3,
            'imported' => 3,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $this->assertDatabaseHas('categories', [
            'tenant_id' => $this->tenant->id,
            'code' => 'ELECTRONICS',
            'name' => 'Electronics & Gadgets',
            'parent_id' => null,
        ]);

        $parent = Category::where('code', 'ELECTRONICS')->firstOrFail();

        $this->assertDatabaseHas('categories', [
            'tenant_id' => $this->tenant->id,
            'code' => 'PHONES',
            'parent_id' => $parent->id,
        ]);

        $phone = Category::where('code', 'PHONES')->firstOrFail();

        $this->assertDatabaseHas('categories', [
            'tenant_id' => $this->tenant->id,
            'code' => 'SMARTPHONES',
            'parent_id' => $phone->id,
        ]);
    }

    public function test_can_bulk_import_brands_with_skip_and_upsert(): void
    {
        Brand::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'SAMSUNG',
            'name' => 'Old Samsung Name',
            'is_active' => false,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        // 1. Skip mode
        $skipPayload = [
            'mode' => 'skip',
            'rows' => [
                ['code' => 'SAMSUNG', 'name' => 'Samsung Electronics', 'is_active' => true],
                ['code' => 'APPLE', 'name' => 'Apple Inc.', 'is_active' => true],
            ],
        ];

        $res1 = $this->postJson('/api/v1/brands/bulk-import', $skipPayload, $this->authHeaders());
        $res1->assertStatus(200);
        $res1->assertJson([
            'success' => true,
            'imported' => 1,
            'skipped' => 1,
        ]);

        $this->assertDatabaseHas('brands', [
            'code' => 'SAMSUNG',
            'name' => 'Old Samsung Name', // Not changed
            'is_active' => 0,
        ]);

        // 2. Upsert mode
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                ['code' => 'SAMSUNG', 'name' => 'Samsung Electronics', 'is_active' => true],
                ['code' => 'SONY', 'name' => 'Sony Group', 'is_active' => true],
            ],
        ];

        $res2 = $this->postJson('/api/v1/brands/bulk-import', $upsertPayload, $this->authHeaders());
        $res2->assertStatus(200);
        $res2->assertJson([
            'success' => true,
            'imported' => 1,
            'updated' => 1,
            'skipped' => 0,
        ]);

        $this->assertDatabaseHas('brands', [
            'code' => 'SAMSUNG',
            'name' => 'Samsung Electronics',
            'is_active' => 1,
        ]);
        $this->assertDatabaseHas('brands', [
            'code' => 'SONY',
            'name' => 'Sony Group',
        ]);
    }

    public function test_can_bulk_import_units_with_type_and_precision(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'KG',
                    'name' => 'Kilogram',
                    'type' => 'weight',
                    'precision' => 3,
                    'is_base' => true,
                    'is_active' => true,
                ],
                [
                    'code' => 'LITER',
                    'name' => 'Liter',
                    'type' => 'volume',
                    'precision' => 2,
                    'is_base' => true,
                    'is_active' => true,
                ],
                [
                    'code' => 'BOX',
                    'name' => 'Box of 12',
                    'type' => 'piece',
                    'precision' => 0,
                    'is_base' => false,
                    'is_active' => true,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/units/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'total' => 3,
            'imported' => 3,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $this->assertDatabaseHas('units', [
            'tenant_id' => $this->tenant->id,
            'code' => 'KG',
            'name' => 'Kilogram',
            'type' => 'weight',
            'precision' => 3,
            'is_base' => 1,
        ]);

        $this->assertDatabaseHas('units', [
            'tenant_id' => $this->tenant->id,
            'code' => 'LITER',
            'type' => 'volume',
        ]);

        $this->assertDatabaseHas('units', [
            'tenant_id' => $this->tenant->id,
            'code' => 'BOX',
            'type' => 'piece',
            'is_base' => 0,
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
