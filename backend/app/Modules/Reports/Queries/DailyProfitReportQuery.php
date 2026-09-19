<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class DailyProfitReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
    'sortable' => true,
  ),
  'orders_count' => 
  array (
    'label' => 'Orders',
    'type' => 'number',
  ),
  'revenue' => 
  array (
    'label' => 'Revenue (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'cost_of_goods' => 
  array (
    'label' => 'COGS (BDT)',
    'type' => 'currency',
  ),
  'gross_profit' => 
  array (
    'label' => 'Gross Profit (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'margin_percent' => 
  array (
    'label' => 'Margin (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->dailyProfit($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
