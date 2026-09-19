<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanProfitContributionReportQuery implements ReportQueryInterface
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
    'label' => 'Salesperson',
    'type' => 'string',
    'sortable' => true,
  ),
  'orders_count' => 
  array (
    'label' => 'Orders Count',
    'type' => 'number',
  ),
  'total_revenue' => 
  array (
    'label' => 'Revenue Generated (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'total_cogs' => 
  array (
    'label' => 'COGS (BDT)',
    'type' => 'currency',
  ),
  'gross_profit' => 
  array (
    'label' => 'Profit Margin (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'margin_percent' => 
  array (
    'label' => 'Net Margin (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanProfitContribution($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
