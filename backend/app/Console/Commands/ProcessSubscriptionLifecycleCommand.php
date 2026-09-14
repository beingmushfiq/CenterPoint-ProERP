<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Core\Audit\AuditAction;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class ProcessSubscriptionLifecycleCommand extends Command
{
    /**
     * Default grace period days for trials without explicit subscriptions.
     */
    public const DEFAULT_TRIAL_GRACE_DAYS = 7;

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'subscriptions:process-lifecycle {--dry-run : Simulate lifecycle checks without modifying database records}';

    /**
     * The console command description.
     */
    protected $description = 'Process tenant subscription expiries, grace periods, and trial transitions';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('Running in DRY-RUN mode. No changes will be written to the database.');
        }

        $this->info('Starting tenant subscription & lifecycle audit...');

        $trialsProcessed = $this->processTrialExpirations($isDryRun);
        $subscriptionsProcessed = $this->processSubscriptionExpirations($isDryRun);
        $gracePeriodsExpired = $this->processGracePeriodExpirations($isDryRun);

        $this->newLine();
        $this->table(
            ['Lifecycle Category', 'Count Processed'],
            [
                ['Expired Trials Transitioned', (string) $trialsProcessed],
                ['Active Subscriptions Moved to Past Due', (string) $subscriptionsProcessed],
                ['Grace Periods Expired (Suspended)', (string) $gracePeriodsExpired],
            ]
        );

        $this->info('Tenant lifecycle processing completed successfully.');

        return 0;
    }

    /**
     * Process trials that have expired.
     */
    protected function processTrialExpirations(bool $isDryRun): int
    {
        $count = 0;
        $now = now();

        $expiredTrialTenants = Tenant::whereIn('status', ['trial', 'trialing'])
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<', $now)
            ->get();

        foreach ($expiredTrialTenants as $tenant) {
            $hasActivePaidSubscription = TenantSubscription::where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->where(function ($query) use ($now): void {
                    $query->whereNull('ends_at')
                        ->orWhere('ends_at', '>=', $now);
                })
                ->exists();

            $oldStatus = $tenant->status;

            if ($hasActivePaidSubscription) {
                $newStatus = 'active';
                $suspendedAt = null;
            } else {
                // Check if 7-day grace period has passed since trial_ends_at
                $trialGraceCutoff = $tenant->trial_ends_at?->copy()->addDays(self::DEFAULT_TRIAL_GRACE_DAYS);
                if ($trialGraceCutoff && $trialGraceCutoff->isPast()) {
                    $newStatus = 'suspended';
                    $suspendedAt = $now;
                } else {
                    $newStatus = 'past_due';
                    $suspendedAt = null;
                }
            }

            $this->line(sprintf(
                '  [Trial Expired] Tenant #%d (%s): %s -> %s',
                $tenant->id,
                $tenant->slug,
                $oldStatus,
                $newStatus
            ));

            if (! $isDryRun) {
                DB::transaction(function () use ($tenant, $oldStatus, $newStatus, $suspendedAt): void {
                    $tenant->status = $newStatus;
                    if ($suspendedAt !== null) {
                        $tenant->suspended_at = $suspendedAt;
                    }
                    $tenant->save();

                    $this->recordAuditLog(
                        tenantId: $tenant->id,
                        auditableType: Tenant::class,
                        auditableId: $tenant->id,
                        before: ['status' => $oldStatus],
                        after: ['status' => $newStatus, 'suspended_at' => $suspendedAt?->toIso8601String()],
                        event: 'trial_expired_transition'
                    );
                });
            }

            $count++;
        }

        return $count;
    }

    /**
     * Process subscriptions that have passed their ends_at date.
     */
    protected function processSubscriptionExpirations(bool $isDryRun): int
    {
        $count = 0;
        $now = now();

        $expiredSubscriptions = TenantSubscription::where('status', 'active')
            ->whereNotNull('ends_at')
            ->where('ends_at', '<', $now)
            ->get();

        foreach ($expiredSubscriptions as $subscription) {
            $graceDays = (int) ($subscription->grace_period_days ?? 7);
            $graceEnd = $subscription->ends_at
                ? $subscription->ends_at->copy()->addDays($graceDays)
                : $now->copy()->addDays($graceDays);

            $this->line(sprintf(
                '  [Subscription Expired] Subscription #%d for Tenant #%d: active -> past_due (Grace ends %s)',
                $subscription->id,
                $subscription->tenant_id,
                $graceEnd->toDateTimeString()
            ));

            if (! $isDryRun) {
                DB::transaction(function () use ($subscription, $graceEnd): void {
                    $subscription->status = 'past_due';
                    $subscription->grace_period_ends_at = $graceEnd;
                    $subscription->save();

                    // Update parent tenant status if active
                    $tenant = Tenant::find($subscription->tenant_id);
                    if ($tenant && $tenant->status === 'active') {
                        $tenant->status = 'past_due';
                        $tenant->save();

                        $this->recordAuditLog(
                            tenantId: $tenant->id,
                            auditableType: Tenant::class,
                            auditableId: $tenant->id,
                            before: ['status' => 'active'],
                            after: ['status' => 'past_due'],
                            event: 'subscription_past_due_transition'
                        );
                    }
                });
            }

            $count++;
        }

        return $count;
    }

    /**
     * Process past_due subscriptions whose grace period has lapsed without payment.
     */
    protected function processGracePeriodExpirations(bool $isDryRun): int
    {
        $count = 0;
        $now = now();

        $lapsedSubscriptions = TenantSubscription::where('status', 'past_due')
            ->whereNotNull('grace_period_ends_at')
            ->where('grace_period_ends_at', '<', $now)
            ->get();

        foreach ($lapsedSubscriptions as $subscription) {
            $this->line(sprintf(
                '  [Grace Period Lapsed] Expiring Subscription #%d and checking Tenant #%d',
                $subscription->id,
                $subscription->tenant_id
            ));

            if (! $isDryRun) {
                DB::transaction(function () use ($subscription, $now): void {
                    $subscription->status = 'expired';
                    $subscription->save();

                    // Check if tenant has any remaining active subscriptions
                    $hasOtherActiveSubscription = TenantSubscription::where('tenant_id', $subscription->tenant_id)
                        ->where('status', 'active')
                        ->where(function ($query) use ($now): void {
                            $query->whereNull('ends_at')
                                ->orWhere('ends_at', '>=', $now);
                        })
                        ->exists();

                    if (! $hasOtherActiveSubscription) {
                        $tenant = Tenant::find($subscription->tenant_id);
                        if ($tenant && $tenant->status !== 'suspended') {
                            $oldStatus = $tenant->status;
                            $tenant->status = 'suspended';
                            $tenant->suspended_at = $now;
                            $tenant->save();

                            $this->recordAuditLog(
                                tenantId: $tenant->id,
                                auditableType: Tenant::class,
                                auditableId: $tenant->id,
                                before: ['status' => $oldStatus],
                                after: ['status' => 'suspended', 'suspended_at' => $now->toIso8601String()],
                                event: 'grace_period_lapsed_suspended'
                            );
                        }
                    }
                });
            }

            $count++;
        }

        return $count;
    }

    /**
     * Helper to write append-only audit log entry.
     *
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    protected function recordAuditLog(
        int $tenantId,
        string $auditableType,
        int $auditableId,
        ?array $before,
        ?array $after,
        string $event
    ): void {
        try {
            $log = new AuditLog;
            $log->uuid = (string) Str::uuid();
            $log->tenant_id = $tenantId;
            $log->action = AuditAction::Updated;
            $log->auditable_type = $auditableType;
            $log->auditable_id = $auditableId;
            $log->before = $before;
            $log->after = $after;
            $log->context = [
                'event' => $event,
                'source' => 'console_scheduler',
            ];
            $log->created_at = now();
            $log->save();
        } catch (Throwable $e) {
            $this->warn("Failed to write audit log for Tenant #{$tenantId}: ".$e->getMessage());
        }
    }
}
