<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $tenant_id
 * @property int|null $user_id
 * @property \Carbon\Carbon $assessment_date
 * @property string $monthly_revenue
 * @property string $monthly_expenses
 * @property string $ar_outstanding
 * @property string $ap_outstanding
 * @property string $inventory_value
 * @property string $bank_balance
 * @property array<string, mixed>|null $recommendations
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class FinancingAssessment extends Model
{
    use BelongsToTenant;

    protected $table = 'financing_assessments';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'user_id',
        'assessment_date',
        'monthly_revenue',
        'monthly_expenses',
        'ar_outstanding',
        'ap_outstanding',
        'inventory_value',
        'bank_balance',
        'recommendations',
    ];

    protected $casts = [
        'assessment_date' => 'date',
        'monthly_revenue' => 'string',
        'monthly_expenses' => 'string',
        'ar_outstanding' => 'string',
        'ap_outstanding' => 'string',
        'inventory_value' => 'string',
        'bank_balance' => 'string',
        'recommendations' => 'array',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (FinancingAssessment $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
