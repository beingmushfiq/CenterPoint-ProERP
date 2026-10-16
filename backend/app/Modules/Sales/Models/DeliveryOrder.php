<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

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
 * @property string $delivery_number
 * @property int $sales_order_id
 * @property int|null $invoice_id
 * @property int|null $party_id
 * @property int $warehouse_id
 * @property int|null $delivery_address_id
 * @property string $recipient_name
 * @property string $recipient_phone
 * @property string $delivery_type
 * @property int|null $courier_provider_id
 * @property int|null $courier_shipment_id
 * @property int|null $run_sheet_id
 * @property int|null $rider_id
 * @property string|null $scheduled_date
 * @property \Illuminate\Support\Carbon|null $delivered_at
 * @property string $status
 * @property string $cod_amount
 * @property string $cod_collected_amount
 * @property string $cod_status
 * @property string $delivery_charge
 * @property string|null $weight
 * @property int $package_count
 * @property string|null $special_instructions
 * @property int $attempt_count
 * @property int|null $failure_reason_id
 * @property string|null $pod_signature_path
 * @property string|null $pod_photo_path
 * @property string|null $pod_received_by
 * @property int|null $stock_movement_id
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read SalesOrder $salesOrder
 * @property-read Warehouse $warehouse
 * @property-read Party|null $party
 * @property-read User|null $creator
 * @property-read Collection<int, DeliveryOrderItem> $items
 */
final class DeliveryOrder extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'delivery_orders';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'delivery_number',
        'sales_order_id',
        'invoice_id',
        'party_id',
        'warehouse_id',
        'delivery_address_id',
        'recipient_name',
        'recipient_phone',
        'delivery_type',
        'courier_provider_id',
        'courier_shipment_id',
        'run_sheet_id',
        'rider_id',
        'scheduled_date',
        'delivered_at',
        'status',
        'cod_amount',
        'cod_collected_amount',
        'cod_status',
        'delivery_charge',
        'weight',
        'package_count',
        'special_instructions',
        'attempt_count',
        'failure_reason_id',
        'pod_signature_path',
        'pod_photo_path',
        'pod_received_by',
        'stock_movement_id',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'scheduled_date' => 'date',
        'delivered_at' => 'datetime',
        'cod_amount' => 'decimal:4',
        'cod_collected_amount' => 'decimal:4',
        'delivery_charge' => 'decimal:4',
        'weight' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<SalesOrder, $this>
     */
    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /**
     * @return BelongsTo<Party, $this>
     */
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'party_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<DeliveryOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(DeliveryOrderItem::class, 'delivery_order_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (DeliveryOrder $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
