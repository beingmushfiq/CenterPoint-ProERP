<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class FinanceDataProvider extends BaseDataProvider
{
    /**
     * General ledger trial balance across Chart of Accounts and posted journal lines.
     */
    public function generalLedger(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('chart_of_accounts as coa')
            ->leftJoin('journal_lines as jl', 'coa.id', '=', 'jl.account_id')
            ->where('coa.tenant_id', $tenantId)
            ->whereNull('coa.deleted_at')
            ->groupBy(['coa.id', 'coa.account_code', 'coa.name', 'coa.account_type', 'coa.normal_balance'])
            ->select([
                'coa.id',
                'coa.account_code',
                'coa.name as account_name',
                'coa.account_type',
                'coa.normal_balance',
                DB::raw('COALESCE(SUM(jl.debit_amount), 0) as total_debits'),
                DB::raw('COALESCE(SUM(jl.credit_amount), 0) as total_credits'),
            ]);

        if (!empty($filters['account_type'])) {
            $query->where('coa.account_type', $filters['account_type']);
        }

        $total = DB::table('chart_of_accounts')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->count();

        $rows = $query->orderBy('coa.account_code', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $debits = (float) $row->total_debits;
                $credits = (float) $row->total_credits;
                $net = strtolower($row->normal_balance) === 'credit'
                    ? ($credits - $debits)
                    : ($debits - $credits);

                return [
                    'account_code' => $row->account_code,
                    'account_name' => $row->account_name,
                    'account_type' => $row->account_type,
                    'normal_balance' => strtoupper($row->normal_balance),
                    'total_debit' => number_format($debits, 4, '.', ''),
                    'total_credit' => number_format($credits, 4, '.', ''),
                    'net_balance' => number_format($net, 4, '.', ''),
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Profit and Loss / Income Statement accounts.
     */
    public function incomeStatement(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('chart_of_accounts as coa')
            ->leftJoin('journal_lines as jl', 'coa.id', '=', 'jl.account_id')
            ->where('coa.tenant_id', $tenantId)
            ->whereIn('coa.account_type', ['revenue', 'income', 'expense', 'cost_of_goods_sold'])
            ->whereNull('coa.deleted_at')
            ->groupBy(['coa.id', 'coa.account_code', 'coa.name', 'coa.account_type', 'coa.normal_balance'])
            ->select([
                'coa.id',
                'coa.account_code',
                'coa.name as account_name',
                'coa.account_type',
                DB::raw('COALESCE(SUM(jl.debit_amount), 0) as total_debits'),
                DB::raw('COALESCE(SUM(jl.credit_amount), 0) as total_credits'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('coa.account_code', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $deb = (float) $row->total_debits;
                $cred = (float) $row->total_credits;
                $isExpense = in_array($row->account_type, ['expense', 'cost_of_goods_sold']);
                $amount = $isExpense ? ($deb - $cred) : ($cred - $deb);

                return [
                    'account_code' => $row->account_code,
                    'account_name' => $row->account_name,
                    'classification' => $isExpense ? 'Expenditure' : 'Revenue',
                    'amount' => $amount,
                    'type' => $row->account_type,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Operating expenses grouped by expense account categories.
     */
    public function operatingExpenses(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('chart_of_accounts as coa')
            ->leftJoin('journal_lines as jl', 'coa.id', '=', 'jl.account_id')
            ->where('coa.tenant_id', $tenantId)
            ->where('coa.account_type', 'expense')
            ->whereNull('coa.deleted_at')
            ->groupBy(['coa.id', 'coa.account_code', 'coa.name'])
            ->select([
                'coa.account_code',
                'coa.name as account_name',
                DB::raw('COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) as net_expense'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('net_expense', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'account_code' => $row->account_code,
                    'account_name' => $row->account_name,
                    'net_expense' => (float) $row->net_expense,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Customer receivables aging schedule (0-30, 31-60, 61-90, 90+ days).
     */
    public function customerArAging(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $driver = DB::getDriverName();
        $diffDaysSql = match ($driver) {
            'sqlite' => "(julianday('now') - julianday(so.order_date))",
            'pgsql' => "(CURRENT_DATE - so.order_date::date)",
            default => "DATEDIFF(NOW(), so.order_date)",
        };

        $query = DB::table('sales_orders as so')
            ->join('parties as p', 'so.party_id', '=', 'p.id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.due_amount', '>', 0)
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.code as customer_code',
                'p.name as customer_name',
                DB::raw("SUM(CASE WHEN {$diffDaysSql} <= 30 THEN so.due_amount ELSE 0 END) as current_30"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 30 AND {$diffDaysSql} <= 60 THEN so.due_amount ELSE 0 END) as days_31_60"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 60 AND {$diffDaysSql} <= 90 THEN so.due_amount ELSE 0 END) as days_61_90"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 90 THEN so.due_amount ELSE 0 END) as days_over_90"),
                DB::raw('SUM(so.due_amount) as total_due'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_due', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'customer_code' => $row->customer_code,
                    'customer_name' => $row->customer_name,
                    'current_30' => (float) $row->current_30,
                    'days_31_60' => (float) $row->days_31_60,
                    'days_61_90' => (float) $row->days_61_90,
                    'days_over_90' => (float) $row->days_over_90,
                    'total_due' => (float) $row->total_due,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Ledger equilibrium and balance verification.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $stats = DB::table('journal_lines as jl')
            ->join('journal_entries as je', 'jl.journal_entry_id', '=', 'je.id')
            ->where('je.tenant_id', $tenantId)
            ->where('je.status', 'posted')
            ->selectRaw('
                COALESCE(SUM(jl.debit_amount), 0) as sum_debits,
                COALESCE(SUM(jl.credit_amount), 0) as sum_credits
            ')->first();

        $debits = (float) ($stats->sum_debits ?? 0);
        $credits = (float) ($stats->sum_credits ?? 0);

        return [
            'total_debits' => number_format($debits, 4, '.', ''),
            'total_credits' => number_format($credits, 4, '.', ''),
            'is_balanced' => abs($debits - $credits) < 0.001,
        ];
    }
}
