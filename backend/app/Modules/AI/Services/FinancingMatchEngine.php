<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Models\Tenant;
use App\Modules\AI\Models\FinancingAssessment;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Sales\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class FinancingMatchEngine
{
    /**
     * Compute comprehensive financial metrics and evaluate matching financing options.
     *
     * @param  array<string, mixed>  $customInputs
     * @return array{
     *     assessment_uuid: string,
     *     tenant_id: int,
     *     metrics: array<string, mixed>,
     *     products: list<array<string, mixed>>,
     *     top_recommendation: array<string, mixed>|null,
     *     summary: string
     * }
     */
    public function assessAndMatch(int $tenantId, ?int $userId = null, array $customInputs = []): array
    {
        $metrics = $this->gatherFinancialMetrics($tenantId, $customInputs);
        $products = $this->evaluateProducts($metrics);

        // Sort products by confidence weight (HIGH=3, MEDIUM=2, LOW=1), then max_amount DESC
        usort($products, function (array $a, array $b): int {
            $confWeight = ['HIGH' => 3, 'MEDIUM' => 2, 'LOW' => 1];
            $confA = is_string($a['confidence'] ?? null) ? (string) $a['confidence'] : 'LOW';
            $confB = is_string($b['confidence'] ?? null) ? (string) $b['confidence'] : 'LOW';
            $weightA = $confWeight[$confA] ?? 0;
            $weightB = $confWeight[$confB] ?? 0;

            if ($weightA !== $weightB) {
                return $weightB <=> $weightA;
            }

            $amountA = is_numeric($a['max_amount'] ?? null) ? (float) $a['max_amount'] : 0.0;
            $amountB = is_numeric($b['max_amount'] ?? null) ? (float) $b['max_amount'] : 0.0;

            return $amountB <=> $amountA;
        });

        $topRecommendation = $products[0] ?? null;

        $summary = $this->generateSummaryNarrative($metrics, $products);

        $revVal = is_numeric($metrics['monthly_revenue'] ?? null) ? (float) $metrics['monthly_revenue'] : 0.0;
        $expVal = is_numeric($metrics['monthly_expenses'] ?? null) ? (float) $metrics['monthly_expenses'] : 0.0;
        $arVal = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;
        $apVal = is_numeric($metrics['ap_outstanding'] ?? null) ? (float) $metrics['ap_outstanding'] : 0.0;
        $invVal = is_numeric($metrics['inventory_value'] ?? null) ? (float) $metrics['inventory_value'] : 0.0;
        $bankVal = is_numeric($metrics['bank_balance'] ?? null) ? (float) $metrics['bank_balance'] : 0.0;

        // Store assessment record
        $assessment = FinancingAssessment::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'assessment_date' => Carbon::now()->toDateString(),
            'monthly_revenue' => (string) round($revVal, 2),
            'monthly_expenses' => (string) round($expVal, 2),
            'ar_outstanding' => (string) round($arVal, 2),
            'ap_outstanding' => (string) round($apVal, 2),
            'inventory_value' => (string) round($invVal, 2),
            'bank_balance' => (string) round($bankVal, 2),
            'recommendations' => [
                'products' => $products,
                'top_recommendation' => $topRecommendation,
                'summary' => $summary,
            ],
        ]);

        return [
            'assessment_uuid' => $assessment->uuid,
            'tenant_id' => $tenantId,
            'metrics' => $metrics,
            'products' => $products,
            'top_recommendation' => $topRecommendation,
            'summary' => $summary,
        ];
    }

    /**
     * Deterministic solvency indicator (0-100) derived only from verified ledger metrics.
     *
     * @param  array<string, mixed>  $metrics
     */
    public function computeSolvencyScore(array $metrics): int
    {
        $score = 50;
        $rawRev = $metrics['monthly_revenue'] ?? null;
        $rawExp = $metrics['monthly_expenses'] ?? null;
        $rawAr = $metrics['ar_outstanding'] ?? null;
        $rawBank = $metrics['bank_balance'] ?? null;

        $revenue = is_numeric($rawRev) ? (float) $rawRev : 0.0;
        $expenses = is_numeric($rawExp) ? (float) $rawExp : 0.0;
        $ar = is_numeric($rawAr) ? (float) $rawAr : 0.0;
        $bank = is_numeric($rawBank) ? (float) $rawBank : 0.0;

        if ($revenue > 0) {
            $score += 15;
        }

        if ($revenue > $expenses && $expenses > 0) {
            $score += 15;
        }

        if ($bank > 0) {
            $score += 10;
        }

        if ($revenue > 0 && $ar <= $revenue) {
            $score += 10;
        }

        return max(0, min(100, $score));
    }

    /**
     * Derive runway and margin indicators from verified metrics.
     *
     * @param  array<string, mixed>  $metrics
     * @return array{runway_cushion_days: int, operating_margin_pct: float}
     */
    public function computeRiskProfile(array $metrics): array
    {
        $rawBank = $metrics['bank_balance'] ?? null;
        $rawRev = $metrics['monthly_revenue'] ?? null;
        $rawExp = $metrics['monthly_expenses'] ?? null;

        $bank = is_numeric($rawBank) ? (float) $rawBank : 0.0;
        $revenue = is_numeric($rawRev) ? (float) $rawRev : 0.0;
        $expenses = is_numeric($rawExp) ? (float) $rawExp : 0.0;

        $dailyBurn = $expenses / 30.0;
        $runway = $dailyBurn > 0 ? (int) floor($bank / $dailyBurn) : 999;

        $margin = $revenue > 0
            ? round((($revenue - $expenses) / $revenue) * 100, 2)
            : 0.0;

        return [
            'runway_cushion_days' => $runway,
            'operating_margin_pct' => is_numeric($metrics['operating_margin_pct'] ?? null)
                ? (float) $metrics['operating_margin_pct']
                : $margin,
        ];
    }

    /**
     * Build the WeBank credit_assessment block from a completed assessment.
     *
     * @param  array<string, mixed>  $assessment
     * @return array<string, mixed>
     */
    public function webankCreditAssessment(array $assessment): array
    {
        /** @var array<string, mixed> $metrics */
        $metrics = is_array($assessment['metrics'] ?? null) ? $assessment['metrics'] : [];
        $profile = $this->computeRiskProfile($metrics);
        $rev = is_numeric($metrics['monthly_revenue'] ?? null) ? (float) $metrics['monthly_revenue'] : 0.0;
        $ar = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;

        return [
            'solvency_score' => $this->computeSolvencyScore($metrics),
            'monthly_revenue_verified' => round($rev, 2),
            'operating_margin_verified' => $profile['operating_margin_pct'],
            'verified_ar_pool' => round($ar, 2),
            'runway_cushion_days' => $profile['runway_cushion_days'],
        ];
    }

    /**
     * Merge the UI request contract into the internal custom-input map.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function normalizeMatchInputs(array $payload): array
    {
        $inputs = [];

        foreach (['monthly_revenue', 'monthly_expenses', 'ar_outstanding', 'ap_outstanding', 'inventory_value', 'bank_balance'] as $key) {
            if (isset($payload[$key]) && is_numeric($payload[$key])) {
                $inputs[$key] = (float) $payload[$key];
            }
        }

        if (isset($payload['requested_amount']) && is_numeric($payload['requested_amount'])) {
            $inputs['requested_amount'] = (float) $payload['requested_amount'];
        }

        if (isset($payload['preferred_term_months']) && is_numeric($payload['preferred_term_months'])) {
            $inputs['preferred_term_months'] = (int) $payload['preferred_term_months'];
        }

        if (isset($payload['collateral_available']) && is_string($payload['collateral_available'])) {
            $inputs['collateral_available'] = $payload['collateral_available'];
        }

        if (isset($payload['purpose']) && is_string($payload['purpose'])) {
            $inputs['purpose'] = $payload['purpose'];
        }

        return $inputs;
    }

    /**
     * Convert an internal product row into the FinancingProduct contract.
     *
     * @param  array<string, mixed>  $product
     * @return array<string, mixed>
     */
    public function formatProduct(array $product): array
    {
        $confidence = is_string($product['confidence'] ?? null) ? (string) $product['confidence'] : 'LOW';
        $isEligible = (bool) ($product['is_eligible'] ?? false);

        $scoreByConfidence = ['HIGH' => 85, 'MEDIUM' => 65, 'LOW' => 40];
        $eligibilityScore = ($scoreByConfidence[$confidence] ?? 40) + ($isEligible ? 10 : 0);
        $eligibilityScore = max(0, min(100, $eligibilityScore));

        if (! $isEligible) {
            $qualificationStatus = 'not_eligible';
        } elseif ($confidence === 'HIGH') {
            $qualificationStatus = 'pre_approved';
        } elseif ($confidence === 'MEDIUM') {
            $qualificationStatus = 'eligible';
        } else {
            $qualificationStatus = 'conditionally_eligible';
        }

        $rateString = is_string($product['estimated_interest_rate'] ?? null) ? (string) $product['estimated_interest_rate'] : '';
        $interestRate = is_numeric(strtok($rateString, '%- ')) ? (float) strtok($rateString, '%- ') : 0.0;

        $turnaroundByProduct = [
            'working_capital_loan' => '5-7 business days',
            'invoice_discounting' => '24-48 hours',
            'inventory_financing' => '3-5 business days',
            'equipment_leasing' => '7-10 business days',
        ];
        $productId = is_string($product['product_id'] ?? null) ? (string) $product['product_id'] : '';

        $maxAmount = is_numeric($product['max_amount'] ?? null) ? (float) $product['max_amount'] : 0.0;
        $rationale = is_string($product['rationale'] ?? null) ? (string) $product['rationale'] : '';
        $collateral = is_string($product['collateral_requirement'] ?? null) ? (string) $product['collateral_requirement'] : '';

        return [
            'product_id' => $productId,
            'product_name' => is_string($product['product_name'] ?? null) ? (string) $product['product_name'] : '',
            'institution' => 'WeBank Digital SME Micro-Finance',
            'interest_rate_pct' => round($interestRate, 2),
            'repayment_terms' => is_string($product['tenor_months'] ?? null) ? (string) $product['tenor_months'] : '',
            'eligible_amount' => round($maxAmount, 2),
            'eligibility_score' => $eligibilityScore,
            'qualification_status' => $qualificationStatus,
            'required_collateral' => $collateral,
            'application_turnaround' => $turnaroundByProduct[$productId] ?? '5-7 business days',
            'benefits' => array_values(array_filter([
                $rationale !== '' ? $rationale : null,
                'Facility up to BDT '.number_format($maxAmount, 2).' against verified ERP data',
            ])),
        ];
    }

    /**
     * Convert a full assessment into the FinancingMatchData UI contract.
     *
     * @param  array<string, mixed>  $assessment
     * @return array<string, mixed>
     */
    public function formatMatchData(array $assessment): array
    {
        /** @var array<string, mixed> $metrics */
        $metrics = is_array($assessment['metrics'] ?? null) ? $assessment['metrics'] : [];
        /** @var list<array<string, mixed>> $products */
        $products = is_array($assessment['products'] ?? null) ? $assessment['products'] : [];

        $matchedProducts = array_map(fn (array $p): array => $this->formatProduct($p), $products);

        $recommendedFinancing = 0.0;
        $top = $assessment['top_recommendation'] ?? null;
        if (is_array($top) && is_numeric($top['max_amount'] ?? null)) {
            $recommendedFinancing = (float) $top['max_amount'];
        }

        $rawBank = $metrics['bank_balance'] ?? null;
        $rawAr = $metrics['ar_outstanding'] ?? null;
        $rawAp = $metrics['ap_outstanding'] ?? null;
        $rawExp = $metrics['monthly_expenses'] ?? null;

        $bank = is_numeric($rawBank) ? (float) $rawBank : 0.0;
        $ar = is_numeric($rawAr) ? (float) $rawAr : 0.0;
        $ap = is_numeric($rawAp) ? (float) $rawAp : 0.0;
        $expenses = is_numeric($rawExp) ? (float) $rawExp : 0.0;

        $cashDeficit = max(0.0, ($ap + $expenses) - ($bank + ($ar * 0.70)));

        return [
            'assessment_uuid' => is_string($assessment['assessment_uuid'] ?? null) ? (string) $assessment['assessment_uuid'] : null,
            'cash_deficit_amount' => round($cashDeficit, 2),
            'recommended_financing' => round($recommendedFinancing, 2),
            'credit_score_indicator' => $this->computeSolvencyScore($metrics),
            'matched_products' => $matchedProducts,
            'evaluation_summary' => is_string($assessment['summary'] ?? null) ? (string) $assessment['summary'] : '',
        ];
    }

    /**
     * Gather baseline financial metrics from live database tables.
     *
     * @param  array<string, mixed>  $customInputs
     * @return array<string, mixed>
     */
    public function gatherFinancialMetrics(int $tenantId, array $customInputs = []): array
    {
        // 1. Bank balance
        $bankBalance = is_numeric($customInputs['bank_balance'] ?? null)
            ? (float) $customInputs['bank_balance']
            : (float) BankAccount::where('tenant_id', $tenantId)->where('is_active', true)->sum('current_balance');

        // 2. AR outstanding
        $arOutstanding = is_numeric($customInputs['ar_outstanding'] ?? null)
            ? (float) $customInputs['ar_outstanding']
            : (float) $this->calculateArOutstanding($tenantId);

        // 3. AP outstanding
        $apOutstanding = is_numeric($customInputs['ap_outstanding'] ?? null)
            ? (float) $customInputs['ap_outstanding']
            : (float) $this->calculateApOutstanding($tenantId);

        // 4. Inventory value
        $inventoryValue = is_numeric($customInputs['inventory_value'] ?? null)
            ? (float) $customInputs['inventory_value']
            : (float) $this->calculateInventoryValue($tenantId);

        // 5. Monthly revenue (from invoices over past 90 days / 3)
        $monthlyRevenue = is_numeric($customInputs['monthly_revenue'] ?? null)
            ? (float) $customInputs['monthly_revenue']
            : (float) $this->calculateAverageMonthlyRevenue($tenantId);

        // 6. Monthly expenses (from expenses over past 90 days / 3)
        $monthlyExpenses = is_numeric($customInputs['monthly_expenses'] ?? null)
            ? (float) $customInputs['monthly_expenses']
            : (float) $this->calculateAverageMonthlyExpenses($tenantId);

        // 7. Business age in months
        $tenant = null;
        if (Schema::hasTable('tenants')) {
            try {
                $tenant = Tenant::find($tenantId);
            } catch (Throwable) {
                $tenant = null;
            }
        }
        $businessAgeMonths = $tenant && $tenant->created_at
            ? max(1, (int) Carbon::parse($tenant->created_at)->diffInMonths(Carbon::now()))
            : 12;

        $netMonthlyProfit = max(0.0, $monthlyRevenue - $monthlyExpenses);

        return [
            'bank_balance' => $bankBalance,
            'ar_outstanding' => $arOutstanding,
            'ap_outstanding' => $apOutstanding,
            'inventory_value' => $inventoryValue,
            'monthly_revenue' => $monthlyRevenue,
            'monthly_expenses' => $monthlyExpenses,
            'net_monthly_profit' => $netMonthlyProfit,
            'business_age_months' => $businessAgeMonths,
            'currency' => 'BDT',
        ];
    }

    /**
     * Evaluate the 4 core financing products against business metrics.
     *
     * @param  array<string, mixed>  $metrics
     * @return list<array<string, mixed>>
     */
    private function evaluateProducts(array $metrics): array
    {
        $products = [];
        $rev = is_numeric($metrics['monthly_revenue'] ?? null) ? (float) $metrics['monthly_revenue'] : 0.0;
        $profit = is_numeric($metrics['net_monthly_profit'] ?? null) ? (float) $metrics['net_monthly_profit'] : 0.0;
        $ar = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;
        $inv = is_numeric($metrics['inventory_value'] ?? null) ? (float) $metrics['inventory_value'] : 0.0;
        $age = is_numeric($metrics['business_age_months'] ?? null) ? (int) $metrics['business_age_months'] : 0;

        // 1. Working Capital Loan
        $wcEligible = $rev > 0 && $age >= 3;
        $wcMaxAmount = $rev * 3.0;
        $wcConfidence = ($rev > 50000 && $profit > 0) ? 'HIGH' : ($wcEligible ? 'MEDIUM' : 'LOW');

        $products[] = [
            'product_id' => 'working_capital_loan',
            'product_name' => 'Working Capital Term Loan',
            'category' => 'Cash Flow Support',
            'is_eligible' => $wcEligible,
            'max_amount' => round($wcMaxAmount, 2),
            'confidence' => $wcConfidence,
            'estimated_interest_rate' => '9.5% - 11.5%',
            'tenor_months' => '12 - 36 months',
            'collateral_requirement' => 'Hypothecation of book debts & plant machinery',
            'rationale' => $wcEligible
                ? 'Eligible based on stable monthly revenue of BDT '.number_format($rev, 2)." over {$age} months operating history."
                : 'Requires at least 3 months operating history and positive monthly revenue.',
        ];

        // 2. Invoice Discounting / Factoring
        $idEligible = $ar >= 25000;
        $idMaxAmount = $ar * 0.80; // 80% advance rate
        $idConfidence = $ar >= 100000 ? 'HIGH' : ($idEligible ? 'MEDIUM' : 'LOW');

        $products[] = [
            'product_id' => 'invoice_discounting',
            'product_name' => 'Accounts Receivable / Invoice Factoring',
            'category' => 'Asset-Backed Working Capital',
            'is_eligible' => $idEligible,
            'max_amount' => round($idMaxAmount, 2),
            'confidence' => $idConfidence,
            'estimated_interest_rate' => '8.0% - 10.0%',
            'tenor_months' => '30 - 90 days',
            'collateral_requirement' => 'Pledge of validated customer receivables',
            'rationale' => $idEligible
                ? 'Immediate 80% liquidity unlock against BDT '.number_format($ar, 2).' in outstanding customer invoices.'
                : 'Requires a minimum of BDT 25,000 in uncollected accounts receivable.',
        ];

        // 3. Inventory Financing
        $ifEligible = $inv >= 50000;
        $ifMaxAmount = $inv * 0.60; // 60% loan-to-value
        $ifConfidence = $inv >= 200000 ? 'HIGH' : ($ifEligible ? 'MEDIUM' : 'LOW');

        $products[] = [
            'product_id' => 'inventory_financing',
            'product_name' => 'Warehouse / Stock Financing (Revolving)',
            'category' => 'Inventory Liquidity',
            'is_eligible' => $ifEligible,
            'max_amount' => round($ifMaxAmount, 2),
            'confidence' => $ifConfidence,
            'estimated_interest_rate' => '10.0% - 12.5%',
            'tenor_months' => '3 - 12 months (Revolving)',
            'collateral_requirement' => 'Lien on warehouse stock & finished goods',
            'rationale' => $ifEligible
                ? 'Unlocks up to 60% LTV against current inventory assets valued at BDT '.number_format($inv, 2).'.'
                : 'Requires verifiable warehouse stock valuation exceeding BDT 50,000.',
        ];

        // 4. Equipment Leasing & Machinery Finance
        $elMaxAmount = $profit > 0 ? max(200000.0, $profit * 24.0) : 150000.0;
        $elEligible = true;
        $elConfidence = $profit > 20000 ? 'HIGH' : 'MEDIUM';

        $products[] = [
            'product_id' => 'equipment_leasing',
            'product_name' => 'Machinery & Equipment Capital Lease',
            'category' => 'Capex Expansion',
            'is_eligible' => $elEligible,
            'max_amount' => round($elMaxAmount, 2),
            'confidence' => $elConfidence,
            'estimated_interest_rate' => '10.5% - 13.0%',
            'tenor_months' => '24 - 60 months',
            'collateral_requirement' => 'Ownership of equipment retained by financier during lease',
            'rationale' => 'Capital expenditure lease structured on production machinery with predictable monthly amortization.',
        ];

        return $products;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  list<array<string, mixed>>  $products
     */
    private function generateSummaryNarrative(array $metrics, array $products): string
    {
        $eligibleCount = count(array_filter($products, fn ($p) => ! empty($p['is_eligible'])));
        $top = $products[0] ?? null;
        $currency = is_string($metrics['currency'] ?? null) ? (string) $metrics['currency'] : 'BDT';

        $msg = "Financial Assessment completed for {$currency}. ";
        $msg .= "Identified {$eligibleCount} eligible financing facilities. ";

        if ($top) {
            $topName = is_string($top['product_name'] ?? null) ? (string) $top['product_name'] : '';
            $topMax = is_numeric($top['max_amount'] ?? null) ? (float) $top['max_amount'] : 0.0;
            $topRate = is_string($top['estimated_interest_rate'] ?? null) ? (string) $top['estimated_interest_rate'] : '';
            $topConf = is_string($top['confidence'] ?? null) ? (string) $top['confidence'] : '';

            $msg .= "Prime recommendation: **{$topName}** providing up to {$currency} "
                .number_format($topMax, 2)." at {$topRate} ({$topConf} confidence).";
        }

        return $msg;
    }

    private function calculateArOutstanding(int $tenantId): float
    {
        if (! Schema::hasTable('invoices')) {
            return 0.0;
        }

        try {
            $due = DB::table('invoices')
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'partially_paid'])
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as due')
                ->value('due');

            return is_numeric($due) ? (float) $due : 0.0;
        } catch (Throwable) {
            return 0.0;
        }
    }

    private function calculateApOutstanding(int $tenantId): float
    {
        if (! Schema::hasTable('purchase_bills')) {
            return 0.0;
        }

        try {
            $due = DB::table('purchase_bills')
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'approved', 'partially_paid'])
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as due')
                ->value('due');

            return is_numeric($due) ? (float) $due : 0.0;
        } catch (Throwable) {
            return 0.0;
        }
    }

    private function calculateInventoryValue(int $tenantId): float
    {
        if (! Schema::hasTable('stock_balances')) {
            return 0.0;
        }

        try {
            $val = DB::table('stock_balances')
                ->where('tenant_id', $tenantId)
                ->selectRaw('COALESCE(SUM(quantity * average_cost), 0) as val')
                ->value('val');

            return is_numeric($val) ? (float) $val : 0.0;
        } catch (Throwable) {
            return 0.0;
        }
    }

    private function calculateAverageMonthlyRevenue(int $tenantId): float
    {
        if (! Schema::hasTable('invoices')) {
            return 0.0;
        }

        try {
            $ninetyDaysAgo = Carbon::now()->subDays(90);
            $total = (float) Invoice::where('tenant_id', $tenantId)
                ->where('invoice_date', '>=', $ninetyDaysAgo)
                ->sum('total_amount');

            return $total > 0 ? $total / 3.0 : 0.0;
        } catch (Throwable) {
            return 0.0;
        }
    }

    private function calculateAverageMonthlyExpenses(int $tenantId): float
    {
        if (! Schema::hasTable('expenses')) {
            return 0.0;
        }

        try {
            $ninetyDaysAgo = Carbon::now()->subDays(90);
            $total = (float) Expense::where('tenant_id', $tenantId)
                ->where('expense_date', '>=', $ninetyDaysAgo)
                ->sum('amount');

            return $total > 0 ? $total / 3.0 : 0.0;
        } catch (Throwable) {
            return 0.0;
        }
    }
}
