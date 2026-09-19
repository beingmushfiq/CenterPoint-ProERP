<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class DailyProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return [
            'date' => ['label' => 'Date', 'type' => 'date', 'sortable' => true],
            'line_name' => ['label' => 'Production Line', 'type' => 'string'],
            'shift_name' => ['label' => 'Shift', 'type' => 'string'],
            'batches_count' => ['label' => 'Batches Run', 'type' => 'number'],
            'planned_quantity' => ['label' => 'Planned Qty', 'type' => 'number'],
            'actual_quantity' => ['label' => 'Actual Produced', 'type' => 'number', 'sortable' => true],
            'scrap_quantity' => ['label' => 'Scrap / Wastage', 'type' => 'number'],
            'adherence_percent' => ['label' => 'Schedule Adherence %', 'type' => 'percentage'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->dailyOutput($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
