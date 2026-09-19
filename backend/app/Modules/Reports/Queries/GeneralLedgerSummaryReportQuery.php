<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use Illuminate\Support\Facades\DB;

class GeneralLedgerSummaryReportQuery implements ReportQueryInterface
{
    public function columns(): array
    {
        return [
            'account_code' => ['label' => 'Code', 'type' => 'string', 'sortable' => true],
            'account_name' => ['label' => 'Account Name', 'type' => 'string'],
            'account_type' => ['label' => 'Type', 'type' => 'badge'],
            'normal_balance' => ['label' => 'Normal Balance', 'type' => 'string'],
            'total_debit' => ['label' => 'Total Debits (BDT)', 'type' => 'currency'],
            'total_credit' => ['label' => 'Total Credits (BDT)', 'type' => 'currency'],
            'net_balance' => ['label' => 'Net Balance (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = \App\Core\Tenancy\TenantContext::isBound()
            ? \App\Core\Tenancy\TenantContext::current()->tenantId()
            : (auth()->user()?->tenant_id ?? (int) config('app.default_tenant_id', 1));

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
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $data = $rows->map(function ($row): array {
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
        })->toArray();

        return [
            'data' => $data,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    public function summary(array $filters): array
    {
        $tenantId = $filters['tenant_id'] ?? auth()->user()?->tenant_id ?? 1;

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
