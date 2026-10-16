<?php

declare(strict_types=1);

namespace App\Modules\Finance\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProductCost extends Model
{
    use BelongsToTenant;

    protected $table = 'product_costs';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'product_id',
        'variant_id',
        'warehouse_id',
        'costing_method',
        'material_cost',
        'labour_cost',
        'overhead_cost',
        'total_cost',
        'standard_cost',
        'last_purchase_cost',
        'effective_from',
        'effective_to',
        'source',
        'source_reference_type',
        'source_reference_id',
        'calculated_at',
        'created_by',
    ];

    protected $casts = [
        'material_cost' => 'string',
        'labour_cost' => 'string',
        'overhead_cost' => 'string',
        'total_cost' => 'string',
        'standard_cost' => 'string',
        'last_purchase_cost' => 'string',
        'effective_from' => 'date:Y-m-d',
        'effective_to' => 'date:Y-m-d',
        'calculated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (ProductCost $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
