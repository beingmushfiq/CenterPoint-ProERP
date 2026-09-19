<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\HRDataProvider;

class DailyAttendanceReportQuery implements ReportQueryInterface
{
    protected HRDataProvider $provider;

    public function __construct(?HRDataProvider $provider = null)
    {
        $this->provider = $provider ?? new HRDataProvider();
    }

    public function columns(): array
    {
        return [
            'date' => ['label' => 'Date', 'type' => 'date', 'sortable' => true],
            'employee_code' => ['label' => 'Employee ID', 'type' => 'string'],
            'name' => ['label' => 'Employee Name', 'type' => 'string'],
            'shift' => ['label' => 'Shift', 'type' => 'string'],
            'check_in' => ['label' => 'In Time', 'type' => 'time'],
            'check_out' => ['label' => 'Out Time', 'type' => 'time'],
            'worked_hours' => ['label' => 'Hours Worked', 'type' => 'number'],
            'late_minutes' => ['label' => 'Late (Min)', 'type' => 'number'],
            'status' => ['label' => 'Attendance Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->dailyAttendance($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
