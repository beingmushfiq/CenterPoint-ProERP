<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Department extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'departments';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'company_id',
        'cost_center_code',
        'parent_id',
        'head_employee_id',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<Employee, $this>
     */
    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'department_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Department $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
