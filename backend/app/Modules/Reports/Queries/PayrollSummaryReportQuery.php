<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\HRDataProvider;

class PayrollSummaryReportQuery implements ReportQueryInterface
{
    protected HRDataProvider $provider;

    public function __construct(?HRDataProvider $provider = null)
    {
        $this->provider = $provider ?? new HRDataProvider();
    }

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
        return $this->provider->payrollSummary($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
