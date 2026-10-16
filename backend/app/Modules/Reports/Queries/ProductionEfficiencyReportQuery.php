<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionEfficiencyReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider;
    }

    public function columns(): array
    {
        return [
            'batch_number' => [
                'label' => 'Batch No',
                'type' => 'string',
                'sortable' => true,
            ],
            'batch_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'sku' => [
                'label' => 'SKU',
                'type' => 'string',
            ],
            'product_name' => [
                'label' => 'Product Name',
                'type' => 'string',
            ],
            'line_name' => [
                'label' => 'Line',
                'type' => 'string',
            ],
            'planned_quantity' => [
                'label' => 'Planned Qty',
                'type' => 'number',
            ],
            'actual_quantity' => [
                'label' => 'Actual Output',
                'type' => 'number',
            ],
            'yield_percentage' => [
                'label' => 'Yield (%)',
                'type' => 'string',
                'sortable' => true,
            ],
            'variance_percentage' => [
                'label' => 'Variance (%)',
                'type' => 'string',
            ],
            'efficiency_rating' => [
                'label' => 'Performance Band',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productionEfficiency($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
