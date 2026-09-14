<?php

declare(strict_types=1);

namespace Tests\Feature\Core;

use App\Core\Http\Middleware\EnsureFeatureEnabled;
use App\Core\Tenancy\TenantContext;
use App\Models\FeatureFlag;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class EnsureFeatureEnabledTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private EnsureFeatureEnabled $middleware;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();
        Cache::flush();

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
            'name' => 'Feature Flag Corp',
            'slug' => 'ff-corp',
            'status' => 'active',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());
        $this->middleware = new EnsureFeatureEnabled;
    }

    public function test_permissive_default_allows_request_when_flag_not_in_database(): void
    {
        $request = Request::create('/api/v1/test', 'GET');
        $response = $this->middleware->handle($request, function () {
            return new Response('OK', 200);
        }, 'unregistered_feature');

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_blocks_request_with_403_when_global_flag_is_disabled(): void
    {
        FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => null,
            'key' => 'beta_feature',
            'enabled' => false,
            'description' => 'Global disabled feature',
        ]);

        $request = Request::create('/api/v1/test', 'GET');
        $response = $this->middleware->handle($request, function () {
            return new Response('OK', 200);
        }, 'beta_feature');

        $this->assertEquals(403, $response->getStatusCode());

        $content = json_decode((string) $response->getContent(), true);
        $this->assertFalse($content['success']);
        $this->assertEquals('FEATURE_DISABLED', $content['error']['code']);
    }

    public function test_tenant_specific_enabled_flag_overrides_global_disabled_flag(): void
    {
        // Global disabled
        FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => null,
            'key' => 'custom_ai',
            'enabled' => false,
            'description' => 'Global AI disabled',
        ]);

        // Tenant 1 enabled override
        FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'key' => 'custom_ai',
            'enabled' => true,
            'description' => 'Tenant 1 AI enabled',
        ]);

        $request = Request::create('/api/v1/test', 'GET');
        $response = $this->middleware->handle($request, function () {
            return new Response('OK', 200);
        }, 'custom_ai');

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_tenant_specific_disabled_flag_blocks_even_if_global_flag_is_enabled(): void
    {
        // Global enabled
        FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => null,
            'key' => 'ecommerce_module',
            'enabled' => true,
            'description' => 'Global ecommerce enabled',
        ]);

        // Tenant 1 disabled override
        FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'key' => 'ecommerce_module',
            'enabled' => false,
            'description' => 'Tenant 1 ecommerce disabled',
        ]);

        $request = Request::create('/api/v1/test', 'GET');
        $response = $this->middleware->handle($request, function () {
            return new Response('OK', 200);
        }, 'ecommerce_module');

        $this->assertEquals(403, $response->getStatusCode());
    }
}
