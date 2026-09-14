<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int|null $product_id
 * @property string $name
 * @property string $type
 * @property int|null $unit_id
 * @property string|null $min_value
 * @property string|null $max_value
 * @property array<string, mixed>|null $options
 * @property int $is_mandatory
 * @property int $sort_order
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Tenant $tenant
 * @property-read Product|null $product
 * @property-read Unit|null $unit
 */
final class QcParameter extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'qc_parameters';

    protected $fillable = [
        'uuid',
        'product_id',
        'name',
        'type',
        'unit_id',
        'min_value',
        'max_value',
        'options',
        'is_mandatory',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /**
     * @return HasMany<QcInspectionResult, $this>
     */
    public function results(): HasMany
    {
        return $this->hasMany(QcInspectionResult::class, 'qc_parameter_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'min_value' => 'string',
            'max_value' => 'string',
            'options' => 'array',
            'is_mandatory' => 'integer',
            'sort_order' => 'integer',
        ];
    }
}
