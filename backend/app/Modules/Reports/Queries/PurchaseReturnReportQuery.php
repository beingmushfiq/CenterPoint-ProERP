<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class PurchaseReturnReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider();
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
    'label' => 'Return Date',
    'type' => 'date',
  ),
  'supplier_name' => 
  array (
    'label' => 'Supplier',
    'type' => 'string',
  ),
  'warehouse_name' => 
  array (
    'label' => 'Warehouse',
    'type' => 'string',
  ),
  'debit_note_number' => 
  array (
    'label' => 'Debit Note No',
    'type' => 'string',
  ),
  'subtotal' => 
  array (
    'label' => 'Subtotal (BDT)',
    'type' => 'currency',
  ),
  'tax_amount' => 
  array (
    'label' => 'Tax (BDT)',
    'type' => 'currency',
  ),
  'total_amount' => 
  array (
    'label' => 'Total Return Value (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'status' => 
  array (
    'label' => 'Return Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->purchaseReturn($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
