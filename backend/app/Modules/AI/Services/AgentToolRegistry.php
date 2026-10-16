<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Models\CashFlowAlert;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Reports\Actions\RunReportQueryAction;
use App\Modules\Sales\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class AgentToolRegistry
{
    public function __construct(
        protected FinancingMatchEngine $financingMatchEngine,
        protected RunReportQueryAction $runReportQueryAction,
        protected AgentPermissionGuard $permissionGuard
    ) {}

    /**
     * Get the JSON Schema for all registered OpenAI Function Calling tools.
     *
     * @return list<array<string, mixed>>
     */
    public function getOpenAiToolSchemas(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_cash_position',
                    'description' => 'Retrieve live liquidity and balances across all active bank and cash accounts for the enterprise.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'account_type' => [
                                'type' => 'string',
                                'description' => 'Optional filter by account type: bank, cash, or mobile_banking',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'list_overdue_invoices',
                    'description' => 'Retrieve uncollected and overdue customer sales invoices with debtor details, overdue days, and amounts.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'days_overdue' => [
                                'type' => 'integer',
                                'description' => 'Minimum number of days overdue (default 0 for all pending due).',
                            ],
                            'limit' => [
                                'type' => 'integer',
                                'description' => 'Maximum number of records to return (default 10).',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_pl_summary',
                    'description' => 'Get Income Statement (Profit & Loss) summary covering revenue, operating expenses, and net margins.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'start_date' => [
                                'type' => 'string',
                                'description' => 'Period start date (YYYY-MM-DD). Defaults to 30 days ago.',
                            ],
                            'end_date' => [
                                'type' => 'string',
                                'description' => 'Period end date (YYYY-MM-DD). Defaults to today.',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'analyze_cash_flow_risk',
                    'description' => 'Run holistic liquidity risk and cash runway assessment comparing cash on hand against pending AP bills, AR receivables, and operating burn rate.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'forecast_days' => [
                                'type' => 'integer',
                                'description' => 'Horizon in days for forward runway projection (default 30).',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'match_financing_options',
                    'description' => 'Recommend optimal SME credit and working capital facilities (Working Capital Term, Invoice Factoring, Inventory Financing, Machinery Leasing) with eligibility and loan limits.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'monthly_revenue' => [
                                'type' => 'number',
                                'description' => 'Optional override for average monthly revenue (BDT).',
                            ],
                            'inventory_value' => [
                                'type' => 'number',
                                'description' => 'Optional override for inventory asset value (BDT).',
                            ],
                            'ar_outstanding' => [
                                'type' => 'number',
                                'description' => 'Optional override for receivables outstanding (BDT).',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_inventory_value',
                    'description' => 'Fetch total stock valuation (AVCO), current quantities, and identify low-stock capital ties across warehouses.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'warehouse_id' => [
                                'type' => 'integer',
                                'description' => 'Optional warehouse filter.',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'create_cash_flow_alert',
                    'description' => 'TIER 2 (SUPERVISED): Create an official financial monitoring alert in the system. Requires operator verification.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'alert_type' => [
                                'type' => 'string',
                                'enum' => ['low_balance', 'overdue_ar', 'upcoming_ap', 'payroll_due', 'low_stock_value'],
                                'description' => 'Category of financial alert.',
                            ],
                            'severity' => [
                                'type' => 'string',
                                'enum' => ['info', 'warning', 'critical'],
                                'description' => 'Severity level.',
                            ],
                            'title' => [
                                'type' => 'string',
                                'description' => 'Concise title for the alert.',
                            ],
                            'description' => [
                                'type' => 'string',
                                'description' => 'Detailed context and recommended corrective action.',
                            ],
                            'threshold_value' => [
                                'type' => 'number',
                                'description' => 'Threshold triggering the alert.',
                            ],
                            'actual_value' => [
                                'type' => 'number',
                                'description' => 'Current actual value.',
                            ],
                            'currency' => [
                                'type' => 'string',
                                'description' => 'Currency code (default BDT).',
                            ],
                        ],
                        'required' => ['alert_type', 'severity', 'title', 'description'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_report_data',
                    'description' => 'Query standard ERP reports (e.g., income_statement, customer_ar_aging, current_stock, supplier_ap_aging, cash_bank_ledger) with parameters.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'report_code' => [
                                'type' => 'string',
                                'description' => 'Canonical report code.',
                            ],
                            'filters' => [
                                'type' => 'object',
                                'description' => 'Key-value filters like start_date, end_date, etc.',
                            ],
                            'limit' => [
                                'type' => 'integer',
                                'description' => 'Row limit (default 25).',
                            ],
                        ],
                        'required' => ['report_code'],
                    ],
                ],
            ],
        ];
    }

    /**
     * Convert the OpenAI function schemas to Anthropic Messages tool shape.
     *
     * @return list<array<string, mixed>>
     */
    public function getAnthropicToolSchemas(): array
    {
        $tools = [];

        foreach ($this->getOpenAiToolSchemas() as $schema) {
            $function = is_array($schema['function'] ?? null) ? $schema['function'] : [];

            $tools[] = [
                'name' => $function['name'] ?? '',
                'description' => $function['description'] ?? '',
                'input_schema' => $function['parameters'] ?? [
                    'type' => 'object',
                    'properties' => [],
                    'required' => [],
                ],
            ];
        }

        return $tools;
    }

    /**
     * Dispatch and execute a recognized tool call.
     *
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
            'get_cash_position' => $this->executeCashPosition($tenantId, $arguments),
            'list_overdue_invoices' => $this->executeListOverdueInvoices($tenantId, $arguments),
            'get_pl_summary' => $this->executePlSummary($tenantId, $arguments),
            'analyze_cash_flow_risk' => $this->executeAnalyzeCashFlowRisk($tenantId, $arguments),
            'match_financing_options' => $this->financingMatchEngine->assessAndMatch($tenantId, $userId, $arguments),
            'get_inventory_value' => $this->executeInventoryValue($tenantId, $arguments),
            'create_cash_flow_alert' => $this->executeCreateCashFlowAlert($tenantId, $arguments, $confirmedBy),
            'get_report_data' => $this->executeReportData($tenantId, $arguments),
            default => [
                'error' => "Unknown tool '{$toolName}'",
            ],
        };
    }

    // --- Tool Implementation Methods ---

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeCashPosition(int $tenantId, array $arguments): array
    {
        $query = BankAccount::where('tenant_id', $tenantId)->where('is_active', true);

        if (! empty($arguments['account_type'])) {
            $query->where('account_type', $arguments['account_type']);
        }

        $accounts = $query->get()->map(function (BankAccount $account): array {
            return [
                'uuid' => $account->uuid,
                'name' => $account->name,
                'account_number' => $account->account_number ? '••••'.substr($account->account_number, -4) : null,
                'bank_name' => $account->bank_name,
                'account_type' => $account->account_type,
                'current_balance' => (float) $account->current_balance,
                'currency' => $account->currency ?? 'BDT',
            ];
        });

        $totalBalance = is_numeric($accounts->sum('current_balance')) ? (float) $accounts->sum('current_balance') : 0.0;

        return [
            'total_liquidity' => round($totalBalance, 2),
            'currency' => 'BDT',
            'account_count' => $accounts->count(),
            'accounts' => $accounts->all(),
            'as_of' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeListOverdueInvoices(int $tenantId, array $arguments): array
    {
        $daysOverdue = max(0, is_numeric($arguments['days_overdue'] ?? null) ? (int) $arguments['days_overdue'] : 0);
        $limit = min(50, max(1, is_numeric($arguments['limit'] ?? null) ? (int) $arguments['limit'] : 10));
        $now = Carbon::now();

        if (! Schema::hasTable('invoices')) {
            return ['overdue_invoices' => [], 'total_overdue' => 0];
        }

        $query = Invoice::where('invoices.tenant_id', $tenantId)
            ->whereIn('invoices.payment_status', ['unpaid', 'partially_paid'])
            ->where('invoices.due_date', '<', $now->copy()->subDays($daysOverdue))
            ->leftJoin('parties', 'invoices.customer_id', '=', 'parties.id')
            ->select([
                'invoices.uuid',
                'invoices.invoice_number',
                'parties.name as customer_name',
                'invoices.invoice_date',
                'invoices.due_date',
                'invoices.total_amount',
                'invoices.paid_amount',
                DB::raw('(invoices.total_amount - invoices.paid_amount) as outstanding_amount'),
            ])
            ->orderBy('invoices.due_date', 'asc')
            ->limit($limit);

        $results = $query->get()->map(function ($inv) use ($now): array {
            $dueDate = Carbon::parse($inv->due_date);
            $daysPast = max(0, (int) $dueDate->diffInDays($now, false));
            $rawOutstanding = is_numeric($inv->outstanding_amount ?? null) ? (float) $inv->outstanding_amount : 0.0;

            return [
                'uuid' => (string) $inv->uuid,
                'invoice_number' => (string) $inv->invoice_number,
                'customer_name' => is_string($inv->customer_name ?? null) ? (string) $inv->customer_name : 'Walk-in Customer',
                'due_date' => (string) $inv->due_date,
                'days_overdue' => $daysPast,
                'outstanding_amount' => round($rawOutstanding, 2),
                'currency' => 'BDT',
            ];
        });

        $totalOverdueSum = (float) (Invoice::where('tenant_id', $tenantId)
            ->whereIn('payment_status', ['unpaid', 'partially_paid'])
            ->where('due_date', '<', $now)
            ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as total')
            ->first()?->getAttribute('total') ?? 0.0);

        return [
            'total_overdue_amount' => round($totalOverdueSum, 2),
            'currency' => 'BDT',
            'returned_count' => $results->count(),
            'invoices' => $results->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executePlSummary(int $tenantId, array $arguments): array
    {
        $startDate = ! empty($arguments['start_date']) && is_string($arguments['start_date'])
            ? Carbon::parse($arguments['start_date'])->startOfDay()
            : Carbon::now()->subDays(30)->startOfDay();

        $endDate = ! empty($arguments['end_date']) && is_string($arguments['end_date'])
            ? Carbon::parse($arguments['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        $totalRevenue = 0.0;
        if (Schema::hasTable('invoices')) {
            $totalRevenue = (float) Invoice::where('tenant_id', $tenantId)
                ->whereBetween('invoice_date', [$startDate, $endDate])
                ->sum('total_amount');
        }

        $totalExpenses = 0.0;
        $expensesByCategory = [];
        if (Schema::hasTable('expenses')) {
            $totalExpenses = (float) Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->sum('expenses.amount');

            $expensesByCategory = Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->leftJoin('expense_categories', 'expenses.category_id', '=', 'expense_categories.id')
                ->selectRaw('COALESCE(expense_categories.name, "General") as category, SUM(expenses.amount) as total')
                ->groupBy('expense_categories.name')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row) => ['category' => $row->category, 'amount' => round((float) $row->total, 2)])
                ->all();
        }

        $netProfit = $totalRevenue - $totalExpenses;
        $profitMargin = $totalRevenue > 0 ? round(($netProfit / $totalRevenue) * 100, 2) : 0.0;

        return [
            'period' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'total_revenue' => round($totalRevenue, 2),
            'total_expenses' => round($totalExpenses, 2),
            'net_profit' => round($netProfit, 2),
            'net_margin_percentage' => $profitMargin,
            'top_expense_categories' => $expensesByCategory,
            'currency' => 'BDT',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeAnalyzeCashFlowRisk(int $tenantId, array $arguments): array
    {
        $forecastDays = is_numeric($arguments['forecast_days'] ?? null) ? (int) $arguments['forecast_days'] : 30;
        $horizonDays = max(7, min(90, $forecastDays));

        $metrics = $this->financingMatchEngine->gatherFinancialMetrics($tenantId);
        $bankBalance = is_numeric($metrics['bank_balance'] ?? null) ? (float) $metrics['bank_balance'] : 0.0;
        $ar = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;
        $ap = is_numeric($metrics['ap_outstanding'] ?? null) ? (float) $metrics['ap_outstanding'] : 0.0;
        $expenses = is_numeric($metrics['monthly_expenses'] ?? null) ? (float) $metrics['monthly_expenses'] : 0.0;
        $dailyBurnRate = $expenses / 30.0;

        // Estimated collections: 70% of current AR within horizon
        $expectedCollections = $ar * 0.70;
        $projectedLiquidity = $bankBalance + $expectedCollections - $ap - ($dailyBurnRate * $horizonDays);

        $runwayDays = $dailyBurnRate > 0 ? (int) floor($bankBalance / $dailyBurnRate) : 999;

        // Risk grading
        if ($runwayDays < 15 || $projectedLiquidity < 0) {
            $riskLevel = 'CRITICAL';
            $recommendation = 'Immediate liquidity intervention required. Accelerate AR collection via discounting and defer non-critical capex.';
        } elseif ($runwayDays < 30) {
            $riskLevel = 'HIGH';
            $recommendation = 'Short runway. Apply for Working Capital or Invoice Factoring facility to buffer upcoming payables.';
        } elseif ($runwayDays < 60) {
            $riskLevel = 'MEDIUM';
            $recommendation = 'Adequate cash buffer. Maintain disciplined supplier payment terms and monitor receivables aging.';
        } else {
            $riskLevel = 'LOW';
            $recommendation = 'Healthy liquidity buffer. Consider deploying surplus capital into inventory or high-margin product lines.';
        }

        return [
            'risk_level' => $riskLevel,
            'cash_on_hand' => round($bankBalance, 2),
            'receivables_expected_70pct' => round($expectedCollections, 2),
            'payables_due' => round($ap, 2),
            'daily_burn_rate' => round($dailyBurnRate, 2),
            'estimated_runway_days' => $runwayDays,
            'net_projected_cash_at_horizon' => round($projectedLiquidity, 2),
            'horizon_days' => $horizonDays,
            'recommendation' => $recommendation,
            'currency' => 'BDT',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeInventoryValue(int $tenantId, array $arguments): array
    {
        $warehouseId = is_numeric($arguments['warehouse_id'] ?? null) ? (int) $arguments['warehouse_id'] : null;

        $query = StockBalance::where('stock_balances.tenant_id', $tenantId);
        if ($warehouseId !== null) {
            $query->where('stock_balances.warehouse_id', $warehouseId);
        }

        $totalUnits = (float) $query->sum('quantity');
        $totalValuation = (float) (StockBalance::where('stock_balances.tenant_id', $tenantId)
            ->when($warehouseId !== null, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->selectRaw('COALESCE(SUM(quantity * average_cost), 0) as val')
            ->first()?->getAttribute('val') ?? 0.0);

        return [
            'total_units' => round($totalUnits, 2),
            'total_valuation' => round($totalValuation, 2),
            'currency' => 'BDT',
            'warehouse_filter' => $warehouseId,
            'as_of' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeCreateCashFlowAlert(int $tenantId, array $arguments, ?int $confirmedBy = null): array
    {
        // Enforce Tier 2 confirmation requirement
        if ($confirmedBy === null) {
            return [
                'status' => 'PENDING_CONFIRMATION',
                'tier' => 2,
                'message' => 'Action requires explicit operator confirmation before saving to database.',
                'payload' => $arguments,
            ];
        }

        $alertType = is_string($arguments['alert_type'] ?? null) ? (string) $arguments['alert_type'] : 'low_balance';
        $severity = is_string($arguments['severity'] ?? null) ? (string) $arguments['severity'] : 'warning';
        $title = is_string($arguments['title'] ?? null) ? (string) $arguments['title'] : 'Cash Flow Alert';
        $description = is_string($arguments['description'] ?? null) ? (string) $arguments['description'] : null;
        $thresholdValue = isset($arguments['threshold_value']) && is_numeric($arguments['threshold_value']) ? (string) $arguments['threshold_value'] : null;
        $actualValue = isset($arguments['actual_value']) && is_numeric($arguments['actual_value']) ? (string) $arguments['actual_value'] : null;
        $currency = is_string($arguments['currency'] ?? null) ? (string) $arguments['currency'] : 'BDT';

        $alert = CashFlowAlert::create([
            'tenant_id' => $tenantId,
            'alert_type' => $alertType,
            'severity' => $severity,
            'title' => $title,
            'description' => $description,
            'threshold_value' => $thresholdValue,
            'actual_value' => $actualValue,
            'currency' => $currency,
            'status' => 'active',
            'generated_by' => 'agent',
            'acknowledged_by' => $confirmedBy,
        ]);

        return [
            'status' => 'CONFIRMED_AND_CREATED',
            'alert_uuid' => $alert->uuid,
            'alert_id' => $alert->id,
            'title' => $alert->title,
            'severity' => $alert->severity,
            'created_at' => $alert->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function executeReportData(int $tenantId, array $arguments): array
    {
        $reportCode = is_string($arguments['report_code'] ?? null) ? (string) $arguments['report_code'] : 'income_statement';
        $filters = is_array($arguments['filters'] ?? null) ? $arguments['filters'] : [];
        $limit = min(50, max(1, is_numeric($arguments['limit'] ?? null) ? (int) $arguments['limit'] : 25));

        try {
            return $this->runReportQueryAction->execute($reportCode, $filters, 1, $limit);
        } catch (Throwable $e) {
            return [
                'error' => 'Report query failed: '.$e->getMessage(),
                'report_code' => $reportCode,
            ];
        }
    }
}
