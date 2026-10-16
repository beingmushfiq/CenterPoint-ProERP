<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class MonthlyProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider;
    }

    public function columns(): array
    {
        return [
            'month' => [
                'label' => 'Month',
                'type' => 'string',
                'sortable' => true,
            ],
            'batches_count' => [
                'label' => 'Batches Run',
                'type' => 'number',
            ],
            'planned_quantity' => [
                'label' => 'Planned Qty',
                'type' => 'number',
            ],
            'actual_quantity' => [
                'label' => 'Actual Output',
                'type' => 'number',
                'sortable' => true,
            ],
            'rejected_quantity' => [
                'label' => 'Rejection / Scrap',
                'type' => 'number',
            ],
            'yield_percentage' => [
                'label' => 'Yield (%)',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->monthlyProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
