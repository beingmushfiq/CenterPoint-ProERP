<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class SupplierApAgingReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider();
    }

    public function columns(): array
    {
        return array (
  'supplier_code' => 
  array (
    'label' => 'Supplier Code',
    'type' => 'string',
    'sortable' => true,
  ),
  'supplier_name' => 
  array (
    'label' => 'Supplier Name',
    'type' => 'string',
  ),
  'current_30' => 
  array (
    'label' => '0-30 Days (BDT)',
    'type' => 'currency',
  ),
  'days_31_60' => 
  array (
    'label' => '31-60 Days (BDT)',
    'type' => 'currency',
  ),
  'days_61_90' => 
  array (
    'label' => '61-90 Days (BDT)',
    'type' => 'currency',
  ),
  'days_over_90' => 
  array (
    'label' => 'Over 90 Days (BDT)',
    'type' => 'currency',
  ),
  'total_due' => 
  array (
    'label' => 'Total Payable (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->supplierApAging($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
