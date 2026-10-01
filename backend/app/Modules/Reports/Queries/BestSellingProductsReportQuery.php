<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class BestSellingProductsReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return [
            'rank' => ['label' => 'Rank', 'type' => 'number', 'sortable' => true],
            'sku' => ['label' => 'SKU', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product Name', 'type' => 'string', 'sortable' => true],
            'category' => ['label' => 'Category', 'type' => 'string'],
            'brand' => ['label' => 'Brand', 'type' => 'string'],
            'orders_count' => ['label' => 'Orders', 'type' => 'number'],
            'units_sold' => ['label' => 'Units Sold', 'type' => 'number', 'sortable' => true],
            'avg_selling_price' => ['label' => 'Avg Price (BDT)', 'type' => 'currency'],
            'total_revenue' => ['label' => 'Total Revenue (BDT)', 'type' => 'currency', 'sortable' => true],
            'gross_profit' => ['label' => 'Gross Profit (BDT)', 'type' => 'currency', 'sortable' => true],
            'margin_percent' => ['label' => 'Margin %', 'type' => 'percentage'],
            'sales_velocity' => ['label' => 'Velocity (Pcs/Day)', 'type' => 'number'],
            'revenue_share_percent' => ['label' => 'Revenue Share %', 'type' => 'percentage'],
            'velocity_tier' => ['label' => 'Velocity Tier', 'type' => 'status_badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->bestSellingProducts($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->bestSellingSummary($filters);
    }
}
