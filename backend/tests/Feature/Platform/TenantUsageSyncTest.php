<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\TenantUsageCounter;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class TenantUsageSyncTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant1;

    private Tenant $tenant2;

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

        $this->tenant1 = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Alpha Corp',
            'slug' => 'alpha-corp',
            'status' => 'active',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenant2 = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Beta Logistics',
            'slug' => 'beta-logistics',
            'status' => 'active',
            'currency_code' => 'EUR',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);
    }

    public function test_sync_command_updates_counters_for_all_tenants(): void
    {
        // Seed users & warehouses for Tenant 1
        User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'User Alpha 1',
            'email' => 'u1@alpha.test',
            'password' => Hash::make('secret'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        TenantContext::bind($this->tenant1->toArray());
        Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-A1',
            'name' => 'Alpha Main Warehouse',
            'is_active' => true,
        ]);
        TenantContext::flush();

        $exitCode = Artisan::call('tenants:sync-usage');
        $this->assertEquals(0, $exitCode);

        $currentMonth = Carbon::now()->format('Y-m');

        // Verify Tenant 1 counters
        $userCounter = TenantUsageCounter::where('tenant_id', 1)
            ->where('metric', 'users')
            ->where('period', 'lifetime')
            ->first();

        $this->assertNotNull($userCounter);
        $this->assertEquals(1, $userCounter->value);

        $whCounter = TenantUsageCounter::where('tenant_id', 1)
            ->where('metric', 'warehouses')
            ->where('period', 'lifetime')
            ->first();

        $this->assertNotNull($whCounter);
        $this->assertEquals(1, $whCounter->value);

        $docCounter = TenantUsageCounter::where('tenant_id', 1)
            ->where('metric', 'documents_created')
            ->where('period', $currentMonth)
            ->first();

        $this->assertNotNull($docCounter);
        $this->assertEquals(0, $docCounter->value);
    }

    public function test_sync_command_dry_run_does_not_persist_counters(): void
    {
        User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'User Beta 1',
            'email' => 'u1@beta.test',
            'password' => Hash::make('secret'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $exitCode = Artisan::call('tenants:sync-usage', ['--dry-run' => true]);
        $this->assertEquals(0, $exitCode);

        $counter = TenantUsageCounter::where('tenant_id', 2)->first();
        $this->assertNull($counter);
    }

    public function test_sync_command_respects_tenant_option(): void
    {
        User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'User Alpha 2',
            'email' => 'u2@alpha.test',
            'password' => Hash::make('secret'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'User Beta 2',
            'email' => 'u2@beta.test',
            'password' => Hash::make('secret'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $exitCode = Artisan::call('tenants:sync-usage', ['--tenant' => 1]);
        $this->assertEquals(0, $exitCode);

        // Tenant 1 should be synced
        $t1Count = TenantUsageCounter::where('tenant_id', 1)->count();
        $this->assertGreaterThan(0, $t1Count);

        // Tenant 2 should NOT be synced
        $t2Count = TenantUsageCounter::where('tenant_id', 2)->count();
        $this->assertEquals(0, $t2Count);
    }
}
