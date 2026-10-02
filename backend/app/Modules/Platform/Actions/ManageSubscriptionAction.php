<?php

declare(strict_types=1);

namespace App\Modules\Platform\Actions;

use App\Core\Actions\Action;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Action to change plan, extend trial, or renew subscription.
 */
class ManageSubscriptionAction extends Action
{
    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function execute(array $input): array
    {
        $tenantId = (int) $input['tenant_id'];
        $tenant = Tenant::findOrFail($tenantId);

        $actionType = (string) ($input['action'] ?? 'extend'); // 'extend' | 'change_plan' | 'renew' | 'set_expiry' | 'set_grace_period'

        if ($actionType === 'change_plan') {
            $newPlanId = (int) ($input['plan_id'] ?? 0);
            $newPlan = Plan::findOrFail($newPlanId);

            $oldPlanId = $tenant->plan_id;
            $tenant->update(['plan_id' => $newPlan->id]);

            // Update active subscription or create one if none exists
            $subscription = TenantSubscription::where('tenant_id', $tenant->id)
                ->whereIn('status', ['active', 'trial', 'past_due', 'grace_period'])
                ->latest('id')
                ->first();

            if ($subscription !== null) {
                $subscription->update([
                    'plan_id' => $newPlan->id,
                    'amount' => $newPlan->price,
                    'updated_by' => Auth::id(),
                ]);
            }

            AuditLog::withoutTenantScope()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => Auth::id(),
                'action' => \App\Core\Audit\AuditAction::Updated,
                'auditable_type' => 'Tenant',
                'auditable_id' => $tenant->id,
                'ip' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
                'created_at' => Carbon::now(),
                'before' => ['plan_id' => $oldPlanId],
                'after' => ['plan_id' => $newPlan->id, 'plan_code' => $newPlan->code],
            ]);

            $this->flushTenantCache($tenant->id);

