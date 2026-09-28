<?php

declare(strict_types=1);

namespace App\Modules\Finance\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Expense extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'expenses';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'expense_number',
        'company_id',
        'branch_id',
        'expense_category_id',
        'expense_date',
        'payee_type',
        'payee_id',
        'payee_name',
        'description',
        'amount',
        'tax_amount',
        'total_amount',
        'payment_method',
        'bank_account_id',
        'reference_number',
        'attachment_id',
        'status',
        'submitted_by',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'paid_at',
        'journal_entry_id',
        'cost_center_code',
        'related_module',
        'related_reference_type',
        'related_reference_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'expense_date' => 'date:Y-m-d',
        'amount' => 'string',
        'tax_amount' => 'string',
        'total_amount' => 'string',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Expense $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<ExpenseCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return HasMany<ExpensePaymentSplit, $this>
     */
    public function splits(): HasMany
    {
        return $this->hasMany(ExpensePaymentSplit::class, 'expense_id');
    }
}
