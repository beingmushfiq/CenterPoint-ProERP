<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\WarehouseLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $stock_count_id
 * @property int $product_id
 * @property int|null $variant_id
 * @property int|null $warehouse_location_id
 * @property string|null $batch_code
 * @property string $system_quantity
 * @property string|null $counted_quantity
 * @property string|null $variance_quantity
 * @property string|null $recount_quantity
 * @property string $status
 * @property int|null $counted_by
 * @property \Illuminate\Support\Carbon|null $counted_at
 * @property string|null $notes
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read WarehouseLocation|null $warehouseLocation
 * @property-read StockCount|null $stockCount
 */
final class StockCountItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'stock_count_items';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'stock_count_id',
        'product_id',
        'variant_id',
        'warehouse_location_id',
        'batch_code',
        'system_quantity',
        'counted_quantity',
        'variance_quantity',
        'recount_quantity',
        'status',
        'counted_by',
        'counted_at',
        'notes',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'system_quantity' => 'decimal:4',
        'counted_quantity' => 'decimal:4',
        'variance_quantity' => 'decimal:4',
        'recount_quantity' => 'decimal:4',
        'counted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<StockCount, $this>
     */
    public function stockCount(): BelongsTo
    {
        return $this->belongsTo(StockCount::class, 'stock_count_id');
    }

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
     * @return BelongsTo<WarehouseLocation, $this>
     */
    public function warehouseLocation(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class, 'warehouse_location_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (StockCountItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
