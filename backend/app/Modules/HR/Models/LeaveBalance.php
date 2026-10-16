<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class LeaveBalance extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'leave_balances';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_id',
        'leave_type_id',
        'year',
        'opening_days',
        'accrued_days',
        'used_days',
        'carried_forward_days',
        'balance_days',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'year' => 'integer',
        'opening_days' => 'decimal:4',
        'accrued_days' => 'decimal:4',
        'used_days' => 'decimal:4',
        'carried_forward_days' => 'decimal:4',
        'balance_days' => 'decimal:4',
    ];

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (LeaveBalance $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
