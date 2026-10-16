<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $stock_transfer_id
 * @property int $product_id
 * @property int|null $variant_id
 * @property string|null $batch_code
 * @property string $sent_quantity
 * @property string|null $received_quantity
 * @property string|null $damaged_quantity
 * @property int $unit_id
 * @property int|null $out_movement_id
 * @property int|null $in_movement_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read Unit|null $unit
 * @property-read StockTransfer|null $transfer
 * @property-read StockMovement|null $outMovement
 * @property-read StockMovement|null $inMovement
 */
final class StockTransferItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'stock_transfer_items';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'stock_transfer_id',
        'product_id',
        'variant_id',
        'batch_code',
        'sent_quantity',
        'received_quantity',
        'damaged_quantity',
        'unit_id',
        'out_movement_id',
        'in_movement_id',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'sent_quantity' => 'decimal:4',
        'received_quantity' => 'decimal:4',
        'damaged_quantity' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<StockTransfer, $this>
     */
    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
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
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /**
     * @return BelongsTo<StockMovement, $this>
     */
    public function outMovement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'out_movement_id');
    }

    /**
     * @return BelongsTo<StockMovement, $this>
     */
    public function inMovement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'in_movement_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (StockTransferItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
