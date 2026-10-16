<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class IncentiveCalculation extends Model
{
    use BelongsToTenant;

    protected $table = 'incentive_calculations';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_id',
        'salesman_target_id',
        'incentive_policy_id',
        'period_month',
        'target_amount',
        'achieved_amount',
        'achievement_pct',
        'calculated_amount',
        'approved_amount',
        'status',
        'approved_by',
        'approved_at',
        'notes',
    ];

    protected $casts = [
        'target_amount' => 'decimal:4',
        'achieved_amount' => 'decimal:4',
        'achievement_pct' => 'decimal:2',
        'calculated_amount' => 'decimal:4',
        'approved_amount' => 'decimal:4',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(SalesmanTarget::class, 'salesman_target_id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(IncentivePolicy::class, 'incentive_policy_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (IncentiveCalculation $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
