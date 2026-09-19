<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionYieldReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return [
            'batch_number' => ['label' => 'Batch Number', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product / SKU', 'type' => 'string'],
            'line_name' => ['label' => 'Line', 'type' => 'string'],
            'batch_date' => ['label' => 'Batch Date', 'type' => 'date', 'sortable' => true],
            'planned_quantity' => ['label' => 'Planned Qty', 'type' => 'number'],
            'actual_quantity' => ['label' => 'Produced Qty', 'type' => 'number'],
            'rejected_quantity' => ['label' => 'Variance / Scrap', 'type' => 'number'],
            'yield_percentage' => ['label' => 'Yield Efficiency %', 'type' => 'percentage'],
            'status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->yield($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
