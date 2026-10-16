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

        $accounts = $query->orderBy('id', 'asc')->get();

        $bankBalance = 0.0;
        $cashOnHand = 0.0;
        $breakdown = [];

        foreach ($accounts as $account) {
            $balance = is_numeric($account->current_balance) ? (float) $account->current_balance : 0.0;

            if ($account->account_type === 'cash') {
                $cashOnHand += $balance;
            } else {
                $bankBalance += $balance;
            }

            $breakdown[] = [
                'id' => (int) $account->id,
                'code' => (string) ($account->code ?? $account->account_number ?? $account->uuid),
                'name' => (string) $account->name,
                'type' => (string) ($account->account_type ?? 'bank'),
                'balance' => round($balance, 2),
            ];
        }

        $totalLiquidCash = $bankBalance + $cashOnHand;
        $monthlyExpenses = (float) $this->financingMatchEngine->gatherFinancialMetrics($tenantId)['monthly_expenses'];
        $dailyBurnRate = round($monthlyExpenses / 30.0, 2);
        $runwayDays = $dailyBurnRate > 0 ? (int) floor($totalLiquidCash / $dailyBurnRate) : 999;

        if ($runwayDays >= 60) {
            $healthStatus = 'healthy';
        } elseif ($runwayDays >= 30) {
            $healthStatus = 'moderate';
        } else {
            $healthStatus = 'critical';
        }

        return [
            'total_liquid_cash' => round($totalLiquidCash, 2),
            'bank_balance' => round($bankBalance, 2),
            'cash_on_hand' => round($cashOnHand, 2),
            'accounts_breakdown' => $breakdown,
            'daily_burn_rate' => $dailyBurnRate,
            'runway_days' => $runwayDays,
            'health_status' => $healthStatus,
            'as_of_date' => Carbon::now()->toDateString(),
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

        $empty = [
            'total_overdue' => 0.0,
            'total_invoices_count' => 0,
            'aging_summary' => ['1-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0],
            'invoices' => [],
        ];

        if (! Schema::hasTable('invoices')) {
            return $empty;
        }

        $rows = Invoice::where('invoices.tenant_id', $tenantId)
            ->whereIn('invoices.status', ['posted', 'partially_paid'])
            ->where('invoices.due_date', '<', $now->copy()->subDays($daysOverdue))
            ->leftJoin('parties', 'invoices.party_id', '=', 'parties.id')
            ->select([
                'invoices.id',
                'invoices.invoice_number',
                'parties.name as customer_name',
                'invoices.due_date',
                'invoices.total_amount',
                'invoices.paid_amount',
            ])
            ->orderBy('invoices.due_date', 'asc')
            ->limit($limit)
            ->get();

        $buckets = ['1-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0];
        $invoices = [];

        foreach ($rows as $row) {
            $dueDate = Carbon::parse((string) $row->due_date);
            $daysPast = max(0, (int) $dueDate->diffInDays($now, false));
            $total = is_numeric($row->total_amount) ? (float) $row->total_amount : 0.0;
            $paid = is_numeric($row->paid_amount) ? (float) $row->paid_amount : 0.0;
            $due = max(0.0, $total - $paid);

            if ($daysPast <= 30) {
                $bucket = '1-30';
            } elseif ($daysPast <= 60) {
                $bucket = '31-60';
            } elseif ($daysPast <= 90) {
                $bucket = '61-90';
            } else {
                $bucket = '90+';
            }

            $buckets[$bucket] += $due;

            $invoices[] = [
                'id' => (int) $row->id,
                'invoice_number' => (string) $row->invoice_number,
                'customer_name' => is_string($row->customer_name ?? null) ? (string) $row->customer_name : 'Walk-in Customer',
                'total_amount' => round($total, 2),
                'amount_paid' => round($paid, 2),
                'amount_due' => round($due, 2),
                'due_date' => $dueDate->toDateString(),
                'days_overdue' => $daysPast,
                'aging_bucket' => $bucket,
            ];
        }

        $totalOverdue = (float) (Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', ['posted', 'partially_paid'])
            ->where('due_date', '<', $now)
            ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as total')
            ->value('total') ?? 0.0);

        return [
            'total_overdue' => round(max(0.0, $totalOverdue), 2),
            'total_invoices_count' => $rows->count(),
            'aging_summary' => [
                '1-30' => round($buckets['1-30'], 2),
                '31-60' => round($buckets['31-60'], 2),
                '61-90' => round($buckets['61-90'], 2),
                '90+' => round($buckets['90+'], 2),
            ],
            'invoices' => $invoices,
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
                ->whereIn('status', ['posted', 'partially_paid', 'paid'])
                ->whereBetween('invoice_date', [$startDate, $endDate])
                ->sum('total_amount');
        }

        $totalExpenses = 0.0;
        $expenseBreakdown = [];
        if (Schema::hasTable('expenses')) {
            $totalExpenses = (float) Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->sum('expenses.amount');

            $expenseBreakdown = Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->leftJoin('expense_categories', 'expenses.expense_category_id', '=', 'expense_categories.id')
                ->selectRaw('COALESCE(expense_categories.name, "General") as category, SUM(expenses.amount) as total')
                ->groupBy('expense_categories.name')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row): array => [
                    'category' => (string) $row->category,
                    'amount' => round((float) $row->total, 2),
                    'pct_of_total' => $totalExpenses > 0
                        ? round(((float) $row->total / $totalExpenses) * 100, 2)
                        : 0.0,
                ])
                ->all();
        }

        // COGS comes from posted ledger balances on cost_of_goods_sold accounts.
        $cogs = 0.0;
        if (Schema::hasTable('chart_of_accounts') && Schema::hasTable('journal_lines')) {
            $cogsRow = DB::table('chart_of_accounts as coa')
                ->leftJoin('journal_lines as jl', 'coa.id', '=', 'jl.account_id')
                ->where('coa.tenant_id', $tenantId)
                ->where('coa.account_type', 'cost_of_goods_sold')
                ->whereNull('coa.deleted_at')
                ->selectRaw('COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) as cogs')
                ->value('cogs');

            $cogs = max(0.0, (float) $cogsRow);
        }

        $grossProfit = $totalRevenue - $cogs;
        $netOperatingIncome = $grossProfit - $totalExpenses;

        return [
            'period_start' => $startDate->toDateString(),
            'period_end' => $endDate->toDateString(),
            'total_revenue' => round($totalRevenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'gross_margin_pct' => $totalRevenue > 0 ? round(($grossProfit / $totalRevenue) * 100, 2) : 0.0,
            'operating_expenses' => round($totalExpenses, 2),
            'net_operating_income' => round($netOperatingIncome, 2),
            'net_margin_pct' => $totalRevenue > 0 ? round(($netOperatingIncome / $totalRevenue) * 100, 2) : 0.0,
            'expense_breakdown' => $expenseBreakdown,
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
        $startingCash = is_numeric($metrics['bank_balance'] ?? null) ? (float) $metrics['bank_balance'] : 0.0;
        $ar = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;
        $ap = is_numeric($metrics['ap_outstanding'] ?? null) ? (float) $metrics['ap_outstanding'] : 0.0;
        $monthlyExpenses = is_numeric($metrics['monthly_expenses'] ?? null) ? (float) $metrics['monthly_expenses'] : 0.0;

        $dailyBurnRate = $monthlyExpenses / 30.0;
        $projectedInflows = round($ar * 0.70, 2);
        $projectedOutflows = round($ap + ($dailyBurnRate * $horizonDays), 2);
        $projectedNet = round($projectedInflows - $projectedOutflows, 2);
        $endingCash = round($startingCash + $projectedNet, 2);
        $liquidityShortfall = $endingCash < 0;
        $shortfallAmount = $liquidityShortfall ? round(abs($endingCash), 2) : 0.0;

        $daysUntilDeficit = null;
        if ($dailyBurnRate > 0) {
            $daysUntilDeficit = $startingCash + $projectedInflows >= $projectedOutflows
                ? null
                : max(0, (int) floor(($startingCash + $projectedInflows) / $dailyBurnRate));
        }

        if ($daysUntilDeficit !== null && $daysUntilDeficit < 15) {
            $riskLevel = 'critical';
            $actions = [
                'Accelerate overdue receivables collection',
                'Apply for invoice discounting against validated AR',
                'Defer all non-critical capital expenditure',
            ];
        } elseif ($daysUntilDeficit !== null && $daysUntilDeficit < 30) {
            $riskLevel = 'severe';
            $actions = [
                'Accelerate overdue receivables collection',
                'Negotiate extended supplier payment terms',
                'Secure a working capital facility before the deficit window',
            ];
        } elseif ($liquidityShortfall) {
            $riskLevel = 'moderate';
            $actions = [
                'Tighten receivables follow-up on 31-60 day buckets',
                'Reschedule discretionary operating expenses',
            ];
        } else {
            $riskLevel = 'low';
            $actions = [
                'Maintain current collection discipline',
                'Consider deploying surplus liquidity into inventory or high-margin lines',
            ];
        }

        return [
            'horizon_days' => $horizonDays,
            'starting_cash' => round($startingCash, 2),
            'projected_inflows' => $projectedInflows,
            'projected_outflows' => $projectedOutflows,
            'projected_net_cash_flow' => $projectedNet,
            'ending_cash' => $endingCash,
            'liquidity_shortfall' => $liquidityShortfall,
            'days_until_deficit' => $daysUntilDeficit,
            'shortfall_amount' => $shortfallAmount,
            'risk_level' => $riskLevel,
            'recommended_actions' => $actions,
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
