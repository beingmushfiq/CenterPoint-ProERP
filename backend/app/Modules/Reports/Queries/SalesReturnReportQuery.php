<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesReturnReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'return_number' => 
  array (
    'label' => 'Return No',
    'type' => 'string',
    'sortable' => true,
  ),
  'return_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'customer_name' => 
  array (
    'label' => 'Customer',
    'type' => 'string',
  ),
  'warehouse_name' => 
  array (
    'label' => 'Restock Warehouse',
    'type' => 'string',
  ),
  'credit_note_number' => 
  array (
    'label' => 'Credit Note No',
    'type' => 'string',
  ),
  'subtotal' => 
  array (
    'label' => 'Subtotal (BDT)',
    'type' => 'currency',
  ),
  'tax_amount' => 
  array (
    'label' => 'Tax Reversal (BDT)',
    'type' => 'currency',
  ),
  'total_amount' => 
  array (
    'label' => 'Refund Total (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'reason' => 
  array (
    'label' => 'Return Reason',
    'type' => 'string',
  ),
  'status' => 
  array (
    'label' => 'Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesReturn($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
