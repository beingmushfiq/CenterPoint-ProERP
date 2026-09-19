<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class HRDataProvider extends BaseDataProvider
{
    /**
     * Payroll register and disbursed net pay per employee.
     */
    public function payrollSummary(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

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

        $rows = $query
            ->orderBy('pp.period_code', 'desc')
            ->orderBy('ps.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
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
     * Headcount distribution across Factory Lines, Sales, Logistics, and Administration.
     */
    public function employeeDirectory(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('employees as e')
            ->leftJoin('departments as d', 'e.department_id', '=', 'd.id')
            ->leftJoin('designations as des', 'e.designation_id', '=', 'des.id')
            ->leftJoin('production_lines as pl', 'e.production_line_id', '=', 'pl.id')
            ->where('e.tenant_id', $tenantId)
            ->whereNull('e.deleted_at')
            ->select([
                'e.id',
                'e.employee_code',
                'e.display_name',
                DB::raw("COALESCE(d.name, 'General') as department_name"),
                DB::raw("COALESCE(des.name, 'Staff') as designation_name"),
                DB::raw("COALESCE(pl.name, '—') as line_name"),
                'e.employment_type',
                'e.date_of_joining',
                'e.phone',
            ]);

        if (!empty($filters['department_id'])) {
            $query->where('e.department_id', $filters['department_id']);
        }
        if (!empty($filters['employment_type'])) {
            $query->where('e.employment_type', $filters['employment_type']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('e.employee_code', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'employee_code' => $row->employee_code,
                    'name' => $row->display_name,
                    'department' => $row->department_name,
                    'designation' => $row->designation_name,
                    'line' => $row->line_name,
                    'employment_type' => ucfirst(str_replace('_', ' ', $row->employment_type)),
                    'date_of_joining' => $row->date_of_joining,
                    'phone' => $row->phone,
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
     * Daily attendance logs, punch times, worked minutes, and punctuality.
     */
    public function dailyAttendance(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('attendances as a')
            ->join('employees as e', 'a.employee_id', '=', 'e.id')
            ->leftJoin('shifts as s', 'a.shift_id', '=', 's.id')
            ->where('a.tenant_id', $tenantId)
            ->whereNull('a.deleted_at')
            ->select([
                'a.id',
                'a.attendance_date',
                'e.employee_code',
                'e.display_name',
                DB::raw("COALESCE(s.name, 'Standard Shift') as shift_name"),
                'a.check_in_at',
                'a.check_out_at',
                'a.worked_minutes',
                'a.late_minutes',
                'a.status',
            ]);

        if (!empty($filters['date'])) {
            $query->where('a.attendance_date', $filters['date']);
        }
        if (!empty($filters['status'])) {
            $query->where('a.status', $filters['status']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('a.attendance_date', 'desc')
            ->orderBy('a.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'date' => $row->attendance_date,
                    'employee_code' => $row->employee_code,
                    'name' => $row->display_name,
                    'shift' => $row->shift_name,
                    'check_in' => $row->check_in_at ? substr($row->check_in_at, 11, 5) : '—',
                    'check_out' => $row->check_out_at ? substr($row->check_out_at, 11, 5) : '—',
                    'worked_hours' => $row->worked_minutes ? round($row->worked_minutes / 60, 2) : 0,
                    'late_minutes' => (int) ($row->late_minutes ?? 0),
                    'status' => $row->status,
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
     * Aggregated piece-rate production log per worker.
     */
    public function workerPieceRate(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('worker_production_entries as wpe')
            ->join('employees as e', 'wpe.employee_id', '=', 'e.id')
            ->where('wpe.tenant_id', $tenantId)
            ->groupBy(['e.id', 'e.employee_code', 'e.display_name'])
            ->select([
                'e.id as employee_id',
                'e.employee_code',
                'e.display_name',
                DB::raw('COUNT(wpe.id) as logs_count'),
                DB::raw('SUM(wpe.quantity) as total_pieces'),
                DB::raw('SUM(COALESCE(wpe.rejected_quantity, 0)) as total_rejected'),
                DB::raw('SUM(wpe.quantity * COALESCE(wpe.rate, 0)) as total_earnings'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_earnings', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'employee_code' => $row->employee_code,
                    'worker_name' => $row->display_name,
                    'logs_count' => (int) $row->logs_count,
                    'total_pieces' => (float) $row->total_pieces,
                    'total_rejected' => (float) $row->total_rejected,
                    'total_earnings' => (float) $row->total_earnings,
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
     * Sales commission and incentive payout schedule for sales representatives.
     */
    public function salesCommissionPayout(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->join('users as u', 'so.salesperson_id', '=', 'u.id')
            ->leftJoin('employees as e', 'u.id', '=', 'e.user_id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['u.id', 'u.name', 'e.employee_code', 'e.bank_name', 'e.bank_account_number'])
            ->select([
                'u.id as user_id',
                'u.name as salesperson_name',
                DB::raw("COALESCE(e.employee_code, 'SALES-REP') as employee_code"),
                DB::raw("COALESCE(e.bank_name, 'Bank Transfer') as payment_channel"),
                DB::raw("COALESCE(e.bank_account_number, '—') as account_no"),
                DB::raw('COUNT(so.id) as orders_closed'),
                DB::raw('SUM(so.total_amount) as total_sales_volume'),
                DB::raw('SUM(so.paid_amount) as total_collected_volume'),
                // Standard 3% commission on collected sales
                DB::raw('SUM(so.paid_amount * 0.03) as commission_earned'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('so.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('so.order_date', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('commission_earned', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $commission = (float) $row->commission_earned;

                return [
                    'employee_code' => $row->employee_code,
                    'salesperson_name' => $row->salesperson_name,
                    'orders_closed' => (int) $row->orders_closed,
                    'sales_volume' => (float) $row->total_sales_volume,
                    'collected_volume' => (float) $row->total_collected_volume,
                    'commission_rate' => '3.00%',
                    'commission_earned' => $commission,
                    'payout_channel' => $row->payment_channel,
                    'account_number' => $row->account_no,
                    'payout_status' => $commission > 0 ? 'Accrued (Pending Payroll Batch)' : 'No Commission',
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
     * Summary metrics across the tenant's workforce and payroll.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

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
