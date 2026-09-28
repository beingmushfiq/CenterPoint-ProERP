<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantQuotaEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_tenant_quota_blocks_product_creation_when_plan_limit_reached(): void
    {
        /** @var Plan $restrictedPlan */
        $restrictedPlan = Plan::create([
            'uuid' => 'plan-quota-test-1',
            'code' => 'QUOTA_TRIAL',
            'name' => 'Restricted Quota Trial',
            'price' => '0.0000',
            'billing_period' => 'monthly',
            'limits' => [
                'max_products' => 1,
                'max_warehouses' => 1,
            ],
            'features' => [],
            'is_active' => true,
        ]);

        /** @var Tenant $tenant */
        $tenant = Tenant::create([
            'uuid' => 'tenant-quota-test-1',
            'plan_id' => $restrictedPlan->id,
            'name' => 'Quota Test Corp',
            'slug' => 'quota-test-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        /** @var User $user */
        $user = User::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Quota Test Admin',
            'email' => "admin@{$tenant->slug}.com",
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => '1',
        ]);

        $superRole = \App\Models\Role::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Super Administrator'],
            ['uuid' => 'role-sa-1', 'slug' => 'super-admin']
        );
        $user->roles()->syncWithoutDetaching([$superRole->id]);

        TenantContext::bind($tenant->toArray());
        /** @var Unit $unit */
        $unit = Unit::create([
            'uuid' => 'unit-quota-t1',
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'discrete',
            'is_base' => true,
            'precision' => 0,
            'is_active' => true,
        ]);

        // Seed 1 product so limit (1) is hit
        Product::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'uuid' => 'test-product-uuid-1',
            'sku' => 'PRD-LIMIT-1',
            'name' => 'First Product',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'status' => 'active',
            'standard_cost' => '100.0000',
            'default_sale_price' => '150.0000',
        ]);

        $headers = $this->getTenantAuthHeader($tenant, $user);

        // Attempt to create a 2nd product
        $response = $this->postJson('/api/v1/products', [
            'sku' => 'PRD-LIMIT-2',
            'name' => 'Second Product Attempt',
            'type' => 'finished',
            'base_unit_id' => $unit->uuid,
            'status' => 'active',
            'standard_cost' => '100.00',
            'default_sale_price' => '150.00',
        ], $headers);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATED');
        $errorMessage = $response->json('error.message');
        $this->assertIsString($errorMessage);
        $this->assertStringContainsString('Plan quota limit reached', $errorMessage);
        $response->assertJsonPath('error.details.quota.resource', 'products');
        $response->assertJsonPath('error.details.quota.limit', 1);
        $response->assertJsonPath('error.details.quota.current', 1);
    }

    public function test_custom_tenant_limits_override_plan_limits(): void
    {
        /** @var Plan $restrictedPlan */
        $restrictedPlan = Plan::create([
            'uuid' => 'plan-quota-test-2',
            'code' => 'QUOTA_TRIAL_2',
            'name' => 'Restricted Quota Trial 2',
            'price' => '0.0000',
            'billing_period' => 'monthly',
            'limits' => [
                'max_products' => 1,
            ],
            'features' => [],
            'is_active' => true,
        ]);

        /** @var Tenant $tenant */
        $tenant = Tenant::create([
            'uuid' => 'tenant-quota-test-2',
            'plan_id' => $restrictedPlan->id,
            'name' => 'Override Corp',
            'slug' => 'override-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
            'settings' => [
                'custom_limits' => [
                    'max_products' => 10,
                ],
            ],
        ]);

        /** @var User $user */
        $user = User::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Override Test Admin',
            'email' => "admin@{$tenant->slug}.com",
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => '1',
        ]);

        $superRole = \App\Models\Role::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Super Administrator'],
            ['uuid' => 'role-sa-2', 'slug' => 'super-admin']
        );
        $user->roles()->syncWithoutDetaching([$superRole->id]);

        TenantContext::bind($tenant->toArray());
        /** @var Unit $unit */
        $unit = Unit::create([
            'uuid' => 'unit-quota-t2',
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'discrete',
            'is_base' => true,
            'precision' => 0,
            'is_active' => true,
        ]);

        // Seed 1 product (plan limit was 1, but custom limit is 10)
        Product::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'uuid' => 'test-product-uuid-2',
            'sku' => 'PRD-LIMIT-3',
            'name' => 'Existing Product',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
            'status' => 'active',
            'standard_cost' => '100.0000',
            'default_sale_price' => '150.0000',
        ]);

        $headers = $this->getTenantAuthHeader($tenant, $user);

        // Attempt to create a 2nd product - should bypass 422 quota barrier
        $response = $this->postJson('/api/v1/products', [
            'sku' => 'PRD-LIMIT-4',
            'name' => 'Second Product Attempt',
            'type' => 'finished',
            'base_unit_id' => $unit->uuid,
            'status' => 'active',
            'standard_cost' => '100.00',
            'default_sale_price' => '150.00',
        ], $headers);

        // Status should not be blocked by quota limit
        $this->assertNotEquals(
            'Plan quota limit reached: maximum 1 products allowed (current: 1). Please upgrade your subscription to add more.',
            $response->json('error.message')
        );
    }

    public function test_tenant_quota_blocks_warehouse_creation_when_plan_limit_reached(): void
    {
        /** @var Plan $plan */
        $plan = Plan::create([
            'uuid' => 'plan-quota-wh-1',
            'code' => 'QUOTA_WH_1',
            'name' => 'Restricted WH Plan',
            'price' => '0.0000',
            'billing_period' => 'monthly',
            'limits' => [
                'max_warehouses' => 1,
            ],
            'features' => [],
            'is_active' => true,
        ]);

        /** @var Tenant $tenant */
        $tenant = Tenant::create([
            'uuid' => 'tenant-quota-wh-1',
            'plan_id' => $plan->id,
            'name' => 'WH Quota Corp',
            'slug' => 'wh-quota-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        /** @var User $user */
        $user = User::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'WH Test Admin',
            'email' => "admin@{$tenant->slug}.com",
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => '1',
        ]);

        $superRole = \App\Models\Role::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Super Administrator'],
            ['uuid' => 'role-sa-wh-1', 'slug' => 'super-admin']
        );
        $user->roles()->syncWithoutDetaching([$superRole->id]);

        TenantContext::bind($tenant->toArray());

        // Seed 1 warehouse so limit (1) is hit
        \App\Models\Warehouse::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'uuid' => 'wh-uuid-1',
            'code' => 'WH-01',
            'name' => 'Main Central Warehouse',
            'type' => 'central',
            'is_active' => true,
        ]);

        $headers = $this->getTenantAuthHeader($tenant, $user);

        // Attempt to create a 2nd warehouse
        $response = $this->postJson('/api/v1/warehouses', [
            'code' => 'WH-02',
            'name' => 'Secondary Warehouse',
            'type' => 'retail',
            'is_active' => true,
        ], $headers);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATED');
        $errorMessage = $response->json('error.message');
        $this->assertIsString($errorMessage);
        $this->assertStringContainsString('Plan quota limit reached: maximum 1 warehouses allowed', $errorMessage);
        $response->assertJsonPath('error.details.quota.resource', 'warehouses');
        $response->assertJsonPath('error.details.quota.limit', 1);
        $response->assertJsonPath('error.details.quota.current', 1);
    }

    /**
     * @return array<string, string>
     */
    private function getTenantAuthHeader(Tenant $tenant, User $user): array
    {
        $jwtService = app(JwtService::class);
        $token = $jwtService->issueToken(
            userId: $user->id,
            tenantId: $tenant->id,
            tokenVersion: $user->token_version ?? 1,
            permVersion: '1',
            scopes: [],
            customClaims: ['email' => $user->email, 'is_platform_user' => false]
        );

        return [
            'Authorization' => "Bearer {$token}",
            'X-Tenant' => $tenant->slug,
        ];
    }
}
