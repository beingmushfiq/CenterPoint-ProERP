<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class MonthlyProfitReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'month' => [
                'label' => 'Month',
                'type' => 'string',
                'sortable' => true,
            ],
            'orders_count' => [
                'label' => 'Orders Processed',
                'type' => 'number',
            ],
            'revenue' => [
                'label' => 'Total Revenue (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'cost_of_goods' => [
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
        return $this->provider->monthlyProfit($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
