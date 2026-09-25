<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Category;
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

final class ProductUpdateTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Unit $baseUnit;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1, 'uuid' => (string) Str::uuid(), 'code' => 'ENTERPRISE',
            'name' => 'Enterprise', 'price' => '10000.0000', 'billing_period' => 'monthly',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1, 'uuid' => (string) Str::uuid(), 'plan_id' => 1, 'name' => 'Acme',
            'slug' => 'acme', 'status' => 'active', 'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka', 'locale' => 'en', 'date_format' => 'Y-m-d', 'number_format' => 'standard',
        ]);

        $this->user = User::create([
            'uuid' => (string) Str::uuid(), 'tenant_id' => 1, 'name' => 'Operator',
            'email' => 'operator@acme.test', 'password' => Hash::make('Password123!'),
            'status' => 'active', 'locale' => 'en', 'token_version' => 1, 'perm_version' => 1,
        ]);

        $this->assignOnly('catalog.product.view', 'catalog.product.manage', 'catalog.product.update');

        TenantContext::bind($this->tenant->toArray());
        $this->baseUnit = Unit::factory()->create();
        $this->warehouse = Warehouse::factory()->create();
        TenantContext::flush();
    }

    public function test_updating_opening_stock_synchronizes_inventory_balance(): void
    {
        TenantContext::bind($this->tenant->toArray());
        $product = Product::factory()->create([
            'base_unit_id' => $this->baseUnit->id,
            'is_stock_tracked' => true,
            'standard_cost' => '100.0000',
        ]);
        TenantContext::flush();

        // Initial edit setting opening stock to 25
        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'opening_stock' => 25,
            'warehouse_id' => $this->warehouse->uuid,
        ], $this->headers());

        $res->assertOk();

        // Verify stock balance exists and matches 25
        $balance = DB::table('stock_balances')
            ->where('tenant_id', $this->tenant->id)
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('stock_state', 'available')
            ->first();

        self::assertNotNull($balance);
        self::assertEquals(25.0, (float) $balance->quantity);

        // Edit again adjusting opening stock to 35
        $res2 = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'opening_stock' => 35,
            'warehouse_id' => $this->warehouse->uuid,
        ], $this->headers());

        $res2->assertOk();

        $balanceAfter = DB::table('stock_balances')
            ->where('tenant_id', $this->tenant->id)
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('stock_state', 'available')
            ->first();

        self::assertEquals(35.0, (float) $balanceAfter->quantity);
    }

    public function test_duplicate_barcode_returns_409_conflict(): void
    {
        TenantContext::bind($this->tenant->toArray());
        Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'barcode' => 'BAR-001']);
        $product2 = Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'barcode' => 'BAR-002']);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product2->uuid]), [
            'barcode' => 'BAR-001',
        ], $this->headers());

        $res->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_duplicate_online_slug_returns_409_conflict(): void
    {
        TenantContext::bind($this->tenant->toArray());
        Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'online_slug' => 'slug-one']);
        $product2 = Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'online_slug' => 'slug-two']);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product2->uuid]), [
            'online_slug' => 'slug-one',
        ], $this->headers());

        $res->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_changing_base_unit_with_existing_movements_is_rejected(): void
    {
        TenantContext::bind($this->tenant->toArray());
        $product = Product::factory()->create(['base_unit_id' => $this->baseUnit->id]);
        $newUnit = Unit::factory()->create();

        // Record a movement
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-TEST-1',
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'opening_balance',
            'direction' => 'in',
            'stock_state' => 'available',
            'quantity' => 10,
            'unit_id' => $this->baseUnit->id,
            'unit_cost' => 10,
            'total_cost' => 100,
            'balance_after' => 10,
            'moved_at' => now(),
            'created_at' => now(),
        ]);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'base_unit_id' => $newUnit->uuid,
        ], $this->headers());

        $res->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED')->assertJsonPath('error.fields.base_unit_id.0', 'Base unit of measure cannot be modified after inventory transactions have been recorded.');
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return ['Authorization' => 'Bearer '.$this->jwt];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create(['uuid' => (string) Str::uuid(), 'tenant_id' => 1, 'name' => 'Product Role', 'slug' => 'product-'.Str::random(6), 'is_system' => false]);
        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(['name' => $name], ['uuid' => (string) Str::uuid(), 'module' => $module, 'resource' => $resource, 'action' => $action]);
            $role->permissions()->attach($permission);
        }
        $this->user->roles()->detach();
        $this->user->roles()->attach($role);
        $this->jwt = app(JwtService::class)->issueToken(userId: $this->user->id, tenantId: 1, tokenVersion: 1);
    }
}
