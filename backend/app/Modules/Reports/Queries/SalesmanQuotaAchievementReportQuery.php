<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesmanQuotaAchievementReportQuery implements ReportQueryInterface
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
  'orders_closed' => 
  array (
    'label' => 'Orders Closed',
    'type' => 'number',
  ),
  'target_quota' => 
  array (
    'label' => 'Monthly Target (BDT)',
    'type' => 'currency',
  ),
  'achieved_revenue' => 
  array (
    'label' => 'Achieved Sales (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'achievement_percent' => 
  array (
    'label' => 'Quota Attainment (%)',
    'type' => 'string',
  ),
  'status' => 
  array (
    'label' => 'Quota Rating',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesmanQuotaAchievement($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
