<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class B2cSalesReportQuery implements ReportQueryInterface
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
    'label' => 'Order No',
    'type' => 'string',
    'sortable' => true,
  ),
  'order_date' => 
  array (
    'label' => 'Order Date',
    'type' => 'date',
  ),
  'channel' => 
  array (
    'label' => 'Sales Channel',
    'type' => 'badge',
  ),
  'customer_name' => 
  array (
    'label' => 'Customer Name',
    'type' => 'string',
  ),
  'phone' => 
  array (
    'label' => 'Phone',
    'type' => 'string',
  ),
  'grand_total' => 
  array (
    'label' => 'Total (BDT)',
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
  'status' => 
  array (
    'label' => 'Order Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->b2cSales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
