<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $exchange_id
 * @property int $product_id
 * @property int|null $variant_id
 * @property string $quantity
 * @property int $unit_id
 * @property string $unit_price
 * @property string $line_total
 * @property string|null $batch_code
 * @property int|null $stock_movement_id
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Exchange $exchange
 * @property-read Product|null $product
 * @property-read ProductVariant|null $variant
 * @property-read Unit|null $unit
 */
final class ExchangeReplacementItem extends Model
{
    use BelongsToTenant;

    protected $table = 'exchange_replacement_items';

    /** @var list<string> */
    protected $fillable = [
        'tenant_id',
        'exchange_id',
        'product_id',
        'variant_id',
        'quantity',
        'unit_id',
        'unit_price',
        'line_total',
        'batch_code',
        'stock_movement_id',
        'created_by',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:4',
        'line_total' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** @return BelongsTo<Exchange, $this> */
    public function exchange(): BelongsTo
    {
        return $this->belongsTo(Exchange::class, 'exchange_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /** @return BelongsTo<ProductVariant, $this> */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
