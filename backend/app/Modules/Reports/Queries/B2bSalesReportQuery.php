<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class B2bSalesReportQuery implements ReportQueryInterface
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
    'label' => 'Invoice / Order No',
    'type' => 'string',
    'sortable' => true,
  ),
  'order_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'customer_name' => 
  array (
    'label' => 'Corporate / B2B Client',
    'type' => 'string',
  ),
  'salesperson' => 
  array (
    'label' => 'Account Manager',
    'type' => 'string',
  ),
  'branch' => 
  array (
    'label' => 'Branch',
    'type' => 'string',
  ),
  'grand_total' => 
  array (
    'label' => 'Order Total (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'paid_amount' => 
  array (
    'label' => 'Paid (BDT)',
    'type' => 'currency',
  ),
  'due_amount' => 
  array (
    'label' => 'Outstanding (BDT)',
    'type' => 'currency',
  ),
  'status' => 
  array (
    'label' => 'Fulfillment Status',
    'type' => 'badge',
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
        return $this->provider->b2bSales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
