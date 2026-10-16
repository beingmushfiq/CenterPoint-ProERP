<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class OrderFraudAssessment extends Model
{
    use BelongsToTenant;

    protected $table = 'order_fraud_assessments';

    protected $fillable = [
        'tenant_id',
        'sales_order_id',
        'uuid',
        'risk_score',
        'risk_level',
        'risk_factors',
        'verification_status',
        'verification_checklist',
        'verification_notes',
        'verified_by',
        'verified_at',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'risk_factors' => 'array',
        'verification_checklist' => 'array',
        'verified_at' => 'datetime',
    ];

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (OrderFraudAssessment $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
