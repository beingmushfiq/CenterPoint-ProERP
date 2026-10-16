<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $purchase_bill_id
 * @property int|null $goods_receipt_item_id
 * @property int|null $product_id
 * @property string|null $description
 * @property string $quantity
 * @property int|null $unit_id
 * @property string $unit_price
 * @property int|null $tax_profile_id
 * @property string $tax_amount
 * @property string $line_total
 * @property int|null $expense_account_id
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read PurchaseBill|null $bill
 * @property-read GoodsReceiptItem|null $goodsReceiptItem
 * @property-read Product|null $product
 * @property-read TaxProfile|null $taxProfile
 * @property-read Unit|null $unit
 */
final class PurchaseBillItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'purchase_bill_items';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'purchase_bill_id',
        'goods_receipt_item_id',
        'product_id',
        'description',
        'quantity',
        'unit_id',
        'unit_price',
        'tax_profile_id',
        'tax_amount',
        'line_total',
        'expense_account_id',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'line_total' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<PurchaseBill, $this>
     */
    public function bill(): BelongsTo
    {
        return $this->belongsTo(PurchaseBill::class, 'purchase_bill_id');
    }

    /**
     * @return BelongsTo<GoodsReceiptItem, $this>
     */
    public function goodsReceiptItem(): BelongsTo
    {
        return $this->belongsTo(GoodsReceiptItem::class, 'goods_receipt_item_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * @return BelongsTo<TaxProfile, $this>
     */
    public function taxProfile(): BelongsTo
    {
        return $this->belongsTo(TaxProfile::class, 'tax_profile_id');
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PurchaseBillItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
