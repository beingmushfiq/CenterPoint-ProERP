<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class DeliveryStatusEvent extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $table = 'delivery_status_events';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'delivery_order_id',
        'status',
        'source',
        'courier_event_id',
        'occurred_at',
        'location',
        'latitude',
        'longitude',
        'notes',
        'raw_payload',
        'created_by',
        'created_at',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'created_at' => 'datetime',
        'raw_payload' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * @return BelongsTo<DeliveryOrder, $this>
     */
    public function deliveryOrder(): BelongsTo
    {
        return $this->belongsTo(DeliveryOrder::class, 'delivery_order_id');
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

        static::creating(static function (DeliveryStatusEvent $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }
}
