<?php

declare(strict_types=1);

namespace App\Modules\Assets\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class AssetCategory extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'asset_categories';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'parent_id',
        'default_depreciation_method',
        'default_useful_life_months',
        'default_salvage_percentage',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'default_useful_life_months' => 'integer',
        'default_salvage_percentage' => 'string',
        'is_active' => 'boolean',
    ];

    /**
     * @return BelongsTo<AssetCategory, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * @return HasMany<Asset, $this>
     */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'asset_category_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (AssetCategory $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
