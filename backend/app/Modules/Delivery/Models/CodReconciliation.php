<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CodReconciliation extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'cod_reconciliations';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'reconciliation_number',
        'source_type',
        'source_id',
        'period_start',
        'period_end',
        'expected_amount',
        'received_amount',
        'variance_amount',
        'bank_account_id',
        'status',
        'reconciled_by',
        'reconciled_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'expected_amount' => 'string',
        'received_amount' => 'string',
        'variance_amount' => 'string',
        'reconciled_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
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

        static::creating(static function (CodReconciliation $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
