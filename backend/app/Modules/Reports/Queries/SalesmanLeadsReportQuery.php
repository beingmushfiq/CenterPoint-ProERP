<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class SalesmanLeadsReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider();
    }

    public function columns(): array
    {
        return [
            'representative_name' => ['label' => 'Sales Representative', 'type' => 'string', 'sortable' => true],
            'representative_email' => ['label' => 'Email', 'type' => 'string'],
            'total_assigned_leads' => ['label' => 'Total Assigned', 'type' => 'number', 'sortable' => true],
            'active_leads' => ['label' => 'Active Inquiries', 'type' => 'number'],
            'converted_leads' => ['label' => 'Won / Converted', 'type' => 'number'],
            'fake_leads' => ['label' => 'Flagged Invalid', 'type' => 'number'],
            'conversion_rate' => ['label' => 'Conversion Rate %', 'type' => 'percentage'],
            'pipeline_value' => ['label' => 'Pipeline Value (BDT)', 'type' => 'currency', 'sortable' => true],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanWorkload($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
