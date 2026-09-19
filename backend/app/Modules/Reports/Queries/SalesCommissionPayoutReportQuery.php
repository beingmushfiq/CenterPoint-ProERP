<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\HRDataProvider;

class SalesCommissionPayoutReportQuery implements ReportQueryInterface
{
    protected HRDataProvider $provider;

    public function __construct(?HRDataProvider $provider = null)
    {
        $this->provider = $provider ?? new HRDataProvider();
    }

    public function columns(): array
    {
        return array (
  'employee_code' => 
  array (
    'label' => 'Employee ID',
    'type' => 'string',
    'sortable' => true,
  ),
  'salesperson_name' => 
  array (
    'label' => 'Sales Representative',
    'type' => 'string',
  ),
  'orders_closed' => 
  array (
    'label' => 'Deals Closed',
    'type' => 'number',
  ),
  'sales_volume' => 
  array (
    'label' => 'Sales Volume (BDT)',
    'type' => 'currency',
  ),
  'collected_volume' => 
  array (
    'label' => 'Collected Volume (BDT)',
    'type' => 'currency',
  ),
  'commission_rate' => 
  array (
    'label' => 'Commission Rate',
    'type' => 'string',
  ),
  'commission_earned' => 
  array (
    'label' => 'Commission Accrued (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'payout_channel' => 
  array (
    'label' => 'Payout Method',
    'type' => 'string',
  ),
  'account_number' => 
  array (
    'label' => 'Account / Wallet',
    'type' => 'string',
  ),
  'payout_status' => 
  array (
    'label' => 'Payout Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesCommissionPayout($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
