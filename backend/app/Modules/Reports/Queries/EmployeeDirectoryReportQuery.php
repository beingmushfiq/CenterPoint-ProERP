<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\HRDataProvider;

class EmployeeDirectoryReportQuery implements ReportQueryInterface
{
    protected HRDataProvider $provider;

    public function __construct(?HRDataProvider $provider = null)
    {
        $this->provider = $provider ?? new HRDataProvider();
    }

    public function columns(): array
    {
        return [
            'employee_code' => ['label' => 'Employee ID', 'type' => 'string', 'sortable' => true],
            'name' => ['label' => 'Full Name', 'type' => 'string'],
            'department' => ['label' => 'Department', 'type' => 'string'],
            'designation' => ['label' => 'Designation', 'type' => 'string'],
            'line' => ['label' => 'Production Line', 'type' => 'string'],
            'employment_type' => ['label' => 'Type', 'type' => 'badge'],
            'date_of_joining' => ['label' => 'Joining Date', 'type' => 'date'],
            'phone' => ['label' => 'Contact Number', 'type' => 'string'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->employeeDirectory($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
