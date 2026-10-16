<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PayslipItem extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'payslip_items';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'payslip_id',
        'salary_component_id',
        'component_code',
        'component_type',
        'calculation_basis',
        'quantity',
        'rate',
        'amount',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'calculation_basis' => 'array',
        'quantity' => 'string',
        'rate' => 'string',
        'amount' => 'string',
        'sort_order' => 'integer',
    ];

    /**
     * @return BelongsTo<Payslip, $this>
     */
    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class, 'payslip_id');
    }

    /**
     * @return BelongsTo<SalaryComponent, $this>
     */
    public function component(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'salary_component_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (PayslipItem $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
