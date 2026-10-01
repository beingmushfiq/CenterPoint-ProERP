<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ReportDefinition extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'report_definitions';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'canonical_code',
        'name',
        'module',
        'category',
        'description',
        'default_filters',
        'available_columns',
        'required_permission',
        'supports_export',
        'tier',
        'summary_table',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * Canonical aliases mapping legacy / single-filter report codes to their consolidated parents.
     */
    public const CANONICAL_ALIASES = [
        // Production
        'daily_production' => 'production_output',
        'monthly_production' => 'production_output',
        'production_target_vs_achievement' => 'production_output',
        'product_wise_production' => 'production_output',
        'line_wise_production' => 'production_output',
        'factory_wise_production' => 'production_output',
        'shift_wise_production' => 'production_output',
        'production_efficiency' => 'production_output',
        'production_wastage_scrap' => 'production_yield',
        'total_input_output' => 'production_yield',
        'worker_piece_rate_summary' => 'worker_production',

        // Inventory
        'warehouse_stock' => 'current_stock',
        'raw_material_stock' => 'current_stock',
        'finished_goods_stock' => 'current_stock',
        'stock_movement' => 'stock_ledger',
        'warehouse_transfer' => 'stock_ledger',
        'out_of_stock' => 'low_stock',

        // Sales & Profit
        'b2c_sales' => 'product_sales',
        'daily_sales' => 'sales_performance',
        'monthly_sales' => 'sales_performance',
        'b2b_sales' => 'sales_performance',
        'invoice_profit' => 'product_profit',
        'daily_profit' => 'product_profit',
        'monthly_profit' => 'product_profit',

        // Salesmen
        'salesman_profitability' => 'salesman_profit_contribution',
        'salesman_leaderboard' => 'salesman_sales',
        'salesman_quota_achievement' => 'salesman_sales',
        'salesman_remaining_target' => 'salesman_sales',
        'salesman_incentive_accrual' => 'salesman_sales',

        // Purchasing
        'purchase_details' => 'purchase_summary',
        'supplier_due' => 'supplier_ap_aging',
        'supplier_purchase' => 'supplier_purchase',
        'product_purchase' => 'supplier_purchase',

        // Delivery
        'pending_deliveries' => 'delivery_master',
        'delivered_orders' => 'delivery_master',
        'returned_orders' => 'delivery_master',
        'cancelled_deliveries' => 'delivery_master',
        'delivery_sla_history' => 'courier_performance',

        // CRM
        'converted_leads' => 'lead_summary',
        'lost_leads_analysis' => 'lead_status_distribution',
        'conversion_rate_source' => 'lead_summary',
        'salesman_leads' => 'lead_summary',

        // Finance
        'cash_bank_ledger' => 'gl_summary',
        'payment_method_summary' => 'pos_counter_sales',

        // QC
        'defect_categorization' => 'qc_inspection_ratio',
    ];

    /**
     * Resolves a report definition by code, alias, or canonical fallback.
     */
    public static function resolveDefinition(string $code, ?int $tenantId = null): ?self
    {
        $canonical = self::CANONICAL_ALIASES[$code] ?? $code;

        $buildScope = function ($q) use ($tenantId) {
            if ($tenantId !== null) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            }
        };

        // 1. Exact match on code
        $exact = self::withoutTenantScope()->where('code', $code)->where($buildScope)->first();
        if ($exact) {
            return $exact;
        }

        // 2. Exact match on canonical mapped code
        if ($canonical !== $code) {
            $canon = self::withoutTenantScope()->where('code', $canonical)->where($buildScope)->first();
            if ($canon) {
                return $canon;
            }
        }

        // 3. Match via canonical_code column
        return self::withoutTenantScope()
            ->where(function ($q) use ($code, $canonical): void {
                $q->where('canonical_code', $code)->orWhere('canonical_code', $canonical);
            })
            ->where($buildScope)
            ->first();
    }

    protected $casts = [
        'default_filters' => 'array',
        'available_columns' => 'array',
        'supports_export' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function savedViews(): HasMany
    {
        return $this->hasMany(ReportSavedView::class, 'report_definition_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(ReportSchedule::class, 'report_definition_id');
    }

    public function exports(): HasMany
    {
        return $this->hasMany(ReportExport::class, 'report_definition_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
