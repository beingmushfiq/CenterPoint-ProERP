<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanRemainingTargetReportQuery implements ReportQueryInterface
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
  'monthly_target' => 
  array (
    'label' => 'Sales Target (BDT)',
    'type' => 'currency',
  ),
  'achieved_amount' => 
  array (
    'label' => 'Closed Sales (BDT)',
    'type' => 'currency',
  ),
  'remaining_gap' => 
  array (
    'label' => 'Target Deficit (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'status' => 
  array (
    'label' => 'Target Gap Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanRemainingTarget($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
