<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * App\Models\Tenant
 *
 * @property int $id
 * @property string $uuid
 * @property int $plan_id
 * @property string $name
 * @property string $slug
 * @property string|null $domain
 * @property string $status
 * @property string $currency
 * @property string $timezone
 * @property string $locale
 * @property string|null $logo_path
 * @property array<string, mixed>|null $branding
 * @property array<string, mixed>|null $settings
 * @property CarbonInterface|null $onboarding_completed_at
 * @property int|null $onboarding_step
 * @property array<string, mixed>|null $onboarding_draft
 * @property string|null $industry_profile_key
 * @property string|null $manufacturing_type
 * @property array<string, mixed>|null $terminology
 * @property CarbonInterface|null $trial_ends_at
 * @property CarbonInterface|null $activated_at
 * @property CarbonInterface|null $grace_period_ends_at
 * @property CarbonInterface|null $suspended_at
 * @property CarbonInterface|null $archived_at
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
 * @property-read Collection<int, User> $users
 * @property-read Plan|null $plan
 */
class Tenant extends Model
{
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'plan_id',
        'name',
        'slug',
        'status',
        'currency_code',
        'timezone',
        'locale',
        'date_format',
        'number_format',
        'settings',
        'branding',
        'business_type_keys',
        'industry_profile_key',
        'manufacturing_type',
        'terminology',
        'onboarding_completed_at',
        'onboarding_step',
        'onboarding_draft',
        'trial_ends_at',
        'activated_at',
        'suspended_at',
        'archived_at',
    ];

    /**
     * Subscription plan assigned to this tenant.
     *
     * @return BelongsTo<Plan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    /**
     * Subscriptions history for this tenant.
     *
     * @return HasMany<TenantSubscription, $this>
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'tenant_id');
    }

    /**
     * SaaS subscription payments for this tenant.
     *
     * @return HasMany<PlatformSubscriptionPayment, $this>
     */
    public function subscriptionPayments(): HasMany
    {
        return $this->hasMany(PlatformSubscriptionPayment::class, 'tenant_id');
    }

    /**
     * Support tickets for this tenant.
     *
     * @return HasMany<PlatformSupportTicket, $this>
     */
    public function supportTickets(): HasMany
    {
        return $this->hasMany(PlatformSupportTicket::class, 'tenant_id');
    }

    /**
     * Users associated with this tenant.
     *
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'tenant_id');
    }

    /**
     * Enabled/configured modules for this tenant.
     *
     * @return HasMany<TenantModule, $this>
     */
    public function modules(): HasMany
    {
        return $this->hasMany(TenantModule::class, 'tenant_id');
    }

    /**
     * Production stages for this tenant.
     *
     * @return HasMany<TenantProductionStage, $this>
     */
    public function productionStages(): HasMany
    {
        return $this->hasMany(TenantProductionStage::class, 'tenant_id')->orderBy('sort_order');
    }

    /**
     * QC templates for this tenant.
     *
     * @return HasMany<TenantQcTemplate, $this>
     */
    public function qcTemplates(): HasMany
    {
        return $this->hasMany(TenantQcTemplate::class, 'tenant_id');
    }

    /**
     * Custom field definitions for this tenant.
     *
     * @return HasMany<CustomFieldDefinition, $this>
     */
    public function customFieldDefinitions(): HasMany
    {
        return $this->hasMany(CustomFieldDefinition::class, 'tenant_id')->orderBy('sort_order');
    }

    /**
     * Check if tenant's subscription and grace period have lapsed.
     */
    public function isSubscriptionExpiredPastGrace(): bool
    {
        if (in_array($this->status, ['suspended', 'cancelled', 'archived'], true)) {
            return true;
        }

        // 1. Check paid subscription expiries
        /** @var TenantSubscription|null $latestSub */
        $latestSub = $this->subscriptions()->latest('id')->first();
        if ($latestSub !== null && $latestSub->ends_at !== null) {
            if ($latestSub->ends_at->isPast()) {
                $graceDays = (int) ($latestSub->grace_period_days ?? 7);
                $graceCutoff = $latestSub->grace_period_ends_at ?? $latestSub->ends_at->copy()->addDays($graceDays);
                if ($graceCutoff->isPast()) {
                    return true;
                }
            }

            return false;
        }

        // 2. Check trial expiries (without paid subscription)
        if ($this->trial_ends_at !== null && $this->trial_ends_at->isPast()) {
            $trialGraceCutoff = $this->trial_ends_at->copy()->addDays(7);
            if ($trialGraceCutoff->isPast()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine if tenant is suspended (explicitly or via lapsed grace period).
     */
    public function isSuspended(): bool
    {
        return in_array($this->status, ['suspended', 'cancelled', 'archived'], true)
            || $this->isSubscriptionExpiredPastGrace();
    }

    /**
     * Resolve the effective operational status in real-time.
     */
    public function resolveEffectiveStatus(): string
    {
        if (in_array($this->status, ['suspended', 'cancelled', 'archived'], true)) {
            return $this->status;
        }

        if ($this->isSubscriptionExpiredPastGrace()) {
            return 'suspended';
        }

        // Check if in grace period (past_due)
        $latestSub = $this->subscriptions()->latest('id')->first();
        if ($latestSub !== null && $latestSub->ends_at !== null && $latestSub->ends_at->isPast()) {
            return 'past_due';
        }

        if ($this->trial_ends_at !== null && $this->trial_ends_at->isPast()) {
            return 'past_due';
        }

        return $this->status;
    }

    /**
     * Automatically synchronize suspension state to database and flush caches if lapsed.
     */
    public function syncSuspensionStateIfNeeded(): bool
    {
        if ($this->isSubscriptionExpiredPastGrace() && $this->status !== 'suspended') {
            $this->update([
                'status' => 'suspended',
                'suspended_at' => $this->suspended_at ?? Carbon::now(),
            ]);

            /** @var TenantSubscription|null $latestSub */
            $latestSub = $this->subscriptions()->latest('id')->first();
            if ($latestSub !== null && in_array($latestSub->status, ['active', 'past_due', 'trial'], true)) {
                $latestSub->update(['status' => 'expired']);
            }

            Cache::forget("t{$this->id}:tenant:profile");
            Cache::forget("tenant:{$this->id}:profile");

            return true;
        }

        return false;
    }

    /**
     * Check if tenant is in an active state.
     */
    public function isActive(): bool
    {
        return ! $this->isSuspended() && ($this->status === 'active' || $this->status === 'trial' || $this->status === 'trialing');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'plan_id' => 'integer',
            'settings' => 'array',
            'branding' => 'array',
            'business_type_keys' => 'array',
            'terminology' => 'array',
            'onboarding_draft' => 'array',
            'onboarding_completed_at' => 'datetime',
            'onboarding_step' => 'integer',
            'trial_ends_at' => 'datetime',
            'activated_at' => 'datetime',
            'grace_period_ends_at' => 'datetime',
            'suspended_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}
