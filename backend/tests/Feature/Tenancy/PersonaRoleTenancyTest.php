<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Auth\TenantPersonaService;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PersonaRoleTenancyTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant1;

    private Tenant $tenant2;

    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->plan = Plan::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Enterprise Plan',
            'code' => 'ENTERPRISE',
            'price' => 999.00,
            'billing_period' => 'monthly',
            'features' => ['all'],
            'is_active' => true,
        ]);

        $this->tenant1 = Tenant::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Industries',
            'slug' => 'slicemart',
            'plan_id' => $this->plan->id,
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenant2 = Tenant::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Apex Manufacturing',
            'slug' => 'apex',
            'plan_id' => $this->plan->id,
            'status' => 'active',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        // Provision personas for both tenants
        TenantPersonaService::provisionPersonasForTenant($this->tenant1, '12345678');
        TenantPersonaService::provisionPersonasForTenant($this->tenant2, '12345678');
    }

    public function test_all_tenants_have_the_5_canonical_enterprise_personas_provisioned(): void
    {
        foreach ([$this->tenant1, $this->tenant2] as $tenant) {
            $expectedRoles = [
                'super_admin' => 'Enterprise Administrator',
                'production_manager' => 'Plant Production Manager',
                'qc_inspector' => 'Quality Assurance Inspector',
                'storekeeper' => 'Inventory Controller & Storekeeper',
                'sales_officer' => 'Commercial & Sales Operations Officer',
            ];

            foreach ($expectedRoles as $slug => $expectedDesignation) {
                $role = Role::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('slug', $slug)
                    ->first();

                $this->assertNotNull($role, "Role {$slug} must exist for tenant {$tenant->slug}");
                $this->assertSame($expectedDesignation, $role->designation);

                // Check that at least one persona user is provisioned with password 12345678
                $users = $role->users;
                $this->assertNotEmpty($users, "At least one user must be attached to role {$slug} for tenant {$tenant->slug}");

                foreach ($users as $user) {
                    $this->assertTrue(
                        Hash::check('12345678', $user->password),
                        "User {$user->email} must have password 12345678"
                    );
                }
            }
        }
    }

    public function test_personas_can_authenticate_with_password_12345678_and_receive_proper_designation(): void
    {
        $testCases = [
            [
                'email' => 'admin@slicemart.test',
                'expected_role' => 'Administrator',
                'expected_designation' => 'Enterprise Administrator',
            ],
            [
                'email' => 'production@slicemart.test',
                'expected_role' => 'Production Manager',
                'expected_designation' => 'Plant Production Manager',
            ],
            [
                'email' => 'qc@slicemart.test',
                'expected_role' => 'Quality Inspector',
                'expected_designation' => 'Quality Assurance Inspector',
            ],
            [
                'email' => 'store@slicemart.test',
                'expected_role' => 'Warehouse Storekeeper',
                'expected_designation' => 'Inventory Controller & Storekeeper',
            ],
            [
                'email' => 'sales@slicemart.test',
                'expected_role' => 'Sales Officer',
                'expected_designation' => 'Commercial & Sales Operations Officer',
            ],
        ];

        foreach ($testCases as $tc) {
            $loginRes = $this->postJson('/api/v1/auth/login', [
                'email' => $tc['email'],
                'password' => '12345678',
                'tenant_id' => $this->tenant1->id,
            ]);

            $loginRes->assertOk();
            $data = $loginRes->json('data');

            $this->assertNotNull($data);
            $this->assertArrayHasKey('access_token', $data);
            $this->assertSame($tc['expected_role'], $data['user']['role']);
            $this->assertSame($tc['expected_role'], $data['user']['role_label']);
            $this->assertSame($tc['expected_designation'], $data['user']['designation']);
            $this->assertNotSame('Factory Operator', $data['user']['designation']);

            // Verify /api/v1/auth/me also returns proper designation
            $token = $data['access_token'];
            $meRes = $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson('/api/v1/auth/me');

            $meRes->assertOk();
            $meData = $meRes->json('data');
            $this->assertSame($tc['expected_designation'], $meData['user']['designation']);
            $this->assertNotSame('Factory Operator', $meData['user']['designation']);
        }
    }

    public function test_tenant_can_edit_role_designation_and_it_reflects_in_auth_payload(): void
    {
        // 1. Log in as tenant Admin
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@slicemart.test',
            'password' => '12345678',
            'tenant_id' => $this->tenant1->id,
        ]);
        $loginRes->assertOk();
        $adminToken = $loginRes->json('data.access_token');
        $this->assertNotEmpty($adminToken);

        // 2. Find Production Manager role for tenant 1
        $prodRole = Role::withoutTenantScope()
            ->where('tenant_id', $this->tenant1->id)
            ->where('slug', 'production_manager')
            ->firstOrFail();

        // 3. Update designation of Production Manager
        $updateRes = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/v1/roles/{$prodRole->id}", [
                'name' => 'Operations & Production Lead',
                'designation' => 'Chief Floor Operations Director',
                'description' => 'Customized production leadership domain',
            ]);

        $updateRes->assertOk();
        $this->assertSame('Chief Floor Operations Director', $updateRes->json('data.designation'));
        $this->assertSame('Operations & Production Lead', $updateRes->json('data.name'));

        // 4. Log in as Production Manager and verify updated designation
        $prodLoginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'production@slicemart.test',
            'password' => '12345678',
            'tenant_id' => $this->tenant1->id,
        ]);
        $prodLoginRes->assertOk();
        $this->assertSame('Chief Floor Operations Director', $prodLoginRes->json('data.user.designation'));
        $this->assertSame('Operations & Production Lead', $prodLoginRes->json('data.user.role'));
    }

    public function test_rbac_permissions_isolation_across_personas(): void
    {
        // Production Manager permissions
        $prodUser = User::withoutTenantScope()
            ->where('tenant_id', $this->tenant1->id)
            ->where('email', 'production@slicemart.test')
            ->firstOrFail();
        $prodPerms = $prodUser->getEffectivePermissions();

        $this->assertContains('production.plan.create', $prodPerms);
        $this->assertContains('production.batch.create', $prodPerms);
        $this->assertNotContains('sales.order.create', $prodPerms);
        $this->assertNotContains('core.role.manage', $prodPerms);

        // Quality Inspector permissions
        $qcUser = User::withoutTenantScope()
            ->where('tenant_id', $this->tenant1->id)
            ->where('email', 'qc@slicemart.test')
            ->firstOrFail();
        $qcPerms = $qcUser->getEffectivePermissions();

        $this->assertContains('qc.inspection.create', $qcPerms);
        $this->assertContains('qc.defect.create', $qcPerms);
        $this->assertNotContains('production.worker_entry.approve', $qcPerms);
        $this->assertNotContains('sales.invoice.create', $qcPerms);

        // Warehouse Storekeeper permissions
        $storeUser = User::withoutTenantScope()
            ->where('tenant_id', $this->tenant1->id)
            ->where('email', 'store@slicemart.test')
            ->firstOrFail();
        $storePerms = $storeUser->getEffectivePermissions();

        $this->assertContains('inventory.stock.adjust', $storePerms);
        $this->assertContains('purchasing.grn.create', $storePerms);
        $this->assertNotContains('sales.order.approve', $storePerms);
        $this->assertNotContains('production.plan.create', $storePerms);

        // Sales Officer permissions
        $salesUser = User::withoutTenantScope()
            ->where('tenant_id', $this->tenant1->id)
            ->where('email', 'sales@slicemart.test')
            ->firstOrFail();
        $salesPerms = $salesUser->getEffectivePermissions();

        $this->assertContains('sales.order.create', $salesPerms);
        $this->assertContains('sales.invoice.create', $salesPerms);
        $this->assertNotContains('production.plan.create', $salesPerms);
        $this->assertNotContains('qc.inspection.create', $salesPerms);
    }
}
