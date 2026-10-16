<?php

declare(strict_types=1);

namespace App\Modules\Pos\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $session_number
 * @property int $branch_id
 * @property int $warehouse_id
 * @property int $terminal_id
 * @property int $user_id
 * @property \Illuminate\Support\Carbon $opened_at
 * @property \Illuminate\Support\Carbon|null $closed_at
 * @property string $opening_cash
 * @property string $expected_cash
 * @property string|null $counted_cash
 * @property string|null $cash_variance
 * @property string $card_total
 * @property string $mobile_total
 * @property string $credit_total
 * @property int $sales_count
 * @property string $refund_total
 * @property string $status
 * @property int|null $closed_by
 * @property string|null $notes
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read PosTerminal $terminal
 * @property-read Warehouse $warehouse
 * @property-read User $operator
 * @property-read User|null $closer
 */
final class PosSession extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'pos_sessions';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'session_number',
        'branch_id',
        'warehouse_id',
        'terminal_id',
        'user_id',
        'opened_at',
        'closed_at',
        'opening_cash',
        'expected_cash',
        'counted_cash',
        'cash_variance',
        'card_total',
        'mobile_total',
        'credit_total',
        'sales_count',
        'refund_total',
        'status',
        'closed_by',
        'notes',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'opening_cash' => 'decimal:4',
        'expected_cash' => 'decimal:4',
        'counted_cash' => 'decimal:4',
        'cash_variance' => 'decimal:4',
        'card_total' => 'decimal:4',
        'mobile_total' => 'decimal:4',
        'credit_total' => 'decimal:4',
        'refund_total' => 'decimal:4',
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
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PosSession $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
