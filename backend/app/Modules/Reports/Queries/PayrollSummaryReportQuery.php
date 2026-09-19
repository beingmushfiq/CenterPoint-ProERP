<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use Illuminate\Support\Facades\DB;

class PayrollSummaryReportQuery implements ReportQueryInterface
{
    public function columns(): array
    {
        return [
            'period_code' => ['label' => 'Period', 'type' => 'string', 'sortable' => true],
            'employee_name' => ['label' => 'Employee', 'type' => 'string'],
            'employment_type' => ['label' => 'Type', 'type' => 'badge'],
            'produced_quantity' => ['label' => 'Piece-rate Output', 'type' => 'number'],
            'gross_amount' => ['label' => 'Gross Earnings (BDT)', 'type' => 'currency'],
            'total_deductions' => ['label' => 'Deductions (BDT)', 'type' => 'currency'],
            'net_amount' => ['label' => 'Net Payable (BDT)', 'type' => 'currency'],
            'payment_status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = \App\Core\Tenancy\TenantContext::isBound()
            ? \App\Core\Tenancy\TenantContext::current()->tenantId()
            : (auth()->user()?->tenant_id ?? (int) config('app.default_tenant_id', 1));

        $query = DB::table('payslips as ps')
            ->join('payroll_periods as pp', 'ps.payroll_period_id', '=', 'pp.id')
            ->join('employees as e', 'ps.employee_id', '=', 'e.id')
            ->where('ps.tenant_id', $tenantId)
            ->whereNull('ps.deleted_at')
            ->select([
                'ps.id',
                'ps.uuid',
                'pp.period_code',
                'e.display_name as employee_name',
                'e.employee_code',
                'e.employment_type',
                'ps.produced_quantity',
                'ps.gross_amount',
                'ps.total_deductions',
                'ps.net_amount',
                'ps.payment_status',
            ]);

        if (!empty($filters['period_id'])) {
            $query->where('ps.payroll_period_id', $filters['period_id']);
        }
        if (!empty($filters['employment_type'])) {
            $query->where('e.employment_type', $filters['employment_type']);
        }

        $total = $query->count();
        $rows = $query->orderBy('pp.period_code', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $data = $rows->map(function ($row): array {
            return [
                'id' => $row->id,
                'uuid' => $row->uuid,
                'period_code' => $row->period_code,
                'employee_name' => "{$row->employee_name} ({$row->employee_code})",
                'employment_type' => $row->employment_type,
                'produced_quantity' => $row->produced_quantity ? number_format((float) $row->produced_quantity, 2, '.', '') : '—',
                'gross_amount' => number_format((float) $row->gross_amount, 4, '.', ''),
                'total_deductions' => number_format((float) $row->total_deductions, 4, '.', ''),
                'net_amount' => number_format((float) $row->net_amount, 4, '.', ''),
                'payment_status' => $row->payment_status,
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

        $query = DB::table('payslips as ps')
            ->where('ps.tenant_id', $tenantId)
            ->whereNull('ps.deleted_at');

        if (!empty($filters['period_id'])) {
            $query->where('ps.payroll_period_id', $filters['period_id']);
        }

        $stats = $query->selectRaw('
            COUNT(ps.id) as total_payslips,
            COALESCE(SUM(ps.gross_amount), 0) as total_gross,
            COALESCE(SUM(ps.total_deductions), 0) as total_deductions,
            COALESCE(SUM(ps.net_amount), 0) as total_net
        ')->first();

        return [
            'total_payslips' => (int) ($stats->total_payslips ?? 0),
            'total_gross' => number_format((float) ($stats->total_gross ?? 0), 4, '.', ''),
            'total_deductions' => number_format((float) ($stats->total_deductions ?? 0), 4, '.', ''),
            'total_net' => number_format((float) ($stats->total_net ?? 0), 4, '.', ''),
        ];
    }
}
