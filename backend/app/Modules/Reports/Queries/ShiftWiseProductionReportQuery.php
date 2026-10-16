<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ShiftWiseProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider;
    }

    public function columns(): array
    {
        return [
            'shift_code' => [
                'label' => 'Shift Code',
                'type' => 'string',
                'sortable' => true,
            ],
            'shift_name' => [
                'label' => 'Operational Shift',
                'type' => 'string',
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
                'label' => 'Actual Produced',
                'type' => 'number',
                'sortable' => true,
            ],
            'rejected_quantity' => [
                'label' => 'Scrap',
                'type' => 'number',
            ],
            'achievement_percentage' => [
                'label' => 'Adherence (%)',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->shiftWiseProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
