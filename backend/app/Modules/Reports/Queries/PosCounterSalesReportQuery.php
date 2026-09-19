<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class PosCounterSalesReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return array (
  'order_number' => 
  array (
    'label' => 'POS Bill No',
    'type' => 'string',
    'sortable' => true,
  ),
  'order_date' => 
  array (
    'label' => 'Date & Time',
    'type' => 'string',
  ),
  'customer_name' => 
  array (
    'label' => 'Customer',
    'type' => 'string',
  ),
  'cashier' => 
  array (
    'label' => 'Cashier / Counter Agent',
    'type' => 'string',
  ),
  'subtotal' => 
  array (
    'label' => 'Subtotal (BDT)',
    'type' => 'currency',
  ),
  'discount_amount' => 
  array (
    'label' => 'Discount (BDT)',
    'type' => 'currency',
  ),
  'tax_amount' => 
  array (
    'label' => 'VAT / Tax (BDT)',
    'type' => 'currency',
  ),
  'total_amount' => 
  array (
    'label' => 'Total Amount (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'paid_amount' => 
  array (
    'label' => 'Paid (BDT)',
    'type' => 'currency',
  ),
  'payment_status' => 
  array (
    'label' => 'Payment Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->posCounterSales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
