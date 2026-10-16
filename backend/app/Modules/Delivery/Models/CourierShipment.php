<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CourierShipment extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'courier_shipments';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'delivery_order_id',
        'courier_provider_id',
        'consignment_id',
        'awb_number',
        'label_path',
        'tracking_url',
        'status',
        'provider_status_raw',
        'charge_amount',
        'cod_amount',
        'requested_at',
        'confirmed_at',
        'last_synced_at',
        'request_payload',
        'response_payload',
        'error_message',
        'retry_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'charge_amount' => 'string',
        'cod_amount' => 'string',
        'requested_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'request_payload' => 'array',
        'response_payload' => 'array',
        'retry_count' => 'integer',
    ];

    /**
     * @return BelongsTo<DeliveryOrder, $this>
     */
    public function deliveryOrder(): BelongsTo
    {
        return $this->belongsTo(DeliveryOrder::class, 'delivery_order_id');
    }

    /**
     * @return BelongsTo<CourierProvider, $this>
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(CourierProvider::class, 'courier_provider_id');
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

        static::creating(static function (CourierShipment $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
