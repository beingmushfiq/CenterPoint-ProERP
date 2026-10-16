<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

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
 * @property string $exchange_number
 * @property int|null $original_invoice_id
 * @property int|null $original_sales_order_id
 * @property int|null $party_id
 * @property int $warehouse_id
 * @property int|null $pos_session_id
 * @property \Illuminate\Support\Carbon|string|null $exchange_date
 * @property int $reason_code_id
 * @property string $exchange_type
 * @property string $return_subtotal
 * @property string $replacement_subtotal
 * @property string $difference_amount
 * @property string $difference_settlement
 * @property string $status
 * @property string|null $notes
 * @property int|null $approved_by
 * @property \Illuminate\Support\Carbon|null $approved_at
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $customer
 * @property-read Warehouse $warehouse
 * @property-read ReasonCode $reasonCode
 * @property-read Invoice|null $originalInvoice
 * @property-read SalesOrder|null $originalOrder
 * @property-read User|null $creator
 * @property-read Collection<int, ExchangeReturnItem> $returnItems
 * @property-read Collection<int, ExchangeReplacementItem> $replacementItems
 */
final class Exchange extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'exchanges';

    /** @var list<string> */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'exchange_number',
        'original_invoice_id',
        'original_sales_order_id',
        'party_id',
        'warehouse_id',
        'pos_session_id',
        'exchange_date',
        'reason_code_id',
        'exchange_type',
        'return_subtotal',
        'replacement_subtotal',
        'difference_amount',
        'difference_settlement',
        'status',
        'notes',
        'approved_by',
        'approved_at',
        'created_by',
        'updated_by',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'exchange_date' => 'date',
        'return_subtotal' => 'decimal:4',
        'replacement_subtotal' => 'decimal:4',
        'difference_amount' => 'decimal:4',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /** @return BelongsTo<Party, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'party_id');
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /** @return BelongsTo<ReasonCode, $this> */
    public function reasonCode(): BelongsTo
    {
        return $this->belongsTo(ReasonCode::class, 'reason_code_id');
    }

    /** @return BelongsTo<Invoice, $this> */
    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'original_invoice_id');
    }

    /** @return BelongsTo<SalesOrder, $this> */
    public function originalOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'original_sales_order_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /** @return HasMany<ExchangeReturnItem, $this> */
    public function returnItems(): HasMany
    {
        return $this->hasMany(ExchangeReturnItem::class, 'exchange_id');
    }

    /** @return HasMany<ExchangeReplacementItem, $this> */
    public function replacementItems(): HasMany
    {
        return $this->hasMany(ExchangeReplacementItem::class, 'exchange_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (Exchange $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
