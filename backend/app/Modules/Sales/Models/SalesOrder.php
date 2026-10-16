<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\HR\Models\Employee;
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
 * @property string $order_number
 * @property string $channel
 * @property int|null $company_id
 * @property int|null $branch_id
 * @property int|null $warehouse_id
 * @property int|null $party_id
 * @property string|null $customer_name
 * @property string|null $customer_phone
 * @property int|null $pos_session_id
 * @property string $order_date
 * @property string|null $required_date
 * @property int|null $price_list_id
 * @property string $currency_code
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $shipping_amount
 * @property string $round_off
 * @property string $total_amount
 * @property string $paid_amount
 * @property string $due_amount
 * @property string $delivery_type
 * @property string $status
 * @property string $payment_status
 * @property int|null $salesperson_id
 * @property string|null $notes
 * @property string|null $internal_notes
 * @property int|null $confirmed_by
 * @property \Illuminate\Support\Carbon|null $confirmed_at
 * @property int|null $cancelled_by
 * @property \Illuminate\Support\Carbon|null $cancelled_at
 * @property int|null $cancellation_reason_id
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $customer
 * @property-read Warehouse|null $warehouse
 * @property-read User|null $creator
 * @property-read User|null $salesperson
 * @property-read Collection<int, SalesOrderItem> $items
 * @property-read Collection<int, Invoice> $invoices
 */
final class SalesOrder extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'sales_orders';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'order_number',
        'channel',
        'company_id',
        'branch_id',
        'warehouse_id',
        'party_id',
        'lead_id',
        'salesman_id',
        'customer_name',
        'customer_phone',
        'pos_session_id',
        'order_date',
        'required_date',
        'price_list_id',
        'currency_code',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'round_off',
        'total_amount',
        'paid_amount',
        'due_amount',
        'delivery_type',
        'status',
        'payment_status',
        'salesperson_id',
        'notes',
        'internal_notes',
        'confirmed_by',
        'confirmed_at',
        'cancelled_by',
        'cancelled_at',
        'cancellation_reason_id',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'order_date' => 'date',
        'required_date' => 'date',
        'subtotal' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'shipping_amount' => 'decimal:4',
        'round_off' => 'decimal:4',
        'total_amount' => 'decimal:4',
        'paid_amount' => 'decimal:4',
        'due_amount' => 'decimal:4',
        'confirmed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Party, $this>
     */
    public function customer(): BelongsTo
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
    public function salesperson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesperson_id');
    }

    /**
     * @return BelongsTo<CrmLead, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(CrmLead::class, 'lead_id');
    }

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function salesman(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'salesman_id');
    }

    /**
     * @return HasMany<SalesOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class, 'sales_order_id');
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'sales_order_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (SalesOrder $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
