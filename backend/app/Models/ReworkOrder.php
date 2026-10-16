<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

final class ReworkOrder extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'rework_orders';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'rework_number',
        'source_batch_id',
        'qc_inspection_id',
        'product_id',
        'quantity',
        'unit_id',
        'target_batch_id',
        'cycle_number',
        'status',
        'cost_incurred',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'cost_incurred' => 'decimal:4',
        'cycle_number' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function sourceBatch(): BelongsTo
    {
        return $this->belongsTo(ProductionBatch::class, 'source_batch_id');
    }

    public function targetBatch(): BelongsTo
    {
        return $this->belongsTo(ProductionBatch::class, 'target_batch_id');
    }

    public function qcInspection(): BelongsTo
    {
        return $this->belongsTo(QcInspection::class, 'qc_inspection_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (ReworkOrder $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
