<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class SalaryStructureComponent extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'salary_structure_components';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'salary_structure_id',
        'component_id',
        'calculation_type',
        'value',
        'base_component_id',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'string',
        'sort_order' => 'integer',
    ];

    /**
     * @return BelongsTo<SalaryStructure, $this>
     */
    public function salaryStructure(): BelongsTo
    {
        return $this->belongsTo(SalaryStructure::class, 'salary_structure_id');
    }

    /**
     * @return BelongsTo<SalaryComponent, $this>
     */
    public function component(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'component_id');
    }

    /**
     * @return BelongsTo<SalaryComponent, $this>
     */
    public function baseComponent(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'base_component_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (SalaryStructureComponent $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
