<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Employee extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'employees';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_code',
        'user_id',
        'company_id',
        'branch_id',
        'factory_id',
        'production_line_id',
        'department_id',
        'designation_id',
        'reports_to_employee_id',
        'first_name',
        'last_name',
        'display_name',
        'gender',
        'date_of_birth',
        'national_id',
        'phone',
        'email',
        'address_line1',
        'address_line2',
        'city',
        'photo_path',
        'date_of_joining',
        'date_of_leaving',
        'employment_type',
        'employment_status',
        'default_shift_id',
        'salary_structure_id',
        'bank_name',
        'bank_account_number',
        'mobile_wallet_number',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date:Y-m-d',
        'date_of_joining' => 'date:Y-m-d',
        'date_of_leaving' => 'date:Y-m-d',
        'is_active' => 'boolean',
    ];

    /**
     * @return BelongsTo<Department, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * @return BelongsTo<Designation, $this>
     */
    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class, 'designation_id');
    }

    /**
     * @return BelongsTo<Shift, $this>
     */
    public function defaultShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'default_shift_id');
    }

    /**
     * @return BelongsTo<SalaryStructure, $this>
     */
    public function salaryStructure(): BelongsTo
    {
        return $this->belongsTo(SalaryStructure::class, 'salary_structure_id');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return HasMany<Attendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'employee_id');
    }

    /**
     * @return HasMany<Payslip, $this>
     */
    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'employee_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Employee $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->display_name)) {
                $model->display_name = trim($model->first_name.' '.($model->last_name ?? ''));
            }
        });
    }
}
