<?php

declare(strict_types=1);

namespace App\Modules\Pos\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $terminal_id
 * @property int $user_id
 * @property string $idempotency_key
 * @property array<string, mixed> $payload
 * @property \Illuminate\Support\Carbon $client_created_at
 * @property \Illuminate\Support\Carbon|null $synced_at
 * @property string $status
 * @property string|null $rejection_reason
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read PosTerminal $terminal
 * @property-read User $user
 */
final class PosOfflineQueue extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'pos_offline_queue';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'terminal_id',
        'user_id',
        'idempotency_key',
        'payload',
        'client_created_at',
        'synced_at',
        'status',
        'rejection_reason',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'payload' => 'array',
        'client_created_at' => 'datetime',
        'synced_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<PosTerminal, $this>
     */
    public function terminal(): BelongsTo
    {
        return $this->belongsTo(PosTerminal::class, 'terminal_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PosOfflineQueue $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
