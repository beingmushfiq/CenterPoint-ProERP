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
 * @property string $payment_number
 * @property string $direction
 * @property int|null $party_id
 * @property int|null $company_id
 * @property int|null $branch_id
 * @property string $payment_date
 * @property string $method
 * @property int|null $bank_account_id
 * @property string|null $reference_number
 * @property string $amount
 * @property string $allocated_amount
 * @property string $unallocated_amount
 * @property string $currency_code
 * @property string $status
 * @property int|null $received_by
 * @property \Illuminate\Support\Carbon|null $posted_at
 * @property string|null $notes
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Party|null $party
 * @property-read User|null $creator
 * @property-read Collection<int, PaymentAllocation> $allocations
 */
final class Payment extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'payments';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'payment_number',
        'direction',
        'party_id',
        'company_id',
        'branch_id',
        'payment_date',
        'method',
        'bank_account_id',
        'reference_number',
        'amount',
        'allocated_amount',
        'unallocated_amount',
        'currency_code',
        'status',
        'received_by',
        'posted_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'payment_date'      => 'date',
        'amount'            => 'decimal:4',
        'allocated_amount'  => 'decimal:4',
        'unallocated_amount' => 'decimal:4',
        'posted_at'         => 'datetime',
        'created_at'        => 'datetime',
        'updated_at'        => 'datetime',
        'deleted_at'        => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Payment $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<Party, $this>
     */
    public function party(): BelongsTo
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
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class, 'payment_id');
    }

    /**
     * @return HasMany<PaymentSplit, $this>
     */
    public function splits(): HasMany
    {
        return $this->hasMany(PaymentSplit::class, 'payment_id');
    }
}
