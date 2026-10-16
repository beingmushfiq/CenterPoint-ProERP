<?php

declare(strict_types=1);

namespace App\Modules\Finance\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class BankAccount extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'bank_accounts';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'company_id',
        'code',
        'name',
        'account_type',
        'account_name',
        'account_number',
        'bank_name',
        'branch_name',
        'currency',
        'currency_code',
        'routing_number',
        'swift_code',
        'chart_of_account_id',
        'opening_balance',
        'current_balance',
        'is_default_for_pos',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'opening_balance' => 'string',
        'current_balance' => 'string',
        'is_active' => 'boolean',
        'is_default_for_pos' => 'boolean',
    ];

    public function setAccountNameAttribute(?string $value): void
    {
        if ($value !== null) {
            $this->attributes['name'] = $value;
        }
    }

    public function getAccountNameAttribute(): ?string
    {
        return $this->attributes['name'] ?? null;
    }

    public function setCurrencyCodeAttribute(?string $value): void
    {
        if ($value !== null) {
            $this->attributes['currency'] = $value;
        }
    }

    public function getCurrencyCodeAttribute(): ?string
    {
        return $this->attributes['currency'] ?? null;
    }

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'chart_of_account_id');
    }

    /**
     * @return HasMany<BankTransaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class, 'bank_account_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (BankAccount $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->code)) {
                $model->code = 'BA-'.strtoupper(Str::random(6));
            }
            if (empty($model->account_type)) {
                $model->account_type = 'bank';
            }
            if (empty($model->name) && ! empty($model->account_name)) {
                $model->name = $model->account_name;
            }
        });
    }
}
