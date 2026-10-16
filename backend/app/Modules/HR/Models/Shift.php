<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Shift extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'shifts';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'start_time',
        'end_time',
        'crosses_midnight',
        'break_minutes',
        'grace_in_minutes',
        'grace_out_minutes',
        'half_day_threshold_minutes',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'crosses_midnight' => 'boolean',
        'break_minutes' => 'integer',
        'grace_in_minutes' => 'integer',
        'grace_out_minutes' => 'integer',
        'half_day_threshold_minutes' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<Employee, $this>
     */
    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'default_shift_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Shift $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
