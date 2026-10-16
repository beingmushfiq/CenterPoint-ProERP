<?php

declare(strict_types=1);

namespace App\Modules\Finance\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class JournalEntry extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'journal_entries';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'company_id',
        'entry_number',
        'entry_date',
        'entry_type',
        'source_module',
        'reference_type',
        'reference_id',
        'narration',
        'total_debit',
        'total_credit',
        'status',
        'posted_by',
        'posted_at',
        'voided_by',
        'voided_at',
        'void_reason',
        'reversal_of_entry_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'entry_date' => 'date:Y-m-d',
        'total_debit' => 'string',
        'total_credit' => 'string',
        'posted_at' => 'datetime',
        'voided_at' => 'datetime',
    ];

    /**
     * @return HasMany<JournalLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class, 'journal_entry_id')->orderBy('sort_order');
    }

    /**
     * @return BelongsTo<JournalEntry, $this>
     */
    public function reversedEntry(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_entry_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (JournalEntry $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
