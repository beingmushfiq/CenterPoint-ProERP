<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Modules\Finance\Models\BankAccount;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $payment_id
 * @property string $method
 * @property string $amount
 * @property int|null $bank_account_id
 * @property string|null $mobile_provider
 * @property string|null $mobile_number
 * @property string|null $transaction_ref
 * @property string|null $cheque_number
 * @property \Illuminate\Support\Carbon|null $cheque_date
 * @property string|null $card_last4
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Payment $payment
 * @property-read BankAccount|null $bankAccount
 */
final class PaymentSplit extends Model
{
    use BelongsToTenant;

    protected $table = 'payment_splits';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'payment_id',
        'method',
        'amount',
        'bank_account_id',
        'mobile_provider',
        'mobile_number',
        'transaction_ref',
        'cheque_number',
        'cheque_date',
        'card_last4',
        'notes',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'amount'      => 'decimal:4',
        'cheque_date' => 'date',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];

    /**
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'payment_id');
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }
}
