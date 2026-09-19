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
     * Accounts Payable (AP) Aging schedule for suppliers.
     */
    public function supplierApAging(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();
        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $diffDaysSql = $isSqlite
            ? "CAST(julianday('now') - julianday(po.order_date) AS INTEGER)"
            : "DATEDIFF(NOW(), po.order_date)";

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->whereNotIn('po.status', ['cancelled', 'draft'])
            ->whereRaw('(po.total_amount - po.billed_value) > 0')
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw("SUM(CASE WHEN {$diffDaysSql} <= 30 THEN (po.total_amount - po.billed_value) ELSE 0 END) as current_30"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 30 AND {$diffDaysSql} <= 60 THEN (po.total_amount - po.billed_value) ELSE 0 END) as days_31_60"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 60 AND {$diffDaysSql} <= 90 THEN (po.total_amount - po.billed_value) ELSE 0 END) as days_61_90"),
                DB::raw("SUM(CASE WHEN {$diffDaysSql} > 90 THEN (po.total_amount - po.billed_value) ELSE 0 END) as days_over_90"),
                DB::raw('SUM(po.total_amount - po.billed_value) as total_due'),
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
                    'supplier_code' => $row->supplier_code,
                    'supplier_name' => $row->supplier_name,
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
     * Cash and bank account transaction ledger.
     */
    public function cashBankLedger(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('payments as pay')
            ->leftJoin('parties as p', 'pay.party_id', '=', 'p.id')
            ->where('pay.tenant_id', $tenantId)
            ->whereNull('pay.deleted_at')
            ->select([
                'pay.id',
                'pay.payment_number',
                'pay.payment_date',
                'pay.direction',
                DB::raw("COALESCE(p.name, 'General Party') as party_name"),
                'pay.method',
                'pay.reference_number',
                'pay.amount',
                'pay.status',
                'pay.notes',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pay.payment_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pay.payment_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['method'])) {
            $query->where('pay.method', $filters['method']);
        }
        if (!empty($filters['direction'])) {
            $query->where('pay.direction', $filters['direction']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('pay.payment_date', 'desc')
            ->orderBy('pay.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $dir = strtolower((string) $row->direction);
                $isIn = in_array($dir, ['inbound', 'in', 'receipt', 'receive']);

                return [
                    'payment_number' => $row->payment_number,
                    'payment_date' => $row->payment_date,
                    'party_name' => $row->party_name,
                    'direction' => $isIn ? 'Inflow (Receipt)' : 'Outflow (Payment)',
                    'payment_method' => ucfirst($row->method ?? 'cash'),
                    'reference' => $row->reference_number ?? '—',
                    'inflow_amount' => $isIn ? (float) $row->amount : 0.0,
                    'outflow_amount' => !$isIn ? (float) $row->amount : 0.0,
                    'net_amount' => $isIn ? (float) $row->amount : -((float) $row->amount),
                    'status' => ucfirst($row->status ?? 'posted'),
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
     * Breakdown of transactions aggregated by payment method.
     */
    public function paymentMethodSummary(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('payments as pay')
            ->where('pay.tenant_id', $tenantId)
            ->whereNull('pay.deleted_at')
            ->groupBy('pay.method')
            ->select([
                DB::raw("COALESCE(pay.method, 'cash') as method_name"),
                DB::raw('COUNT(pay.id) as total_transactions'),
                DB::raw("SUM(CASE WHEN pay.direction IN ('inbound', 'in', 'receipt') THEN pay.amount ELSE 0 END) as total_inflow"),
                DB::raw("SUM(CASE WHEN pay.direction IN ('outbound', 'out', 'payment') THEN pay.amount ELSE 0 END) as total_outflow"),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pay.payment_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pay.payment_date', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_transactions', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $inflow = (float) $row->total_inflow;
                $outflow = (float) $row->total_outflow;

                return [
                    'payment_method' => ucfirst((string) $row->method_name),
                    'transaction_count' => (int) $row->total_transactions,
                    'total_inflow' => $inflow,
                    'total_outflow' => $outflow,
                    'net_cash_flow' => $inflow - $outflow,
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
