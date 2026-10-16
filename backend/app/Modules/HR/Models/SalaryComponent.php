<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class SalaryComponent extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'salary_components';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'component_type',
        'is_taxable',
        'affects_gross',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_taxable' => 'boolean',
        'affects_gross' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<SalaryStructureComponent, $this>
     */
    public function structureComponents(): HasMany
    {
        return $this->hasMany(SalaryStructureComponent::class, 'component_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (SalaryComponent $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
