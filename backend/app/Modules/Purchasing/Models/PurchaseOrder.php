<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
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
 * @property string $po_number
 * @property int $party_id
 * @property int|null $company_id
 * @property int|null $branch_id
 * @property int|null $warehouse_id
 * @property int|null $purchase_requisition_id
 * @property string $order_date
 * @property string|null $expected_date
 * @property string $currency_code
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $shipping_amount
 * @property string $total_amount
 * @property string $received_value
 * @property string $billed_value
 * @property string|null $payment_terms
 * @property string $status
 * @property int|null $approved_by
 * @property \Illuminate\Support\Carbon|null $approved_at
 * @property string|null $notes
 * @property string|null $terms
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $supplier
 * @property-read Warehouse|null $warehouse
 * @property-read User|null $creator
 * @property-read User|null $approver
 * @property-read Collection<int, PurchaseOrderItem> $items
 */
final class PurchaseOrder extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'purchase_orders';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'po_number',
        'party_id',
        'company_id',
        'branch_id',
        'warehouse_id',
        'purchase_requisition_id',
        'order_date',
        'expected_date',
        'currency_code',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'total_amount',
        'received_value',
        'billed_value',
        'payment_terms',
        'status',
        'approved_by',
        'approved_at',
        'notes',
        'terms',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'order_date' => 'date',
        'expected_date' => 'date',
        'subtotal' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'shipping_amount' => 'decimal:4',
        'total_amount' => 'decimal:4',
        'received_value' => 'decimal:4',
        'billed_value' => 'decimal:4',
        'approved_at' => 'datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return HasMany<PurchaseOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class, 'purchase_order_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PurchaseOrder $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
