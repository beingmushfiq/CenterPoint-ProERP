<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
use App\Models\User;
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
 * @property string $invoice_number
 * @property int|null $sales_order_id
 * @property int|null $company_id
 * @property int|null $branch_id
 * @property int|null $party_id
 * @property \Illuminate\Support\Carbon $invoice_date
 * @property \Illuminate\Support\Carbon|null $due_date
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $shipping_amount
 * @property string $round_off
 * @property string $total_amount
 * @property string $paid_amount
 * @property string $status
 * @property int|null $invoice_template_id
 * @property int $printed_count
 * @property int|null $posted_by
 * @property \Illuminate\Support\Carbon|null $posted_at
 * @property int|null $voided_by
 * @property \Illuminate\Support\Carbon|null $voided_at
 * @property string|null $void_reason
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read SalesOrder|null $salesOrder
 * @property-read Party|null $customer
 * @property-read User|null $creator
 * @property-read Collection<int, InvoiceItem> $items
 * @property-read Collection<int, Payment> $payments
 */
final class Invoice extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'invoices';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'invoice_number',
        'sales_order_id',
        'company_id',
        'branch_id',
        'party_id',
        'invoice_date',
        'due_date',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'round_off',
        'total_amount',
        'paid_amount',
        'status',
        'invoice_template_id',
        'printed_count',
        'posted_by',
        'posted_at',
        'voided_by',
        'voided_at',
        'void_reason',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'invoice_date'    => 'date',
        'due_date'        => 'date',
        'subtotal'        => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'tax_amount'      => 'decimal:4',
        'shipping_amount' => 'decimal:4',
        'round_off'       => 'decimal:4',
        'total_amount'    => 'decimal:4',
        'paid_amount'     => 'decimal:4',
        'posted_at'       => 'datetime',
        'voided_at'       => 'datetime',
        'created_at'      => 'datetime',
        'updated_at'      => 'datetime',
        'deleted_at'      => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Invoice $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<SalesOrder, $this>
     */
    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    /**
     * @return BelongsTo<Party, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'party_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<InvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id');
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class, 'invoice_id');
    }

    /**
     * @return HasMany<Exchange, $this>
     */
    public function exchanges(): HasMany
    {
        return $this->hasMany(Exchange::class, 'original_invoice_id');
    }
}
