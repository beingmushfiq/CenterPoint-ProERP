<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int $invoice_id
 * @property int|null $sales_order_item_id
 * @property int|null $product_id
 * @property string|null $description
 * @property string $quantity
 * @property int|null $unit_id
 * @property string $unit_price
 * @property string $discount_amount
 * @property int|null $tax_profile_id
 * @property string $tax_amount
 * @property string $line_total
 * @property int $sort_order
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Invoice $invoice
 * @property-read Product|null $product
 */
final class InvoiceItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'invoice_items';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'invoice_id',
        'sales_order_item_id',
        'product_id',
        'description',
        'quantity',
        'unit_id',
        'unit_price',
        'discount_amount',
        'tax_profile_id',
        'tax_amount',
        'line_total',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'line_total' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (InvoiceItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
