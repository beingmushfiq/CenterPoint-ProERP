<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanLeaderboardReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'rank' => [
                'label' => 'Rank',
                'type' => 'string',
            ],
            'salesman_name' => [
                'label' => 'Salesperson',
                'type' => 'string',
                'sortable' => true,
            ],
            'deals_closed' => [
                'label' => 'Deals Closed',
                'type' => 'number',
            ],
            'total_volume' => [
                'label' => 'Total Sales (BDT)',
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
        return $this->provider->salesmanLeaderboard($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
