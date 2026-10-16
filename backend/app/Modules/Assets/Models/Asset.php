<?php

declare(strict_types=1);

namespace App\Modules\Assets\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Branch;
use App\Models\Company;
use App\Modules\HR\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Asset extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'assets';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'asset_code',
        'asset_tag',
        'name',
        'asset_category_id',
        'company_id',
        'branch_id',
        'factory_id',
        'production_line_id',
        'warehouse_id',
        'assigned_employee_id',
        'serial_number',
        'manufacturer',
        'model',
        'purchase_date',
        'purchase_order_id',
        'supplier_party_id',
        'purchase_cost',
        'depreciation_method',
        'useful_life_months',
        'salvage_value',
        'accumulated_depreciation',
        'book_value',
        'warranty_expires_on',
        'status',
        'condition',
        'disposal_date',
        'disposal_amount',
        'disposal_reason',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'purchase_date' => 'date:Y-m-d',
        'purchase_cost' => 'string',
        'salvage_value' => 'string',
        'accumulated_depreciation' => 'string',
        'book_value' => 'string',
        'useful_life_months' => 'integer',
        'warranty_expires_on' => 'date:Y-m-d',
        'disposal_date' => 'date:Y-m-d',
        'disposal_amount' => 'string',
    ];

    /**
     * @return BelongsTo<AssetCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function assignedEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_employee_id');
    }

    /**
     * @return HasMany<AssetDepreciationEntry, $this>
     */
    public function depreciationEntries(): HasMany
    {
        return $this->hasMany(AssetDepreciationEntry::class, 'asset_id');
    }

    /**
     * @return HasMany<MaintenanceOrder, $this>
     */
    public function maintenanceOrders(): HasMany
    {
        return $this->hasMany(MaintenanceOrder::class, 'asset_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Asset $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
