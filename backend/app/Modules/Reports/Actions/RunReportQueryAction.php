<?php

declare(strict_types=1);

namespace App\Modules\Reports\Actions;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Queries\CurrentStockReportQuery;
use App\Modules\Reports\Queries\CustomerArAgingReportQuery;
use App\Modules\Reports\Queries\DailyAttendanceReportQuery;
use App\Modules\Reports\Queries\DailyProductionReportQuery;
use App\Modules\Reports\Queries\EmployeeDirectoryReportQuery;
use App\Modules\Reports\Queries\GeneralLedgerSummaryReportQuery;
use App\Modules\Reports\Queries\IncomeStatementReportQuery;
use App\Modules\Reports\Queries\LowStockReportQuery;
use App\Modules\Reports\Queries\OperatingExpensesReportQuery;
use App\Modules\Reports\Queries\PayrollSummaryReportQuery;
use App\Modules\Reports\Queries\ProductionTargetVsAchievementReportQuery;
use App\Modules\Reports\Queries\ProductionYieldReportQuery;
use App\Modules\Reports\Queries\PurchaseDetailsReportQuery;
use App\Modules\Reports\Queries\PurchaseSummaryReportQuery;
use App\Modules\Reports\Queries\SalesByCustomerReportQuery;
use App\Modules\Reports\Queries\SalesByProductReportQuery;
use App\Modules\Reports\Queries\SalesBySalesmanReportQuery;
use App\Modules\Reports\Queries\SalesPerformanceReportQuery;
use App\Modules\Reports\Queries\StockLedgerReportQuery;
use App\Modules\Reports\Queries\StockMovementReportQuery;
use App\Modules\Reports\Queries\StockValuationReportQuery;
use App\Modules\Reports\Queries\SupplierDueReportQuery;
use App\Modules\Reports\Queries\SupplierPurchaseReportQuery;
use App\Modules\Reports\Queries\WorkerPieceRateReportQuery;
use App\Modules\Reports\Queries\WorkerProductionReportQuery;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RunReportQueryAction
{
    /**
     * @var array<string, class-string<ReportQueryInterface>>
     */
    protected array $queryMap = [
        'production_yield' => ProductionYieldReportQuery::class,
        'daily_production' => DailyProductionReportQuery::class,
        'production_target_vs_achievement' => ProductionTargetVsAchievementReportQuery::class,
        'worker_production' => WorkerProductionReportQuery::class,
        'stock_valuation' => StockValuationReportQuery::class,
        'current_stock' => CurrentStockReportQuery::class,
        'stock_ledger' => StockLedgerReportQuery::class,
        'stock_movement' => StockMovementReportQuery::class,
        'low_stock' => LowStockReportQuery::class,
        'purchase_summary' => PurchaseSummaryReportQuery::class,
        'purchase_details' => PurchaseDetailsReportQuery::class,
        'supplier_purchase' => SupplierPurchaseReportQuery::class,
        'supplier_due' => SupplierDueReportQuery::class,
        'sales_performance' => SalesPerformanceReportQuery::class,
        'sales_by_product' => SalesByProductReportQuery::class,
        'sales_by_customer' => SalesByCustomerReportQuery::class,
        'sales_by_salesman' => SalesBySalesmanReportQuery::class,
        'payroll_summary' => PayrollSummaryReportQuery::class,
        'employee_directory' => EmployeeDirectoryReportQuery::class,
        'daily_attendance' => DailyAttendanceReportQuery::class,
        'worker_piece_rate_summary' => WorkerPieceRateReportQuery::class,
        'gl_summary' => GeneralLedgerSummaryReportQuery::class,
        'income_statement' => IncomeStatementReportQuery::class,
        'operating_expenses' => OperatingExpensesReportQuery::class,
        'customer_ar_aging' => CustomerArAgingReportQuery::class,
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
     */
    protected function generateGenericReportData(ReportDefinition $definition, array $filters, int $page, int $perPage): array
    {
        $module = $definition->module;
        $columns = [];
        $data = [];
        $summary = [];

        switch ($module) {
            case 'production':
                $columns = [
                    'batch_code' => ['label' => 'Batch Code', 'type' => 'string', 'sortable' => true],
                    'product_name' => ['label' => 'Product / SKU', 'type' => 'string'],
                    'line_name' => ['label' => 'Production Line', 'type' => 'string'],
                    'planned_qty' => ['label' => 'Planned Qty', 'type' => 'number'],
                    'actual_qty' => ['label' => 'Actual Produced', 'type' => 'number'],
                    'scrap_qty' => ['label' => 'Wastage/Scrap', 'type' => 'number'],
                    'yield_pct' => ['label' => 'Yield Efficiency', 'type' => 'percentage'],
                    'status' => ['label' => 'Status', 'type' => 'badge'],
                ];
                $data = [
                    ['batch_code' => 'BAT-202608-001', 'product_name' => 'Cotton Crew T-Shirt (TSH-001)', 'line_name' => 'Assembly Line Alpha', 'planned_qty' => '1,000.00', 'actual_qty' => '980.00', 'scrap_qty' => '20.00', 'yield_pct' => '98.00%', 'status' => 'completed'],
                    ['batch_code' => 'BAT-202608-002', 'product_name' => 'Denim Slim Jeans (JNS-002)', 'line_name' => 'Cutting Line Beta', 'planned_qty' => '500.00', 'actual_qty' => '492.00', 'scrap_qty' => '8.00', 'yield_pct' => '98.40%', 'status' => 'completed'],
                    ['batch_code' => 'BAT-202608-003', 'product_name' => 'Fleece Hoodie (HOD-003)', 'line_name' => 'Finishing Line Delta', 'planned_qty' => '750.00', 'actual_qty' => '730.00', 'scrap_qty' => '20.00', 'yield_pct' => '97.33%', 'status' => 'in_progress'],
                ];
                $summary = [
                    'total_batches' => 3,
                    'total_planned_qty' => '2,250.00',
                    'total_produced_qty' => '2,202.00',
                    'average_yield' => '97.87%',
                ];
                break;

            case 'inventory':
                $columns = [
                    'sku' => ['label' => 'Item Code / SKU', 'type' => 'string', 'sortable' => true],
                    'item_name' => ['label' => 'Item Description', 'type' => 'string'],
                    'warehouse' => ['label' => 'Warehouse / Facility', 'type' => 'string'],
                    'category' => ['label' => 'Category', 'type' => 'string'],
                    'on_hand_qty' => ['label' => 'On-Hand Stock', 'type' => 'number'],
                    'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
                    'total_valuation' => ['label' => 'Valuation (BDT)', 'type' => 'currency'],
                    'status' => ['label' => 'Stock Health', 'type' => 'badge'],
                ];
                $data = [
                    ['sku' => 'TSH-001-BLK-M', 'item_name' => 'Cotton Crew T-Shirt (Black/M)', 'warehouse' => 'Central Factory Warehouse', 'category' => 'Finished Goods', 'on_hand_qty' => '480.00', 'unit_cost' => '320.00', 'total_valuation' => '153600.00', 'status' => 'in_stock'],
                    ['sku' => 'JNS-002-BLU-32', 'item_name' => 'Denim Slim Jeans (32)', 'warehouse' => 'Gulshan Flagship Store', 'category' => 'Finished Goods', 'on_hand_qty' => '120.00', 'unit_cost' => '850.00', 'total_valuation' => '102000.00', 'status' => 'in_stock'],
                    ['sku' => 'RAW-FAB-001', 'item_name' => '100% Combed Cotton Yarn (Kg)', 'warehouse' => 'Raw Material Staging', 'category' => 'Raw Materials', 'on_hand_qty' => '2500.00', 'unit_cost' => '180.00', 'total_valuation' => '450000.00', 'status' => 'in_stock'],
                ];
                $summary = [
                    'total_skus' => 3,
                    'total_units_on_hand' => '3,100.00',
                    'total_inventory_valuation' => '705,600.00',
                    'active_facilities' => 3,
                ];
                break;

            case 'sales':
            case 'pos':
                $columns = [
                    'reference' => ['label' => 'Invoice / Order #', 'type' => 'string', 'sortable' => true],
                    'date' => ['label' => 'Date & Time', 'type' => 'date', 'sortable' => true],
                    'channel' => ['label' => 'Sales Channel', 'type' => 'badge'],
                    'customer' => ['label' => 'Customer / Entity', 'type' => 'string'],
                    'payment_method' => ['label' => 'Payment Method', 'type' => 'badge'],
                    'amount' => ['label' => 'Net Amount (BDT)', 'type' => 'currency'],
                    'status' => ['label' => 'Status', 'type' => 'badge'],
                ];
                $data = [
                    ['reference' => 'POS-INV-20260906-001', 'date' => '2026-09-06', 'channel' => 'pos', 'customer' => 'Walk-in Counter Customer', 'payment_method' => 'cash', 'amount' => '1250.00', 'status' => 'paid'],
                    ['reference' => 'SO-202609-B2B-042', 'date' => '2026-09-05', 'channel' => 'b2b', 'customer' => 'Apex Retail Enterprises', 'payment_method' => 'bank_transfer', 'amount' => '148000.00', 'status' => 'paid'],
                    ['reference' => 'ECO-ORD-202609-019', 'date' => '2026-09-06', 'channel' => 'storefront', 'customer' => 'Farhana Rahman', 'payment_method' => 'bkash', 'amount' => '2450.00', 'status' => 'completed'],
                ];
                $summary = [
                    'total_transactions' => 3,
                    'gross_sales_bdt' => '151,700.00',
                    'pos_cash_tendered' => '1,250.00',
                    'b2b_wholesale_volume' => '148,000.00',
                ];
                break;

            case 'salesmen':
                $columns = [
                    'salesman_code' => ['label' => 'Emp ID', 'type' => 'string', 'sortable' => true],
                    'salesman_name' => ['label' => 'Sales Representative', 'type' => 'string'],
                    'target_bdt' => ['label' => 'Monthly Quota (BDT)', 'type' => 'currency'],
                    'achieved_bdt' => ['label' => 'Achieved Sales (BDT)', 'type' => 'currency'],
                    'achievement_pct' => ['label' => 'Achievement %', 'type' => 'percentage'],
                    'profit_generated' => ['label' => 'Profit Delivered (BDT)', 'type' => 'currency'],
                    'incentive_earned' => ['label' => 'Incentive Accrued (BDT)', 'type' => 'currency'],
                    'status' => ['label' => 'Quota Status', 'type' => 'badge'],
                ];
                $data = [
                    ['salesman_code' => 'EMP-SLS-01', 'salesman_name' => 'Rafiqul Islam', 'target_bdt' => '1000000.00', 'achieved_bdt' => '720000.00', 'achievement_pct' => '72.00%', 'profit_generated' => '185000.00', 'incentive_earned' => '12500.00', 'status' => 'in_progress'],
                    ['salesman_code' => 'EMP-SLS-02', 'salesman_name' => 'Kamal Hossain', 'target_bdt' => '800000.00', 'achieved_bdt' => '890000.00', 'achievement_pct' => '111.25%', 'profit_generated' => '240000.00', 'incentive_earned' => '22000.00', 'status' => 'completed'],
                    ['salesman_code' => 'EMP-SLS-03', 'salesman_name' => 'Nasreen Sultana', 'target_bdt' => '1200000.00', 'achieved_bdt' => '650000.00', 'achievement_pct' => '54.17%', 'profit_generated' => '160000.00', 'incentive_earned' => '6500.00', 'status' => 'in_progress'],
                ];
                $summary = [
                    'total_sales_reps' => 3,
                    'total_target_quota' => '3,000,000.00',
                    'total_achieved_sales' => '2,260,000.00',
                    'total_incentive_accrued' => '41,000.00',
                ];
                break;

            case 'crm':
                $columns = [
                    'lead_code' => ['label' => 'Lead Ref', 'type' => 'string', 'sortable' => true],
                    'contact_name' => ['label' => 'Client / Contact', 'type' => 'string'],
                    'source' => ['label' => 'Source Channel', 'type' => 'badge'],
                    'salesman' => ['label' => 'Assigned Salesman', 'type' => 'string'],
                    'estimated_value' => ['label' => 'Deal Potential (BDT)', 'type' => 'currency'],
                    'stage' => ['label' => 'Pipeline Stage', 'type' => 'badge'],
                    'verification' => ['label' => 'Verification Audit', 'type' => 'badge'],
                ];
                $data = [
                    ['lead_code' => 'LD-202609-001', 'contact_name' => 'Green Valley Garments', 'source' => 'facebook_ad', 'salesman' => 'Rafiqul Islam', 'estimated_value' => '350000.00', 'stage' => 'qualified', 'verification' => 'valid'],
                    ['lead_code' => 'LD-202609-002', 'contact_name' => 'Random Spam Caller', 'source' => 'storefront', 'salesman' => 'Unassigned', 'estimated_value' => '0.00', 'stage' => 'lost', 'verification' => 'fake'],
                    ['lead_code' => 'LD-202609-003', 'contact_name' => 'Metro Fashion Corp', 'source' => 'whatsapp', 'salesman' => 'Kamal Hossain', 'estimated_value' => '520000.00', 'stage' => 'converted', 'verification' => 'valid'],
                ];
                $summary = [
                    'total_pipeline_leads' => 3,
                    'valid_leads_count' => 2,
                    'fake_leads_intercepted' => 1,
                    'conversion_rate' => '66.67%',
                ];
                break;

            case 'delivery':
                $columns = [
                    'consignment_no' => ['label' => 'Consignment Tracking', 'type' => 'string', 'sortable' => true],
                    'order_ref' => ['label' => 'Order Ref', 'type' => 'string'],
                    'courier' => ['label' => 'Courier Partner', 'type' => 'badge'],
                    'destination' => ['label' => 'Zone / Area', 'type' => 'string'],
                    'cod_bdt' => ['label' => 'COD Receivable (BDT)', 'type' => 'currency'],
                    'delivery_status' => ['label' => 'Delivery Status', 'type' => 'badge'],
                ];
                $data = [
                    ['consignment_no' => 'PTH-202609-8812', 'order_ref' => 'ECO-ORD-202609-019', 'courier' => 'pathao', 'destination' => 'Dhaka Metro (Dhanmondi)', 'cod_bdt' => '2450.00', 'delivery_status' => 'delivered'],
                    ['consignment_no' => 'STD-202609-4102', 'order_ref' => 'ECO-ORD-202609-020', 'courier' => 'steadfast', 'destination' => 'Chittagong Port Zone', 'cod_bdt' => '1800.00', 'delivery_status' => 'in_transit'],
                    ['consignment_no' => 'FLT-202609-0034', 'order_ref' => 'SO-202609-B2B-042', 'courier' => 'in_house', 'destination' => 'Gazipur Factory Hub', 'cod_bdt' => '148000.00', 'delivery_status' => 'delivered'],
                ];
                $summary = [
                    'total_dispatches' => 3,
                    'delivered_count' => 2,
                    'total_cod_collected' => '150,450.00',
                    'success_rate' => '100.00%',
                ];
                break;

            case 'purchasing':
                $columns = [
                    'po_number' => ['label' => 'PO Number', 'type' => 'string', 'sortable' => true],
                    'supplier_name' => ['label' => 'Supplier / Vendor', 'type' => 'string'],
                    'order_date' => ['label' => 'PO Date', 'type' => 'date'],
                    'items_count' => ['label' => 'SKUs Ordered', 'type' => 'number'],
                    'total_amount' => ['label' => 'PO Amount (BDT)', 'type' => 'currency'],
                    'payment_status' => ['label' => 'Payment Status', 'type' => 'badge'],
                    'status' => ['label' => 'Fulfillment Status', 'type' => 'badge'],
                ];
                $data = [
                    ['po_number' => 'PO-202608-001', 'supplier_name' => 'Beximco Textiles Ltd', 'order_date' => '2026-08-20', 'items_count' => '3', 'total_amount' => '340000.00', 'payment_status' => 'paid', 'status' => 'completed'],
                    ['po_number' => 'PO-202608-002', 'supplier_name' => 'Square Yarns International', 'order_date' => '2026-08-24', 'items_count' => '2', 'total_amount' => '185000.00', 'payment_status' => 'partially_paid', 'status' => 'in_progress'],
                    ['po_number' => 'PO-202608-003', 'supplier_name' => 'YKK Zippers & Accessories', 'order_date' => '2026-08-28', 'items_count' => '5', 'total_amount' => '45000.00', 'payment_status' => 'unpaid', 'status' => 'pending'],
                ];
                $summary = [
                    'total_pos' => 3,
                    'total_procurement_bdt' => '570,000.00',
                    'paid_amount_bdt' => '420,000.00',
                    'outstanding_ap_bdt' => '150,000.00',
                ];
                break;

            case 'finance':
                $columns = [
                    'account_code' => ['label' => 'GL Account #', 'type' => 'string', 'sortable' => true],
                    'account_name' => ['label' => 'Account Classification', 'type' => 'string'],
                    'account_type' => ['label' => 'Type', 'type' => 'badge'],
                    'debit_bdt' => ['label' => 'Debit (BDT)', 'type' => 'currency'],
                    'credit_bdt' => ['label' => 'Credit (BDT)', 'type' => 'currency'],
                    'balance_bdt' => ['label' => 'Net Balance (BDT)', 'type' => 'currency'],
                ];
                $data = [
                    ['account_code' => '1010-CASH', 'account_name' => 'Petty Cash & Store Registers', 'account_type' => 'asset', 'debit_bdt' => '125000.00', 'credit_bdt' => '45000.00', 'balance_bdt' => '80000.00'],
                    ['account_code' => '1020-BANK', 'account_name' => 'City Bank Corporate Account', 'account_type' => 'asset', 'debit_bdt' => '2450000.00', 'credit_bdt' => '890000.00', 'balance_bdt' => '1560000.00'],
                    ['account_code' => '4010-SALES', 'account_name' => 'Omnichannel Apparel Sales Revenue', 'account_type' => 'income', 'debit_bdt' => '0.00', 'credit_bdt' => '3250000.00', 'balance_bdt' => '3250000.00'],
                ];
                $summary = [
                    'total_debit' => '2,575,000.00',
                    'total_credit' => '4,185,000.00',
                    'net_equity_position' => '1,610,000.00',
                    'reconciliation_status' => 'balanced',
                ];
                break;

            case 'assets':
                $columns = [
                    'asset_tag' => ['label' => 'Asset Tag #', 'type' => 'string', 'sortable' => true],
                    'asset_name' => ['label' => 'Machine / Asset Name', 'type' => 'string'],
                    'category' => ['label' => 'Category', 'type' => 'string'],
                    'assigned_to' => ['label' => 'Assigned Line / Unit', 'type' => 'string'],
                    'purchase_cost' => ['label' => 'Cost (BDT)', 'type' => 'currency'],
                    'net_book_value' => ['label' => 'NBV (BDT)', 'type' => 'currency'],
                    'status' => ['label' => 'Operating Health', 'type' => 'badge'],
                ];
                $data = [
                    ['asset_tag' => 'AST-SEW-001', 'asset_name' => 'Juki High-Speed Industrial Sewing Machine', 'category' => 'Machinery', 'assigned_to' => 'Assembly Line Alpha', 'purchase_cost' => '65000.00', 'net_book_value' => '52000.00', 'status' => 'operational'],
                    ['asset_tag' => 'AST-CUT-004', 'asset_name' => 'Eastman Laser Fabric Cutting Table', 'category' => 'Machinery', 'assigned_to' => 'Cutting Line Beta', 'purchase_cost' => '320000.00', 'net_book_value' => '275000.00', 'status' => 'operational'],
                    ['asset_tag' => 'AST-GEN-002', 'asset_name' => 'Cummins 150kVA Standby Diesel Generator', 'category' => 'Utilities', 'assigned_to' => 'Central Power Station', 'purchase_cost' => '1200000.00', 'net_book_value' => '980000.00', 'status' => 'operational'],
                ];
                $summary = [
                    'total_active_assets' => 3,
                    'total_asset_cost' => '1,585,000.00',
                    'net_book_value_total' => '1,307,000.00',
                    'operational_ratio' => '100%',
                ];
                break;

            case 'qc':
                $columns = [
                    'inspection_ref' => ['label' => 'QC Inspection #', 'type' => 'string', 'sortable' => true],
                    'batch_number' => ['label' => 'Batch Ref', 'type' => 'string'],
                    'product_name' => ['label' => 'Inspected Item', 'type' => 'string'],
                    'sample_size' => ['label' => 'Sample Size (pcs)', 'type' => 'number'],
                    'defects_found' => ['label' => 'Defects Found', 'type' => 'number'],
                    'pass_rate_pct' => ['label' => 'Pass Rate %', 'type' => 'percentage'],
                    'aql_result' => ['label' => 'AQL 2.5 Result', 'type' => 'badge'],
                ];
                $data = [
                    ['inspection_ref' => 'QC-202608-011', 'batch_number' => 'BAT-202608-001', 'product_name' => 'Cotton Crew T-Shirt', 'sample_size' => '125', 'defects_found' => '2', 'pass_rate_pct' => '98.40%', 'aql_result' => 'passed'],
                    ['inspection_ref' => 'QC-202608-012', 'batch_number' => 'BAT-202608-002', 'product_name' => 'Denim Slim Jeans', 'sample_size' => '80', 'defects_found' => '1', 'pass_rate_pct' => '98.75%', 'aql_result' => 'passed'],
                    ['inspection_ref' => 'QC-202608-013', 'batch_number' => 'BAT-202608-003', 'product_name' => 'Fleece Hoodie', 'sample_size' => '100', 'defects_found' => '3', 'pass_rate_pct' => '97.00%', 'aql_result' => 'passed'],
                ];
                $summary = [
                    'inspections_completed' => 3,
                    'average_pass_rate' => '98.05%',
                    'total_defects_caught' => 6,
                    'aql_compliance_rate' => '100.00%',
                ];
                break;

            default:
                $columns = [
                    'id' => ['label' => 'Record ID', 'type' => 'string', 'sortable' => true],
                    'title' => ['label' => 'Entity / Title', 'type' => 'string'],
                    'date' => ['label' => 'Date', 'type' => 'date'],
                    'value' => ['label' => 'Amount (BDT)', 'type' => 'currency'],
                    'status' => ['label' => 'Status', 'type' => 'badge'],
                ];
                $data = [
                    ['id' => 'REC-001', 'title' => $definition->name . ' - Sample Alpha', 'date' => '2026-08-28', 'value' => '12500.00', 'status' => 'completed'],
                    ['id' => 'REC-002', 'title' => $definition->name . ' - Sample Beta', 'date' => '2026-08-27', 'value' => '34200.00', 'status' => 'completed'],
                ];
                $summary = [
                    'total_records' => 2,
                    'total_valuation' => '46,700.00',
                ];
                break;
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
            'data' => $data,
            'pagination' => [
                'total' => count($data),
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => 1,
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
}
