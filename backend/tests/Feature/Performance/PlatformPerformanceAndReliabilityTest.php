<?php

declare(strict_types=1);

namespace Tests\Feature\Performance;

use App\Core\Auth\JwtService;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PlatformPerformanceAndReliabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

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

    private function getTenantUser(Tenant $tenant, string $email = 'admin@slicemart.test'): User
    {
        /** @var User|null $user */
        $user = User::withoutTenantScope()->where('email', $email)->first()
            ?? User::withoutTenantScope()->where('email', 'admin@dcp.com')->first()
            ?? User::withoutTenantScope()->first();

        if (! $user) {
            $user = User::create([
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'email' => $email,
                'name' => 'Performance Test User',
                'password' => \Illuminate\Support\Facades\Hash::make('12345678'),
                'tenant_id' => $tenant->id,
                'status' => 'active',
                'token_version' => 1,
                'perm_version' => 1,
            ]);
        }

        $user->tenant_id = $tenant->id;
        $user->save();

        return $user;
    }

    public function test_health_check_returns_services_telemetry_and_latencies(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure([
                'status',
                'timestamp',
                'version',
                'services' => [
                    'database' => ['status', 'latency_ms'],
                    'cache' => ['status', 'latency_ms'],
                ],
                'memory_usage_mb',
            ]);

        $this->assertEquals('ok', $response->json('services.database.status'));
        $this->assertEquals('ok', $response->json('services.cache.status'));
        $this->assertIsNumeric($response->json('services.database.latency_ms'));
        $this->assertIsNumeric($response->json('services.cache.latency_ms'));
    }

    public function test_tenant_dashboard_metrics_query_count_and_caching(): void
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::firstOrFail();
        $user = $this->getTenantUser($tenant);
        $headers = $this->getTenantAuthHeader($tenant, $user);

        Cache::flush();
        DB::flushQueryLog();
        DB::enableQueryLog();

        // 1. Initial invocation (uncached)
        $response = $this->getJson('/api/v1/dashboard/metrics', $headers);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'commercial' => ['today_revenue', 'month_revenue', 'active_orders', 'today_orders_count', 'total_receivable_due'],
                'production' => ['today_output', 'target_output', 'achievement_rate', 'active_batches', 'total_batches'],
                'inventory' => ['total_valuation', 'low_stock_count'],
                'quality' => ['qc_pass_rate', 'pending_inspections', 'total_inspections'],
                'trends' => ['weekly', 'today', 'monthly'],
                'recent_batches',
                'recent_qc',
                'active_workers',
                'attention_items',
            ],
        ]);

        $firstQueryCount = count(DB::getQueryLog());
        // Strictly bounded to constant O(1) queries (no N+1 loops across metrics and models).
        $this->assertLessThanOrEqual(36, $firstQueryCount, "Initial dashboard load exceeded expected bounded query threshold.");

        // Assert cache was created with required tenant namespace standard
        $cacheKey = "t{$tenant->id}:dashboard:metrics";
        $this->assertTrue(Cache::has($cacheKey), "Cache key [{$cacheKey}] was not found in cache store.");

        // 2. Second invocation (cached)
        DB::flushQueryLog();
        $cachedResponse = $this->getJson('/api/v1/dashboard/metrics', $headers);
        $cachedResponse->assertStatus(200);

        $cachedQueryCount = count(DB::getQueryLog());
        // Middleware cached profile & scopes + cached metrics means only user lookup query
        $this->assertLessThanOrEqual(2, $cachedQueryCount, "Cached invocation did not leverage cache efficiently.");

        // 3. Invalidation with ?refresh=1
        $refreshedResponse = $this->getJson('/api/v1/dashboard/metrics?refresh=1', $headers);
        $refreshedResponse->assertStatus(200);
        $this->assertTrue(Cache::has($cacheKey));
    }

    public function test_tenant_dashboard_metrics_isolation_between_tenants(): void
    {
        /** @var Tenant $tenantA */
        $tenantA = Tenant::firstOrFail();

        /** @var Tenant $tenantB */
        $tenantB = Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'plan_id' => $tenantA->plan_id,
            'name' => 'Isolated Tenant B',
            'slug' => 'isolated-tenant-b',
            'status' => 'active',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $userA = $this->getTenantUser($tenantA, 'admin@slicemart.test');
        $userB = $this->getTenantUser($tenantB, 'sales@slicemart.test');

        $headersA = $this->getTenantAuthHeader($tenantA, $userA);
        $headersB = $this->getTenantAuthHeader($tenantB, $userB);

        $this->getJson('/api/v1/dashboard/metrics', $headersA)->assertStatus(200);
        $this->getJson('/api/v1/dashboard/metrics', $headersB)->assertStatus(200);

        $keyA = "t{$tenantA->id}:dashboard:metrics";
        $keyB = "t{$tenantB->id}:dashboard:metrics";

        $this->assertTrue(Cache::has($keyA));
        $this->assertTrue(Cache::has($keyB));
        $this->assertNotEquals($keyA, $keyB);
    }

    public function test_idempotency_purge_command_deletes_only_expired_keys(): void
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::firstOrFail();
        /** @var User $user */
        $user = User::withoutTenantScope()->where('is_platform_user', false)->firstOrFail();

        // 1. Insert expired idempotency key
        DB::table('idempotency_keys')->insert([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'key' => 'expired-key-1',
            'endpoint' => 'test.endpoint',
            'request_hash' => hash('sha256', 'expired'),
            'response_status' => 200,
            'response_body' => json_encode(['ok' => true]),
            'expires_at' => now()->subHours(2),
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        // 2. Insert active idempotency key
        DB::table('idempotency_keys')->insert([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'key' => 'active-key-1',
            'endpoint' => 'test.endpoint',
            'request_hash' => hash('sha256', 'active'),
            'response_status' => 200,
            'response_body' => json_encode(['ok' => true]),
            'expires_at' => now()->addHours(22),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Run dry-run first
        $this->artisan('idempotency:purge-expired', ['--dry-run' => true])
            ->expectsOutputToContain('Dry run: 1 expired idempotency key(s) identified for deletion.')
            ->assertExitCode(0);

        // Verify still in database
        $this->assertEquals(1, DB::table('idempotency_keys')->where('key', 'expired-key-1')->count());

        // Run actual purge
        $this->artisan('idempotency:purge-expired')
            ->expectsOutputToContain('Successfully purged 1 expired idempotency key(s).')
            ->assertExitCode(0);

        // Verify expired is purged and active is retained
        $this->assertEquals(0, DB::table('idempotency_keys')->where('key', 'expired-key-1')->count());
        $this->assertEquals(1, DB::table('idempotency_keys')->where('key', 'active-key-1')->count());
    }

    public function test_bounded_options_endpoints_enforce_limit_and_contract(): void
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::firstOrFail();
        $user = $this->getTenantUser($tenant);
        $headers = $this->getTenantAuthHeader($tenant, $user);

        // Test units options
        $response = $this->getJson('/api/v1/units/options', $headers);
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $data = $response->json('data');
        $this->assertIsArray($data);
        $this->assertLessThanOrEqual(500, count($data));

        if (! empty($data)) {
            $this->assertArrayHasKey('id', $data[0]);
            $this->assertArrayHasKey('label', $data[0]);
        }
    }

    public function test_rate_limiter_throttles_excessive_login_attempts(): void
    {
        $payload = [
            'email' => 'ratelimit-test@slicemart.test',
            'password' => 'wrong-password',
        ];

        // 5 attempts allowed per 5 minutes per email
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/login', $payload);
            $this->assertNotEquals(429, $response->status(), "Attempt $i should not be rate limited.");
        }

        // 6th attempt should be blocked with 429 Too Many Requests
        $blockedResponse = $this->postJson('/api/v1/auth/login', $payload);
        $blockedResponse->assertStatus(429);
    }
}
