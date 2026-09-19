<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanIncentiveAccrualReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'salesman_name' => 
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
  'total_sales' => 
  array (
    'label' => 'Total Bookings (BDT)',
    'type' => 'currency',
  ),
  'collected_sales' => 
  array (
    'label' => 'Realized Collections (BDT)',
    'type' => 'currency',
  ),
  'incentive_rate' => 
  array (
    'label' => 'Incentive Rate',
    'type' => 'string',
  ),
  'accrued_incentive' => 
  array (
    'label' => 'Incentive Payable (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanIncentiveAccrual($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
