<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $tenant_id
 * @property string $alert_type
 * @property string $severity
 * @property string $title
 * @property string|null $description
 * @property string|null $threshold_value
 * @property string|null $actual_value
 * @property string $currency
 * @property string $status
 * @property string $generated_by
 * @property int|null $acknowledged_by
 * @property \Carbon\Carbon|null $acknowledged_at
 * @property \Carbon\Carbon|null $expires_at
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class CashFlowAlert extends Model
{
    use BelongsToTenant;

    protected $table = 'cash_flow_alerts';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'alert_type',
        'severity',
        'title',
        'description',
        'threshold_value',
        'actual_value',
        'currency',
        'status',
        'generated_by',
        'acknowledged_by',
        'acknowledged_at',
        'expires_at',
    ];

    protected $casts = [
        'threshold_value' => 'string',
        'actual_value' => 'string',
        'acknowledged_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function acknowledgedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (CashFlowAlert $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->currency)) {
                $model->currency = 'BDT';
            }
            if (empty($model->status)) {
                $model->status = 'active';
            }
            if (empty($model->severity)) {
                $model->severity = 'warning';
            }
            if (empty($model->generated_by)) {
                $model->generated_by = 'agent';
            }
        });
    }
}
