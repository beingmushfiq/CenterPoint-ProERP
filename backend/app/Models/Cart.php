<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Cart extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use SoftDeletes;

    protected $table = 'carts';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'storefront_id',
        'customer_party_id',
        'session_token',
        'email',
        'phone',
        'item_count',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'total_amount',
        'coupon_code',
        'price_list_id',
        'status',
        'converted_sales_order_id',
        'abandoned_at',
        'expires_at',
        'last_activity_at',
        'ip_address',
        'user_agent',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'item_count' => 'integer',
        'subtotal' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'shipping_amount' => 'decimal:4',
        'total_amount' => 'decimal:4',
        'abandoned_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_activity_at' => 'datetime',
    ];

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'customer_party_id');
    }

    public function recalculateTotals(): void
    {
        $this->loadMissing('items');
        $itemCount = 0;
        $subtotal = '0.0000';
        $discount = '0.0000';
        $tax = '0.0000';

        foreach ($this->items as $item) {
            $itemCount += (int) $item->quantity;
            $subtotal = bcadd($subtotal, (string) $item->line_total, 4);
            $discount = bcadd($discount, (string) $item->line_discount, 4);
            $tax = bcadd($tax, (string) $item->tax_amount, 4);
        }

        $total = bcadd(bcsub($subtotal, $discount, 4), bcadd($tax, (string) $this->shipping_amount, 4), 4);

        $this->item_count = $itemCount;
        $this->subtotal = $subtotal;
        $this->discount_amount = $discount;
        $this->tax_amount = $tax;
        $this->total_amount = bccomp($total, '0.0000', 4) < 0 ? '0.0000' : $total;
        $this->last_activity_at = now();
        $this->save();
    }

    protected static function booted(): void
    {
        static::creating(function (Cart $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->last_activity_at)) {
                $model->last_activity_at = now();
            }
        });
    }
}
