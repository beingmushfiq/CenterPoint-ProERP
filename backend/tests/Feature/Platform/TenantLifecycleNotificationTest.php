<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Mail\TenantSubscriptionLifecycleMail;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

final class TenantLifecycleNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Plan $plan;

    private Tenant $tenant;

    private User $tenantAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->plan = Plan::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'GROWTH',
            'name' => 'Growth Tier',
            'price' => '499.0000',
            'billing_period' => 'monthly',
            'limits' => ['max_users' => 15],
            'is_active' => true,
        ]);

        $this->tenant = Tenant::create([
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'name' => 'Apex Sound Ltd',
            'slug' => 'apex-sound',
            'status' => 'trial',
            'trial_ends_at' => Carbon::now()->subDay(), // Expired yesterday
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenantAdmin = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Apex Administrator',
            'email' => 'admin@apexsound.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
            'is_platform_user' => false,
        ]);
    }

    public function test_expired_trial_sends_past_due_lifecycle_email_to_admin(): void
    {
        Artisan::call('subscriptions:process-lifecycle');

        Mail::assertSent(TenantSubscriptionLifecycleMail::class, function (TenantSubscriptionLifecycleMail $mail) {
            return $mail->hasTo('admin@apexsound.test')
                && $mail->eventType === 'past_due'
                && $mail->tenantName === 'Apex Sound Ltd';
        });
    }

    public function test_lapsed_grace_period_sends_suspended_lifecycle_email_to_admin(): void
    {
        $this->tenant->status = 'past_due';
        $this->tenant->save();

        TenantSubscription::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'plan_id' => $this->plan->id,
            'starts_at' => Carbon::now()->subMonths(2),
            'ends_at' => Carbon::now()->subDays(15),
            'grace_period_ends_at' => Carbon::now()->subDay(), // Grace ended yesterday
            'status' => 'past_due',
            'amount' => '499.0000',
        ]);

        Artisan::call('subscriptions:process-lifecycle');

        Mail::assertSent(TenantSubscriptionLifecycleMail::class, function (TenantSubscriptionLifecycleMail $mail) {
            return $mail->hasTo('admin@apexsound.test')
                && $mail->eventType === 'suspended'
                && $mail->tenantName === 'Apex Sound Ltd';
        });
    }
}
