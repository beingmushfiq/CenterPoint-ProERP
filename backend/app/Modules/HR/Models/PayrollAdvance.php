<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PayrollAdvance extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'payroll_advances';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_id',
        'advance_number',
        'amount',
        'issued_on',
        'recovery_start_period_id',
        'installment_amount',
        'recovered_amount',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'amount' => 'decimal:4',
        'installment_amount' => 'decimal:4',
        'recovered_amount' => 'decimal:4',
        'issued_on' => 'date',
    ];

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * @return BelongsTo<PayrollPeriod, $this>
     */
    public function recoveryStartPeriod(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'recovery_start_period_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (PayrollAdvance $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
