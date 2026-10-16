<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Branch;
use App\Models\User;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class RunSheet extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'run_sheets';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'run_sheet_number',
        'branch_id',
        'rider_id',
        'vehicle_id',
        'run_date',
        'status',
        'total_stops',
        'completed_stops',
        'total_cod_expected',
        'total_cod_collected',
        'dispatched_at',
        'returned_at',
        'reconciled_by',
        'reconciled_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'run_date' => 'date:Y-m-d',
        'total_stops' => 'integer',
        'completed_stops' => 'integer',
        'total_cod_expected' => 'string',
        'total_cod_collected' => 'string',
        'dispatched_at' => 'datetime',
        'returned_at' => 'datetime',
        'reconciled_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    /**
     * @return HasMany<DeliveryOrder, $this>
     */
    public function deliveryOrders(): HasMany
    {
        return $this->hasMany(DeliveryOrder::class, 'run_sheet_id');
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

        static::creating(static function (RunSheet $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
