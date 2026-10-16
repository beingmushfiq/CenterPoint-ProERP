<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
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
 * @property string $count_number
 * @property int $warehouse_id
 * @property string $count_date
 * @property string $type
 * @property string $status
 * @property int $freeze_stock
 * @property int|null $counted_by
 * @property int|null $reconciled_by
 * @property \Illuminate\Support\Carbon|null $reconciled_at
 * @property int|null $stock_adjustment_id
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Warehouse|null $warehouse
 * @property-read User|null $creator
 * @property-read User|null $reconciler
 * @property-read Collection<int, StockCountItem> $items
 */
final class StockCount extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'stock_counts';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'count_number',
        'warehouse_id',
        'count_date',
        'type',
        'status',
        'freeze_stock',
        'counted_by',
        'reconciled_by',
        'reconciled_at',
        'stock_adjustment_id',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'count_date' => 'date',
        'freeze_stock' => 'integer',
        'reconciled_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

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
    public function reconciler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }

    /**
     * @return HasMany<StockCountItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(StockCountItem::class, 'stock_count_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (StockCount $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
