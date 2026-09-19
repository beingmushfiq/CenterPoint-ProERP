<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class LeadSummaryReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider();
    }

    public function columns(): array
    {
        return [
            'lead_number' => ['label' => 'Lead #', 'type' => 'string', 'sortable' => true],
            'contact_name' => ['label' => 'Contact Name', 'type' => 'string'],
            'company_name' => ['label' => 'Company / Organization', 'type' => 'string'],
            'phone' => ['label' => 'Phone', 'type' => 'string'],
            'source' => ['label' => 'Source Channel', 'type' => 'badge'],
            'stage' => ['label' => 'Pipeline Stage', 'type' => 'badge'],
            'expected_value' => ['label' => 'Deal Value (BDT)', 'type' => 'currency', 'sortable' => true],
            'expected_close_date' => ['label' => 'Target Close', 'type' => 'date'],
            'assigned_rep' => ['label' => 'Sales Representative', 'type' => 'string'],
            'is_fake' => ['label' => 'Verification', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->pipelineSummary($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
