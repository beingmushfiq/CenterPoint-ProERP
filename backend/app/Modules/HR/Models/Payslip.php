<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Payslip extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'payslips';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'payroll_period_id',
        'employee_id',
        'payslip_number',
        'gross_amount',
        'total_earnings',
        'total_deductions',
        'net_amount',
        'paid_days',
        'absent_days',
        'leave_days',
        'overtime_minutes',
        'produced_quantity',
        'payment_method',
        'payment_status',
        'paid_at',
        'payment_reference',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'gross_amount' => 'string',
        'total_earnings' => 'string',
        'total_deductions' => 'string',
        'net_amount' => 'string',
        'paid_days' => 'string',
        'absent_days' => 'string',
        'leave_days' => 'string',
        'overtime_minutes' => 'integer',
        'produced_quantity' => 'string',
        'paid_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<PayrollPeriod, $this>
     */
    public function payrollPeriod(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * @return HasMany<PayslipItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PayslipItem::class, 'payslip_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Payslip $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
