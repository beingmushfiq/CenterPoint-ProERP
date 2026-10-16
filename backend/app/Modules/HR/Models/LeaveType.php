<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class LeaveType extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'leave_types';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'is_paid',
        'annual_quota_days',
        'accrual_method',
        'carry_forward_allowed',
        'max_carry_forward_days',
        'requires_attachment',
        'min_notice_days',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_paid' => 'boolean',
        'annual_quota_days' => 'string',
        'carry_forward_allowed' => 'boolean',
        'max_carry_forward_days' => 'string',
        'requires_attachment' => 'boolean',
        'min_notice_days' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<LeaveRequest, $this>
     */
    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'leave_type_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (LeaveType $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
