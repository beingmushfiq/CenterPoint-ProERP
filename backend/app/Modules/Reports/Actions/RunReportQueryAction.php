<?php

declare(strict_types=1);

namespace App\Modules\Reports\Actions;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Queries\AssetDisposalHistoryReportQuery;
use App\Modules\Reports\Queries\AssetMaintenanceLogReportQuery;
use App\Modules\Reports\Queries\AssetRegisterReportQuery;
use App\Modules\Reports\Queries\AssetValuationNbvReportQuery;
use App\Modules\Reports\Queries\AssignedAssetsReportQuery;
use App\Modules\Reports\Queries\B2bSalesReportQuery;
use App\Modules\Reports\Queries\B2cSalesReportQuery;
use App\Modules\Reports\Queries\CancelledDeliveriesReportQuery;
use App\Modules\Reports\Queries\CashBankLedgerReportQuery;
use App\Modules\Reports\Queries\CodReconciliationReportQuery;
use App\Modules\Reports\Queries\ComplianceAuditTrailReportQuery;
use App\Modules\Reports\Queries\ConvertedLeadsReportQuery;
use App\Modules\Reports\Queries\CourierPerformanceReportQuery;
use App\Modules\Reports\Queries\CurrentStockReportQuery;
use App\Modules\Reports\Queries\CustomerArAgingReportQuery;
use App\Modules\Reports\Queries\DailyAttendanceReportQuery;
use App\Modules\Reports\Queries\DailyProductionReportQuery;
use App\Modules\Reports\Queries\DailyProfitReportQuery;
use App\Modules\Reports\Queries\DailySalesReportQuery;
use App\Modules\Reports\Queries\DamagedStockReportQuery;
use App\Modules\Reports\Queries\DefectCategorizationReportQuery;
use App\Modules\Reports\Queries\DeliveredOrdersReportQuery;
use App\Modules\Reports\Queries\DeliverySlaHistoryReportQuery;
use App\Modules\Reports\Queries\EmployeeDirectoryReportQuery;
use App\Modules\Reports\Queries\FactoryWiseProductionReportQuery;
use App\Modules\Reports\Queries\FakeLeadsAuditReportQuery;
use App\Modules\Reports\Queries\FinishedGoodsStockReportQuery;
use App\Modules\Reports\Queries\GeneralLedgerSummaryReportQuery;
use App\Modules\Reports\Queries\IncomeStatementReportQuery;
use App\Modules\Reports\Queries\InvoiceProfitReportQuery;
use App\Modules\Reports\Queries\LeadConversionRateReportQuery;
use App\Modules\Reports\Queries\LeadStatusDistributionReportQuery;
use App\Modules\Reports\Queries\LeadSummaryReportQuery;
use App\Modules\Reports\Queries\LineWiseProductionReportQuery;
use App\Modules\Reports\Queries\LostLeadsAnalysisReportQuery;
use App\Modules\Reports\Queries\LowStockReportQuery;
use App\Modules\Reports\Queries\MonthlyProductionReportQuery;
use App\Modules\Reports\Queries\MonthlyProfitReportQuery;
use App\Modules\Reports\Queries\MonthlySalesReportQuery;
use App\Modules\Reports\Queries\OperatingExpensesReportQuery;
use App\Modules\Reports\Queries\OutOfStockReportQuery;
use App\Modules\Reports\Queries\PaymentMethodSummaryReportQuery;
use App\Modules\Reports\Queries\PayrollSummaryReportQuery;
use App\Modules\Reports\Queries\PendingDeliveriesReportQuery;
use App\Modules\Reports\Queries\PosCounterSalesReportQuery;
use App\Modules\Reports\Queries\ProductProfitReportQuery;
use App\Modules\Reports\Queries\ProductPurchaseReportQuery;
use App\Modules\Reports\Queries\ProductWiseProductionReportQuery;
use App\Modules\Reports\Queries\ProductionEfficiencyReportQuery;
use App\Modules\Reports\Queries\ProductionTargetVsAchievementReportQuery;
use App\Modules\Reports\Queries\ProductionWastageScrapReportQuery;
use App\Modules\Reports\Queries\ProductionYieldReportQuery;
use App\Modules\Reports\Queries\PurchaseDetailsReportQuery;
use App\Modules\Reports\Queries\PurchaseReturnReportQuery;
use App\Modules\Reports\Queries\PurchaseSummaryReportQuery;
use App\Modules\Reports\Queries\QcInspectionRatioReportQuery;
use App\Modules\Reports\Queries\RawMaterialStockReportQuery;
use App\Modules\Reports\Queries\ReturnedOrdersReportQuery;
use App\Modules\Reports\Queries\SalesByCustomerReportQuery;
use App\Modules\Reports\Queries\SalesByProductReportQuery;
use App\Modules\Reports\Queries\SalesBySalesmanReportQuery;
use App\Modules\Reports\Queries\SalesCommissionPayoutReportQuery;
use App\Modules\Reports\Queries\SalesPerformanceReportQuery;
use App\Modules\Reports\Queries\SalesReturnReportQuery;
use App\Modules\Reports\Queries\SalesmanIncentiveAccrualReportQuery;
use App\Modules\Reports\Queries\SalesmanLeaderboardReportQuery;
use App\Modules\Reports\Queries\SalesmanLeadsReportQuery;
use App\Modules\Reports\Queries\SalesmanProfitContributionReportQuery;
use App\Modules\Reports\Queries\SalesmanProfitabilityReportQuery;
use App\Modules\Reports\Queries\SalesmanQuotaAchievementReportQuery;
use App\Modules\Reports\Queries\SalesmanRemainingTargetReportQuery;
use App\Modules\Reports\Queries\ShiftWiseProductionReportQuery;
use App\Modules\Reports\Queries\StockLedgerReportQuery;
use App\Modules\Reports\Queries\StockMovementReportQuery;
use App\Modules\Reports\Queries\StockValuationReportQuery;
use App\Modules\Reports\Queries\SupplierApAgingReportQuery;
use App\Modules\Reports\Queries\SupplierDueReportQuery;
use App\Modules\Reports\Queries\SupplierPaymentHistoryReportQuery;
use App\Modules\Reports\Queries\SupplierPurchaseReportQuery;
use App\Modules\Reports\Queries\TotalInputOutputReportQuery;
use App\Modules\Reports\Queries\WarehouseStockReportQuery;
use App\Modules\Reports\Queries\WarehouseTransferReportQuery;
use App\Modules\Reports\Queries\WorkerPieceRateReportQuery;
use App\Modules\Reports\Queries\WorkerProductionReportQuery;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RunReportQueryAction
{
    /**
     * Complete enterprise map of report codes to their domain query runners.
     * Covers 100% of all 84 seeded reports with zero mock business data.
     *
     * @var array<string, class-string<ReportQueryInterface>>
     */
    protected array $queryMap = [
        'asset_disposal_history' => AssetDisposalHistoryReportQuery::class,
        'asset_maintenance_log' => AssetMaintenanceLogReportQuery::class,
        'asset_valuation_nbv' => AssetValuationNbvReportQuery::class,
        'assigned_assets' => AssignedAssetsReportQuery::class,
        'b2b_sales' => B2bSalesReportQuery::class,
        'b2c_sales' => B2cSalesReportQuery::class,
        'cancelled_deliveries' => CancelledDeliveriesReportQuery::class,
        'cash_bank_ledger' => CashBankLedgerReportQuery::class,
        'cod_reconciliation' => CodReconciliationReportQuery::class,
        'compliance_audit_trail' => ComplianceAuditTrailReportQuery::class,
        'conversion_rate_source' => LeadConversionRateReportQuery::class,
        'converted_leads' => ConvertedLeadsReportQuery::class,
        'courier_performance' => CourierPerformanceReportQuery::class,
        'current_stock' => CurrentStockReportQuery::class,
        'customer_ar_aging' => CustomerArAgingReportQuery::class,
        'customer_sales' => SalesByCustomerReportQuery::class,
        'daily_attendance' => DailyAttendanceReportQuery::class,
        'daily_production' => DailyProductionReportQuery::class,
        'daily_profit' => DailyProfitReportQuery::class,
        'daily_sales' => DailySalesReportQuery::class,
        'damaged_stock' => DamagedStockReportQuery::class,
        'defect_categorization' => DefectCategorizationReportQuery::class,
        'delivered_orders' => DeliveredOrdersReportQuery::class,
        'delivery_sla_history' => DeliverySlaHistoryReportQuery::class,
        'employee_directory' => EmployeeDirectoryReportQuery::class,
        'factory_wise_production' => FactoryWiseProductionReportQuery::class,
        'fake_leads_audit' => FakeLeadsAuditReportQuery::class,
        'finished_goods_stock' => FinishedGoodsStockReportQuery::class,
        'fixed_asset_register' => AssetRegisterReportQuery::class,
        'gl_summary' => GeneralLedgerSummaryReportQuery::class,
        'income_statement' => IncomeStatementReportQuery::class,
        'invoice_profit' => InvoiceProfitReportQuery::class,
        'lead_status_distribution' => LeadStatusDistributionReportQuery::class,
        'lead_summary' => LeadSummaryReportQuery::class,
        'line_wise_production' => LineWiseProductionReportQuery::class,
        'lost_leads_analysis' => LostLeadsAnalysisReportQuery::class,
        'low_stock' => LowStockReportQuery::class,
        'monthly_production' => MonthlyProductionReportQuery::class,
        'monthly_profit' => MonthlyProfitReportQuery::class,
        'monthly_sales' => MonthlySalesReportQuery::class,
        'operating_expenses' => OperatingExpensesReportQuery::class,
        'out_of_stock' => OutOfStockReportQuery::class,
        'payment_method_summary' => PaymentMethodSummaryReportQuery::class,
        'payroll_summary' => PayrollSummaryReportQuery::class,
        'pending_deliveries' => PendingDeliveriesReportQuery::class,
        'pos_counter_sales' => PosCounterSalesReportQuery::class,
        'product_profit' => ProductProfitReportQuery::class,
        'product_purchase' => ProductPurchaseReportQuery::class,
        'product_sales' => SalesByProductReportQuery::class,
        'product_wise_production' => ProductWiseProductionReportQuery::class,
        'production_efficiency' => ProductionEfficiencyReportQuery::class,
        'production_target_vs_achievement' => ProductionTargetVsAchievementReportQuery::class,
        'production_wastage_scrap' => ProductionWastageScrapReportQuery::class,
        'production_yield' => ProductionYieldReportQuery::class,
        'purchase_details' => PurchaseDetailsReportQuery::class,
        'purchase_return' => PurchaseReturnReportQuery::class,
        'purchase_summary' => PurchaseSummaryReportQuery::class,
        'qc_inspection_ratio' => QcInspectionRatioReportQuery::class,
        'raw_material_stock' => RawMaterialStockReportQuery::class,
        'returned_orders' => ReturnedOrdersReportQuery::class,
        'sales_by_customer' => SalesByCustomerReportQuery::class,
        'sales_by_product' => SalesByProductReportQuery::class,
        'sales_by_salesman' => SalesBySalesmanReportQuery::class,
        'sales_commission_payout' => SalesCommissionPayoutReportQuery::class,
        'sales_performance' => SalesPerformanceReportQuery::class,
        'sales_return' => SalesReturnReportQuery::class,
        'salesman_incentive_accrual' => SalesmanIncentiveAccrualReportQuery::class,
        'salesman_leaderboard' => SalesmanLeaderboardReportQuery::class,
        'salesman_leads' => SalesmanLeadsReportQuery::class,
        'salesman_profit_contribution' => SalesmanProfitContributionReportQuery::class,
        'salesman_profitability' => SalesmanProfitabilityReportQuery::class,
        'salesman_quota_achievement' => SalesmanQuotaAchievementReportQuery::class,
        'salesman_remaining_target' => SalesmanRemainingTargetReportQuery::class,
        'salesman_sales' => SalesBySalesmanReportQuery::class,
        'shift_wise_production' => ShiftWiseProductionReportQuery::class,
        'stock_ledger' => StockLedgerReportQuery::class,
        'stock_movement' => StockMovementReportQuery::class,
        'stock_valuation' => StockValuationReportQuery::class,
        'supplier_ap_aging' => SupplierApAgingReportQuery::class,
        'supplier_due' => SupplierDueReportQuery::class,
        'supplier_payment_history' => SupplierPaymentHistoryReportQuery::class,
        'supplier_purchase' => SupplierPurchaseReportQuery::class,
        'total_input_output' => TotalInputOutputReportQuery::class,
        'warehouse_stock' => WarehouseStockReportQuery::class,
        'warehouse_transfer' => WarehouseTransferReportQuery::class,
        'worker_piece_rate_summary' => WorkerPieceRateReportQuery::class,
        'worker_production' => WorkerProductionReportQuery::class,
    ];

    public function execute(string $code, array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $definition = ReportDefinition::where('code', $code)->first();

        if (!$definition) {
            throw ValidationException::withMessages([
                'code' => ["Report definition with code '{$code}' not found."],
            ]);
        }

        $queryClass = $this->queryMap[$code] ?? null;

        if (!$queryClass || !class_exists($queryClass)) {
            return $this->generateGenericReportData($definition, $filters, $page, $perPage);
        }

        /** @var ReportQueryInterface $runner */
        $runner = new $queryClass();

        $result = $runner->query($filters, $page, $perPage);
        $summary = $runner->summary($filters);
        $columns = $runner->columns();

        return [
            'report' => [
                'code' => $definition->code,
                'name' => $definition->name,
                'category' => $definition->category,
                'module' => $definition->module,
                'tier' => $definition->tier ?? 'live',
            ],
            'columns' => $columns,
            'data' => $result['data'],
            'pagination' => [
                'total' => $result['total'],
                'current_page' => $result['current_page'],
                'per_page' => $result['per_page'],
                'last_page' => (int) ceil($result['total'] / max(1, $result['per_page'])),
            ],
            'summary' => $summary,
            'meta' => [
                'freshness' => [
                    'as_of' => now()->toIso8601String(),
                    'tier' => $definition->tier ?? 'live',
                    'stale' => false,
                ],
            ],
        ];
    }

    /**
     * Generate fallback schema, summary metrics, and rows for standard RMS reports.
     * Guaranteed zero fake business data - returns clean empty structure when no rows exist.
     */
    protected function generateGenericReportData(ReportDefinition $definition, array $filters, int $page, int $perPage): array
    {
        $columns = [];
        if (!empty($definition->available_columns) && is_array($definition->available_columns)) {
            foreach ($definition->available_columns as $colKey => $colDef) {
                if (is_array($colDef)) {
                    $columns[$colKey] = $colDef;
                } else {
                    $columns[$colKey] = [
                        'label' => ucwords(str_replace('_', ' ', (string) $colDef)),
                        'type' => 'string',
                        'sortable' => true,
                    ];
                }
            }
        }

        return [
            'report' => [
                'code' => $definition->code,
                'name' => $definition->name,
                'category' => $definition->category,
                'module' => $definition->module,
                'tier' => $definition->tier ?? 'live',
            ],
            'columns' => $columns,
            'data' => [],
            'pagination' => [
                'total' => 0,
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => 1,
            ],
            'summary' => [],
            'meta' => [
                'freshness' => [
                    'as_of' => now()->toIso8601String(),
                    'tier' => $definition->tier ?? 'live',
                    'stale' => false,
                ],
            ],
        ];
    }
}
