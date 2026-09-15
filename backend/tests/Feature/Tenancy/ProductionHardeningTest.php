<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Http\Middleware\EnsurePlatformAdmin;
use App\Core\Tenancy\TenantContext;
use App\Core\Tenancy\TenantResolver;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\ProductionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

final class ProductionHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    /**
     * Test that TenantResolver guards the master platform domain.
     */
    public function test_tenant_resolver_guards_master_domain(): void
    {
        config(['platform.master_domain' => 'proerp.devcenterpoint.com']);
        config(['platform.tenant_base_domain' => 'devcenterpoint.com']);

        $request = Request::create('https://proerp.devcenterpoint.com/api/v1/platform/dashboard/kpis');
        $resolved = TenantResolver::resolveFromRequest($request);

        $this->assertNull($resolved, 'Master domain proerp.devcenterpoint.com must never resolve to a tenant.');
    }

    /**
     * Test that TenantResolver rejects reserved subdomains.
     */
    public function test_tenant_resolver_rejects_reserved_subdomains(): void
    {
        config(['platform.tenant_base_domain' => 'devcenterpoint.com']);

        $reservedHosts = [
            'api.devcenterpoint.com',
            'admin.devcenterpoint.com',
            'mail.devcenterpoint.com',
            'cpanel.devcenterpoint.com',
            'status.devcenterpoint.com',
        ];

        foreach ($reservedHosts as $host) {
            $request = Request::create("https://{$host}/");
            $this->assertNull(
                TenantResolver::resolveFromRequest($request),
                "Reserved host {$host} must not resolve as a tenant."
            );
        }
    }

    /**
     * Test that TenantResolver validates RFC-1123 DNS subdomain label format.
     */
    public function test_subdomain_dns_validation(): void
    {
        $this->assertTrue(TenantResolver::isValidSubdomain('slicemart'));
        $this->assertTrue(TenantResolver::isValidSubdomain('tenant-1'));
        $this->assertTrue(TenantResolver::isValidSubdomain('factory123'));

        // Invalid subdomains
        $this->assertFalse(TenantResolver::isValidSubdomain('-leading-hyphen'));
        $this->assertFalse(TenantResolver::isValidSubdomain('trailing-hyphen-'));
        $this->assertFalse(TenantResolver::isValidSubdomain('invalid_char'));
        $this->assertFalse(TenantResolver::isValidSubdomain('has space'));
        $this->assertFalse(TenantResolver::isValidSubdomain('has.dot'));
    }

    /**
     * Test that EnsurePlatformAdmin middleware rejects non-platform users.
     */
    public function test_ensure_platform_admin_rejects_tenant_users(): void
    {
        $plan = Plan::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'TEST_PLAN',
            'name' => 'Test Plan',
            'price' => '100.0000',
            'billing_period' => 'monthly',
        ]);

        $tenant = Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'plan_id' => $plan->id,
            'name' => 'Acme Manufacturing',
            'slug' => 'acme',
            'status' => 'active',
            'timezone' => 'UTC',
            'currency_code' => 'USD',
            'date_format' => 'Y-m-d',
            'number_format' => '1,234.56',
        ]);

        $tenantUser = new User();
        $tenantUser->id = 10;
        $tenantUser->tenant_id = $tenant->id;
        $tenantUser->is_platform_user = false;

        $request = Request::create('https://proerp.devcenterpoint.com/api/v1/platform/tenants');
        $request->setUserResolver(fn () => $tenantUser);

        $middleware = new EnsurePlatformAdmin();
        $response = $middleware->handle($request, fn () => response('OK'));

        $this->assertSame(403, $response->getStatusCode());
    }

    /**
     * Test that ProductionSeeder seeds structural data, platform super admin, and the flagship tenant.
     */
    public function test_production_seeder_seeds_flagship_tenant_and_super_admin(): void
    {
        $this->seed(ProductionSeeder::class);

        // Plans should be seeded
        $this->assertGreaterThan(0, Plan::count(), 'ProductionSeeder must seed subscription plans.');

        // Platform Super Admin must exist
        $this->assertDatabaseHas('users', [
            'email' => 'admin@devcenterpoint.com',
            'tenant_id' => null,
        ]);

        // Flagship tenant SliceMart must exist
        $this->assertDatabaseHas('tenants', [
            'slug' => 'slicemart',
        ]);
        $this->assertGreaterThan(0, Tenant::count());
    }
}
