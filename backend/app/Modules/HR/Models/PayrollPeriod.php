<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PayrollPeriod extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'payroll_periods';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'company_id',
        'period_code',
        'pay_frequency',
        'period_start',
        'period_end',
        'payment_date',
        'status',
        'total_gross',
        'total_deductions',
        'total_net',
        'employee_count',
        'calculated_by',
        'calculated_at',
        'approved_by',
        'approved_at',
        'locked_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'payment_date' => 'date:Y-m-d',
        'total_gross' => 'string',
        'total_deductions' => 'string',
        'total_net' => 'string',
        'employee_count' => 'integer',
        'calculated_at' => 'datetime',
        'approved_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    /**
     * @return HasMany<Payslip, $this>
     */
    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'payroll_period_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isLocked(): bool
    {
        return $this->status === 'closed' || $this->locked_at !== null;
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (PayrollPeriod $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
