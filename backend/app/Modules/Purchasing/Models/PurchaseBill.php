<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $bill_number
 * @property string|null $supplier_bill_number
 * @property int $party_id
 * @property int|null $purchase_order_id
 * @property int|null $goods_receipt_id
 * @property string $bill_date
 * @property string|null $due_date
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $other_charges
 * @property string $total_amount
 * @property string $paid_amount
 * @property string $status
 * @property int|null $posted_by
 * @property \Illuminate\Support\Carbon|null $posted_at
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $supplier
 * @property-read PurchaseOrder|null $purchaseOrder
 * @property-read GoodsReceipt|null $goodsReceipt
 * @property-read User|null $creator
 * @property-read Collection<int, PurchaseBillItem> $items
 */
final class PurchaseBill extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'purchase_bills';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'bill_number',
        'supplier_bill_number',
        'party_id',
        'purchase_order_id',
        'goods_receipt_id',
        'bill_date',
        'due_date',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'other_charges',
        'total_amount',
        'paid_amount',
        'status',
        'posted_by',
        'posted_at',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'bill_date' => 'date',
        'due_date' => 'date',
        'subtotal' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'other_charges' => 'decimal:4',
        'total_amount' => 'decimal:4',
        'paid_amount' => 'decimal:4',
        'posted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Party, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'party_id');
    }

    /**
     * @return BelongsTo<PurchaseOrder, $this>
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class, 'goods_receipt_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<PurchaseBillItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseBillItem::class, 'purchase_bill_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PurchaseBill $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
