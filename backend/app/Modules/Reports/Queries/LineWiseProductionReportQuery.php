<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class LineWiseProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider;
    }

    public function columns(): array
    {
        return [
            'line_code' => [
                'label' => 'Line Code',
                'type' => 'string',
                'sortable' => true,
            ],
            'line_name' => [
                'label' => 'Production Line',
                'type' => 'string',
            ],
            'capacity' => [
                'label' => 'Shift Capacity',
                'type' => 'number',
            ],
            'batches_count' => [
                'label' => 'Batches',
                'type' => 'number',
            ],
            'planned_quantity' => [
                'label' => 'Planned Target',
                'type' => 'number',
            ],
            'actual_quantity' => [
                'label' => 'Actual Output',
                'type' => 'number',
                'sortable' => true,
            ],
            'rejected_quantity' => [
                'label' => 'Scrap Qty',
                'type' => 'number',
            ],
            'efficiency_percentage' => [
                'label' => 'Efficiency (%)',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->lineWiseProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
