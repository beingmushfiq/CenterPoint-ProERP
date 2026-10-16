<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class LeadStatusDistributionReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider;
    }

    public function columns(): array
    {
        return [
            'stage' => [
                'label' => 'Pipeline Stage',
                'type' => 'string',
                'sortable' => true,
            ],
            'leads_count' => [
                'label' => 'Total Prospects',
                'type' => 'number',
                'sortable' => true,
            ],
            'pipeline_value' => [
                'label' => 'Pipeline Value (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'average_deal_size' => [
                'label' => 'Avg Deal Size (BDT)',
                'type' => 'currency',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->leadStatusDistribution($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
