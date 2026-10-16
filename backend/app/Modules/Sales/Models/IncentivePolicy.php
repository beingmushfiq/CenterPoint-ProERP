<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class IncentivePolicy extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'incentive_policies';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'name',
        'code',
        'description',
        'basis',
        'min_achievement_pct',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'min_achievement_pct' => 'decimal:2',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function rules(): HasMany
    {
        return $this->hasMany(IncentivePolicyRule::class, 'incentive_policy_id');
    }

    public function calculations(): HasMany
    {
        return $this->hasMany(IncentiveCalculation::class, 'incentive_policy_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (IncentivePolicy $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
