<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

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
 * @property CarbonInterface|null $trial_ends_at
 * @property CarbonInterface|null $grace_period_ends_at
 * @property CarbonInterface|null $suspended_at
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
     * Check if tenant is in an active state.
     */
    public function isActive(): bool
    {
        return $this->status === 'active' || $this->status === 'trialing';
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
