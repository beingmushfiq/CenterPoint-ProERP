<?php

declare(strict_types=1);

namespace App\Modules\Assets\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Modules\Finance\Models\JournalEntry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class AssetDepreciationEntry extends Model
{
    use BelongsToTenant;

    protected $table = 'asset_depreciation_entries';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'asset_id',
        'period_year',
        'period_month',
        'opening_book_value',
        'depreciation_amount',
        'closing_book_value',
        'journal_entry_id',
        'posted_at',
        'created_by',
    ];

    protected $casts = [
        'period_year' => 'integer',
        'period_month' => 'integer',
        'opening_book_value' => 'string',
        'depreciation_amount' => 'string',
        'closing_book_value' => 'string',
        'posted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Asset, $this>
     */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    /**
     * @return BelongsTo<JournalEntry, $this>
     */
    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (AssetDepreciationEntry $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