            return [
                'tenant_id' => $tenant->id,
                'plan_id' => $newPlan->id,
                'plan_name' => $newPlan->name,
                'status' => $tenant->status,
            ];
        }

        if ($actionType === 'set_expiry') {
            $endsAtInput = $input['ends_at'] ?? null;
            if (! $endsAtInput) {
                throw ValidationException::withMessages([
                    'ends_at' => ['An absolute expiry date (ends_at) is required.'],
                ]);
            }

            $newEndsAt = Carbon::parse((string) $endsAtInput);
            $subscription = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();
            $graceDays = (int) ($input['grace_period_days'] ?? $subscription?->grace_period_days ?? 7);
            $graceEndsAt = (clone $newEndsAt)->addDays($graceDays);

            // Accurately determine status based on expiry and grace period
            $computedStatus = 'active';
            if ($newEndsAt->isPast()) {
                $computedStatus = $graceEndsAt->isFuture() ? 'past_due' : 'suspended';
            }

            $notes = isset($input['notes']) ? (string) $input['notes'] : null;
            $updates = [
                'ends_at' => $newEndsAt,
                'grace_period_days' => $graceDays,
                'grace_period_ends_at' => $graceEndsAt,
                'status' => $computedStatus,
                'renewed_by' => Auth::id(),
                'updated_by' => Auth::id(),
            ];
            if ($notes !== null) {
                $updates['notes'] = $notes;
            }

            if ($subscription !== null) {
                $subscription->update($updates);
            } else {
                $subscription = TenantSubscription::create(array_merge($updates, [
                    'tenant_id' => $tenant->id,
                    'uuid' => (string) Str::uuid(),
                    'plan_id' => $tenant->plan_id,
                    'starts_at' => Carbon::now(),
                    'amount' => $tenant->plan?->price ?? 0,
                    'currency_code' => 'BDT',
                    'created_by' => Auth::id(),
                ]));
            }

            $tenantUpdates = ['status' => $computedStatus];
            if ($computedStatus === 'suspended') {
                $tenantUpdates['suspended_at'] = Carbon::now();
            } else {
                $tenantUpdates['suspended_at'] = null;
            }
            $tenant->update($tenantUpdates);

            AuditLog::withoutTenantScope()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => Auth::id(),
                'action' => \App\Core\Audit\AuditAction::Updated,
                'auditable_type' => 'TenantSubscription',
                'auditable_id' => $subscription->id,
                'ip' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
                'created_at' => Carbon::now(),
                'after' => [
                    'action' => 'set_expiry',
                    'ends_at' => $newEndsAt->toIso8601String(),
                    'grace_period_days' => $graceDays,
                    'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
                    'status' => $computedStatus,
                    'notes' => $notes,
                ],
            ]);

            $this->flushTenantCache($tenant->id);

            return [
                'tenant_id' => $tenant->id,
                'status' => $computedStatus,
                'ends_at' => $newEndsAt->toIso8601String(),
                'grace_period_days' => $graceDays,
                'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
                'notes' => $notes,
            ];
        }

        if ($actionType === 'extend') {
            $days = (int) ($input['days'] ?? 30);
            $subscription = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();

            $baseDate = ($subscription && $subscription->ends_at && $subscription->ends_at->isFuture())
                ? $subscription->ends_at
                : Carbon::now();

            $newEndsAt = Carbon::parse($baseDate)->addDays($days);
            $graceDays = (int) ($input['grace_period_days'] ?? $subscription?->grace_period_days ?? 7);
            $graceEndsAt = (clone $newEndsAt)->addDays($graceDays);
            $notes = isset($input['notes']) ? (string) $input['notes'] : null;

            if ($subscription !== null) {
                $subUpdates = [
                    'ends_at' => $newEndsAt,
                    'grace_period_days' => $graceDays,
                    'grace_period_ends_at' => $graceEndsAt,
                    'status' => 'active',
                    'renewed_by' => Auth::id(),
                    'updated_by' => Auth::id(),
                ];
                if ($notes !== null) {
                    $subUpdates['notes'] = $notes;
                }
                $subscription->update($subUpdates);
            }

            $tenant->update(['status' => 'active', 'suspended_at' => null]);

            AuditLog::withoutTenantScope()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => Auth::id(),
                'action' => \App\Core\Audit\AuditAction::Updated,
                'auditable_type' => 'Tenant',
                'auditable_id' => $tenant->id,
                'ip' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
                'created_at' => Carbon::now(),
                'after' => [
                    'extended_days' => $days,
                    'ends_at' => $newEndsAt->toIso8601String(),
                    'grace_period_days' => $graceDays,
                    'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
                    'notes' => $notes,
                ],
            ]);

            $this->flushTenantCache($tenant->id);

            return [
                'tenant_id' => $tenant->id,
                'status' => 'active',
                'ends_at' => $newEndsAt->toIso8601String(),
                'grace_period_days' => $graceDays,
                'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
            ];
        }

        if ($actionType === 'set_grace_period') {
            $graceDays = (int) ($input['grace_period_days'] ?? 7);
            $subscription = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();

            if ($subscription !== null) {
                $base = $subscription->ends_at ?? Carbon::now();
                $graceEndsAt = Carbon::parse($base)->addDays($graceDays);
                $subscription->update([
                    'grace_period_days' => $graceDays,
                    'grace_period_ends_at' => $graceEndsAt,
                    'updated_by' => Auth::id(),
                ]);

                if ($subscription->ends_at !== null && $subscription->ends_at->isPast()) {
                    if ($graceEndsAt->isFuture()) {
                        $tenant->update(['status' => 'past_due', 'suspended_at' => null]);
                    } else {
                        $tenant->update(['status' => 'suspended', 'suspended_at' => Carbon::now()]);
                    }
                }
            }

            AuditLog::withoutTenantScope()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => Auth::id(),
                'action' => \App\Core\Audit\AuditAction::Updated,
                'auditable_type' => 'TenantSubscription',
                'auditable_id' => $subscription?->id ?? $tenant->id,
                'ip' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
                'created_at' => Carbon::now(),
                'after' => ['grace_period_days' => $graceDays],
            ]);

            $this->flushTenantCache($tenant->id);

            return [
                'tenant_id' => $tenant->id,
                'grace_period_days' => $graceDays,
            ];
        }

        if ($actionType === 'renew') {
            $plan = $tenant->plan ?? Plan::findOrFail($tenant->plan_id);
            $billingCycle = (string) ($input['billing_cycle'] ?? $plan->billing_period ?? 'monthly');
            $months = $billingCycle === 'yearly' ? 12 : 1;

            $currentSub = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();
            $startsAt = ($currentSub && $currentSub->ends_at && $currentSub->ends_at->isFuture())
                ? $currentSub->ends_at
                : Carbon::now();
            $endsAt = Carbon::parse($startsAt)->addMonths($months);
            $graceDays = (int) ($input['grace_period_days'] ?? $currentSub?->grace_period_days ?? 7);
            $graceEndsAt = (clone $endsAt)->addDays($graceDays);

            $amount = isset($input['amount']) ? (float) $input['amount'] : (float) $plan->price;
            $discountType = (string) ($input['discount_type'] ?? 'none');
            $discountValue = (float) ($input['discount_value'] ?? 0);
            $notes = isset($input['notes']) ? (string) $input['notes'] : 'Manual admin renewal';

            $newSub = TenantSubscription::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'plan_id' => $plan->id,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'grace_period_days' => $graceDays,
                'grace_period_ends_at' => $graceEndsAt,
                'status' => 'active',
                'amount' => $amount,
                'currency_code' => $input['currency_code'] ?? 'BDT',
                'billing_cycle' => $billingCycle,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'notes' => $notes,
                'renewed_by' => Auth::id(),
                'created_by' => Auth::id(),
            ]);

            $tenant->update(['status' => 'active', 'suspended_at' => null]);

            AuditLog::withoutTenantScope()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => Auth::id(),
                'action' => \App\Core\Audit\AuditAction::Created,
                'auditable_type' => 'TenantSubscription',
                'auditable_id' => $newSub->id,
                'ip' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
                'created_at' => Carbon::now(),
                'after' => [
                    'renewed_sub_id' => $newSub->id,
                    'starts_at' => $startsAt->toIso8601String(),
                    'ends_at' => $endsAt->toIso8601String(),
                    'grace_period_days' => $graceDays,
                    'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
                    'amount' => $amount,
                ],
            ]);

            $this->flushTenantCache($tenant->id);

            return [
                'tenant_id' => $tenant->id,
                'subscription_id' => $newSub->id,
                'status' => 'active',
                'starts_at' => $startsAt->toIso8601String(),
                'ends_at' => $endsAt->toIso8601String(),
                'grace_period_days' => $graceDays,
                'grace_period_ends_at' => $graceEndsAt->toIso8601String(),
                'amount' => $amount,
            ];
        }

        throw ValidationException::withMessages([
            'action' => ["Unsupported subscription action '{$actionType}'."],
        ]);
    }

    private function flushTenantCache(int $tenantId): void
    {
        Cache::forget("t{$tenantId}:tenant:profile");
        Cache::forget("tenant:{$tenantId}:profile");
        \App\Core\Capabilities\TenantCapabilityManifest::invalidate($tenantId);
    }
}
