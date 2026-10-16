<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ReasonCode;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $movement_number
 * @property int $product_id
 * @property int|null $variant_id
 * @property int $warehouse_id
 * @property int|null $warehouse_location_id
 * @property string|null $batch_code
 * @property string|null $serial_number
 * @property string|null $expiry_date
 * @property string $movement_type
 * @property string $direction
 * @property string $stock_state
 * @property string $quantity
 * @property int $unit_id
 * @property string $unit_cost
 * @property string $total_cost
 * @property string $balance_after
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property int|null $related_movement_id
 * @property int|null $reason_code_id
 * @property \Illuminate\Support\Carbon|null $moved_at
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read Warehouse|null $warehouse
 * @property-read WarehouseLocation|null $warehouseLocation
 * @property-read Unit|null $unit
 * @property-read ReasonCode|null $reasonCode
 * @property-read User|null $creator
 */
final class StockMovement extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $table = 'stock_movements';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'movement_number',
        'product_id',
        'variant_id',
        'warehouse_id',
        'warehouse_location_id',
        'batch_code',
        'serial_number',
        'expiry_date',
        'movement_type',
        'direction',
        'stock_state',
        'quantity',
        'unit_id',
        'unit_cost',
        'total_cost',
        'balance_after',
        'reference_type',
        'reference_id',
        'related_movement_id',
        'reason_code_id',
        'moved_at',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'moved_at' => 'datetime',
        'created_at' => 'datetime',
        'quantity' => 'decimal:4',
        'unit_cost' => 'decimal:4',
        'total_cost' => 'decimal:4',
        'balance_after' => 'decimal:4',
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
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /**
     * @return BelongsTo<ReasonCode, $this>
     */
    public function reasonCode(): BelongsTo
    {
        return $this->belongsTo(ReasonCode::class, 'reason_code_id');
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

        self::creating(static function (StockMovement $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
