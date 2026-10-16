<?php

declare(strict_types=1);

namespace App\Modules\Pos\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
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
 * @property int $branch_id
 * @property string $code
 * @property string $name
 * @property int|null $default_warehouse_id
 * @property array<string, mixed>|null $printer_config
 * @property bool $is_active
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Warehouse|null $defaultWarehouse
 * @property-read Collection<int, PosSession> $sessions
 */
final class PosTerminal extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'pos_terminals';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'branch_id',
        'code',
        'name',
        'default_warehouse_id',
        'printer_config',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'printer_config' => 'array',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function defaultWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'default_warehouse_id');
    }

    /**
     * @return HasMany<PosSession, $this>
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(PosSession::class, 'terminal_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (PosTerminal $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
