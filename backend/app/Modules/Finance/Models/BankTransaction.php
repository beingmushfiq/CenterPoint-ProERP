<?php

declare(strict_types=1);

namespace App\Modules\Finance\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class BankTransaction extends Model
{
    use BelongsToTenant;

    protected $table = 'bank_transactions';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'bank_account_id',
        'transaction_date',
        'direction',
        'transaction_type',
        'amount',
        'running_balance',
        'balance_after',
        'reference_type',
        'reference_id',
        'reference_number',
        'related_transaction_id',
        'journal_entry_id',
        'description',
        'cleared_at',
        'reconciliation_status',
        'reconciled',
        'reconciled_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'transaction_date' => 'date:Y-m-d',
        'amount' => 'string',
        'running_balance' => 'string',
        'cleared_at' => 'datetime',
        'reconciled_at' => 'datetime',
    ];

    public function setBalanceAfterAttribute($value): void
    {
        $this->attributes['running_balance'] = $value !== null ? (string) $value : '0.0000';
    }

    public function getBalanceAfterAttribute(): ?string
    {
        return isset($this->attributes['running_balance']) ? (string) $this->attributes['running_balance'] : null;
    }

    public function setReconciledAttribute($value): void
    {
        $this->attributes['reconciliation_status'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'reconciled' : 'unreconciled';
    }

    public function getReconciledAttribute(): bool
    {
        return ($this->attributes['reconciliation_status'] ?? '') === 'reconciled';
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (BankTransaction $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->direction)) {
                $model->direction = in_array($model->transaction_type, ['withdrawal', 'payment', 'expense', 'transfer_out']) ? 'out' : 'in';
            }
            if (!isset($model->attributes['running_balance'])) {
                $model->attributes['running_balance'] = '0.0000';
            }
            if (empty($model->reconciliation_status)) {
                $model->reconciliation_status = 'unreconciled';
            }
        });
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    /**
     * @return BelongsTo<JournalEntry, $this>
     */
    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
