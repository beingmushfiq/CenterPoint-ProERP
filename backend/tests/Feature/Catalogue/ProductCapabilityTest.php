<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
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

final class ProductCapabilityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;

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
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Acme',
            'slug' => 'acme',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);
        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Operator',
            'email' => 'capability@acme.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);
        $this->assignOnly('catalog.product.view', 'catalog.product.manage');
    }

    public function test_finished_good_defaults_to_purchased_produced_and_sold(): void
    {
        $unit = $this->createUnit();

        $response = $this->json('POST', route('tenant.products.store'), [
            'sku' => 'FG-DEFAULT-1',
            'name' => 'Default Finished Good',
            'type' => 'finished',
            'base_unit_id' => $unit->uuid,
        ], $this->headers());

        $response->assertCreated()
            ->assertJsonPath('data.sku', 'FG-DEFAULT-1')
            ->assertJsonPath('data.is_purchased', true)
            ->assertJsonPath('data.is_produced', true)
            ->assertJsonPath('data.is_sold', true);
    }

    public function test_raw_material_defaults_to_purchased_only(): void
    {
        $unit = $this->createUnit();

        $response = $this->json('POST', route('tenant.products.store'), [
            'sku' => 'RM-DEFAULT-1',
            'name' => 'Default Raw Material',
            'type' => 'raw_material',
            'base_unit_id' => $unit->uuid,
        ], $this->headers());

        $response->assertCreated()
            ->assertJsonPath('data.sku', 'RM-DEFAULT-1')
            ->assertJsonPath('data.is_purchased', true)
            ->assertJsonPath('data.is_produced', false)
            ->assertJsonPath('data.is_sold', false);
    }

    public function test_explicit_capability_flags_are_respected(): void
    {
        $unit = $this->createUnit();

        $response = $this->json('POST', route('tenant.products.store'), [
            'sku' => 'FG-EXPLICIT-1',
            'name' => 'Manufacture-Only Finished Good',
            'type' => 'finished',
            'base_unit_id' => $unit->uuid,
            'is_purchased' => false,
            'is_produced' => true,
            'is_sold' => true,
        ], $this->headers());

        $response->assertCreated()
            ->assertJsonPath('data.sku', 'FG-EXPLICIT-1')
            ->assertJsonPath('data.is_purchased', false)
            ->assertJsonPath('data.is_produced', true)
            ->assertJsonPath('data.is_sold', true);
    }

    public function test_can_update_product_capability_flags(): void
    {
        $unit = $this->createUnit();
        TenantContext::bind($this->tenant->toArray());
        $product = Product::factory()->create([
            'sku' => 'FG-UPDATE-1',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'is_purchased' => false,
        ]);
        TenantContext::flush();

        $response = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'is_purchased' => true,
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.is_purchased', true);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'is_purchased' => 1,
        ]);
    }

    public function test_can_filter_products_by_is_purchased(): void
    {
        $unit = $this->createUnit();
        TenantContext::bind($this->tenant->toArray());
        Product::factory()->create([
            'sku' => 'FG-PURCHASABLE',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'is_purchased' => true,
        ]);
        Product::factory()->create([
            'sku' => 'FG-INTERNAL-ONLY',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'is_purchased' => false,
        ]);
        TenantContext::flush();

        $response = $this->json('GET', route('tenant.products.index', ['is_purchased' => 'true']), [], $this->headers());
        $response->assertOk();

        $skus = collect($response->json('data'))->pluck('sku')->all();
        $this->assertContains('FG-PURCHASABLE', $skus);
        $this->assertNotContains('FG-INTERNAL-ONLY', $skus);
    }

    private function createUnit(): Unit
    {
        TenantContext::bind($this->tenant->toArray());
        $unit = Unit::factory()->create();
        TenantContext::flush();

        return $unit;
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return ['Authorization' => 'Bearer '.$this->jwt];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Capability Role',
            'slug' => 'cap-'.Str::random(6),
            'is_system' => false,
        ]);
        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(['name' => $name], [
                'uuid' => (string) Str::uuid(),
                'module' => $module,
                'resource' => $resource,
                'action' => $action,
            ]);
            $role->permissions()->attach($permission);
        }
        $this->user->roles()->detach();
        $this->user->roles()->attach($role);
        $this->jwt = app(JwtService::class)->issueToken(userId: $this->user->id, tenantId: 1, tokenVersion: 1);
    }
}
