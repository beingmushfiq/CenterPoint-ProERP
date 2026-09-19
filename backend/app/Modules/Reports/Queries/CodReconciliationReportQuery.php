<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class CodReconciliationReportQuery implements ReportQueryInterface
{
    protected DeliveryDataProvider $provider;

    public function __construct(?DeliveryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new DeliveryDataProvider();
    }

    public function columns(): array
    {
        return array (
  'delivery_number' => 
  array (
    'label' => 'Shipment Tracking No',
    'type' => 'string',
    'sortable' => true,
  ),
  'recipient_name' => 
  array (
    'label' => 'Customer',
    'type' => 'string',
  ),
  'courier_name' => 
  array (
    'label' => 'Courier Partner',
    'type' => 'string',
  ),
  'delivery_status' => 
  array (
    'label' => 'Delivery Status',
    'type' => 'badge',
  ),
  'delivered_at' => 
  array (
    'label' => 'Delivery Timestamp',
    'type' => 'string',
  ),
  'cod_amount' => 
  array (
    'label' => 'COD Invoiced (BDT)',
    'type' => 'currency',
  ),
  'collected_amount' => 
  array (
    'label' => 'Courier Remitted (BDT)',
    'type' => 'currency',
  ),
  'variance' => 
  array (
    'label' => 'Settlement Variance (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'cod_status' => 
  array (
    'label' => 'Remittance Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->codReconciliation($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
