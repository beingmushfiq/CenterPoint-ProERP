<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
use App\Models\ReasonCode;
use App\Models\User;
use App\Models\Warehouse;
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
 * @property string $return_number
 * @property int $party_id
 * @property int|null $goods_receipt_id
 * @property int $warehouse_id
 * @property string $return_date
 * @property int $reason_code_id
 * @property string $subtotal
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $status
 * @property string|null $debit_note_number
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $supplier
 * @property-read Warehouse|null $warehouse
 * @property-read GoodsReceipt|null $goodsReceipt
 * @property-read ReasonCode|null $reasonCode
 * @property-read User|null $creator
 * @property-read Collection<int, PurchaseReturnItem> $items
 */
final class PurchaseReturn extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'purchase_returns';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'return_number',
        'party_id',
        'goods_receipt_id',
        'warehouse_id',
        'return_date',
        'reason_code_id',
        'subtotal',
        'tax_amount',
        'total_amount',
        'status',
        'debit_note_number',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'return_date' => 'date',
        'subtotal' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'total_amount' => 'decimal:4',
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
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class, 'goods_receipt_id');
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

    /**
     * @return HasMany<PurchaseReturnItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseReturnItem::class, 'purchase_return_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PurchaseReturn $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
