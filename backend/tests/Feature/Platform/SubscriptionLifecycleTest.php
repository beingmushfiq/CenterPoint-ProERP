<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubscriptionLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->plan = Plan::firstOrFail();
    }

    public function test_trial_tenant_transitions_to_past_due_when_trial_expires_without_subscription(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Expired Trial Bakery',
            'slug' => 'expired-trial-bakery',
            'status' => 'trialing',
            'trial_ends_at' => now()->subDay(),
        ]);

        $this->artisan('subscriptions:process-lifecycle')
            ->assertSuccessful();

        $tenant->refresh();
        $this->assertSame('past_due', $tenant->status);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'auditable_type' => Tenant::class,
            'auditable_id' => $tenant->id,
        ]);
    }

    public function test_trial_tenant_suspended_when_trial_expired_past_grace_period(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Lapsed Trial Bakery',
            'slug' => 'lapsed-trial-bakery',
            'status' => 'trialing',
            'trial_ends_at' => now()->subDays(10),
        ]);

        $this->artisan('subscriptions:process-lifecycle')
            ->assertSuccessful();

        $tenant->refresh();
        $this->assertSame('suspended', $tenant->status);
        $this->assertNotNull($tenant->suspended_at);
    }

    public function test_trial_tenant_transitions_to_active_when_active_paid_subscription_exists(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Converted Trial Bakery',
            'slug' => 'converted-trial-bakery',
            'status' => 'trialing',
            'trial_ends_at' => now()->subDay(),
        ]);

        TenantSubscription::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addMonth(),
            'status' => 'active',
            'amount' => '49.00',
            'billing_cycle' => 'monthly',
        ]);

        $this->artisan('subscriptions:process-lifecycle')
            ->assertSuccessful();

        $tenant->refresh();
        $this->assertSame('active', $tenant->status);
    }

    public function test_active_subscription_moves_to_past_due_when_ends_at_in_past(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Past Due Co',
            'slug' => 'past-due-co',
            'status' => 'active',
        ]);

        $subscription = TenantSubscription::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'starts_at' => now()->subMonth(),
            'ends_at' => now()->subDay(),
            'status' => 'active',
            'amount' => '99.00',
            'billing_cycle' => 'monthly',
            'grace_period_days' => 5,
        ]);

        $this->artisan('subscriptions:process-lifecycle')
            ->assertSuccessful();

        $subscription->refresh();
        $tenant->refresh();

        $this->assertSame('past_due', $subscription->status);
        $this->assertSame('past_due', $tenant->status);
        $this->assertNotNull($subscription->grace_period_ends_at);
    }

    public function test_past_due_tenant_is_suspended_when_grace_period_ends(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Lapsed Bakery',
            'slug' => 'lapsed-bakery',
            'status' => 'past_due',
        ]);

        TenantSubscription::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'starts_at' => now()->subMonth(),
            'ends_at' => now()->subDays(10),
            'status' => 'past_due',
            'amount' => '99.00',
            'billing_cycle' => 'monthly',
            'grace_period_ends_at' => now()->subHour(),
        ]);

        $this->artisan('subscriptions:process-lifecycle')
            ->assertSuccessful();

        $tenant->refresh();
        $this->assertSame('suspended', $tenant->status);
        $this->assertNotNull($tenant->suspended_at);

        $this->assertDatabaseHas('tenant_subscriptions', [
            'tenant_id' => $tenant->id,
            'status' => 'expired',
        ]);
    }

    public function test_dry_run_does_not_persist_changes(): void
    {
        $tenant = $this->createTenant([
            'name' => 'Dry Run Bakery',
            'slug' => 'dry-run-bakery',
            'status' => 'trialing',
            'trial_ends_at' => now()->subDay(),
        ]);

        $this->artisan('subscriptions:process-lifecycle', ['--dry-run' => true])
            ->assertSuccessful();

        $tenant->refresh();
        $this->assertSame('trialing', $tenant->status);
    }

    private function createTenant(array $attributes = []): Tenant
    {
        return Tenant::create(array_merge([
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'name' => 'Test Tenant',
            'slug' => 'test-tenant-'.Str::random(6),
            'status' => 'active',
            'timezone' => 'Asia/Dhaka',
            'currency_code' => 'BDT',
            'date_format' => 'Y-m-d',
            'number_format' => 'en_US',
        ], $attributes));
    }
}
