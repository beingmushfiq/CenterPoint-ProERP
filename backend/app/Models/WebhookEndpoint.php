<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WebhookEndpoint extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'webhook_endpoints';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'url',
        'secret',
        'events',
        'is_active',
        'last_success_at',
        'last_failure_at',
        'consecutive_failures',
        'disabled_reason',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'events' => 'array',
        'is_active' => 'boolean',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
        'consecutive_failures' => 'integer',
        'created_by' => 'integer',
        'updated_by' => 'integer',
    ];

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class, 'webhook_endpoint_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function subscribesTo(string $eventType): bool
    {
        $events = $this->events ?? [];
        if (in_array('*', $events, true)) {
            return true;
        }

        return in_array($eventType, $events, true);
    }
}
