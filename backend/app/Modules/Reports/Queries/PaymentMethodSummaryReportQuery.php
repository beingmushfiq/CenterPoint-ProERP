<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class PaymentMethodSummaryReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider();
    }

    public function columns(): array
    {
        return array (
  'payment_method' => 
  array (
    'label' => 'Payment Channel',
    'type' => 'string',
    'sortable' => true,
  ),
  'transaction_count' => 
  array (
    'label' => 'Transactions Count',
    'type' => 'number',
    'sortable' => true,
  ),
  'total_inflow' => 
  array (
    'label' => 'Total Inflows (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'total_outflow' => 
  array (
    'label' => 'Total Outflows (BDT)',
    'type' => 'currency',
  ),
  'net_cash_flow' => 
  array (
    'label' => 'Net Liquidity Flow (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->paymentMethodSummary($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
