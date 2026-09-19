<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanProfitabilityReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'salesperson_name' => 
  array (
    'label' => 'Sales Representative',
    'type' => 'string',
    'sortable' => true,
  ),
  'orders_count' => 
  array (
    'label' => 'Deals Closed',
    'type' => 'number',
  ),
  'total_revenue' => 
  array (
    'label' => 'Sales Volume (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'total_cogs' => 
  array (
    'label' => 'Delivered COGS (BDT)',
    'type' => 'currency',
  ),
  'gross_profit' => 
  array (
    'label' => 'Profit Generated (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'margin_percent' => 
  array (
    'label' => 'Gross Margin (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanProfitability($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
