<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $product_id
 * @property int|null $variant_id
 * @property int $warehouse_id
 * @property int|null $warehouse_location_id
 * @property string|null $batch_code
 * @property string $stock_state
 * @property string $quantity
 * @property string $reserved_quantity
 * @property string $available_quantity
 * @property string $average_cost
 * @property string $total_value
 * @property int|null $last_movement_id
 * @property \Illuminate\Support\Carbon|null $last_movement_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read Warehouse|null $warehouse
 * @property-read WarehouseLocation|null $warehouseLocation
 * @property-read StockMovement|null $lastMovement
 */
final class StockBalance extends Model
{
    use BelongsToTenant;

    protected $table = 'stock_balances';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'product_id',
        'variant_id',
        'warehouse_id',
        'warehouse_location_id',
        'batch_code',
        'stock_state',
        'quantity',
        'reserved_quantity',
        'average_cost',
        'total_value',
        'last_movement_id',
        'last_movement_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'decimal:4',
        'reserved_quantity' => 'decimal:4',
        'average_cost' => 'decimal:4',
        'total_value' => 'decimal:4',
        'last_movement_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
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
     * @return BelongsTo<WarehouseLocation, $this>
     */
    public function warehouseLocation(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class, 'warehouse_location_id');
    }

    /**
     * @return BelongsTo<StockMovement, $this>
     */
    public function lastMovement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'last_movement_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (StockBalance $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
