<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class SalesmanTarget extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'salesman_targets';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_id',
        'period_month',
        'target_name',
        'target_amount',
        'achieved_amount',
        'achievement_percentage',
        'total_leads',
        'valid_leads',
        'fake_leads',
        'converted_leads',
        'profit_generated',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'target_amount' => 'decimal:4',
        'achieved_amount' => 'decimal:4',
        'achievement_percentage' => 'decimal:2',
        'profit_generated' => 'decimal:4',
        'total_leads' => 'integer',
        'valid_leads' => 'integer',
        'fake_leads' => 'integer',
        'converted_leads' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function incentiveCalculations(): HasMany
    {
        return $this->hasMany(IncentiveCalculation::class, 'salesman_target_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (SalesmanTarget $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
