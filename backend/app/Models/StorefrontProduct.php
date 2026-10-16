<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class StorefrontProduct extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use SoftDeletes;

    protected $table = 'storefront_products';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'storefront_id',
        'product_id',
        'variant_id',
        'display_name_override',
        'description_override',
        'price_override',
        'compare_at_price',
        'is_featured',
        'is_available',
        'sold_out_behaviour',
        'seo_slug',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'price_override' => 'decimal:4',
        'compare_at_price' => 'decimal:4',
        'is_featured' => 'boolean',
        'is_available' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    protected static function booted(): void
    {
        static::creating(function (StorefrontProduct $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
