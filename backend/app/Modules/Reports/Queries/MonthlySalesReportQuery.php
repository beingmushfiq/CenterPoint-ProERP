<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class MonthlySalesReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'month' => 
  array (
    'label' => 'Month',
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
    'label' => 'Total Sales Revenue (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'collected_amount' => 
  array (
    'label' => 'Realized Cash (BDT)',
    'type' => 'currency',
  ),
  'due_amount' => 
  array (
    'label' => 'Due Amount (BDT)',
    'type' => 'currency',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->monthlySales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
