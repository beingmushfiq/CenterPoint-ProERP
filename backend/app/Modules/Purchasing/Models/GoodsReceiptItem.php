<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ReasonCode;
use App\Models\Unit;
use App\Models\WarehouseLocation;
use App\Modules\Inventory\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $goods_receipt_id
 * @property int|null $purchase_order_item_id
 * @property int $product_id
 * @property int|null $variant_id
 * @property string $ordered_quantity
 * @property string $received_quantity
 * @property string $accepted_quantity
 * @property string $rejected_quantity
 * @property int $unit_id
 * @property string $unit_cost
 * @property string|null $batch_code
 * @property string|null $expiry_date
 * @property int|null $warehouse_location_id
 * @property int|null $stock_movement_id
 * @property int|null $reason_code_id
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read GoodsReceipt|null $goodsReceipt
 * @property-read PurchaseOrderItem|null $purchaseOrderItem
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read WarehouseLocation|null $warehouseLocation
 * @property-read Unit|null $unit
 * @property-read ReasonCode|null $reasonCode
 * @property-read StockMovement|null $movement
 */
final class GoodsReceiptItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'goods_receipt_items';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'goods_receipt_id',
        'purchase_order_item_id',
        'product_id',
        'variant_id',
        'ordered_quantity',
        'received_quantity',
        'accepted_quantity',
        'rejected_quantity',
        'unit_id',
        'unit_cost',
        'batch_code',
        'expiry_date',
        'warehouse_location_id',
        'stock_movement_id',
        'reason_code_id',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'ordered_quantity' => 'decimal:4',
        'received_quantity' => 'decimal:4',
        'accepted_quantity' => 'decimal:4',
        'rejected_quantity' => 'decimal:4',
        'unit_cost' => 'decimal:4',
        'expiry_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class, 'goods_receipt_id');
    }

    /**
     * @return BelongsTo<PurchaseOrderItem, $this>
     */
    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class, 'purchase_order_item_id');
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
     * @return BelongsTo<StockMovement, $this>
     */
    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (GoodsReceiptItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
