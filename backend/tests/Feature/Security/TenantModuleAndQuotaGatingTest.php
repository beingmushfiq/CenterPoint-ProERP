<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Core\Auth\JwtService;
use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantModuleAndQuotaGatingTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected Company $company;
    protected User $user;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'PROFESSIONAL',
            'name' => 'Professional Plan',
            'price' => '5000.0000',
            'billing_period' => 'monthly',
            'limits' => json_encode([
                'max_users' => 1,
                'max_warehouses' => 1,
                'max_products' => 5,
            ]),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'SliceMart Gating Tenant',
            'slug' => 'slicemart-gating',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart Security Ltd',
            'code' => 'SM-SEC',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'fiscal_year_start_month' => 7,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Tenant Administrator',
            'email' => 'admin@slicemart.com',
            'password' => 'secret123',
            'status' => 'active',
        ]);

        $role = Role::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'slug' => 'super-admin',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id, ['tenant_id' => $this->tenant->id]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_access_allowed_when_module_is_enabled_by_default(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->getJson('/api/v1/hr/departments');

        $response->assertStatus(200);
    }

    public function test_access_blocked_with_403_when_module_is_not_allowed_in_plan(): void
    {
        TenantModule::create([
            'tenant_id' => $this->tenant->id,
            'module_key' => 'assets',
            'enabled' => true,
            'plan_allowed' => false,
            'config' => [],
        ]);

        TenantCapabilityManifest::invalidate($this->tenant->id);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->getJson('/api/v1/assets/categories');

        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'MODULE_NOT_IN_PLAN');
    }

    public function test_access_blocked_with_403_when_module_is_disabled_by_admin(): void
    {
        TenantModule::create([
            'tenant_id' => $this->tenant->id,
            'module_key' => 'production',
            'enabled' => false,
            'plan_allowed' => true,
            'config' => [],
        ]);

        TenantCapabilityManifest::invalidate($this->tenant->id);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->getJson('/api/v1/production/plans');

        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'MODULE_DISABLED');
    }

    public function test_user_creation_blocked_with_422_when_quota_limit_reached(): void
    {
        // Max users limit is 1, and $this->user already exists (count = 1)
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->postJson('/api/v1/users', [
            'name' => 'Second User',
            'email' => 'second@slicemart.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATED')
            ->assertJsonPath('error.details.quota.resource', 'users')
            ->assertJsonPath('error.details.quota.limit', 1);
    }

    public function test_warehouse_creation_blocked_with_422_when_quota_limit_reached(): void
    {
        // Create 1 warehouse so count = 1
        Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-001',
            'name' => 'Main Warehouse',
            'type' => 'physical',
            'is_active' => true,
        ]);

        // Max warehouses limit is 1, so attempting to create a second warehouse should fail
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->postJson('/api/v1/warehouses', [
            'code' => 'WH-002',
            'name' => 'Second Warehouse',
            'type' => 'physical',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATED')
            ->assertJsonPath('error.details.quota.resource', 'warehouses')
            ->assertJsonPath('error.details.quota.limit', 1);
    }

    public function test_creation_permitted_when_quota_is_unlimited(): void
    {
        // Set unlimited custom limits (-1)
        $this->tenant->update([
            'settings' => [
                'custom_limits' => [
                    'max_users' => -1,
                ],
            ],
        ]);
        Cache::flush();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->slug,
        ])->postJson('/api/v1/users', [
            'name' => 'Second User',
            'email' => 'second@slicemart.com',
            'password' => 'Password123!',
        ]);

        // It should pass through the quota barrier and successfully create the user (HTTP 201)
        $response->assertStatus(201);
    }
}
