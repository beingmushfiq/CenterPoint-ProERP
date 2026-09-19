<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesByProductReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return [
            'sku' => ['label' => 'SKU', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product Name', 'type' => 'string', 'sortable' => true],
            'category' => ['label' => 'Category', 'type' => 'string'],
            'orders_count' => ['label' => 'Orders', 'type' => 'number'],
            'quantity_sold' => ['label' => 'Qty Sold', 'type' => 'number'],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_revenue' => ['label' => 'Revenue (BDT)', 'type' => 'currency', 'sortable' => true],
            'total_cogs' => ['label' => 'COGS (BDT)', 'type' => 'currency'],
            'gross_profit' => ['label' => 'Gross Profit (BDT)', 'type' => 'currency'],
            'margin_percent' => ['label' => 'Margin %', 'type' => 'percentage'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->byProduct($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
