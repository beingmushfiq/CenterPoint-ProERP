<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\Delivery\Contracts\CourierProviderInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use RuntimeException;

class CourierProvider extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'courier_providers';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'adapter_class',
        'is_active',
        'credentials',
        'capabilities',
        'webhook_secret',
        'default_charge',
        'settings',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'credentials' => 'encrypted:array',
        'capabilities' => 'array',
        'settings' => 'array',
        'default_charge' => 'string',
    ];

    public function getAdapterInstance(): CourierProviderInterface
    {
        /** @var class-string<CourierProviderInterface> $class */
        $class = $this->adapter_class;
        if (! class_exists($class)) {
            throw new RuntimeException("Courier adapter class {$class} not found.");
        }

        $adapter = new $class;
        $adapter->setConfig(
            credentials: (array) ($this->credentials ?? []),
            settings: (array) ($this->settings ?? [])
        );

        return $adapter;
    }

    /**
     * @return HasMany<CourierShipment, $this>
     */
    public function shipments(): HasMany
    {
        return $this->hasMany(CourierShipment::class, 'courier_provider_id');
    }

    /**
     * @return HasMany<CourierWebhookEvent, $this>
     */
    public function webhookEvents(): HasMany
    {
        return $this->hasMany(CourierWebhookEvent::class, 'courier_provider_id');
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

        static::creating(static function (CourierProvider $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
