<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
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
 * @property int $product_id
 * @property int|null $variant_id
 * @property int $warehouse_id
 * @property string $quantity
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string $status
 * @property string|null $expires_at
 * @property int|null $created_by
 * @property string|null $created_at
 * @property string|null $updated_at
 */
final class StockReservation extends Model
{
    use BelongsToTenant, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'product_id',
        'variant_id',
        'warehouse_id',
        'quantity',
        'reference_type',
        'reference_id',
        'status',
        'expires_at',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'tenant_id' => 'integer',
        'product_id' => 'integer',
        'variant_id' => 'integer',
        'warehouse_id' => 'integer',
        'quantity' => 'string',
        'reference_id' => 'integer',
        'expires_at' => 'datetime',
        'created_by' => 'integer',
    ];

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function booted(): void
    {
        self::creating(function (self $res): void {
            if (empty($res->uuid)) {
                $res->uuid = (string) Str::uuid();
            }
        });
    }
}
