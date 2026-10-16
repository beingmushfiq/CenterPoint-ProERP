<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class SalaryStructure extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'salary_structures';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'description',
        'currency_code',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<SalaryStructureComponent, $this>
     */
    public function components(): HasMany
    {
        return $this->hasMany(SalaryStructureComponent::class, 'salary_structure_id')->orderBy('sort_order');
    }

    /**
     * @return HasMany<Employee, $this>
     */
    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'salary_structure_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (SalaryStructure $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
