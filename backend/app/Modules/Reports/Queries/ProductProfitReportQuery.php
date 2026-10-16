<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class ProductProfitReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'sku' => [
                'label' => 'SKU',
                'type' => 'string',
                'sortable' => true,
            ],
            'product_name' => [
                'label' => 'Product Name',
                'type' => 'string',
            ],
            'category' => [
                'label' => 'Category',
                'type' => 'string',
            ],
            'units_sold' => [
                'label' => 'Units Sold',
                'type' => 'number',
            ],
            'revenue' => [
                'label' => 'Gross Revenue (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'total_cost' => [
                'label' => 'COGS (BDT)',
                'type' => 'currency',
            ],
            'gross_profit' => [
                'label' => 'Gross Profit (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'margin_percent' => [
                'label' => 'Margin (%)',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productProfit($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
