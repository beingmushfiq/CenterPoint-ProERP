<?php

declare(strict_types=1);

namespace App\Modules\Assets\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MaintenanceOrder extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'maintenance_orders';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'order_number',
        'asset_id',
        'maintenance_schedule_id',
        'maintenance_type',
        'priority',
        'reported_by',
        'reported_at',
        'problem_description',
        'diagnosis',
        'scheduled_start',
        'scheduled_end',
        'actual_start',
        'actual_end',
        'downtime_minutes',
        'status',
        'performed_by_employee_id',
        'vendor_party_id',
        'labour_cost',
        'parts_cost',
        'external_cost',
        'total_cost',
        'completion_notes',
        'approved_by',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
        'scheduled_start' => 'datetime',
        'scheduled_end' => 'datetime',
        'actual_start' => 'datetime',
        'actual_end' => 'datetime',
        'downtime_minutes' => 'integer',
        'labour_cost' => 'string',
        'parts_cost' => 'string',
        'external_cost' => 'string',
        'total_cost' => 'string',
    ];

    /**
     * @return BelongsTo<Asset, $this>
     */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'performed_by_employee_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (MaintenanceOrder $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
