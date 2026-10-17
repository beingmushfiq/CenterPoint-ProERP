<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Modules\AI\Models\CashFlowAlert;
use App\Modules\AI\Services\AgentPermissionGuard;
use App\Modules\AI\Services\AgentToolRegistry;
use App\Modules\AI\Services\FinancingMatchEngine;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Reports\Actions\RunReportQueryAction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Brain Tool Registry — extends the Financial Copilot's AgentToolRegistry
 * with full-system ERP tools covering Sales, HR, Production, Purchasing, QC.
 *
 * Total tool count: 20 (8 Finance + 12 Operations ERP)
 */
class BrainToolRegistry extends AgentToolRegistry
{
    public function __construct(
        protected FinancingMatchEngine $financingMatchEngine,
        protected RunReportQueryAction $runReportQueryAction,
        protected AgentPermissionGuard $permissionGuard
    ) {
        parent::__construct($financingMatchEngine, $runReportQueryAction, $permissionGuard);
    }

    // -----------------------------------------------------------------------
    // Tool Schemas — full 20-tool registry
    // -----------------------------------------------------------------------

    /**
     * @return list<array<string, mixed>>
     */
    public function getOpenAiToolSchemas(): array
    {
        return array_merge(parent::getOpenAiToolSchemas(), $this->getOperationsToolSchemas());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getOperationsToolSchemas(): array
    {
        return [
            // ── Sales & Revenue ───────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_sales_summary',
                    'description' => 'Get total billed revenue, collected cash, open AR, and order volumes for a given period.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'start_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD, defaults to start of current month.'],
                            'end_date'   => ['type' => 'string', 'description' => 'YYYY-MM-DD, defaults to today.'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Inventory / Stock ─────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_stock_level',
                    'description' => 'Get total inventory valuation, on-hand units, low-stock items, and out-of-stock count across all warehouses.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'warehouse_id' => ['type' => 'integer', 'description' => 'Optional warehouse filter.'],
                            'include_zero' => ['type' => 'boolean', 'description' => 'Include zero-quantity items.'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Production / Manufacturing ────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_production_status',
                    'description' => 'Get live shopfloor manufacturing batches, planned vs actual output, QC yield pass-rate, and active work orders.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'status' => ['type' => 'string', 'description' => 'Filter: draft, in_progress, completed, paused'],
                            'limit'  => ['type' => 'integer', 'description' => 'Max records (default 10).'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── HR & Payroll ──────────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_payroll_summary',
                    'description' => 'Get payroll cost breakdown: gross wages, net pay, deductions, employer contributions, and upcoming payroll obligations for the current period.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'month' => ['type' => 'string', 'description' => 'YYYY-MM format. Defaults to current month.'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Purchasing / Procurement ──────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_purchase_orders',
                    'description' => 'List open purchase orders, GRN receiving status, 3-way matching bills, and outstanding AP payables.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'status' => ['type' => 'string', 'description' => 'Filter: draft, sent, partial, received, billed'],
                            'limit'  => ['type' => 'integer', 'description' => 'Max records (default 10).'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Quality Control ───────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_qc_inspections',
                    'description' => 'Get QC inspection results: pass/fail counts, defect rates, quarantine stock value, and yield statistics.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'start_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD.'],
                            'end_date'   => ['type' => 'string', 'description' => 'YYYY-MM-DD.'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Budget vs Actual ──────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_budget_vs_actual',
                    'description' => 'Compare budgeted vs actual revenue and expenses for the current period. Returns variance amounts and percentages by category.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'period'    => ['type' => 'string', 'description' => 'YYYY-MM month or YYYY year. Defaults to current month.'],
                            'category'  => ['type' => 'string', 'description' => 'Optional expense category filter.'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── AP / Payables Aging ───────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_payables_aging',
                    'description' => 'Analyze outstanding supplier payables with aging buckets (0-30, 31-60, 61-90, 90+ days). Critical for cash outflow planning.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'limit' => ['type' => 'integer', 'description' => 'Max supplier records (default 10).'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── HR Payroll Alert (Tier 1) ─────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_payroll_alert',
                    'description' => 'TIER 1 (ADVISORY): Check if upcoming payroll can be met from current cash position. Returns cash gap analysis and recommended actions.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'month' => [
                                'type'        => 'string',
                                'description' => 'Optional period YYYY-MM to check (defaults to current month).',
                            ],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── Navigation ────────────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'dispatch_navigation',
                    'description' => 'Generate a deep-link URL to a specific ERP workspace or module. Use when the user asks to go to, open, or view a specific area.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'module'  => ['type' => 'string', 'description' => 'Module: sales, inventory, finance, hr, production, purchasing, qc, reports, settings, ai'],
                            'subpath' => ['type' => 'string', 'description' => 'Optional sub-path, e.g. invoices, orders, stock'],
                        ],
                        'required'   => ['module'],
                    ],
                ],
            ],
            // ── Data Bin ─────────────────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'query_data_bin',
                    'description' => 'Query the soft-deleted records bin across ERP entities. Useful for checking what has been deleted and may need recovery.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'entity' => ['type' => 'string', 'description' => 'Entity type: products, invoices, orders, parties, etc.'],
                            'limit'  => ['type' => 'integer', 'description' => 'Max records (default 10).'],
                        ],
                        'required'   => [],
                    ],
                ],
            ],
            // ── SOP / Knowledge Base ──────────────────────────────────────
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'consult_system_sop',
                    'description' => 'Answer questions about ERP platform SOPs: FIFO/AVCO costing rules, RBAC permission structure, accounting posting logic, module workflows.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'topic' => ['type' => 'string', 'description' => 'The SOP topic to explain, e.g. fifo_costing, journal_posting, permission_tiers'],
                        ],
                        'required'   => ['topic'],
                    ],
                ],
            ],
        ];
    }

    // -----------------------------------------------------------------------
    // Tool Execution Dispatcher
    // -----------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function executeTool(
        string $toolName,
        array $arguments,
        int $tenantId,
        ?int $userId = null,
        ?int $confirmedBy = null
    ): array {
        return match ($toolName) {
            'get_sales_summary'   => $this->executeSalesSummary($tenantId, $arguments),
            'get_stock_level'     => $this->executeStockLevel($tenantId, $arguments),
            'get_production_status' => $this->executeProductionStatus($tenantId, $arguments),
            'get_payroll_summary' => $this->executePayrollSummary($tenantId, $arguments),
            'get_purchase_orders' => $this->executePurchaseOrders($tenantId, $arguments),
            'get_qc_inspections'  => $this->executeQcInspections($tenantId, $arguments),
            'get_budget_vs_actual'=> $this->executeBudgetVsActual($tenantId, $arguments),
            'get_payables_aging'  => $this->executePayablesAging($tenantId, $arguments),
            'get_payroll_alert'   => $this->executePayrollAlert($tenantId),
            'dispatch_navigation' => $this->executeNavigation($arguments),
            'query_data_bin'      => $this->executeDataBin($tenantId, $arguments),
            'consult_system_sop'  => $this->executeSystemSop($arguments),
            default               => parent::executeTool($toolName, $arguments, $tenantId, $userId, $confirmedBy),
        };
    }

    // -----------------------------------------------------------------------
    // Operations Tool Implementations
    // -----------------------------------------------------------------------

    /** @param array<string, mixed> $args */
    protected function executeSalesSummary(int $tenantId, array $args): array
    {
        $startDate = ! empty($args['start_date']) && is_string($args['start_date'])
            ? Carbon::parse($args['start_date'])->startOfDay()
            : Carbon::now()->startOfMonth()->startOfDay();

        $endDate = ! empty($args['end_date']) && is_string($args['end_date'])
            ? Carbon::parse($args['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        if (! Schema::hasTable('invoices')) {
            return ['error' => 'Invoice table not available.'];
        }

        $revenue    = (float) DB::table('invoices')->where('tenant_id', $tenantId)
            ->whereIn('status', ['posted', 'partially_paid', 'paid'])
            ->whereBetween('invoice_date', [$startDate, $endDate])
            ->sum('total_amount');

        $collected  = (float) DB::table('invoices')->where('tenant_id', $tenantId)
            ->whereIn('status', ['partially_paid', 'paid'])
            ->whereBetween('invoice_date', [$startDate, $endDate])
            ->sum('paid_amount');

        $openAr     = max(0, $revenue - $collected);

        $orderCount = Schema::hasTable('sales_orders')
            ? (int) DB::table('sales_orders')->where('tenant_id', $tenantId)
                ->whereBetween('order_date', [$startDate, $endDate])
                ->count()
            : 0;

        return [
            'period_start'     => $startDate->toDateString(),
            'period_end'       => $endDate->toDateString(),
            'total_revenue'    => round($revenue, 2),
            'collected_cash'   => round($collected, 2),
            'open_ar'          => round($openAr, 2),
            'collection_rate'  => $revenue > 0 ? round(($collected / $revenue) * 100, 1) : 0.0,
            'order_count'      => $orderCount,
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeStockLevel(int $tenantId, array $args): array
    {
        $warehouseId = is_numeric($args['warehouse_id'] ?? null) ? (int) $args['warehouse_id'] : null;
        $includeZero = ! empty($args['include_zero']);

        $query = StockBalance::where('stock_balances.tenant_id', $tenantId)
            ->with('product:id,sku,name,standard_cost,reorder_level')
            ->when($warehouseId !== null, fn ($q) => $q->where('stock_balances.warehouse_id', $warehouseId))
            ->when(! $includeZero, fn ($q) => $q->where('stock_balances.quantity', '>', 0));

        $rows             = $query->get();
        $totalValuation   = 0.0;
        $lowStockCount    = 0;
        $outOfStockCount  = 0;
        $topItems         = [];

        foreach ($rows as $row) {
            $qty      = is_numeric($row->quantity) ? (float) $row->quantity : 0.0;
            $cost     = is_numeric($row->average_cost) ? (float) $row->average_cost : 0.0;
            $value    = round($qty * $cost, 2);
            $totalValuation += $value;
            $reorder  = is_numeric($row->product->reorder_level ?? null) ? (float) $row->product->reorder_level : 0.0;

            if ($qty <= 0) {
                $outOfStockCount++;
            } elseif ($reorder > 0 && $qty <= $reorder) {
                $lowStockCount++;
            }

            $topItems[] = ['name' => $row->product->name ?? '', 'qty' => $qty, 'value' => $value];
        }

        usort($topItems, fn ($a, $b) => $b['value'] <=> $a['value']);

        return [
            'total_valuation'   => round($totalValuation, 2),
            'item_count'        => count($rows),
            'low_stock_count'   => $lowStockCount,
            'out_of_stock_count'=> $outOfStockCount,
            'top_items'         => array_slice($topItems, 0, 5),
            'as_of_date'        => Carbon::now()->toDateString(),
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeProductionStatus(int $tenantId, array $args): array
    {
        if (! Schema::hasTable('production_batches')) {
            return ['error' => 'Production module not available.'];
        }

        $limit  = min(25, max(1, is_numeric($args['limit'] ?? null) ? (int) $args['limit'] : 10));
        $status = is_string($args['status'] ?? null) ? (string) $args['status'] : null;

        $query = DB::table('production_batches')
            ->where('tenant_id', $tenantId)
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->select(['id', 'batch_number', 'status', 'planned_qty', 'actual_qty', 'created_at']);

        $batches = $query->get();

        $summary = DB::table('production_batches')->where('tenant_id', $tenantId)
            ->selectRaw('status, COUNT(*) as cnt, COALESCE(SUM(actual_qty),0) as total_output')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        return [
            'batches'         => $batches->toArray(),
            'status_summary'  => $summary->toArray(),
            'in_progress'     => (int) ($summary->get('in_progress')?->cnt ?? 0),
            'completed_today' => (int) DB::table('production_batches')
                ->where('tenant_id', $tenantId)->where('status', 'completed')
                ->whereDate('updated_at', Carbon::today())->count(),
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executePayrollSummary(int $tenantId, array $args): array
    {
        $month = ! empty($args['month']) && is_string($args['month'])
            ? Carbon::parse($args['month'].'-01')
            : Carbon::now()->startOfMonth();

        if (! Schema::hasTable('payroll_runs')) {
            return $this->estimatePayrollFromHr($tenantId, $month);
        }

        $run = DB::table('payroll_runs')
            ->where('tenant_id', $tenantId)
            ->whereYear('pay_period_start', $month->year)
            ->whereMonth('pay_period_start', $month->month)
            ->first();

        if (! $run) {
            return $this->estimatePayrollFromHr($tenantId, $month);
        }

        return [
            'period'            => $month->format('F Y'),
            'gross_wages'       => (float) ($run->gross_wages ?? 0),
            'net_pay'           => (float) ($run->net_pay ?? 0),
            'total_deductions'  => (float) ($run->total_deductions ?? 0),
            'employer_contrib'  => (float) ($run->employer_contributions ?? 0),
            'status'            => (string) ($run->status ?? 'pending'),
            'employee_count'    => (int) ($run->employee_count ?? 0),
        ];
    }

    /**
     * @param Carbon $month
     * @return array<string, mixed>
     */
    private function estimatePayrollFromHr(int $tenantId, Carbon $month): array
    {
        $staffCount = Schema::hasTable('employees')
            ? (int) DB::table('employees')->where('tenant_id', $tenantId)->where('status', 'active')->count()
            : 0;

        $avgWage = Schema::hasTable('employees')
            ? (float) (DB::table('employees')->where('tenant_id', $tenantId)->where('status', 'active')->avg('basic_salary') ?? 0)
            : 0.0;

        $estimated = round($staffCount * $avgWage, 2);

        return [
            'period'           => $month->format('F Y'),
            'gross_wages'      => $estimated,
            'net_pay'          => round($estimated * 0.88, 2),
            'total_deductions' => round($estimated * 0.12, 2),
            'employer_contrib' => round($estimated * 0.08, 2),
            'status'           => 'estimated',
            'employee_count'   => $staffCount,
            'note'             => 'Estimated from employee base salary records — no payroll run found.',
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executePurchaseOrders(int $tenantId, array $args): array
    {
        if (! Schema::hasTable('purchase_orders')) {
            return ['error' => 'Purchasing module not available.'];
        }

        $limit  = min(25, max(1, is_numeric($args['limit'] ?? null) ? (int) $args['limit'] : 10));
        $status = is_string($args['status'] ?? null) ? (string) $args['status'] : null;

        $rows = DB::table('purchase_orders')
            ->where('purchase_orders.tenant_id', $tenantId)
            ->when($status, fn ($q) => $q->where('purchase_orders.status', $status))
            ->leftJoin('parties', 'purchase_orders.party_id', '=', 'parties.id')
            ->select(['purchase_orders.id', 'purchase_orders.po_number', 'purchase_orders.status',
                'purchase_orders.total_amount', 'purchase_orders.order_date', 'parties.name as supplier_name'])
            ->orderByDesc('purchase_orders.order_date')
            ->limit($limit)
            ->get();

        $totalAp = (float) DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['received', 'partially_received'])
            ->sum('total_amount');

        return [
            'orders'     => $rows->toArray(),
            'total_ap'   => round($totalAp, 2),
            'open_count' => (int) DB::table('purchase_orders')
                ->where('tenant_id', $tenantId)->whereNotIn('status', ['cancelled', 'closed'])->count(),
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeQcInspections(int $tenantId, array $args): array
    {
        if (! Schema::hasTable('qc_inspections')) {
            return ['error' => 'QC module not available.'];
        }

        $startDate = ! empty($args['start_date']) ? Carbon::parse((string) $args['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate   = ! empty($args['end_date']) ? Carbon::parse((string) $args['end_date'])->endOfDay() : Carbon::now()->endOfDay();

        $stats = DB::table('qc_inspections')
            ->where('tenant_id', $tenantId)
            ->whereBetween('inspected_at', [$startDate, $endDate])
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN result = \'pass\' THEN 1 ELSE 0 END) as passed, SUM(CASE WHEN result = \'fail\' THEN 1 ELSE 0 END) as failed')
            ->first();

        $total  = (int) ($stats?->total ?? 0);
        $passed = (int) ($stats?->passed ?? 0);
        $failed = (int) ($stats?->failed ?? 0);

        return [
            'period_start'  => $startDate->toDateString(),
            'period_end'    => $endDate->toDateString(),
            'total'         => $total,
            'passed'        => $passed,
            'failed'        => $failed,
            'pass_rate_pct' => $total > 0 ? round(($passed / $total) * 100, 1) : 0.0,
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeBudgetVsActual(int $tenantId, array $args): array
    {
        // Use report engine for budget vs actual
        try {
            $period = is_string($args['period'] ?? null) ? (string) $args['period'] : Carbon::now()->format('Y-m');
            $parts  = explode('-', $period);
            $year   = $parts[0] ?? Carbon::now()->format('Y');
            $month  = $parts[1] ?? Carbon::now()->format('m');

            $startDate = Carbon::parse("{$year}-{$month}-01")->startOfDay();
            $endDate   = $startDate->copy()->endOfMonth();

            $actual = (float) DB::table('expenses')
                ->where('tenant_id', $tenantId)
                ->whereBetween('expense_date', [$startDate, $endDate])
                ->sum('amount');

            $revenue = (float) DB::table('invoices')
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'partially_paid', 'paid'])
                ->whereBetween('invoice_date', [$startDate, $endDate])
                ->sum('total_amount');

            // Check if budget table exists
            $budgetRevenue  = 0.0;
            $budgetExpenses = 0.0;

            if (Schema::hasTable('budgets')) {
                $budgetRevenue  = (float) DB::table('budgets')
                    ->where('tenant_id', $tenantId)
                    ->where('type', 'revenue')
                    ->whereYear('period_date', $year)->whereMonth('period_date', $month)
                    ->sum('amount');

                $budgetExpenses = (float) DB::table('budgets')
                    ->where('tenant_id', $tenantId)
                    ->where('type', 'expense')
                    ->whereYear('period_date', $year)->whereMonth('period_date', $month)
                    ->sum('amount');
            }

            return [
                'period'              => $startDate->format('F Y'),
                'revenue_actual'      => round($revenue, 2),
                'revenue_budget'      => round($budgetRevenue, 2),
                'revenue_variance'    => round($revenue - $budgetRevenue, 2),
                'revenue_variance_pct'=> $budgetRevenue > 0 ? round((($revenue - $budgetRevenue) / $budgetRevenue) * 100, 1) : 0.0,
                'expense_actual'      => round($actual, 2),
                'expense_budget'      => round($budgetExpenses, 2),
                'expense_variance'    => round($actual - $budgetExpenses, 2),
                'expense_variance_pct'=> $budgetExpenses > 0 ? round((($actual - $budgetExpenses) / $budgetExpenses) * 100, 1) : 0.0,
                'note'                => $budgetRevenue === 0.0 ? 'No budget entries found for this period.' : null,
            ];
        } catch (Throwable $e) {
            return ['error' => 'Budget analysis failed: '.$e->getMessage()];
        }
    }

    /** @param array<string, mixed> $args */
    protected function executePayablesAging(int $tenantId, array $args): array
    {
        try {
            $limit = min(25, max(1, is_numeric($args['limit'] ?? null) ? (int) $args['limit'] : 10));
            $now   = Carbon::now();

            if (Schema::hasTable('purchase_bills')) {
                $rows = DB::table('purchase_bills')
                    ->where('purchase_bills.tenant_id', $tenantId)
                    ->whereIn('purchase_bills.status', ['posted', 'partially_paid'])
                    ->leftJoin('parties', 'purchase_bills.party_id', '=', 'parties.id')
                    ->select([
                        'purchase_bills.id',
                        'purchase_bills.status',
                        DB::raw('purchase_bills.total_amount - COALESCE(purchase_bills.paid_amount, 0) as total_amount'),
                        'parties.name as supplier_name',
                        DB::raw('COALESCE(purchase_bills.due_date, purchase_bills.bill_date) as ap_due_date'),
                    ])
                    ->orderByRaw('ap_due_date ASC')
                    ->limit($limit)
                    ->get();
            } elseif (Schema::hasTable('purchase_orders')) {
                $rows = DB::table('purchase_orders')
                    ->where('purchase_orders.tenant_id', $tenantId)
                    ->whereIn('purchase_orders.status', ['received', 'partially_received'])
                    ->leftJoin('parties', 'purchase_orders.party_id', '=', 'parties.id')
                    ->select([
                        'purchase_orders.id',
                        'purchase_orders.status',
                        'purchase_orders.total_amount',
                        'parties.name as supplier_name',
                        DB::raw('COALESCE(purchase_orders.expected_date, purchase_orders.order_date) as ap_due_date'),
                    ])
                    ->orderByRaw('ap_due_date ASC')
                    ->limit($limit)
                    ->get();
            } else {
                return ['error' => 'Purchasing and payables module not available.'];
            }

            $buckets = ['0-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0];
            $total   = 0.0;
            $items   = [];

            foreach ($rows as $row) {
                $amt     = is_numeric($row->total_amount) ? (float) $row->total_amount : 0.0;
                $dueDate = is_string($row->ap_due_date ?? null) ? Carbon::parse($row->ap_due_date) : $now;
                $days    = max(0, (int) $dueDate->diffInDays($now, false));
                $total  += $amt;

                $bucket = match (true) {
                    $days <= 30 => '0-30',
                    $days <= 60 => '31-60',
                    $days <= 90 => '61-90',
                    default     => '90+',
                };
                $buckets[$bucket] += $amt;

                $items[] = [
                    'supplier'     => is_string($row->supplier_name ?? null) ? $row->supplier_name : 'Unknown',
                    'amount'       => round($amt, 2),
                    'due_date'     => $dueDate->toDateString(),
                    'days_overdue' => $days,
                    'bucket'       => $bucket,
                    'status'       => $row->status,
                ];
            }

            return [
                'total_payables' => round($total, 2),
                'aging_buckets'  => array_map(fn ($v) => round($v, 2), $buckets),
                'items'          => $items,
            ];
        } catch (Throwable $e) {
            return ['error' => 'Payables aging calculation failed: '.$e->getMessage()];
        }
    }

    protected function executePayrollAlert(int $tenantId): array
    {
        $payroll   = $this->executePayrollSummary($tenantId, []);
        $cashPos   = $this->executeCashPosition($tenantId, []);
        $grossWage = is_numeric($payroll['gross_wages'] ?? null) ? (float) $payroll['gross_wages'] : 0.0;
        $cash      = is_numeric($cashPos['total_liquid_cash'] ?? null) ? (float) $cashPos['total_liquid_cash'] : 0.0;
        $gap       = round($cash - $grossWage, 2);

        return [
            'payroll_due'    => round($grossWage, 2),
            'cash_available' => round($cash, 2),
            'cash_gap'       => $gap,
            'can_meet'       => $gap >= 0,
            'risk'           => match (true) {
                $gap < 0       => 'critical',
                $gap < $grossWage * 0.5 => 'moderate',
                default        => 'low',
            },
            'recommendation' => $gap < 0
                ? 'Insufficient cash for upcoming payroll. Accelerate AR collection or draw on credit facility immediately.'
                : ($gap < $grossWage * 0.5
                    ? 'Cash buffer is tight after payroll. Monitor closely and defer non-critical expenses.'
                    : 'Cash position is sufficient to meet payroll obligations.'),
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeNavigation(array $args): array
    {
        $module  = is_string($args['module'] ?? null) ? strtolower((string) $args['module']) : '';
        $subpath = is_string($args['subpath'] ?? null) ? '/'.ltrim((string) $args['subpath'], '/') : '';

        $map = [
            'sales'      => '/sales',
            'inventory'  => '/inventory',
            'finance'    => '/finance',
            'hr'         => '/hr',
            'production' => '/production',
            'purchasing' => '/purchasing',
            'qc'         => '/qc',
            'reports'    => '/reports',
            'settings'   => '/settings',
            'ai'         => '/ai',
            'dashboard'  => '/dashboard',
        ];

        $base = $map[$module] ?? '/dashboard';

        return [
            'url'    => $base.$subpath,
            'module' => $module,
            'label'  => 'Navigate to '.ucfirst($module),
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeDataBin(int $tenantId, array $args): array
    {
        $entity = is_string($args['entity'] ?? null) ? (string) $args['entity'] : null;
        $limit  = min(25, max(1, is_numeric($args['limit'] ?? null) ? (int) $args['limit'] : 10));

        $tableMap = [
            'products'  => 'products',
            'invoices'  => 'invoices',
            'orders'    => 'sales_orders',
            'parties'   => 'parties',
            'employees' => 'employees',
        ];

        $results = [];

        $tables = $entity && isset($tableMap[$entity])
            ? [$entity => $tableMap[$entity]]
            : $tableMap;

        foreach ($tables as $label => $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            if (! Schema::hasColumn($table, 'deleted_at')) {
                continue;
            }

            $count = (int) DB::table($table)
                ->where('tenant_id', $tenantId)
                ->whereNotNull('deleted_at')
                ->count();

            if ($count > 0) {
                $results[] = ['entity' => $label, 'deleted_count' => $count];
            }
        }

        return [
            'entities_with_deleted' => $results,
            'total_deleted'         => array_sum(array_column($results, 'deleted_count')),
            'note'                  => 'Use the Data Bin workspace (/settings → Data Bin) to restore records.',
        ];
    }

    /** @param array<string, mixed> $args */
    protected function executeSystemSop(array $args): array
    {
        $topic = strtolower(is_string($args['topic'] ?? null) ? (string) $args['topic'] : '');

        $sops = [
            'fifo'        => 'FIFO (First-In, First-Out) costing: inventory is valued at the cost of the oldest stock first. When goods are sold/consumed, the system uses the earliest purchase cost.',
            'avco'        => 'AVCO (Average Cost / WAC): inventory cost is recalculated as a weighted average each time new stock arrives. Formula: (existing_qty × existing_avg + new_qty × new_cost) / (existing_qty + new_qty).',
            'journal'     => 'Journal postings follow double-entry: every debit has an equal credit. Sales post: Debit AR, Credit Revenue. Payments post: Debit Cash/Bank, Credit AR. COGS post: Debit COGS, Credit Inventory.',
            'permission'  => 'Permission tiers: Tier 0 = read-only (auto-execute), Tier 1 = advisory (manager review), Tier 2 = supervised mutations (explicit operator confirmation required).',
            'grn'         => '3-way matching: Purchase Order → Goods Received Note → Vendor Bill must all match in qty and price before a vendor bill can be posted and paid.',
            'payroll'     => 'Payroll flow: HR creates payroll run → salary lines generated per employee → deductions (tax, PF, etc.) calculated → net pay disbursed → bank journal entry posted.',
        ];

        foreach ($sops as $key => $text) {
            if (str_contains($topic, $key)) {
                return ['topic' => $key, 'explanation' => $text];
            }
        }

        return [
            'available_topics' => array_keys($sops),
            'note'             => "No specific SOP found for '{$topic}'. Try one of the available topics.",
        ];
    }
}
