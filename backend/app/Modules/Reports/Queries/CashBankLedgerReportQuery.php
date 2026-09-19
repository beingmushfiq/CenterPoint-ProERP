<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class CashBankLedgerReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider();
    }

    public function columns(): array
    {
        return array (
  'payment_number' => 
  array (
    'label' => 'Voucher / Ref No',
    'type' => 'string',
    'sortable' => true,
  ),
  'payment_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'party_name' => 
  array (
    'label' => 'Counterparty Name',
    'type' => 'string',
  ),
  'direction' => 
  array (
    'label' => 'Cash Flow Direction',
    'type' => 'badge',
  ),
  'payment_method' => 
  array (
    'label' => 'Account / Channel',
    'type' => 'badge',
  ),
  'reference' => 
  array (
    'label' => 'External Cheque / Trx ID',
    'type' => 'string',
  ),
  'inflow_amount' => 
  array (
    'label' => 'Inflow (BDT)',
    'type' => 'currency',
  ),
  'outflow_amount' => 
  array (
    'label' => 'Outflow (BDT)',
    'type' => 'currency',
  ),
  'net_amount' => 
  array (
    'label' => 'Net Movement (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'status' => 
  array (
    'label' => 'Posting Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->cashBankLedger($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
